// =====================================================================
//  動作の記録：画面に出ている間（裏に回っていない間）にアプリが落ちたら、次の起動で直前の様子を記録に残す。
//  iPhone でしか起きない「落ちる」問題の原因を探るためのもの。設定画面の「動作の記録」で見られる。
//  セーブとは別のキー（バックアップには入れない）
// =====================================================================
const KEY = 'jewel-survivor-diag';
const MAX = 10; // 残す記録の数
const BEAT = 3000; // 様子を書き残す間隔（ミリ秒）

const t0 = performance.now();
const counters = { canvases: 0, canvasMB: 0 };
let data = load();
let getInfo = () => ({});
let fresh = null; // 今回の起動で見つかった異常終了

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.crashes)) return d;
  } catch (e) { /* 壊れていたら作り直す */ }
  return { crashes: [], launches: 0 };
}
function write() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 書けなくてもゲームは続ける */ }
}

// render.js がキャンバスを作るたびに呼ぶ
export function diagCanvas(bytes) {
  counters.canvases++;
  counters.canvasMB += bytes / 1048576;
}

function beat() {
  if (document.visibilityState !== 'visible') return;
  let info = {};
  try { info = getInfo() || {}; } catch (e) { /* 記録のための情報が取れなくても続ける */ }
  data.live = {
    ts: Date.now(), clean: false, up: Math.round((performance.now() - t0) / 1000),
    canvases: counters.canvases, canvasMB: Math.round(counters.canvasMB),
    ...info,
  };
  write();
}
function markClean() {
  if (!data.live) return;
  data.live.clean = true;
  write();
}

// 起動時に呼ぶ。info は今の様子を返す関数（main.js）。前回の異常終了があれば、その記録を返す
export function initDiag(info) {
  getInfo = info;
  data.launches = (data.launches || 0) + 1;
  if (data.live && !data.live.clean) {
    fresh = { ...data.live };
    delete fresh.clean;
    data.crashes.unshift(fresh);
    data.crashes.length = Math.min(data.crashes.length, MAX);
  }
  data.live = null;
  write();
  beat();
  setInterval(beat, BEAT);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') beat(); else markClean(); });
  window.addEventListener('pagehide', markClean);
  return fresh;
}

export function diagCrashes() { return data.crashes; }
export function diagLaunches() { return data.launches || 0; }
export function clearDiag() {
  data.crashes = [];
  write();
}
