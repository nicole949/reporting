import { workflow, node, trigger, ifElse, splitInBatches, nextBatch, expr } from '@n8n/workflow-sdk';

const V2DB = { postgres: { id: 'WSKtkJQxaUVY77oI', name: 'Postgres/t Database for Vibereport & AI Harness' } };
const HS = { httpHeaderAuth: { id: 'Uv4k2RMMsWPZCuS2', name: 'Hubspot Admin' } };
const hsAuth = { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' };

const daily = trigger({ type: 'n8n-nodes-base.scheduleTrigger', version: 1.2, config: { name: 'Daily 05:10', parameters: { rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 5, triggerAtMinute: 10 }] } } } });
const manual = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Run Manually' } });
const sub = trigger({ type: 'n8n-nodes-base.executeWorkflowTrigger', version: 1.1, config: { name: 'Mirror One Object (called by itself)', parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [{ name: 'object', type: 'string' }, { name: 'table', type: 'string' }, { name: 'assoc', type: 'string' }, { name: 'started', type: 'string' }, { name: 'exclude', type: 'string' }, { name: 'page_size', type: 'number' }] } } } });

const config = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Config', parameters: { jsCode: `// ---- Config ----------------------------------------------------------------
// HubSpot objects to mirror.
//   object = name in the HubSpot API, table = table in schema hs, assoc = linked objects stored in hs.associations
const OBJECTS = [
  { object: 'companies',  table: 'companies',  assoc: [] },
  { object: 'deals',      table: 'deals',      assoc: ['companies', 'contacts', 'line_items', 'quotes'] },
  { object: 'line_items', table: 'line_items', assoc: [] },
  { object: 'quotes',     table: 'quotes',     assoc: [] },
  { object: 'tickets',    table: 'tickets',    assoc: ['companies'] },
  { object: 'calls',      table: 'calls',      assoc: ['companies', 'contacts'] },
  { object: 'meetings',   table: 'meetings',   assoc: ['companies', 'contacts', 'deals'] },
  { object: '0-162',      table: 'services',   assoc: ['companies', 'deals'] },   // HubSpot "Services"
];
// Contacts are not mirrored yet: personal data, wait until the database connection is encrypted (TLS).
// Properties that are never copied (regular expression on the property name): long free text such as
// call notes, meeting notes, transcripts, HTML bodies and ticket descriptions.
const EXCLUDE_PROPS = '(_body$|_html$|transcript|body_preview|^content$|internal_meeting_notes|hs_call_summary)';
// Records per HubSpot search request (max 200).
const PAGE_SIZE = 200;
// Name written to app.sync_runs.
const RUN_NAME = 'Reporting v2 — HubSpot Mirror';
// -----------------------------------------------------------------------------
return [{ json: { OBJECTS, EXCLUDE_PROPS, PAGE_SIZE, RUN_NAME } }];` } } });

const startRun = node({ type: 'n8n-nodes-base.postgres', version: 2.5, config: { name: 'Start Run', credentials: V2DB, parameters: { operation: 'executeQuery', query: 'INSERT INTO app.sync_runs (workflow, workflow_id) VALUES ($1, $2) RETURNING id, started_at', options: { queryReplacement: expr('{{ [$json.RUN_NAME, $workflow.id] }}') } } } });

const metaRequests = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Meta Requests', parameters: { jsCode: `const B = 'https://api.hubapi.com/crm/v3/';
return [
  { json: { kind: 'owners', url: B + 'owners?limit=500' } },
  { json: { kind: 'owners_archived', url: B + 'owners?limit=500&archived=true' } },
  { json: { kind: 'pipelines_deals', url: B + 'pipelines/deals' } },
  { json: { kind: 'pipelines_tickets', url: B + 'pipelines/tickets' } },
];` } } });

const metaGet = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Get Owners & Pipelines', credentials: HS, retryOnFail: true, maxTries: 4, waitBetweenTries: 3000, parameters: { ...hsAuth, method: 'GET', url: expr('{{ $json.url }}'), options: { batching: { batch: { batchSize: 1, batchInterval: 300 } } } } } });

const writeMeta = node({ type: 'n8n-nodes-base.postgres', version: 2.5, config: { name: 'Write Owners & Pipelines', credentials: V2DB, parameters: { operation: 'executeQuery', query: 'SELECT hs.set_meta($1, $2) AS n', options: { queryReplacement: expr("{{ [$('Meta Requests').item.json.kind, JSON.stringify($json)] }}") } } } });

const objectList = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Object List', parameters: { jsCode: `const cfg = $('Config').first().json;
const started = new Date($('Start Run').first().json.started_at).toISOString();
return cfg.OBJECTS.map(o => ({ json: { object: o.object, table: o.table, assoc: JSON.stringify(o.assoc || []), started, exclude: cfg.EXCLUDE_PROPS, page_size: cfg.PAGE_SIZE } }));` } } });

const loop = splitInBatches({ version: 3, config: { name: 'One Object at a Time', parameters: { batchSize: 1 } } });

const f = (id, type) => ({ id, displayName: id, required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type });
const mirrorObject = node({ type: 'n8n-nodes-base.executeWorkflow', version: 1.2, config: { name: 'Mirror Object', alwaysOutputData: true, parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'tKjh1lpirdiM65Nc' }, workflowInputs: { mappingMode: 'defineBelow', value: { object: expr('{{ $json.object }}'), table: expr('{{ $json.table }}'), assoc: expr('{{ $json.assoc }}'), started: expr('{{ $json.started }}'), exclude: expr('{{ $json.exclude }}'), page_size: expr('{{ $json.page_size }}') }, matchingColumns: [], schema: [f('object', 'string'), f('table', 'string'), f('assoc', 'string'), f('started', 'string'), f('exclude', 'string'), f('page_size', 'number')] }, mode: 'each', options: { waitForSubWorkflow: true } } } });

const finish = node({ type: 'n8n-nodes-base.postgres', version: 2.5, config: { name: 'Finish Run', credentials: V2DB, executeOnce: true, parameters: { operation: 'executeQuery', query: "UPDATE app.sync_runs SET finished_at = now(), status = 'ok', rows_written = (SELECT sum(value::bigint) FROM jsonb_each_text(hs.summary())), notes = hs.summary()::text WHERE id = $1::bigint RETURNING id, status, rows_written, notes", options: { queryReplacement: expr("{{ [$('Start Run').first().json.id] }}") } } } });

// ---- sub path: one object ----
const getProps = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Get Property List', credentials: HS, retryOnFail: true, maxTries: 4, waitBetweenTries: 3000, parameters: { ...hsAuth, method: 'GET', url: expr('https://api.hubapi.com/crm/v3/properties/{{ $json.object }}'), options: {} } } });

const initState = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Init State', parameters: { jsCode: `// Property catalogue for this object and the list of properties to request.
const inp = $('Mirror One Object (called by itself)').first().json;
const all = $input.first().json.results || [];
const re = new RegExp(inp.exclude);
const catalogue = all.map(p => ({ name: p.name, label: p.label, type: p.type, fieldType: p.fieldType, groupName: p.groupName,
  options: (p.options || []).map(o => ({ label: o.label, value: o.value })), hubspotDefined: !!p.hubspotDefined, mirrored: !re.test(p.name) }));
