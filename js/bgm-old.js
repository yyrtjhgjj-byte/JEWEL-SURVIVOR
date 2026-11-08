// =====================================================================
//  旧曲：チップ音源にする前の BGM（ジュークボックスの「旧曲」で聴く）
//  16 分音符ごとに WebAudio の音を予約して鳴らす。楽器の音は 1 度録音して使い回す
// =====================================================================

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// フルート風：やわらかい正弦波＋倍音、遅れてかかるビブラート、吹き始めの息の音
function flute(a, freq, dur, { vol = 0.08, when = 0, bus } = {}) {
  if (!a.ready) return;
  const c = a.ctx;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  const o2 = c.createOscillator();
  o2.type = 'triangle';
  o2.frequency.setValueAtTime(freq * 2, t);
  const g2 = c.createGain();
  g2.gain.value = 0.12;
  const lfo = c.createOscillator();
  lfo.frequency.value = 5.2;
  const lg = c.createGain();
  lg.gain.setValueAtTime(0, t);
  lg.gain.linearRampToValueAtTime(freq * 0.012, t + Math.min(0.3, dur * 0.6));
  lfo.connect(lg);
  lg.connect(o.frequency);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.07);
  g.gain.setValueAtTime(vol, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  o2.connect(g2).connect(g);
  g.connect(bus || a.sfxBus);
  o.onended = () => { for (const x of [o, o2, g2, lfo, lg, g]) x.disconnect(); };
  a.nodeCount += 6;
  for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + dur + 0.05); }
  a.noise(Math.min(0.12, dur), { vol: vol * 0.45, freq: freq * 1.6, q: 1.5, when, bus });
}

// 撥弦（古琴・古筝風）：三角波と 1 オクターブ上の正弦波を、はじいてすぐ減衰させる
function pluck(a, freq, { vol = 0.1, when = 0, bus, dur = 0.7 } = {}) {
  a.tone(freq, dur, { type: 'triangle', vol, when, bus, attack: 0.003 });
  a.tone(freq * 2, dur * 0.45, { type: 'sine', vol: vol * 0.35, when, bus, attack: 0.003 });
}
// 鐘（編鐘風）：倍音の比をずらした正弦波を重ねる
function bell(a, freq, { vol = 0.08, when = 0, bus } = {}) {
  a.tone(freq, 1.3, { type: 'sine', vol, when, bus, attack: 0.004 });
  a.tone(freq * 2.76, 0.5, { type: 'sine', vol: vol * 0.3, when, bus, attack: 0.004 });
  a.tone(freq * 5.4, 0.22, { type: 'sine', vol: vol * 0.12, when, bus, attack: 0.004 });
}
// チェレスタ（オルゴール風）：整数倍の倍音だけを重ね、短めに減衰させる（旋律の音が重なって濁らないように）
function celesta(a, freq, { vol = 0.08, when = 0, bus } = {}) {
  a.tone(freq, 0.55, { type: 'sine', vol, when, bus, attack: 0.003 });
  a.tone(freq * 2, 0.3, { type: 'sine', vol: vol * 0.28, when, bus, attack: 0.003 });
  a.tone(freq * 4, 0.12, { type: 'sine', vol: vol * 0.07, when, bus, attack: 0.003 });
}
// 銅鑼
function gong(a, { when = 0, bus } = {}) {
  a.tone(72, 1.9, { type: 'sine', vol: 0.3, when, bus, slide: 62, attack: 0.01 });
  a.tone(108, 1.5, { type: 'triangle', vol: 0.06, when, bus, attack: 0.01 });
  a.noise(1.1, { vol: 0.07, freq: 340, q: 2.5, when, bus });
}


