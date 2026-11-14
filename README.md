# Fyyr

Fyyr is a Blue Science Park hackathon project that helps companies find relevant events, funding, testbeds, news and collaboration partners through company profiles, ranked opportunities and a chat assistant. It provides member and staff views.

Stack: Python/FastAPI, SQLite, React and Vite. The local demo needs no API key or separate database server.

## Prerequisites

- Windows PowerShell and Git.
- Python 3.14 with the `py` launcher (verified with Python 3.14.4).
- Node.js 22.12+ (24 LTS recommended), including npm.

All commands use PowerShell. `npm.cmd` avoids script execution-policy issues; virtual-environment activation is unnecessary.

## Clone and install

```powershell
git clone https://github.com/omposs/Fyyr.git
Set-Location .\Fyyr
py -3.14 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
Push-Location .\frontend
npm.cmd ci
Pop-Location
```

Run backend commands from the repository root containing [pyproject.toml](./pyproject.toml) and [app/](./app/).

## Environment configuration

For a fresh clone, create the backend configuration in the repository root. These commands overwrite existing configuration files.

```powershell
@"
BSP_DATABASE_URL=sqlite:///./bsp.db
BSP_LLM_PROVIDER=mock
BSP_SCHEDULER_ENABLED=false
BSP_FETCH_ALLOWED_DOMAINS=[]
"@ | Set-Content -Encoding ascii .\.env
```

Create the frontend configuration:

```powershell
@"
VITE_API_BASE_URL=http://localhost:8000
VITE_AUTH_MODE=backend
VITE_CONTENT_MODE=demo
"@ | Set-Content -Encoding ascii .\frontend\.env.local
```

Keep configuration local. The root `.env` is ignored by Git. Every `VITE_*` value is public browser configuration, so never put secrets there.

The mock AI provider works offline. For optional Claude access, change `BSP_LLM_PROVIDER` to `anthropic` and set `BSP_ANTHROPIC_API_KEY` privately in the backend environment. To enable scheduled feed/profile refresh, set `BSP_SCHEDULER_ENABLED=true`; use one backend worker. These options are unnecessary for the demo.

## Database and demo setup

From the repository root:

```powershell
.\.venv\Scripts\python.exe -m app.seed
.\.venv\Scripts\python.exe -m app.dev_accounts
```

The first command creates `bsp.db`, three fictional company profiles, opportunities and matches; it prints generated API tokens, which must remain private. The second creates or updates the staff and Saab logins below. Both commands can be rerun without duplicating seeded companies. Startup creates missing tables and applies supported additive SQLite migrations automatically.

Local development logins only; both use password `DemoBSP2026!`:

- **Staff:** Erik Andersson — `erik.andersson@bsp.se`.
- **Member (Saab):** Anna Johansson — `anna.johansson@saab.se`.

Choose the corresponding staff or member login. Backend login requires no six-digit code. Change development passwords before sharing a deployment. The three fictional companies created by `app.seed` do not have email/password logins.

## Start and use

From the cloned repository root, launch both services:

```powershell
.\start-dev.ps1
```

The launcher opens two PowerShell terminals. Open http://localhost:5173; the frontend communicates with the API at http://localhost:8000. If PowerShell blocks the script, run it with a process-only policy override:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\start-dev.ps1
```

### Two-terminal fallback

Alternatively, open two PowerShell terminals in the cloned repository root.

**Terminal 1 — backend:**

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API documentation: <http://localhost:8000/docs>. Health check:

```powershell
Invoke-RestMethod http://localhost:8000/health
```

**Terminal 2 — frontend:**

```powershell
Set-Location .\frontend
npm.cmd run dev -- --host localhost --port 5173 --strictPort
```

Open <http://localhost:5173>. This origin is allowed by the backend's default CORS configuration.

Login uses the API while content initially uses browser demo fixtures. Switch content with **Demo data / Live data** in the header, or set `VITE_CONTENT_MODE=live` and restart Vite. The browser remembers the header selection. Live views use backend records and may be sparse for the newly created Saab account; seeded fictional profiles belong to other companies. Staff analytics and sections without backend support retain labelled demo content.

The legacy frontend-only simulated flow still exists behind `VITE_AUTH_MODE=demo`: it requires a valid email format and a non-empty password, then accepts any six-digit code. It sends no email and provides no real authentication. Leave `VITE_AUTH_MODE=backend` to use the verified accounts above.

## Stop and restart

Press **Ctrl+C** in each service terminal to stop that service, then close the terminals. SQLite and browser demo data persist. Rerun `.\start-dev.ps1` to resume; no reseeding is needed. Stop existing services before relaunching. Restart the backend after changing backend environment settings and Vite after changing frontend settings.

## Checks

From the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest
Push-Location .\frontend
npm.cmd run build
Pop-Location
```

See [BACKEND.md](./BACKEND.md) for API administration, live feeds and profiling details.