return [{ json: { ...inp, props: catalogue.filter(p => p.mirrored).map(p => p.name), props_json: JSON.stringify(catalogue) } }];` } } });

const prepare = node({ type: 'n8n-nodes-base.postgres', version: 2.5, config: { name: 'Prepare Table', credentials: V2DB, parameters: { operation: 'executeQuery', query: 'SELECT hs.prepare($1, $2) AS properties, 0 AS last_id', options: { queryReplacement: expr('{{ [$json.table, $json.props_json] }}') } } } });

const searchPage = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Search Page', credentials: HS, retryOnFail: true, maxTries: 5, waitBetweenTries: 5000, parameters: { ...hsAuth, method: 'POST', url: expr("https://api.hubapi.com/crm/v3/objects/{{ $('Init State').first().json.object }}/search"), sendBody: true, specifyBody: 'json', jsonBody: expr("{{ JSON.stringify({ limit: $('Init State').first().json.page_size, sorts: [{ propertyName: 'hs_object_id', direction: 'ASCENDING' }], properties: $('Init State').first().json.props, filterGroups: [{ filters: [{ propertyName: 'hs_object_id', operator: 'GT', value: String($json.last_id || 0) }] }] }) }}"), options: { timeout: 90000 } } } });

const upsertPage = node({ type: 'n8n-nodes-base.postgres', version: 2.5, config: { name: 'Upsert Page', credentials: V2DB, parameters: { operation: 'executeQuery', query: 'SELECT hs.upsert($1, $2) AS n, $3::text AS last_id, $4::int AS got, $5::int AS page_size', options: { queryReplacement: expr("{{ [$('Init State').first().json.table, JSON.stringify($json.results || []), ($json.results || []).length ? $json.results[$json.results.length - 1].id : '0', ($json.results || []).length, $('Init State').first().json.page_size] }}") } } } });

const more = ifElse({ version: 2.2, config: { name: 'More Pages?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.got >= $json.page_size }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } } } });

const finishObject = node({ type: 'n8n-nodes-base.postgres', version: 2.5, config: { name: 'Remove Deleted Records', credentials: V2DB, parameters: { operation: 'executeQuery', query: 'SELECT hs.finish($1, $2::timestamptz) AS result', options: { queryReplacement: expr("{{ [$('Init State').first().json.table, $('Init State').first().json.started] }}") } } } });

const assocChunks = node({ type: 'n8n-nodes-base.postgres', version: 2.5, config: { name: 'Association Requests', credentials: V2DB, parameters: { operation: 'executeQuery', query: 'SELECT * FROM hs.assoc_chunks($1, $2, 1000)', options: { queryReplacement: expr("{{ [$('Init State').first().json.table, $('Init State').first().json.assoc] }}") } } } });

const assocRead = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Read Associations', credentials: HS, retryOnFail: true, maxTries: 5, waitBetweenTries: 5000, parameters: { ...hsAuth, method: 'POST', url: expr("https://api.hubapi.com/crm/v4/associations/{{ $('Init State').first().json.object }}/{{ $json.to_type }}/batch/read"), sendBody: true, specifyBody: 'json', jsonBody: expr("{{ '{\"inputs\":' + $json.ids + '}' }}"), options: { timeout: 90000, batching: { batch: { batchSize: 1, batchInterval: 300 } } } } } });

const writeAssoc = node({ type: 'n8n-nodes-base.postgres', version: 2.5, config: { name: 'Write Associations', credentials: V2DB, parameters: { operation: 'executeQuery', query: 'SELECT hs.set_associations($1, $2, $3, $4) AS n', options: { queryReplacement: expr("{{ [$('Init State').first().json.table, $('Association Requests').item.json.to_type, $('Association Requests').item.json.ids, JSON.stringify($json)] }}") } } } });

export default workflow('hubspot-mirror', 'Reporting v2 — HubSpot Mirror')
  .add(daily).to(config)
  .add(manual).to(config)
  .add(config).to(startRun).to(metaRequests).to(metaGet).to(writeMeta).to(objectList)
  .to(loop
    .onDone(finish)
    .onEachBatch(mirrorObject.to(nextBatch(loop))))
  .add(sub).to(getProps).to(initState).to(prepare).to(searchPage).to(upsertPage)
  .to(more
    .onTrue(searchPage)
    .onFalse(finishObject.to(assocChunks).to(assocRead).to(writeAssoc)));
