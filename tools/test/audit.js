// 画面の点検：全画面を狭い画面で開き、文字の見切れ・重なり・横へのはみ出しを拾ってスクリーンショットを残す。
// node tools/test/audit.js <出力フォルダ> [幅x高さ,…]（既定は 375x667,375x600,390x844）
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123';
const OUT = path.resolve(process.argv[2] || 'audit-out');
const SIZES = (process.argv[3] || '375x667,375x600,390x844').split(',').map((s) => s.split('x').map(Number));
if (require.main === module) fs.mkdirSync(OUT, { recursive: true });

// 遊び込んだ状態のセーブ（ほとんどの画面とハブの印が出るように）
async function richSave(p) {
  await p.evaluate(async () => {
    const { todayStr } = await import('/js/util.js');
    const D = await import('/js/data.js');
    const A = await import('/js/atelier.js');
    const { STAGES } = await import('/js/stages.js');
    const { persist } = await import('/js/save.js');
    const s = window.__save;
    s.login = { last: todayStr(), days: 12 };
    s.coins = 123456789; s.dust = 422406;
    s.rough = { shard: 40, rough: 20, large: 6, mystic: 3 };
    for (const st of STAGES) s.stages[st.id] = { cleared: true, heat: 3, best: 420 };
    s.chaosOpen = true;
    for (const id of D.CHAR_IDS) s.unlocked[id] = true;
    for (const it of D.SHOP) s.upgrades[it.id] = it.max;
    s.upperShop = true;
    for (const id of A.COLLECTION_IDS) s.jewels[id] = { n: 12, best: 3, ct: 2.4, have: 14 };
    for (const id of D.WEAPON_IDS) { s.seen.weapons[id] = true; s.seen.evos[id] = true; }
    for (const id of D.PASSIVE_IDS) s.seen.passives[id] = true;
    for (const id of Object.keys(D.ENEMIES)) s.seen.enemies[id] = true;
    D.ACHIEVEMENTS.forEach((a, i) => { if (i % 2) s.achievements[a.id] = true; });
    s.stats.runs = 80; s.stats.runCoins = 80 * 40000; s.stats.clears = 40;
    s.seen.polishTut = true;
    s.settings.lite = true;
    persist();
  });
}

// 画面の中の問題を拾う
const PROBE = () => {
  const out = [];
  const vw = innerWidth, vh = innerHeight;
  const vis = (e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && +c.opacity > 0.05; };
  const label = (e) => (e.id ? '#' + e.id : '') + '.' + [...e.classList].slice(0, 3).join('.') + ' "' + (e.textContent || '').trim().slice(0, 24) + '"';
  // 1 行で … や切り落としになっている文字（一覧の行の名前と説明は手引きで … が決まりなので除く）
  const ALLOW = '.lr-name,.lr-val,.ar-name,.ar-t,.hc-f,.sht-sub,.zrow *,.mn-jp,.chip,.lchips *';
  for (const e of document.querySelectorAll('#screens *, #toasts *, #mnav *')) {
    if (!vis(e) || !e.childNodes.length) continue;
    const hasText = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!hasText) continue;
    const c = getComputedStyle(e);
    const clipped = (c.overflow !== 'visible' || c.overflowX !== 'visible' || c.textOverflow === 'ellipsis' || c.webkitLineClamp !== 'none');
    if (clipped && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2) && !e.matches(ALLOW) && c.overflowY !== 'auto' && c.overflowY !== 'scroll' && c.overflowX !== 'auto') {
      out.push({ kind: 'cut', el: label(e), sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight });
    }
    // 画面の横からはみ出す文字（横にスクロールする入れ物の中は除く）
    const r = e.getBoundingClientRect();
    let sc = false;
    for (let a = e.parentElement; a; a = a.parentElement) { const ac = getComputedStyle(a); if (ac.overflowX === 'auto' || ac.overflowX === 'scroll') { sc = true; break; } }
    if (!sc && (r.right > vw + 1 || r.left < -1) && r.width < vw * 1.5) out.push({ kind: 'offscreen', el: label(e), l: Math.round(r.left), r: Math.round(r.right) });
  }
  // 単語の途中で行が折れている短い文字（名前・見出し・ラベル。「交換｜所」「アレキサンドライ｜ト」「422,4｜06」など）
  const cls = (c) => (/[\u30a0-\u30ff\u31f0-\u31ff]/.test(c) ? 'k' : /[\u4e00-\u9fff々]/.test(c) ? 'h' : /[A-Za-z0-9,.%+]/.test(c) ? 'a' : '');
  const walk = document.createTreeWalker(document.querySelector('#screens'), NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const t = n.data;
    // 文章（親の文字が長いもの）の折り返しは日本語のふつうの組み方なので見ない
    if (t.trim().length < 2 || t.length > 24 || !n.parentElement || !vis(n.parentElement) || n.parentElement.textContent.length > 26) continue;
    const rg = document.createRange();
    let prevTop = null;
    for (let i = 0; i < t.length; i++) {
      rg.setStart(n, i); rg.setEnd(n, i + 1);
      const rr = rg.getClientRects()[0];
      if (!rr || !rr.width) continue;
      if (prevTop !== null && rr.top > prevTop + 4) {
        const a1 = t[i - 1], b1 = t[i];
        if (cls(a1) && cls(a1) === cls(b1)) out.push({ kind: 'midbreak', el: label(n.parentElement), at: t.slice(0, i) + '|' + t.slice(i) });
        break;
      }
      prevTop = rr.top;
    }
  }
  // 上の帯の部品どうしの重なり
  for (const tb of document.querySelectorAll('#screens .topbar, #screens .hub-top, #screens .title-top')) {
    const kids = [...tb.children].filter(vis);
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
      const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 2 && oy > 2) out.push({ kind: 'overlap', el: label(kids[i]) + ' × ' + label(kids[j]) });
    }
  }
  // ホームの名前と宝石（宝石の箱は周りに透明な余白と影があるので、内側 8 割で見る）
  const w = document.querySelector('.title-hero .word b'), gm = document.querySelector('.th-gem');
  if (w && gm) {
    const a = w.getBoundingClientRect(), g0 = gm.getBoundingClientRect(), m = g0.width * 0.1;
    const b = { left: g0.left + m, right: g0.right - m, top: g0.top + m, bottom: g0.bottom - m };
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ox > 4 && oy > 4) out.push({ kind: 'overlap', el: 'home name × gem', ox: Math.round(ox), oy: Math.round(oy) });
  }
  // 決定のボタンや下のメニューに隠れて押せない最後の要素（画面の最後までスクロールしたときに見えるか）
  const scr = [...document.querySelectorAll('#screens > .screen')].pop();
  if (scr) {
    if (scr.scrollWidth > scr.clientWidth + 1) out.push({ kind: 'hscroll', el: label(scr), sw: scr.scrollWidth, cw: scr.clientWidth });
  }
  if (document.documentElement.scrollWidth > vw + 1) out.push({ kind: 'hscroll-doc', sw: document.documentElement.scrollWidth });
  return out;
};

