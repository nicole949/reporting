-- 001_init.sql — Reporting v2 database layout. Idempotent. Run as the owner role (reporting_app).
-- Applied to Supabase on 2026-11-11 (interim home until the self-hosted DB is ready; move = pg_dump -n hs -n ext -n core -n api -n app).
-- Schemas:  hs   = HubSpot mirror (HubSpot property names, one row per object)
--           ext  = other sources (LGM, Instantly, DCP usage, Confluence)
--           core = derived facts the dashboard is about (stage entries, corrections, responses, AI outputs, aggregates)
--           api  = views only — the read contract of the site (PostgREST db-schemas = api)
--           app  = users, settings, sync runs, AI usage
CREATE SCHEMA IF NOT EXISTS hs;
CREATE SCHEMA IF NOT EXISTS ext;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS api;
CREATE SCHEMA IF NOT EXISTS app;

-- read role used by PostgREST for anonymous requests (created by DevOps setup; no-op if it exists)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF; END $$;
GRANT USAGE ON SCHEMA api TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT EXECUTE ON FUNCTIONS TO anon;
-- hs / ext / core / app are NOT exposed: anon has no USAGE on them.

-- ---------------------------------------------------------------- app: bookkeeping
CREATE TABLE IF NOT EXISTS app.sync_runs (
  id            bigserial PRIMARY KEY,
  workflow      text NOT NULL,            -- n8n workflow name
  workflow_id   text,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  status        text NOT NULL DEFAULT 'running',   -- running | ok | failed
  rows_written  integer,
  notes         text,
  error         text
);
CREATE INDEX IF NOT EXISTS sync_runs_wf_idx ON app.sync_runs (workflow, started_at DESC);

CREATE TABLE IF NOT EXISTS app.ai_usage (
  id             bigserial PRIMARY KEY,
  at             timestamptz NOT NULL DEFAULT now(),
  workflow       text NOT NULL,           -- n8n workflow that made the call
  feature        text NOT NULL,           -- what the user sees it as: customer_summary | quote_check | reply_evaluation | deal_note | ...
  model          text NOT NULL,
  input_tokens   integer NOT NULL DEFAULT 0,
  output_tokens  integer NOT NULL DEFAULT 0,
  cache_read_tokens integer NOT NULL DEFAULT 0,
  cost_eur       numeric(10,5),           -- computed from app.ai_prices at insert time
  object_type    text,                    -- company | deal | quote | contact | email | ...
  object_id      text,
  requested_by   text,                    -- user email when triggered from the site
  duration_ms    integer,
  stop_reason    text
);
CREATE INDEX IF NOT EXISTS ai_usage_at_idx ON app.ai_usage (at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_feature_idx ON app.ai_usage (feature, at DESC);

CREATE TABLE IF NOT EXISTS app.ai_prices (            -- € per 1M tokens; update when Anthropic changes list prices
  model         text PRIMARY KEY,
  input_eur     numeric(8,3) NOT NULL,
  output_eur    numeric(8,3) NOT NULL,
  cache_read_eur numeric(8,3) NOT NULL DEFAULT 0,
  valid_from    date NOT NULL DEFAULT current_date
);
INSERT INTO app.ai_prices (model, input_eur, output_eur, cache_read_eur) VALUES
  ('claude-sonnet-5-5', 2.80, 14.00, 0.28),
  ('claude-haiku-4-5',  0.95,  4.70, 0.09),
  ('claude-opus-5-5',  14.00, 70.00, 1.40)
ON CONFLICT (model) DO NOTHING;   -- placeholders in EUR — set the real list prices before the AI spend page goes live

CREATE OR REPLACE FUNCTION app.ai_cost(p_model text, p_in integer, p_out integer, p_cache integer)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT round((coalesce(p_in,0) * input_eur + coalesce(p_out,0) * output_eur + coalesce(p_cache,0) * cache_read_eur) / 1e6, 5)
  FROM app.ai_prices WHERE model = p_model
$$;

CREATE TABLE IF NOT EXISTS app.users (               -- filled by the SSO proxy later; until then unused
  email         text PRIMARY KEY,
  name          text,
  first_seen    timestamptz NOT NULL DEFAULT now(),
  last_seen     timestamptz
);
CREATE TABLE IF NOT EXISTS app.settings (            -- per-user preferences: theme, default filters, seen change notes, saved filters
  email         text NOT NULL REFERENCES app.users(email) ON DELETE CASCADE,
  key           text NOT NULL,
  value         jsonb NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (email, key)
);

-- ---------------------------------------------------------------- api: first views
CREATE OR REPLACE VIEW api.sync_status AS
SELECT DISTINCT ON (workflow) workflow, workflow_id, started_at, finished_at, status, rows_written, error
FROM app.sync_runs ORDER BY workflow, started_at DESC;

CREATE OR REPLACE VIEW api.ai_usage_daily AS
SELECT date_trunc('day', at)::date AS day, feature, workflow, model,
       count(*) AS calls, sum(input_tokens) AS input_tokens, sum(output_tokens) AS output_tokens, sum(cache_read_tokens) AS cache_read_tokens, sum(cost_eur) AS cost_eur
FROM app.ai_usage GROUP BY 1, 2, 3, 4;

CREATE OR REPLACE VIEW api.ai_usage_last AS                   -- latest call per object, for the ✦ marker on pages
SELECT DISTINCT ON (feature, object_type, object_id) feature, object_type, object_id, at, model, input_tokens, output_tokens, cost_eur, requested_by
FROM app.ai_usage WHERE object_id IS NOT NULL ORDER BY feature, object_type, object_id, at DESC;

GRANT SELECT ON ALL TABLES IN SCHEMA api TO anon;
