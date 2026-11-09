// =====================================================================
//  BGM の楽譜（js/chip.js で鳴らす）
//  旋律は MML で手で書き、伴奏（アルペジオ・ベース・持続音）は和音の名前から作る
// =====================================================================

// ---------------------------------------------------------------- 音色
export const INST = {
  // 主旋律（25%・12.5%・50% のパルス）
  lead: { duty: 0.25, env: [14, 15, 14, 13, 12, 12, 11, 11, 10], rel: 4, vib: [16, 5.6, 18] },
  lead12: { duty: 0.125, env: [15, 14, 13, 12, 11, 10, 10, 9], rel: 4, vib: [14, 5.8, 16] },
  lead50: { duty: 0.5, env: [12, 13, 12, 11, 10, 10, 9], rel: 5, vib: [18, 5.2, 20] },
  // 鋭く入って太くなる（金管風）
  brass: { duty: [0.125, 0.125, 0.25, 0.25, 0.5], env: [9, 12, 14, 15, 14, 13, 13, 12], rel: 4, pit: [-0.6, -0.35, -0.15, -0.05, 0], vib: [14, 5.5, 22] },
  // はじく音
  pluck: { duty: 0.25, env: [15, 12, 10, 8, 7, 6, 5, 4, 4, 3, 3, 2, 2, 2, 1, 1, 1, 0], rel: 2 },
  pluck12: { duty: 0.125, env: [15, 12, 10, 8, 7, 6, 5, 4, 4, 3, 3, 2, 2, 2, 1, 1, 1, 0], rel: 2 },
  // 鐘（長く残る。12.5% と 25% を行き来してきらめく）
  bell: { duty: [0.125, 0.25], dl: 0, env: [15, 13, 11, 10, 9, 8, 8, 7, 7, 6, 6, 6, 5, 5, 5, 4, 4, 4, 4, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 0], rel: 8 },
  // 和音の分散
  arp: { duty: 0.25, env: [10, 9, 8, 8, 7, 7, 6], rel: 3 },
  arp12: { duty: 0.125, env: [11, 10, 9, 8, 8, 7], rel: 3 },
  // やわらかい持続音
  pad: { duty: 0.5, env: [2, 4, 5, 6, 7, 8, 8, 8, 9, 9, 9, 9, 8, 8, 8, 8, 8, 7], rel: 10, vib: [10, 4.6, 30] },
  pad25: { duty: 0.25, env: [2, 4, 6, 7, 8, 8, 8, 7], rel: 10, vib: [10, 4.6, 30] },
  // 短く切る和音・刻み
  stab: { duty: 0.5, env: [14, 11, 8, 6, 4, 3, 2, 1, 0], rel: 1 },
  chug: { duty: 0.5, env: [12, 9, 7, 6, 5, 5, 4], rel: 1 },
  // 笛（息で入る）
  flute: { duty: 0.5, env: [5, 8, 10, 11, 12, 12, 11, 11], rel: 5, pit: [-0.5, -0.3, -0.15, -0.05, 0], vib: [22, 5.2, 14] },
  // 竹の笛：下からしゃくり上げる
  bamboo: { duty: [0.5, 0.5, 0.25], dl: 2, env: [6, 9, 11, 12, 12, 11, 11, 10], rel: 6, pit: [-1.2, -0.8, -0.45, -0.2, -0.08, 0], vib: [26, 5, 18] },
  // 琴・琵琶：はじいて少し下がる
  koto: { duty: [0.125, 0.25], dl: 1, env: [15, 13, 11, 9, 8, 7, 6, 5, 5, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1, 0], rel: 3, pit: [0.25, 0.12, 0.04, 0] },
  // 三角波
  bass: { env: [15], rel: 1 },
  bassP: { env: [15, 15, 15, 15, 15, 13, 11, 9, 7, 5, 3, 0], rel: 1 },
  tflute: { env: [15], rel: 3, vib: [20, 5, 16] },
  // のこぎり波
  saw: { env: [13, 12, 11, 11, 10], rel: 3 },
  sawlead: { env: [12, 13, 12, 11, 10, 10, 9], rel: 4, vib: [14, 5.5, 18] },

  // ---- 楽器（第2・3章。チャンネルの type が inst。js/chip.js の楽器の音源の説明を参照）
  // 笛
  fl: { model: 'add', parts: [[1, 1], [2, 0.18], [3, 0.08], [4, 0.03], [5, 0.01]], noise: 0.035, chiff: 0.3, nf: 1, nq: 2.5, env: [0.06, 0.5, 0.88, 0.16], vib: [14, 5.1, 0.3], scoop: [-0.2, 0.05], glide: 0.05, gain: 0.9 },
  // 澄んだ笛（外なる奏者）：倍音をおさえた正弦波に近い音。息の音は吹き始めだけ
  flc: { model: 'add', parts: [[1, 1], [2, 0.14], [3, 0.04], [4, 0.01]], chiff: 0.32, nf: 1.6, nq: 2.5, env: [0.06, 0.5, 0.92, 0.14], vib: [20, 5.2, 0.3], scoop: [-0.15, 0.04], glide: 0.04, gain: 1 },
  afl: { model: 'add', parts: [[1, 1], [2, 0.12], [3, 0.05]], noise: 0.06, chiff: 0.35, nf: 1, nq: 2, env: [0.09, 0.5, 0.85, 0.2], vib: [12, 4.8, 0.35], glide: 0.06, gain: 1 },
  dizi: { model: 'add', parts: [[1, 1], [2, 0.35], [3, 0.28], [4, 0.14], [5, 0.09], [6, 0.05], [7, 0.03]], noise: 0.05, chiff: 0.4, nf: 1.5, nq: 3, env: [0.04, 0.4, 0.88, 0.12], vib: [22, 5.6, 0.2], scoop: [-0.9, 0.09], glide: 0.05, gain: 0.75 },
  xiao: { model: 'add', parts: [[1, 1], [2, 0.1], [3, 0.06]], noise: 0.12, chiff: 0.5, nf: 1, nq: 1.5, env: [0.12, 0.6, 0.85, 0.25], vib: [16, 4.6, 0.35], scoop: [-1.2, 0.14], glide: 0.08, gain: 0.95 },
  theremin: { model: 'add', parts: [[1, 1], [2, 0.08], [3, 0.03]], env: [0.15, 0.5, 0.95, 0.3], vib: [30, 6.2, 0.15], glide: 0.12, gain: 0.9 },
  // 弦
  strings: { model: 'sub', n: 3, det: 14, cut: 2600, kt: 0.35, q: 0.6, env: [0.22, 0.5, 0.9, 0.45], vib: [8, 5.2, 0.3], gain: 1.5 },
  strst: { model: 'sub', n: 3, det: 12, cut: 3000, kt: 0.35, q: 0.6, env: [0.008, 0.22, 0, 0.08], gain: 1.8 },
  violin: { model: 'sub', n: 1, cut: 3500, kt: 0.2, q: 0.8, noise: 0.03, env: [0.06, 0.4, 0.9, 0.18], vib: [24, 5.8, 0.18], scoop: [-0.3, 0.05], glide: 0.06, gain: 1.1 },
  cello: { model: 'sub', n: 1, cut: 1600, kt: 0.3, q: 0.8, noise: 0.02, env: [0.08, 0.4, 0.9, 0.25], vib: [20, 5.2, 0.2], glide: 0.06, gain: 1 },
  erhu: { model: 'sub', n: 1, form: [[750, 2.5, 1], [1600, 3, 0.7], [3200, 4, 0.35]], noise: 0.04, env: [0.05, 0.4, 0.9, 0.15], vib: [30, 6, 0.12], scoop: [-0.6, 0.1], glide: 0.08, gain: 2 },
  // 金管・リード
  horn: { model: 'sub', n: 2, det: 6, cut: 500, kt: 0.5, fenv: [1400, 0.06, 0.35], q: 0.8, env: [0.05, 0.4, 0.85, 0.2], scoop: [-0.4, 0.05], vib: [8, 5, 0.4], gain: 1.4 },
  tpt: { model: 'sub', n: 1, cut: 900, kt: 0.5, fenv: [3200, 0.04, 0.3], q: 0.9, env: [0.025, 0.3, 0.85, 0.12], scoop: [-0.5, 0.04], vib: [14, 5.5, 0.3], gain: 1.1 },
  trb: { model: 'sub', n: 2, det: 5, cut: 450, kt: 0.6, fenv: [1500, 0.05, 0.3], q: 0.8, env: [0.04, 0.4, 0.85, 0.2], gain: 1.4 },
  brs: { model: 'sub', n: 3, det: 10, cut: 700, kt: 0.4, fenv: [2500, 0.04, 0.25], q: 0.7, env: [0.03, 0.3, 0.75, 0.15], gain: 1.6 },
  suona: { model: 'sub', osc: 'pulse', duty: 0.3, n: 1, form: [[1100, 2, 1], [2500, 3, 0.6], [4000, 4, 0.3]], env: [0.03, 0.3, 0.9, 0.1], vib: [26, 6, 0.15], scoop: [-0.8, 0.08], glide: 0.05, gain: 1.4 },
  bando: { model: 'sub', osc: 'pulse', duty: 0.35, n: 2, det: 7, cut: 2400, kt: 0.3, q: 0.7, env: [0.05, 0.3, 0.9, 0.12], trem: [0.12, 6], gain: 0.9 },
  organ: { model: 'add', parts: [[0.5, 0.5], [1, 1], [2, 0.6], [3, 0.35], [4, 0.3], [6, 0.15], [8, 0.1]], env: [0.012, 0.1, 1, 0.08], gain: 0.45 },
  // 合唱（あー・うー）
  cha: { model: 'sub', n: 3, det: 16, form: [[730, 5, 1], [1090, 6, 0.55], [2440, 8, 0.25]], noise: 0.02, env: [0.35, 0.5, 0.9, 0.6], vib: [10, 4.8, 0.4], gain: 3.6 },
  cho: { model: 'sub', n: 3, det: 16, form: [[320, 5, 1], [800, 6, 0.35], [2240, 8, 0.12]], noise: 0.02, env: [0.4, 0.5, 0.9, 0.7], vib: [10, 4.8, 0.4], gain: 3.2 },
  synpad: { model: 'sub', n: 2, det: 10, cut: 900, kt: 0.3, q: 0.6, env: [0.6, 1, 0.85, 1.2], vib: [6, 4, 0.5], gain: 1.5 },
  // はじく弦
  harp: { model: 'ks', bright: 0.55, t60: 3.2, damp: 0.25, pick: 0.12, cut: 6000, rel: 2.5, gain: 1.6 },
  zheng: { model: 'ks', bright: 0.75, t60: 3, damp: 0.18, pick: 0.08, cut: 8000, rel: 1.5, gain: 1.7 },
  pipa: { model: 'ks', bright: 0.9, t60: 1.2, damp: 0.15, pick: 0.1, cut: 9000, rel: 0.4, gain: 1.9 },
  yangqin: { model: 'ks', bright: 0.85, t60: 1.8, damp: 0.2, pick: 0.3, cut: 9000, rel: 1, gain: 2 },
  pizz: { model: 'ks', bright: 0.4, t60: 0.5, damp: 0.4, pick: 0.2, cut: 3500, rel: 0.15, gain: 1.9 },
  cbass: { model: 'ks', bright: 0.15, t60: 1, damp: 0.5, tk: 0.3, cut: 650, rel: 0.2, gain: 1.9 },
  // 第2章の低音は曲ごとに楽器を変える（どの曲も同じコントラバスだと「またこの音」になるため）
  synbass: { model: 'sub', n: 1, cut: 260, kt: 0.5, fenv: [420, 0.05, 0.3], q: 1.1, env: [0.015, 0.5, 0.8, 0.15], glide: 0.04, gain: 1.15 },
  tuba: { model: 'sub', n: 1, cut: 520, kt: 0.5, fenv: [600, 0.05, 0.25], q: 0.8, noise: 0.01, env: [0.035, 0.4, 0.85, 0.12], scoop: [-0.3, 0.04], gain: 1.55 },
  bassoon: { model: 'sub', n: 1, form: [[220, 1.2, 1], [500, 3, 0.8], [1150, 4, 0.35]], noise: 0.015, env: [0.03, 0.3, 0.8, 0.08], vib: [10, 5, 0.3], gain: 1.3 },
  arcobass: { model: 'sub', n: 1, cut: 950, kt: 0.4, fenv: [500, 0.02, 0.15], q: 0.8, noise: 0.03, env: [0.04, 0.35, 0.8, 0.12], scoop: [-0.4, 0.06], gain: 1.3 },
  lostr: { model: 'sub', n: 2, det: 8, cut: 800, kt: 0.4, fenv: [900, 0.01, 0.08], q: 0.7, noise: 0.025, env: [0.006, 0.15, 0.45, 0.06], gain: 2.3 },
  harpsi: { model: 'ks', bright: 0.95, t60: 1.6, damp: 0.08, pick: 0.15, cut: 9000, rel: 0.15, gain: 1.6 },
  guitar: { model: 'ks', bright: 0.5, t60: 2.4, damp: 0.3, pick: 0.18, cut: 5000, rel: 0.3, gain: 1.8 },
  // 鍵盤・打つ音程楽器
  epiano: { model: 'fm', pairs: [[1, 1, 1.6, 0.25, 1.2, 1, 0], [1, 14, 1.1, 0, 0.18, 0.18, 0.5]], env: [0.002, 3.5, 0, 0.35], gain: 0.9 },
  celesta: { model: 'fm', pairs: [[1, 4, 1.3, 0, 0.25, 1, 0]], env: [0.001, 1.6, 0, 0.4], gain: 0.9 },
  glock: { model: 'add', parts: [[1, 1, 1.8], [2.76, 0.35, 0.6], [5.4, 0.15, 0.3], [8.93, 0.05, 0.12]], env: [0.001, 2.2, 0, 0.6], gain: 0.7 },
  vibes: { model: 'add', parts: [[1, 1, 2.5], [4, 0.18, 0.5], [10, 0.03, 0.12]], env: [0.001, 3, 0, 0.7], trem: [0.35, 5.5], gain: 0.9 },
  marimba: { model: 'add', parts: [[1, 1, 0.6], [4, 0.3, 0.12], [10, 0.06, 0.03]], env: [0.001, 0.8, 0, 0.25], gain: 1.1 },
  bianzhong: { model: 'add', parts: [[1, 1, 2.6], [1.19, 0.35, 1.8], [2, 0.5, 1.4], [2.76, 0.3, 0.8], [4.1, 0.15, 0.5], [5.4, 0.08, 0.3]], chiff: 0.15, nf: 4, nq: 1, env: [0.001, 3, 0, 1.2], gain: 0.7 },
  // ガラスの鐘（外なる奏者の分散和音）：やわらかい出だしの正弦波。わずかにずらした 2 本でゆらめかせる（はじく音にしない）
  glass: { model: 'add', parts: [[0.998, 0.6, 2.4], [1.002, 0.6, 2.2], [2, 0.18, 1.1], [3, 0.05, 0.6], [4.2, 0.03, 0.3]], env: [0.018, 2.4, 0, 0.9], gain: 0.65 },
  tubell: { model: 'add', parts: [[1, 1, 3], [2.76, 0.5, 2], [5.4, 0.25, 1.2], [8.93, 0.12, 0.6]], env: [0.001, 3.5, 0, 1.5], gain: 0.65 },
  timp: { model: 'add', parts: [[1, 1, 1.6], [1.5, 0.5, 1.1], [1.98, 0.35, 0.9], [2.44, 0.22, 0.7], [2.97, 0.1, 0.5]], noise: 0, chiff: 0.3, nf: 3, nq: 0.7, env: [0.002, 2, 0, 0.6], gain: 1.1 },
  subbass: { model: 'add', parts: [[1, 1], [2, 0.15]], env: [0.01, 0.3, 0.9, 0.12], gain: 1.2 },
};

