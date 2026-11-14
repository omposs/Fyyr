# Blue Science Park backend

FastAPI + SQLAlchemy (SQLite for now). Runs fully offline with a mock LLM; set `BSP_ANTHROPIC_API_KEY` to use Claude.

## Run

    python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
    .venv/bin/python -m app.seed          # demo admin + 3 fictional members; prints their API tokens
    .venv/bin/uvicorn app.main:app --reload   # docs at /docs
    .venv/bin/pytest

Auth is a per-member `X-Member-Token` header (placeholder for real auth/SSO).
In `/docs`, click **Authorize** once and paste a token; it is then sent with every request.

**CORS (for the frontend).** Browsers may only call the API from origins in `BSP_CORS_ORIGINS`. The default
allows `localhost`/`127.0.0.1` on ports 3000, 5173, 4200 and 8080. For another origin, set a JSON list:
`export BSP_CORS_ORIGINS='["http://localhost:4200","https://demo.example.org"]'`. Credentials/cookies are off:
the token is sent in the `X-Member-Token` header by the frontend (keep it in memory, not in a URL).

## Config (env, prefix `BSP_`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | default `sqlite:///./bsp.db` |
| `ANTHROPIC_API_KEY` | unset = deterministic mock provider |
| `LLM_MODEL` | default `claude-sonnet-5-5` |
| `FETCH_ALLOWED_DOMAINS` | JSON list, e.g. `["ericsson.com","saab.com"]`. Empty = API/refresh will not crawl |
| `LLM_PROVIDER` | `auto` (default: Claude if a key is set, else mock), `anthropic`, `openai_compat`, `mock` |
| `OPENAI_BASE_URL`, `OPENAI_MODEL` | for `openai_compat`, default Ollama at `http://localhost:11434/v1`, model `llama3.1` |
| `STALE_AFTER_DAYS` | agent-found items not re-seen for this long are flagged `stale` (default 180) |
| `CRAWL_MAX_PAGES`, `CRAWL_DELAY_SECONDS` | crawler limits (default 5 pages, 1 s between requests) |

## Layout

    app/agents/profiling.py     profiling agent (validation, provenance, company-edit rules)
    app/monitoring/             feed ingestion + ranking + grounded "why this matters"
    app/matching/matcher.py     collaboration matching with evidence basis
    app/chat/assistant.py       chat pipeline
    app/guardrails/             injection.py, scope.py, access.py, output.py
    app/sources/fetcher.py      allowlisted, SSRF-safe fetching
    app/llm/                    provider interface, Anthropic provider, offline mock

## Real data

Feeds (events, funding, testbeds, news) are configured in `data/feeds.json`, RSS/Atom and iCal.
No feed URL there is verified yet: test from a normal network, not the cloud sandbox.

    .venv/bin/python -m app.feeds check     # probe each enabled feed, show which work
    .venv/bin/python -m app.feeds ingest    # store new items

Edit `feeds.json` to fix or add feeds (`enabled`, `include` keyword filter, `location` default, `note`).

News feeds are treated as pointers, not republished articles: only a short excerpt (default 300 characters,
`max_summary_chars`) and the link are stored, items older than 45 days are dropped (`max_age_days`), and
tracking parameters (`utm_*`, `fbclid` ...) are stripped from links so one article is not stored twice.
Enabled by default: The Maritime Executive (Atom) and ODEE (RSS). Both are general maritime or offshore news,
so expect them to rank low for telecom or defence profiles. Add feeds closer to each company.
Profile a real company from its site (needs normal internet). The crawler fetches the start page plus a few
same-site pages (about, products, technology ...), honours robots.txt, then runs the profiling agent:

    .venv/bin/python -m app.profile_company "Saab" https://www.saab.com/about

Keep profiles fresh (cron-friendly; only crawls hosts in `BSP_FETCH_ALLOWED_DOMAINS`):

    .venv/bin/python -m app.refresh_profiles