export class OldBgm {
  constructor(a) {
    this.a = a;
    this.pool = new Map();
    this.track = null;
    this.timer = null;
  }
  play(name) {
    this.stop();
    const tr = OLD_TRACKS[name];
    if (!tr) return;
    this.track = tr;
    // 録音は今の曲のぶんだけ持つ
    this.pool = new Map();
    this.n = 0;
    this.next = this.a.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.track = null;
  }
  // 録音があれば録音を鳴らし、なければ録音を作りながらその場で合成する
  sample(key, dur, synth, bus, when) {
    const a = this.a;
    const buf = this.pool.get(key);
    if (buf) {
      const s = a.ctx.createBufferSource();
      s.buffer = buf;
      s.connect(bus);
      s.onended = () => s.disconnect();
      a.nodeCount += 1;
      s.start(a.ctx.currentTime + when);
      return;
    }
    if (!this.pool.has(key)) a.bake(this.pool, key, dur, synth);
    synth(bus, when);
  }
  schedule() {
    const tr = this.track;
    const c = this.a.ctx;
    if (!tr || !c || c.state !== 'running') return;
    const stepDur = 60 / tr.bpm / 4;
    while (this.next < c.currentTime + 0.12) {
      this.step(tr, this.n, this.next - c.currentTime);
      this.next += stepDur;
      this.n++;
    }
  }
  step(tr, step, when) {
    const bars = tr.chords.length;
    const s16 = step % 16;
    const bar = Math.floor(step / 16) % bars;
    const chord = tr.chords[bar];
    const a = this.a;
    const b = a.bgmBus;
    const S = (key, dur, f) => this.sample(key, dur, f, b, when);
    // ベース
    if (tr.bass[s16] != null) {
      const n = chord[0] - 24 + tr.bass[s16];
      S(`b${n}`, 0.2, (bus, w) => a.tone(mtof(n), 0.16, { type: 'triangle', vol: 0.32, when: w, bus }));
    }
    // アルペジオ（arpPluck は撥弦の音色）
    if (tr.arp && (s16 % tr.arp === 0)) {
      const idx = Math.floor(step / tr.arp) % 4;
      const n = chord[idx % 3] + (idx === 3 ? 12 : 0) + 12;
      if (tr.arpPluck) S(`ap${n}`, 0.34, (bus, w) => pluck(a, mtof(n), { when: w, bus, vol: 0.05, dur: 0.3 }));
      else S(`as${n}`, 0.13, (bus, w) => a.tone(mtof(n), 0.09, { type: 'square', vol: 0.045, when: w, bus }));
    }
    // 銅鑼（gong 小節ごとの頭）
    if (tr.gong && s16 === 0 && bar % tr.gong === 0) S('gong', 1.95, (bus, w) => gong(a, { when: w, bus }));
    // メロディ（8分）。flute / pluck / bell / celesta で音色を変える
    if (s16 % 2 === 0 && tr.melody) {
      const mel = tr.melody[bar];
      const n = mel && mel[s16 / 2];
      const len = tr.noteLen || (tr.flute ? 0.4 : 0.7);
      if (n && tr.flute) S(`mf${n}`, len + 0.08, (bus, w) => flute(a, mtof(n), len, { when: w, bus, vol: 0.09 }));
      else if (n && tr.pluck) S(`mp${n}`, len + 0.05, (bus, w) => pluck(a, mtof(n), { when: w, bus, vol: 0.11, dur: len }));
      else if (n && tr.bell) S(`mb${n}`, 1.35, (bus, w) => bell(a, mtof(n), { when: w, bus, vol: 0.075 }));
      else if (n && tr.celesta) S(`mc${n}`, 0.6, (bus, w) => celesta(a, mtof(n), { when: w, bus, vol: 0.09 }));
      else if (n) {
        S(`ms${n}`, 0.27, (bus, w) => {
          a.tone(mtof(n), 0.22, { type: 'sawtooth', vol: 0.035, when: w, bus, detune: 6 });
          a.tone(mtof(n), 0.24, { type: 'sine', vol: 0.06, when: w, bus });
        });
      }
    }
    // ドラム
    if (tr.drums) {
      if (tr.kick.includes(s16)) S('kick', 0.3, (bus, w) => a.tone(tr.kickHz || 150, tr.kickHz ? 0.24 : 0.14, { type: 'sine', vol: 0.5, slide: 40, when: w, bus }));
      if (tr.snare.includes(s16)) S('snare', 0.16, (bus, w) => a.noise(0.13, { vol: 0.22, freq: 1800, q: 0.7, when: w, bus }));
      if (tr.hat.includes(s16)) S('hat', 0.06, (bus, w) => a.noise(0.035, { vol: 0.09, freq: 9000, type: 'highpass', when: w, bus }));
    }
  }
}

// コード（ルートは C4 あたり）
const C = [60, 64, 67], G = [55, 59, 62], Am = [57, 60, 64], F = [53, 57, 60], E = [52, 56, 59];
const Em = [52, 55, 59], D = [50, 54, 57], Dm = [50, 53, 57], Bb = [46, 50, 53], A = [45, 49, 52];
const Cm = [48, 51, 55], Ab = [44, 48, 51], Eb = [51, 55, 58];
const B = [47, 51, 54];

