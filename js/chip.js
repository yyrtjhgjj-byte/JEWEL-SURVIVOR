// =====================================================================
//  チップ音源：8bit 風の BGM の合成（パルス波・三角波・のこぎり波・ノイズのドラム）と、楽譜（MML）の読み込み
//  AudioWorklet（'chip'）でも、メインスレッド（AudioWorklet が使えないとき）でも、Node（tools/test/chip-render.js）でも同じ音が出る。
//  DOM もセーブも読まない
// =====================================================================

// 4 分音符の長さ（tick）
export const TPQ = 48;
const WHOLE = TPQ * 4;
// 音色のマクロ（音量・デューティ比・アルペジオ・音程）が 1 つ進む速さ（1 秒あたり）
const FPS = 60;
// ノイズの周期（ファミコンと同じ番号。小さいほど高い音）
const CPU = 1789773;
const NOISE_PERIOD = [4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068];
// 音量 15 のときの大きさ
const GAIN = { pulse: 0.1, tri: 0.12, saw: 0.085, drum: 1 };
const DRUM_NOISE = 0.075;
const DRUM_TONE = 0.12;

// ドラム（1 つの値が 1/60 秒。最後の値を保つ）
//  nv：ノイズの音量  np：ノイズの周期の番号  ns：短い周期（金属的な音）
//  tv：三角波の音量  tf：三角波の周波数（Hz）
const DRUMS = {
  // バスドラム
  k: { tv: [15, 15, 14, 12, 9, 6, 3, 0], tf: [120, 86, 66, 55, 49, 45, 42, 40], nv: [8, 3, 0], np: [9, 11] },
  // 太鼓（長く低い）
  j: { tv: [15, 15, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0], tf: [96, 70, 56, 48, 44, 41, 39, 38, 37], nv: [10, 6, 3, 1, 0], np: [10, 12, 13] },
  // スネア
  s: { tv: [12, 9, 5, 0], tf: [240, 200, 180], nv: [15, 13, 11, 9, 8, 7, 6, 5, 4, 3, 2, 2, 1, 1, 0], np: [6, 7, 7, 8] },
  // クラップ
  x: { nv: [13, 3, 12, 4, 11, 8, 6, 4, 3, 2, 1, 0], np: [5] },
  // クローズド・ハイハット
  h: { nv: [8, 5, 2, 0], np: [1] },
  // オープン・ハイハット
  o: { nv: [9, 8, 7, 6, 5, 5, 4, 4, 3, 3, 2, 2, 2, 1, 1, 1, 0], np: [1] },
  // シェイカー（金属的）
  z: { nv: [4, 6, 3, 1, 0], np: [0], ns: 1 },
  // シンバル
  c: { nv: [14, 13, 12, 11, 11, 10, 10, 9, 9, 9, 8, 8, 8, 7, 7, 7, 6, 6, 6, 6, 5, 5, 5, 5, 4, 4, 4, 4, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 0], np: [3, 3, 4] },
  // タム（高・中・低）
  t: { tv: [15, 14, 12, 10, 8, 6, 4, 2, 0], tf: [270, 225, 195, 180, 170, 165], nv: [6, 2, 0], np: [8] },
  m: { tv: [15, 14, 12, 10, 8, 6, 4, 2, 0], tf: [200, 168, 146, 134, 127, 123], nv: [6, 2, 0], np: [9] },
  f: { tv: [15, 15, 13, 11, 9, 7, 5, 3, 1, 0], tf: [148, 120, 104, 96, 91, 88], nv: [6, 2, 0], np: [10] },
  // 銅鑼
  g: {
    tv: [15, 15, 14, 14, 13, 13, 12, 12, 11, 11, 10, 10, 9, 9, 9, 8, 8, 8, 7, 7, 7, 6, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1, 0],
    tf: [74, 70, 68, 67, 66, 65],
    nv: [12, 11, 10, 10, 9, 9, 9, 8, 8, 8, 7, 7, 7, 7, 6, 6, 6, 6, 5, 5, 5, 5, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 0],
    np: [10, 11, 12, 12, 13],
  },
};

const mac = (a, f, loop) => {
  if (f < a.length) return a[f];
  if (loop >= 0 && loop < a.length) return a[loop + ((f - loop) % (a.length - loop))];
  return a[a.length - 1];
};

