-- 006_ai_ask.sql — "Ask AI" on the dashboard (n8n workflow "Reporting v2 — Ask AI").
-- Every question is stored with its plan, the data that was read, the estimate and the answer, so answers can be
-- checked later and the cost per question is visible. The AI itself only ever reads data through the public dashboard
-- API (PostgREST, role anon) — it never gets database access. Not exposed in schema api.
CREATE TABLE IF NOT EXISTS app.ai_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  asked_by        text,
  page            text,
  element         text,
  question        text NOT NULL,
  context         jsonb,              -- page, element, filters, visible numbers sent by the dashboard
  plan            jsonb,              -- the AI's plan: requests, wording, issues
  data            jsonb,              -- what was read (already aggregated / trimmed) — exactly what the answer step sees
  est_cost_eur    numeric(10,4),
  plan_cost_eur   numeric(10,4),
  status          text NOT NULL DEFAULT 'planned',   -- planned | answered | failed | clarify | cannot
  answer          jsonb,
  answer_cost_eur numeric(10,4),
  answered_at     timestamptz,
  duration_ms     integer
);
CREATE INDEX IF NOT EXISTS ai_questions_created_idx ON app.ai_questions (created_at DESC);

-- small, cached data catalogue for the planner (views of schema api with columns and row counts); refreshed by the
-- workflow when older than a day
CREATE TABLE IF NOT EXISTS app.ai_catalog (
  view_name   text PRIMARY KEY,
  columns     text NOT NULL,
  row_count   integer,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION app.ai_catalog_refresh() RETURNS int LANGUAGE plpgsql AS $f$
DECLARE r record; n int; k int := 0;
BEGIN
  DELETE FROM app.ai_catalog;
  FOR r IN SELECT c.table_name, string_agg(c.column_name || ' ' || replace(replace(c.data_type, 'timestamp with time zone', 'timestamp'), 'character varying', 'text'), ', ' ORDER BY c.ordinal_position) AS cols
           FROM information_schema.columns c WHERE c.table_schema = 'api' AND c.table_name NOT IN ('saved_filters', 'todos') GROUP BY 1 LOOP
    BEGIN EXECUTE format('SELECT count(*) FROM api.%I', r.table_name) INTO n; EXCEPTION WHEN OTHERS THEN n := NULL; END;
    INSERT INTO app.ai_catalog (view_name, columns, row_count) VALUES (r.table_name, r.cols, n);
    k := k + 1;
  END LOOP;
  RETURN k;
END $f$;

INSERT INTO app.ai_prices (model, input_eur, output_eur, cache_read_eur)
SELECT 'claude-haiku-5-5', input_eur, output_eur, cache_read_eur FROM app.ai_prices WHERE model = 'claude-haiku-4-5'
ON CONFLICT DO NOTHING;
