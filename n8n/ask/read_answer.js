// Reads Claude's answer and its real cost.
const { cfg } = $('Config').first().json, prev = $('Build Answer Request').first().json, q = $('Load Question').first().json;
const r = $json, b = r.body || {}, u = b.usage || {}, price = q.price;
let ans = null, err = null;
if (r.statusCode && r.statusCode >= 300) err = 'The AI service answered with an error (' + r.statusCode + (b.error && b.error.message ? ': ' + b.error.message : '') + ').';
else { const t = (b.content || []).filter(x => x.type === 'text').map(x => x.text).join('').trim();
  if (!t) err = 'The AI returned no answer.';
  else { ans = {}; const keep = [];
    for (const line of t.split('\n')) { const m = /^\s*\**(Basis|Issue|Suggestion)\**\s*:\s*(.+)$/i.exec(line); if (m) ans[m[1].toLowerCase()] = m[2].trim(); else keep.push(line); }
    ans.answer = keep.join('\n').trim(); } }
const cost = ((u.input_tokens || 0) * price.input_eur + (u.output_tokens || 0) * price.output_eur + (u.cache_read_input_tokens || 0) * price.cache_read_eur) / 1e6;
const ms = Date.now() - prev.started, credits = v => Math.max(1, Math.round(v / cfg.CREDIT_EUR));
const row = { id: q.id, status: err ? 'failed' : 'answered', answer: ans || { error: err }, answer_cost_eur: Math.round(cost * 10000) / 10000, duration_ms: ms,
  usage: { model: cfg.MODEL, input: u.input_tokens || 0, output: u.output_tokens || 0, cache: u.cache_read_input_tokens || 0, stop: b.stop_reason || null }, asked_by: q.asked_by };
const total = cost + (Number(q.plan_cost_eur) || 0);
const response = { ok: !err, step: 'run', error: err || undefined, answer: ans && ans.answer, basis: ans && ans.basis, issue: ans && ans.issue, suggestion: ans && ans.suggestion,
  cost: { eur: row.answer_cost_eur, credits: credits(cost), total_eur: Math.round(total * 10000) / 10000, total_credits: credits(total) }, seconds: Math.round(ms / 1000),
  reads: ((q.plan || {}).reads || []).map(x => ({ what: x.why, rows: x.rows, truncated: x.truncated, limit_hit: x.limit_hit })) };
return [{ json: { row, response } }];
