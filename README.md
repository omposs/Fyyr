# Blue Science Park backend

FastAPI + SQLAlchemy (SQLite for now). Runs fully offline with a mock LLM; set `BSP_ANTHROPIC_API_KEY` to use Claude.

## Run

    python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
    .venv/bin/python -m app.seed          # demo admin + 3 fictional members; prints their API tokens
    .venv/bin/uvicorn app.main:app --reload   # docs at /docs
    .venv/bin/pytest

Auth is a per-member `X-Member-Token` header (placeholder for real auth/SSO).

## Config (env, prefix `BSP_`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | default `sqlite:///./bsp.db` |
| `ANTHROPIC_API_KEY` | unset = deterministic mock provider |
| `LLM_MODEL` | default `claude-sonnet-5-5` |
| `FETCH_ALLOWED_DOMAINS` | JSON list, e.g. `["example.com"]`. Empty = no live web fetching |

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

Edit `feeds.json` to fix or add feeds (`enabled`, `include` keyword filter, `location` default).
Profile a real company from a page you choose (needs normal internet):

    .venv/bin/python -m app.profile_company "Saab" https://www.saab.com/about

Pages rendered by JavaScript return little text; the command warns when that happens.
With the offline mock, profiles come from a keyword lexicon (`app/llm/mock.py`) and will be thin.

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
