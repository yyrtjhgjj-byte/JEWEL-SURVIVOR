// 画面のでたらめ操作：見えていて押せるものを片っ端から押し、例外・セーブの壊れ（NaN・負の数）・固まった画面・
// ゲームと画面の食い違い（画面待ちなのに画面が無い、など）を拾う。ときどき再読み込みと裏に回す操作もはさむ
// 使い方：STEPS=1500 PAGES=2 SEED=1 MODE=rich node tools/test/fuzz-ui.js
//   MODE：new（新規のセーブ）・rich（育ったセーブ。工房は最大の 1 つ手前）・full（工房も上位工房も最大）・
//         play（ランの中を重点的に。でたらめな条件でランを始める）・wild（データ削除や転生も押す）。POOR=1 でコインとダストを少なく
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8123';
const STEPS = +(process.env.STEPS || 1500), PAGES = +(process.env.PAGES || 2), SEED0 = +(process.env.SEED || 1);
const MODE = process.env.MODE || 'rich'; // rich：育ったセーブ ／ new：新規 ／ wild：消去や転生も押す
const STAGE_IDS = ['wastes', 'cavern', 'magma', 'tundra', 'void', 'deep', 'rlyeh', 'lake', 'carcosa', 'space', 'azathoth', 'yushu', 'uzan', 'sanki', 'chuou', 'calcinatio', 'solutio', 'separatio', 'coniunctio', 'fermentatio', 'distillatio', 'coagulatio'];
const CHARS = ['ruby', 'sapphire', 'garnet', 'opal', 'amethyst', 'emerald', 'pectolite', 'obsidian', 'moonstone', 'tourmaline'];
const BLOCK = MODE === 'wild' ? /^$/ : /データを削除|データ削除|すべて消|転生する|合流する|前世と/;

async function setup(page, mode) {
  await page.goto(BASE + '/?speed=3');
  await page.waitForFunction(() => window.__save);
  if (mode === 'new') return;
  // rich：工房は最大の 1 つ手前（上位工房は閉じたまま）／full・wild：工房は最大、上位工房も開いている
  await page.evaluate(async ([process_env_full, poor]) => {
    const { todayStr } = await import('/js/util.js');
    const D = await import('/js/data.js');
    const A = await import('/js/atelier.js');
    const { STAGES } = await import('/js/stages.js');
    const { persist } = await import('/js/save.js');
    const s = window.__save;
    s.login = { last: todayStr(), days: 3 };
    s.coins = poor ? 30000 : 3e8; s.totalCoins = 3e8; s.dust = poor ? 250 : 400000;
    s.rough = { shard: 300, rough: 300, large: 200, mystic: 120 };
    for (const st of STAGES) s.stages[st.id] = { cleared: true, heat: 4, best: 420 };
    s.chaosOpen = true;
    for (const id of D.CHAR_IDS) s.unlocked[id] = true;
    for (const it of D.SHOP) s.upgrades[it.id] = process_env_full ? it.max : Math.max(0, it.max - 1);
    if (process_env_full) { s.upgrades2 = {}; for (const it of D.UPPER_SHOP) s.upgrades2[it.id] = it.max; s.upperShop = true; }
    for (const id of (A.COLLECTION_IDS || Object.keys(D.GEMS))) s.jewels[id] = { n: 25, best: 3, ct: 4.2, have: 25 };
    s.stats.runs = 50; s.stats.runCoins = 150000; s.stats.kills = 90000; s.stats.clears = 30;
    persist();
  }, [MODE !== 'rich', !!process.env.POOR]);
  await page.reload();
  await page.waitForFunction(() => window.__save);
}