// ---------------------------------------------------------------- 楽譜（MML）
//  音  c d e f g a b（+ か # で半音上、- で半音下）。長さ 1 2 4 8 16 32、3 6 12 24 は 3 連符。. で付点、^ で長さを足す
//  r 休符  o4 オクターブ（o4 c が中央の ド）  > < オクターブを上下  l8 長さの省略時  v12 音量（0〜15）
//  q7 音を出す長さ（8 分の q）  & 次の音へなめらかにつなぐ（同じ高さならタイ）  k-2 移調（半音）
//  @name 音色  D10 音程をずらす（セント）  P4 前の音から滑る（フレーム）  ~20,5.5,12 ビブラート（セント, Hz, 遅れ）
//  A0,4,7 アルペジオ（/2 で 1 段を 2 フレームに。A0 で解除）
//  [ ... : ... ]3 くり返し（: の後ろは最後の回だけ飛ばす）  $name 曲の pat の中身  L ループの戻り先  | 小節線（長さを確かめる）
//  ドラムのチャンネルは k j s x h o z c t m f g（大文字は強く）と r
const NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

function expandPatterns(src, pat, depth, where) {
  if (depth > 8) throw new Error(`${where}: パターンの入れ子が深すぎる`);
  return src.replace(/\$([A-Za-z0-9_]+)/g, (m, k) => {
    if (!pat || !(k in pat)) throw new Error(`${where}: パターン $${k} がない`);
    return ` ${expandPatterns(pat[k], pat, depth + 1, where)} `;
  });
}

function expandLoops(s) {
  const re = /\[([^[\]]*)\](\d*)/;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    const n = m[2] ? +m[2] : 2;
    const k = m[1].indexOf(':');
    const a = k < 0 ? m[1] : m[1].slice(0, k);
    const b = k < 0 ? '' : m[1].slice(k + 1);
    let out = '';
    for (let i = 0; i < n; i++) out += ` ${a} ${i < n - 1 ? b : ''} `;
    s = s.slice(0, m.index) + out + s.slice(m.index + m[0].length);
  }
  if (/[[\]]/.test(s)) throw new Error('くり返しの [ ] が対になっていない');
  return s;
}