// 第3章（四凶）：五音音階の旋律に、撥弦・鐘・笛・銅鑼
const TRACKS3 = {
  // 窮奇：北の果ての北風。笛と撥弦のアルペジオ
  yushu: {
    bpm: 132,
    flute: true, noteLen: 0.22,
    chords: [Dm, C, Dm, Am, Dm, C, F, A],
    bass: [0, null, 12, null, 0, null, 7, null, 0, null, 12, null, 0, 7, 10, null],
    arp: 1, arpPluck: true,
    melody: [
      [74, null, 77, 79, 81, null, 79, 77],
      [79, null, 77, 74, 72, null, 74, 77],
      [81, 84, 86, 84, 81, null, 79, 81],
      [81, null, 79, 77, 76, null, 72, 76],
      [86, null, 84, 81, 84, null, 86, 89],
      [84, null, 81, 79, 77, null, 79, 81],
      [77, 79, 81, 84, 81, 79, 77, 74],
      [73, null, 76, null, 81, null, 76, 73],
    ],
    drums: true, kick: [0, 6, 8, 14], snare: [4, 12], hat: [2, 6, 10, 14], gong: 8,
  },
  // 檮杌：洪水。重い太鼓と撥弦の旋律
  uzan: {
    bpm: 118,
    pluck: true, noteLen: 0.9,
    chords: [Em, Em, C, D, Em, G, Am, B],
    bass: [0, null, null, 0, null, null, 7, null, 0, null, null, 0, null, 12, 7, null],
    arp: 2, arpPluck: true,
    melody: [
      [76, null, null, 79, 81, null, 79, null],
      [83, null, 81, null, 79, 76, 74, null],
      [72, null, 76, null, 79, null, 81, 79],
      [74, null, 78, null, 81, null, 78, 74],
      [88, null, 86, 83, 81, null, 83, null],
      [86, null, 83, null, 79, 81, 83, null],
      [81, null, 84, null, 88, null, 84, 81],
      [83, null, 78, null, 75, null, 71, null],
    ],
    drums: true, kickHz: 95, kick: [0, 3, 8, 10], snare: [12], hat: [4, 12], gong: 4,
  },
  // 饕餮：青銅の祭器。編鐘の旋律
  sanki: {
    bpm: 104,
    bell: true,
    chords: [Am, Am, F, G, Am, Em, F, E],
    bass: [0, null, null, null, 7, null, null, null, 0, null, null, 0, 7, null, 12, null],
    arp: 2, arpPluck: true,
    melody: [
      [81, null, 84, null, 88, null, 84, null],
      [86, null, 84, 81, 79, null, 81, null],
      [77, null, 81, null, 84, null, 86, 84],
      [79, null, 86, null, 84, null, 79, null],
      [88, null, 91, 88, 86, null, 84, null],
      [79, null, 76, null, 79, 81, 83, null],
      [84, null, 81, null, 77, null, 81, 84],
      [80, null, 83, null, 76, null, 68, null],
    ],
    drums: true, kickHz: 110, kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14], gong: 4,
  },
  // 渾沌：歌と舞。にぎやかな笛と四つ打ち（渾沌の輪の弾もこの拍に合わせる）
  chuou: {
    bpm: 140,
    flute: true, noteLen: 0.18,
    chords: [C, Am, F, G, C, Am, Dm, G],
    bass: [0, null, 12, null, 7, null, 12, null, 0, null, 12, null, 7, null, 12, 10],
    arp: 2, arpPluck: true,
    melody: [
      [79, 81, 84, null, 81, 79, 76, 79],
      [81, null, 76, 79, 81, 84, 81, null],
      [77, 79, 81, null, 84, 81, 79, 77],
      [79, null, 74, 76, 79, 81, 79, null],
      [84, 86, 88, null, 86, 84, 81, 84],
      [88, null, 84, 81, 84, 86, 88, null],
      [86, 84, 81, null, 77, 79, 81, 84],
      [79, null, 81, 79, 76, 74, 72, null],
    ],
    drums: true, kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14], gong: 8,
  },
  // 四凶との戦い（第3章の最終ボス）
  shikyou: {
    bpm: 166,
    chords: [Am, F, Dm, E, Am, F, G, E],
    bass: [0, 0, 12, 0, 12, 0, 12, 0, 0, 0, 12, 0, 12, 0, 12, 12],
    arp: 1, arpPluck: true,
    melody: [
      [81, 84, 88, 84, 93, null, 91, 88],
      [89, null, 88, 84, 81, null, 84, 88],
      [86, 89, 93, 89, 86, null, 84, 81],
      [80, null, 83, 88, 92, null, 88, 83],
      [93, null, 91, 88, 86, 88, 91, 93],
      [89, 88, 84, 81, 84, null, 88, 89],
      [91, null, 86, 83, 79, null, 83, 86],
      [88, null, 92, null, 95, null, 92, 88],
    ],
    drums: true, kickHz: 120, kick: [0, 3, 6, 8, 11, 14], snare: [4, 12], hat: [1, 3, 5, 7, 9, 11, 13, 15], gong: 2,
  },
};

