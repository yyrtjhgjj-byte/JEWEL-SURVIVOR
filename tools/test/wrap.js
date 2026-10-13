// 文字の折り返しチェック：画面を一通り開き、「最後の行が 1〜2 文字だけ」になっている箇所と、
// ボタンの文字が上下（左右）に見切れている箇所を一覧にする
// 使い方：NODE_PATH=/opt/node22/lib/node_modules node tools/test/wrap.js
// 画面は iPhone SE（375×667）・13 mini（375×812）・13（390×844）・Pro Max（430×932）で確認する。
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8123';
const SIZES = (process.env.SIZES || '375x667,375x812,390x844,430x932').split(',').map((s) => s.split('x').map(Number));

// ページ内で実行：折り返しの悪い要素を探す
function findOrphans(label) {
  const out = [];
  const isBlock = (el) => {
    const d = getComputedStyle(el).display;
    return d !== 'inline' && d !== 'contents';
  };
  const blockOf = (node) => {
    let el = node.parentElement;
    while (el && !isBlock(el)) el = el.parentElement;
    return el;
  };
  // 見えている要素ごとに、配下の文字（ブロックの中にある分だけ）を集める
  const groups = new Map();
  const walker = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.data.trim()) continue;
    const b = blockOf(n);
    if (!b || !b.offsetParent || b.closest('#hud')) continue;
    if (b.closest('.ztext, .zevo, .lore, .gd-lore, .gd-fr, .gd-trivia, .gd-desc, .howto-body')) continue; // 図鑑・ジュエル選択の長い説明文は、ふつうの折り返しでよい（ユーザーの判断）
    // 傾けた帯（図鑑のボスのリボン）は、文字の位置が斜めにずれて折り返しに見えるので数えない
    if (b.closest('.mon-rib')) continue;
    if (!groups.has(b)) groups.set(b, []);
    groups.get(b).push(n);
  }
  const r = document.createRange();
  for (const [el, nodes] of groups) {
    const lines = [];
    for (const n of nodes) {
      for (let i = 0; i < n.data.length; i++) {
        const ch = n.data[i];
        if (/\s/.test(ch)) continue;
        r.setStart(n, i); r.setEnd(n, i + 1);
        const rc = r.getBoundingClientRect();
        if (!rc.width && !rc.height) continue;
        const cy = rc.top + rc.height / 2;
        let line = lines.find((l) => Math.abs(l.cy - cy) < rc.height * 0.45);
        if (!line) { line = { cy, s: '' }; lines.push(line); }
        line.s += ch;
      }
    }
    if (lines.length < 2) continue;
    lines.sort((a, b) => a.cy - b.cy);
    const last = lines[lines.length - 1].s;
    if (last.length <= 2) {
      const text = lines.map((l) => l.s).join(' / ');
      out.push(`${label} | .${[...el.classList].join('.') || el.tagName} | ${text}`);
    }
  }
  return out;
}

// ページ内で実行：ボタンの中の文字がボタンの枠からはみ出して見切れていないか
function findClipped(label) {
  const out = [];
  const r = document.createRange();
  for (const b of document.querySelectorAll('#app button, #app .btn')) {
    // 経営の地図のピンは、名前と数の印をわざと外に出している
    if (!b.offsetParent || b.closest('#hud') || b.classList.contains('bzpin')) continue;
    const br = b.getBoundingClientRect();
    if (!br.width || !br.height) continue;
    const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    let bad = '';
    for (let n = walker.nextNode(); n && !bad; n = walker.nextNode()) {
      if (!n.data.trim()) continue;
      r.selectNodeContents(n);
      for (const rc of r.getClientRects()) {
        if (!rc.width) continue;
        // 文字の上下 2px 以上、左右 1px 以上が枠の外に出ていたら見切れ
        if (rc.top < br.top - 2 || rc.bottom > br.bottom + 2 || rc.left < br.left - 1 || rc.right > br.right + 1) { bad = n.data.trim(); break; }
      }
    }
    if (bad) out.push(`${label} | CLIP button.${[...b.classList].join('.')}${b.id ? '#' + b.id : ''} h=${Math.round(br.height)} | ${bad}`);
  }
  return out;
}

