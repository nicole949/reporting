// Builds the planning request for Claude: the question, where it was asked, the dashboard's own definitions and the
// data catalogue. Stops early when the daily budget is used up or the question is empty.
const { cfg, body } = $('Config').first().json;
const ctx = $json;                                   // Plan Context row
const stop = msg => [{ json: { stop: true, response: { ok: false, step: 'plan', error: msg } } }];
const q = String(body.question || '').trim();
if (q.length < 3) return stop('Please type a question.');
if (q.length > 1500) return stop('The question is too long (max 1500 characters).');
const spent = Number(ctx.spent_today) || 0;
if (spent >= cfg.DAILY_BUDGET_EUR) return stop('The daily AI budget (' + cfg.DAILY_BUDGET_EUR + ' €) is used up. Asking works again tomorrow.');
if (!ctx.price) return stop('No price is stored for ' + cfg.MODEL + ' (table app.ai_prices).');
const c = body.context || {};
const cut = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + ' …' : s; };
const catalog = (ctx.catalog || []).map(v => v.v + ' (' + (v.n == null ? '?' : v.n) + ' rows): ' + v.cols).join('\n');
const docs = (ctx.docs || []).map(d => d.key + ' — ' + d.title).join('\n');
const pageDocs = (c.docs || []).slice(0, 60).map(d => '- ' + cut(d.m, 80) + ': ' + cut(d.calc, 600) + (d.src ? ' [source: ' + cut(d.src, 300) + ']' : '') + (d.note ? ' [note: ' + cut(d.note, 300) + ']' : '')).join('\n');
const today = new Date().toISOString().slice(0, 10);
// the catalogue part is identical for every question of the day → cached by the API (a repeat costs a tenth)
const system = `You plan how to answer a question asked inside JENTIS's internal commercial reporting dashboard (marketing, business development, sales, customer success; data from HubSpot, Instantly, LaGrowthMachine and the product database). You do not answer yet: you decide which data to read, so the cost can be shown to the user before anything else is spent.

You can ONLY read the dashboard's data API (PostgREST, read-only). Available views with row counts and columns:
${catalog}

Documentation of the data model (view doc_pages, columns doc_key, title, body_md — filter with doc_key=eq.<key>):
${docs}

Weeks start on Monday.

Return ONLY a JSON object:
{"status":"ok"|"clarify"|"cannot",
 "understood":"the question in one sentence as you will answer it (fill in period, unit, definition)",
 "clarify":"status clarify only: one short question back to the user",
 "plan":"max 2 short sentences in plain language for a non-technical reader: what you will read and how you will judge it. No API syntax, no view names.",
 "requests":[{"id":"r1","path":"<view>?select=a,b&<filters>&order=..&limit=..","why":"max 8 words","aggregate":null}],
 "answer_tokens":<expected length of the answer in tokens, 150-800>,
 "better_way":null or one sentence if there is a clearly better way to get this (e.g. a dashboard page or filter that already shows it exactly),
 "issues":null or one sentence if the data cannot fully answer the question (field missing, data not linked, period not covered)}

Rules for requests:
- PostgREST syntax only: select=col1,col2 · filters col=eq.x / neq. / gt. / gte. / lt. / lte. / in.(a,b) / ilike.*text* / is.null / not.is.null · or=(a.eq.1,b.eq.2) · order=col.desc · limit=N. Dates as YYYY-MM-DD. Write spaces in values as %20.
- Only views and columns from the list above — never invent names. Select only the columns you need.\n- No sub-queries or joins in a filter: every request stands alone. To find one company / contact, filter by its name (ilike) in a view that has the name column; if the view you need has only ids, read the id from the user's context or choose a view that has the name.
- At most ${cfg.MAX_REQUESTS} requests and ${cfg.MAX_ROWS} rows each. When rows are needed only for totals, add "aggregate"; the workflow computes it exactly before the answer step: {"group_by":["col" or "month:datecol" / "week:datecol" / "day:datecol"],"metrics":[{"op":"count|sum|avg|min|max|count_distinct","col":"x","as":"name"}],"ratios":[{"as":"rate","num":"name1","den":"name2"}],"order_by":"name","desc":true,"limit":50}.
- Prefer the views the dashboard uses for the number in question (mostly v_…): they apply the same definitions as the dashboard.
- "Why is X here / in this list": read X's rows (filter by name with ilike) from the views behind that page and the definition above.
- status "cannot" when the data cannot answer it at all (say why in "issues"); "clarify" only when the question is truly ambiguous.`;
const where = [c.page_title ? 'Page: ' + c.page_title + (c.page ? ' (' + c.page + ')' : '') : '', c.element && c.element.label ? 'Asked from: ' + c.element.label + (c.element.kind ? ' (' + c.element.kind + ')' : '') : 'Asked from: the page as a whole',
  c.period ? 'Period selected on the page: ' + c.period : '', c.filters ? 'Other filters on the page: ' + cut(JSON.stringify(c.filters), 800) : '',
  c.element && c.element.text ? 'What the user sees there:\n' + cut(c.element.text, 2500) : '',
  (c.history || []).length ? 'Earlier in this conversation:\n' + c.history.slice(-3).map(h => 'Q: ' + cut(h.q, 300) + '\nA: ' + cut(h.a, 600)).join('\n') : ''].filter(Boolean).join('\n');
const user = 'Question: ' + q + '\n\n' + where;
const dyn = "How the numbers on the page the user is looking at are defined (the dashboard's own explanations):\n" + (pageDocs || '(none sent)') + '\n\nToday is ' + today + '.';
return [{ json: { stop: false, request: { model: cfg.MODEL, max_tokens: cfg.PLAN_MAX_TOKENS,
  system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }, { type: 'text', text: dyn }], messages: [{ role: 'user', content: user }] }, q, where } }];
