// =====================================================================
//  オークション（研磨工房のタブ）：ランを 1 回終えるごとに「開催」が入れ替わり、3 点が順に競りにかけられる。
//  出品は宝石（品質 S 以上・大きなカラット）2 点と、原石の詰め合わせ 1 点。
//  ライバル 3 人はその回の予算を持っていて、落札するたびに減る（先の品で使わせると、あとの品が安く取れる）。
//  品ごとの欲しがり具合（本命・狙い・様子見）と、財布の残りは画面に出す。
//  裏オークション（上位工房で解放）は別枠の開催で、品質・カラットの下限が高く、値も張る。
// =====================================================================
import { save } from './save.js';
import { COLLECTION_IDS, ABUNDANCE, GRADES } from './atelier.js';
import { weightedPick } from './util.js';

const r100 = (v) => Math.round(v / 100) * 100;
const rnd = (a, b) => a + Math.random() * (b - a);

// 開催の中身：SS の確率、カラットの下限と幅、予想落札価格の倍率、詰め合わせの中身
export const AUCTION_KINDS = {
  front: { key: 'auction', ss: 0.25, ct: [7, 5], priceMul: 1, bundle: [{ large: 3, mystic: 1 }, { large: 5 }, { rough: 6, large: 2, mystic: 1 }] },
  black: { key: 'auction2', ss: 0.5, ct: [10, 6], priceMul: 2.5, bundle: [{ mystic: 4 }, { large: 6, mystic: 3 }, { mystic: 6 }] },
};
// 原石 1 個の値打ち（採掘の確率から見た相場より少し安め）
const ROUGH_VALUE = { shard: 200, rough: 900, large: 2400, mystic: 8000 };

// 予想落札価格。宝石：20,000 × 珍しさ（産出量 5→1 で 1.0〜2.6）× 品質（SS 1.8）×（カラット ÷ 7）^1.6。詰め合わせ：中身の値打ちの合計
const RARITY = [0, 2.6, 2.0, 1.6, 1.3, 1.0];
export function lotEstimate(lot) {
  if (lot.kind === 'bundle') return r100(Object.entries(lot.rough).reduce((a, [t, n]) => a + ROUGH_VALUE[t] * n, 0));
  const mul = lot.black ? AUCTION_KINDS.black.priceMul : 1;
  return r100(20000 * mul * RARITY[ABUNDANCE[lot.gem] || 3] * (lot.grade >= 4 ? 1.8 : 1) * Math.pow(lot.ct / 7, 1.6));
}

// ライバル：予算（その回の予想価格の合計に対する割合）、1 回の上げ幅、入札の間隔、品ごとの欲しがり具合（want）。
// rash：相場を超えると降りやすい。成金は最初の品ほど欲しがる
const SS = () => GRADES.length - 1;
const TRAITS = [
  { budget: [0.42, 0.58], step: [0.03, 0.05], wait: [0.7, 1.6], want: (lot) => (lot.kind === 'gem' ? (lot.grade >= SS() ? 1.25 : 1.0) : 0.75), likes: 'SS の宝石' },
  { budget: [0.55, 0.75], step: [0.06, 0.12], wait: [1.0, 2.4], want: (lot) => (lot.kind === 'gem' ? 0.86 + (5 - (ABUNDANCE[lot.gem] || 3)) * 0.12 : 0.8), likes: '珍しい宝石' },
  { budget: [0.6, 0.8], step: [0.12, 0.22], wait: [0.4, 1.0], rash: true, want: (lot, i) => [1.3, 1.05, 0.85][i] * (lot.kind === 'bundle' ? 1.15 : 1), likes: '最初の品' },
];
export const RIVALS = [
  { id: 'appraiser', name: '鑑定士', mark: '鑑', color: '#7fd0ff', ...TRAITS[0] },
  { id: 'collector', name: '蒐集家', mark: '蒐', color: '#c78bff', ...TRAITS[1] },
  { id: 'tycoon', name: '成金', mark: '成', color: '#ffd24a', ...TRAITS[2] },
];
// 裏オークションのライバル（顔ぶれは裏の世界の住人。競り方は表と同じ 3 タイプ）
export const BLACK_RIVALS = [
  { id: 'fence', name: '影の故買屋', mark: '影', color: '#8fa3ff', ...TRAITS[0] },
  { id: 'count', name: '仮面の伯爵', mark: '仮', color: '#d77bff', ...TRAITS[1] },
  { id: 'broker', name: '闇ブローカー', mark: '闇', color: '#ff6b8a', ...TRAITS[2] },
];
export const rivalsOf = (black) => (black ? BLACK_RIVALS : RIVALS);
// 欲しがり具合の言葉
export const wantLabel = (w) => (w >= 1.15 ? '本命' : w >= 0.95 ? '狙い' : '様子見');

