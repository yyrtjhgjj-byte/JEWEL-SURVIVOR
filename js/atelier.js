// =====================================================================
//  研磨工房（原石 → 研磨 → コレクション）
//  ラン中に拾った原石を研磨して宝石にし、宝石ごとの「練度」に応じて
//  小さな永続ボーナスを得る。
// =====================================================================
import { GEMS } from './data.js';
import { save } from './save.js';
import { chance, weightedPick } from './util.js';

// 原石の等級
export const ROUGH = {
  shard: { name: '原石の欠片', short: '欠片', cost: 30, ct: [0.3, 1.2], facets: 3, speed: 1.0, zone: 1.0, rare: 1, color: '#9a93b0' },
  rough: { name: '原石', short: '原石', cost: 80, ct: [0.8, 2.5], facets: 4, speed: 1.1, zone: 0.9, rare: 1.6, color: '#b8a8e0' },
  large: { name: '大原石', short: '大原石', cost: 200, ct: [2.0, 5.0], facets: 5, speed: 1.2, zone: 0.8, rare: 2.4, color: '#e0b8ff' },
  mystic: { name: '秘石', short: '秘石', cost: 500, ct: [4.0, 10.0], facets: 6, speed: 1.3, zone: 0.7, rare: 4, color: '#ffd6f5' },
};
export const ROUGH_IDS = Object.keys(ROUGH);

// 品質
export const GRADES = [
  { id: 'C', min: 0, color: '#7dffb0' },
  { id: 'B', min: 0.35, color: '#7fd0ff' },
  { id: 'A', min: 0.6, color: '#c78bff' },
  { id: 'S', min: 0.8, color: '#ffd24a' },
  { id: 'SS', min: 0.95, color: 'rainbow' },
];
export function gradeFromScore(score) {
  let g = 0;
  // 浮動小数点の誤差（0.8 が 0.7999… になるなど）で 1 段階下がらないよう、わずかに余裕を持たせる
  for (let i = 0; i < GRADES.length; i++) if (score + 1e-9 >= GRADES[i].min) g = i;
  return g;
}

// コレクション対象（武器の宝石 15 ＋ チャームの宝石 13）
export const COLLECTION_IDS = Object.keys(GEMS).filter((id) => id !== 'obsidian');

// 宝石ごとの練度 1 あたりのボーナス（ジュエルパワーに沿った能力）
export const MASTERY_BONUS = {
  ruby: { might: 0.006 }, sapphire: { magnet: 0.02 }, garnet: { regen: 0.02 }, labradorite: { crit: 0.002 },
  opal: { luck: 0.02 }, amber: { greed: 0.02 }, angelite: { maxHp: 2 }, diamond: { area: 0.005 },
  emerald: { growth: 0.01 }, rhodochrosite: { might: 0.005 }, kyanite: { speed: 0.01 }, aquamarine: { duration: 0.01 },
  alexandrite: { growth: 0.01 }, tourmaline: { moveSpeed: 0.005 }, moonstone: { luck: 0.02 },
  topaz: { might: 0.005 }, jasper: { maxHp: 2 }, nephrite: { area: 0.004 }, milkyquartz: { area: 0.004 },
  coral: { luck: 0.02 }, iolite: { cooldown: -0.004 }, prase: { growth: 0.01 }, granite: { guard: 0.003 },
  coal: { regen: 0.02 }, titanite: { greed: 0.02 }, redberyl: { magnet: 0.02 }, turquoise: { guard: 0.003 },
  peridot: { moveSpeed: 0.005 },
};
const STAT_LABEL = {
  might: ['攻撃力', '%'], magnet: ['回収範囲', '%'], regen: ['HP自然回復', '/秒'], crit: ['クリティカル率', '%'],
  luck: ['幸運', '%'], greed: ['獲得コイン', '%'], maxHp: ['最大HP', ''], area: ['攻撃範囲', '%'],
  growth: ['経験値', '%'], speed: ['弾速', '%'], duration: ['持続', '%'], moveSpeed: ['移動速度', '%'],
  cooldown: ['クールダウン短縮', '%'], guard: ['被ダメージ軽減', '%'],
};
export function statText(k, v) {
  const [label, unit] = STAT_LABEL[k] || [k, ''];
  const pct = unit === '%';
  const n = pct ? Math.abs(v) * 100 : Math.abs(v);
  const num = +n.toFixed(pct ? 1 : 2);
  const sign = k === 'cooldown' || k === 'guard' ? '' : '+';
  return `${label} ${sign}${num}${unit}`;
}

