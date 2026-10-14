// =====================================================================
//  宝石の光線追跡（WebGL2）
//  カットを平面の集合（凸多面体）で作り、屈折・内部反射（全反射）・フレネル・
//  波長ごとの屈折率（分散）・色の吸収を計算する。不透明な石はカボション・カット面・
//  丸く磨いた石の描き方を持つ。
//  ホーム・ジュエル選択・コレクションのカード・オークションの宝石はその場で描き（mountLiveGem）、ほかのアイコンは
//  同じ計算で書き出した画像（img/gems/*.webp。tools/gem-bake.html と tools/test/gem-bake.js）を使う
// =====================================================================

// 見た目の数値。mode：trace（透明）・cab（カボション）・facet（不透明なカット面）・tumble（丸く磨いた石）
// t：長さ 1 進んだときに残る光の割合（RGB）、d：濃さ、pleo：横向きに進むときの色（多色性）、bi：バイカラーのもう一方の色
// fog・fogD：乳白（中で散る光の色と濃さ）、kind：シェーダーの石の番号、ri：屈折率（不透明な石）
// exp・fire：その石だけの明るさ・ファイア（省くと 1.2・1.6）、spin0：置く向き（度。旧アイコンの向きに合わせる）、spark：小さく鋭い照明（分散の強い石）、fill：照明のあいだの暗い空の明るさの倍率（中が黒く沈む石の地の色を見せる）
const T = (cut, ior, disp, t, d, ex) => ({ mode: 'trace', cut, ior, disp, t, d, ...ex });
const C = (cut, kind, ri) => ({ mode: 'cab', cut, kind, ri });
export const GEM_LOOK = {
  diamond: T('brilliant', 2.42, 0.044, [0.98, 0.985, 1.0], 1, { exp: 0.6, fire: 0.7, spark: true }),
  topaz: T('brilliant', 1.62, 0.014, [1.0, 0.7, 0.12], 1.0),
  ruby: T('oval', 1.77, 0.018, [0.95, 0.07, 0.2], 1.2),
  sapphire: T('oval', 1.77, 0.018, [0.12, 0.25, 0.95], 1.2),
  garnet: T('cushion', 1.76, 0.027, [0.82, 0.04, 0.16], 1.25),
  alexandrite: T('cushion', 1.75, 0.015, [0.12, 0.66, 0.42], 1.5, { pleo: [0.72, 0.16, 0.32], fill: 8 }),
  redberyl: T('cushion', 1.57, 0.014, [0.95, 0.12, 0.4], 1.0),
  emerald: T('step', 1.58, 0.014, [0.1, 0.8, 0.38], 1.1),
  aquamarine: T('step', 1.58, 0.014, [0.55, 0.95, 0.97], 1.0),
  citrine: T('step', 1.55, 0.013, [1.0, 0.62, 0.1], 0.9),
  peridot: T('step', 1.67, 0.02, [0.6, 0.92, 0.12], 1.0),
  iolite: T('pear', 1.54, 0.017, [0.32, 0.24, 0.95], 1.7, { pleo: [0.55, 0.48, 0.85], spin0: 180 }),
  kyanite: T('baguette', 1.72, 0.02, [0.12, 0.32, 0.95], 1.1),
  tourmaline: T('baguette', 1.63, 0.017, [1.0, 0.3, 0.58], 1.0, { bi: [0.25, 0.85, 0.4] }),
  titanite: T('trillion', 1.95, 0.051, [0.8, 0.88, 0.2], 0.9, { spin0: 180, spark: true }),
  milkyquartz: T('point', 1.544, 0.013, [0.97, 0.965, 0.99], 0.4, { fogD: 3.4, fog: [0.92, 0.9, 1.05], spin0: -22 }),
  opal: C('cabOval', 0, 1.45),
  moonstone: C('cabOval', 1, 1.52),
  labradorite: C('cabOval', 2, 1.56),
  turquoise: C('cabOval', 3, 1.61),
  amber: C('cabOval', 4, 1.54),
  rhodochrosite: C('cab', 5, 1.6),
  jasper: C('cabOval', 6, 1.54),
  coral: C('cab', 7, 1.49),
  nephrite: C('cab', 8, 1.61),
  prase: C('cab', 9, 1.54),
  angelite: C('cab', 10, 1.57),
  obsidian: { mode: 'facet', cut: 'trillion', kind: 0, ri: 1.49, spin0: 180 },
  coal: { mode: 'facet', cut: 'lump', kind: 1, ri: 1.9 },
  granite: { mode: 'tumble', cut: 'tumble', kind: 0, ri: 1.55 },
};
const MODE = { trace: 0, cab: 1, facet: 2, tumble: 3 };
// 画面の端から端までの広さ（宝石の半径が 1）。アイコンと、その場で描く宝石で同じにする
const SPAN = 1.36;
const GLINT = 0.6;
// 透明な石の光線を出す波長の数（多いほどファイアの色がなめらかにつながる）
const NW = 6;
// 透明な石を見る近さ（目までの距離の逆数。宝石の半径が 1）
const PERSP = 0.12;

// 書き出した画像の場所
export const gemImage = (id) => `img/gems/${id}.webp`;