function newGemLot(black) {
  const K = black ? AUCTION_KINDS.black : AUCTION_KINDS.front;
  const gem = weightedPick(COLLECTION_IDS, (id) => 6 - (ABUNDANCE[id] || 3));
  const grade = Math.random() < K.ss ? GRADES.length - 1 : GRADES.length - 2; // SS か S
  const ct = +(K.ct[0] + K.ct[1] * Math.pow(Math.random(), 1.8)).toFixed(2);
  return { kind: 'gem', gem, grade, ct };
}
function newBundleLot(black) {
  const K = black ? AUCTION_KINDS.black : AUCTION_KINDS.front;
  return { kind: 'bundle', rough: { ...K.bundle[Math.floor(Math.random() * K.bundle.length)] } };
}

// 新しい開催：3 点（宝石 2・詰め合わせ 1 を混ぜた順）と、ライバルの予算・品ごとの欲しがり具合
export function newSession(black = false) {
  const lots = [newGemLot(black), newGemLot(black), newBundleLot(black)].sort(() => Math.random() - 0.5);
  lots.forEach((l, i) => {
    if (black) l.black = true;
    l.est = lotEstimate(l);
    l.state = 'open'; // open 未決 ／ won 落札 ／ lost 他の人が落札 ／ unsold 流れた
    l.want = {};
    for (const r of rivalsOf(black)) l.want[r.id] = +(r.want(l, i) * rnd(0.88, 1.12)).toFixed(2);
  });
  const total = lots.reduce((a, l) => a + l.est, 0);
  const rivals = {};
  for (const r of rivalsOf(black)) { const b = r100(total * rnd(...r.budget)); rivals[r.id] = { budget: b, left: b }; }
  return { v: 2, lots, cur: 0, rivals };
}

// ライバルがその品に出せる上限（欲しがり具合 × 予想価格、ただし財布の残りまで）
export function rivalMax(sess, lot, r) {
  return Math.min(sess.rivals[r.id].left, r100(lot.est * lot.want[r.id]));
}
// 開始価格
export const startPrice = (lot) => r100(lot.est * 0.45);

// あなたが入らない（見送る・途中で降りる）とき、ライバルどうしで決まる結果。from は今の価格
export function settleWithoutYou(sess, lot, black, from = startPrice(lot)) {
  const rs = rivalsOf(black).map((r) => ({ r, max: rivalMax(sess, lot, r) })).filter((x) => x.max > from).sort((a, b) => b.max - a.max);
  if (!rs.length) { lot.state = 'unsold'; return null; }
  const top = rs[0];
  const second = rs[1] ? rs[1].max : from;
  const price = Math.min(top.max, r100(Math.max(from, second) * rnd(1.03, 1.08)));
  lot.state = 'lost';
  lot.price = price;
  lot.winner = top.r.id;
  sess.rivals[top.r.id].left -= price;
  return { rival: top.r, price };
}

export function currentSession(black = false) {
  const k = black ? AUCTION_KINDS.black.key : AUCTION_KINDS.front.key;
  let s = save[k];
  if (!s || s.v !== 2 || !Array.isArray(s.lots)) s = save[k] = newSession(black);
  // 入札したあとにアプリが終了した品は、ライバルどうしで決まったことにして先へ進める
  const lot = s.lots[s.cur];
  if (lot && lot.state === 'open' && lot.joined) {
    settleWithoutYou(s, lot, black);
    s.cur++;
  }
  return s;
}
// ランを終えるたびに入れ替える（main.js の settleRun）。裏オークションは一度開いてから
export function refreshLot() {
  save.auction = newSession();
  if (save.auction2) save.auction2 = newSession(true);
}

// 落札した品を受け取る。宝石：研磨コレクションに入れる（研磨数 +1、最高品質・最大カラットを更新）。詰め合わせ：原石に足す
export function awardLot(lot) {
  if (lot.kind === 'bundle') {
    for (const [t, n] of Object.entries(lot.rough)) save.rough[t] = (save.rough[t] || 0) + n;
    return {};
  }
  const rec = save.jewels[lot.gem] || (save.jewels[lot.gem] = { n: 0, best: -1, ct: 0 });
  const before = { best: rec.best, ct: rec.ct, n: rec.n };
  rec.n++;
  rec.have = (rec.have || 0) + 1;
  if (lot.grade > rec.best) rec.best = lot.grade;
  if (lot.ct > rec.ct) rec.ct = lot.ct;
  return { isNew: before.n === 0, bestUp: lot.grade > before.best && before.n > 0, ctUp: lot.ct > before.ct && before.n > 0 };
}
