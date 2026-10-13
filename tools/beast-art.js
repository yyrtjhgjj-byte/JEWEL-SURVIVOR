// =====================================================================
//  百獣の彫刻の絵（書き出し用。アプリからは読まない）
//  beasts.js の型（shape）を、縁で 0・中ほどが厚い立体にふくらませ、宝石と同じ光線追跡
//  （屈折・全反射・吸収・フレネル）で描く。輪郭と厚みは型のまま、面の向きだけを三角形ごとに
//  そろえてカットした宝石の置物に見せる。台座は黒い磨いた石。
//  tools/gem-bake.html から呼び、tools/test/gem-bake.js が img/beasts/*.webp に保存する
// =====================================================================
import { BEASTS } from '../js/beasts.js';

const D2R = Math.PI / 180;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// ---------------------------------------------------------------- 照明
// 黒い背景にソフトボックス。向き（az・el）と大きさ（r）は度。el が負なら物体の後ろ
function studio(o) {
  const L = o.lights.map((l) => ({ x: Math.cos(l.el * D2R) * Math.cos(l.az * D2R), y: Math.cos(l.el * D2R) * Math.sin(l.az * D2R), z: Math.sin(l.el * D2R), c0: Math.cos(l.r * D2R), c1: Math.cos(l.r * (o.soft || 1.3) * D2R), I: l.I }));
  const head = Math.cos((o.head || 16) * D2R), head2 = Math.cos((o.head || 16) * 1.4 * D2R);
  return (x, y, z) => {
    let v = z > 0 ? o.sky0 + o.sky1 * z * z : o.floor * (1 + z * 0.5);
    for (const l of L) { const c = x * l.x + y * l.y + z * l.z; if (c > l.c1) v += l.I * (c >= l.c0 ? 1 : (c - l.c1) / (l.c0 - l.c1)); }
    if (z > head2) v *= z > head ? 0.08 : 0.08 + (0.92 * (head - z)) / (head - head2);
    return v;
  };
}
const ring = (n, el, r, I, off = 0) => Array.from({ length: n }, (_, i) => ({ az: off + (i * 360) / n, el, r, I }));
// 透明な体：ソフトボックスと、後ろ上からの大きな柔らかい光（透けた色が見えるように）
const ENV = studio({ floor: 0.05, sky0: 0.03, sky1: 0.06, lights: [...ring(6, 42, 13, 2.6, 15), ...ring(4, 18, 9, 1.8, 40), ...ring(3, 64, 5, 7, 0), { az: 90, el: -38, r: 40, I: 1.1 }, { az: 270, el: -50, r: 30, I: 0.44 }] });
// 不透明な体：カボションと同じ少ない灯り
const ENV_OP = studio({ floor: 0.015, sky0: 0.03, sky1: 0.08, head: 8, soft: 1.7, lights: [{ az: 135, el: 50, r: 15, I: 5.5 }, { az: 35, el: 36, r: 9, I: 3 }, { az: 250, el: 28, r: 8, I: 2.4 }, { az: 200, el: 18, r: 10, I: 1.2 }] });
// 法線ごとの拡散光（ENV_OP を半球で積分した表）
const IRR = (() => {
  const N = 24, tab = new Float32Array(N * N), dirs = [];
  for (let i = 0; i < 900; i++) { const u = (i + 0.5) / 900, z = 1 - 2 * u, r = Math.sqrt(1 - z * z), ph = i * 2.399963; dirs.push([r * Math.cos(ph), r * Math.sin(ph), z]); }
  const L = dirs.map((d) => ENV_OP(d[0], d[1], d[2]));
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const th = (j / (N - 1)) * Math.PI, ph = (i / N) * Math.PI * 2;
    const n = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
    let s = 0;
    for (let k = 0; k < dirs.length; k++) { const c = n[0] * dirs[k][0] + n[1] * dirs[k][1] + n[2] * dirs[k][2]; if (c > 0) s += L[k] * c; }
    tab[j * N + i] = (s / dirs.length) * 2;
  }
  return (nx, ny, nz) => {
    const th = Math.acos(clamp(nz, -1, 1)), ph = (Math.atan2(ny, nx) + Math.PI * 2) % (Math.PI * 2);
    const fj = (th / Math.PI) * (N - 1), fi = (ph / (Math.PI * 2)) * N;
    const j0 = Math.min(N - 2, Math.floor(fj)), i0 = Math.floor(fi) % N, i1 = (i0 + 1) % N, tj = fj - j0, ti = fi - Math.floor(fi);
    const a = tab[j0 * N + i0] * (1 - ti) + tab[j0 * N + i1] * ti, b = tab[(j0 + 1) * N + i0] * (1 - ti) + tab[(j0 + 1) * N + i1] * ti;
    return a * (1 - tj) + b * tj;
  };
})();

