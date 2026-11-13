-- 002_bridge.sql — helpers for the nightly Supabase → v2 database copy (n8n workflow "Reporting v2 — Supabase Bridge").
-- Schema v1 = replica of Supabase's public schema: tables are copied, views / materialized view / functions are rebuilt
-- from Supabase's own definitions on every run. Schema api gets one pass-through view per v1 relation (marked with the
-- comment 'bridge'), so the site reads the same names as before. A hand-written api view with the same name wins:
-- the bridge never touches api views that don't carry the 'bridge' comment.
-- Rule: hand-written api views may read v1 tables, but not v1 views (those are dropped and recreated every night).
CREATE SCHEMA IF NOT EXISTS v1;
CREATE SCHEMA IF NOT EXISTS bridge;

-- spec = [{name, columns:[{name,type}], pk:[col,…]|null, indexes:[indexdef,…]|null}, …]
CREATE OR REPLACE FUNCTION bridge.apply_tables(spec jsonb) RETURNS jsonb LANGUAGE plpgsql AS $f$
DECLARE t jsonb; c jsonb; ix text; cols text; pk text; cur text;
        created int := 0; added int := 0; notes text[] := '{}';
BEGIN
  FOR t IN SELECT * FROM jsonb_array_elements(spec) LOOP
    IF to_regclass(format('v1.%I', t->>'name')) IS NULL THEN
      SELECT string_agg(format('%I %s', x.v->>'name', x.v->>'type'), ', ' ORDER BY x.o) INTO cols
        FROM jsonb_array_elements(t->'columns') WITH ORDINALITY x(v, o);
      pk := NULL;
      IF jsonb_typeof(t->'pk') = 'array' THEN
        SELECT string_agg(format('%I', x.v), ', ' ORDER BY x.o) INTO pk FROM jsonb_array_elements_text(t->'pk') WITH ORDINALITY x(v, o);
      END IF;
      EXECUTE format('CREATE TABLE v1.%I (%s%s)', t->>'name', cols, CASE WHEN pk IS NOT NULL THEN ', PRIMARY KEY (' || pk || ')' ELSE '' END);
      created := created + 1;
    ELSE
      FOR c IN SELECT * FROM jsonb_array_elements(t->'columns') LOOP
        cur := NULL;
        SELECT format_type(a.atttypid, a.atttypmod) INTO cur FROM pg_attribute a
          WHERE a.attrelid = format('v1.%I', t->>'name')::regclass AND a.attname = c->>'name' AND NOT a.attisdropped;
        IF cur IS NULL THEN
          EXECUTE format('ALTER TABLE v1.%I ADD COLUMN %I %s', t->>'name', c->>'name', c->>'type'); added := added + 1;
        ELSIF cur <> c->>'type' THEN
          notes := notes || format('%s.%s is %s here but %s in the source', t->>'name', c->>'name', cur, c->>'type');
        END IF;
      END LOOP;
    END IF;
    IF jsonb_typeof(t->'indexes') = 'array' THEN
      FOR ix IN SELECT * FROM jsonb_array_elements_text(t->'indexes') LOOP
        EXECUTE replace(regexp_replace(ix, '^CREATE (UNIQUE )?INDEX ', 'CREATE \1INDEX IF NOT EXISTS '), ' ON public.', ' ON v1.');
      END LOOP;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('tables_created', created, 'columns_added', added, 'notes', to_jsonb(notes));
END $f$;

-- one chunk of rows (json array as text); chunk 0 empties the table first. Run all chunks of a table in one transaction.
CREATE OR REPLACE FUNCTION bridge.load(tbl text, chunk int, payload text) RETURNS int LANGUAGE plpgsql AS $f$
DECLARE n int;
BEGIN
  IF chunk = 0 THEN EXECUTE format('TRUNCATE v1.%I', tbl); END IF;
  EXECUTE format('INSERT INTO v1.%I SELECT * FROM json_populate_recordset(NULL::v1.%I, $1::json)', tbl, tbl) USING payload;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $f$;

-- spec = {functions:[{sig,def}], views:[{name,kind:'v'|'m',def}], mv_indexes:[indexdef]}; hidden = ["relation not to expose", …]
-- Runs in one transaction: either everything is rebuilt or nothing changes.
CREATE OR REPLACE FUNCTION bridge.rebuild_views(spec jsonb, hidden jsonb) RETURNS jsonb LANGUAGE plpgsql AS $f$
DECLARE r record; f jsonb; v jsonb; ix text; remaining jsonb; nxt jsonb; pass int := 0; last_err text;
        n_views int := 0; n_api int := 0; left_over int; before int;
