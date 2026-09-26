// =====================================================================
//  オークション（研磨工房のタブ）：品質 S 以上・7ct 以上の宝石が 1 点だけ出品され、ランを 1 回終えるごとに入れ替わる。
//  ライバル 3 人と実時間で競り、最後に最高額なら落札（研磨コレクションに入り、最高品質・最大カラットを更新）
// =====================================================================
import { save } from './save.js';
import { COLLECTION_IDS, ABUNDANCE, GRADES } from './atelier.js';
import { weightedPick } from './util.js';

// 予想落札価格：15,000 × 珍しさ（産出量 5→1 で 1.0〜2.6）× 品質（SS 1.8）×（カラット ÷ 7）^1.6
const RARITY = [0, 2.6, 2.0, 1.6, 1.3, 1.0];
export function lotEstimate(lot) {
  return Math.round((20000 * RARITY[ABUNDANCE[lot.gem] || 3] * (lot.grade >= 4 ? 1.8 : 1) * Math.pow(lot.ct / 7, 1.6)) / 100) * 100;
}

// 新しい出品（珍しい宝石ほど出やすい）
export function newLot() {
  const gem = weightedPick(COLLECTION_IDS, (id) => 6 - (ABUNDANCE[id] || 3));
  const grade = Math.random() < 0.25 ? GRADES.length - 1 : GRADES.length - 2; // SS 25% ／ S 75%
  const ct = +(7 + 5 * Math.pow(Math.random(), 1.8)).toFixed(2);
  const lot = { gem, grade, ct, state: 'open' }; // state：open 出品中 ／ won 落札 ／ lost 他の人が落札
  lot.est = lotEstimate(lot);
  return lot;
}

export function currentLot() {
  if (!save.auction || !COLLECTION_IDS.includes(save.auction.gem)) save.auction = newLot();
  return save.auction;
}
// ランを終えるたびに入れ替える（main.js の settleRun）
export function refreshLot() { save.auction = newLot(); }

// 落札した宝石を研磨コレクションに入れる（研磨数 +1、最高品質・最大カラットを更新）
export function awardLot(lot) {
  const rec = save.jewels[lot.gem] || (save.jewels[lot.gem] = { n: 0, best: -1, ct: 0 });
  const before = { best: rec.best, ct: rec.ct, n: rec.n };
  rec.n++;
  if (lot.grade > rec.best) rec.best = lot.grade;
  if (lot.ct > rec.ct) rec.ct = lot.ct;
  return { isNew: before.n === 0, bestUp: lot.grade > before.best && before.n > 0, ctUp: lot.ct > before.ct && before.n > 0 };
}

// ライバル：上限（予想価格 × 倍率の幅）、1 回の上げ幅、入札の間隔、降りる傾向
export const RIVALS = [
  { id: 'appraiser', name: '鑑定士', color: '#7fd0ff', cap: [0.8, 1.15], step: [0.03, 0.05], wait: [0.7, 1.6] },
  { id: 'collector', name: '蒐集家', color: '#c78bff', cap: [0.9, 1.45], step: [0.06, 0.12], wait: [1.0, 2.4] },
  { id: 'tycoon', name: '成金', color: '#ffd24a', cap: [0.6, 1.05], step: [0.12, 0.22], wait: [0.4, 1.0] },
];