// ---------------------------------------------------------------- ノイズ（不透明な石の模様）
function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct, s) { let v = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { v += a * vnoise(x * f, y * f, s + i * 17); f *= 2.03; a *= 0.5; } return v; }
const spectral = (h) => [clamp(Math.abs(h * 6 - 3) - 1), clamp(2 - Math.abs(h * 6 - 2)), clamp(2 - Math.abs(h * 6 - 4))];

// ---------------------------------------------------------------- 材質
// 透明：t は長さ 1 で残る光の割合、d は濃さ。不透明：face（面の番号）・p（位置）・w（画面の向きの法線）から色を返す
const MAT = {
  ruby: { ior: 1.77, t: [0.95, 0.07, 0.2], d: 5 },
  sapphire: { ior: 1.77, t: [0.12, 0.25, 0.95], d: 5 },
  garnet: { ior: 1.76, t: [0.82, 0.04, 0.16], d: 5 },
  peridot: { ior: 1.67, t: [0.6, 0.92, 0.12], d: 4.5 },
  diamond: { ior: 2.42, t: [0.98, 0.985, 1.0], d: 1 },
  // ラブラドライト：暗い灰色の地。向きが光と合った面だけ青〜緑にひらめく
  labradorite: { opaque: (p, w, k) => {
    const hh = Math.abs((Math.sin(k * 12.9898) * 43758.5453) % 1);
    const st = 0.5 + 0.5 * Math.sin(p[0] * 9 + p[1] * 23 + hh * 6);
    const dirA = [0.35, 0.45, 0.82], l = Math.hypot(...dirA);
    const c = Math.max(0, (w[0] * dirA[0] + w[1] * dirA[1] + w[2] * dirA[2]) / l);
    const fl = (hh > 0.55 ? 1 : 0.15) * Math.pow(c, 10) * 1.6;
    return { albedo: [0.07 + 0.05 * st, 0.08 + 0.05 * st, 0.085 + 0.05 * st], emit: spectral(0.47 + 0.12 * hh).map((v) => v * fl) };
  } },
  // エンジェライト：淡い青に白い筋
  angelite: { opaque: (p) => {
    const x = p[0] * 1.6, y = p[1] * 1.6;
    const m = fbm(x * 2.5, y * 2.5, 4, 171);
    const vein = smooth(0.9, 0.97, 1 - Math.abs(fbm(x * 3, y * 3, 4, 181) * 2 - 1));
    const body = mix([0.28, 0.52, 0.92], [0.5, 0.72, 1.0], m);
    return { albedo: mix(body, [0.95, 0.97, 1.0], vein * 0.8), emit: body.map((v) => v * 0.1) };
  } },
};
// 台座の上の縁に引く、宝石の色の細い線
const LINE = { ruby: [1, 0.3, 0.4], sapphire: [0.4, 0.6, 1], garnet: [1, 0.25, 0.35], peridot: [0.7, 1, 0.3], diamond: [0.9, 0.95, 1], labradorite: [0.3, 0.9, 0.8], angelite: [0.5, 0.75, 1] };

// ---------------------------------------------------------------- 形：型 → 符号付き距離 → 厚み → 面
const R = 512;
function insideShape(B, x, y) {
  for (const sh of B.shape) {
    if (sh[0] === 'e') {
      const a = -(sh[5] || 0) * D2R, dx = x - sh[1], dy = y - sh[2];
      const u = dx * Math.cos(a) - dy * Math.sin(a), v = dx * Math.sin(a) + dy * Math.cos(a);
      if ((u / sh[3]) ** 2 + (v / sh[4]) ** 2 <= 1) return true;
    } else {
      let c = false;
      const n = (sh.length - 1) / 2;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = sh[1 + i * 2], yi = sh[2 + i * 2], xj = sh[1 + j * 2], yj = sh[2 + j * 2];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      if (c) return true;
    }
  }
  return false;
}
// 距離変換（Felzenszwalb）
function edt1(f, n) {
  const d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  let k = 0;
  v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s;
    while (true) { s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); if (s <= z[k]) k--; else break; }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; }
  return d;
}
function edt(mask, want) {
  const out = new Float64Array(R * R), col = new Float64Array(R);
  for (let i = 0; i < R * R; i++) out[i] = mask[i] === want ? 0 : 1e20;
  for (let x = 0; x < R; x++) { for (let y = 0; y < R; y++) col[y] = out[y * R + x]; const d = edt1(col, R); for (let y = 0; y < R; y++) out[y * R + x] = d[y]; }
  for (let y = 0; y < R; y++) { const d = edt1(Float64Array.from(out.subarray(y * R, y * R + R)), R); for (let x = 0; x < R; x++) out[y * R + x] = d[x]; }
  for (let i = 0; i < R * R; i++) out[i] = Math.sqrt(out[i]);
  return out;
}