// ---------------------------------------------------------------- カットの形（平面の集合）
const TAU = Math.PI * 2, D2R = Math.PI / 180;
const OUT = {
  round: () => (t) => ({ x: Math.cos(t), y: Math.sin(t), mx: Math.cos(t), my: Math.sin(t) }),
  oval: (a = 1, b = 0.74) => (t) => { const x = a * Math.cos(t), y = b * Math.sin(t); let mx = Math.cos(t) / a, my = Math.sin(t) / b; const l = Math.hypot(mx, my); return { x, y, mx: mx / l, my: my / l }; },
  cushion: (a = 0.94, b = 0.86, p = 3.2) => (t) => {
    const c = Math.cos(t), s = Math.sin(t);
    const x = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / p), y = b * Math.sign(s) * Math.pow(Math.abs(s), 2 / p);
    let mx = Math.sign(x) * Math.pow(Math.abs(x / a), p - 1) / a, my = Math.sign(y) * Math.pow(Math.abs(y / b), p - 1) / b;
    const l = Math.hypot(mx, my) || 1; return { x, y, mx: mx / l, my: my / l };
  },
  pear: () => numeric((t) => { const x = Math.cos(t), y = Math.sin(t) * Math.pow(Math.sin(t / 2), 1.1) * 0.78; return [y, -x + 0.08]; }),
  trillion: () => numeric((t) => { const r = 0.78 / (1 + 0.22 * Math.cos(3 * (t - Math.PI / 2))); return [r * Math.cos(t) * 1.02, r * Math.sin(t) * 1.02 - 0.08]; }),
};
// 数値微分で法線を求める輪郭。角度は 0〜2π に収めてから渡す（しずく形は負の角度で計算できないため）
function numeric(f0) {
  const f = (t) => f0(((t % TAU) + TAU) % TAU);
  return (t) => {
    const [x, y] = f(t), e = 1e-4, [x1, y1] = f(t + e), [x0, y0] = f(t - e);
    let mx = y1 - y0, my = -(x1 - x0); const l = Math.hypot(mx, my) || 1; mx /= l; my /= l;
    if (mx * x + my * y < 0) { mx = -mx; my = -my; }
    return { x, y, mx, my };
  };
}
const plane = (nx, ny, nz, px, py, pz) => { const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l; return [nx, ny, nz, nx * px + ny * py + nz * pz]; };
function brilliant(at, o = {}) {
  const N = o.mains || 8, crown = 34.5 * D2R, pav = 40.8 * D2R, star = 20 * D2R, g = 0.025, tin = o.tableIn || 0.42;
  const zt = tin * Math.tan(crown), P = [[0, 0, 1, zt]];
  for (let k = 0; k < N; k++) {
    const t0 = (k / N) * TAU + (o.rot || 0);
    let q = at(t0);
    P.push(plane(Math.sin(crown) * q.mx, Math.sin(crown) * q.my, Math.cos(crown), q.x, q.y, 0));
    q = at(t0 + Math.PI / N);
    P.push(plane(Math.sin(star) * q.mx, Math.sin(star) * q.my, Math.cos(star), q.x - q.mx * tin * 1.05, q.y - q.my * tin * 1.05, zt));
    for (const f of [0.5, 1.5]) {
      q = at(t0 + (f * Math.PI) / N);
      const cu = crown + 7 * D2R, pl = pav + 1.8 * D2R;
      P.push(plane(Math.sin(cu) * q.mx, Math.sin(cu) * q.my, Math.cos(cu), q.x, q.y, 0));
      P.push(plane(Math.sin(pl) * q.mx, Math.sin(pl) * q.my, -Math.cos(pl), q.x, q.y, -g));
    }
    q = at(t0);
    P.push(plane(Math.sin(pav) * q.mx, Math.sin(pav) * q.my, -Math.cos(pav), q.x, q.y, -g));
  }
  for (let k = 0; k < 32; k++) { const q = at((k / 32) * TAU); P.push(plane(q.mx, q.my, 0, q.x, q.y, 0)); }
  return P;
}
function stepCut(o = {}) {
  const a = o.a || 1, b = o.b || 0.72, c = o.corner == null ? 0.22 : o.corner, g = 0.025;
  const edges = [[1, 0, a], [-1, 0, a], [0, 1, b], [0, -1, b]];
  if (c > 0) { const s = Math.SQRT1_2, h = (a + b - c * Math.SQRT2) * s; edges.push([s, s, h], [-s, s, h], [s, -s, h], [-s, -s, h]); }
  const unit = Math.min(a, b), cT = o.crownT || [52, 40, 28], cIn = [0, 0.1, 0.2, 0.3], pT = o.pavT || [58, 50, 42, 36], pIn = [0, 0.16, 0.32, 0.5];
  const zs = [0]; let z = 0;
  for (let j = 0; j < cT.length; j++) { z += (cIn[j + 1] - cIn[j]) * unit * Math.tan(cT[j] * D2R); zs.push(z); }
  const P = [[0, 0, 1, zs[cT.length]]];
  for (const [mx, my, h] of edges) {
    for (let j = 0; j < cT.length; j++) { const th = cT[j] * D2R, s = h - cIn[j] * unit; P.push(plane(Math.sin(th) * mx, Math.sin(th) * my, Math.cos(th), s * mx, s * my, zs[j])); }
    let zp = -g;
    for (let j = 0; j < pT.length; j++) { const be = pT[j] * D2R, s = h - pIn[j] * unit; P.push(plane(Math.sin(be) * mx, Math.sin(be) * my, -Math.cos(be), s * mx, s * my, zp)); if (j + 1 < pIn.length) zp -= (pIn[j + 1] - pIn[j]) * unit * Math.tan(be); }
    P.push([mx, my, 0, h]);
  }
  return P;
}
// 結晶のポイント（六角柱＋とがった先）。軸は y で、柱の稜を上に向けて寝かせる。面の大きさは少し不ぞろい
function point() {
  const P = [], ys = 0.4, ya = 1.02;
  for (let k = 0; k < 6; k++) {
    const th = Math.PI / 2 + Math.PI / 6 + (k * Math.PI) / 3, c = Math.cos(th), s = Math.sin(th);
    const rr = 0.4 * (1 + 0.07 * Math.sin(k * 2.3 + 0.4));
    P.push([c, 0, s, rr]);
    const l = Math.hypot(ya - ys, rr);
    P.push([(c * (ya - ys)) / l, rr / l, (s * (ya - ys)) / l, (rr * ya) / l]);
  }
  P.push(plane(0.22, -1, 0.12, 0, -1, 0));
  return P;
}
// 割れた塊：楕円体のまわりに、向きと深さを少しずつ乱した面を並べる
function lump() {
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const P = [], ax = [1, 0.84, 0.66], N = 22;
  for (let i = 0; i < N; i++) {
    const z = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - z * z), ph = i * 2.399963 + rnd() * 0.6;
    let n = [r * Math.cos(ph) + (rnd() - 0.5) * 0.5, r * Math.sin(ph) + (rnd() - 0.5) * 0.5, z + (rnd() - 0.5) * 0.5];
    const l = Math.hypot(...n); n = n.map((v) => v / l);
    P.push([...n, Math.hypot(ax[0] * n[0], ax[1] * n[1], ax[2] * n[2]) * (0.8 + 0.2 * rnd())]);
  }
  return P;
}
const CUTS = {
  point, lump,
  brilliant: () => brilliant(OUT.round()), oval: () => brilliant(OUT.oval()), cushion: () => brilliant(OUT.cushion(), { tableIn: 0.4 }),
  pear: () => brilliant(OUT.pear(), { tableIn: 0.34, rot: Math.PI / 8 }), trillion: () => brilliant(OUT.trillion(), { mains: 6, tableIn: 0.36, rot: Math.PI / 2 }),
  step: () => stepCut({ a: 1, b: 0.74, corner: 0.2 }), baguette: () => stepCut({ a: 1, b: 0.52, corner: 0, crownT: [46, 34, 22], pavT: [58, 50, 42, 36] }),
};
const PORTRAIT = ['oval', 'step', 'baguette', 'cabOval'];
const sigmaOf = (rgb, d) => rgb.map((c) => -Math.log(Math.max(1e-4, c)) * d);

// ---------------------------------------------------------------- 照明（宝石の撮影：黒い背景にソフトボックスと小さな強い光）
function lightsOf(list, soft) {
  return list.map((l) => ({ dir: [Math.cos(l.el * D2R) * Math.cos(l.az * D2R), Math.cos(l.el * D2R) * Math.sin(l.az * D2R), Math.sin(l.el * D2R)], c0: Math.cos(l.r * D2R), c1: Math.cos(l.r * soft * D2R), I: l.I }));
}
const ring = (n, el, r, I, off = 0) => Array.from({ length: n }, (_, i) => ({ az: off + (i * 360) / n, el, r, I }));
const ENV_FACET = { L: lightsOf([...ring(6, 42, 13, 5, 15), ...ring(12, 68, 2.6, 30, 7), ...ring(4, 18, 9, 3, 40)], 1.3), sky0: 0.016, sky1: 0.04, floor: 0.035, head: 16 };
// 分散の強い石（spark）：小さな強い光をもっと小さく鋭くする（明るさの合計は同じ）。光が波長ごとに分かれて、ファイアが虹色に見える
const ENV_SPARK = { ...ENV_FACET, L: lightsOf([...ring(6, 42, 13, 5, 15), ...ring(12, 68, 0.6, 565, 7), ...ring(4, 18, 9, 3, 40)], 1.3) };
const ENV_CAB = { L: lightsOf([{ az: 135, el: 50, r: 15, I: 5.5 }, { az: 35, el: 36, r: 9, I: 3 }, { az: 250, el: 28, r: 8, I: 2.4 }, { az: 200, el: 18, r: 10, I: 1.2 }], 1.7), sky0: 0.03, sky1: 0.08, floor: 0.015, head: 8 };