function parseChannel(src, opt) {
  const { bar, drum, insts, where, warn } = opt;
  const ev = [];
  const st = { t: 0, oct: 4, len: 24, vol: drum ? 12 : 15, q: 7, k: 0, inst: 0, det: 0, port: 0, vib: null, arp: null, as: 1, slur: false, loop: -1, barNo: 1 };
  let i = 0;
  const s = src;
  const peek = () => s[i];
  const digits = () => {
    const j = i;
    while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
    return s.slice(j, i);
  };
  const num = () => {
    const m = /^-?\d+(\.\d+)?/.exec(s.slice(i));
    if (!m) throw new Error(`${where}: 数がない（${s.slice(i, i + 12)}）`);
    i += m[0].length;
    return +m[0];
  };
  const oneLen = () => {
    const d = digits();
    let t = d === '' ? st.len : WHOLE / +d;
    let add = t;
    while (peek() === '.') { i++; add /= 2; t += add; }
    return t;
  };
  const len = () => {
    let t = oneLen();
    while (peek() === '^') { i++; t += oneLen(); }
    if (Math.abs(t - Math.round(t)) > 1e-6) warn(`${where}: 小節 ${st.barNo} の長さが tick の整数にならない`);
    return Math.round(t);
  };
  let last = null;
  while (i < s.length) {
    const c = s[i++];
    if (c === ' ' || c === '\n' || c === '\t' || c === '\r') continue;
    if (c === '|') {
      if (st.t % bar) warn(`${where}: 小節 ${st.barNo} の長さが合わない（${(st.t % bar) / TPQ} 拍ずれ）`);
      st.barNo = Math.round(st.t / bar) + 1;
      continue;
    }
    if (c === 'L') { st.loop = st.t; continue; }
    if (drum && DRUMS[c.toLowerCase()]) {
      const d = c.toLowerCase();
      const t = len();
      ev.push({ t: st.t, d, v: c === d ? st.vol : Math.min(15, st.vol + 3) });
      st.t += t;
      continue;
    }
    if (c === 'o') { st.oct = num(); continue; }
    if (c === '>') { st.oct++; continue; }
    if (c === '<') { st.oct--; continue; }
    if (c === 'l') { st.len = oneLen(); continue; }
    if (c === 'v') { st.vol = num(); continue; }
    if (c === 'q') { st.q = num(); continue; }
    if (c === 'k') { st.k = num(); continue; }
    if (c === 'D') { st.det = num(); continue; }
    if (c === 'P') { st.port = num(); continue; }
    if (c === '@') {
      const m = /^[A-Za-z0-9_]+/.exec(s.slice(i));
      if (!m || !(m[0] in insts)) throw new Error(`${where}: 音色 @${m ? m[0] : ''} がない`);
      i += m[0].length;
      st.inst = insts[m[0]];
      continue;
    }
    if (c === '~') {
      const a = [num()];
      while (peek() === ',') { i++; a.push(num()); }
      st.vib = a[0] ? [a[0], a[1] || 5.5, a[2] || 0] : null;
      continue;
    }
    if (c === 'A') {
      const a = [num()];
      while (peek() === ',') { i++; a.push(num()); }
      st.as = 1;
      if (peek() === '/') { i++; st.as = num(); }
      st.arp = a.length === 1 && a[0] === 0 ? null : a;
      continue;
    }
    if (c === 'r') {
      st.t += len();
      st.slur = false;
      last = null;
      continue;
    }
    if (drum) throw new Error(`${where}: ドラム ${c} がない`);
    if (!(c in NOTE)) throw new Error(`${where}: 読めない文字 ${c}（小節 ${st.barNo}）`);
    let n = (st.oct + 1) * 12 + NOTE[c] + st.k;
    while (peek() === '+' || peek() === '#' || peek() === '-') n += s[i++] === '-' ? -1 : 1;
    const t = len();
    let slurOut = false;
    while (peek() === ' ') i++;
    if (peek() === '&') { i++; slurOut = true; }
    if (st.slur && last && last.n === n) {
      // タイ：前の音を伸ばす
      last.g = st.t + (slurOut ? t : Math.max(1, Math.round((t * st.q) / 8)));
    } else {
      last = { t: st.t, g: st.t + (slurOut ? t : Math.max(1, Math.round((t * st.q) / 8))), n, i: st.inst, v: st.vol, sl: st.slur ? 1 : 0, pt: st.port, d: st.det, vib: st.vib, arp: st.arp, as: st.as };
      ev.push(last);
    }
    st.t += t;
    st.slur = slurOut;
  }
  return { ev, ticks: st.t, loop: st.loop };
}

// 音色を内部の形にそろえる
function normInst(I) {
  return {
    env: I.env || [15],
    el: I.el === undefined ? -1 : I.el,
    rel: I.rel === undefined ? 2 : I.rel,
    duty: I.duty === undefined ? 0.5 : I.duty,
    dl: I.dl === undefined ? -1 : I.dl,
    arp: I.arp || null,
    as: I.as || 1,
    pit: I.pit || null,
    vib: I.vib || null,
    det: I.det || 0,
  };
}

// 曲を、チャンネルごとの音の並びにする。warnings に小節の長さのずれなどを入れる
export function compileSong(song, lib = {}) {
  const warnings = [];
  const warn = (m) => warnings.push(m);
  const names = { ...lib, ...(song.inst || {}) };
  const insts = {};
  const instList = [normInst({})];
  for (const k of Object.keys(names)) { insts[k] = instList.length; instList.push(normInst(names[k])); }
  const bar = (song.meter || 4) * TPQ;
  const chans = [];
  let T = 0;
  let loop = -1;
  for (const [ci, ch] of song.ch.entries()) {
    const where = `${song.name || ''}#${ch.id || ci}`;
    const drum = ch.type === 'drum';
    const src = expandLoops(expandPatterns(ch.mml, song.pat, 0, where));
    const r = parseChannel(src, { bar, drum, insts, where, warn });
    if (r.ticks % bar) warn(`${where}: 全体の長さが小節で割り切れない`);
    if (ci === 0) { T = r.ticks; loop = r.loop; }
    else {
      if (r.ticks !== T) warn(`${where}: 長さ ${r.ticks / bar} 小節（最初のチャンネルは ${T / bar} 小節）`);
      if (r.loop !== loop) warn(`${where}: ループの位置 ${r.loop / bar} 小節目（最初のチャンネルは ${loop / bar}）`);
    }
    chans.push({ ch, ev: r.ev, ticks: r.ticks });
  }
  if (loop < 0) loop = 0;
  const out = [];
  for (const { ch, ev } of chans) {
    for (const e of ev) if (e.g > T) e.g = T;
    const base = { type: ch.type, pan: ch.pan || 0, gain: ch.gain === undefined ? 1 : ch.gain };
    out.push({ ...base, ev });
    // やまびこ：同じ音を遅らせて小さく鳴らす（ループの終わりをはみ出す分は、ループの頭へ回す）
    if (ch.echo) {
      const [delay, mul, pan] = ch.echo;
      const ec = [];
      for (const e of ev) {
        const v = Math.round(e.v * mul);
        if (v < 1) continue;
        let t = e.t + delay;
        let g = e.g + delay;
        if (t >= T) { t -= T - loop; g -= T - loop; }
        ec.push({ ...e, t, g: Math.min(g, T), v });
      }
      ec.sort((a, b) => a.t - b.t);
      out.push({ ...base, pan: pan === undefined ? -base.pan : pan, ev: ec });
    }
  }
  return { song: { bpm: song.bpm, T, loop, ch: out, inst: instList }, warnings };
}

