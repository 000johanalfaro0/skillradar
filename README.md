# SkillRadar

GitHub-trending–style ranking app for **Claude Code Skills** (`SKILL.md` files), with
AI critique, plain-language summaries, and the predominant programming language per skill.

## How it works

The app's heart is **not** the UI — it's a daily Cloudflare **Cron Trigger** that:

1. **Discovers** skills on GitHub (Code Search for `SKILL.md` + configured topics + seed repos).
2. **Measures** each skill (stars/forks/last commit) into `skill_snapshots` — one row per day.
3. **Scores** them: `trend_7d`/`trend_30d` come from diffing today's snapshot vs N days ago.
4. **Analyzes** new/changed skills with Gemini 2.5 Flash (cached in `skill_analysis`).

**Golden rule:** GitHub is the source of truth for hard data; Gemini only *interprets* text;
the React app only ever reads precomputed values from the DB. No ranking math or AI calls at runtime.

## Stack

- `apps/api` — Cloudflare Worker + Hono (REST API + the scheduled cron). D1 (SQLite) + KV (sessions).
- `apps/web` — React + Vite + Tailwind + TanStack Query. Deploys to Cloudflare Pages.

## Setup

```bash
pnpm install

# 1. Create the D1 database and KV namespace, then paste the printed ids into apps/api/wrangler.toml
pnpm --filter @skillradar/api db:create
cd apps/api && npx wrangler kv namespace create SESSIONS && cd ../..

# 2. Apply the schema locally
pnpm db:migrate:local

# 3. Secrets for local dev: copy apps/api/.dev.vars.example -> apps/api/.dev.vars and fill in
#    GITHUB_TOKEN, GEMINI_API_KEY, GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_CLIENT_SECRET, SESSION_SECRET

# 4. Frontend env: create apps/web/.env with VITE_API_URL=http://localhost:8787

# 5. Run both
pnpm dev:api   # Worker on :8787
pnpm dev:web   # Vite on :5173
```

### Trigger the cron manually (to populate data)

```bash
# Option A: the guarded admin route (needs SESSION_SECRET)
curl -H "x-admin-key: <SESSION_SECRET>" http://localhost:8787/admin/run-cron

# Option B: wrangler's scheduled tester
cd apps/api && npx wrangler dev --test-scheduled
curl "http://localhost:8787/__scheduled"
```

## Production

- API: `pnpm deploy:api` (set secrets with `wrangler secret put NAME`).
- Web: `pnpm build:web` then deploy `apps/web/dist` to Cloudflare Pages.
- Point `APP_URL`, `GITHUB_OAUTH_CALLBACK`, and `VITE_API_URL` at the deployed origins.
