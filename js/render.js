// =====================================================================
//  絵：ぜんぶ コードで かく（画像ファイル不要）
// =====================================================================
import { GEMS } from './data.js';
import { TAU, mix, rgba, hexToRgb } from './util.js';

const RES = 2; // スプライトの 解像度倍率

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return c;
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
  drawGem(ctx, size / 2, g, cutOverride);
  c.logical = size + pad * 2;
  c.base = size;
  gemCache.set(key, c);
  return c;
}

const iconCache = new Map();
export function gemIcon(id, size = 72) {
  const key = id + ':' + size;
  let u = iconCache.get(key);
  if (u) return u;
  const g = GEMS[id];
  const c = makeCanvas(size * 2, size * 2);
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  ctx.translate(size / 2, size / 2);
  drawGem(ctx, size * 0.36, g);
  u = c.toDataURL();
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
export function enemySprite(type, r, frame = 0, flash = false, colOverride) {
  const key = type + ':' + r + ':' + frame + ':' + (flash ? 1 : 0) + ':' + (colOverride || '');
  let c = enemyCache.get(key);
  if (c) return c;
  const S = r * 3.4;
  c = makeCanvas(S * RES, S * RES);
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
  c.logical = S;
  enemyCache.set(key, c);
  return c;
}
const ENEMY_COLORS = {
  slime: '#7a64a8', bat: '#5a4a80', ghost: '#9c90c8', toge: '#6a3a70', golem: '#7a6a60', knight: '#3c3456',
  boss1: '#6a48a0', boss2: '#35235a', boss3: '#1a0d2a',
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
  const glow = g.rainbow ? '#d9c4ff' : g.color;
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
  // からだ（暗いガラス）
  silhouette(ctx, r);
  const bg = ctx.createRadialGradient(-r * 0.35, -r * 0.45, 1, 0, 0, r * 1.3);
  bg.addColorStop(0, hurt ? 'rgba(255,80,110,0.6)' : 'rgba(255,255,255,0.22)');
  bg.addColorStop(0.55, rgba(glow, 0.14));
  bg.addColorStop(1, 'rgba(8,8,16,0.88)');
  ctx.fillStyle = bg;
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
let bgTile = null;
export function backgroundTile() {
  if (bgTile) return bgTile;
  const S = 256;
  bgTile = makeCanvas(S, S);
  const ctx = bgTile.getContext('2d');
  ctx.fillStyle = '#07070d';
  ctx.fillRect(0, 0, S, S);
  // うすい グリッド
  ctx.strokeStyle = 'rgba(160,140,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= S; i += 64) {
    ctx.beginPath(); ctx.moveTo(i + 0.5, 0); ctx.lineTo(i + 0.5, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i + 0.5); ctx.lineTo(S, i + 0.5); ctx.stroke();
  }
  // 交点の しるし
  ctx.fillStyle = 'rgba(200,180,255,0.16)';
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
    ctx.fillStyle = `rgba(210,200,255,${a})`;
    ctx.fillRect(x, y, 1, 1);
  }
  return bgTile;
}

export function hexA(hex, a) { return rgba(hex, a); }
export { hexToRgb };
