-- 004_saved_filters.sql — filter sets users share with everyone ("Shared with everyone" in the Saved filters menu).
-- Personal saved filters stay in the browser; only shared ones are stored here.
-- There is no login yet, so writes are anonymous: the functions below are the only way in and they limit size and count.
CREATE TABLE IF NOT EXISTS app.saved_filters (
  id          bigserial PRIMARY KEY,
  page        text NOT NULL,                       -- page key, e.g. 'deals'
  name        text NOT NULL,
  state       jsonb NOT NULL,                      -- the filter values as the page reads them
  created_by  text,                                -- name the user typed in the dashboard settings (not verified)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS saved_filters_page_name_idx ON app.saved_filters (page, lower(name));

CREATE OR REPLACE VIEW api.saved_filters AS
  SELECT id, page, name, state, created_by, created_at, updated_at FROM app.saved_filters;
GRANT SELECT ON api.saved_filters TO anon;

-- saves (or overwrites, same page + same name) a shared filter set
CREATE OR REPLACE FUNCTION api.save_filter(p_page text, p_name text, p_state jsonb, p_by text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, pg_catalog AS $f$
DECLARE r app.saved_filters;
BEGIN
  p_page := btrim(coalesce(p_page, '')); p_name := btrim(coalesce(p_name, ''));
  -- chr(36) is the end-of-string anchor, written this way so the n8n Postgres node does not mangle it
  IF p_page !~ ('^[a-z0-9_-]{1,40}' || chr(36)) THEN RAISE EXCEPTION 'invalid page'; END IF;
  IF length(p_name) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'name must have 1 to 60 characters'; END IF;
  IF p_state IS NULL OR jsonb_typeof(p_state) <> 'object' OR length(p_state::text) > 6000 THEN RAISE EXCEPTION 'invalid filter state'; END IF;
  IF NOT EXISTS (SELECT 1 FROM app.saved_filters s WHERE s.page = p_page AND lower(s.name) = lower(p_name)) THEN
    IF (SELECT count(*) FROM app.saved_filters s WHERE s.page = p_page) >= 40 THEN RAISE EXCEPTION 'too many shared filters on this page (40) - delete one first'; END IF;
    IF (SELECT count(*) FROM app.saved_filters) >= 600 THEN RAISE EXCEPTION 'too many shared filters'; END IF;
  END IF;
  INSERT INTO app.saved_filters AS s (page, name, state, created_by)
  VALUES (p_page, p_name, p_state, nullif(left(btrim(coalesce(p_by, '')), 80), ''))
  ON CONFLICT (page, lower(name)) DO UPDATE SET state = EXCLUDED.state, name = EXCLUDED.name,
    created_by = coalesce(EXCLUDED.created_by, s.created_by), updated_at = now()
  RETURNING * INTO r;
  RETURN to_jsonb(r);
END $f$;

CREATE OR REPLACE FUNCTION api.delete_filter(p_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, pg_catalog AS $f$
BEGIN
  DELETE FROM app.saved_filters WHERE id = p_id;
  RETURN FOUND;
END $f$;

REVOKE ALL ON FUNCTION api.save_filter(text, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION api.delete_filter(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.save_filter(text, text, jsonb, text) TO anon;
GRANT EXECUTE ON FUNCTION api.delete_filter(bigint) TO anon;
-- Browser entry point. The reverse proxy only lets "simple" cross-site requests through (GET, or POST with a
-- text/plain body), so the dashboard posts one JSON text: {"op":"save","page":..,"name":..,"state":{..},"by":..} or {"op":"delete","id":..}
CREATE OR REPLACE FUNCTION api.filter_op(text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, pg_catalog AS $f$
DECLARE j jsonb;
BEGIN
  IF length($1) > 8000 THEN RAISE EXCEPTION 'request too large'; END IF;
  j := $1::jsonb;
  IF j->>'op' = 'save' THEN RETURN api.save_filter(j->>'page', j->>'name', j->'state', j->>'by');
  ELSIF j->>'op' = 'delete' THEN RETURN jsonb_build_object('deleted', api.delete_filter((j->>'id')::bigint));
  ELSE RAISE EXCEPTION 'unknown op'; END IF;
END $f$;
REVOKE ALL ON FUNCTION api.filter_op(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.filter_op(text) TO anon;
NOTIFY pgrst, 'reload schema';
