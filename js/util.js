// 小さな便利関数たち
export const TAU = Math.PI * 2;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};
export const chance = (p) => Math.random() < p;

export function weightedPick(items, weightFn) {
  let total = 0;
  for (const it of items) total += weightFn(it);
  let r = Math.random() * total;
  for (const it of items) {
    r -= weightFn(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function fmt(n) {
  n = Math.floor(n);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ダメージ数字は「ドパ」っぽく k / M 表記もする
export function fmtShort(n) {
  n = Math.floor(n);
  if (n >= 1e7) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e5) return Math.floor(n / 1e3) + 'K';
  return String(n);
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export const ease = {
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
};

// 色ユーティリティ
const _rgbCache = new Map();
export function hexToRgb(hex) {
  let c = _rgbCache.get(hex);
  if (c) return c;
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  c = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  _rgbCache.set(hex, c);
  return c;
}
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const r = Math.round(lerp(A[0], B[0], t)), g = Math.round(lerp(A[1], B[1], t)), bl = Math.round(lerp(A[2], B[2], t));
  return `rgb(${r},${g},${bl})`;
}
export function rgba(hex, a) {
  const c = hexToRgb(hex);
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

export const RAINBOW = ['#ff4d6d', '#ff9f1c', '#ffe14d', '#4ade80', '#38bdf8', '#818cf8', '#e879f9'];
export const hsl = (h, s = 100, l = 60) => `hsl(${h},${s}%,${l}%)`;
