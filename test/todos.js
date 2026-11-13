// Marketing overview: to-dos & KPI targets (add, KPI progress, edit, done, delete), goals, chart cards.
//   node test/todos.js [--shots DIR]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const { wire, TD } = require('./render.js');
const SHOTS = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--shots'));
const res = []; const ok = (n, c, x) => res.push((c ? 'ok   ' : 'FAIL ') + n + (x ? '  ' + x : ''));
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('r2.user.name', JSON.stringify('Sebastian Tapinos')); localStorage.setItem('r2.seenVersion', JSON.stringify('9999')); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await wire(p, errs, new Set()); await p.goto('http://local.test/v2-staging/marketing/'); await p.waitForTimeout(2500);
  const shot = async n => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, n + '.png') }); } };
  ok('tiles', await p.evaluate(() => document.querySelectorAll('#kg .tile.clk').length) === 7);
  ok('chart cards', await p.evaluate(() => document.querySelectorAll('.ccard .cc-chart svg').length) === 4);
  ok('goals', await p.evaluate(() => document.querySelectorAll('.goal2').length) >= 1, String(await p.evaluate(() => document.querySelectorAll('.goal2').length)));
  // plain to-do
  await p.fill('.tdadd input[name=title]', 'Send the DMEXCO follow-up'); await p.fill('.tdadd input[name=assignee]', 'Laila'); await p.click('.tdadd button[type=submit]'); await p.waitForTimeout(300);
  ok('add a to-do', TD.length === 1 && TD[0].scope === 'marketing' && TD[0].created_by === 'Sebastian Tapinos', JSON.stringify(TD[0]));
  // KPI target: calls this week, Sebastian only
  await p.fill('.tdadd input[name=title]', '200 calls this week'); await p.check('.tdadd input[name=iskpi]');
  await p.selectOption('.tdadd select[name=metric]', 'calls'); await p.fill('.tdadd input[name=target]', '200');
  await p.selectOption('.tdadd select[name=period]', 'rweek'); await p.selectOption('.tdadd select[name=owner]', 'Sebastian Tapinos');
  await p.click('.tdadd button[type=submit]'); await p.waitForTimeout(300);
  const k = TD[1] && TD[1].kpi;
  ok('add a KPI target', k && k.metric === 'calls' && k.target === 200 && k.period === 'week' && k.repeat && k.owner === 'Sebastian Tapinos', JSON.stringify(k));
  const txt = await p.evaluate(() => (document.querySelector('li.td.kpi .tdn') || {}).innerText || '');
  const expect = await p.evaluate(() => { const d = new Date(), a = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)); const f = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); return K.value('calls', f(a), f(new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7)), { owner: 'Sebastian Tapinos' }); });
  ok('KPI progress is computed', txt.startsWith(expect + ' / 200'), txt + ' (expected ' + expect + ')');
  // series target: LinkedIn connection requests this month
  await p.fill('.tdadd input[name=title]', '150 connection requests'); await p.check('.tdadd input[name=iskpi]');
  await p.selectOption('.tdadd select[name=metric]', 'linkedin'); await p.fill('.tdadd input[name=target]', '150');
  await p.selectOption('.tdadd select[name=period]', 'month'); await p.selectOption('.tdadd select[name=series]', 'Connection request');
  await p.click('.tdadd button[type=submit]'); await p.waitForTimeout(300);
  ok('series target stored with fixed dates', TD[2] && TD[2].kpi.series === 'Connection request' && /^\d{4}-\d\d-01$/.test(TD[2].kpi.from), JSON.stringify(TD[2] && TD[2].kpi));
  // validation
  await p.fill('.tdadd input[name=title]', 'Bad target'); await p.check('.tdadd input[name=iskpi]'); await p.fill('.tdadd input[name=target]', ''); await p.click('.tdadd button[type=submit]'); await p.waitForTimeout(200);
  ok('missing target number is refused', TD.length === 3 && /target number/i.test(await p.textContent('.tdmsg')));
  await p.uncheck('.tdadd input[name=iskpi]'); await p.fill('.tdadd input[name=title]', '');
  await shot('todos');
  // records behind a target
  await p.click('li.td.kpi button.tdk'); await p.waitForTimeout(300);
  ok('target opens its records', await p.evaluate(() => document.getElementById('drill').classList.contains('open') && /calls/i.test(document.querySelector('#drill .small').innerText)));
  await shot('todo_records');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // edit
  await p.hover('li.td:not(.kpi)'); await p.click('li.td:not(.kpi) .ed'); await p.waitForTimeout(150);
  await p.fill('.tdadd input[name=title]', 'Send the DMEXCO follow-up mails'); await p.click('.tdadd button[type=submit]'); await p.waitForTimeout(300);
  ok('edit', TD[0].title === 'Send the DMEXCO follow-up mails' && TD.length === 3);
  // done
  await p.click('li.td:not(.kpi) .tdc'); await p.waitForTimeout(300);
  ok('mark done', TD[0].done && TD[0].done_by === 'Sebastian Tapinos' && await p.evaluate(() => !!document.querySelector('.tdshow')));
  await p.click('.tdshow'); await p.waitForTimeout(150);
  ok('show done', await p.evaluate(() => document.querySelectorAll('li.td.done').length) === 1);
  // delete (two clicks)
  await p.hover('li.td.done'); await p.click('li.td.done .del'); await p.click('li.td.done .del'); await p.waitForTimeout(300);
  ok('delete', TD.length === 2);
  // goal panel
  await p.click('.goal2'); await p.waitForTimeout(300);
  ok('goal opens its records', await p.evaluate(() => document.getElementById('drill').classList.contains('open')));
  await p.keyboard.press('Escape');
  // chart card bar
  await p.click('#c-calls, #c-emails .cc-chart .bk:last-of-type'); await p.waitForTimeout(300);
  ok('chart card bar opens records', await p.evaluate(() => document.getElementById('drill').classList.contains('open')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.evaluate(() => window.scrollTo(0, 0)); await shot('mkt_top');
  await p.evaluate(() => window.scrollTo(0, 900)); await p.waitForTimeout(150); await shot('mkt_bottom');
  ok('no errors', !errs.length, errs.join(' | '));
  await b.close(); console.log(res.join('\n')); if (res.some(r => r.startsWith('FAIL'))) process.exit(1);
})();