// ---------------------------------------------------------------- シェーダー
const VS = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }`;
const FS_TRACE = `#version 300 es
precision highp float; precision highp int;
out vec4 o;
uniform vec2 uRes; uniform float uSpan, uExp; uniform mat3 uR; uniform int uMode, uKind, uSS;
uniform vec4 uP[112]; uniform int uN;
uniform vec3 uIor, uSig, uSig2, uPleo; uniform float uPleoOn, uBiOn, uBiAt;
uniform vec2 uCau; uniform int uNW; uniform float uPersp;
uniform vec3 uAbc; uniform float uFogD; uniform vec3 uFogL;
uniform vec4 uL[24]; uniform vec2 uLc[24]; uniform int uNL; uniform vec4 uEnv; uniform vec2 uHead;

float env(vec3 d){
  float v = d.z > 0. ? uEnv.x + uEnv.y * d.z * d.z : uEnv.z * (1. + d.z * .5);
  for (int i = 0; i < 24; i++) { if (i >= uNL) break; float c = dot(d, uL[i].xyz); if (c > uLc[i].y) v += uL[i].w * (c >= uLc[i].x ? 1. : (c - uLc[i].y) / (uLc[i].x - uLc[i].y)); }
  if (d.z > uHead.y) v *= d.z > uHead.x ? .08 : .08 + .92 * (uHead.x - d.z) / (uHead.x - uHead.y);
  return v;
}
float fres(float ci, float eta){ float s2 = (1. - ci * ci) / (eta * eta); if (s2 >= 1.) return 1.; float ct = sqrt(1. - s2); float rs = (ci - eta * ct) / (ci + eta * ct), rp = (eta * ci - ct) / (eta * ci + ct); return .5 * (rs * rs + rp * rp); }

// ---- ノイズ（不透明な石の模様・乳白のむら）
float hash(vec2 p, float s){ uvec2 q = uvec2(ivec2(floor(p)) + ivec2(int(s) * 7919, int(s) * 104729)); uint h = q.x * 374761393u + q.y * 668265263u; h = (h ^ (h >> 13)) * 1274126177u; h ^= h >> 16; return float(h) / 4294967295.; }
float vnoise(vec2 x, float s){ vec2 i = floor(x), f = fract(x), u = f * f * (3. - 2. * f); float a = hash(i, s), b = hash(i + vec2(1, 0), s), c = hash(i + vec2(0, 1), s), d = hash(i + vec2(1, 1), s); return a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y; }
float fbm(vec2 x, int oct, float s){ float v = 0., a = .5, f = 1.; for (int i = 0; i < 6; i++) { if (i >= oct) break; v += a * vnoise(x * f, s + float(i) * 17.); f *= 2.03; a *= .5; } return v; }
vec3 vor(vec2 x, float s){ vec2 i = floor(x); float d1 = 9., d2 = 9., id = 0.; for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++) { vec2 c = i + vec2(k, j); vec2 p = c + vec2(hash(c, s), hash(c, s + 7.)); float d = length(p - x); if (d < d1) { d2 = d1; d1 = d; id = hash(c, s + 3.); } else if (d < d2) d2 = d; } return vec3(d1, d2, id); }
float hash3(vec3 p){ uvec3 q = uvec3(ivec3(floor(p)) + 4096); uint h = q.x * 374761393u + q.y * 668265263u + q.z * 2246822519u; h = (h ^ (h >> 13)) * 1274126177u; h ^= h >> 16; return float(h) / 4294967295.; }
float vnoise3(vec3 x){ vec3 i = floor(x), f = fract(x), u = f * f * (3. - 2. * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), u.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), u.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), u.x), u.y), u.z); }
vec3 vnoise33(vec3 x){ return vec3(vnoise3(x), vnoise3(x + 17.3), vnoise3(x + 41.7)) - .5; }
// 3 次元のボロノイ：近い 2 点までの距離と、いちばん近い粒の番号
vec3 vor3(vec3 x){ vec3 i = floor(x); float d1 = 9., d2 = 9., id = 0.;
  for (int a = -1; a <= 1; a++) for (int b = -1; b <= 1; b++) for (int c = -1; c <= 1; c++) {
    vec3 cc = i + vec3(a, b, c), pp = cc + vec3(hash3(cc), hash3(cc + 31.), hash3(cc + 71.)); float d = length(pp - x);
    if (d < d1) { d2 = d1; d1 = d; id = hash3(cc + 113.); } else if (d < d2) d2 = d; }
  return vec3(d1, d2, id); }
vec3 spectral(float h){ h = fract(h); return clamp(vec3(abs(h * 6. - 3.) - 1., 2. - abs(h * 6. - 2.), 2. - abs(h * 6. - 4.)), 0., 1.); }

// 1 つの波長の光線：外から入り、中で反射を繰り返して、出た光を足す（色の吸収は RGB でまとめて計算する）
vec3 trace(vec3 ro, vec3 rd, vec3 rr, float ior, out bool hit){
  float tin = -1e9, tout = 1e9; int ni = -1;
  for (int i = 0; i < 112; i++) { if (i >= uN) break; vec4 p = uP[i]; float dn = dot(p.xyz, rd), dist = p.w - dot(p.xyz, ro);
    if (abs(dn) < 1e-9) { if (dist < 0.) { hit = false; return vec3(0); } continue; }
    float t = dist / dn; if (dn < 0.) { if (t > tin) { tin = t; ni = i; } } else tout = min(tout, t); }
  if (tin > tout || ni < 0) { hit = false; return vec3(0); }
  hit = true;
  vec3 p = ro + rd * tin, n = uP[ni].xyz; float ci = -dot(n, rd), F = fres(ci, ior);
  vec3 outv = vec3(F * env(uR * (rr + 2. * dot(-n, rr) * n)));
  float k = 1. / ior, ct = sqrt(max(0., 1. - k * k * (1. - ci * ci)));
  vec3 v = k * rd + (k * ci - ct) * n; vec3 T = vec3(1. - F);
  for (int b = 0; b < 8; b++) {
    if (max(T.x, max(T.y, T.z)) < .004) break;
    float tm = 1e9; int ei = -1;
    for (int i = 0; i < 112; i++) { if (i >= uN) break; vec4 q = uP[i]; float dn = dot(q.xyz, v); if (dn <= 1e-9) continue; float t = (q.w - dot(q.xyz, p)) / dn; if (t < tm) { tm = t; ei = i; } }
    if (ei < 0) break;
    vec3 s = uSig;
    if (uPleoOn > 0.) { float w = abs(v.z); s = uSig * w + uPleo * (1. - w); }
    if (uBiOn > 0.) { vec3 m = p + v * tm * .5; s = mix(uSig, uSig2, clamp((m.x - uBiAt) / .18 + .5, 0., 1.)); }
    // 乳白：中の細かな粒で光が散る（根元ほど濃く、先は澄む）。散った光は上からの照明で少し明るい
    if (uFogD > 0.) { vec3 m = p + v * tm * .5; float tr = exp(-uFogD * mix(1., .25, smoothstep(-.7, .95, m.y)) * (.55 + 1.1 * vnoise3(m * 3.2 + 5.)) * tm); outv += T * (1. - tr) * uFogL * (.7 + .3 * (uR * m).y); T *= tr; }
    T *= exp(-s * tm); p += v * tm; n = uP[ei].xyz; ci = dot(n, v); F = fres(ci, 1. / ior);
    if (F < 1.) { k = ior; ct = sqrt(max(0., 1. - k * k * (1. - ci * ci))); outv += T * (1. - F) * env(uR * (k * v + (ct - k * ci) * n)); T *= F; }
    v -= 2. * ci * n; p -= n * 1e-5;
  }
  return outv + T * .02;
}
// 波長（0＝赤の端 700nm 〜 1＝紫の端 400nm）の色の重み（RGB）。足した重みで割って、全部の波長で白になるようにする
vec3 wlRGB(float s){
  float l = 700. - 300. * s;
  return vec3(exp(-pow((l - 600.) / 42., 2.)) + .3 * exp(-pow((l - 425.) / 22., 2.)), exp(-pow((l - 545.) / 45., 2.)), exp(-pow((l - 452.) / 30., 2.)));
}