async function fullSave(p) {
  await p.evaluate(async () => {
    const D = await import('/js/data.js');
    const A = await import('/js/artifacts.js');
    const S = await import('/js/stages.js');
    const all = (ids) => Object.fromEntries(ids.map((id) => [id, true]));
    const B = await import('/js/biz.js');
    const BD = await import('/js/biz-data.js');
    const sv = JSON.parse(localStorage.getItem('jewel-survivor-save-v1') || '{}');
    sv.coins = 999999;
    // 経営：全部の施設を持ち、在庫と輸送中の荷がある状態
    const now = Date.now(), st = B.newBiz(now - 6 * 3600e3);
    st.rank = 7; st.cash = 9e12;
    for (const id in BD.MINES) { B.buyMine(st, id); for (let i = 0; i < 3; i++) B.upgradeMine(st, id); }
    for (const id in BD.FACTORIES) { B.buyFactory(st, id); for (let i = 0; i < 4; i++) B.upgradeFactory(st, id); }
    B.catchUp(st, now - 3600e3);
    for (const id in st.mines) B.ship(st, id, BD.MINES[id].mix.diamond ? 'surat' : 'idar', now - 3600e3);
    B.catchUp(st, now - 600e3);
    for (const id in st.mines) B.ship(st, id, 'kofu', now - 600e3);
    B.catchUp(st, now);
    sv.biz = st;
    sv.unlocked = all(D.CHAR_IDS);
    sv.seen = { weapons: all(D.WEAPON_IDS), passives: all(D.PASSIVE_IDS), enemies: all(Object.keys(D.ENEMIES)), evos: all(D.WEAPON_IDS) };
    sv.achievements = Object.fromEntries(D.ACHIEVEMENTS.map((a) => [a.id, Date.now()]));
    sv.stages = Object.fromEntries(S.STAGES.map((s) => [s.id, { cleared: true, heat: 5, best: 600 }]));
    sv.rough = { shard: 9, rough: 9, large: 9, mystic: 9 };
    sv.dust = 999;
    sv.jewels = Object.fromEntries(Object.keys(D.GEMS).map((id) => [id, { n: 30, best: 4, ct: 5.2 }]));
    sv.login = { last: ((d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`)(new Date()), days: 1 }; // ui.js の todayStr と同じ形式
    localStorage.setItem('jewel-survivor-save-v1', JSON.stringify(sv));
  });
}

(async () => {
  const b = await chromium.launch();
  const found = new Set();
  const errs = [];
  for (const [W, H] of SIZES) {
    for (const mode of ['fresh', 'full']) {
      const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: W, height: H } });
      const p = await ctx.newPage();
      p.on('pageerror', (e) => errs.push(e.message));
      const check = async (label) => {
        await p.waitForTimeout(350);
        for (const s of await p.evaluate(findOrphans, `${W} ${mode} ${label}`)) found.add(s.replace(/^\d+ \w+ /, `[${W}x${H}] `));
        for (const s of await p.evaluate(findClipped, `${W} ${mode} ${label}`)) found.add(s.replace(/^\d+ \w+ /, `[${W}x${H}] `));
      };
      const clickAll = async (sel, label) => {
        const n = await p.$$eval(sel, (e) => e.length);
        for (let i = 0; i < n; i++) { await p.$$eval(sel, (e, i) => e[i].click(), i); await check(`${label}#${i}`); }
      };
      const back = async () => { await p.evaluate(() => document.querySelector('#back')?.click()); await p.waitForTimeout(250); };
      await p.goto(BASE + '/');
      if (mode === 'full') { await fullSave(p); await p.goto(BASE + '/'); }
      await p.waitForTimeout(1200);
      await check('login');
      await p.evaluate(() => document.querySelector('#lok')?.click());
      await check('title');
      await p.click('#t-play'); await clickAll('.char-cell', 'select');
      await p.evaluate(() => document.querySelector('.char-cell:not(.locked)')?.click());
      await p.click('#go'); await check('stage');
      if (mode === 'full') { await p.evaluate(() => document.querySelector('#artsel')?.click()); await check('art-pick'); await p.evaluate(() => document.querySelector('#anone')?.click()); }
      await back(); await back();
      // 下のメニューから各カテゴリのハブへ（menu.js）
      const nav = async (c) => { await p.click('#nav-' + c); await p.waitForTimeout(250); };
      await nav('power'); await check('hub-power');
      await p.click('#h-workshop'); await check('shop'); await back();
      if (await p.$('#h-masterworks:not(.locked)')) { await p.click('#h-masterworks'); await check('upper-shop'); await back(); }
      await nav('jewel'); await check('hub-jewel');
      await p.click('#h-polish'); await check('polish'); await back();
      await p.click('#h-auction'); await check('auction'); await clickAll('.tabs.sub button', 'auction-tab'); await back();
      await p.click('#h-beasts'); await check('beasts'); await back();
      await p.click('#h-collection'); await check('collection');
      // コレクションの詳細（閉じるボタンがパネルの中にある）
      const cells = await p.$$eval('.coll-cell', (e) => e.length);
      for (let i = 0; i < cells; i += mode === 'full' ? 1 : 7) {
        await p.$$eval('.coll-cell', (e, i) => e[i].click(), i);
        await check('gem-detail#' + i);
        await p.evaluate(() => document.querySelector('.at-over')?.remove());
      }
      await back();
      await p.click('#h-mining'); await check('gacha');
      if (await p.$('#gex')) { await p.click('#gex'); await check('exchange'); await p.evaluate(() => document.querySelector('#xok, #xd')?.click()); }
      await back();
      // 経営（地図のピンから各施設のシート）
      await nav('biz'); await check('biz');
      for (const id of ['tokyo', 'ratnapura', 'minas', 'jaipur', 'bangkok']) {
        await p.evaluate((id) => document.querySelector(`.bzpin[data-p="${id}"]`)?.click(), id);
        await check('biz-' + id);
        // 施設の種類のタブ（本社なら会社・在庫のタブも）を順に押す。押すとタブの数が変わることがある
        for (let i = 0; i < 6; i++) {
          if (!(await p.evaluate((i) => { const b = document.querySelectorAll('.bz-sheet .bs-tabs button')[i]; if (b) b.click(); return !!b; }, i))) break;
          await check(`biz-${id}-tab#${i}`);
        }
        await p.evaluate(() => document.querySelector('.bz-sheet [data-act="close"]')?.click());
      }
      await nav('archive'); await check('hub-archive');
      await p.click('#h-library'); await clickAll('.tabs button', 'zukan'); await back();
      await p.click('#h-records'); await check('records'); await back();
      await p.click('#h-jukebox'); await check('jukebox'); await back();
      await nav('more'); await check('hub-more');
      await p.click('#h-settings'); await check('settings'); await back();
      await nav('home');
      await p.click('#t-howto'); await p.evaluate(() => document.querySelectorAll('.howto').forEach((d) => (d.open = true))); await check('howto'); await back();

      // ラン中の画面
      await p.goto(BASE + '/?auto=ruby&god&build=ruby,sapphire,garnet,amber');
      await p.waitForTimeout(1500);
      const r = await p.evaluate(async () => {
        const D = await import('/js/data.js');
        const UI = await import('/js/ui.js');
        const g = window.__game;
        return { w: D.WEAPON_IDS, p: D.PASSIVE_IDS, ach: D.ACHIEVEMENTS.map((a) => a.id), ui: !!UI };
      });
      // レベルアップの全カード（新規・強化・進化）
      const chunks = [];
      for (const id of r.w) chunks.push([{ type: 'wnew', id }], [{ type: 'evo', id }]);
      for (const id of r.p) chunks.push([{ type: 'pnew', id }]);
      for (let i = 0; i < chunks.length; i += 3) {
        const cs = chunks.slice(i, i + 3).flat();
        await p.evaluate((cs) => {
          const g = window.__game;
          const org = g.rollChoices.bind(g);
          g.rollChoices = () => { g.rollChoices = org; return [...cs, { type: 'heal25' }]; };
          g.modalQueue.push({ type: 'level' });
        }, cs);
        await p.waitForTimeout(700);
        await check('level');
        await p.evaluate(() => { document.querySelector('.lvl-screen')?.remove(); window.__game.state = 'play'; });
      }
      // 進化の演出
      for (const id of r.w) {
        await p.evaluate(async (id) => { const UI = await import('/js/ui.js'); window.__game.state = 'modal'; UI.evolveScene({ id }, () => {}); }, id);
        await check('evo ' + id);
        await p.evaluate(() => document.querySelector('.evo-screen')?.remove());
      }
      // 実績の通知・バナー
      await p.evaluate(async () => {
        const D = await import('/js/data.js'); const UI = await import('/js/ui.js');
        for (const a of D.ACHIEVEMENTS) UI.toast(a.name, '+' + a.coins + ' コイン');
      });
      await check('toast');
      // ポーズとリザルト
      await p.evaluate(() => { window.__game.state = 'play'; document.querySelector('#pausebtn')?.click(); });
      await check('pause');
      await ctx.close();
    }
  }
  console.log([...found].sort().join('\n') || 'no orphans');
  console.log('ERRORS', errs.length, errs.slice(0, 5).join('\n'));
  await b.close();
})();
