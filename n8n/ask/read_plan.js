// Reads Claude's plan, checks every data request (known view, read-only path, row limit) and emits one item per
// request for the HTTP node. A plan without requests (clarify / cannot) still emits one placeholder item.
const { cfg } = $('Config').first().json;
const prev = $('Build Plan Request').first().json, ctx = $('Plan Context').first().json;
const r = $json, b = r.body || {}, usage = b.usage || {};
const views = new Set((ctx.catalog || []).map(v => v.v));
let plan = null, err = null;
if (r.statusCode && r.statusCode >= 300) err = 'The AI service answered with an error (' + r.statusCode + (b.error && b.error.message ? ': ' + b.error.message : '') + ').';
else {
  const t = (b.content || []).filter(x => x.type === 'text').map(x => x.text).join('').trim();
  try { plan = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch (e) { err = 'The AI plan could not be read. Please try again or rephrase.'; }
}
const meta = { plan, err, usage: { input: usage.input_tokens || 0, output: usage.output_tokens || 0, cache: usage.cache_read_input_tokens || 0, cache_write: usage.cache_creation_input_tokens || 0 }, q: prev.q, where: prev.where };
const reqs = [];
if (plan && plan.status === 'ok') {
  for (const x of (plan.requests || []).slice(0, cfg.MAX_REQUESTS)) {
    let path = String(x.path || '').trim().replace(/^\/+/, '').replace(/^api\//, '');
    const view = path.split('?')[0];
    if (!/^[a-z0-9_]+$/.test(view) || !views.has(view)) { x.rejected = 'unknown view ' + view; continue; }
    if (/(^|[?&])(on_conflict|columns)=/.test(path)) { x.rejected = 'not allowed'; continue; }
    const m = /[?&]limit=(\d+)/.exec(path);
    if (!m) path += (path.includes('?') ? '&' : '?') + 'limit=' + cfg.MAX_ROWS;
    else if (+m[1] > cfg.MAX_ROWS) path = path.replace(/([?&]limit=)\d+/, '$1' + cfg.MAX_ROWS);
    x.path = path; x.view = view;
    reqs.push(x);
  }
}
if (!reqs.length) return [{ json: { meta, req: null, url: cfg.API + 'v_goals?limit=0' } }];
return reqs.map(x => ({ json: { meta, req: x, url: cfg.API + x.path } }));
