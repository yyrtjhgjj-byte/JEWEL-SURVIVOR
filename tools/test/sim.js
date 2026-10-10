// バランス計測用のシミュレーション（描画なし・rAF を使わずに update を直接回す）
// 使い方：NODE_PATH=... node tools/test/sim.js <出力.jsonl> <並列数> <ラン指定...>
//   ラン指定は "char:stage:heat:meta:god:回数:collect"（meta は none / half / max、god は 1 で無敵、
//   collect は view で「画面内の経験値は拾う」人間の動きを近似。省略時はボットの動きのまま）
//   例：node tools/test/sim.js out.jsonl 4 ruby:wastes:0:none:1:3 opal:void:0:max:0:2
// 1 ランごとに 1 行の JSON：時系列（15 秒ごと）、ボス・エリート・シーフの撃破時間、雑魚の寿命、死亡時刻など
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8123';
const out = process.argv[2] || 'sim.jsonl';
const par = +(process.argv[3] || 4);
const specs = [];
for (const a of process.argv.slice(4)) {
  const [char, stage, heat, meta, god, n, collect] = a.split(':');
  for (let i = 0; i < (+n || 1); i++) specs.push({ char, stage, heat: +heat || 0, meta: meta || 'none', god: god === '1', collect: collect || '' });
}

// 工房の強化（none：なし、half：各強化の半分、max：すべて最大）。研磨・覚醒・ランクは含めない
const SHOP_MAX = { might: 5, maxHp: 5, armor: 3, regen: 5, cooldown: 3, area: 3, speed: 3, duration: 3, moveSpeed: 3, magnet: 3, luck: 3, growth: 5, greed: 5, crit: 5, critDmg: 5, reroll: 5, skip: 3, banish: 3, revive: 1, amount: 1 };
function shop(meta) {
  if (meta === 'none') return {};
  const o = {};
  for (const [k, v] of Object.entries(SHOP_MAX)) o[k] = meta === 'max' ? v : Math.floor(v / 2);
  return o;
}

