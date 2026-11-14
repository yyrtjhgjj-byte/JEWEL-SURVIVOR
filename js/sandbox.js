// 宝石の砂場：宝石をたくさん出して、かき混ぜたり はじいたりして遊ぶだけの画面（3D）
// 形は gem-gl.js のカット（平面の集合）から多面体を作り、WebGL2 のインスタンス描画でまとめて描く。
// 光り方は光線追跡の簡易版（表の反射＋中で 2 回跳ね返る光を波長ごとに屈折させてファイア）。
// 物理は位置ベース（PBD）の球。床と壁のある箱の中で転がり、止まりかけると平らな面を上か下に向けて寝る。
import { save } from './save.js';
import { audio } from './audio.js';
import { show, el, $, topbar, toast } from './ui.js';
import { gemIcon } from './render.js';
import { GEMS } from './data.js';
import { CUTS, GEM_LOOK } from './gem-gl.js';

const IDS = Object.keys(GEMS);
const SIZES = { s: 0.3, m: 0.46, l: 0.7 };
const TOOLS = [['pour', '出す'], ['stir', 'かき混ぜる'], ['blast', 'はじく']];
const GRAV = [['down', '重力：下'], ['tilt', '重力：傾き'], ['off', '重力：なし']];
// 箱（床は y = 0。x は ±HX、z は ±HZ。天井は CEIL）
const HX = 3.6, HZ = 4.8, CEIL = 12, WALL = 1.8;
const G = 28;
const COLL = 0.78;
const FINGER = 1.3;
// 選んだもの（画面を開き直しても残す。保存はしない）
const pick = { tool: 'pour', gem: 'random', size: 'm', grav: 'down' };

// ---------------------------------------------------------------- 形
const v3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};
const basis = (n) => { const u = v3.norm(v3.cross(n, Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])); return [u, v3.cross(n, u)]; };
// 平面の集合（n・p <= d の側を残す）を切り取った凸多面体。面ごとに平らな法線
function hullMesh(planes) {
  const B = 4;
  let faces = [];
  for (const n of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
    const [u, v] = basis(n), c = v3.mul(n, B);
    faces.push({ n, pts: [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => v3.add(c, v3.add(v3.mul(u, a * B), v3.mul(v, b * B)))) });
  }
  for (const P of planes) {
    const n = v3.norm([P[0], P[1], P[2]]), d = P[3] / Math.hypot(P[0], P[1], P[2]);
    const out = [], cut = [];
    for (const f of faces) {
      const res = [], pts = f.pts;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], da = v3.dot(a, n) - d, db = v3.dot(b, n) - d;
        if (da <= 1e-9) res.push(a);
        if ((da <= 1e-9) !== (db <= 1e-9)) { const p = v3.add(a, v3.mul(v3.sub(b, a), da / (da - db))); res.push(p); cut.push(p); }
      }
      if (res.length >= 3) out.push({ n: f.n, pts: res });
    }
    if (cut.length >= 3) {
      const c = v3.mul(cut.reduce((s, p) => v3.add(s, p), [0, 0, 0]), 1 / cut.length), [u, v] = basis(n);
      const ang = (p) => Math.atan2(v3.dot(v3.sub(p, c), v), v3.dot(v3.sub(p, c), u));
      cut.sort((a, b) => ang(a) - ang(b));
      const cap = cut.filter((p, i) => i === 0 || Math.hypot(...v3.sub(p, cut[i - 1])) > 1e-6);
      if (cap.length >= 3) out.push({ n, pts: cap });
    }
    faces = out;
  }
  let R = 0;
  for (const f of faces) for (const p of f.pts) R = Math.max(R, Math.hypot(...p));
  const pos = [], nrm = [];
  for (const f of faces) {
    for (let i = 1; i + 1 < f.pts.length; i++) {
      for (const p of [f.pts[0], f.pts[i], f.pts[i + 1]]) { pos.push(p[0] / R, p[1] / R, p[2] / R); nrm.push(...f.n); }
    }
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm) };
}
// 丸い石：楕円体（full でなければ上半分と平らな底）。lump で表面を少しでこぼこに
function domeMesh(a, b, h, full, lump = 0) {
  const NT = full ? 14 : 8, NP = 22, tri = [], z0 = full ? 0 : -h * 0.35;
  const P = (t, p) => {
    const th = (t / NT) * (full ? Math.PI : Math.PI / 2), ph = (p / NP) * Math.PI * 2;
    let x = a * Math.sin(th) * Math.cos(ph), y = b * Math.sin(th) * Math.sin(ph), z = h * Math.cos(th);
    if (lump) { const k = 1 + lump * (Math.sin(ph * 3 + th * 2) * 0.5 + Math.sin(ph * 5 - th * 3) * 0.3); x *= k; y *= k; z *= k; }
    return { p: [x, y, z + z0], n: v3.norm([x / (a * a), y / (b * b), z / (h * h)]) };
  };
  for (let t = 0; t < NT; t++) for (let p = 0; p < NP; p++) {
    const q00 = P(t, p), q01 = P(t, p + 1), q10 = P(t + 1, p), q11 = P(t + 1, p + 1);
    tri.push(q00, q10, q11, q00, q11, q01);
  }
  if (!full) for (let p = 0; p < NP; p++) {
    const q0 = P(NT, p), q1 = P(NT, p + 1), c = { p: [0, 0, z0], n: [0, 0, -1] };
    tri.push({ p: q0.p, n: [0, 0, -1] }, c, { p: q1.p, n: [0, 0, -1] });
  }
  let R = 0;
  for (const q of tri) R = Math.max(R, Math.hypot(...q.p));
  return { pos: new Float32Array(tri.flatMap((q) => q.p.map((x) => x / R))), nrm: new Float32Array(tri.flatMap((q) => q.n)) };
}
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => Math.pow(x / 255, 2.2)); };
// 宝石ごとの形と材質（mode 0 透明・1 丸い石・2 カットした不透明・3 磨いた石）
function material(id) {
  const L = GEM_LOOK[id] || { mode: 'cab', cut: 'cab', kind: 99 };
  const m = { id, base: hex(GEMS[id].color), kind: L.kind == null ? 99 : L.kind, ior: L.ior || L.ri || 1.55, disp: L.disp || 0.012, tint: L.t || [1, 1, 1], d: L.d || 1, fog: L.fogD ? 0.55 : 0, fogC: L.fog || [1, 1, 1] };
  if (L.mode === 'trace') { m.mode = 0; m.mesh = hullMesh(CUTS[L.cut]()); }
  else if (L.mode === 'facet') { m.mode = 2; m.mesh = hullMesh(CUTS[L.cut]()); }
  else if (L.mode === 'tumble') { m.mode = 3; m.mesh = domeMesh(1, 0.82, 0.64, true, 0.06); }
  else {
    m.mode = 1;
    m.mesh = L.cut === 'sphere' ? domeMesh(1, 1, 1, true) : L.cut === 'cabOval' ? domeMesh(1, 0.74, 0.52, false) : domeMesh(1, 1, 0.56, false);
  }
  if (id === 'diamond') m.boost = 1.25;
  return m;
}