// 物体の座標：X = (x-50)/50、Y = (50-y)/50（型は 100×100、台座は y 86 から下）
function buildBeast(id) {
  const B = BEASTS[id];
  const mask = new Uint8Array(R * R);
  for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
    const x = ((i + 0.5) / R) * 100, y = ((j + 0.5) / R) * 100;
    mask[j * R + i] = y < 86.2 && insideShape(B, x, y) ? 1 : 0;
  }
  const dIn = edt(mask, 0), dOut = edt(mask, 1);
  const sd = (x, y) => {
    const k = clamp(Math.floor((y / 100) * R), 0, R - 1) * R + clamp(Math.floor((x / 100) * R), 0, R - 1);
    return ((mask[k] ? dIn[k] : -dOut[k]) * 100) / R;
  };
  // 片側の厚み：縁で 0、内側へ RS まで丸く増える。外は負（輪郭を型どおりにするため）
  const T = 0.26, RS = 12;
  const Hv = (x, y) => { const d = sd(x, y); return d > 0 ? T * Math.sqrt(Math.min(1, d / RS)) * (0.85 + 0.15 * Math.min(1, d / (RS * 2))) : (d / RS) * T * 0.5; };
  // 少しずらした格子の三角形ごとに、なめらかな面の向きを平均して 1 つにする
  const G = 7.5;
  let seed = 7;
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
  const rnd = () => (seed = (seed * 16807 + 11) % 2147483647) / 2147483647;
  const n = Math.ceil(100 / G) + 2, P = [];
  for (let j = 0; j <= n; j++) { P[j] = []; for (let i = 0; i <= n; i++) P[j][i] = [(i - 0.5) * G + (rnd() - 0.5) * G * 0.7, (j - 0.5) * G + (rnd() - 0.5) * G * 0.7]; }
  const tris = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const p = P[j][i], q = P[j][i + 1], r = P[j + 1][i], s = P[j + 1][i + 1];
    if ((i + j) % 2) tris.push([p, q, s], [p, s, r]); else tris.push([p, q, r], [q, s, r]);
  }
  const face = new Int32Array(R * R).fill(-1), gsum = tris.map(() => [0, 0, 0]), e = 100 / R;
  tris.forEach((t, k) => {
    const xs = t.map((p) => (p[0] / 100) * R), ys = t.map((p) => (p[1] / 100) * R);
    const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(R - 1, Math.ceil(Math.max(...xs)));
    const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(R - 1, Math.ceil(Math.max(...ys)));
    const d = (xs[1] - xs[0]) * (ys[2] - ys[0]) - (xs[2] - xs[0]) * (ys[1] - ys[0]);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const l1 = ((xs[1] - px) * (ys[2] - py) - (xs[2] - px) * (ys[1] - py)) / d;
      const l2 = ((xs[2] - px) * (ys[0] - py) - (xs[0] - px) * (ys[2] - py)) / d;
      if (l1 < -1e-6 || l2 < -1e-6 || 1 - l1 - l2 < -1e-6) continue;
      face[y * R + x] = k;
      if (!mask[y * R + x]) continue;
      const cx = (x + 0.5) * e, cy = (y + 0.5) * e;
      const gx = ((Hv(cx + e, cy) - Hv(cx - e, cy)) / (2 * e)) * 50, gy = (-(Hv(cx, cy + e) - Hv(cx, cy - e)) / (2 * e)) * 50;
      const l = Math.hypot(gx, gy, 1);
      gsum[k][0] -= gx / l; gsum[k][1] -= gy / l; gsum[k][2] += 1 / l;
    }
  });
  const fn = gsum.map((g) => { const l = Math.hypot(g[0], g[1], g[2]) || 1; return [g[0] / l, g[1] / l, g[2] / l]; });
  const faceAt = (X, Y) => {
    const x = Math.floor(((X * 50 + 50) / 100) * R), y = Math.floor(((50 - Y * 50) / 100) * R);
    return x < 0 || y < 0 || x >= R || y >= R ? -1 : face[y * R + x];
  };
  return { id, H: (X, Y) => Hv(X * 50 + 50, 50 - Y * 50), faceAt, fn };
}