// ---------------------------------------------------------------- 和音から伴奏を作る
const NN = ['c', 'c+', 'd', 'd+', 'e', 'f', 'f+', 'g', 'g+', 'a', 'a+', 'b'];
// 高さ（MIDI の番号）→ MML の音（オクターブ付き）
const nm = (m) => `o${Math.floor(m / 12) - 1}${NN[((m % 12) + 12) % 12]}`;
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUAL = {
  '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], mM7: [0, 3, 7, 11],
  m7b5: [0, 3, 6, 10], dim: [0, 3, 6], dim7: [0, 3, 6, 9], aug: [0, 4, 8], sus4: [0, 5, 7], sus2: [0, 2, 7],
  '7sus4': [0, 5, 7, 10], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14],
  M9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14], 9: [0, 4, 7, 10, 14], '7b9': [0, 4, 7, 10, 13], 5: [0, 7],
  'M7#11': [0, 4, 7, 11, 18], 69: [0, 4, 7, 9, 14], m11: [0, 3, 7, 10, 17], '7#9': [0, 4, 7, 10, 15], aug7: [0, 4, 8, 10],
  // 旋律の確かめ用：フリギアの短 2 度・エオリアの短 6 度を含む短三和音
  mb9: [0, 3, 7, 13], mb6: [0, 3, 7, 8],
};
const pcOf = (s) => (PC[s[0]] + (s[1] === '#' ? 1 : s[1] === 'b' ? -1 : 0) + 12) % 12;
export function parseChord(name) {
  const [main, slash] = name.split('/');
  const m = /^([A-G][#b]?)(.*)$/.exec(main);
  if (!m || !(m[2] in QUAL)) throw new Error(`和音 ${name} が読めない`);
  const root = pcOf(m[1]);
  return { root, iv: QUAL[m[2]], bass: slash ? pcOf(slash) : root };
}
// lo 以上の和音の音を下から n 個
function tones(c, lo, n = 10) {
  const pcs = new Set(c.iv.map((x) => (c.root + x) % 12));
  const out = [];
  for (let m = lo; out.length < n; m++) if (pcs.has(m % 12)) out.push(m);
  return out;
}
// 'FM7 Em7 G7sus4,G7' → 小節ごとの和音（, で 1 小節を等分）
const barsOf = (s) => s.trim().split(/\s+/).map((b) => b.split(',').map(parseChord));
export const chordNames = (s) => s.trim().split(/\s+/).map((b) => b.split(','));

// 分散和音。pat は 1 小節ぶんの「下から何番目の音か」（r は休み）。1 小節に 2 つの和音なら pat の前半・後半をそれぞれに使う
export function arp(chords, { lo = 60, pat, len = 16 }) {
  const per = pat.length;
  return barsOf(chords).map((cs) => {
    const k = per / cs.length;
    return pat.map((x, j) => {
      if (x === 'r') return `r${len}`;
      const t = tones(cs[Math.floor(j / k)], lo);
      return `${nm(t[x])}${len}`;
    }).join(' ');
  }).join(' | ') + ' |';
}

// ベース。tpl は 1 小節の型：R 根音  O 1 オクターブ上  F 5 度  T 3 度  S 7 度  L 次の小節の根音へ半音下から  r 休み（後ろに長さ）
// near：前の小節の根音にいちばん近い高さを選ぶ（lo〜hi の中で）
export function bass(chords, tpl, { lo = 33, hi = 52, near = true } = {}) {
  const bs = barsOf(chords);
  const toks = tpl.trim().split(/\s+/).map((t) => {
    const m = /^([RFOTSLr])(\d+\.?)$/.exec(t);
    if (!m) throw new Error(`ベースの型 ${t} が読めない`);
    return { k: m[1], len: m[2] };
  });
  const lenTick = (l) => (192 / parseInt(l, 10)) * (l.endsWith('.') ? 1.5 : 1);
  const total = toks.reduce((a, t) => a + lenTick(t.len), 0);
  let prev = null;
  const place = (pc) => {
    const cand = [];
    for (let m = lo; m <= hi; m++) if (m % 12 === pc) cand.push(m);
    if (!cand.length) return lo + (((pc - lo) % 12) + 12) % 12;
    if (!near || prev === null) return cand[0];
    return cand.reduce((a, b) => (Math.abs(b - prev) < Math.abs(a - prev) ? b : a));
  };
  const roots = bs.map((cs) => cs.map((c) => { const r = place(c.bass); prev = r; return r; }));
  return bs.map((cs, b) => {
    let t = 0;
    return toks.map((tk) => {
      const h = Math.min(cs.length - 1, Math.floor((t / total) * cs.length));
      t += lenTick(tk.len);
      const c = cs[h];
      const R = roots[b][h];
      if (tk.k === 'r') return `r${tk.len}`;
      const up = (x) => R + ((((c.root + x) % 12) - R) % 12 + 12) % 12;
      const fifth = c.iv.includes(7) ? 7 : c.iv.includes(6) ? 6 : c.iv.includes(8) ? 8 : 7;
      const third = c.iv.includes(4) ? 4 : c.iv.includes(3) ? 3 : 5;
      const sev = c.iv.includes(10) ? 10 : c.iv.includes(11) ? 11 : c.iv.includes(9) ? 9 : 12;
      let n = R;
      if (tk.k === 'O') n = R + 12;
      if (tk.k === 'F') n = up(fifth);
      if (tk.k === 'T') n = up(third);
      if (tk.k === 'S') n = up(sev);
      if (tk.k === 'L') {
        const nx = roots[(b + 1) % roots.length][0];
        n = nx - 1;
      }
      return `${nm(n)}${tk.len}`;
    }).join(' ');
  }).join(' | ') + ' |';
}

// 持続音：和音の 3 度か 7 度のうち、前の音にいちばん近いものを lo〜lo+11 から選ぶ（なめらかな内声）
// len は 1 小節の長さ（4 拍子なら '1'、3 拍子なら '2.'）。1 小節に 2 つの和音なら半分ずつ
export function pads(chords, { lo = 64, len = '1', start = null } = {}) {
  let prev = start === null ? lo + 6 : start;
  const half = { 1: '2', '2.': '4.' };
  return barsOf(chords).map((cs) => cs.map((c) => {
    const cand = [];
    for (const x of c.iv) if (x !== 0 && x !== 7) for (let m = lo; m < lo + 12; m++) if (m % 12 === (c.root + x) % 12) cand.push(m);
    if (!cand.length) cand.push(lo + ((c.root - lo) % 12 + 12) % 12);
    cand.sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev));
    prev = cand[0];
    return `${nm(prev)}${cs.length === 1 ? len : half[len]}`;
  }).join(' ')).join(' | ') + ' |';
}

// 和音の塊（楽器のチャンネル）。n 声で、lo から上の形のうち前の和音からいちばん動かないものを選ぶ。
// rh は 1 小節の中の長さの並び（r で始まると休み）、1 小節に 2 つの和音なら rh2 をそれぞれに使う
export function blocks(chords, { lo = 55, n = 3, rh = ['1'], rh2 = ['2'] } = {}) {
  let prev = null;
  const voicing = (c) => {
    let pcs = [...new Set(c.iv.map((x) => (c.root + x) % 12))];
    if (pcs.length > n && pcs.length > 3) pcs = pcs.filter((pc) => pc !== (c.root + 7) % 12);
    const cands = [];
    for (let k = 0; k < pcs.length; k++) {
      let m = lo;
      while (m % 12 !== pcs[k]) m++;
      const v = [m];
      let j = k;
      while (v.length < n) {
        j = (j + 1) % pcs.length;
        let x = v[v.length - 1] + 1;
        while (x % 12 !== pcs[j]) x++;
        v.push(x);
      }
      cands.push(v);
    }
    const cost = (v) => v.reduce((a, x, i) => a + Math.abs(x - prev[Math.min(i, prev.length - 1)]), 0);
    const best = prev ? cands.reduce((a, b) => (cost(b) < cost(a) ? b : a)) : cands[0];
    prev = best;
    return `{${best.map(nm).join(' ')}}`;
  };
  return barsOf(chords).map((cs) => cs.map((c) => {
    const v = voicing(c);
    return (cs.length === 1 ? rh : rh2).map((d) => (d[0] === 'r' ? d : v + d)).join(' ');
  }).join(' ')).join(' | ') + ' |';
}

// よく使う分散の型（1 小節の 16 分音符）
const WAVE = [2, 3, 4, 5, 6, 5, 4, 3, 2, 3, 4, 5, 6, 7, 6, 5];
const RISE = [0, 1, 2, 3, 1, 2, 3, 4, 2, 3, 4, 5, 3, 4, 5, 6];

// ---------------------------------------------------------------- 曲
// chords は小節ごとの和音（旋律の確かめ用。tools/test/chip-check.js）。melody は旋律のチャンネルの id
export const SONGS = {};

// タイトル：宝石の主題。F から半音ずつ下がっていくベースの上に、遠い記憶のような旋律
{
  const intro = 'FM7 FM7 Em7 Em7';
  const A = 'FM7 Em7 Dm7 CM7 BbM7 Am7 AbM7 G7sus4,G7';
  const A2 = 'FM7 Em7 Dm7 CM7 BbM7 Am7 Dm7,G7 C';
  const B = 'Dm7 G7 CM7 FM7 Bm7b5 E7 Am7 A7';
  const C = 'Dm9 Em7 FM7 G7 Em7 Am7 Dm7 G7sus4,G7';
  SONGS.title = {
    bpm: 92,
    melody: 'p1',
    chords: `${intro} ${A} ${A2} ${B} ${C}`,
    ch: [
      { id: 'p1', type: 'pulse', pan: -0.2, echo: [36, 0.35, 0.45], mml: `
        r1 | r1 | r1 | r1 | L
        @lead12 v13
        o5 r8 e8 a8 b8 >c4. <b8 | g4 e4 d8 e4. | r8 d8 a8 b8 >c4. d8 | e4. d8 <b2 |
        >d4. c8 <a+8 a8 f4 | g4. e8 c8 d8 e4 | g2 f8 e-8 c8 e-8 | d4. c8 <b2 |
        o5 r8 e8 a8 b8 >c8 e8 d8 c8 | <b4 g4 e8 d8 e4 | r8 d8 a8 b8 >c8 d8 f8 g8 | e2^8 g8 f8 e8 |
        d4. c8 d8 f8 a8 f8 | e4. d8 c4 <a4 | >c4. d8 <b8 a8 g8 f8 | e2. r4 |
        @lead v12
        o5 r8 d8 f8 a8 >c4 <b8 a8 | b4. a8 g8 f8 d4 | r8 c8 e8 g8 b4 a8 g8 | a4. g8 e8 f8 c4 |
        r8 <b8 >d8 f8 a4 g+8 a8 | b4. a8 g+8 f8 e4 | r8 e8 a8 >c8 e4 d8 c8 | c+2 <a4 g4 |
        @lead v14
        o5 r8 a8 >d8 e8 f4. e8 | d4. e8 d8 c8 <b4 | a4. g8 a8 >c8 e4 | g2 f8 e8 d8 e8 |
        d4. <b8 g4 b4 | >c4. d8 e4 g4 | a2 g4 f4 | f4. e8 d2 |` },
      { id: 'p2', type: 'pulse', pan: 0.25, mml: `
        @arp12 v7 ${arp(intro, { lo: 67, pat: WAVE })} L
        v7 ${arp(A, { lo: 60, pat: WAVE })}
        v7 ${arp(A2, { lo: 67, pat: WAVE })}
        @pluck v9 ${arp(B, { lo: 57, pat: [0, 2, 1, 3, 2, 4, 3, 5], len: 8 })}
        @pad v9 ${pads(C, { lo: 64 })}` },
      { id: 'tri', type: 'tri', mml: `
        @bass ${bass(intro, 'R1', { lo: 40 })} L
        ${bass(A, 'R2. O8 F8', { lo: 31, hi: 50 })}
        ${bass(A2, 'R2. O8 F8', { lo: 31, hi: 50 })}
        ${bass(B, 'R4 O8 R8 F4 O8 F8', { lo: 33, hi: 50 })}
        ${bass(C, 'R8 O8 R8 O8 R8 O8 F8 O8', { lo: 33, hi: 50 })}` },
      { id: 'dr', type: 'drum', mml: `
        r1 | r1 | v5 [z8 z8 z8 z8 z8 z8 z8 z8 |]2 L
        [v11 k8 v6 h8 h8 h8 v9 s8 v6 h8 v11 k8 v6 h8 |]7 v11 k8 v6 h8 h8 h8 v9 s8 s16 s16 v10 t8 m8 |
        [v11 k8 v6 h8 h8 h8 v9 s8 v6 h8 v11 k8 v6 h8 |]7 v11 k8 v6 h8 h8 h8 v10 s8 s8 s8 s16 s16 |
        [v12 k8 v6 h8 v12 k8 v6 h8 v10 s8 v6 h8 v12 k8 v6 o8 |]7 v12 k8 v6 h8 v10 s8 s16 s16 t8 t8 m8 f8 |
        v12 c8 v6 h8 v12 k8 v6 h8 v11 s8 v6 h8 v12 k8 v6 o8 |
        [v12 k8 v6 h8 v12 k8 v6 h8 v11 s8 v6 h8 v12 k8 v6 o8 |]6 v12 k8 v11 s8 s8 s16 s16 v12 s8 t8 m8 f8 |` },
    ],
  };
}

// 黒曜の荒野：乾いた荒野を駆ける。アンダルシア進行に、ギャロップのベース
{
  const intro = 'Am Am Am E';
  const A = 'Am G F E Am G F E7';
  const A2 = 'Am G F E Dm7 E7 F,G A';
  const B = 'C G/B Am Em/G F Fm Em7,A7 Dm7,G7';
  const C = 'F E F E Dm E F E7';
  const gallop = 'R8 R16 R16 O8 R16 R16 R8 R16 R16 F8 R16 R16';
  SONGS.stage = {
    bpm: 128,
    melody: 'p1',
    chords: `${intro} ${A} ${A2} ${B} ${C}`,
    ch: [
      { id: 'p1', type: 'pulse', pan: -0.15, echo: [36, 0.3, 0.4], mml: `
        r1 | r1 | r1 | r1 | L
        @lead v13
        o5 a4. e8 a8 b8 >c4 | <b4. g8 d4 g4 | a4. f8 c8 d8 f4 | e2 g+4 b4 |
        >c4. d8 e4 c4 | d4. <b8 g4 b4 | >c4. <a8 f4 a8 g8 | g+4. a8 b4 >d4 |
        <a4. e8 a8 b8 >c8 d8 | e4 d4 <b4 g4 | a4. f8 c8 d8 f4 | e4. f8 g+4 b4 |
        a4. g8 f8 e8 d4 | g+4. a8 b8 >c8 d4 | c4 <a4 b4 >d4 | c+2. r4 |
        e4. d8 c4 <g4 | >d4. c8 <b4 g4 | a4. b8 >c8 d8 e4 | d4. c8 <b2 |
        a2. g8 a8 | g+2. g8 f8 | e4. g8 >c+4 <a4 | >d4. c8 <b4 g4 |
        a4. g+8 a8 b8 >c4 | <b4. a8 g+8 f8 e4 | a4. g+8 a8 b8 >c8 d8 | e4. d8 c8 <b8 g+4 |
        f4. e8 d8 e8 f8 a8 | g+4. f8 e8 f8 g+8 b8 | >c4. <b8 a8 b8 >c8 d8 | e2. r4 |` },
      { id: 'p2', type: 'pulse', pan: 0.25, mml: `
        @arp v8 ${arp(intro, { lo: 57, pat: [0, 2, 1, 3, 2, 4, 3, 5, 0, 2, 1, 3, 2, 4, 3, 5] })} L
        @pluck v9 ${arp(A, { lo: 57, pat: [0, 1, 2, 3, 2, 1, 2, 3], len: 8 })}
        ${arp(A2, { lo: 57, pat: [0, 1, 2, 3, 2, 1, 2, 3], len: 8 })}
        @pad25 v9 ${pads(B, { lo: 62 })}
        @arp12 v8 ${arp(C, { lo: 57, pat: RISE })}` },
      { id: 'tri', type: 'tri', mml: `
        @bass ${bass(intro, gallop, { lo: 33, hi: 50 })} L
        ${bass(A, gallop, { lo: 33, hi: 50 })}
        ${bass(A2, gallop, { lo: 33, hi: 50 })}
        ${bass(B, 'R8 O8 R8 O8 R8 O8 R8 O8', { lo: 33, hi: 50 })}
        ${bass(C, 'R8 R8 R8 R8 R8 R8 R8 L8', { lo: 36, hi: 50 })}` },
      { id: 'dr', type: 'drum', mml: `
        [k8 h8 h8 h8 k8 h8 h8 h8 |]3 s16 s16 s16 s16 t8 t8 m8 m8 f8 f8 | L
        [[k8 h8 S8 h8 k8 k8 S8 h8 |]7 k8 h8 S8 h8 s16 s16 s16 s16 t8 m8 |]2
        C8 h8 S8 h8 k8 k8 S8 o8 | [k8 h8 S8 h8 k8 k8 S8 o8 |]6 k8 h8 S8 S8 s16 s16 s16 s16 S4 |
        C4 h8 h8 S4 h8 k8 | [K4 h8 h8 S4 h8 k8 |]6 k8 k8 S8 k8 s16 s16 s16 s16 S8 S8 |` },
    ],
  };
}