// ---------------------------------------------------------------- 行列（列優先）
const M4 = {
  persp(fy, asp, n, f) { const t = 1 / Math.tan(fy / 2); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]); },
  look(e, c, up) {
    const z = v3.norm(v3.sub(e, c)), x = v3.norm(v3.cross(up, z)), y = v3.cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -v3.dot(x, e), -v3.dot(y, e), -v3.dot(z, e), 1]);
  },
  mul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; },
  inv(a) {
    const o = new Float32Array(16);
    const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5];
    const b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6], b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12];
    const b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
    const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
    o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * d; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * d; o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * d; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * d;
    o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * d; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * d; o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * d; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * d;
    o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * d; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * d; o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * d; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * d;
    o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * d; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * d; o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * d; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * d;
    return o;
  },
  apply(m, p) { const [x, y, z, w = 1] = p; return [m[0] * x + m[4] * y + m[8] * z + m[12] * w, m[1] * x + m[5] * y + m[9] * z + m[13] * w, m[2] * x + m[6] * y + m[10] * z + m[14] * w, m[3] * x + m[7] * y + m[11] * z + m[15] * w]; },
};

// ---------------------------------------------------------------- シェーダー
const VS_GEM = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm;
layout(location=2) in vec4 iPS; layout(location=3) in vec4 iQ; layout(location=4) in float iSeed;
uniform mat4 uVP;
out vec3 vW; out vec3 vN; out vec3 vOP; flat out vec3 vON; flat out float vSeed;
vec3 qrot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
void main() {
  vec3 p = qrot(iQ, aPos) * iPS.w + iPS.xyz;
  vW = p; vN = qrot(iQ, aNrm); vOP = aPos; vON = aNrm; vSeed = iSeed;
  gl_Position = uVP * vec4(p, 1.0);
}`;
const FS_GEM = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; in vec3 vOP; flat in vec3 vON; flat in float vSeed;
uniform vec3 uCam; uniform int uMode; uniform int uKind;
uniform vec3 uTint; uniform float uD; uniform float uIor; uniform float uDisp; uniform vec3 uBase; uniform float uFog; uniform vec3 uFogC; uniform float uBoost; uniform bool uLite;
uniform vec4 uL[12]; uniform vec3 uLc[12];
out vec4 o;
vec3 env(vec3 d) {
  vec3 c = mix(vec3(0.012, 0.011, 0.016), vec3(0.07, 0.07, 0.09), smoothstep(-0.3, 1.0, d.y));
  for (int i = 0; i < 12; i++) c += uLc[i] * exp(uL[i].w * (dot(d, uL[i].xyz) - 1.0));
  return c;
}
float h1(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
vec3 h3(vec3 p) { return vec3(h1(p), h1(p + 17.1), h1(p + 31.7)) * 2.0 - 1.0; }
float vn(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h1(i), h1(i + vec3(1, 0, 0)), f.x), mix(h1(i + vec3(0, 1, 0)), h1(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h1(i + vec3(0, 0, 1)), h1(i + vec3(1, 0, 1)), f.x), mix(h1(i + vec3(0, 1, 1)), h1(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
vec3 hue(float t) { return clamp(abs(fract(t + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }
void main() {
  vec3 N = normalize(vN), V = normalize(uCam - vW);
  float c = clamp(dot(N, V), 0.0, 1.0);
  vec3 key = normalize(vec3(-0.35, 1.0, 0.45)), fill = normalize(vec3(0.6, 0.5, -0.3));
  float diff = 0.22 + 0.85 * max(dot(N, key), 0.0) + 0.25 * max(dot(N, fill), 0.0);
  vec3 col;
  if (uMode == 0) {
    float f0 = pow((uIor - 1.0) / (uIor + 1.0), 2.0), F = f0 + (1.0 - f0) * pow(1.0 - c, 5.0);
    vec3 refl = env(reflect(-V, N));
    vec3 k = floor(vON * 40.0) + vSeed;
    vec3 a1 = normalize(-N + 0.95 * h3(k)), a2 = normalize(0.3 * N + 0.95 * h3(k + 5.3));
    // 中で 2 回跳ね返る光。2 回目は波長ごとに屈折率を変えてファイア（軽量化のときは 1 本）
    vec3 r = refract(-V, N, 1.0 / uIor), r2 = reflect(r, a1);
    vec3 body = env(r2) * 0.4;
    if (uLite) body += env(reflect(r2, a2)) * 0.6;
    else for (int j = 0; j < 3; j++) {
      vec3 rj = reflect(reflect(refract(-V, N, 1.0 / (uIor + uDisp * float(j - 1) * 2.4)), a1), a2);
      body[j] += env(rj)[j] * 0.6;
    }
    body *= pow(uTint, vec3(uD * 1.5)) * 2.0 * uBoost;
    if (uFog > 0.0) body = mix(body, uFogC * diff * 0.55, uFog);
    col = refl * F + body * (1.0 - F);
  } else if (uMode == 1) {
    vec3 P = vOP, base = uBase;
    float n1 = vn(P * 4.0 + vSeed * 7.0);
    if (uKind == 0) { base = vec3(0.62, 0.62, 0.68); float m = smoothstep(0.4, 0.75, vn(P * 5.0 + 3.0 + vSeed)); base += hue(vn(P * 3.0 + vSeed) * 2.0 + c * 0.7) * 0.75 * m; }
    else if (uKind == 1) { base = vec3(0.55, 0.57, 0.62); base += vec3(0.3, 0.5, 1.0) * pow(c, 5.0) * 0.9; }
    else if (uKind == 2) { base = vec3(0.07, 0.08, 0.085); float fl = smoothstep(0.7, 0.97, dot(N, normalize(vec3(0.2, 1.0, 0.5)))); base += mix(vec3(0.08, 0.4, 0.9), vec3(0.2, 0.9, 0.5), n1) * fl * 1.6; }
    else if (uKind == 3) { float v = smoothstep(0.05, 0.0, abs(vn(P * 5.0 + vSeed) - 0.5)); base = mix(base, vec3(0.08, 0.06, 0.05), v * 0.8); }
    else if (uKind == 5 || uKind == 12) { float b = 0.5 + 0.5 * sin(length(P.xy + vec2(0.37, 0.21)) * (uKind == 12 ? 30.0 : 22.0) + n1 * 3.0); base *= mix(0.4, 1.15, b); }
    else if (uKind == 6) { base *= 0.55 + 0.8 * n1; }
    else if (uKind == 4) { base *= 0.8 + 0.3 * n1; base += vec3(0.5, 0.25, 0.0) * pow(c, 3.0) * 0.4; }
    else base *= 0.8 + 0.35 * n1;
    float F = 0.04 + 0.96 * pow(1.0 - c, 5.0);
    col = base * diff + env(reflect(-V, N)) * mix(0.05, 0.9, F) * 0.55;
  } else if (uMode == 2) {
    vec3 base = uKind == 0 ? vec3(0.03, 0.02, 0.04) : vec3(0.03);
    float F = 0.06 + 0.94 * pow(1.0 - c, 5.0);
    col = base * diff + env(reflect(-V, N)) * mix(0.12, 1.0, F) * (uKind == 0 ? 0.5 : 0.3);
    if (uKind == 0) col += vec3(0.25, 0.1, 0.4) * pow(c, 6.0) * 0.25;
  } else {
    vec3 base = uBase * mix(0.45, 1.15, step(0.55, vn(vOP * 16.0 + vSeed)));
    base = mix(base, vec3(0.05), step(0.82, vn(vOP * 23.0 - vSeed)));
    float F = 0.04 + 0.96 * pow(1.0 - c, 5.0);
    col = base * diff + env(reflect(-V, N)) * mix(0.04, 0.8, F) * 0.4;
  }
  col = 1.0 - exp(-col * 1.15);
  o = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`;
