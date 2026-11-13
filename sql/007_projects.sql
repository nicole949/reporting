-- 007_projects.sql — "Projects" card on the overview pages (next to "To-dos & targets").
-- A project has a name, status, owner, timeframe, a description and a list of subtasks. Shared per scope like the to-dos
-- (everyone on the page sees and edits the same list). No login yet, so writes are anonymous: api.project_op is the only
-- way in and it limits size and count.
CREATE TABLE IF NOT EXISTS app.projects (
  id          bigserial PRIMARY KEY,
  scope       text NOT NULL,                       -- which overview: 'marketing' (= Go-To-Market), 'sales', 'cs' …
  name        text NOT NULL,
  status      text NOT NULL DEFAULT 'planned' CHECK (status IN ('idea', 'planned', 'active', 'blocked', 'on_hold', 'done')),
  owner       text,                                -- free text, usually a team member's name
  start_date  date,
  end_date    date,
  description text,
  sort        double precision NOT NULL DEFAULT 0,
  done_at     timestamptz,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_scope_idx ON app.projects (scope, status, sort);

CREATE TABLE IF NOT EXISTS app.project_tasks (
  id          bigserial PRIMARY KEY,
  project_id  bigint NOT NULL REFERENCES app.projects (id) ON DELETE CASCADE,
  title       text NOT NULL,
  done        boolean NOT NULL DEFAULT false,
  done_at     timestamptz,
  done_by     text,
  sort        double precision NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_tasks_project_idx ON app.project_tasks (project_id, sort);

-- one row per project, subtasks as a JSON array in their order
CREATE OR REPLACE VIEW api.projects AS
  SELECT p.id, p.scope, p.name, p.status, p.owner, p.start_date, p.end_date, p.description, p.sort, p.done_at,
         p.created_by, p.created_at, p.updated_at,
         coalesce((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'done', t.done, 'done_at', t.done_at, 'done_by', t.done_by) ORDER BY t.sort, t.id)
                   FROM app.project_tasks t WHERE t.project_id = p.id), '[]'::jsonb) AS subtasks
  FROM app.projects p;
GRANT SELECT ON api.projects TO anon;