// 水晶洞窟：水晶の光。5 度で上がるきらめきと、リディアの #11
{
  const intro = 'Em9 Em9 CM7#11 CM7#11';
  const A = 'Em9 CM7#11 Am9 B7sus4,B7 Em9 CM7#11 D6 B7';
  const A2 = 'Em9 CM7#11 Am9 B7sus4,B7 CM7 D6 Bm7 Em9';
  const B = 'CM7 D/C Bm7 Em9 CM7 D/C B7sus4 B7';
  const C = 'Am9 Bm7 CM7 D6 Am9 Bm7 CM7#11 B7';
  SONGS.cavern = {
    bpm: 120,
    melody: 'p1',
    chords: `${intro} ${A} ${A2} ${B} ${C}`,
    ch: [
      { id: 'p1', type: 'pulse', pan: -0.2, echo: [36, 0.38, 0.5], mml: `
        r1 | r1 | r1 | r1 | L
        @lead12 v13
        o5 e8 b8 >f+4 e8 d8 <b4 | >c4. <b8 g4 f+4 | e8 a8 >e4 d8 c8 <b4 | >e2 d+2 |
        <e8 b8 >f+4 g8 f+8 e4 | e4. f+8 g4 b4 | a2 f+4 d4 | d+2. r4 |
        <e8 b8 >f+4 e8 d8 <b4 | >c4. <b8 >e4 d4 | c4. <b8 a4 e4 | e4 f+4 d+2 |
        e4. g8 b4 >e4 | f+4. e8 d4 <a4 | b4. a8 f+4 d4 | e2. r4 |
        @lead50 v12
        g4 b4 >e4. d8 | f+2 e4 d4 | d4. c+8 <b4 a4 | b2 g4 f+4 |
        e4 g4 b4 >e4 | f+4. g8 a4 f+4 | e2 f+4 e4 | d+2 <b4 a4 |
        @bell v13
        o6 b2 e2 | a2 f+2 | g2 e2 | f+2 d2 | e2 c2 | d2 <b2 | >f+2 e2 | d+1 |` },
      { id: 'p2', type: 'pulse', pan: 0.3, mml: `
        @arp12 v7 ${arp(intro, { lo: 64, pat: WAVE })} L
        @arp v7 ${arp(A, { lo: 59, pat: [0, 2, 4, 1, 3, 5, 2, 4, 0, 2, 4, 1, 3, 5, 2, 4] })}
        ${arp(A2, { lo: 59, pat: [0, 2, 4, 1, 3, 5, 2, 4, 0, 2, 4, 1, 3, 5, 2, 4] })}
        @pluck12 v9 ${arp(B, { lo: 55, pat: [0, 1, 2, 3, 4, 3, 2, 1], len: 8 })}
        @arp12 v8 ${arp(C, { lo: 64, pat: RISE })}` },
      { id: 'tri', type: 'tri', mml: `
        @bass ${bass(intro, 'R1', { lo: 40 })} L
        ${bass(A, 'R4. O8 r8 F8 R4', { lo: 35, hi: 52 })}
        ${bass(A2, 'R4. O8 r8 F8 R4', { lo: 35, hi: 52 })}
        ${bass(B, 'R8 R8 O8 R8 F8 R8 O8 F8', { lo: 35, hi: 52 })}
        ${bass(C, 'R2. F4', { lo: 35, hi: 52 })}` },
      { id: 'dr', type: 'drum', mml: `
        r1 | r1 | v6 [z8 z8 z8 z8 z8 z8 z8 z8 |]2 L
        [[v11 k8 v6 z8 h8 z8 v9 s8 v6 z8 h8 z8 |]7 v11 k8 v6 z8 h8 z8 v9 s8 s16 s16 v8 t8 m8 |]2
        [v11 k8 v6 h8 v11 k8 v6 h8 v10 s8 v6 h8 v11 k8 v6 o8 |]7 v11 k8 v10 s8 s8 s16 s16 v11 s8 t8 m8 f8 |
        v12 c4 v6 z4 v10 k4 v6 z4 | [v10 k4 v6 z4 v8 s4 v6 z4 |]6 v10 k4 v8 s8 s8 s8 s8 t8 f8 |` },
    ],
  };
}

// 灼熱鉱脈：煮えたぎる 16 分のベース。最後はナポリの和音（E♭）で熱を上げる
{
  const intro = 'Dm Dm Bb A';
  const A = 'Dm Dm Bb A Dm Dm Gm A7';
  const A2 = 'Dm C Bb A Gm A7 Dm Dm';
  const B = 'Bb C Am Dm Bb C Eb A7';
  const C = 'Dm Eb Dm Eb Gm Eb A A7';
  const drive = 'R16 R16 O16 R16 R16 R16 O16 R16 R16 R16 O16 R16 F16 F16 O16 F16';
  SONGS.magma = {
    bpm: 146,
    melody: 'p1',
    chords: `${intro} ${A} ${A2} ${B} ${C}`,
    ch: [
      { id: 'p1', type: 'pulse', pan: -0.15, echo: [24, 0.28, 0.4], mml: `
        r1 | r1 | r1 | r1 | L
        @brass v14
        o5 d8 e8 f4. e8 d4 | a2. g8 e8 | f8 g8 b-4. a8 g4 | a2. r4 |
        d8 e8 f4. e8 d4 | a4 >d4^8 c8 <a4 | b-4. a8 g8 f8 e4 | c+4. d8 e4 r4 |
        d8 e8 f4. e8 d4 | e8 f8 g4. f8 e4 | f8 g8 b-4. a8 b-4 | >c+2. <a8 b-8 |
        >d4. c8 <b-8 a8 g8 f8 | e4. f8 e8 d8 c+4 | d2. r4 | r4 d8 e8 f8 g8 a8 >c8 |
        d2. c8 d8 | e2 d4 c4 | <a2 b4 >c4 | d2. r4 |
        f2. e8 f8 | g2 f8 e8 d4 | g2. f8 e-8 | f4 e4 c+4 r4 |
        @chug v11
        o4 [d16 d16 a16 d16]4 | [e-16 e-16 b-16 e-16]4 | [d16 d16 a16 d16]4 | [e-16 e-16 b-16 e-16]4 |
        [g16 g16 >d16 <g16]4 | [e-16 e-16 b-16 e-16]4 | [a16 a16 >e16 <a16]4 | a16 a16 >e16 <a16 >g16 e16 c+16 <a16 >c+8 e8 g8 b-8 |` },
      { id: 'p2', type: 'pulse', pan: 0.25, mml: `
        @chug v10 ${bass(intro, drive, { lo: 50, hi: 62 })} L
        @stab v9 ${arp(A, { lo: 62, pat: ['r', 0, 'r', 1, 'r', 2, 'r', 1], len: 8 })}
        ${arp(A2, { lo: 62, pat: ['r', 0, 'r', 1, 'r', 2, 'r', 1], len: 8 })}
        @pad25 v9 ${pads(B, { lo: 62 })}
        @pad v10 ${pads(C, { lo: 67 })}` },
      { id: 'tri', type: 'tri', mml: `
        @bass ${bass(intro, drive, { lo: 38, hi: 50 })} L
        ${bass(A, drive, { lo: 38, hi: 50 })}
        ${bass(A2, drive, { lo: 38, hi: 50 })}
        ${bass(B, 'R8 O8 R8 O8 R8 O8 R8 O8', { lo: 38, hi: 50 })}
        ${bass(C, 'R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16', { lo: 38, hi: 50 })}` },
      { id: 'dr', type: 'drum', mml: `
        [k8 h8 s8 h8 k8 k8 s8 h8 |]3 s16 s16 s16 s16 s16 s16 s16 s16 t16 t16 m16 m16 f16 f16 f16 f16 | L
        [C8 h8 S8 h8 k8 k8 S8 h8 | [k8 h8 S8 h8 k8 k8 S8 h8 |]6 k8 h8 S8 h8 s16 s16 s16 s16 S8 S8 |]2
        [C8 h8 S8 h8 k16 k16 h8 S8 o8 | [k8 h8 S8 h8 k16 k16 h8 S8 o8 |]2 k8 h8 S8 h8 k16 k16 h8 s16 s16 s16 s16 |]2
        [K8 k8 k8 k8 S8 k8 k8 k8 |]7 s16 s16 s16 s16 s16 s16 s16 s16 S8 S8 C4 |` },
    ],
  };
}

// 凍晶氷原：雪のワルツ（3 拍子）。終わりの手前でナポリの和音（B♭）へ寄り道する
{
  const intro = 'Am Am FM7 E';
  const A = 'Am Am/G FM7 E Dm Am/C B7 E7 Am Am/G FM7 Dm7 BbM7 E7 Am Am';
  const B = 'F G Em Am Dm G CM7 E7 F G Em7 A7 Dm E7 Am Am';
  SONGS.tundra = {
    bpm: 126,
    meter: 3,
    melody: 'p1',
    chords: `${intro} ${A} ${B}`,
    ch: [
      { id: 'p1', type: 'pulse', pan: -0.2, echo: [48, 0.35, 0.5], mml: `
        r2. | r2. | r2. | r2. | L
        @lead12 v13
        o5 e2 a4 | b2 >c4 | <b2 a4 | g+2. | f2 a4 | e2 a4 | d+2 f+4 | e2. |
        e2 a4 | b2 >c4 | e2 d4 | c2 <a4 | b-2 a4 | g+2 a8 b8 | a2. | r2. |
        @lead50 v12
        a2 >c4 | d2 <b4 | >e2. | e4 d4 c4 | d2 f4 | f4 e4 d4 | e2. | d2 <b4 |
        >c2 <a4 | b2 >d4 | g2 e4 | c+2 e4 | f2 d4 | <b2 g+4 | a2. | r2. |` },
      { id: 'p2', type: 'pulse', pan: 0.3, mml: `
        @arp12 v7 ${arp(intro, { lo: 64, pat: [0, 1, 2, 3, 4, 3], len: 8 })} L
        @pluck12 v8 ${arp(A, { lo: 60, pat: ['r', 1, 2], len: 4 })}
        @arp v7 ${arp(B, { lo: 62, pat: [0, 1, 2, 3, 2, 1], len: 8 })}` },
      { id: 'tri', type: 'tri', mml: `
        @bass ${bass(intro, 'R2.', { lo: 40 })} L
        ${bass(A, 'R2 F4', { lo: 33, hi: 50 })}
        ${bass(B, 'R4 F4 O4', { lo: 33, hi: 50 })}` },
      { id: 'dr', type: 'drum', mml: `
        [v5 z4 z8 z8 z4 |]4 L
        [v10 k4 v5 h4 h4 |]15 v10 k4 v8 s8 s8 s4 |
        [v10 k4 v6 h4 v8 s4 |]15 v10 k4 s8 s8 t8 f8 |` },
    ],
  };
}

// 虚空聖堂：オルガンのトッカータ（16 分の分散）と、下がっていくベースの上のコラール
{
  const intro = 'Cm Cm Ab G';
  const A = 'Cm G/B Cm/Bb F/A Fm/Ab Cm/G Dm7b5 G7';
  const B = 'Ab Bb Gm Cm Fm7 Bb7 EbM7 G7';
  const C = 'Cm Db Cm Db Bbm Cm Ab G7';
  const toc = [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1];
  SONGS.void = {
    bpm: 138,
    melody: 'p1',
    chords: `${intro} ${A} ${A} ${B} ${C}`,
    ch: [
      { id: 'p1', type: 'pulse', pan: -0.15, echo: [48, 0.3, 0.45], mml: `
        r1 | r1 | r1 | r1 | L
        @lead50 v13
        o5 g4 >c2. | <b4 >d2. | e-2 d4 c4 | f2. e-8 d8 | c2. <a-4 | g2 >c4 e-4 | f2 d4 c4 | <b2. r4 |
        g8 a-8 g8 b8 >c2 | <b8 >c8 <b8 g8 >d2 | e-4. f8 e-8 d8 c4 | f4. g8 f8 e-8 d4 |
        c4 <a-8 b-8 >c8 d8 e-4 | g2 f8 e-8 d4 | f4. e-8 d8 c8 <a-4 | b2. r4 |
        @brass v14
        o6 c4 c8 d8 e-2 | d4 d8 e-8 f2 | g2 f8 e-8 d8 e-8 | c2. r4 |
        <a-4 a-8 b-8 >c2 | <b-4 b-8 >c8 d2 | e-4 e-8 f8 g2 | a-2 g4 f4 |
        @lead50 v13
        o4 g4. a-8 g2 | a-4. b-8 a-2 | g4. a-8 b-4 >c4 | d-2. r4 |
        f4. g-8 f2 | e-4. f8 e-2 | a-4. g8 f8 e-8 c4 | d2 <b2 |` },
      { id: 'p2', type: 'pulse', pan: 0.25, mml: `
        @arp v8 ${arp(intro, { lo: 55, pat: toc })} L
        ${arp(A, { lo: 55, pat: toc })}
        ${arp(A, { lo: 60, pat: toc })}
        ${arp(B, { lo: 60, pat: toc })}
        v9 ${arp(C, { lo: 55, pat: RISE })}` },
      { id: 'tri', type: 'tri', mml: `
        @bass ${bass(intro, 'R2 R2', { lo: 36, hi: 50 })} L
        ${bass(A, 'R2 R2', { lo: 31, hi: 48 })}
        ${bass(A, 'R4 O4 R4 O4', { lo: 31, hi: 48 })}
        ${bass(B, 'R8 O8 R8 O8 R8 O8 R8 O8', { lo: 32, hi: 48 })}
        ${bass(C, 'R4. R8 R4 L4', { lo: 34, hi: 48 })}` },
      { id: 'dr', type: 'drum', mml: `
        r1 | r1 | r1 | r1 | L
        v12 c4 v6 h4 v11 k4 v6 h4 | [v11 k4 v6 h4 v11 k4 v6 h4 |]6 v11 k4 v6 h4 v10 s8 s8 s8 s8 |
        v12 [k8 h8 S8 h8 k8 k8 S8 h8 |]7 k8 h8 S8 h8 s16 s16 s16 s16 t8 f8 |
        C8 h8 S8 h8 k8 k8 S8 o8 | [k8 h8 S8 h8 k8 k8 S8 o8 |]6 k8 h8 S8 S8 S16 S16 S16 S16 S8 S8 |
        [J4 h8 h8 S4 t8 m8 |]7 J8 J8 S8 S8 t8 m8 f8 f8 |` },
    ],
  };
}

// 深海：ゆらゆら揺れる探検ツアー。ドリアの 6 度（B）。旋律はビブラフォン → 笛 → チェロ → 笛とビブラフォンの 2 オクターブ。泡はチェレスタ
{
  const intro = 'Dm7 Em7 Dm7 Em7';
  const A = 'Dm7 Em7 Dm7 Em7 BbM7 Am7 Gm7 A7';
  const A2 = 'Dm7 Em7 Dm7 Em7 BbM7 C7 FM7 A7';
  const B = 'Gm7 C9 FM7 BbM7 Em7b5 A7 Dm7 A7';
  const bubbles = [0, 4, 2, 5, 1, 3, 6, 2, 0, 5, 3, 1, 4, 6, 2, 4];
  const groove = 'R8. R16 r8 O8 F8. F16 r8 O8';
  SONGS.deep = {
    gain: 1.3,
    bpm: 100,
    melody: 'lead',
    chords: `${intro} ${A} ${A2} ${B} ${A}`,
    reverb: { size: 0.85, damp: 0.3 },
    pat: {
      MA: 'o5 f4. e8 f8 a8^4 | g4. f+8 g8 b8^4 | a4. g8 f8 e8 f8 g8 | e2. r4 | f4. e8 f8 a8^4 | >c4. <b8 >c8 e8^4 | d4 c8 <b-8^4 a8 g8 | a2. r4 |',
    },
    ch: [
      { id: 'lead', type: 'inst', pan: -0.15, rev: 0.35, mml: `
        r1 | r1 | r1 | r1 | L
        @vibes v13 $MA
        @fl v12 o5 f4. e8 f8 a8^4 | g4. f+8 g8 b8^4 | >c4. <b8 a8 g8 f8 a8 | g2. r4 | f4 d8 f8^8 a8 g8 f8 | e4. f8 g8 b-8^4 | a4. g8 f8 e8 c4 | c+2. r4 |
        @cello v13 o4 f2. g8 a8 | b-2. a8 g8 | a4 g8 f8^2 | r4 c8 d8 e8 f8 g8 a8 | b-2. a8 g8 | a4 g8 f8^4 e4 | d2. f4 | e4 d8 c+8^2 |
        @fl v12 k12 $MA k0` },
      { id: 'lead2', type: 'inst', pan: 0.25, rev: 0.35, poly: 6, mml: `
        r1 | r1 | r1 | r1 | L
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        @vibes v8 ${blocks(A2, { lo: 60, rh: ['r4', '4', 'r4', '4'], rh2: ['r4', '4'] })}
        @cho v7 ${blocks(B, { lo: 57 })}
        @vibes v10 $MA` },
      { id: 'bub', type: 'inst', pan: 0.4, rev: 0.45, poly: 10, mml: `
        @celesta v8 ${arp(intro, { lo: 74, pat: bubbles })} L
        v6 ${arp(A, { lo: 74, pat: bubbles })}
        ${arp(A2, { lo: 74, pat: bubbles })}
        @harp v9 ${arp(B, { lo: 50, pat: [0, 2, 1, 3, 2, 4, 3, 1], len: 8 })}
        @celesta v6 ${arp(A, { lo: 74, pat: bubbles })}` },
      { id: 'pad', type: 'inst', pan: 0, rev: 0.5, poly: 6, mml: `
        @strings v6 ${blocks(intro, { lo: 53 })} L
        ${blocks(A, { lo: 53 })}
        ${blocks(A2, { lo: 53 })}
        v7 ${blocks(B, { lo: 53 })}
        v7 ${blocks(A, { lo: 55 })}` },
      { id: 'bass', type: 'inst', pan: 0, rev: 0.1, mml: `
        @synbass v12 ${bass(intro, groove, { lo: 38, hi: 52 })} L
        ${bass(A, groove, { lo: 38, hi: 52 })}
        ${bass(A2, groove, { lo: 38, hi: 52 })}
        ${bass(B, 'R4 F8 O8 R4 F8 L8', { lo: 38, hi: 52 })}
        ${bass(A, groove, { lo: 38, hi: 52 })}` },
      { id: 'dr', type: 'perc', pan: 0, rev: 0.2, mml: `
        v6 [z8 z8 z8 z8 z8 z8 z8 z8 |]3 v9 k8. k16 s8 s16 s16 t8 m8 f8 f8 | L
        [[v10 k8. k16 v5 h8 h8 v8 s8 v5 h8 v10 k8 v5 z8 |]7 v10 k8. k16 v8 s8 s16 s16 s8 s8 t8 f8 |]2
        [v10 k4 v5 z8 z8 v7 x4 v5 z8 z8 |]7 v10 k8 v8 s8 s8 s8 s16 s16 s16 s16 s8 s8 |
        [v10 k8. k16 v5 h8 h8 v8 s8 v5 h8 v10 k8 v5 o8 |]7 v10 k8. k16 v8 s8 s16 s16 s8 s8 t8 f8 |` },
    ],
  };
}

