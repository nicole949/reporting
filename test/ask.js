// Ask AI: buttons next to the explanations, page button, plan → confirm → answer, context sent along.
//   node test/ask.js [--shots DIR]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const { wire, ASK } = require('./render.js');
const SHOTS = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--shots'));
const res = []; const ok = (n, c, x) => res.push((c ? 'ok   ' : 'FAIL ') + n + (x ? '  ' + x : ''));
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('r2.user.name', JSON.stringify('Sebastian Tapinos')); localStorage.setItem('r2.seenVersion', JSON.stringify('9999')); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await wire(p, errs, new Set()); await p.goto('http://local.test/v2-staging/'); await p.waitForTimeout(2200);
  const shot = async n => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, n + '.png') }); } };
  const nAi = await p.evaluate(() => document.querySelectorAll('button.ai').length), nQ = await p.evaluate(() => document.querySelectorAll('button.q').length);
  ok('an AI button next to every explanation', nAi === nQ && nAi > 20, nAi + ' / ' + nQ);
  ok('page button', await p.evaluate(() => !!document.querySelector('.tool.askbtn')));
  await shot('ask_buttons');
  // tile button: opens the panel, does not open the record panel
  await p.click('.tile[data-m="connected"] button.ai'); await p.waitForTimeout(200);
  ok('panel opens for the tile', await p.evaluate(() => document.getElementById('ask').classList.contains('open') && /Connected calls/.test(document.querySelector('#ask .actx').innerText)));
  ok('record panel stays closed', await p.evaluate(() => !(document.getElementById('drill') || { classList: { contains: () => false } }).classList.contains('open')));
  await p.fill('#ask textarea', 'Who connected the most calls?'); await p.click('#ask .aform button[type=submit]'); await p.waitForTimeout(300);
  const sent = ASK[0] || {};
  ok('plan request carries the context', sent.step === 'plan' && sent.context.element && /Connected calls/.test(sent.context.element.label) && sent.context.period && sent.context.docs.length > 5 && /41/.test(sent.context.element.text) && sent.asked_by === 'Sebastian Tapinos', JSON.stringify({ el: sent.context && sent.context.element && sent.context.element.label, period: sent.context && sent.context.period, docs: sent.context && sent.context.docs.length }));
  ok('plan shows cost and asks to continue', await p.evaluate(() => /3 credits/.test(document.querySelector('#ask .acost').innerText) && !!document.querySelector('#ask [data-a="go"]')));
  await shot('ask_plan');
  await p.click('#ask [data-a="go"]'); await p.waitForTimeout(300);
  ok('run uses the plan id', ASK[1] && ASK[1].step === 'run' && ASK[1].id === '3a1f81dc-d40e-4310-9759-3c5342ae1bc2');
  ok('answer shown with basis and cost', await p.evaluate(() => /41 calls connected/.test(document.querySelector('#ask .aa').innerText) && /Based on/.test(document.querySelector('#ask .ameta').innerText) && /4 credits/.test(document.querySelector('#ask .ameta').innerText)));
  await shot('ask_answer');
  // follow-up keeps the history
  await p.fill('#ask textarea', 'And last quarter?'); await p.click('#ask .aform button[type=submit]'); await p.waitForTimeout(300);
  ok('follow-up sends the earlier answer', ASK[2] && ASK[2].context.history.length === 1 && /41 calls/.test(ASK[2].context.history[0].a));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // page-level question
  await p.click('.tool.askbtn'); await p.waitForTimeout(150);
  ok('page question has no element', await p.evaluate(() => /this page/.test(document.querySelector('#ask .actx').innerText)));
  ok('no errors', !errs.length, errs.join(' | '));
  await b.close(); console.log(res.join('\n')); if (res.some(r => r.startsWith('FAIL'))) process.exit(1);
})();
