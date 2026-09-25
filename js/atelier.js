// =====================================================================
//  研磨工房（原石 → 研磨 → コレクション）
//  ラン中に拾った原石を研磨して宝石にし、宝石ごとの「練度」に応じて
//  小さな永続ボーナスを得る。
// =====================================================================
import { GEMS, CHARACTERS } from './data.js';
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
  { id: 'C', min: 0, color: '#9a93b0' },
  { id: 'B', min: 0.35, color: '#7fd0ff' },
  { id: 'A', min: 0.6, color: '#7dffb0' },
  { id: 'S', min: 0.8, color: '#ffd24a' },
  { id: 'SS', min: 0.95, color: 'rainbow' },
];
export function gradeFromScore(score) {
  let g = 0;
  for (let i = 0; i < GRADES.length; i++) if (score >= GRADES[i].min) g = i;
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
    for (const [k, v] of Object.entries(MASTERY_BONUS[id])) s[k] = (s[k] || 0) + v * m;
  }
  return s;
}
export function gemBonusText(id, m) {
  return Object.entries(MASTERY_BONUS[id]).map(([k, v]) => statText(k, v * m)).join(' / ');
}

// どの宝石が出るか。レアな宝石ほど出にくく、上位の原石ほど出やすい
function gemWeight(id, tier) {
  const c = CHARACTERS[id];
  const r = c ? c.rarity : 'R';
  const t = ROUGH[tier].rare;
  return r === 'UR' ? 1.5 * t : r === 'SR' ? 4 * Math.sqrt(t) : 10;
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