// ルルイエ：ゆがんだ遺跡の探検。三全音離れた和音。ホルンの旋律、弦の刻み、ティンパニ、終わりは合唱の詠唱
{
  const intro = 'Em Bb Em Bb';
  const A = 'Em Bb Em Bb CM7 F#7 Am7 B7';
  const A2 = 'Em Bb Gm Db CM7 F#7 Am7 B7';
  const B = 'G Db G Db Eb A Cm B7';
  const C = 'Em Bb Em Bb C F#7 B7sus4 B7';
  const ost = [0, 0, 2, 0, 1, 0, 2, 1];
  SONGS.rlyeh = {
    gain: 1.22,
    bpm: 112,
    melody: ['lead', 'cnt'],
    chords: `${intro} ${A} ${A2} ${B} ${C}`,
    reverb: { size: 0.8, damp: 0.35 },
    ch: [
      { id: 'lead', type: 'inst', pan: -0.15, rev: 0.3, mml: `
        r1 | r1 | r1 | r1 | L
        @horn v13
        o5 r8 e8 g8 a8 b2 | b-4. a8 f2 | r8 e8 g8 a8 b4 >e4 | d4. c8 <b-4 r4 |
        g4 a8 b8 >c4. e8 | e2 d8 c+8 <a+4 | r8 a8 >c8 e8 d4. c8 | <b2. r4 |
        @tpt v12
        r8 e8 g8 a8 b2 | b-4. a8 f4 d4 | r8 d8 g8 a8 b-4. a8 | a-2 f4 r4 |
        r8 e8 g8 b8 >c4. d8 | e4. f+8 e8 d8 c+4 | c4. <b8 a4 g4 | f+2. r4 |
        @strings v13
        o5 b2. a8 g8 | a-2 f4. e-8 | d2. g8 a8 | b-4 a-4 f2 | g2 b-4. >c8 | c+2 <a4 b4 | >c2 <b-4. a-8 | g4 f+2 r4 |
        @cha v12
        o4 b2 g2 | b-2 f2 | b2 >e2 | d2 <b-2 | >c2 e2 | c+2 <a+2 | b1 | b1 |` },
      { id: 'cnt', type: 'inst', pan: 0.25, rev: 0.3, mml: `
        r1 | r1 | r1 | r1 | L
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        @horn v9 o4 e1 | d1 | d1 | d-1 | e1 | f+1 | e1 | d+1 |
        @cha v8 ${pads(B, { lo: 62 })}
        @horn v11 o4 e1 | d1 | e1 | f1 | g1 | f+1 | e1 | d+1 |` },
      { id: 'ost', type: 'inst', pan: 0.35, rev: 0.25, poly: 8, mml: `
        @strst v10 ${arp(intro, { lo: 52, pat: ost, len: 8 })} L
        ${arp(A, { lo: 52, pat: ost, len: 8 })}
        ${arp(A2, { lo: 52, pat: ost, len: 8 })}
        @harp v10 ${arp(B, { lo: 55, pat: RISE })}
        @strst v11 ${arp(C, { lo: 52, pat: ost, len: 8 })}` },
      { id: 'pad', type: 'inst', pan: -0.3, rev: 0.45, poly: 6, mml: `
        @cho v6 ${blocks(intro, { lo: 52 })} L
        ${blocks(A, { lo: 52 })}
        ${blocks(A2, { lo: 52 })}
        @strings v6 ${blocks(B, { lo: 55 })}
        @strings v8 ${blocks(C, { lo: 55 })}` },
      { id: 'bass', type: 'inst', pan: 0, rev: 0.15, mml: `
        @trb v11 ${bass(intro, 'R2. O4', { lo: 34, hi: 50 })} L
        @tuba v12 ${bass(A, 'R8 R8 O8 R8 F8 R8 O8 F8', { lo: 34, hi: 50 })}
        ${bass(A2, 'R8 R8 O8 R8 F8 R8 O8 F8', { lo: 34, hi: 50 })}
        @cello v11 ${bass(B, 'R4. R8 O4 F4', { lo: 34, hi: 50 })}
        @trb v12 ${bass(C, 'R2. O4', { lo: 34, hi: 50 })}` },
      { id: 'timp', type: 'inst', pan: 0.1, rev: 0.3, mml: `
        @timp v12 ${bass(intro, 'R4 R8 R8 R4 r4', { lo: 40, hi: 52 })} L
        ${bass(A, 'R4 r4 R4 r4', { lo: 40, hi: 52 })}
        ${bass(A2, 'R4 r4 R4 r4', { lo: 40, hi: 52 })}
        ${bass(B, 'R4 r2.', { lo: 40, hi: 52 })}
        v13 ${bass(C, 'R8 R8 R4 R4 R4', { lo: 40, hi: 52 })}` },
      { id: 'dr', type: 'perc', pan: 0, rev: 0.2, mml: `
        v10 [s16 s16 s8 s8 s8 s16 s16 s8 s8 s8 |]3 v12 s16 s16 s16 s16 S8 S8 j8 j8 C4 | L
        [[v11 j8 v6 s16 s16 v9 s8 v6 s16 s16 v11 j8 j8 v9 s8 v6 s16 s16 |]7 v11 j8 s16 s16 s8 s8 s16 s16 s16 s16 S8 S8 |]2
        v11 C4 v6 h8 h8 v9 s4 v6 h8 h8 | [v11 j4 v6 h8 h8 v9 s4 v6 h8 h8 |]6 v11 j8 j8 v9 s8 s8 s16 s16 s16 s16 S8 S8 |
        [v12 J4 v8 s8 s8 v12 J4 v8 s16 s16 s8 |]7 v12 j16 j16 j16 j16 s16 s16 s16 s16 S8 S8 C4 |` },
      { id: 'gong', type: 'perc', pan: 0, rev: 0.45, mml: `r1 | r1 | r1 | r1 | L r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 | v10 g1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 | v12 g1 | r1 | r1 | r1 | v10 g1 | r1 | r1 | r1 |` },
    ],
  };
}

// ハリ湖のお茶会：スウィングする優雅なお茶の時間。チェンバロの刻み、ピチカート、歩くベース、ブラシ。
// 笛が旋律、中間部はバイオリン、終わりはバイオリンと笛のオクターブ。ときどき影が差す（短調の iv・減 7 の和音）
{
  const intro = 'FM7 Dm7 Gm7 C7';
  const A = 'FM7 D7 Gm7 C7 Am7 D7 Gm7 C7';
  const A2 = 'FM7 F7 BbM7 Bbm6 Am7 Abdim7 Gm7 C7';
  const B = 'Dm7 G7 CM7 Am7 Dm7 G7 Gm7 C7';
  const swing = ['r6', '12', 'r6', '12', 'r6', '12', 'r6', '12'];
  SONGS.lake = {
    gain: 1.4,
    bpm: 96,
    melody: 'lead',
    chords: `${intro} ${A} ${A2} ${B} ${A}`,
    reverb: { size: 0.6, damp: 0.45 },
    pat: {
      MA: 'o5 c6 d12 e6 f12 a2 | a6 g12 f+6 g12 a4 r4 | d6 e12 f6 g12 b-2 | b-6 a12 g6 a12 b-4 r4 | >c2 <b6 a12 g6 e12 | f+6 g12 a6 >c12^4 <a4 | b-4 a6 g12 f4 d4 | e2 r2 |',
      MA2: 'o5 c6 d12 e6 f12 a2 | >c4 <a6 g12 e-2 | d6 e-12 f6 g12 a2 | f2 e-6 d-12^4 | c6 d12 e6 g12^4 e4 | f6 e12 d6 <b12^2 | >d6 e12 f6 g12 b-4 a4 | g2 r2 |',
    },
    ch: [
      { id: 'lead', type: 'inst', pan: -0.15, rev: 0.25, mml: `
        r1 | r1 | r1 | r1 | L
        @fl v12 $MA
        $MA2
        @violin v13 o5 a2. g6 a12 | b2. a6 b12 | >c2 <b6 a12 g4 | e2 r2 | f6 g12 a6 >c12^2 | <b2 a6 g12 f4 | b-2 a6 g12 f6 d12 | e2 r2 |
        @violin v13 $MA` },
      { id: 'lead2', type: 'inst', pan: 0.3, rev: 0.3, mml: `
        r1 | r1 | r1 | r1 | L
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        @celesta v8 k12 $MA2 k0
        @cello v9 ${pads(B, { lo: 50 })}
        @fl v10 k12 $MA k0` },
      { id: 'harpsi', type: 'inst', pan: 0.35, rev: 0.2, poly: 8, mml: `
        @harpsi v9 ${blocks(intro, { lo: 57, rh: swing, rh2: ['r6', '12', 'r6', '12'] })} L
        ${blocks(A, { lo: 57, rh: swing, rh2: ['r6', '12', 'r6', '12'] })}
        ${blocks(A2, { lo: 57, rh: swing, rh2: ['r6', '12', 'r6', '12'] })}
        @pizz v10 ${arp(B, { lo: 55, pat: [0, 'r', 'r', 2, 'r', 'r', 1, 'r', 'r', 3, 'r', 'r'], len: 12 })}
        @harpsi v9 ${blocks(A, { lo: 57, rh: swing, rh2: ['r6', '12', 'r6', '12'] })}` },
      { id: 'pad', type: 'inst', pan: -0.3, rev: 0.4, poly: 6, mml: `
        @strings v5 ${blocks(intro, { lo: 55 })} L
        ${blocks(A, { lo: 55 })}
        v6 ${blocks(A2, { lo: 55 })}
        v6 ${blocks(B, { lo: 57 })}
        v6 ${blocks(A, { lo: 55 })}` },
      { id: 'bass', type: 'inst', pan: 0, rev: 0.1, mml: `
        @bassoon v12 ${bass(intro, 'R4 T4 F4 L4', { lo: 36, hi: 52 })} L
        ${bass(A, 'R4 T4 F4 L4', { lo: 36, hi: 52 })}
        ${bass(A2, 'R4 T4 F4 L4', { lo: 36, hi: 52 })}
        ${bass(B, 'R4 T4 F4 L4', { lo: 36, hi: 52 })}
        ${bass(A, 'R4 T4 F4 L4', { lo: 36, hi: 52 })}` },
      { id: 'dr', type: 'perc', pan: 0, rev: 0.2, mml: `
        [v8 k4 v5 y6 y12 v7 s4 v5 y6 y12 |]4 L
        [[v8 k4 v5 y6 y12 v7 s4 v5 y6 y12 |]7 v8 k4 v5 y6 y12 v7 s6 s12 s6 s12 |]4` },
    ],
  };
}

// カルコサ：黄衣の王の劇場で踊るタンゴ。半音ずつ下がるベース。バンドネオンの旋律、ピアノのハバネラ、バイオリン
{
  const intro = 'Am E7 Am E7';
  const A = 'Am Am/G F#m7b5 F7 E7 E7 Am E7';
  const A2 = 'Am Am/G F#m7b5 F7 E7 Bb7 Am Am';
  const B = 'Dm G7 CM7 FM7 Bm7b5 E7 Am A7';
  const C = 'Dm Dm/C Bm7b5 Bb7 Am/E E7 Am E7';
  const hab = 'R8. F16 T8 F8 R8. F16 T8 F8';
  const habR = ['8.', '16', '8', '8', '8.', '16', '8', '8'];
  const habR2 = ['8.', '16', '8', '8'];
  SONGS.carcosa = {
    gain: 1.09,
    bpm: 104,
    melody: ['lead', 'cnt'],
    chords: `${intro} ${A} ${A2} ${B} ${C}`,
    reverb: { size: 0.7, damp: 0.4 },
    pat: {
      MC: 'o5 a6 a6 a6 >d2 | c6 <b-6 a6 f2 | a4 b8 >c8 d2 | d6 c6 <b-6 a-2 | a2 >c4. <b8 | b4 a8 g+8^2 | a4. b8 >c8 d8 e4 | d4 c8 <b8^2 |',
    },
    ch: [
      { id: 'lead', type: 'inst', pan: -0.2, rev: 0.25, mml: `
        r1 | r1 | r1 | r1 | L
        @bando v13
        o5 e2. d+8 e8 | >c4. <b8 a8 g+8 a8 b8 | >c2 <a4. e8 | e-2. r4 | g+8. a16 b8 >c8 d4 <b4 | >d4. c8 <b8 a8 g+8 f8 | e2 a4. g+8 | b2. r4 |
        e2. d+8 e8 | >c4. <b8 a8 g+8 a8 b8 | >c2 e4. d8 | e-2. r4 | d8. e16 d8 c8 <b4 g+4 | a-2 f4. d8 | e4 c8 <b8 a2 | r2 r8 >e8 f8 g8 |
        @violin v13
        o5 a4. g8 f2 | g4 f8 e8 f2 | e2. d8 e8 | a2 r4 a8 b8 | >d4. c8 <a2 | g+4 a8 b8 >d4 <b4 | >c2 <a4. e8 | c+2. r4 |
        @violin v14 $MC` },
      { id: 'cnt', type: 'inst', pan: 0.3, rev: 0.3, mml: `
        r1 | r1 | r1 | r1 | L
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        @violin v10 o5 c1 | <b1 | a1 | a1 | b1 | a-1 | >c1 | e1 |
        @bando v9 ${pads(B, { lo: 60 })}
        @bando v11 k-12 $MC k0` },
      { id: 'piano', type: 'inst', pan: 0.2, rev: 0.2, poly: 8, mml: `
        @epiano v10 ${blocks(intro, { lo: 55, rh: habR, rh2: habR2 })} L
        ${blocks(A, { lo: 55, rh: habR, rh2: habR2 })}
        ${blocks(A2, { lo: 55, rh: habR, rh2: habR2 })}
        v9 ${blocks(B, { lo: 57, rh: ['2', '2'], rh2: ['2'] })}
        v11 ${blocks(C, { lo: 55, rh: ['4', '4', '4', '4'], rh2: ['4', '4'] })}` },
      { id: 'pad', type: 'inst', pan: -0.3, rev: 0.4, poly: 6, mml: `
        r1 | r1 | r1 | r1 | L
        @strings v5 ${blocks(A, { lo: 55 })}
        v6 ${blocks(A2, { lo: 55 })}
        v7 ${blocks(B, { lo: 55 })}
        v8 ${blocks(C, { lo: 57 })}` },
      { id: 'bass', type: 'inst', pan: 0, rev: 0.1, mml: `
        @arcobass v13 ${bass(intro, hab, { lo: 33, hi: 50 })} L
        ${bass(A, hab, { lo: 33, hi: 50 })}
        ${bass(A2, hab, { lo: 33, hi: 50 })}
        ${bass(B, hab, { lo: 33, hi: 50 })}
        ${bass(C, 'R8 R8 R8 R8 R8 R8 R8 L8', { lo: 33, hi: 50 })}` },
      { id: 'dr', type: 'perc', pan: 0, rev: 0.15, mml: `
        [v9 k8. v6 b16 v7 b8 v5 b8 v9 k8. k16 v7 b8 v5 b8 |]4 L
        [[v9 k8. v6 b16 v7 b8 v5 b8 v9 k8. k16 v7 b8 v5 b8 |]7 v9 k8. k16 v8 s8 s8 s16 s16 s16 s16 v9 x8 x8 |]4` },
    ],
  };
}

// 宇宙：リディアの和音（C → D/C）が短 3 度ずつ上へ平行移動していく。テルミンの旋律、星のようなチェレスタ、
// 中間部は鉄琴、終わりはホルンと弦で同じ主題を雄大に
{
  const intro = 'Cadd9 D/C Cadd9 D/C';
  const A = 'CM7 D/C EbM7 F/Eb AbM7 Bb/Ab Gsus4 G';
  const A2 = 'CM7 D/C Em7 Am7 FM7 G/F Em7,A7 Dm7,G7';
  const B = 'Am7 Em7 FM7 CM7 Dm7 Em7 FM7 Gsus4,G';
  const star = [0, 1, 2, 3, 4, 3, 2, 1];
  SONGS.space = {
    bpm: 88,
    melody: ['lead', 'lead2'],
    chords: `${intro} ${A} ${A2} ${B} ${A}`,
    reverb: { size: 0.95, damp: 0.25 },
    pat: { MA: 'o5 e2. f+8 g8 | a1 | b-4. a-8 g2 | a4 g4 f2 | >c2. d8 e-8 | f2 d2 | d2 c2 | <b1 |' },
    ch: [
      { id: 'lead', type: 'inst', pan: -0.15, rev: 0.45, mml: `
        r1 | r1 | r1 | r1 | L
        @theremin v12 $MA
        @fl v12 o5 e8 f+8 g8 b8^2 | a4. f+8 d2 | e8 f+8 g8 b8^4 a4 | >c2. r4 | <a8 b8 >c8 e8^2 | d4. <b8 g2 | g4. f+8 e8 g8 >c+4 | d4 c4 <b2 |
        @glock v12 o6 c4. <b8 a8 b8 >c8 e8 | d2 <b2 | a4. g8 f8 g8 a8 >c8 | <b2 g2 | a8 b8 >c8 d8^2 | e4 d8 <b8^2 | >c2 e4. d8 | c2 <b2 |
        @horn v13 k-12 $MA k0` },
      { id: 'lead2', type: 'inst', pan: 0.25, rev: 0.45, mml: `
        r1 | r1 | r1 | r1 | L
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        @cho v8 ${pads(B, { lo: 60 })}
        @strings v11 $MA` },
      { id: 'arp', type: 'inst', pan: 0.4, rev: 0.5, poly: 10, mml: `
        @celesta v8 ${arp(intro, { lo: 67, pat: star, len: 8 })} L
        v7 ${arp(A, { lo: 67, pat: star, len: 8 })}
        @harp v9 ${arp(A2, { lo: 55, pat: RISE })}
        @celesta v7 ${arp(B, { lo: 67, pat: RISE })}
        @harp v10 ${arp(A, { lo: 55, pat: RISE })}` },
      { id: 'pad', type: 'inst', pan: -0.3, rev: 0.6, poly: 6, mml: `
        @cho v7 ${blocks(intro, { lo: 55 })} L
        ${blocks(A, { lo: 55 })}
        @strings v6 ${blocks(A2, { lo: 55 })}
        ${blocks(B, { lo: 55 })}
        @cha v9 ${blocks(A, { lo: 57 })}` },
      { id: 'bass', type: 'inst', pan: 0, rev: 0.2, mml: `
        @subbass v11 ${bass(intro, 'R1', { lo: 36, hi: 50 })} L
        ${bass(A, 'R1', { lo: 32, hi: 48 })}
        @cello v11 ${bass(A2, 'R2 F2', { lo: 33, hi: 50 })}
        @subbass v12 ${bass(B, 'R4. F8 O4 F4', { lo: 33, hi: 50 })}
        @trb v12 ${bass(A, 'R1', { lo: 32, hi: 48 })}` },
      { id: 'timp', type: 'inst', pan: 0.1, rev: 0.4, mml: `
        r1 | r1 | r1 | r1 | L
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        @timp v12 ${bass(A, 'R4 r4 R8 R8 R4', { lo: 40, hi: 52 })}` },
      { id: 'dr', type: 'perc', pan: 0, rev: 0.45, mml: `
        v9 d1 | r1 | v5 [z4 z4 z4 z4 |]2 L
        [v9 d1 | v5 z4 z4 z4 z4 |]4
        [v7 k2 v5 y4 y4 |]8
        [v9 k4 v5 y4 v8 s4 v5 y4 |]7 v9 k4 v8 s8 s8 s8 s16 s16 s4 |
        v11 c4 v6 y4 v9 s4 v6 y4 | [v10 k4 v6 y4 v9 s4 v6 y4 |]6 v10 k4 v9 s8 s8 t8 m8 f4 |` },
      { id: 'gong', type: 'perc', pan: 0, rev: 0.5, mml: `r1 | r1 | r1 | r1 | L v9 g1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 | v8 e1 | r1 | r1 | r1 | v8 e1 | r1 | r1 | r1 | v12 g1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |` },
    ],
  };
}

