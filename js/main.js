// =====================================================================
//  JEWEL SURVIVOR  ─  エントリーポイント
// =====================================================================
import { Game } from './game.js';
import { Input } from './input.js';
import { audio } from './audio.js';
import { save, persist } from './save.js';
import { ACHIEVEMENTS, GEMS, WEAPON_IDS, ENEMIES } from './data.js';
import { STAGES, STAGE_BY_ID, heatMods } from './stages.js';
import { gemSprite, starSprite, backgroundTile } from './render.js';
import { TAU, rand, pick } from './util.js';
import * as UI from './ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input(canvas, document.getElementById('joy'), document.getElementById('joyknob'));
const params = new URLSearchParams(location.search);
const DEBUG = {
  bot: params.has('bot'),
  speed: +(params.get('speed') || 1),
  start: +(params.get('t') || 0),
  god: params.has('god'),
  autostart: params.get('auto'),
  build: params.get('build'),
  stage: params.get('stage'),
  heat: +(params.get('heat') || 0),
  norender: params.has('norender'),
};

let game = null;
let reloadPending = false; // 新しい版の反映待ち

// iOS: ダブルタップ ズーム / ピンチ ぼうし
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
// さいしょの タッチで 音を ONにする
const unlock = () => audio.unlock();
window.addEventListener('touchend', unlock, { passive: true });
window.addEventListener('click', unlock);
window.addEventListener('keydown', unlock);

// ------------------------------------------------------------------ タイトル背景
const titleGems = [];
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  if (game) game.resize();
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 200));
resizeCanvas();