// ---------------------------------------------------------------- 合成
const blep = (t, dt) => {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
};

class Voice {
  constructor(ch, inst, sr) {
    this.type = ch.type;
    this.ev = ch.ev;
    this.inst = inst;
    this.sr = sr;
    const a = ((Math.max(-1, Math.min(1, ch.pan)) + 1) * Math.PI) / 4;
    this.gl = Math.cos(a) * Math.SQRT2;
    this.gr = Math.sin(a) * Math.SQRT2;
    this.gain = (GAIN[ch.type] || 0.1) * ch.gain;
    this.loopIdx = this.ev.findIndex((e) => e.t >= 0);
    this.idx = 0;
    this.cur = null;
    this.on = false;
    this.rel = false;
    this.phase = 0;
    this.dt = 0;
    this.duty = 0.5;
    this.amp = 0;
    this.target = 0;
    this.frame = 0;
    this.fAcc = 0;
    this.lastN = null;
    // ドラム
    this.lfsr = 1;
    this.nAcc = 0;
    this.nRate = 0;
    this.nShort = 0;
    this.nAmp = 0;
    this.nTarget = 0;
    this.nBit = 1;
    this.tPhase = 0;
    this.tDt = 0;
  }
  setLoop(loopTick) {
    let k = this.ev.findIndex((e) => e.t >= loopTick);
    if (k < 0) k = this.ev.length;
    this.loopIdx = k;
  }
  nextTick() {
    const e = this.ev[this.idx];
    let t = e ? e.t : Infinity;
    if (this.on && !this.rel && this.cur && this.cur.g !== undefined && this.cur.g < t) t = this.cur.g;
    return t;
  }
  events(tick) {
    if (this.on && !this.rel && this.cur && this.cur.g !== undefined && tick >= this.cur.g) {
      this.rel = true;
      this.relF = this.frame;
      this.relLv = this.envLv;
      this.params();
    }
    while (this.idx < this.ev.length && this.ev[this.idx].t <= tick) this.trigger(this.ev[this.idx++]);
  }
  trigger(e) {
    if (this.type === 'drum') {
      this.cur = e;
      this.dk = DRUMS[e.d];
      this.on = true;
      this.frame = 0;
      this.fAcc = 0;
      this.params();
      return;
    }
    const legato = e.sl && this.on && !this.rel && this.cur;
    const from = this.lastN;
    this.cur = e;
    this.I = this.inst[e.i] || this.inst[0];
    if (!legato) { this.frame = 0; this.fAcc = 0; this.nf = 0; } else this.nf = this.frame;
    this.on = true;
    this.rel = false;
    this.pf = e.pt > 0 && from !== null ? e.pt : 0;
    this.pFrom = from;
    this.lastN = e.n;
    this.params();
  }
  // 1/60 秒ごとに音量・音程・デューティ比を決める
  params() {
    const f = this.frame;
    if (this.type === 'drum') {
      const d = this.dk;
      const k = this.cur.v / 15;
      const nl = d.nv ? Math.round(mac(d.nv, f, -1) * k) : 0;
      this.nTarget = (nl / 15) * DRUM_NOISE;
      if (d.np) this.nRate = CPU / NOISE_PERIOD[mac(d.np, f, -1)] / this.sr;
      this.nShort = d.ns || 0;
      const tl = d.tv ? Math.round(mac(d.tv, f, -1) * k) : 0;
      this.target = (tl / 15) * DRUM_TONE;
      if (d.tf) this.tDt = mac(d.tf, f, -1) / this.sr;
      return;
    }
    const e = this.cur;
    const I = this.I;
    let lv;
    if (!this.rel) lv = mac(I.env, f, I.el);
    else lv = I.rel > 0 ? this.relLv * Math.max(0, 1 - (f - this.relF + 1) / (I.rel + 1)) : 0;
    this.envLv = lv;
    let L = Math.round((lv * e.v) / 15);
    if (L < 1 && lv > 0 && e.v > 0) L = 1;
    this.target = (L / 15) * this.gain;
    let n = e.n + (I.det + e.d) / 100;
    const arp = e.arp || I.arp;
    if (arp) n += arp[Math.floor(f / (e.arp ? e.as : I.as)) % arp.length];
    if (I.pit) n += mac(I.pit, f, -1);
    const vib = e.vib || I.vib;
    if (vib && f > vib[2]) {
      const g = f - vib[2];
      n += (vib[0] / 100) * Math.min(1, g / 10) * Math.sin((2 * Math.PI * vib[1] * g) / FPS);
    }
    if (this.pf > 0 && this.pFrom !== null) {
      const g = f - this.nf;
      if (g < this.pf) n += (this.pFrom - e.n) * (1 - g / this.pf);
    }
    this.dt = (440 * Math.pow(2, (n - 69) / 12)) / this.sr;
    if (typeof I.duty === 'number') this.duty = I.duty;
    else this.duty = mac(I.duty, f, I.dl);
  }
  render(L, R, off, m, tick0, tps, frameLen, sm) {
    let next = this.nextTick();
    const gl = this.gl;
    const gr = this.gr;
    for (let s = off, end = off + m; s < end; s++) {
      const tick = tick0 + (s - off) * tps;
      if (tick >= next) { this.events(tick); next = this.nextTick(); }
      if (this.on) {
        this.fAcc += 1;
        if (this.fAcc >= frameLen) { this.fAcc -= frameLen; this.frame++; this.params(); }
      }
      let v = 0;
      if (this.type === 'drum') {
        this.nAmp += (this.nTarget - this.nAmp) * sm;
        this.amp += (this.target - this.amp) * sm;
        if (this.nAmp > 1e-5) {
          this.nAcc += this.nRate;
          const c = Math.floor(this.nAcc);
          if (c > 0) {
            this.nAcc -= c;
            let sum = 0;
            for (let j = 0; j < c; j++) {
              const r = this.lfsr;
              const fb = (r ^ (r >> (this.nShort ? 6 : 1))) & 1;
              this.lfsr = (r >> 1) | (fb << 14);
              sum += this.lfsr & 1 ? -1 : 1;
            }
            this.nBit = sum / c;
          }
          v += this.nBit * this.nAmp;
        }
        if (this.amp > 1e-5) {
          let p = this.tPhase + this.tDt;
          if (p >= 1) p -= 1;
          this.tPhase = p;
          const st = (p * 32) | 0;
          v += ((st < 16 ? 15 - st : st - 16) / 7.5 - 1) * this.amp;
        }
      } else {
        this.amp += (this.target - this.amp) * sm;
        if (this.amp < 1e-5 && this.target === 0) continue;
        const dt = this.dt;
        let p = this.phase + dt;
        if (p >= 1) p -= 1;
        this.phase = p;
        if (this.type === 'pulse') {
          const d = this.duty;
          v = p < d ? 1 : -1;
          v += blep(p, dt);
          v -= blep(p >= d ? p - d : p - d + 1, dt);
          v -= 2 * d - 1;
        } else if (this.type === 'tri') {
          const st = (p * 32) | 0;
          v = (st < 16 ? 15 - st : st - 16) / 7.5 - 1;
        } else {
          v = 2 * p - 1 - blep(p, dt);
        }
        v *= this.amp;
      }
      L[s] += v * gl;
      R[s] += v * gr;
    }
  }
  wrap() {
    this.idx = this.loopIdx;
  }
}

