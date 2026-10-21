// 小さな便利関数たち
export const TAU = Math.PI * 2;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const lerp = (a, b, t) => a + (b - a) * t;
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

// その日の日付の文字列（ログインボーナス・経営の配当の 1 日の区切り）
export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
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

// 画像を 1 度だけ読み込んで、blob の URL に差し替える（宝石・百獣の絵）。サービスワーカーが入っていると、
// <img> を作るたびに読み込み済みの画像でもサービスワーカーを通って 0.1 秒ほど待ち、出るのが遅れたり、
// 描き直しでちらついたりする。blob の URL はサービスワーカーを通らないので、すぐ出る。
// 読み込みが終わるまでは元の URL のまま
const blobUrls = {};
export const imgUrl = (path) => blobUrls[path] || path;
export function preloadImages(paths) {
  return Promise.all(paths.map((p) => fetch(p)
    .then((r) => (r.ok ? r.blob() : null))
    .then((b) => { if (b) blobUrls[p] = URL.createObjectURL(b); })
    .catch(() => {})));
}