// 練度：最高品質（C=1〜SS=5）＋ 研磨数 3 / 10 / 30 で +1 ずつ（最大 8）
export const COUNT_MILESTONES = [3, 10, 30];
export const MASTERY_MAX = 8;
export function mastery(rec) {
  if (!rec || !rec.n) return 0;
  return rec.best + 1 + COUNT_MILESTONES.filter((m) => rec.n >= m).length;
}
export function nextMilestone(rec) {
  const n = rec ? rec.n : 0;
  return COUNT_MILESTONES.find((m) => n < m) || null;
}

// コレクション全体のボーナス（game.js の computeStats から使う）
export function collectionStats() {
  const s = {};
  for (const id of COLLECTION_IDS) {
    const m = mastery(save.jewels[id]);
    if (!m) continue;
    const c = caratMul(save.jewels[id].ct);
    for (const [k, v] of Object.entries(MASTERY_BONUS[id])) s[k] = (s[k] || 0) + v * m * c;
  }
  return s;
}
// 最大カラットによる倍率：3.69ct なら ×1.369
export function caratMul(ct) {
  return 1 + (ct || 0) / 10;
}
export function gemBonusText(id, m, ct = save.jewels[id] ? save.jewels[id].ct : 0) {
  return Object.entries(MASTERY_BONUS[id]).map(([k, v]) => statText(k, v * m * caratMul(ct))).join(' / ');
}

// どの宝石が出るか。実際の宝石の産出量をおおまかに 5 段階にした（5 が多い）。
// 厳密に合わせると偏りすぎるので、重みの差は最大 10 倍にとどめ、上位の原石ほど差を縮める
const ABUNDANCE = {
  milkyquartz: 5, granite: 5, coal: 5, jasper: 5,
  garnet: 4, amber: 4, labradorite: 4, moonstone: 4, nephrite: 4, topaz: 4,
  tourmaline: 3, peridot: 3, aquamarine: 3, iolite: 3, kyanite: 3, turquoise: 3, angelite: 3, prase: 3, opal: 3,
  sapphire: 2, ruby: 2, emerald: 2, diamond: 2, coral: 2, rhodochrosite: 2, titanite: 2,
  alexandrite: 1, redberyl: 1,
};
const ABUNDANCE_W = [0, 1, 2.5, 4.5, 7, 10];
function gemWeight(id, tier) {
  const a = ABUNDANCE[id] || 3;
  return ABUNDANCE_W[a] * Math.pow(ROUGH[tier].rare, (5 - a) / 4);
}
export function rollGem(tier) {
  return weightedPick(COLLECTION_IDS, (id) => gemWeight(id, tier));
}
export function rollCarat(tier) {
  const [a, b] = ROUGH[tier].ct;
  // 大きいものほど出にくい
  return +(a + (b - a) * Math.pow(Math.random(), 1.8)).toFixed(2);
}

// 研磨の結果をセーブに反映し、変化を返す
export function applyPolish(tier, gemId, grade, ct) {
  const rec = save.jewels[gemId] || (save.jewels[gemId] = { n: 0, best: -1, ct: 0 });
  const before = { m: mastery(rec), best: rec.best, ct: rec.ct, n: rec.n };
  rec.n++;
  if (grade > rec.best) rec.best = grade;
  if (ct > rec.ct) rec.ct = ct;
  save.stats.polished = (save.stats.polished || 0) + 1;
  if (grade === GRADES.length - 1) save.stats.polishSS = (save.stats.polishSS || 0) + 1;
  save.rough[tier]--;
  return {
    gemId, grade, ct, tier,
    isNew: before.n === 0,
    bestUp: grade > before.best && before.n > 0,
    ctUp: ct > before.ct && before.n > 0,
    mBefore: before.m, mAfter: mastery(rec),
  };
}

// 自動研磨：品質は C か B
export function autoGrade() {
  return chance(0.6) ? 1 : 0;
}

// ---------------------------------------------------------------- ラン中のドロップ
// 基本の等級を、ステージとヒートに応じて確率で 1 段階上げる
export function upgradeTier(tier, stageNo, heat) {
  const i = ROUGH_IDS.indexOf(tier);
  if (i >= ROUGH_IDS.length - 1) return tier;
  const p = (stageNo - 1) * 0.06 + heat * 0.05;
  return chance(p) ? ROUGH_IDS[i + 1] : tier;
}
export function eliteDrop() {
  if (chance(0.05)) return 'rough';
  if (chance(0.2)) return 'shard';
  return null;
}
export function bossDrop(isFinal, heat) {
  if (isFinal) return chance(0.25 + heat * 0.1) ? 'mystic' : 'large';
  return chance(0.3) ? 'large' : 'rough';
}

export function collectionCount() {
  return COLLECTION_IDS.filter((id) => save.jewels[id] && save.jewels[id].n).length;
}
export function totalRough() {
  return ROUGH_IDS.reduce((a, t) => a + (save.rough[t] || 0), 0);
}
