// =====================================================================
//  絵：ぜんぶ コードで かく（画像ファイル不要）
// =====================================================================
import { GEMS } from './data.js';
import { TAU, mix, rgba } from './util.js';
import { drawArtifact } from './artifact-art.js';
import { drawShopIcon } from './shop-art.js';
import { drawCutGem } from './gem-art.js';
import { diagCanvas } from './diag.js';

const RES = 2; // スプライトの 解像度倍率

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  diagCanvas(c.width * c.height * 4);
  return c;
}

// 使い捨ての絵（アイコンの dataURL、縁取りの下ごしらえ）は、決まったキャンバスを使い回す。
// iOS の Safari はキャンバスのメモリに上限があり、捨てたキャンバスもしばらく数えられたままになるので、作っては捨てるを繰り返さない。
// 使い終わったら 1×1 に縮めてメモリを手放す
const iconCanvas = makeCanvas(1, 1);
function iconBegin(w, h) {
  iconCanvas.width = Math.ceil(w);
  iconCanvas.height = Math.ceil(h);
  return iconCanvas;
}
function iconEnd(c) {
  const u = c.toDataURL();
  c.width = c.height = 1;
  return u;
}

// 0=dark 0.5=color 1=light
function shade3(g, t) {
  return t < 0.5 ? mix(g.dark, g.color, t * 2) : mix(g.color, g.light, (t - 0.5) * 2);
}

const OPAL_COLS = ['#ffd6f2', '#d6f0ff', '#e8ffd6', '#fff3c4', '#ecd6ff', '#c9fff6', '#ffe0cc', '#dcd6ff'];
const LABRA_COLS = ['#1b3f5c', '#3fb6c9', '#2a6a8a', '#e8c14a', '#1b3f5c', '#5ad0a0', '#2a6a8a', '#3f7fd9'];

// ------------------------------------------------------------------ 形
function shapePoints(cut, r) {
  const pts = [];
  if (cut === 'round' || cut === 'oval') {
    const sx = cut === 'oval' ? 0.8 : 1;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU - Math.PI / 2 + Math.PI / 8;
      pts.push([Math.cos(a) * r * sx, Math.sin(a) * r]);
    }
  } else if (cut === 'emerald') {
    const w = r * 0.78, h = r, c = r * 0.3;
    pts.push([-w + c, -h], [w - c, -h], [w, -h + c], [w, h - c], [w - c, h], [-w + c, h], [-w, h - c], [-w, -h + c]);
  } else if (cut === 'long') {
    pts.push([0, -r], [r * 0.42, -r * 0.45], [r * 0.42, r * 0.45], [0, r], [-r * 0.42, r * 0.45], [-r * 0.42, -r * 0.45]);
  } else if (cut === 'drop') {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU - Math.PI / 2;
      const k = 1 - 0.45 * Math.max(0, -Math.sin(a)); // 上が とがる
      let x = Math.cos(a) * r * 0.78 * k, y = Math.sin(a) * r * 0.9 + r * 0.1;
      if (i === 0) { x = 0; y = -r; }
      pts.push([x, y]);
    }
  } else if (cut === 'heart') {
    for (let i = 0; i < 20; i++) {
      const t = (i / 20) * TAU;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      pts.push([(x / 17) * r, (y / 17) * r + r * 0.08]);
    }
  } else if (cut === 'star') {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU - Math.PI / 2;
      const rr = i % 2 ? r * 0.48 : r;
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
  }
  return pts;
}

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

export function sparkle(ctx, x, y, s, color = '#fff') {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
}

// 原点に 半径 r の ジュエルを かく
export function drawGem(ctx, r, g, cutOverride) {
  const cut = cutOverride || g.cut || 'round';
  const outer = shapePoints(cut, r);
  // 中心を すこし 上に
  const cx = 0, cy = cut === 'heart' ? -r * 0.05 : cut === 'drop' ? r * 0.12 : 0;
  const k = cut === 'long' ? 0.35 : 0.52;
  const inner = outer.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
  const light = Math.atan2(-0.8, -0.6);

  // ぼんやり グロー
  ctx.save();
  ctx.shadowColor = g.rainbow ? '#ffffff' : g.color;
  ctx.shadowBlur = r * 0.5;
  poly(ctx, outer);
  ctx.fillStyle = g.color;
  ctx.fill();
  ctx.restore();

  // ファセット
  const n = outer.length;
  for (let i = 0; i < n; i++) {
    const a = outer[i], b = outer[(i + 1) % n];
    const ia = inner[i], ib = inner[(i + 1) % n];
    const mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy;
    const ang = Math.atan2(my, mx);
    let t = 0.5 + 0.5 * Math.cos(ang - light);
    t = t * 0.9 + (i % 2 ? 0.05 : -0.05);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(ib[0], ib[1]);
    ctx.lineTo(ia[0], ia[1]);
    ctx.closePath();
    if (g.rainbow) ctx.fillStyle = mix(OPAL_COLS[i % 8], '#ffffff', t * 0.4);
    else if (g.shimmer) ctx.fillStyle = mix(LABRA_COLS[i % 8], g.light, t * 0.35);
    else ctx.fillStyle = shade3(g, t);
    ctx.fill();
    // 三角ファセット
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo((ia[0] + ib[0]) / 2 * 0.9 + (a[0] + b[0]) / 2 * 0.1, (ia[1] + ib[1]) / 2 * 0.9 + (a[1] + b[1]) / 2 * 0.1);
    ctx.lineTo(b[0], b[1]);
    ctx.closePath();
    ctx.fillStyle = g.rainbow ? rgba('#ffffff', 0.25 * t) : rgba(t > 0.5 ? g.light : g.dark, 0.25);
    ctx.fill();
  }
  // テーブル面
  const grd = ctx.createLinearGradient(-r * 0.5, -r * 0.5, r * 0.5, r * 0.5);
  if (g.rainbow) {
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.3, '#ffd6f5');
    grd.addColorStop(0.55, '#d6f7ff');
    grd.addColorStop(0.8, '#fff7c9');
    grd.addColorStop(1, '#e3d6ff');
  } else {
    grd.addColorStop(0, g.light);
    grd.addColorStop(0.55, g.color);
    grd.addColorStop(1, mix(g.color, g.dark, 0.5));
  }
  poly(ctx, inner);
  ctx.fillStyle = grd;
  ctx.fill();
  // 線
  ctx.strokeStyle = rgba('#ffffff', 0.35);
  ctx.lineWidth = Math.max(0.5, r * 0.035);
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.moveTo(outer[i][0], outer[i][1]);
    ctx.lineTo(inner[i][0], inner[i][1]);
    ctx.stroke();
  }
  poly(ctx, inner);
  ctx.stroke();
  // ふち
  poly(ctx, outer);
  ctx.strokeStyle = g.rainbow ? '#b9a4d6' : g.dark;
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.lineJoin = 'round';
  ctx.stroke();
  // ハイライト
  ctx.fillStyle = rgba('#ffffff', 0.55);
  ctx.beginPath();
  ctx.ellipse(-r * 0.22, -r * 0.3, r * 0.2, r * 0.1, -0.6, 0, TAU);
  ctx.fill();
  sparkle(ctx, -r * 0.38, -r * 0.42, r * 0.28, '#ffffff');
  sparkle(ctx, r * 0.3, r * 0.25, r * 0.12, rgba('#ffffff', 0.8));
}

// ------------------------------------------------------------------ キャッシュ
const gemCache = new Map();
export function gemSprite(id, size = 32, cutOverride) {
  const idKey = typeof id === 'string' ? id : (id._k || (id._k = JSON.stringify(id)));
  const key = idKey + ':' + size + ':' + (cutOverride || '');
  let c = gemCache.get(key);
  if (c) return c;
  const g = typeof id === 'string' ? GEMS[id] : id;
  const pad = size * 0.45;
  c = makeCanvas((size + pad * 2) * RES, (size + pad * 2) * RES);
  const ctx = c.getContext('2d');
  ctx.scale(RES, RES);
  ctx.translate(size / 2 + pad, size / 2 + pad);
  // 宝石の id で呼んだときはカット別の新しい絵（gem-art.js）。形を指定したとき（弾のハートや槍など）は従来の絵
  if (typeof id === 'string' && !cutOverride) drawCutGem(ctx, size / 2, g, id);
  else drawGem(ctx, size / 2, g, cutOverride);
  c.logical = size + pad * 2;
  c.base = size;
  gemCache.set(key, c);
  return c;
}

const iconCache = new Map();
// 原石（岩の塊から結晶がのぞく）
const ROUGH_LOOK = {
  shard: { n: 1, size: 0.62, glow: 0 },
  rough: { n: 2, size: 0.8, glow: 0.2 },
  large: { n: 3, size: 1, glow: 0.35 },
  mystic: { n: 4, size: 1, glow: 0.7 },
};
function drawRough(ctx, r, tier, color) {
  const L = ROUGH_LOOK[tier] || ROUGH_LOOK.rough;
  r *= L.size;
  // 岩
  const pts = [];
  const N = 9;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + 0.2;
    const k = 0.78 + 0.22 * Math.sin(i * 2.7 + r) * Math.cos(i * 1.3);
    pts.push([Math.cos(a) * r * k, Math.sin(a) * r * k * 0.86 + r * 0.06]);
  }
  if (L.glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = r * L.glow * 1.4;
  }
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, '#5d5870');
  g.addColorStop(0.55, '#34303f');
  g.addColorStop(1, '#1b1922');
  ctx.fillStyle = g;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.stroke();
  // 岩肌の筋
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, r * 0.1); ctx.lineTo(-r * 0.1, r * 0.35); ctx.lineTo(r * 0.3, r * 0.2);
  ctx.stroke();
  // 結晶
  const spots = [[0.1, -0.25, 0.5, -0.3], [-0.38, -0.05, 0.38, 0.5], [0.42, 0.05, 0.34, 0.9], [-0.05, 0.3, 0.3, 0.2]];
  for (let i = 0; i < L.n; i++) {
    const [x, y, s, rot] = spots[i];
    ctx.save();
    ctx.translate(x * r, y * r);
    ctx.rotate(rot);
    const w = s * r * 0.45, h = s * r;
    const cg = ctx.createLinearGradient(0, -h, 0, h * 0.4);
    cg.addColorStop(0, '#ffffff');
    cg.addColorStop(0.35, color);
    cg.addColorStop(1, 'rgba(40,30,60,0.9)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(0, -h); ctx.lineTo(w, -h * 0.35); ctx.lineTo(w * 0.7, h * 0.4); ctx.lineTo(-w * 0.7, h * 0.4); ctx.lineTo(-w, -h * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(0.8, r * 0.03);
    ctx.stroke();
    ctx.restore();
  }
  if (L.glow >= 0.35) sparkle(ctx, r * 0.35, -r * 0.45, r * 0.28, '#ffffff');
}
const roughCache = new Map();
export function roughSprite(tier, color, size = 14) {
  const key = tier + ':' + color + ':' + size;
  let c = roughCache.get(key);
  if (c) return c;
  const S = size * 2.8;
  c = makeCanvas(S * RES, S * RES);
  const ctx = c.getContext('2d');
  ctx.scale(RES, RES);
  ctx.translate(S / 2, S / 2);
  drawRough(ctx, size, tier, color);
  c.logical = S;
  roughCache.set(key, c);
  return c;
}
export function roughIcon(tier, color, size = 72) {
  const key = 'rough:' + tier + ':' + color + ':' + size;
  let u = iconCache.get(key);
  if (u) return u;
  const c = iconBegin(size * 2, size * 2);
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  ctx.translate(size / 2, size / 2);
  drawRough(ctx, size * 0.4, tier, color);
  u = iconEnd(c);
  iconCache.set(key, u);
  return u;
}
export { drawRough };

// 秘宝のアイコン（金の縁取りのカードに、描き下ろしの絵）
export function artifactIcon(id, size = 72) {
  const key = 'art:' + id + ':' + size;
  let u = iconCache.get(key);
  if (u) return u;
  const W = size;
  const c = iconBegin(W * 2, W * 2);
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  const m = W * 0.03, rr = W * 0.12;
  ctx.beginPath();
  ctx.moveTo(m + rr, m); ctx.arcTo(W - m, m, W - m, W - m, rr); ctx.arcTo(W - m, W - m, m, W - m, rr);
  ctx.arcTo(m, W - m, m, m, rr); ctx.arcTo(m, m, W - m, m, rr); ctx.closePath();
  const bg = ctx.createRadialGradient(W / 2, W / 2, 1, W / 2, W / 2, W * 0.7);
  bg.addColorStop(0, '#1d1830'); bg.addColorStop(1, '#0b0a12');
  ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = 'rgba(232,197,106,0.8)'; ctx.lineWidth = Math.max(1, W * 0.025); ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.translate(W / 2, W / 2);
  drawArtifact(ctx, id, W * 0.92);
  ctx.restore();
  u = iconEnd(c);
  iconCache.set(key, u);
  return u;
}

// 工房の強化のアイコン（描き下ろし。shop-art.js）。枠は付けない（工房のカードの中に置くため）
export function shopIcon(id, size = 72) {
  const key = 'shop:' + id + ':' + size;
  let u = iconCache.get(key);
  if (u) return u;
  const c = iconBegin(size * 2, size * 2);
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  ctx.translate(size / 2, size / 2);
  drawShopIcon(ctx, id, size * 0.96);
  u = iconEnd(c);
  iconCache.set(key, u);
  return u;
}

// 採掘画面のピッケル
export function pickaxeIcon(size = 120) {
  const key = 'pick:' + size;
  let u = iconCache.get(key);
  if (u) return u;
  const c = iconBegin(size * 2, size * 2);
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  ctx.translate(size / 2, size / 2);
  ctx.rotate(Math.PI / 4);
  const s = size;
  ctx.lineJoin = 'round';
  // 柄：黒地に白の輪郭
  ctx.beginPath();
  ctx.roundRect(-s * 0.045, -s * 0.3, s * 0.09, s * 0.72, s * 0.03);
  const hg = ctx.createLinearGradient(-s * 0.05, 0, s * 0.05, 0);
  hg.addColorStop(0, '#1a1822');
  hg.addColorStop(0.5, '#34303f');
  hg.addColorStop(1, '#0c0b10');
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = s * 0.014;
  ctx.stroke();
  // 握りの巻き
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = s * 0.01;
  for (let i = 0; i < 5; i++) {
    const y = s * (0.2 + i * 0.04);
    ctx.beginPath();
    ctx.moveTo(-s * 0.045, y + s * 0.015);
    ctx.lineTo(s * 0.045, y - s * 0.015);
    ctx.stroke();
  }
  // 頭：鋼の三日月
  ctx.save();
  ctx.shadowColor = 'rgba(190,210,255,0.55)';
  ctx.shadowBlur = s * 0.08;
  ctx.beginPath();
  ctx.moveTo(-s * 0.44, -s * 0.1);
  ctx.quadraticCurveTo(0, -s * 0.58, s * 0.44, -s * 0.1);
  ctx.quadraticCurveTo(0, -s * 0.37, -s * 0.44, -s * 0.1);
  ctx.closePath();
  const mg = ctx.createLinearGradient(0, -s * 0.36, 0, -s * 0.22);
  mg.addColorStop(0, '#ffffff');
  mg.addColorStop(0.35, '#c9d2e4');
  mg.addColorStop(1, '#5a6278');
  ctx.fillStyle = mg;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(20,20,30,0.9)';
  ctx.lineWidth = s * 0.012;
  ctx.stroke();
  // 刃先の光
  sparkle(ctx, s * 0.42, -s * 0.12, s * 0.06, '#ffffff');
  // 継ぎ目の金具と宝石
  ctx.beginPath();
  ctx.roundRect(-s * 0.075, -s * 0.36, s * 0.15, s * 0.13, s * 0.025);
  ctx.fillStyle = '#15141c';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = s * 0.012;
  ctx.stroke();
  ctx.save();
  ctx.translate(0, -s * 0.295);
  ctx.rotate(-Math.PI / 4);
  drawGem(ctx, s * 0.05, GEMS.diamond);
  ctx.restore();
  u = iconEnd(c);
  iconCache.set(key, u);
  return u;
}

// コイン報酬のアイコン（3枚重ねの金貨）
export function coinIcon(size = 72) {
  const key = 'coin:' + size;
  let u = iconCache.get(key);
  if (u) return u;
  const c = iconBegin(size * 2, size * 2);
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  ctx.translate(size / 2, size / 2);
  const coin = (x, y, r) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = 'rgba(255,190,40,0.6)';
    ctx.shadowBlur = r * 0.5;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
    g.addColorStop(0, '#fff8c4');
    g.addColorStop(0.6, '#ffc21a');
    g.addColorStop(1, '#c47a00');
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#8a5200';
    ctx.lineWidth = r * 0.1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, TAU);
    ctx.strokeStyle = 'rgba(138,82,0,0.55)';
    ctx.lineWidth = r * 0.07;
    ctx.stroke();
    sparkle(ctx, 0, 0, r * 0.45, '#fff6b0');
    ctx.restore();
  };
  const r = size * 0.2;
  coin(-size * 0.15, size * 0.08, r);
  coin(size * 0.15, size * 0.1, r);
  coin(0, -size * 0.08, r * 1.08);
  u = iconEnd(c);
  iconCache.set(key, u);
  return u;
}

export function gemIcon(id, size = 72) {
  const key = id + ':' + size;
  let u = iconCache.get(key);
  if (u) return u;
  const g = GEMS[id];
  const c = iconBegin(size * 2, size * 2);
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  ctx.translate(size / 2, size / 2);
  drawCutGem(ctx, size * 0.36, g, id);
  u = iconEnd(c);
  iconCache.set(key, u);
  return u;
}

// キラキラ（加算合成用）
const starCache = new Map();
export function starSprite(color) {
  let c = starCache.get(color);
  if (c) return c;
  const S = 64;
  c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const rg = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  rg.addColorStop(0, rgba(color, 0.9));
  rg.addColorStop(0.25, rgba(color, 0.4));
  rg.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, S, S);
  sparkle(ctx, S / 2, S / 2, S * 0.42, rgba(color, 0.9));
  sparkle(ctx, S / 2, S / 2, S * 0.22, '#ffffff');
  starCache.set(color, c);
  return c;
}
const dotCache = new Map();
export function dotSprite(color) {
  let c = dotCache.get(color);
  if (c) return c;
  const S = 32;
  c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const rg = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  rg.addColorStop(0, '#ffffff');
  rg.addColorStop(0.3, rgba(color, 1));
  rg.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, S, S);
  dotCache.set(color, c);
  return c;
}

// 中心が白く飛ばない やわらかい光（炎など）
const softCache = new Map();
export function softSprite(color) {
  let c = softCache.get(color);
  if (c) return c;
  const S = 32;
  c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const rg = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  rg.addColorStop(0, rgba(color, 0.9));
  rg.addColorStop(0.45, rgba(color, 0.45));
  rg.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, S, S);
  softCache.set(color, c);
  return c;
}

// ------------------------------------------------------------------ てき
// 光る目
function eyes(ctx, x, y, s, { color = '#ff4f9a', gap = 0.9, angry = true } = {}) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = s * 1.4;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(x + side * s * gap, y);
    ctx.rotate(angry ? side * 0.38 : 0);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.58, s * 0.27, 0, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.28, s * 0.1, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

const RIM = 'rgba(205,180,255,0.6)';

function bodyGrad(ctx, r, base) {
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r * 1.2);
  g.addColorStop(0, mix(base, '#ffffff', 0.45));
  g.addColorStop(0.6, base);
  g.addColorStop(1, mix(base, '#000000', 0.55));
  return g;
}

function shine(ctx, r) {
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.4, -r * 0.45, r * 0.25, r * 0.13, -0.6, 0, TAU);
  ctx.fill();
}

// 異形の単眼（白目＋光る瞳）
function oneEye(ctx, x, y, s, color = '#b8ff5f') {
  ctx.save();
  ctx.fillStyle = '#f4f0e6';
  ctx.beginPath();
  ctx.arc(x, y, s, 0, TAU);
  ctx.fill();
  ctx.shadowColor = color;
  ctx.shadowBlur = s * 1.2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.55, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0b0610';
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.18, s * 0.45, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}
function tentacle(ctx, x0, y0, x1, y1, bend, w, col) {
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2 + bend, (y0 + y1) / 2, x1, y1);
  ctx.stroke();
}

