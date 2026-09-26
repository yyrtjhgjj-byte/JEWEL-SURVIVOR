// =====================================================================
//  ユーザーレベル（ランク）：ランが終わるたびに経験値が入り、レベルに応じて獲得コインが増える
// =====================================================================
import { save } from './save.js';

// 称号：1〜19 アクリル、20〜49 グラス、50〜 クリスタル
export const RANK_CLASSES = [
  { max: 19, name: 'アクリル', en: 'ACRYLIC', color: '#d9dde6' },
  { max: 49, name: 'グラス', en: 'GLASS', color: '#9fe8ff' },
  { max: Infinity, name: 'クリスタル', en: 'CRYSTAL', color: 'prism' },
];
export const rankClass = (lv) => RANK_CLASSES.find((c) => lv <= c.max);

// 次のレベルまでに必要な経験値（7 分のクリアで 400 前後入る。Lv20 までおよそ 16 回、Lv50 までおよそ 85 回）
export const rankNeed = (lv) => 80 + 25 * lv;

// 獲得コインの倍率：1 レベルにつき +0.5%（Lv50 で 1.25 倍）
export const rankCoinMul = (lv = rankLv()) => 1 + 0.005 * lv;

export function rankState() {
  if (!save.rank || typeof save.rank !== 'object') save.rank = { lv: 1, xp: 0 };
  return save.rank;
}
export const rankLv = () => rankState().lv;

// 1 回のランで入る経験値：生存時間、撃破数、ボス、クリア。ヒートが高いほど多い
export function runExp(res, cleared) {
  const base = res.time / 4.2 + res.kills / 20 + (res.bosses || 0) * 20 + (cleared ? 100 : 0);
  return Math.max(1, Math.round(base * (1 + 0.1 * (res.heat || 0))));
}

// 経験値を加えて、上がる前と後のレベルを返す
export function addRankExp(exp) {
  const r = rankState();
  const from = { lv: r.lv, xp: r.xp };
  r.xp += exp;
  while (r.xp >= rankNeed(r.lv)) { r.xp -= rankNeed(r.lv); r.lv++; }
  return { exp, from, to: { lv: r.lv, xp: r.xp } };
}
