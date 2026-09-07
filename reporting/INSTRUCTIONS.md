# JENTIS Sales Reporting — Site Instructions

A static multi-page reporting site in your corporate design. No build step, no backend: any web server serves the folder as-is; pages fetch data client-side from Supabase with the read-only key.

## What's in the folder

```
reporting/
├── index.html               landing page with report cards
├── assets/
│   ├── config.js            THE one config file: Supabase URL, key, build number
│   ├── app.css              design system (colors/fonts from the JENTIS Webflow CD)
│   └── app.js               shared plumbing: data fetch, nav, tables, charts
├── leads/index.html         LIVE — the lifecycle cohort dashboard (was jentis-lifecycle-dashboard.html)
├── discoveries/index.html   pending pipeline — every discovery meeting + status
├── deals/index.html         pending pipeline — deal mirror with value/age/owner
├── calls/index.html         pending pipeline — call volume, connect rate, outcomes
├── sequences/index.html     pending pipeline — sequence stats + CTA/collateral/length/tone + engager drill-down
├── subjects/index.html      pending pipeline — subject line performance + recipient breakdown
└── sql/reporting-views.sql  data contracts: tables the pipelines fill + views the pages read
```

"Pending pipeline" pages are fully built — filters, tables, KPIs, drill-downs all wired. They show a friendly "pipeline pending" note until their Supabase view exists and has data, then light up with zero page changes.

## Setup (you, once, ~10 minutes)

1. **Run `sql/reporting-views.sql`** in the Supabase SQL Editor. Creates the future data tables, the `v_*` views the pages read, and read-only policies for the anon key. Safe to re-run. (The lifecycle tables from the Leads page keep their existing policies from the earlier setup.)
2. **Import `Lifecycle_Cohort_Reporting___Main_v4.json`** into n8n, deactivate/delete v2. It contains the duplicate-entries fix (see below) AND an email-body fix: your portal has no `hs_email_text` property, so reply classification was running on subjects only — v4 reads `hs_email_html` with a subject fallback — credentials and your spreadsheet ID carry over inside the file. Run it once manually so the cleanup deletes the World-Food-Programme-style duplicates already in the database.
3. **Open the site**: double-click `index.html` locally to verify, then hand the folder to DevOps.

## Handover to DevOps

Serve the `reporting/` folder from any static web server at any path, ideally behind VPN/SSO. Users' browsers need outbound access to `evaaqpmornjbdfiyddtu.supabase.co` and (cosmetic only) `fonts.googleapis.com`. No server-side anything. Ideal loop: a Git repo they auto-deploy on push — then updating a report is committing one file. The build number in `assets/config.js` (shown in the top bar of every page) tells everyone which version is deployed.

## Design (v6)

Restyled to match jentis.com: dark rounded navigation band with the JENTIS logo, white cards on light gray, brand-blue active states and heat matrix, teal for positive signals. **Logo:** replace `assets/jentis-logo.svg` with the official white JENTIS logo SVG from your brand folder (same filename) — a placeholder wordmark ships so nothing breaks. Tokens read directly from the JENTIS Webflow project: accent blue `#1A3DE8` (the heat matrix uses its official A10–A90 alpha steps), teal `#14C7C5` for positive accents, neutral `#E9FDFD`, **Noto Sans** for text and numbers, **Instrument Sans** for navigation and buttons. All in `assets/app.css` — change once, applies everywhere.

## The duplicate-numbers bug (fixed in workflow v3)

Your diagnosis pointed at contacts, but the pipeline only ever reads the **company** object — one company can't be double-counted via its contacts. What actually happened: World Food Programme's company lifecycle stage history contains rapid back-and-forth changes on the same day (typical when HubSpot's contact↔company stage sync or an import churns the field). Each backward move legitimately closed a "journey" and each re-set opened a new one — the re-entry rule working as designed, but on sync noise instead of real journeys, producing entries 2–5 with identical dates.

Fix in v3, two parts: (1) a re-entry into the same stage within `REENTRY_MIN_GAP_DAYS` (default 7, in Config) of the previous entry is treated as flapping and merged — real re-entries months later still count; (2) each run now deletes stale entry rows for the companies it processes, so the duplicates already written disappear on the first v3 run. Genuine multi-journey companies keep their `entry 2` labels.

## The five data pipelines — NOW BUILT (import + configure)

Five workflow JSONs ship alongside the site. Import each, attach credentials (HubSpot header auth on api.hubapi.com nodes, Postgres on Write DB, Google Sheets on sheet-read nodes, Anthropic x-api-key on Claude Attributes), then run once manually and activate:

1. **reporting-calls-sync.json** (daily 06:30) — mirrors call engagements with owner, disposition label and bucket. First run: set `BACKFILL_START = '2026-01-01'` in Config, execute, set back to `''`.
2. **reporting-deals-sync.json** (daily 06:40) — mirrors deals with pipeline/stage labels, dealtype, owner. First run: `BACKFILL_START = '2020-01-01'` for full history, then `''`.
3. **reporting-discoveries-sync.json** (daily 06:50) — every discovery meeting (type match or title regex) with derived status: upcoming / completed / no_show / canceled / rescheduled. Past meetings without a logged outcome count as completed. First run: `BACKFILL_START = '2026-01-01'`, then `''`.
4. **reporting-outreach-sync.json** (weekly Tue 06:00) — full recompute of subject-line stats + recipient breakdowns from all SENT sales emails since `FULL_FROM`, plus sequence stats via the **SequenceMap** sheet tab (see below), engager lists, and Claude-derived CTA/collateral/tone/length from sampled step-1 emails. Set `SPREADSHEET_ID` in Config.
5. **reporting-goals-sync.json** (daily 07:00) — syncs the **Goals** sheet tab into Supabase for the overview page. Set `SPREADSHEET_ID` in Config.

**Two new tabs in the reporting spreadsheet:**
- **Goals** — headers: `metric | period | target | label`. metric ∈ responded, discovery, qualified, opportunity, customer, calls, won_value; period like `2026-Q3` or `2026`; label is what the overview displays (e.g. "Discoveries Q3"). Delete a row to remove the goal.
- **SequenceMap** — headers: `sequence_id | sequence_name | status | step | subject`. One row per sequence step with the step's subject line exactly as sent (personalization tokens as `{{...}}` act as wildcards). This is how emails get attributed to sequences — HubSpot's API exposes no sequence ID on emails, so this map (which you already know from your manual sheet) is the honest bridge. Enrolled = step-1 sends; opens/clicks/replies are counted across all mapped steps; meetings stay empty (not derivable).

**Honest limits:** subject-line open rates are directional (Apple MPP inflates uniformly); sequence attribution is only as complete as the SequenceMap; deleted HubSpot deals linger in the mirror until a manual cleanup.

## Updating

Same loop as before: I hand you changed files, you (or DevOps via Git) replace them. The old single-file dashboard and any Netlify deploy of it are superseded by `leads/` — retire them once this is up so there's only one truth.

## Overview page (v6)

Dark hero with the running quarter, a live countdown of days left, and progress bars for every goal whose period matches the current quarter or year — actuals computed live from the entry/calls/deals data, targets from the Goals sheet via goals-sync. Below: quarter metrics and two weekly charts (discoveries booked, funnel entries). Report cards now detect live vs pending automatically per data source.

## Deals page (v6)

Deal type is a multi-select dropdown, defaulting to everything containing "New Business" (all types if none match); All/None quick actions inside. A Type column was added to the table.
