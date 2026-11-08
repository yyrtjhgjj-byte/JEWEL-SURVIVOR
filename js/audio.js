// =====================================================================
//  オーディオ：ぜんぶ WebAudio で その場で 合成（ファイル不要）
//  BGM は js/chip.js のチップ音源（AudioWorklet）で、js/songs.js の楽譜を鳴らす
// =====================================================================
import { save } from './save.js';
import { SONGS, INST } from './songs.js';

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
    // BGM の音源（AudioWorkletNode か、使えないときの代わり）。曲・速さは port に送る
    this.chip = null;
    this.tempo = 1;
    this.nodeCount = 0; // 作った音声ノードの数（動作の記録 diag.js 用）
    this.samples = new Map(); // 録音した効果音（sample）
  }

  // BGM の速さの倍率（フィーバー中は速くなる）
  get tempoMul() { return this.tempo; }
  set tempoMul(v) {
    if (v === this.tempo) return;
    this.tempo = v;
    if (this.chip) this.chip.port.postMessage({ tempo: v });
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
    this.initChip();
    if (this.pendingTrack) this.playBgm(this.pendingTrack);
  }

  // BGM の音源を用意する。AudioWorklet で動かし、使えなければメインスレッドの ScriptProcessor で同じ音源を動かす
  initChip() {
    const c = this.ctx;
    const ready = (node) => {
      this.chip = node;
      node.port.postMessage({ tempo: this.tempo });
      if (this.bgmTrack) node.port.postMessage({ song: SONGS[this.bgmTrack.name], lib: INST });
    };
    const fallback = () => import('./chip.js').then(({ ChipSynth }) => {
      const syn = new ChipSynth(c.sampleRate);
      const sp = c.createScriptProcessor(2048, 0, 2);
      sp.onaudioprocess = (e) => {
        const o = e.outputBuffer;
        syn.render(o.getChannelData(0), o.getChannelData(1), o.length);
      };
      sp.connect(this.bgmBus);
      ready({ port: { postMessage: (m) => syn.message(m) } });
    }).catch(() => {});
    if (!c.audioWorklet || !window.AudioWorkletNode) { fallback(); return; }
    c.audioWorklet.addModule(new URL('./chip.js', import.meta.url)).then(() => {
      const node = new AudioWorkletNode(c, 'chip', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
      node.port.onmessage = (e) => { if (e.data && e.data.error) console.warn('chip:', e.data.error); };
      node.connect(this.bgmBus);
      ready(node);
    }).catch(fallback);
  }

  applyVolume() {
    if (!this.ctx) return;
    this.sfxBus.gain.value = save.settings.sfx * 0.9;
    this.bgmBus.gain.value = save.settings.bgm * 0.45;
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume().catch(() => {}); }

  // 戦闘中によく鳴る効果音は、1 度だけ録音（OfflineAudioContext）して、あとは録音を 1 つの音声ノードで鳴らす。
  // 合成すると 1 回に 2〜14 個のノードを作るが、録音なら 1 個で済む（終盤は 1 秒に数百のノードを作っていて、
  // iOS で落ちる原因の候補）。音は合成と同じ。録音ができるまでは、その場で合成して鳴らす。
  // key は録音の名前（音の高さなどが違えば別の key）、dur は録音の長さ（秒）、synth(bus, when) は合成
  sample(key, dur, synth) {
    if (!this.ready) return;
    const pool = this.samples;
    const buf = pool.get(key);
    if (buf) {
      const s = this.ctx.createBufferSource();
      s.buffer = buf;
      s.connect(this.sfxBus);
      s.onended = () => s.disconnect();
      this.nodeCount += 1;
      s.start(this.ctx.currentTime);
      return;
    }
    if (!pool.has(key)) this.bake(pool, key, dur, synth);
    synth(this.sfxBus, 0);
  }
  bake(pool, key, dur, synth) {
    pool.set(key, null);
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return;
    let off;
    try { off = new OAC(1, Math.ceil(this.ctx.sampleRate * dur), this.ctx.sampleRate); } catch (e) { return; }
    // 合成の行き先を録音用に差し替えて、同じ合成を 1 回だけ流す
    const keep = [this.ctx, this.sfxBus, this.nodeCount];
    this.ctx = off;
    this.sfxBus = off.destination;
    try { synth(off.destination, 0); } catch (e) { /* 録音できなければ合成のまま */ }
    [this.ctx, this.sfxBus, this.nodeCount] = keep;
    // 録音中に曲が変わっていたら、捨てた方の入れ物に入るだけ（今の曲の録音には混ざらない）
    const done = (b) => { if (b) pool.set(key, b); };
    const p = off.startRendering();
    if (p && p.then) p.then(done).catch(() => {});
    else off.oncomplete = (e) => done(e.renderedBuffer);
  }

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

  // 高さが毎回少し変わる音は、録音を何通りか作って選ぶ
  shoot() {
    if (!this.throttle('shoot', 70)) return;
    this.sample(`shoot${Math.floor(Math.random() * 4)}`, 0.1, () => this.tone(900 + Math.random() * 200, 0.07, { type: 'square', vol: 0.035, slide: 500 }));
  }
  hit() {
    if (!this.throttle('hit', 35)) return;
    this.sample(`hit${Math.floor(Math.random() * 6)}`, 0.08, () => this.noise(0.05, { vol: 0.12, freq: 2500 + Math.random() * 1500, q: 2 }));
  }
  crit() {
    if (!this.throttle('crit', 60)) return;
    this.sample('crit', 0.16, () => {
      this.tone(1800, 0.12, { type: 'triangle', vol: 0.08 });
      this.tone(2700, 0.1, { type: 'sine', vol: 0.05, when: 0.02 });
    });
  }
  kill() {
    if (!this.throttle('kill', 40)) return;
    this.sample(`kill${Math.floor(Math.random() * 6)}`, 0.16, () => {
      const f = 500 + Math.random() * 300;
      this.tone(f, 0.12, { type: 'triangle', vol: 0.09, slide: f * 2.2 });
    });
  }
  pickup() {
    if (!this.throttle('pickup', 28)) return;
    const now = performance.now();
    if (now - this.pickupT > 450) this.pickupStep = 0;
    this.pickupT = now;
    const s = this.pickupStep++;
    const oct = Math.floor(s / 5) % 3;
    const note = 76 + PENTA[s % 5] + oct * 12;
    this.sample(`pickup${note}`, 0.12, () => {
      this.tone(mtof(note), 0.09, { type: 'sine', vol: 0.09 });
      this.tone(mtof(note + 12), 0.06, { type: 'triangle', vol: 0.03, when: 0.01 });
    });
  }
  coin() {
    if (!this.throttle('coin', 50)) return;
    this.sample('coin', 0.32, () => {
      this.tone(mtof(83), 0.06, { type: 'square', vol: 0.05 });
      this.tone(mtof(88), 0.22, { type: 'square', vol: 0.05, when: 0.06 });
    });
  }
  heal() {
    [72, 76, 79, 84].forEach((n, i) => this.tone(mtof(n), 0.18, { type: 'sine', vol: 0.08, when: i * 0.05 }));
  }
  hurt() {
    if (!this.throttle('hurt', 120)) return;
    this.sample('hurt', 0.2, () => {
      this.tone(220, 0.15, { type: 'sawtooth', vol: 0.08, slide: 90 });
      this.noise(0.12, { vol: 0.15, freq: 600, q: 0.8 });
    });
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
    // 重なりで小さくする音量（k）は数通りなので、それぞれ録音する
    this.sample(`bomb${k.toFixed(2)}`, 1.05, () => {
      this.noise(1.0, { vol: 0.35 * k, freq: 3000, slide: 80, q: 0.5, type: 'lowpass' });
      this.tone(120, 0.8, { type: 'sine', vol: 0.3 * k, slide: 30 });
      this.tone(mtof(96), 0.5, { type: 'triangle', vol: 0.06 * k });
    });
  }
  thunder() {
    if (!this.throttle('thunder', 90)) return;
    this.sample('thunder', 0.4, () => {
      this.noise(0.35, { vol: 0.2, freq: 5000, slide: 300, q: 0.7 });
      this.tone(90, 0.3, { type: 'square', vol: 0.05, slide: 40 });
    });
  }
  whoosh() {
    if (!this.throttle('whoosh', 120)) return;
    this.sample('whoosh', 0.3, () => this.noise(0.25, { vol: 0.08, freq: 600, slide: 3000, q: 3 }));
  }
  splash() {
    if (!this.throttle('splash', 150)) return;
    this.sample('splash', 0.45, () => this.noise(0.4, { vol: 0.12, freq: 1200, slide: 300, q: 1 }));
  }
  miracle() {
    // MIRACLE の音は爆発と同じグループで重なりを抑える（効果そのものは制限しない）
    if (!this.throttle('miracle', 70)) return;
    const k = this.voice('loud', 3, 0.46);
    if (!k) return;
    this.sample(`miracle${k.toFixed(2)}`, 0.5, () => [84, 88, 91, 96, 100, 103, 108].forEach((n, i) => this.tone(mtof(n), 0.25, { type: 'sine', vol: 0.07 * k, when: i * 0.035 })));
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
    if (SONGS[name]) (save.seen.bgm || (save.seen.bgm = {}))[name] = true;
    if (!this.ready) { this.pendingTrack = name; return; }
    if (this.bgmTrack && this.bgmTrack.name === name && !this.bgmTrack.old) return;
    if (!SONGS[name]) { this.stopBgm(); return; }
    if (this.old) this.old.stop();
    this.bgmTrack = { name };
    if (this.chip) this.chip.port.postMessage({ song: SONGS[name], lib: INST });
  }
  // 旧曲（ジュークボックスの「旧曲」）。js/bgm-old.js はこのときに読み込む
  playOldBgm(name) {
    if (!this.ready) return;
    this.stopBgm();
    this.bgmTrack = { name, old: true };
    import('./bgm-old.js').then(({ OldBgm }) => {
      const t = this.bgmTrack;
      if (!t || !t.old || t.name !== name) return;
      if (!this.old) this.old = new OldBgm(this);
      this.old.play(name);
    }).catch(() => {});
  }
  stopBgm() {
    this.bgmTrack = null;
    if (this.old) this.old.stop();
    if (this.chip) this.chip.port.postMessage({ stop: true });
  }
}

export const audio = new AudioEngine();
