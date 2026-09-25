// セーブデータ（localStorage）。使えない環境でもゲームは動くようにする。
const KEY = 'jewel-survivor-save-v1';

function defaults() {
  return {
    coins: 0,
    totalCoins: 0,
    upgrades: {},
    unlocked: { ruby: true, sapphire: true, garnet: true },
    awaken: {}, // キャラの かくせい（ガチャのダブり）
    selected: 'ruby',
    best: { time: 0, kills: 0, level: 0, damage: 0, coins: 0 },
    stats: { runs: 0, kills: 0, clears: 0, gacha: 0, polished: 0, polishSS: 0 },
    achievements: {},
    seen: { weapons: {}, passives: {}, enemies: {}, evos: {} },
    kills: {},
    settings: { bgm: 0.55, sfx: 0.8, haptic: true, dmgNum: true, shake: true },
    endless: false,
    login: { last: '', streak: 0 },
    stages: {},
    selectedStage: 'wastes',
    heatSel: 0,
    lastBackup: 0, // 最後にバックアップを書き出した時刻（ms）
    rough: { shard: 0, rough: 0, large: 0, mystic: 0 }, // 手持ちの原石
    jewels: {}, // コレクション { gemId: { n: 研磨数, best: 最高品質, ct: 最大カラット } }
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

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch (e) { /* ignore */ }
}

export function resetSave() {
  const d = defaults();
  for (const k of Object.keys(save)) delete save[k];
  Object.assign(save, d);
  persist();
}

// ---------------------------------------------------------------- バックアップ
const APP = 'jewel-survivor';

// 書き出し用の文字列
export function exportSave() {
  return JSON.stringify({ app: APP, version: 1, exportedAt: new Date().toISOString(), data: save });
}

// 読み込んだ文字列を解析。正しくなければ例外
export function parseBackup(text) {
  const obj = JSON.parse(text);
  const data = obj && obj.app === APP ? obj.data : obj;
  if (!data || typeof data !== 'object' || typeof data.coins !== 'number' || !data.unlocked) {
    throw new Error('JEWEL SURVIVOR のバックアップファイルではありません');
  }
  return data;
}

// 現在のセーブを置き換える
export function importSave(data) {
  const d = merge(defaults(), JSON.parse(JSON.stringify(data)));
  for (const k of Object.keys(save)) delete save[k];
  Object.assign(save, d);
  persist();
}
