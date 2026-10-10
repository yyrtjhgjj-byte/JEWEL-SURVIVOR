// =====================================================================
//  JEWEL SURVIVOR  ─  エントリーポイント
// =====================================================================
import { Game } from './game.js';
import { refreshLot } from './auction.js';
import { Input } from './input.js';
import { audio } from './audio.js';
import { save, persist } from './save.js';
import { ACHIEVEMENTS, GEMS, WEAPON_IDS, ENEMIES, SHOP, UPPER_SHOP, shopCost } from './data.js';
import { ARTIFACTS } from './artifacts.js';
import { STAGES, STAGE_BY_ID } from './stages.js';
import { gemSprite, starSprite, backgroundTile, clearEnemySprites } from './render.js';
import { TAU, rand, pick } from './util.js';
import * as UI from './ui.js';
import { addRankExp, runExp, settleRank } from './rank.js';
import { initDiag } from './diag.js';

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
  // BOSS モード：rush=武器,武器/チャーム,チャーム（空なら、そのジュエルの武器だけ）
  rush: params.has('rush') ? params.get('rush') : null,
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
let titlePattern = null; // 背景の模様（毎フレーム作り直さない）
function renderTitle(dt) {
  titleT += dt;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = innerWidth, H = innerHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#06060b';
  ctx.fillRect(0, 0, W, H);
  // グリッド
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = titlePattern || (titlePattern = ctx.createPattern(backgroundTile(), 'repeat'));
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
    const art = ARTIFACTS.find((x) => x.ach === a.id);
    if (live) UI.toast(a.name, `+${a.coins} コイン${a.unlock ? ` ／ ${GEMS[a.unlock].jp} 解放` : ''}${art ? ` ／ 秘宝「${art.name}」解放` : ''}`);
  }
  if (got.length) persist();
  return got;
}

// ------------------------------------------------------------------ ゲーム
const hooks = {
  hud: (g) => UI.hud(g),
  banner: (t, k, s) => UI.banner(t, k, s),
  bossBar: (e) => UI.bossBar(e),
  fever: (on, sec) => UI.feverUI(on, sec),
  combo: (n) => UI.comboBanner(n),
  coinPop: () => UI.coinPop(),
  haptic: () => UI.haptic(),
  levelUp: (g, done) => UI.levelUp(g, done),
  chest: (g, big, done) => UI.chest(g, big, done),
  artifact: (g, done) => UI.artifactChoice(g, done),
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
    artifact: (g, done) => { const c = g.artifactChoices(); if (c.length) g.addArtifact(c[0]); done(); },
  } : {};
  clearEnemySprites();
  game = new Game(canvas, {
    ...hooks,
    ...botHooks,
    checkAchievements: (r, live) => { achDuringRun.push(...checkAchievements(r, live)); },
  },{ charId, artifact: opt.artifact || null, artifact2: opt.artifact2 || null, endless: !opt.rush && !!opt.endless, hyper: !!opt.hyper, hurry: !opt.rush && !!opt.hurry, stageId: stage.id, heat: opt.rush ? 0 : opt.heat || 0, rush: opt.rush || null, bot: DEBUG.bot, god: DEBUG.god, startTime: opt.resume ? opt.resume.time : DEBUG.start, build: DEBUG.build, noRender: DEBUG.norender });
  achDuringRun = [];
  window.__game = game; // デバッグ用
  UI.hudShow(true);
  if (opt.resume) game.restore(opt.resume); // 中断したランの続き（HUD の準備のあとに）
  moveHint = document.getElementById('movehint');
  moveHint.classList.remove('hidden', 'gone');
  audio.tempoMul = 1;
  if (!(opt.resume && game.boss)) audio.playBgm(stage.bgm);
  const m = Math.floor(stage.time / 60);
  if (opt.resume) UI.banner('RESUME', 'start', opt.rush ? `BOSS ・ STAGE ${stage.no}` : stage.name);
  else if (opt.rush) {
    UI.banner('BOSS RUSH', 'start', `STAGE ${stage.no} のボス ${game.rushOrder.length} 体 ・ 1 周ごとに ×2`);
    save.stats.runs++;
  } else {
    UI.banner(stage.en, 'start', `${m}:00 — ${ENEMIES[stage.finalBoss].name}を撃破せよ`);
    save.stats.runs++;
  }
  persist();
}