// ------------------------------------------------------------------ 第3章の絵の部品
// 羽ばたく翼（s=左右、根元→先端。後ろの縁に n 枚の羽の切れ込み）
function featherWing(ctx, s, rx, ry, tx, ty, bx, by, n, fill, w) {
  ctx.beginPath();
  ctx.moveTo(s * rx, ry);
  ctx.lineTo(s * tx, ty);
  for (let i = 1; i <= n; i++) {
    const k0 = (i - 0.5) / n, k1 = i / n;
    const mx = tx + (bx - tx) * k0, my = ty + (by - ty) * k0;
    const qx = tx + (bx - tx) * k1, qy = ty + (by - ty) * k1;
    ctx.lineTo(s * mx, my + w);
    ctx.lineTo(s * qx, qy);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = RIM;
  ctx.lineWidth = w * 0.3;
  ctx.stroke();
}
// 下向きの牙
function fang(ctx, x, y, w, h, up = false) {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x - w * 0.1, y + (up ? -h : h) * 0.6, x, y + (up ? -h : h));
  ctx.quadraticCurveTo(x + w * 0.1, y + (up ? -h : h) * 0.6, x + w / 2, y);
  ctx.closePath();
  ctx.fillStyle = '#f6f0e2';
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,40,30,0.7)';
  ctx.lineWidth = w * 0.12;
  ctx.stroke();
}
// 渦巻き（雲雷文）
function spiral(ctx, x, y, R, turns, dir = 1) {
  ctx.beginPath();
  const n = 40 * turns;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = dir * t * turns * TAU;
    const rr = R * (1 - t * 0.85);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke();
}
// 光のにじみ（スプライトに 1 度だけ描く）
function glowBlob(ctx, x, y, R, color, a) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, TAU);
  ctx.fill();
  ctx.restore();
}
// 儵と忽（南海の帝・北海の帝）：冕冠の玉すだれで顔が隠れた帝。tool は 'chisel'（鑿）か 'mallet'（槌）
function seaEmperor(ctx, r, col, tool, eyeCol) {
  // 袖と衣
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * r * 0.35, -r * 0.35);
    ctx.quadraticCurveTo(s * r * 1.25, -r * 0.2, s * r * 1.3, r * 0.55);
    ctx.lineTo(s * r * 0.8, r * 0.75);
    ctx.quadraticCurveTo(s * r * 0.75, r * 0.2, s * r * 0.4, r * 0.05);
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r, mix(col, '#000000', 0.15));
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.04;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-r * 0.42, -r * 0.4);
  ctx.quadraticCurveTo(-r * 0.75, r * 0.5, -r * 0.85, r * 1.2);
  ctx.lineTo(r * 0.85, r * 1.2);
  ctx.quadraticCurveTo(r * 0.75, r * 0.5, r * 0.42, -r * 0.4);
  ctx.closePath();
  ctx.fillStyle = bodyGrad(ctx, r * 1.1, col);
  ctx.fill();
  ctx.strokeStyle = RIM;
  ctx.lineWidth = r * 0.04;
  ctx.stroke();
  // 衿と帯
  ctx.strokeStyle = '#f0d58a';
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.38);
  ctx.lineTo(0, r * 0.15);
  ctx.lineTo(r * 0.3, -r * 0.38);
  ctx.stroke();
  ctx.fillStyle = '#f0d58a';
  ctx.fillRect(-r * 0.6, r * 0.32, r * 1.2, r * 0.12);
  // 顔
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.62, r * 0.32, r * 0.36, 0, 0, TAU);
  ctx.fillStyle = mix(col, '#000000', 0.55);
  ctx.fill();
  eyes(ctx, 0, -r * 0.62, r * 0.17, { color: eyeCol, gap: 0.95 });
  // 冕冠（平らな冠と、前後に垂れる玉すだれ）
  ctx.fillStyle = '#1a1420';
  ctx.fillRect(-r * 0.62, -r * 1.12, r * 1.24, r * 0.12);
  ctx.strokeStyle = '#f0d58a';
  ctx.lineWidth = r * 0.03;
  ctx.strokeRect(-r * 0.62, -r * 1.12, r * 1.24, r * 0.12);
  ctx.fillStyle = mix(col, '#f0d58a', 0.4);
  ctx.fillRect(-r * 0.2, -r * 1.0, r * 0.4, r * 0.18);
  for (let i = 0; i < 7; i++) {
    const x = -r * 0.54 + i * r * 0.18;
    ctx.strokeStyle = 'rgba(240,213,138,0.7)';
    ctx.lineWidth = r * 0.015;
    ctx.beginPath();
    ctx.moveTo(x, -r * 1.0);
    ctx.lineTo(x, -r * 0.45);
    ctx.stroke();
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(x, -r * 0.92 + k * r * 0.14, r * 0.035, 0, TAU);
      ctx.fillStyle = k % 2 ? '#f6f0e2' : eyeCol;
      ctx.fill();
    }
  }
  // 道具
  ctx.save();
  ctx.translate(r * 1.05, r * 0.25);
  ctx.rotate(0.5);
  if (tool === 'chisel') {
    ctx.fillStyle = '#8a5a3a';
    ctx.fillRect(-r * 0.08, -r * 0.75, r * 0.16, r * 0.45);
    ctx.fillStyle = '#c8ccd8';
    ctx.beginPath();
    ctx.moveTo(-r * 0.07, -r * 0.3);
    ctx.lineTo(r * 0.07, -r * 0.3);
    ctx.lineTo(r * 0.05, r * 0.35);
    ctx.lineTo(-r * 0.05, r * 0.35);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = '#8a5a3a';
    ctx.fillRect(-r * 0.05, -r * 0.3, r * 0.1, r * 0.75);
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(-r * 0.25, -r * 0.62, r * 0.5, r * 0.32);
    ctx.strokeStyle = '#f0d58a';
    ctx.lineWidth = r * 0.025;
    ctx.strokeRect(-r * 0.25, -r * 0.62, r * 0.5, r * 0.32);
  }
  ctx.restore();
  ctx.save();
  ctx.translate(0, -r * 1.25);
  drawGem(ctx, r * 0.1, tool === 'chisel' ? GEMS.ruby : GEMS.iolite);
  ctx.restore();
}