async function monkey(browser, idx) {
  const seed = SEED0 + idx;
  let r = (seed * 2654435761) % 4294967296;
  const rnd = () => (r = (r * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const hist = [];
  const problems = new Map();
  const add = (k, extra = '') => { const key = k.slice(0, 260); if (!problems.has(key)) problems.set(key, { n: 0, at: hist.slice(-10).join(' > '), extra }); problems.get(key).n++; };
  page.on('pageerror', (e) => add('pageerror: ' + e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).join(' | ').replace(/http:\/\/localhost:8123/g, '')));
  page.on('console', (m) => { if (m.type() === 'error' && !/WebGL|swiftshader|GPU stall|Failed to load resource|favicon|navigator\.vibrate/i.test(m.text())) add('console.error: ' + m.text().replace(/http:\/\/localhost:8123/g, '').slice(0, 400)); });
  page.on('dialog', (d) => { hist.push(`dialog(${d.type()}:${d.message().slice(0, 20)})`); (rnd() < 0.6 ? d.accept(d.type() === 'prompt' ? '' : undefined) : d.dismiss()).catch(() => {}); });
  page.on('filechooser', () => {});
  await setup(page, MODE);
  let stuck = 0, reloads = 0, idle = 99, lastDesync = '', desyncN = 0;
  const cov = new Map();
  for (let i = 0; i < STEPS; i++) {
    const x = rnd();
    try {
      if (x < 0.008) {
        hist.push('RELOAD');
        reloads++;
        await page.reload();
        await page.waitForFunction(() => window.__save, null, { timeout: 15000 });
        await page.waitForTimeout(400);
        continue;
      }
      if (x < 0.02) {
        hist.push('HIDE/SHOW');
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
        await page.waitForTimeout(150);
        await page.evaluate(() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
        continue;
      }
      if (MODE === 'play') {
        const inGame = await page.evaluate(() => !!window.__game);
        idle = inGame ? 0 : idle + 1;
        if (idle > 12) {
          idle = 0;
          const st = STAGE_IDS[Math.floor(rnd() * STAGE_IDS.length)], ch = CHARS[Math.floor(rnd() * CHARS.length)];
          const q = `auto=${ch}&speed=${rnd() < 0.5 ? 6 : 3}&stage=${st}&heat=${Math.floor(rnd() * 21)}${rnd() < 0.4 ? '&chaos' : ''}${rnd() < 0.5 ? '&god' : ''}${rnd() < 0.3 ? '&hyper' : ''}${rnd() < 0.3 ? '&hurry' : ''}${rnd() < 0.3 ? '&endless' : ''}${rnd() < 0.4 ? '&t=' + (100 + Math.floor(rnd() * 300)) : ''}${rnd() < 0.3 ? '&build=' + ch + ',opal,diamond:evo' : ''}${rnd() < 0.15 ? '&rush=' + ch + ',opal/topaz,jasper/0' : ''}`;
          hist.push('GOTO ?' + q);
          await page.goto(`${BASE}/?${q}`);
          await page.waitForFunction(() => window.__save, null, { timeout: 15000 });
          await page.waitForTimeout(500);
          continue;
        }
        // スティックを動かす
        if (inGame && rnd() < 0.25) { await page.mouse.move(195, 600); await page.mouse.down(); await page.mouse.move(195 + (rnd() - 0.5) * 160, 600 + (rnd() - 0.5) * 160, { steps: 3 }); await page.waitForTimeout(200 + rnd() * 600); await page.mouse.up(); hist.push('MOVE'); continue; }
        if (inGame && rnd() < 0.35) { await page.waitForTimeout(250); continue; }
      }
      const info = await page.evaluate(([pickR, block]) => {
        const BL = new RegExp(block);
        const vis = (el) => { const b = el.getBoundingClientRect(); return b.width > 4 && b.height > 4 && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth; };
        const all = [...document.querySelectorAll('button, input, select, .tab, .tap, [data-id], [data-k], [data-c], [data-help], a')].concat([...document.querySelectorAll('#screens *, #nav *')].filter((e) => typeof e.onclick === 'function'));
        const uniq = [...new Set(all)].filter((el) => !el.disabled && el.type !== 'file');
        // 画面の外のものも、ときどきスクロールして押す
        let cands = uniq.filter(vis);
        if (pickR[0] < 0.25) { const off = uniq.filter((el) => !vis(el) && el.getBoundingClientRect().width > 4); if (off.length) { const el = off[Math.floor(pickR[1] * off.length)]; el.scrollIntoView({ block: 'center' }); cands = [el]; } }
        const ok = cands.map((el) => { const b = el.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2; const top = document.elementFromPoint(cx, cy); return top && (top === el || el.contains(top) || top.contains(el) && top.onclick === el.onclick) ? { el, cx, cy } : null; }).filter(Boolean)
          .filter((c) => !(pickR[3] < 0.85 && (c.el.matches('[data-help], .help-btn') || c.el.closest('.help-over'))) || !document.querySelector('.help-over') === false).filter((c) => !BL.test(c.el.textContent || '') && !(block !== '^$' && /^(reset|rb-)/.test(c.el.id || '')));
        const g = window.__game;
        const state = { n: ok.length, game: g ? g.state : '', screen: (() => { const t = document.getElementById('screens').lastElementChild; return t ? t.className : ''; })() };
        if (!ok.length) return state;
        const c = ok[Math.floor(pickR[2] * ok.length)];
        const el = c.el;
        if (el.tagName === 'INPUT' && el.type === 'range') { el.value = +el.min + (+el.max - +el.min) * pickR[3]; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return { ...state, did: 'range#' + el.id }; }
        if (el.tagName === 'SELECT') { el.selectedIndex = Math.floor(pickR[3] * el.options.length); el.dispatchEvent(new Event('change', { bubbles: true })); return { ...state, did: 'select#' + el.id }; }
        const label = (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') + ':' + (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 14);
        return { ...state, did: label, cx: c.cx, cy: c.cy };
      }, [[rnd(), rnd(), rnd(), rnd()], BLOCK.source]);
      { const key = (info.screen || '-').replace(/\b(screen|dim|has-nav)\b/g, '').trim().split(/\s+/).slice(0, 2).join('.') + (info.game ? '[' + info.game + ']' : ''); cov.set(key, (cov.get(key) || 0) + 1); }
      if (!info.n) {
        // 押せるものがない：演出の途中かもしれないので、画面を押して待つ
        stuck++;
        await page.mouse.click(60 + rnd() * 270, 200 + rnd() * 400);
        await page.waitForTimeout(350);
        if (stuck >= 40) {
          const shot = `stuck-${seed}-${i}.png`;
          await page.screenshot({ path: shot });
          add(`STUCK screen="${info.screen}" game=${info.game}`, shot);
          stuck = 0;
          hist.push('RELOAD(stuck)');
          await page.reload();
          await page.waitForFunction(() => window.__save, null, { timeout: 15000 });
        }
        continue;
      }
      stuck = 0;
      hist.push(`${info.did}${info.game ? '[' + info.game + ']' : ''}`);
      if (info.cx !== undefined) {
        if (rnd() < 0.12) { await page.mouse.click(info.cx, info.cy); await page.mouse.click(info.cx, info.cy); } else await page.mouse.click(info.cx, info.cy);
      }
      await page.waitForTimeout(rnd() < 0.2 ? 400 : 90);
      {
        // 食い違い：ゲームは画面待ち（modal）なのに画面が無い／ゲームは動いているのにレベルアップや宝箱の画面が残っている
        const d = await page.evaluate(() => {
          const g = window.__game; if (!g) return '';
          const kids = [...document.getElementById('screens').children].map((x) => x.className);
          const hasModalUi = kids.some((c) => /lvl-screen|chest-screen|art-|evo|rush-warp|reveal/.test(c));
          if (g.state === 'modal' && !kids.length) return 'modal-without-screen cur=' + (g.curModal ? g.curModal.type : '-');
          if (g.state === 'play' && hasModalUi) return 'play-with-modal-screen ' + kids.join('|');
          if (g.state === 'paused' && !kids.length) return 'paused-without-menu';
          if (g.state === 'over' && !kids.length) return 'over-without-screen';
          return '';
        });
        if (d && d === lastDesync) { if (++desyncN === 25) { const shot = `desync-${seed}-${i}.png`; await page.screenshot({ path: shot }); add('DESYNC ' + d, shot); } } else { lastDesync = d; desyncN = 0; }
      }
      if (i % 5 === 0) {
        const bad = await page.evaluate(() => {
          const out = [];
          const s = window.__save;
          const scan = (v, p, d) => { if (typeof v === 'number') { if (!Number.isFinite(v)) out.push(p + '=' + v); } else if (v && typeof v === 'object' && d < 7) for (const k in v) scan(v[k], p + '.' + k, d + 1); };
          scan(s, 'save', 0);
          if (s.coins < 0) out.push('coins<0 ' + s.coins);
          if (s.dust < 0) out.push('dust<0 ' + s.dust);
          for (const k in s.rough) if (s.rough[k] < 0 || !Number.isInteger(s.rough[k])) out.push(`rough.${k}=${s.rough[k]}`);
          for (const k in s.jewels) { const j = s.jewels[k]; if (j && (j.have < 0 || j.n < 0)) out.push(`jewels.${k} have=${j.have} n=${j.n}`); }
          for (const k in s.pickRough || {}) if (s.pickRough[k] < 0) out.push('pickRough<0');
          for (const k in s.upgrades) if (s.upgrades[k] < 0) out.push('upgrades<0 ' + k);
          if (s.biz && s.biz.cash < -1e-6) out.push('biz.cash<0');
          const len = JSON.stringify(s).length;
          if (len > 1500000) out.push('save size ' + len);
          return out;
        });
        for (const b of bad) add('SAVE ' + b.replace(/=.*/, '') + ' ' + b.slice(0, 80));
      }
    } catch (e) {
      const msg = String(e.message).split('\n')[0];
      if (/Target closed|crashed/.test(msg)) { add('PAGE CRASH ' + msg); break; }
      if (!/Execution context was destroyed|navigation/.test(msg)) add('harness: ' + msg.slice(0, 160));
      await page.waitForTimeout(300);
    }
  }
  const size = await page.evaluate(() => JSON.stringify(window.__save).length).catch(() => -1);
  await ctx.close();
  return { seed, problems, reloads, size, cov };
}

(async () => {
  const browser = await chromium.launch();
  const rs = await Promise.all(Array.from({ length: PAGES }, (_, i) => monkey(browser, i)));
  for (const r of rs) {
    console.log(`--- seed ${r.seed} mode ${MODE}: ${r.problems.size} kinds, reloads ${r.reloads}, save ${r.size} bytes`);
    console.log('  screens: ' + [...r.cov].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join(' '));
    for (const [k, v] of r.problems) console.log(`  x${v.n} ${k}\n      at: ${v.at}${v.extra ? '\n      ' + v.extra : ''}`);
  }
  await browser.close();
})();