function finishRun(res, cleared) {
  cleared = cleared || !!res.cleared; // 最終ボス撃破後、クリア画面の前に倒れた・リタイアした場合もクリア扱い
  input.enabled = false;
  input.reset();
  UI.hudShow(false);
  document.getElementById('movehint').classList.add('hidden');
  audio.tempoMul = 1;
  const extra = settleRun(res, cleared);
  extra.newAch = [...achDuringRun, ...extra.newAch];
  if (DEBUG.bot) window.__lastResult = { ...res, cleared };
  UI.results(res, cleared, extra);
}

// ランの成績をセーブに反映する（コイン・原石・記録・ステージのクリアなど）
function settleRun(res, cleared) {
  delete save.pendingRun;
  const stage = STAGE_BY_ID[res.stageId] || STAGE_BY_ID.wastes;
  // BOSS モード：ステージのクリアや最長記録には数えず、倒したボスの数の最高記録だけを残す
  let rushBest = false;
  if (res.rush) {
    cleared = false;
    const br = save.bossRush || (save.bossRush = {});
    rushBest = res.rush.kills > (br[stage.id] || 0);
    if (rushBest) br[stage.id] = res.rush.kills;
  }
  const rec = res.rush ? {} : save.stages[stage.id] || (save.stages[stage.id] = {});
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
  // ヒート・HYPER の倍率はラン中のコインに掛け済み（game.js の computeStats）
  const coinsEarned = Math.round(res.coins + (firstClear ? stage.reward : cleared ? 500 : 0));
  save.coins += coinsEarned;
  save.totalCoins += coinsEarned;
  save.stats.kills += res.kills;
  if (cleared) save.stats.clears++;
  for (const [k, v] of Object.entries(res.killsByType)) save.kills[k] = (save.kills[k] || 0) + v;
  for (const [t, n] of Object.entries(res.roughGot || {})) save.rough[t] = (save.rough[t] || 0) + n;
  refreshLot();
  const newBest = {};
  for (const k of ['time', 'kills', 'level', 'damage']) {
    const v = res[k];
    newBest[k] = v > (save.best[k] || 0) && save.stats.runs > 1;
    if (v > (save.best[k] || 0)) save.best[k] = v;
  }
  const rankUp = DEBUG.bot ? null : addRankExp(runExp(res, cleared)); // ユーザーランクの経験値
  const newAch = checkAchievements(res, false);
  persist();
  return { coinsEarned, newBest, newAch, firstClear, unlocked, nextStage, rankUp, rushBest };
}

// 途中保存：ラン中の成績と状態を数秒ごとにセーブへ書いておく。アプリが落ちたり終了させられたりしても、
// 次の起動時に「再開」か「精算」（リタイア扱い。最終ボス撃破後ならクリア扱い）を選べる
function saveRunSnapshot() {
  if (!game || DEBUG.bot || game.state === 'over') return;
  const res = game.results();
  // 最終ボス撃破後は、ENDLESS で続けているときだけ再開できる（それ以外はクリア画面の直前なので精算する）
  if ((!game.cleared || game.endless) && game.state !== 'dying') res.resume = game.snapshot();
  save.pendingRun = res;
  persist();
}
setInterval(saveRunSnapshot, 5000);
window.addEventListener('pagehide', saveRunSnapshot);
function recoverPendingRun() {
  const res = save.pendingRun;
  if (!res || typeof res !== 'object' || !res.stageId) { delete save.pendingRun; return; }
  const settle = () => {
    const r = settleRun(res, !!res.cleared);
    if (r.coinsEarned > 0) setTimeout(() => UI.toast('中断したプレイの報酬を反映', `+${r.coinsEarned} コイン`, 'RECOVERED'), 600);
  };
  if (res.resume && (!res.cleared || res.endless) && STAGE_BY_ID[res.stageId]) {
    UI.resumePrompt(res, () => {
      // 中断の記録はここでは消さない（再開した直後に落ちたり再読み込みされたりしても、もう一度再開できるように）。
      // 再開したランの途中保存で上書きされ、ランが終われば settleRun で消える
      startGame(res.charId, { stageId: res.stageId, heat: res.heat || 0, endless: !!res.endless, hyper: !!res.hyper, hurry: !!res.hurry, rush: res.rush ? { w: res.rush.w, p: res.rush.p } : null, resume: res.resume });
    }, () => { settle(); UI.refreshCoinPill(); });
  } else settle();
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
// リタイア（最終ボス撃破後、クリア画面の前なら盤面のアイテムも回収する）
function quitRun() {
  if (game.cleared && !game.endless) game.sweepPickups();
  game.state = 'over';
  audio.stopBgm();
  finishRun(game.results(), false);
}
document.getElementById('pausebtn').addEventListener('click', () => {
  if (!game || !game.pause()) return;
  audio.tap();
  UI.pauseMenu(game, () => game && game.resume(), quitRun);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    saveRunSnapshot();
    audio.suspend();
    input.reset(); // 指を離したことが伝わらずスティックが効かなくなるのを防ぐ
    if (game && game.pause()) UI.pauseMenu(game, () => game && game.resume(), quitRun);
  } else audio.resume();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') document.getElementById('pausebtn').click();
});

