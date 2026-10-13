// =====================================================================
//  ジュエル選択の展示（額装）。奥のベルベットは宝石ごと、枠は共通。1 度だけ描いて dataURL を使い回す
//  重ね順：奥（ベルベット・宝石の影）→ 宝石（gemIcon の img）→ 枠（内側の壁・額・ガラスの映り込み）
// =====================================================================
import { iconBegin } from './render.js';
import { TAU, hexToRgb } from './util.js';

const W = 120, H = 148, K = 3;
// 額の外形と窓（展示ケースの CSS の大きさに合わせる）
const X0 = 4, Y0 = 4, FW = 112, FH = 140, F = 9;
const IX = X0 + F, IY = Y0 + F, IW = FW - 2 * F, IH = FH - 2 * F;
// 宝石の中心と半径（css の .sc-gem の位置と合わせる）
const CASE_GEM = { x: 60, y: 70, r: 29 };
// 奥のベルベットの彩度をどれだけ落とすか（0 で宝石の色のまま、1 で灰色）
const DESAT = 0.65;

const backCache = new Map();
let frontUrl = null;

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgbaStr = (c, a) => `rgba(${c.map((v) => Math.round(clamp(v, 0, 255))).join(',')},${a})`;
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function desat(c, k) {
  const l = c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
  return mixRgb(c, [l, l, l], k);
}

// 奥：ベルベット（上の枠の影が落ち、上寄りの真ん中にだけ光が当たる。細かい毛羽のざらつき）と、浮いた宝石の影
export function showcaseBack(color, locked = false) {
  const key = color + (locked ? ':locked' : '');
  let u = backCache.get(key);
  if (u) return u;
  const gem = hexToRgb(color);
  const col = locked ? [64, 62, 72] : desat(gem, DESAT);
  const base = col.map((v) => v * 0.13 + 8), sheen = col.map((v) => v * 0.3 + 14);
  const c = iconBegin(W * K, H * K);
  const ctx = c.getContext('2d');
  const im = ctx.createImageData(c.width, c.height);
  const d = im.data;
  const R = rng(7);
  for (let Y = 0; Y < c.height; Y++) {
    const y = Y / K;
    for (let X = 0; X < c.width; X++) {
      const x = X / K;
      const n = 1 + (R() - 0.5) * 0.14;
      let p;
      if (x >= IX && x < IX + IW && y >= IY && y < IY + IH) {
        const top = 0.35 + 0.65 * smooth(0, 14, y - IY);
        const sp = Math.exp(-Math.pow((x - 60) / 40, 2) - Math.pow((y - 50) / 60, 2)) * 0.6;
        p = [0, 1, 2].map((i) => (base[i] + (sheen[i] - base[i]) * sp) * top * n);
      } else {
        const t = y / H;
        p = [12 - 5 * t, 11 - 5 * t, 18 - 7 * t];
      }
      const i = (Y * c.width + X) * 4;
      d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = 255;
    }
  }
  ctx.putImageData(im, 0, 0);
  ctx.setTransform(K, 0, 0, K, 0, 0);
  // 宝石の影（右下へずらしてぼかす）と、宝石を抜けた色の光
  const { x: gx, y: gy, r: gr } = CASE_GEM;
  const sx = gx + 7, sy = gy + 11;
  let g = ctx.createRadialGradient(sx, sy, gr * 0.2, sx, sy, gr * 1.25);
  g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sx, sy, gr * 1.25, gr * 1.15, 0, 0, TAU); ctx.fill();
  if (!locked) {
    const cx = gx + 11, cy = gy + 19;
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr * 0.9);
    g.addColorStop(0, rgbaStr(mixRgb(gem, [255, 255, 255], 0.25), 0.26)); g.addColorStop(1, rgbaStr(gem, 0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, gr * 0.9, gr * 0.75, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  u = c.toDataURL('image/jpeg', 0.9);
  c.width = c.height = 1;
  backCache.set(key, u);
  return u;
}

// 手前：窓の内側の壁（上は暗く下は明るい）、黒い漆の額、金の細い縁、ガラスの映り込み
export function showcaseFront() {
  if (frontUrl) return frontUrl;
  const c = iconBegin(W * K, H * K);
  const ctx = c.getContext('2d');
  ctx.setTransform(K, 0, 0, K, 0, 0);
  const wall = (pts, fill) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  const d = 5;
  wall([[IX, IY], [IX + IW, IY], [IX + IW - d, IY + d], [IX + d, IY + d]], 'rgba(0,0,0,0.75)');
  wall([[IX, IY], [IX + d, IY + d], [IX + d, IY + IH - d], [IX, IY + IH]], 'rgba(0,0,0,0.5)');
  wall([[IX + IW, IY], [IX + IW, IY + IH], [IX + IW - d, IY + IH - d], [IX + IW - d, IY + d]], 'rgba(0,0,0,0.45)');
  wall([[IX, IY + IH], [IX + d, IY + IH - d], [IX + IW - d, IY + IH - d], [IX + IW, IY + IH]], 'rgba(255,255,255,0.1)');
  ctx.beginPath();
  ctx.roundRect(X0, Y0, FW, FH, 5);
  ctx.rect(IX, IY, IW, IH);
  const g = ctx.createLinearGradient(0, Y0, 0, Y0 + FH);
  g.addColorStop(0, '#2b2733'); g.addColorStop(0.5, '#141219'); g.addColorStop(1, '#1d1a23');
  ctx.fillStyle = g;
  ctx.fill('evenodd');
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.roundRect(X0 + 0.5, Y0 + 0.5, FW - 1, FH - 1, 5); ctx.stroke();
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = 'rgba(214,176,92,0.55)';
  ctx.strokeRect(IX - 2.5, IY - 2.5, IW + 5, IH + 5);
  ctx.save();
  ctx.beginPath(); ctx.rect(IX, IY, IW, IH); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath(); ctx.moveTo(-10, 40); ctx.lineTo(40, -10); ctx.lineTo(62, -10); ctx.lineTo(-10, 62); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.beginPath(); ctx.moveTo(-10, 74); ctx.lineTo(74, -10); ctx.lineTo(80, -10); ctx.lineTo(-10, 80); ctx.fill();
  ctx.restore();
  frontUrl = c.toDataURL();
  c.width = c.height = 1;
  return frontUrl;
}
