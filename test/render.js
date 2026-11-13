// Renders every page of site/ in a headless browser against local data fixtures and reports JS errors,
// labels without a "?" explanation and (optionally) screenshots.
//   node test/render.js [--shots DIR] [--only /path/] [--fixtures DIR]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const ROOT = path.join(__dirname, '..', 'site'), FX = arg('--fixtures') || '/home/claude/fixtures', SHOTS = arg('--shots'), ONLY = arg('--only');
const PAGES = ['/', '/me/', '/funnel/', '/changes/', '/marketing/', '/marketing/leads/', '/email-outreach/', '/email-outreach/subjects/', '/marketing/responses/',
  '/bd/', '/bd/calls/', '/bd/discoveries/', '/bd/journeys/', '/bd/celebrations/', '/sales/', '/sales/deals/', '/sales/quote-checker/', '/sales/celebrations/',
  '/cs/', '/cs/customers/', '/cs/renewals/', '/cs/tickets/', '/cs/professional-services/', '/cs/celebrations/'];
const cache = {};
const load = v => { if (!(v in cache)) { const f = path.join(FX, v + '.json'); cache[v] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; } return cache[v]; };
const cmp = (a, b) => (a == null ? (b == null ? 0 : 1) : b == null ? -1 : typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b)));
function query(view, params) {           // a small part of PostgREST: eq/neq/gt/gte/lt/lte/in/is/not.is, order, limit
  let rows = load(view); if (!rows) return null;
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    const m = /^(not\.)?(eq|neq|gt|gte|lt|lte|in|is|like|ilike)\.(.*)$/.exec(v); if (!m) continue;
    const neg = !!m[1], op = m[2], val = m[3];
    const test = r => { const x = r[k]; switch (op) {
      case 'eq': return String(x) === val; case 'neq': return String(x) !== val;
      case 'gt': return x != null && String(x) > val; case 'gte': return x != null && String(x) >= val;
      case 'lt': return x != null && String(x) < val; case 'lte': return x != null && String(x) <= val;
      case 'in': return val.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, '')).includes(String(x));
      case 'is': return val === 'null' ? x == null : String(x) === val;
      default: return true; } };
    rows = rows.filter(r => neg ? !test(r) : test(r));
  }
  const order = params.get('order');
  if (order) { const keys = order.split(',').map(o => o.split('.')); rows = [...rows].sort((a, b) => { for (const [c, dir] of keys) { const d = cmp(a[c], b[c]); if (d) return dir === 'desc' ? -d : d; } return 0; }); }
  const lim = params.get('limit'); if (lim) rows = rows.slice(0, Number(lim));
  return rows;
}
const SF = [], TD = [], ASK = [];   // TD: shared to-dos (emulates api.todos + rpc/todo_op)   // shared saved filters (emulates api.saved_filters + rpc/filter_op)
const wire = (page, errs, missing404) => page.route('**/*', async route => {
      const u = new URL(route.request().url());
      if (u.hostname === 'local.test') {
        let pth = u.pathname.replace(/^\/v2-staging/, ''); if (pth.endsWith('/')) pth += 'index.html';
        if (pth === '/assets/changelog.json') return route.fulfill({ contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, '..', 'docs', 'changelog.json'), 'utf8') });
        const f = path.join(ROOT, pth); if (!fs.existsSync(f)) { errs.push('404 ' + pth); return route.fulfill({ status: 404, body: '' }); }
        const ct = pth.endsWith('.js') ? 'application/javascript' : pth.endsWith('.css') ? 'text/css' : pth.endsWith('.png') ? 'image/png' : 'text/html';
        return route.fulfill({ contentType: ct, body: pth.endsWith('.png') ? fs.readFileSync(f) : fs.readFileSync(f, 'utf8').replace(/__BUILD__/g, 'test').replace(/__ENV__/g, 'staging') });
      }
      if (u.hostname === 'n8n.rec.jentis.com') {
        if (u.pathname === '/rpc/filter_op') {
          if (route.request().method() !== 'POST' || (route.request().headers()['content-type'] || '').indexOf('text/plain') !== 0) { errs.push('filter_op: not a simple POST'); return route.fulfill({ status: 400, body: '{}' }); }
          const j = JSON.parse(route.request().postData());
          if (j.op === 'save') { const k = SF.findIndex(x => x.page === j.page && x.name.toLowerCase() === j.name.toLowerCase()); const row = { id: k >= 0 ? SF[k].id : SF.length + 1, page: j.page, name: j.name, state: j.state, created_by: j.by }; if (k >= 0) SF[k] = row; else SF.push(row); return route.fulfill({ contentType: 'application/json', body: JSON.stringify(row) }); }
          const k = SF.findIndex(x => x.id === j.id); if (k >= 0) SF.splice(k, 1); return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ deleted: k >= 0 }) });
        }
        if (u.pathname === '/rpc/todo_op') {
          if (route.request().method() !== 'POST' || (route.request().headers()['content-type'] || '').indexOf('text/plain') !== 0) { errs.push('todo_op: not a simple POST'); return route.fulfill({ status: 400, body: '{}' }); }
          const j = JSON.parse(route.request().postData()), now = new Date().toISOString();
          if (j.kpi && !(j.kpi.target > 0)) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'KPI target: enter a number above 0' }) });
          let row;
          if (j.op === 'add') { row = { id: TD.length + 1, scope: j.scope, title: j.title, assignee: j.assignee || null, due: j.due || null, kpi: j.kpi || null, done: false, done_at: null, done_by: null, sort: TD.length + 1, created_by: j.by, created_at: now }; TD.push(row); }
          else { const k = TD.findIndex(x => x.id === j.id); if (j.op === 'delete') { TD.splice(k, 1); return route.fulfill({ contentType: 'application/json', body: '{"deleted":true}' }); }
            row = TD[k]; if (j.op === 'done') Object.assign(row, { done: j.done, done_at: j.done ? now : null, done_by: j.done ? j.by : null }); else ['title', 'assignee', 'due', 'kpi', 'sort'].forEach(f => { if (f in j) row[f] = j[f] === '' ? null : j[f]; }); }
          return route.fulfill({ contentType: 'application/json', body: JSON.stringify(row) });
        }
        if (u.pathname === '/todos') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(TD.filter(x => 'eq.' + x.scope === u.searchParams.get('scope')).sort((a, b) => (a.done - b.done) || (a.sort - b.sort))) });
        if (u.pathname === '/saved_filters') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(SF.filter(x => 'eq.' + x.page === u.searchParams.get('page'))) });
        const view = u.pathname.slice(1); const rows = query(view, u.searchParams);
        if (!rows) { missing404.add(view); return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: '42P01', message: 'relation "api.' + view + '" does not exist' }) }); }
        const range = (route.request().headers()['range'] || '0-999').split('-').map(Number);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows.slice(range[0], range[1] + 1)) });
      }
      if (u.hostname === 'jentis.app.n8n.cloud' && u.pathname === '/webhook/reporting-ask') {
        const j = JSON.parse(route.request().postData() || '{}'); ASK.push(j);
        if (j.step === 'plan') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, step: 'plan', status: 'ok', id: '3a1f81dc-d40e-4310-9759-3c5342ae1bc2', understood: 'Which calls connected in Q4 2026', plan: 'I will read the calls of Q4 and count the connected ones per owner.', reads: [{ what: 'Calls in Q4 2026', rows: 618 }], issues: 'Calls without an owner are counted as Unassigned.', better_way: null, estimate: { eur: 0.03, credits: 3, seconds: 12 }, plan_cost: { eur: 0.012, credits: 1 } }) });
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, step: 'run', answer: '**41 calls connected in Q4 2026.**\n\n- Sebastian Tapinos: 30\n- Eddie May: 11', basis: 'v_calls, 01.10.–13.11.2026', issue: null, suggestion: 'The Calls page shows this per week.', cost: { eur: 0.03, credits: 3, total_eur: 0.042, total_credits: 4 }, seconds: 9 }) });
      }
      if (/supabase|vibe-reports/.test(u.hostname)) { errs.push('still calls ' + u.hostname + u.pathname); return route.fulfill({ status: 500, body: '' }); }
      return route.fulfill({ status: 200, body: '' });
    });
