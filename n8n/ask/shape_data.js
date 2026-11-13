// Turns the fetched rows into what the answer step will read (aggregated exactly where the plan asked for it, rows as
// compact CSV otherwise), and estimates the cost and time of the answer from its real size.
const { cfg } = $('Config').first().json, ctx = $('Plan Context').first().json, body = $('Config').first().json.body;
const items = $('Read Plan').all(), got = $input.all(), meta = items[0].json.meta, plan = meta.plan || {};
const price = ctx.price, eur = (i, o, c) => ((i || 0) * price.input_eur + (o || 0) * price.output_eur + (c || 0) * price.cache_read_eur) / 1e6;
// writing the cache costs 1.25 × the input price (first question of a 5-minute window); reading it 0.1 ×
const planCost = eur(meta.usage.input + 1.25 * (meta.usage.cache_write || 0), meta.usage.output, meta.usage.cache);
const iso = d => d.toISOString().slice(0, 10);
const bucket = (fn, v) => { if (v == null || v === '') return ''; const s = String(v).slice(0, 10);
  if (fn === 'day') return s; if (fn === 'month') return s.slice(0, 7); if (fn === 'year') return s.slice(0, 4);
  if (fn === 'week') { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return 'week of ' + iso(d); } return s; };
function aggregate(rows, a) {
  const gb = (a.group_by || []).map(g => g.includes(':') ? g.split(':') : [null, g]);
  const ms = (a.metrics || [{ op: 'count', as: 'count' }]).map(m => ({ op: m.op || 'count', col: m.col, as: m.as || ((m.op || 'count') + (m.col ? '_' + m.col : '')) }));
  const groups = new Map();
  for (const r of rows) {
    const keys = gb.map(([fn, col]) => fn ? bucket(fn, r[col]) : (r[col] == null ? '' : r[col]));
    const k = JSON.stringify(keys);
    let g = groups.get(k); if (!g) { g = { keys, acc: ms.map(() => ({ n: 0, s: 0, min: null, max: null, set: new Set() })) }; groups.set(k, g); }
    ms.forEach((m, i) => { const acc = g.acc[i], v = m.col ? r[m.col] : 1;
      if (m.op === 'count') { if (!m.col || (v != null && v !== '')) acc.n++; return; }
      if (m.op === 'count_distinct') { if (v != null && v !== '') acc.set.add(String(v)); return; }
      const x = Number(v); if (v == null || v === '' || isNaN(x)) return;
      acc.n++; acc.s += x; acc.min = acc.min == null ? x : Math.min(acc.min, x); acc.max = acc.max == null ? x : Math.max(acc.max, x); });
  }
  let out = [...groups.values()].map(g => { const o = {}; gb.forEach(([fn, col], i) => o[(fn ? fn + '_' : '') + col] = g.keys[i]);
    ms.forEach((m, i) => { const a2 = g.acc[i]; o[m.as] = m.op === 'count' ? a2.n : m.op === 'count_distinct' ? a2.set.size : m.op === 'sum' ? Math.round(a2.s * 100) / 100 : m.op === 'avg' ? (a2.n ? Math.round(100 * a2.s / a2.n) / 100 : null) : m.op === 'min' ? a2.min : a2.max; });
    (a.ratios || []).forEach(q => { const d = Number(o[q.den]); o[q.as] = d ? Math.round(10000 * Number(o[q.num]) / d) / 10000 : null; });
    return o; });
  if (a.order_by) out.sort((x, y) => { const p = x[a.order_by], q = y[a.order_by]; const c = (p == null) - (q == null) || (p < q ? -1 : p > q ? 1 : 0); return a.desc ? -c : c; });
  if (a.limit) out = out.slice(0, Math.min(500, a.limit));
  return out;
}
const cell = v => { if (v == null) return ''; let s = typeof v === 'object' ? JSON.stringify(v) : String(v); s = s.replace(/\s+/g, ' ').trim(); if (s.length > 300) s = s.slice(0, 300) + '…'; return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = rows => { if (!rows.length) return '(no rows)'; const cols = Object.keys(rows[0]); return [cols.join(',')].concat(rows.map(r => cols.map(c => cell(r[c])).join(','))).join('\n'); };
const blocks = [], reads = [];
let budget = cfg.MAX_DATA_CHARS;
items.forEach((it, i) => {
  const x = it.json.req; if (!x) return;
  const res = (got[i] || {}).json || {}, status = res.statusCode || 0;
  if (status >= 300 || !Array.isArray(res.body)) { blocks.push('### ' + x.id + ' — ' + x.view + ': could not be read (' + status + (res.body && res.body.message ? ': ' + res.body.message : '') + ')'); reads.push({ id: x.id, view: x.view, why: x.why, error: (res.body && res.body.message) || ('HTTP ' + status) }); return; }
  const rows = res.body, agg = x.aggregate && typeof x.aggregate === 'object' ? aggregate(rows, x.aggregate) : null, shown = agg || rows;
  let text = csv(shown), trunc = false;
  const room = Math.max(4000, Math.floor(budget / Math.max(1, items.length - i)));
  if (text.length > room) { text = text.slice(0, room); text = text.slice(0, text.lastIndexOf('\n')); trunc = true; }
  budget -= text.length;
  const lines = text.split('\n').length - 1;
  blocks.push('### ' + x.id + ' — ' + x.view + ' · ' + rows.length + ' rows read' + (rows.length >= cfg.MAX_ROWS ? ' (row limit reached — there may be more)' : '') + (agg ? ' · aggregated to ' + agg.length + ' rows' : '') + (trunc ? ' · only the first ' + lines + ' rows fit and are shown' : '') + '\nwhy: ' + (x.why || '') + '\nrequest: ' + x.path + (agg ? '\naggregate: ' + JSON.stringify(x.aggregate) : '') + '\n' + text);
  reads.push({ id: x.id, view: x.view, why: x.why, rows: rows.length, shown: lines, aggregated: !!agg, truncated: trunc, limit_hit: rows.length >= cfg.MAX_ROWS });
});
const data = blocks.join('\n\n');
const status = meta.err ? 'failed' : plan.status === 'ok' && !reads.length ? 'cannot' : (plan.status || 'failed');
// size of the answer step: system prompt (~1.2k tokens) + question / context + data; ~3.2 characters per token for this mix
const inTok = Math.round(1200 + (meta.q.length + meta.where.length + data.length) / 3.2), outTok = Math.min(cfg.ANSWER_MAX_TOKENS, Math.max(150, Number(plan.answer_tokens) || 400));
const THINK = 700;   // the model reasons before it writes; observed ~650 tokens, billed as output
const est = eur(inTok, outTok + THINK, 0), secs = Math.round(5 + inTok / 9000 + (outTok + THINK) / 80);
const tooBig = status === 'ok' && est > cfg.MAX_ANSWER_EUR;
const row = { asked_by: String(body.asked_by || '').slice(0, 80), page: String((body.context || {}).page || '').slice(0, 60), element: String(((body.context || {}).element || {}).label || '').slice(0, 200),
  question: meta.q, context: body.context || {}, plan: Object.assign({}, plan, { reads }), data: { text: data, in_tokens: inTok, out_tokens: outTok },
  est_cost_eur: Math.round(est * 10000) / 10000, plan_cost_eur: Math.round(planCost * 10000) / 10000, status: tooBig ? 'too_big' : status,
  usage: { model: cfg.MODEL, input: meta.usage.input + (meta.usage.cache_write || 0), output: meta.usage.output, cache: meta.usage.cache } };
const credits = v => Math.max(1, Math.round(v / cfg.CREDIT_EUR));
const response = { ok: !meta.err, step: 'plan', status: row.status, error: meta.err || undefined,
  understood: plan.understood || null, plan: plan.plan || null, clarify: plan.clarify || null, issues: plan.issues || null, better_way: plan.better_way || null,
  reads: reads.map(r => ({ what: r.why, rows: r.rows, error: r.error })),
  estimate: status === 'ok' ? { eur: row.est_cost_eur, credits: credits(est), seconds: secs, tokens: inTok + outTok + THINK } : null,
  plan_cost: { eur: row.plan_cost_eur, credits: credits(planCost) },
  limit_eur: cfg.MAX_ANSWER_EUR, credit_eur: cfg.CREDIT_EUR };
if (tooBig) response.error = 'This would read too much data (about ' + credits(est) + ' credits). Please narrow the question — a shorter period or one segment.';
return [{ json: { row, response } }];