Pages rendered by JavaScript return little text; the commands warn when that happens.
With the offline mock, profiles come from a keyword lexicon (`app/llm/mock.py`) and will be thin.

Real extraction without a paid key, using Ollama (https://ollama.com):

    ollama pull llama3.1
    export BSP_LLM_PROVIDER=openai_compat
    .venv/bin/python -m app.profile_company "Saab" https://www.saab.com/about

Small local models follow the JSON format less reliably than Claude; malformed output is retried and
then the page is reported under `sources_failed` instead of being trusted.

Schema note: there are no migrations yet. After pulling a change that adds a column (for example
`last_seen_at`), delete `bsp.db` and run `python -m app.seed` again.

## Rules the code enforces

1. Every profile item has `source_url` and `source_date` (`company-edit` for company-authored items).
2. `stated` items must carry a verbatim quote found in the source text, otherwise they are rejected.
   `inferred` items are stored separately, private and unapproved until the company reviews them.
3. Company edits are final: the agent never overwrites company-authored items or re-adds removed ones.
4. Other members only see public items that are stated, or inferred-and-approved. Matching uses only
   those, on both sides, so an explanation can never reveal unpublished data.
5. The chat model has no tools and no database access. The server builds its context from rows the
   member may see, and the reply is checked before it is returned (secrets, other companies, citations).
6. Retrieved documents are untrusted: normalised, scanned, wrapped as data; flagged ones are held back.

## Known limits

* Similarity is TF-IDF behind `app/text.py`; swap for embeddings (pgvector) when moving to Postgres.
* Injection and scope checks are heuristics; the structural controls (4, 5) are what bound the damage.
* Score weights in ranking and matching are untuned; calibrate on real members.
* `recompute_matches` is O(n^2) in members; fine for a science park, batch it if that changes.


## Measuring quality

Without labels you cannot say whether a change made things better. `python -m app.eval` scores the real
profiling agent and the real news ranking against labels you write by hand. It uses a throw-away in-memory
database, so `bsp.db` is never touched, and whichever `BSP_LLM_PROVIDER` is active, so the same labels compare
the mock, Ollama and Claude. Each run prints the change since the previous run with that provider.

```
python -m app.eval run --dir data/eval/example     # shipped fictional example, works immediately
```

**Profiling.** Snapshot a company's pages once so every run sees identical text, then label them:

```
python -m app.eval snapshot ericsson "Ericsson" https://www.ericsson.com/en/about-us
# open data/eval/pages/ericsson.txt and fill in "items" in data/eval/profiles/ericsson.json
python -m app.eval run --only profiles
```

Each label is `{"category", "value", "aliases": [], "also_categories": []}`. `must_not` lists things the page
does not say that a model might invent. Reported: recall (labelled items found), precision against your labels,
recall per category, what was missed, what was extracted but is not in your labels, and `must_not` hits.
Only stated items are scored; inferred items are counted but not judged.

Matching is intentionally simple (same words after dropping plural s, or one side a subset covering at least
half of the other, or Jaccard >= 0.6). `5G` matches `5G networks`; `radio` does not match `radio access networks`.

**News ranking.** Ingest news, export it, label each item true or false for that company:

```
python -m app.feeds ingest
python -m app.eval labelsheet ericsson "Ericsson" --limit 40
# set "relevant": true/false on each item in data/eval/ranking/ericsson.json
python -m app.eval run --only ranking
```

The profile used for ranking is your labelled profile, so ranking quality is measured separately from
extraction quality. Reported: precision@5, the base rate (share of items that are relevant at all), lift over it,
recall@10, rank of the first relevant item, irrelevant items in the top 5 and relevant items never shown.
Compare precision@5 to the base rate, not to 1.0.

Caveats: precision is only as complete as your labels, so read the "extracted but not in your labels" list and add
anything correct. Label before changing the code or prompts, not after, or you will unconsciously fit the labels
to the output. Two labelled companies are a sanity check, not a benchmark.