// 外なる奏者：呪われた笛の単調な調べ（フリギア）。主題は前の曲の笛の旋律。
// 旧曲のように、澄んだ笛と心拍のような太鼓が主役（ユーザーの希望）。笛は残響を少なくして前に出し、伴奏は笛の下に
// （伴奏を小さくしすぎたので、チャンネルの gain で 3〜4 dB 戻してある。ユーザーの指摘）。
// 1 回目は笛と心拍と低い持続音だけ、2 回目はアルトフルートが 4 度下を平行に吹き、ガラスの鐘の分散和音が加わる
// （竪琴ははじく音がアコースティックギターのようで、雰囲気に合わなかった。ユーザーの指摘）
{
  const A = 'Dm Dm Bb A Dm Dm Bb A';
  const B = 'Gm A7 Gm A7 Bb A7 Eb A7';
  const C = 'Dm Eb Dm Eb Dm Eb Bbm A';
  const chk = 'Dmb9,Dmb6 Dmb9 Bbsus4,Bb Asus4,A Dmb6 Dmb6 Bbsus4,Bb A';
  // 心拍（ドクン・ドクン）：1 小節に 2 回
  const beat = 'v13 j8. v9 j16 r4 v13 j8. v9 j16 r4 |';
  SONGS.pipers = {
    gain: 1.12,
    bpm: 80,
    melody: 'fl',
    chords: `Dm Dm ${chk} ${chk} ${B} Dmb6 Eb Dm Eb Dm Eb Bbm A`,
    reverb: { size: 0.8, damp: 0.35 },
    pat: {
      T: 'o5 d4 e-4 d4 <b-4 | >d4 e-4 f4 e-8 d8 | <b-4 a4 b-4 >d4 | c+4 d4 e4 c+4 | a4 b-4 a4 f4 | a4 b-4 >c4 <b-8 a8 | f4 e-4 d4 <b-4 | >c+2 <a2 |',
    },
    ch: [
      { id: 'fl', type: 'inst', pan: 0, rev: 0.12, mml: `
        r1 | r1 | L
        @flc v14 $T $T
        @flc v13 o6 r2 d4. e-8 | c+2 e2 | d2 <b-2 | >c+1 | d2 f2 | e2 c+2 | <b-2 >e-4 d4 | c+2 e4 c+4 |
        @flc v14 o5 [a16 b-16]4 a2 | [b-16 >c16 <]4 b-2 | [a16 b-16]4 >d2 | e-4. d8 c4 <b-4 | a4. g8 f4 d4 | e-4. f8 g4 b-4 | >d-4. c8 <b-4 a-4 | a2. r4 |` },
      { id: 'afl', type: 'inst', pan: 0.3, rev: 0.35, gain: 1.4, mml: `
        r1 | r1 | L
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        @afl v8 k-5 $T k0
        @afl v8 o4 g4. a8 b-4 a4 | g4 f4 e4 c+4 | d4. e-8 f4 g4 | a2 e2 | f4. g8 a4 b-4 | >c+4. <b-8 a4 g4 | g4. f8 e-4 b-4 | a2 >c+2 |
        @afl v7 o4 f1 | g1 | a1 | b-1 | a2 f2 | g2 b-2 | b-2 a-2 | a1 |` },
      { id: 'cho', type: 'inst', pan: 0, rev: 0.55, poly: 6, gain: 1.6, mml: `
        r1 | r1 | L
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        @cho v4 ${blocks(A, { lo: 50 })}
        v5 ${blocks(B, { lo: 50 })}
        @cha v5 ${blocks(C, { lo: 52 })}` },
      { id: 'low', type: 'inst', pan: 0.05, rev: 0.25, gain: 1.6, mml: `
        @cello v6 ${bass('Dm Dm', 'R1', { lo: 38, hi: 50 })} L
        ${bass(A, 'R1', { lo: 38, hi: 50 })}
        ${bass(A, 'R2 R2', { lo: 38, hi: 50 })}
        v7 ${bass(B, 'R2 F2', { lo: 38, hi: 50 })}
        @cbass v8 ${bass(C, 'R4 R4 R4 R4', { lo: 38, hi: 50 })}` },
      { id: 'glass', type: 'inst', pan: 0.35, rev: 0.5, gain: 1.2, mml: `
        r1 | r1 | L
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        @glass v7 ${arp(A, { lo: 50, pat: [0, 1, 2, 3, 4, 3, 2, 1], len: 8 })}
        ${arp(B, { lo: 50, pat: [0, 2, 1, 3, 2, 4, 3, 5], len: 8 })}
        v8 ${arp(C, { lo: 55, pat: RISE })}` },
      // 心拍の太鼓は大きめに（ユーザーの希望）
      { id: 'dr', type: 'perc', pan: 0, rev: 0.2, gain: 1.45, mml: `
        ${beat} ${beat} L
        [${beat}]8
        [${beat}]7 v13 j8. v9 j16 r4 v13 j8. v6 t16 t16 m16 m16 f16 |
        [${beat}]7 v13 j8. v9 j16 r4 v13 j8. v6 t16 t16 m16 m16 f16 |
        [v14 j8. v10 j16 v5 t8 m8 v14 j8. v10 j16 v5 m8 f8 |]7 v14 j16 j16 j16 j16 v8 t16 t16 m16 m16 v12 f8 f8 j8 C8 |` },
      { id: 'gong', type: 'perc', pan: 0, rev: 0.45, gain: 1.4, mml: `v8 g1 | r1 | L [v8 g1 | r1 | r1 | r1 | v6 e1 | r1 | r1 | r1 |]4` },
    ],
  };
}

// 目覚めたアザトース：渦を巻く混沌。三全音と半音ずつ上がる和音。弦と金管の総奏、最後は奏者の笛の主題が狂ったように戻ってくる
{
  const intro = 'Dm Eb Dm Eb';
  const A = 'Dm Eb Dm Ab Dm Eb Bb A7';
  const A2 = 'Dm Eb Dm Ab Gm A7 Dm C#dim7';
  const B = 'Bb C Db Eb Bb C Db A7';
  const C = 'Dm Dm Bb A Dm Dm Bb A';
  const chk = 'Dmb9,Dmb6 Dmb9 Bbsus4,Bb Asus4,A Dmb6 Dmb6 Bbsus4,Bb A';
  const chaos = [0, 3, 1, 4, 2, 5, 3, 6, 0, 3, 1, 4, 2, 5, 3, 6];
  SONGS.azathoth = {
    bpm: 168,
    melody: 'lead',
    chords: `${intro} ${A} ${A2} ${B} ${chk}`,
    reverb: { size: 0.8, damp: 0.4 },
    pat: {
      MA: 'o5 d4 a4 g8 f8 e8 f8 | g2 b-2 | a4 >d4 c8 <b-8 a8 g8 | a-2. r4 | d4 a4 g8 f8 e8 f8 | g4 b-4 >e-2 | d4. c8 <b-8 a8 g8 f8 | e4 f4 e2 |',
      MA2: 'o5 d4 a4 g8 f8 e8 f8 | g2 b-2 | a4 >d4 c8 <b-8 a8 g8 | a-2. r4 | g2 b-4 >d4 | c+2. <a4 | >d2. c+8 d8 | e2. r4 |',
      MB: 'o5 f2. e-8 d8 | g4. f8 e2 | a-2 g-8 f8 e-8 f8 | b-1 | >d2 c4 <b-4 | g2. a8 b-8 | a-2 >d-2 | c+1 |',
      T: 'o5 d4 e-4 d4 <b-4 | >d4 e-4 f4 e-8 d8 | <b-4 a4 b-4 >d4 | c+4 d4 e4 c+4 | a4 b-4 a4 f4 | a4 b-4 >c4 <b-8 a8 | f4 e-4 d4 <b-4 | >c+2 <a2 |',
    },
    ch: [
      { id: 'lead', type: 'inst', pan: -0.15, rev: 0.3, mml: `
        r1 | r1 | r1 | r1 | L
        @strings v13 $MA
        @strings v13 $MA2
        @horn v13 k-12 $MB k0
        @fl v13 k12 $T k0` },
      { id: 'lead2', type: 'inst', pan: 0.25, rev: 0.3, mml: `
        r1 | r1 | r1 | r1 | L
        @tpt v11 k-12 $MA k0
        @tpt v12 k-12 $MA2 k0
        @strings v12 $MB
        @afl v12 $T` },
      { id: 'ost', type: 'inst', pan: 0.35, rev: 0.2, poly: 8, mml: `
        @strst v10 ${arp(intro, { lo: 50, pat: chaos })} L
        ${arp(A, { lo: 50, pat: chaos })}
        ${arp(A2, { lo: 50, pat: chaos })}
        @brs v10 ${blocks(B, { lo: 55, rh: ['r8', '8', 'r8', '8', 'r8', '8', 'r8', '8'] })}
        @strst v11 ${arp(C, { lo: 50, pat: chaos })}` },
      { id: 'pad', type: 'inst', pan: -0.3, rev: 0.45, poly: 6, mml: `
        @cha v8 ${blocks(intro, { lo: 52 })} L
        ${blocks(A, { lo: 52 })}
        ${blocks(A2, { lo: 52 })}
        @strings v7 ${blocks(B, { lo: 55 })}
        @cha v10 ${blocks(C, { lo: 52 })}` },
      { id: 'bass', type: 'inst', pan: 0, rev: 0.1, mml: `
        @trb v12 ${bass(intro, 'R8 O8 R8 O8 R8 O8 R8 O8', { lo: 38, hi: 52 })} L
        ${bass(A, 'R8 O8 R8 O8 R8 O8 R8 O8', { lo: 38, hi: 52 })}
        ${bass(A2, 'R8 O8 R8 O8 R8 O8 R8 O8', { lo: 38, hi: 52 })}
        @cbass v13 ${bass(B, 'R8 R8 O8 R8 R8 O8 R8 L8', { lo: 38, hi: 52 })}
        @trb v13 ${bass(C, 'R8 R8 O8 R8 R8 O8 F8 O8', { lo: 38, hi: 52 })}` },
      { id: 'timp', type: 'inst', pan: 0.1, rev: 0.3, mml: `
        @timp v12 ${bass(intro, 'R8 R8 R8 R8 R4 R4', { lo: 40, hi: 52 })} L
        ${bass(A, 'R4 r4 R4 R4', { lo: 40, hi: 52 })}
        ${bass(A2, 'R4 r4 R4 R4', { lo: 40, hi: 52 })}
        ${bass(B, 'R4 r2.', { lo: 40, hi: 52 })}
        v13 ${bass(C, 'R8 R8 R4 R8 R8 R4', { lo: 40, hi: 52 })}` },
      { id: 'dr', type: 'perc', pan: 0, rev: 0.2, mml: `
        [v12 J8 j8 S8 j8 j8 j8 S8 j8 |]3 v12 s16 s16 s16 s16 s16 s16 s16 s16 t16 t16 m16 m16 f16 f16 f16 f16 | L
        [v12 C8 h8 S8 h8 J8 j8 S8 h8 | [v12 J8 h8 S8 h8 j8 j8 S8 h8 |]6 v12 j8 h8 S8 h8 s16 s16 s16 s16 S8 S8 |]2
        v12 C8 h8 S8 h8 j8 j8 S8 o8 | [v12 J8 h8 S8 h8 j8 j8 S8 o8 |]6 v12 j8 j8 S8 S8 s16 s16 s16 s16 S8 S8 |
        [v12 J8 j8 S8 j8 J8 j8 S8 j8 |]7 v12 s16 s16 s16 s16 s16 s16 s16 s16 C4 S8 S8 |` },
      { id: 'gong', type: 'perc', pan: 0, rev: 0.45, mml: `v11 g1 | r1 | r1 | r1 | L [v12 g1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |]4` },
    ],
  };
}

// 第2章の中ボス：低い弦の刻みと金管。Em に、ナポリの F（♭II）
{
  const intro = 'Em Em';
  const A = 'Em Em C B7 Em Em F B7';
  const B = 'Am Em F C Am Em F B7';
  const C = 'Em F Em F Em F G B7';
  const ost = [0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 3];
  const lowBow = `${bass(intro, 'R8 R8 O8 R8 R8 O8 R8 O8', { lo: 33, hi: 50 })} L
        ${bass(A, 'R8 R8 O8 R8 R8 O8 R8 O8', { lo: 33, hi: 50 })}
        ${bass(A, 'R8 R8 O8 R8 R8 O8 R8 O8', { lo: 33, hi: 50 })}
        ${bass(B, 'R4 O4 R4 O4', { lo: 33, hi: 50 })}
        ${bass(C, 'R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16', { lo: 33, hi: 50 })}`;
  SONGS.boss2 = {
    gain: 1.12,
    bpm: 148,
    melody: 'lead',
    chords: `${intro} ${A} ${A} ${B} ${C}`,
    reverb: { size: 0.7, damp: 0.4 },
    pat: {
      MA: 'o5 e4 g8 a8 b4. a8 | g4 f+8 e8^2 | e4 g8 a8 b4. >c8 | <b2. r4 | e4 g8 a8 b4. >d8 | e2 d8 <b8 g4 | a2. g8 f8 | f+4 e8 d+8^2 |',
      RE: '[e16 f16 e16 g16 e16 f16 e16 b16]2 |',
      RF: '[f16 g16 f16 a16 f16 g16 f16 >c16 <]2 |',
      RG: '[g16 a16 g16 b16 g16 a16 g16 >d16 <]2 |',
      RB: '[b16 >c16 <b16 >d+16 <b16 >c16 <b16 f+16]2 |',
    },
    ch: [
      { id: 'lead', type: 'inst', pan: -0.15, rev: 0.3, mml: `
        r1 | r1 | L
        @tpt v13 $MA
        @strings v13 $MA
        @strings v13 o5 a2 >c4. <b8 | b4 a8 g8^2 | a2 >c4. d8 | e2. r4 | e4. d8 c8 <b8 a4 | g4. a8 b2 | >c2 <a4 f4 | f+2 d+2 |
        @trb v13 o3 e1 | f1 | e1 | f1 | e2 g2 | f2 a2 | g2 b2 | b1 |` },
      { id: 'lead2', type: 'inst', pan: 0.25, rev: 0.3, mml: `
        r1 | r1 | L
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        @horn v12 k-12 $MA k0
        @cha v9 ${pads(B, { lo: 62 })}
        @horn v11 o4 e1 | f1 | g1 | a1 | b1 | a1 | b1 | b1 |` },
      { id: 'ost', type: 'inst', pan: 0.35, rev: 0.2, poly: 8, mml: `
        @strst v11 ${arp(intro, { lo: 40, pat: ost })} L
        ${arp(A, { lo: 40, pat: ost })}
        ${arp(A, { lo: 40, pat: ost })}
        @harp v10 ${arp(B, { lo: 52, pat: RISE })}
        @strst v12 o4 $RE $RF $RE $RF $RE $RF $RG $RB` },
      { id: 'pad', type: 'inst', pan: -0.3, rev: 0.4, poly: 6, mml: `
        @brs v9 ${blocks(intro, { lo: 52, rh: ['4', 'r4', 'r4', '4'] })} L
        ${blocks(A, { lo: 52, rh: ['4', 'r4', 'r4', '4'] })}
        @strings v7 ${blocks(A, { lo: 55 })}
        ${blocks(B, { lo: 55 })}
        @brs v10 ${blocks(C, { lo: 52, rh: ['8', 'r8', 'r4', '8', 'r8', 'r4'] })}` },
      // 低い弦を弓で刻む（コントラバスと、1 オクターブ上のチェロ）
      { id: 'bass', type: 'inst', pan: -0.1, rev: 0.1, mml: `@lostr v13 ${lowBow}` },
      { id: 'vc', type: 'inst', pan: 0.15, rev: 0.12, mml: `@lostr v9 k12 ${lowBow}` },
      { id: 'timp', type: 'inst', pan: 0.1, rev: 0.3, mml: `
        @timp v12 ${bass(intro, 'R8 R8 R4 R8 R8 R4', { lo: 40, hi: 52 })} L
        ${bass(A, 'R4 r2.', { lo: 40, hi: 52 })}
        ${bass(A, 'R4 r4 R4 r4', { lo: 40, hi: 52 })}
        ${bass(B, 'R4 r2.', { lo: 40, hi: 52 })}
        v13 ${bass(C, 'R8 R8 R4 R8 R8 R4', { lo: 40, hi: 52 })}` },
      { id: 'dr', type: 'perc', pan: 0, rev: 0.2, mml: `
        [v12 J8 j8 S8 j8 j16 j16 j8 S8 j8 |]2 L
        [v12 C8 h8 S8 h8 j8 j8 S8 h8 | [v12 J8 h8 S8 h8 j8 j8 S8 h8 |]6 v12 j8 h8 S8 h8 s16 s16 s16 s16 S8 S8 |]2
        v12 C4 h8 h8 S4 h8 j8 | [v12 J4 h8 h8 S4 h8 j8 |]6 v12 j8 j8 S8 j8 s16 s16 s16 s16 S8 S8 |
        [v12 j16 j16 h8 S8 h8 j16 j16 h8 S8 h8 |]7 v12 s16 s16 s16 s16 s16 s16 s16 s16 S8 S8 C4 |` },
    ],
  };
}

