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