// 中の層（向き m、物体の座標）が照明を返す強さ。光の向きと見る向きの中間が m に近いほど強い。
// 画面の座標で比べるので、石が傾くと光る場所と色が変わる。層は表と裏のどちらからも光を返す（裏から見たとき）。al は向きの合い具合（重み付きの平均）
float layerFlash(vec3 m, float k, out float al){
  vec3 mw = normalize(uR * m); float s = 0., ws = 0., as = 0.;
  for (int i = 0; i < 24; i++) {
    if (i >= uNL) break;
    float c = abs(dot(normalize(uL[i].xyz + vec3(0, 0, 1)), mw)), w = uL[i].w * (1. - uLc[i].x);
    s += w * pow(c, k); ws += w; as += w * c;
  }
  al = as / max(ws, 1e-4);
  return s;
}
// ラブラドライトの色：紫がかった青 → 鮮やかな青 → 水色 → 金 → 橙
vec3 labPal(float t){
  vec3 c = mix(vec3(.35, .22, 1.), vec3(.06, .28, 1.), smoothstep(0., .3, t));
  c = mix(c, vec3(.12, .6, 1.), smoothstep(.35, .6, t));
  c = mix(c, vec3(.4, .8, .5), smoothstep(.62, .72, t));
  c = mix(c, vec3(1., .78, .28), smoothstep(.72, .84, t));
  return mix(c, vec3(1., .52, .18), smoothstep(.9, 1., t));
}

// 石ごとの見た目：albedo（地の色）・emit（光の効果）・gloss・tr（半透明）
void stone(vec2 q, vec3 n, vec3 r, out vec3 alb, out vec3 emit, out float tr){
  float x = q.x, y = q.y; emit = vec3(0); tr = 0.;
  if (uKind == 0) {
    // オパール：白い地に、小さな斑ごとの遊色。斑ごとに中の格子の向きが違い、向きが合うと強く光って色が移ろう
    alb = mix(vec3(.8, .82, .86), vec3(.93, .93, .96), fbm(q * 3., 4, 3.));
    float cover = 0.;
    for (int L = 0; L < 2; L++) {
      float sc = L == 0 ? 5. : 10., sd = L == 0 ? 11. : 23., w = L == 0 ? 1. : .75;
      vec2 wq = q + (vec2(fbm(q * 2., 3, sd), fbm(q.yx * 2., 3, sd + 1.)) - .5) * .3;
      vec3 vo = vor(wq * sc, sd);
      float a1 = fract(vo.z * 7.13) * 6.283, a2 = fract(vo.z * 3.71);
      float al, fs = layerFlash(normalize(vec3(cos(a1) * .9 * a2, sin(a1) * .9 * a2 + .25, 1.)), 34., al);
      float inner = fbm(wq * 16., 3, sd + 5.);
      float k = (fs * 8. + .015) * smoothstep(0., .08, vo.y - vo.x) * (.5 + inner) * w;
      emit += spectral(fract(vo.z * 13.7) + (1. - al) * 1.5 + inner * .2) * k * 1.6;
      cover = max(cover, min(1., k));
    }
    alb *= 1. - .45 * cover;
    // 乳白の地の、内側からのほのかな光
    emit += vec3(.15, .16, .18) * (1. - cover);
    tr = .4;
  } else if (uKind == 1) {
    float st = fbm(vec2(x * 2. + y * 6., y * 1.2), 4, 21.);
    alb = mix(vec3(.62, .64, .7), vec3(.85, .86, .9), st) * .45;
    float c = dot(n, normalize(vec3(-.45, .55, .7)));
    float gl = exp(-pow((c - .88) / .1, 2.)) * 1.6 + exp(-pow((c - .7) / .18, 2.)) * .35;
    emit = vec3(.55, .85, 1.9) * gl; tr = .55;
  } else if (uKind == 2) {
    // ラブラドライト：煙った暗い地。中の平行な層が光を返して、青を中心に光る（傾けると光る斑が変わり、色が金の側へずれる）
    // 層の向きと厚み（色）は大きな斑ごとに違う。細い平行な筋と、細かなひびが入る
    float st = fbm(q * 2.5, 4, 31.);
    float ln = pow(abs(sin(y * 26. + x * 3. + fbm(q * 1.8, 3, 33.) * 7.)), 90.) * (.4 + .6 * fbm(q * 5., 3, 35.));
    vec3 vo = vor(q * 3.2, 37.);
    float crack = 1. - smoothstep(0., .012, vo.y - vo.x);
    alb = mix(vec3(.045, .04, .036), vec3(.11, .1, .09), st) * (1. - .45 * ln) * (1. - .25 * crack);
    float pch = smoothstep(.27, .44, fbm(q * 1.7, 4, 41.));
    vec3 m = normalize(vec3((fbm(q * 1.1, 3, 61.) - .5) * 1.2 + .08, (fbm(q * 1.1, 3, 67.) - .5) * 1.2 + .38, 1.));
    float al, fs = layerFlash(m, 22., al);
    float t = clamp(fbm(q * 1.4, 4, 71.) * 1.3 - .45, 0., .6);
    t = mix(t, .86, smoothstep(.58, .68, fbm(q * 1.05 + 9., 3, 91.)));
    vec3 c = labPal(clamp(t + (1. - al) * 2., 0., 1.));
    emit = c * pch * (fs * 9. + .05) * (1. - .4 * ln) * (1. - .35 * crack);
  } else if (uKind == 3) {
    alb = mix(vec3(.04, .55, .55), vec3(.25, .8, .74), fbm(q * 3., 5, 61.));
    float rv = 1. - abs(fbm(q * 2.4, 5, 71.) * 2. - 1.);
    alb = mix(alb, vec3(.16, .1, .06), smoothstep(.9, .96, rv));
  } else if (uKind == 4) {
    float d = length(q); vec3 body = mix(vec3(1., .72, .18), vec3(.55, .2, .02), smoothstep(.2, 1., d));
    float sp = smoothstep(.78, .84, fbm(q * 8., 3, 81.));
    alb = mix(body * .5, vec3(.1, .04, .01), sp); emit = body * (1. - smoothstep(0., .95, d)) * (.8 + .4 * n.z) * .9; tr = .6;
  } else if (uKind == 5) {
    float d = length(vec2(x * 1.1 + .25, y + .2)); float band = .5 + .5 * sin(d * 26. + fbm(q * 2., 4, 91.) * 7.);
    alb = mix(vec3(.9, .18, .35), vec3(1., .72, .8), smoothstep(.55, .95, band)); tr = .1;
  } else if (uKind == 6) {
    float m = fbm(q * 2.5, 5, 101.), w = fbm(vec2(x * 6. + m * 3., y * 6.), 4, 111.);
    alb = mix(mix(vec3(.45, .08, .04), vec3(.8, .28, .1), m), vec3(.3, .08, .04), smoothstep(.55, .75, w));
  } else if (uKind == 7) {
    float pores = smoothstep(.7, .85, vnoise(q * 40., 121.)); float st = fbm(vec2(x * 1.5, y * 9.), 3, 131.);
    alb = mix(mix(vec3(.85, .16, .1), vec3(.98, .34, .24), st), vec3(.55, .08, .05), pores * .6); tr = .15;
  } else if (uKind == 8) {
    float m = fbm(vec2(x * 3. + y, y * 3.), 5, 141.), fl = smoothstep(.7, .8, fbm(q * 9., 3, 151.));
    vec3 body = mix(vec3(.04, .26, .08), vec3(.16, .5, .2), m); alb = mix(body, vec3(.05, .12, .06), fl * .7); emit = body * .12; tr = .35;
  } else if (uKind == 9) {
    vec3 body = mix(vec3(.22, .6, .14), vec3(.45, .85, .3), fbm(q * 2., 4, 161.)); alb = body * .6; emit = body * .35 * (.5 + .5 * n.z); tr = .5;
  } else {
    float m = fbm(q * 2.5, 4, 171.), vein = smoothstep(.9, .97, 1. - abs(fbm(q * 3., 4, 181.) * 2. - 1.));
    vec3 body = mix(vec3(.28, .52, .92), vec3(.5, .72, 1.), m); alb = mix(body, vec3(.95, .97, 1.), vein * .8); emit = body * .1; tr = .3;
  }
}
// 照明を法線のまわりで受ける量（大まかに）
float irr(vec3 n){ float e = .5 * (uEnv.x + uEnv.y * .5) * (.5 + .5 * n.z); for (int i = 0; i < 24; i++) { if (i >= uNL) break; float s = 1. - .5 * (uLc[i].x + uLc[i].y); e += uL[i].w * s * max(0., dot(n, uL[i].xyz)); } return e; }