// 旧バージョンのセーブの移行。起動時と、バックアップの読み込み時に行う。工房の返金額（上位工房の入れ替えの分）を返す
function migrateSave() {
  // 旧バージョンのセーブ：ステージ1クリア済みなら引き継ぐ
  if (save.stats.clears > 0 && !(save.stages.wastes && save.stages.wastes.cleared)) {
    save.stages.wastes = { cleared: true, heat: 0, best: save.best.time || 600 };
    persist();
  }
  // 旧セーブ：全ステージ共通だった HEAT の選択を、最後に選んでいたステージの分として引き継ぐ
  if ('heatSel' in save) {
    if (save.heatSel && save.heatSels[save.selectedStage] === undefined) save.heatSels[save.selectedStage] = save.heatSel;
    delete save.heatSel;
    persist();
  }
  if (settleRank()) persist(); // ランクの必要経験値を下げた分を反映
  // ログインボーナスを連続日数から累計日数に変えた：それまでの連続日数を累計として引き継ぐ
  if (save.login && 'streak' in save.login) {
    save.login.days = Math.max(save.login.days || 0, save.login.streak || 0);
    delete save.login.streak;
    persist();
  }
  // 虚空聖堂をクリア済みなら、あとから追加したオブシディアンを解放する
  if (save.stages.void && save.stages.void.cleared && !save.unlocked.obsidian) { save.unlocked.obsidian = true; persist(); }
  // 宝石の所持数を数える前のセーブは、研磨数をそのまま所持数にする
  if (Object.values(save.jewels).some((r) => r.have === undefined)) {
    for (const r of Object.values(save.jewels)) if (r.have === undefined) r.have = r.n || 0;
    persist();
  }
  // 「裏工房」を「上位工房」に改名した：セーブの名前も移す
  if ('backShop' in save) {
    if (save.backShop) save.upperShop = true;
    delete save.backShop;
    persist();
  }
  if (save.shopPaid && 'back' in save.shopPaid) {
    save.shopPaid.upper = (save.shopPaid.upper || 0) + (save.shopPaid.back || 0);
    delete save.shopPaid.back;
    persist();
  }
  // 工房の返金額：払ったコインを記録する前のセーブは、当時の値段（工房は今の半分、上位工房は今と同じ）で数えて引き継ぐ
  if (!save.shopPaid) {
    const sum = (up, cost) => SHOP.reduce((a, it) => { for (let i = 0; i < ((up || {})[it.id] || 0); i++) a += cost(it, i); return a; }, 0);
    const oldBack = (it) => (['reroll', 'skip', 'banish', 'revive', 'amount'].includes(it.id) ? 12 : 6); // 旧上位工房の値段（工房の 6 倍、回数系などは 12 倍）
    save.shopPaid = { front: sum(save.upgrades, (it, i) => shopCost(it, i) / 2), upper: sum(save.upgrades2, (it, i) => shopCost(it, i) * oldBack(it)) };
    persist();
  }
  // 上位工房の中身を専用の強化に入れ替えた：旧上位工房（工房の半分の効果）で強化していた分は、払ったコインを全額返す
  let upperRefund = 0;
  if (Object.keys(save.upgrades2 || {}).some((k) => !UPPER_SHOP.some((it) => it.id === k))) {
    upperRefund = save.shopPaid.upper || 0;
    save.coins += upperRefund;
    save.upgrades2 = {};
    save.upgrades2Off = {};
    save.shopPaid.upper = 0;
    persist();
  }
  // 流星のオルゴールの解放を Lv.50 から Lv.15 の実績に移した：Lv.30 以上の実績があれば Lv.15 も達成済みにする
  if (!save.achievements.lv15 && (save.achievements.lv30 || save.achievements.lv50)) {
    save.achievements.lv15 = true;
    save.coins += ACHIEVEMENTS.find((a) => a.id === 'lv15').coins;
    persist();
  }
  // 生存時間の実績を HURRY の倍速を含まない時間で判定していたため、HURRY で 10 分（20 分）を超えても取れていなかった。
  // クリア済みステージの最長記録（画面の時計）から付ける（最終ボスの 3 分以上あとまで続く記録は、実際にはエンドレスでしか出ない）
  const mig = save.migrated || (save.migrated = {});
  if (!mig.endlessTime) {
    mig.endlessTime = true;
    const longest = Math.max(0, ...STAGES.filter((st) => (save.stages[st.id] || {}).cleared).map((st) => save.stages[st.id].best || 0));
    for (const [id, sec] of [['endless20', 600], ['endless40', 1200]]) {
      if (save.achievements[id] || longest < sec) continue;
      save.achievements[id] = true;
      save.coins += ACHIEVEMENTS.find((a) => a.id === id).coins;
    }
    persist();
  }
  // 解放条件を実績に移したキャラ：すでにその実績を持っていれば解放しておく
  for (const a of ACHIEVEMENTS) {
    if (a.unlock && save.achievements[a.id] && !save.unlocked[a.unlock]) {
      save.unlocked[a.unlock] = true;
      persist();
    }
  }
  return upperRefund;
}
const upperRefund = migrateSave();