const VS_FLAT = `#version 300 es
layout(location=0) in vec3 aPos; uniform mat4 uVP; out vec3 vW;
void main() { vW = aPos; gl_Position = uVP * vec4(aPos, 1.0); }`;
const FS_FLAT = `#version 300 es
precision highp float; in vec3 vW; uniform vec3 uCol; uniform vec2 uHalf; out vec4 o;
float h1(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 q = vW.xz / uHalf;
  float r = length(q * vec2(0.9, 0.75));
  vec3 c = uCol * (1.25 - 0.7 * r) * (0.94 + 0.06 * h1(floor(vW.xz * 40.0)));
  c *= 1.0 - 0.55 * smoothstep(0.0, 1.2, vW.y / ${WALL.toFixed(1)});
  o = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);
}`;
const VS_SH = `#version 300 es
layout(location=0) in vec2 aQ; layout(location=1) in vec4 iS;
uniform mat4 uVP; out vec2 vQ; out float vA;
void main() { vQ = aQ; vA = iS.w; gl_Position = uVP * vec4(iS.x + aQ.x * iS.z, 0.004, iS.y + aQ.y * iS.z, 1.0); }`;
const FS_SH = `#version 300 es
precision highp float; in vec2 vQ; in float vA; out vec4 o;
void main() { float d = length(vQ); o = vec4(0.0, 0.0, 0.0, vA * pow(max(0.0, 1.0 - d), 1.6)); }`;

// 照明：大きなやわらかい光 3 つと、上の輪に並ぶ小さく鋭い光 6 つ（ファイアのきらめき）
const LIGHTS = (() => {
  const out = [];
  const add = (az, el, k, I, col = [1, 0.97, 0.93]) => { const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180; out.push({ d: [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)], k, c: col.map((x) => x * I) }); };
  add(-30, 60, 14, 2.2); add(40, 42, 10, 1.4, [0.92, 0.96, 1]); add(180, 30, 8, 0.8, [1, 0.92, 0.85]);
  for (let i = 0; i < 6; i++) add(i * 60 + 15, 72, 900, 40);
  for (let i = 0; i < 3; i++) add(i * 120 + 75, 34, 1200, 30);
  return out;
})();

