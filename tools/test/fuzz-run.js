// ランの総当たり：ステージ × モードをボット（描画なし）で回し、例外・NaN・途中保存からの再開の食い違いを拾う
// 使い方：PAR=4 node tools/test/fuzz-run.js ruby:wastes opal:void:chaos,heat20 garnet:finale1:rush …
//   指定は "ジュエル:ステージ:旗"。旗：chaos・hyper・hurry・endless・heatN・nogod（無敵なし）・notrip（再開しない）・
//   build（進化済みの武器 4 つ）・tN（開始時刻）・long／xlong（ENDLESS を長く）・rush（BOSS モード）・fromN（CHECKPOINT）
//   ラン中に何度か「途中保存 → 再開」をはさみ、レベル・装備・コイン・ボスが同じかを比べる
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8123';
const par = +(process.env.PAR || 4);
const specs = process.argv.slice(2).map((a) => { const [char, stage, flags = ''] = a.split(':'); return { char, stage, flags: flags.split(',').filter(Boolean), tag: a }; });

async function runOne(browser, spec) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/WebGL|swiftshader|GPU stall/i.test(m.text())) errs.push('console.error: ' + m.text().slice(0, 300)); });
  await page.goto(BASE + '/');
  await page.waitForFunction(() => window.__save);
  await page.evaluate(async () => {
    const { todayStr } = await import('/js/util.js');
    const D = await import('/js/data.js');
    const { STAGES } = await import('/js/stages.js');
    const { persist } = await import('/js/save.js');
    const s = window.__save;
    s.login = { last: todayStr(), days: 1 };
    for (const st of STAGES) s.stages[st.id] = { cleared: true, heat: 20, best: 420 };
    s.chaosOpen = true;
    for (const it of D.SHOP) s.upgrades[it.id] = it.max;
    s.upgrades2 = {};
    for (const it of D.UPPER_SHOP) s.upgrades2[it.id] = it.max;
    s.upperShop = true;
    for (const id of D.CHAR_IDS) s.unlocked[id] = true;
    persist();
  });
  const f = spec.flags;
  const heat = (f.find((x) => x.startsWith('heat')) || 'heat0').slice(4);
  const t0p = f.find((x) => /^t\d+$/.test(x));
  let q = `auto=${spec.char}&bot&norender&stage=${spec.stage}&heat=${heat}`;
  if (!f.includes('nogod')) q += '&god';
  for (const k of ['chaos', 'hyper', 'hurry', 'endless']) if (f.includes(k)) q += '&' + k;
  if (f.includes('rush')) q += `&rush=${spec.char},opal,diamond,garnet/topaz,jasper,nephrite,coral,iolite,citrine/${(f.find((x) => /^from\d+$/.test(x)) || 'from0').slice(4)}`;
  if (t0p) q += '&t=' + t0p.slice(1);
  if (f.includes('build')) q += `&build=${spec.char},opal,diamond,garnet:evo`;
  await page.goto(`${BASE}/?${q}`);
  await page.waitForFunction(() => window.__game);
  const limit = f.includes('xlong') ? 3300 : f.includes('long') ? 480 : f.includes('endless') ? 240 : 0;
  const T0 = t0p ? +t0p.slice(1) : 0;
  const trips = (f.includes('notrip') ? [] : [35 + Math.random() * 60, 125 + Math.random() * 100, 250 + Math.random() * 150, 425 + Math.random() * 40, 500 + Math.random() * 80, 640 + Math.random() * 100, 780 + Math.random() * 100]).filter((t) => t > T0 + 5);
  await page.evaluate(([limit, trips, rush, xl]) => {
    const F = (window.__F = { errs: [], nan: [], trips: trips.slice(), tripLog: [], limit, rush, laps: xl ? 9 : 2, rushT: xl ? 5000 : 900, n: 0, maxEn: 0, maxPr: 0, maxPk: 0, prevLv: 0 });
    window.__hook = () => { window.__game.frame = () => {}; };
    window.__hook();
    F.scan = (g) => {
      const bad = [];
      const chk = (name, v) => { if (typeof v === 'number' && !Number.isFinite(v)) bad.push(name + '=' + v); };
      const p = g.player;
      for (const k of ['x', 'y', 'hp', 'maxHp', 'iT']) chk('player.' + k, p[k]);
      for (const k in g.stats) chk('stats.' + k, g.stats[k]);
      for (const k of ['time', 'xp', 'xpNext', 'coins', 'totalDmg', 'kills', 'level', 'feverGauge', 'trashMul', 'combo', 'healShow']) chk(k, g[k]);
      for (const w of g.weapons) if (w.s) for (const k in w.s) chk(`w.${w.id}.${k}`, w.s[k]);
      for (const e of g.enemies) if (e.alive) for (const k of ['x', 'y', 'hp', 'maxHp', 'dmg', 'speed', 'r']) chk(`e.${e.type}.${k}`, e[k]);
      for (const a of g.projs || []) { chk('proj.x', a.x); chk('proj.y', a.y); }
      for (const a of g.pickups || []) { chk('pk.x', a.x); chk('pk.y', a.y); chk('pk.v', a.v); }
      for (const a of g.ebullets || []) { chk('eb.x', a.x); chk('eb.y', a.y); }
      if (p.hp > p.maxHp + 0.01) bad.push(`hp>max ${p.hp}/${p.maxHp}`);
      if (g.coins < 0) bad.push('coins<0');
      return bad;
    };
  }, [limit, trips, f.includes('rush'), f.includes('xlong')]);
  let res = null, guard = 0;
  for (;;) {
    const st = await page.evaluate(async () => {
      const F = window.__F;
      let g = window.__game;
      const end = (g.stageTime || 420) + 0.5 + F.limit;
      for (let i = 0; i < 1200; i++) {
        g = window.__game;
        if (!g || g.state === 'over' || window.__lastResult) break;
        if (g.time > end + 150) break;
        if (F.rush && (g.rushKills >= g.rushOrder.length * F.laps + 1 || g.time > F.rushT)) break;
        try { g.update(1 / 60); } catch (e) { const s = String(e && e.stack || e).split('\n').slice(0, 4).join(' | '); if (F.errs.length < 8 && !F.errs.includes(s)) F.errs.push(`t=${g.time.toFixed(1)} ${s}`); if (F.errs.length >= 8) break; }
        F.n++;
        if (F.n % 30 === 0) {
          const bad = F.scan(g);
          for (const b of bad) { const k = b.replace(/=.*/, ''); if (F.nan.length < 12 && !F.nan.some((x) => x.includes(k))) F.nan.push(`t=${g.time.toFixed(1)} ${b}`); }
          F.maxEn = Math.max(F.maxEn, g.enemies.length); F.maxPr = Math.max(F.maxPr, (g.projs || []).length); F.maxPk = Math.max(F.maxPk, (g.pickups || []).length);
        }
        if (F.trips.length && g.time >= F.trips[0] && (g.state === 'play' || g.state === 'modal')) {
          F.trips.shift();
          try {
            const r = g.results();
            if ((!g.cleared || g.endless) && g.state !== 'dying') r.resume = g.snapshot();
            const res = JSON.parse(JSON.stringify(r));
            if (!res.resume) { F.tripLog.push(`t=${g.time.toFixed(0)} no-resume`); continue; }
            const sig = (x) => JSON.stringify({ lv: x.level, w: x.weapons.map((w) => [w.id, w.level, !!w.evolved, w.lbN || 0]), p: x.passives.map((p) => [p.id, p.level, p.lbN || 0]), coins: x.coins, kills: x.kills, rev: x.revives, arts: [...x.arts], boss: x.boss && x.boss.alive ? (x.boss.type === 'piper' ? 'azathoth' : x.boss.type) : null, rk: x.rushKills, auto: x.autoPick });
            const before = sig(g), est0 = g.estPower(), mh0 = g.player.maxHp;
            const { getApp } = await import('/js/ui.js');
            getApp().startGame(res.charId, { stageId: res.stageId, heat: res.heat || 0, endless: !!res.endless, hyper: !!res.hyper, hurry: !!res.hurry, chaos: !!res.chaos, rush: res.rush ? { w: res.rush.w, p: res.rush.p } : null, resume: res.resume });
            const g2 = window.__game;
            window.__hook();
            const after = sig(g2);
            const d = [];
            if (before !== after) d.push(`sig ${before} -> ${after}`);
            if (Math.abs(g2.time - res.resume.time) > 0.01) d.push(`time ${res.resume.time} -> ${g2.time}`);
            if (Math.abs(g2.estPower() - est0) / Math.max(1, est0) > 0.02) d.push(`estPower ${est0.toFixed(0)} -> ${g2.estPower().toFixed(0)}`);
            if (Math.abs(g2.player.maxHp - mh0) > 0.5) d.push(`maxHp ${mh0} -> ${g2.player.maxHp}`);
            for (const k of ['hyper', 'hurry', 'chaos', 'endless', 'heat']) if (g2[k] !== g[k]) d.push(`${k} ${g[k]} -> ${g2[k]}`);
            F.tripLog.push(`t=${g.time.toFixed(0)} ${d.length ? 'DIFF ' + d.join(' ; ') : 'ok'}`);
          } catch (e) { F.tripLog.push(`t=${g.time.toFixed(0)} THROW ` + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); }
        }
      }
      g = window.__game;
      const done = !g || g.state === 'over' || !!window.__lastResult || g.time > end + 150 || F.errs.length >= 8 || (F.rush && (g.rushKills >= g.rushOrder.length * 2 + 1 || g.time > 900));
      return { done, t: g ? g.time : -1, state: g && g.state };
    });
    if (st.done || ++guard > 4000) break;
  }
  res = await page.evaluate(() => {
    const F = window.__F, g = window.__game, r = window.__lastResult;
    return { errs: F.errs, nan: F.nan, trips: F.tripLog, maxEn: F.maxEn, maxPr: F.maxPr, maxPk: F.maxPk, t: g ? Math.round(g.time) : -1, lv: g ? g.level : -1, state: g ? g.state : '', cleared: r ? !!r.cleared : g ? !!g.cleared : null, rk: g ? g.rushKills : 0, lbs: g ? g.weapons.reduce((a, w) => a + (w.lbN || 0), 0) : 0 };
  });
  await ctx.close();
  return { ...res, page: errs };
}

