-- ============================================================
-- JENTIS Reporting — consolidated data contracts (v9)
-- Safe to run at ANY time, from any prior state, repeatedly:
-- tables use IF NOT EXISTS + additive ALTERs, views are always
-- dropped and recreated with their final definition.
-- ============================================================

-- ---------- Tables ----------
CREATE TABLE IF NOT EXISTS discoveries (
  meeting_id bigint PRIMARY KEY, company_id bigint, company_name text, contact_name text,
  owner_name text, meeting_start timestamptz, created_at timestamptz, activity_type text,
  outcome text, status text, updated_at timestamptz DEFAULT now());
ALTER TABLE discoveries ADD COLUMN IF NOT EXISTS participants text;
ALTER TABLE discoveries ADD COLUMN IF NOT EXISTS outcome_note text;
ALTER TABLE discoveries ADD COLUMN IF NOT EXISTS next_todo text;
ALTER TABLE discoveries ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE discoveries ADD COLUMN IF NOT EXISTS conversions text;

CREATE TABLE IF NOT EXISTS calls (
  call_id bigint PRIMARY KEY, ts timestamptz, owner_name text, disposition_id text,
  disposition_label text, bucket text, company_id bigint, company_name text, duration_seconds integer);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS contact_id bigint;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS icp_type text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS persona text;

CREATE TABLE IF NOT EXISTS deals_mirror (
  deal_id bigint PRIMARY KEY, deal_name text, company_id bigint, company_name text,
  pipeline_label text, stage_label text, amount numeric, owner_name text,
  create_date date, close_date date, dealtype text,
  is_closed boolean DEFAULT false, is_won boolean DEFAULT false, updated_at timestamptz DEFAULT now());
ALTER TABLE deals_mirror ADD COLUMN IF NOT EXISTS next_step text;
ALTER TABLE deals_mirror ADD COLUMN IF NOT EXISTS last_activity date;
ALTER TABLE deals_mirror ADD COLUMN IF NOT EXISTS mrr numeric;
ALTER TABLE deals_mirror ADD COLUMN IF NOT EXISTS has_quote boolean DEFAULT false;
ALTER TABLE deals_mirror ADD COLUMN IF NOT EXISTS status_note text;
ALTER TABLE deals_mirror ADD COLUMN IF NOT EXISTS todo text;
ALTER TABLE deals_mirror ADD COLUMN IF NOT EXISTS partner_name text;
ALTER TABLE customer_journeys ADD COLUMN IF NOT EXISTS license_type text;
ALTER TABLE customer_journeys ADD COLUMN IF NOT EXISTS owner_name text;
ALTER TABLE customer_journeys ADD COLUMN IF NOT EXISTS mrr numeric;
ALTER TABLE email_replies ADD COLUMN IF NOT EXISTS reply_snippet text;
ALTER TABLE deals_mirror ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE deals_mirror ADD COLUMN IF NOT EXISTS license_start date;
ALTER TABLE deals_mirror ADD COLUMN IF NOT EXISTS source_detail text;

CREATE TABLE IF NOT EXISTS sequence_stats (
  sequence_id text PRIMARY KEY, sequence_name text, status text,
  enrolled integer DEFAULT 0, delivered integer DEFAULT 0, opens integer DEFAULT 0,
  clicks integer DEFAULT 0, replies integer DEFAULT 0, meetings integer DEFAULT 0,
  bounces integer DEFAULT 0, cta text, collateral text, email_length_words integer, tone text,
  first_send date, last_send date, updated_at timestamptz DEFAULT now());
ALTER TABLE sequence_stats ADD COLUMN IF NOT EXISTS steps integer;
ALTER TABLE sequence_stats ADD COLUMN IF NOT EXISTS main_icp text;
ALTER TABLE sequence_stats ADD COLUMN IF NOT EXISTS main_persona text;
ALTER TABLE sequence_stats ADD COLUMN IF NOT EXISTS ai_note text;

CREATE TABLE IF NOT EXISTS sequence_steps (
  sequence_id text, step_rank integer, subject text,
  sends integer DEFAULT 0, opens integer DEFAULT 0, clicks integer DEFAULT 0,
  replies integer DEFAULT 0, first_sent date,
  PRIMARY KEY (sequence_id, subject));
ALTER TABLE sequence_steps ADD COLUMN IF NOT EXISTS cta text;
ALTER TABLE sequence_steps ADD COLUMN IF NOT EXISTS collateral text;

CREATE TABLE IF NOT EXISTS sequence_companies (
  sequence_id text, company_id bigint, company_name text, first_sent date,
  PRIMARY KEY (sequence_id, company_id));

