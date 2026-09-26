const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8123';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message + ' ' + e.stack));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('C ' + m.text()); });
  for (const [st, t] of [['wastes', 598], ['cavern', 598], ['magma', 598], ['tundra', 598], ['void', 718]]) {
    await p.goto(`${BASE}/?auto=ruby&bot&speed=4&god&stage=${st}&t=${t}&build=ruby:evo,amber:evo,alexandrite:evo,kyanite:evo,emerald:evo,diamond:evo`);
    const t0 = Date.now(); let r = null;
    while (Date.now() - t0 < 420000) { await p.waitForTimeout(1500); r = await p.evaluate(() => window.__lastResult && { c: window.__lastResult.cleared, t: window.__lastResult.time|0 }); if (r) break; }
    await p.waitForTimeout(2500);
    const vis = await p.evaluate(() => [...document.querySelectorAll('.screen, .modal, #results')].filter(e=>e.offsetParent).map(e=>e.id||e.className).join('|'));
    console.log(st, JSON.stringify(r), vis);
    if (st === 'wastes') await p.screenshot({ path: 'clear_wastes.png' });
  }
  console.log('ERRORS', errs.length, errs.slice(0, 5).join('\n'));
  await b.close();
})();
