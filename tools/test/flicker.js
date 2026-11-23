// 押したときの描き直しの点検：各画面で押せるものを 1 つずつ押し、画面ごと作り直したもの・中の絵（img・canvas）を作り直したものを拾う。
// 作り直すと iPhone では一瞬消えてチラつく。中身だけ描き直すか、変わったところだけ書き換える。
// node tools/test/flicker.js [画面の名前,…]（audit.js の SCREENS。省くと全部）
const { chromium } = require('playwright');
const { openPage, SCREENS } = require('./audit.js');
const ONLY = process.argv[2] ? process.argv[2].split(',') : null;
// 押さないもの：戻る・閉じる・下のメニュー・データを消す・転生・外へ出るもの
const SKIP = /^(‹|✕|×|閉じる|RESET|リセット|転生する|書き出す|読み込む|コピー|START|DEPLOY|NEXT)$/;

// 押す前の様子：一番上の画面、その中の絵
const SNAP = () => {
  const top = [...document.querySelectorAll('#screens > *')].pop();
  window.__flk = { top, cls: top && top.className, imgs: new Set(top ? top.querySelectorAll('img, canvas') : []) };
};
// 押した後の様子
const DIFF = () => {
  const f = window.__flk;
  const top = [...document.querySelectorAll('#screens > *')].pop();
  const same = top === f.top;
  const rebuilt = !f.top.isConnected && top && top.className === f.cls;
  let gone = 0, total = f.imgs.size;
  for (const i of f.imgs) if (!i.isConnected) gone++;
  return { same, rebuilt, anim: rebuilt && !top.classList.contains('redraw'), gone, total, opened: !same && f.top.isConnected, cls: top && top.className };
};

(async () => {
  const b = await chromium.launch();
  const out = [];
  const p = await openPage(b, 390, 844);
  for (const [name, js] of SCREENS) {
    if (ONLY && !ONLY.includes(name)) continue;
    // 押せるものの一覧（画面を開き直すたびに同じ順で取る）
    const open = async () => {
      await p.evaluate(() => { document.querySelectorAll('.sht-over, .screen.dim').forEach((x) => x.remove()); });
      await p.evaluate(js);
      await p.waitForTimeout(700);
    };
    try { await open(); } catch (e) { out.push([name, 'open-error', e.message.split('\n')[0]]); continue; }
    const n = await p.evaluate(() => {
      const top = [...document.querySelectorAll('#screens > *')].pop();
      window.__flkList = [...top.querySelectorAll('button, .chip, .tab, .lrow, .arow, [data-tab], .coll-cell, .beast-cell, .stage-card, .zitem.tap, .zrow, .zstage, .mon, .jb-row, .cat-lot, .lg-card, .seat, .hub-card, label, input[type=range]')]
        .filter((e) => e.offsetParent && !e.closest('#mnav'));
      return window.__flkList.length;
    });
    for (let i = 0; i < Math.min(n, 40); i++) {
      const info = await p.evaluate(([i, skip]) => {
        const top = [...document.querySelectorAll('#screens > *')].pop();
        const list = [...top.querySelectorAll('button, .chip, .tab, .lrow, .arow, [data-tab], .coll-cell, .beast-cell, .stage-card, .zitem.tap, .zrow, .zstage, .mon, .jb-row, .cat-lot, .lg-card, .seat, .hub-card, label, input[type=range]')].filter((e) => e.offsetParent && !e.closest('#mnav'));
        const e = list[i];
        if (!e) return null;
        const t = (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
        if (new RegExp(skip).test(t) || e.id === 'back' || e.matches('[data-close], .sht-x, .iconbtn, #lok') || e.disabled) return { skip: t };
        return { t, cls: e.className.toString().slice(0, 40) };
      }, [i, SKIP.source]);
      if (!info || info.skip !== undefined) continue;
      await p.evaluate(SNAP);
      await p.evaluate((i) => {
        const top = [...document.querySelectorAll('#screens > *')].pop();
        const list = [...top.querySelectorAll('button, .chip, .tab, .lrow, .arow, [data-tab], .coll-cell, .beast-cell, .stage-card, .zitem.tap, .zrow, .zstage, .mon, .jb-row, .cat-lot, .lg-card, .seat, .hub-card, label, input[type=range]')].filter((e) => e.offsetParent && !e.closest('#mnav'));
        list[i].click();
      }, i);
      await p.waitForTimeout(450);
      const d = await p.evaluate(DIFF);
      if (d.rebuilt) out.push([name, d.anim ? 'REBUILD+FADE' : 'rebuild', info.t, info.cls]);
      else if (d.same && d.gone) out.push([name, `imgs ${d.gone}/${d.total}`, info.t, info.cls]);
      // 開いたものは閉じ、別の画面へ移ったら開き直す
      if (!d.same) await open();
    }
  }
  for (const r of out) console.log(r.join(' | '));
  console.log('found', out.length);
  await b.close();
})();