CREATE TABLE IF NOT EXISTS sequence_engagers (
  id bigserial PRIMARY KEY, sequence_id text, contact_id bigint, contact_name text,
  company_id bigint, company_name text, action text, step integer, ts timestamptz);
CREATE INDEX IF NOT EXISTS idx_seq_eng ON sequence_engagers (sequence_id, ts DESC);

CREATE TABLE IF NOT EXISTS subject_stats (
  subject text PRIMARY KEY, sends integer DEFAULT 0, opens integer DEFAULT 0,
  replies integer DEFAULT 0, first_sent date, last_sent date, updated_at timestamptz DEFAULT now());
ALTER TABLE subject_stats ADD COLUMN IF NOT EXISTS main_icp text;
ALTER TABLE subject_stats ADD COLUMN IF NOT EXISTS main_persona text;

CREATE TABLE IF NOT EXISTS subject_recipients (   -- legacy (pre-v9), kept for compatibility
  id bigserial PRIMARY KEY, subject text, persona text, industry text, sends integer DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_subj_rec ON subject_recipients (subject);

CREATE TABLE IF NOT EXISTS subject_segments (
  id bigserial PRIMARY KEY, subject text, dim text, value text,
  sends integer DEFAULT 0, opens integer DEFAULT 0, replies integer DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_subj_seg ON subject_segments (subject);

CREATE TABLE IF NOT EXISTS goals (
  metric text NOT NULL, period text NOT NULL, target numeric NOT NULL, label text,
  updated_at timestamptz DEFAULT now(), PRIMARY KEY (metric, period));

CREATE TABLE IF NOT EXISTS email_daily (date date PRIMARY KEY, sends integer DEFAULT 0);

CREATE TABLE IF NOT EXISTS customer_journeys (
  company_id bigint PRIMARY KEY, name text, status text, icp text, region text,
  source_type text, source_detail text,
  first_touch date, first_disc date, first_deal date, deal_create date, close_date date, churn_date date,
  cycle_days integer, journey_days integer, tt_disc integer, tt_deal integer, tt_close integer,
  emails integer, calls integer, connected integer, meetings integer,
  champions text, partner_name text, license_type text, owner_name text, mrr numeric, pain text, ai_story text,
  events jsonb, updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS report_notes (
  key text PRIMARY KEY, note text, updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS email_replies (
  email_id bigint PRIMARY KEY, date date, contact_id bigint, contact_name text, company_id bigint);

-- LinkedIn replies from La Growth Machine, written by reporting-lgm-sync.
-- Mirrors email_replies so the Responded page treats both channels alike.
CREATE TABLE IF NOT EXISTS linkedin_replies (
  note_id bigint PRIMARY KEY, date date, contact_id bigint, contact_name text, company_id bigint, message text);
ALTER TABLE linkedin_replies ADD COLUMN IF NOT EXISTS reply_snippet text;
ALTER TABLE linkedin_replies ADD COLUMN IF NOT EXISTS campaign_name text;
ALTER TABLE linkedin_replies ADD COLUMN IF NOT EXISTS lgm_event_id text;
-- LGM retries a webhook until it gets a 2xx; this is what makes a retry a no-op
-- instead of a second note. Partial so pre-existing rows without an id are fine.
CREATE UNIQUE INDEX IF NOT EXISTS ux_linkedin_replies_lgm_event
  ON linkedin_replies (lgm_event_id) WHERE lgm_event_id IS NOT NULL;

-- ---------- Views (final definitions; drop+create is always safe) ----------
DROP VIEW IF EXISTS v_discoveries;
CREATE VIEW v_discoveries AS
  SELECT meeting_id, company_id, company_name, contact_name, owner_name, meeting_start,
         created_at, activity_type, outcome, status, participants, outcome_note, next_todo, topic, conversions
  FROM discoveries;

DROP VIEW IF EXISTS v_calls;
CREATE VIEW v_calls AS
  SELECT call_id, ts, owner_name, disposition_label, bucket, company_id, company_name,
         contact_id, contact_name, duration_seconds, icp_type, persona
  FROM calls;

DROP VIEW IF EXISTS v_deals;
CREATE VIEW v_deals AS
  SELECT deal_id, deal_name, company_id, company_name, pipeline_label, stage_label, amount,
         owner_name, create_date, close_date, dealtype, is_closed, is_won,
         (CASE WHEN is_closed AND close_date IS NOT NULL THEN close_date - create_date
               ELSE CURRENT_DATE - create_date END) AS age_days, next_step, last_activity,
         mrr, has_quote, status_note, todo, partner_name, source_type, source_detail, license_start,
         CASE WHEN has_quote AND COALESCE(mrr,0) > 0 THEN mrr ELSE amount END AS amount_display,
         (has_quote AND COALESCE(mrr,0) > 0) AS amount_is_monthly
  FROM deals_mirror;

DROP VIEW IF EXISTS v_sequence_stats;
CREATE VIEW v_sequence_stats AS
  SELECT sequence_id, sequence_name, status, enrolled, delivered, opens, clicks, replies,
         meetings, bounces, cta, collateral, email_length_words, tone, first_send, last_send,
         CASE WHEN delivered > 0 THEN 100.0 * opens   / delivered ELSE NULL END AS open_rate,
         CASE WHEN delivered > 0 THEN 100.0 * clicks  / delivered ELSE NULL END AS click_rate,
         CASE WHEN delivered > 0 THEN 100.0 * replies / delivered ELSE NULL END AS reply_rate,
         CASE WHEN enrolled  > 0 THEN 100.0 * bounces / enrolled  ELSE NULL END AS bounce_rate,
         steps, main_icp, main_persona, ai_note
  FROM sequence_stats;

DROP VIEW IF EXISTS v_sequence_steps;
CREATE VIEW v_sequence_steps AS
  SELECT sequence_id, step_rank, subject, sends, opens, clicks, replies, cta, collateral, first_sent FROM sequence_steps;

DROP VIEW IF EXISTS v_sequence_companies;
CREATE VIEW v_sequence_companies AS
  SELECT sequence_id, company_id, company_name, first_sent FROM sequence_companies;

DROP VIEW IF EXISTS v_sequence_engagers;
CREATE VIEW v_sequence_engagers AS
  SELECT sequence_id, contact_id, contact_name, company_id, company_name, action, step, ts
  FROM sequence_engagers;

DROP VIEW IF EXISTS v_subject_stats;
CREATE VIEW v_subject_stats AS
  SELECT subject, sends, opens, replies, first_sent, last_sent,
         CASE WHEN sends > 0 THEN 100.0 * opens   / sends ELSE NULL END AS open_rate,
         CASE WHEN sends > 0 THEN 100.0 * replies / sends ELSE NULL END AS reply_rate,
         main_icp, main_persona
  FROM subject_stats;

DROP VIEW IF EXISTS v_subject_recipients;
CREATE VIEW v_subject_recipients AS
  SELECT subject, persona, industry, sends FROM subject_recipients;

DROP VIEW IF EXISTS v_subject_segments;
CREATE VIEW v_subject_segments AS
  SELECT subject, dim, value, sends, opens, replies FROM subject_segments;

DROP VIEW IF EXISTS v_goals;
CREATE VIEW v_goals AS SELECT metric, period, target, label FROM goals;

DROP VIEW IF EXISTS v_customer_journeys;
CREATE VIEW v_customer_journeys AS
  SELECT company_id, name, status, icp, region, source_type, source_detail,
         first_touch, first_disc, first_deal, deal_create, close_date, churn_date,
         cycle_days, journey_days, tt_disc, tt_deal, tt_close,
         emails, calls, connected, meetings, champions, partner_name, license_type, owner_name, mrr, pain, ai_story, events, updated_at
  FROM customer_journeys;

DROP VIEW IF EXISTS v_report_notes;
CREATE VIEW v_report_notes AS SELECT key, note, updated_at FROM report_notes;

DROP VIEW IF EXISTS v_email_daily;
CREATE VIEW v_email_daily AS SELECT date, sends FROM email_daily;

DROP VIEW IF EXISTS v_email_replies;
CREATE VIEW v_email_replies AS
  SELECT email_id, date, contact_id, contact_name, company_id FROM email_replies;

DROP VIEW IF EXISTS v_linkedin_replies;
CREATE VIEW v_linkedin_replies AS
  SELECT note_id, date, contact_id, contact_name, company_id, message, reply_snippet, campaign_name
  FROM linkedin_replies;

-- ---------- Read-only access for the site (anon key) ----------
DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['discoveries','calls','deals_mirror','sequence_stats','sequence_engagers',
    'subject_stats','subject_recipients','subject_segments','goals','email_daily','email_replies','linkedin_replies','sequence_steps','sequence_companies','report_notes','customer_journeys'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = 'anon_read') THEN
      EXECUTE format('CREATE POLICY anon_read ON %I FOR SELECT TO anon USING (true)', t);
    END IF;
  END LOOP;
END $$;
