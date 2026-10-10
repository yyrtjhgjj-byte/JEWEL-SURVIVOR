// 百獣：同じ宝石を 10 個使って動物の彫刻を召喚し、以降は 10 個ごとに強化する
import { save } from './save.js';
import { GEMS } from './data.js';

export const BEAST_COST = 10;

// base：召喚したときの効果（クリティカル率 +10% と同じくらいの価値）、step：強化 1 回ごとに伸びる量（base の 1/10）
// shape：100×100 の座標で、台座（y 86〜）の上に立つ形。['e', 中心x, 中心y, 半径x, 半径y, 傾き°] ／ ['p', x1, y1, x2, y2, …]
export const BEASTS = {
  ruby: {
    name: 'ニホンウサギ', stat: 'might', base: 0.15, step: 0.015, spark: [[63, 40, 3], [34, 60, 2.2]],
    shape: [
      ['e', 44, 68, 23, 17, 0],
      ['e', 36, 74, 17, 12, 0],
      ['e', 22, 64, 6, 6, 0],
      ['e', 66, 46, 13, 11, -15],
      ['e', 76, 50, 6, 5, 0],
      ['p', 58, 38, 55, 16, 57, 7, 62, 8, 66, 36],
      ['p', 64, 37, 67, 16, 71, 9, 76, 12, 72, 38],
      ['e', 64, 82, 8, 4, 0],
      ['e', 38, 84, 17, 3, 0],
    ],
  },
  sapphire: {
    name: 'キャバリア', stat: 'growth', base: 0.2, step: 0.02, spark: [[58, 33, 3], [42, 66, 2.2]],
    shape: [
      ['p', 34, 86, 32, 66, 40, 52, 56, 50, 62, 62, 64, 86],
      ['e', 38, 76, 12, 11, 0],
      ['e', 60, 38, 12, 11, 0],
      ['e', 71, 44, 8, 5, 0],
      ['p', 50, 32, 56, 31, 59, 56, 50, 59, 45, 48],
      ['p', 56, 64, 62, 64, 63, 86, 56, 86],
      ['p', 31, 74, 20, 70, 21, 65, 33, 69],
      ['e', 60, 85, 7, 2.5, 0],
    ],
    lines: [[56, 31, 59, 56, 50, 59, 45, 48]],
  },
  garnet: {
    name: 'ペルシャ', stat: 'hpMul', base: 0.25, step: 0.025, spark: [[55, 38, 3], [40, 64, 2.2]],
    shape: [
      ['e', 46, 70, 20, 16, 0],
      ['e', 58, 64, 11, 14, 0],
      ['e', 60, 44, 14, 12, 0],
      ['e', 60, 51, 15, 6, 0],
      ['p', 49, 37, 49, 27, 57, 33],
      ['p', 63, 33, 71, 27, 71, 38],
      ['e', 25, 79, 13, 6, -15],
      ['e', 57, 84, 9, 3, 0],
    ],
  },
  labradorite: {
    name: 'ポーラベア', stat: 'critDmg', base: 0.4, step: 0.04, spark: [[76, 49, 2.6], [40, 52, 2.4]],
    shape: [
      ['e', 46, 58, 26, 15, 0],
      ['e', 26, 57, 10, 12, 0],
      ['p', 60, 48, 70, 45, 74, 60, 62, 66],
      ['p', 66, 50, 70, 44, 80, 44, 90, 52, 88, 58, 74, 60],
      ['e', 71, 43, 3, 3, 0],
      ['p', 24, 62, 33, 62, 32, 86, 23, 86],
      ['p', 38, 66, 45, 66, 45, 86, 38, 86],
      ['p', 54, 64, 61, 64, 62, 86, 55, 86],
      ['p', 64, 60, 71, 60, 72, 86, 65, 86],
    ],
  },
  angelite: {
    name: 'アルパカ', stat: 'healUp', base: 0.3, step: 0.03, spark: [[63, 18, 2.6], [38, 50, 2.4]],
    shape: [
      ['e', 42, 54, 20, 12, 0],
      ['p', 55, 54, 57, 24, 68, 22, 67, 54],
      ['e', 66, 20, 7, 6, 0],
      ['e', 72, 23, 5, 4, 0],
      ['e', 62, 14, 5, 4, 0],
      ['p', 61, 16, 60, 6, 65, 13],
      ['p', 66, 14, 68, 5, 70, 14],
      ['p', 28, 58, 33, 58, 33, 86, 28, 86],
      ['p', 36, 60, 41, 60, 41, 86, 36, 86],
      ['p', 46, 60, 51, 60, 51, 86, 46, 86],
      ['p', 54, 58, 59, 58, 59, 86, 54, 86],
      ['e', 22, 50, 4, 6, 0],
    ],
  },
  peridot: {
    name: 'パピヨン', stat: 'moveSpeed', base: 0.1, step: 0.01, spark: [[46, 42, 2.6], [44, 66, 2.2]],
    shape: [
      ['e', 50, 70, 14, 16, 0],
      ['e', 50, 45, 10, 9, 0],
      ['e', 50, 53, 5, 4, 0],
      ['p', 46, 41, 24, 20, 28, 40, 42, 49],
      ['p', 54, 41, 76, 20, 72, 40, 58, 49],
      ['p', 42, 72, 47, 72, 47, 86, 42, 86],
      ['p', 53, 72, 58, 72, 58, 86, 53, 86],
      ['e', 66, 64, 6, 11, 30],
      ['e', 50, 85, 14, 2.5, 0],
    ],
    lines: [[42, 49, 28, 40, 24, 20], [58, 49, 72, 40, 76, 20], [47, 74, 47, 86], [53, 74, 53, 86]],
  },
  diamond: {
    name: 'マンチカン', stat: 'crit', base: 0.1, step: 0.01, spark: [[73, 61, 2.6], [44, 71, 2.4]],
    shape: [
      ['e', 48, 74, 25, 9, 0],
      ['e', 76, 64, 10, 9, 0],
      ['p', 69, 58, 70, 47, 77, 55],
      ['p', 78, 55, 85, 47, 85, 60],
      ['p', 28, 78, 34, 78, 34, 86, 28, 86],
      ['p', 37, 79, 42, 79, 42, 86, 37, 86],
      ['p', 57, 79, 62, 79, 62, 86, 57, 86],
      ['p', 65, 77, 71, 77, 71, 86, 65, 86],
      ['p', 25, 71, 14, 58, 12, 48, 16, 47, 19, 57, 29, 68],
    ],
  },
};
export const BEAST_IDS = Object.keys(BEASTS);

