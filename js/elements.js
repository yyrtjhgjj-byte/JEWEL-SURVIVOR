// =====================================================================
//  属性：攻撃が当たったときに抽選して、敵に状態異常を付ける（オマケ程度の効果）
//  同じ属性の宝石（武器・チャームどちらも 1 と数える）を揃えると、効果量と効果時間が伸びる
// =====================================================================
import { WEAPONS, PASSIVES } from './data.js';
import { chance } from './util.js';

// st：状態異常の名前、d：効果、vs：その状態の敵への追加効果（図鑑の「属性」タブに出す）
export const ELEMENTS = {
  fire: { jp: '炎', color: '#ff7a45', st: '燃焼', d: '3 秒間、当てたダメージの 24% を追加で与える', vs: '燃焼中の敵へのダメージ +8%' },
  water: { jp: '水', color: '#4ab8ff', st: '濡れ', d: '3 秒間、移動速度 -25%（ボスは -10%）', vs: '濡れた敵から受ける接触ダメージ -15%' },
  ice: { jp: '氷', color: '#bff0ff', st: '凍結', d: '1 秒間、動きを止める（ボスは 0.5 秒間、移動速度 -20%）', vs: '凍結中の敵へのクリティカル率 +10%' },
  grass: { jp: '草', color: '#74e07e', st: '寄生', d: '4 秒間、その敵に与えたダメージの一部で HP 回復（毎秒 1 まで）', vs: '寄生中の敵を倒すと HP +1' },
  thunder: { jp: '雷', color: '#ffe14a', st: '感電', d: '当てたダメージの 20% が近くの敵 1 体へ飛ぶ', vs: '感電中の敵なら、飛ぶ先が 2 体になる' },
  light: { jp: '光', color: '#fff3c4', st: '目くらまし', d: '3 秒間、攻撃の間隔が 30% 延びる（ボスは 15%）', vs: '目くらまし中の敵を倒すと経験値 +10%' },
  dark: { jp: '闇', color: '#b77bff', st: '恐怖', d: '1.5 秒間、自機から逃げる（ボスには効かない）', vs: '恐怖中の敵を倒すと、近くの敵に恐怖がうつる' },
  earth: { jp: '土', color: '#d09a5c', st: '大地の加護', d: '6 秒ごとに 40% で発動。5 秒間、被ダメージ -15%・ボスのブレイクゲージ +15%', vs: '' },
};

// 宝石ごとの属性
export const GEM_ELEMENT = {
  ruby: 'fire', rhodochrosite: 'fire', coal: 'fire', redberyl: 'fire',
  aquamarine: 'water', coral: 'water', iolite: 'water',
  sapphire: 'ice', kyanite: 'ice', milkyquartz: 'ice',
  emerald: 'grass', nephrite: 'grass', prase: 'grass', peridot: 'grass',
  labradorite: 'thunder', tourmaline: 'thunder', amber: 'thunder',
  opal: 'light', angelite: 'light', diamond: 'light', topaz: 'light', titanite: 'light',
  moonstone: 'dark', garnet: 'dark', alexandrite: 'dark',
  granite: 'earth', jasper: 'earth', turquoise: 'earth',
};

export const elemOf = (gem) => GEM_ELEMENT[gem] || null;

// 揃えた数による倍率（2 つで 1.15、3 つで 1.3、4 つ以上で 1.5）
export function elementMul(n) {
  return n >= 4 ? 1.5 : n === 3 ? 1.3 : n === 2 ? 1.15 : 1;
}

const PROC = 0.04; // 1 回の抽選で発動する確率
const PROC_CD = 0.2; // 武器ごとの抽選のクールタイム（秒）。何度も当たる武器ほど発動しやすくなるのを防ぐ
const GRASS_HEAL_CAP = 1; // 草の回復は、毎秒この量（×揃えた倍率）まで
const EARTH_EVERY = 6; // 土：この間隔で抽選する（秒）
const EARTH_CHANCE = 0.4;