vec4 cab(vec3 ro, vec3 rd){
  vec3 a2 = uAbc * uAbc;
  float qa = dot(rd * rd, 1. / a2), qb = 2. * dot(ro * rd, 1. / a2), qc = dot(ro * ro, 1. / a2) - 1.;
  float disc = qb * qb - 4. * qa * qc; if (disc < 0.) return vec4(0);
  float t = (-qb - sqrt(disc)) / (2. * qa); vec3 h = ro + rd * t, n;
  if (h.z < 0.) {
    // 裏から見たとき：平らに磨いた底の面
    if (rd.z <= 0.) return vec4(0);
    h = ro + rd * (-ro.z / rd.z);
    if (dot(h.xy * h.xy, 1. / a2.xy) > 1.) return vec4(0);
    n = vec3(0, 0, -1);
  } else n = normalize(h / a2);
  float cv = -dot(n, rd); vec3 r = rd + 2. * cv * n;
  vec3 alb, emit; float tr; stone(h.xy, n, r, alb, emit, tr);
  float F = .04 + .96 * pow(1. - clamp(cv, 0., 1.), 5.);
  float spec = env(uR * r), E = irr(uR * n);
  float rim = tr * pow(1. - cv, 2.) * .6;
  return vec4(alb * (E * (1. - F) + rim) + emit + spec * F, 1.);
}

// ---- 不透明なカット面：入口の面だけ求めて、照明の映り込みと地の色を足す
vec3 obsidian(vec3 p, vec3 n, vec3 rd){
  float ci = -dot(n, rd), F = fres(ci, uIor.y);
  vec3 r = rd + 2. * ci * n;
  vec3 col = vec3(env(uR * r) * F) + vec3(.008, .005, .013) * irr(uR * n) * (1. - F);
  // シーン：中に並んだ細かな泡の層が、入った光を返して紫に光る。層の向きは m、絹のような筋で強さが変わる
  mat3 Rt = transpose(uR);
  vec3 m = normalize(vec3(.3, .36, 1.)), tv = refract(rd, n, 1. / uIor.y);
  float band = fbm(vec2(p.x * 1.1 + p.y * .45, (p.y - p.x * .35) * 8.), 4, 7.);
  float tex = .12 + 1.1 * smoothstep(.42, .8, band);
  float sh = 0.;
  for (int i = 0; i < 24; i++) {
    if (i >= uNL) break;
    vec3 lo = Rt * uL[i].xyz; float cl = dot(n, lo); if (cl <= 0.) continue;
    vec3 tl = refract(-lo, n, 1. / uIor.y);
    sh += uL[i].w * (1. - uLc[i].x) * pow(abs(dot(normalize(tl + tv), m)), 16.) * (1. - fres(cl, uIor.y));
  }
  return col + vec3(.5, .22, 1.) * sh * tex * (1. - F) * .17;
}
vec3 coal(vec3 p, vec3 n, vec3 rd, float fid){
  // 面ごとに、つるりと割れた面か、ざらついてきらめく面かを決める
  bool rough = hash(vec2(fid, 3.), 5.) < .4;
  vec3 nn = normalize(n + .22 * vnoise33(p * 1.4 + fid) + .025 * vnoise33(p * 11.));
  if (rough) nn = normalize(nn + .5 * vnoise33(p * 60.));
  float ci = max(-dot(nn, rd), .001), F = fres(ci, uIor.y);
  vec3 r = rd + 2. * ci * nn;
  vec3 col = env(uR * r) * F * vec3(.88, .93, 1.05) * (rough ? .1 : .36) + vec3(.03, .03, .034) * (rough ? 1.6 : 1.) * irr(uR * nn) * (1. - F);
  // ざらついた面の、ところどころ光る細かな粒
  if (rough) { vec3 g = floor(p * 70.); float h = hash3(g); if (h > .95) { vec3 fn = normalize(n + (vec3(hash3(g + 7.), hash3(g + 13.), hash3(g + 19.)) - .5) * 1.2); col += env(uR * reflect(rd, fn)) * .09; } }
  return col;
}
vec4 facet(vec3 ro, vec3 rd){
  float tin = -1e9, tout = 1e9; int ni = -1;
  for (int i = 0; i < 112; i++) { if (i >= uN) break; vec4 q = uP[i]; float dn = dot(q.xyz, rd), dist = q.w - dot(q.xyz, ro);
    if (abs(dn) < 1e-9) { if (dist < 0.) return vec4(0); continue; }
    float t = dist / dn; if (dn < 0.) { if (t > tin) { tin = t; ni = i; } } else tout = min(tout, t); }
  if (tin > tout || ni < 0) return vec4(0);
  vec3 p = ro + rd * tin, n = uP[ni].xyz;
  return vec4(uKind == 0 ? obsidian(p, n, rd) : coal(p, n, rd, float(ni)), 1.);
}

