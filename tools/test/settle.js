// 中断・再開・精算でコインや撃破数が二重に入らないか（実際の再読み込みで確かめる）
// 使い方：node tools/test/settle.js   （途中保存・精算のまわりを変えたら回す）
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8123';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const snap = () => p.evaluate(() => { const s = JSON.parse(localStorage.getItem('jewel-survivor-save-v1')); return { coins: s.coins, runs: s.stats.runs, kills: s.stats.kills, rough: Object.values(s.rough).reduce((a, b) => a + b, 0), pending: s.pendingRun ? { coins: Math.round(s.pendingRun.coins), kills: s.pendingRun.kills, resume: !!s.pendingRun.resume, cleared: !!s.pendingRun.cleared } : null, clears: s.stats.clears, wastes: s.stages.wastes || null }; });
  // 条件が満たされるまで、開いた画面（レベルアップ・宝箱・進化・秘宝）を押して進める
  const until = async (cond, ms) => {
    const t0 = Date.now();
    for (;;) {
      if (await p.evaluate(cond)) return true;
      if (Date.now() - t0 > ms) { console.log('  (timeout) game=' + await p.evaluate(() => { const g = window.__game; return g ? `${g.state} t=${g.time.toFixed(0)}` : 'none'; })); return false; }
      await p.evaluate(() => {
        const top = document.getElementById('screens').lastElementChild;
        if (!top) return;
        const hx = document.querySelector('.help-over #hx'); if (hx) { hx.click(); return; }
        const b = [...top.querySelectorAll('.card:not(.slim), .card, .btn.primary, .btn, button')].find((x) => !x.matches('.help-btn, [data-help], #set') && !x.disabled);
        if (b && !top.classList.contains('result-screen') && !top.querySelector('#again')) b.click(); else if (!b) top.click();
      });
      await p.waitForTimeout(250);
    }
  };
  const log = (label, s) => console.log(label.padEnd(34), JSON.stringify(s));
  await p.goto(BASE + '/');
  await p.waitForFunction(() => window.__save);
  await p.evaluate(async () => { const { todayStr } = await import('/js/util.js'); const { persist } = await import('/js/save.js'); const s = window.__save; s.login = { last: todayStr(), days: 1 }; s.coins = 1000; persist(); });
  log('start', await snap());
  // 1) ランの途中で再読み込み（god で 40 秒ぶん進める）
  await p.goto(BASE + '/?auto=ruby&god&speed=8&stage=wastes&build=ruby,opal:evo');
  await until(() => window.__game && window.__game.time > 45, 150000);
  await p.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const s1 = await snap(); log('mid-run (pagehide)', s1);
  await p.goto(BASE + '/');
  await p.waitForSelector('#rs-go', { timeout: 10000 });
  log('relaunch: prompt shown', await snap());
  // 2) 再開 → すぐ再読み込み → もう一度プロンプト
  await p.click('#rs-go');
  await p.waitForFunction(() => window.__game && (window.__game.state === 'play' || window.__game.state === 'modal'));
  const resumed = await p.evaluate(() => ({ t: Math.round(window.__game.time), coins: Math.round(window.__game.coins), kills: window.__game.kills, lv: window.__game.level }));
  log('resumed game', resumed);
  await p.goto(BASE + '/');
  await p.waitForSelector('#rs-go', { timeout: 10000 });
  log('relaunch again: prompt shown', await snap());
  // 3) 精算
  await p.click('#rs-end');
  await p.waitForTimeout(800);
  const s3 = await snap(); log('settled', s3);
  await p.goto(BASE + '/');
  await p.waitForTimeout(1500);
  const again = await p.$('#rs-go');
  const s4 = await snap(); log('relaunch after settle', { prompt: !!again, ...s4 });
  console.log('CHECK settle once:', s3.coins - s1.coins === s1.pending.coins ? 'ok' : `MISMATCH +${s3.coins - s1.coins} vs pending ${s1.pending.coins}`, '| kills', s3.kills - s1.kills === s1.pending.kills ? 'ok' : 'MISMATCH', '| no second settle', s4.coins === s3.coins && !again ? 'ok' : 'MISMATCH');
  // 4) 再開して最後まで（クリア）→ 再読み込みで二重にならないか
  await p.goto(BASE + '/?auto=ruby&god&speed=8&stage=wastes&build=ruby,opal,diamond,garnet:evo&t=395');
  await until(() => window.__game && window.__game.time > 410, 150000);
  await p.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const s5 = await snap(); log('mid-run 2', s5);
  await p.goto(BASE + '/?speed=8');
  await p.waitForSelector('#rs-go', { timeout: 10000 });
  await p.click('#rs-go');
  // 再開後は god ではないので、ボスに倒されるかクリアするまで待つ
  await until(() => !!document.querySelector('#again'), 240000);
  await p.waitForTimeout(500);
  const s6 = await snap(); log('after resumed run ended', s6);
  await p.goto(BASE + '/');
  await p.waitForTimeout(1500);
  const again2 = await p.$('#rs-go');
  const s7 = await snap(); log('relaunch', { prompt: !!again2, ...s7 });
  console.log('CHECK no double after finished resume:', s7.coins === s6.coins && !again2 && !s7.pending ? 'ok' : 'MISMATCH');
  // 5) 死んでいる途中（dying）で落ちた
  await p.goto(BASE + '/?auto=ruby&speed=4&stage=void&heat=20&t=300');
  await until(() => window.__game && (window.__game.state === 'dying' || window.__game.state === 'over'), 200000);
  await p.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const s8 = await snap(); log('dying (pagehide)', s8);
  await p.goto(BASE + '/');
  await p.waitForTimeout(1500);
  const s9 = await snap(); log('relaunch', { prompt: !!(await p.$('#rs-go')), ...s9 });
  console.log('CHECK dying settle once:', s9.coins - s7.coins === (s8.pending ? s8.pending.coins : NaN) ? 'ok' : `MISMATCH +${s9.coins - s7.coins} vs ${s8.pending && s8.pending.coins}`);
  console.log(errs.length ? 'ERR ' + [...new Set(errs)].join(' | ') : 'no page errors');
  await b.close();
})();
