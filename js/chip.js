// =====================================================================
//  BGM の音源：楽譜（MML）の読み込みと合成。8bit 風のチップ音源（パルス波・三角波・のこぎり波・ノイズのドラム）と、
//  楽器の音源（笛・弦・金管・合唱・はじく弦・打楽器と残響。第2・3章）
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
//  {c e g}4 和音（楽器のチャンネルだけ。中の > < はかっこの中だけ効く）
//  ドラムのチャンネルは k j s x h o z c t m f g（大文字は強く）と r。打楽器（perc）のチャンネルはさらに y u n b e d
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
  const { bar, drum, kit, poly, insts, where, warn } = opt;
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
    if (drum && kit[c.toLowerCase()]) {
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
    if (c === '{') {
      if (!poly) throw new Error(`${where}: 和音は楽器のチャンネルだけ（小節 ${st.barNo}）`);
      const ns = [];
      let o = st.oct;
      while (i < s.length && s[i] !== '}') {
        const d = s[i++];
        if (d === ' ') continue;
        if (d === '>') { o++; continue; }
        if (d === '<') { o--; continue; }
        if (d === 'o') { o = num(); continue; }
        if (!(d in NOTE)) throw new Error(`${where}: 和音の中の ${d} が読めない（小節 ${st.barNo}）`);
        let n = (o + 1) * 12 + NOTE[d] + st.k;
        while (peek() === '+' || peek() === '#' || peek() === '-') n += s[i++] === '-' ? -1 : 1;
        ns.push(n);
      }
      i++;
      const t = len();
      for (const n of ns) ev.push({ t: st.t, g: st.t + Math.max(1, Math.round((t * st.q) / 8)), n, i: st.inst, v: st.vol, sl: 0, pt: 0, d: st.det, vib: st.vib, arp: null, as: 1 });
      st.t += t;
      st.slur = false;
      last = null;
      continue;
    }
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

// 音色を内部の形にそろえる（model のある音色は楽器の音源用で、そのまま使う）
function normInst(I) {
  if (I.model) return I;
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
    const drum = ch.type === 'drum' || ch.type === 'perc';
    const src = expandLoops(expandPatterns(ch.mml, song.pat, 0, where));
    const r = parseChannel(src, { bar, drum, kit: ch.type === 'perc' ? PERC : DRUMS, poly: ch.type === 'inst', insts, where, warn });
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
    const base = { type: ch.type, pan: ch.pan || 0, gain: ch.gain === undefined ? 1 : ch.gain, rev: ch.rev || 0, poly: ch.poly || 8 };
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
  return { song: { bpm: song.bpm, T, loop, ch: out, inst: instList, reverb: song.reverb || null, gain: song.gain || 1 }, warnings };
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

// ---------------------------------------------------------------- 楽器の音源（第2・3章）
//  チャンネルの type が 'inst'（和音も鳴らせる楽器）と 'perc'（打楽器）。音色の model：
//  add  正弦波の倍音を足す（笛・鐘・ビブラフォン・オルガン）  fm  周波数変調（エレピ・チェレスタ・木琴）
//  sub  のこぎり波などをフィルターで削る（弦・金管・合唱・二胡・アコーディオン）  ks  弦をはじく（ハープ・琴・琵琶・ピチカート）
//  時間はすべて秒。env は [立ち上がり, 減衰, 持続の大きさ, 離したあと]（減衰と離したあとは 1/1000 になるまでの時間）
const TBL = 2048;
const SINT = new Float32Array(TBL + 1);
for (let i = 0; i <= TBL; i++) SINT[i] = Math.sin((2 * Math.PI * i) / TBL);
// p は 0〜1 の位相
const sin1 = (p) => { const x = p * TBL; const i = x | 0; return SINT[i] + (SINT[i + 1] - SINT[i]) * (x - i); };
const sinw = (p) => sin1(p - Math.floor(p));
let seed = 0x2545f491;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 2147483648 - 1; };
// 音程・フィルターを決め直す間隔（サンプル）
const CR = 32;
const T60 = (t, sr) => Math.exp(-6.9 / (Math.max(t, 0.001) * sr));
const INST_GAIN = 0.12;
const PERC_GAIN = 0.15;
// シンバルの金属音（6 つの矩形波の比）
const METAL = [1, 1.4471, 1.617, 1.9265, 2.5028, 2.6637];

// 状態変数フィルター。run の type：0 低域 1 帯域（中心で 1 倍） 2 高域
class SVF {
  constructor() { this.s1 = 0; this.s2 = 0; this.a1 = 1; this.a2 = 0; this.a3 = 0; this.k = 1; }
  set(f, q, sr) {
    const g = Math.tan((Math.PI * Math.min(Math.max(f, 20), sr * 0.45)) / sr);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }
  reset() { this.s1 = 0; this.s2 = 0; }
  run(x, type) {
    const v3 = x - this.s2;
    const v1 = this.a1 * this.s1 + this.a2 * v3;
    const v2 = this.s2 + this.a2 * this.s1 + this.a3 * v3;
    this.s1 = 2 * v1 - this.s1;
    this.s2 = 2 * v2 - this.s2;
    return type === 0 ? v2 : type === 1 ? this.k * v1 : x - this.k * v1 - v2;
  }
}

// 打楽器（perc のチャンネル）。t 音程が下がる正弦波 [始め Hz, 終わり Hz, 下がる時間, 長さ, 大きさ]
//  n ノイズ [0 低域・1 帯域・2 高域, Hz, Q, 長さ, 大きさ, 何回打つか, 打つ間隔]  m 金属音 [基音 Hz, 高域フィルター Hz, 長さ, 大きさ]
//  p 倍音（銅鑼） [[比, 大きさ, 長さ]...] と基音 pf、立ち上がり sw
export const PERC = {
  k: { t: [[150, 46, 0.045, 0.42, 1]], n: [[0, 1500, 0.7, 0.025, 0.35]] },
  s: { t: [[230, 180, 0.02, 0.12, 0.5], [350, 320, 0.02, 0.07, 0.25]], n: [[1, 4200, 0.6, 0.2, 0.85]] },
  x: { n: [[1, 1300, 1.4, 0.16, 0.9, 3, 0.011]] },
  h: { m: [430, 7500, 0.05, 0.55], n: [[2, 9000, 0.7, 0.035, 0.25]] },
  o: { m: [430, 6500, 0.4, 0.5], n: [[2, 8000, 0.7, 0.3, 0.2]] },
  y: { m: [380, 5200, 1.4, 0.35], n: [[2, 7000, 0.7, 0.9, 0.12]] },
  c: { m: [330, 3800, 2.2, 0.55], n: [[2, 5500, 0.6, 1.8, 0.45]] },
  t: { t: [[210, 160, 0.05, 0.4, 0.9]], n: [[1, 900, 1, 0.05, 0.25]] },
  m: { t: [[150, 112, 0.05, 0.45, 0.9]], n: [[1, 700, 1, 0.05, 0.25]] },
  f: { t: [[108, 80, 0.06, 0.55, 0.95]], n: [[1, 500, 1, 0.06, 0.25]] },
  j: { t: [[88, 52, 0.09, 1.1, 1.1], [176, 120, 0.05, 0.18, 0.25]], n: [[0, 700, 0.8, 0.08, 0.45]] },
  d: { t: [[64, 32, 0.25, 2.2, 1.1]], n: [[0, 260, 0.7, 0.7, 0.35]] },
  g: { p: [[1, 1, 4.5], [1.47, 0.55, 3.6], [2.09, 0.38, 3], [2.56, 0.3, 2.6], [3.1, 0.2, 2], [4.3, 0.12, 1.4], [5.3, 0.07, 1]], pf: 96, sw: 0.06, n: [[0, 450, 0.7, 0.5, 0.18]] },
  z: { n: [[1, 6500, 1.1, 0.07, 0.55, 1, 0, 0.012]] },
  u: { m: [880, 6500, 0.24, 0.45], n: [[2, 8000, 0.8, 0.12, 0.2]] },
  n: { n: [[1, 2600, 2.2, 0.035, 0.85, 2, 0.022]], t: [[2100, 1900, 0.01, 0.02, 0.2]] },
  b: { t: [[1250, 1180, 0.01, 0.07, 0.75]], n: [[1, 1250, 4, 0.025, 0.3]] },
  e: { p: [[1, 1, 1.6], [2.76, 0.4, 0.9], [5.4, 0.2, 0.5]], pf: 2900, sw: 0 },
};

class PercVoice {
  constructor(sr) {
    this.sr = sr;
    this.done = true;
    this.tp = new Float64Array(4);
    this.tf = new Float32Array(4);
    this.tdf = new Float32Array(4);
    this.tm = new Float32Array(4);
    this.ta = new Float32Array(4);
    this.td = new Float32Array(4);
    this.nf = [new SVF(), new SVF()];
    this.nt = new Int8Array(2);
    this.na = new Float32Array(2);
    this.n0 = new Float32Array(2);
    this.nd = new Float32Array(2);
    this.nb = new Int32Array(2);
    this.ng = new Int32Array(2);
    this.nat = new Float32Array(2);
    this.mp = new Float64Array(6);
    this.mf = new SVF();
    this.pp = new Float64Array(8);
    this.pa = new Float32Array(8);
    this.pd = new Float32Array(8);
    this.pr = new Float32Array(8);
  }
  start(d, vel) {
    const sr = this.sr;
    this.done = false;
    this.t = 0;
    this.vel = vel;
    const T = d.t || [];
    this.ntone = T.length;
    for (let k = 0; k < T.length; k++) {
      const [f0, f1, sw, len, a] = T[k];
      this.tp[k] = 0;
      this.tf[k] = f1;
      this.tdf[k] = f0 - f1;
      this.tm[k] = Math.exp(-1 / (Math.max(sw, 0.001) * sr));
      this.ta[k] = a;
      this.td[k] = T60(len, sr);
    }
    const N = d.n || [];
    this.nnoise = N.length;
    for (let k = 0; k < N.length; k++) {
      const [type, f, q, len, a, bursts = 1, gap = 0, att = 0] = N[k];
      this.nt[k] = type;
      this.nf[k].reset();
      this.nf[k].set(f, q, sr);
      this.n0[k] = a;
      this.na[k] = att > 0 ? 0 : a;
      this.nd[k] = T60(len, sr);
      this.nb[k] = bursts;
      this.ng[k] = Math.round(gap * sr);
      this.nat[k] = att > 0 ? a / (att * sr) : 0;
    }
    this.metal = !!d.m;
    if (d.m) {
      const [f, hp, len, a] = d.m;
      this.mbase = f / sr;
      for (let k = 0; k < 6; k++) this.mp[k] = rnd() * 0.5 + 0.5;
      this.mf.reset();
      this.mf.set(hp, 0.7, sr);
      this.ma = a;
      this.md = T60(len, sr);
    }
    const P = d.p || [];
    this.npart = Math.min(8, P.length);
    for (let k = 0; k < this.npart; k++) {
      this.pp[k] = 0;
      this.pa[k] = P[k][1];
      this.pd[k] = T60(P[k][2], sr);
      this.pr[k] = (P[k][0] * (d.pf || 100)) / sr;
    }
    this.sw = d.sw ? 1 / (d.sw * sr) : 0;
    this.swv = d.sw ? 0 : 1;
  }
  render(buf, s, e) {
    const sr = this.sr;
    for (let i = s; i < e; i++) {
      let y = 0;
      let alive = 0;
      for (let k = 0; k < this.ntone; k++) {
        const f = this.tf[k] + this.tdf[k];
        this.tdf[k] *= this.tm[k];
        let p = this.tp[k] + f / sr;
        if (p >= 1) p -= 1;
        this.tp[k] = p;
        y += sin1(p) * this.ta[k];
        this.ta[k] *= this.td[k];
        alive += this.ta[k];
      }
      for (let k = 0; k < this.nnoise; k++) {
        if (this.nat[k] > 0) {
          this.na[k] += this.nat[k];
          if (this.na[k] >= this.n0[k]) { this.na[k] = this.n0[k]; this.nat[k] = 0; }
        } else this.na[k] *= this.nd[k];
        if (this.nb[k] > 1 && this.ng[k] > 0 && this.t > 0 && this.t % this.ng[k] === 0) { this.nb[k]--; this.na[k] = this.n0[k]; }
        y += this.nf[k].run(rnd(), this.nt[k]) * this.na[k];
        alive += this.na[k];
      }
      if (this.metal) {
        let m = 0;
        for (let k = 0; k < 6; k++) {
          let p = this.mp[k] + this.mbase * METAL[k];
          if (p >= 1) p -= 1;
          this.mp[k] = p;
          m += p < 0.5 ? 1 : -1;
        }
        y += this.mf.run(m / 6, 2) * this.ma;
        this.ma *= this.md;
        alive += this.ma;
      }
      if (this.npart) {
        if (this.swv < 1) { this.swv += this.sw; if (this.swv > 1) this.swv = 1; }
        let g = 0;
        for (let k = 0; k < this.npart; k++) {
          let p = this.pp[k] + this.pr[k];
          if (p >= 1) p -= 1;
          this.pp[k] = p;
          g += sin1(p) * this.pa[k];
          this.pa[k] *= this.pd[k];
          alive += this.pa[k];
        }
        y += g * this.swv;
      }
      this.t++;
      const att = this.t < 40 ? this.t / 40 : 1;
      buf[i] += y * this.vel * att;
      if (alive < 1e-4) { this.done = true; return; }
    }
  }
}

// 楽器の 1 音
class InstVoice {
  constructor(sr) {
    this.sr = sr;
    this.done = true;
    this.ph = new Float64Array(8);
    this.am = new Float32Array(8);
    this.dc = new Float32Array(8);
    this.rt = new Float32Array(8);
    this.f1 = new SVF();
    this.f2 = new SVF();
    this.f3 = new SVF();
    this.is = new Float32Array(3);
    this.buf = null;
  }
  start(P, e, vel) {
    const sr = this.sr;
    this.P = P;
    this.model = P.model;
    this.done = false;
    this.st = 0;
    this.t = 0;
    this.cr = 0;
    this.vel = vel * (P.gain || 1);
    this.n = e.n + (e.d || 0) / 100;
    this.from = null;
    this.gl = 0;
    this.vib = e.vib ? [e.vib[0], e.vib[1], e.vib[2] / 60] : P.vib || null;
    const env = P.env || [0.01, 0.3, 0.8, 0.2];
    this.e = 0;
    this.ea = env[0] > 0 ? 1 / (env[0] * sr) : 1;
    this.es = env[2];
    this.edc = T60(env[1], sr);
    this.erc = T60(env[3], sr);
    const f0 = 440 * Math.pow(2, (this.n - 69) / 12);
    if (this.model === 'add') {
      const parts = P.parts || [[1, 1]];
      this.np = Math.min(8, parts.length);
      for (let k = 0; k < this.np; k++) {
        const [r, a, d] = parts[k];
        this.rt[k] = r;
        this.am[k] = r * f0 < sr * 0.45 ? a : 0;
        this.dc[k] = d ? T60(d, sr) : 1;
        this.ph[k] = 0;
      }
      this.nz = P.noise || 0;
      this.chiff = P.chiff || 0;
      this.chd = T60(0.08, sr);
      this.f1.reset();
    } else if (this.model === 'fm') {
      const pr = P.pairs;
      this.np = Math.min(3, pr.length);
      for (let k = 0; k < this.np; k++) {
        const [c, m, i0, is, it, amp, adec] = pr[k];
        this.ph[2 * k] = 0;
        this.ph[2 * k + 1] = 0;
        this.rt[2 * k] = c;
        this.rt[2 * k + 1] = m;
        this.am[2 * k] = i0 / (2 * Math.PI);
        this.am[2 * k + 1] = amp;
        this.dc[2 * k] = T60(it, sr);
        this.dc[2 * k + 1] = adec ? T60(adec, sr) : 1;
      }
      for (let k = 0; k < this.np; k++) this.is[k] = pr[k][3] / (2 * Math.PI);
    } else if (this.model === 'sub') {
      this.np = P.n || 1;
      for (let k = 0; k < this.np; k++) {
        this.ph[k] = (rnd() + 1) / 2;
        const sp = this.np > 1 ? (k / (this.np - 1)) * 2 - 1 : 0;
        this.rt[k] = Math.pow(2, ((P.det || 0) * sp) / 1200);
      }
      this.f1.reset();
      this.f2.reset();
      this.f3.reset();
      if (P.form) {
        const F = P.form;
        this.f1.set(F[0][0], F[0][1], sr);
        if (F[1]) this.f2.set(F[1][0], F[1][1], sr);
        if (F[2]) this.f3.set(F[2][0], F[2][1], sr);
      }
    } else if (this.model === 'ks') {
      if (!this.buf) this.buf = new Float32Array(4096);
      const S = P.damp === undefined ? 0.3 : P.damp;
      const D = sr / f0;
      const N = Math.max(2, Math.min(4000, Math.floor(D - S - 0.1)));
      const dl = D - S - N;
      this.kn = N;
      this.kC = (1 - dl) / (1 + dl);
      this.kS = S;
      this.kg = Math.pow(10, -3 / (f0 * (P.t60 || 2) * Math.pow(261.6 / f0, P.tk === undefined ? 0.5 : P.tk)));
      const b = P.bright === undefined ? 0.6 : P.bright;
      const lp = 0.04 + b * b * 0.96;
      let y = 0;
      let mean = 0;
      for (let k = 0; k < N; k++) { y += (rnd() - y) * lp; this.buf[k] = y; mean += y; }
      mean /= N;
      const pk = Math.floor((P.pick || 0) * N);
      let mx = 1e-6;
      for (let k = N - 1; k >= 0; k--) {
        let v = this.buf[k] - mean;
        if (pk > 0 && k >= pk) v -= this.buf[k - pk] - mean;
        this.buf[k] = v;
        mx = Math.max(mx, Math.abs(v));
      }
      for (let k = 0; k < N; k++) this.buf[k] /= mx;
      this.kp = 0;
      this.kprev = 0;
      this.kx1 = 0;
      this.ky1 = 0;
      this.klv = 1;
      this.f1.reset();
      this.f1.set(P.cut || 7000, 0.7, sr);
      this.e = 1;
      this.st = 2;
    }
  }
  // 同じ音を離さずに次の高さへ（& でつないだ音）
  glide(e) {
    this.from = this.cur;
    this.n = e.n + (e.d || 0) / 100;
    this.gl = e.pt > 0 ? e.pt / 60 : this.P.glide || 0;
    this.gt = this.t;
    if (this.st === 3) { this.st = 1; }
  }
  release() {
    if (this.st !== 3) this.st = 3;
    if (this.model === 'ks') this.kg = Math.min(this.kg, Math.pow(10, -3 / ((440 * Math.pow(2, (this.n - 69) / 12)) * (this.P.rel || 0.12))));
  }
  control() {
    const P = this.P;
    const sr = this.sr;
    const t = this.t / sr;
    let n = this.n;
    if (this.from !== null) {
      const k = this.gl > 0 ? Math.min(1, (this.t - this.gt) / (this.gl * sr)) : 1;
      n = this.from + (this.n - this.from) * k;
      if (k >= 1) this.from = null;
    }
    if (P.scoop) n += P.scoop[0] * Math.max(0, 1 - t / P.scoop[1]);
    const v = this.vib;
    if (v && t > v[2]) {
      const g = t - v[2];
      n += (v[0] / 100) * Math.min(1, g / 0.35) * Math.sin(2 * Math.PI * v[1] * g);
    }
    this.cur = n;
    const f = 440 * Math.pow(2, (n - 69) / 12);
    this.inc = f / sr;
    if (P.trem) this.tg = 1 - P.trem[0] * (0.5 + 0.5 * Math.sin(2 * Math.PI * P.trem[1] * t));
    else this.tg = 1;
    if (this.model === 'add') {
      if (this.nz || this.chiff) this.f1.set(f * (P.nf || 1.5), P.nq || 1.5, sr);
    } else if (this.model === 'sub' && !P.form) {
      let c = (P.cut || 2000) * Math.pow(f / 261.6, P.kt === undefined ? 0.4 : P.kt);
      if (P.fenv) {
        const [amt, a, d] = P.fenv;
        c += amt * (t < a ? t / a : Math.exp(-(t - a) * (6.9 / d)));
      }
      this.f1.set(c, P.q || 0.7, sr);
    }
  }
  env() {
    let e = this.e;
    if (this.st === 0) { e += this.ea; if (e >= 1) { e = 1; this.st = 1; } }
    else if (this.st === 1) {
      e = this.es + (e - this.es) * this.edc;
      if (this.es === 0 && e < 1e-4) this.done = true;
    } else if (this.st === 3) { e *= this.erc; if (e < 1e-4) this.done = true; }
    this.e = e;
    return e;
  }
  render(buf, s, e) {
    const m = this.model;
    if (m === 'add') this.rAdd(buf, s, e);
    else if (m === 'fm') this.rFm(buf, s, e);
    else if (m === 'sub') this.rSub(buf, s, e);
    else this.rKs(buf, s, e);
  }
  rAdd(buf, s, e) {
    const np = this.np;
    for (let i = s; i < e; i++) {
      if (--this.cr <= 0) { this.cr = CR; this.control(); }
      const en = this.env();
      const inc = this.inc;
      let y = 0;
      for (let k = 0; k < np; k++) {
        let p = this.ph[k] + inc * this.rt[k];
        if (p >= 1) p -= Math.floor(p);
        this.ph[k] = p;
        y += sin1(p) * this.am[k];
        this.am[k] *= this.dc[k];
      }
      if (this.nz || this.chiff) {
        y += this.f1.run(rnd(), 1) * (this.nz + this.chiff);
        this.chiff *= this.chd;
      }
      this.t++;
      buf[i] += y * en * this.vel * this.tg;
      if (this.done) return;
    }
  }
  rFm(buf, s, e) {
    const np = this.np;
    for (let i = s; i < e; i++) {
      if (--this.cr <= 0) { this.cr = CR; this.control(); }
      const en = this.env();
      const inc = this.inc;
      let y = 0;
      for (let k = 0; k < np; k++) {
        const c = 2 * k;
        let pc = this.ph[c] + inc * this.rt[c];
        if (pc >= 1) pc -= Math.floor(pc);
        let pm = this.ph[c + 1] + inc * this.rt[c + 1];
        if (pm >= 1) pm -= Math.floor(pm);
        this.ph[c] = pc;
        this.ph[c + 1] = pm;
        const I = this.am[c];
        this.am[c] = this.is[k] + (I - this.is[k]) * this.dc[c];
        y += sinw(pc + I * sin1(pm)) * this.am[c + 1];
        this.am[c + 1] *= this.dc[c + 1];
      }
      this.t++;
      buf[i] += y * en * this.vel * this.tg;
      if (this.done) return;
    }
  }
  rSub(buf, s, e) {
    const P = this.P;
    const np = this.np;
    const pulse = P.osc === 'pulse';
    const duty = P.duty || 0.5;
    const form = P.form;
    const nz = P.noise || 0;
    for (let i = s; i < e; i++) {
      if (--this.cr <= 0) { this.cr = CR; this.control(); }
      const en = this.env();
      let x = 0;
      for (let k = 0; k < np; k++) {
        const dt = this.inc * this.rt[k];
        let p = this.ph[k] + dt;
        if (p >= 1) p -= 1;
        this.ph[k] = p;
        if (pulse) {
          let v = p < duty ? 1 : -1;
          v += blep(p, dt);
          v -= blep(p >= duty ? p - duty : p - duty + 1, dt);
          x += v;
        } else x += 2 * p - 1 - blep(p, dt);
      }
      x /= np;
      if (nz) x += rnd() * nz;
      let y;
      if (form) {
        y = this.f1.run(x, 1) * form[0][2];
        if (form[1]) y += this.f2.run(x, 1) * form[1][2];
        if (form[2]) y += this.f3.run(x, 1) * form[2][2];
      } else y = this.f1.run(x, 0);
      this.t++;
      buf[i] += y * en * this.vel * this.tg;
      if (this.done) return;
    }
  }
  rKs(buf, s, e) {
    const b = this.buf;
    const N = this.kn;
    const C = this.kC;
    const S = this.kS;
    for (let i = s; i < e; i++) {
      const en = this.env();
      const y = b[this.kp];
      const lp = (1 - S) * y + S * this.kprev;
      this.kprev = y;
      const ap = C * lp + this.kx1 - C * this.ky1;
      this.kx1 = lp;
      this.ky1 = ap;
      b[this.kp] = ap * this.kg;
      if (++this.kp >= N) this.kp = 0;
      const o = this.f1.run(y, 0);
      this.klv = this.klv * 0.999 + Math.abs(o) * 0.001;
      this.t++;
      buf[i] += o * en * this.vel;
      if (this.t > 2000 && this.klv < 2e-4) this.done = true;
      if (this.done) return;
    }
  }
}

// 楽器・打楽器のチャンネル：音を重ねて鳴らし、残響へも送る
class PolyChannel {
  constructor(ch, inst, sr) {
    this.ev = ch.ev;
    this.inst = inst;
    this.sr = sr;
    this.perc = ch.type === 'perc';
    const a = ((Math.max(-1, Math.min(1, ch.pan)) + 1) * Math.PI) / 4;
    this.gl = Math.cos(a) * Math.SQRT2;
    this.gr = Math.sin(a) * Math.SQRT2;
    this.gain = (this.perc ? PERC_GAIN : INST_GAIN) * ch.gain;
    this.rev = ch.rev;
    this.max = ch.poly;
    this.pool = [];
    this.voices = [];
    this.last = null;
    this.idx = 0;
    this.loopIdx = 0;
    this.tmp = new Float32Array(4096);
  }
  setLoop(loopTick) {
    let k = this.ev.findIndex((e) => e.t >= loopTick);
    if (k < 0) k = this.ev.length;
    this.loopIdx = k;
  }
  wrap() { this.idx = this.loopIdx; }
  nextTick() {
    const e = this.ev[this.idx];
    let t = e ? e.t : Infinity;
    for (const v of this.voices) if (!v.done && v.st !== 3 && v.g < t) t = v.g;
    return t;
  }
  events(tick) {
    for (const v of this.voices) if (!v.done && v.st !== 3 && v.g <= tick) v.release();
    while (this.idx < this.ev.length && this.ev[this.idx].t <= tick) this.trigger(this.ev[this.idx++]);
  }
  // 鳴らす音を用意する。重ねられる数（poly）を超えたら、いちばん古い音を止めて使う
  voice() {
    let v;
    if (this.voices.length >= this.max) v = this.voices.shift();
    else v = this.pool.pop() || (this.perc ? new PercVoice(this.sr) : new InstVoice(this.sr));
    this.voices.push(v);
    return v;
  }
  trigger(e) {
    const vel = Math.pow(e.v / 15, 1.5);
    if (this.perc) {
      const v = this.voice();
      v.g = Infinity;
      v.st = 3;
      v.start(PERC[e.d], vel);
      return;
    }
    const P = this.inst[e.i];
    if (!P || !P.model) return;
    const L = this.last;
    if (e.sl && L && !L.done && L.st !== 3 && L.P === P) {
      L.glide(e);
      L.g = e.g;
      return;
    }
    const v = this.voice();
    v.start(P, e, vel);
    v.g = e.g;
    this.last = v;
  }
  render(L, R, RV, off, m, tick0, tps) {
    const tmp = this.tmp;
    tmp.fill(0, 0, m);
    let s = 0;
    while (s < m) {
      this.events(tick0 + s * tps);
      const nt = this.nextTick();
      let e = m;
      if (nt !== Infinity) {
        const k = Math.ceil((nt - tick0) / tps - 1e-9);
        if (k < e) e = Math.max(k, s + 1);
      }
      for (const v of this.voices) if (!v.done) v.render(tmp, s, e);
      s = e;
    }
    const g = this.gain;
    const gl = g * this.gl;
    const gr = g * this.gr;
    const rv = g * this.rev;
    for (let i = 0; i < m; i++) {
      const x = tmp[i];
      L[off + i] += x * gl;
      R[off + i] += x * gr;
      RV[off + i] += x * rv;
    }
    // 鳴り終わった音を並びから外して使い回しに戻す（配列を作らずに詰める）
    const vs = this.voices;
    let w = 0;
    for (let k = 0; k < vs.length; k++) {
      if (vs[k].done) this.pool.push(vs[k]);
      else vs[w++] = vs[k];
    }
    vs.length = w;
  }
}

// 残響（Freeverb）。size 0〜1 で広さ、damp 0〜1 で高音の吸われ方
class Reverb {
  constructor(sr, o = {}) {
    const k = sr / 44100;
    const mk = (n) => ({ b: new Float32Array(Math.max(8, Math.round(n * k))), p: 0, f: 0 });
    const C = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
    const A = [556, 441, 341, 225];
    this.cl = C.map(mk);
    this.cr = C.map((n) => mk(n + 23));
    this.al = A.map(mk);
    this.ar = A.map((n) => mk(n + 23));
    this.fb = 0.28 * (o.size === undefined ? 0.75 : o.size) + 0.7;
    this.damp = (o.damp === undefined ? 0.35 : o.damp) * 0.4;
    this.wet = (o.wet === undefined ? 1 : o.wet) * 3;
    this.ol = new Float32Array(4096);
    this.or = new Float32Array(4096);
  }
  side(cs, as, inp, out, n) {
    out.fill(0, 0, n);
    const fb = this.fb;
    const d = this.damp;
    for (const c of cs) {
      const b = c.b;
      const len = b.length;
      let p = c.p;
      let f = c.f;
      for (let i = 0; i < n; i++) {
        const y = b[p];
        f = y * (1 - d) + f * d;
        b[p] = inp[i] * 0.015 + f * fb;
        if (++p >= len) p = 0;
        out[i] += y;
      }
      c.p = p;
      c.f = f;
    }
    for (const a of as) {
      const b = a.b;
      const len = b.length;
      let p = a.p;
      for (let i = 0; i < n; i++) {
        const y = b[p];
        const x = out[i];
        b[p] = x + y * 0.5;
        out[i] = y - x;
        if (++p >= len) p = 0;
      }
      a.p = p;
    }
  }
  process(inp, L, R, n) {
    this.side(this.cl, this.al, inp, this.ol, n);
    this.side(this.cr, this.ar, inp, this.or, n);
    const w = this.wet;
    for (let i = 0; i < n; i++) { L[i] += this.ol[i] * w; R[i] += this.or[i] * w; }
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
    this.rv = new Float32Array(4096);
    this.reverb = null;
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
      const v = ch.type === 'inst' || ch.type === 'perc' ? new PolyChannel(ch, c.inst, this.sr) : new Voice(ch, c.inst, this.sr);
      v.setLoop(c.loop);
      return v;
    });
    this.reverb = c.ch.some((ch) => ch.rev > 0) ? new Reverb(this.sr, c.reverb || {}) : null;
  }
  render(L, R, n) {
    L.fill(0);
    R.fill(0);
    const song = this.song;
    if (!song) return;
    const RV = this.rv;
    RV.fill(0, 0, n);
    let i = 0;
    while (i < n) {
      if (this.tick >= song.T) {
        this.tick -= song.T - song.loop;
        for (const v of this.voices) v.wrap();
      }
      const tps = ((song.bpm / 60) * TPQ * this.mul) / this.sr;
      const m = Math.min(n - i, Math.max(1, Math.ceil((song.T - this.tick) / tps)));
      for (const v of this.voices) {
        if (v instanceof PolyChannel) v.render(L, R, RV, i, m, this.tick, tps);
        else v.render(L, R, i, m, this.tick, tps, this.frameLen, this.sm);
      }
      this.tick += m * tps;
      i += m;
    }
    if (this.reverb) this.reverb.process(RV, L, R, n);
    // 仕上げ：低音の偏りを除き、高音を少し丸め、大きすぎる音を抑える。曲の切り替えは短くフェード
    const f = this.f;
    const lpA = this.lpA;
    const hpR = this.hpR;
    const fs = 1 / (0.04 * this.sr);
    const g = this.master * song.gain;
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

// 効果音を同時に鳴らす数の上限
const SFX_VOICES = 64;
// AudioWorklet として読み込まれたとき
if (typeof registerProcessor === 'function') {
  registerProcessor('chip', class extends AudioWorkletProcessor {
    constructor() {
      super();
      this.syn = new ChipSynth(sampleRate);
      // 最後に受け取った曲と速さ（音源を作り直したときに戻す）
      this.keep = {};
      // 効果音：録音した波形を受け取っておき、鳴らす合図が来たらここで混ぜる（2 つ目の出力）。
      // 効果音 1 回ごとに音声ノードを作ると、iPhone でランの終盤に落ちる疑いがあるため（1 ランで 2〜3 万個になる）
      this.sfxBufs = new Map();
      this.sfxVoices = [];
      this.port.onmessage = (e) => {
        const m = e.data || {};
        if (m.sfxBuf) { this.sfxBufs.set(m.sfxBuf, m.data); return; }
        if (m.sfxPlay) {
          const d = this.sfxBufs.get(m.sfxPlay);
          if (!d) return;
          // 同時に鳴らす数の上限（超えたら、いちばん古い音を止める）
          if (this.sfxVoices.length >= SFX_VOICES) this.sfxVoices.shift();
          this.sfxVoices.push({ d, i: 0 });
          return;
        }
        if (m.song) this.keep.song = m;
        if (m.stop) delete this.keep.song;
        if (m.tempo) this.keep.tempo = m.tempo;
        try { this.syn.message(m); } catch (err) { this.port.postMessage({ error: String(err && err.message || err) }); }
      };
    }
    process(inputs, outputs) {
      this.mixSfx(outputs[1] && outputs[1][0]);
      const o = outputs[0];
      const L = o[0];
      if (!L) return true;
      const R = o[1] || (this.tmp && this.tmp.length === L.length ? this.tmp : (this.tmp = new Float32Array(L.length)));
      try { this.syn.render(L, R, L.length); } catch (err) { L.fill(0); R.fill(0); this.reset(String(err && err.message || err)); return true; }
      // 数でない値（NaN など）が出たら、その分は無音にして音源を作り直す（そのまま流すと出口のコンプレッサーが壊れて、効果音まで鳴らなくなる）
      for (let s = 0; s < L.length; s++) {
        if (!Number.isFinite(L[s] + R[s])) { L.fill(0); R.fill(0); this.reset('nan'); return true; }
      }
      if (!o[1]) for (let s = 0; s < L.length; s++) L[s] = (L[s] + R[s]) * 0.5;
      return true;
    }
    mixSfx(out) {
      const vs = this.sfxVoices;
      if (!out || !vs.length) return;
      const n = out.length;
      for (let k = vs.length - 1; k >= 0; k--) {
        const v = vs[k], d = v.d;
        const m = Math.min(n, d.length - v.i);
        for (let s = 0; s < m; s++) out[s] += d[v.i + s];
        v.i += m;
        if (v.i >= d.length) vs.splice(k, 1);
      }
    }
    reset(why) {
      this.port.postMessage({ error: why });
      this.syn = new ChipSynth(sampleRate);
      try {
        if (this.keep.tempo) this.syn.message({ tempo: this.keep.tempo });
        if (this.keep.song) this.syn.message(this.keep.song);
      } catch (err) { /* 戻せなければ無音のまま次の曲を待つ */ }
    }
  });
}