// 装備から属性の数と倍率を数え直す
export function recalcElements(g) {
  const cnt = {};
  for (const w of g.weapons) { const k = elemOf(WEAPONS[w.id].gem); if (k) cnt[k] = (cnt[k] || 0) + 1; }
  for (const p of g.passives) { const k = elemOf(PASSIVES[p.id].gem); if (k) cnt[k] = (cnt[k] || 0) + 1; }
  g.elemCnt = cnt;
  g.elemMul = {};
  for (const k in ELEMENTS) g.elemMul[k] = elementMul(cnt[k] || 0);
}

// 命中時：その武器の属性を抽選する
export function procElement(g, e, wid, dealt) {
  const def = WEAPONS[wid];
  if (!def || e.segment || e.prop) return;
  const el = elemOf(def.gem);
  if (!el) return;
  const cd = g.procCd || (g.procCd = {});
  if ((cd[wid] || 0) > g.time) return;
  cd[wid] = g.time + PROC_CD;
  if (!chance(PROC)) return;
  const m = g.elemMul[el];
  const col = ELEMENTS[el].color;
  switch (el) {
    case 'fire': // 燃焼：3 秒で、当てたダメージの 24% を追加
      e.burnDps = Math.max(e.burnT > 0 ? e.burnDps : 0, (dealt * 0.24 * m) / 3);
      e.burnT = 3 * m;
      e.burnWid = wid;
      break;
    case 'water': // 濡れ：移動速度 -25%（ボスは -10%）
      e.wetT = 3 * m;
      e.wetSlow = Math.min(0.6, (e.boss ? 0.1 : 0.25) * m);
      break;
    case 'ice': // 凍結：1 秒止まる（ボスは止めずに -20% の減速を 0.5 秒）
      if (e.boss || e.ai === 'thief') { e.chillT = 0.5 * m; e.chill = Math.min(0.5, 0.2 * m); }
      else e.frozenT = Math.max(e.frozenT, 1 * m);
      break;
    case 'grass': // 寄生：4 秒間、この敵に与えたダメージの一部で HP 回復（上限あり）
      e.parT = 4 * m;
      break;
    case 'thunder': { // 感電：当てたダメージの 20% が近くの敵へ飛ぶ。感電中の敵なら 2 体へ
      const n = e.shockT > 0 ? 2 : 1;
      e.shockT = 3 * m;
      const ex = g._elEx || (g._elEx = new Set());
      ex.clear();
      ex.add(e);
      for (const t of g.nearestEnemies(e.x, e.y, n, 170, ex)) {
        g.fx.bolt(e.x, e.y, t.x, t.y, col, 0.2, 2.5);
        g.damage(t, dealt * 0.2 * m, { wid, dot: true });
        if (t.alive) t.shockT = Math.max(t.shockT || 0, 1.5 * m);
      }
      break;
    }
    case 'light': // 目くらまし：攻撃の間隔が 30% 延びる（ボスは 15%）
      e.blindT = 3 * m;
      e.blind = Math.min(0.6, (e.boss ? 0.15 : 0.3) * m);
      break;
    case 'dark': // 恐怖：自機から逃げる（ボス・シーフには効かない）
      if (!e.boss && e.ai !== 'thief') e.fearT = 1.5 * m;
      break;
  }
  g.fx.burst(e.x, e.y, col, 5, 120, 0.35, 7);
}

// 状態異常の敵へのダメージ倍率とクリティカル率の加算
export function elementVs(g, e) {
  let mul = 1, crit = 0;
  const M = g.elemMul;
  if (e.burnT > 0) mul *= 1 + 0.08 * M.fire;
  if (e.frozenT > 0 && g.elemCnt.ice) crit += 0.1 * M.ice;
  return { mul, crit };
}

