// Loads the confirmed question and builds the answer request from exactly the data read in the plan step.
const { cfg, body } = $('Config').first().json, q = $json;
const stop = msg => [{ json: { stop: true, response: { ok: false, step: 'run', error: msg } } }];
if (!q || !q.id) return stop('This question has expired or was already answered. Please ask again.');
if ((Number(q.spent_today) || 0) >= cfg.DAILY_BUDGET_EUR) return stop('The daily AI budget (' + cfg.DAILY_BUDGET_EUR + ' €) is used up. Asking works again tomorrow.');
const plan = q.plan || {}, c = q.context || {}, data = (q.data || {}).text || '';
const cut = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + ' …' : s; };
const defs = (c.docs || []).slice(0, 60).map(d => '- ' + cut(d.m, 80) + ': ' + cut(d.calc, 500)).join('\n');
const system = `You answer a question asked inside JENTIS's internal commercial reporting dashboard, using ONLY the data below (read from the dashboard's data API a moment ago) and the dashboard's definitions.

Rules:
- Lead with the answer. Max 120 words; a short list (max 8 bullets) where it reads better.
- Every number, name and date must come from the data. If you calculate something (rate, share, difference), say in a few words how.
- No guessing, no filler, no generic advice. If the data does not answer the question, or only partly, say exactly what is missing.
- Use names exactly as in the data (companies, sequences, subject lines). Mention the period the answer covers.
- Answer in the language of the question.

Format: the answer in markdown (**bold** and '- ' bullets only; no headings, no tables). Then, each on its own line at the very end:
Basis: <one line — which data and period the answer rests on>
Issue: <only if you noticed a data problem: gaps, duplicates, a row limit that was hit, numbers that contradict the dashboard>
Suggestion: <only if there is a significantly better way to answer this or a better question to ask>`;
const user = 'Question: ' + q.question + '\nAs understood: ' + (plan.understood || '') + '\nPage: ' + (c.page_title || c.page || '') + (c.element && c.element.label ? ' · asked from: ' + c.element.label : '') + (c.period ? ' · period on the page: ' + c.period : '') +
  (c.element && c.element.text ? '\nWhat the user sees there:\n' + cut(c.element.text, 2000) : '') +
  ((c.history || []).length ? '\nEarlier in this conversation:\n' + c.history.slice(-3).map(h => 'Q: ' + cut(h.q, 300) + '\nA: ' + cut(h.a, 600)).join('\n') : '') +
  (defs ? '\n\nDashboard definitions:\n' + defs : '') + (plan.issues ? '\n\nKnown limitation noted when planning: ' + plan.issues : '') +
  '\n\nToday: ' + new Date().toISOString().slice(0, 10) + '\n\nDATA\n' + (data || '(no data was read)');
return [{ json: { stop: false, id: q.id, started: Date.now(), request: { model: cfg.MODEL, max_tokens: cfg.ANSWER_MAX_TOKENS, system, messages: [{ role: 'user', content: user }] } } }];