const ENEMY_DRAW = {
  slime(ctx, r, col, f) {
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.55);
    ctx.bezierCurveTo(-r * 1.1, -r * 0.4, -r * 0.5, -r * 1.05, 0, -r * 1.0);
    ctx.bezierCurveTo(r * 0.5, -r * 1.05, r * 1.1, -r * 0.4, r, r * 0.55);
    ctx.quadraticCurveTo(r * 0.6, r * 0.8, r * 0.3, r * 0.65);
    ctx.quadraticCurveTo(0, r * 0.85, -r * 0.3, r * 0.65);
    ctx.quadraticCurveTo(-r * 0.6, r * 0.8, -r, r * 0.55);
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.1;
    ctx.stroke();
    shine(ctx, r);
    eyes(ctx, 0, -r * 0.1, r * 0.34);
  },
  bat(ctx, r, col, f) {
    const up = f === 1;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.4, -r * 0.1);
      ctx.lineTo(s * r * 1.5, up ? -r * 0.9 : -r * 0.1);
      ctx.lineTo(s * r * 1.3, up ? -r * 0.2 : r * 0.5);
      ctx.lineTo(s * r * 1.0, up ? -r * 0.3 : r * 0.25);
      ctx.lineTo(s * r * 0.8, up ? r * 0.1 : r * 0.6);
      ctx.lineTo(s * r * 0.4, r * 0.3);
      ctx.closePath();
      ctx.fillStyle = mix(col, '#000', 0.25);
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.1;
      ctx.stroke();
    }
    // みみ
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.2, -r * 0.5);
      ctx.lineTo(s * r * 0.5, -r * 1.05);
      ctx.lineTo(s * r * 0.6, -r * 0.35);
      ctx.fillStyle = col;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.7, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.1;
    ctx.stroke();
    eyes(ctx, 0, -r * 0.05, r * 0.24, { color: '#ffd23d' });
  },
  ghost(ctx, r, col) {
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.8);
    ctx.lineTo(-r, -r * 0.1);
    ctx.arc(0, -r * 0.1, r, Math.PI, 0);
    ctx.lineTo(r, r * 0.8);
    for (let i = 0; i < 4; i++) {
      const x0 = r - (i * r) / 2;
      ctx.quadraticCurveTo(x0 - r * 0.25, r * 0.45, x0 - r * 0.5, r * 0.8);
    }
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.09;
    ctx.stroke();
    ctx.globalAlpha = 1;
    shine(ctx, r);
    eyes(ctx, 0, -r * 0.08, r * 0.34, { color: '#5ff0ff', angry: false, gap: 1.0 });
  },
  toge(ctx, r, col) {
    const n = 12;
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * TAU;
      const rr = i % 2 ? r * 0.78 : r * 1.12;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = mix(col, '#ff2d6a', 0.25);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.78, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.8, col);
    ctx.fill();
    shine(ctx, r * 0.8);
    eyes(ctx, 0, 0, r * 0.28, { color: '#ff2d55' });
  },
  golem(ctx, r, col) {
    const pts = [[-0.9, -0.3], [-0.6, -0.85], [0.1, -1.0], [0.75, -0.7], [1.0, 0.0], [0.8, 0.7], [0.1, 0.95], [-0.7, 0.75], [-1.0, 0.2]];
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r)));
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(20,10,30,0.5)';
    ctx.lineWidth = r * 0.05;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.6); ctx.lineTo(-r * 0.2, -r * 0.3); ctx.lineTo(-r * 0.35, 0);
    ctx.moveTo(r * 0.5, r * 0.3); ctx.lineTo(r * 0.25, r * 0.55);
    ctx.stroke();
    ctx.shadowColor = '#d56bff';
    ctx.shadowBlur = r * 0.4;
    ctx.fillStyle = '#f0b3ff';
    ctx.fillRect(-r * 0.45, -r * 0.2, r * 0.3, r * 0.14);
    ctx.fillRect(r * 0.15, -r * 0.2, r * 0.3, r * 0.14);
    ctx.shadowBlur = 0;
    // こけ
    ctx.fillStyle = '#6a9a5a';
    ctx.beginPath();
    ctx.ellipse(r * 0.1, -r * 0.85, r * 0.35, r * 0.14, 0, 0, TAU);
    ctx.fill();
  },
  knight(ctx, r, col) {
    // マント
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, r * 0.9);
    ctx.lineTo(-r * 0.6, -r * 0.1);
    ctx.lineTo(r * 0.6, -r * 0.1);
    ctx.lineTo(r * 0.9, r * 0.9);
    ctx.closePath();
    ctx.fillStyle = '#6a1f4a';
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    // かぶと
    ctx.beginPath();
    ctx.arc(0, -r * 0.1, r * 0.75, Math.PI, 0);
    ctx.lineTo(r * 0.75, r * 0.45);
    ctx.lineTo(-r * 0.75, r * 0.45);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -r, 0, r * 0.5);
    g.addColorStop(0, '#8d86a8');
    g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#12091c';
    ctx.fillRect(-r * 0.55, -r * 0.05, r * 1.1, r * 0.22);
    ctx.shadowColor = '#ff3b6b';
    ctx.shadowBlur = r * 0.4;
    ctx.fillStyle = '#ff6b8e';
    ctx.fillRect(-r * 0.4, 0, r * 0.22, r * 0.1);
    ctx.fillRect(r * 0.18, 0, r * 0.22, r * 0.1);
    ctx.shadowBlur = 0;
    // はね
    ctx.fillStyle = '#b3246b';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.85);
    ctx.quadraticCurveTo(r * 0.6, -r * 1.4, r * 0.9, -r * 1.0);
    ctx.quadraticCurveTo(r * 0.4, -r * 1.0, 0, -r * 0.75);
    ctx.fill();
  },
  // ================================================ 第2章：使い回す異形（ステージの tint で色が変わる）
  spawn(ctx, r, col) {
    // 触手の粘体（スライムの役）
    for (let i = 0; i < 5; i++) tentacle(ctx, -r * 0.7 + i * r * 0.35, r * 0.4, -r * 0.8 + i * r * 0.4, r * 1.15, (i % 2 ? 1 : -1) * r * 0.25, r * 0.16, mix(col, '#000000', 0.25));
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.55);
    ctx.bezierCurveTo(-r * 1.15, -r * 0.5, -r * 0.4, -r * 1.05, r * 0.1, -r * 0.95);
    ctx.bezierCurveTo(r * 0.8, -r * 0.9, r * 1.15, -r * 0.2, r, r * 0.55);
    ctx.quadraticCurveTo(0, r * 0.85, -r, r * 0.55);
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.09;
    ctx.stroke();
    shine(ctx, r);
    oneEye(ctx, -r * 0.3, -r * 0.2, r * 0.26);
    oneEye(ctx, r * 0.35, -r * 0.35, r * 0.18);
    oneEye(ctx, r * 0.2, r * 0.2, r * 0.14);
  },
  byakhee(ctx, r, col, f) {
    // 羽の異形（コウモリの役）
    const up = f === 1;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.3, -r * 0.1);
      ctx.lineTo(s * r * 1.55, up ? -r * 1.0 : -r * 0.2);
      ctx.lineTo(s * r * 1.05, up ? -r * 0.35 : r * 0.35);
      ctx.lineTo(s * r * 1.25, up ? -r * 0.05 : r * 0.6);
      ctx.lineTo(s * r * 0.35, r * 0.35);
      ctx.closePath();
      ctx.fillStyle = mix(col, '#000000', 0.3);
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.08;
      ctx.stroke();
    }
    for (let i = 0; i < 4; i++) tentacle(ctx, -r * 0.2 + i * r * 0.13, r * 0.3, -r * 0.4 + i * r * 0.27, r * 1.05, (i % 2 ? 1 : -1) * r * 0.2, r * 0.08, mix(col, '#000000', 0.2));
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.45, r * 0.6, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.6, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    oneEye(ctx, 0, -r * 0.1, r * 0.28, '#ffd23d');
  },
  eyes(ctx, r, col) {
    // 目玉の群体（レイスの役）
    for (let i = 0; i < 4; i++) tentacle(ctx, -r * 0.4 + i * r * 0.27, r * 0.3, -r * 0.5 + i * r * 0.33, r * 1.2, (i % 2 ? 1 : -1) * r * 0.3, r * 0.1, mix(col, '#000000', 0.2));
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.8, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    oneEye(ctx, 0, -r * 0.05, r * 0.36, '#5ff0ff');
    oneEye(ctx, -r * 0.55, -r * 0.45, r * 0.22, '#5ff0ff');
    oneEye(ctx, r * 0.55, -r * 0.4, r * 0.24, '#5ff0ff');
    oneEye(ctx, -r * 0.45, r * 0.4, r * 0.17, '#5ff0ff');
    oneEye(ctx, r * 0.5, r * 0.35, r * 0.19, '#5ff0ff');
  },
  thorn(ctx, r, col) {
    // 棘の多肢球（ソーンコアの役）
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.2;
      tentacle(ctx, Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, Math.cos(a + 0.35) * r * 1.3, Math.sin(a + 0.35) * r * 1.3, r * 0.15, r * 0.14, mix(col, '#ff2d6a', 0.2));
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.78, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.8, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    // 口
    ctx.beginPath();
    ctx.arc(0, r * 0.1, r * 0.32, 0, TAU);
    ctx.fillStyle = '#12060e';
    ctx.fill();
    ctx.fillStyle = '#f2f2ff';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.32, r * 0.1 + Math.sin(a) * r * 0.32);
      ctx.lineTo(Math.cos(a) * r * 0.16, r * 0.1 + Math.sin(a) * r * 0.16);
      ctx.lineTo(Math.cos(a + 0.3) * r * 0.32, r * 0.1 + Math.sin(a + 0.3) * r * 0.32);
      ctx.fill();
    }
    oneEye(ctx, 0, -r * 0.45, r * 0.18, '#ff3d6a');
  },
  crawler(ctx, r, col) {
    // 這いずる肉塊（ゴーレムの役）
    ctx.strokeStyle = mix(col, '#000000', 0.35);
    ctx.lineWidth = r * 0.12;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.5, r * (-0.2 + i * 0.25));
      ctx.lineTo(s * r * 1.15, r * (-0.45 + i * 0.3));
      ctx.lineTo(s * r * 1.35, r * (0.0 + i * 0.3));
      ctx.stroke();
    }
    const pts = [[-0.95, 0.1], [-0.8, -0.6], [-0.3, -0.95], [0.3, -0.9], [0.85, -0.55], [1.0, 0.15], [0.7, 0.75], [0, 0.9], [-0.7, 0.75]];
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r)));
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.07;
    ctx.stroke();
    // こぶ
    ctx.fillStyle = mix(col, '#ffffff', 0.15);
    for (const [x, y, rr] of [[-0.45, -0.45, 0.22], [0.35, -0.55, 0.18], [0.55, 0.2, 0.15]]) {
      ctx.beginPath();
      ctx.arc(x * r, y * r, rr * r, 0, TAU);
      ctx.fill();
    }
    // 口
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, r * 0.25);
    ctx.quadraticCurveTo(0, r * 0.7, r * 0.45, r * 0.25);
    ctx.closePath();
    ctx.fillStyle = '#12060e';
    ctx.fill();
    ctx.fillStyle = '#f2f2ff';
    for (let i = 0; i < 4; i++) {
      const x = -r * 0.3 + i * r * 0.2;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.06, r * 0.28);
      ctx.lineTo(x, r * 0.42);
      ctx.lineTo(x + r * 0.06, r * 0.28);
      ctx.fill();
    }
    oneEye(ctx, -r * 0.1, -r * 0.2, r * 0.2, '#ff8a3d');
  },
  cultist(ctx, r, col) {
    // 黒衣の信徒（ダスクナイトの役）
    ctx.beginPath();
    ctx.moveTo(-r * 0.95, r * 0.95);
    ctx.quadraticCurveTo(-r * 0.75, -r * 0.2, -r * 0.45, -r * 0.55);
    ctx.quadraticCurveTo(0, -r * 1.35, r * 0.45, -r * 0.55);
    ctx.quadraticCurveTo(r * 0.75, -r * 0.2, r * 0.95, r * 0.95);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, mix(col, '#ffffff', 0.15));
    g.addColorStop(1, mix(col, '#000000', 0.45));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    // 頭巾の中の闇
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.35, r * 0.34, r * 0.3, 0, 0, TAU);
    ctx.fillStyle = '#05030a';
    ctx.fill();
    eyes(ctx, 0, -r * 0.35, r * 0.2, { color: '#b8ff5f', gap: 0.9 });
    // 袖から出る触手
    for (const s of [-1, 1]) tentacle(ctx, s * r * 0.6, r * 0.35, s * r * 1.2, r * 0.85, s * r * 0.3, r * 0.1, mix(col, '#7fffc0', 0.3));
    ctx.save();
    ctx.translate(0, r * 0.25);
    drawGem(ctx, r * 0.12, GEMS.obsidian);
    ctx.restore();
  },
  // ================================================ 第2章：ルルイエ
  starspawn(ctx, r, col) {
    // 落とし子：蛸の頭＋顔の触手＋小さな翼
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.4, -r * 0.2);
      ctx.lineTo(s * r * 1.4, -r * 0.9);
      ctx.lineTo(s * r * 1.15, -r * 0.2);
      ctx.lineTo(s * r * 1.35, r * 0.15);
      ctx.lineTo(s * r * 0.5, r * 0.2);
      ctx.closePath();
      ctx.fillStyle = mix(col, '#000000', 0.35);
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.06;
      ctx.stroke();
    }
    for (let i = 0; i < 5; i++) tentacle(ctx, -r * 0.35 + i * r * 0.18, r * 0.1, -r * 0.5 + i * r * 0.25, r * 1.2, (i % 2 ? 1 : -1) * r * 0.2, r * 0.12, mix(col, '#000000', 0.15));
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.35, r * 0.62, r * 0.72, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.8, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.07;
    ctx.stroke();
    shine(ctx, r * 0.7);
    eyes(ctx, 0, -r * 0.2, r * 0.22, { color: '#ffd23d', gap: 1.1 });
  },
  mindeye(ctx, r, col, f) {
    // 心を覗く目（遠距離）
    ctx.save();
    ctx.strokeStyle = f === 1 ? 'rgba(220,140,255,0.9)' : 'rgba(200,140,255,0.45)';
    ctx.lineWidth = r * 0.08;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, r * (1.05 + i * 0.25), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.95, r * 0.6, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    oneEye(ctx, 0, 0, r * 0.45, f === 1 ? '#ff5fd2' : '#c78bff');
  },
  shoggoth(ctx, r, col) {
    ENEMY_DRAW.spawn(ctx, r, col);
    oneEye(ctx, -r * 0.7, -r * 0.55, r * 0.12);
    oneEye(ctx, r * 0.7, -r * 0.1, r * 0.13);
    oneEye(ctx, -r * 0.1, -r * 0.7, r * 0.11);
    oneEye(ctx, -r * 0.65, r * 0.2, r * 0.1);
    ctx.save();
    ctx.translate(0, -r * 0.95);
    drawGem(ctx, r * 0.1, GEMS.obsidian);
    ctx.restore();
  },
  nightgaunt(ctx, r, col) {
    // 顔のない夜の飛行者
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.35, -r * 0.35);
      ctx.quadraticCurveTo(s * r * 1.2, -r * 1.4, s * r * 1.6, -r * 0.5);
      ctx.lineTo(s * r * 1.25, -r * 0.35);
      ctx.lineTo(s * r * 1.4, r * 0.05);
      ctx.lineTo(s * r * 1.0, -r * 0.05);
      ctx.lineTo(s * r * 1.05, r * 0.35);
      ctx.lineTo(s * r * 0.45, r * 0.2);
      ctx.closePath();
      ctx.fillStyle = mix(col, '#000000', 0.3);
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.05;
      ctx.stroke();
    }
    // しっぽ
    tentacle(ctx, 0, r * 0.6, r * 0.6, r * 1.3, -r * 0.5, r * 0.1, mix(col, '#000000', 0.2));
    // 胴
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, -r * 0.3);
    ctx.lineTo(r * 0.45, -r * 0.3);
    ctx.lineTo(r * 0.3, r * 0.75);
    ctx.lineTo(-r * 0.3, r * 0.75);
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r * 0.8, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.05;
    ctx.stroke();
    // 顔のない頭と角
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.15, -r * 0.8);
      ctx.quadraticCurveTo(s * r * 0.6, -r * 1.1, s * r * 0.5, -r * 1.45);
      ctx.quadraticCurveTo(s * r * 0.35, -r * 1.1, s * r * 0.05, -r * 0.85);
      ctx.fillStyle = '#d8d0e8';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.6, r * 0.3, r * 0.36, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.4, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.stroke();
  },
  cthulhu(ctx, r, col) {
    // 大いなる夢見る者：大きな翼＋蛸の頭＋顔の触手
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.5, -r * 0.3);
      ctx.quadraticCurveTo(s * r * 1.1, -r * 1.55, s * r * 1.65, -r * 1.1);
      ctx.lineTo(s * r * 1.35, -r * 0.7);
      ctx.lineTo(s * r * 1.6, -r * 0.35);
      ctx.lineTo(s * r * 1.2, -r * 0.3);
      ctx.lineTo(s * r * 1.35, r * 0.1);
      ctx.lineTo(s * r * 0.6, r * 0.15);
      ctx.closePath();
      ctx.fillStyle = mix(col, '#000000', 0.4);
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.04;
      ctx.stroke();
    }
    // 体
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, r * 1.1);
    ctx.quadraticCurveTo(-r * 0.9, r * 0.1, -r * 0.4, -r * 0.1);
    ctx.lineTo(r * 0.4, -r * 0.1);
    ctx.quadraticCurveTo(r * 0.9, r * 0.1, r * 0.8, r * 1.1);
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r, mix(col, '#000000', 0.2));
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.04;
    ctx.stroke();
    // 顔の触手
    for (let i = 0; i < 7; i++) tentacle(ctx, -r * 0.4 + i * r * 0.13, -r * 0.2, -r * 0.55 + i * r * 0.18, r * 0.75, (i % 2 ? 1 : -1) * r * 0.18, r * 0.09, mix(col, '#7fffc0', 0.15));
    // 頭
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.65, r * 0.55, r * 0.6, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.7, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.04;
    ctx.stroke();
    shine(ctx, r * 0.6);
    ctx.save();
    ctx.translate(0, -r * 1.12);
    drawGem(ctx, r * 0.1, GEMS.obsidian);
    ctx.restore();
    eyes(ctx, 0, -r * 0.55, r * 0.18, { color: '#ffd23d', gap: 1.2 });
  },
  // ================================================ 第2章：湖畔
  teapot(ctx, r, col, f) {
    // ティーポット・ミミック
    // 注ぎ口
    ctx.beginPath();
    ctx.moveTo(r * 0.7, 0);
    ctx.quadraticCurveTo(r * 1.3, -r * 0.1, r * 1.45, -r * 0.7);
    ctx.lineTo(r * 1.2, -r * 0.7);
    ctx.quadraticCurveTo(r * 1.05, -r * 0.2, r * 0.7, r * 0.3);
    ctx.closePath();
    ctx.fillStyle = mix(col, '#ffffff', 0.2);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.07;
    ctx.stroke();
    // 取っ手
    ctx.strokeStyle = mix(col, '#ffffff', 0.2);
    ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    ctx.arc(-r * 0.95, 0, r * 0.38, Math.PI * 0.5, Math.PI * 1.5);
    ctx.stroke();
    // 胴
    ctx.beginPath();
    ctx.ellipse(0, r * 0.05, r * 0.9, r * 0.75, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.07;
    ctx.stroke();
    // 金の帯
    ctx.strokeStyle = '#e8c860';
    ctx.lineWidth = r * 0.08;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.35, r * 0.82, r * 0.18, 0, 0.1, Math.PI - 0.1);
    ctx.stroke();
    // ふた（開くと牙）
    const open = f === 1;
    ctx.save();
    ctx.translate(0, -r * 0.62);
    if (open) ctx.rotate(-0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.55, r * 0.18, 0, Math.PI, 0);
    ctx.fillStyle = mix(col, '#ffffff', 0.25);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -r * 0.22, r * 0.1, 0, TAU);
    ctx.fillStyle = '#e8c860';
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#12060e';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.55, r * 0.42, r * 0.12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f2f2ff';
    for (let i = 0; i < 5; i++) {
      const x = -r * 0.32 + i * r * 0.16;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.05, -r * 0.52);
      ctx.lineTo(x, -r * 0.42);
      ctx.lineTo(x + r * 0.05, -r * 0.52);
      ctx.fill();
    }
    shine(ctx, r);
    eyes(ctx, 0, -r * 0.05, r * 0.22, { color: '#ffb84a' });
  },
  servant(ctx, r, col) {
    // グラーキの従者：棘に貫かれた屍
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, r * 1.0);
    ctx.lineTo(-r * 0.65, -r * 0.2);
    ctx.lineTo(r * 0.65, -r * 0.2);
    ctx.lineTo(r * 0.8, r * 1.0);
    ctx.closePath();
    ctx.fillStyle = mix(col, '#000000', 0.25);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.07;
    ctx.stroke();
    // だらりと下がった腕
    for (const s of [-1, 1]) tentacle(ctx, s * r * 0.6, -r * 0.1, s * r * 0.95, r * 0.75, s * r * 0.1, r * 0.16, mix(col, '#ffffff', 0.1));
    // 頭
    ctx.beginPath();
    ctx.arc(0, -r * 0.55, r * 0.48, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.6, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.stroke();
    // 胸を貫く棘
    ctx.strokeStyle = '#d8e0ff';
    ctx.lineWidth = r * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, r * 0.6);
    ctx.lineTo(r * 0.55, -r * 0.1);
    ctx.stroke();
    ctx.fillStyle = '#5a0a1a';
    ctx.beginPath();
    ctx.arc(r * 0.1, r * 0.25, r * 0.12, 0, TAU);
    ctx.fill();
    // うつろな目
    ctx.fillStyle = '#0b0610';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * r * 0.18, -r * 0.6, r * 0.1, r * 0.13, 0, 0, TAU);
      ctx.fill();
    }
    ctx.save();
    ctx.shadowColor = '#c8f0ff';
    ctx.shadowBlur = r * 0.3;
    ctx.fillStyle = '#c8f0ff';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * r * 0.18, -r * 0.6, r * 0.04, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },
  lady(ctx, r, col) {
    // 湖の貴婦人：ヴェールの亡霊
    ctx.globalAlpha = 0.93;
    ctx.beginPath();
    ctx.moveTo(-r * 1.1, r * 1.1);
    ctx.quadraticCurveTo(-r * 0.9, -r * 0.3, -r * 0.45, -r * 0.7);
    ctx.quadraticCurveTo(0, -r * 1.25, r * 0.45, -r * 0.7);
    ctx.quadraticCurveTo(r * 0.9, -r * 0.3, r * 1.1, r * 1.1);
    for (let i = 0; i < 5; i++) {
      const x0 = r * 1.1 - (i * 2.2 * r) / 5;
      ctx.quadraticCurveTo(x0 - r * 0.22, r * 0.8, x0 - r * 0.44, r * 1.1);
    }
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r * 1.1, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.04;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // ヴェールの縁
    ctx.strokeStyle = 'rgba(240,240,255,0.5)';
    ctx.lineWidth = r * 0.03;
    ctx.beginPath();
    ctx.arc(0, -r * 0.35, r * 0.55, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    // 顔の影
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.35, r * 0.3, r * 0.36, 0, 0, TAU);
    ctx.fillStyle = 'rgba(10,8,20,0.8)';
    ctx.fill();
    eyes(ctx, 0, -r * 0.35, r * 0.14, { color: '#c8f0ff', angry: false, gap: 1.0 });
    // ティーカップ
    ctx.save();
    ctx.translate(r * 0.55, r * 0.3);
    ctx.fillStyle = '#f4f0e6';
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, -r * 0.1);
    ctx.lineTo(r * 0.2, -r * 0.1);
    ctx.quadraticCurveTo(r * 0.18, r * 0.12, 0, r * 0.14);
    ctx.quadraticCurveTo(-r * 0.18, r * 0.12, -r * 0.2, -r * 0.1);
    ctx.fill();
    ctx.fillStyle = '#e8c860';
    ctx.fillRect(-r * 0.2, -r * 0.1, r * 0.4, r * 0.03);
    ctx.restore();
    ctx.save();
    ctx.translate(0, -r * 0.95);
    drawGem(ctx, r * 0.09, GEMS.obsidian);
    ctx.restore();
  },
  kelpie(ctx, r, col) {
    // ケルピー：湖の水馬（首から上）
    // たてがみ（海藻）
    for (let i = 0; i < 6; i++) tentacle(ctx, -r * 0.15, -r * 0.9 + i * r * 0.28, -r * 0.95 - (i % 2) * r * 0.2, -r * 0.6 + i * r * 0.32, -r * 0.2, r * 0.13, mix(col, '#3fe08a', 0.4));
    // 首
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, r * 1.1);
    ctx.quadraticCurveTo(-r * 0.5, -r * 0.3, -r * 0.1, -r * 0.95);
    ctx.lineTo(r * 0.45, -r * 0.7);
    ctx.quadraticCurveTo(r * 0.2, r * 0.1, r * 0.6, r * 1.1);
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.04;
    ctx.stroke();
    // 頭
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, -r * 1.05);
    ctx.quadraticCurveTo(r * 0.3, -r * 1.35, r * 0.6, -r * 1.0);
    ctx.lineTo(r * 1.3, -r * 0.55);
    ctx.quadraticCurveTo(r * 1.4, -r * 0.25, r * 1.05, -r * 0.25);
    ctx.lineTo(r * 0.35, -r * 0.45);
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r * 0.8, col);
    ctx.fill();
    ctx.stroke();
    // 耳
    ctx.beginPath();
    ctx.moveTo(-r * 0.05, -r * 1.1);
    ctx.lineTo(-r * 0.1, -r * 1.45);
    ctx.lineTo(r * 0.2, -r * 1.2);
    ctx.fillStyle = col;
    ctx.fill();
    // 鼻の穴と目
    ctx.fillStyle = '#0b0610';
    ctx.beginPath();
    ctx.arc(r * 1.15, -r * 0.42, r * 0.05, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.shadowColor = '#5fffe0';
    ctx.shadowBlur = r * 0.2;
    ctx.fillStyle = '#5fffe0';
    ctx.beginPath();
    ctx.ellipse(r * 0.45, -r * 0.85, r * 0.1, r * 0.06, -0.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  },
  glaaki(ctx, r, col) {
    // グラーキ：棘だらけのナメクジのような湖の主。柄の先に 3 つの目
    // 棘
    ctx.strokeStyle = '#d8e0ff';
    ctx.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const a = Math.PI + (i / 15) * Math.PI;
      const x0 = Math.cos(a) * r * 0.95, y0 = Math.sin(a) * r * 0.65 + r * 0.1;
      ctx.lineWidth = r * 0.04;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 * 1.35, y0 * 1.45 - r * 0.1);
      ctx.stroke();
    }
    // 胴
    ctx.beginPath();
    ctx.ellipse(0, r * 0.1, r * 1.0, r * 0.72, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 1.1, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.04;
    ctx.stroke();
    shine(ctx, r);
    // 厚い唇の口
    ctx.beginPath();
    ctx.ellipse(0, r * 0.45, r * 0.4, r * 0.16, 0, 0, TAU);
    ctx.fillStyle = mix(col, '#ff5a8a', 0.4);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, r * 0.45, r * 0.3, r * 0.07, 0, 0, TAU);
    ctx.fillStyle = '#12060e';
    ctx.fill();
    // 目の柄
    for (const [x, h] of [[-0.45, 0.95], [0, 1.2], [0.45, 0.95]]) {
      ctx.strokeStyle = mix(col, '#000000', 0.2);
      ctx.lineWidth = r * 0.1;
      ctx.beginPath();
      ctx.moveTo(x * r, -r * 0.3);
      ctx.lineTo(x * r * 1.1, -r * h);
      ctx.stroke();
      oneEye(ctx, x * r * 1.1, -r * h, r * 0.16, '#ffd23d');
    }
    ctx.save();
    ctx.translate(0, r * 0.05);
    drawGem(ctx, r * 0.12, GEMS.obsidian);
    ctx.restore();
  },
  // ================================================ 第2章：カルコサ
  yellowsign(ctx, r, col, f) {
    // 黄の印：浮かぶ印章（三つ巴の鉤）
    ctx.save();
    ctx.shadowColor = '#ffd24a';
    ctx.shadowBlur = r * (f === 1 ? 0.9 : 0.5);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#1a1206';
    ctx.lineWidth = r * 0.14;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, Math.cos(a + 1.1) * r * 0.62, Math.sin(a + 1.1) * r * 0.62);
      ctx.stroke();
    }
    oneEye(ctx, 0, 0, r * 0.2, f === 1 ? '#ff3d3d' : '#ffd23d');
  },
  masked(ctx, r, col) {
    // 仮面の貴族
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, r * 1.0);
    ctx.lineTo(-r * 0.55, -r * 0.1);
    ctx.lineTo(r * 0.55, -r * 0.1);
    ctx.lineTo(r * 0.9, r * 1.0);
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.07;
    ctx.stroke();
    // ひだ襟
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(i * r * 0.14, -r * 0.1, r * 0.1, r * 0.14, 0, 0, TAU);
      ctx.fillStyle = '#f4f0e6';
      ctx.fill();
    }
    // 仮面
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.6, r * 0.42, r * 0.48, 0, 0, TAU);
    ctx.fillStyle = '#ece6d6';
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.06;
    ctx.stroke();
    ctx.fillStyle = '#0b0610';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * r * 0.17, -r * 0.66, r * 0.1, r * 0.06, s * 0.3, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(40,20,20,0.6)';
    ctx.lineWidth = r * 0.04;
    ctx.beginPath();
    ctx.arc(0, -r * 0.42, r * 0.12, 0.2, Math.PI - 0.2);
    ctx.stroke();
    // 羽飾り
    ctx.beginPath();
    ctx.moveTo(r * 0.2, -r * 1.0);
    ctx.quadraticCurveTo(r * 0.7, -r * 1.5, r * 0.95, -r * 1.1);
    ctx.quadraticCurveTo(r * 0.55, -r * 1.1, r * 0.25, -r * 0.9);
    ctx.fillStyle = '#ffd24a';
    ctx.fill();
  },
  kingyellow(ctx, r, col) {
    // 黄衣の王：ぼろぼろの黄色い外套と、青白い仮面
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.6);
    ctx.quadraticCurveTo(-r * 1.4, -r * 0.2, -r * 1.35, r * 1.05);
    for (let i = 0; i < 7; i++) {
      const x0 = -r * 1.35 + (i * 2.7 * r) / 7;
      ctx.lineTo(x0 + r * 0.19, r * (0.7 + (i % 2) * 0.25));
      ctx.lineTo(x0 + (2.7 * r) / 7, r * 1.05);
    }
    ctx.quadraticCurveTo(r * 1.4, -r * 0.2, r * 0.5, -r * 0.6);
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r * 1.3, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.04;
    ctx.stroke();
    // 外套の裂け目
    ctx.strokeStyle = 'rgba(60,40,0,0.45)';
    ctx.lineWidth = r * 0.03;
    for (const x of [-0.6, -0.2, 0.25, 0.65]) {
      ctx.beginPath();
      ctx.moveTo(x * r, 0);
      ctx.lineTo(x * r * 1.1, r * 0.8);
      ctx.stroke();
    }
    // 頭巾
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, -r * 0.4);
    ctx.quadraticCurveTo(-r * 0.6, -r * 1.35, 0, -r * 1.45);
    ctx.quadraticCurveTo(r * 0.6, -r * 1.35, r * 0.55, -r * 0.4);
    ctx.closePath();
    ctx.fillStyle = mix(col, '#000000', 0.2);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.stroke();
    // 青白い仮面
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.82, r * 0.3, r * 0.36, 0, 0, TAU);
    ctx.fillStyle = '#e8e4f0';
    ctx.fill();
    ctx.fillStyle = '#0b0610';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * r * 0.12, -r * 0.88, r * 0.06, r * 0.035, 0, 0, TAU);
      ctx.fill();
    }
    // 胸の黄の印
    ctx.save();
    ctx.translate(0, r * 0.05);
    ENEMY_DRAW.yellowsign(ctx, r * 0.28, '#ffd24a', 0);
    ctx.restore();
  },
  // ================================================ 第2章：宇宙
  hal(ctx, r, col, f) {
    // H.A.L.ドローン：赤い単眼の機械
    ctx.strokeStyle = mix(col, '#ffffff', 0.3);
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.8);
    ctx.lineTo(0, -r * 1.3);
    ctx.stroke();
    ctx.fillStyle = '#ff3d3d';
    ctx.beginPath();
    ctx.arc(0, -r * 1.33, r * 0.09, 0, TAU);
    ctx.fill();
    for (const s of [-1, 1]) {
      ctx.fillStyle = mix(col, '#000000', 0.3);
      ctx.fillRect(s * r * 0.95 - r * 0.2, -r * 0.15, r * 0.4, r * 0.3);
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.07;
    ctx.stroke();
    // レンズ
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.5, 0, TAU);
    ctx.fillStyle = '#0b0610';
    ctx.fill();
    ctx.save();
    const lit = f === 1;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.42);
    g.addColorStop(0, '#fff2a0');
    g.addColorStop(0.25, lit ? '#ff5a3d' : '#ff2d2d');
    g.addColorStop(1, 'rgba(120,0,0,0.9)');
    ctx.shadowColor = '#ff2d2d';
    ctx.shadowBlur = r * (lit ? 0.9 : 0.5);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  },
  migo(ctx, r, col) {
    // ミ＝ゴ：膜の翼を持つ甲殻の菌類。頭は渦巻く楕円
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.3, -r * 0.2);
      ctx.quadraticCurveTo(s * r * 1.5, -r * 1.2, s * r * 1.45, r * 0.1);
      ctx.quadraticCurveTo(s * r * 0.9, -r * 0.1, s * r * 0.35, r * 0.2);
      ctx.closePath();
      ctx.fillStyle = 'rgba(210,170,230,0.45)';
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.05;
      ctx.stroke();
    }
    ctx.strokeStyle = mix(col, '#000000', 0.25);
    ctx.lineWidth = r * 0.09;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.3, r * (0.2 + i * 0.2));
      ctx.lineTo(s * r * 0.8, r * (0.45 + i * 0.25));
      ctx.lineTo(s * r * 0.75, r * (0.85 + i * 0.2));
      ctx.stroke();
    }
    // 胴（甲殻の節）
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, r * (0.1 + i * 0.3), r * (0.42 - i * 0.08), r * 0.18, 0, 0, TAU);
      ctx.fillStyle = mix(col, '#000000', i * 0.12);
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.04;
      ctx.stroke();
    }
    // 頭（渦巻き）
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.45, r * 0.42, r * 0.5, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.6, mix(col, '#ff9ad2', 0.3));
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.05;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(80,20,60,0.6)';
    ctx.lineWidth = r * 0.05;
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const a = i * 0.7, rr = r * 0.03 + i * r * 0.018;
      ctx.lineTo(Math.cos(a) * rr, -r * 0.45 + Math.sin(a) * rr * 1.1);
    }
    ctx.stroke();
    // 触角
    for (const s of [-1, 1]) tentacle(ctx, s * r * 0.2, -r * 0.9, s * r * 0.55, -r * 1.3, s * r * 0.1, r * 0.06, mix(col, '#ff9ad2', 0.4));
  },
  monolith(ctx, r, col) {
    // 黒き石板（ニャルラトホテプ）：燃える三裂の目
    ctx.save();
    ctx.shadowColor = '#b45cff';
    ctx.shadowBlur = r * 0.35;
    ctx.fillStyle = '#05030a';
    ctx.fillRect(-r * 0.55, -r * 1.3, r * 1.1, r * 2.5);
    ctx.restore();
    const g = ctx.createLinearGradient(-r * 0.55, 0, r * 0.55, 0);
    g.addColorStop(0, 'rgba(180,92,255,0.25)');
    g.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(180,92,255,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(-r * 0.55, -r * 1.3, r * 1.1, r * 2.5);
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.04;
    ctx.strokeRect(-r * 0.55, -r * 1.3, r * 1.1, r * 2.5);
    // 三裂の目
    ctx.save();
    ctx.translate(0, -r * 0.35);
    ctx.shadowColor = '#ff3d3d';
    ctx.shadowBlur = r * 0.6;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU - Math.PI / 2;
      ctx.fillStyle = i ? '#ff5a2d' : '#ffb84a';
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r * 0.16, Math.sin(a) * r * 0.16, r * 0.17, r * 0.1, a, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#fff2a0';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.07, 0, TAU);
    ctx.fill();
    ctx.restore();
    // 石板の刻み
    ctx.strokeStyle = 'rgba(180,92,255,0.35)';
    ctx.lineWidth = r * 0.02;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.35, r * (0.25 + i * 0.22));
      ctx.lineTo(r * 0.35, r * (0.25 + i * 0.22));
      ctx.stroke();
    }
  },
  // ================================================ 第2章：宇宙の中心
  piper(ctx, r, col, f) {
    // 奏者：顔のない細長い影がフルートを吹く
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, r * 1.1);
    ctx.quadraticCurveTo(-r * 0.55, -r * 0.2, -r * 0.3, -r * 0.7);
    ctx.quadraticCurveTo(0, -r * 1.3, r * 0.3, -r * 0.7);
    ctx.quadraticCurveTo(r * 0.55, -r * 0.2, r * 0.7, r * 1.1);
    for (let i = 0; i < 4; i++) {
      const x0 = r * 0.7 - (i * 1.4 * r) / 4;
      ctx.quadraticCurveTo(x0 - r * 0.17, r * 0.8, x0 - r * 0.35, r * 1.1);
    }
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.06;
    ctx.stroke();
    // 顔のない頭
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.55, r * 0.26, r * 0.3, 0, 0, TAU);
    ctx.fillStyle = '#05030a';
    ctx.fill();
    // フルート
    ctx.save();
    ctx.translate(0, -r * 0.3);
    ctx.rotate(-0.5);
    ctx.fillStyle = '#d8c8a0';
    ctx.fillRect(-r * 0.1, -r * 0.06, r * 1.2, r * 0.12);
    ctx.fillStyle = '#3a2a1a';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(r * (0.25 + i * 0.22), 0, r * 0.03, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // 音の輪
    ctx.strokeStyle = f === 1 ? 'rgba(160,255,220,0.9)' : 'rgba(160,255,220,0.45)';
    ctx.lineWidth = r * 0.05;
    ctx.beginPath();
    ctx.arc(r * 1.0, -r * 0.95, r * 0.2, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 1.2, -r * 1.2, r * 0.12, 0, TAU);
    ctx.stroke();
    eyes(ctx, 0, -r * 0.55, r * 0.12, { color: '#9fffe0', angry: false, gap: 1.0 });
  },
  flutist(ctx, r, col, f) {
    // 下位の奏者（遠距離）
    ENEMY_DRAW.piper(ctx, r, col, f);
  },
  azathoth(ctx, r, col, f) {
    // アザトース：泡立つ混沌の塊。f=0 眠り（目を閉じる）、f=1 目覚め（無数の目が開く）
    const awake = f === 1;
    // 触手
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + 0.2;
      tentacle(ctx, Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.6, Math.cos(a + 0.4) * r * 1.5, Math.sin(a + 0.4) * r * 1.4, r * 0.3, r * 0.12, mix(col, awake ? '#ff5fd2' : '#000000', 0.35));
    }
    // 泡の塊
    const blobs = [[0, 0, 0.95], [-0.55, -0.35, 0.5], [0.55, -0.4, 0.48], [-0.6, 0.35, 0.45], [0.6, 0.4, 0.46], [0, -0.7, 0.42], [0, 0.72, 0.4]];
    for (const [x, y, rr] of blobs) {
      ctx.beginPath();
      ctx.arc(x * r, y * r, rr * r, 0, TAU);
      ctx.fillStyle = bodyGrad(ctx, rr * r, col);
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.03;
      ctx.stroke();
    }
    // 宇宙の色のにじみ
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, c] of [[-0.3, -0.2, '#6a3aff'], [0.35, 0.25, '#ff3d9a'], [0, 0.4, '#3fe0ff']]) {
      const g = ctx.createRadialGradient(x * r, y * r, 0, x * r, y * r, r * 0.6);
      g.addColorStop(0, rgba(c, awake ? 0.45 : 0.22));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x * r, y * r, r * 0.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // 目
    const eyesAt = [[0, -0.05, 0.28], [-0.55, -0.35, 0.16], [0.55, -0.4, 0.15], [-0.6, 0.35, 0.13], [0.6, 0.4, 0.14], [0, -0.7, 0.12], [0, 0.72, 0.12], [-0.3, 0.35, 0.09], [0.3, -0.45, 0.09]];
    for (const [x, y, s] of eyesAt) {
      if (awake) oneEye(ctx, x * r, y * r, s * r, '#ff3d9a');
      else {
        ctx.strokeStyle = 'rgba(20,0,30,0.8)';
        ctx.lineWidth = r * 0.03;
        ctx.beginPath();
        ctx.arc(x * r, y * r - s * r * 0.3, s * r, 0.35, Math.PI - 0.35);
        ctx.stroke();
      }
    }
  },
  // ================================================ 第2章：深海
  jelly(ctx, r, col) {
    // 触手
    ctx.strokeStyle = mix(col, '#ffffff', 0.35);
    ctx.lineWidth = r * 0.11;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const x = -r * 0.6 + i * r * 0.4;
      ctx.beginPath();
      ctx.moveTo(x, r * 0.2);
      ctx.quadraticCurveTo(x + r * 0.25, r * 0.6, x, r * 0.95);
      ctx.quadraticCurveTo(x - r * 0.2, r * 1.2, x + r * 0.05, r * 1.4);
      ctx.stroke();
    }
    // かさ
    ctx.globalAlpha = 0.93;
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.25);
    ctx.bezierCurveTo(-r * 1.05, -r * 0.95, r * 1.05, -r * 0.95, r, r * 0.25);
    for (let i = 0; i < 5; i++) {
      const x0 = r - (i * 2 * r) / 5;
      ctx.quadraticCurveTo(x0 - r * 0.2, r * 0.48, x0 - r * 0.4, r * 0.25);
    }
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.09;
    ctx.stroke();
    ctx.globalAlpha = 1;
    shine(ctx, r);
    eyes(ctx, 0, -r * 0.12, r * 0.3, { color: '#5ff0ff', angry: false });
  },
  eel(ctx, r, col) {
    // 頭が上、体はうねりながら下へ
    const segs = 8;
    for (let i = segs; i >= 1; i--) {
      const t = i / segs;
      const x = Math.sin(t * 5.2) * r * 0.45;
      const y = -r * 0.35 + t * r * 1.75;
      const rr = r * 0.5 * (1 - t * 0.7);
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, TAU);
      ctx.fillStyle = mix(col, '#000000', 0.15 + t * 0.25);
      ctx.fill();
    }
    // 背びれ
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.05);
    ctx.quadraticCurveTo(r * 0.5, -r * 0.9, r * 0.45, -r * 0.3);
    ctx.lineTo(r * 0.2, -r * 0.4);
    ctx.closePath();
    ctx.fillStyle = mix(col, '#7fffe0', 0.35);
    ctx.fill();
    // 頭
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.4, r * 0.6, r * 0.65, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.7, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.09;
    ctx.stroke();
    // 口
    ctx.strokeStyle = 'rgba(10,20,30,0.8)';
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.05);
    ctx.quadraticCurveTo(0, r * 0.08, r * 0.3, -r * 0.05);
    ctx.stroke();
    eyes(ctx, 0, -r * 0.45, r * 0.24, { color: '#b8ff5f', gap: 1.1 });
  },
  angler(ctx, r, col, f) {
    // ちょうちん
    const lit = f === 1;
    ctx.strokeStyle = mix(col, '#ffffff', 0.25);
    ctx.lineWidth = r * 0.09;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.8);
    ctx.quadraticCurveTo(r * 0.2, -r * 1.4, r * 0.75, -r * 1.12);
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = '#fff27a';
    ctx.shadowBlur = r * (lit ? 1.2 : 0.6);
    ctx.fillStyle = lit ? '#ffffff' : '#fff27a';
    ctx.beginPath();
    ctx.arc(r * 0.75, -r * 1.08, r * (lit ? 0.24 : 0.2), 0, TAU);
    ctx.fill();
    ctx.restore();
    // ひれ
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.8, r * 0.1);
      ctx.lineTo(s * r * 1.35, -r * 0.2);
      ctx.lineTo(s * r * 1.25, r * 0.45);
      ctx.closePath();
      ctx.fillStyle = mix(col, '#000000', 0.2);
      ctx.fill();
    }
    // からだ
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.95, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    // 口と牙
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, r * 0.15);
    ctx.quadraticCurveTo(0, r * 0.95, r * 0.7, r * 0.15);
    ctx.quadraticCurveTo(0, r * 0.45, -r * 0.7, r * 0.15);
    ctx.fillStyle = '#12060e';
    ctx.fill();
    ctx.fillStyle = '#f2f2ff';
    for (let i = 0; i < 5; i++) {
      const x = -r * 0.5 + i * r * 0.25;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.07, r * 0.3);
      ctx.lineTo(x, r * 0.5);
      ctx.lineTo(x + r * 0.07, r * 0.3);
      ctx.fill();
    }
    shine(ctx, r);
    eyes(ctx, 0, -r * 0.3, r * 0.22, { color: '#fff27a' });
  },
  squid(ctx, r, col, f) {
    // 足
    ctx.strokeStyle = mix(col, '#000000', 0.1);
    ctx.lineWidth = r * 0.16;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const x = -r * 0.55 + i * r * 0.22;
      const w = (i % 2 ? 1 : -1) * r * 0.18;
      ctx.beginPath();
      ctx.moveTo(x, r * 0.35);
      ctx.quadraticCurveTo(x + w, r * 0.9, x - w * 0.5, r * 1.35);
      ctx.stroke();
    }
    // えんぺら
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.3, -r * 1.05);
      ctx.lineTo(s * r * 1.0, -r * 0.8);
      ctx.lineTo(s * r * 0.5, -r * 0.35);
      ctx.closePath();
      ctx.fillStyle = mix(col, '#ffffff', 0.15);
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.06;
      ctx.stroke();
    }
    // 胴
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.4);
    ctx.quadraticCurveTo(r * 0.8, -r * 0.6, r * 0.65, r * 0.45);
    ctx.quadraticCurveTo(0, r * 0.65, -r * 0.65, r * 0.45);
    ctx.quadraticCurveTo(-r * 0.8, -r * 0.6, 0, -r * 1.4);
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    shine(ctx, r * 0.9);
    eyes(ctx, 0, r * 0.05, r * 0.28, { color: f === 1 ? '#ff3d6a' : '#ffd23d', gap: 1.0 });
  },
  crab(ctx, r, col) {
    // あし
    ctx.strokeStyle = mix(col, '#000000', 0.3);
    ctx.lineWidth = r * 0.1;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.6, r * (0.1 + i * 0.2));
      ctx.lineTo(s * r * 1.15, r * (0.2 + i * 0.25));
      ctx.lineTo(s * r * 1.3, r * (0.6 + i * 0.2));
      ctx.stroke();
    }
    // はさみ
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * r * 1.05, -r * 0.65, r * 0.42, 0, TAU);
      ctx.fillStyle = bodyGrad(ctx, r * 0.5, col);
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.07;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * r * 1.05, -r * 0.65);
      ctx.lineTo(s * r * 1.35, -r * 1.05);
      ctx.lineTo(s * r * 0.85, -r * 1.02);
      ctx.closePath();
      ctx.fillStyle = '#0b0610';
      ctx.fill();
    }
    // こうら
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.95, r * 0.7, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = r * 0.05;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, r * 0.15);
    ctx.quadraticCurveTo(0, r * 0.4, r * 0.5, r * 0.15);
    ctx.stroke();
    shine(ctx, r);
    // 目（柄の先）
    for (const s of [-1, 1]) {
      ctx.strokeStyle = mix(col, '#000000', 0.3);
      ctx.lineWidth = r * 0.08;
      ctx.beginPath();
      ctx.moveTo(s * r * 0.25, -r * 0.55);
      ctx.lineTo(s * r * 0.3, -r * 0.9);
      ctx.stroke();
    }
    eyes(ctx, 0, -r * 0.92, r * 0.2, { color: '#ff8a3d', angry: false, gap: 1.5 });
  },
  deepone(ctx, r, col) {
    // 背びれ
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, -r * 1.35);
    ctx.lineTo(r * 0.1, -r * 1.05);
    ctx.lineTo(r * 0.35, -r * 1.3);
    ctx.lineTo(r * 0.45, -r * 0.85);
    ctx.lineTo(-r * 0.45, -r * 0.85);
    ctx.closePath();
    ctx.fillStyle = mix(col, '#7fffc0', 0.3);
    ctx.fill();
    // 肩と腕
    ctx.beginPath();
    ctx.moveTo(-r * 1.1, r * 0.9);
    ctx.quadraticCurveTo(-r * 1.1, -r * 0.1, -r * 0.5, -r * 0.2);
    ctx.lineTo(r * 0.5, -r * 0.2);
    ctx.quadraticCurveTo(r * 1.1, -r * 0.1, r * 1.1, r * 0.9);
    ctx.closePath();
    ctx.fillStyle = mix(col, '#000000', 0.2);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.07;
    ctx.stroke();
    // うろこ
    ctx.strokeStyle = 'rgba(160,255,220,0.25)';
    ctx.lineWidth = r * 0.04;
    for (let j = 0; j < 2; j++) for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(i * r * 0.32, r * (0.25 + j * 0.3), r * 0.16, 0, Math.PI);
      ctx.stroke();
    }
    // 頭
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.45, r * 0.62, r * 0.55, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.7, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    // えら
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = r * 0.05;
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(s * r * (0.42 + i * 0.08), -r * 0.35);
      ctx.lineTo(s * r * (0.38 + i * 0.08), -r * 0.15);
      ctx.stroke();
    }
    // 口
    ctx.strokeStyle = '#0b0610';
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.18);
    ctx.lineTo(r * 0.3, -r * 0.18);
    ctx.stroke();
    eyes(ctx, 0, -r * 0.5, r * 0.26, { color: '#b8ff5f', angry: false, gap: 1.05 });
  },
  motherjelly(ctx, r, col) {
    ENEMY_DRAW.jelly(ctx, r, col);
    // 中で光る器官
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      const x = Math.cos(a) * r * 0.42, y = -r * 0.35 + Math.sin(a) * r * 0.18;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 0.22);
      g.addColorStop(0, 'rgba(255,170,240,0.5)');
      g.addColorStop(1, 'rgba(255,120,220,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.22, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // かんむり（宝石）
    ctx.save();
    ctx.translate(0, -r * 0.78);
    drawGem(ctx, r * 0.12, GEMS.obsidian);
    ctx.restore();
  },
  serpent(ctx, r, col) {
    // とぐろ
    for (let i = 0; i < 3; i++) {
      const y = r * (0.75 - i * 0.28), w = r * (1.05 - i * 0.2);
      ctx.beginPath();
      ctx.ellipse(0, y, w, r * 0.26, 0, 0, TAU);
      ctx.fillStyle = mix(col, '#000000', 0.1 + i * 0.1);
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.05;
      ctx.stroke();
    }
    // 首
    ctx.beginPath();
    ctx.moveTo(-r * 0.25, r * 0.2);
    ctx.quadraticCurveTo(-r * 0.45, -r * 0.5, 0, -r * 0.75);
    ctx.quadraticCurveTo(r * 0.45, -r * 0.5, r * 0.25, r * 0.2);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    // ひれの冠
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.25, -r * 1.0);
      ctx.lineTo(s * r * 0.95, -r * 1.35);
      ctx.lineTo(s * r * 0.75, -r * 0.95);
      ctx.lineTo(s * r * 1.05, -r * 0.75);
      ctx.lineTo(s * r * 0.4, -r * 0.7);
      ctx.closePath();
      ctx.fillStyle = mix(col, '#5fffe0', 0.35);
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.04;
      ctx.stroke();
    }
    // 頭
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.95, r * 0.5, r * 0.42, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.6, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.05;
    ctx.stroke();
    eyes(ctx, 0, -r * 1.0, r * 0.18, { color: '#ff3d6a' });
  },
  dagon(ctx, r, col) {
    // 背びれの冠
    for (let i = -3; i <= 3; i++) {
      const x = i * r * 0.2;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.1, -r * 0.8);
      ctx.lineTo(x + i * r * 0.05, -r * (1.35 - Math.abs(i) * 0.1));
      ctx.lineTo(x + r * 0.1, -r * 0.8);
      ctx.closePath();
      ctx.fillStyle = mix(col, '#5fffe0', 0.3);
      ctx.fill();
    }
    // 肩と体
    ctx.beginPath();
    ctx.moveTo(-r * 1.3, r * 1.05);
    ctx.quadraticCurveTo(-r * 1.35, -r * 0.2, -r * 0.6, -r * 0.35);
    ctx.lineTo(r * 0.6, -r * 0.35);
    ctx.quadraticCurveTo(r * 1.35, -r * 0.2, r * 1.3, r * 1.05);
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r * 1.2, mix(col, '#000000', 0.15));
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.06;
    ctx.stroke();
    // うろこ
    ctx.strokeStyle = 'rgba(140,255,220,0.22)';
    ctx.lineWidth = r * 0.03;
    for (let j = 0; j < 3; j++) for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(i * r * 0.3 + (j % 2) * r * 0.15, r * (0.1 + j * 0.28), r * 0.14, 0, Math.PI);
      ctx.stroke();
    }
    // 胸の宝石
    ctx.save();
    ctx.translate(0, r * 0.35);
    drawGem(ctx, r * 0.16, GEMS.obsidian);
    ctx.restore();
    // 頭
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.5, r * 0.62, r * 0.5, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.7, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.05;
    ctx.stroke();
    // 大きな口
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, -r * 0.3);
    ctx.quadraticCurveTo(0, -r * 0.05, r * 0.42, -r * 0.3);
    ctx.quadraticCurveTo(0, -r * 0.18, -r * 0.42, -r * 0.3);
    ctx.fillStyle = '#0b0610';
    ctx.fill();
    // ひげ
    ctx.strokeStyle = mix(col, '#5fffe0', 0.3);
    ctx.lineWidth = r * 0.05;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.4, -r * 0.3);
      ctx.quadraticCurveTo(s * r * 0.75, -r * 0.1, s * r * 0.6, r * 0.2);
      ctx.stroke();
    }
    eyes(ctx, 0, -r * 0.6, r * 0.2, { color: '#5fffe0', gap: 1.3 });
  },
  boss1(ctx, r, col) {
    ENEMY_DRAW.slime(ctx, r, col);
    // おうかん
    ctx.save();
    ctx.translate(0, -r * 0.95);
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, r * 0.15);
    ctx.lineTo(-r * 0.55, -r * 0.35);
    ctx.lineTo(-r * 0.25, -r * 0.1);
    ctx.lineTo(0, -r * 0.45);
    ctx.lineTo(r * 0.25, -r * 0.1);
    ctx.lineTo(r * 0.55, -r * 0.35);
    ctx.lineTo(r * 0.5, r * 0.15);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -r * 0.4, 0, r * 0.15);
    g.addColorStop(0, '#fff3a0');
    g.addColorStop(1, '#d99a00');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#6b4300';
    ctx.lineWidth = r * 0.04;
    ctx.stroke();
    ctx.translate(0, -r * 0.02);
    drawGem(ctx, r * 0.1, GEMS.obsidian);
    ctx.restore();
  },
  boss2(ctx, r, col) {
    // つばさ
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.4, -r * 0.3);
      ctx.quadraticCurveTo(s * r * 1.3, -r * 1.3, s * r * 1.6, -r * 0.6);
      ctx.lineTo(s * r * 1.3, -r * 0.3);
      ctx.lineTo(s * r * 1.45, r * 0.05);
      ctx.lineTo(s * r * 1.1, -r * 0.05);
      ctx.lineTo(s * r * 1.15, r * 0.35);
      ctx.lineTo(s * r * 0.5, r * 0.2);
      ctx.closePath();
      ctx.fillStyle = '#4a2d7a';
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.06;
      ctx.stroke();
    }
    // つの
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.3, -r * 0.7);
      ctx.quadraticCurveTo(s * r * 0.5, -r * 1.3, s * r * 0.75, -r * 1.25);
      ctx.quadraticCurveTo(s * r * 0.55, -r * 1.0, s * r * 0.55, -r * 0.6);
      ctx.fillStyle = '#e8d9ff';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.8, r * 0.85, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.07;
    ctx.stroke();
    // おなか
    ctx.beginPath();
    ctx.ellipse(0, r * 0.35, r * 0.45, r * 0.35, 0, 0, TAU);
    ctx.fillStyle = '#7d63b0';
    ctx.fill();
    shine(ctx, r * 0.8);
    eyes(ctx, 0, -r * 0.2, r * 0.24, { color: '#ffd23d' });
  },
  boss3(ctx, r, col) {
    // ドレス
    ctx.beginPath();
    ctx.moveTo(-r * 1.0, r * 1.0);
    ctx.quadraticCurveTo(-r * 0.4, r * 0.1, -r * 0.35, -r * 0.2);
    ctx.lineTo(r * 0.35, -r * 0.2);
    ctx.quadraticCurveTo(r * 0.4, r * 0.1, r * 1.0, r * 1.0);
    ctx.quadraticCurveTo(0, r * 0.8, -r * 1.0, r * 1.0);
    const dg = ctx.createLinearGradient(0, -r * 0.2, 0, r);
    dg.addColorStop(0, '#4b1f6e');
    dg.addColorStop(1, '#12051c');
    ctx.fillStyle = dg;
    ctx.fill();
    ctx.strokeStyle = '#b04dff';
    ctx.lineWidth = r * 0.04;
    ctx.stroke();
    // かみ
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.45, r * 0.55, r * 0.6, 0, 0, TAU);
    ctx.fillStyle = '#20102e';
    ctx.fill();
    // かお
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.4, r * 0.38, r * 0.4, 0, 0, TAU);
    ctx.fillStyle = '#e9dcf5';
    ctx.fill();
    ctx.shadowColor = '#ff2dd4';
    ctx.shadowBlur = r * 0.2;
    ctx.fillStyle = '#ff3ddc';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.08, -r * 0.42);
      ctx.lineTo(s * r * 0.28, -r * 0.5);
      ctx.lineTo(s * r * 0.26, -r * 0.36);
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    // かんむり
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const x = -r * 0.45 + (i / 8) * r * 0.9;
      const y = -r * 0.85 - (i % 2 ? r * 0.35 : 0) - (i === 4 ? r * 0.15 : 0);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.lineTo(r * 0.45, -r * 0.75);
    ctx.lineTo(-r * 0.45, -r * 0.75);
    ctx.closePath();
    ctx.fillStyle = '#2b0f3d';
    ctx.fill();
    ctx.strokeStyle = '#d17bff';
    ctx.lineWidth = r * 0.03;
    ctx.stroke();
    ctx.save();
    ctx.translate(0, r * 0.1);
    drawGem(ctx, r * 0.2, GEMS.obsidian);
    ctx.restore();
  },
  spitter(ctx, r, col, f) {
    // 背中の結晶
    const cc = { color: '#6fe0ff', light: '#e0fbff', dark: '#1f6f99' };
    for (const [x, rot, sz] of [[-0.45, -0.5, 0.45], [0, 0, 0.6], [0.45, 0.5, 0.45]]) {
      ctx.save(); ctx.translate(x * r, -r * 0.55); ctx.rotate(rot); drawGem(ctx, r * sz, cc, 'long'); ctx.restore();
    }
    ctx.beginPath();
    ctx.ellipse(0, r * 0.1, r * 0.95, r * 0.8, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    shine(ctx, r);
    eyes(ctx, 0, -r * 0.05, r * 0.26, { color: '#5fe0ff' });
    // 口（溜め中は光る）
    ctx.fillStyle = f === 1 ? '#bff6ff' : '#0a1420';
    if (f === 1) { ctx.shadowColor = '#5fe0ff'; ctx.shadowBlur = r * 0.8; }
    ctx.beginPath();
    ctx.ellipse(0, r * 0.42, r * 0.22, r * 0.16, 0, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
  },
  splitter(ctx, r, col) {
    ctx.beginPath();
    ctx.ellipse(0, r * 0.05, r * 1.05, r * 0.85, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    // 分裂線
    ctx.strokeStyle = 'rgba(160,255,200,0.8)';
    ctx.shadowColor = '#7fffb0';
    ctx.shadowBlur = r * 0.4;
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.8);
    for (let i = 1; i <= 6; i++) ctx.lineTo((i % 2 ? 1 : -1) * r * 0.1, -r * 0.8 + (i / 6) * r * 1.65);
    ctx.stroke();
    ctx.shadowBlur = 0;
    shine(ctx, r);
    eyes(ctx, -r * 0.45, -r * 0.05, r * 0.17, { color: '#7fffb0', gap: 0.8 });
    eyes(ctx, r * 0.45, -r * 0.05, r * 0.17, { color: '#7fffb0', gap: 0.8 });
  },
  charger(ctx, r, col) {
    // 角
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sd * r * 0.45, -r * 0.45);
      ctx.quadraticCurveTo(sd * r * 1.25, -r * 0.8, sd * r * 1.15, -r * 1.35);
      ctx.quadraticCurveTo(sd * r * 0.95, -r * 0.8, sd * r * 0.2, -r * 0.6);
      ctx.fillStyle = '#e8dcc8';
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.05;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, r * 0.05, r * 0.95, r * 0.85, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    // 鼻先
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.45, r * 0.4, r * 0.22, 0, 0, TAU);
    ctx.fill();
    shine(ctx, r);
    eyes(ctx, 0, -r * 0.1, r * 0.24, { color: '#ff3d3d' });
  },
  bomber(ctx, r, col, f) {
    const hot = f === 1;
    ctx.beginPath();
    ctx.arc(0, r * 0.1, r * 0.9, 0, TAU);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.2, 1, 0, r * 0.1, r);
    g.addColorStop(0, hot ? '#ffe0a0' : '#7a3a2a');
    g.addColorStop(0.6, hot ? '#ff6a1f' : '#3a1510');
    g.addColorStop(1, '#140505');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,150,80,0.7)';
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    // ひび（溶岩）
    ctx.strokeStyle = hot ? '#fff3b0' : '#ff7a2a';
    ctx.shadowColor = '#ff6a1f';
    ctx.shadowBlur = r * 0.5;
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.2); ctx.lineTo(-r * 0.15, r * 0.1); ctx.lineTo(-r * 0.3, r * 0.5);
    ctx.moveTo(r * 0.55, 0); ctx.lineTo(r * 0.2, r * 0.25);
    ctx.stroke();
    // 導火線
    ctx.strokeStyle = '#c9b89a';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.75);
    ctx.quadraticCurveTo(r * 0.3, -r * 1.1, r * 0.15, -r * 1.3);
    ctx.stroke();
    ctx.fillStyle = hot ? '#ffffff' : '#ffb84a';
    ctx.shadowColor = '#ffb84a';
    ctx.shadowBlur = r;
    ctx.beginPath();
    ctx.arc(r * 0.15, -r * 1.32, r * (hot ? 0.28 : 0.16), 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    eyes(ctx, 0, r * 0.05, r * 0.22, { color: '#ffd23d' });
  },
  wisp(ctx, r, col) {
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.3);
    ctx.bezierCurveTo(r * 0.5, -r * 0.8, r * 1.0, -r * 0.1, r * 0.8, r * 0.45);
    ctx.bezierCurveTo(r * 0.55, r * 1.0, -r * 0.55, r * 1.0, -r * 0.8, r * 0.45);
    ctx.bezierCurveTo(-r * 1.0, -r * 0.1, -r * 0.3, -r * 0.6, 0, -r * 1.3);
    const g = ctx.createRadialGradient(0, r * 0.3, 1, 0, 0, r * 1.2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, '#bfefff');
    g.addColorStop(1, 'rgba(90,160,230,0.4)');
    ctx.fillStyle = g;
    ctx.shadowColor = '#9fe4ff';
    ctx.shadowBlur = r * 0.8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0a1a33';
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sd * r * 0.3, r * 0.25, r * 0.12, r * 0.2, 0, 0, TAU);
      ctx.fill();
    }
  },
  phantom(ctx, r, col) {
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.1);
    ctx.quadraticCurveTo(r * 0.95, -r * 0.9, r * 0.9, r * 0.3);
    for (let i = 0; i < 5; i++) {
      const x0 = r * 0.9 - (i * r * 1.8) / 5;
      ctx.lineTo(x0 - r * 0.18, r * (i % 2 ? 0.8 : 1.1));
    }
    ctx.lineTo(-r * 0.9, r * 0.3);
    ctx.quadraticCurveTo(-r * 0.95, -r * 0.9, 0, -r * 1.1);
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#3a2060');
    g.addColorStop(1, 'rgba(20,5,40,0.6)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(224,92,255,0.7)';
    ctx.lineWidth = r * 0.07;
    ctx.stroke();
    // フードの中
    ctx.fillStyle = '#05010a';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.3, r * 0.5, r * 0.45, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, 0, -r * 0.3, r * 0.2, { color: '#e05cff' });
  },
  wormseg(ctx, r) {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.95, 0, TAU);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
    g.addColorStop(0, '#6a3a2a');
    g.addColorStop(0.7, '#3a1a12');
    g.addColorStop(1, '#140505');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#ff7a2a';
    ctx.shadowColor = '#ff6a1f';
    ctx.shadowBlur = r * 0.5;
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r * 0.2); ctx.lineTo(-r * 0.1, r * 0.15); ctx.lineTo(r * 0.5, -r * 0.1);
    ctx.stroke();
    ctx.shadowBlur = 0;
  },
  worm(ctx, r) {
    // あご
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sd * r * 0.5, r * 0.3);
      ctx.quadraticCurveTo(sd * r * 1.2, r * 0.9, sd * r * 0.4, r * 1.35);
      ctx.quadraticCurveTo(sd * r * 0.7, r * 0.8, sd * r * 0.15, r * 0.55);
      ctx.fillStyle = '#e8d0b0';
      ctx.fill();
    }
    ENEMY_DRAW.wormseg(ctx, r);
    ctx.fillStyle = '#ffb84a';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.45, r * 0.35, r * 0.2, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, 0, -r * 0.2, r * 0.26, { color: '#ffd23d' });
  },
  prism(ctx, r) {
    const cc = [
      { color: '#6fe0ff', light: '#ffffff', dark: '#1f5f99' },
      { color: '#b88fff', light: '#f4e8ff', dark: '#4a2a99' },
      { color: '#8fffd8', light: '#ffffff', dark: '#1f8a6a' },
    ];
    const parts = [[-0.7, 0.3, -0.5, 0.55, 0], [0.7, 0.3, 0.5, 0.55, 1], [-0.35, -0.35, -0.2, 0.6, 2], [0.35, -0.35, 0.2, 0.6, 0], [0, 0.5, 0, 0.5, 1]];
    for (const [x, y, rot, sz, ci] of parts) {
      ctx.save(); ctx.translate(x * r, y * r); ctx.rotate(rot); drawGem(ctx, r * sz, cc[ci], 'long'); ctx.restore();
    }
    ctx.save(); ctx.translate(0, -r * 0.05); drawGem(ctx, r * 0.75, cc[0], 'long'); ctx.restore();
    // 核の目
    ctx.fillStyle = '#05101a';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.22, r * 0.14, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, 0, 0, r * 0.12, { color: '#ff3ddc', angry: false, gap: 0 });
  },
  lich(ctx, r) {
    // ローブ
    ctx.beginPath();
    ctx.moveTo(-r * 0.95, r * 1.0);
    ctx.quadraticCurveTo(-r * 0.6, -r * 0.2, 0, -r * 0.7);
    ctx.quadraticCurveTo(r * 0.6, -r * 0.2, r * 0.95, r * 1.0);
    ctx.quadraticCurveTo(0, r * 0.75, -r * 0.95, r * 1.0);
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#2a4a7a');
    g.addColorStop(1, '#0a1428');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,240,255,0.7)';
    ctx.lineWidth = r * 0.04;
    ctx.stroke();
    // 顔（骸骨）
    ctx.fillStyle = '#dfe8f0';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.25, r * 0.3, r * 0.34, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, 0, -r * 0.3, r * 0.14, { color: '#5fe0ff', gap: 1.0 });
    // 氷の冠
    const ic = { color: '#bfefff', light: '#ffffff', dark: '#4a8ac0' };
    for (let i = -2; i <= 2; i++) {
      ctx.save(); ctx.translate(i * r * 0.16, -r * 0.7 - (2 - Math.abs(i)) * r * 0.08); drawGem(ctx, r * (0.2 + (2 - Math.abs(i)) * 0.05), ic, 'long'); ctx.restore();
    }
    // 杖の宝珠
    ctx.save(); ctx.translate(r * 0.85, r * 0.1); drawGem(ctx, r * 0.2, ic, 'round'); ctx.restore();
  },
  emperor(ctx, r) {
    // 周囲の黒曜石片
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.save();
      ctx.translate(Math.cos(a) * r * 1.0, Math.sin(a) * r * 1.0);
      ctx.rotate(a + Math.PI / 2);
      drawGem(ctx, r * 0.2, GEMS.obsidian, 'long');
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.78, 0, TAU);
    const g = ctx.createRadialGradient(-r * 0.2, -r * 0.3, 1, 0, 0, r * 0.8);
    g.addColorStop(0, '#5a2a8a');
    g.addColorStop(0.6, '#1a0a2a');
    g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#e05cff';
    ctx.shadowColor = '#e05cff';
    ctx.shadowBlur = r * 0.3;
    ctx.lineWidth = r * 0.04;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 大きな目
    ctx.fillStyle = '#f4e8ff';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.42, r * 0.22, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ff3ddc';
    ctx.shadowColor = '#ff3ddc';
    ctx.shadowBlur = r * 0.3;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.1, r * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 冠
    ctx.save(); ctx.translate(0, -r * 0.95); drawGem(ctx, r * 0.22, GEMS.obsidian); ctx.restore();
  },
  // ================================================ 第3章：四凶（共通の雑魚。ai なしで、ステージの tint で色が変わる）
  moryo(ctx, r, col) {
    // 魍魎：三歳の子どものような姿。赤黒い体に長い耳、赤い目（スライムの役）
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.45, -r * 0.55);
      ctx.quadraticCurveTo(s * r * 1.15, -r * 1.05, s * r * 1.45, -r * 0.95);
      ctx.quadraticCurveTo(s * r * 1.05, -r * 0.5, s * r * 0.72, -r * 0.12);
      ctx.closePath();
      ctx.fillStyle = mix(col, '#000000', 0.2);
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.08;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-r * 0.75, r * 0.82);
    ctx.bezierCurveTo(-r * 1.0, r * 0.1, -r * 0.85, -r * 0.95, 0, -r * 0.95);
    ctx.bezierCurveTo(r * 0.85, -r * 0.95, r * 1.0, r * 0.1, r * 0.75, r * 0.82);
    ctx.quadraticCurveTo(r * 0.45, r * 0.68, r * 0.25, r * 0.95);
    ctx.quadraticCurveTo(0, r * 0.75, -r * 0.25, r * 0.95);
    ctx.quadraticCurveTo(-r * 0.45, r * 0.68, -r * 0.75, r * 0.82);
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.09;
    ctx.stroke();
    // 髪
    ctx.strokeStyle = mix(col, '#ffffff', 0.45);
    ctx.lineWidth = r * 0.11;
    ctx.lineCap = 'round';
    for (const [x0, b] of [[-0.3, -0.45], [0, 0.05], [0.3, 0.45]]) {
      ctx.beginPath();
      ctx.moveTo(x0 * r, -r * 0.85);
      ctx.quadraticCurveTo((x0 + b * 0.4) * r, -r * 1.45, (x0 + b) * r, -r * 1.3);
      ctx.stroke();
    }
    shine(ctx, r);
    eyes(ctx, 0, -r * 0.18, r * 0.32, { color: '#ff3d3d' });
  },
  kochou(ctx, r, col, f) {
    // 蠱雕：角のある鷲。赤子のような声で鳴き、人を食う（コウモリの役）
    const up = f === 1;
    for (const s of [-1, 1]) featherWing(ctx, s, r * 0.25, -r * 0.2, r * 1.6, up ? -r * 1.05 : -r * 0.25, r * 0.35, r * 0.35, 4, mix(col, '#000000', 0.3), r * 0.26);
    // 尾羽
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, r * 0.4);
    ctx.lineTo(-r * 0.32, r * 1.05);
    ctx.lineTo(0, r * 0.85);
    ctx.lineTo(r * 0.32, r * 1.05);
    ctx.lineTo(r * 0.2, r * 0.4);
    ctx.closePath();
    ctx.fillStyle = mix(col, '#000000', 0.35);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, r * 0.05, r * 0.4, r * 0.55, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.6, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    // 頭・角・くちばし
    ctx.strokeStyle = '#efe6d0';
    ctx.lineWidth = r * 0.13;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.05, -r * 0.72);
    ctx.quadraticCurveTo(r * 0.05, -r * 1.1, r * 0.3, -r * 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -r * 0.5, r * 0.33, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.35, mix(col, '#ffffff', 0.15));
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.07;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, -r * 0.38);
    ctx.quadraticCurveTo(0, -r * 0.42, r * 0.12, -r * 0.38);
    ctx.quadraticCurveTo(r * 0.06, -r * 0.18, -r * 0.02, -r * 0.08);
    ctx.closePath();
    ctx.fillStyle = '#ffcf4a';
    ctx.fill();
    eyes(ctx, 0, -r * 0.55, r * 0.2, { color: '#ffd23d', gap: 1.1 });
  },
  chimi(ctx, r, col) {
    // 魑魅：山の精。獣の顔が浮かぶ霊（レイスの役）
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.35, -r * 0.62);
      ctx.quadraticCurveTo(s * r * 0.55, -r * 1.25, s * r * 0.95, -r * 1.3);
      ctx.quadraticCurveTo(s * r * 0.7, -r * 0.95, s * r * 0.65, -r * 0.45);
      ctx.closePath();
      ctx.fillStyle = mix(col, '#ffffff', 0.25);
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.06;
      ctx.stroke();
    }
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(-r * 0.92, r * 0.1);
    ctx.bezierCurveTo(-r * 1.05, -r * 1.0, r * 1.05, -r * 1.0, r * 0.92, r * 0.1);
    ctx.quadraticCurveTo(r * 0.9, r * 0.75, r * 0.6, r * 1.15);
    ctx.quadraticCurveTo(r * 0.42, r * 0.62, r * 0.18, r * 0.8);
    ctx.quadraticCurveTo(0, r * 1.3, -r * 0.18, r * 0.8);
    ctx.quadraticCurveTo(-r * 0.42, r * 0.62, -r * 0.6, r * 1.15);
    ctx.quadraticCurveTo(-r * 0.9, r * 0.75, -r * 0.92, r * 0.1);
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // 獣の面
    ctx.beginPath();
    ctx.moveTo(-r * 0.62, -r * 0.45);
    ctx.quadraticCurveTo(0, -r * 0.7, r * 0.62, -r * 0.45);
    ctx.quadraticCurveTo(r * 0.55, r * 0.25, 0, r * 0.4);
    ctx.quadraticCurveTo(-r * 0.55, r * 0.25, -r * 0.62, -r * 0.45);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fill();
    eyes(ctx, 0, -r * 0.2, r * 0.3, { color: '#7dff9a', gap: 1.0 });
    ctx.strokeStyle = 'rgba(10,20,10,0.85)';
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.moveTo(-r * 0.32, r * 0.12);
    ctx.quadraticCurveTo(0, r * 0.28, r * 0.32, r * 0.12);
    ctx.stroke();
    fang(ctx, -r * 0.2, r * 0.17, r * 0.13, r * 0.2);
    fang(ctx, r * 0.2, r * 0.17, r * 0.13, r * 0.2);
  },
  kyubi(ctx, r, col) {
    // 九尾狐：九本の尾を広げた狐。赤子のような声で人を誘う（ソーンコアの役）
    const tip = '#fff4e0';
    for (let i = 0; i < 9; i++) {
      const a = (i - 4) * 0.34;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.2);
      ctx.bezierCurveTo(r * 0.34, -r * 0.6, r * 0.26, -r * 1.3, 0, -r * 1.6);
      ctx.bezierCurveTo(-r * 0.26, -r * 1.3, -r * 0.34, -r * 0.6, 0, -r * 0.2);
      const g = ctx.createLinearGradient(0, -r * 0.3, 0, -r * 1.6);
      g.addColorStop(0, mix(col, '#000000', 0.25));
      g.addColorStop(0.65, col);
      g.addColorStop(1, tip);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.05;
      ctx.stroke();
      ctx.restore();
    }
    // 耳
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.25, -r * 0.4);
      ctx.lineTo(s * r * 0.65, -r * 1.0);
      ctx.lineTo(s * r * 0.72, -r * 0.25);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.06;
      ctx.stroke();
    }
    // 顔
    ctx.beginPath();
    ctx.moveTo(-r * 0.78, -r * 0.35);
    ctx.quadraticCurveTo(0, -r * 0.75, r * 0.78, -r * 0.35);
    ctx.quadraticCurveTo(r * 0.7, r * 0.3, 0, r * 0.85);
    ctx.quadraticCurveTo(-r * 0.7, r * 0.3, -r * 0.78, -r * 0.35);
    ctx.fillStyle = bodyGrad(ctx, r * 0.85, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.07;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, r * 0.15);
    ctx.quadraticCurveTo(0, r * 0.05, r * 0.35, r * 0.15);
    ctx.quadraticCurveTo(r * 0.2, r * 0.6, 0, r * 0.82);
    ctx.quadraticCurveTo(-r * 0.2, r * 0.6, -r * 0.35, r * 0.15);
    ctx.fillStyle = tip;
    ctx.fill();
    ctx.fillStyle = '#2a1a1a';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.62, r * 0.09, r * 0.06, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, 0, -r * 0.1, r * 0.3, { color: '#ff5fb0', gap: 1.0 });
  },
  kui(ctx, r, col) {
    // 夔：一本足の牛。青黒い体に角はなく、日月のように光り、雷の声で吠える（ゴーレムの役）
    ctx.beginPath();
    ctx.moveTo(-r * 0.24, r * 0.4);
    ctx.lineTo(-r * 0.2, r * 1.0);
    ctx.lineTo(r * 0.2, r * 1.0);
    ctx.lineTo(r * 0.24, r * 0.4);
    ctx.closePath();
    ctx.fillStyle = mix(col, '#000000', 0.35);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, r * 1.05, r * 0.32, r * 0.13, 0, 0, TAU);
    ctx.fillStyle = '#16141c';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, r * 0.05, r * 1.02, r * 0.74, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.06;
    ctx.stroke();
    // 雷の模様
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = r * 0.07;
    ctx.lineJoin = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.95, -r * 0.2);
      ctx.lineTo(s * r * 0.7, r * 0.05);
      ctx.lineTo(s * r * 0.85, r * 0.12);
      ctx.lineTo(s * r * 0.6, r * 0.45);
      ctx.stroke();
    }
    // 頭（角はない）
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * r * 0.55, -r * 0.42, r * 0.2, r * 0.1, s * -0.5, 0, TAU);
      ctx.fillStyle = mix(col, '#000000', 0.2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.25, r * 0.5, r * 0.42, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.55, mix(col, '#ffffff', 0.1));
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.05;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.02, r * 0.34, r * 0.2, 0, 0, TAU);
    ctx.fillStyle = mix(col, '#ffffff', 0.35);
    ctx.fill();
    ctx.fillStyle = '#1a1622';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * r * 0.12, -r * 0.02, r * 0.05, r * 0.07, 0, 0, TAU);
      ctx.fill();
    }
    shine(ctx, r * 0.8);
    eyes(ctx, 0, -r * 0.38, r * 0.22, { color: '#ffe066', gap: 1.1 });
  },
  keiten(ctx, r, col) {
    // 刑天：首を斬られても、乳を目に、臍を口にして、盾と斧を手に舞い続ける巨人（ナイトの役）
    // 斧（戚）
    ctx.strokeStyle = '#7a5434';
    ctx.lineWidth = r * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.82, r * 0.75);
    ctx.lineTo(r * 1.02, -r * 1.05);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.98, -r * 0.95);
    ctx.quadraticCurveTo(r * 1.6, -r * 1.0, r * 1.55, -r * 0.4);
    ctx.quadraticCurveTo(r * 1.3, -r * 0.6, r * 0.95, -r * 0.55);
    ctx.closePath();
    ctx.fillStyle = '#c8ccd8';
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.05;
    ctx.stroke();
    // 脚
    ctx.fillStyle = mix(col, '#000000', 0.3);
    for (const s of [-1, 1]) ctx.fillRect(s * r * 0.3 - r * 0.15, r * 0.6, r * 0.3, r * 0.45);
    // 胴
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, -r * 0.55);
    ctx.quadraticCurveTo(0, -r * 0.72, r * 0.9, -r * 0.55);
    ctx.quadraticCurveTo(r * 0.75, r * 0.3, r * 0.55, r * 0.75);
    ctx.lineTo(-r * 0.55, r * 0.75);
    ctx.quadraticCurveTo(-r * 0.75, r * 0.3, -r * 0.9, -r * 0.55);
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.07;
    ctx.stroke();
    // 首の切り口
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.62, r * 0.25, r * 0.08, 0, 0, TAU);
    ctx.fillStyle = '#5a1420';
    ctx.fill();
    // 腕（左は盾、右は斧）
    ctx.strokeStyle = mix(col, '#000000', 0.15);
    ctx.lineWidth = r * 0.24;
    ctx.beginPath();
    ctx.moveTo(r * 0.8, -r * 0.45);
    ctx.lineTo(r * 0.95, r * 0.05);
    ctx.stroke();
    // 盾（干）
    ctx.beginPath();
    ctx.ellipse(-r * 0.95, r * 0.05, r * 0.42, r * 0.62, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.6, '#8a6a3a');
    ctx.fill();
    ctx.strokeStyle = '#f0d58a';
    ctx.lineWidth = r * 0.06;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-r * 0.95, r * 0.05, r * 0.14, 0, TAU);
    ctx.fillStyle = '#f0d58a';
    ctx.fill();
    // 乳の目と臍の口
    oneEye(ctx, -r * 0.33, -r * 0.2, r * 0.17, '#ffb03d');
    oneEye(ctx, r * 0.33, -r * 0.2, r * 0.17, '#ffb03d');
    ctx.beginPath();
    ctx.ellipse(0, r * 0.32, r * 0.24, r * 0.12, 0, 0, TAU);
    ctx.fillStyle = '#2a0a10';
    ctx.fill();
    ctx.fillStyle = '#f6f0e2';
    for (let i = -2; i <= 2; i++) ctx.fillRect(i * r * 0.08 - r * 0.025, r * 0.22, r * 0.05, r * 0.08);
  },
  // ================================================ 第3章：ステージ専用の雑魚
  hippou(ctx, r, col, f) {
    // 畢方：一本足の鶴。青い体に赤い模様、白いくちばし。現れた所では火事が起こる（火の玉を撃つ）
    ctx.strokeStyle = '#2a2430';
    ctx.lineWidth = r * 0.09;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.05, r * 0.4);
    ctx.lineTo(r * 0.05, r * 1.15);
    ctx.lineTo(r * 0.3, r * 1.2);
    ctx.stroke();
    // 尾羽
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(r * 0.55, r * 0.15);
      ctx.quadraticCurveTo(r * 1.1, r * 0.1 + i * r * 0.15, r * 1.35, r * 0.35 + i * r * 0.22);
      ctx.strokeStyle = i === 1 ? '#ff4a3a' : mix(col, '#000000', 0.3);
      ctx.lineWidth = r * 0.12;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(r * 0.1, r * 0.1, r * 0.72, r * 0.48, -0.15, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.75, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.07;
    ctx.stroke();
    // 翼の赤い模様
    ctx.strokeStyle = '#ff4a3a';
    ctx.lineWidth = r * 0.08;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(r * 0.25, r * 0.05, r * (0.22 + i * 0.12), -0.4, 1.0);
      ctx.stroke();
    }
    // 首と頭
    ctx.strokeStyle = col;
    ctx.lineWidth = r * 0.2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.05);
    ctx.quadraticCurveTo(-r * 0.25, -r * 0.6, -r * 0.45, -r * 0.82);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-r * 0.45, -r * 0.85, r * 0.24, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.3, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.05;
    ctx.stroke();
    ctx.fillStyle = '#ff4a3a';
    ctx.beginPath();
    ctx.ellipse(-r * 0.4, -r * 1.1, r * 0.12, r * 0.07, 0.3, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r * 0.62, -r * 0.92);
    ctx.lineTo(-r * 1.35, -r * 0.62);
    ctx.lineTo(-r * 0.6, -r * 0.76);
    ctx.closePath();
    ctx.fillStyle = '#f6f0e2';
    ctx.fill();
    oneEye(ctx, -r * 0.42, -r * 0.88, r * 0.1, '#ffb03d');
    if (f === 1) glowBlob(ctx, -r * 1.25, -r * 0.65, r * 0.45, '#ff7a3d', 0.9);
  },
  yokko(ctx, r, col) {
    // 翼虎：窮奇の子。翼のある虎の子（突進）
    for (const s of [-1, 1]) featherWing(ctx, s, r * 0.4, -r * 0.3, r * 1.55, -r * 0.95, r * 0.6, r * 0.35, 4, mix(col, '#000000', 0.25), r * 0.24);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * r * 0.55, -r * 0.62, r * 0.22, 0, TAU);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.05;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s * r * 0.55, -r * 0.62, r * 0.1, 0, TAU);
      ctx.fillStyle = '#f6f0e2';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-r * 0.85, -r * 0.2);
    ctx.quadraticCurveTo(-r * 0.8, -r * 0.8, 0, -r * 0.8);
    ctx.quadraticCurveTo(r * 0.8, -r * 0.8, r * 0.85, -r * 0.2);
    ctx.quadraticCurveTo(r * 0.95, r * 0.45, r * 0.45, r * 0.7);
    ctx.quadraticCurveTo(0, r * 0.85, -r * 0.45, r * 0.7);
    ctx.quadraticCurveTo(-r * 0.95, r * 0.45, -r * 0.85, -r * 0.2);
    ctx.fillStyle = bodyGrad(ctx, r * 0.9, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.07;
    ctx.stroke();
    // 縞
    ctx.strokeStyle = '#7fe8ff';
    ctx.lineWidth = r * 0.08;
    ctx.lineCap = 'round';
    for (const [x0, y0, x1, y1] of [[-0.15, -0.75, -0.1, -0.5], [0.15, -0.75, 0.1, -0.5], [0, -0.78, 0, -0.55], [-0.85, -0.05, -0.55, 0.0], [0.85, -0.05, 0.55, 0.0], [-0.8, 0.2, -0.55, 0.18], [0.8, 0.2, 0.55, 0.18]]) {
      ctx.beginPath();
      ctx.moveTo(x0 * r, y0 * r);
      ctx.lineTo(x1 * r, y1 * r);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, r * 0.35, r * 0.42, r * 0.3, 0, 0, TAU);
    ctx.fillStyle = '#f6f0e2';
    ctx.fill();
    ctx.fillStyle = '#ff8aa0';
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, r * 0.18);
    ctx.lineTo(r * 0.12, r * 0.18);
    ctx.lineTo(0, r * 0.3);
    ctx.closePath();
    ctx.fill();
    fang(ctx, -r * 0.14, r * 0.45, r * 0.1, r * 0.18);
    fang(ctx, r * 0.14, r * 0.45, r * 0.1, r * 0.18);
    eyes(ctx, 0, -r * 0.2, r * 0.27, { color: '#ffd23d', gap: 1.15 });
  },
  bunyo(ctx, r, col, f) {
    // 文鰩魚：鳥の翼を持つ魚。青い模様に白い頭と赤いくちばし。夜に海の上を飛ぶ（水の弾を撃つ）
    for (const s of [-1, 1]) featherWing(ctx, s, r * 0.1, -r * 0.1, r * 1.15, -r * 1.2, r * 0.45, r * 0.05, 3, mix(col, '#ffffff', 0.25), r * 0.22);
    // 尾びれ
    ctx.beginPath();
    ctx.moveTo(r * 0.7, r * 0.15);
    ctx.lineTo(r * 1.4, -r * 0.25);
    ctx.lineTo(r * 1.2, r * 0.2);
    ctx.lineTo(r * 1.4, r * 0.6);
    ctx.closePath();
    ctx.fillStyle = mix(col, '#000000', 0.2);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.05;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, r * 0.18, r * 0.9, r * 0.45, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.9, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.07;
    ctx.stroke();
    // 模様（うろこ）
    ctx.strokeStyle = rgba('#ffffff', 0.35);
    ctx.lineWidth = r * 0.05;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(-r * 0.05 + i * r * 0.22, r * 0.15, r * 0.14, -1.2, 1.2);
      ctx.stroke();
    }
    // 白い頭と赤いくちばし
    ctx.beginPath();
    ctx.ellipse(-r * 0.62, r * 0.12, r * 0.34, r * 0.33, 0, 0, TAU);
    ctx.fillStyle = '#eef2f8';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, r * 0.02);
    ctx.lineTo(-r * 1.3, r * 0.15);
    ctx.lineTo(-r * 0.9, r * 0.25);
    ctx.closePath();
    ctx.fillStyle = '#ff4a3a';
    ctx.fill();
    oneEye(ctx, -r * 0.62, r * 0.05, r * 0.12, '#3fd0ff');
    if (f === 1) glowBlob(ctx, -r * 1.2, r * 0.15, r * 0.4, '#5fd8ff', 0.9);
  },
  tsuchi(ctx, r, col) {
    // 息壌の土人形：ひとりでに増える土（息壌）から生まれた人形。ゆっくり迫り、とにかくしぶとい
    ctx.beginPath();
    const bumps = [[-0.95, 0.85], [-1.05, 0.2], [-0.85, -0.3], [-0.5, -0.45], [0.5, -0.45], [0.85, -0.3], [1.05, 0.2], [0.95, 0.85]];
    ctx.moveTo(-0.95 * r, 0.85 * r);
    for (let i = 1; i < bumps.length; i++) {
      const [x0, y0] = bumps[i - 1], [x1, y1] = bumps[i];
      ctx.quadraticCurveTo(((x0 + x1) / 2) * r * 1.12, ((y0 + y1) / 2) * r * 1.12, x1 * r, y1 * r);
    }
    ctx.quadraticCurveTo(0, r * 1.05, -0.95 * r, 0.85 * r);
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.07;
    ctx.stroke();
    // 頭
    ctx.beginPath();
    ctx.arc(0, -r * 0.62, r * 0.45, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.5, mix(col, '#ffffff', 0.08));
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.06;
    ctx.stroke();
    // 芽
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * r * 0.14, -r * 1.12, r * 0.14, r * 0.07, s * -0.6, 0, TAU);
      ctx.fillStyle = '#7fd06a';
      ctx.fill();
    }
    ctx.strokeStyle = '#5aa04a';
    ctx.lineWidth = r * 0.04;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.05);
    ctx.lineTo(0, -r * 1.2);
    ctx.stroke();
    // ひび割れ
    ctx.strokeStyle = '#ffb84a';
    ctx.lineWidth = r * 0.05;
    ctx.lineJoin = 'round';
    for (const pts of [[[-0.5, 0.0], [-0.3, 0.25], [-0.45, 0.5]], [[0.4, -0.1], [0.55, 0.2], [0.35, 0.45], [0.5, 0.7]], [[-0.1, 0.4], [0.05, 0.6]]]) {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r)));
      ctx.stroke();
    }
    eyes(ctx, 0, -r * 0.62, r * 0.22, { color: '#ffb84a', angry: false, gap: 1.0 });
  },
  seicho(ctx, r, col, f) {
    // 三青鳥：三危山に棲む三羽の青い鳥。赤い頭に黒い目（羽の弾を撃つ）
    const birds = [[0, -0.5, 0.74], [-0.7, 0.38, 0.66], [0.7, 0.38, 0.66]];
    for (const [bx, by, k] of birds) {
      ctx.save();
      ctx.translate(bx * r, by * r);
      ctx.scale(k, k);
      for (const s of [-1, 1]) featherWing(ctx, s, r * 0.2, -r * 0.1, r * 1.0, f === 1 ? -r * 0.75 : -r * 0.35, r * 0.25, r * 0.3, 3, mix(col, '#000000', 0.2), r * 0.22);
      ctx.beginPath();
      ctx.ellipse(0, r * 0.1, r * 0.42, r * 0.5, 0, 0, TAU);
      ctx.fillStyle = bodyGrad(ctx, r * 0.5, col);
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.08;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -r * 0.42, r * 0.3, 0, TAU);
      ctx.fillStyle = bodyGrad(ctx, r * 0.32, '#e8402a');
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.07;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.08, -r * 0.3);
      ctx.lineTo(r * 0.08, -r * 0.3);
      ctx.lineTo(0, -r * 0.1);
      ctx.closePath();
      ctx.fillStyle = '#ffcf4a';
      ctx.fill();
      eyes(ctx, 0, -r * 0.46, r * 0.16, { color: '#1a1020', gap: 1.0, angry: false });
      ctx.restore();
    }
    if (f === 1) glowBlob(ctx, 0, 0, r * 0.7, '#5fb8ff', 0.6);
  },
  kanae(ctx, r, col, f) {
    // 饕餮の鼎（三危山のギミックの絵）：饕餮の文様の青銅の鼎。f=3 はためた経験値で中身が光る
    ctx.fillStyle = mix(col, '#000000', 0.4);
    for (const x of [-0.6, 0, 0.6]) {
      ctx.beginPath();
      ctx.moveTo((x - 0.12) * r, r * 0.35);
      ctx.lineTo((x - 0.08) * r, r * 1.1);
      ctx.lineTo((x + 0.08) * r, r * 1.1);
      ctx.lineTo((x + 0.12) * r, r * 0.35);
      ctx.closePath();
      ctx.fill();
    }
    // 耳（取っ手）
    for (const s of [-1, 1]) {
      ctx.strokeStyle = mix(col, '#000000', 0.2);
      ctx.lineWidth = r * 0.12;
      ctx.beginPath();
      ctx.moveTo(s * r * 0.35, -r * 0.4);
      ctx.lineTo(s * r * 0.4, -r * 0.95);
      ctx.lineTo(s * r * 0.7, -r * 0.95);
      ctx.lineTo(s * r * 0.65, -r * 0.4);
      ctx.stroke();
    }
    // 胴
    ctx.beginPath();
    ctx.moveTo(-r * 0.95, -r * 0.4);
    ctx.lineTo(r * 0.95, -r * 0.4);
    ctx.quadraticCurveTo(r * 0.95, r * 0.6, 0, r * 0.62);
    ctx.quadraticCurveTo(-r * 0.95, r * 0.6, -r * 0.95, -r * 0.4);
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.07;
    ctx.stroke();
    // 口（中身が光る）
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.4, r * 0.95, r * 0.2, 0, 0, TAU);
    ctx.fillStyle = mix(col, '#000000', 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.37, r * 0.75, r * 0.13, 0, 0, TAU);
    ctx.fillStyle = f === 3 ? '#ffd27a' : '#5a3a20';
    ctx.fill();
    if (f === 3) glowBlob(ctx, 0, -r * 0.4, r * 0.7, '#ffb84a', 0.8);
    // 饕餮の文様
    ctx.strokeStyle = '#f0d58a';
    ctx.lineWidth = r * 0.05;
    for (const s of [-1, 1]) spiral(ctx, s * r * 0.4, r * 0.08, r * 0.2, 1.4, s);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.18);
    ctx.lineTo(0, r * 0.4);
    ctx.stroke();
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sx * r * 0.4, r * 0.08, r * 0.07, 0, TAU);
      ctx.fillStyle = f === 3 ? '#ffd27a' : '#1a1208';
      ctx.fill();
    }
  },
  houkyou(ctx, r, col) {
    // 狍鴞：羊の体に人の顔、目は腋の下にあり、虎の歯と人の手を持つ。饕餮の正体ともいわれる（突進）
    // 毛のかたまり
    const puffs = [[0, 0.1, 0.75], [-0.6, -0.2, 0.42], [0.6, -0.2, 0.42], [-0.7, 0.35, 0.4], [0.7, 0.35, 0.4], [-0.3, 0.65, 0.38], [0.3, 0.65, 0.38], [0, -0.55, 0.45]];
    for (const [x, y, rr] of puffs) {
      ctx.beginPath();
      ctx.arc(x * r, y * r, rr * r, 0, TAU);
      ctx.fillStyle = bodyGrad(ctx, rr * r, col);
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.05;
      ctx.stroke();
    }
    // 巻いた角
    ctx.strokeStyle = '#d8c8a8';
    ctx.lineWidth = r * 0.1;
    for (const s of [-1, 1]) spiral(ctx, s * r * 0.62, -r * 0.55, r * 0.26, 1.2, -s);
    // 人の顔（目はない）
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.15, r * 0.42, r * 0.5, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.5, '#e8c8b0');
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,40,30,0.6)';
    ctx.lineWidth = r * 0.04;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, r * 0.02);
    ctx.quadraticCurveTo(0, r * 0.32, r * 0.3, r * 0.02);
    ctx.closePath();
    ctx.fillStyle = '#3a0a14';
    ctx.fill();
    for (let i = -2; i <= 2; i++) fang(ctx, i * r * 0.11, r * 0.02, r * 0.09, r * (i % 2 ? 0.1 : 0.16));
    // 人の手と、腋の下の目
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * r * 0.95, r * 0.05, r * 0.16, r * 0.12, 0, 0, TAU);
      ctx.fillStyle = '#e8c8b0';
      ctx.fill();
      oneEye(ctx, s * r * 0.62, r * 0.42, r * 0.13, '#ff3d3d');
    }
  },
  maiko(ctx, r, col, f) {
    // 無面の舞子：渾沌の子。顔のない黄色い袋が、六本の足と四枚の翼で踊る（音の弾を撃つ）
    ctx.globalAlpha = 0.75;
    for (const s of [-1, 1]) {
      for (const [ty, sz] of [[-0.75, 1], [0.0, 0.75]]) {
        ctx.beginPath();
        ctx.ellipse(s * r * 0.9, ty * r, r * 0.55 * sz, r * 0.25 * sz, s * (ty < 0 ? -0.5 : 0.3), 0, TAU);
        ctx.fillStyle = '#ffe9b0';
        ctx.fill();
        ctx.strokeStyle = RIM;
        ctx.lineWidth = r * 0.04;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = r * 0.07;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(s * r * (0.3 + i * 0.15), r * 0.55);
      ctx.lineTo(s * r * (0.55 + i * 0.2), r * 0.85);
      ctx.lineTo(s * r * (0.45 + i * 0.25), r * 1.15);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, -r * 0.85);
    ctx.quadraticCurveTo(-r * 0.95, -r * 0.4, -r * 0.8, r * 0.3);
    ctx.quadraticCurveTo(-r * 0.6, r * 0.8, 0, r * 0.8);
    ctx.quadraticCurveTo(r * 0.6, r * 0.8, r * 0.8, r * 0.3);
    ctx.quadraticCurveTo(r * 0.95, -r * 0.4, r * 0.2, -r * 0.85);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -r * 0.9, 0, r * 0.8);
    g.addColorStop(0, '#fff0a0');
    g.addColorStop(0.5, col);
    g.addColorStop(1, '#e8402a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.07;
    ctx.stroke();
    // 袋の口
    ctx.strokeStyle = '#c8402a';
    ctx.lineWidth = r * 0.1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.25, -r * 0.85);
    ctx.quadraticCurveTo(0, -r * 0.72, r * 0.25, -r * 0.85);
    ctx.stroke();
    shine(ctx, r * 0.8);
    glowBlob(ctx, 0, r * 0.1, r * 0.6, '#ff6a2a', f === 1 ? 0.8 : 0.35);
  },
  nomi(ctx, r, col) {
    // 鑿：渾沌に穴を開けた鑿。まっすぐ突っ込んでくる
    ctx.save();
    ctx.rotate(-0.55);
    ctx.beginPath();
    ctx.moveTo(-r * 0.18, -r * 1.35);
    ctx.lineTo(r * 0.18, -r * 1.35);
    ctx.lineTo(r * 0.2, -r * 0.2);
    ctx.lineTo(-r * 0.2, -r * 0.2);
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r * 0.6, '#8a5a3a');
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.06;
    ctx.stroke();
    ctx.fillStyle = '#c8a050';
    ctx.fillRect(-r * 0.22, -r * 0.3, r * 0.44, r * 0.14);
    ctx.fillRect(-r * 0.2, -r * 1.2, r * 0.4, r * 0.08);
    ctx.beginPath();
    ctx.moveTo(-r * 0.14, -r * 0.16);
    ctx.lineTo(r * 0.14, -r * 0.16);
    ctx.lineTo(r * 0.16, r * 1.1);
    ctx.lineTo(0, r * 1.4);
    ctx.lineTo(-r * 0.16, r * 1.1);
    ctx.closePath();
    const g = ctx.createLinearGradient(-r * 0.16, 0, r * 0.16, 0);
    g.addColorStop(0, '#7a808e');
    g.addColorStop(0.5, '#eef2f8');
    g.addColorStop(1, '#8a90a0');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.05;
    ctx.stroke();
    oneEye(ctx, 0, -r * 0.75, r * 0.15, '#ff5a3d');
    ctx.restore();
  },
  // ================================================ 第3章：中ボス（羿が退治した六つの害と、渾沌に穴を開けた二柱の帝）
  kyuei(ctx, r, col) {
    // 九嬰：水と火を吐く九つの首の怪物
    const heads = [];
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.3;
      const L = r * (i % 2 ? 1.05 : 1.3);
      heads.push([Math.cos(a) * L, -r * 0.05 + Math.sin(a) * L, a, i % 2 ? '#3fa8ff' : '#ff6a3d']);
    }
    for (const [hx, hy, a, c] of heads) {
      ctx.strokeStyle = mix(col, c, 0.25);
      ctx.lineWidth = r * 0.16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, r * 0.1);
      ctx.quadraticCurveTo(hx * 0.4 + Math.cos(a + 1.2) * r * 0.2, hy * 0.5, hx, hy);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, r * 0.45, r * 0.9, r * 0.65, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.9, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.04;
    ctx.stroke();
    ctx.strokeStyle = rgba('#ffffff', 0.18);
    ctx.lineWidth = r * 0.03;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(-r * 0.45 + i * r * 0.22, r * 0.5, r * 0.12, 0, Math.PI);
      ctx.stroke();
    }
    for (const [hx, hy, a, c] of heads) {
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.36);
      ctx.quadraticCurveTo(r * 0.25, -r * 0.24, r * 0.2, r * 0.1);
      ctx.lineTo(-r * 0.2, r * 0.1);
      ctx.quadraticCurveTo(-r * 0.25, -r * 0.24, 0, -r * 0.36);
      ctx.fillStyle = bodyGrad(ctx, r * 0.25, mix(col, c, 0.45));
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.025;
      ctx.stroke();
      eyes(ctx, 0, -r * 0.06, r * 0.09, { color: c, gap: 1.1 });
      ctx.restore();
    }
    ctx.save();
    ctx.translate(0, r * 0.45);
    drawGem(ctx, r * 0.12, GEMS.redberyl);
    ctx.restore();
  },
  taifu(ctx, r, col) {
    // 大風：家々を吹き壊す風を起こす巨大な鳥（風伯）
    ctx.strokeStyle = rgba('#e8f4ff', 0.55);
    ctx.lineWidth = r * 0.04;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, r * 0.1, r * (0.95 + i * 0.22), Math.PI * (0.15 + i * 0.3), Math.PI * (0.75 + i * 0.3));
      ctx.stroke();
    }
    for (const s of [-1, 1]) {
      featherWing(ctx, s, r * 0.3, -r * 0.25, r * 1.62, -r * 0.95, r * 0.4, r * 0.4, 6, mix(col, '#000000', 0.25), r * 0.22);
      featherWing(ctx, s, r * 0.3, -r * 0.2, r * 1.15, -r * 0.6, r * 0.35, r * 0.15, 4, mix(col, '#ffffff', 0.2), r * 0.16);
    }
    // 尾羽
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.12, r * 0.4);
      ctx.quadraticCurveTo(i * r * 0.5, r * 1.0, i * r * 0.35, r * 1.5);
      ctx.quadraticCurveTo(i * r * 0.25, r * 1.05, i * r * 0.08 + r * 0.06, r * 0.4);
      ctx.fillStyle = i ? mix(col, '#ffffff', 0.25) : '#e8f4ff';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(0, r * 0.1, r * 0.42, r * 0.55, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.6, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.04;
    ctx.stroke();
    // 冠羽と頭
    ctx.strokeStyle = '#e8f4ff';
    ctx.lineWidth = r * 0.05;
    ctx.lineCap = 'round';
    for (const a of [-0.5, 0, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.65);
      ctx.quadraticCurveTo(a * r * 0.4, -r * 1.05, a * r * 0.7, -r * 1.2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, -r * 0.5, r * 0.3, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.35, mix(col, '#ffffff', 0.15));
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.035;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 0.42);
    ctx.lineTo(r * 0.1, -r * 0.42);
    ctx.quadraticCurveTo(r * 0.05, -r * 0.2, -r * 0.02, -r * 0.12);
    ctx.closePath();
    ctx.fillStyle = '#ffcf4a';
    ctx.fill();
    eyes(ctx, 0, -r * 0.55, r * 0.16, { color: '#8fe8ff', gap: 1.1 });
    ctx.save();
    ctx.translate(0, r * 0.15);
    drawGem(ctx, r * 0.11, GEMS.aquamarine);
    ctx.restore();
  },
  fuki(ctx, r, col) {
    // 封豨：桑林を荒らした巨大な猪
    ctx.fillStyle = mix(col, '#000000', 0.35);
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI;
      const rr = i % 2 ? r * 1.0 : r * 1.35;
      ctx.lineTo(Math.cos(a) * rr, -r * 0.1 + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.45, -r * 0.65);
      ctx.lineTo(s * r * 0.95, -r * 1.05);
      ctx.lineTo(s * r * 0.85, -r * 0.45);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.03;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-r * 0.95, -r * 0.3);
    ctx.quadraticCurveTo(-r * 0.9, -r * 0.85, 0, -r * 0.85);
    ctx.quadraticCurveTo(r * 0.9, -r * 0.85, r * 0.95, -r * 0.3);
    ctx.quadraticCurveTo(r * 1.0, r * 0.6, 0, r * 0.95);
    ctx.quadraticCurveTo(-r * 1.0, r * 0.6, -r * 0.95, -r * 0.3);
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.04;
    ctx.stroke();
    // 鼻
    ctx.beginPath();
    ctx.ellipse(0, r * 0.38, r * 0.42, r * 0.3, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.45, mix(col, '#ff9a8a', 0.35));
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.03;
    ctx.stroke();
    ctx.fillStyle = '#1a0a0a';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * r * 0.15, r * 0.38, r * 0.07, r * 0.11, 0, 0, TAU);
      ctx.fill();
    }
    // 牙
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.38, r * 0.55);
      ctx.quadraticCurveTo(s * r * 0.95, r * 0.6, s * r * 0.85, -r * 0.05);
      ctx.quadraticCurveTo(s * r * 0.75, r * 0.4, s * r * 0.3, r * 0.42);
      ctx.closePath();
      ctx.fillStyle = '#f6f0e2';
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,40,30,0.7)';
      ctx.lineWidth = r * 0.025;
      ctx.stroke();
    }
    eyes(ctx, 0, -r * 0.2, r * 0.17, { color: '#ff3d3d', gap: 1.6 });
    ctx.save();
    ctx.translate(0, -r * 0.62);
    drawGem(ctx, r * 0.1, GEMS.jasper);
    ctx.restore();
  },
  shuda(ctx, r, col) {
    // 修蛇：洞庭の大蛇。象をも呑む
    for (let i = 2; i >= 0; i--) {
      ctx.beginPath();
      ctx.ellipse(0, r * (0.55 - i * 0.18), r * (1.25 - i * 0.25), r * (0.48 - i * 0.08), 0, 0, TAU);
      ctx.strokeStyle = mix(col, '#000000', 0.15 + i * 0.1);
      ctx.lineWidth = r * 0.3;
      ctx.stroke();
      ctx.strokeStyle = rgba('#ffe08a', 0.35);
      ctx.lineWidth = r * 0.06;
      ctx.stroke();
    }
    // 首
    ctx.strokeStyle = col;
    ctx.lineWidth = r * 0.34;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, r * 0.25);
    ctx.bezierCurveTo(-r * 0.7, -r * 0.2, r * 0.5, -r * 0.35, r * 0.05, -r * 0.75);
    ctx.stroke();
    ctx.strokeStyle = '#e8c870';
    ctx.lineWidth = r * 0.1;
    ctx.stroke();
    // 頭
    ctx.save();
    ctx.translate(r * 0.05, -r * 0.85);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.45);
    ctx.quadraticCurveTo(r * 0.45, -r * 0.3, r * 0.38, r * 0.15);
    ctx.quadraticCurveTo(0, r * 0.32, -r * 0.38, r * 0.15);
    ctx.quadraticCurveTo(-r * 0.45, -r * 0.3, 0, -r * 0.45);
    ctx.fillStyle = bodyGrad(ctx, r * 0.45, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.035;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.22, r * 0.12);
    ctx.quadraticCurveTo(0, r * 0.38, r * 0.22, r * 0.12);
    ctx.closePath();
    ctx.fillStyle = '#3a0a14';
    ctx.fill();
    fang(ctx, -r * 0.12, r * 0.13, r * 0.06, r * 0.13);
    fang(ctx, r * 0.12, r * 0.13, r * 0.06, r * 0.13);
    ctx.strokeStyle = '#ff4a6a';
    ctx.lineWidth = r * 0.03;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.22);
    ctx.lineTo(0, r * 0.42);
    ctx.lineTo(-r * 0.06, r * 0.5);
    ctx.moveTo(0, r * 0.42);
    ctx.lineTo(r * 0.06, r * 0.5);
    ctx.stroke();
    eyes(ctx, 0, -r * 0.12, r * 0.14, { color: '#ffd23d', gap: 1.3 });
    ctx.translate(0, -r * 0.3);
    drawGem(ctx, r * 0.08, GEMS.peridot);
    ctx.restore();
  },
  atsuyu(ctx, r, col) {
    // 猰貐：竜の頭を持つ人食いの獣
    // たてがみ（炎）
    ctx.fillStyle = mix(col, '#ff8a3d', 0.4);
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * 0.9 + (i / 14) * Math.PI * 1.2;
      const rr = i % 2 ? r * 0.85 : r * 1.3;
      ctx.lineTo(Math.cos(a) * rr, -r * 0.2 + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    // 体と爪
    ctx.beginPath();
    ctx.ellipse(0, r * 0.55, r * 0.95, r * 0.6, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.95, mix(col, '#000000', 0.15));
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.04;
    ctx.stroke();
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) fang(ctx, s * r * (0.55 + k * 0.12), r * 1.05, r * 0.08, r * 0.16);
    // 角
    ctx.strokeStyle = '#efe0b0';
    ctx.lineWidth = r * 0.09;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.25, -r * 0.7);
      ctx.quadraticCurveTo(s * r * 0.5, -r * 1.2, s * r * 0.95, -r * 1.25);
      ctx.moveTo(s * r * 0.48, -r * 1.05);
      ctx.lineTo(s * r * 0.62, -r * 1.35);
      ctx.stroke();
    }
    // 竜の頭
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.6);
    ctx.quadraticCurveTo(0, -r * 0.85, r * 0.5, -r * 0.6);
    ctx.quadraticCurveTo(r * 0.62, -r * 0.1, r * 0.4, r * 0.3);
    ctx.quadraticCurveTo(0, r * 0.45, -r * 0.4, r * 0.3);
    ctx.quadraticCurveTo(-r * 0.62, -r * 0.1, -r * 0.5, -r * 0.6);
    ctx.fillStyle = bodyGrad(ctx, r * 0.65, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.035;
    ctx.stroke();
    // ひげ
    ctx.strokeStyle = '#ffe08a';
    ctx.lineWidth = r * 0.03;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.2, r * 0.15);
      ctx.bezierCurveTo(s * r * 0.8, r * 0.1, s * r * 0.9, r * 0.5, s * r * 1.3, r * 0.35);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, r * 0.18, r * 0.3, r * 0.14, 0, 0, TAU);
    ctx.fillStyle = '#2a0a0a';
    ctx.fill();
    for (let i = -2; i <= 2; i++) if (i) fang(ctx, i * r * 0.1, r * 0.08, r * 0.07, r * 0.12);
    eyes(ctx, 0, -r * 0.35, r * 0.17, { color: '#ffd23d', gap: 1.3 });
    ctx.save();
    ctx.translate(0, -r * 0.62);
    drawGem(ctx, r * 0.09, GEMS.garnet);
    ctx.restore();
  },
  sakushi(ctx, r, col) {
    // 鑿齒：鑿のような長い歯を持つ巨人。盾を構える
    // 右腕
    ctx.strokeStyle = mix(col, '#000000', 0.1);
    ctx.lineWidth = r * 0.26;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.7, -r * 0.25);
    ctx.quadraticCurveTo(r * 1.15, r * 0.15, r * 1.0, r * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 1.0, r * 0.65, r * 0.17, 0, TAU);
    ctx.fillStyle = mix(col, '#ffffff', 0.1);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r * 1.0, -r * 0.05);
    ctx.quadraticCurveTo(-r * 0.95, -r * 0.45, -r * 0.6, -r * 0.45);
    ctx.lineTo(r * 0.6, -r * 0.45);
    ctx.quadraticCurveTo(r * 0.95, -r * 0.45, r * 1.0, -r * 0.05);
    ctx.lineTo(r * 0.65, r * 1.0);
    ctx.lineTo(-r * 0.65, r * 1.0);
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.04;
    ctx.stroke();
    // 頭
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.55, r * 0.42, r * 0.4, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.45, mix(col, '#ffffff', 0.08));
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.035;
    ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.2, -r * 0.88);
      ctx.lineTo(s * r * 0.35, -r * 1.25);
      ctx.lineTo(s * r * 0.4, -r * 0.82);
      ctx.closePath();
      ctx.fillStyle = '#efe0b0';
      ctx.fill();
    }
    ctx.fillStyle = mix(col, '#000000', 0.45);
    ctx.fillRect(-r * 0.38, -r * 0.72, r * 0.76, r * 0.1);
    eyes(ctx, 0, -r * 0.58, r * 0.14, { color: '#ff7a3d', gap: 1.2 });
    // 鑿のような歯
    ctx.fillStyle = '#2a0a10';
    ctx.fillRect(-r * 0.25, -r * 0.35, r * 0.5, r * 0.1);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.08, -r * 0.33);
      ctx.lineTo(s * r * 0.22, -r * 0.33);
      ctx.lineTo(s * r * 0.2, r * 0.35);
      ctx.lineTo(s * r * 0.1, r * 0.3);
      ctx.closePath();
      ctx.fillStyle = '#f6f0e2';
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,40,30,0.7)';
      ctx.lineWidth = r * 0.02;
      ctx.stroke();
    }
    // 盾
    ctx.beginPath();
    ctx.moveTo(-r * 1.55, -r * 0.4);
    ctx.lineTo(-r * 0.75, -r * 0.4);
    ctx.lineTo(-r * 0.75, r * 0.6);
    ctx.quadraticCurveTo(-r * 1.15, r * 1.0, -r * 1.55, r * 0.6);
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r * 0.6, '#7a6a3a');
    ctx.fill();
    ctx.strokeStyle = '#f0d58a';
    ctx.lineWidth = r * 0.04;
    ctx.stroke();
    ctx.strokeStyle = '#f0d58a';
    ctx.lineWidth = r * 0.03;
    spiral(ctx, -r * 1.15, r * 0.1, r * 0.25, 1.5);
    ctx.save();
    ctx.translate(0, r * 0.4);
    drawGem(ctx, r * 0.1, GEMS.citrine);
    ctx.restore();
  },
  shuku(ctx, r, col) {
    // 儵：南海の帝。忽とともに、渾沌に一日一つずつ穴を開けた
    seaEmperor(ctx, r, col, 'chisel', '#ff7a3d');
  },
  kotsu(ctx, r, col) {
    // 忽：北海の帝。儵とともに、渾沌に一日一つずつ穴を開けた
    seaEmperor(ctx, r, col, 'mallet', '#5fd8ff');
  },
  // ================================================ 第3章：最終ボス（四凶）
  kyuki(ctx, r, col, f) {
    // 窮奇：北風（広莫風）から生まれた、翼のある虎。針鼠のような毛に覆われ、人を頭から食らう。f=1 は飛びかかる構え
    const open = f === 1;
    for (const s of [-1, 1]) {
      featherWing(ctx, s, r * 0.35, -r * 0.35, r * 1.65, -r * 1.25, r * 0.55, r * 0.45, 6, mix(col, '#000000', 0.35), r * 0.24);
      featherWing(ctx, s, r * 0.35, -r * 0.3, r * 1.3, -r * 0.85, r * 0.5, r * 0.2, 4, mix(col, '#7fe8ff', 0.2), r * 0.18);
    }
    // 針鼠の毛
    ctx.beginPath();
    for (let i = 0; i <= 26; i++) {
      const a = Math.PI * 0.85 + (i / 26) * Math.PI * 1.3;
      const rr = i % 2 ? r * 0.78 : r * 1.12;
      ctx.lineTo(Math.cos(a) * rr, -r * 0.15 + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = mix(col, '#cfe8ff', 0.25);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.025;
    ctx.stroke();
    // 胸と前足
    ctx.beginPath();
    ctx.ellipse(0, r * 0.62, r * 0.68, r * 0.45, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.7, col);
    ctx.fill();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * r * 0.42, r * 0.98, r * 0.22, r * 0.14, 0, 0, TAU);
      ctx.fillStyle = mix(col, '#ffffff', 0.15);
      ctx.fill();
      for (let k = -1; k <= 1; k++) fang(ctx, s * r * 0.42 + k * r * 0.09, r * 1.05, r * 0.06, r * 0.1);
    }
    // 耳
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * r * 0.5, -r * 0.62, r * 0.18, 0, TAU);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.03;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s * r * 0.5, -r * 0.62, r * 0.08, 0, TAU);
      ctx.fillStyle = '#f6f0e2';
      ctx.fill();
    }
    // 顔
    ctx.beginPath();
    ctx.moveTo(-r * 0.72, -r * 0.2);
    ctx.quadraticCurveTo(-r * 0.7, -r * 0.72, 0, -r * 0.72);
    ctx.quadraticCurveTo(r * 0.7, -r * 0.72, r * 0.72, -r * 0.2);
    ctx.quadraticCurveTo(r * 0.85, r * 0.3, r * 0.42, r * 0.5);
    ctx.quadraticCurveTo(0, r * 0.62, -r * 0.42, r * 0.5);
    ctx.quadraticCurveTo(-r * 0.85, r * 0.3, -r * 0.72, -r * 0.2);
    ctx.fillStyle = bodyGrad(ctx, r * 0.8, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.035;
    ctx.stroke();
    // 光る縞
    ctx.strokeStyle = '#7fe8ff';
    ctx.lineWidth = r * 0.055;
    ctx.lineCap = 'round';
    for (const [x0, y0, x1, y1] of [[-0.2, -0.68, -0.14, -0.48], [0.2, -0.68, 0.14, -0.48], [-0.72, -0.05, -0.45, -0.02], [0.72, -0.05, 0.45, -0.02], [-0.7, 0.15, -0.48, 0.14], [0.7, 0.15, 0.48, 0.14], [-0.62, 0.32, -0.45, 0.28], [0.62, 0.32, 0.45, 0.28]]) {
      ctx.beginPath();
      ctx.moveTo(x0 * r, y0 * r);
      ctx.lineTo(x1 * r, y1 * r);
      ctx.stroke();
    }
    glowBlob(ctx, 0, -r * 0.1, r * 0.7, '#7fe8ff', 0.18);
    // 口
    ctx.beginPath();
    ctx.ellipse(0, r * 0.28, r * 0.36, r * 0.22, 0, 0, TAU);
    ctx.fillStyle = '#f6f0e2';
    ctx.fill();
    if (open) {
      ctx.beginPath();
      ctx.ellipse(0, r * 0.36, r * 0.26, r * 0.18, 0, 0, TAU);
      ctx.fillStyle = '#3a0a14';
      ctx.fill();
      fang(ctx, -r * 0.14, r * 0.2, r * 0.08, r * 0.2);
      fang(ctx, r * 0.14, r * 0.2, r * 0.08, r * 0.2);
      fang(ctx, -r * 0.12, r * 0.52, r * 0.07, r * 0.14, true);
      fang(ctx, r * 0.12, r * 0.52, r * 0.07, r * 0.14, true);
    } else {
      fang(ctx, -r * 0.13, r * 0.32, r * 0.07, r * 0.15);
      fang(ctx, r * 0.13, r * 0.32, r * 0.07, r * 0.15);
    }
    ctx.fillStyle = '#ff8aa0';
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, r * 0.1);
    ctx.lineTo(r * 0.1, r * 0.1);
    ctx.lineTo(0, r * 0.2);
    ctx.closePath();
    ctx.fill();
    eyes(ctx, 0, -r * 0.18, r * (open ? 0.24 : 0.2), { color: '#ffd23d', gap: 1.25 });
    ctx.save();
    ctx.translate(0, -r * 0.5);
    drawGem(ctx, r * 0.1, GEMS.sapphire);
    ctx.restore();
  },
  tokotsu(ctx, r, col) {
    // 檮杌：虎に似て毛が長く、人の顔に虎の足、猪の牙。尾は一丈八尺。またの名を傲狠・難訓（教えようのない者）
    // 長い尾
    ctx.strokeStyle = mix(col, '#000000', 0.2);
    ctx.lineWidth = r * 0.16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.7, r * 0.7);
    ctx.bezierCurveTo(r * 1.7, r * 0.6, r * 1.55, -r * 0.9, r * 0.6, -r * 1.25);
    ctx.quadraticCurveTo(-r * 0.4, -r * 1.55, -r * 1.2, -r * 1.05);
    ctx.stroke();
    ctx.strokeStyle = rgba('#d8f0e0', 0.35);
    ctx.lineWidth = r * 0.05;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-r * 1.25, -r * 1.0, r * 0.22, r * 0.14, -0.6, 0, TAU);
    ctx.fillStyle = mix(col, '#d8f0e0', 0.3);
    ctx.fill();
    // 長い毛の体
    ctx.beginPath();
    ctx.moveTo(-r * 1.05, -r * 0.2);
    ctx.quadraticCurveTo(-r * 1.0, -r * 0.95, 0, -r * 0.95);
    ctx.quadraticCurveTo(r * 1.0, -r * 0.95, r * 1.05, -r * 0.2);
    ctx.lineTo(r * 1.05, r * 0.7);
    for (let i = 0; i <= 10; i++) {
      const x = r * 1.05 - (i / 10) * r * 2.1;
      ctx.lineTo(x + r * 0.05, r * (i % 2 ? 0.75 : 1.02));
    }
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r * 1.1, col);
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.03;
    ctx.stroke();
    ctx.strokeStyle = rgba('#d8f0e0', 0.25);
    ctx.lineWidth = r * 0.025;
    for (let i = 0; i < 9; i++) {
      const x = -r * 0.9 + i * r * 0.225;
      ctx.beginPath();
      ctx.moveTo(x, r * 0.1);
      ctx.quadraticCurveTo(x + r * 0.05, r * 0.5, x - r * 0.02, r * 0.85);
      ctx.stroke();
    }
    // 虎の足
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * r * 0.55, r * 1.05, r * 0.26, r * 0.15, 0, 0, TAU);
      ctx.fillStyle = mix(col, '#e8c070', 0.35);
      ctx.fill();
      ctx.strokeStyle = RIM;
      ctx.lineWidth = r * 0.025;
      ctx.stroke();
      for (let k = -1; k <= 1; k++) fang(ctx, s * r * 0.55 + k * r * 0.1, r * 1.12, r * 0.06, r * 0.1);
    }
    // 人の顔
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.2, r * 0.48, r * 0.56, 0, 0, TAU);
    ctx.fillStyle = bodyGrad(ctx, r * 0.55, '#e0d4c0');
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,30,0.6)';
    ctx.lineWidth = r * 0.03;
    ctx.stroke();
    // たてがみ（顔を囲む長い毛）
    ctx.strokeStyle = mix(col, '#d8f0e0', 0.2);
    ctx.lineWidth = r * 0.07;
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(s * r * (0.3 + i * 0.05), -r * 0.72 + i * r * 0.05);
      ctx.quadraticCurveTo(s * r * (0.72 + i * 0.05), -r * 0.2, s * r * (0.48 + i * 0.08), r * (0.35 + i * 0.1));
      ctx.stroke();
    }
    // 眉と口と牙
    ctx.strokeStyle = '#2a1a14';
    ctx.lineWidth = r * 0.06;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.05, -r * 0.32);
      ctx.lineTo(s * r * 0.36, -r * 0.42);
      ctx.stroke();
    }
    eyes(ctx, 0, -r * 0.22, r * 0.15, { color: '#ffcc66', gap: 1.35 });
    ctx.beginPath();
    ctx.moveTo(-r * 0.22, r * 0.18);
    ctx.quadraticCurveTo(0, r * 0.08, r * 0.22, r * 0.18);
    ctx.strokeStyle = '#2a1a14';
    ctx.lineWidth = r * 0.045;
    ctx.stroke();
    fang(ctx, -r * 0.2, r * 0.18, r * 0.08, r * 0.22, true);
    fang(ctx, r * 0.2, r * 0.18, r * 0.08, r * 0.22, true);
    ctx.save();
    ctx.translate(0, -r * 0.62);
    drawGem(ctx, r * 0.1, GEMS.nephrite);
    ctx.restore();
  },
  totetsu(ctx, r, col, f) {
    // 饕餮：首があって体がない。青銅の器に刻まれた貪欲の怪物。f=1 は大きく口を開けて吸い込む
    const open = f === 1;
    const gold = '#f0d58a';
    // 巻いた角
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.3, -r * 0.6);
      ctx.bezierCurveTo(s * r * 0.4, -r * 1.5, s * r * 1.55, -r * 1.45, s * r * 1.5, -r * 0.7);
      ctx.bezierCurveTo(s * r * 1.45, -r * 0.35, s * r * 1.05, -r * 0.4, s * r * 1.05, -r * 0.7);
      ctx.bezierCurveTo(s * r * 1.05, -r * 1.0, s * r * 0.75, -r * 1.05, s * r * 0.62, -r * 0.6);
      ctx.closePath();
      const hg = ctx.createLinearGradient(0, -r * 1.4, 0, -r * 0.4);
      hg.addColorStop(0, mix(col, '#ffffff', 0.3));
      hg.addColorStop(1, mix(col, '#000000', 0.35));
      ctx.fillStyle = hg;
      ctx.fill();
      ctx.strokeStyle = gold;
      ctx.lineWidth = r * 0.03;
      ctx.stroke();
    }
    // 顔の板
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.95);
    ctx.lineTo(r * 0.55, -r * 0.7);
    ctx.lineTo(r * 1.15, -r * 0.45);
    ctx.quadraticCurveTo(r * 1.3, r * 0.05, r * 1.05, r * 0.35);
    ctx.lineTo(r * 0.7, r * 0.55);
    ctx.quadraticCurveTo(r * 0.5, r * 1.05, 0, r * 1.05);
    ctx.quadraticCurveTo(-r * 0.5, r * 1.05, -r * 0.7, r * 0.55);
    ctx.lineTo(-r * 1.05, r * 0.35);
    ctx.quadraticCurveTo(-r * 1.3, r * 0.05, -r * 1.15, -r * 0.45);
    ctx.lineTo(-r * 0.55, -r * 0.7);
    ctx.closePath();
    ctx.fillStyle = bodyGrad(ctx, r * 1.2, col);
    ctx.fill();
    ctx.strokeStyle = gold;
    ctx.lineWidth = r * 0.035;
    ctx.stroke();
    // 雲雷文
    ctx.strokeStyle = rgba(gold, 0.75);
    ctx.lineWidth = r * 0.025;
    for (const s of [-1, 1]) {
      spiral(ctx, s * r * 0.92, -r * 0.05, r * 0.18, 1.6, s);
      spiral(ctx, s * r * 0.85, r * 0.32, r * 0.12, 1.4, -s);
      spiral(ctx, s * r * 0.35, -r * 0.68, r * 0.12, 1.4, s);
    }
    // 鼻筋
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 0.85);
    ctx.lineTo(r * 0.1, -r * 0.85);
    ctx.lineTo(r * 0.16, r * 0.15);
    ctx.quadraticCurveTo(r * 0.3, r * 0.22, r * 0.22, r * 0.3);
    ctx.lineTo(-r * 0.22, r * 0.3);
    ctx.quadraticCurveTo(-r * 0.3, r * 0.22, -r * 0.16, r * 0.15);
    ctx.closePath();
    ctx.fillStyle = mix(col, '#ffffff', 0.15);
    ctx.fill();
    ctx.strokeStyle = gold;
    ctx.lineWidth = r * 0.025;
    ctx.stroke();
    // 目（飛び出た丸い目）
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * r * 0.48, -r * 0.25, r * 0.26, r * 0.2, s * 0.15, 0, TAU);
      ctx.fillStyle = '#1a1208';
      ctx.fill();
      ctx.strokeStyle = gold;
      ctx.lineWidth = r * 0.035;
      ctx.stroke();
      oneEye(ctx, s * r * 0.48, -r * 0.25, r * 0.15, '#ffb03d');
    }
    // 口
    if (open) {
      ctx.beginPath();
      ctx.ellipse(0, r * 0.62, r * 0.55, r * 0.36, 0, 0, TAU);
      ctx.fillStyle = '#12060a';
      ctx.fill();
      ctx.strokeStyle = gold;
      ctx.lineWidth = r * 0.03;
      ctx.stroke();
      glowBlob(ctx, 0, r * 0.66, r * 0.4, '#ff6a2a', 0.55);
      for (let i = -3; i <= 3; i++) fang(ctx, i * r * 0.14, r * 0.3, r * 0.1, r * (Math.abs(i) === 3 ? 0.3 : 0.16));
      for (let i = -2; i <= 2; i++) fang(ctx, i * r * 0.16, r * 0.95, r * 0.1, r * 0.16, true);
    } else {
      ctx.strokeStyle = '#12060a';
      ctx.lineWidth = r * 0.06;
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, r * 0.5);
      ctx.quadraticCurveTo(0, r * 0.7, r * 0.6, r * 0.5);
      ctx.stroke();
      for (let i = -3; i <= 3; i++) fang(ctx, i * r * 0.17, r * 0.52 + Math.abs(i) * r * -0.02, r * 0.1, r * (Math.abs(i) === 3 ? 0.32 : 0.14));
    }
    ctx.save();
    ctx.translate(0, -r * 0.72);
    drawGem(ctx, r * 0.12, GEMS.diamond);
    ctx.restore();
  },
  konton(ctx, r, col, f) {
    // 渾沌（帝江）：黄色い袋のような体で、丹のように赤く光る。六本の足と四枚の翼があり、顔はない。歌と舞を知っている。
    // f は開いた穴（竅）の数（0〜6）。左目・右目・左耳・右耳・左の鼻・右の鼻の順に開き、七つ目で死ぬ
    ctx.globalAlpha = 0.7;
    for (const s of [-1, 1]) {
      for (const [ty, sz, rot] of [[-0.55, 1, -0.45], [0.15, 0.78, 0.25]]) {
        ctx.beginPath();
        ctx.ellipse(s * r * 1.0, ty * r, r * 0.62 * sz, r * 0.28 * sz, s * rot, 0, TAU);
        const g = ctx.createRadialGradient(s * r * 0.6, ty * r, 0, s * r * 1.0, ty * r, r * 0.65 * sz);
        g.addColorStop(0, '#fff2c0');
        g.addColorStop(1, '#ff8a3d');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = RIM;
        ctx.lineWidth = r * 0.02;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // 六本の足
    ctx.strokeStyle = '#3a1a0a';
    ctx.lineWidth = r * 0.06;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(s * r * (0.25 + i * 0.2), r * 0.7);
      ctx.lineTo(s * r * (0.55 + i * 0.25), r * 0.95);
      ctx.lineTo(s * r * (0.45 + i * 0.3), r * 1.32);
      ctx.stroke();
    }
    // 袋の体
    ctx.beginPath();
    ctx.moveTo(-r * 0.22, -r * 0.92);
    ctx.quadraticCurveTo(-r * 1.0, -r * 0.55, -r * 0.92, r * 0.25);
    ctx.quadraticCurveTo(-r * 0.75, r * 0.95, 0, r * 0.95);
    ctx.quadraticCurveTo(r * 0.75, r * 0.95, r * 0.92, r * 0.25);
    ctx.quadraticCurveTo(r * 1.0, -r * 0.55, r * 0.22, -r * 0.92);
    ctx.closePath();
    const g = ctx.createRadialGradient(-r * 0.25, -r * 0.35, r * 0.05, 0, r * 0.1, r * 1.05);
    g.addColorStop(0, '#fff6c8');
    g.addColorStop(0.35, col);
    g.addColorStop(0.8, '#e8502a');
    g.addColorStop(1, '#8a1a10');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = r * 0.03;
    ctx.stroke();
    glowBlob(ctx, 0, r * 0.35, r * 0.75, '#ff3d1a', 0.35);
    // 袋の口（結び目）
    ctx.strokeStyle = '#c8302a';
    ctx.lineWidth = r * 0.08;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.9);
    ctx.quadraticCurveTo(0, -r * 0.75, r * 0.3, -r * 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, -r * 0.9);
    ctx.quadraticCurveTo(-r * 0.3, -r * 1.2, -r * 0.05, -r * 1.25);
    ctx.moveTo(r * 0.12, -r * 0.9);
    ctx.quadraticCurveTo(r * 0.3, -r * 1.2, r * 0.05, -r * 1.25);
    ctx.stroke();
    shine(ctx, r * 0.8);
    // 竅（開いた穴）
    const holes = [[-0.34, -0.2, 0.15, 0.1], [0.34, -0.2, 0.15, 0.1], [-0.82, 0.0, 0.06, 0.13], [0.82, 0.0, 0.06, 0.13], [-0.09, 0.14, 0.05, 0.06], [0.09, 0.14, 0.05, 0.06]];
    const n = Math.max(0, Math.min(6, f | 0));
    for (let i = 0; i < n; i++) {
      const [x, y, w, h] = holes[i];
      glowBlob(ctx, x * r, y * r, r * Math.max(w, h) * 2.2, '#ff5a1a', 0.7);
      ctx.beginPath();
      ctx.ellipse(x * r, y * r, w * r, h * r, 0, 0, TAU);
      ctx.fillStyle = '#0a0204';
      ctx.fill();
      ctx.strokeStyle = '#ffb03d';
      ctx.lineWidth = r * 0.025;
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(0, -r * 1.3);
    drawGem(ctx, r * 0.11, GEMS.topaz);
    ctx.restore();
  },
  crystal(ctx, r) {
    const cols = [
      { color: '#ffd6f5', light: '#ffffff', dark: '#d07bb8' },
      { color: '#d6f0ff', light: '#ffffff', dark: '#6fa6d0' },
      { color: '#fff3b0', light: '#ffffff', dark: '#d0a84a' },
    ];
    ctx.save(); ctx.translate(-r * 0.45, r * 0.15); ctx.rotate(-0.35); drawGem(ctx, r * 0.6, cols[1], 'long'); ctx.restore();
    ctx.save(); ctx.translate(r * 0.45, r * 0.2); ctx.rotate(0.35); drawGem(ctx, r * 0.55, cols[2], 'long'); ctx.restore();
    ctx.save(); ctx.translate(0, -r * 0.1); drawGem(ctx, r * 0.85, cols[0], 'long'); ctx.restore();
  },
};

