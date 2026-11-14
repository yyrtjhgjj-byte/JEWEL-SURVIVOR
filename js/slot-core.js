// =====================================================================
//  ジュエル・スロットの中身（抽選と払い戻しの計算）。画面は slot.js。
//  Node の tools/test/slot-sim.js からも動かす（ここでは何も import しない）
// =====================================================================

// 1 回の賭け金
export const SLOT_BETS = [10000, 100000, 1000000];
// 絵柄：w は出やすさ。pay は同じ絵柄が 1 列に 3 つ並んだときの払い戻し（賭け金の何倍ぶんか）。
// coins はコイン、dust はジェムダスト、rough は原石（その等級で何倍ぶんの数）。star はどこでも 3 つでフィーバー、jp は 1 列に 3 つでジャックポット
export const SLOT_SYMS = [
  { id: 'shard', w: 36, pay: { coins: 1.5 } },
  { id: 'ruby', w: 22, pay: { coins: 4.5 } },
  { id: 'sapphire', w: 16, pay: { dust: 4 } },
  { id: 'diamond', w: 11, pay: { coins: 24 } },
  { id: 'mystic', w: 7, pay: { rough: 'mystic', v: 15 } },
  { id: 'star', w: 6 },
  { id: 'jp', w: 3.5 },
];
export const SYM = Object.fromEntries(SLOT_SYMS.map((s) => [s.id, s]));
// 当たりの列（[行, 列]）：横 3 本と斜め 2 本
export const SLOT_LINES = [
  [[0, 0], [0, 1], [0, 2]],
  [[1, 0], [1, 1], [1, 2]],
  [[2, 0], [2, 1], [2, 2]],
  [[0, 0], [1, 1], [2, 2]],
  [[2, 0], [1, 1], [0, 2]],
];
// ジャックポット：最初の額（当たると、ここから積み立て直す）と、賭け金のうち積み立てに回す割合。
// 当たりは「積み立て × 賭け金 ÷ いちばん高い賭け金」のコインと、賭け金 × mystic 個の秘石
export const SLOT_JP = { seed: 100000000, rate: 0.02, mystic: 0.001 };
// フィーバー：★ が どこでも stars 個以上で、spins 回ただで回せて払い戻しが mul 倍
export const SLOT_FEVER = { stars: 3, spins: 8, mul: 2 };
// コインに直したときの値打ち（採掘・交換所の値段から。還元率の計算と、当たりの大きさの判定に使う）
export const DUST_VALUE = 60;
export const ROUGH_VALUE = { shard: 60, rough: 300, large: 900, mystic: 2400 };

const TOTAL_W = SLOT_SYMS.reduce((a, s) => a + s.w, 0);
function pickSym(rng) {
  let r = rng() * TOTAL_W;
  for (const s of SLOT_SYMS) { r -= s.w; if (r < 0) return s.id; }
  return SLOT_SYMS[0].id;
}
// 3×3 の盤面（grid[行][列]）
export function rollGrid(rng = Math.random) {
  return [0, 1, 2].map(() => [0, 1, 2].map(() => pickSym(rng)));
}

// 払い戻しを数える。mul はフィーバーの倍率。jp はジャックポットで払う額（積み立てから引くのは呼ぶ側）
export function judge(grid, bet, pool, mul = 1) {
  const res = { lines: [], coins: 0, dust: 0, rough: {}, jp: 0, stars: 0, fever: false, value: 0 };
  for (let i = 0; i < SLOT_LINES.length; i++) {
    const cells = SLOT_LINES[i];
    const id = grid[cells[0][0]][cells[0][1]];
    if (!cells.every(([r, c]) => grid[r][c] === id)) continue;
    const s = SYM[id];
    if (id === 'jp') {
      if (!res.jp) {
        res.jp = Math.floor((pool * bet) / SLOT_BETS[SLOT_BETS.length - 1]);
        res.rough.mystic = (res.rough.mystic || 0) + Math.round(bet * SLOT_JP.mystic);
      }
      res.lines.push({ i, id });
      continue;
    }
    if (!s.pay) continue;
    const p = s.pay;
    if (p.coins) res.coins += Math.round(bet * p.coins * mul);
    if (p.dust) res.dust += Math.round((bet * p.dust * mul) / DUST_VALUE);
    if (p.rough) res.rough[p.rough] = (res.rough[p.rough] || 0) + Math.round((bet * p.v * mul) / ROUGH_VALUE[p.rough]);
    res.lines.push({ i, id });
  }
  for (const row of grid) for (const id of row) if (id === 'star') res.stars++;
  res.fever = res.stars >= SLOT_FEVER.stars;
  res.value = res.coins + res.jp + res.dust * DUST_VALUE + Object.entries(res.rough).reduce((a, [t, n]) => a + n * ROUGH_VALUE[t], 0);
  return res;
}