export const OLD_TRACKS = {
  ...TRACKS3,
  // 経営：ゆったりした跳ねるリズムに、チェレスタの旋律と撥弦のアルペジオ
  business: {
    bpm: 104,
    celesta: true,
    chords: [F, Em, Dm, C, F, G, Am, G],
    bass: [0, null, null, 7, null, null, 12, null, 0, null, 7, null, 12, null, 7, null],
    arp: 2, arpPluck: true,
    melody: [
      [77, null, 76, 74, 72, null, 69, null],
      [71, null, 72, 74, 76, null, null, 79],
      [77, null, 74, null, 72, 74, 77, null],
      [76, null, null, null, 72, null, 67, null],
      [69, 72, 77, null, 76, null, 77, 79],
      [81, null, 79, null, 77, null, 74, null],
      [76, null, 72, 76, 81, null, 79, 76],
      [74, null, null, 71, 74, null, 79, null],
    ],
    drums: true, kick: [0, 6, 10], snare: [4, 12], hat: [2, 6, 10, 14],
  },
  // 第2章の最後：奏者のフルート（ラン開始から、奏者を倒すまで）
  pipers: {
    bpm: 80,
    flute: true, noteLen: 0.55,
    chords: [Dm, Dm, Bb, A, Dm, Dm, Bb, A],
    bass: [0, null, null, null, null, null, null, null, 1, null, null, null, null, null, null, null],
    melody: [
      [74, null, 75, null, 74, null, 70, null],
      [74, null, 75, null, 77, null, 75, 74],
      [70, null, 69, null, 70, null, 74, null],
      [73, null, 74, null, 76, null, 73, null],
      [81, null, 82, null, 81, null, 77, null],
      [81, null, 82, null, 84, null, 82, 81],
      [77, null, 75, null, 74, null, 70, null],
      [73, null, null, null, 69, null, null, null],
    ],
    drums: true, kick: [0, 3, 8, 11], snare: [], hat: [],
  },
  // 第2章の最後：目覚めたアザトース
  azathoth: {
    bpm: 168,
    flute: true, noteLen: 0.16,
    chords: [Dm, Eb, Dm, Ab, Dm, Eb, Bb, A],
    bass: [0, null, 0, 12, 0, null, 0, 13, 0, null, 0, 12, 0, 1, 0, 13],
    arp: 1,
    melody: [
      [86, 87, 86, 82, 81, 82, 86, 89],
      [87, 86, 82, 79, 82, 87, 91, 87],
      [86, 89, 93, 89, 86, 82, 81, 82],
      [80, 84, 87, 92, 87, 84, 80, 75],
      [86, 87, 86, 82, 81, 82, 86, 89],
      [87, 86, 82, 79, 82, 87, 91, 94],
      [94, 93, 89, 86, 82, 86, 89, 93],
      [85, 88, 91, 88, 85, 81, 76, 73],
    ],
    drums: true, kick: [0, 4, 8, 10, 12], snare: [4, 12], hat: [2, 6, 10, 14],
  },
  // 第2章：宇宙
  space: {
    bpm: 88,
    chords: [C, G, Am, Em, F, C, Dm, G],
    bass: [0, null, null, null, null, null, null, null, 7, null, null, null, 12, null, null, null],
    arp: 1,
    melody: [
      [72, null, null, null, 79, null, null, null],
      [84, null, null, null, 83, null, 79, null],
      [81, null, null, null, 76, null, 72, null],
      [79, null, null, null, 71, null, 74, null],
      [77, null, 81, null, 84, null, 89, null],
      [88, null, 84, null, 79, null, 76, null],
      [77, null, 74, null, 81, null, 77, null],
      [79, null, null, null, 83, null, 86, null],
    ],
    drums: true, kick: [0], snare: [8], hat: [4, 12],
  },
  // 第2章：カルコサ
  carcosa: {
    bpm: 104,
    chords: [Am, F, Dm, E, Am, F, E, E],
    bass: [0, null, null, 0, 7, null, null, null, 0, null, null, 0, 7, null, 5, null],
    arp: 2,
    melody: [
      [81, null, 84, null, 88, null, 84, 81],
      [77, null, 81, null, 84, null, 81, null],
      [77, null, 74, null, 81, null, 77, 74],
      [76, null, 80, null, 83, null, 80, 76],
      [81, null, 84, 88, 93, null, 91, 88],
      [89, null, 88, 84, 81, null, 84, null],
      [83, null, 80, null, 76, null, 80, 83],
      [81, null, null, null, 80, null, 76, null],
    ],
    drums: true, kick: [0, 8, 11], snare: [4, 12], hat: [2, 6, 10, 14],
  },
  // 第2章：湖畔のお茶会
  lake: {
    bpm: 96,
    chords: [F, Dm, Bb, C, F, Am, Bb, C],
    bass: [0, null, null, null, 7, null, 12, null, 0, null, null, null, 7, null, 12, null],
    arp: 2,
    melody: [
      [77, null, 81, null, 84, null, 81, 77],
      [74, null, 77, null, 81, null, 77, null],
      [74, null, 77, null, 82, null, 81, 77],
      [79, null, 76, null, 72, null, 76, 79],
      [81, null, 84, 81, 89, null, 88, 84],
      [84, null, 81, null, 76, null, 81, null],
      [82, null, 81, 77, 74, null, 77, 79],
      [81, null, null, null, 79, null, 76, null],
    ],
    drums: true, kick: [0, 8], snare: [], hat: [4, 12],
  },
  // 第2章：ルルイエ
  rlyeh: {
    bpm: 112,
    chords: [Em, C, Am, B, Em, C, D, B],
    bass: [0, null, 0, null, 7, null, null, 6, 0, null, 0, null, 7, null, 12, null],
    arp: 2,
    melody: [
      [76, null, 79, null, 83, null, 82, 79],
      [79, null, 76, null, 72, null, 76, null],
      [81, null, 84, null, 81, null, 76, null],
      [78, null, 75, null, 71, null, 75, 78],
      [76, null, 79, 83, 88, null, 86, 83],
      [84, null, 83, 79, 76, null, 79, null],
      [81, null, 78, null, 74, null, 78, 81],
      [83, null, null, null, 75, null, 71, null],
    ],
    drums: true, kick: [0, 6, 8], snare: [4, 12], hat: [2, 10, 14],
  },
  // 第2章：深海
  deep: {
    bpm: 100,
    chords: [Dm, Bb, F, C, Dm, Bb, C, A],
    bass: [0, null, null, null, 7, null, null, null, 12, null, null, null, 7, null, null, null],
    arp: 2,
    melody: [
      [74, null, 77, null, 81, null, 77, null],
      [82, null, 81, null, 77, null, 74, null],
      [77, null, 81, null, 84, null, 81, null],
      [79, null, 76, null, 72, null, 76, null],
      [74, null, 77, 81, 86, null, 84, 81],
      [82, null, 81, 77, 74, null, 77, null],
      [79, null, 81, null, 84, null, 79, null],
      [81, null, null, null, 73, null, 76, null],
    ],
    drums: true, kick: [0, 10], snare: [8], hat: [4, 12],
  },
  title: {
    bpm: 92,
    chords: [Am, F, C, G],
    bass: [0, null, null, null, null, null, null, null, 12, null, null, null, null, null, 7, null],
    arp: 2,
    melody: [
      [76, null, null, null, 72, null, null, null],
      [77, null, null, null, 81, null, null, null],
      [79, null, null, null, 76, null, null, null],
      [74, null, null, null, 71, null, 74, null],
    ],
    drums: true, kick: [0, 8], snare: [], hat: [4, 12],
  },
  stage: {
    bpm: 128,
    chords: [Am, F, C, G, Am, F, G, E],
    bass: [0, null, 12, null, 0, null, 12, null, 0, null, 12, null, 0, null, 12, 7],
    arp: 1,
    melody: [
      [76, null, 72, 76, 81, null, 79, 76],
      [77, null, 76, 72, 69, null, 72, 74],
      [76, null, 79, 76, 84, null, 83, 79],
      [74, null, 79, 74, 71, null, 74, 79],
      [81, null, 76, 81, 84, null, 83, 81],
      [84, null, 81, 77, 72, null, 77, 81],
      [83, null, 79, 74, 79, null, 83, 86],
      [83, null, 80, 76, 71, null, 68, null],
    ],
    drums: true, kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14],
  },
  boss: {
    bpm: 152,
    chords: [Am, F, G, E],
    bass: [0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 0, 12, 0, 12],
    arp: 1,
    melody: [
      [69, 72, 76, 72, 81, null, 79, 76],
      [77, null, 76, 74, 72, null, 74, 76],
      [74, 79, 83, 79, 86, null, 83, 79],
      [80, null, 83, 80, 76, null, 71, 68],
    ],
    drums: true, kick: [0, 3, 6, 8, 11, 14], snare: [4, 12], hat: [2, 6, 10, 14],
  },
  cavern: {
    bpm: 120,
    chords: [Em, C, G, D],
    bass: [0, null, null, 12, null, null, 0, null, 0, null, null, 12, null, 7, null, null],
    arp: 1,
    melody: [
      [83, null, 79, null, 76, null, 79, 83],
      [84, null, 79, null, 76, null, 72, null],
      [79, null, 83, 86, 83, null, 79, null],
      [78, null, 74, null, 78, 81, 78, null],
    ],
    drums: true, kick: [0, 6, 8], snare: [4, 12], hat: [2, 6, 10, 14],
  },
  magma: {
    bpm: 146,
    chords: [Dm, Bb, C, A],
    bass: [0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 0, 12, 0, 12],
    arp: 2,
    melody: [
      [74, 74, 77, 74, 81, null, 79, 77],
      [74, null, 70, 74, 77, null, 74, 70],
      [72, 76, 79, 76, 84, null, 79, 76],
      [73, null, 76, 81, 79, null, 76, 73],
    ],
    drums: true, kick: [0, 4, 8, 10, 12], snare: [4, 12], hat: [2, 6, 10, 14],
  },
  tundra: {
    bpm: 100,
    chords: [Am, F, C, Em],
    bass: [0, null, null, null, null, null, 12, null, 0, null, null, null, 7, null, null, null],
    arp: 1,
    melody: [
      [88, null, null, 84, null, null, 81, null],
      [84, null, null, 81, null, null, 77, null],
      [79, null, 84, null, 88, null, 86, null],
      [83, null, null, 79, null, null, 76, null],
    ],
    drums: true, kick: [0, 8], snare: [12], hat: [4, 12],
  },
  void: {
    bpm: 138,
    chords: [Cm, Ab, Eb, G],
    bass: [0, null, 12, 0, null, 12, 0, null, 0, null, 12, 0, null, 12, 7, null],
    arp: 1,
    melody: [
      [72, 75, 79, 75, 84, null, 82, 79],
      [80, null, 79, 75, 72, null, 75, 79],
      [82, null, 79, 75, 87, null, 86, 82],
      [83, null, 79, 74, 71, null, 74, 79],
    ],
    drums: true, kick: [0, 4, 8, 12, 14], snare: [4, 12], hat: [2, 6, 10, 14],
  },
  final: {
    bpm: 164,
    chords: [Am, F, Dm, E],
    bass: [0, 0, 12, 0, 12, 0, 12, 0, 0, 0, 12, 0, 12, 0, 12, 12],
    arp: 1,
    melody: [
      [81, 84, 88, 84, 93, null, 91, 88],
      [89, null, 88, 84, 81, null, 84, 88],
      [86, 89, 93, 89, 98, null, 96, 93],
      [92, null, 95, 92, 88, null, 83, 80],
    ],
    drums: true, kick: [0, 3, 6, 8, 11, 14], snare: [4, 12], hat: [1, 3, 5, 7, 9, 11, 13, 15],
  },
  result: {
    bpm: 120,
    chords: [C, Am, F, G],
    bass: [0, null, null, 12, null, null, 0, null, 0, null, null, 12, null, null, 7, null],
    arp: 2,
    melody: [
      [84, null, 79, null, 76, null, 79, null],
      [81, null, 76, null, 72, null, 76, null],
      [77, null, 81, null, 84, null, 86, null],
      [83, null, 79, null, 74, null, null, null],
    ],
    drums: true, kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14],
  },
};
