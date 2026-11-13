// Go-To-Market overview: the Projects card (create, status pill, subtasks drop-down, description drop-down, edit, done, delete).
//   node test/projects.js [--shots DIR]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const { wire, PJ } = require('./render.js');
const SHOTS = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--shots'));
const res = []; const ok = (n, c, x) => res.push((c ? 'ok   ' : 'FAIL ') + n + (x ? '  ' + x : ''));
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('r2.user.name', JSON.stringify('Sebastian Tapinos')); localStorage.setItem('r2.seenVersion', JSON.stringify('9999')); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await wire(p, errs, new Set()); await p.goto('http://local.test/v2-staging/marketing/'); await p.waitForTimeout(2500);
  const shot = async n => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.locator('#projects').screenshot({ path: path.join(SHOTS, n + '.png') }); } };
  ok('card next to the to-dos', await p.evaluate(() => { const g = document.querySelector('.mgrid'); return g && g.children[0].id === 'todos' && g.children[1].id === 'projects'; }));
  ok('empty state', /No projects yet/.test(await p.textContent('#projects')));
  // create
  await p.click('.pjnew'); await p.fill('.pjform input[name=name]', 'Find new calling tool'); await p.selectOption('.pjform select[name=status]', 'active');
  await p.fill('.pjform input[name=owner]', 'Sebastian Tapinos'); await p.fill('.pjform input[name=start_date]', '2026-11-01'); await p.fill('.pjform input[name=end_date]', '2026-12-15');
  await p.fill('.pjform textarea', 'Local numbers per country, number rotation, HubSpot integration.\nShortlist: https://example.com/dialers');
  await p.click('.pjform button[type=submit]'); await p.waitForTimeout(300);
  ok('create', PJ.length === 1 && PJ[0].status === 'active' && PJ[0].scope === 'marketing' && PJ[0].created_by === 'Sebastian Tapinos', JSON.stringify(PJ[0]));
  await p.click('.pjnew'); await p.fill('.pjform input[name=name]', 'Implement dashboard 2.0'); await p.fill('.pjform input[name=start_date]', '2026-11-20'); await p.fill('.pjform input[name=end_date]', '2026-11-10');
  await p.click('.pjform button[type=submit]'); await p.waitForTimeout(200);
  ok('end before start is refused', PJ.length === 1 && /before the start/.test(await p.textContent('.pjform .tdmsg')));
  await p.fill('.pjform input[name=start_date]', '2026-10-01'); await p.fill('.pjform input[name=end_date]', '2026-11-10'); await p.click('.pjform button[type=submit]'); await p.waitForTimeout(300);
  ok('second project, overdue flag', PJ.length === 2 && await p.evaluate(() => /overdue/.test(document.querySelector('li.pj[data-id="2"] .tdmeta').innerText)));
  ok('sorted by status (in progress first)', await p.evaluate(() => document.querySelector('li.pj').dataset.id === '1'));
  // subtasks
  await p.click('li.pj[data-id="1"] .pjtg[data-dd="sub"]'); await p.waitForTimeout(100);
  for (const t of ['Shortlist 3 vendors', 'Run trials with both SDRs', 'Decide and sign']) { await p.fill('li.pj[data-id="1"] .pjsadd input', t); await p.press('li.pj[data-id="1"] .pjsadd input', 'Enter'); await p.waitForTimeout(150); }
  ok('add subtasks', PJ[0].subtasks.length === 3 && await p.evaluate(() => document.querySelectorAll('li.pj[data-id="1"] .pjsubs li').length) === 3);
  await p.click('li.pj[data-id="1"] .pjsubs li:first-child .tdc'); await p.waitForTimeout(200);
  ok('tick a subtask', PJ[0].subtasks[0].done && PJ[0].subtasks[0].done_by === 'Sebastian Tapinos' && /1\/3/.test(await p.textContent('li.pj[data-id="1"] .pjprog')));
  await p.dblclick('li.pj[data-id="1"] .pjsubs li:nth-child(2) .pjtt'); await p.fill('li.pj[data-id="1"] .pjsubs li:nth-child(2) .pjtt input', 'Run trials (2 weeks)'); await p.press('li.pj[data-id="1"] .pjsubs li:nth-child(2) .pjtt input', 'Enter'); await p.waitForTimeout(200);
  ok('rename a subtask', PJ[0].subtasks[1].title === 'Run trials (2 weeks)');
  ok('subtasks stay open after changes', await p.evaluate(() => !!document.querySelector('li.pj[data-id="1"] .pjsubs')));
  // description
  await p.click('li.pj[data-id="1"] .pjtg[data-dd="desc"]'); await p.waitForTimeout(100);
  ok('description drop-down with link', await p.evaluate(() => { const d = document.querySelector('li.pj[data-id="1"] .pjdesc'); return d && /HubSpot integration/.test(d.innerText) && !!d.querySelector('a[href="https://example.com/dialers"]'); }));
  await shot('projects');
  // status pill
  await p.selectOption('li.pj[data-id="2"] .pjst', 'blocked'); await p.waitForTimeout(200);
  ok('status from the pill', PJ[1].status === 'blocked');
  // edit
  await p.hover('li.pj[data-id="2"]'); await p.click('li.pj[data-id="2"] .ed'); await p.fill('.pjform input[name=owner]', 'Nici'); await p.click('.pjform button[type=submit]'); await p.waitForTimeout(200);
  ok('edit', PJ[1].owner === 'Nici' && PJ[1].name === 'Implement dashboard 2.0');
  // done + show done
  await p.selectOption('li.pj[data-id="2"] .pjst', 'done'); await p.waitForTimeout(200);
  ok('done goes under "Show done"', PJ[1].done_at && await p.evaluate(() => !document.querySelector('li.pj[data-id="2"]') && /Show done \(1\)/.test(document.querySelector('.pjshow').innerText)));
  await p.click('.pjshow'); await p.waitForTimeout(100);
  ok('show done', await p.evaluate(() => !!document.querySelector('li.pj.st-done[data-id="2"]')));
  // delete (two clicks)
  await p.hover('li.pj[data-id="2"]'); await p.click('li.pj[data-id="2"] .del'); await p.click('li.pj[data-id="2"] .del'); await p.waitForTimeout(200);
  ok('delete', PJ.length === 1);
  ok('"?" on the card', await p.evaluate(() => !!document.querySelector('#projects .gh h2 .q')));
  ok('no errors', !errs.length, errs.join(' | '));
  await b.close(); console.log(res.join('\n')); if (res.some(r => r.startsWith('FAIL'))) process.exit(1);
})();