async function runOne(browser, spec) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript((up) => {
    localStorage.setItem('jewel-survivor-save-v1', JSON.stringify({ coins: 0, unlocked: { ruby: true }, upgrades: up, login: { last: ((d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`)(new Date()), days: 1 } }));
  }, shop(spec.meta));
  if (process.env.SIM_ENEMY) await page.addInitScript((o) => { window.__enemyOverride = o; }, JSON.parse(process.env.SIM_ENEMY));
  const q = `auto=${spec.char}&bot&norender&stage=${spec.stage}&heat=${spec.heat}${spec.god ? '&god' : ''}`;
  await page.goto(`${BASE}/?${q}`);
  await page.waitForFunction(() => window.__game);
  await page.evaluate((collect) => {
    const g = window.__game;
    window.__collect = collect;
    // 環境変数 SIM_ENEMY（例：{"boss1":{"hp":15000}}）で敵の値を上書きして比べられる
    if (window.__enemyOverride) import('/js/data.js').then((m) => { for (const [k, v] of Object.entries(window.__enemyOverride)) Object.assign(m.ENEMIES[k], v); });
    g.frame = () => {}; // rAF からは動かさない
    const S = (window.__sim = { tl: [], kills: [], trash: {}, lastDmg: 0, nextT: 0, dead: null });
    const spawn = g.spawnEnemy.bind(g);
    g.spawnEnemy = (type, x, y, o) => { const e = spawn(type, x, y, o); e.bornT = g.time; return e; };
    const kill = g.kill.bind(g);
    g.kill = (e, wid) => {
      if (e.boss || e.elite || e.ai === 'thief') S.kills.push({ type: e.type, cls: e.boss ? 'boss' : e.elite ? 'elite' : 'thief', t: Math.round(g.time), ttk: +(g.time - e.bornT).toFixed(1), hp: Math.round(e.maxHp) });
      else if (!e.prop && !e.segment && e.bornT !== undefined) {
        const b = Math.floor(g.time / 60);
        const r = S.trash[b] || (S.trash[b] = { n: 0, life: 0, hp: 0 });
        r.n++; r.life += g.time - e.bornT; r.hp += e.maxHp;
      }
      return kill(e, wid);
    };
    const die = g.die.bind(g);
    g.die = () => { die(); if (g.state === 'dying' && !S.dead) S.dead = Math.round(g.time); };
    S.xpDrop = 0;
    const dx = g.dropXp.bind(g);
    g.dropXp = (x, y, v) => { S.xpDrop += v; return dx(x, y, v); };
  }, spec.collect);
  const t0 = Date.now();
  let res = null;
  for (;;) {
    const st = await page.evaluate(() => {
      const g = window.__game, S = window.__sim;
      const end = g.stageTime + 0.5;
      for (let i = 0; i < 900; i++) {
        if (g.state === 'dying' || g.state === 'over' || window.__lastResult) break;
        if (g.cleared) break;
        g.update(1 / 60);
        if (window.__collect === 'view' && (S.ct = (S.ct || 0) + 1) % 30 === 0) {
          const R2 = (g.viewR * 0.8) ** 2;
          for (const pk of g.pickups) if (pk.kind === 'xp' && (pk.x - g.player.x) ** 2 + (pk.y - g.player.y) ** 2 < R2) pk.vac = true;
        }
        if (g.time >= S.nextT) {
          S.nextT += 15;
          const dmg = g.totalDmg - S.lastDmg; S.lastDmg = g.totalDmg;
          const near = g.enemies.filter((e) => e.alive && !e.prop && !e.segment && (e.x - g.player.x) ** 2 + (e.y - g.player.y) ** 2 < 200 * 200).length;
          S.tl.push({ t: Math.round(g.time), lv: g.level, dps: Math.round(dmg / 15), xpd: Math.round(S.xpDrop), est: Math.round(g.estPower()), tm: +(g.trashMul || 1).toFixed(2), hp: Math.round(g.player.hp), near, en: g.enemies.filter((e) => e.alive && !e.prop).length,
            w: g.weapons.map((w) => w.id + (w.evolved ? 'E' : w.level)).join(','), p: g.passives.map((p) => p.id + p.level).join(','),
            ar: +g.stats.area.toFixed(2), war: +Math.max(0, ...g.weapons.map((w) => w.s.area)).toFixed(2), lk: +g.stats.luck.toFixed(2) });
        }
        if (g.time > end + 60) break;
      }
      return { t: g.time, state: g.state, cleared: g.cleared, done: g.state === 'dying' || g.state === 'over' || g.cleared || g.time > end + 60 };
    });
    if (st.done) {
      res = await page.evaluate(() => { const g = window.__game, S = window.__sim; return { time: Math.round(g.time), coins: Math.round(g.coins), rough: { ...g.roughGot }, cleared: g.cleared, dead: S.dead, level: g.level, kills: g.kills, tl: S.tl, bk: S.kills, trash: S.trash, weapons: g.weapons.map((w) => w.id + (w.evolved ? 'E' : w.level)).join(','), passives: g.passives.map((p) => p.id + p.level).join(',') }; });
      break;
    }
    if (Date.now() - t0 > 900000) { res = { timeout: true, t: st.t }; break; }
  }
  await ctx.close();
  return { ...spec, ...res, real: Math.round((Date.now() - t0) / 1000), errs: errs.slice(0, 3) };
}

(async () => {
  const browser = await chromium.launch();
  let i = 0;
  const worker = async () => {
    while (i < specs.length) {
      const s = specs[i++];
      const r = await runOne(browser, s);
      fs.appendFileSync(out, JSON.stringify(r) + '\n');
      console.log(`${r.char} ${r.stage} h${r.heat} ${r.meta} ${r.god ? 'god' : ''} ${r.collect} → t=${r.time} ${r.cleared ? 'CLEAR' : r.dead ? 'DEAD@' + r.dead : ''} lv${r.level} (${r.real}s) ${r.errs.join('|')}`);
    }
  };
  await Promise.all(Array.from({ length: par }, worker));
  await browser.close();
})();
