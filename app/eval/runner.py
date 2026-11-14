"""Loads label files, runs the real profiling agent and ranking code in a throw-away in-memory database
(your bsp.db is never touched), and scores the result.

Layout under the eval directory (default data/eval):
  pages/<slug>.txt       saved page text, pages separated by a line "=== <url> ===" (made by `snapshot`)
  profiles/<slug>.json   hand-made labels: what the profile SHOULD contain
  ranking/<slug>.json    hand-made relevance labels for news items, per company
  results/               last scores per kind and provider, so each run can show the change
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401  (register tables)
from app.agents.profiling import run_profiling, visible_items
from app.db import Base
from app.eval.metrics import Forbidden, Label, score_profile, score_ranking
from app.llm import get_provider
from app.models import Category, Kind, Member, MonitoredItem, Origin, ProfileItem, Visibility
from app.monitoring.ranking import recommend
from app.schemas import SourceDocIn

PAGE_MARK = re.compile(r"^=== (\S+) ===\s*$", re.MULTILINE)
MAX_DOC = 200_000


class EvalConfigError(Exception):
    pass


def _session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()


def _load_json(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise EvalConfigError(f"{path}: {e}") from e
    if not isinstance(data, dict):
        raise EvalConfigError(f"{path}: top level must be an object")
    return data


@dataclass
class ProfileLabels:
    slug: str
    company: str
    page: str
    source_url: str
    labels: list[Label]
    must_not: list[Forbidden]


def load_profile_labels(path: Path) -> ProfileLabels:
    d = _load_json(path)
    cats = {c.value for c in Category}
    labels: list[Label] = []
    for i, it in enumerate(d.get("items") or []):
        if not isinstance(it, dict) or it.get("category") not in cats or not str(it.get("value", "")).strip():
            raise EvalConfigError(f"{path}: items[{i}] needs category in {sorted(cats)} and a non-empty value")
        aliases = it.get("aliases") or []
        if not isinstance(aliases, list) or not all(isinstance(a, str) for a in aliases):
            raise EvalConfigError(f"{path}: items[{i}].aliases must be a list of strings")
        also = it.get("also_categories") or []
        if not isinstance(also, list) or any(c not in cats for c in also):
            raise EvalConfigError(f"{path}: items[{i}].also_categories must be a list of valid categories")
        labels.append(Label(it["category"], it["value"].strip(), aliases, also))
    must_not: list[Forbidden] = []
    for i, it in enumerate(d.get("must_not") or []):
        if not isinstance(it, dict) or not str(it.get("value", "")).strip() or it.get("category") not in (None, *cats):
            raise EvalConfigError(f"{path}: must_not[{i}] needs a value and an optional valid category")
        must_not.append(Forbidden(it["value"].strip(), it.get("category")))
    slug = path.stem
    return ProfileLabels(slug, d.get("company") or slug, d.get("page") or f"{slug}.txt",
                         d.get("source_url") or f"eval://{slug}", labels, must_not)


def split_pages(text: str, default_url: str) -> list[tuple[str, str]]:
    parts = PAGE_MARK.split(text)
    if len(parts) == 1:
        return [(default_url, text.strip())] if text.strip() else []
    docs = []
    for url, body in zip(parts[1::2], parts[2::2]):
        if body.strip():
            docs.append((url, body.strip()[:MAX_DOC]))
    return docs


def eval_profiles(root: Path) -> dict:
    provider = get_provider().name
    companies, skipped = [], []
    for path in sorted((root / "profiles").glob("*.json")):
        pl = load_profile_labels(path)
        if not pl.labels:
            skipped.append(f"{pl.slug}: no labels yet (fill in 'items' in {path})")
            continue
        page = root / "pages" / pl.page
        if not page.exists():
            skipped.append(f"{pl.slug}: no page snapshot at {page} (run: python -m app.eval snapshot)")
            continue
        docs = split_pages(page.read_text(encoding="utf-8"), pl.source_url)
        if not docs:
            skipped.append(f"{pl.slug}: page snapshot is empty")
            continue
        db = _session()
        try:
            m = Member(name=pl.company)
            db.add(m)
            db.commit()
            res = run_profiling(db, m, [SourceDocIn(url=u, title=pl.company, text=t,
                                                    published_at=datetime.now(timezone.utc).date()) for u, t in docs])
            items = visible_items(db, m.id, viewer_is_owner=True)
        finally:
            db.close()
        stated = [(i.category, i.value) for i in items if i.kind == Kind.stated.value]
        r = score_profile(pl.labels, stated, pl.must_not)
        r.update(slug=pl.slug, company=pl.company, inferred_unscored=sum(1 for i in items if i.kind == Kind.inferred.value),
                 rejected_by_agent=res.items_rejected, sources_failed=list(res.sources_failed))
        companies.append(r)
    agg = {"companies": len(companies), "provider": provider}
    if companies:
        tl, tf = sum(c["labels"] for c in companies), sum(c["found"] for c in companies)
        te, tc = sum(c["extracted"] for c in companies), sum(c["correct"] for c in companies)
        agg.update(recall=round(tf / tl, 3) if tl else None, precision=round(tc / te, 3) if te else None,
                   forbidden_hits=sum(len(c["forbidden_hits"]) for c in companies))
    return {"kind": "profiles", "aggregate": agg, "companies": companies, "skipped": skipped}


def eval_ranking(root: Path, k: int = 5) -> dict:
    provider = get_provider().name
    companies, skipped = [], []
    for path in sorted((root / "ranking").glob("*.json")):
        slug = path.stem
        d = _load_json(path)
        items = d.get("items") or []
        unlabelled = sum(1 for it in items if not isinstance(it, dict) or not isinstance(it.get("relevant"), bool))
        if not items or unlabelled:
            skipped.append(f"{slug}: {unlabelled or len(items)} item(s) have no true/false 'relevant' yet")
            continue
        ppath = root / "profiles" / f"{d.get('profile_from') or slug}.json"
        if not ppath.exists():
            skipped.append(f"{slug}: profile labels {ppath} not found")
            continue
        pl = load_profile_labels(ppath)
        if not pl.labels:
            skipped.append(f"{slug}: profile labels in {ppath} are empty")
            continue
        db = _session()
        try:
            m = Member(name=d.get("company") or slug)
            db.add(m)
            db.commit()
            now = datetime.now(timezone.utc)
            for l in pl.labels:  # ground-truth profile: isolates ranking from extraction quality
                db.add(ProfileItem(member_id=m.id, category=l.category, value=l.value, kind=Kind.stated.value,
                                   visibility=Visibility.public.value, origin=Origin.company.value,
                                   source_url="eval", source_date=now.date(), approved=True))
            rel_by_url: dict[str, bool] = {}
            for i, it in enumerate(items):
                url = f"eval://{slug}/{i}"
                rel_by_url[url] = it["relevant"]
                db.add(MonitoredItem(module="news", title=it.get("title", ""), summary=it.get("summary", ""), url=url,
                                     source_name="eval", location=it.get("location"), tags=it.get("tags") or [],
                                     published_at=now.date() - timedelta(days=int(it.get("published_days_ago", 3)))))
            db.commit()
            ranked = recommend(db, m, module="news", limit=len(items))
        finally:
            db.close()
        flags = [rel_by_url[r.url] for _, r in ranked]
        r = score_ranking(flags, sum(rel_by_url.values()), len(items), k=k)
        shown_urls = {r_.url for _, r_ in ranked}
        titles = {f"eval://{slug}/{i}": it.get("title", "") for i, it in enumerate(items)}
        r.update(slug=slug, company=d.get("company") or slug,
                 irrelevant_in_top=[titles[x.url] for _, x in ranked[:k] if not rel_by_url[x.url]],
                 relevant_not_shown=[titles[u] for u, rel in rel_by_url.items() if rel and u not in shown_urls])
        companies.append(r)
    agg = {"companies": len(companies), "provider": provider}
    key = f"precision_at_{k}"
    if companies:
        vals = [c[key] for c in companies if c[key] is not None]
        lifts = [c["lift_over_base_rate"] for c in companies if c["lift_over_base_rate"] is not None]
        agg.update({key: round(sum(vals) / len(vals), 3) if vals else None,
                    "lift_over_base_rate": round(sum(lifts) / len(lifts), 2) if lifts else None,
                    "relevant_not_shown": sum(len(c["relevant_not_shown"]) for c in companies)})
    return {"kind": "ranking", "aggregate": agg, "companies": companies, "skipped": skipped}


def save_and_diff(root: Path, result: dict) -> dict[str, float]:
    """Store this run's aggregate per kind and provider; return the change against the previous run."""
    out = root / "results"
    out.mkdir(parents=True, exist_ok=True)
    f = out / f"{result['kind']}-{result['aggregate']['provider']}.json"
    prev = json.loads(f.read_text()).get("aggregate", {}) if f.exists() else {}
    agg = result["aggregate"]
    f.write_text(json.dumps({"at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "aggregate": agg}, indent=2))
    return {k: round(v - prev[k], 3) for k, v in agg.items()
            if isinstance(v, (int, float)) and isinstance(prev.get(k), (int, float)) and k != "companies" and v != prev[k]}