// ---- 丸く磨いた石（タンブル）：でこぼこの楕円体を少しずつ進んで探す
float sdTumble(vec3 p){
  vec3 r = vec3(1., .8, .56);
  float k0 = length(p / r), k1 = length(p / (r * r));
  return k0 * (k0 - 1.) / k1 + (vnoise3(p * 1.5 + 3.) - .5) * .17 + (vnoise3(p * 3.3 + 9.) - .5) * .05;
}
vec4 tumble(vec3 ro, vec3 rd){
  float b = dot(ro, rd), c = dot(ro, ro) - 1.44, disc = b * b - c; if (disc < 0.) return vec4(0);
  float t = -b - sqrt(disc), tend = -b + sqrt(disc); bool got = false;
  for (int i = 0; i < 90; i++) { float d = sdTumble(ro + rd * t); if (d < 3e-4) { got = true; break; } t += d * .75; if (t > tend) break; }
  if (!got) return vec4(0);
  vec3 p = ro + rd * t; vec2 e = vec2(1e-3, -1e-3);
  vec3 n = normalize(e.xyy * sdTumble(p + e.xyy) + e.yyx * sdTumble(p + e.yyx) + e.yxy * sdTumble(p + e.yxy) + e.xxx * sdTumble(p + e.xxx));
  // 花崗岩：細かな粒でできた灰色がかったベージュの地に、大きさの違う結晶がまばらに散らばる
  // 結晶はボロノイの粒を縮めた角ばった形で、粒ごとに縮め方を変えて大小を付ける
  vec3 w = vnoise33(p * 3.) * .35;
  float cl = fbm(p.xy * 14. + p.z * 5., 3, 211.);
  vec3 alb = mix(vec3(.5, .43, .38), vec3(.66, .58, .52), cl) * (.92 + .16 * vnoise3(p * 52.));
  float f0 = .045, mid = -1.;
  vec3 g = vor3(p * 3.6 + w + 11.);
  if (g.z < .5 && g.y - g.x > .12 + .45 * fract(g.z * 53.)) alb = (fract(g.z * 7.3) < .55 ? vec3(.93, .9, .85) : vec3(.86, .5, .42)) * (.88 + .2 * cl);
  g = vor3(p * 7. + w * 1.4 + 37.);
  if (g.z < .3 && g.y - g.x > .14 + .5 * fract(g.z * 41.)) alb = vec3(.34, .34, .37) * (.8 + .35 * cl);
  g = vor3(p * 12. + w * 2. + 73.);
  if (g.z < .17 && g.y - g.x > .16 + .5 * fract(g.z * 29.)) { alb = vec3(.03, .028, .026); mid = g.z; }
  g = vor3(p * 24. + 91.);
  if (g.z < .1 && g.y - g.x > .32) alb = g.z < .045 ? vec3(.05, .045, .045) : vec3(.9, .88, .84);
  float cv = -dot(n, rd), F = f0 + (1. - f0) * pow(1. - clamp(cv, 0., 1.), 5.);
  vec3 r = rd + 2. * cv * n;
  vec3 col = alb * irr(uR * n) * (1. - F) + env(uR * r) * F;
  // 雲母：粒ごとに少し傾いた薄片が、照明を受けたときだけ光る
  if (mid >= 0.) { vec3 fn = normalize(n + (vec3(fract(mid * 13.1), fract(mid * 71.7), fract(mid * 29.3)) - .5) * .8); col += env(uR * reflect(rd, fn)) * .1 * vec3(.95, .9, .8); }
  return vec4(col, 1.);
}

vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
vec3 srgb(vec3 c){ return mix(12.92 * c, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }

void main(){
  vec3 acc = vec3(0); float cov = 0.;
  mat3 Rt = transpose(uR);
  for (int sy = 0; sy < 2; sy++) for (int sx = 0; sx < 2; sx++) {
    if (sx >= uSS || sy >= uSS) continue;
    vec2 px = gl_FragCoord.xy + (vec2(sx, sy) + .5) / float(uSS) - .5;
    vec2 uv = (px / uRes * 2. - 1.) * uSpan * uRes / min(uRes.x, uRes.y);
    vec3 ro = Rt * vec3(uv, 10.), rd = Rt * vec3(0, 0, -1);
    vec3 c; bool hit;
    if (uMode == 0) {
      // 透明な石は近くから見る（目の位置から広がる光線）。面ごとに見る向きが少しずつ変わり、ファイアの中で色が移ろう
      // 表の面で跳ね返る光だけは、遠くから見た向きで求める（テーブルに照明が大きく映り込まないように）
      vec3 rr = rd;
      if (uPersp > 0.) { ro = Rt * vec3(0, 0, 1. / uPersp); rd = Rt * normalize(vec3(uv * uPersp, -1.)); }
      // 波長ごとに屈折率が少し違う（コーシーの式）ので、出ていく向きがずれて虹色に分かれる（ファイア）。
      // 点ごとに波長を少しずらして、細かく描くほど色がなめらかにつながる
      c = vec3(0); vec3 ws = vec3(0); float j = (float(sy * uSS + sx) + .5) / float(uSS * uSS);
      for (int w = 0; w < 16; w++) {
        if (w >= uNW) break;
        float s = (float(w) + j) / float(uNW), lm = (700. - 300. * s) * .001;
        vec3 wc = wlRGB(s);
        c += trace(ro, rd, rr, uCau.x + uCau.y / (lm * lm), hit) * wc; ws += wc;
        if (!hit) break;
      }
      if (!hit) continue;
      c /= ws;
    } else { vec4 r = uMode == 1 ? cab(ro, rd) : uMode == 2 ? facet(ro, rd) : tumble(ro, rd); if (r.a < .5) continue; c = r.rgb; }
    acc += srgb(aces(c * uExp)); cov += 1.;
  }
  float n = float(uSS * uSS);
  o = vec4(acc / n, cov / n);
}`;
// 仕上げ：明るいところのにじみと十字のきらめき（前の結果は α を掛けた色）
const FS_POST = `#version 300 es
precision highp float;
out vec4 o; uniform sampler2D uT; uniform vec2 uRes; uniform float uBloom, uStar, uLight;
float lum(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
vec3 br(vec2 uv, float th){ vec4 c = texture(uT, uv); return c.rgb * smoothstep(th, 1., lum(c.rgb)); }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; vec4 c = texture(uT, uv);
  vec3 bl = vec3(0); float ws = 0.;
  for (int r = 1; r <= 4; r++) for (int a = 0; a < 8; a++) {
    float rad = float(r * r) * 1.6 * min(uRes.x, uRes.y) / 520., an = float(a) * .785398 + float(r) * .37;
    float w = 1. / float(r); bl += br(uv + vec2(cos(an), sin(an)) * rad / uRes, .86) * w; ws += w;
  }
  bl /= ws;
  vec3 st = vec3(0); float L = min(uRes.x, uRes.y) / 520.;
  for (int k = 1; k <= 16; k++) {
    float w = pow(1. - float(k) / 17., 2.); vec2 dx = vec2(float(k) * 2.2 * L, 0) / uRes, dy = vec2(0, float(k) * 2.2 * L) / uRes;
    st += (br(uv + dx, .975) + br(uv - dx, .975) + br(uv + dy, .975) + br(uv - dy, .975)) * w;
  }
  vec3 add = bl * uBloom * 1.1 + st * uStar * .1;
  vec3 col = c.rgb + add;
  float a = clamp(max(c.a + lum(add) * 1.2, max(col.r, max(col.g, col.b))), 0., 1.);
  // 明るい背景に重ねるとき（uLight）は、石の外のにじみを足さない（白の上では灰色の輪になるため）
  a = mix(a, c.a, uLight);
  o = vec4(min(col, vec3(a)), a);
}`;

// ---------------------------------------------------------------- 描く道具（キャンバス 1 枚に 1 つ）
const UNIFORMS = ['uRes', 'uSpan', 'uExp', 'uR', 'uMode', 'uKind', 'uSS', 'uP', 'uN', 'uIor', 'uCau', 'uNW', 'uPersp', 'uSig', 'uSig2', 'uPleo', 'uPleoOn', 'uBiOn', 'uBiAt', 'uAbc', 'uL', 'uLc', 'uNL', 'uEnv', 'uHead', 'uFogD', 'uFogL'];

function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false, alpha: true, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const compile = (s, type) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, s);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  };
  const link = (fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(VS, gl.VERTEX_SHADER));
    gl.attachShader(p, compile(fs, gl.FRAGMENT_SHADER));
    gl.bindAttribLocation(p, 0, 'a');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  };
  let prog, post;
  try {
    prog = link(FS_TRACE);
    post = link(FS_POST);
  } catch (e) {
    console.warn('gem-gl', e);
    return null;
  }
  const uni = {}, upost = {};
  for (const n of UNIFORMS) uni[n] = gl.getUniformLocation(prog, n);
  for (const n of ['uT', 'uRes', 'uBloom', 'uStar', 'uLight']) upost[n] = gl.getUniformLocation(post, n);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture(), fbo = gl.createFramebuffer();
  let texW = 0, texH = 0, look = null;

  // 宝石を切り替えたときに、形・色・照明を送る
  const load = (id) => {
    const g = GEM_LOOK[id] || GEM_LOOK.ruby;
    gl.useProgram(prog);
    const E = g.mode === 'cab' || g.mode === 'tumble' ? ENV_CAB : g.spark ? ENV_SPARK : ENV_FACET;
    const L = new Float32Array(24 * 4), Lc = new Float32Array(24 * 2);
    E.L.forEach((l, i) => { L.set([...l.dir, l.I], i * 4); Lc.set([l.c0, l.c1], i * 2); });
    gl.uniform4fv(uni.uL, L);
    gl.uniform2fv(uni.uLc, Lc);
    gl.uniform1i(uni.uNL, E.L.length);
    const fill = g.fill || 1;
    gl.uniform4f(uni.uEnv, E.sky0 * fill, E.sky1 * fill, E.floor * fill, 0);
    gl.uniform2f(uni.uHead, Math.cos(E.head * D2R), Math.cos(E.head * 1.4 * D2R));
    gl.uniform1i(uni.uMode, MODE[g.mode]);
    gl.uniform1i(uni.uKind, g.kind || 0);
    if (CUTS[g.cut]) {
      const P = CUTS[g.cut]().filter((p) => p.every(Number.isFinite));
      const arr = new Float32Array(112 * 4);
      P.slice(0, 112).forEach((p, i) => arr.set(p, i * 4));
      gl.uniform4fv(uni.uP, arr);
      gl.uniform1i(uni.uN, Math.min(112, P.length));
    }
    gl.uniform1f(uni.uFogD, g.fogD || 0);
    gl.uniform3fv(uni.uFogL, (g.fog || [0, 0, 0]).map((v) => v * 0.75));
    if (g.mode === 'trace') {
      const s = sigmaOf(g.t, g.d);
      gl.uniform3fv(uni.uSig, s);
      gl.uniform3fv(uni.uSig2, g.bi ? sigmaOf(g.bi, g.d) : s);
      gl.uniform1f(uni.uBiOn, g.bi ? 1 : 0);
      gl.uniform1f(uni.uBiAt, 0.25);
      gl.uniform3fv(uni.uPleo, g.pleo ? sigmaOf(g.pleo, g.d) : s);
      gl.uniform1f(uni.uPleoOn, g.pleo ? 1 : 0);
      gl.uniform2fv(uni.uCau, cauchy(g, g.fire == null ? 1.6 : g.fire));
    } else {
      gl.uniform3fv(uni.uAbc, g.cut === 'cab' ? [0.92, 0.92, 0.62] : [1.0, 0.76, 0.62]);
      gl.uniform3f(uni.uIor, g.ri, g.ri, g.ri);
    }
    look = g;
  };

  // W×W（o.h があれば W×H）で描く。rockT・rockS は置いた向きからのずれ（度）
  // o（鑑賞画面）：yaw・pitch は画面の縦軸・横軸まわりの回転（度）、zoom は拡大の倍率、exp・fire・glint は明るさ・ファイア・きらめき、
  // light は明るい背景に重ねるとき、h は縦の大きさ（宝石は短い辺に合わせて写る）。省くと石ごとの値（アイコンと同じ見た目）
  const draw = (W, rockT = 0, rockS = 0, ss = 1, o = null) => {
    const g = look;
    const H = o && o.h ? o.h : W;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    if (texW !== W || texH !== H) {
      texW = W;
      texH = H;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    }
    const clear = g.mode === 'trace';
    const tilt = (clear || g.mode === 'facet' ? 12 : 18) + rockT;
    const spin = (g.spin0 != null ? g.spin0 : PORTRAIT.includes(g.cut) ? 90 : 0) + rockS;
    const exp = o && o.exp != null ? o.exp : g.exp || 1.2;
    const glint = o && o.glint != null ? o.glint : GLINT;
    gl.useProgram(prog);
    if (clear) {
      gl.uniform2fv(uni.uCau, cauchy(g, o && o.fire != null ? o.fire : g.fire == null ? 1.6 : g.fire));
      gl.uniform1i(uni.uNW, o && o.nw ? o.nw : NW);
      gl.uniform1f(uni.uPersp, o && o.persp != null ? o.persp : PERSP);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, W, H);
    gl.uniform2f(uni.uRes, W, H);
    gl.uniform1f(uni.uSpan, o && o.zoom ? SPAN / o.zoom : SPAN);
    gl.uniform1f(uni.uExp, clear ? exp : exp / 1.2);
    gl.uniformMatrix3fv(uni.uR, false, o ? viewMat(o.yaw || 0, o.pitch || 0, rotMat(tilt, spin)) : rotMat(tilt, spin));
    gl.uniform1i(uni.uSS, ss);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // にじみと十字：カットした石は強め、丸い石は弱め
    const cutStone = clear || g.mode === 'facet';
    gl.useProgram(post);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(upost.uT, 0);
    gl.uniform2f(upost.uRes, W, H);
    gl.uniform1f(upost.uBloom, glint * (cutStone ? 1 : 0.5));
    gl.uniform1f(upost.uStar, cutStone ? glint : 0);
    gl.uniform1f(upost.uLight, o && o.light ? 1 : 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  return { gl, load, draw };
}

// 屈折率の波長による違い（コーシーの式 n = A + B / λ²、λ は µm）。disp は B 線（686.7nm）と G 線（430.8nm）の差で、
// それに fire を掛けて強める。ior は黄の光（589nm）あたりの値
function cauchy(g, fire) {
  const d = g.disp * fire, B = d / (1 / 0.4308 ** 2 - 1 / 0.6867 ** 2);
  return [g.ior - B / 0.589 ** 2, B];
}

// 縦軸まわりに spin、そのあと手前へ tilt（物体 → 画面）。列優先で渡す
function rotMat(tiltDeg, spinDeg) {
  const t = tiltDeg * D2R, s = spinDeg * D2R, ct = Math.cos(t), st = Math.sin(t), cs = Math.cos(s), ss = Math.sin(s);
  return new Float32Array([cs, ss * ct, ss * st, -ss, cs * ct, cs * st, 0, -st, ct]);
}

// 置いた向き M のあと、画面の縦軸まわりに yaw（右へ）、横軸まわりに pitch（下へ）回す。列優先
function viewMat(yawDeg, pitchDeg, M) {
  const y = yawDeg * D2R, p = pitchDeg * D2R, cy = Math.cos(y), sy = Math.sin(y), cp = Math.cos(p), sp = Math.sin(p);
  // V = Rx(p)·Ry(y)（行優先で書く）
  const V = [cy, 0, sy, -sp * -sy, cp, -sp * cy, cp * -sy, sp, cp * cy];
  const out = new Float32Array(9);
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) out[c * 3 + r] = V[r * 3] * M[c * 3] + V[r * 3 + 1] * M[c * 3 + 1] + V[r * 3 + 2] * M[c * 3 + 2];
  return out;
}

// ---------------------------------------------------------------- その場で描く宝石
// 画像（img）の横にキャンバスを置き、最初の 1 枚が描けたら画像と入れ替える。キャンバスと WebGL は
// アプリ全体で 1 つを使い回す（iOS は作り捨てたものもしばらく数えるため）。画像が画面から外れたら止める。
// WebGL が使えない・失われたときは画像のまま
let live = null;
let broken = false;

function dropLive() {
  if (!live) return;
  if (live.raf) cancelAnimationFrame(live.raf);
  if (live.img) live.img.hidden = false;
  live.canvas.remove();
  live = null;
}

function stopLive() {
  if (!live) return;
  if (live.raf) cancelAnimationFrame(live.raf);
  live.raf = 0;
  if (live.img) live.img.hidden = false;
  live.img = null;
  live.canvas.remove();
}

function tick(now) {
  const L = live;
  if (!L) return;
  L.raf = 0;
  if (!L.img || !L.img.isConnected) { stopLive(); return; }
  L.raf = requestAnimationFrame(tick);
  if (document.hidden || now - L.last < 30) return;
  // 鑑賞画面（ctl）：動いていないあいだは描かない。止まったら 1 度だけ細かく描く
  const f = L.ctl && L.shown ? L.ctl.frame(now) : null;
  if (L.ctl && L.shown && !f) { L.last = 0; return; }
  // 遅ければ解像度を下げ、速ければ 4 点で滑らかに
  if (L.last) {
    const dt = now - L.last;
    if (dt > 60) { L.slow++; L.fast = 0; } else if (dt < 40) { L.fast++; L.slow = 0; }
    if (L.slow > 5) { if (L.ss > 1) L.ss = 1; else L.scale = Math.max(0.5, L.scale - 0.15); L.slow = 0; }
    if (L.fast > 60) { if (L.scale < 1) L.scale = Math.min(1, L.scale + 0.1); else L.ss = 2; L.fast = 0; }
  }
  L.last = now;
  const box = L.shown ? L.canvas : L.img;
  const css = box.clientWidth;
  if (!css) return;
  const still = f && f.still;
  const k = Math.min(2, window.devicePixelRatio || 1) * (still ? 1 : L.scale);
  const W = Math.max(48, Math.round(css * k));
  if (L.ctl) {
    // 鑑賞画面は置き場所いっぱいの長方形に描く
    const v = f || L.ctl.frame(now, true);
    v.o.h = Math.max(48, Math.round((box.clientHeight || css) * k));
    L.r.draw(W, v.rockT, v.rockS, still ? (L.scale < 1 ? 1 : 2) : L.ss, v.o);
    if (still) L.last = 0;
  } else {
    const t = (now - L.t0) / 1000;
    L.r.draw(W, 10 * Math.sin(t * 0.9), 14 * Math.cos(t * 0.6), L.ss);
  }
  if (!L.shown) {
    L.shown = true;
    L.canvas.hidden = false;
    L.img.hidden = true;
  }
}

// img（書き出した画像）の宝石を、その場で描く宝石に置き換える。
// ctl（鑑賞画面）：ctl.frame(now, force) が描く値 { rockT, rockS, o, still } を返す（描かなくてよいときは null。force なら必ず返す）。
// 別の img に付け直すと外れる
export function mountLiveGem(img, id, ctl = null) {
  if (broken || !img || !GEM_LOOK[id]) return;
  if (!live) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const r = createRenderer(canvas);
    if (!r) { broken = true; return; }
    // iOS は裏に回したときなどに WebGL を失うことがある。そのときは画像に戻し、次に表示するときに作り直す
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      const back = live && live.img;
      const backId = live && live.id;
      const backCtl = live && live.ctl;
      dropLive();
      if (back && back.isConnected) setTimeout(() => mountLiveGem(back, backId, backCtl), 500);
    });
    live = { canvas, r, img: null, id: null, ctl: null, raf: 0, last: 0, t0: 0, scale: 1, ss: 1, slow: 0, fast: 0, shown: false };
  }
  if (live.img && live.img !== img) live.img.hidden = false;
  if (live.raf) cancelAnimationFrame(live.raf);
  const c = live.canvas;
  c.className = img.className;
  c.style.cssText = img.style.cssText;
  c.setAttribute('aria-hidden', 'true');
  c.hidden = true;
  img.after(c);
  // 鑑賞画面に出入りするときは大きさが大きく変わるので、画質の調整をやり直す
  if (ctl || live.ctl) { live.scale = 1; live.ss = 1; live.slow = live.fast = 0; }
  live.img = img;
  live.id = id;
  live.ctl = ctl;
  live.shown = false;
  live.last = 0;
  live.t0 = performance.now();
  live.r.load(id);
  live.raf = requestAnimationFrame(tick);
}

// その場で描く宝石が使えるか（WebGL2 が無い・作れなかった端末では false）
export const liveGemOk = () => !broken;

// ---------------------------------------------------------------- 画像の書き出し（tools/gem-bake.html から使う）
let baker = null;
// o は draw と同じ（確かめるための比べる画像用。省くとアイコンと同じ）
export function bakeGem(id, size, rockT = 0, rockS = 0, o = null) {
  if (!baker) {
    const canvas = document.createElement('canvas');
    baker = createRenderer(canvas);
    baker.canvas = canvas;
  }
  baker.load(id);
  baker.draw(size * 2, rockT, rockS, 2, o);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(baker.canvas, 0, 0, size, size);
  return c.toDataURL('image/webp', 0.9);
}