// 旧支配者との戦い（第2章の最終ボス）：オルガンと合唱の詠唱。終わりはハンガリー短音階（増 4 度の F#）の主題
{
  const intro = 'Cm Ab F#dim7 G7';
  const A = 'Cm Cm Ab G Cm Cm Db G7';
  const A2 = 'Fm Cm Ab G Fm Cm Db G7';
  const B = 'Eb Bb Cm Ab Eb Bb Ab G7sus4,G7';
  const C = 'Cm F#dim7 Cm F#dim7 Ab G Db G7';
  SONGS.final2 = {
    gain: 0.76,
    bpm: 158,
    melody: 'lead',
    chords: `${intro} ${A} ${A2} ${B} ${C}`,
    reverb: { size: 0.9, damp: 0.35 },
    pat: {
      MA: 'o5 g2. a-8 g8 | f4 e-4 d4 e-4 | c2 e-2 | d1 | g2 a-8 g8 a-8 b-8 | >c2. d4 | d-2. c4 | <b1 |',
      MC: 'o5 c4. d8 e-4. f+8 | a4 f+8 e-8^2 | c4. d8 e-4. f+8 | a4 >c8 e-8^2 | c4. <b-8 a-2 | g4 f+8 g8 b2 | a-2. g8 f8 | g4 a-4 b2 |',
      MB: 'o5 e-4. f8 g2 | f4 d8 f8 b-2 | g2 >c4. <b-8 | a-2. r4 | g4. a-8 b-2 | >d4 c8 <b-8 f2 | a-8 b-8 >c8 e-8^2 | d2 <b2 |',
    },
    ch: [
      { id: 'lead', type: 'inst', pan: -0.15, rev: 0.4, mml: `
        r1 | r1 | r1 | r1 | L
        @cha v14 $MA
        @strings v13 o5 a-4. g8 f8 g8 a-8 b-8 | >c2 <g2 | e-4. f8 g8 a-8 b-8 >c8 | d2. r4 | f4. e-8 d-8 c8 <b-8 a-8 | g2 >c2 | d-4. c8 <b-8 a-8 f4 | g4 a-8 g8 f4 d4 |
        @tpt v13 $MB
        @tpt v14 $MC` },
      { id: 'lead2', type: 'inst', pan: 0.25, rev: 0.4, mml: `
        r1 | r1 | r1 | r1 | L
        @horn v12 k-12 $MA k0
        @cha v9 ${pads(A2, { lo: 62 })}
        @strings v11 k12 $MB k0
        @cha v12 $MC` },
      { id: 'organ', type: 'inst', pan: 0, rev: 0.5, poly: 8, mml: `
        @organ v10 ${blocks(intro, { lo: 52, n: 4 })} L
        ${blocks(A, { lo: 52, n: 4 })}
        v8 ${blocks(A2, { lo: 52, n: 4 })}
        @brs v9 ${blocks(B, { lo: 55, rh: ['4.', '8', 'r4', '4'], rh2: ['4', '4'] })}
        @organ v11 ${blocks(C, { lo: 52, n: 4 })}` },
      { id: 'ost', type: 'inst', pan: 0.35, rev: 0.2, poly: 8, mml: `
        r1 | r1 | r1 | r1 | L
        @strst v10 ${arp(A, { lo: 48, pat: RISE })}
        ${arp(A2, { lo: 48, pat: RISE })}
        @harp v10 ${arp(B, { lo: 55, pat: RISE })}
        @strst v11 ${arp(C, { lo: 48, pat: RISE })}` },
      { id: 'bass', type: 'inst', pan: 0, rev: 0.1, mml: `
        @trb v12 ${bass(intro, 'R1', { lo: 31, hi: 48 })} L
        @cbass v13 ${bass(A, 'R8 R8 O8 R8 R8 O8 R8 O8', { lo: 31, hi: 48 })}
        ${bass(A2, 'R8 R8 O8 R8 R8 O8 R8 O8', { lo: 31, hi: 48 })}
        ${bass(B, 'R4 O4 R4 O4', { lo: 31, hi: 48 })}
        @trb v13 ${bass(C, 'R8 R8 R8 R8 R8 R8 R8 L8', { lo: 31, hi: 48 })}` },
      { id: 'timp', type: 'inst', pan: 0.1, rev: 0.35, mml: `
        @timp v12 ${bass(intro, 'R4 R8 R8 R4 R4', { lo: 40, hi: 52 })} L
        ${bass(A, 'R4 r4 R4 r4', { lo: 40, hi: 52 })}
        ${bass(A2, 'R4 r4 R4 r4', { lo: 40, hi: 52 })}
        ${bass(B, 'R4 r2.', { lo: 40, hi: 52 })}
        v13 ${bass(C, 'R8 R8 R4 R8 R8 R4', { lo: 40, hi: 52 })}` },
      { id: 'dr', type: 'perc', pan: 0, rev: 0.25, mml: `
        [v12 J4 r4 J4 r4 |]3 v12 s16 s16 s16 s16 s16 s16 s16 s16 t8 m8 f8 f8 | L
        [v12 C8 h8 S8 h8 j8 j8 S8 h8 | [v12 J8 h8 S8 h8 j8 j8 S8 h8 |]6 v12 j8 h8 S8 h8 s16 s16 s16 s16 S8 S8 |]2
        v12 C8 h8 S8 h8 j16 j16 h8 S8 o8 | [v12 J8 h8 S8 h8 j16 j16 h8 S8 o8 |]6 v12 j8 j8 S8 S8 s16 s16 s16 s16 S8 S8 |
        v12 C8 h8 S8 h8 j8 j8 S8 o8 | [v12 J8 h8 S8 h8 j8 j8 S8 o8 |]6 v12 j8 h8 S8 S8 s16 s16 s16 s16 t8 f8 |` },
      { id: 'gong', type: 'perc', pan: 0, rev: 0.5, mml: `v11 g1 | r1 | r1 | r1 | L [v12 g1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |]4` },
    ],
  };
}

// 第3章の銅鑼（4 小節ごと。n は小節の数）
const gongs = (n, every = 4) => `[v13 g1 | ${'r1 | '.repeat(every - 1)}]${n / every}`;

// 窮奇：北の果ての北風。竹笛（笛子）・古筝・二胡・琵琶と、大太鼓・木魚・銅鑼
{
  const intro = 'Dm Dm C C';
  const A = 'Dm C Dm Am Dm C Bb A';
  const A2 = 'Dm C Dm Am F C Gm A';
  const B = 'F C Dm Am Bb F Gm A';
  const C = 'Dm C Dm C Bb C Dm A';
  const trem = [3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1];
  SONGS.yushu = {
    bpm: 132,
    melody: ['dizi', 'erhu'],
    chords: `${intro} ${A} ${A2} ${B} ${C}`,
    reverb: { size: 0.8, damp: 0.4 },
    ch: [
      { id: 'dizi', type: 'inst', pan: -0.2, rev: 0.3, mml: `
        r1 | r1 | r1 | r1 | L
        @dizi v13
        o5 a4. g8 a8 >c8 <a4 | g4 e8 g8^2 | d4. f8 g8 a8 f8 d8 | e2. r4 | a4. >c8 d8 f8 d4 | e4 d8 c8^2 | <b-2 a8 g8 f8 g8 | a2. r4 |
        a4. g8 a8 >c8 <a4 | g4 e8 g8^2 | a4 >c8 d8^8 c8 <a4 | >c4 <a8 g8 e2 | f4. g8 a8 >c8 <a4 | g4 e8 c8^2 | d4. f8 g8 b-8 a8 g8 | a2. r4 |
        r1 | r1 | r1 | r2 o6 c4 <a4 | r1 | r1 | r1 | r2 a4 >c+4 |
        o5 d16 f16 g16 a16 >c16 d16 c16 <a16 >d2 | e4 d8 c8^2 |
        <a16 >c16 d16 f16 g16 f16 d16 c16 <a2 | g4 e8 g8^2 |
        f4. g8 f8 d8 c8 d8 | e2 g4. a8 | a4 >c8 d8^8 f8 e8 d8 | c+2. r4 |` },
      { id: 'erhu', type: 'inst', pan: 0.25, rev: 0.3, mml: `
        r1 | r1 | r1 | r1 | L
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        @erhu v11 o4 a2 f2 | g2 e2 | f2 a2 | e1 | f2 a2 | g1 | g2 b-2 | a1 |
        v13 o5 a2. g8 f8 | g2 e4. d8 | d4 f8 g8 a2 | e2 r2 | f2. d8 f8 | a2 >c4. <a8 | g4 b-8 a8^4 g4 | e2 r2 |
        v11 o4 a1 | g1 | a1 | g1 | f1 | e1 | f1 | e1 |` },
      { id: 'zheng', type: 'inst', pan: 0.35, rev: 0.25, poly: 10, mml: `
        @zheng v10 ${arp(intro, { lo: 62, pat: WAVE })} L
        v9 ${arp(A, { lo: 57, pat: WAVE })}
        ${arp(A2, { lo: 57, pat: WAVE })}
        ${arp(B, { lo: 57, pat: [0, 2, 1, 3, 2, 4, 3, 1], len: 8 })}
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |` },
      { id: 'pipa', type: 'inst', pan: -0.35, rev: 0.2, poly: 6, mml: `
        r1 | r1 | r1 | r1 | L
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        @pipa v9 ${arp(B, { lo: 55, pat: ['r', 0, 'r', 1, 'r', 2, 'r', 1], len: 8 })}
        v10 ${arp(C, { lo: 62, pat: trem, len: 32 })}` },
      { id: 'str', type: 'inst', pan: 0, rev: 0.45, poly: 6, mml: `
        r1 | r1 | @strings v7 ${blocks('C C', { lo: 55 })} L
        ${blocks(A, { lo: 55 })}
        v8 ${blocks(A2, { lo: 55 })}
        v9 ${blocks(B, { lo: 55 })}
        v10 ${blocks(C, { lo: 57 })}` },
      { id: 'bass', type: 'inst', pan: 0, rev: 0.1, mml: `
        @cbass v12 ${bass(intro, 'R2 R2', { lo: 38, hi: 52 })} L
        ${bass(A, 'R4 O8 R8 F4 O8 R8', { lo: 38, hi: 52 })}
        ${bass(A2, 'R4 O8 R8 F4 O8 R8', { lo: 38, hi: 52 })}
        ${bass(B, 'R4 O8 R8 F4 O8 R8', { lo: 38, hi: 52 })}
        ${bass(C, 'R8 O8 R8 O8 R8 O8 R8 O8', { lo: 38, hi: 52 })}` },
      { id: 'dr', type: 'perc', pan: 0, rev: 0.2, mml: `
        v6 [z8 z8 z8 z8 z8 z8 z8 z8 |]3 v11 s16 s16 s16 s16 j8 j8 J4 C4 | L
        [[v12 J8 v7 b8 v10 s8 v7 b8 v12 j8 j8 v10 s8 v7 b8 |]7 v12 j8 b8 s8 s8 s16 s16 s16 s16 J8 C8 |]2
        [v12 J4 v8 b8 b8 v11 S4 v8 b8 j8 |]7 v12 j8 j8 S8 S8 s16 s16 s16 s16 J8 C8 |
        [v12 J8 j8 S8 j8 J8 j8 S8 v9 u8 |]7 v12 J8 J8 S8 S8 s16 s16 s16 s16 J8 C8 |` },
      { id: 'gong', type: 'perc', pan: 0, rev: 0.4, mml: `v12 g1 | r1 | r1 | r1 | L [v12 g1 | r1 | r1 | r1 |]8` },
    ],
  };
}

// 檮杌：天にあふれる洪水。重い太鼓。旋律は古筝 → 二胡 → 簫（低い縦笛）→ 二胡と簫の二重奏
{
  const intro = 'Em Em C D';
  const A = 'Em Em C D Em G Am B';
  const A2 = 'Em Em C D C D Em Em';
  const B = 'Am Em Am Em C D B7sus4 B7';
  const C = 'Em Em D D C C B7 B7';
  const tpl = 'R4. R8 r8 R8 O4';
  SONGS.uzan = {
    bpm: 118,
    melody: ['lead', 'lead2'],
    chords: `${intro} ${A} ${A2} ${B} ${C}`,
    reverb: { size: 0.8, damp: 0.4 },
    ch: [
      { id: 'lead', type: 'inst', pan: -0.2, rev: 0.3, mml: `
        r1 | r1 | r1 | r1 | L
        @zheng v14
        o5 e8 g8 a8 b8^4 a8 g8 | e2 r8 d8 e8 g8 | a4. g8 e8 g8 a8 >c8 | <b4 a8 f+8^2 | e8 g8 a8 b8^4 >d8 e8 | d4. <b8 a8 g8 e8 d8 | e8 g8 a8 >c8^4 <b8 a8 | b2. r4 |
        @erhu v13
        o5 b2 a8 g8 e8 g8 | a4. b8 g2 | g4 e8 g8 >c2 | <b8 a8 f+2. | g2 >c4. d8 | e4 d8 <a8^2 | b4. a8 g8 a8 g8 d8 | e2. r4 |
        @xiao v13
        o4 a4. b8 >c2 | <b4 g8 a8 b2 | >c4. d8 e2 | d4 <b8 a8 g2 | g2. a8 b8 | >c4. <a8 f+2 | e2. f+8 e8 | d+2. r4 |
        @erhu v13
        o5 b1 | a2 g2 | f+1 | a2 f+2 | g1 | e2 c2 | d+1 | f+2 b2 |` },
      { id: 'lead2', type: 'inst', pan: 0.25, rev: 0.35, mml: `
        r1 | r1 | r1 | r1 | L
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        @xiao v11 o4 g1 | f+2 e2 | a1 | f+2 a2 | e1 | g2 e2 | f+1 | d+2 f+2 |` },
      { id: 'acc', type: 'inst', pan: 0.35, rev: 0.25, poly: 10, mml: `
        @zheng v10 ${arp(intro, { lo: 52, pat: WAVE })} L
        @pipa v9 ${arp(A, { lo: 52, pat: [0, 1, 2, 3, 2, 1, 2, 3], len: 8 })}
        @zheng v9 ${arp(A2, { lo: 52, pat: WAVE })}
        ${arp(B, { lo: 52, pat: [0, 1, 2, 3, 2, 1, 2, 3], len: 8 })}
        v10 ${arp(C, { lo: 57, pat: RISE })}` },
      { id: 'pad', type: 'inst', pan: -0.3, rev: 0.5, poly: 6, mml: `
        @strings v7 ${blocks(intro, { lo: 47 })} L
        v5 ${blocks(A, { lo: 52 })}
        v7 ${blocks(A2, { lo: 52 })}
        v8 ${blocks(B, { lo: 52 })}
        v9 ${blocks(C, { lo: 52 })}` },
      { id: 'bass', type: 'inst', pan: 0, rev: 0.15, mml: `
        @cbass v13 ${bass(intro, tpl, { lo: 35, hi: 50 })} L
        ${bass(A, tpl, { lo: 35, hi: 50 })}
        ${bass(A2, tpl, { lo: 35, hi: 50 })}
        @cello v11 ${bass(B, 'R2 F2', { lo: 35, hi: 50 })}
        @cbass v13 ${bass(C, tpl, { lo: 35, hi: 50 })}` },
      { id: 'dr', type: 'perc', pan: 0, rev: 0.25, mml: `
        [v12 J4 r4 v9 t4 m4 |]3 v12 J8 J8 S8 S8 t8 m8 f8 f8 | L
        [[v12 J4 r8 j8 r8 j8 S4 |]7 v12 J8 j8 S8 S8 s16 s16 s16 s16 t8 f8 |]2
        [v12 J8 j8 j8 r8 S4 j8 j8 |]7 v12 J8 j8 S8 S8 s16 s16 s16 s16 S8 S8 |
        [v12 J8 J8 S8 j8 J8 j8 S8 S8 |]7 v12 J8 J8 S8 S8 J8 S8 S8 S8 |` },
      { id: 'gong', type: 'perc', pan: 0, rev: 0.45, mml: `r1 | r1 | r1 | r1 | L ${gongs(32)}` },
    ],
  };
}

