// 自分で作った宝石（ジュエル・アトリエ）：選んだカット・色・質感から、光線追跡の見た目（gem-gl.js の GEM_LOOK）を作って登録する。
// 登録すると、アイコン（gemIcon）・その場で描く宝石・鑑賞モード・宝石の砂場がそのまま描ける。セーブは save.myGems（30 個まで）
import { save, persist } from './save.js';
import { GEM_LOOK, forgetGemImage } from './gem-gl.js';

export const MY_MAX = 30;
// 透明な石のカット（gem-gl.js の CUTS の名前）
export const CLEAR_CUTS = [
  ['brilliant', 'ラウンド'], ['oval', 'オーバル'], ['cushion', 'クッション'], ['pear', 'ペア'], ['trillion', 'トリリオン'],
  ['step', 'エメラルド'], ['baguette', 'バゲット'], ['point', '結晶'], ['lgKoh', 'コ・イ・ヌール'], ['lgRegent', 'リージェント'],
  ['lgHope', 'ホープ'], ['lgCullinan', 'カリナン'], ['lgPink', 'ピンク・スター'], ['lgTablet', '板'],
];
// 丸い石の形と模様（模様は gem-gl.js の stone の kind 20〜24）
export const CAB_CUTS = [['cab', '丸'], ['cabOval', '楕円'], ['sphere', '球']];
export const PATTERNS = [['plain', '単色', 20], ['band', '縞', 21], ['spot', '斑', 22], ['play', '遊色', 23], ['sheen', 'シラー', 24]];
// 2 色目を使う模様（バイカラーは透明な石だけ）
export const usesColor2 = (g) => (g.kind === 'clear' ? !!g.bi : ['band', 'spot', 'sheen'].includes(g.pat));

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// 色相 0〜1・鮮やかさ 0〜1・明るさ 0〜1 → RGB 0〜1
export function hsv(h, s, v) {
  const f = (n) => { const k = (n + h * 6) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5), f(3), f(1)];
}
const hex = (rgb) => '#' + rgb.map((c) => Math.round(clamp(c, 0, 1) * 255).toString(16).padStart(2, '0')).join('');

// 新しい宝石のたたき台（ランダムでなければルビーのような赤いラウンド）
export function blankGem(random = false) {
  const r = Math.random;
  const g = { id: '', name: '', kind: 'clear', cut: 'brilliant', h: 0.96, s: 0.85, v: 0.5, bi: false, h2: 0.4, s2: 0.8, brill: 0.4, fire: 0.3, fog: 0, pat: 'plain' };
  if (random) {
    g.kind = r() < 0.7 ? 'clear' : 'cab';
    g.cut = g.kind === 'clear' ? CLEAR_CUTS[(r() * CLEAR_CUTS.length) | 0][0] : CAB_CUTS[(r() * CAB_CUTS.length) | 0][0];
    g.h = r(); g.s = 0.3 + r() * 0.7; g.v = 0.2 + r() * 0.7;
    g.bi = r() < 0.2; g.h2 = r(); g.s2 = 0.4 + r() * 0.6;
    g.brill = r(); g.fire = r(); g.fog = r() < 0.15 ? r() * 0.7 : 0;
    g.pat = PATTERNS[(r() * PATTERNS.length) | 0][0];
  }
  return g;
}

// 透明な石の色：抜ける光の色（色の濃さは吸収の強さ d で決める）。真っ黒にならないよう少しだけ下を持ち上げる
const passColor = (h, s) => hsv(h, s, 1).map((c) => 0.03 + 0.97 * c);

// 宝石の記録 → 光線追跡の見た目
export function lookOf(g) {
  const color = hex(g.kind === 'clear' ? hsv(g.h, g.s * 0.9, 1) : hsv(g.h, g.s, 1 - g.v * 0.6));
  if (g.kind === 'clear') {
    const fire = g.fire;
    const L = {
      mode: 'trace', cut: g.cut, ior: 1.45 + g.brill * 1.0, disp: 0.006 + fire * 0.05, t: passColor(g.h, g.s), d: 0.25 + g.v * 1.9,
      fire: 0.6 + fire * 1.4, spark: fire > 0.55, exp: g.brill > 0.75 ? 0.75 : 1.2,
    };
    if (g.bi) L.bi = passColor(g.h2, g.s2);
    if (g.fog > 0.02) { L.fogD = g.fog * 3.4; L.fog = hsv(g.h, g.s * 0.35, 1).map((c) => c * 1.05); }
    if (g.cut === 'point') L.spin0 = -22;
    // ラウンドは大きな照明がテーブルに白く丸く映るので、ダイヤモンドと同じ照明にする
    if (g.cut === 'brilliant') L.env = 'diamond';
    L.meta = { jp: g.name || '名前のない宝石', en: 'MY JEWEL', color };
    return L;
  }
  const P = PATTERNS.find((p) => p[0] === g.pat) || PATTERNS[0];
  const c1 = hsv(g.h, g.s, 1 - g.v * 0.75).map((c) => c * c);
  const c2 = hsv(g.h2, g.s2, g.pat === 'sheen' ? 1 : 0.85).map((c) => c * c);
  return {
    mode: 'cab', cut: g.cut, kind: P[2], ri: 1.55, c1, c2,
    abc: g.cut === 'sphere' ? [0.9, 0.9, 0.9] : g.cut === 'cab' ? [0.92, 0.92, 0.62] : [1.0, 0.76, 0.62],
    meta: { jp: g.name || '名前のない宝石', en: 'MY JEWEL', color },
  };
}

export const myGems = () => (Array.isArray(save.myGems) ? save.myGems : (save.myGems = []));
export const myGem = (id) => myGems().find((g) => g.id === id);
export const myGemIds = () => myGems().map((g) => g.id);
// 名前と色（GEMS に無い宝石の表示用）
export const myMeta = (id) => (GEM_LOOK[id] && GEM_LOOK[id].meta) || null;

// 見た目を登録する（作り直したら古いアイコンを捨てる）
export function registerGem(g) {
  GEM_LOOK[g.id] = lookOf(g);
  forgetGemImage(g.id);
}
export function registerMyGems() {
  for (const g of myGems()) if (!GEM_LOOK[g.id]) GEM_LOOK[g.id] = lookOf(g);
}

export function saveMyGem(g) {
  const list = myGems();
  if (!g.id) {
    if (list.length >= MY_MAX) return null;
    g.id = 'my_' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    list.push(g);
  } else {
    const i = list.findIndex((x) => x.id === g.id);
    if (i < 0) list.push(g); else list[i] = g;
  }
  g.name = String(g.name || '').slice(0, 16);
  registerGem(g);
  persist();
  return g;
}
export function deleteMyGem(id) {
  save.myGems = myGems().filter((g) => g.id !== id);
  if (save.myHome === id) save.myHome = null;
  delete GEM_LOOK[id];
  forgetGemImage(id);
  persist();
}
