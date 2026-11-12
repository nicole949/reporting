-- ============================================================================
-- 000_devops_setup.sql — JENTIS Reporting v2 database: one-time setup for DevOps
-- Supersedes migration/01_devops_postgrest_setup.sql (that one was for a 1:1 copy of Supabase; v2 starts fresh).
--
-- Run ONCE as a superuser, connected to the reporting database behind n8n.rec.jentis.com
-- (psql -d <reporting db> -f 000_devops_setup.sql). Safe to re-run.
-- Before running: replace the two <SET-…-PASSWORD> placeholders.
-- After this, the reporting team runs sql/001_init.sql etc. as reporting_app — no further superuser steps needed.
-- ============================================================================

-- 1. Extensions -----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Roles ----------------------------------------------------------------------
--    reporting_app  = login for n8n (sync workflows) and schema migrations; owns all reporting objects
--    authenticator  = login PostgREST connects with; switches to anon for every request
--    anon           = what the browser reads with through PostgREST (SELECT on schema api only)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'reporting_app') THEN
    CREATE ROLE reporting_app LOGIN PASSWORD '<SET-REPORTING-APP-PASSWORD>';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    -- if PostgREST already connects with another login role, skip this and GRANT anon to that role instead
    CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '<SET-AUTHENTICATOR-PASSWORD>';
  END IF;
END $$;
GRANT anon TO authenticator;
GRANT anon TO reporting_app;            -- lets reporting_app test views "as the website" (SET ROLE anon)

ALTER ROLE anon SET statement_timeout = '15s';           -- a heavy browser query can't hog the DB
ALTER ROLE reporting_app SET statement_timeout = '10min'; -- syncs and backfills
ALTER ROLE reporting_app CONNECTION LIMIT 20;

-- 3. Ownership ------------------------------------------------------------------
--    reporting_app owns the database, so it can create the schemas hs / ext / core / api / app itself.
DO $$ BEGIN EXECUTE format('ALTER DATABASE %I OWNER TO reporting_app', current_database()); END $$;

--    Schema api already exists (PostgREST points at it). Hand it to reporting_app so it can create the views.
CREATE SCHEMA IF NOT EXISTS api;
ALTER SCHEMA api OWNER TO reporting_app;
GRANT USAGE ON SCHEMA api TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE reporting_app IN SCHEMA api GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE reporting_app IN SCHEMA api GRANT EXECUTE ON FUNCTIONS TO anon;

--    Nothing in public: anon must not see anything outside api.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM anon;

-- 4. PostgREST picks up new views automatically ------------------------------------
--    (needs superuser for the event trigger; without it every new view needs a PostgREST restart)
CREATE OR REPLACE FUNCTION public.pgrst_watch() RETURNS event_trigger LANGUAGE plpgsql AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
END $$;
DROP EVENT TRIGGER IF EXISTS pgrst_watch;
CREATE EVENT TRIGGER pgrst_watch ON ddl_command_end EXECUTE PROCEDURE public.pgrst_watch();

-- 5. Optional: read-only login for Metabase / a SQL client later ----------------------
-- CREATE ROLE reporting_read LOGIN PASSWORD '<SET-READ-PASSWORD>';
-- GRANT CONNECT ON DATABASE <reporting db> TO reporting_read;
-- (the reporting team grants schema access to it from their side)

-- 6. Check ----------------------------------------------------------------------
SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname IN ('reporting_app', 'authenticator', 'anon') ORDER BY 1;
SELECT nspname, pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname = 'api';
SELECT pg_get_userbyid(datdba) AS db_owner FROM pg_database WHERE datname = current_database();

-- ============================================================================
-- PostgREST config (postgrest.conf or PGRST_* env vars)
--   db-uri                       = postgres://authenticator:<pw>@<host>:5432/<reporting db>
--   db-schemas                   = api
--   db-anon-role                 = anon
--   db-channel-enabled           = true          (default; needed for the auto-reload in step 4)
--   db-max-rows                  = 5000
--   server-cors-allowed-origins  = https://vibe-reports.jentis.info
--   jwt-secret                   = <leave unset for now> → anonymous read-only API, like Supabase's anon key today
--                                  (set later together with the SSO proxy)
-- Restart PostgREST once after this script.
--
-- Network
--   - Postgres 5432 reachable from n8n Cloud (jentis.app.n8n.cloud) egress IPs only — list: n8n docs "Cloud IP addresses"
--   - TLS on for that connection (ssl = on; hostssl … reporting_app … scram-sha-256 in pg_hba.conf)
--   - PostgREST stays on public HTTPS at n8n.rec.jentis.com (the site calls it from the browser)
--
-- Backups
--   - daily pg_dump of the reporting database, keep 14 days
--
-- Please send back to the reporting team
--   host, port, database name, reporting_app password (via 1Password / secure channel),
--   and a note once PostgREST is restarted with db-schemas = api.
--
-- Later, separate ticket: SSO (oauth2-proxy with Google/Microsoft login) in front of /v2/ and PostgREST.
-- ============================================================================