async function openPage(b, w, h) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  await p.goto(BASE + '/');
  await p.waitForTimeout(1500);
  await richSave(p);
  await p.reload();
  await p.waitForTimeout(2200);
  await p.evaluate(() => { const t = document.getElementById('toasts'); if (t) t.style.display = 'none'; });
  return p;
}
const imp = (m, f, ...a) => `(async () => { const M = await import('/js/${m}.js'); return M.${f}(${a.map((x) => JSON.stringify(x)).join(',')}); })()`;

// 点検する画面（名前と開き方）
const SCREENS = [
  ['home-ruby', `(async()=>{window.__save.homeBag=['ruby'];return (await import('/js/ui.js')).showTitle();})()`],
  ['home-alex', `(async()=>{window.__save.homeBag=['alexandrite'];return (await import('/js/ui.js')).showTitle();})()`],
  ['home-rhodo', `(async()=>{window.__save.homeBag=['rhodochrosite'];return (await import('/js/ui.js')).showTitle();})()`],
  ['hub-power', imp('menu', 'showHub', 'power')],
  ['hub-jewel', imp('menu', 'showHub', 'jewel')],
  ['hub-archive', imp('menu', 'showHub', 'archive')],
  ['hub-more', imp('menu', 'showHub', 'more')],
  ['shop', imp('ui', 'showShop', false)],
  ['upper', imp('ui', 'showShop', true)],
  ['exchange', `(async()=>{const M=await import('/js/menu.js');M.showHub('power');document.querySelector('#h-exchange').click();})()`],
  ['polish', imp('atelier-ui', 'showAtelier', 'polish')],
  ['mining', `(async()=>{const M=await import('/js/menu.js');M.showHub('jewel');document.querySelector('#h-mining').click();})()`],
  ['auction', imp('atelier-ui', 'showAtelier', 'auction')],
  ['auction-after', `(async()=>{(await import('/js/atelier-ui.js')).showAtelier('auction');for(let i=0;i<2;i++){await new Promise(r=>setTimeout(r,300));const b=document.querySelector('#auc-pass');if(b)b.click();}})()`],
  ['collection', imp('atelier-ui', 'showAtelier', 'collection')],
  ['gemdetail', `(async()=>{(await import('/js/atelier-ui.js')).showAtelier('collection');await new Promise(r=>setTimeout(r,400));document.querySelector('.coll-cell:not(.none)').click();})()`],
  ['beasts', imp('atelier-ui', 'showAtelier', 'beasts')],
  ['slot', `(async()=>{const M=await import('/js/menu.js');M.showHub('jewel');document.querySelector('#h-slot').click();})()`],
  ['legends', `(async()=>{const M=await import('/js/menu.js');M.showHub('jewel');document.querySelector('#h-legends').click();})()`],
  ['library', `(async()=>{const M=await import('/js/menu.js');M.showHub('archive');document.querySelector('#h-library').click();})()`],
  ['records', imp('ui', 'showZukan', 'trophy')],
  ['rank', `(async()=>{const M=await import('/js/menu.js');M.showHub('archive');document.querySelector('#h-rank').click();})()`],
  ['jukebox', `(async()=>{const M=await import('/js/menu.js');M.showHub('archive');document.querySelector('#h-jukebox').click();})()`],
  ['settings', `(async()=>{const M=await import('/js/menu.js');M.showHub('more');document.querySelector('#h-settings').click();})()`],
  ['rebirth', `(async()=>{const M=await import('/js/menu.js');M.showHub('more');document.querySelector('#h-rebirth').click();})()`],
  ['biz', `(async()=>{document.querySelector('#mnav [data-c="biz"]').click();})()`],
  ['select', imp('ui', 'showCharSelect')],
  ['stage', imp('ui', 'showStageSelect')],
  ['howto', `(async()=>{(await import('/js/ui.js')).showTitle();document.querySelector('#t-howto').click();})()`],
  ['help', `(async()=>{(await import('/js/ui.js')).openHelp('@jewel');})()`],
  ['shopsheet', `(async()=>{(await import('/js/ui.js')).showShop(false);await new Promise(r=>setTimeout(r,300));document.querySelector('.lrow').click();})()`],
  ['achsheet', `(async()=>{(await import('/js/ui.js')).showZukan('trophy');await new Promise(r=>setTimeout(r,300));document.querySelector('.arow').click();})()`],
];