const enemyCache = new Map();
// ランの始めに敵の絵を捨てる（ステージごとに敵が違うので、遊ぶほど溜まり続けないように。
// iOS の Safari はキャンバスのメモリの上限が小さい。渾沌は穴の数ごとに大きな絵を作る）
export function clearEnemySprites() {
  for (const c of enemyCache.values()) c.width = c.height = 1;
  enemyCache.clear();
}
export function enemySprite(type, r, frame = 0, flash = false, colOverride) {
  const key = type + ':' + r + ':' + frame + ':' + (flash ? 1 : 0) + ':' + (colOverride || '');
  let c = enemyCache.get(key);
  if (c) return c;
  const S = r * 3.4;
  c = makeCanvas(S * RES, S * RES);
  paintEnemy(c, type, r, frame, flash, colOverride);
  c.logical = S;
  enemyCache.set(key, c);
  return c;
}
// 図鑑の敵のアイコン（dataURL）
export function enemyIcon(type, r, colOverride) {
  const key = 'enemy:' + type + ':' + r + ':' + (colOverride || '');
  let u = iconCache.get(key);
  if (u) return u;
  const S = r * 3.4;
  const c = iconBegin(S * RES, S * RES);
  paintEnemy(c, type, r, 0, false, colOverride);
  u = iconEnd(c);
  iconCache.set(key, u);
  return u;
}
function paintEnemy(c, type, r, frame, flash, colOverride) {
  const S = r * 3.4;
  const ctx = c.getContext('2d');
  ctx.scale(RES, RES);
  ctx.translate(S / 2, S / 2);
  const draw = ENEMY_DRAW[type] || ENEMY_DRAW.slime;
  const col = colOverride || (ENEMY_COLORS[type] || '#6b5a8e');
  draw(ctx, r, col, frame);
  if (flash) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(0, 0, c.width, c.height);
  }
  outline(c, r >= 30 ? 1.6 : 1.1);
}