export class ChipSynth {
  constructor(sr) {
    this.sr = sr;
    this.song = null;
    this.voices = [];
    this.tick = 0;
    this.mul = 1;
    this.fade = 1;
    this.fadeTo = 1;
    this.next = null;
    this.master = 0.7;
    this.frameLen = sr / FPS;
    this.sm = 1 - Math.exp(-1 / (0.0008 * sr));
    this.lpA = 1 - Math.exp((-2 * Math.PI * 12000) / sr);
    this.hpR = 1 - (2 * Math.PI * 30) / sr;
    this.f = [0, 0, 0, 0, 0, 0];
  }
  // メッセージ：{ song, lib } 曲を流す  { tempo } 速さの倍率  { stop } 止める
  message(m) {
    if (m.song) {
      const c = compileSong(m.song, m.lib).song;
      if (this.song && this.fade > 0) { this.next = c; this.fadeTo = 0; }
      else this.start(c);
    }
    if (m.tempo) this.mul = m.tempo;
    if (m.stop) { this.next = null; this.fadeTo = 0; }
  }
  start(c) {
    this.song = c;
    this.tick = 0;
    this.fade = 1;
    this.fadeTo = 1;
    this.voices = c.ch.map((ch) => {
      const v = new Voice(ch, c.inst, this.sr);
      v.setLoop(c.loop);
      return v;
    });
  }
  render(L, R, n) {
    L.fill(0);
    R.fill(0);
    const song = this.song;
    if (!song) return;
    let i = 0;
    while (i < n) {
      if (this.tick >= song.T) {
        this.tick -= song.T - song.loop;
        for (const v of this.voices) v.wrap();
      }
      const tps = ((song.bpm / 60) * TPQ * this.mul) / this.sr;
      const m = Math.min(n - i, Math.max(1, Math.ceil((song.T - this.tick) / tps)));
      for (const v of this.voices) v.render(L, R, i, m, this.tick, tps, this.frameLen, this.sm);
      this.tick += m * tps;
      i += m;
    }
    // 仕上げ：低音の偏りを除き、高音を少し丸め、大きすぎる音を抑える。曲の切り替えは短くフェード
    const f = this.f;
    const lpA = this.lpA;
    const hpR = this.hpR;
    const fs = 1 / (0.04 * this.sr);
    const g = this.master;
    for (let s = 0; s < n; s++) {
      if (this.fade !== this.fadeTo) {
        this.fade += this.fadeTo > this.fade ? fs : -fs;
        if (this.fade <= 0) {
          // 消えきったら次の曲へ（新しい曲は次のブロックから鳴る）
          this.fade = 0;
          if (this.next) { const c = this.next; this.next = null; this.start(c); }
          else this.song = null;
          L.fill(0, s);
          R.fill(0, s);
          return;
        } else if (this.fade > 1) this.fade = 1;
      }
      let l = L[s] * g * this.fade;
      let r = R[s] * g * this.fade;
      const hl = l - f[0] + hpR * f[1];
      f[0] = l;
      f[1] = hl;
      const hr = r - f[2] + hpR * f[3];
      f[2] = r;
      f[3] = hr;
      f[4] += (hl - f[4]) * lpA;
      f[5] += (hr - f[5]) * lpA;
      l = f[4];
      r = f[5];
      L[s] = l > 0.8 ? 0.8 + 0.2 * Math.tanh((l - 0.8) / 0.2) : l < -0.8 ? -0.8 - 0.2 * Math.tanh((-l - 0.8) / 0.2) : l;
      R[s] = r > 0.8 ? 0.8 + 0.2 * Math.tanh((r - 0.8) / 0.2) : r < -0.8 ? -0.8 - 0.2 * Math.tanh((-r - 0.8) / 0.2) : r;
    }
  }
}

// AudioWorklet として読み込まれたとき
if (typeof registerProcessor === 'function') {
  registerProcessor('chip', class extends AudioWorkletProcessor {
    constructor() {
      super();
      this.syn = new ChipSynth(sampleRate);
      this.port.onmessage = (e) => {
        try { this.syn.message(e.data); } catch (err) { this.port.postMessage({ error: String(err && err.message || err) }); }
      };
    }
    process(inputs, outputs) {
      const o = outputs[0];
      const L = o[0];
      if (!L) return true;
      const R = o[1] || (this.tmp && this.tmp.length === L.length ? this.tmp : (this.tmp = new Float32Array(L.length)));
      this.syn.render(L, R, L.length);
      if (!o[1]) for (let s = 0; s < L.length; s++) L[s] = (L[s] + R[s]) * 0.5;
      return true;
    }
  });
}