function compile(gl, vs, fs) {
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, name); }
  return { p, u };
}

// ---------------------------------------------------------------- 画面
export function showSandbox(back) {
  const lite = !!(save.settings && save.settings.lite);
  const MAX = lite ? 500 : 1200;
  const node = el(`
    <div class="screen sb-screen">
      ${topbar('SANDBOX', '宝石の砂場', '<div class="sb-count"><b id="sbn">0</b><small>/ ' + MAX + '</small></div>', 'sandbox')}
      <div class="sb-stage" id="sbst"><canvas id="sbc"></canvas><canvas id="sbo"></canvas></div>
      <div class="sb-ctl">
        <div class="sb-seg" id="sbtool">${TOOLS.map(([v, t]) => `<button data-v="${v}">${t}</button>`).join('')}</div>
        <div class="sb-gems" id="sbgem"><button data-v="random" class="sb-rnd">ランダム</button>${IDS.map((id) => `<button data-v="${id}"><img src="${gemIcon(id)}" alt=""></button>`).join('')}</div>
        <div class="sb-row">
          <div class="sb-seg sm" id="sbsize"><button data-v="s">小</button><button data-v="m">中</button><button data-v="l">大</button></div>
          <button class="sb-btn" id="sbgrav"></button>
          <button class="sb-btn" id="sbclr">全部消す</button>
        </div>
      </div>
    </div>`);
  show(node);
  let alive = true;
  $('#back', node).onclick = () => { audio.tap(); stop(); back(); };

  const stage = $('#sbst', node), cv = $('#sbc', node), ov = $('#sbo', node), octx = ov.getContext('2d');
  const gl = cv.getContext('webgl2', { antialias: !lite, alpha: false, powerPreference: 'high-performance' });
  if (!gl) { alive = false; toast('この端末では表示できません', '', 'SANDBOX'); return; }

  // ---------------------------------------------------------------- 操作の部品
  const mark = () => {
    for (const [id, k] of [['#sbtool', 'tool'], ['#sbgem', 'gem'], ['#sbsize', 'size']]) {
      $(id, node).querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === pick[k]));
    }
    $('#sbgrav', node).textContent = GRAV.find((g) => g[0] === pick.grav)[1];
  };
  for (const [id, k] of [['#sbtool', 'tool'], ['#sbgem', 'gem'], ['#sbsize', 'size']]) {
    $(id, node).onclick = (e) => { const b = e.target.closest('button'); if (!b) return; pick[k] = b.dataset.v; audio.tap(); mark(); };
  }
  $('#sbgrav', node).onclick = async () => {
    const i = GRAV.findIndex((g) => g[0] === pick.grav);
    pick.grav = GRAV[(i + 1) % GRAV.length][0];
    audio.tap();
    if (pick.grav === 'tilt') await askTilt();
    mark();
  };
  $('#sbclr', node).onclick = () => { n = 0; sparks.length = 0; audio.whoosh(); };
  mark();

  // ---------------------------------------------------------------- 傾き（iPhone は許可を求める）
  let tilt = null;
  const onTilt = (e) => {
    if (e.beta == null) return;
    const b = (e.beta * Math.PI) / 180, g = (e.gamma * Math.PI) / 180;
    tilt = [Math.sin(g) * Math.cos(b), -Math.cos(b) * Math.cos(g), Math.sin(b)];
  };
  async function askTilt() {
    try {
      const D = window.DeviceOrientationEvent;
      if (D && typeof D.requestPermission === 'function') { const r = await D.requestPermission(); if (r !== 'granted') { pick.grav = 'off'; toast('傾きを使えませんでした', '', 'SANDBOX'); return; } }
      window.addEventListener('deviceorientation', onTilt);
    } catch (_) { pick.grav = 'off'; toast('傾きを使えませんでした', '', 'SANDBOX'); }
  }
  if (pick.grav === 'tilt') window.addEventListener('deviceorientation', onTilt);

  // ---------------------------------------------------------------- GL の準備
  const progGem = compile(gl, VS_GEM, FS_GEM), progFlat = compile(gl, VS_FLAT, FS_FLAT), progSh = compile(gl, VS_SH, FS_SH);
  const STRIDE = 9;
  const types = IDS.map((id) => {
    const m = material(id);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    const nv = m.mesh.pos.length / 3, inter = new Float32Array(nv * 6);
    for (let i = 0; i < nv; i++) { inter.set(m.mesh.pos.subarray(i * 3, i * 3 + 3), i * 6); inter.set(m.mesh.nrm.subarray(i * 3, i * 3 + 3), i * 6 + 3); }
    gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ib);
    gl.bufferData(gl.ARRAY_BUFFER, MAX * STRIDE * 4, gl.DYNAMIC_DRAW);
    for (const [loc, size, off] of [[2, 4, 0], [3, 4, 16], [4, 1, 32]]) {
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE * 4, off); gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);
    return { ...m, vao, ib, verts: nv, data: new Float32Array(MAX * STRIDE), cnt: 0 };
  });
  const typeOf = Object.fromEntries(IDS.map((id, i) => [id, i]));
  // 床と壁（手前の壁は描かない）
  const room = (() => {
    const t = [];
    const quad = (a, b, c, d) => t.push(...a, ...b, ...c, ...a, ...c, ...d);
    quad([-HX - 0.4, 0, -HZ - 0.4], [-HX - 0.4, 0, HZ + 0.4], [HX + 0.4, 0, HZ + 0.4], [HX + 0.4, 0, -HZ - 0.4]);
    quad([-HX, 0, -HZ], [HX, 0, -HZ], [HX, WALL, -HZ], [-HX, WALL, -HZ]);
    quad([-HX, 0, HZ], [-HX, 0, -HZ], [-HX, WALL, -HZ], [-HX, WALL, HZ]);
    quad([HX, 0, -HZ], [HX, 0, HZ], [HX, WALL, HZ], [HX, WALL, -HZ]);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(t), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return { vao, n: t.length / 3 };
  })();
  const shadow = (() => {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const q = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, q); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, MAX * 16, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 16, 0); gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
    return { vao, ib, data: new Float32Array(MAX * 4) };
  })();
  const LD = new Float32Array(LIGHTS.length * 4), LC = new Float32Array(LIGHTS.length * 3);
  LIGHTS.forEach((l, i) => { LD.set([...l.d, l.k], i * 4); LC.set(l.c, i * 3); });

  // ---------------------------------------------------------------- 大きさとカメラ
  let W = 1, H = 1, dpr = 1, VP = null, IVP = null, eye = [0, 0, 0];
  const resize = () => {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, lite ? 1 : 2);
    W = r.width; H = r.height;
    cv.width = ov.width = Math.round(W * dpr); cv.height = ov.height = Math.round(H * dpr);
    // 箱がちょうど収まる距離
    const asp = W / H, fov = (34 * Math.PI) / 180;
    const fit = Math.max(HZ * 1.08, (HX * 1.22) / asp);
    const dist = fit / Math.tan(fov / 2);
    const el0 = (58 * Math.PI) / 180;
    eye = [0, Math.sin(el0) * dist, Math.cos(el0) * dist + 0.4];
    VP = M4.mul(M4.persp(fov, asp, 0.5, 200), M4.look(eye, [0, 0.3, 0.55], [0, 1, 0]));
    IVP = M4.inv(VP);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  const ray = (sx, sy) => {
    const x = (sx / W) * 2 - 1, y = 1 - (sy / H) * 2;
    const a = M4.apply(IVP, [x, y, -1, 1]), b = M4.apply(IVP, [x, y, 1, 1]);
    const p0 = [a[0] / a[3], a[1] / a[3], a[2] / a[3]], p1 = [b[0] / b[3], b[1] / b[3], b[2] / b[3]];
    return { o: p0, d: v3.norm(v3.sub(p1, p0)) };
  };
  const project = (p) => { const q = M4.apply(VP, [p[0], p[1], p[2], 1]); return q[3] > 0 ? [((q[0] / q[3]) * 0.5 + 0.5) * W, (0.5 - (q[1] / q[3]) * 0.5) * H] : null; };

  // ---------------------------------------------------------------- 宝石の配列
  const X = new Float32Array(MAX * 3), PX = new Float32Array(MAX * 3), VV = new Float32Array(MAX * 3), WW = new Float32Array(MAX * 3);
  const Q = new Float32Array(MAX * 4), S = new Float32Array(MAX), R = new Float32Array(MAX), SEED = new Float32Array(MAX);
  const T = new Uint8Array(MAX), CON = new Uint8Array(MAX);
  let n = 0;
  const sparks = [];

  // 指の当たり：宝石の山（球）か床と、指の光線の交わるところ
  function hitPoint(sx, sy) {
    const { o, d } = ray(sx, sy);
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      const cx = X[i * 3] - o[0], cy = X[i * 3 + 1] - o[1], cz = X[i * 3 + 2] - o[2];
      const b = cx * d[0] + cy * d[1] + cz * d[2], cc = cx * cx + cy * cy + cz * cz - S[i] * S[i];
      const disc = b * b - cc;
      if (disc < 0) continue;
      const t = b - Math.sqrt(disc);
      if (t > 0 && t < best) best = t;
    }
    if (best === Infinity && d[1] < 0) best = -o[1] / d[1];
    if (best === Infinity) return null;
    const p = v3.add(o, v3.mul(d, best));
    return [Math.max(-HX, Math.min(HX, p[0])), Math.max(0, p[1]), Math.max(-HZ, Math.min(HZ, p[2]))];
  }
  // 出す高さ：指の光線が y = 7 を通るところ
  function pourPoint(sx, sy) {
    const { o, d } = ray(sx, sy), y0 = 6;
    const t = d[1] < -1e-3 ? (y0 - o[1]) / d[1] : 20;
    const p = v3.add(o, v3.mul(d, t));
    return [Math.max(-HX + 0.5, Math.min(HX - 0.5, p[0])), y0, Math.max(-HZ + 0.5, Math.min(HZ - 0.5, p[2]))];
  }

  // ---------------------------------------------------------------- 指
  const F = { on: false, sx: 0, sy: 0, p: null, acc: 0 };
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    const [x, y] = pos(e);
    Object.assign(F, { on: true, sx: x, sy: y, p: null, acc: 1 });
    if (pick.tool === 'blast') { const p = hitPoint(x, y); if (p) blast(p); }
  });
  cv.addEventListener('pointermove', (e) => { if (!F.on) return; const [x, y] = pos(e); F.sx = x; F.sy = y; });
  const up = () => { F.on = false; F.p = null; };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);

  function spawn(p) {
    if (n >= MAX) return;
    const i = n++, s = SIZES[pick.size] * (0.85 + Math.random() * 0.3), j = i * 3;
    X[j] = PX[j] = p[0] + (Math.random() - 0.5) * 0.4; X[j + 1] = PX[j + 1] = p[1] + (Math.random() - 0.5) * 0.4; X[j + 2] = PX[j + 2] = p[2] + (Math.random() - 0.5) * 0.4;
    VV[j] = (Math.random() - 0.5) * 2; VV[j + 1] = -2 - Math.random() * 2; VV[j + 2] = (Math.random() - 0.5) * 2;
    WW[j] = (Math.random() - 0.5) * 10; WW[j + 1] = (Math.random() - 0.5) * 10; WW[j + 2] = (Math.random() - 0.5) * 10;
    const u1 = Math.random(), u2 = Math.random() * Math.PI * 2, u3 = Math.random() * Math.PI * 2;
    Q.set([Math.sqrt(1 - u1) * Math.sin(u2), Math.sqrt(1 - u1) * Math.cos(u2), Math.sqrt(u1) * Math.sin(u3), Math.sqrt(u1) * Math.cos(u3)], i * 4);
    S[i] = s; R[i] = s * COLL; SEED[i] = Math.random() * 100;
    T[i] = typeOf[pick.gem === 'random' ? IDS[(Math.random() * IDS.length) | 0] : pick.gem];
  }
  function blast(p) {
    const RB = 3.6;
    let hit = 0;
    for (let i = 0; i < n; i++) {
      const j = i * 3, dx = X[j] - p[0], dy = X[j + 1] - p[1] + 0.8, dz = X[j + 2] - p[2], d = Math.hypot(dx, dy, dz);
      if (d > RB || d < 1e-3) continue;
      const k = (22 * (1 - d / RB)) / d;
      VV[j] += dx * k; VV[j + 1] += Math.abs(dy) * k + 6 * (1 - d / RB); VV[j + 2] += dz * k;
      for (let a = 0; a < 3; a++) WW[j + a] += (Math.random() - 0.5) * 40;
      hit++;
    }
    for (let k = 0; k < 16; k++) addSpark([p[0] + (Math.random() - 0.5) * 1.6, p[1] + Math.random() * 1.2, p[2] + (Math.random() - 0.5) * 1.6]);
    if (hit) audio.bomb(false, 2); else audio.tap();
  }
  function addSpark(p) {
    if (sparks.length > (lite ? 40 : 140)) return;
    sparks.push({ p, t: 0, life: 0.35 + Math.random() * 0.45, s: 3 + Math.random() * 6 });
  }

  // ---------------------------------------------------------------- 物理
  let cell = 1, gx = 1, gy = 1, gz = 1, head = new Int32Array(1);
  const next = new Int32Array(MAX), CI = new Int32Array(MAX);
  let clinkT = 0;
  function build() {
    let rm = 0.1;
    for (let i = 0; i < n; i++) if (R[i] > rm) rm = R[i];
    cell = rm * 2;
    gx = Math.ceil((HX * 2) / cell) + 1; gz = Math.ceil((HZ * 2) / cell) + 1; gy = Math.ceil(CEIL / cell) + 1;
    if (head.length < gx * gy * gz) head = new Int32Array(gx * gy * gz);
    head.fill(-1, 0, gx * gy * gz);
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      const ix = Math.min(gx - 1, Math.max(0, ((X[j] + HX) / cell) | 0)), iy = Math.min(gy - 1, Math.max(0, (X[j + 1] / cell) | 0)), iz = Math.min(gz - 1, Math.max(0, ((X[j + 2] + HZ) / cell) | 0));
      const c = (iy * gz + iz) * gx + ix;
      CI[i] = c; next[i] = head[c]; head[c] = i;
    }
  }
  function solve(first) {
    let loud = 0, lp = null;
    for (let i = 0; i < n; i++) {
      const c = CI[i], ix = c % gx, iz = ((c / gx) | 0) % gz, iy = (c / (gx * gz)) | 0, j = i * 3;
      for (let oy = -1; oy <= 1; oy++) {
        const yy = iy + oy;
        if (yy < 0 || yy >= gy) continue;
        for (let oz = -1; oz <= 1; oz++) {
          const zz = iz + oz;
          if (zz < 0 || zz >= gz) continue;
          for (let ox = -1; ox <= 1; ox++) {
            const xx = ix + ox;
            if (xx < 0 || xx >= gx) continue;
            for (let k = head[(yy * gz + zz) * gx + xx]; k !== -1; k = next[k]) {
              if (k <= i) continue;
              const q = k * 3, dx = X[q] - X[j], dy = X[q + 1] - X[j + 1], dz = X[q + 2] - X[j + 2], rr = R[i] + R[k], d2 = dx * dx + dy * dy + dz * dz;
              if (d2 >= rr * rr || d2 < 1e-9) continue;
              const d = Math.sqrt(d2), o = (rr - d) / d, mi = R[i] ** 3, mk = R[k] ** 3, sm = mi + mk;
              const ki = (o * mk) / sm, kk = (o * mi) / sm;
              X[j] -= dx * ki; X[j + 1] -= dy * ki; X[j + 2] -= dz * ki;
              X[q] += dx * kk; X[q + 1] += dy * kk; X[q + 2] += dz * kk;
              if (!CON[i]) CON[i] = 1;
              if (!CON[k]) CON[k] = 1;
              if (first) {
                const rv = ((VV[q] - VV[j]) * dx + (VV[q + 1] - VV[j + 1]) * dy + (VV[q + 2] - VV[j + 2]) * dz) / d;
                if (rv < -loud) { loud = -rv; lp = [X[j] + dx / 2, X[j + 1] + dy / 2, X[j + 2] + dz / 2]; }
              }
            }
          }
        }
      }
    }
    return [loud, lp];
  }

  function step(dt, iters) {
    let g = [0, 0, 0];
    if (pick.grav === 'down') g = [0, -G, 0];
    else if (pick.grav === 'tilt') g = tilt ? v3.mul(tilt, G) : [0, -G, 0];
    // 指：出す・かき混ぜる
    if (F.on && pick.tool === 'pour') {
      F.acc += dt * (lite ? 24 : 45);
      const p = pourPoint(F.sx, F.sy);
      while (F.acc >= 1) { F.acc -= 1; spawn(p); }
    }
    let fp = null;
    if (F.on && pick.tool === 'stir') { fp = hitPoint(F.sx, F.sy); if (fp) { fp[1] = Math.max(FINGER * 0.4, fp[1] - FINGER * 0.3); F.p = fp; } }
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      CON[i] = 0;
      VV[j] += g[0] * dt; VV[j + 1] += g[1] * dt; VV[j + 2] += g[2] * dt;
      PX[j] = X[j]; PX[j + 1] = X[j + 1]; PX[j + 2] = X[j + 2];
      X[j] += VV[j] * dt; X[j + 1] += VV[j + 1] * dt; X[j + 2] += VV[j + 2] * dt;
    }
    build();
    let loud = 0, lp = null;
    for (let it = 0; it < iters; it++) {
      const r = solve(it === 0);
      if (it === 0) [loud, lp] = r;
      if (fp) {
        for (let i = 0; i < n; i++) {
          const j = i * 3, dx = X[j] - fp[0], dy = X[j + 1] - fp[1], dz = X[j + 2] - fp[2], rr = FINGER + R[i], d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2) || 0.01, o = (rr - d) / d;
          X[j] += dx * o; X[j + 1] += dy * o; X[j + 2] += dz * o;
          if (!CON[i]) CON[i] = 1;
        }
      }
      for (let i = 0; i < n; i++) {
        const j = i * 3, r = R[i];
        if (X[j] < -HX + r) X[j] = -HX + r; else if (X[j] > HX - r) X[j] = HX - r;
        if (X[j + 2] < -HZ + r) X[j + 2] = -HZ + r; else if (X[j + 2] > HZ - r) X[j + 2] = HZ - r;
        if (X[j + 1] < r) { X[j + 1] = r; CON[i] = 2; } else if (X[j + 1] > CEIL - r) X[j + 1] = CEIL - r;
      }
    }
    const gl0 = Math.hypot(g[0], g[1], g[2]), upv = gl0 > 0 ? [-g[0] / gl0, -g[1] / gl0, -g[2] / gl0] : [0, 1, 0];
    for (let i = 0; i < n; i++) {
      const j = i * 3, r = R[i];
      let vx = (X[j] - PX[j]) / dt, vy = (X[j + 1] - PX[j + 1]) / dt, vz = (X[j + 2] - PX[j + 2]) / dt;
      const touch = CON[i];
      if (touch === 2) { vx *= 0.94; vz *= 0.94; } else if (touch) { vx *= 0.985; vy *= 0.985; vz *= 0.985; } else { vx *= 0.999; vy *= 0.999; vz *= 0.999; }
      const sp = vx * vx + vy * vy + vz * vz;
      if (sp > 900) { const k = 30 / Math.sqrt(sp); vx *= k; vy *= k; vz *= k; }
      VV[j] = vx; VV[j + 1] = vy; VV[j + 2] = vz;
      // 回転：触れていれば転がる向きへ寄せる。遅くなったら平らな面（カットの z 軸）を上か下へ向けて寝かせる
      const q = i * 4;
      if (touch) {
        const tw = v3.mul(v3.cross(upv, [vx, vy, vz]), 1 / r);
        const k = touch === 2 ? 0.3 : 0.08;
        WW[j] += (tw[0] - WW[j]) * k; WW[j + 1] += (tw[1] - WW[j + 1]) * k; WW[j + 2] += (tw[2] - WW[j + 2]) * k;
        if (sp < 4 && gl0 > 0) {
          const qx = Q[q], qy = Q[q + 1], qz = Q[q + 2], qw = Q[q + 3];
          const az = [2 * (qx * qz + qw * qy), 2 * (qy * qz - qw * qx), 1 - 2 * (qx * qx + qy * qy)];
          const ax = v3.cross(az, v3.mul(upv, v3.dot(az, upv) >= 0 ? 1 : -1));
          const kk = 84 * (1 - sp / 4) * dt;
          WW[j] = (WW[j] + ax[0] * kk) * 0.82; WW[j + 1] = (WW[j + 1] + ax[1] * kk) * 0.82; WW[j + 2] = (WW[j + 2] + ax[2] * kk) * 0.82;
        }
      } else { WW[j] *= 0.999; WW[j + 1] *= 0.999; WW[j + 2] *= 0.999; }
      const wx = WW[j], wy = WW[j + 1], wz = WW[j + 2];
      const qx = Q[q], qy = Q[q + 1], qz = Q[q + 2], qw = Q[q + 3], h = dt * 0.5;
      const nx = qx + h * (wx * qw + wy * qz - wz * qy), ny = qy + h * (wy * qw + wz * qx - wx * qz), nz = qz + h * (wz * qw + wx * qy - wy * qx), nw = qw - h * (wx * qx + wy * qy + wz * qz);
      const l = Math.hypot(nx, ny, nz, nw) || 1;
      Q[q] = nx / l; Q[q + 1] = ny / l; Q[q + 2] = nz / l; Q[q + 3] = nw / l;
      if (sp > 60 && Math.random() < 0.01) addSpark([X[j], X[j + 1], X[j + 2]]);
    }
    if (loud > 3.5 && performance.now() - clinkT > 45) {
      clinkT = performance.now();
      audio.clink(Math.min(1, loud / 18));
      if (loud > 9 && lp) addSpark(lp);
    }
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.t += dt; if (s.t > s.life) sparks.splice(i, 1); }
  }

  // ---------------------------------------------------------------- 描画
  function draw() {
    gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(0.02, 0.02, 0.03, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    // 床と壁
    gl.useProgram(progFlat.p);
    gl.uniformMatrix4fv(progFlat.u.uVP, false, VP);
    gl.uniform3f(progFlat.u.uCol, 0.011, 0.01, 0.016);
    gl.uniform2f(progFlat.u.uHalf, HX, HZ);
    gl.bindVertexArray(room.vao);
    gl.drawArrays(gl.TRIANGLES, 0, room.n);
    // 影
    const sd = shadow.data;
    for (let i = 0; i < n; i++) {
      const j = i * 3, y = X[j + 1];
      sd[i * 4] = X[j]; sd[i * 4 + 1] = X[j + 2]; sd[i * 4 + 2] = S[i] * (1.15 + y * 0.12); sd[i * 4 + 3] = 0.6 * Math.exp(-y * 0.35);
    }
    if (n) {
      gl.useProgram(progSh.p);
      gl.uniformMatrix4fv(progSh.u.uVP, false, VP);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.bindVertexArray(shadow.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, shadow.ib);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, sd, 0, n * 4);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    // 宝石：種類ごとにまとめて
    for (const t of types) t.cnt = 0;
    for (let i = 0; i < n; i++) {
      const t = types[T[i]], o = t.cnt++ * STRIDE, j = i * 3, q = i * 4, D = t.data;
      D[o] = X[j]; D[o + 1] = X[j + 1]; D[o + 2] = X[j + 2]; D[o + 3] = S[i];
      D[o + 4] = Q[q]; D[o + 5] = Q[q + 1]; D[o + 6] = Q[q + 2]; D[o + 7] = Q[q + 3]; D[o + 8] = SEED[i];
    }
    gl.useProgram(progGem.p);
    const u = progGem.u;
    gl.uniformMatrix4fv(u.uVP, false, VP);
    gl.uniform3fv(u.uCam, eye);
    gl.uniform4fv(u.uL, LD); gl.uniform3fv(u.uLc, LC);
    gl.uniform1i(u.uLite, lite ? 1 : 0);
    gl.enable(gl.CULL_FACE);
    for (const t of types) {
      if (!t.cnt) continue;
      gl.uniform1i(u.uMode, t.mode); gl.uniform1i(u.uKind, t.kind);
      gl.uniform3fv(u.uTint, t.tint); gl.uniform1f(u.uD, t.d); gl.uniform1f(u.uIor, t.ior); gl.uniform1f(u.uDisp, t.disp);
      gl.uniform3fv(u.uBase, t.base); gl.uniform1f(u.uFog, t.fog); gl.uniform3fv(u.uFogC, t.fogC); gl.uniform1f(u.uBoost, t.boost || 1);
      gl.bindVertexArray(t.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, t.ib);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, t.data, 0, t.cnt * STRIDE);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, t.verts, t.cnt);
    }
    gl.bindVertexArray(null);
    // きらめきと指の輪（2D を重ねる）
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, W, H);
    if (sparks.length) {
      octx.globalCompositeOperation = 'lighter';
      octx.fillStyle = '#fff';
      for (const s of sparks) {
        const sc = project(s.p);
        if (!sc) continue;
        const k = 1 - s.t / s.life, z = s.s * (0.4 + k), [x, y] = sc;
        octx.globalAlpha = k;
        octx.beginPath();
        octx.moveTo(x, y - z * 2); octx.lineTo(x + z * 0.3, y - z * 0.3); octx.lineTo(x + z * 2, y); octx.lineTo(x + z * 0.3, y + z * 0.3);
        octx.lineTo(x, y + z * 2); octx.lineTo(x - z * 0.3, y + z * 0.3); octx.lineTo(x - z * 2, y); octx.lineTo(x - z * 0.3, y - z * 0.3);
        octx.fill();
      }
      octx.globalAlpha = 1;
      octx.globalCompositeOperation = 'source-over';
    }
    if (F.on && pick.tool === 'stir' && F.p) {
      const c = project(F.p), e = project([F.p[0] + FINGER, F.p[1], F.p[2]]);
      if (c && e) { octx.strokeStyle = 'rgba(255,255,255,0.3)'; octx.lineWidth = 1.5; octx.beginPath(); octx.arc(c[0], c[1], Math.abs(e[0] - c[0]), 0, Math.PI * 2); octx.stroke(); }
    }
  }

  // ---------------------------------------------------------------- ループ
  let raf = 0, last = performance.now(), shown = -1;
  const cnt = $('#sbn', node);
  // 確かめ用（テストが読む）：物理と描画の時間
  const perf = (window.__sandbox = { step: 0, draw: 0, n: 0, fill: (k) => { for (let i = 0; i < k; i++) spawn([(Math.random() - 0.5) * HX * 1.8, 0.5 + Math.random() * 8, (Math.random() - 0.5) * HZ * 1.8]); } });
  const loop = (now) => {
    if (!alive) return;
    if (!node.isConnected) { stop(); return; }
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    if (W > 1 && VP) {
      const t0 = performance.now();
      // 多いときは 1 回にまとめる（そのぶんぶつかりの解き直しを増やす）
      const sub = n > 500 ? 1 : 2;
      for (let k = 0; k < sub; k++) step(dt / sub, sub === 1 ? 4 : 3);
      const t1 = performance.now();
      draw();
      perf.step = perf.step * 0.9 + (t1 - t0) * 0.1; perf.draw = perf.draw * 0.9 + (performance.now() - t1) * 0.1; perf.n = n;
    }
    if (shown !== n) { shown = n; cnt.textContent = n; }
  };
  raf = requestAnimationFrame(loop);
  function stop() {
    if (!alive) return;
    alive = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener('deviceorientation', onTilt);
    // WebGL の場所を手放す（iPhone は同時に持てる数が少ない）
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    cv.width = cv.height = ov.width = ov.height = 1;
  }
}