// 縁取り：外側に黒、内側に白の線を付ける（攻撃エフェクトの上でも敵の形が分かるように）。w は論理ピクセル
const outlineSrc = makeCanvas(1, 1), outlineTint = makeCanvas(1, 1);
function outline(c, w) {
  const W = c.width, H = c.height;
  // 元の絵を退避（幅を設定し直すと中身と状態がリセットされる）
  outlineSrc.width = W; outlineSrc.height = H;
  outlineSrc.getContext('2d').drawImage(c, 0, 0);
  outlineTint.width = W; outlineTint.height = H;
  const t = outlineTint.getContext('2d');
  const ctx = c.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, W, H);
  // 形を単色で塗った絵を、少しずつずらして周りに重ねる
  const ring = (color, d) => {
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, W, H);
    t.drawImage(outlineSrc, 0, 0);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = color;
    t.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctx.drawImage(outlineTint, Math.cos(a) * d, Math.sin(a) * d);
    }
  };
  ring('#000', w * 2 * RES);
  ring('#fff', w * RES);
  ctx.drawImage(outlineSrc, 0, 0);
  outlineSrc.width = outlineSrc.height = 1;
  outlineTint.width = outlineTint.height = 1;
}
const ENEMY_COLORS = {
  slime: '#7a64a8', bat: '#5a4a80', ghost: '#9c90c8', toge: '#6a3a70', golem: '#7a6a60', knight: '#3c3456',
  boss1: '#6a48a0', boss2: '#35235a', boss3: '#1a0d2a',
  spitter: '#3a5a7a', splitter: '#3a7a5a', charger: '#6a4a3a', phantom: '#2a1a4a',
  jelly: '#7f88e8', eel: '#2f7a7a', angler: '#4a4a78', squid: '#b0588a', crab: '#b8543a', deepone: '#2f7a62',
  motherjelly: '#b070d8', serpent: '#1f6a8a', dagon: '#1f5a6a',
  spawn: '#5a5a70', byakhee: '#4a4a62', eyes: '#4e4c66', thorn: '#5a3a5a', crawler: '#7a5a5a', cultist: '#2a2438',
  starspawn: '#3f8a6a', mindeye: '#6a4a8a', shoggoth: '#1f3a32', nightgaunt: '#2a2a3a', cthulhu: '#2f7a5a',
  teapot: '#c8b8d8', servant: '#7a8a7a', lady: '#8a94c8', kelpie: '#3a5a6a', glaaki: '#6a6a8a',
  yellowsign: '#e0b030', masked: '#5a2a4a', kingyellow: '#d8b030',
  hal: '#8a8aa0', migo: '#b0708a', monolith: '#05030a',
  piper: '#3a2a5a', flutist: '#4a3a6a', azathoth: '#2a1a4a',
  moryo: '#5a2a32', kochou: '#5a4a38', chimi: '#4a6a5a', kyubi: '#b8783a', kui: '#3a5a7a', keiten: '#6a5040',
  hippou: '#3a6ab8', yokko: '#3a4a6a', bunyo: '#3a7ab0', tsuchi: '#7a5a3a', kanae: '#4f8a72', seicho: '#3a7ad8', houkyou: '#c8c0b0', maiko: '#f0b030', nomi: '#9aa0b0',
  kyuei: '#4a3a5a', taifu: '#4a5a7a', fuki: '#5a3a2a', shuda: '#2a4a3a', atsuyu: '#8a2a2a', sakushi: '#6a5a4a', shuku: '#a83a2a', kotsu: '#2a2a5a',
  kyuki: '#2a3a5a', tokotsu: '#3a4a3a', totetsu: '#3f6a5a', konton: '#f0b030',
};

