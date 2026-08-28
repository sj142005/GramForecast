# GramForecast — Production Deploy Verification Checklist

**Stack:** React+Vite frontend (Vercel) · FastAPI backend (Vercel Python serverless) · PostgreSQL (Render) · Groq LLM · Holt-Winters forecaster
**Prepared:** 28 Aug 2026 · Judging in ~2–3 days

Work top to bottom. Each phase has a **verify** step — don't move on until it passes.

---

## Phase 1 — Env vars & secrets

### 1.1 Backend env vars on Vercel

Vercel → Project → Settings → Environment Variables. Set for **Production AND Preview** (Preview matters — a preview URL is often what you end up demoing):

| Variable | Notes |
|---|---|
| `GROQ_API_KEY` | The NEW rotated key. Never `VITE_`-prefixed. |
| `GROQ_MODEL` | `openai/gpt-oss-20b` |
| `DATABASE_URL` | Render **External** URL, `postgresql://` scheme (see Phase 3) |
| `SECRET_KEY` / `JWT_SECRET` | Whatever name your auth code reads. Long random string, not `"secret"`. |
| `ALGORITHM` | `HS256` (if your code reads it) |
| `CORS_ORIGINS` | Comma-separated frontend origins (see Phase 2) |

### 1.2 Frontend env var

| Variable | Notes |
|---|---|
| `VITE_API_URL` | Full backend base URL, **no trailing slash**. No localhost anywhere. |

Only `VITE_API_URL` should be `VITE_`-prefixed. Anything `VITE_` ships to the browser in plain text.

### 1.3 Redeploy after setting vars

Vercel does **not** apply new env vars to an existing deployment. Deployments → latest → ⋯ → **Redeploy**. Skipping this is the single most common "I set the var but it's still broken" cause.

### Verify Phase 1

```bash
# 1. No secret in the shipped client bundle (Groq keys start with gsk_)
cd frontend && npm run build && grep -ri "gsk_" dist/ ; grep -ri "groq" dist/
# Expect: no matches for gsk_

# 2. No secret in tracked files, and .env is not tracked
git grep -I -n "gsk_" -- . ; git ls-files | grep -x '\.env'
# Expect: no output from either command

# 3. .env is ignored going forward
git check-ignore -v .env
# Expect: a line showing .gitignore matched it
```

- [ ] All backend vars set (Production + Preview)
- [ ] `VITE_API_URL` set, no other `VITE_` secret
- [ ] Redeployed after adding vars
- [ ] Bundle + tracked-file greps clean

> **Old key in git history:** since you rotated, the leaked key is dead — that's the real fix. If the repo is **public**, optionally scrub history later with `git-filter-repo`. Not worth doing before judging.

---

## Phase 2 — CORS for the Vercel domain

Your frontend and backend are different origins, so CORS must explicitly allow the frontend. Preview deploys get a *new random subdomain every push*, so hardcoding one domain will break your next deploy — use a regex for `*.vercel.app`.

```python
# backend/main.py (or app factory)
import os
from fastapi.middleware.cors import CORSMiddleware

allowed = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
allowed += ["http://localhost:5173", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed,
    allow_origin_regex=r"https://.*\.vercel\.app",   # covers every preview deploy
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

⚠️ **Trap:** with `allow_credentials=True`, `allow_origins=["*"]` is silently ignored by browsers. You must list real origins or use the regex. If your auth uses a `Bearer` header (not cookies), you can set `allow_credentials=False` and it still works.

### Verify Phase 2

```bash
# Preflight test — replace both URLs
curl -i -X OPTIONS "https://<BACKEND>/api/auth/login" \
  -H "Origin: https://<FRONTEND>.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization"
```

Expect `200`/`204` **and** a header `access-control-allow-origin: https://<FRONTEND>.vercel.app`. If that header is missing, CORS is not configured — the browser will show "blocked by CORS policy" no matter what the status code says.

- [ ] Preflight returns 2xx with `access-control-allow-origin` echoing your origin
- [ ] Regex covers `*.vercel.app` so preview deploys keep working
- [ ] Login works from the deployed frontend, not just curl

---

## Phase 3 — Render Postgres connection

Three separate traps here, all common:

**3.1 Use the External URL.** Render shows an *Internal* and an *External* connection string. Internal only resolves inside Render's network — your backend is on Vercel, so you need **External Database URL**.

**3.2 Fix the scheme.** Render hands you `postgres://…`. SQLAlchemy needs `postgresql://…`:

```python
url = os.environ["DATABASE_URL"]
if url.startswith("postgres://"):
    url = url.replace("postgres://", "postgresql://", 1)
```

**3.3 Pooling on serverless.** Every Vercel invocation is a fresh process, so a normal connection pool leaks connections until Render refuses new ones ("too many clients already"). Use `NullPool`:

