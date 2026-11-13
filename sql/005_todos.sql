-- 005_todos.sql — shared to-dos and KPI targets on the department overviews ("To-dos & targets").
-- Everyone sees and edits the same list per scope (marketing, bd, sales, cs …). There is no login yet, so writes are
-- anonymous: api.todo_op is the only way in and it limits size and count.
CREATE TABLE IF NOT EXISTS app.todos (
  id          bigserial PRIMARY KEY,
  scope       text NOT NULL,                       -- which overview: 'marketing', 'bd', …
  title       text NOT NULL,
  assignee    text,                                -- free text, usually a team member's name
  due         date,
  kpi         jsonb,                               -- {metric, target, period: week|month|quarter|custom, repeat, from, to, owner}
  done        boolean NOT NULL DEFAULT false,
  done_at     timestamptz,
  done_by     text,
  sort        double precision NOT NULL DEFAULT 0,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS todos_scope_idx ON app.todos (scope, done, sort);

CREATE OR REPLACE VIEW api.todos AS
  SELECT id, scope, title, assignee, due, kpi, done, done_at, done_by, sort, created_by, created_at, updated_at FROM app.todos;
GRANT SELECT ON api.todos TO anon;

-- One JSON text per call (POST text/plain — the proxy answers CORS preflights for GET only):
--   {"op":"add",    "scope":"marketing", "title":"…", "assignee":…, "due":…, "kpi":{…}, "by":"…"}
--   {"op":"update", "id":1, "title":…, "assignee":…, "due":…, "kpi":{…}|null, "sort":…}   (only the keys sent are changed)
--   {"op":"done",   "id":1, "done":true|false, "by":"…"}
--   {"op":"delete", "id":1}
CREATE OR REPLACE FUNCTION api.todo_op(text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, pg_catalog AS $f$
DECLARE j jsonb; r app.todos; k jsonb; id_ bigint;
BEGIN
  IF length($1) > 6000 THEN RAISE EXCEPTION 'request too large'; END IF;
  j := $1::jsonb;
  id_ := nullif(j->>'id', '')::bigint;
  -- a KPI target must name a metric and a positive number; everything else in it is optional
  IF j ? 'kpi' AND jsonb_typeof(j->'kpi') = 'object' THEN
    k := j->'kpi';
    IF coalesce(k->>'metric', '') !~ ('^[a-z0-9_]{1,40}' || chr(36)) THEN RAISE EXCEPTION 'KPI target: pick a metric'; END IF;
    IF coalesce(nullif(k->>'target', '')::numeric, 0) <= 0 THEN RAISE EXCEPTION 'KPI target: enter a number above 0'; END IF;
    IF length(k::text) > 1000 THEN RAISE EXCEPTION 'KPI target too large'; END IF;
  END IF;
  IF j ? 'title' AND length(btrim(coalesce(j->>'title', ''))) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'the to-do needs a text (up to 200 characters)'; END IF;

  IF j->>'op' = 'add' THEN
    IF coalesce(j->>'scope', '') !~ ('^[a-z0-9_-]{1,30}' || chr(36)) THEN RAISE EXCEPTION 'invalid scope'; END IF;
    IF NOT j ? 'title' THEN RAISE EXCEPTION 'the to-do needs a text'; END IF;
    IF (SELECT count(*) FROM app.todos t WHERE t.scope = j->>'scope' AND NOT t.done) >= 200 THEN RAISE EXCEPTION 'too many open to-dos on this page (200)'; END IF;
    IF (SELECT count(*) FROM app.todos) >= 5000 THEN RAISE EXCEPTION 'too many to-dos'; END IF;
    INSERT INTO app.todos (scope, title, assignee, due, kpi, sort, created_by)
    VALUES (j->>'scope', btrim(j->>'title'), nullif(left(btrim(coalesce(j->>'assignee', '')), 80), ''), nullif(j->>'due', '')::date,
            CASE WHEN jsonb_typeof(j->'kpi') = 'object' THEN j->'kpi' END,
            coalesce((SELECT max(t.sort) FROM app.todos t WHERE t.scope = j->>'scope'), 0) + 1,
            nullif(left(btrim(coalesce(j->>'by', '')), 80), ''))
    RETURNING * INTO r;
  ELSIF j->>'op' = 'update' THEN
    UPDATE app.todos t SET
      title    = CASE WHEN j ? 'title' THEN btrim(j->>'title') ELSE t.title END,
      assignee = CASE WHEN j ? 'assignee' THEN nullif(left(btrim(coalesce(j->>'assignee', '')), 80), '') ELSE t.assignee END,
      due      = CASE WHEN j ? 'due' THEN nullif(j->>'due', '')::date ELSE t.due END,
      kpi      = CASE WHEN j ? 'kpi' THEN CASE WHEN jsonb_typeof(j->'kpi') = 'object' THEN j->'kpi' END ELSE t.kpi END,
      sort     = CASE WHEN j ? 'sort' THEN (j->>'sort')::double precision ELSE t.sort END,
      updated_at = now()
    WHERE t.id = id_ RETURNING * INTO r;
  ELSIF j->>'op' = 'done' THEN
    UPDATE app.todos t SET done = coalesce((j->>'done')::boolean, true),
      done_at = CASE WHEN coalesce((j->>'done')::boolean, true) THEN now() END,
      done_by = CASE WHEN coalesce((j->>'done')::boolean, true) THEN nullif(left(btrim(coalesce(j->>'by', '')), 80), '') END,
      updated_at = now()
    WHERE t.id = id_ RETURNING * INTO r;
  ELSIF j->>'op' = 'delete' THEN
    DELETE FROM app.todos t WHERE t.id = id_;
    RETURN jsonb_build_object('deleted', FOUND);
  ELSE
    RAISE EXCEPTION 'unknown op';
  END IF;
  IF r.id IS NULL THEN RAISE EXCEPTION 'to-do not found (deleted by someone else?)'; END IF;
  RETURN to_jsonb(r);
END $f$;
REVOKE ALL ON FUNCTION api.todo_op(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.todo_op(text) TO anon;
NOTIFY pgrst, 'reload schema';