// ------------------------------------------------------------------ プレイヤー
// 輪郭（体＋耳）を 1本のパスで
function silhouette(ctx, r) {
  const D = Math.PI / 180;
  const at = (deg) => [Math.cos(deg * D) * r, Math.sin(deg * D) * r];
  const lo = at(-148), li = at(-112), ro = at(-32);
  ctx.beginPath();
  ctx.moveTo(lo[0], lo[1]);
  ctx.quadraticCurveTo(-r * 1.0, -r * 1.25, -r * 0.74, -r * 1.55);
  ctx.quadraticCurveTo(-r * 0.46, -r * 1.25, li[0], li[1]);
  ctx.arc(0, 0, r, -112 * D, -68 * D);
  ctx.quadraticCurveTo(r * 0.46, -r * 1.25, r * 0.74, -r * 1.55);
  ctx.quadraticCurveTo(r * 1.0, -r * 1.25, ro[0], ro[1]);
  ctx.arc(0, 0, r, -32 * D, 212 * D);
  ctx.closePath();
}

export function drawPlayer(ctx, p, time, gemId) {
  const g = GEMS[gemId] || GEMS.ruby;
  const glow = g.rainbow ? '#d9c4ff' : g.glow || g.color;
  const r = 15;
  const bob = Math.sin(time * 6) * (p.moving ? 2 : 1.2);
  const hurt = p.hurtT > 0 && Math.floor(time * 30) % 2 === 0;
  ctx.save();
  ctx.translate(p.x, p.y);
  // 足元の光
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.4;
  const halo = dotSprite(glow);
  ctx.drawImage(halo, -r * 2.4, -r * 2.4 + bob, r * 4.8, r * 4.8);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = rgba(glow, 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, r + 5, r * 0.9, r * 0.28, 0, 0, TAU);
  ctx.stroke();

  ctx.translate(0, bob - 2);
  ctx.scale(p.face, 1);
  // からだ（黒地）
  silhouette(ctx, r);
  ctx.fillStyle = hurt ? '#3a0a14' : '#060609';
  ctx.fill();
  // 輪郭
  ctx.shadowColor = hurt ? '#ff2d55' : glow;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = hurt ? '#ff8aa0' : '#ffffff';
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.shadowBlur = 0;
  // 瞳（ジュエル）
  for (const s of [-1, 1]) {
    const ex = s * r * 0.36 + r * 0.08, ey = -r * 0.02;
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
    const eg = ctx.createLinearGradient(ex, ey - r * 0.35, ex, ey + r * 0.35);
    eg.addColorStop(0, g.rainbow ? '#8a6fc4' : g.dark);
    eg.addColorStop(0.5, g.rainbow ? '#e0c9ff' : g.color);
    eg.addColorStop(1, g.rainbow ? '#9ff6ff' : g.light);
    ctx.beginPath();
    ctx.ellipse(ex, ey, r * 0.19, r * 0.3, 0, 0, TAU);
    ctx.fillStyle = eg;
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex - r * 0.06, ey - r * 0.12, r * 0.075, 0, TAU);
    ctx.fill();
    sparkle(ctx, ex + r * 0.06, ey + r * 0.11, r * 0.07, '#fff');
  }
  ctx.restore();
}

