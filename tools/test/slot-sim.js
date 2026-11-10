// ジュエル・スロットの還元率を数える（ブラウザ不要）
// 使い方：node tools/test/slot-sim.js [回数] [賭け金の番号 0〜2]
// 還元率はコインに直した値打ち（slot-core.js の DUST_VALUE・ROUGH_VALUE）で数える。フィーバーのただの回転とジャックポットも含める
const fs = require('fs');
const path = require('path');
(async () => {
  const src = fs.readFileSync(path.join(__dirname, '../../js/slot-core.js'), 'utf8');
  const S = await import('data:text/javascript,' + encodeURIComponent(src));
  const N = +(process.argv[2] || 2000000);
  const bet = S.SLOT_BETS[+(process.argv[3] || 0)];
  let pool = S.SLOT_JP.seed, paid = 0, back = 0, hits = 0, fevers = 0, jps = 0, big = 0, free = 0;
  const bySym = {};
  for (let n = 0; n < N; n++) {
    const isFree = free > 0;
    if (isFree) free--;
    else { paid += bet; pool += bet * S.SLOT_JP.rate; }
    const r = S.judge(S.rollGrid(), bet, pool, isFree ? S.SLOT_FEVER.mul : 1);
    if (r.jp) { pool = Math.max(S.SLOT_JP.seed, pool - r.jp); jps++; }
    if (r.fever) { free += S.SLOT_FEVER.spins; fevers++; }
    back += r.value;
    if (r.value > 0) hits++;
    if (r.value >= bet * 10) big++;
    for (const l of r.lines) bySym[l.id] = (bySym[l.id] || 0) + 1;
  }
  console.log(`賭け ${bet.toLocaleString()} × ${N.toLocaleString()} 回`);
  console.log(`還元率 ${(back / paid * 100).toFixed(1)}%　当たり ${(hits / N * 100).toFixed(1)}%　10 倍以上 1/${Math.round(N / Math.max(1, big))}　フィーバー 1/${Math.round(N / Math.max(1, fevers))}　ジャックポット 1/${Math.round(N / Math.max(1, jps))}`);
  console.log('列の当たり（回数）', bySym);
})();
