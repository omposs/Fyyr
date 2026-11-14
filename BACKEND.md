# Blue Science Park backend

FastAPI + SQLAlchemy (SQLite for now). Runs fully offline with a mock LLM; set `BSP_ANTHROPIC_API_KEY` to use Claude.

## Run

    python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
    .venv/bin/python -m app.seed          # demo admin + 3 fictional members; prints their API tokens
    .venv/bin/uvicorn app.main:app --reload   # docs at /docs
    .venv/bin/pytest

## Authentication

Members log in with email + password and get a session token:

```
POST /auth/login   {"email": "...", "password": "..."}   ->  {"access_token": "...", "expires_at": "...", ...}
```

Send it on every request as `Authorization: Bearer <access_token>`. In `/docs`, click **Authorize**, paste the token
into the bearer box, and every call carries it. `POST /auth/logout` ends the session; `POST /auth/change-password`
changes the password and signs out every other session.

- Passwords are hashed with scrypt (standard library) and never stored or logged in clear. Minimum 10 characters.
- Session tokens are random and only a SHA-256 hash is stored, so a leaked database does not leak live sessions.
  Sessions last `BSP_SESSION_HOURS` (default 12) and are revoked on logout, password change or admin reset.
- Wrong password and unknown email give the same answer and take the same time. After `BSP_LOGIN_MAX_FAILURES`
  (default 5) failed attempts for an email within `BSP_LOGIN_WINDOW_MINUTES` (15), further logins get 429.
  The counter is in memory, so it resets on restart.
- The older static `X-Member-Token` still works for scripts and local development. Once everyone logs in, set
  `BSP_ALLOW_API_TOKENS=false` to turn it off.

Give a member a login (they have none until you do). Either from the command line, typing the password hidden:

```
python -m app.accounts set-password "Saab" saab@example.org
python -m app.accounts create-admin "BSP Admin" admin@example.org
python -m app.accounts list
```

or over the API as an admin: `PUT /admin/members/{id}/credentials {"email","password"}`, or include `email` and
`password` in `POST /admin/members`.

**Local demo logins (development only).** Two fictional development personas. Nothing in this project sends email to these
addresses.

| Role | Person | Email | Password |
|---|---|---|---|
| Blue Science Park staff | Erik Andersson | `erik.andersson@bsp.se` | `DemoBSP2026!` |
| Saab member | Anna Johansson, Innovation Coordinator | `anna.johansson@saab.se` | `DemoBSP2026!` |

These are local development credentials; change them for anything shared.

```
python -m app.dev_accounts --check   # shows what would change
python -m app.dev_accounts           # updates the existing accounts in place (or creates them), idempotent
```

It is a command you run yourself: nothing calls it at startup, and it refuses to run if `BSP_ENVIRONMENT=production` or the
database is not a local SQLite file. It keeps each account's id, permissions (staff = admin, member = not admin), API token and
linked data, uses the normal scrypt hasher, and only sets a password when the stored hash does not already match, so running it
again changes nothing and signs nobody out. It also takes over the previous demo logins `stefanu@bsp.se` and `stefanu@saab.se`.
Set `BSP_DEV_STAFF_PASSWORD` / `BSP_DEV_MEMBER_PASSWORD` to use other passwords.

A member row is the **company** in this backend, so the Saab row keeps `name = "Saab"` (matching and profile use it). The person
shown in the interface (Anna Johansson, her job title, the greeting "Anna" and the initials AJ) comes from the demo profile data in
`frontend/src/member/data.js`; in live content mode the backend has no person-name field, so no personal name is shown there.
For the frontend dev server use an allowed origin (default port 5173).

Not built: password reset by email, single sign-on, two-factor. Run behind HTTPS in any real deployment.

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

Schema note: at start-up an older SQLite file is upgraded automatically for the simple case of NEW columns
(`app/migrate.py`, add-only, keeps your data). It cannot rename, retype or drop columns, and it is SQLite-only.
For that, or for Postgres, switch to Alembic.

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


## Automatic refresh

The API process runs a small background scheduler (`app/scheduler.py`), on by default:

| Job | Default | What it does |
|---|---|---|
| `feeds` | every 60 min | ingests every enabled feed in `data/feeds.json` (news, events, ...) |
| `profiles` | every 24 h | re-profiles members whose website host is in `BSP_FETCH_ALLOWED_DOMAINS` |
| `matches` | every 24 h | recomputes collaboration matches |
| `maintenance` | hourly | removes sessions that expired more than 7 days ago |

Settings: `BSP_SCHEDULER_ENABLED`, `BSP_SCHEDULER_INITIAL_DELAY_SECONDS` (30), `BSP_FEEDS_REFRESH_MINUTES`,
`BSP_PROFILES_REFRESH_HOURS`. A failing job is recorded and retried at its next interval; it never stops the others.
Admins see the last result of each job at `GET /admin/scheduler` and can run one now with
`POST /admin/scheduler/{job}/run`.

Profiles are only refreshed for hosts you allow, so for Saab and Marine Technology Center set, for example:
`export BSP_FETCH_ALLOWED_DOMAINS='["saab.com","www.saab.com"]'` (the JSON list must name each host used).

Run exactly ONE server process (no `--workers N`): each worker would run every job. For several workers, set
`BSP_SCHEDULER_ENABLED=false` and use cron for `python -m app.feeds ingest` and `python -m app.refresh_profiles`.

## Events

Event calendars are read as iCal (`kind: "ical"`) from `data/feeds.json`. Events that have already happened are not
stored, and the ranking drops any that expire later. Two calendars are configured, Baltic Wind and WASP. Both
sites use the same WordPress calendar plugin whose all-events address ends in `/events/?ical=1`, but those exact
addresses are unconfirmed from the sandbox: run `python -m app.feeds check` and fix or disable whichever fails.
Limits: an event is stored once per URL, so a change of date for an already-stored event is not picked up; the
calendars are general industry calendars, not Blue Science Park's own (no public feed was found for it).
