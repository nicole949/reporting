// Checks that filters stay as set after a reload and that saved filters (own + shared) can be saved, applied and deleted.
//   node test/filters.js [--shots DIR]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const { wire, SF } = require('./render.js');
const SHOTS = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--shots'));
const res = []; const ok = (name, cond, extra) => res.push((cond ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : ''));
const val = (page, id) => page.evaluate(i => { const e = document.getElementById(i); return e ? e.value : null; }, id);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('r2.user.name')) { localStorage.setItem('r2.user.name', JSON.stringify('Sebastian Tapinos')); localStorage.setItem('r2.seenVersion', JSON.stringify('9999')); } } catch (e) {} });
  const open = async p => { const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 200))); await wire(page, errs, new Set()); await page.goto('http://local.test/v2-staging' + p); await page.waitForTimeout(1800); page._errs = errs; return page; };
  const shot = async (page, n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, n + '.png') }); } };

  // ---- Deals (ported page): selects, period, search ----
  let pg = await open('/sales/deals/');
  const owner = await pg.evaluate(() => [...document.getElementById('f-owner').options].map(o => o.value).filter(Boolean)[0]);
  await pg.selectOption('#f-status', 'won'); await pg.selectOption('#f-owner', owner); await pg.selectOption('#f-created', 'lastquarter');
  await pg.fill('#f-search', 'gmbh'); await pg.waitForTimeout(500);
  const rows1 = await pg.evaluate(() => document.querySelectorAll('#page tbody tr').length);
  await pg.close(); pg = await open('/sales/deals/');
  ok('deals: status stays after reload', await val(pg, 'f-status') === 'won', await val(pg, 'f-status'));
  ok('deals: owner stays (option arrives with data)', await val(pg, 'f-owner') === owner, await val(pg, 'f-owner'));
  ok('deals: period stays', await val(pg, 'f-created') === 'lastquarter');
  ok('deals: search stays', await val(pg, 'f-search') === 'gmbh');
  ok('deals: same rows as before reload', await pg.evaluate(() => document.querySelectorAll('#page tbody tr').length) === rows1, String(rows1));
  // save as own + shared
  await pg.click('.views .vbtn'); await pg.fill('.vnm', 'Won last quarter'); await pg.click('.vsave button'); await pg.waitForTimeout(200);
  await pg.fill('.vnm', 'Team: won'); await pg.check('.vsh'); await pg.click('.vsave button'); await pg.waitForTimeout(300);
  ok('deals: shared filter reached the database', SF.length === 1 && SF[0].page === 'deals' && SF[0].created_by === 'Sebastian Tapinos', JSON.stringify(SF.map(x => x.name)));
  await shot(pg, 'views_menu');
  await pg.keyboard.press('Escape');
  await pg.selectOption('#f-status', 'open'); await pg.selectOption('#f-owner', ''); await pg.fill('#f-search', ''); await pg.waitForTimeout(400);
  await pg.click('.views .vbtn'); await pg.click('.vrow .vname[data-sh="0"]'); await pg.waitForTimeout(600);
  ok('deals: own saved filter applied', await val(pg, 'f-status') === 'won' && await val(pg, 'f-owner') === owner && await val(pg, 'f-search') === 'gmbh');
  ok('deals: button shows the active filter', (await pg.textContent('.views .vbtn span')) === 'Saved filters · Won last quarter');
  ok('deals: no errors', !pg._errs.length, pg._errs.join(' | '));
  await pg.close();
  // "another user": fresh browser storage sees the shared one only
  const ctx2 = await b.newContext({ viewport: { width: 1500, height: 1000 } });
  const p2 = await ctx2.newPage(); await wire(p2, [], new Set()); await p2.goto('http://local.test/v2-staging/sales/deals/'); await p2.waitForTimeout(1800);
  await p2.click('.views .vbtn'); await p2.waitForTimeout(300);
  ok('other user: sees shared, not the private one', await p2.evaluate(() => document.querySelectorAll('.vname[data-sh="1"]').length === 1 && document.querySelectorAll('.vname[data-sh="0"]').length === 0));
  await p2.click('.vname[data-sh="1"]'); await p2.waitForTimeout(600);
  ok('other user: shared filter applied', await val(p2, 'f-status') === 'won' && await val(p2, 'f-owner') === owner);
  await p2.click('.views .vbtn'); await p2.click('.vdel[data-sh="1"]'); await p2.click('.vdel[data-sh="1"]'); await p2.waitForTimeout(300);
  ok('shared filter deleted', SF.length === 0);
  await ctx2.close();

  // ---- Customers: owner pills + multi-select + clear ----
  pg = await open('/cs/customers/');
  const pill = await pg.evaluate(() => document.querySelectorAll('#ownerbar .opill')[2].dataset.o);
  await pg.click('#ownerbar .opill:nth-child(3)'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { document.querySelector('details.msel').open = true; });
  await pg.click('details.msel input[type=checkbox] >> nth=1'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { document.querySelector('details.msel').open = true; });
  await pg.click('details.msel input[type=checkbox] >> nth=3'); await pg.waitForTimeout(500);
  const picked = await pg.evaluate(() => [...document.querySelectorAll('details.msel')[0].querySelectorAll('input:checked')].map(x => x.value));
  const n1 = await pg.evaluate(() => document.querySelectorAll('#page tbody tr').length);
  await pg.close(); pg = await open('/cs/customers/');
  ok('customers: owner pill stays', await pg.evaluate(() => (document.querySelector('#ownerbar .opill.on') || {}).dataset.o) === pill, pill);
  ok('customers: multi-select stays', JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll('details.msel')[0].querySelectorAll('input:checked')].map(x => x.value))) === JSON.stringify(picked), JSON.stringify(picked));
  ok('customers: same rows', await pg.evaluate(() => document.querySelectorAll('#page tbody tr').length) === n1, String(n1));
  ok('customers: no errors', !pg._errs.length, pg._errs.join(' | '));
  await shot(pg, 'views_customers');
  await pg.click('.views .vbtn'); await pg.click('.vreset'); await pg.waitForTimeout(2000);
  ok('customers: reset goes back to all owners', await pg.evaluate(() => (document.querySelector('#ownerbar .opill.on') || {}).dataset.o) === '');
  await pg.close();

  // ---- Commercial overview (native bar) + BD overview (native bar with a second control) ----
  pg = await open('/');
  await pg.selectOption('#f-time', 'lastquarter'); await pg.waitForTimeout(300);
  await pg.click('.views .vbtn'); await pg.fill('.vnm', 'Last quarter'); await pg.click('.vsave button'); await pg.keyboard.press('Escape');
  await pg.selectOption('#f-time', '30d'); await pg.waitForTimeout(300);
  await pg.close(); pg = await open('/');
  ok('overview: period stays', await val(pg, 'f-time') === '30d');
  await pg.click('.views .vbtn'); await pg.waitForTimeout(200);
  await pg.click('.vname[data-sh="0"]', { timeout: 3000 }); await pg.waitForTimeout(400);
  ok('overview: saved filter applied on native bar', await val(pg, 'f-time') === 'lastquarter');
  ok('overview: no errors', !pg._errs.length, pg._errs.join(' | '));
  await pg.close();

  // ---- Calls: chart drop-down inside the page ----
  pg = await open('/bd/calls/');
  await pg.selectOption('#f-gran', { index: 2 }); const g = await val(pg, 'f-gran'); await pg.waitForTimeout(300);
  await pg.close(); pg = await open('/bd/calls/');
  ok('calls: chart granularity stays', await val(pg, 'f-gran') === g, g);
  ok('calls: no errors', !pg._errs.length, pg._errs.join(' | '));
  await pg.close();

  await b.close();
  console.log(res.join('\n'));
  if (res.some(r => r.startsWith('FAIL'))) process.exit(1);
})();
