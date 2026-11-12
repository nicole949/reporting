-- 003_hs.sql — HubSpot mirror (schema hs). Filled by the n8n workflow "Reporting v2 — HubSpot Mirror".
-- One table per HubSpot object, one row per record, all non-empty properties in `props` under HubSpot's own names.
-- A new report needs a new view on these tables, not a new sync.
CREATE SCHEMA IF NOT EXISTS hs;

CREATE TABLE IF NOT EXISTS hs.owners (
  id bigint PRIMARY KEY, email text, first_name text, last_name text, user_id bigint,
  archived boolean NOT NULL DEFAULT false, teams jsonb, synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hs.pipeline_stages (
  object_type text NOT NULL, pipeline_id text NOT NULL, pipeline_label text, pipeline_order int,
  stage_id text NOT NULL, stage_label text, stage_order int, probability numeric, is_closed boolean,
  synced_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (object_type, pipeline_id, stage_id)
);
CREATE TABLE IF NOT EXISTS hs.properties (
  object_type text NOT NULL, name text NOT NULL, label text, type text, field_type text, group_name text,
  options jsonb, hubspot_defined boolean, mirrored boolean NOT NULL DEFAULT true, PRIMARY KEY (object_type, name)
);
CREATE TABLE IF NOT EXISTS hs.associations (
  from_type text NOT NULL, from_id bigint NOT NULL, to_type text NOT NULL, to_id bigint NOT NULL, labels text[],
  synced_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (from_type, from_id, to_type, to_id)
);
CREATE INDEX IF NOT EXISTS associations_to_idx ON hs.associations (to_type, to_id, from_type);

-- owners / pipelines: payload = the raw HubSpot API response
CREATE OR REPLACE FUNCTION hs.set_meta(kind text, payload text) RETURNS int LANGUAGE plpgsql AS $f$
DECLARE n int; j jsonb := payload::jsonb;
BEGIN
  IF kind IN ('owners', 'owners_archived') THEN
    INSERT INTO hs.owners (id, email, first_name, last_name, user_id, archived, teams, synced_at)
    SELECT (r->>'id')::bigint, r->>'email', r->>'firstName', r->>'lastName', nullif(r->>'userId', '')::bigint,
           coalesce((r->>'archived')::boolean, kind = 'owners_archived'), r->'teams', now()
    FROM jsonb_array_elements(coalesce(j->'results', '[]'::jsonb)) r
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
      user_id = EXCLUDED.user_id, archived = EXCLUDED.archived, teams = EXCLUDED.teams, synced_at = now();
  ELSIF kind LIKE 'pipelines_%' THEN
    DELETE FROM hs.pipeline_stages WHERE object_type = substr(kind, 11);
    INSERT INTO hs.pipeline_stages (object_type, pipeline_id, pipeline_label, pipeline_order, stage_id, stage_label, stage_order, probability, is_closed)
    SELECT substr(kind, 11), p->>'id', p->>'label', (p->>'displayOrder')::int, s->>'id', s->>'label', (s->>'displayOrder')::int,
           nullif(s->'metadata'->>'probability', '')::numeric, nullif(s->'metadata'->>'isClosed', '')::boolean
    FROM jsonb_array_elements(coalesce(j->'results', '[]'::jsonb)) p, jsonb_array_elements(p->'stages') s;
  ELSE
    RAISE EXCEPTION 'hs.set_meta: unknown kind %', kind;
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $f$;

-- creates hs.<tbl> if missing and refreshes the property catalogue for the object. props = [{name,label,type,fieldType,groupName,options,hubspotDefined,mirrored}]
CREATE OR REPLACE FUNCTION hs.prepare(tbl text, props text) RETURNS int LANGUAGE plpgsql AS $f$
DECLARE n int;
BEGIN
  EXECUTE format('CREATE TABLE IF NOT EXISTS hs.%I (id bigint PRIMARY KEY, props jsonb NOT NULL DEFAULT ''{}''::jsonb, created_at timestamptz, updated_at timestamptz, archived boolean NOT NULL DEFAULT false, synced_at timestamptz NOT NULL DEFAULT now())', tbl);
  DELETE FROM hs.properties WHERE object_type = tbl;
  INSERT INTO hs.properties (object_type, name, label, type, field_type, group_name, options, hubspot_defined, mirrored)
  SELECT tbl, p->>'name', p->>'label', p->>'type', p->>'fieldType', p->>'groupName',
         CASE WHEN jsonb_array_length(coalesce(p->'options', '[]'::jsonb)) > 0 THEN p->'options' END,
         (p->>'hubspotDefined')::boolean, coalesce((p->>'mirrored')::boolean, true)
  FROM jsonb_array_elements(props::jsonb) p ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $f$;

-- one page of search results (json array of {id, properties, createdAt, updatedAt, archived})
CREATE OR REPLACE FUNCTION hs.upsert(tbl text, payload text) RETURNS int LANGUAGE plpgsql AS $f$
DECLARE n int;
BEGIN
  EXECUTE format($q$
    INSERT INTO hs.%I AS t (id, props, created_at, updated_at, archived, synced_at)
    SELECT (r->>'id')::bigint,
           coalesce((SELECT jsonb_object_agg(e.key, e.value) FROM jsonb_each(r->'properties') e
                     WHERE e.value <> 'null'::jsonb AND e.value <> '""'::jsonb), '{}'::jsonb),
           (r->>'createdAt')::timestamptz, (r->>'updatedAt')::timestamptz, coalesce((r->>'archived')::boolean, false), clock_timestamp()
    FROM jsonb_array_elements($1::jsonb) r
    ON CONFLICT (id) DO UPDATE SET props = EXCLUDED.props, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at,
      archived = EXCLUDED.archived, synced_at = EXCLUDED.synced_at
  $q$, tbl) USING payload;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $f$;

-- after a full run: remove records HubSpot no longer returns (deleted / merged). Refuses when more than 20 % would go.
CREATE OR REPLACE FUNCTION hs.finish(tbl text, started timestamptz) RETURNS jsonb LANGUAGE plpgsql AS $f$
DECLARE total int; stale int; deleted int := 0;
BEGIN
  EXECUTE format('SELECT count(*), count(*) FILTER (WHERE synced_at < $1) FROM hs.%I', tbl) INTO total, stale USING started;
  IF stale > 0 AND stale <= total * 0.2 THEN
    EXECUTE format('DELETE FROM hs.%I WHERE synced_at < $1', tbl) USING started;
    EXECUTE format('DELETE FROM hs.associations a WHERE a.from_type = $1 AND NOT EXISTS (SELECT 1 FROM hs.%I t WHERE t.id = a.from_id)', tbl) USING tbl;
    deleted := stale;
  END IF;
  RETURN jsonb_build_object('table', tbl, 'rows', total - deleted, 'removed', deleted, 'stale_kept', stale - deleted);
END $f$;

-- ids of hs.<tbl> in chunks, one row per target type — the request list for the v4 association batch read
CREATE OR REPLACE FUNCTION hs.assoc_chunks(tbl text, to_types text, chunk_size int) RETURNS TABLE (to_type text, chunk int, ids text) LANGUAGE plpgsql AS $f$
BEGIN
  RETURN QUERY EXECUTE format($q$
    SELECT tt.v, c.chunk, c.ids FROM jsonb_array_elements_text($1::jsonb) tt(v)
    CROSS JOIN (SELECT ((rn - 1) / $2)::int AS chunk, json_agg(json_build_object('id', id::text))::text AS ids
                FROM (SELECT id, row_number() OVER (ORDER BY id) AS rn FROM hs.%I) s GROUP BY 1) c
    ORDER BY 1, 2
  $q$, tbl) USING to_types, chunk_size;
END $f$;

-- ids = the request inputs of one chunk, payload = v4 batch read response
CREATE OR REPLACE FUNCTION hs.set_associations(from_t text, to_t text, ids text, payload text) RETURNS int LANGUAGE plpgsql AS $f$
DECLARE n int;
BEGIN
  DELETE FROM hs.associations a WHERE a.from_type = from_t AND a.to_type = to_t
    AND a.from_id IN (SELECT (x->>'id')::bigint FROM jsonb_array_elements(ids::jsonb) x);
  INSERT INTO hs.associations (from_type, from_id, to_type, to_id, labels, synced_at)
  SELECT from_t, (r->'from'->>'id')::bigint, to_t, (t->>'toObjectId')::bigint,
         ARRAY(SELECT coalesce(nullif(at->>'label', ''), at->>'typeId') FROM jsonb_array_elements(coalesce(t->'associationTypes', '[]'::jsonb)) at), clock_timestamp()
  FROM jsonb_array_elements(coalesce(payload::jsonb->'results', '[]'::jsonb)) r, jsonb_array_elements(coalesce(r->'to', '[]'::jsonb)) t
  ON CONFLICT (from_type, from_id, to_type, to_id) DO UPDATE SET labels = EXCLUDED.labels, synced_at = EXCLUDED.synced_at;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $f$;

-- row counts of everything in hs
CREATE OR REPLACE FUNCTION hs.summary() RETURNS jsonb LANGUAGE plpgsql AS $f$
DECLARE r record; n bigint; out jsonb := '{}'::jsonb;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c WHERE c.relnamespace = 'hs'::regnamespace AND c.relkind = 'r' ORDER BY 1 LOOP
    EXECUTE format('SELECT count(*) FROM hs.%I', r.relname) INTO n;
    out := out || jsonb_build_object(r.relname, n);
  END LOOP;
  RETURN out;
END $f$;
