// 武器の潜在火力の計測（動かない的を相手に、描画なしで update を直接回す）
// crowd：自機の周り（半径 60〜260）に 40 体の雑魚（HP はレベルごとに固定、倒すと別の場所に湧き直す。倒しきる分を超えたダメージは数えない）、
// single：正面 130 にボス 1 体（HP 無限）。自機は動かず、正面（+x）を向く
// 使い方：NODE_PATH=... node tools/test/wbench.js [武器リスト] [レベル（1,4,8,evo をカンマ区切り）]
// PAIR=1：進化の相方のチャームを最大 Lv で持たせる（それ以外の強化はなし）。REPS=3：同じ条件を 3 回測って平均と振れ幅を出す
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8123';
const IDS = (process.argv[2] || 'ruby,sapphire,garnet,labradorite,opal,amber,angelite,diamond,emerald,rhodochrosite,kyanite,aquamarine,alexandrite,tourmaline,moonstone').split(',');
const LVS = (process.argv[3] || '1,4,8,evo').split(',');
const SEC = +(process.env.SEC || 20);
const PAIR = process.env.PAIR === '1';
const REPS = +(process.env.REPS || 1);

(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.on('pageerror', (e) => console.log('ERR', e.message));
  await page.goto(`${BASE}/?auto=ruby&bot&norender&god`);
  await page.waitForFunction(() => window.__game);
  const rows = [];
  for (const id of IDS) {
    const row = { id };
    for (const lv of LVS) for (const mode of ['crowd', 'single']) {
      const vals = [];
      for (let r = 0; r < REPS; r++) vals.push(await page.evaluate(async ({ id, lv, mode, SEC, PAIR, r }) => {
        const { Game } = await import('/js/game.js');
        const old = window.__game;
        old.frame = () => {};
        const g = new Game(old.canvas, { ...old.hooks, levelUp: (g2, d) => d(), chest: (g2, big, d) => d(), artifact: (g2, d) => d(), checkAchievements: () => {}, hud: () => {}, banner: () => {}, bossBar: () => {}, fever: () => {}, combo: () => {}, coinPop: () => {}, haptic: () => {} }, { charId: 'ruby', god: true, noRender: true, startTime: 0 });
        window.__game = g;
        g.frame = () => {};
        g.director = () => {}; g.gainXp = () => {}; g.dropXp = () => {}; g.dropPickup = () => {}; g.botInput = () => {};
        g.weapons = []; g.dmgBy = {};
        const w = g.addWeapon(id);
        w.level = lv === 'evo' ? 8 : +lv; w.evolved = lv === 'evo';
        g.charId = 'garnet'; // ジュエルの特性が火力に効かないキャラ（最大 HP・自然回復だけ）
        if (PAIR) {
          const { WEAPONS, PASSIVES } = await import('/js/data.js');
          const pid = WEAPONS[id].evo.with;
          g.passives = [{ id: pid, level: PASSIVES[pid].max }];
          g.computeStats();
        } else { g.stats.might = 1; g.stats.crit = 0.05; g.stats.luck = 1; }
        w.s = (await import('/js/weapons.js')).weaponStats(g, w);
        const p = g.player; p.dirX = 1; p.dirY = 0; p.moving = false;
        const dummies = [];
        const H = mode === 'crowd' ? { 1: 150, 4: 600, 8: 3000, evo: 10000 }[lv] : 1e12;
        let sd = 1 + r * 7919; const R0 = Math.random; Math.random = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); // 回ごとに違う乱数列（再現できるように固定の種）
        const mk = (type, x, y) => { const e = g.spawnEnemy(type, x, y); e.hp = e.maxHp = H; e.speed = 0; e.dmg = 0; e.px = x; e.py = y; dummies.push(e); return e; };
        let seed = 999; const rnd2 = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        let killed = 0;
        if (mode === 'crowd') {
          let s = 12345; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
          for (let i = 0; i < 40; i++) { const a = rnd() * Math.PI * 2, d = 60 + rnd() * 200; mk('slime', Math.cos(a) * d, Math.sin(a) * d); }
        } else {
          const e = mk('boss1', 130, 0); e.ai = 'none'; e.atkT = 1e9; e.atk2 = 1e9;
        }
        const step = 1 / 60;
        for (let i = 0; i < SEC * 60; i++) {
          g.grid.clear(); for (const e of g.enemies) if (e.alive) g.grid.insert(e);
          for (const x of g.weapons) (window.__LOGIC || (window.__LOGIC = (await import('/js/weapons.js')).LOGIC))[x.id].update(g, x, x.s, step);
          g.updateProjs(step); g.updateAreas(step);
          for (const e of dummies) {
            if (!e.alive) { killed += H; const a = rnd2() * Math.PI * 2, d = 60 + rnd2() * 200; e.px = Math.cos(a) * d; e.py = Math.sin(a) * d; e.alive = true; e.hp = H; e.burnT = 0; e.hitT = {}; }
            e.x = e.px; e.y = e.py; e.vx = e.vy = 0; if (mode !== 'crowd') e.hp = 1e12; e.charmT = 0; e.frozenT = 0; e.fearT = 0;
          }
          g.time += step;
        }
        const dmg = g.dmgBy[id] || 0; // 倒しきる分を超えたダメージは数えない（damage() の dealt）
        window.__game = old;
        Math.random = R0;
        return Math.round(dmg / SEC);
      }, { id, lv, mode, SEC, PAIR, r }));
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      row[lv + ':' + mode] = Math.round(mean);
      row[lv + ':' + mode + ':spread'] = vals.length > 1 ? Math.round(((Math.max(...vals) - Math.min(...vals)) / (mean || 1)) * 100) : 0;
    }
    rows.push(row);
    console.log(id.padEnd(14), LVS.map((lv) => `${lv}: ${String(row[lv + ':crowd']).padStart(7)} / ${String(row[lv + ':single']).padStart(7)}` + (REPS > 1 ? ` (±${Math.max(row[lv + ':crowd:spread'], row[lv + ':single:spread'])}%)` : '')).join('   '));
  }
  await b.close();
})();