// 宝石の所持数（研磨・落札で +1、召喚・強化で使う）
export function jewelStock(id) {
  const r = save.jewels[id];
  return r ? r.have || 0 : 0;
}
export function beastLevel(id) {
  return (save.beasts && save.beasts[id]) || 0;
}
export function beastValue(id, lv = beastLevel(id)) {
  const b = BEASTS[id];
  return lv ? b.base + b.step * (lv - 1) : 0;
}
// 召喚（Lv0→1）と強化（Lv+1）。宝石が足りなければ false
export function raiseBeast(id) {
  const r = save.jewels[id];
  if (!r || (r.have || 0) < BEAST_COST) return false;
  r.have -= BEAST_COST;
  save.beasts = save.beasts || {};
  save.beasts[id] = beastLevel(id) + 1;
  return true;
}
// 全体のボーナス（game.js の computeStats から使う）
export function beastStats() {
  const s = {};
  let n = 0;
  for (const id of BEAST_IDS) {
    const v = beastValue(id);
    if (!v) continue;
    s[BEASTS[id].stat] = (s[BEASTS[id].stat] || 0) + v;
    n++;
  }
  // 召喚した種類の数だけ与ダメージ +1%
  if (n) s.dmgUp = (s.dmgUp || 0) + 0.01 * n;
  return s;
}

// ---------------------------------------------------------------- 彫刻の絵
// 形を宝石の色で塗り、ローポリの面（明るさの違う三角形）で彫刻らしく見せる
const artCache = new Map();
function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; }
function shapePath(ctx, sh) {
  ctx.beginPath();
  if (sh[0] === 'e') ctx.ellipse(sh[1], sh[2], sh[3], sh[4], (sh[5] * Math.PI) / 180, 0, Math.PI * 2);
  else { ctx.moveTo(sh[1], sh[2]); for (let i = 3; i < sh.length; i += 2) ctx.lineTo(sh[i], sh[i + 1]); ctx.closePath(); }
}
function mkCanvas(n) { const c = document.createElement('canvas'); c.width = c.height = n; return c; }

