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
    this.nodeCount = 0; // 作った音声ノードの数（動作の記録 diag.js 用）
  }

  // iOS は ユーザー操作の中で よばないと 音が でない
  unlock() {
    if (this.ready) {
      // 電話や Siri のあと 'interrupted' のままになることがあるので、動いていなければ再開
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
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
    o.onended = () => { o.disconnect(); g.disconnect(); };
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
  resume() { if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume().catch(() => {}); }

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
    // 鳴り終わったら切り離す（iOS の Safari は、つないだままの音声ノードを解放しないことがあり、メモリが増え続ける）
    o.onended = () => { o.disconnect(); g.disconnect(); };
    this.nodeCount += 2;
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // フルート風：やわらかい正弦波＋倍音、遅れてかかるビブラート、吹き始めの息の音
  flute(freq, dur, { vol = 0.08, when = 0, bus } = {}) {
    if (!this.ready) return;
    const c = this.ctx;
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
    g.connect(bus || this.sfxBus);
    o.onended = () => { for (const x of [o, o2, g2, lfo, lg, g]) x.disconnect(); };
    this.nodeCount += 6;
    for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + dur + 0.05); }
    this.noise(Math.min(0.12, dur), { vol: vol * 0.45, freq: freq * 1.6, q: 1.5, when, bus });
  }

  // 撥弦（古琴・古筝風）：三角波と 1 オクターブ上の正弦波を、はじいてすぐ減衰させる
  pluck(freq, { vol = 0.1, when = 0, bus, dur = 0.7 } = {}) {
    this.tone(freq, dur, { type: 'triangle', vol, when, bus, attack: 0.003 });
    this.tone(freq * 2, dur * 0.45, { type: 'sine', vol: vol * 0.35, when, bus, attack: 0.003 });
  }
  // 鐘（編鐘風）：倍音の比をずらした正弦波を重ねる
  bell(freq, { vol = 0.08, when = 0, bus } = {}) {
    this.tone(freq, 1.3, { type: 'sine', vol, when, bus, attack: 0.004 });
    this.tone(freq * 2.76, 0.5, { type: 'sine', vol: vol * 0.3, when, bus, attack: 0.004 });
    this.tone(freq * 5.4, 0.22, { type: 'sine', vol: vol * 0.12, when, bus, attack: 0.004 });
  }
  // 銅鑼
  gong({ when = 0, bus } = {}) {
    this.tone(72, 1.9, { type: 'sine', vol: 0.3, when, bus, slide: 62, attack: 0.01 });
    this.tone(108, 1.5, { type: 'triangle', vol: 0.06, when, bus, attack: 0.01 });
    this.noise(1.1, { vol: 0.07, freq: 340, q: 2.5, when, bus });
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
    s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
    this.nodeCount += 3;
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------------ SFX
  // 大きい音（爆発・MIRACLE）の重なりを抑える：グループごとに同時に鳴る数の上限を設け、
  // 重なっている数に応じて新しい音を小さくする（戻り値は音量の倍率。0 なら鳴らさない）
  voice(group, max, dur) {
    if (!this.ctx) return 0;
    const now = this.ctx.currentTime;
    const vg = this.vg || (this.vg = {});
    const L = (vg[group] || []).filter((t) => t > now);
    vg[group] = L;
    if (L.length >= max) return 0;
    L.push(now + dur);
    return 1 / (1 + 0.6 * (L.length - 1));
  }

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
  // max：大きい音のグループで同時に鳴らす数の上限（灼熱鉱脈の噴火は 2）
  bomb(force, max = 3) {
    if (!force && !this.throttle('bomb', 90)) return;
    const k = force ? 1 : this.voice('loud', max, 0.7); // アイテムのボムは必ず鳴らす
    if (!k) return;
    this.noise(1.0, { vol: 0.35 * k, freq: 3000, slide: 80, q: 0.5, type: 'lowpass' });
    this.tone(120, 0.8, { type: 'sine', vol: 0.3 * k, slide: 30 });
    this.tone(mtof(96), 0.5, { type: 'triangle', vol: 0.06 * k });
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
    // MIRACLE の音は爆発と同じグループで重なりを抑える（効果そのものは制限しない）
    if (!this.throttle('miracle', 70)) return;
    const k = this.voice('loud', 3, 0.46);
    if (!k) return;
    [84, 88, 91, 96, 100, 103, 108].forEach((n, i) => this.tone(mtof(n), 0.25, { type: 'sine', vol: 0.07 * k, when: i * 0.035 }));
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
  // BOSS モードの 3・2・1
  countdown() {
    this.tone(mtof(84), 0.12, { type: 'square', vol: 0.05 });
    this.tone(mtof(96), 0.18, { type: 'sine', vol: 0.07, when: 0.02 });
  }
  countTick() {
    if (!this.throttle('count', 45)) return;
    this.tone(mtof(96), 0.03, { type: 'square', vol: 0.025 });
  }

  // ------------------------------------------------------------------ BGM
  playBgm(name) {
    // 一度流れた曲は、ジュークボックスで聴けるようにする
    if (TRACKS[name]) (save.seen.bgm || (save.seen.bgm = {}))[name] = true;
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
    // アルペジオ（arpPluck は撥弦の音色）
    if (tr.arp && (s16 % tr.arp === 0)) {
      const idx = Math.floor(step / tr.arp) % 4;
      const n = chord[idx % 3] + (idx === 3 ? 12 : 0) + 12;
      if (tr.arpPluck) this.pluck(mtof(n), { when, bus: b, vol: 0.05, dur: 0.3 });
      else this.tone(mtof(n), 0.09, { type: 'square', vol: 0.045, when, bus: b });
    }
    // 銅鑼（gong 小節ごとの頭）
    if (tr.gong && s16 === 0 && bar % tr.gong === 0) this.gong({ when, bus: b });
    // メロディ（8分）。flute / pluck / bell で音色を変える
    if (s16 % 2 === 0 && tr.melody) {
      const mel = tr.melody[bar];
      const n = mel && mel[s16 / 2];
      if (n && tr.flute) this.flute(mtof(n), tr.noteLen || 0.4, { when, bus: b, vol: 0.09 });
      else if (n && tr.pluck) this.pluck(mtof(n), { when, bus: b, vol: 0.11, dur: tr.noteLen || 0.7 });
      else if (n && tr.bell) this.bell(mtof(n), { when, bus: b, vol: 0.075 });
      else if (n) {
        this.tone(mtof(n), 0.22, { type: 'sawtooth', vol: 0.035, when, bus: b, detune: 6 });
        this.tone(mtof(n), 0.24, { type: 'sine', vol: 0.06, when, bus: b });
      }
    }
    // ドラム
    if (tr.drums) {
      if (tr.kick.includes(s16)) this.tone(tr.kickHz || 150, tr.kickHz ? 0.24 : 0.14, { type: 'sine', vol: 0.5, slide: 40, when, bus: b });
      if (tr.snare.includes(s16)) this.noise(0.13, { vol: 0.22, freq: 1800, q: 0.7, when, bus: b });
      if (tr.hat.includes(s16) || (fever && s16 % 2 === 1)) this.noise(0.035, { vol: 0.09, freq: 9000, type: 'highpass', when, bus: b });
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

const TRACKS = {
  ...TRACKS3,
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

export const audio = new AudioEngine();
