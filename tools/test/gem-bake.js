// 宝石のアイコン（img/gems/*.webp）を、js/gem-gl.js の計算で書き出す。
// 宝石の見た目（GEM_LOOK・シェーダー）を変えたら実行して、できた画像もコミットする。
// 使い方：NODE_PATH=/opt/node22/lib/node_modules node tools/test/gem-bake.js [ruby,opal …（省くと全部）]
// 結果が端末で変わらないように、ソフトウェアの WebGL（SwiftShader）で描く
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8123';
const SIZE = 320;
const OUT = path.join(__dirname, '..', '..', 'img', 'gems');

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await b.newContext({ viewport: { width: 800, height: 600 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await page.goto(`${BASE}/tools/gem-bake.html?bake`);
  await page.waitForFunction(() => window.ready, null, { timeout: 120000 });
  const ids = process.argv[2] ? process.argv[2].split(',') : await page.evaluate(() => window.gemIds);
  fs.mkdirSync(OUT, { recursive: true });
  for (const id of ids) {
    const url = await page.evaluate(([id, s]) => window.bake(id, s), [id, SIZE]);
    const buf = Buffer.from(url.split(',')[1], 'base64');
    fs.writeFileSync(path.join(OUT, `${id}.webp`), buf);
    console.log(id, (buf.length / 1024).toFixed(1) + 'KB');
  }
  if (errs.length) console.log(errs.join('\n'));
  await b.close();
})();
