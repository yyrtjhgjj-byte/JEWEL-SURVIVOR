// 経営のチュートリアルを、新しいセーブで最初から最後まで通す（光っている所を押していく）
// 使い方：node tools/test/biz-tut.js [幅x高さ=390x844]（SHOT=<フォルダ> で手順ごとのスクリーンショットを保存）
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8123';
const [W, H] = (process.argv[2] || '390x844').split('x').map(Number);
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + '/');
  await page.waitForTimeout(1500);
  for (let i = 0; i < 2; i++) { const x = await page.$('#lok'); if (x) { await x.click(); await page.waitForTimeout(600); } }
  await page.click('#nav-biz');
  await page.waitForTimeout(1200);
  const log = [];
  for (let n = 0; n < 30; n++) {
    await page.waitForTimeout(900);
    const info = await page.evaluate(() => {
      const t = document.querySelector('#bztut');
      if (!t) return null;
      const h = t.querySelector('.tut-hole'), r = h.getBoundingClientRect();
      return { text: t.querySelector('.tut-bub p').textContent, n: t.querySelector('.tut-n').textContent, none: h.classList.contains('none'), x: r.left + r.width / 2, y: r.top + r.height / 2, ok: t.querySelector('.tut-ok').style.display !== 'none' };
    });
    if (!info) break;
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/biz-tut-${info.n.split(' / ')[0].padStart(2, '0')}.png` });
    log.push(`${info.n} ${info.text}`);
    if (info.ok) { await page.click('.tut-ok'); continue; }
    if (info.none) { await page.waitForTimeout(2500); continue; }
    // 光っている枠の外を押しても進まないことも確かめる（最初の 1 回だけ）
    if (n === 0) await page.mouse.click(20, H / 2);
    await page.mouse.click(info.x, info.y);
  }
  const st = await page.evaluate(() => ({ tut: window.__save.biz.tut, earned: Math.round(window.__save.biz.earned), mines: Object.keys(window.__save.biz.mines), factories: Object.keys(window.__save.biz.factories) }));
  console.log(log.join('\n'));
  console.log(JSON.stringify(st));
  console.log(st.tut === -1 && st.earned > 0 ? 'OK' : 'NG：チュートリアルが最後まで進まなかった');
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