// 敵ごとの毎フレームの処理（タイマー・燃焼のダメージ）
export function tickElements(g, e, dt) {
  if (e.wetT > 0) e.wetT -= dt;
  if (e.chillT > 0) e.chillT -= dt;
  if (e.parT > 0) e.parT -= dt;
  if (e.shockT > 0) e.shockT -= dt;
  if (e.blindT > 0) e.blindT -= dt;
  if (e.fearT > 0) e.fearT -= dt;
  if (e.burnT > 0) {
    e.burnT -= dt;
    e.burnAcc = (e.burnAcc || 0) + e.burnDps * dt;
    e.burnTick = (e.burnTick || 0) - dt;
    if (e.burnTick <= 0 || e.burnT <= 0) {
      e.burnTick = 0.5;
      const v = e.burnAcc;
      e.burnAcc = 0;
      if (v >= 1) g.damage(e, v, { wid: e.burnWid, dot: true });
    }
  }
}

// 移動の補正（濡れ・冷気の減速、恐怖で逃げる）
export function elementMove(e, mv, dx, dy) {
  let k = 1;
  if (e.wetT > 0) k *= 1 - e.wetSlow;
  if (e.chillT > 0) k *= 1 - e.chill;
  mv.spd *= k;
  if (e.fearT > 0 && !(e.dash > 0)) { mv.mx = -dx; mv.my = -dy; }
}

// 目くらまし中は、敵の AI の時間を遅らせる（攻撃の間隔が延びる）
export const blindDt = (e, dt) => (e.blindT > 0 ? dt / (1 + e.blind) : dt);

// 接触ダメージ：濡れた敵からは減る
export function touchMul(g, e) {
  return e.wetT > 0 ? 1 - Math.min(0.4, 0.15 * g.elemMul.water) : 1;
}

// 草の回復（毎秒の上限つき）
export function grassHeal(g, v) {
  const cap = GRASS_HEAL_CAP * g.elemMul.grass;
  g.grassBudget = Math.min(cap, g.grassBudget ?? cap);
  const h = Math.min(v, g.grassBudget);
  if (h <= 0) return;
  g.grassBudget -= h;
  g.heal(h, true);
}

// 与えたダメージによる回復（寄生中の敵）
export function onElementHit(g, e, dealt) {
  if (e.parT > 0) grassHeal(g, dealt * 0.015 * g.elemMul.grass);
}

// 撃破時の追加効果
export function onElementKill(g, e) {
  const M = g.elemMul;
  if (e.parT > 0) grassHeal(g, 1 * M.grass);
  if (e.fearT > 0) {
    // 恐怖がとなりの敵にうつる
    const ex = g._elEx || (g._elEx = new Set());
    ex.clear();
    ex.add(e);
    const t = g.nearestEnemies(e.x, e.y, 1, 150, ex)[0];
    if (t && !t.boss && t.ai !== 'thief') t.fearT = Math.max(t.fearT || 0, 1.5 * M.dark);
  }
  return e.blindT > 0 ? 1 + 0.1 * M.light : 1; // 経験値の倍率
}

// 全体の毎フレームの処理（草の回復の上限の回復、土の自己バフ）
export function updateElements(g, dt) {
  const gc = GRASS_HEAL_CAP * g.elemMul.grass;
  g.grassBudget = Math.min(gc, (g.grassBudget ?? gc) + gc * dt);
  if (g.earthT > 0) g.earthT -= dt;
  if (g.elemCnt.earth) {
    g.earthTimer = (g.earthTimer ?? EARTH_EVERY) - dt;
    if (g.earthTimer <= 0) {
      g.earthTimer = EARTH_EVERY;
      if (chance(EARTH_CHANCE)) {
        g.earthT = 5 * g.elemMul.earth;
        const p = g.player;
        g.fx.ring(p.x, p.y, 10, 60, 0.4, ELEMENTS.earth.color, 4);
      }
    }
  }
}

// 土の自己バフ：被ダメージ -15%、ボスのブレイクゲージ +15%
export const earthGuard = (g) => (g.earthT > 0 ? 1 - Math.min(0.4, 0.15 * g.elemMul.earth) : 1);
export const earthBreak = (g) => (g.earthT > 0 ? 1 + 0.15 * g.elemMul.earth : 1);