module.exports = { wire, SF, TD, ASK };
if (require.main === module) (async () => {
  const b = await chromium.launch(); const out = {};
  for (const p of PAGES) {
    if (ONLY && p !== ONLY) continue;
    const page = await b.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
    const errs = [], missing404 = new Set();
    page.on('pageerror', e => errs.push(e.message.slice(0, 300)));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text().slice(0, 300)); });
    await wire(page, errs, missing404);
    await page.addInitScript(() => { try { localStorage.setItem('r2.user.name', JSON.stringify('Sebastian Tapinos')); localStorage.setItem('r2.seenVersion', JSON.stringify('9999')); } catch (e) {} });
    await page.goto('http://local.test/v2-staging' + p);
    await page.waitForTimeout(1800);
    const info = await page.evaluate(() => ({ q: document.querySelectorAll('button.q').length, missing: (window.R && R.help && R.help.missing) ? R.help.missing() : [],
      filters: [...document.querySelectorAll('#filters .f')].map(f => (f.querySelector('span') ? f.querySelector('span').textContent : '') + ':' + (f.querySelector('select') ? f.querySelector('select').value : f.querySelector('input') ? 'input' : 'x')).join(' | '),
      text: document.getElementById('page') ? document.getElementById('page').innerText.replace(/\s+/g, ' ').slice(0, 160) : '', h: document.documentElement.scrollHeight }));
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, (p.replace(/\//g, '_') || '_') + '.png'), fullPage: false }); }
    out[p] = { errs, missing404: [...missing404], ...info };
    await page.close();
  }
  await b.close();
  console.log(JSON.stringify(out));
})();