BEGIN
  PERFORM set_config('search_path', 'v1', true);

  -- 1 · drop the bridge's own api views, then the replica views (no CASCADE: a foreign dependency must fail loudly)
  FOR r IN SELECT c.relname FROM pg_class c WHERE c.relnamespace = 'api'::regnamespace AND c.relkind = 'v' AND obj_description(c.oid, 'pg_class') = 'bridge' LOOP
    EXECUTE format('DROP VIEW api.%I', r.relname);
  END LOOP;
  LOOP
    SELECT count(*) INTO before FROM pg_class c WHERE c.relnamespace = 'v1'::regnamespace AND c.relkind IN ('v', 'm');
    EXIT WHEN before = 0;
    FOR r IN SELECT c.relname, c.relkind FROM pg_class c WHERE c.relnamespace = 'v1'::regnamespace AND c.relkind IN ('v', 'm') LOOP
      BEGIN
        EXECUTE format('DROP %s v1.%I', CASE r.relkind WHEN 'm' THEN 'MATERIALIZED VIEW' ELSE 'VIEW' END, r.relname);
      EXCEPTION WHEN OTHERS THEN last_err := r.relname || ': ' || SQLERRM;
      END;
    END LOOP;
    SELECT count(*) INTO left_over FROM pg_class c WHERE c.relnamespace = 'v1'::regnamespace AND c.relkind IN ('v', 'm');
    IF left_over = before THEN RAISE EXCEPTION 'bridge: cannot drop replica views (%)', last_err; END IF;
  END LOOP;

  -- 2 · functions
  FOR f IN SELECT * FROM jsonb_array_elements(coalesce(spec->'functions', '[]'::jsonb)) LOOP
    EXECUTE replace(replace(f->>'def', 'public.', 'v1.'), $q$search_path TO 'public'$q$, $q$search_path TO 'v1'$q$);
    EXECUTE format('ALTER FUNCTION v1.%s SET search_path = v1', f->>'sig');
    -- dashboard users (role anon) may not enter schema v1; a function that reads v1 tables (cs_resolve_company) must
    -- therefore run with the owner's rights, otherwise every api view that uses it fails with "permission denied for schema v1"
    EXECUTE format('ALTER FUNCTION v1.%s SECURITY DEFINER', f->>'sig');
  END LOOP;

  -- 3 · views, retried until dependencies resolve
  remaining := coalesce(spec->'views', '[]'::jsonb);
  WHILE jsonb_array_length(remaining) > 0 LOOP
    pass := pass + 1; nxt := '[]'::jsonb;
    FOR v IN SELECT * FROM jsonb_array_elements(remaining) LOOP
      BEGIN
        EXECUTE format('CREATE %s v1.%I AS %s', CASE v->>'kind' WHEN 'm' THEN 'MATERIALIZED VIEW' ELSE 'VIEW' END, v->>'name', rtrim(v->>'def', E'; \n\t'));
        n_views := n_views + 1;
      EXCEPTION WHEN OTHERS THEN
        nxt := nxt || jsonb_build_array(v); last_err := (v->>'name') || ': ' || SQLERRM;
      END;
    END LOOP;
    IF jsonb_array_length(nxt) = jsonb_array_length(remaining) OR pass > 25 THEN
      RAISE EXCEPTION 'bridge: % view(s) could not be created, e.g. %', jsonb_array_length(nxt), last_err;
    END IF;
    remaining := nxt;
  END LOOP;
  FOR ix IN SELECT * FROM jsonb_array_elements_text(coalesce(spec->'mv_indexes', '[]'::jsonb)) LOOP
    EXECUTE replace(ix, ' ON public.', ' ON v1.');
  END LOOP;

  -- 4 · api pass-throughs (skipped where a hand-written api view already owns the name)
  FOR r IN SELECT c.relname FROM pg_class c WHERE c.relnamespace = 'v1'::regnamespace AND c.relkind IN ('r', 'v', 'm')
             AND NOT (coalesce(hidden, '[]'::jsonb) ? c.relname) ORDER BY 1 LOOP
    IF to_regclass(format('api.%I', r.relname)) IS NULL THEN
      EXECUTE format('CREATE VIEW api.%I AS SELECT * FROM v1.%I', r.relname, r.relname);
      EXECUTE format('COMMENT ON VIEW api.%I IS %L', r.relname, 'bridge');
      EXECUTE format('GRANT SELECT ON api.%I TO anon', r.relname);
      n_api := n_api + 1;
    END IF;
  END LOOP;

  NOTIFY pgrst, 'reload schema';
  RETURN jsonb_build_object('views', n_views, 'passes', pass, 'api_views', n_api);
END $f$;