// ------------------------------------------------------------------ アイテム
export const XP_TIERS = [
  { min: 0, gem: { color: '#4da3ff', light: '#d6ebff', dark: '#1a4fa0', cut: 'round' }, size: 9 },
  { min: 5, gem: { color: '#27d98a', light: '#c9ffe6', dark: '#0a6a3c', cut: 'round' }, size: 11 },
  { min: 20, gem: { color: '#ff3d6e', light: '#ffc6d6', dark: '#8a0028', cut: 'round' }, size: 13 },
  { min: 100, gem: { color: '#f4e9ff', light: '#ffffff', dark: '#b9a4d6', cut: 'star', rainbow: true }, size: 17 },
];
export function xpSprite(value) {
  let t = XP_TIERS[0];
  for (const tier of XP_TIERS) if (value >= tier.min) t = tier;
  return gemSprite(t.gem, t.size, t.gem.cut);
}

const itemCache = new Map();
export function itemSprite(kind) {
  let c = itemCache.get(kind);
  if (c) return c;
  const S = 40;
  c = makeCanvas(S * RES, S * RES);
  const ctx = c.getContext('2d');
  ctx.scale(RES, RES);
  ctx.translate(S / 2, S / 2);
  if (kind === 'coin' || kind === 'bigcoin') {
    const r = kind === 'bigcoin' ? 13 : 8;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
    g.addColorStop(0, '#fff8c4');
    g.addColorStop(0.6, '#ffc21a');
    g.addColorStop(1, '#c47a00');
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#8a5200';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.7, 0, TAU);
    ctx.strokeStyle = 'rgba(138,82,0,0.5)';
    ctx.stroke();
    sparkle(ctx, 0, 0, r * 0.5, '#fff6b0');
  } else if (kind === 'heart') {
    drawGem(ctx, 11, { color: '#ff4d8d', light: '#ffc2d9', dark: '#9a0040' }, 'heart');
  } else if (kind === 'magnet') {
    ctx.lineWidth = 6;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#ff3b5c';
    ctx.beginPath();
    ctx.arc(0, -2, 9, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-9, -2); ctx.lineTo(-9, 8);
    ctx.moveTo(9, -2); ctx.lineTo(9, 8);
    ctx.stroke();
    ctx.strokeStyle = '#e8e8f0';
    ctx.beginPath();
    ctx.moveTo(-9, 5); ctx.lineTo(-9, 11);
    ctx.moveTo(9, 5); ctx.lineTo(9, 11);
    ctx.stroke();
    sparkle(ctx, 8, -10, 4, '#fff');
  } else if (kind === 'bomb') {
    drawGem(ctx, 12, { color: '#f4e9ff', light: '#ffffff', dark: '#b9a4d6', rainbow: true }, 'star');
  } else if (kind === 'clock') {
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, TAU);
    ctx.fillStyle = '#e6f7ff';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#3a8fd6';
    ctx.stroke();
    ctx.strokeStyle = '#1a3a6a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, -7);
    ctx.moveTo(0, 0); ctx.lineTo(5, 2);
    ctx.stroke();
  } else if (kind === 'chest' || kind === 'bigchest') {
    const s = kind === 'bigchest' ? 1.25 : 1;
    ctx.scale(s, s);
    ctx.fillStyle = '#1b1828';
    ctx.strokeStyle = '#e0b85a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-12, -3, 24, 14, 3) : ctx.rect(-12, -3, 24, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#26223a';
    ctx.beginPath();
    ctx.moveTo(-12, -3);
    ctx.quadraticCurveTo(0, -16, 12, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e0b85a';
    ctx.fillRect(-12, -4, 24, 2);
    ctx.fillRect(-1.5, -10, 3, 20);
    ctx.save();
    ctx.translate(0, 2);
    drawGem(ctx, 4, GEMS.ruby);
    ctx.restore();
  }
  c.logical = S;
  c.base = kind === 'bigcoin' ? 26 : kind === 'coin' ? 16 : 24;
  itemCache.set(kind, c);
  return c;
}

