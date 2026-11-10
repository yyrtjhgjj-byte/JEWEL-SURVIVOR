// 最終ボス戦の途中で中断 → 再開しても、ボスを倒してクリアまで行けるか（HP の 3 か所で中断する。通常と ENDLESS）
// 使い方：node tools/test/boss-resume.js [void magma …]   （省くと全ステージ。ボスの段階・形態を変えたら回す）
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8123';
const only = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const stages = await (async () => { const p = await browser.newPage(); await p.goto(BASE + '/'); await p.waitForFunction(() => window.__save); const r = await p.evaluate(async () => (await import('/js/stages.js')).STAGES.map((s) => ({ id: s.id, time: s.time, boss: s.finalBoss }))); await p.close(); return r; })();
  const q = stages.filter((s) => !only.length || only.includes(s.id));
  let bad = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    for (;;) {
      const st = q.shift();
      if (!st) return;
      for (const endless of [false, true]) {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await ctx.newPage();
        const perr = [];
        page.on('pageerror', (e) => perr.push(e.message));
        await page.goto(BASE + '/');
        await page.waitForFunction(() => window.__save);
        await page.evaluate(async () => { const { todayStr } = await import('/js/util.js'); const { persist } = await import('/js/save.js'); const s = window.__save; s.login = { last: todayStr(), days: 1 }; persist(); });
        await page.goto(`${BASE}/?auto=ruby&bot&norender&god&stage=${st.id}&t=${st.time - 12}&build=ruby,opal,diamond,garnet:evo${endless ? '&endless' : ''}`);
        await page.waitForFunction(() => window.__game);
        const r = await page.evaluate(async ([boss, endless]) => {
          const log = [];
          let g = window.__game;
          g.frame = () => {};
          const errs = [];
          const step = (n) => { for (let i = 0; i < n; i++) { g = window.__game; if (!g || g.state === 'over' || window.__lastResult) return; try { g.update(1 / 60); } catch (e) { const m = String(e.stack).split('\n').slice(0, 3).join(' | '); if (!errs.includes(m)) errs.push(m); } } };
          const head = () => g.enemies.find((e) => e.alive && e.type === boss);
          // ボスが出るまで
          for (let i = 0; i < 60 * 40 && !head(); i += 30) step(30);
          if (!head()) return { fail: 'boss did not spawn', log, errs };
          const { getApp } = await import('/js/ui.js');
          const cuts = [0.72 - Math.random() * 0.1, 0.45 - Math.random() * 0.1, 0.16 - Math.random() * 0.1];
          let frames = 0, lastHp = Infinity, stall = 0;
          const trip = () => {
            const b0 = head();
            const res = JSON.parse(JSON.stringify({ ...g.results(), resume: g.snapshot() }));
            const before = { hp: b0.hp / b0.maxHp, frame: b0.sprFrame, form: b0.form ?? b0.holes ?? b0.flask, n: g.enemies.filter((e) => e.alive && e.boss).length };
            getApp().startGame(res.charId, { stageId: res.stageId, heat: 0, endless: !!res.endless, resume: res.resume });
            g = window.__game; g.frame = () => {};
            step(90);
            const b1 = head();
            log.push(`trip@${(before.hp * 100).toFixed(0)}% -> ${b1 ? (b1.hp / b1.maxHp * 100).toFixed(0) + '%' : 'NO BOSS'} form ${before.form}->${b1 ? b1.form ?? b1.holes ?? b1.flask : '-'} spr ${before.frame}->${b1 ? b1.sprFrame : '-'} bosses ${before.n}->${g.enemies.filter((e) => e.alive && e.boss).length}`);
          };
          for (;;) {
            if (window.__lastResult || !window.__game || g.state === 'over') break;
            if (g.cleared) break;
            const b = head();
            if (b) {
              const f = b.hp / b.maxHp;
              if (cuts.length && f <= cuts[0]) { cuts.shift(); trip(); continue; }
              // 1 秒に最大 HP の 6% ずつ削る（武器の分に上乗せ）。境目で止まるボスは damage が止める
              if (frames % 6 === 0) { try { g.damage(b, b.maxHp * 0.006, {}); } catch (e) { const m = 'damage: ' + String(e.stack).split('\n').slice(0, 3).join(' | '); if (!errs.includes(m)) errs.push(m); } }
              if (frames % 60 === 0) { if (b.hp >= lastHp - 1e-6) stall++; else stall = 0; lastHp = b.hp; }
            }
            step(1);
            if (++frames > 60 * 240) { log.push(`TIMEOUT boss ${b ? (b.hp / b.maxHp * 100).toFixed(1) + '% alive' : 'gone'} cleared=${g.cleared} state=${g.state} stall=${stall} asleep=${b && b.asleep} inv=${b && (b.invuln || b.iT)}`); break; }
          }
          // ENDLESS 以外はクリア画面まで
          if (!endless) for (let k = 0; k < 16 && !window.__lastResult; k++) { await new Promise((r) => setTimeout(r, 300)); step(30); }
          const lr = window.__lastResult;
          return { log, errs, cleared: endless ? g.cleared : !!(lr && lr.cleared), t: Math.round(g.time), frames, trips: 3 - cuts.length };
        }, [st.boss, endless]);
        const ok = !r.fail && r.cleared && !r.errs.length && !perr.length && r.trips === 3 && !r.log.some((l) => /NO BOSS|TIMEOUT/.test(l));
        if (!ok) bad++;
        console.log(`${ok ? 'ok' : 'NG'} ${st.id}${endless ? ':endless' : ''} boss=${st.boss} cleared=${r.cleared} t=${r.t} trips=${r.trips}${r.fail ? ' FAIL ' + r.fail : ''}`);
        for (const l of r.log || []) console.log('     ' + l);
        for (const e of r.errs || []) console.log('   ERR ' + e.slice(0, 400));
        for (const e of [...new Set(perr)]) console.log('   PAGE ' + e.slice(0, 300));
        await ctx.close();
      }
    }
  }));
  console.log(`boss resume: ${bad} problems`);
  await browser.close();
})();
