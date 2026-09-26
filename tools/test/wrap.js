// 文字の折り返しチェック：画面を一通り開き、「最後の行が 1〜2 文字だけ」になっている箇所を一覧にする
// 使い方：NODE_PATH=/opt/node22/lib/node_modules node tools/test/wrap.js
// 画面幅は iPhone SE（375）・13（390）・Pro Max（430）の 3 通りで確認する。
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8123';
const WIDTHS = (process.env.WIDTHS || '375,390,430').split(',').map(Number);

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
    if (b.closest('.ztext, .zevo, .lore')) continue; // 図鑑・ジュエル選択の長い説明文は、ふつうの折り返しでよい（ユーザーの判断）
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

async function fullSave(p) {
  await p.evaluate(async () => {
    const D = await import('/js/data.js');
    const A = await import('/js/artifacts.js');
    const S = await import('/js/stages.js');
    const all = (ids) => Object.fromEntries(ids.map((id) => [id, true]));
    const sv = JSON.parse(localStorage.getItem('jewel-survivor-save-v1') || '{}');
    sv.coins = 999999;
    sv.unlocked = all(D.CHAR_IDS);
    sv.seen = { weapons: all(D.WEAPON_IDS), passives: all(D.PASSIVE_IDS), enemies: all(Object.keys(D.ENEMIES)), evos: all(D.WEAPON_IDS) };
    sv.achievements = Object.fromEntries(D.ACHIEVEMENTS.map((a) => [a.id, Date.now()]));
    sv.stages = Object.fromEntries(S.STAGES.map((s) => [s.id, { cleared: true, heat: 5, best: 600 }]));
    sv.rough = { shard: 9, rough: 9, large: 9, mystic: 9 };
    sv.dust = 999;
    sv.jewels = Object.fromEntries(Object.keys(D.GEMS).map((id) => [id, { n: 30, best: 4, ct: 5.2 }]));
    sv.login = { last: new Date().toISOString().slice(0, 10), streak: 1 };
    localStorage.setItem('jewel-survivor-save-v1', JSON.stringify(sv));
  });
}

(async () => {
  const b = await chromium.launch();
  const found = new Set();
  const errs = [];
  for (const W of WIDTHS) {
    for (const mode of ['fresh', 'full']) {
      const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: W, height: Math.round(W * 2.16) } });
      const p = await ctx.newPage();
      p.on('pageerror', (e) => errs.push(e.message));
      const check = async (label) => {
        await p.waitForTimeout(350);
        for (const s of await p.evaluate(findOrphans, `${W} ${mode} ${label}`)) found.add(s.replace(/^\d+ \w+ /, `[${W}] `));
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
      await p.click('#t-shop'); await check('shop'); await back();
      await p.click('#t-atelier'); await check('atelier');
      await clickAll('.seg button, .tabs button', 'atelier-tab'); await back();
      await p.click('#t-gacha'); await check('gacha');
      if (await p.$('#gex')) { await p.click('#gex'); await check('exchange'); await p.evaluate(() => document.querySelector('#xok, #xd')?.click()); }
      await back();
      await p.click('#t-zukan'); await clickAll('.tabs button, .seg button', 'zukan'); await back();
      await p.click('#t-set'); await check('settings'); await back();

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