// ------------------------------------------------------------------ 背景
const bgCache = new Map();
const DEFAULT_PAL = { bg: '#07070d', grid: '160,140,255', mark: '200,180,255', dust: '210,200,255' };
export function backgroundTile(pal = DEFAULT_PAL) {
  const key = pal.bg + pal.grid;
  let t = bgCache.get(key);
  if (t) return t;
  const S = 256;
  t = makeCanvas(S, S);
  const ctx = t.getContext('2d');
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, S, S);
  // うすい グリッド
  ctx.strokeStyle = `rgba(${pal.grid},0.06)`;
  ctx.lineWidth = 1;
  for (let i = 0; i <= S; i += 64) {
    ctx.beginPath(); ctx.moveTo(i + 0.5, 0); ctx.lineTo(i + 0.5, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i + 0.5); ctx.lineTo(S, i + 0.5); ctx.stroke();
  }
  // 交点の しるし
  ctx.fillStyle = `rgba(${pal.mark},0.16)`;
  for (let x = 0; x < S; x += 64) for (let y = 0; y < S; y += 64) {
    ctx.beginPath();
    ctx.moveTo(x, y - 3); ctx.lineTo(x + 3, y); ctx.lineTo(x, y + 3); ctx.lineTo(x - 3, y);
    ctx.closePath();
    ctx.fill();
  }
  // ちり
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * S, y = rnd() * S, a = 0.05 + rnd() * 0.18;
    ctx.fillStyle = `rgba(${pal.dust},${a})`;
    ctx.fillRect(x, y, 1, 1);
  }
  bgCache.set(key, t);
  return t;
}

// 水晶柱
const pillarCache = new Map();
export function pillarSprite(r, v) {
  const key = r + ':' + v;
  let c = pillarCache.get(key);
  if (c) return c;
  const S = r * 4;
  c = makeCanvas(S * RES, S * RES);
  const ctx = c.getContext('2d');
  ctx.scale(RES, RES);
  ctx.translate(S / 2, S * 0.62);
  // 影
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.15, r * 1.1, r * 0.45, 0, 0, TAU);
  ctx.fill();
  const cols = [
    { color: '#4fc8ff', light: '#e0fbff', dark: '#0f4a7a' },
    { color: '#8f7fff', light: '#ece8ff', dark: '#2a1f7a' },
    { color: '#5fffd0', light: '#e0fff4', dark: '#0f6a5a' },
    { color: '#9fd8ff', light: '#ffffff', dark: '#2a5a8a' },
  ];
  const cc = cols[v % 4];
  const parts = [[-0.55, -0.35, -0.45, 0.55], [0.55, -0.3, 0.4, 0.5], [0, -0.75, 0, 0.9], [0.25, -0.2, 0.2, 0.4]];
  for (const [x, y, rot, sz] of parts) {
    ctx.save(); ctx.translate(x * r, y * r); ctx.rotate(rot); drawGem(ctx, r * sz, cc, 'long'); ctx.restore();
  }
  c.logical = S;
  pillarCache.set(key, c);
  return c;
}

// 三日月／満月
const moonCache = new Map();
export function moonSprite(size, full) {
  const key = size + ':' + (full ? 1 : 0);
  let c = moonCache.get(key);
  if (c) return c;
  const S = size * 2.2;
  c = makeCanvas(S * RES, S * RES);
  const ctx = c.getContext('2d');
  ctx.scale(RES, RES);
  ctx.translate(S / 2, S / 2);
  const r = size / 2;
  ctx.shadowColor = '#9fb8ff';
  ctx.shadowBlur = r * 0.8;
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.6, '#d8e4ff');
  g.addColorStop(1, '#7f96d8');
  ctx.fillStyle = g;
  ctx.beginPath();
  if (full) ctx.arc(0, 0, r, 0, TAU);
  else {
    ctx.arc(0, 0, r, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.arc(-r * 0.35, 0, r * 0.93, Math.PI * 0.42, -Math.PI * 0.42, true);
  }
  ctx.fill();
  ctx.shadowBlur = 0;
  c.logical = S;
  c.base = size;
  moonCache.set(key, c);
  return c;
}

