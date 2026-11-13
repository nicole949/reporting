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
(async () => {
  const b = await chromium.launch(); const out = {};
  for (const p of PAGES) {
    if (ONLY && p !== ONLY) continue;
    const page = await b.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
    const errs = [], missing404 = new Set();
    page.on('pageerror', e => errs.push(e.message.slice(0, 300)));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text().slice(0, 300)); });
    await page.route('**/*', async route => {
      const u = new URL(route.request().url());
      if (u.hostname === 'local.test') {
        let pth = u.pathname.replace(/^\/v2-staging/, ''); if (pth.endsWith('/')) pth += 'index.html';
        if (pth === '/assets/changelog.json') return route.fulfill({ contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, '..', 'docs', 'changelog.json'), 'utf8') });
        const f = path.join(ROOT, pth); if (!fs.existsSync(f)) { errs.push('404 ' + pth); return route.fulfill({ status: 404, body: '' }); }
        const ct = pth.endsWith('.js') ? 'application/javascript' : pth.endsWith('.css') ? 'text/css' : pth.endsWith('.png') ? 'image/png' : 'text/html';
        return route.fulfill({ contentType: ct, body: pth.endsWith('.png') ? fs.readFileSync(f) : fs.readFileSync(f, 'utf8').replace(/__BUILD__/g, 'test').replace(/__ENV__/g, 'staging') });
      }
      if (u.hostname === 'n8n.rec.jentis.com') {
        const view = u.pathname.slice(1); const rows = query(view, u.searchParams);
        if (!rows) { missing404.add(view); return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: '42P01', message: 'relation "api.' + view + '" does not exist' }) }); }
        const range = (route.request().headers()['range'] || '0-999').split('-').map(Number);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows.slice(range[0], range[1] + 1)) });
      }
      if (/supabase|vibe-reports/.test(u.hostname)) { errs.push('still calls ' + u.hostname + u.pathname); return route.fulfill({ status: 500, body: '' }); }
      return route.fulfill({ status: 200, body: '' });
    });
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