let titleT = 0;
function renderTitle(dt) {
  titleT += dt;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = innerWidth, H = innerHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#06060b';
  ctx.fillRect(0, 0, W, H);
  // グリッド
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = ctx.createPattern(backgroundTile(), 'repeat');
  ctx.save();
  ctx.translate(0, (titleT * 12) % 256);
  ctx.fillRect(0, -256, W, H + 256);
  ctx.restore();
  ctx.globalAlpha = 1;
  // 中央の ぼんやりした光
  const cg = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, Math.max(W, H) * 0.6);
  cg.addColorStop(0, 'rgba(110,60,200,0.28)');
  cg.addColorStop(0.5, 'rgba(40,20,90,0.12)');
  cg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cg;
  ctx.fillRect(0, 0, W, H);
  // 漂うジュエル
  while (titleGems.length < 16) {
    titleGems.push({
      x: rand(W), y: titleGems.length < 10 ? rand(H) : H + 40, s: rand(14, 40), v: rand(12, 40), r: rand(TAU), vr: rand(-1, 1),
      id: pick(WEAPON_IDS),
    });
  }
  for (const t of titleGems) {
    t.y -= t.v * dt;
    t.r += t.vr * dt;
    if (t.y < -60) { t.y = H + 60; t.x = rand(W); t.id = pick(WEAPON_IDS); }
    const x = t.x + Math.sin(titleT * 0.7 + t.s) * 10;
    const depth = t.s / 40;
    const col = GEMS[t.id].rainbow ? '#e0d0ff' : GEMS[t.id].color;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 * depth;
    const glow = starSprite(col);
    ctx.drawImage(glow, x - t.s * 1.6, t.y - t.s * 1.6, t.s * 3.2, t.s * 3.2);
    ctx.globalCompositeOperation = 'source-over';
    const spr = gemSprite(t.id, 32);
    const L = spr.logical * (t.s / 32);
    ctx.save();
    ctx.translate(x, t.y);
    ctx.rotate(Math.sin(t.r) * 0.4);
    ctx.globalAlpha = 0.35 + 0.55 * depth;
    ctx.drawImage(spr, -L / 2, -L / 2, L, L);
    ctx.restore();
  }
  // 光の粒
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    const x = (Math.sin(i * 12.3 + titleT * 0.13) * 0.5 + 0.5) * W;
    const y = (Math.cos(i * 7.1 + titleT * 0.09) * 0.5 + 0.5) * H;
    const s = 3 + (Math.sin(titleT * 2 + i * 1.7) * 0.5 + 0.5) * 7;
    ctx.globalAlpha = 0.6;
    ctx.drawImage(starSprite(i % 3 ? '#ffffff' : '#c9a4ff'), x - s, y - s, s * 2, s * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// ------------------------------------------------------------------ ループ
let last = performance.now();
function loop(now) {
  // 1 フレームの例外でループが止まり、ゲームが固まらないよう、次のフレームは先に予約しておく
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  try {
    step(dt);
  } catch (e) {
    console.error(e);
  }
}
function step(dt) {
  if (game) {
    if (game.state === 'play') {
      const v = input.read();
      game.input.x = v.x;
      game.input.y = v.y;
      if (moveHint && (v.x || v.y)) { moveHint.classList.add('gone'); moveHint = null; }
    }
    for (let i = 0; i < DEBUG.speed; i++) game.frame(dt);
  } else {
    renderTitle(dt);
  }
}
requestAnimationFrame(loop);

// ------------------------------------------------------------------ トロフィー
function checkAchievements(r, live) {
  const got = [];
  for (const a of ACHIEVEMENTS) {
    if (save.achievements[a.id]) continue;
    if (!r && !a.meta) continue; // r が無いとき（研磨工房など）は meta の実績だけ判定
    if (!a.check(r || {}, save)) continue;
    save.achievements[a.id] = true;
    save.coins += a.coins;
    if (a.unlock && !save.unlocked[a.unlock]) {
      save.unlocked[a.unlock] = true;
    }
    got.push(a);
    if (live) UI.toast(a.name, `+${a.coins} コイン${a.unlock ? ` ／ ${GEMS[a.unlock].jp} 解放` : ''}`);
  }
  if (got.length) persist();
  return got;
}

// ------------------------------------------------------------------ ゲーム
const hooks = {
  hud: (g) => UI.hud(g),
  banner: (t, k, s) => UI.banner(t, k, s),
  bossBar: (e) => UI.bossBar(e),
  fever: (on) => UI.feverUI(on),
  combo: (n) => UI.comboBanner(n),
  coinPop: () => UI.coinPop(),
  haptic: () => UI.haptic(),
  levelUp: (g, done) => UI.levelUp(g, done),
  chest: (g, big, done) => UI.chest(g, big, done),
  checkAchievements: (r, live) => checkAchievements(r, live),
  gameOver: (res, cleared) => finishRun(res, cleared),
};

let achDuringRun = [];
let moveHint = null;
function startGame(charId, opt = {}) {
  if (typeof opt === 'boolean') opt = { endless: opt };
  const stage = STAGE_BY_ID[opt.stageId] || STAGE_BY_ID.wastes;
  UI.clearScreens();
  audio.unlock();
  input.reset();
  input.enabled = true;
  const botHooks = DEBUG.bot ? {
    // テスト用：自動で えらぶ
    levelUp: (g, done) => {
      const cs = g.rollChoices();
      const pri = { evo: 0, wnew: g.weapons.length < 4 ? 1 : 5, wup: 2, pnew: 3, pup: 4 };
      cs.sort((a, b) => (pri[a.type] ?? 9) - (pri[b.type] ?? 9));
      g.applyChoice(cs[0]);
      done();
    },
    chest: (g, big, done) => { g.rollChest(big); done(); },
  } : {};
  game = new Game(canvas, {
    ...hooks,
    ...botHooks,
    checkAchievements: (r, live) => { achDuringRun.push(...checkAchievements(r, live)); },
  },{ charId, endless: !!opt.endless, stageId: stage.id, heat: opt.heat || 0, bot: DEBUG.bot, god: DEBUG.god, startTime: DEBUG.start, build: DEBUG.build, noRender: DEBUG.norender });
  achDuringRun = [];
  window.__game = game; // デバッグ用
  UI.hudShow(true);
  moveHint = document.getElementById('movehint');
  moveHint.classList.remove('hidden', 'gone');
  audio.tempoMul = 1;
  audio.playBgm(stage.bgm);
  const m = Math.floor(stage.time / 60);
  UI.banner(stage.en, 'start', `${m}:00 — ${ENEMIES[stage.finalBoss].name}を撃破せよ`);
  save.stats.runs++;
  persist();
}

function finishRun(res, cleared) {
  cleared = cleared || !!res.cleared; // 最終ボス撃破後、クリア画面の前に倒れた・リタイアした場合もクリア扱い
  input.enabled = false;
  input.reset();
  UI.hudShow(false);
  document.getElementById('movehint').classList.add('hidden');
  audio.tempoMul = 1;
  // セーブ
  const stage = STAGE_BY_ID[res.stageId] || STAGE_BY_ID.wastes;
  const rec = save.stages[stage.id] || (save.stages[stage.id] = {});
  const firstClear = cleared && !rec.cleared;
  let unlocked = null, nextStage = null;
  if (cleared) {
    if (!rec.cleared) {
      rec.cleared = true;
      if (stage.unlockChar && !save.unlocked[stage.unlockChar]) { save.unlocked[stage.unlockChar] = true; unlocked = stage.unlockChar; }
      const nx = STAGES[stage.no];
      if (nx) nextStage = nx.name;
    }
    rec.heat = Math.max(rec.heat ?? 0, res.heat || 0);
  }
  rec.best = Math.max(rec.best || 0, res.time);
  const coinsEarned = Math.round(res.coins * heatMods(res.heat || 0).coin + (firstClear ? stage.reward : cleared ? 500 : 0));
  save.coins += coinsEarned;
  save.totalCoins += coinsEarned;
  save.stats.kills += res.kills;
  if (cleared) save.stats.clears++;
  for (const [k, v] of Object.entries(res.killsByType)) save.kills[k] = (save.kills[k] || 0) + v;
  for (const [t, n] of Object.entries(res.roughGot || {})) save.rough[t] = (save.rough[t] || 0) + n;
  const newBest = {};
  for (const k of ['time', 'kills', 'level', 'damage']) {
    const v = res[k];
    newBest[k] = v > (save.best[k] || 0) && save.stats.runs > 1;
    if (v > (save.best[k] || 0)) save.best[k] = v;
  }
  const newAch = [...achDuringRun, ...checkAchievements(res, false)];
  persist();
  if (DEBUG.bot) window.__lastResult = { ...res, cleared };
  UI.results(res, cleared, { coinsEarned, newBest, newAch, firstClear, unlocked, nextStage });
}

function toTitle() {
  if (reloadPending) { location.reload(); return; }
  game = null;
  window.__game = null;
  input.enabled = false;
  UI.hudShow(false);
  UI.showTitle();
}

// ポーズ
document.getElementById('pausebtn').addEventListener('click', () => {
  if (!game || !game.pause()) return;
  audio.tap();
  UI.pauseMenu(game, () => game && game.resume(), () => {
    game.state = 'over';
    audio.stopBgm();
    finishRun(game.results(), false);
  });
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    audio.suspend();
    input.reset(); // 指を離したことが伝わらずスティックが効かなくなるのを防ぐ
    if (game && game.pause()) {
      UI.pauseMenu(game, () => game && game.resume(), () => {
        game.state = 'over';
        audio.stopBgm();
        finishRun(game.results(), false);
      });
    }
  } else audio.resume();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') document.getElementById('pausebtn').click();
});

// 旧バージョンのセーブ：ステージ1クリア済みなら引き継ぐ
if (save.stats.clears > 0 && !(save.stages.wastes && save.stages.wastes.cleared)) {
  save.stages.wastes = { cleared: true, heat: 0, best: save.best.time || 600 };
  persist();
}

UI.initUI({ startGame, toTitle, checkMetaAchievements: () => checkAchievements(null, true) });
window.__save = save; // デバッグ用

if (DEBUG.autostart) startGame(DEBUG.autostart in GEMS ? DEBUG.autostart : 'ruby', { endless: params.has('endless'), stageId: DEBUG.stage, heat: DEBUG.heat });
else UI.showTitle();

// オフライン用 サービスワーカー
// 新しい版が入ったら自動で再読み込み（プレイ中・リザルト中ならタイトルに戻ったときに）
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    // アプリに戻ってきたときにも更新を確認する（iOS のホーム画面アプリは再読み込みされないため）
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // 初回インストール時は不要
    if (game) reloadPending = true;
    else location.reload();
  });
}