// ---------------------------------------------------------------- 光線追跡
function fresnel(cosi, eta) {
  const s2 = (1 - cosi * cosi) / (eta * eta);
  if (s2 >= 1) return 1;
  const ct = Math.sqrt(1 - s2), rs = (cosi - eta * ct) / (cosi + eta * ct), rp = (eta * cosi - ct) / (eta * cosi + ct);
  return 0.5 * (rs * rs + rp * rp);
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const at = (o, d, t) => [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];

// 体：|z| < H(X, Y)。f < 0 が中。線分 [t0, t1] で中（外）に変わる最初の点を探す
function makeSolid(S) {
  const f = (p) => Math.abs(p[2]) - S.H(p[0], p[1]);
  const normalAt = (p) => {
    const k = S.faceAt(p[0], p[1]);
    if (k < 0) return [0, 0, p[2] >= 0 ? 1 : -1];
    const v = S.fn[k];
    return [v[0], v[1], p[2] >= 0 ? v[2] : -v[2]];
  };
  const march = (o, d, t0, t1, inside) => {
    const st = 0.006;
    let tp = t0;
    for (let t = t0 + st; t <= t1; t += st) {
      const fv = f(at(o, d, t));
      if (inside ? fv < 0 : fv > 0) {
        let a = tp, b = t;
        for (let i = 0; i < 14; i++) { const m = (a + b) / 2, fm = f(at(o, d, m)); if (inside ? fm < 0 : fm > 0) b = m; else a = m; }
        return b;
      }
      tp = t;
    }
    return -1;
  };
  return { normalAt, march };
}

// 台座：黒い磨いた石の箱
const BOX = { x0: -0.72, x1: 0.72, y0: -0.94, y1: -0.72, z0: -0.3, z1: 0.3 };
function boxHit(o, d) {
  let tn = -1e9, tf = 1e9, nn = null;
  for (const [ax, lo, hi] of [[0, BOX.x0, BOX.x1], [1, BOX.y0, BOX.y1], [2, BOX.z0, BOX.z1]]) {
    if (Math.abs(d[ax]) < 1e-9) { if (o[ax] < lo || o[ax] > hi) return null; continue; }
    let t0 = (lo - o[ax]) / d[ax], t1 = (hi - o[ax]) / d[ax], s = -1;
    if (t0 > t1) { [t0, t1] = [t1, t0]; s = 1; }
    if (t0 > tn) { tn = t0; nn = [0, 0, 0]; nn[ax] = s; }
    if (t1 < tf) tf = t1;
  }
  return tn > tf || tf < 0 ? null : { t: tn, n: nn };
}

// 少し右から、少し見下ろして撮る。返り値は HDR の色と不透明度
function render(S, W, SS) {
  const span = 0.98, yaw = 16 * D2R, pitch = 10 * D2R;
  const M = MAT[S.id], solid = makeSolid(S), lineCol = LINE[S.id];
  const toWorld = (v) => {
    const x1 = v[0] * Math.cos(yaw) + v[2] * Math.sin(yaw), z1 = -v[0] * Math.sin(yaw) + v[2] * Math.cos(yaw);
    return [x1, v[1] * Math.cos(pitch) - z1 * Math.sin(pitch), v[1] * Math.sin(pitch) + z1 * Math.cos(pitch)];
  };
  const toObj = (v) => {
    const y1 = v[1] * Math.cos(pitch) + v[2] * Math.sin(pitch), z1 = -v[1] * Math.sin(pitch) + v[2] * Math.cos(pitch);
    return [v[0] * Math.cos(yaw) - z1 * Math.sin(yaw), y1, v[0] * Math.sin(yaw) + z1 * Math.cos(yaw)];
  };
  const envW = (d) => { const w = toWorld(d); return ENV(w[0], w[1], w[2]); };
  const sig = M.t ? M.t.map((c) => -Math.log(Math.max(1e-4, c)) * M.d) : null;

  // 体：入って、中で反射を繰り返して出る（不透明なら表面だけ）
  const traceBody = (ro, rd, tIn) => {
    if (tIn < 0) return null;
    let p = at(ro, rd, tIn), n = solid.normalAt(p);
    if (dot(n, rd) > 0) n = n.map((v) => -v);
    const ci = -dot(n, rd), r = [rd[0] + 2 * ci * n[0], rd[1] + 2 * ci * n[1], rd[2] + 2 * ci * n[2]];
    if (M.opaque) {
      const w = toWorld(n), rw = toWorld(r), m = M.opaque(p, w, S.faceAt(p[0], p[1]));
      const F = 0.04 + 0.96 * Math.pow(1 - clamp(ci), 5), E = IRR(w[0], w[1], w[2]), spec = ENV_OP(rw[0], rw[1], rw[2]);
      return [0, 1, 2].map((i) => m.albedo[i] * E * (1 - F) + m.emit[i] + spec * F);
    }
    const F = fresnel(ci, M.ior), out = [0, 1, 2].map(() => F * envW(r));
    let k = 1 / M.ior, ct = Math.sqrt(Math.max(0, 1 - k * k * (1 - ci * ci)));
    let v = norm([k * rd[0] + (k * ci - ct) * n[0], k * rd[1] + (k * ci - ct) * n[1], k * rd[2] + (k * ci - ct) * n[2]]);
    let T = [1 - F, 1 - F, 1 - F];
    p = at(p, v, 0.002);
    for (let b = 0; b < 6 && Math.max(...T) > 0.004; b++) {
      const tOut = solid.march(p, v, 0.001, 4, false);
      if (tOut < 0) break;
      T = T.map((x, c) => x * Math.exp(-sig[c] * tOut));
      p = at(p, v, tOut);
      let nn = solid.normalAt(p);
      if (dot(nn, v) < 0) nn = nn.map((x) => -x);
      const c2 = dot(nn, v), F2 = fresnel(c2, 1 / M.ior);
      if (F2 < 1) {
        k = M.ior; ct = Math.sqrt(Math.max(0, 1 - k * k * (1 - c2 * c2)));
        const e = envW(norm([k * v[0] + (ct - k * c2) * nn[0], k * v[1] + (ct - k * c2) * nn[1], k * v[2] + (ct - k * c2) * nn[2]]));
        for (let c = 0; c < 3; c++) out[c] += T[c] * (1 - F2) * e;
        T = T.map((x) => x * F2);
      }
      v = [v[0] - 2 * c2 * nn[0], v[1] - 2 * c2 * nn[1], v[2] - 2 * c2 * nn[2]];
      p = at(p, nn, -0.002);
    }
    return out;
  };
  // 台座：上の面に体が映り込む
  const tracePlinth = (ro, rd, h) => {
    const p = at(ro, rd, h.t), n = h.n, ci = -dot(n, rd);
    const r = [rd[0] + 2 * ci * n[0], rd[1] + 2 * ci * n[1], rd[2] + 2 * ci * n[2]];
    const F = 0.045 + 0.955 * Math.pow(1 - clamp(ci), 5), rp = at(p, r, 0.003);
    let refl = traceBody(rp, r, solid.march(rp, r, 0, 2, true));
    if (!refl) { const e = envW(r); refl = [e, e, e]; }
    const w = toWorld(n), E = IRR(w[0], w[1], w[2]);
    const out = [0, 1, 2].map((c) => refl[c] * F * 0.3 + 0.006 * E);
    if (n[2] > 0.5 && p[1] > BOX.y1 - 0.016) for (let c = 0; c < 3; c++) out[c] += lineCol[c] * 0.9;
    return out;
  };

  const col = new Float32Array(W * W * 3), al = new Float32Array(W * W), rd = toObj([0, 0, -1]);
  for (let py = 0; py < W; py++) for (let px = 0; px < W; px++) {
    const acc = [0, 0, 0];
    let a = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const u = ((px + (sx + 0.5) / SS) / W * 2 - 1) * span, v = -((py + (sy + 0.5) / SS) / W * 2 - 1) * span + 0.06;
      const ro = toObj([u, v, 2]), hb = boxHit(ro, rd), tb = solid.march(ro, rd, 1.2, 2.8, true);
      const c = tb > 0 && (!hb || tb < hb.t) ? traceBody(ro, rd, tb) : hb ? tracePlinth(ro, rd, hb) : null;
      if (!c) continue;
      for (let i = 0; i < 3; i++) acc[i] += c[i];
      a++;
    }
    const n = SS * SS, i = py * W + px;
    col[i * 3] = acc[0] / n; col[i * 3 + 1] = acc[1] / n; col[i * 3 + 2] = acc[2] / n;
    al[i] = a / n;
  }
  return { col, al, opaque: !!M.opaque };
}

