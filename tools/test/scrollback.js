// 戻ったときのスクロールの位置の点検：各画面を途中までスクロールして項目を押し、別の画面へ移ったら「‹」で戻って、元の位置に戻るかを見る。
// node tools/test/scrollback.js [画面の名前,…]（audit.js の SCREENS。省くと全部）
const { chromium } = require('playwright');
const { openPage, SCREENS } = require('./audit.js');
const ONLY = process.argv[2] ? process.argv[2].split(',') : null;
const SEL = 'button, .lrow, .arow, .coll-cell, .beast-cell, .stage-card, .zitem.tap, .zrow, .zstage, .mon, .jb-row, .cat-lot, .lg-card, .hub-card';
const SKIP = /^(‹|✕|×|閉じる|RESET|リセット|転生する|書き出す|読み込む|コピー|START|DEPLOY|NEXT|競りに参加|研磨|自動|×1|×10|×100)/;
const top = () => [...document.querySelectorAll('#screens > .screen:not(.dim)')].pop();

(async () => {
  const b = await chromium.launch();
  const out = [];
  const p = await openPage(b, 390, 844);
  for (const [name, js] of SCREENS) {
    if (ONLY && !ONLY.includes(name)) continue;
    const open = async () => {
      await p.evaluate(() => { document.querySelectorAll('.sht-over, .screen.dim').forEach((x) => x.remove()); });
      await p.evaluate(js);
      await p.waitForTimeout(600);
      // 途中までスクロール
      return p.evaluate(() => { const t = [...document.querySelectorAll('#screens > .screen:not(.dim)')].pop(); if (!t || t.scrollHeight - t.clientHeight < 120) return null; t.scrollTop = Math.round((t.scrollHeight - t.clientHeight) / 2); return { y: t.scrollTop, key: t.dataset.key }; });
    };
    let st;
    try { st = await open(); } catch (e) { continue; }
    if (!st) continue;
    const n = await p.evaluate((sel) => { const t = [...document.querySelectorAll('#screens > .screen:not(.dim)')].pop(); return [...t.querySelectorAll(sel)].filter((e) => e.offsetParent && !e.closest('#mnav')).length; }, SEL);
    let tested = 0;
    for (let i = 0; i < n && tested < 4; i++) {
      st = await open();
      if (!st) break;
      const r = await p.evaluate(([i, sel, skip]) => {
        const t = [...document.querySelectorAll('#screens > .screen:not(.dim)')].pop();
        const e = [...t.querySelectorAll(sel)].filter((x) => x.offsetParent && !x.closest('#mnav'))[i];
        if (!e) return null;
        const txt = (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
        if (new RegExp(skip).test(txt) || e.id === 'back' || e.matches('.iconbtn, [data-close], .tab, .chip') || e.disabled) return { skip: true };
        e.click();
        return { txt };
      }, [i, SEL, SKIP.source]);
      if (!r || r.skip) continue;
      await p.waitForTimeout(600);
      const moved = await p.evaluate((k) => { const t = [...document.querySelectorAll('#screens > .screen:not(.dim)')].pop(); return t && t.dataset.key !== k && !!t.querySelector('#back'); }, st.key);
      if (!moved) continue;
      tested++;
      await p.evaluate(() => { const t = [...document.querySelectorAll('#screens > .screen:not(.dim)')].pop(); t.querySelector('#back').click(); });
      await p.waitForTimeout(700);
      const back = await p.evaluate(() => { const t = [...document.querySelectorAll('#screens > .screen:not(.dim)')].pop(); return { key: t.dataset.key, y: t.scrollTop }; });
      const ok = back.key === st.key && Math.abs(back.y - st.y) <= 4;
      out.push([name, ok ? 'ok' : 'LOST', r.txt, `${st.y} → ${back.y}`, back.key === st.key ? '' : 'went to ' + back.key]);
    }
  }
  for (const r of out) console.log(r.join(' | '));
  console.log('checked', out.length, 'lost', out.filter((r) => r[1] === 'LOST').length);
  await b.close();
})();