module.exports = { openPage, SCREENS, BASE };
if (require.main === module) (async () => {
  const b = await chromium.launch();
  const report = {};
  for (const [w, h] of SIZES) {
    const tag = `${w}x${h}`;
    const p = await openPage(b, w, h);
    for (const [name, js] of SCREENS) {
      try {
        await p.evaluate(() => { document.querySelectorAll('.sht-over, .screen.dim').forEach((x) => x.remove()); });
        await p.evaluate(js);
      } catch (e) { (report[name] = report[name] || {})[tag] = [{ kind: 'error', el: e.message.split('\n')[0] }]; continue; }
      await p.waitForTimeout(900);
      const r = await p.evaluate(PROBE);
      if (r.length) (report[name] = report[name] || {})[tag] = r;
      await p.screenshot({ path: path.join(OUT, `${tag}-${name}.png`) });
    }
    // ラン中の画面（レベルアップ・宝箱・ポーズ・リザルト）
    const q = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    q.errs = [];
    q.on('pageerror', (e) => q.errs.push(e.message));
    await q.goto(BASE + '/?auto=ruby&god&build=ruby,amber,opal');
    await q.waitForTimeout(3000);
    // 進化などの演出の画面は押して閉じてから次へ
    const tapAway = `(async()=>{for(let i=0;i<6;i++){const t=document.querySelector('#tap, .tap-hint, #chest');if(!t)break;t.click();await new Promise(r=>setTimeout(r,700));}})()`;
    const run = [
      ['run-hud', `0`],
      ['run-level', `(()=>{window.__game.modalQueue.push({type:'level'});})()`],
      ['run-chest', `(async()=>{const c=document.querySelector('.card');if(c)c.click();await new Promise(r=>setTimeout(r,900));await ${tapAway};window.__game.modalQueue.push({type:'chest'});})()`],
      ['run-chest-open', `(async()=>{const c=document.querySelector('#chest');if(c)c.click();await new Promise(r=>setTimeout(r,2500));const s=document.querySelector('.chest-screen');if(s)s.click();})()`],
      ['run-pause', `(async()=>{for(let i=0;i<8&&window.__game.state!=='play';i++){const b=[...document.querySelectorAll('.btn,button')].find(x=>/^(OK|閉じる|受け取る)$/i.test(x.textContent.trim())&&x.offsetParent);if(b)b.click();else{const o=document.querySelector('.evo-screen,.chest-screen');if(o)o.click();}await new Promise(r=>setTimeout(r,900));}document.querySelector('#pausebtn').click();})()`],
      ['run-result', `(async()=>{for(let i=0;i<2;i++){const b=[...document.querySelectorAll('button')].find(x=>/リタイア|もう一度で確定/.test(x.textContent)&&x.offsetParent);if(b)b.click();await new Promise(r=>setTimeout(r,500));}})()`],
    ];
    for (const [name, js] of run) {
      try { await q.evaluate(js); } catch (e) { (report[name] = report[name] || {})[tag] = [{ kind: 'error', el: e.message.split('\n')[0] }]; }
      await q.waitForTimeout(name === 'run-result' ? 4500 : 2600);
      const r = await q.evaluate(PROBE);
      if (r.length) (report[name] = report[name] || {})[tag] = r;
      await q.screenshot({ path: path.join(OUT, `${tag}-${name}.png`) });
    }
    if (p.errs.length || q.errs.length) report['_errors_' + tag] = [...p.errs, ...q.errs].slice(0, 10);
    await p.close();
    await q.close();
  }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  for (const [k, v] of Object.entries(report)) console.log(k, JSON.stringify(v).slice(0, 600));
  console.log('screens', SCREENS.length + 4, 'sizes', SIZES.length);
  await b.close();
})();
