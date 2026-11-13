// kpis.js — the metric engine behind the overview pages: one definition per number (where its records come from, how
// they are dated and counted, how they split into stacked series), tiles with mini charts, big chart cards and the
// side panel with the records behind a number. Used by the Commercial overview, the Marketing overview and the
// KPI targets in the to-do lists.
//   const K = R.kpis({ el, groups: [{ key, name, st, tiles: ['leads', …] }], cards: [...], extra: ['lsr', 'goals'],
//                      defaultTime: 'quarter', onReady(K), onRender(K) });
(function () {
  const R = window.R, esc = R.esc, DAY = 864e5, d10 = v => v ? String(v).slice(0, 10) : '';
  const NB = /^(full license \(new business\)|jentis light)$/i, POC = /^poc$/i, PS = /^professional service/i, REN = /^(early )?renewal$/i;
  // ---------- data sources (PostgREST) ----------
  const SRC = {
    entries: 'company_stage_entries?suppressed=eq.false&select=stage,effective_date,company_id',
    dims: 'company_dimensions?select=company_id,name',
    seqDaily: 'sequence_daily?select=date,sequence_name,sends,new_recipients',
    email: 'v_email_daily?select=date,sends',
    inst: 'instantly_daily?select=date,sent,new_leads_contacted',
    outreach: 'v_outreach_events?channel=in.(linkedin_message,connection_request,follow)&select=channel,ts,contact_name,company_name',
    resp: 'v_responded_events?select=channel,ts,contact_name,company_id,company_name,category',
    lsr: 'v_contact_responded?select=contact_id,contact_name,company_id,company_name,responded_at,source',
    calls: 'v_calls?select=ts,bucket,company_id,company_name,contact_name,owner_name,disposition_label',
    discos: 'v_discoveries?select=meeting_id,created_at,meeting_start,status,company_id,company_name,contact_name,owner_name',
    deals: 'v_deals?select=deal_id,deal_name,company_id,company_name,owner_name,partner_name,dealtype,create_date,close_date,is_closed,is_won,amount,stage_label',
    // contact form submissions (website) — view api.v_contact_forms is not built yet; until then the tile says so instead of showing 0
    forms: 'v_contact_forms?select=submitted_at,form_name,contact_id,contact_name,company_id,company_name',
    tickets: 'cs_tickets?select=ticket_id,subject,company_name,created_at,status',
    renewals: 'v_cs_renewals?select=company_name,license_end,renewal_status,mrr,stage_label,owner_name',
    goals: 'v_goals?select=*'
  };
  // which sources each metric needs
  const NEEDS = { leads: ['entries', 'dims'], st_responded: ['entries', 'dims'], st_discovery: ['entries', 'dims'], st_qualified: ['entries', 'dims'], st_opp: ['entries', 'dims'], st_customer: ['entries', 'dims'],
    emails: ['seqDaily', 'email', 'inst'], linkedin: ['outreach'], responses: ['resp'], lsr: ['lsr'], forms: ['forms'], calls: ['calls'], connected: ['calls'], booked: ['discos'], held: ['discos'],
    created: ['deals'], won: ['deals'], won_value: ['deals'], pipe: ['deals'], onb: ['deals'], renwon: ['deals'], ps: ['deals'], rendue: ['renewals'], tix: ['tickets'], tixopen: ['tickets'] };
  const COMMERCIAL = [
    { key: 'mkt', name: 'Marketing', st: 'awareness → lead → response', tiles: ['leads', 'emails', 'linkedin', 'responses', 'st_responded'] },
    { key: 'bd', name: 'Business Development', st: 'response → discovery', tiles: ['calls', 'connected', 'booked', 'held', 'st_discovery'] },
    { key: 'sales', name: 'Sales pipeline', st: 'qualified → closed won', tiles: ['st_qualified', 'st_opp', 'created', 'won', 'pipe'] },
    { key: 'cs', name: 'Customer Success', st: 'onboarding → renewal → expansion', tiles: ['st_customer', 'onb', 'rendue', 'renwon', 'ps', 'tix', 'tixopen'] }];

  // ---------- what every number is made of ----------
  // rows: the records · d: their date · n: what one record counts (default 1) · s: series for the stacked bars
  // who: the owner (KPI targets can be limited to one person) · cols: columns of the record list
  // list: 'series' = list the series instead of single records · now: snapshot tile · eur: amounts
  const link = (type, id, txt) => id ? '<a href="' + R.hs(type, id) + '" target="_blank" rel="noopener">' + esc(txt || '—') + '</a>' : esc(txt || '—');
  const C_DATE = (h, f) => [h, r => R.fmtDate(d10(f(r))), 'nw'];
  const LI = { connection_request: 'Connection request', linkedin_message: 'Message', follow: 'Follow' };
  const RT = { call: 'Connected call', email: 'Email reply', linkedin: 'LinkedIn reply' };
  const CB = { connected: 'Connected', rejected: 'Connected, rejected', no_contact: 'No contact' };
  function defs(D) {
    const L = k => D[k] || [];
    const name = {}; L('dims').forEach(c => name[c.company_id] = c.name);
    const co = (id, nm) => link('0-2', id, nm || name[id] || (id ? 'Company ' + id : '—'));
    const stage = (key, label, st) => ({ key, label, rows: L('entries').filter(e => e.stage === st), d: e => e.effective_date,
      cols: [C_DATE('Entered', e => e.effective_date), ['Company', e => co(e.company_id)]], more: ['marketing/leads/', 'Leads page'] });
    const deals = L('deals');
    const nb = deals.filter(d => NB.test(d.dealtype || '') || POC.test(d.dealtype || ''));
    const won = deals.filter(d => d.is_won && NB.test(d.dealtype || ''));
    const dealCols = f => [C_DATE(f === 'create_date' ? 'Created' : 'Closed', d => d[f]), ['Deal', d => link('0-3', d.deal_id, d.deal_name)], ['Company', d => esc(d.company_name || '—')], ['Type', d => esc(d.dealtype || '—')], ['Stage', d => esc(d.stage_label || '—')], ['Amount', d => R.eur(d.amount), 'num'], ['Owner', d => esc(d.owner_name || '—')]];
    const emailRows = (L('seqDaily').length ? L('seqDaily').map(x => ({ d: x.date, n: x.sends, s: x.sequence_name || 'Sequence without a name', rec: x.new_recipients }))
        : L('email').map(x => ({ d: x.date, n: x.sends, s: 'HubSpot sequences', rec: null })))
      .concat(L('inst').map(x => ({ d: x.date, n: x.sent, s: 'Instantly (all campaigns)', rec: x.new_leads_contacted })));
    const callCols = [C_DATE('Date', c => c.ts), ['Outcome', c => esc(c.disposition_label || CB[c.bucket] || '—')], ['Contact', c => esc(c.contact_name || '—')], ['Company', c => esc(c.company_name || '—')], ['Owner', c => esc(c.owner_name || '—')]];
    const discoCols = [C_DATE('Booked', x => x.created_at), C_DATE('Meeting', x => x.meeting_start), ['Company', x => esc(x.company_name || '—')], ['Contact', x => esc(x.contact_name || '—')], ['Status', x => esc(x.status || '—')], ['Owner', x => esc(x.owner_name || '—')]];
    const openTix = L('tickets').filter(t => !/closed|done|resolved|geschlossen/i.test(t.status || ''));
    const tixCols = [C_DATE('Created', t => t.created_at), ['Ticket', t => link('0-5', t.ticket_id, t.subject)], ['Company', t => esc(t.company_name || '—')], ['Status', t => esc(t.status || '—')]];
    const who = x => x.owner_name || 'Unassigned';
    return [
      stage('leads', 'New leads', 'lead'),
      { key: 'emails', label: 'Outreach emails sent', rows: emailRows, d: x => x.d, n: x => x.n, s: x => x.s, list: 'series', unit: 'emails',
        seriesCols: [['Sequence', 'Emails sent', 'New recipients'], rows => rows.some(x => x.rec != null) ? rows.reduce((a, x) => a + (Number(x.rec) || 0), 0) : null], more: ['email-outreach/', 'Email outreach page'] },
      { key: 'linkedin', label: 'LinkedIn actions', rows: L('outreach'), d: x => x.ts, s: x => LI[x.channel] || x.channel, order: Object.values(LI),
        cols: [C_DATE('Date', x => x.ts), ['Action', x => esc(LI[x.channel] || x.channel)], ['Contact', x => esc(x.contact_name || '—')], ['Company', x => esc(x.company_name || '—')]] },
      { key: 'responses', label: 'Responses', rows: L('resp'), d: x => x.ts, s: x => RT[x.channel] || x.channel, order: Object.values(RT),
        cols: [C_DATE('Date', x => x.ts), ['Response', x => esc(RT[x.channel] || x.channel)], ['Contact', x => esc(x.contact_name || '—')], ['Company', x => co(x.company_id, x.company_name)]], more: ['marketing/responses/', 'Responses page'] },
      { key: 'lsr', label: 'Contacts → lead status Responded', rows: L('lsr'), d: x => x.responded_at,
        cols: [C_DATE('Responded', x => x.responded_at), ['Contact', x => link('0-1', x.contact_id, x.contact_name || 'Contact ' + x.contact_id)], ['Company', x => co(x.company_id, x.company_name)], ['Source', x => esc(String(x.source || '—').replace(/^history:/, ''))]], more: ['marketing/responses/', 'Responses page'] },
      { key: 'forms', label: 'Contact form submissions', soon: true, rows: L('forms'), d: x => x.submitted_at, s: x => x.form_name || 'Contact form',
        cols: [C_DATE('Submitted', x => x.submitted_at), ['Form', x => esc(x.form_name || '—')], ['Contact', x => link('0-1', x.contact_id, x.contact_name || (x.contact_id ? 'Contact ' + x.contact_id : '—'))], ['Company', x => co(x.company_id, x.company_name)]] },
      stage('st_responded', 'Engaged → Responded (stage)', 'responded'),
      { key: 'calls', label: 'Calls', rows: L('calls'), d: c => c.ts, s: c => CB[c.bucket] || 'Other', order: Object.values(CB), who, cols: callCols, more: ['bd/calls/', 'Calls page'] },
      { key: 'connected', label: 'Connected calls', rows: L('calls').filter(c => c.bucket === 'connected' || c.bucket === 'rejected'), d: c => c.ts, s: c => CB[c.bucket], order: Object.values(CB), who, cols: callCols, more: ['bd/calls/', 'Calls page'] },
      { key: 'booked', label: 'Discoveries booked', rows: L('discos').filter(x => x.status !== 'canceled'), d: x => x.created_at || x.meeting_start, who, cols: discoCols, more: ['bd/discoveries/', 'Discoveries page'] },
      { key: 'held', label: 'Discoveries held', rows: L('discos').filter(x => x.status === 'completed'), d: x => x.meeting_start, who, cols: discoCols, more: ['bd/discoveries/', 'Discoveries page'] },
      stage('st_discovery', 'Entered Discovery (stage)', 'discovery'),
      stage('st_qualified', 'Qualified accounts', 'qualified'), stage('st_opp', 'Opportunities', 'opportunity'),
      { key: 'created', label: 'Deals created (NB + POC)', rows: nb, d: x => x.create_date, s: x => x.dealtype, who, cols: dealCols('create_date'), more: ['sales/deals/', 'Deals page'] },
      { key: 'won', label: 'Won new business', rows: won, d: x => x.close_date, amount: x => x.amount, who, cols: dealCols('close_date'), more: ['sales/deals/', 'Deals page'] },
      { key: 'pipe', label: 'Open NB pipeline · now', now: true, eur: true, rows: nb.filter(x => !x.is_closed).sort((a, b) => (b.amount || 0) - (a.amount || 0)), n: x => Number(x.amount) || 0, cols: dealCols('create_date'), more: ['sales/deals/', 'Deals page'] },
      { key: 'won_value', label: 'Won new business (€)', eur: true, rows: won, d: x => x.close_date, n: x => Number(x.amount) || 0, who, cols: dealCols('close_date'), more: ['sales/deals/', 'Deals page'] },
      stage('st_customer', 'Customers signed', 'customer'),
      { key: 'onb', label: 'In onboarding · now', now: true, rowsFor: r => { const from = new Date(Date.parse(r.to) - 90 * DAY).toISOString().slice(0, 10); return won.filter(x => x.close_date >= from && x.close_date < r.to); }, sub: 'signed in the 90 days before period end', cols: dealCols('close_date') },
      { key: 'rendue', label: 'Renewals due', rows: L('renewals'), d: x => x.license_end, who, cols: [C_DATE('Licence end', x => x.license_end), ['Company', x => esc(x.company_name || '—')], ['MRR', x => R.eur(x.mrr), 'num'], ['Status', x => esc(String(x.renewal_status || '—').replace(/_/g, ' '))], ['Stage', x => esc(x.stage_label || '—')], ['Owner', x => esc(x.owner_name || '—')]], more: ['cs/renewals/', 'Renewals page'] },
      { key: 'renwon', label: 'Renewals won', rows: deals.filter(x => x.is_won && REN.test(x.dealtype || '')), d: x => x.close_date, who, cols: dealCols('close_date'), more: ['cs/renewals/', 'Renewals page'] },
      { key: 'ps', label: 'Professional services sold', rows: deals.filter(x => x.is_won && PS.test(x.dealtype || '')), d: x => x.close_date, amount: x => x.amount, who, cols: dealCols('close_date') },
      { key: 'tix', label: 'Tickets opened', rows: L('tickets'), d: x => x.created_at, cols: tixCols, more: ['cs/tickets/', 'Tickets page'] },
      { key: 'tixopen', label: 'Open tickets · now', now: true, rows: openTix.sort((a, b) => (b.created_at || '') < (a.created_at || '') ? -1 : 1), cols: tixCols, more: ['cs/tickets/', 'Tickets page'] }
    ];
  }

R.kpis = function (OPTS) {
  const K = { NB, POC, link };
  const EL = typeof OPTS.el === 'string' ? document.getElementById(OPTS.el) : OPTS.el;
  const GROUPS = OPTS.groups || [];
  let D = null, ALL = {}, F = null;
  const CARDS = [];
// ---------- chart window → buckets ----------
// The tile number is always the selected period. The bars can reach further back ("Charts go back"): they end where the
// period ends and start at least that far before; bars that lie before the period are drawn pale.
const iso = t => new Date(t).toISOString().slice(0, 10), TODAY = () => Date.parse(iso(Date.now()));
function win(r) {
  const end = Math.min(Date.parse(r.to), TODAY() + DAY), look = F.look || '13w';
  const from = look === 'period' ? Date.parse(r.from) : Math.min(Date.parse(r.from), end - parseInt(look, 10) * 7 * DAY);
  return { from, end, pFrom: Date.parse(r.from) };
}
function freqOf(r) {
  if (F.freq && F.freq !== 'auto') return F.freq;
  const w = win(r), days = (w.end - w.from) / DAY;
  return days <= 21 ? 'day' : days <= 200 ? 'week' : 'month';
}
const FREQ = { day: 'daily', week: 'weekly', month: 'monthly' }, UNIT = { day: 'day', week: 'week', month: 'month' };
const isoWeek = t => { const d = new Date(t); d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7)); const y = Date.UTC(d.getUTCFullYear(), 0, 4); return 1 + Math.round(((d - y) / DAY - 3 + ((new Date(y).getUTCDay() + 6) % 7)) / 7); };
const dm = t => iso(t).slice(8, 10) + '.' + iso(t).slice(5, 7) + '.';
function buckets(r) {
  const f = freqOf(r), w = win(r), out = [];
  const next = a => { const x = new Date(a); return f === 'day' ? a + DAY : f === 'week' ? a + (7 - ((x.getUTCDay() + 6) % 7)) * DAY : Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 1); };
  let a = w.from;                                   // start on a full week / month so the first bar is not a stub
  if (a < w.pFrom) { const x = new Date(a); a = f === 'week' ? a - ((x.getUTCDay() + 6) % 7) * DAY : f === 'month' ? Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), 1) : a; }
  while (a < w.end && out.length < 800) {
    let b = Math.min(next(a), w.end); if (a < w.pFrom && b > w.pFrom) b = w.pFrom;   // the period always starts on a bar edge → pale + solid bars never mix
    const x = new Date(a), span = dm(a) + (b - a > DAY ? ' – ' + dm(b - DAY) : '');
    out.push({ from: iso(a), to: iso(b), inp: a >= w.pFrom,
      label: f === 'day' ? dm(a).slice(0, 5) : f === 'week' ? 'W' + isoWeek(a) : x.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }) + (x.getUTCMonth() === 0 ? ' ' + String(x.getUTCFullYear()).slice(2) : ''),
      title: f === 'day' ? R.fmtDate(iso(a)) : f === 'week' ? 'Week ' + isoWeek(a) + ' (' + span + ')' : x.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) + (b - a < 27 * DAY ? ' (' + span + ')' : '') });
    a = b;
  }
  return out;
}
// ---------- numbers ----------
const valOf = (m, x) => m.n ? Number(m.n(x)) || 0 : 1;
const between = (m, from, to) => m.rows.filter(x => { const d = m.d(x); if (!d) return false; const k = String(d).slice(0, 10); return k >= from && k < to; });
const inR = (m, rg) => between(m, rg.from, rg.to);
const total = (m, rows) => rows.reduce((a, x) => a + valOf(m, x), 0);
function seriesOf(m, rows) {                      // [{name, total, ci}] — fixed order when given, else biggest first; at most 6 + Other
  if (!m.s) return [{ name: m.label, total: total(m, rows), ci: 0 }];
  const t = {}; rows.forEach(x => { const k = m.s(x) || '—'; t[k] = (t[k] || 0) + valOf(m, x); });
  let names = Object.keys(t).sort((a, b) => t[b] - t[a]);
  if (m.order) names = m.order.filter(n => t[n]).concat(names.filter(n => !m.order.includes(n)));
  const top = names.slice(0, names.length > 7 ? 6 : 7), rest = names.slice(top.length);
  const out = top.map((n, i) => ({ name: n, total: t[n], ci: m.order && m.order.includes(n) ? m.order.indexOf(n) : i }));   // fixed series keep their colour
  if (rest.length) out.push({ name: 'Other (' + rest.length + ')', total: rest.reduce((a, n) => a + t[n], 0), other: rest, ci: 6 });
  return out;
}
function matrix(m, rows, bk, ser) {                // value per bucket and series
  const idx = {}; ser.forEach((s, i) => { idx[s.name] = i; (s.other || []).forEach(n => idx[n] = i); });
  const grid = bk.map(() => ser.map(() => 0));
  rows.forEach(x => { const d = String(m.d(x)).slice(0, 10); const b = bk.findIndex(k => d >= k.from && d < k.to); if (b < 0) return; grid[b][m.s ? idx[m.s(x) || '—'] : 0] += valOf(m, x); });
  return grid;
}
const fmt = (m, v) => m.eur ? R.eur(v) : R.num(v);
const short = (m, v) => (m.eur ? '€' : '') + (v >= 10000 ? Math.round(v / 1000) + 'k' : v >= 1000 ? (v / 1000).toFixed(1).replace('.0', '') + 'k' : R.num(v));
// stacked bars drawn at the pixel width they are shown at; numbers above, week / month / day below
function bars(m, bk, ser, grid, W, H, opts) {
  opts = opts || {};
  const fs = opts.big ? 10 : 9, top = fs + 4, bot = fs + 6, h = H - top - bot, sums = grid.map(g => g.reduce((a, b) => a + b, 0)), max = Math.max(1, ...sums);
  const n = Math.max(1, bk.length), step = W / n, bw = Math.max(1, Math.min(step * .78, opts.big ? 46 : 26));
  const cw = fs * .58, last = n - 1;
  const every = need => Math.max(1, Math.ceil(need / step));                       // show every k-th label, counted back from the newest bar
  const kv = every(Math.max(...sums.map(v => short(m, v).length)) * cw + 5), kx = every(Math.max(...bk.map(b => b.label.length)) * cw + 6);
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(m.label) + ' over time">';
  s += '<line class="ax" x1="0" x2="' + W + '" y1="' + (top + h + .5) + '" y2="' + (top + h + .5) + '"/>';
  bk.forEach((b, i) => {
    const sum = sums[i], cx = i * step + step / 2, x = cx - bw / 2; let y = top + h;
    const tip = b.title + ': ' + fmt(m, sum) + (ser.length > 1 && sum ? '\n' + ser.map((q, k) => grid[i][k] ? q.name + ': ' + fmt(m, grid[i][k]) : '').filter(Boolean).join('\n') : '') + (b.inp ? '' : '\n(before the selected period)');
    s += '<g class="bk' + (b.inp ? '' : ' pre') + (opts.sel === i ? ' sel' : '') + '" data-b="' + i + '"><title>' + esc(tip) + '</title><rect class="hit" x="' + (i * step).toFixed(1) + '" y="0" width="' + step.toFixed(1) + '" height="' + H + '"/>';
    grid[i].forEach((v, k) => { if (!v) return; const bh = Math.max(1, h * v / max); y -= bh; s += '<rect class="c' + ser[k].ci + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '"/>'; });
    const anchor = cx < 12 ? 'start' : cx > W - 12 ? 'end' : 'middle', tx = anchor === 'start' ? 0 : anchor === 'end' ? W : cx;
    if (sum && (last - i) % kv === 0) s += '<text class="val" x="' + tx.toFixed(1) + '" y="' + (y - 3).toFixed(1) + '" text-anchor="' + anchor + '" font-size="' + fs + '">' + short(m, sum) + '</text>';
    if ((last - i) % kx === 0) s += '<text class="xl" x="' + tx.toFixed(1) + '" y="' + (H - 3) + '" text-anchor="' + anchor + '" font-size="' + fs + '">' + esc(b.label) + '</text>';
    s += '</g>';
  });
  return s + '</svg>';
}
const cut = (t, n) => t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
// ---------- tiles ----------
function prep(m, r, p) {                         // the numbers of one metric for the selected period and the chart window
  if (m.now) { const rows = m.rowsFor ? m.rowsFor(r) : m.rows; m._rows = rows; m._c = null; m._cur = m.n ? total(m, rows) : rows.length; return; }
  const rows = inR(m, r), prev = inR(m, p); m._rows = rows; m._prev = prev; m._cur = total(m, rows); m._was = total(m, prev);
  const wrows = BK.length ? between(m, BK[0].from, BK[BK.length - 1].to) : [], ser = seriesOf(m, wrows);
  m._c = { wrows, ser, grid: matrix(m, wrows, BK, ser) };
}
const pending = m => m.soon && (NEEDS[m.key] || []).some(s => (K.failed || []).includes(s));   // only for sources that are not built yet
function tileHtml(m, r, p) {
  if (pending(m)) return '<div class="tile soft pend" data-m="' + m.key + '"><div class="k">' + esc(m.label) + '</div><div class="v">—</div><div class="s">not connected yet · the data source for this number is still being built</div></div>';
  prep(m, r, p);
  let val, sub, spark = '';
  if (m.now) { val = fmt(m, m._cur); sub = m.sub || 'as of today'; }
  else {
    val = fmt(m, m._cur) + ' ' + R.delta(m._cur, m._was);
    sub = m.amount ? R.eur(m._rows.reduce((a, x) => a + (Number(m.amount(x)) || 0), 0)) + ' · before ' + R.eur(m._prev.reduce((a, x) => a + (Number(m.amount(x)) || 0), 0)) : 'before: ' + fmt(m, m._was);
    const ser = m._c.ser, shown = ser.slice(0, 3), more = ser.length - shown.length;
    spark = '<div class="spark" data-m="' + m.key + '"></div>' + (ser.length > 1 ? '<div class="sleg">' + shown.map(q => '<span title="' + esc(q.name) + '"><i class="c' + q.ci + '"></i>' + esc(cut(q.name, 18)) + '</span>').join('') + (more > 0 ? '<span class="more" title="' + esc(ser.slice(3).map(q => q.name).join('\n')) + '">+' + more + '</span>' : '') + '</div>' : '');
  }
  return '<div class="tile clk' + (m.now ? ' soft' : '') + '" data-m="' + m.key + '" tabindex="0" role="button" title="Click to see the records behind this number"><div class="k">' + esc(m.label) + '</div><div class="v">' + val + '</div><div class="s">' + sub + '</div>' + spark + '</div>';
}
let BK = [];
function drawSparks() {                             // drawn after layout: the bars need the tile's real width
  (EL ? [...EL.querySelectorAll('.spark')] : []).forEach(el => { const m = metric(el.dataset.m); if (!m || !m._c) return; const W = Math.max(80, Math.floor(el.clientWidth)); el.innerHTML = bars(m, BK, m._c.ser, m._c.grid, W, 66); });
}
function render() {
  if (!D) return;
  const r = F.range, p = R.prevRange(r); BK = buckets(r);
  const back = BK.length && !BK[0].inp ? ' · bars from ' + R.fmtDate(BK[0].from) : '';
  K.head = esc(r.label) + ' · ' + FREQ[freqOf(r)] + back;
  if (EL) EL.innerHTML = GROUPS.map(g => '<section class="kgroup ' + g.key + '"><div class="gh"><h2>' + esc(g.name) + '</h2>' + (g.st ? '<span class="st">' + esc(g.st) + '</span>' : '') + '<span class="st" style="margin-left:auto">' + K.head + '</span></div><div class="tiles">' + g.tiles.map(k => ALL[k]).filter(Boolean).map(m => tileHtml(m, r, p)).join('') + '</div></section>').join('');
  CARDS.forEach(c => { const m = ALL[c.key]; if (m) prep(m, r, p); });
  drawSparks(); drawCards();
  (OPTS.onRender || (() => {}))(K);
  if (drillKey) drill(drillKey, true);
}
let rsT; window.addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(() => { if (D) { drawSparks(); drawCards(); if (drillKey) drill(drillKey, true); } }, 150); });
// ---------- the records behind a tile ----------
function listHtml(m, rows) {
  let h = '';
  const moreLink = m.more ? ' · <a href="' + R.C.SITE_BASE.replace(/\/?$/, '/') + m.more[0] + '">Open the ' + m.more[1] + ' →</a>' : '';
  if (m.list === 'series') {
    const t = {}; rows.forEach(x => { const k = m.s(x) || '—'; (t[k] = t[k] || []).push(x); });
    const list = Object.entries(t).map(([k, a]) => [k, total(m, a), m.seriesCols[1](a)]).sort((a, b) => b[1] - a[1]);
    h += '<div class="dcount">' + R.num(list.length) + ' sequences / campaigns · ' + R.num(list.reduce((a, x) => a + x[1], 0)) + ' ' + (m.unit || '') + moreLink + '</div>';
    h += '<table><thead><tr><th>' + m.seriesCols[0][0] + '</th><th class="num">' + m.seriesCols[0][1] + '</th><th class="num">' + m.seriesCols[0][2] + '</th></tr></thead><tbody>' +
      list.map(x => '<tr><td>' + esc(x[0]) + '</td><td class="num">' + R.num(x[1]) + '</td><td class="num">' + R.num(x[2]) + '</td></tr>').join('') + '</tbody></table>';
  } else {
    if (m.d) rows.sort((a, b) => String(m.d(b) || '') < String(m.d(a) || '') ? -1 : 1);
    const CAP = 300, shown = rows.slice(0, CAP);
    h += '<div class="dcount">' + R.num(rows.length) + ' record' + (rows.length === 1 ? '' : 's') + (rows.length > CAP ? ' · the latest ' + CAP + ' are listed' : '') + moreLink + '</div>';
    h += rows.length ? '<table><thead><tr>' + m.cols.map(c => '<th class="' + (c[2] || '') + '">' + c[0] + '</th>').join('') + '</tr></thead><tbody>' +
      shown.map(x => '<tr>' + m.cols.map(c => '<td class="' + (c[2] || '') + '">' + c[1](x) + '</td>').join('') + '</tr>').join('') + '</tbody></table>' : '<div class="state">Nothing in this period.</div>';
  }
  return h;
}
let drillKey = null, drillSel = null;
const metric = k => ALL[k];
function drill(key, keep) {
  const m = metric(key); if (!m) return;
  if (!keep) drillSel = null;
  drillKey = key;
  const r = F.range, bk = m.now ? [] : BK, el = document.getElementById('drill');
  if (drillSel != null && drillSel >= bk.length) drillSel = null;
  let rows = (m._rows || []).slice();
  let h = '<div class="dh"><div><h3>' + esc(m.label) + '</h3><div class="small muted">' + (m.now ? 'as of today' : esc(r.label) + ' · ' + fmt(m, total(m, rows)) + ' · bars ' + FREQ[freqOf(r)]) + '</div></div><button class="x" type="button" aria-label="Close" onclick="K.close()">✕</button></div>';
  if (!m.now && m._c) {
    const ser = m._c.ser, W = Math.max(320, Math.min(780, (el.clientWidth || 640) - 44));
    h += '<div class="dchart">' + bars(m, bk, ser, m._c.grid, W, 200, { big: true, sel: drillSel }) + '</div>';
    if (ser.length > 1) {                             // legend with the totals of the selected period
      const pt = {}; rows.forEach(x => { const k = m.s(x) || '—'; pt[k] = (pt[k] || 0) + valOf(m, x); });
      const tot = q => (pt[q.name] || 0) + (q.other || []).reduce((a, n) => a + (pt[n] || 0), 0);
      h += '<div class="dleg">' + ser.map(q => '<span><i class="c' + q.ci + '"></i>' + esc(q.name) + ' <b>' + fmt(m, tot(q)) + '</b></span>').join('') + '</div>';
    }
    if (drillSel != null) { const b = bk[drillSel]; rows = between(m, b.from, b.to);
      h += '<div class="dsel">Showing <b>' + esc(b.title) + '</b> only' + (b.inp ? '' : ' (before the selected period)') + ' · <a href="#" onclick="K.unselect();return false">back to ' + esc(r.label) + '</a></div>'; }
    else h += '<div class="dsel muted">Pale bars lie before the selected period. Click a bar to see only that ' + UNIT[freqOf(r)] + '.</div>';
  }
  h += listHtml(m, rows);
  el.innerHTML = h; el.classList.add('open'); document.getElementById('drill-bg').classList.add('open');
  if (!keep) el.scrollTop = 0;
  el.querySelectorAll('.dchart .bk').forEach(g => g.onclick = () => { const i = +g.dataset.b; drillSel = drillSel === i ? null : i; drill(drillKey, true); });
}
  // ---------- big chart cards (a metric as a full-width chart, bars clickable) ----------
  function drawCards() {
    if (!D) return;
    CARDS.forEach(c => {
      const m = ALL[c.key], box = c.el.querySelector('.cc-chart'); if (!m || !m._c || !box) return;
      c.el.querySelector('.cc-v').innerHTML = fmt(m, m._cur) + ' <span class="muted">in ' + esc(F.range.label) + '</span> ' + R.delta(m._cur, m._was);
      const W = Math.max(240, Math.floor(box.clientWidth));
      box.innerHTML = bars(m, BK, m._c.ser, m._c.grid, W, c.h || 210, { big: true });
      const ser = m._c.ser, pt = {}; m._rows.forEach(x => { const k = m.s ? m.s(x) || '—' : m.label; pt[k] = (pt[k] || 0) + valOf(m, x); });
      const tot = q => (pt[q.name] || 0) + (q.other || []).reduce((a, n) => a + (pt[n] || 0), 0);
      c.el.querySelector('.cc-leg').innerHTML = ser.length > 1 ? ser.map(q => '<span><i class="c' + q.ci + '"></i>' + esc(q.name) + ' <b>' + fmt(m, tot(q)) + '</b></span>').join('') : '';
      box.querySelectorAll('.bk').forEach(g => g.onclick = () => { drillSel = +g.dataset.b; drill(c.key, true); });
    });
  }
  K.card = function (el, key, opts) {
    opts = opts || {}; el = typeof el === 'string' ? document.getElementById(el) : el; if (!el) return;
    const m = ALL[key] || {};
    el.classList.add('ccard');
    el.innerHTML = '<div class="cch"><div><h2 data-help="' + esc(opts.title || m.label || key) + '">' + esc(opts.title || m.label || key) + (opts.sub ? ' <span>· ' + esc(opts.sub) + '</span>' : '') + '</h2><div class="cc-v"></div></div>' +
      '<div class="cc-links">' + (opts.links || []).map(l => '<a href="' + R.C.SITE_BASE.replace(/\/?$/, '/') + l[0] + '">' + esc(l[1]) + ' →</a>').join('') + '<button type="button" class="tool" title="The records behind the number">Records</button></div></div>' +
      '<div class="cc-chart"></div><div class="cc-leg"></div>';
    el.querySelector('.cc-links .tool').onclick = () => drill(key);
    CARDS.push({ el, key, h: opts.height });
    if (D) { const m2 = ALL[key]; if (m2) prep(m2, F.range, R.prevRange(F.range)); drawCards(); }
  };

  // ---------- side panel ----------
  function closeDrill() { drillKey = null; document.getElementById('drill').classList.remove('open'); document.getElementById('drill-bg').classList.remove('open'); }
  if (!document.getElementById('drill')) document.body.insertAdjacentHTML('beforeend', '<div id="drill-bg"></div><aside id="drill" aria-label="Records behind the number"></aside>');
  document.getElementById('drill-bg').onclick = closeDrill;
  K.close = closeDrill;
  K.unselect = () => { drillSel = null; drill(drillKey, true); };
  K.panel = function (html) {                          // any other content in the same panel (e.g. a goal's companies)
    drillKey = null; const el = document.getElementById('drill');
    el.innerHTML = '<div class="dh"><div></div><button class="x" type="button" aria-label="Close" onclick="K.close()">✕</button></div>' + html;
    el.classList.add('open'); document.getElementById('drill-bg').classList.add('open'); el.scrollTop = 0;
  };
  K.drill = drill;
  K.list = function (key, rows, title, sub) {
    const m = ALL[key]; if (!m) return;
    K.panel('<h3 class="ph">' + esc(title || m.label) + '</h3>' + (sub ? '<div class="small muted">' + sub + '</div>' : '') + listHtml(m, rows.slice()));
  };
  if (EL) {
    EL.addEventListener('click', e => { if (e.target.closest('.q, .ai, a')) return; const t = e.target.closest('.tile.clk'); if (t) drill(t.dataset.m); });
    EL.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('clk')) { e.preventDefault(); drill(e.target.dataset.m); } });
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrill(); });

  // ---------- numbers for other parts of a page (KPI targets) ----------
  // value of a metric between two dates, optionally only one owner's records and / or one series
  K.value = function (key, from, to, f) {
    const m = ALL[key]; if (!m || m.now) return null; f = f || {};
    return between(m, from, to).filter(x => (!f.owner || !m.who || m.who(x) === f.owner) && (!f.series || !m.s || m.s(x) === f.series)).reduce((a, x) => a + valOf(m, x), 0);
  };
  K.records = function (key, from, to, f) {
    const m = ALL[key]; if (!m || m.now) return []; f = f || {};
    return between(m, from, to).filter(x => (!f.owner || !m.who || m.who(x) === f.owner) && (!f.series || !m.s || m.s(x) === f.series));
  };
  K.targetable = () => Object.values(ALL).filter(m => !m.now && !pending(m) && (NEEDS[m.key] || []).every(s => D && D[s] !== undefined) && m.key !== 'onb');
  K.owners = key => { const m = ALL[key]; return m && m.who ? [...new Set(m.rows.map(m.who))].filter(Boolean).sort() : []; };
  K.series = key => { const m = ALL[key]; return m && m.order ? m.order.slice() : []; };
  K.metric = metric; K.fmt = fmt; K.show = (key, rows, title) => { const m = ALL[key]; if (!m) return; const keep = m._rows; m._rows = rows; drill(key); m._rows = keep; };
  K.render = render;

  // ---------- filters + data ----------
  F = K.F = R.filters({ defaultTime: OPTS.defaultTime || 'quarter', onChange: render, controls: [
    { key: 'look', label: 'Charts go back', value: '13w', options: [['period', 'Selected period only'], ['4w', '4 weeks'], ['8w', '8 weeks'], ['13w', '13 weeks'], ['26w', '6 months'], ['52w', '12 months'], ['104w', '24 months']] },
    { key: 'freq', label: 'Frequency', value: 'auto', options: [['auto', 'Auto'], ['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']] }].concat(OPTS.controls || []) });
  const want = new Set(OPTS.extra || []);
  GROUPS.forEach(g => g.tiles.forEach(k => (NEEDS[k] || []).forEach(s => want.add(s))));
  (OPTS.metrics || []).forEach(k => (NEEDS[k] || []).forEach(s => want.add(s)));
  (OPTS.cards || []).forEach(k => (NEEDS[k] || []).forEach(s => want.add(s)));
  K.ready = (async () => {
    const keys = [...want], got = await Promise.all(keys.map(k => R.fetchAll(SRC[k]).catch(e => { console.warn(k, e); return null; })));
    D = K.D = {}; keys.forEach((k, i) => D[k] = got[i] || []);
    K.failed = keys.filter((k, i) => got[i] === null);
    defs(D).forEach(m => ALL[m.key] = m);
    if (OPTS.onReady) OPTS.onReady(K);
    render();
    return K;
  })();
  window.K = K;
  return K;
};
R.kpis.COMMERCIAL = COMMERCIAL;
})();
