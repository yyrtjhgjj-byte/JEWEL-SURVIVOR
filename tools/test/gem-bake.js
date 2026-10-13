// 宝石のアイコン（img/gems/*.webp）を js/gem-gl.js の計算で、百獣の絵（img/beasts/*.webp）を tools/beast-art.js で書き出す。
// 見た目（GEM_LOOK・シェーダー・百獣の型や材質）を変えたら実行して、できた画像もコミットする。
// 使い方：NODE_PATH=/opt/node22/lib/node_modules node tools/test/gem-bake.js [ruby,opal …（省くと全部）] [beasts（百獣だけ）]
//   例：gem-bake.js all beasts → 百獣だけ全部、gem-bake.js ruby → ルビーの宝石だけ
// 結果が端末で変わらないように、ソフトウェアの WebGL（SwiftShader）で描く
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123';
const SIZE = 320;
const BEAST_SIZE = 360;
const ROOT = path.join(__dirname, '..', '..', 'img');

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await b.newContext({ viewport: { width: 800, height: 600 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await page.goto(`${BASE}/tools/gem-bake.html?bake`);
  await page.waitForFunction(() => window.ready, null, { timeout: 120000 });
  const beastsOnly = process.argv[3] === 'beasts';
  const pick = (all) => (!process.argv[2] || process.argv[2] === 'all' ? all : process.argv[2].split(',').filter((id) => all.includes(id)));
  const jobs = [];
  if (!beastsOnly) for (const id of pick(await page.evaluate(() => window.gemIds))) jobs.push(['gems', id, 'bake', SIZE]);
  if (beastsOnly || !process.argv[2]) for (const id of pick(await page.evaluate(() => window.beastIds))) jobs.push(['beasts', id, 'bakeBeast', BEAST_SIZE]);
  for (const [dir, id, fn, size] of jobs) {
    const url = await page.evaluate(([fn, id, s]) => window[fn](id, s), [fn, id, size]);
    const buf = Buffer.from(url.split(',')[1], 'base64');
    fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
    fs.writeFileSync(path.join(ROOT, dir, `${id}.webp`), buf);
    console.log(dir, id, (buf.length / 1024).toFixed(1) + 'KB');
  }
  if (errs.length) console.log(errs.join('\n'));
  await b.close();
})();