// 饕餮：青銅の祭器を打つ。旋律は編鐘（青銅の鐘）→ 簫 → 二胡 → 編鐘と簫。揚琴と古筝が分散和音
{
  const intro = 'Am Am F G';
  const A = 'Am Am F G Am Em F E';
  const A2 = 'Am Am F G C G F E';
  const B = 'F G Em Am Dm G C E7';
  const C = 'Am F Am F Dm E Am E';
  const tpl = 'R4 r8 R8 F4 O4';
  SONGS.sanki = {
    gain: 1.25,
    bpm: 104,
    melody: ['lead', 'lead2'],
    chords: `${intro} ${A} ${A2} ${B} ${C}`,
    reverb: { size: 0.85, damp: 0.35 },
    ch: [
      { id: 'lead', type: 'inst', pan: -0.2, rev: 0.4, mml: `
        r1 | r1 | r1 | r1 | L
        @bianzhong v14
        o5 e4. d8 c8 d8 e4 | a2. g8 e8 | f4. e8 c8 d8 f4 | g2. r4 | a4. g8 e8 g8 a4 | b4. a8 g2 | a4 >c4 <a8 g8 f4 | e2. r4 |
        @xiao v13
        o5 c4 d8 e8^2 | a4. g8 e2 | c4 d8 f8^2 | g4. a8 b2 | >c2 <b8 a8 g4 | a4 g8 e8^4 d4 | c4. d8 c8 <a8 f4 | g+2. r4 |
        @erhu v13
        o5 a2. g8 f8 | g4. a8 b2 | >e4 d8 <b8^2 | a2. r4 | f2. e8 d8 | d4. e8 g2 | >c4 <b8 g8^2 | g+2. r4 |
        @bianzhong v14
        o5 a2. g8 e8 | f2. e8 c8 | e2 d4 c4 | <a1 | >d4 f4 a2 | g+4. a8 b2 | >c4. <b8 a2 | g+1 |` },
      { id: 'lead2', type: 'inst', pan: 0.25, rev: 0.4, mml: `
        r1 | r1 | r1 | r1 | L
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        @xiao v11 o4 e1 | a1 | >c1 | c1 | d1 | <b1 | >c1 | <b1 |` },
      { id: 'acc', type: 'inst', pan: 0.35, rev: 0.3, poly: 10, mml: `
        @yangqin v9 ${arp(intro, { lo: 57, pat: [0, 1, 2, 3, 2, 1, 2, 3], len: 8 })} L
        ${arp(A, { lo: 57, pat: [0, 1, 2, 3, 2, 1, 2, 3], len: 8 })}
        ${arp(A2, { lo: 57, pat: [0, 1, 2, 3, 2, 1, 2, 3], len: 8 })}
        @zheng v9 ${arp(B, { lo: 57, pat: WAVE })}
        ${arp(C, { lo: 57, pat: RISE })}` },
      { id: 'pad', type: 'inst', pan: -0.3, rev: 0.5, poly: 6, mml: `
        @strings v6 ${blocks(intro, { lo: 52 })} L
        v5 ${blocks(A, { lo: 52 })}
        v6 ${blocks(A2, { lo: 52 })}
        v7 ${blocks(B, { lo: 52 })}
        v7 ${blocks(C, { lo: 52 })}` },
      { id: 'bass', type: 'inst', pan: 0, rev: 0.15, mml: `
        @cbass v12 ${bass(intro, tpl, { lo: 33, hi: 50 })} L
        ${bass(A, tpl, { lo: 33, hi: 50 })}
        ${bass(A2, tpl, { lo: 33, hi: 50 })}
        ${bass(B, tpl, { lo: 33, hi: 50 })}
        @cello v11 ${bass(C, 'R2 F4 O4', { lo: 33, hi: 50 })}` },
      { id: 'dr', type: 'perc', pan: 0, rev: 0.25, mml: `
        v6 [z4 z8 z8 z4 z8 z8 |]3 v11 b8 b8 b8 b8 t8 t8 f8 f8 | L
        [[v11 j4 v6 b8 b8 v9 u4 v6 b8 z8 |]7 v11 j4 v9 s8 s8 s16 s16 s16 s16 t8 f8 |]3
        [v11 j4 v6 z8 z8 v11 j4 v9 u4 |]7 v11 j4 v9 s8 s8 t8 m8 f8 f8 |` },
      { id: 'gong', type: 'perc', pan: 0, rev: 0.45, mml: `r1 | r1 | r1 | r1 | L ${gongs(32)}` },
    ],
  };
}

// 渾沌：歌と舞の祭り。140 BPM（渾沌の輪の弾がこの拍で出る）。旋律はチャルメラ（嗩吶）→ 笛子 → 琵琶 → 笛子と嗩吶
{
  const intro = 'C C F G';
  const A = 'C Am F G C Am Dm G';
  const A2 = 'C Am F G Em Am Dm,G C';
  const B = 'F G Em Am Dm Em F G';
  const C = 'C C F G C Am F,G C';
  const tpl = 'R8 O8 F8 O8 R8 O8 F8 O8';
  SONGS.chuou = {
    gain: 1.18,
    bpm: 140,
    melody: 'lead',
    chords: `${intro} ${A} ${A2} ${B} ${C}`,
    reverb: { size: 0.7, damp: 0.4 },
    pat: {
      MC: 'o6 c8 d8 e8 g8^4 a8 g8 | e4 d8 c8^2 | <a8 >c8 d8 f8^4 d8 c8 | d4. <b8 g2 | >g4. a8 g8 e8 d8 e8 | a4 g8 e8^2 | f4 e8 d8^4 <b4 | >c2. r4 |',
    },
    ch: [
      { id: 'lead', type: 'inst', pan: -0.2, rev: 0.25, mml: `
        r1 | r1 | r1 | r1 | L
        @suona v13
        o5 e8 g8 a8 g8^4 e4 | d8 e8 c8 <a8^2 | >c8 d8 f8 d8^4 c4 | d2 r4 g8 a8 | >c4. <a8 g8 e8 g4 | a4 >c8 d8^8 e8 d8 c8 | d2 c8 <a8 f4 | g2. r4 |
        @dizi v13
        o5 e8 g8 a8 g8^4 e4 | d8 e8 c8 <a8^2 | >c8 d8 f8 d8^4 c4 | d2 r4 g8 a8 | b4. a8 g8 e8 g4 | a4 >c8 e8^8 d8 c8 <a8 | >d4. c8 <b8 a8 g4 | >c2. r4 |
        @pipa v14 k-12
        o6 a8 a8 g8 a8^2 | b8 b8 a8 b8^2 | >e4. d8 <b8 a8 g4 | a2. r4 | f8 f8 e8 f8^2 | g8 g8 e8 g8^2 | a4 >c4 <a8 g8 f4 | g2. r4 | k0
        @dizi v13 $MC` },
      { id: 'lead2', type: 'inst', pan: 0.25, rev: 0.25, mml: `
        r1 | r1 | r1 | r1 | L
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        @erhu v10 ${pads(B, { lo: 62 })}
        @suona v11 k-12 $MC k0` },
      { id: 'acc', type: 'inst', pan: 0.35, rev: 0.25, poly: 10, mml: `
        @zheng v10 ${arp(intro, { lo: 60, pat: WAVE })} L
        v9 ${arp(A, { lo: 60, pat: [0, 2, 1, 3, 2, 4, 3, 5], len: 8 })}
        ${arp(A2, { lo: 60, pat: [0, 2, 1, 3, 2, 4, 3, 5], len: 8 })}
        @yangqin v9 ${arp(B, { lo: 60, pat: ['r', 0, 'r', 1, 'r', 2, 'r', 1], len: 8 })}
        @zheng v10 ${arp(C, { lo: 60, pat: RISE })}` },
      { id: 'pad', type: 'inst', pan: -0.3, rev: 0.4, poly: 6, mml: `
        r1 | r1 | @strings v6 ${blocks('F G', { lo: 55 })} L
        v5 ${blocks(A, { lo: 55 })}
        v6 ${blocks(A2, { lo: 55 })}
        v7 ${blocks(B, { lo: 55 })}
        v7 ${blocks(C, { lo: 55 })}` },
      { id: 'bass', type: 'inst', pan: 0, rev: 0.1, mml: `
        @cbass v12 ${bass(intro, tpl, { lo: 36, hi: 52 })} L
        ${bass(A, tpl, { lo: 36, hi: 52 })}
        ${bass(A2, tpl, { lo: 36, hi: 52 })}
        ${bass(B, tpl, { lo: 36, hi: 52 })}
        ${bass(C, tpl, { lo: 36, hi: 52 })}` },
      { id: 'dr', type: 'perc', pan: 0, rev: 0.2, mml: `
        [v12 j8 v6 b8 v11 X8 v6 b8 v12 j8 j8 v11 X8 v7 u8 |]3 v11 s16 s16 s16 s16 t8 t8 m8 m8 f8 C8 | L
        [[v12 j8 v6 b8 v11 X8 v6 b8 v12 j8 j8 v11 X8 v7 u8 |]7 v12 j8 v6 b8 v11 X8 x8 s16 s16 s16 s16 t8 C8 |]4` },
      { id: 'gong', type: 'perc', pan: 0, rev: 0.45, mml: `r1 | r1 | r1 | r1 | L ${gongs(32, 8)}` },
    ],
  };
}

// 四凶との戦い（第3章の最終ボス）：二胡と笛子の斉奏 → 嗩吶 → 弦とホルン → 金管と合唱。古筝・琵琶・弦の刻み、大太鼓と銅鑼
{
  const intro = 'Am Am F E';
  const A = 'Am F Dm E Am F G E';
  const A2 = 'Am F Dm E F G Am Am';
  const B = 'Dm Am G C F Dm E7sus4 E7';
  const C = 'F G Em Am F G E E7';
  const drive = 'R8 O8 R8 O8 R8 O8 R8 O8';
  const trem = [3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1];
  SONGS.shikyou = {
    gain: 0.88,
    bpm: 166,
    melody: 'lead',
    chords: `${intro} ${A} ${A2} ${B} ${C}`,
    reverb: { size: 0.8, damp: 0.4 },
    pat: {
      MA: 'o5 a4 e8 a8^8 b8 >c4 | <a2. r4 | d4 <a8 >d8^8 e8 f4 | e2. r4 | a4 e8 a8^8 b8 >c4 | d4. c8 <a8 g8 f4 | g4 a8 b8^4 >d4 | e2. r4 |',
      MA2: 'o5 a4 e8 a8^8 b8 >c4 | <a2. r4 | d4 <a8 >d8^8 e8 f4 | e2. r4 | >c4 <a8 >c8^8 d8 e4 | d2 <b4 g4 | a4. b8 >c8 d8 e4 | <a2. r4 |',
      MB: 'o5 f2. e8 d8 | e2 a4. g8 | g2. a8 b8 | >c2. r4 | <a4 g8 f8^2 | d4 f8 a8^4 >d4 | e2. d8 c8 | <b2 g+2 |',
      MC: 'o6 a2. g8 a8 | b2 >d4. c8 | <b4 g8 e8^2 | a2. r4 | >c2. <b8 a8 | b4 >d8 e8^4 d4 | e2. d8 <b8 | g+2. r4 |',
    },
    ch: [
      { id: 'lead', type: 'inst', pan: -0.15, rev: 0.3, mml: `
        r1 | r1 | r1 | r1 | L
        @erhu v13 $MA
        @suona v13 $MA2
        @strings v13 $MB
        @tpt v14 k-12 $MC k0` },
      { id: 'lead2', type: 'inst', pan: 0.25, rev: 0.3, mml: `
        r1 | r1 | r1 | r1 | L
        @dizi v11 $MA
        @erhu v11 k-12 $MA2 k0
        @horn v12 k-12 $MB k0
        @cha v12 k-12 $MC k0` },
      { id: 'acc', type: 'inst', pan: 0.35, rev: 0.2, poly: 10, mml: `
        @zheng v10 ${arp(intro, { lo: 57, pat: RISE })} L
        v9 ${arp(A, { lo: 57, pat: WAVE })}
        ${arp(A2, { lo: 57, pat: WAVE })}
        @pipa v10 ${arp(B, { lo: 60, pat: trem, len: 32 })}
        @strst v11 ${arp(C, { lo: 52, pat: RISE })}` },
      { id: 'pad', type: 'inst', pan: -0.3, rev: 0.4, poly: 6, mml: `
        @strings v7 ${blocks(intro, { lo: 52 })} L
        v6 ${blocks(A, { lo: 52 })}
        v7 ${blocks(A2, { lo: 52 })}
        @brs v9 ${blocks(B, { lo: 55, rh: ['r8', '8', 'r8', '8', 'r8', '8', 'r8', '8'], rh2: ['r8', '8', 'r8', '8'] })}
        @strings v9 ${blocks(C, { lo: 55 })}` },
      { id: 'bass', type: 'inst', pan: 0, rev: 0.1, mml: `
        @cbass v13 ${bass(intro, drive, { lo: 33, hi: 50 })} L
        ${bass(A, drive, { lo: 33, hi: 50 })}
        ${bass(A2, drive, { lo: 33, hi: 50 })}
        ${bass(B, drive, { lo: 33, hi: 50 })}
        @trb v13 ${bass(C, drive, { lo: 33, hi: 50 })}` },
      { id: 'timp', type: 'inst', pan: 0.1, rev: 0.3, mml: `
        @timp v12 ${bass(intro, 'R8 R8 R4 R8 R8 R4', { lo: 40, hi: 52 })} L
        ${bass(A, 'R4 r2.', { lo: 40, hi: 52 })}
        ${bass(A2, 'R4 r4 R4 r4', { lo: 40, hi: 52 })}
        ${bass(B, 'R4 r2.', { lo: 40, hi: 52 })}
        v13 ${bass(C, 'R8 R8 R4 R8 R8 R4', { lo: 40, hi: 52 })}` },
      { id: 'dr', type: 'perc', pan: 0, rev: 0.2, mml: `
        [v12 J4 J4 J8 J8 J4 |]3 v12 s16 s16 s16 s16 s16 s16 s16 s16 t8 m8 f8 f8 | L
        [[v12 J8 v6 h8 v11 S8 v6 h8 v12 j8 j8 v11 S8 v6 h8 |]7 v12 J8 h8 S8 h8 s16 s16 s16 s16 S8 C8 |]4` },
      { id: 'gong', type: 'perc', pan: 0, rev: 0.45, mml: `v11 g1 | r1 | r1 | r1 | L ${gongs(32)}` },
    ],
  };
}

// 第3章の中ボス：琵琶の刻みに二胡が切り込む。中間部は弦とホルン、終わりは笛子の速い走句
{
  const intro = 'Dm Dm';
  const A = 'Dm Dm Bb C Dm Dm Gm A';
  const B = 'Bb F Gm Dm Bb C A7sus4 A7';
  const C = 'Dm C Bb A Dm C Bb A';
  const ost = [0, 0, 2, 0, 1, 0, 2, 0, 0, 0, 2, 0, 3, 2, 1, 0];
  const trem = [3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1];
  SONGS.boss3 = {
    bpm: 152,
    melody: 'lead',
    chords: `${intro} ${A} ${A} ${B} ${C}`,
    reverb: { size: 0.75, damp: 0.4 },
    pat: {
      MA: 'o5 d8 d8 r8 f8 a4 g8 f8 | g4 a2 r4 | f8 f8 r8 g8 b-4 a8 g8 | e4 g2 r4 | d8 d8 r8 f8 a4 >c8 d8 | f4. e8 d8 c8 <a4 | g8 b-8 a8 g8^4 d4 | c+4 d8 e8^4 r4 |',
      MB: 'd4. f8 b-2 | a4 g8 f8^2 | g2 b-4. >c8 | <a2. r4 | >d4. c8 <b-2 | >c4 <b-8 g8^2 | a2 >d2 | c+2 e4 r4 |',
      MC: 'o5 d16 f16 g16 a16 >c16 d16 c16 <a16 >d2 | e16 d16 c16 <a16 g16 a16 >c16 d16 e2 | f4. e8 d8 c8 <b-8 g8 | a2. r4 |',
      MC2: 'o5 a16 >c16 d16 f16 a16 f16 d16 c16 d2 | c16 d16 e16 g16 a16 g16 e16 d16 e2 | f4. g8 f8 d8 <b-4 | a2 >c+2 |',
    },
    ch: [
      { id: 'lead', type: 'inst', pan: -0.15, rev: 0.3, mml: `
        r1 | r1 | L
        @erhu v13 $MA
        @dizi v13 $MA
        @strings v13 o5 $MB
        @dizi v13 $MC $MC2` },
      { id: 'lead2', type: 'inst', pan: 0.25, rev: 0.3, mml: `
        r1 | r1 | L
        r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |
        @erhu v11 o4 a1 | f1 | f1 | e1 | a1 | a1 | b-1 | a1 |
        @horn v12 o4 $MB
        @erhu v12 o4 a1 | g1 | f1 | e1 | a1 | g1 | f1 | e1 |` },
      { id: 'acc', type: 'inst', pan: 0.35, rev: 0.2, poly: 8, mml: `
        @pipa v11 ${arp(intro, { lo: 50, pat: ost })} L
        v10 ${arp(A, { lo: 50, pat: ost })}
        ${arp(A, { lo: 50, pat: ost })}
        @zheng v10 ${arp(B, { lo: 57, pat: RISE })}
        @pipa v11 ${arp(C, { lo: 60, pat: trem, len: 32 })}` },
      { id: 'pad', type: 'inst', pan: -0.3, rev: 0.4, poly: 6, mml: `
        r1 | r1 | L
        @strings v6 ${blocks(A, { lo: 52 })}
        v7 ${blocks(A, { lo: 52 })}
        v8 ${blocks(B, { lo: 52 })}
        @brs v9 ${blocks(C, { lo: 52, rh: ['8', 'r8', 'r4', '8', 'r8', 'r4'] })}` },
      { id: 'bass', type: 'inst', pan: 0, rev: 0.1, mml: `
        @cbass v13 ${bass(intro, 'R8 R8 O8 R8 R8 O8 R8 O8', { lo: 38, hi: 52 })} L
        ${bass(A, 'R8 R8 O8 R8 R8 O8 R8 O8', { lo: 38, hi: 52 })}
        ${bass(A, 'R8 R8 O8 R8 R8 O8 R8 O8', { lo: 38, hi: 52 })}
        ${bass(B, 'R4 O4 R4 O4', { lo: 38, hi: 52 })}
        ${bass(C, 'R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16', { lo: 38, hi: 52 })}` },
      { id: 'dr', type: 'perc', pan: 0, rev: 0.2, mml: `
        [v12 J8 j8 S8 j8 j16 j16 j8 S8 b8 |]2 L
        [v12 C8 b8 S8 b8 J8 j8 S8 b8 | [v12 J8 b8 S8 b8 j8 j8 S8 b8 |]6 v12 j8 b8 S8 b8 s16 s16 s16 s16 S8 S8 |]2
        v12 C4 b8 b8 S4 b8 j8 | [v12 J4 b8 b8 S4 b8 j8 |]6 v12 j8 j8 S8 j8 s16 s16 s16 s16 S8 S8 |
        [v12 J16 j16 b8 S8 b8 j16 j16 b8 S8 u8 |]7 v12 s16 s16 s16 s16 s16 s16 s16 s16 S8 S8 C4 |` },
      { id: 'gong', type: 'perc', pan: 0, rev: 0.45, mml: `v12 g1 | r1 | L ${gongs(32)}` },
    ],
  };
}