```python
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

engine = create_engine(
    url,
    poolclass=NullPool,          # serverless: no pooling, connect per request
    connect_args={"sslmode": "require"},   # Render requires SSL
)
```

(`pool_pre_ping=True` is a *pool* feature — with `NullPool` every connection is already brand new, so it's redundant. Harmless if you leave it in, just not doing anything.)

**3.4 Free-tier lifespan.** Render's free Postgres instances expire a fixed number of days after creation and are then deleted — check the exact expiry date shown on your database's page in the Render dashboard **right now**. If it lands before judging day, that's a silent project-killer; upgrade or recreate + reseed ahead of time. Free DBs are also slow on first connect after idle (see Phase 6).

### Verify Phase 3

Add a health endpoint that actually touches the DB (not just `{"ok":true}`):

```python
from sqlalchemy import text

@app.get("/api/health")
def health(db=Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "db": "connected"}
```

```bash
curl -s "https://<BACKEND>/api/health"
# Expect: {"status":"ok","db":"connected"}
```

- [ ] Using External URL, `postgresql://` scheme, `sslmode=require`
- [ ] `NullPool` configured
- [ ] `/api/health` returns db connected from the deployed backend
- [ ] Render DB expiry date is **after** judging day

---

## Phase 4 — Schema, seed & forecast on the PROD DB

Your prod DB is a different database from your local one. Tables and data must exist there too.

- [ ] Tables created on prod (Alembic `upgrade head`, or your `create_all` bootstrap, pointed at prod `DATABASE_URL`)
- [ ] Demo user exists on prod and you can log in with it
- [ ] Seed data loaded on prod — all 6 products, transactions, inventory, alerts
- [ ] Forecast job run against prod so forecast tables are populated

### 🔴 The date trap — read this one twice

Your earlier ₹0 / −100% bug was caused by seed data ending **16 Aug** while "today" was 24 Aug, so every rolling 7-day window was empty. **Judging is 2–3 days away, so any seed you load today has the same decay built in.**

Two ways to be safe, do both:

1. **Make the seeder relative, not absolute** — generate transactions from `today - 90 days` through `today`, computed at run time. Never hardcoded dates.
2. **Re-run seed + forecast on the morning of judging.** Keep it to one command and make it idempotent (truncate-and-reload, not append, so re-running doesn't double sales):

```bash
DATABASE_URL="<prod-url>" python backend/scripts/seed_demo.py --reset
DATABASE_URL="<prod-url>" python backend/scripts/run_forecast.py
```

- [ ] Seeder uses relative dates computed at run time
- [ ] Seed is idempotent / `--reset` safe (re-running does not duplicate)
- [ ] One-command reseed documented, and set a phone reminder for demo morning

---

## Phase 5 — Smoke test on the live URL

Do this **in an incognito window on the deployed URL** — not localhost, not your logged-in tab. Keep DevTools Console open the whole time; **zero red errors** is the bar.

**Auth**
- [ ] Signup with mobile `123`, email `abc`, password `123` → 3 inline errors, no user created
- [ ] Signup with valid data → account created, logged in
- [ ] Login with demo account, hard-refresh → still logged in (JWT persists)
- [ ] Logout works

**Numbers (the credibility screens — all must be NON-ZERO)**
- [ ] Dashboard: Predicted Demand ≠ 0, Top Products list populated
- [ ] Dashboard: 7-day sales ≠ ₹0 and ≠ −100%
- [ ] Demand Prediction: units ≠ 0, accuracy is the real MAPE figure (**not** 92.4%)
- [ ] Sales Analytics: both 7-day and 30-day non-zero
- [ ] Inventory Planning: Expected Demand ≠ 0
- [ ] Forecast Reports: totals non-zero, accuracy **matches Demand Prediction exactly**

**Cross-screen consistency** (judges do cross-check — this is where projects lose marks)
- [ ] Product count identical on Dashboard donut vs Inventory
- [ ] Accuracy % identical on Demand Prediction vs Forecast Reports
- [ ] A product flagged low/out in Alerts shows the same status in Inventory
- [ ] Inventory status respects reorder point (stock below reorder ≠ "Optimal")

**Interactions**
- [ ] Alerts → Acknowledge one → status changes, Resolved count +1, **survives refresh**
- [ ] Alerts → Mark all read → counts update, survives refresh
- [ ] Forecast Reports → open 2 *different* reports → 2 *different* populated views
- [ ] Settings → change a field → Save → hard-refresh → value persisted
- [ ] AI insight banner returns real text; chat assistant answers one question
- [ ] No dead buttons anywhere (Help & Support included — hide what isn't wired)

**Language & voice**
- [ ] Toggle मराठी → walk every screen → zero English left over
- [ ] Toggle हिन्दी → same
- [ ] Voice entry on Chrome: mic works, fills form, submits
- [ ] Deny mic permission → friendly message, no crash, manual entry still available

**Responsive**
- [ ] 390px width (DevTools iPhone): no horizontal scroll, no clipped topbar, charts readable
- [ ] Test on your actual phone over mobile data — that's the real judge-hands scenario

---

## Phase 6 — Demo-day resilience

**Cold start is your biggest live risk.** Vercel serverless + idle Render free DB means the *first* request after idle can take many seconds — exactly when a judge is watching.

- [ ] **Warm up 5–10 min before your slot:** load the app, hit `/api/health`, click through all screens once
- [ ] Keep a browser tab open and refresh it every couple of minutes while waiting

**Backups (make these today, not on demo day)**
- [ ] Screen recording of the full happy-path walkthrough (venue wifi insurance)
- [ ] Localhost copy running and verified, with a local DB seeded — your fallback if prod dies
- [ ] Screenshots of the 4 hero screens in your slide deck
- [ ] Demo account credentials written on paper / in notes (don't fumble typing)

**Rules for the live demo**
- [ ] Log in with the pre-seeded demo account — do **not** create a fresh account live (empty account = empty charts)
- [ ] Know your walkthrough order and rehearse it out loud twice
- [ ] Say the method honestly: *"seasonal Holt-Winters time-series forecasting, with live backtested accuracy"* — a working honest model scores better than a claimed one that errors
- [ ] Frame mocked pieces as roadmap: APMC/mandi price API and WhatsApp alerts are **future scope**, shown in preview mode

---

## Paste-ready agent prompts

Give one at a time, let it finish, git commit, then the next.

### Prompt A — CORS + DB connection + health endpoint

```
TASK: Fix production configuration for our Vercel (FastAPI serverless) + Render (PostgreSQL) deployment. Scope: configuration and DB engine setup only — do not change business logic or UI.

1. CORS: configure CORSMiddleware to read allowed origins from the CORS_ORIGINS env var (comma-separated), plus localhost dev ports, plus allow_origin_regex r"https://.*\.vercel\.app" so preview deploys work. Do not use allow_origins=["*"] together with allow_credentials=True.
2. Database URL: read DATABASE_URL from env. If it starts with "postgres://", rewrite to "postgresql://". Pass connect_args={"sslmode": "require"}.
3. Serverless pooling: use SQLAlchemy NullPool with pool_pre_ping=True so each serverless invocation opens and closes its own connection and we never exhaust Render's connection limit.
4. Add GET /api/health that executes SELECT 1 against the DB and returns {"status":"ok","db":"connected"}; return HTTP 503 with the error type (not the credentials) if the DB is unreachable.
5. Remove every hardcoded localhost URL and hardcoded DB string from backend and frontend source. Frontend must use import.meta.env.VITE_API_URL.

Acceptance (test and report): list the exact env var names the app now requires; paste the CORS middleware config and the engine config; confirm via grep that no hardcoded localhost or DB credential remains in source.
```

### Prompt B — Relative, idempotent seeder + forecast runner

```
TASK: Make our demo seed data date-relative and safely re-runnable, so the app never shows zeros or -100% because the data got stale. Scope: seed and forecast scripts only.

Context: previously the seed had hardcoded dates that ended before "today", so all rolling 7-day windows computed as ₹0 / -100%. Our demo is a few days away, so absolute dates will decay again.

1. Rewrite the seeder to generate all transaction/sales history relative to the run date: from (today - 90 days) through today inclusive, with realistic weekday and festival-driven variation. No hardcoded calendar dates anywhere.
2. Add a --reset flag that truncates the demo tables before loading, so re-running produces identical data instead of duplicating sales.
3. Make it configurable via the DATABASE_URL env var so the same script can target local or production.
4. Ensure the forecast runner can be invoked as a standalone script after seeding and populates forecasts for every product for the current date forward.
5. Print a summary at the end: date range seeded, row counts per table, total sales for the last 7 and last 30 days, and number of forecast rows written.

Acceptance (test and report): run seed --reset twice in a row and show that the summary output is identical both times (proving idempotency), and that last-7-day sales is greater than zero.
```

---

## Quick diagnosis table

| Symptom | Most likely cause |
|---|---|
| "Blocked by CORS policy" in console | Frontend origin not allowed; check preflight returns `access-control-allow-origin` |
| Works in curl, fails in browser | CORS, or `allow_credentials=True` combined with `allow_origins=["*"]` |
| 500 on every DB route | Wrong DB URL — using Internal instead of External, or `postgres://` scheme not rewritten |
| "too many clients already" | Connection pool on serverless — switch to `NullPool` |
| Env var change had no effect | Didn't redeploy after setting it |
| Charts empty / ₹0 / −100% | Seed data ends before today, or forecast job never ran on the prod DB |
| Accuracy shows 92.4% | Hardcoded value still in the code path |
| First click after a pause hangs | Cold start (Vercel + idle Render DB) — warm up before demo |