export function beastIcon(id, size = 96) {
  const key = id + ':' + size;
  let u = artCache.get(key);
  if (u) return u;
  const g = GEMS[id], B = BEASTS[id];
  const N = size * 2, k = N / 100;
  // 形の型抜き
  const mask = mkCanvas(N), m = mask.getContext('2d');
  m.scale(k, k);
  m.fillStyle = '#fff';
  for (const sh of B.shape) { shapePath(m, sh); m.fill(); }
  // 本体：左上から光が当たるローポリの面
  const body = mkCanvas(N), b = body.getContext('2d');
  b.scale(k, k);
  let sd = 0;
  for (const ch of id) sd = (sd * 31 + ch.charCodeAt(0)) % 2147483647;
  const rnd = () => ((sd = (sd * 16807 + 11) % 2147483647) / 2147483647);
  const G = 9, pts = [];
  for (let j = 0; j <= 100 / G + 1; j++) {
    pts[j] = [];
    for (let i = 0; i <= 100 / G + 1; i++) pts[j][i] = [i * G + (rnd() - 0.5) * G * 0.8, j * G + (rnd() - 0.5) * G * 0.8];
  }
  const tri = (a, c, d) => {
    const cx = (a[0] + c[0] + d[0]) / 3, cy = (a[1] + c[1] + d[1]) / 3;
    const t = Math.max(0, Math.min(1, 0.62 - (cx * 0.5 + cy) / 150 + (rnd() - 0.5) * 0.42));
    b.fillStyle = t > 0.5 ? mix(g.color, g.light, (t - 0.5) * 1.6) : mix(g.dark, g.color, t * 2);
    b.beginPath(); b.moveTo(a[0], a[1]); b.lineTo(c[0], c[1]); b.lineTo(d[0], d[1]); b.closePath(); b.fill();
    b.strokeStyle = 'rgba(255,255,255,0.10)'; b.lineWidth = 0.35; b.stroke();
  };
  for (let j = 0; j < pts.length - 1; j++) for (let i = 0; i < pts[j].length - 1; i++) {
    const p = pts[j][i], q = pts[j][i + 1], r = pts[j + 1][i], s = pts[j + 1][i + 1];
    if ((i + j) % 2) { tri(p, q, s); tri(p, s, r); } else { tri(p, q, r); tri(q, s, r); }
  }
  b.setTransform(1, 0, 0, 1, 0, 0);
  b.globalCompositeOperation = 'destination-in';
  b.drawImage(mask, 0, 0);
  // 仕上げ
  const c = mkCanvas(N), x = c.getContext('2d');
  // 台座
  x.save(); x.scale(k, k);
  const pg = x.createLinearGradient(0, 86, 0, 97);
  pg.addColorStop(0, '#3a3548'); pg.addColorStop(1, '#141220');
  x.fillStyle = pg;
  x.beginPath(); x.moveTo(18, 86); x.lineTo(82, 86); x.lineTo(86, 97); x.lineTo(14, 97); x.closePath(); x.fill();
  x.fillStyle = g.color; x.globalAlpha = 0.7; x.fillRect(18, 86, 64, 1.1); x.globalAlpha = 1;
  x.restore();
  // 縁の光（型を少しずらして重ねる）と本体
  const rim = mkCanvas(N), rc = rim.getContext('2d');
  rc.drawImage(mask, 0, 0);
  rc.globalCompositeOperation = 'source-in'; rc.fillStyle = g.light; rc.fillRect(0, 0, N, N);
  x.save(); x.shadowColor = g.color; x.shadowBlur = N * 0.03;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) x.drawImage(rim, dx * k * 0.6, dy * k * 0.6);
  x.restore();
  x.drawImage(body, 0, 0);
  // 細部の線（耳の縁など、同じ色で重なって見えない所）
  if (B.lines) {
    x.save(); x.scale(k, k);
    x.strokeStyle = g.light; x.globalAlpha = 0.6; x.lineWidth = 0.9; x.lineJoin = x.lineCap = 'round';
    for (const l of B.lines) { x.beginPath(); x.moveTo(l[0], l[1]); for (let i = 2; i < l.length; i += 2) x.lineTo(l[i], l[i + 1]); x.stroke(); }
    x.restore();
  }
  // きらめき
  x.save(); x.scale(k, k); x.globalCompositeOperation = 'lighter';
  for (const [sx, sy, r] of B.spark || []) {
    const rg = x.createRadialGradient(sx, sy, 0, sx, sy, r * 2);
    rg.addColorStop(0, 'rgba(255,255,255,0.9)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = rg; x.beginPath(); x.arc(sx, sy, r * 2, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff';
    x.beginPath(); x.moveTo(sx - r * 1.6, sy); x.lineTo(sx, sy - 0.35); x.lineTo(sx + r * 1.6, sy); x.lineTo(sx, sy + 0.35); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(sx, sy - r * 1.6); x.lineTo(sx + 0.35, sy); x.lineTo(sx, sy + r * 1.6); x.lineTo(sx - 0.35, sy); x.closePath(); x.fill();
  }
  x.restore();
  u = c.toDataURL();
  // 作業用のキャンバスはすぐ小さくする（iOS の Safari はキャンバスのメモリの上限が小さく、捨てたキャンバスも回収されるまで数える）
  for (const cv of [mask, body, rim, c]) cv.width = cv.height = 1;
  artCache.set(key, u);
  return u;
}
