// Commercial overview: every tile opens its record list, bars can be clicked, frequency changes the bars.
//   node test/overview.js [--shots DIR]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const { wire } = require('./render.js');
const SHOTS = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--shots'));
const res = []; const ok = (n, c, x) => res.push((c ? 'ok   ' : 'FAIL ') + n + (x ? '  ' + x : ''));
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await wire(p, errs, new Set()); await p.goto('http://local.test/v2-staging/'); await p.waitForTimeout(2200);
  const keys = await p.evaluate(() => [...document.querySelectorAll('.tile.clk')].map(t => t.dataset.m));
  ok('all tiles are clickable', keys.length === 22, String(keys.length));
  for (const k of keys) {
    await p.click('.tile[data-m="' + k + '"] .v'); await p.waitForTimeout(120);
    const info = await p.evaluate(() => { const d = document.getElementById('drill'); return { open: d.classList.contains('open'), n: parseInt(d.querySelector('.dcount').innerText.replace(/\D/g, '').slice(0, 6) || '0', 10), rows: d.querySelectorAll('tbody tr').length }; });
    ok('panel ' + k, info.open && (info.rows > 0 || info.n === 0), JSON.stringify(info));
    if (SHOTS && ['emails', 'linkedin', 'responses', 'calls', 'won'].includes(k)) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, 'ov_' + k + '.png') }); }
    await p.keyboard.press('Escape'); await p.waitForTimeout(220);
  }
  const before = await p.evaluate(() => document.querySelectorAll('.tile[data-m="calls"] .spark .bk').length);
  await p.selectOption('#filters select[data-k="freq"]', 'month'); await p.waitForTimeout(300);
  const after = await p.evaluate(() => document.querySelectorAll('.tile[data-m="calls"] .spark .bk').length);
  ok('frequency changes the bars', before > after && after >= 1, before + ' → ' + after);
  await p.click('.tile[data-m="calls"] .v'); await p.waitForTimeout(250);
  const all = await p.evaluate(() => document.querySelector('#drill .dcount').innerText);
  await p.click('#drill .dchart .bk:nth-of-type(1)'); await p.waitForTimeout(250);
  const one = await p.evaluate(() => document.querySelector('#drill .dcount').innerText);
  ok('clicking a bar narrows the list', all !== one, all.slice(0, 12) + ' → ' + one.slice(0, 12));
  ok('no errors', !errs.length, errs.join(' | '));
  await b.close(); console.log(res.join('\n')); if (res.some(r => r.startsWith('FAIL'))) process.exit(1);
})();
