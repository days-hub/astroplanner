# AstroPlanner

AstroPlanner is an astronomy session planner and observing log web app. Pick an
observing location, see which planets and deep-sky objects are actually visible
from there at a given time (computed with real ephemeris data via Skyfield),
check the hourly forecast for your session, and log what you saw.

![AstroPlanner dashboard](docs/screenshots/dashboard.png)

## Features

- **"Tonight at a glance"**: darkness window (sunset, astronomical twilight,
  sunrise), moon illumination, and ranked target cards for the best viewing
  time — one click prefills a planned session
- Visibility planner: altitude/azimuth, sun altitude, and elongation for the
  Moon, planets, and bright DSOs at your chosen time and place, with
  "why not visible" explanations, computed with Skyfield + the JPL DE421
  ephemeris
- **Sky advisor** (optional): ask a plain-language question ("what's worth
  looking at Friday night?") and get an answer from Claude grounded strictly
  in the app's own computed data — darkness window, moon, ranked targets, and
  the hourly cloud forecast are bundled into one JSON block the model is
  instructed to not stray from; the UI shows the answer and the data behind
  it. Feature-flagged on `ANTHROPIC_API_KEY`; the app runs normally without it
- Saved observing locations with geocoding autofill (name → coordinates + timezone)
- Session planning in the location's local timezone (stored as UTC)
- Hourly weather forecast for each planned session (Open-Meteo, humanized
  WMO conditions)
- Observation logs per session: notes, tap-once seeing/transparency quality,
  star ratings
- Export planned sessions as an `.ics` calendar file
- User accounts with JWT auth (case-insensitive emails, friendly API errors)
- **Demo mode**: a one-click "Try the demo" button mints an ephemeral,
  pre-seeded account so visitors land straight in a populated dashboard — with
  public registration disabled by design on the hosted deploy (see below)
- Ambient space backdrop: a procedural canvas starfield (parallax drift,
  twinkle, shooting stars) over a NASA/ESA photo of whatever target you're
  planning — ~4 MB of assets total, honors `prefers-reduced-motion`

## Screenshots

The Sky advisor, answering a question about a night. Note that it flags the
date mismatch rather than guessing, and reports poor conditions honestly —
every figure it quotes comes from the app's own computed data:

![Sky advisor](docs/screenshots/advisor.png)

| Landing (demo deployment) | Tonight at a glance |
|---|---|
| ![Login](docs/screenshots/login.png) | ![Dashboard](docs/screenshots/dashboard.png) |

## Tech stack

| Layer     | Tech |
|-----------|------|
| Backend   | FastAPI, SQLAlchemy, Pydantic v2, Skyfield (JPL DE421 ephemeris) |
| Database  | SQLite for local dev, PostgreSQL in Docker |
| Frontend  | React 19 + TypeScript, Vite |
| Deploy    | Docker Compose: nginx (static frontend + API reverse proxy) → FastAPI → Postgres |
| External  | Open-Meteo forecast + geocoding APIs |

## Local development

Backend (Python 3.12+):

```bash
cd backend
python -m venv .venv && .venv/Scripts/activate   # or source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # then set SECRET_KEY (see comment in the file)
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev             # http://localhost:5173, API at http://127.0.0.1:8000
```

API docs are served at `http://127.0.0.1:8000/docs`.

Run the backend tests:

```bash
cd backend
python -m pytest tests/
```

## Docker deployment

```bash
cp .env.example .env    # set SECRET_KEY and POSTGRES_PASSWORD
docker compose up --build
```

Then open `http://localhost:8081`. nginx serves the built frontend, proxies
`/api/*` to the FastAPI container (same origin, no CORS in production), and
Postgres data persists in the `pgdata` volume. The frontend port is bound to
loopback only — in production the public entrance is Caddy (below).

## Production hosting (VPS)

The repo is deploy-ready for a small VPS. One-time setup:

1. **DNS**: point an A record (e.g. `astro.example.com`) at the server.
2. **Server**: install Docker + compose, clone the repo, then create `.env`
   with *fresh* production values — a new `SECRET_KEY`, a new
   `POSTGRES_PASSWORD`, your `ANTHROPIC_API_KEY` (a key minted for this
   server, not one used elsewhere), and `DOMAIN=astro.example.com`.
3. **Firewall**: allow only 22 (SSH, key auth only), 80, and 443:
   `ufw allow OpenSSH && ufw allow 80,443/tcp && ufw enable`.
4. **Start**:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```

   Caddy terminates TLS (automatic Let's Encrypt), redirects HTTP→HTTPS, and
   proxies to nginx over the compose network. Nothing else listens publicly.
5. **Backups**: add a cron entry for `scripts/backup_db.sh` (nightly `pg_dump`
   with 14-day rotation — see the header comment for the crontab line and the
   restore command).
6. **Demo cleanup (optional)**: the backend already purges expired demo
   accounts at startup and hourly, but adding a cron entry for
   `scripts/purge_demo_users.sh` covers the gap where the process is down or
   restarting (see the header comment for the crontab line).
7. **Spend cap**: set a hard monthly usage limit in the Claude Console
   (Settings → Limits) as the backstop behind the app's advisor rate limits.

Abuse protection is built in: login (10/min/IP), signup (10/hour/IP), demo
creation (6/hour/IP), and advisor questions (5/min and 25/day per user, or
5/day for demo users) are rate-limited server-side, with real client IPs
recovered through the Caddy→nginx proxy chain. On the public deploy the
cleanest abuse surface — open registration — is disabled outright (see
[Demo mode](#demo-mode)).

## Demo mode

The hosted deployment runs **demo-only**: public registration is disabled and
visitors explore through a throwaway account instead. This keeps the full
feature set one click away for anyone evaluating the project while storing zero
stranger PII — the alternative (open signup on a hobby VPS with no reset flow)
adds real email addresses to custody and an abuse surface, and buys nothing.

How it works:

- **`POST /demo/start`** creates an ephemeral account with a server-generated
  email and random password, pre-seeds it (two locations, planned + completed
  sessions, observation logs), and returns a real, short-lived JWT. The visitor
  is logged straight into a populated dashboard.
- Nothing about auth is bypassed: the demo *is* a JWT login, and demo users
  pass the same token verification and ownership checks as everyone else — so
  two concurrent visitors can't see each other's data. The demo doubles as a
  live demonstration of the security model.
- **`ALLOW_REGISTRATION=false`** makes `POST /auth/register` return `403` and
  hides the sign-up form; the frontend reads `GET /demo/status` to decide which
  entry points to show.
- A startup + hourly cleanup task purges demo accounts older than
  `DEMO_USER_TTL_HOURS` (default 24h); seeded rows go with them via FK cascade,
  so the database never accumulates anything. `scripts/purge_demo_users.sh` is
  a cron-friendly wrapper around the same purge for belt-and-suspenders cleanup
  when the process isn't running.
- Demo accounts get a **tighter advisor allowance** (`5/day` vs `25/day`) since
  each question costs a little Anthropic spend; the Console spend cap is the
  ultimate backstop.

Enable it by setting `DEMO_MODE=true` (and, for a public deploy,
`ALLOW_REGISTRATION=false`) in `.env`. Left off, the app behaves exactly as
before: normal signup, no demo endpoint.

## Configuration

| Variable | Where | Notes |
|----------|-------|-------|
| `SECRET_KEY` | required | JWT signing key; app refuses to start without it |
| `DATABASE_URL` | optional | defaults to local SQLite; compose sets Postgres |
| `CORS_ORIGINS` | optional | comma-separated origins for dev; unused same-origin |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | optional | JWT lifetime, default 60 |
| `ANTHROPIC_API_KEY` | optional | enables the Sky advisor; unset = feature hidden |
| `ADVISOR_MODEL` | optional | Claude model for the advisor, default `claude-opus-4-8` |
| `DOMAIN` | prod only | public hostname for Caddy/Let's Encrypt |
| `DEMO_MODE` | optional | exposes `POST /demo/start` (ephemeral seeded accounts), default off |
| `ALLOW_REGISTRATION` | optional | `false` disables public signup (`/auth/register` → 403), default on |
| `DEMO_USER_TTL_HOURS` | optional | age at which demo accounts are purged, default 24 |
| `RATE_LIMIT_*` | optional | override the login/register/advisor/demo limits |

## Roadmap

- Alembic migrations (schema is currently `create_all` on startup — a
  pre-existing SQLite dev database needs a manual `ALTER TABLE` after a
  model change until this lands)
- More DSO targets and a proper catalog search

Background image credits: `frontend/src/assets/backgrounds/ATTRIBUTION.md`.
