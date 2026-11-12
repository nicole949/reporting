import { workflow, node, trigger, sticky, splitInBatches, nextBatch, expr } from '@n8n/workflow-sdk';

const SUPABASE = { postgres: { id: 'nvtjRzdnFqttOZDI', name: 'Postgres account' } };
const V2DB = { postgres: { id: 'WSKtkJQxaUVY77oI', name: 'Postgres/t Database for Vibereport & AI Harness' } };

const daily = trigger({ type: 'n8n-nodes-base.scheduleTrigger', version: 1.2, config: { name: 'Daily 07:40', parameters: { rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 7, triggerAtMinute: 40 }] } } } });
const manual = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Run Manually' } });
const sub = trigger({ type: 'n8n-nodes-base.executeWorkflowTrigger', version: 1.1, config: { name: 'Copy One Table (called by itself)', parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [{ name: 'tbl', type: 'string' }, { name: 'chunk_rows', type: 'number' }] } } } });

const config = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Config', parameters: { jsCode: `// ---- Config ----------------------------------------------------------------
// Tables that are not copied at all (backups, debug).
const SKIP_TABLES = ['lifecycle_diag', 'company_dimensions_bak_20261104', 'company_stage_entries_bak_20261104'];
// Tables that are created empty: sync ledgers / raw mail text that no page or view needs.
const STRUCTURE_ONLY = ['signature_harvest', 'email_classifications', 'instantly_emails', 'instantly_notes'];
// Copied because views need them, but not readable through the API (raw message text).
const HIDDEN_FROM_API = [...STRUCTURE_ONLY, 'reply_evaluations', 'linkedin_replies', 'lgm_actions'];
// Rows per chunk when copying a table.
const CHUNK_ROWS = 5000;
// Name written to app.sync_runs.
const RUN_NAME = 'Reporting v2 — Supabase Bridge';
// -----------------------------------------------------------------------------
return [{ json: { SKIP_TABLES, STRUCTURE_ONLY, HIDDEN_FROM_API, CHUNK_ROWS, RUN_NAME } }];` } } });

const startRun = node({ type: 'n8n-nodes-base.postgres', version: 2.5, config: { name: 'Start Run', credentials: V2DB, parameters: { operation: 'executeQuery', query: "INSERT INTO app.sync_runs (workflow, workflow_id) VALUES ($1, $2) RETURNING id", options: { queryReplacement: expr("{{ [$json.RUN_NAME, $workflow.id] }}") } } } });

const readStructure = node({ type: 'n8n-nodes-base.postgres', version: 2.5, config: { name: 'Read Supabase Structure', credentials: SUPABASE, executeOnce: true, parameters: { operation: 'executeQuery', query: `WITH t AS (
  SELECT c.oid, c.relname AS name FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
), cols AS (
  SELECT a.attrelid, jsonb_agg(jsonb_build_object('name', a.attname, 'type', format_type(a.atttypid, a.atttypmod)) ORDER BY a.attnum) AS cols
  FROM pg_attribute a WHERE a.attnum > 0 AND NOT a.attisdropped GROUP BY 1
), pk AS (
  SELECT i.indrelid, jsonb_agg(a.attname ORDER BY array_position(i.indkey::int2[], a.attnum)) AS pk
  FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey::int2[]) WHERE i.indisprimary GROUP BY 1
), idx AS (
  SELECT i.indrelid, jsonb_agg(pg_get_indexdef(i.indexrelid)) AS defs FROM pg_index i WHERE NOT i.indisprimary GROUP BY 1
)
SELECT jsonb_build_object(
  'tables', (SELECT jsonb_agg(jsonb_build_object('name', t.name, 'columns', cols.cols, 'pk', pk.pk, 'indexes', idx.defs) ORDER BY t.name)
             FROM t JOIN cols ON cols.attrelid = t.oid LEFT JOIN pk ON pk.indrelid = t.oid LEFT JOIN idx ON idx.indrelid = t.oid),
  'views', (SELECT jsonb_agg(jsonb_build_object('name', c.relname, 'kind', c.relkind::text, 'def', pg_get_viewdef(c.oid, true)) ORDER BY c.oid)
            FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('v', 'm')),
  'mv_indexes', (SELECT jsonb_agg(pg_get_indexdef(i.indexrelid)) FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid
                 WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'm'),
  'functions', (SELECT jsonb_agg(jsonb_build_object('sig', p.oid::regprocedure::text, 'def', pg_get_functiondef(p.oid)))
                FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
                  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'))
) AS spec`, options: {} } } });

const plan = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Plan', parameters: { jsCode: `// Turns the Supabase structure into: tables to create, tables to copy, views/functions to rebuild.
const cfg = $('Config').first().json;
const spec = $input.first().json.spec;
const tables = (spec.tables || []).filter(t => !cfg.SKIP_TABLES.includes(t.name));
const copy = tables.map(t => t.name).filter(n => !cfg.STRUCTURE_ONLY.includes(n));
return [{ json: {
  run_id: $('Start Run').first().json.id,
  tables_json: JSON.stringify(tables),
  views_json: JSON.stringify({ views: spec.views || [], mv_indexes: spec.mv_indexes || [], functions: spec.functions || [] }),
  hidden_json: JSON.stringify(cfg.HIDDEN_FROM_API),
  copy,
  counts: { tables: tables.length, copy: copy.length, views: (spec.views || []).length },
} }];` } } });

const applyTables = node({ type: 'n8n-nodes-base.postgres', version: 2.5, config: { name: 'Create Missing Tables', credentials: V2DB, parameters: { operation: 'executeQuery', query: 'SELECT bridge.apply_tables($1::jsonb) AS result', options: { queryReplacement: expr('{{ [$json.tables_json] }}') } } } });

const tableList = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Table List', parameters: { jsCode: `const p = $('Plan').first().json;
const chunk_rows = $('Config').first().json.CHUNK_ROWS;
return p.copy.map(tbl => ({ json: { tbl, chunk_rows } }));` } } });

const loop = splitInBatches({ version: 3, config: { name: 'One Table at a Time', parameters: { batchSize: 1 } } });

const copyTable = node({ type: 'n8n-nodes-base.executeWorkflow', version: 1.2, config: { name: 'Copy Table', parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'BpOeMklBleYNEuS0' }, workflowInputs: { mappingMode: 'defineBelow', value: { tbl: expr('{{ $json.tbl }}'), chunk_rows: expr('{{ $json.chunk_rows }}') }, matchingColumns: [], schema: [{ id: 'tbl', displayName: 'tbl', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }, { id: 'chunk_rows', displayName: 'chunk_rows', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'number' }] }, mode: 'each', options: { waitForSubWorkflow: true } } } });

const totals = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Totals', parameters: { jsCode: `const rows = $input.all().map(i => i.json);
return [{ json: { tables: rows.length, rows: rows.reduce((s, r) => s + (Number(r.rows) || 0), 0), biggest: rows.sort((a, b) => b.rows - a.rows).slice(0, 5).map(r => r.tbl + ' ' + r.rows).join(', ') } }];` } } });

const rebuild = node({ type: 'n8n-nodes-base.postgres', version: 2.5, config: { name: 'Rebuild Views', credentials: V2DB, parameters: { operation: 'executeQuery', query: 'SELECT bridge.rebuild_views($1::jsonb, $2::jsonb) AS result', options: { queryReplacement: expr("{{ [$('Plan').first().json.views_json, $('Plan').first().json.hidden_json] }}") } } } });

const finish = node({ type: 'n8n-nodes-base.postgres', version: 2.5, config: { name: 'Finish Run', credentials: V2DB, parameters: { operation: 'executeQuery', query: "UPDATE app.sync_runs SET finished_at = now(), status = 'ok', rows_written = $1::int, notes = $2 WHERE id = $3::bigint RETURNING id, status, rows_written, notes", options: { queryReplacement: expr("{{ [$('Totals').first().json.rows, $('Totals').first().json.tables + ' tables · ' + JSON.stringify($json.result), $('Plan').first().json.run_id] }}") } } } });

// ---- sub path: copy one table ----
const readChunks = node({ type: 'n8n-nodes-base.postgres', version: 2.5, config: { name: 'Read Chunks', credentials: SUPABASE, parameters: { operation: 'executeQuery', query: `SELECT '{{ $json.tbl }}'::text AS tbl, c.chunk, c.payload FROM (
  SELECT ((s.rn_ - 1) / {{ $json.chunk_rows }})::int AS chunk, json_agg(s)::text AS payload
  FROM (SELECT t.*, row_number() OVER () AS rn_ FROM public."{{ $json.tbl }}" t) s GROUP BY 1
  UNION ALL
  SELECT 0, '[]' WHERE NOT EXISTS (SELECT 1 FROM public."{{ $json.tbl }}")
) c ORDER BY c.chunk`, options: {} } } });

const writeChunks = node({ type: 'n8n-nodes-base.postgres', version: 2.5, config: { name: 'Write Chunks', credentials: V2DB, parameters: { operation: 'executeQuery', query: 'SELECT bridge.load($1, $2::int, $3) AS n', options: { queryBatching: 'transaction', queryReplacement: expr('{{ [$json.tbl, $json.chunk, $json.payload] }}') } } } });

const summarize = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Table Result', parameters: { jsCode: `const tbl = $('Copy One Table (called by itself)').first().json.tbl;
return [{ json: { tbl, rows: $input.all().reduce((s, i) => s + (Number(i.json.n) || 0), 0) } }];` } } });

const note = sticky('## Reporting v2 — Supabase Bridge\nCopies the Supabase reporting tables into schema `v1` of the v2 database every morning (after the Sync Runner), rebuilds the views there from Supabase\'s own definitions and exposes them 1:1 in schema `api`.\n\nTemporary: as each source sync is moved to write into the v2 database directly, its tables drop out of this copy. Helpers: `sql/002_bridge.sql` in the reporting repo. Each run is logged in `app.sync_runs`.', [], { color: 7 });

export default workflow('supabase-bridge', 'Reporting v2 — Supabase Bridge')
  .add(daily).to(config)
  .add(manual).to(config)
  .add(config).to(startRun).to(readStructure).to(plan).to(applyTables).to(tableList)
  .to(loop
    .onDone(totals.to(rebuild).to(finish))
    .onEachBatch(copyTable.to(nextBatch(loop))))
  .add(sub).to(readChunks).to(writeChunks).to(summarize)
  .add(note);