// ボス戦（第1章の中ボス）：A と B♭ の半音でにじり寄る
{
  const intro = 'Am Am';
  const A = 'Am Am F F Dm Dm E E';
  const A2 = 'Am Am F G Am F Bb E7';
  const B = 'Dm Am Bb Am Dm Am Bb E7';
  const C = 'Am Am F E Am Am F E';
  SONGS.boss = {
    bpm: 152,
    melody: 'p1',
    chords: `${intro} ${A} ${A2} ${B} ${C}`,
    pat: {
      R1: '[a16 a16 >c16 <a16 >e16 <a16 >d+16 <a16]2',
      R2: '[f16 f16 a16 f16 >c16 <f16 b16 f16]2',
      R3: '[e16 e16 g+16 e16 b16 e16 >d16 <e16]2',
    },
    ch: [
      { id: 'p1', type: 'pulse', pan: -0.15, echo: [24, 0.28, 0.4], mml: `
        r1 | r1 | L
        @lead v14
        o5 a4 a8 b8 >c4 <b8 a8 | e4. f8 e4 d+8 e8 | f4 f8 g8 a4 g8 f8 | c2 <a4 >c4 | d4 d8 e8 f4 e8 d8 | a4. g8 f4 d4 | e4 f8 g+8 b4 >d4 | e2 d4 <b4 |
        a4 a8 b8 >c4 <b8 a8 | >e4. f8 e4 d8 c8 | <a4. g8 f4 c4 | d4 g4 b4 >d4 | e4. d8 c4 <a4 | >c4. <a8 f4 a4 | b-4 >d4 f4 d4 | <b2 g+4 e4 |
        @brass v14
        >f2 e4 d4 | e2 c4 <a4 | b-2 >d4 f4 | e2. r4 | f4. e8 d4 a4 | g4. e8 c4 e4 | f4. d8 <b-4 >d4 | e2 d4 <b4 |
        @chug v11
        o4 $R1 | $R1 | $R2 | $R3 | $R1 | $R1 | $R2 | $R3 |` },
      { id: 'p2', type: 'pulse', pan: 0.25, mml: `
        @chug v9 o5 $R1 | $R1 | L
        @stab v9 ${arp(A, { lo: 62, pat: ['r', 0, 'r', 1, 'r', 2, 'r', 1], len: 8 })}
        ${arp(A2, { lo: 62, pat: ['r', 0, 'r', 1, 'r', 2, 'r', 1], len: 8 })}
        @pad v10 ${pads(B, { lo: 64 })}
        @chug v8 o5 $R1 | $R1 | $R2 | $R3 | $R1 | $R1 | $R2 | $R3 |` },
      { id: 'tri', type: 'tri', mml: `
        @bass ${bass(intro, 'R8 R8 O8 R8 R8 O8 R8 O8', { lo: 33, hi: 50 })} L
        ${bass(A, 'R8 R8 O8 R8 R8 O8 R8 O8', { lo: 33, hi: 50 })}
        ${bass(A2, 'R8 R8 O8 R8 R8 O8 R8 O8', { lo: 33, hi: 50 })}
        ${bass(B, 'R8 O8 R8 O8 R8 O8 R8 O8', { lo: 33, hi: 50 })}
        ${bass(C, 'R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16 R16', { lo: 33, hi: 50 })}` },
      { id: 'dr', type: 'drum', mml: `
        [k8 k8 S8 k8 k16 k16 k8 S8 k8 |]2 L
        [C8 h8 S8 h8 k8 k8 S8 h8 | [k8 h8 S8 h8 k8 k8 S8 h8 |]6 k8 h8 S8 h8 s16 s16 s16 s16 S8 S8 |]2
        C4 h8 h8 S4 h8 k8 | [K4 h8 h8 S4 h8 k8 |]6 k8 k8 S8 k8 s16 s16 s16 s16 S8 S8 |
        [k16 k16 h8 S8 h8 k16 k16 h8 S8 h8 |]7 s16 s16 s16 s16 s16 s16 s16 s16 S8 S8 C4 |` },
    ],
  };
}

// 最終ボス戦（第1章）：タイトルの主題が、戦いの中で短調になって帰ってくる
{
  const intro = 'Am Am F E';
  const A = 'Am F Dm E Am F G E';
  const A2 = 'Am F Dm E F G E7 E7';
  const B = 'F G Em Am F G E E';
  const C = 'FM7 Em7 Dm7 CM7 BbM7 Am7 AbM7 G7sus4,G7';
  const drive = 'R8 O8 R8 O8 R8 O8 R8 O8';
  SONGS.final = {
    bpm: 164,
    melody: 'p1',
    chords: `${intro} ${A} ${A2} ${B} ${C}`,
    ch: [
      { id: 'p1', type: 'pulse', pan: -0.15, echo: [24, 0.28, 0.45], mml: `
        r1 | r1 | r1 | r1 | L
        @brass v14
        o5 r8 e8 a8 b8 >c4. <b8 | a4 f4 e8 f4. | r8 d8 a8 b8 >c4. d8 | e4. d8 <b2 |
        r8 e8 a8 b8 >c8 e8 d8 c8 | <a4 >c8 f8^4 e8 d8 | d8 e8 d8 <b8^4 g4 | g+2. r4 |
        r8 e8 a8 b8 >c4. <b8 | a4 f4 e8 f4. | r8 d8 a8 b8 >c4. d8 | e2^8 f8 e8 d8 |
        c4. d8 c8 <a8 f4 | g4. a8 b8 >c8 d4 | e4 d8 c8 <b4 >d4 | e2. r4 |
        c2. <a8 >c8 | d2 <b4 >d4 | e2 g4. f+8 | e2. r4 |
        f2. e8 f8 | g2 f4 d4 | e2^8 d8 c8 <b8 | g+2. r4 |
        @lead v14
        o5 r8 e8 a8 b8 >c4. <b8 | g4 e4 d8 e4. | r8 d8 a8 b8 >c4. d8 | e4. d8 <b2 | >d4. c8 <a+8 a8 f4 | g4. e8 c8 d8 e4 | g2 f8 e-8 c8 e-8 | d4. c8 <b2 |` },
      { id: 'p2', type: 'pulse', pan: 0.3, mml: `
        @arp v9 ${arp(intro, { lo: 57, pat: RISE })} L
        ${arp(A, { lo: 57, pat: WAVE })}
        ${arp(A2, { lo: 57, pat: WAVE })}
        @pad25 v10 ${pads(B, { lo: 62 })}
        @arp12 v9 ${arp(C, { lo: 60, pat: WAVE })}` },
      { id: 'tri', type: 'tri', mml: `
        @bass ${bass(intro, 'R8 R8 R8 R8 R8 R8 R8 R8', { lo: 33, hi: 50 })} L
        ${bass(A, drive, { lo: 33, hi: 50 })}
        ${bass(A2, drive, { lo: 33, hi: 50 })}
        ${bass(B, drive, { lo: 33, hi: 50 })}
        ${bass(C, 'R8 R8 O8 R8 R8 O8 F8 O8', { lo: 31, hi: 50 })}` },
      { id: 'dr', type: 'drum', mml: `
        [v12 J4 J4 J4 J4 |]3 s16 s16 s16 s16 s16 s16 s16 s16 t8 m8 f8 f8 | L
        [C8 h8 S8 h8 k8 k8 S8 h8 | [k8 h8 S8 h8 k8 k8 S8 h8 |]6 k8 h8 S8 h8 s16 s16 s16 s16 S8 S8 |]2
        C8 h8 S8 h8 k16 k16 h8 S8 o8 | [k8 h8 S8 h8 k16 k16 h8 S8 o8 |]6 k8 k8 S8 S8 s16 s16 s16 s16 S8 S8 |
        C8 h8 S8 h8 k8 k8 S8 o8 | [k8 h8 S8 h8 k8 k8 S8 o8 |]6 k8 h8 S8 S8 s16 s16 s16 s16 t8 f8 |` },
    ],
  };
}

// リザルト：タイトルの主題を長調で。明るく、少しだけ名残惜しく
{
  const intro = 'FM7 G';
  const A = 'C G/B Am7 Em/G F C/E Dm7 G7sus4,G7';
  const A2 = 'FM7 G6 Em7 Am7 Dm7 G7 C C';
  const B = 'FM7 Em7 Dm7 CM7 FM7 Em7 Dm7,G7 C';
  SONGS.result = {
    bpm: 120,
    melody: 'p1',
    chords: `${intro} ${A} ${A2} ${B}`,
    ch: [
      { id: 'p1', type: 'pulse', pan: -0.15, echo: [36, 0.3, 0.45], mml: `
        @brass v13 o5 a8 a8 a8 >c8 r8 c4 <b8 | >d2. r4 | L
        @lead v13
        o5 r8 g8 >c8 d8 e4. d8 | <b4 g4 d8 e8 g4 | r8 e8 a8 b8 >c4. d8 | e4. d8 <b2 | >c4. <b8 a8 g8 f4 | g4. e8 c4 e4 | f4 a4 >c4 d4 | c4. d8 <b2 |
        r8 a8 >c8 d8 e4. d8 | <b4 g4 e8 d8 e4 | r8 b8 >d8 e8 g4. f+8 | e4. d8 c2 | d4. e8 f4 a4 | g4. f8 d4 <b4 | >c2. <g4 | >c2. r4 |
        @lead50 v12
        <a2 g4 e4 | g2 e4 d4 | f2 e4 c4 | e2. d4 | a4. b8 >c4 e4 | d4. c8 <b4 g4 | a4 f4 g4 b4 | >c2. r4 |` },
      { id: 'p2', type: 'pulse', pan: 0.3, mml: `
        @stab v9 ${arp(intro, { lo: 60, pat: [0, 'r', 1, 'r', 2, 'r', 3, 'r'], len: 8 })} L
        @arp12 v7 ${arp(A, { lo: 60, pat: WAVE })}
        @pluck v9 ${arp(A2, { lo: 57, pat: [0, 2, 1, 3, 2, 4, 3, 1], len: 8 })}
        @pad v9 ${pads(B, { lo: 62 })}` },
      { id: 'tri', type: 'tri', mml: `
        @bass ${bass(intro, 'R4 r4 R4 r4', { lo: 36, hi: 50 })} L
        ${bass(A, 'R4 O8 R8 F4 O4', { lo: 33, hi: 50 })}
        ${bass(A2, 'R8 O8 R8 O8 F8 O8 R8 O8', { lo: 33, hi: 50 })}
        ${bass(B, 'R2. F4', { lo: 33, hi: 50 })}` },
      { id: 'dr', type: 'drum', mml: `
        v12 C4 h8 h8 s8 s8 s8 s8 | s16 s16 s16 s16 t8 m8 f4 C4 | L
        [v12 k8 v6 h8 v11 s8 v6 h8 v12 k8 k8 v11 s8 v6 h8 |]7 v12 k8 h8 s8 h8 s16 s16 s16 s16 t8 f8 |
        v12 C8 v6 h8 v11 s8 v6 h8 v12 k8 k8 v11 s8 v6 o8 | [v12 k8 v6 h8 v11 s8 v6 h8 v12 k8 k8 v11 s8 v6 o8 |]6 v12 k8 v11 s8 s8 s8 s16 s16 s16 s16 s8 s8 |
        [v11 k4 v6 h8 h8 v10 s4 v6 h8 h8 |]7 v11 k4 v10 s8 s8 t8 m8 f4 |` },
    ],
  };
}

// 経営：明るい午後の事務所。はずむベースと裏拍の刻みの上に、跳ねる旋律（A・A・B・A）
{
  const intro = 'C Am F G';
  const A = 'C Em F G C Am Dm7 G7';
  const A2 = 'C Em F G Am F G7 C';
  const B = 'F G Em Am Dm7 Em7 F,G C';
  const off = ['r', 2, 'r', 1, 'r', 2, 'r', 1];
  const bounce = 'R4. O8 F4 O4';
  const beat = 'v10 k8 v5 h8 v8 s8 v5 h8 v10 k8 k8 v8 s8 v5 h8 |';
  SONGS.business = {
    gain: 1.12,
    bpm: 128,
    melody: 'p1',
    chords: `${intro} ${A} ${A2} ${B} ${A2}`,
    ch: [
      { id: 'p1', type: 'pulse', pan: -0.15, echo: [36, 0.3, 0.4], mml: `
        r1 | r1 | r1 | r1 | L
        @lead12 v13
        o5 e8 g4 a8 g4 e4 | d8 e4 g8^2 | a8 >c4 d8 c4 <a4 | g8 a4 b8^2 |
        e8 g4 a8 g4 >c4 | <b8 >c4 e8^2 | d8 c4 <a8 >c4 <a4 | g2. r4 |
        e8 g4 a8 g4 e4 | d8 e4 g8^2 | a8 >c4 d8 c4 <a4 | g8 a4 b8^2 |
        e8 a4 b8 >c4 <a4 | a8 >c4 d8^8 c8 <a4 | b4. a8 g8 a8 b8 >d8 | c2. r4 |
        <a4. g8 a8 >c8^4 | <b4. a8 b8 >d8^4 | e4 d8 e8^8 d8 <b4 | >c2. r4 |
        <a4. g8 a8 >d8^4 | <b4. a8 b8 >e8^4 | f4 e8 d8^4 <b4 | >c2. r4 |
        <e8 g4 a8 g4 e4 | d8 e4 g8^2 | a8 >c4 d8 c4 <a4 | g8 a4 b8^2 |
        e8 a4 b8 >c4 <a4 | a8 >c4 d8^8 c8 <a4 | b4. a8 g8 a8 b8 >d8 | c2. r4 |` },
      { id: 'p2', type: 'pulse', pan: 0.25, mml: `
        @arp12 v7 ${arp(intro, { lo: 64, pat: RISE })} L
        @stab v8 ${arp(A, { lo: 60, pat: off, len: 8 })}
        ${arp(A2, { lo: 60, pat: off, len: 8 })}
        @arp12 v7 ${arp(B, { lo: 64, pat: WAVE })}
        @stab v8 ${arp(A2, { lo: 60, pat: off, len: 8 })}` },
      { id: 'tri', type: 'tri', mml: `
        @bass ${bass(intro, bounce, { lo: 36, hi: 52 })} L
        ${bass(A, bounce, { lo: 36, hi: 52 })}
        ${bass(A2, bounce, { lo: 36, hi: 52 })}
        ${bass(B, 'R8 O8 R8 O8 R8 O8 R8 O8', { lo: 36, hi: 52 })}
        ${bass(A2, bounce, { lo: 36, hi: 52 })}` },
      { id: 'dr', type: 'drum', mml: `
        [v9 k8 v5 h8 v7 s8 v5 h8 v9 k8 v5 h8 v7 s8 v5 h8 |]3 v9 k8 v5 h8 v7 s8 v5 h8 v9 k8 v7 s8 s16 s16 s8 | L
        [${beat}]7 v10 k8 v5 h8 v8 s8 v5 h8 v10 k8 v8 s8 s8 v9 s8 |
        [${beat}]7 v10 k8 v5 h8 v8 s8 v5 h8 v10 k8 v8 s8 s16 s16 v9 s8 |
        [v10 k8 v6 o8 v8 s8 v6 o8 v10 k8 k8 v8 s8 v6 o8 |]7 v10 k8 v6 o8 v8 s8 s8 v10 k8 v8 s8 s16 s16 s8 |
        [${beat}]7 v10 k8 v5 h8 v8 s8 v5 h8 v10 k8 v8 s8 s8 v9 s8 |` },
    ],
  };
}
