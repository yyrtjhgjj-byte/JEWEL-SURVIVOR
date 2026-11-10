// セーブデータ（localStorage）。使えない環境でもゲームは動くようにする。
const KEY = 'jewel-survivor-save-v1';
// 転生でしまった前世（rebirth.js）。ラン中の保存を重くしないよう、ふだんのセーブとは別にしまう
const PAST_KEY = 'jewel-survivor-past-v1';

export function defaults() {
  return {
    coins: 0,
    totalCoins: 0,
    upgrades: {},
    unlocked: { ruby: true, sapphire: true, garnet: true },
    awaken: {}, // キャラの かくせい（ガチャのダブり）
    selected: 'ruby',
    best: { time: 0, kills: 0, level: 0, damage: 0, coins: 0 },
    stats: { runs: 0, kills: 0, clears: 0, gacha: 0, polished: 0, polishSS: 0, runCoins: 0 }, // runCoins：ランで得たコインの累計（経営の配当の上限に使う）
    achievements: {},
    seen: { weapons: {}, passives: {}, enemies: {}, evos: {} },
    kills: {},
    settings: { bgm: 0.55, sfx: 0.8, haptic: true, dmgNum: true, shake: true },
    endless: false,
    hyper: false, // ハイパーモード（ステージ選択の切り替え）
    hurry: false, // ハリーモード
    chaos: false, // CHAOS（全ステージクリアで解放。ステージ選択の切り替え）
    chaosOpen: false, // CHAOS を開いたか（一度開いたら、章を足しても閉じない）
    chaosRec: {}, // CHAOS の記録（ステージごとの { cleared, best }。ふつうの記録とは別）
    artSel: null, // 持ち込む秘宝
    artSel2: null, // 2 つ目の持ち込む秘宝（上位工房「秘宝の持ち込み」）
    upgradesOff: {}, // 工房：最大まで上げた強化のうち、無効にしているもの
    upgrades2: {}, // 上位工房の強化レベル
    upgrades2Off: {}, // 上位工房：最大まで上げた強化のうち、無効にしているもの
    rank: { lv: 1, xp: 0 }, // ユーザーランク（js/rank.js）
    upperShop: false, // 上位工房を解放済みか（一度解放したら、工房を返金しても閉じない）
    login: { last: '', days: 0 }, // ログインボーナス：最後に受け取った日と、受け取った日数の累計
    stages: {},
    selectedStage: 'wastes',
    heatSels: {}, // ステージごとに選んでいる HEAT
    lastBackup: 0, // 最後にバックアップを書き出した時刻（ms）
    rough: { shard: 0, rough: 0, large: 0, mystic: 0 }, // 手持ちの原石
    dust: 0, // ジェムダスト（ガチャで貯まり、交換所で使う）
    auction: null, // オークションの出品（auction.js）
    nextGem: {}, // 次に磨く原石の中身（等級ごと。atelier.js の nextGem）
    pickRough: {}, // 交換所の選べる原石（「宝石|等級」ごとの数。atelier.js の pickRoughs）
    jewels: {}, // コレクション { gemId: { n: 研磨数, best: 最高品質, ct: 最大カラット, have: 所持数 } }
    beasts: {}, // 百獣 { gemId: レベル }（beasts.js）
    migrated: {}, // 一度だけ行う移行処理の済み印（main.js の migrateSave）
    tabs: { zukan: 'gems', zukanCh: 1 }, // 図鑑で最後に開いていたタブと敵の章
    biz: null, // 経営（biz.js の newBiz。最初に開いたときに作る）
    life: null, // 転生（rebirth.js）：{ id: この人生の印, n: 転生した回数 }
  };
}

function merge(base, over) {
  if (!over || typeof over !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (!(k in over)) continue;
    const b = base[k], o = over[k];
    if (b && typeof b === 'object' && !Array.isArray(b)) base[k] = merge(b, o);
    else base[k] = o;
  }
  // 未知のキー（ずかんの中身など）も残す
  for (const k of Object.keys(over)) if (!(k in base)) base[k] = over[k];
  return base;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(defaults(), JSON.parse(raw));
  } catch (e) { /* 使えないときは まっさらで */ }
  return defaults();
}

export const save = load();

// 書けたかを返す（転生と合流は、書けたのを確かめてから次へ進む）
export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
    return true;
  } catch (e) { return false; }
}

export function resetSave() {
  const d = defaults();
  for (const k of Object.keys(save)) delete save[k];
  Object.assign(save, d);
  clearPast();
  persist();
}

// セーブをまるごと置き換える（転生・合流・バックアップの読み込み）。書けたかを返す（書けなければ元に戻す）
function setAll(d) {
  for (const k of Object.keys(save)) delete save[k];
  Object.assign(save, d);
}
export function replaceSave(data) {
  const old = JSON.stringify(save);
  const d = merge(defaults(), JSON.parse(JSON.stringify(data)));
  delete d.pendingRun;
  setAll(d);
  if (persist()) return true;
  setAll(JSON.parse(old));
  return false;
}

// ---------------------------------------------------------------- 前世（転生）
let past = null;
try {
  const raw = localStorage.getItem(PAST_KEY);
  if (raw) past = JSON.parse(raw);
} catch (e) { past = null; }
export const pastLife = () => past;
// 前世を書く。読み直して同じなら true
export function writePast(p) {
  try {
    const text = JSON.stringify(p);
    localStorage.setItem(PAST_KEY, text);
    if (localStorage.getItem(PAST_KEY) !== text) return false;
    past = JSON.parse(text);
    return true;
  } catch (e) { return false; }
}
export function clearPast() {
  try { localStorage.removeItem(PAST_KEY); } catch (e) { /* ignore */ }
  past = null;
}

// ---------------------------------------------------------------- バックアップ
const APP = 'jewel-survivor';

// 書き出し用の文字列
export function exportSave() {
  // 中断したランは入れない（読み込んだあとに、古いランを再開・精算できてしまわないように）。転生中なら前世も入れる
  const { pendingRun, ...data } = save;
  return JSON.stringify({ app: APP, version: 1, exportedAt: new Date().toISOString(), data, ...(past ? { past } : {}) });
}

// 読み込んだ文字列を解析。正しくなければ例外
export function parseBackup(text) {
  const obj = JSON.parse(text);
  const data = obj && obj.app === APP ? obj.data : obj;
  if (!data || typeof data !== 'object' || typeof data.coins !== 'number' || !data.unlocked) {
    throw new Error('JEWEL SURVIVOR のバックアップファイルではありません');
  }
  // 前世は importSave で受け取る（セーブの中身には混ぜない）
  Object.defineProperty(data, 'pastLife', { value: (obj && obj.app === APP && obj.past) || null, enumerable: false });
  return data;
}

// 現在のセーブを置き換える。前世もバックアップのものにする（入っていなければ消す）
export function importSave(data) {
  replaceSave(data);
  if (data.pastLife) writePast(data.pastLife);
  else clearPast();
}
