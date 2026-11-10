// 古いセーブの再現：育ったセーブから項目を 1 つずつ欠けさせて読み込み（移行も通す）、全画面を開いて短いランまで通す
// 使い方：node tools/test/fuzz-save.js   （セーブに項目を足したら回す。経営の内部の項目は migrateBiz が見るので欠けさせない）
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8123';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const perr = [];
  page.on('pageerror', (e) => perr.push(e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).join(' | ').replace(/http:\/\/localhost:8123/g, '')));
  page.on('console', (m) => { if (m.type() === 'error' && !/WebGL|swiftshader|GPU stall|Failed to load resource/i.test(m.text())) perr.push('console.error: ' + m.text().replace(/http:\/\/localhost:8123/g, '').slice(0, 300)); });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.goto(BASE + '/');
  await page.waitForFunction(() => window.__save);
  // 育ったセーブを作る
  const base = await page.evaluate(async () => {
    const { todayStr } = await import('/js/util.js');
    const D = await import('/js/data.js');
    const A = await import('/js/atelier.js');
    const { STAGES } = await import('/js/stages.js');
    const { persist } = await import('/js/save.js');
    const UI = await import('/js/ui.js');
    const s = window.__save;
    s.login = { last: todayStr(), days: 9 };
    s.coins = 5e8; s.totalCoins = 6e8; s.dust = 300000;
    s.rough = { shard: 200, rough: 200, large: 100, mystic: 60 };
    for (const st of STAGES) s.stages[st.id] = { cleared: true, heat: 6, best: 420 };
    s.chaosOpen = true; s.chaosRec = { wastes: { cleared: true, best: 420 } };
    s.bossRush = { wastes: 7, finale1: 3 };
    for (const id of D.CHAR_IDS) { s.unlocked[id] = true; s.awaken[id] = 2; }
    for (const it of D.SHOP) s.upgrades[it.id] = it.max;
    s.upgrades2 = {}; for (const it of D.UPPER_SHOP) s.upgrades2[it.id] = it.max;
    s.upperShop = true;
    s.shopPaid = { front: 100000, upper: 5000000 };
    for (const id of (A.COLLECTION_IDS || Object.keys(D.GEMS))) s.jewels[id] = { n: 40, best: 4, ct: 6.1, have: 40 };
    s.beasts = { ruby: 2, sapphire: 1 };
    for (const a of D.ACHIEVEMENTS.slice(0, 40)) s.achievements[a.id] = true;
    for (const id of D.WEAPON_IDS) { s.seen.weapons[id] = true; s.seen.evos[id] = true; }
    for (const id of D.PASSIVE_IDS) s.seen.passives[id] = true;
    for (const id of Object.keys(D.ENEMIES)) { s.seen.enemies[id] = true; s.kills[id] = 50; }
    s.stats = { runs: 80, kills: 200000, clears: 60, gacha: 300, polished: 500, polishSS: 12, runCoins: 4000000 };
    s.best = { time: 900, kills: 5000, level: 60, damage: 9e8, coins: 80000 };
    s.rank = { lv: 20, xp: 100 };
    s.artSel = 'grail'; s.endless = true; s.hyper = true; s.chaos = true; s.heatSels = { wastes: 3 };
    s.trainCfg = { target: 'dummy', stage: 3, crowdHp: 1500, low: false, chaos: true, w: [{ id: 'ruby', lv: 8, evo: true, lb: 3 }], p: [{ id: 'topaz', lv: 5, lb: 1 }] };
    s.rushLoadout = { w: ['ruby', 'opal'], p: ['topaz'] };
    persist();
    // いくつかの画面を一度開いて、その画面が作るデータ（経営・オークション・スロット・伝説）を入れる
    (await import('/js/biz-ui.js')).showBiz();
    if (s.biz) s.biz.tut = -1;
    (await import('/js/slot.js')).showSlot(() => {});
    (await import('/js/legends.js')).openLegend('kohinoor', () => {});
    (await import('/js/atelier-ui.js')).showAtelier('auction');
    UI.showStageSelect(); UI.showZukan('enemies', 2); (await import('/js/jukebox.js')).showJukebox();
    UI.showTitle();
    persist();
    return JSON.parse(JSON.stringify(s));
  });
  // 欠けさせ方
  const muts = [['(そのまま)', (s) => s]];
  const homog = new Set(['jewels', 'stages', 'unlocked', 'kills', 'achievements', 'upgrades', 'upgrades2', 'awaken', 'heatSels', 'chaosRec', 'bossRush', 'beasts']);
  for (const k of Object.keys(base)) {
    muts.push([`-${k}`, (s) => { delete s[k]; return s; }]);
    const v = base[k];
    if (k === 'biz') continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const subs = homog.has(k) ? Object.keys(v).slice(0, 1) : Object.keys(v);
      for (const k2 of subs) {
        muts.push([`-${k}.${k2}`, (s) => { delete s[k][k2]; return s; }]);
        const v2 = v[k2];
        if (v2 && typeof v2 === 'object' && !Array.isArray(v2) && k !== 'biz') for (const k3 of Object.keys(v2).slice(0, 8)) muts.push([`-${k}.${k2}.${k3}`, (s) => { delete s[k][k2][k3]; return s; }]);
      }
      muts.push([`${k}={}`, (s) => { s[k] = {}; return s; }]);
    }
  }
  console.log(`base save ${JSON.stringify(base).length} bytes, ${muts.length} mutations`);
  const found = new Map();
  let n = 0;
  for (const [name, fn] of muts) {
    const data = fn(JSON.parse(JSON.stringify(base)));
    perr.length = 0;
    let res;
    try {
      res = await page.evaluate(async (data) => {
        const errs = [];
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const S = await import('/js/save.js');
        const UI = await import('/js/ui.js');
        const M = await import('/js/menu.js');
        const AT = await import('/js/atelier-ui.js');
        const app = UI.getApp();
        const visit = async (label, f) => { try { await f(); await sleep(8); } catch (e) { errs.push(label + ': ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ').replace(/http:\/\/localhost:8123/g, '')); } };
        await visit('import', () => { S.replaceSave(data); app.migrateSave(); });
        const s = window.__save;
        await visit('title', () => UI.showTitle());
        await visit('char', () => UI.showCharSelect());
        for (const tab of [null, 'boss', 'train']) await visit('stage:' + tab, () => { s.stageTab = tab; UI.showStageSelect(); });
        await visit('shop', () => UI.showShop(false));
        await visit('shop2', () => UI.showShop(true));
        await visit('gacha', () => UI.showGacha());
        await visit('exchange', () => UI.showExchange(() => {}));
        for (const t of ['gems', 'charms', 'enemies', 'arts', 'stages', 'trophy']) await visit('zukan:' + t, () => UI.showZukan(t));
        await visit('rank', () => UI.showRank());
        await visit('settings', () => UI.showSettings(() => {}));
        for (const c of ['power', 'jewel', 'archive', 'more']) await visit('hub:' + c, () => M.showHub(c));
        for (const t of ['polish', 'auction', 'collection', 'beasts']) await visit('atelier:' + t, () => AT.showAtelier(t));
        await visit('biz', async () => (await import('/js/biz-ui.js')).showBiz());
        await visit('rebirth', async () => (await import('/js/rebirth.js')).showRebirth(() => {}));
        await visit('slot', async () => (await import('/js/slot.js')).showSlot(() => {}));
        await visit('jukebox', async () => (await import('/js/jukebox.js')).showJukebox());
        await visit('legends', async () => (await import('/js/legends.js')).showLegends(() => {}));
        await visit('legend', async () => (await import('/js/legends.js')).openLegend('hope', () => {}));
        await visit('spec', async () => { const G = await import('/js/gem-spec.js'); G.openSpec('weapon', 'ruby'); G.openSpec('charm', 'topaz'); });
        await visit('help', () => UI.openHelp('stages'));
        await visit('run', async () => {
          app.startGame(s.selected || 'ruby', { stageId: s.selectedStage || 'wastes', heat: 2, chaos: true, artifact: s.artSel || null });
          const g = window.__game;
          g.frame = () => {};
          for (let i = 0; i < 240; i++) g.update(1 / 60);
          g.render && g.render();
          g.state = 'over';
          g.hooks.gameOver(g.results(), false);
          await sleep(60);
          app.toTitle();
        });
        await visit('train', async () => {
          app.startGame(s.selected || 'ruby', { stageId: 'wastes', train: { target: 'dummy', stage: 1, w: [{ id: 'ruby', lv: 8, evo: true, lb: 2 }], p: [{ id: 'topaz', lv: 5, lb: 1 }] } });
          const g = window.__game;
          g.frame = () => {};
          for (let i = 0; i < 120; i++) g.update(1 / 60);
          g.state = 'over';
          app.toTitle();
        });
        const bad = [];
        const scan = (v, p, d) => { if (typeof v === 'number') { if (!Number.isFinite(v)) bad.push(p + '=' + v); } else if (v && typeof v === 'object' && d < 6) for (const k in v) scan(v[k], p + '.' + k, d + 1); };
        scan(s, 'save', 0);
        return { errs, bad: bad.slice(0, 6) };
      }, data);
    } catch (e) { res = { errs: ['EVAL ' + String(e.message).split('\n')[0]], bad: [] }; }
    await page.waitForTimeout(80);
    const all = [...res.errs, ...res.bad.map((b) => 'NaN ' + b), ...perr.map((p) => 'async ' + p)];
    for (const e of all) { const key = e.replace(/\d{3,}/g, '#').slice(0, 300); if (!found.has(key)) found.set(key, []); found.get(key).push(name); }
    if (++n % 25 === 0) console.log(`  ${n}/${muts.length} … ${found.size} kinds so far`);
  }
  for (const [k, names] of found) console.log(`x${names.length} ${k}\n     when: ${names.slice(0, 8).join(', ')}`);
  console.log(`save fuzz: ${muts.length} mutations, ${found.size} kinds of problems`);
  await browser.close();
})();