// ---------------------------------------------------------------- 仕上げ：にじみ・十字のきらめき・トーンマップ
const aces = (x) => clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14));
const srgb = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
function blur(src, W, rad) {
  const k = [];
  let s = 0;
  for (let i = -rad; i <= rad; i++) { const w = Math.exp(-(i * i) / (2 * (rad / 2.2) ** 2)); k.push(w); s += w; }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
    let v = 0;
    for (let i = -rad; i <= rad; i++) v += src[(y * W + clamp(x + i, 0, W - 1)) * 3 + c] * k[i + rad];
    tmp[(y * W + x) * 3 + c] = v;
  }
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
    let v = 0;
    for (let i = -rad; i <= rad; i++) v += tmp[(clamp(y + i, 0, W - 1) * W + x) * 3 + c] * k[i + rad];
    out[(y * W + x) * 3 + c] = v;
  }
  return out;
}
function finish(W, { col, al, opaque }) {
  const bp = new Float32Array(col.length);
  for (let i = 0; i < W * W; i++) {
    const l = 0.2126 * col[i * 3] + 0.7152 * col[i * 3 + 1] + 0.0722 * col[i * 3 + 2], f = l > 1.1 ? (l - 1.1) / l : 0;
    for (let k = 0; k < 3; k++) bp[i * 3 + k] = col[i * 3 + k] * f;
  }
  const bl = blur(bp, W, Math.max(2, Math.round(W * 0.035))), bs = 0.35;
  // 十字のきらめき：透明な体のいちばん明るい 1 点に
  const stars = [];
  if (!opaque) {
    const step = Math.max(2, Math.round(W / 40));
    let best = 4, bi = -1;
    for (let y = step; y < W - step; y++) for (let x = step; x < W - step; x++) { const i = y * W + x, l = col[i * 3] + col[i * 3 + 1] + col[i * 3 + 2]; if (l > best) { best = l; bi = i; } }
    if (bi >= 0) stars.push({ x: bi % W, y: (bi / W) | 0 });
  }
  const out = new Uint8ClampedArray(W * W * 4), len = W * 0.16, sw = W * 0.006;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let st = 0;
    for (const s of stars) {
      const dx = x - s.x, dy = y - s.y, ax = Math.abs(dx), ay = Math.abs(dy);
      st += Math.exp(-(dy * dy) / (sw * sw)) * Math.max(0, 1 - ax / len) ** 2 + Math.exp(-(dx * dx) / (sw * sw)) * Math.max(0, 1 - ay / len) ** 2;
      st += 1.2 * Math.exp(-(dx * dx + dy * dy) / (W * 0.012) ** 2);
    }
    const r = col[i * 3] + bl[i * 3] * bs + st * 1.6, g = col[i * 3 + 1] + bl[i * 3 + 1] * bs + st * 1.6, b = col[i * 3 + 2] + bl[i * 3 + 2] * bs + st * 1.6;
    const blA = Math.min(1, (bl[i * 3] + bl[i * 3 + 1] + bl[i * 3 + 2]) * bs * 0.5 + st * 0.6);
    const a = Math.min(1, al[i] + blA * (1 - al[i])), k = a > 0 ? 1 / a : 0;
    out[i * 4] = srgb(aces(r * k)) * 255;
    out[i * 4 + 1] = srgb(aces(g * k)) * 255;
    out[i * 4 + 2] = srgb(aces(b * k)) * 255;
    out[i * 4 + 3] = a * 255;
  }
  return out;
}

// size×size の WebP（data URL）
export function bakeBeast(id, size) {
  const px = finish(size, render(buildBeast(id), size, 3));
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d').putImageData(new ImageData(px, size, size), 0, 0);
  return c.toDataURL('image/webp', 0.9);
}