-- One JSON text per call (POST text/plain — the proxy answers CORS preflights for GET only):
--   {"op":"add",      "scope":"marketing", "name":"…", "status":…, "owner":…, "start_date":…, "end_date":…, "description":…, "by":"…"}
--   {"op":"update",   "id":1, "name":…, "status":…, "owner":…, "start_date":…, "end_date":…, "description":…, "sort":…}  (only the keys sent change)
--   {"op":"delete",   "id":1}
--   {"op":"task_add", "id":1, "title":"…"}            id = the project
--   {"op":"task_done","task_id":5, "done":true|false, "by":"…"}
--   {"op":"task_edit","task_id":5, "title":"…"}
--   {"op":"task_delete","task_id":5}
-- Every call returns the whole project as api.projects shows it (or {"deleted":…}).
CREATE OR REPLACE FUNCTION api.project_op(text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, pg_catalog AS $f$
DECLARE j jsonb; pid bigint; tid bigint; st text; res jsonb;
BEGIN
  IF length($1) > 12000 THEN RAISE EXCEPTION 'request too large'; END IF;
  j := $1::jsonb;
  pid := nullif(j->>'id', '')::bigint;
  tid := nullif(j->>'task_id', '')::bigint;
  IF j ? 'name' AND length(btrim(coalesce(j->>'name', ''))) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'the project needs a name (up to 160 characters)'; END IF;
  IF j ? 'description' AND length(coalesce(j->>'description', '')) > 6000 THEN RAISE EXCEPTION 'the description is too long (6000 characters)'; END IF;
  IF j ? 'status' AND coalesce(j->>'status', '') NOT IN ('idea', 'planned', 'active', 'blocked', 'on_hold', 'done') THEN RAISE EXCEPTION 'invalid status'; END IF;
  IF j ? 'title' AND length(btrim(coalesce(j->>'title', ''))) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'the subtask needs a text (up to 300 characters)'; END IF;
  IF nullif(j->>'start_date', '') IS NOT NULL AND nullif(j->>'end_date', '') IS NOT NULL AND (j->>'end_date')::date < (j->>'start_date')::date THEN RAISE EXCEPTION 'the end lies before the start'; END IF;

  IF j->>'op' = 'add' THEN
    IF coalesce(j->>'scope', '') !~ ('^[a-z0-9_-]{1,30}' || chr(36)) THEN RAISE EXCEPTION 'invalid scope'; END IF;
    IF NOT j ? 'name' THEN RAISE EXCEPTION 'the project needs a name'; END IF;
    IF (SELECT count(*) FROM app.projects p WHERE p.scope = j->>'scope' AND p.status <> 'done') >= 100 THEN RAISE EXCEPTION 'too many open projects on this page (100)'; END IF;
    IF (SELECT count(*) FROM app.projects) >= 2000 THEN RAISE EXCEPTION 'too many projects'; END IF;
    st := coalesce(nullif(j->>'status', ''), 'planned');
    INSERT INTO app.projects (scope, name, status, owner, start_date, end_date, description, sort, done_at, created_by)
    VALUES (j->>'scope', btrim(j->>'name'), st, nullif(left(btrim(coalesce(j->>'owner', '')), 80), ''),
            nullif(j->>'start_date', '')::date, nullif(j->>'end_date', '')::date, nullif(btrim(coalesce(j->>'description', '')), ''),
            coalesce((SELECT max(p.sort) FROM app.projects p WHERE p.scope = j->>'scope'), 0) + 1,
            CASE WHEN st = 'done' THEN now() END,
            nullif(left(btrim(coalesce(j->>'by', '')), 80), ''))
    RETURNING id INTO pid;
  ELSIF j->>'op' = 'update' THEN
    UPDATE app.projects p SET
      name        = CASE WHEN j ? 'name' THEN btrim(j->>'name') ELSE p.name END,
      status      = CASE WHEN j ? 'status' THEN j->>'status' ELSE p.status END,
      done_at     = CASE WHEN j ? 'status' THEN CASE WHEN j->>'status' = 'done' THEN coalesce(p.done_at, now()) END ELSE p.done_at END,
      owner       = CASE WHEN j ? 'owner' THEN nullif(left(btrim(coalesce(j->>'owner', '')), 80), '') ELSE p.owner END,
      start_date  = CASE WHEN j ? 'start_date' THEN nullif(j->>'start_date', '')::date ELSE p.start_date END,
      end_date    = CASE WHEN j ? 'end_date' THEN nullif(j->>'end_date', '')::date ELSE p.end_date END,
      description = CASE WHEN j ? 'description' THEN nullif(btrim(coalesce(j->>'description', '')), '') ELSE p.description END,
      sort        = CASE WHEN j ? 'sort' THEN (j->>'sort')::double precision ELSE p.sort END,
      updated_at  = now()
    WHERE p.id = pid;
    IF NOT FOUND THEN RAISE EXCEPTION 'project not found (deleted by someone else?)'; END IF;
  ELSIF j->>'op' = 'delete' THEN
    DELETE FROM app.projects p WHERE p.id = pid;
    RETURN jsonb_build_object('deleted', FOUND);
  ELSIF j->>'op' = 'task_add' THEN
    IF NOT j ? 'title' THEN RAISE EXCEPTION 'the subtask needs a text'; END IF;
    IF NOT EXISTS (SELECT 1 FROM app.projects p WHERE p.id = pid) THEN RAISE EXCEPTION 'project not found (deleted by someone else?)'; END IF;
    IF (SELECT count(*) FROM app.project_tasks t WHERE t.project_id = pid) >= 100 THEN RAISE EXCEPTION 'too many subtasks (100)'; END IF;
    INSERT INTO app.project_tasks (project_id, title, sort)
    VALUES (pid, btrim(j->>'title'), coalesce((SELECT max(t.sort) FROM app.project_tasks t WHERE t.project_id = pid), 0) + 1);
    UPDATE app.projects p SET updated_at = now() WHERE p.id = pid;
  ELSIF j->>'op' IN ('task_done', 'task_edit', 'task_delete') THEN
    SELECT t.project_id INTO pid FROM app.project_tasks t WHERE t.id = tid;
    IF pid IS NULL THEN RAISE EXCEPTION 'subtask not found (deleted by someone else?)'; END IF;
    IF j->>'op' = 'task_done' THEN
      UPDATE app.project_tasks t SET done = coalesce((j->>'done')::boolean, true),
        done_at = CASE WHEN coalesce((j->>'done')::boolean, true) THEN now() END,
        done_by = CASE WHEN coalesce((j->>'done')::boolean, true) THEN nullif(left(btrim(coalesce(j->>'by', '')), 80), '') END
      WHERE t.id = tid;
    ELSIF j->>'op' = 'task_edit' THEN
      IF NOT j ? 'title' THEN RAISE EXCEPTION 'the subtask needs a text'; END IF;
      UPDATE app.project_tasks t SET title = btrim(j->>'title') WHERE t.id = tid;
    ELSE
      DELETE FROM app.project_tasks t WHERE t.id = tid;
    END IF;
    UPDATE app.projects p SET updated_at = now() WHERE p.id = pid;
  ELSE
    RAISE EXCEPTION 'unknown op';
  END IF;
  SELECT to_jsonb(v) INTO res FROM api.projects v WHERE v.id = pid;
  RETURN res;
END $f$;
REVOKE ALL ON FUNCTION api.project_op(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.project_op(text) TO anon;
NOTIFY pgrst, 'reload schema';
