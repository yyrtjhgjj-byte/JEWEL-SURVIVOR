const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8123';
(async () => {
  const char = process.argv[2] || 'ruby';
  const speed = process.argv[3] || 6;
  const maxSec = +(process.argv[4] || 240);
  const extra = process.argv[5] || '';
  const tag = process.argv[6] || char;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('CERT')) errs.push('CONSOLE ' + m.text()); });
  await page.goto(`${BASE}/?auto=${char}&bot&speed=${speed}${extra}`);
  const t0 = Date.now();
  let shots = 0, lastLog = 0;
  while ((Date.now() - t0) / 1000 < maxSec) {
    await page.waitForTimeout(2000);
    const st = await page.evaluate(() => {
      const g = window.__game; const r = window.__lastResult;
      if (r) return { done: true, r: { time: r.time|0, kills: r.kills, level: r.level, cleared: r.cleared, tl: (r.timeline||[]).filter((_,i)=>i%4==0).slice(0,12), bl: r.bossLog, dmg: Math.round(r.damage), weapons: r.weapons.map(w=>w.id+w.level+(w.evolved?'E':'')).join(','), passives: r.passives.map(p=>p.id+p.level).join(','), dt: r.dmgTaken, dmgBy: Object.fromEntries(Object.entries(r.dmgBy).map(([k,v])=>[k,Math.round(v)])) } };
      if (!g) return { none: true };
      return { t: g.time|0, lv: g.level, hp: Math.round(g.player.hp) + '/' + g.player.maxHp, en: g.enemies.filter(e=>e.alive).length, pr: g.projs.length, pk: g.pickups.length, parts: g.fx.parts.length, kills: g.kills, state: g.state, pu: g.perfU?.toFixed(2), pr2: g.perfR?.toFixed(2), boss: g.boss ? Math.round(g.boss.hp) : null, fps: 0 };
    });
    if (st.done) { console.log('RESULT', JSON.stringify(st.r)); break; }
    if (Date.now() - lastLog > 8000) { console.log(JSON.stringify(st)); lastLog = Date.now(); }
    if (shots < 3 && st.t > (shots + 1) * 100) { await page.screenshot({ path: `bot_${tag}_${shots}.png` }); shots++; }
  }
  const fps = await page.evaluate(() => new Promise(res => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 1000) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); }));
  console.log('rAF/s', fps);
  await page.screenshot({ path: `bot_${tag}_end.png` });
  console.log(errs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})();
