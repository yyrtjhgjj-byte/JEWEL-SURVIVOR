// 宝石の砂場：宝石をたくさん出して、かき混ぜたり はじいたりして遊ぶだけの画面（3D）
// 宝石はアイコンと同じ光線追跡（gem-gl.js の FS_TRACE）で描く。1 つずつ画面に向けた四角を置き、
// その中でカメラからの光線を宝石の向きに直して追いかけ、当たった深さを書き込む（重なりも正しく隠れる）。
// 仕上げにアイコンと同じにじみと十字のきらめき（FS_POST）。
// 物理は位置ベース（PBD）の球。床と壁のある箱の中で転がり、止まりかけると平らな面を上か下に向けて寝る。
import { save } from './save.js';
import { audio } from './audio.js';
import { show, el, $, topbar, toast } from './ui.js';
import { gemIcon } from './render.js';
import { GEMS } from './data.js';
import { GEM_LOOK, FS_TRACE, FS_POST, NW, applyLook } from './gem-gl.js';

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

// ---------------------------------------------------------------- ベクトル
const v3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};
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
// 宝石：画面に向けた四角（宝石を囲む球が収まる大きさ）
const VS_GEM = `#version 300 es
layout(location=0) in vec2 aQ;
layout(location=2) in vec4 iPS; layout(location=3) in vec4 iQ;
uniform mat4 uVP; uniform vec3 uEye;
out vec3 vW; flat out vec3 vCen; flat out float vS; flat out vec4 vQ;
void main() {
  float R = iPS.w * 1.25;
  vec3 f = normalize(uEye - iPS.xyz), r = normalize(cross(vec3(0, 1, 0), f)), u = cross(f, r);
  float d = length(uEye - iPS.xyz), k = d / sqrt(max(d * d - R * R, 1e-3));
  vW = iPS.xyz + (r * aQ.x + u * aQ.y) * R * k;
  vCen = iPS.xyz; vS = iPS.w; vQ = iQ;
  gl_Position = uVP * vec4(vW, 1.0);
}`;
// 光線追跡の本体はアイコンと同じもの。uR（宝石 → 照明の向き）を宝石ごとに作り、当たった距離 gTin を残すように書き換える
const FS_GEM = (() => {
  let s = FS_TRACE.slice(0, FS_TRACE.indexOf('\nvoid main(){'));
  const rep = (a, b) => { if (!s.includes(a)) throw new Error('sandbox shader: ' + a); s = s.replace(a, b); };
  rep('uniform mat3 uR;', 'mat3 uR; float gTin;');
  rep('  hit = true;\n', '  hit = true; gTin = tin;\n');
  rep('float t = (-qb - sqrt(disc)) / (2. * qa); vec3 h = ro + rd * t, n;', 'float t = (-qb - sqrt(disc)) / (2. * qa); vec3 h = ro + rd * t, n; gTin = t;');
  rep('    h = ro + rd * (-ro.z / rd.z);', '    gTin = -ro.z / rd.z; h = ro + rd * gTin;');
  rep('  vec3 p = ro + rd * tin, n = uP[ni].xyz;\n  return vec4(uKind', '  vec3 p = ro + rd * tin, n = uP[ni].xyz; gTin = tin;\n  return vec4(uKind');
  rep('  vec3 p = ro + rd * t; vec2 e = vec2(1e-3, -1e-3);', '  vec3 p = ro + rd * t; vec2 e = vec2(1e-3, -1e-3); gTin = t;');
  return s + `
in vec3 vW; flat in vec3 vCen; flat in float vS; flat in vec4 vQ;
uniform vec3 uEye; uniform mat3 uView; uniform mat4 uVP;
vec3 qrot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
void main(){
  vec3 rdW = normalize(vW - uEye);
  vec4 qi = vec4(-vQ.xyz, vQ.w);
  vec3 ro = qrot(qi, uEye - vCen) / vS, rd = qrot(qi, rdW);
  uR = uView * mat3(qrot(vQ, vec3(1, 0, 0)), qrot(vQ, vec3(0, 1, 0)), qrot(vQ, vec3(0, 0, 1)));
  vec3 c = vec3(0); bool hit = false; gTin = 0.;
  if (uMode == 0) {
    vec3 ws = vec3(0);
    for (int w = 0; w < 16; w++) {
      if (w >= uNW) break;
      float s = (float(w) + .5) / float(uNW), lm = (700. - 300. * s) * .001;
      vec3 wc = wlRGB(s);
      c += trace(ro, rd, rd, uCau.x + uCau.y / (lm * lm), hit) * wc; ws += wc;
      if (!hit) break;
    }
    if (!hit) discard;
    c /= ws;
  } else { vec4 r = uMode == 1 ? cab(ro, rd) : uMode == 2 ? facet(ro, rd) : tumble(ro, rd); if (r.a < .5) discard; c = r.rgb; }
  vec4 cp = uVP * vec4(uEye + rdW * gTin * vS, 1.);
  gl_FragDepth = cp.z / cp.w * .5 + .5;
  o = vec4(srgb(aces(c * uExp)), 1.);
}`;
})();
// 仕上げ：アイコンと同じにじみと十字（長さは画面の解像度ではなく uK で決める）
const FS_GLOW = FS_POST.replace(/min\(uRes\.x, uRes\.y\) \/ 520\./g, 'uK').replace('uniform float uBloom, uStar;', 'uniform float uBloom, uStar, uK;');
const VS_FULL = `#version 300 es
layout(location=0) in vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }`;
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
  const progGem = compile(gl, VS_GEM, FS_GEM), progFlat = compile(gl, VS_FLAT, FS_FLAT), progSh = compile(gl, VS_SH, FS_SH), progGlow = compile(gl, VS_FULL, FS_GLOW);
  const STRIDE = 8;
  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  const types = IDS.map((id) => {
    const g = GEM_LOOK[id];
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ib);
    gl.bufferData(gl.ARRAY_BUFFER, MAX * STRIDE * 4, gl.DYNAMIC_DRAW);
    for (const [loc, off] of [[2, 0], [3, 16]]) {
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, STRIDE * 4, off); gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);
    const exp = (g && g.exp) || 1.2;
    return { id, vao, ib, exp: g && g.mode === 'trace' ? exp : exp / 1.2, data: new Float32Array(MAX * STRIDE), cnt: 0 };
  });
  // 全面の三角形（仕上げ用）
  const fullVao = gl.createVertexArray();
  gl.bindVertexArray(fullVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  // いったん描く先（色と深さ）
  const fbo = gl.createFramebuffer(), ftex = gl.createTexture(), fdep = gl.createRenderbuffer();
  let fw = 0, fh = 0;
  const fit = () => {
    if (fw === cv.width && fh === cv.height) return;
    fw = cv.width; fh = cv.height;
    gl.bindTexture(gl.TEXTURE_2D, ftex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindRenderbuffer(gl.RENDERBUFFER, fdep);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, fw, fh);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ftex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, fdep);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };
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

  // ---------------------------------------------------------------- 大きさとカメラ
  let W = 1, H = 1, dpr = 1, VP = null, IVP = null, VIEW3 = null, eye = [0, 0, 0];
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
    const V = M4.look(eye, [0, 0.3, 0.55], [0, 1, 0]);
    VIEW3 = new Float32Array([V[0], V[1], V[2], V[4], V[5], V[6], V[8], V[9], V[10]]);
    VP = M4.mul(M4.persp(fov, asp, 0.5, 200), V);
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
    fit();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
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
      D[o + 4] = Q[q]; D[o + 5] = Q[q + 1]; D[o + 6] = Q[q + 2]; D[o + 7] = Q[q + 3];
    }
    gl.useProgram(progGem.p);
    const u = progGem.u;
    gl.uniformMatrix4fv(u.uVP, false, VP);
    gl.uniformMatrix3fv(u.uView, false, VIEW3);
    gl.uniform3fv(u.uEye, eye);
    gl.uniform1i(u.uNW, lite ? 2 : NW);
    for (const t of types) {
      if (!t.cnt) continue;
      applyLook(gl, u, t.id);
      gl.uniform1f(u.uExp, t.exp);
      gl.bindVertexArray(t.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, t.ib);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, t.data, 0, t.cnt * STRIDE);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, t.cnt);
    }
    // 仕上げ：にじみと十字のきらめきを足して画面へ
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cv.width, cv.height);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(progGlow.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, ftex);
    gl.uniform1i(progGlow.u.uT, 0);
    gl.uniform2f(progGlow.u.uRes, cv.width, cv.height);
    gl.uniform1f(progGlow.u.uBloom, 0.6);
    gl.uniform1f(progGlow.u.uStar, 0.6);
    gl.uniform1f(progGlow.u.uK, dpr * 0.5);
    gl.bindVertexArray(fullVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
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
    if (W > 1 && VP && !perf.pause) {
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