UI.initUI({ startGame, toTitle, migrateSave, checkMetaAchievements: () => checkAchievements(null, true) });

// 動作の記録（diag.js）：画面に出ている間に落ちたら、次の起動でこの様子が記録に残る
const crashed = initDiag(() => {
  const top = document.getElementById('screens').lastElementChild;
  const info = {
    screen: top ? [...top.classList].filter((c) => c !== 'screen' && c !== 'dim').join(' ') || 'screen' : '',
    audioNodes: audio.nodeCount, w: innerWidth, h: innerHeight, dpr: window.devicePixelRatio || 1,
    os: (navigator.userAgent.match(/OS ([\d_]+)/) || [])[1] || '',
  };
  const g = game;
  if (g && g.state !== 'over') {
    info.run = {
      stage: g.stage.id, time: Math.round(g.time), heat: g.heat, endless: g.endless, hyper: g.hyper, state: g.state, level: g.level,
      enemies: g.enemies.length, projs: g.projs.length, bullets: g.ebullets.length, pickups: g.pickups.length, parts: g.fx.parts.length,
      areas: g.areas.length, quality: g.quality || 0, fps: Math.round(1 / (g.frameAvg || 1 / 60)),
      boss: g.boss && g.boss.alive ? g.boss.type : null,
      weapons: g.weapons.map((w) => w.id + (w.evolved ? '*' : w.level)).join(','),
    };
  }
  return info;
});
window.__save = save; // デバッグ用

if (DEBUG.autostart) {
  if (save.pendingRun) { delete save.pendingRun; persist(); }
  const rs = DEBUG.rush !== null ? DEBUG.rush.split('/') : null;
  const rush = rs ? { w: (rs[0] || '').split(',').filter(Boolean), p: (rs[1] || '').split(',').filter(Boolean) } : null;
  startGame(DEBUG.autostart in GEMS ? DEBUG.autostart : 'ruby', { endless: params.has('endless'), hyper: params.has('hyper'), hurry: params.has('hurry'), artifact: params.get('art'), stageId: DEBUG.stage, heat: DEBUG.heat, rush });
} else {
  UI.showTitle();
  recoverPendingRun(); // 再開の確認はタイトル（ログインボーナス）の上に出す
  if (upperRefund) setTimeout(() => UI.toast('上位工房の入れ替えに伴い返金', `+${upperRefund.toLocaleString()} コイン`, 'MASTERWORKS'), 900);
  if (crashed) setTimeout(() => UI.toast('前回は途中で終了しました', '設定の「動作の記録」に残しました', 'DIAGNOSTIC'), 1500);
}

// オフライン用 サービスワーカー
// 新しい版が入ったら自動で再読み込みする。ただし、何も開いていないタイトル画面にいるときだけ
// （再開の確認・研磨・オークションなどの途中で読み込み直すと、操作が失われる。特に再開の確認中は、
// 押した直後に読み込み直しが重なるとランが失われていた）
function safeToReload() {
  if (game || save.pendingRun) return false;
  const s = document.getElementById('screens');
  return s.children.length === 1 && s.firstElementChild.classList.contains('title-screen');
}
setInterval(() => { if (reloadPending && safeToReload()) location.reload(); }, 1500);
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    // アプリに戻ってきたときにも更新を確認する（iOS のホーム画面アプリは再読み込みされないため）
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // 初回インストール時は不要
    if (safeToReload()) location.reload();
    else reloadPending = true;
  });
}
