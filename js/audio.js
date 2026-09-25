// =====================================================================
//  オーディオ：ぜんぶ WebAudio で その場で 合成（ファイル不要）
// =====================================================================
import { save } from './save.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// ペンタトニック（ひろうたびに 音が あがっていく ドパミン音階）
const PENTA = [0, 2, 4, 7, 9];

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.last = {};
    this.pickupStep = 0;
    this.pickupT = 0;
    this.bgmTrack = null;
    this.bgmTimer = null;
    this.tempoMul = 1;
  }

  // iOS は ユーザー操作の中で よばないと 音が でない
  unlock() {
    if (this.ready) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      // iOS 17+ のマナーモードでも 音を だす
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch (e) { /* ignore */ }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 6;
    this.master.connect(this.comp).connect(c.destination);
    this.sfxBus = c.createGain();
    this.bgmBus = c.createGain();
    this.sfxBus.connect(this.master);
    this.bgmBus.connect(this.master);
    this.applyVolume();
    // ノイズ
    const len = c.sampleRate;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // 無音を ならして iOS を おこす
    const o = c.createOscillator();
    const g = c.createGain();
    g.gain.value = 0.0001;
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.05);
    this.ready = true;
    if (this.pendingTrack) this.playBgm(this.pendingTrack);
  }

  applyVolume() {
    if (!this.ctx) return;
    this.sfxBus.gain.value = save.settings.sfx * 0.9;
    this.bgmBus.gain.value = save.settings.bgm * 0.45;
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  // 同じ音が 鳴りすぎないように
  throttle(name, gap) {
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < gap) return false;
    this.last[name] = now;
    return true;
  }

  tone(freq, dur, { type = 'sine', vol = 0.2, when = 0, slide = 0, attack = 0.004, bus, detune = 0 } = {}) {
    if (!this.ready) return;
    const c = this.ctx;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.value = detune;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.2, when = 0, freq = 2000, q = 1, type = 'bandpass', slide = 0, bus } = {}) {
    if (!this.ready) return;
    const c = this.ctx;
    const t = c.currentTime + when;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(slide, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(bus || this.sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------------ SFX
  shoot() {
    if (!this.throttle('shoot', 70)) return;
    this.tone(900 + Math.random() * 200, 0.07, { type: 'square', vol: 0.035, slide: 500 });
  }
  hit() {
    if (!this.throttle('hit', 35)) return;
    this.noise(0.05, { vol: 0.12, freq: 2500 + Math.random() * 1500, q: 2 });
  }
  crit() {
    if (!this.throttle('crit', 60)) return;
    this.tone(1800, 0.12, { type: 'triangle', vol: 0.08 });
    this.tone(2700, 0.1, { type: 'sine', vol: 0.05, when: 0.02 });
  }
  kill() {
    if (!this.throttle('kill', 40)) return;
    const f = 500 + Math.random() * 300;
    this.tone(f, 0.12, { type: 'triangle', vol: 0.09, slide: f * 2.2 });
  }
  pickup() {
    if (!this.throttle('pickup', 28)) return;
    const now = performance.now();
    if (now - this.pickupT > 450) this.pickupStep = 0;
    this.pickupT = now;
    const s = this.pickupStep++;
    const oct = Math.floor(s / 5) % 3;
    const note = 76 + PENTA[s % 5] + oct * 12;
    this.tone(mtof(note), 0.09, { type: 'sine', vol: 0.09 });
    this.tone(mtof(note + 12), 0.06, { type: 'triangle', vol: 0.03, when: 0.01 });
  }
  coin() {
    if (!this.throttle('coin', 50)) return;
    this.tone(mtof(83), 0.06, { type: 'square', vol: 0.05 });
    this.tone(mtof(88), 0.22, { type: 'square', vol: 0.05, when: 0.06 });
  }
  heal() {
    [72, 76, 79, 84].forEach((n, i) => this.tone(mtof(n), 0.18, { type: 'sine', vol: 0.08, when: i * 0.05 }));
  }
  hurt() {
    if (!this.throttle('hurt', 120)) return;
    this.tone(220, 0.15, { type: 'sawtooth', vol: 0.08, slide: 90 });
    this.noise(0.12, { vol: 0.15, freq: 600, q: 0.8 });
  }
  levelUp() {
    const seq = [72, 76, 79, 84, 88, 91, 96];
    seq.forEach((n, i) => {
      this.tone(mtof(n), 0.22, { type: 'square', vol: 0.05, when: i * 0.055 });
      this.tone(mtof(n), 0.3, { type: 'sine', vol: 0.08, when: i * 0.055 });
    });
    this.noise(0.6, { vol: 0.05, freq: 8000, type: 'highpass', when: 0.1 });
  }
  select() {
    this.tone(mtof(84), 0.1, { type: 'square', vol: 0.06 });
    this.tone(mtof(91), 0.2, { type: 'square', vol: 0.06, when: 0.07 });
    this.tone(mtof(96), 0.3, { type: 'sine', vol: 0.08, when: 0.14 });
  }
  tap() {
    this.tone(mtof(88), 0.06, { type: 'triangle', vol: 0.08 });
  }
  cardFlip(i = 0) {
    this.tone(mtof(79 + i * 4), 0.08, { type: 'triangle', vol: 0.07 });
    this.noise(0.06, { vol: 0.05, freq: 5000, type: 'highpass' });
  }
  bigWin() {
    // じゃーん！
    const chord = [60, 64, 67, 72, 76, 79, 84];
    chord.forEach((n, i) => this.tone(mtof(n), 1.2, { type: i % 2 ? 'square' : 'sawtooth', vol: 0.035, when: 0.02 * i }));
    [84, 88, 91, 96, 100].forEach((n, i) => this.tone(mtof(n), 0.15, { type: 'sine', vol: 0.08, when: 0.3 + i * 0.07 }));
    this.noise(1.0, { vol: 0.08, freq: 9000, type: 'highpass', when: 0.05 });
  }
  drumroll(dur = 1.2) {
    for (let t = 0; t < dur; t += 0.045) {
      this.noise(0.05, { vol: 0.05 + (t / dur) * 0.12, freq: 1500, q: 1, when: t });
    }
  }
  slotTick(i = 0) {
    if (!this.throttle('slot', 40)) return;
    this.tone(mtof(72 + (i % 12)), 0.05, { type: 'square', vol: 0.04 });
  }
  chestOpen() {
    this.noise(0.3, { vol: 0.2, freq: 400, slide: 4000, q: 1 });
    [67, 72, 76, 79, 84].forEach((n, i) => this.tone(mtof(n), 0.25, { type: 'square', vol: 0.05, when: 0.15 + i * 0.06 }));
  }
  evolve() {
    this.noise(1.2, { vol: 0.15, freq: 200, slide: 9000, q: 2 });
    [60, 67, 72, 79, 84, 91, 96].forEach((n, i) => this.tone(mtof(n), 0.6, { type: 'sawtooth', vol: 0.03, when: 0.4 + i * 0.05 }));
    this.tone(mtof(48), 1.5, { type: 'sine', vol: 0.2, when: 0.4 });
  }
  bomb() {
    this.noise(1.0, { vol: 0.35, freq: 3000, slide: 80, q: 0.5, type: 'lowpass' });
    this.tone(120, 0.8, { type: 'sine', vol: 0.3, slide: 30 });
    this.tone(mtof(96), 0.5, { type: 'triangle', vol: 0.06 });
  }
  thunder() {
    if (!this.throttle('thunder', 90)) return;
    this.noise(0.35, { vol: 0.2, freq: 5000, slide: 300, q: 0.7 });
    this.tone(90, 0.3, { type: 'square', vol: 0.05, slide: 40 });
  }
  whoosh() {
    if (!this.throttle('whoosh', 120)) return;
    this.noise(0.25, { vol: 0.08, freq: 600, slide: 3000, q: 3 });
  }
  splash() {
    if (!this.throttle('splash', 150)) return;
    this.noise(0.4, { vol: 0.12, freq: 1200, slide: 300, q: 1 });
  }
  miracle() {
    [84, 88, 91, 96, 100, 103, 108].forEach((n, i) => this.tone(mtof(n), 0.25, { type: 'sine', vol: 0.07, when: i * 0.035 }));
  }
  jackpot() {
    for (let i = 0; i < 14; i++) this.tone(mtof(i % 2 ? 88 : 83), 0.08, { type: 'square', vol: 0.05, when: i * 0.06 });
    this.bigWin();
  }
  warning() {
    for (let i = 0; i < 3; i++) {
      this.tone(880, 0.35, { type: 'sawtooth', vol: 0.06, slide: 440, when: i * 0.45 });
      this.tone(660, 0.35, { type: 'square', vol: 0.03, slide: 330, when: i * 0.45 });
    }
  }
  fever() {
    [72, 76, 79, 83, 84, 88, 91, 95, 96].forEach((n, i) => this.tone(mtof(n), 0.18, { type: 'square', vol: 0.05, when: i * 0.04 }));
    this.noise(0.8, { vol: 0.08, freq: 400, slide: 12000, q: 2 });
  }
  milestone() {
    [79, 84, 88].forEach((n, i) => this.tone(mtof(n), 0.2, { type: 'square', vol: 0.05, when: i * 0.08 }));
  }
  bossDie() {
    for (let i = 0; i < 6; i++) this.noise(0.5, { vol: 0.2, freq: 800 - i * 100, q: 0.5, type: 'lowpass', when: i * 0.12 });
    this.tone(60, 1.5, { type: 'sine', vol: 0.3, slide: 25 });
  }
  gameOver() {
    [67, 64, 60, 55].forEach((n, i) => this.tone(mtof(n), 0.5, { type: 'triangle', vol: 0.1, when: i * 0.28 }));
  }
  capsule(rank) {
    this.tone(mtof(72 + rank * 5), 0.15, { type: 'square', vol: 0.06 });
    if (rank >= 2) this.bigWin();
  }
  countTick() {
    if (!this.throttle('count', 45)) return;
    this.tone(mtof(96), 0.03, { type: 'square', vol: 0.025 });
  }

  // ------------------------------------------------------------------ BGM
  playBgm(name) {
    if (!this.ready) { this.pendingTrack = name; return; }
    if (this.bgmTrack && this.bgmTrack.name === name) return;
    this.stopBgm();
    const tr = TRACKS[name];
    if (!tr) return;
    this.bgmTrack = { name, ...tr };
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.bgmTimer = setInterval(() => this.schedule(), 25);
  }
  stopBgm() {
    if (this.bgmTimer) clearInterval(this.bgmTimer);
    this.bgmTimer = null;
    this.bgmTrack = null;
  }
  schedule() {
    const tr = this.bgmTrack;
    if (!tr || !this.ctx || this.ctx.state !== 'running') return;
    const stepDur = 60 / (tr.bpm * this.tempoMul) / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.playStep(tr, this.step, this.nextTime - this.ctx.currentTime);
      this.nextTime += stepDur;
      this.step++;
    }
  }
  playStep(tr, step, when) {
    const bars = tr.chords.length;
    const s16 = step % 16;
    const bar = Math.floor(step / 16) % bars;
    const chord = tr.chords[bar];
    const b = this.bgmBus;
    const fever = this.tempoMul > 1.05;
    // ベース
    if (tr.bass[s16] != null) {
      const n = chord[0] - 24 + tr.bass[s16];
      this.tone(mtof(n), 0.16, { type: 'triangle', vol: 0.32, when, bus: b });
    }
    // アルペジオ
    if (tr.arp && (s16 % tr.arp === 0)) {
      const idx = Math.floor(step / tr.arp) % 4;
      const n = chord[idx % 3] + (idx === 3 ? 12 : 0) + 12;
      this.tone(mtof(n), 0.09, { type: 'square', vol: 0.045, when, bus: b });
    }
    // メロディ（8分）
    if (s16 % 2 === 0 && tr.melody) {
      const mel = tr.melody[bar];
      const n = mel && mel[s16 / 2];
      if (n) {
        this.tone(mtof(n), 0.22, { type: 'sawtooth', vol: 0.035, when, bus: b, detune: 6 });
        this.tone(mtof(n), 0.24, { type: 'sine', vol: 0.06, when, bus: b });
      }
    }
    // ドラム
    if (tr.drums) {
      if (tr.kick.includes(s16)) this.tone(150, 0.14, { type: 'sine', vol: 0.5, slide: 40, when, bus: b });
      if (tr.snare.includes(s16)) this.noise(0.13, { vol: 0.22, freq: 1800, q: 0.7, when, bus: b });
      if (tr.hat.includes(s16) || (fever && s16 % 2 === 1)) this.noise(0.035, { vol: 0.09, freq: 9000, type: 'highpass', when, bus: b });
    }
  }
}

// コード（ルートは C4 あたり）
const C = [60, 64, 67], G = [55, 59, 62], Am = [57, 60, 64], F = [53, 57, 60], E = [52, 56, 59];
const Em = [52, 55, 59], D = [50, 54, 57], Dm = [50, 53, 57], Bb = [46, 50, 53], A = [45, 49, 52];
const Cm = [48, 51, 55], Ab = [44, 48, 51], Eb = [51, 55, 58];

const TRACKS = {
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

export const audio = new AudioEngine();