(async () => {
  const browser = await chromium.launch();
  const q = specs.slice();
  let bad = 0;
  await Promise.all(Array.from({ length: par }, async () => {
    for (;;) {
      const s = q.shift();
      if (!s) return;
      let r;
      try { r = await runOne(browser, s); } catch (e) { r = { fatal: String(e.message).slice(0, 300) }; }
      const tripBad = (r.trips || []).filter((x) => !/ ok$| no-resume$/.test(x));
      const problem = r.fatal || (r.errs && r.errs.length) || (r.nan && r.nan.length) || tripBad.length || (r.page && r.page.length);
      if (problem) bad++;
      console.log(`${problem ? 'NG' : 'ok'} ${s.tag} t=${r.t} lv=${r.lv} state=${r.state} cleared=${r.cleared} rk=${r.rk} lb=${r.lbs} en=${r.maxEn} pr=${r.maxPr} pk=${r.maxPk} trips=${(r.trips || []).length}`);
      if (r.fatal) console.log('   FATAL ' + r.fatal);
      for (const e of r.errs || []) console.log('   ERR ' + e);
      for (const e of r.nan || []) console.log('   NAN ' + e);
      for (const e of tripBad) console.log('   TRIP ' + e);
      for (const e of [...new Set(r.page || [])].slice(0, 5)) console.log('   PAGE ' + e);
    }
  }));
  console.log(`done: ${specs.length} runs, ${bad} with problems`);
  await browser.close();
})();
