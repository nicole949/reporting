# JENTIS Reporting v2

Static dashboard (plain HTML/JS, no build step) reading a PostgREST API over the reporting database; data is filled by n8n.

```
site/          the pages. One folder per page (site/<page>/index.html), shared shell in site/assets/
sql/           numbered migrations, applied in order (001_init.sql …). Never edit an applied file — add a new one.
workflows/     n8n workflow exports (JSON) for versioning; the live copies run on jentis.app.n8n.cloud
docs/          changelog.json (drives the "What's new" panel) and notes
deploy/        staging .htaccess / .htpasswd
.github/       deploy workflow: branch "staging" → /v2-staging/ (password), branch "main" → /v2/ (live)
```

## Workflow
1. Work on a branch, open a pull request into `staging`. Merging deploys to staging within a minute.
2. Check on staging, then open a pull request `staging` → `main`. Merging deploys live.
3. Every change that users notice gets an entry at the top of `docs/changelog.json` (see docs/CHANGELOG-HOWTO.md).

## One-time setup
- GitHub → Settings → Secrets → Actions: `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` (ALL-INKL FTP).
- Branch protection on `main`: require a pull request.
- `deploy/staging.htpasswd`: generate once (see deploy/README.md).
- Database: run `sql/001_init.sql` as `reporting_app` on the v2 database; PostgREST exposes schema `api`.

## Conventions
- Pages call `R.shell({ page, title, subtitle })` and read data with `R.fetchAll('view?select=…')` — views only, from schema `api`.
- Anything produced by an AI call is marked with `R.ai({...})` using the row from `api.ai_usage_last`.
- Ids are `company_id`, `deal_id`, `contact_id` everywhere; every table has a primary key; syncs upsert and log to `app.sync_runs`.

## Data (since 12.11.2026)

The site reads one source: the JENTIS-hosted Postgres `reporting` through PostgREST at `https://n8n.rec.jentis.com` (schema `api`, anonymous read-only).

| Schema | What | Filled by |
|---|---|---|
| `api` | views the pages read — the only thing reachable from the browser | `sql/*.sql`, bridge |
| `v1` | copy of the old Supabase tables + its views, rebuilt every morning 07:40 | n8n "Reporting v2 — Supabase Bridge" (`n8n/supabase-bridge.workflow.js`, `sql/002_bridge.sql`) |
| `hs` | HubSpot mirror: one table per object, all non-empty properties in `props` | n8n "Reporting v2 — HubSpot Mirror" 05:10 (`n8n/hubspot-mirror.workflow.js`, `sql/003_hs.sql`) |
| `core`, `ext` | derived facts / other sources — empty until the logic syncs are moved | — |
| `app` | `sync_runs` (every run of the workflows above), AI usage, later users & settings | workflows |

Today every `api` view is a pass-through to `v1` (marked with the comment `bridge`). To move a page off the copy: write the view in `api` on top of `hs` / `core` under the same name — the bridge then leaves that name alone.
SQL files are applied with the "SQL File Trigger" path of the n8n workflow "SQL Scratchpad (Claude)".
