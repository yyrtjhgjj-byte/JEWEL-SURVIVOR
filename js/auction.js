// =====================================================================
//  オークション（研磨工房のタブ）：品質 S 以上・7ct 以上の宝石が 1 点だけ出品され、ランを 1 回終えるごとに入れ替わる。
//  ライバル 3 人と実時間で競り、最後に最高額なら落札（研磨コレクションに入り、最高品質・最大カラットを更新）
//  裏オークション（上位工房で解放）：別枠の出品。品質とカラットの下限が高く、予想落札価格は同じ宝石の 2.5 倍
// =====================================================================
import { save } from './save.js';
import { COLLECTION_IDS, ABUNDANCE, GRADES } from './atelier.js';
import { weightedPick } from './util.js';

// 出品の中身：SS の確率、カラットの下限と幅、予想落札価格の倍率
export const AUCTION_KINDS = {
  front: { key: 'auction', ss: 0.25, ct: [7, 5], priceMul: 1 },
  black: { key: 'auction2', ss: 0.5, ct: [10, 6], priceMul: 2.5 },
};

// 予想落札価格：20,000 × 珍しさ（産出量 5→1 で 1.0〜2.6）× 品質（SS 1.8）×（カラット ÷ 7）^1.6（裏オークションはさらに 2.5 倍）
const RARITY = [0, 2.6, 2.0, 1.6, 1.3, 1.0];
export function lotEstimate(lot) {
  const mul = lot.black ? AUCTION_KINDS.black.priceMul : 1;
  return Math.round((20000 * mul * RARITY[ABUNDANCE[lot.gem] || 3] * (lot.grade >= 4 ? 1.8 : 1) * Math.pow(lot.ct / 7, 1.6)) / 100) * 100;
}

// 新しい出品（珍しい宝石ほど出やすい）
export function newLot(black = false) {
  const K = black ? AUCTION_KINDS.black : AUCTION_KINDS.front;
  const gem = weightedPick(COLLECTION_IDS, (id) => 6 - (ABUNDANCE[id] || 3));
  const grade = Math.random() < K.ss ? GRADES.length - 1 : GRADES.length - 2; // SS か S
  const ct = +(K.ct[0] + K.ct[1] * Math.pow(Math.random(), 1.8)).toFixed(2);
  const lot = { gem, grade, ct, state: 'open' }; // state：open 出品中 ／ won 落札 ／ lost 他の人が落札
  if (black) lot.black = true;
  lot.est = lotEstimate(lot);
  return lot;
}

export function currentLot(black = false) {
  const k = black ? AUCTION_KINDS.black.key : AUCTION_KINDS.front.key;
  if (!save[k] || !COLLECTION_IDS.includes(save[k].gem)) save[k] = newLot(black);
  const lot = save[k];
  // 入札したあとにアプリが終了した競りは、降りたものとして扱う（入札後に降りると、次のランまで参加できない決まりに合わせる）
  if (lot.state === 'open' && lot.joined) lot.state = 'lost';
  return lot;
}
// ランを終えるたびに入れ替える（main.js の settleRun）。裏オークションは一度開いてから
export function refreshLot() {
  save.auction = newLot();
  if (save.auction2) save.auction2 = newLot(true);
}

// 落札した宝石を研磨コレクションに入れる（研磨数 +1、最高品質・最大カラットを更新）
export function awardLot(lot) {
  const rec = save.jewels[lot.gem] || (save.jewels[lot.gem] = { n: 0, best: -1, ct: 0 });
  const before = { best: rec.best, ct: rec.ct, n: rec.n };
  rec.n++;
  rec.have = (rec.have || 0) + 1;
  if (lot.grade > rec.best) rec.best = lot.grade;
  if (lot.ct > rec.ct) rec.ct = lot.ct;
  return { isNew: before.n === 0, bestUp: lot.grade > before.best && before.n > 0, ctUp: lot.ct > before.ct && before.n > 0 };
}

// ライバル：上限（予想価格 × 倍率の幅）、1 回の上げ幅、入札の間隔、降りる傾向（rash：相場を超えると降りやすい）
export const RIVALS = [
  { id: 'appraiser', name: '鑑定士', color: '#7fd0ff', cap: [0.8, 1.15], step: [0.03, 0.05], wait: [0.7, 1.6] },
  { id: 'collector', name: '蒐集家', color: '#c78bff', cap: [0.9, 1.45], step: [0.06, 0.12], wait: [1.0, 2.4] },
  { id: 'tycoon', name: '成金', color: '#ffd24a', cap: [0.6, 1.05], step: [0.12, 0.22], wait: [0.4, 1.0], rash: true },
];
// 裏オークションのライバル（顔ぶれは裏の世界の住人。競り方は表と同じ 3 タイプ）
export const BLACK_RIVALS = [
  { id: 'fence', name: '影の故買屋', color: '#8fa3ff', cap: [0.8, 1.15], step: [0.03, 0.05], wait: [0.7, 1.6] },
  { id: 'count', name: '仮面の伯爵', color: '#d77bff', cap: [0.9, 1.45], step: [0.06, 0.12], wait: [1.0, 2.4] },
  { id: 'broker', name: '闇ブローカー', color: '#ff6b8a', cap: [0.6, 1.05], step: [0.12, 0.22], wait: [0.4, 1.0], rash: true },
];
