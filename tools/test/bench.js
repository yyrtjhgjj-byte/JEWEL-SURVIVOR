const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8123';
const IDS = (process.argv[4] || 'ruby,sapphire,garnet,labradorite,opal,amber,angelite,diamond,emerald,rhodochrosite,kyanite,aquamarine,alexandrite,tourmaline,moonstone').split(',');
const LV = +(process.env.LV || 8);
const T0 = +(process.argv[2] || 300), DUR = +(process.argv[3] || 60);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  for (const id of IDS) for (const evo of LV === 8 ? [false, true] : [false]) {
    const acc = { dmg: 0, kills: 0 };
    for (let rep = 0; rep < 2; rep++) {
      await p.goto(`${BASE}/?auto=ruby&bot&norender&god&speed=30&t=${T0}`);
      await p.waitForFunction(() => window.__game);
      await p.evaluate(async ({ id, evo, lv }) => {
        const m = await import('/js/weapons.js');
        const g = window.__game;
        g.weapons = []; g.passives = []; g.dmgBy = {};
        g.gainXp = () => {}; g.dropPickup = () => {}; g.dropXp = () => {};
        const w = g.addWeapon(id); w.level = lv; w.evolved = evo;
        g.computeStats = () => {};
        g.stats.might = 1; g.stats.crit = 0.05;
        w.s = m.weaponStats(g, w);
        g.benchStart = { t: g.time, k: g.kills };
      }, { id, evo, lv: LV });
      await p.waitForFunction((d) => window.__game.time >= window.__game.benchStart.t + d, DUR, { timeout: 180000, polling: 250 });
      const r = await p.evaluate((id) => { const g = window.__game; return { dmg: g.dmgBy[id] || 0, kills: g.kills - g.benchStart.k, t: g.time - g.benchStart.t }; }, id);
      acc.dmg += r.dmg / r.t / 2; acc.kills += r.kills / 2;
    }
    console.log(id.padEnd(14), evo ? 'EVO' : 'Lv' + LV, String(Math.round(acc.dmg)).padStart(9), 'dps', String(Math.round(acc.kills)).padStart(5), 'kills');
  }
  await b.close();
})();
