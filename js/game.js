// =====================================================================
//  ゲーム本体
// =====================================================================
import {
  GEMS, WEAPONS, WEAPON_IDS, WEAPON_MAX, PASSIVES, PASSIVE_IDS, MAX_WEAPONS, MAX_CHARMS, BASE_STATS, CHARACTERS, ENEMIES, SHOP, LIMIT_BREAK, backShopRate,
} from './data.js';
import { TAU, rand, randi, pick, chance, weightedPick, mix } from './util.js';
import { STAGE_BY_ID, heatMods } from './stages.js';
import { AI, onEnemyKilled } from './enemies.js';
import { Hazards } from './hazards.js';
import { collectionStats, eliteDrop, bossDrop, upgradeTier, ROUGH } from './atelier.js';
import { ARTIFACT_BY_ID, ARTIFACT_MAX, unlockedArtifacts } from './artifacts.js';
import { FX } from './fx.js';
import { ELEMENTS, recalcElements, procElement, elementVs, tickElements, elementMove, blindDt, touchMul, onElementHit, onElementKill, updateElements, earthGuard, earthBreak } from './elements.js';
import { LOGIC, weaponStats, drawArea } from './weapons.js';
import { enemySprite, drawPlayer, xpSprite, itemSprite, roughSprite, backgroundTile, starSprite, dotSprite, softSprite } from './render.js';
import { audio } from './audio.js';
import { save } from './save.js';

// ------------------------------------------------------------------ 空間グリッド
class Grid {
  constructor(cell = 64) {
    this.cell = cell;
    this.map = new Map();
    this.used = [];
    // 体の大きい敵（ボスなど）は中心のセルだけでは縁の当たりを取りこぼすので別に持つ
    this.big = [];
  }
  clear() {
    for (const a of this.used) a.length = 0;
    this.used.length = 0;
    this.big.length = 0;
  }
  key(cx, cy) { return (cx + 32768) * 65536 + (cy + 32768); }
  insert(e) {
    if (e.r > 24) { this.big.push(e); return; }
    const k = this.key(Math.floor(e.x / this.cell), Math.floor(e.y / this.cell));
    let a = this.map.get(k);
    if (!a) { a = []; this.map.set(k, a); }
    if (a.length === 0) this.used.push(a);
    a.push(e);
  }
  query(x, y, r, out) {
    out.length = 0;
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const a = this.map.get(this.key(cx, cy));
        if (a) for (let i = 0; i < a.length; i++) out.push(a[i]);
      }
    }
    for (const e of this.big) {
      const rr = r + e.r;
      if ((e.x - x) ** 2 + (e.y - y) ** 2 < rr * rr) out.push(e);
    }
    return out;
  }
}

// ステージの色に 敵を染める
const BASE_COL = { slime: '#7a64a8', bat: '#5a4a80', ghost: '#9c90c8', toge: '#6a3a70', golem: '#7a6a60', knight: '#3c3456' };
const tintCache = {};
function TINT(type, tint) {
  const k = type + tint;
  if (tintCache[k]) return tintCache[k];
  const m = mix(BASE_COL[type] || '#6b5a8e', tint, 0.55).match(/\d+/g).map(Number);
  return (tintCache[k] = '#' + m.map((v) => v.toString(16).padStart(2, '0')).join(''));
}

const KILL_MILESTONES = [100, 250, 500, 1000, 1500, 2000, 3000, 4000, 5000, 7500, 10000];

// さいしょは すぐ レベルアップ → だんだん ゆっくり
// 必要経験値（初期カーブの 1.75 × 1.8 倍）
const xpFor = (l) => Math.round(1.75 * 1.8 * (3 + (l - 1) * 4 + Math.max(0, l - 15) * 4 + Math.max(0, l - 30) * 6 + Math.max(0, l - 60) * 10));

export class Game {
  constructor(canvas, hooks, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;
    this.charId = opts.charId || 'ruby';
    this.endless = !!opts.endless;
    this.hyper = !!opts.hyper; // 自機・敵の移動 ×1.65、敵弾 ×1.2、コイン ×1.5
    this.hurry = !!opts.hurry; // ステージの時計が 2 倍速で進む
    this.banished = new Set(); // バニッシュした武器・チャーム（このランでは候補に出ない）
    // 秘宝
    this.arts = [];
    this.artSet = new Set();
    this.revBuff = 0; // 護石のペンダント：復活した回数
    this.healedTotal = 0;
    this.moved = 0;
    this.goldFeverT = 0;
    this.goldFeverCd = 0;
    this.prismT = 0;
    this.stage = STAGE_BY_ID[opts.stageId] || STAGE_BY_ID.wastes;
    this.heat = opts.heat || 0;
    this.heatM = heatMods(this.heat);
    this.stageTime = this.stage.time;
    this.stageDmg = this.stage.dmg * this.heatM.dmg;
    this.lasers = [];
    this.warns = [];
    this.hazards = new Hazards(this, this.stage);
    this.bot = !!opts.bot;
    this.god = !!opts.god;
    this.noRender = !!opts.noRender;
    this.fx = new FX();
    this.grid = new Grid(64);
    this.enemies = [];
    this.projs = [];
    this.areas = [];
    this.pickups = [];
    this.ebullets = [];
    this.weapons = [];
    this.passives = [];
    this.input = { x: 0, y: 0 };
    this.time = opts.startTime || 0;
    this.state = 'play';
    this.modalQueue = [];
    this.roughGot = { shard: 0, rough: 0, large: 0, mystic: 0 }; // 拾った原石
    this.eid = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNext = xpFor(1);
    this.pendingLevels = 0;
    this.kills = 0;
    this.coins = 0;
    this.totalDmg = 0;
    this.dmgBy = {};
    this.combo = 0;
    this.comboT = 0;
    this.maxCombo = 0;
    this.feverGauge = 0;
    this.feverNeed = 120;
    this.feverT = 0;
    this.fevers = 0;
    this.evolvedCount = 0;
    this.bosses = 0;
    this.miracles = 0;
    this.killsByType = {};
    this.timeScale = 1;
    this.slowT = 0;
    this.timeStopT = 0;
    this.spawnAcc = 0;
    this.eventIdx = 0;
    while (this.eventIdx < this.stage.events.length && this.stage.events[this.eventIdx].t < this.time) this.eventIdx++;
    this.propT = 5;
    this.boss = null;
    this.milestoneIdx = 0;
    this.healCap = 0;
    this.healShow = 0; // 表示待ちの回復量
    this.healShowT = 0;
    this.acc = 0;
    this.hudT = 0;
    this.achT = 0;
    this.cleared = false;
    this.nextEndlessBoss = Math.max(this.stageTime, this.time) + 180;
    this.nextEndlessEvent = Math.max(this.stageTime, this.time) + 45;
    this.rerolls = 0;
    this.player = { x: 0, y: 0, r: 12, hp: 100, maxHp: 100, face: 1, dirX: 1, dirY: 0, moving: false, hurtT: 0, iT: 0, slowT: 0, slowMul: 1 };
    this.computeStats();
    this.player.hp = this.stats.maxHp;
    this.rerolls = this.stats.reroll;
    this.skips = this.stats.skip;
    this.banishes = this.stats.banish;
    this.revives = this.stats.revive;
    this.startWeapon = CHARACTERS[this.charId].weapon;
    this.addWeapon(CHARACTERS[this.charId].weapon);
    this.lodestoneNext = (Math.floor(this.time / 120) + 1) * 120;
    this.hopeNext = this.time + 60;
    if (opts.artifact && ARTIFACT_BY_ID[opts.artifact]) this.addArtifact(opts.artifact, true);
    if (opts.build) this.debugBuild(opts.build);
    this.resize();
  }

  // ---------------------------------------------------------------- ステータス
  computeStats() {
    const s = { ...BASE_STATS };
    const add = (per, lv = 1) => { for (const k in per) s[k] = (s[k] || 0) + per[k] * lv; };
    add(CHARACTERS[this.charId].stats);
    for (const it of SHOP) {
      const lv = save.upgrades[it.id] || 0;
      if (lv && !save.upgradesOff[it.id]) add(it.per, lv); // 工房で無効にした強化は入れない
      const lv2 = (save.upgrades2 || {})[it.id] || 0; // 裏工房
      if (lv2 && !(save.upgrades2Off || {})[it.id]) add(it.per, lv2 * backShopRate(it).eff);
    }
    s.might += 0.05 * (save.awaken[this.charId] || 0);
    add(collectionStats()); // 研磨コレクションの練度ボーナス
    // 秘宝
    if (this.artSet && this.artSet.has('box')) {
      const empty = Math.max(0, MAX_WEAPONS - (this.weapons ? this.weapons.length : 1));
      s.might += 0.2 * empty;
      s.cooldown -= 0.08 * empty;
    }
    if (this.revBuff) {
      const n = this.revBuff;
      s.maxHp *= 1 + 0.2 * n;
      s.armor += n;
      s.might += 0.1 * n;
      s.area += 0.1 * n;
      s.speed += 0.1 * n;
      s.duration += 0.1 * n;
    }
    if (this.artSet && this.artSet.has('prism')) s.area *= 1.75 + 1.25 * Math.sin((this.time / 10) * TAU);
    for (const p of this.passives) add(PASSIVES[p.id].per, p.level);
    recalcElements(this);
    s.cooldown = Math.max(0.35, s.cooldown);
    const oldMax = this.stats ? this.stats.maxHp : s.maxHp;
    this.stats = s;
    const p = this.player;
    if (p) {
      p.maxHp = s.maxHp;
      if (s.maxHp > oldMax) p.hp += s.maxHp - oldMax;
      p.hp = Math.min(p.hp, p.maxHp);
    }
    for (const w of this.weapons) w.s = weaponStats(this, w);
    // 雑魚の硬さを自機の強さに少しだけ連動させる（強さの平方根。完全には連動させず、育てた実感は残す）
    this.trashMul = Math.min(10, Math.max(1, Math.sqrt(this.estPower() / 3500)));
  }

  // 自機の火力の目安（武器 1 つの DPS を bench.js の実測から：Lv1 約 300、Lv4 約 700、Lv8 約 6500、進化後 約 20000）
  estPower() {
    const EST = [300, 420, 560, 700, 1100, 1800, 3200, 6500];
    let sum = 0;
    for (const w of this.weapons) {
      const lb = w.lb || {};
      const base = w.evolved ? 20000 : EST[Math.min(8, w.level) - 1];
      sum += base * (1 + (lb.dmg || 0)) / (1 - (lb.cd || 0)) * (1 + (lb.amount || 0) * 0.25);
    }
    const st = this.stats;
    return sum * st.might / Math.max(0.35, st.cooldown) * (1 + (st.amount || 0) * 0.25);
  }

  // テスト用：ぶきを いっぱい もたせる  build = "ruby,sapphire,...:evo"
  debugBuild(spec) {
    const [list, flag] = spec.split(':');
    const ids = list === 'all' ? WEAPON_IDS.slice(0, 6) : list.split(',').filter((x) => WEAPONS[x]);
    for (const id of ids) {
      const w = this.getWeapon(id) || (this.weapons.length < MAX_WEAPONS ? this.addWeapon(id) : null);
      if (!w) continue;
      w.level = WEAPON_MAX;
      const partner = WEAPONS[id].evo.with;
      if (!this.getPassive(partner) && this.passives.length < MAX_CHARMS) this.addPassive(partner);
      if (flag === 'evo') w.evolved = true;
    }
    this.computeStats();
  }

  addWeapon(id) {
    const w = { id, level: 1, t: 0, evolved: false };
    this.weapons.push(w);
    w.s = weaponStats(this, w);
    if (!this.dmgBy[id]) this.dmgBy[id] = 0;
    save.seen.weapons[id] = true;
    recalcElements(this);
    if (this.artSet.has('box')) this.computeStats(); // 空きの武器枠が変わるので再計算
    return w;
  }
  addPassive(id) {
    const p = { id, level: 1 };
    this.passives.push(p);
    save.seen.passives[id] = true;
    this.computeStats();
    return p;
  }
  hasPassive(id) { return this.passives.some((p) => p.id === id); }
  getWeapon(id) { return this.weapons.find((w) => w.id === id); }
  getPassive(id) { return this.passives.find((p) => p.id === id); }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    this.dpr = dpr;
    this.W = W;
    this.H = H;
    this.stillDrawn = false;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    // みじかい辺に 440 ぐらい 見えるように
    this.zoom = Math.min(W, H) / 370;
    if (Math.max(W, H) / this.zoom > 1100) this.zoom = Math.max(W, H) / 1100;
    this.viewW = W / this.zoom;
    this.viewH = H / this.zoom;
    this.viewR = Math.hypot(this.viewW, this.viewH) / 2;
  }

  // ---------------------------------------------------------------- メインループ
  frame(realDt) {
    const t0 = performance.now();
    if (this.state === 'play' || this.state === 'dying') {
      this.acc += Math.min(realDt, 0.1);
      const step = 1 / 60;
      let n = 0;
      while (this.acc >= step && n < 5) {
        this.update(step * this.timeScale);
        this.acc -= step;
        n++;
      }
      if (n === 5) this.acc = 0;
    } else {
      this.acc = 0;
      this.fx.update(realDt * 0.3); // モーダル中も すこし キラキラ
    }
    const t1 = performance.now();
    // ポーズ・レベルアップなどの画面の間は、止まった盤面を 1 回だけ描いて使い回す
    // （上に重なる画面のぼかしを毎フレーム計算し直さずに済み、古い iPhone の負荷が下がる）
    const live = this.state === 'play' || this.state === 'dying';
    if (!this.noRender && (live || !this.stillDrawn)) this.render();
    this.stillDrawn = !live;
    const t2 = performance.now();
    this.perfU = (this.perfU || 0) * 0.95 + (t1 - t0) * 0.05;
    this.perfR = (this.perfR || 0) * 0.95 + (t2 - t1) * 0.05;
    this.hudT -= realDt;
    if (this.hudT <= 0) {
      this.hudT = 0.05;
      this.hooks.hud(this);
    }
  }

  update(dt) {
    this.time += dt * (this.hurry ? 2 : 1);
    const p = this.player;
    // スローモーション
    if (this.slowT > 0) {
      this.slowT -= dt / Math.max(0.05, this.timeScale);
      if (this.slowT <= 0) this.timeScale = 1;
    }
    if (this.state === 'dying') {
      this.fx.update(dt);
      return;
    }
    this.healCap = Math.max(0, this.healCap - dt * 6);
    updateElements(this, dt);
    // 回復量をまとめて緑の数字で表示
    this.healShowT -= dt;
    if (this.healShowT <= 0) {
      this.healShowT = 0.6;
      if (this.healShow >= 1) {
        const v = Math.floor(this.healShow);
        this.healShow -= v;
        this.fx.text(this.player.x + rand(-8, 8), this.player.y - 26, '+' + v, { size: 15, color: '#5dff9a', life: 0.7 });
        if (this.artSet.has('grail')) {
          // 回復量に応じた衝撃波
          const R = (90 + Math.min(60, v * 2)) * this.stats.area;
          this.aoe(this.player.x, this.player.y, R, v * 60 * this.stats.might, null, { kb: 140 });
          this.fx.ring(this.player.x, this.player.y, 10, R, 0.35, '#5dff9a', 5);
        }
      }
    }

    // ---- 入力
    if (this.bot) this.botInput();
    let ix = this.input.x, iy = this.input.y;
    const il = Math.hypot(ix, iy);
    if (il > 1) { ix /= il; iy /= il; }
    p.moving = il > 0.08;
    p.slowT = Math.max(0, p.slowT - dt);
    if (p.moving) {
      const spd = 150 * this.stats.moveSpeed * this.hazards.speedMul() * (p.slowT > 0 ? p.slowMul : 1) * (this.hyper ? 1.65 : 1);
      p.x += ix * spd * dt;
      p.y += iy * spd * dt;
      this.moved += spd * dt * il;
      const n = Math.hypot(ix, iy) || 1;
      p.dirX = ix / n;
      p.dirY = iy / n;
      if (Math.abs(ix) > 0.1) p.face = ix > 0 ? 1 : -1;
    }
    p.iT = Math.max(0, p.iT - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
    if (this.stats.regen > 0) this.heal(this.stats.regen * dt, true);

    // ---- グリッド
    this.grid.clear();
    for (const e of this.enemies) if (e.alive) this.grid.insert(e);

    this.director(dt);
    this.hazards.update(dt);

    // ---- ぶき
    const wdt = this.artSet.has('wheel') && p.moving ? dt * 1.5 : dt; // 秘宝「研磨ホイール」
    for (const w of this.weapons) LOGIC[w.id].update(this, w, w.s, wdt);
    this.updateArtifacts(dt);

    this.updateProjs(dt);
    this.updateAreas(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateLasers(dt);
    this.updatePickups(dt);
    this.fx.update(dt);

    // ---- コンボ / フィーバー
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    if (this.feverT > 0) {
      this.feverT -= dt;
      if (this.feverT <= 0) {
        audio.tempoMul = 1;
        this.hooks.fever(false);
      }
    }
    this.timeStopT = Math.max(0, this.timeStopT - dt);

    // ---- きろく（テスト用）
    if (this.bot) {
      this.tlT = (this.tlT || 0) - dt;
      if (this.tlT <= 0) {
        this.tlT = 30;
        (this.timeline = this.timeline || []).push(`${Math.round(this.time)}s:Lv${this.level}/k${this.kills}/hp${Math.round(this.player.hp)}/e${this.enemies.length}/pr${this.projs.length}/pt${this.fx.parts.length}/tx${this.fx.texts.length}`);
      }
    }

    // ---- トロフィー チェック
    this.achT -= dt;
    if (this.achT <= 0) {
      this.achT = 1;
      this.hooks.checkAchievements(this.results(), true);
    }

    if (this.modalQueue.length && this.state === 'play') this.openModal();
    else if (this.pendingClear && this.state === 'play') this.finishClear();
  }

  // ---------------------------------------------------------------- しゅつげん
  wave() {
    const W = this.stage.waves;
    let w = W[0];
    for (const x of W) if (this.time >= x[0]) w = x;
    return w;
  }
  hpScale() {
    const m = Math.min(this.time, 600) / 60;
    let s = 1 + 0.375 * m + 0.09 * m * m;
    if (this.time > 600) s *= 1 + (this.time - 600) / 60 * 0.1; // 10分以降
    if (this.time > this.stageTime) s *= 1 + (this.time - this.stageTime) / 60 * 0.15; // エンドレス
    return s * this.stage.hp * this.heatM.hp;
  }

  director(dt) {
    const t = this.time;
    // イベント
    const EV = this.stage.events;
    while (this.eventIdx < EV.length && EV[this.eventIdx].t <= t) {
      this.runEvent(EV[this.eventIdx]);
      this.eventIdx++;
    }
    // エンドレス
    if (this.endless && t > this.stageTime + 5) {
      const late = this.stage.waves[this.stage.waves.length - 2][1];
      if (t >= this.nextEndlessEvent) {
        this.nextEndlessEvent += 40;
        this.runEvent(pick([
          { type: 'swarm', enemy: pick(late), n: 80 }, { type: 'ring', enemy: pick(late), n: 50 },
          { type: 'elite', enemy: pick(late) }, { type: 'elite', enemy: 'knight' }, { type: 'ring', enemy: pick(late), n: 60 },
          { type: 'wall', enemy: (this.stage.events.find((x) => x.type === 'swarm') || {}).enemy || 'bat', n: 70 }, { type: 'vortex', enemy: (this.stage.events.find((x) => x.type === 'swarm') || {}).enemy || 'bat', n: 80 }, { type: 'thief' },
        ]));
      }
      if (t >= this.nextEndlessBoss) {
        this.nextEndlessBoss += 180;
        this.runEvent({ type: 'warning' });
        const bosses = this.stage.events.filter((e) => e.type === 'boss').map((e) => e.enemy);
        this.endlessBoss = { at: t + 8, enemy: pick(bosses), mul: 1 + (t - this.stageTime) / 120 };
      }
      if (this.endlessBoss && t >= this.endlessBoss.at) {
        const b = this.endlessBoss;
        this.endlessBoss = null;
        this.runEvent({ type: 'boss', enemy: b.enemy, mul: b.mul });
      }
    }
    // ふつうの しゅつげん
    const [, types, max0, rate0] = this.wave();
    let max = max0, rate = rate0 * this.heatM.spawn;
    if (this.endless && t > this.stageTime) {
      const k = 1 + (t - this.stageTime) / 300;
      max = Math.min(300, 220 * k);
      rate = 12 * k * this.heatM.spawn;
    }
    // ボス戦の間は雑魚の同時出現数と出現ペースを少し絞る（ボスに集中できるように）
    if (this.boss && this.boss.alive) { max = Math.round(max * 0.65); rate *= 0.65; }
    let alive = 0;
    for (const e of this.enemies) if (e.alive && !e.prop) alive++;
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (alive >= max) { this.spawnAcc = 0; break; }
      const [x, y] = this.ringPos();
      this.spawnEnemy(pick(types), x, y);
      alive++;
    }
    // クリスタル
    this.propT -= dt;
    if (this.propT <= 0) {
      this.propT = 14;
      const props = this.enemies.filter((e) => e.alive && e.prop).length;
      if (props < 3) {
        const a = rand(TAU), d = rand(this.viewR * 0.5, this.viewR * 0.95);
        const cx = this.player.x + Math.cos(a) * d, cy = this.player.y + Math.sin(a) * d;
        if (!this.hazards.blocks(cx, cy)) this.spawnEnemy('crystal', cx, cy);
      }
    }
  }

  ringPos(extra = 40) {
    const p = this.player;
    // うごいている ほうこうに すこし よせる
    let a = rand(TAU);
    if (p.moving && chance(0.4)) a = Math.atan2(p.dirY, p.dirX) + rand(-0.9, 0.9);
    const d = this.viewR + extra + rand(0, 40);
    return [p.x + Math.cos(a) * d, p.y + Math.sin(a) * d];
  }

  runEvent(ev) {
    const p = this.player;
    if (ev.type === 'elite') {
      const [x, y] = this.ringPos();
      this.spawnEnemy(ev.enemy, x, y, { elite: true });
      this.hooks.banner('ELITE', 'elite', '強敵出現 — 撃破で宝箱');
    } else if (ev.type === 'swarm') {
      const a = rand(TAU);
      const cx = p.x + Math.cos(a) * (this.viewR + 60), cy = p.y + Math.sin(a) * (this.viewR + 60);
      for (let i = 0; i < ev.n; i++) {
        const e = this.spawnEnemy(ev.enemy, cx + rand(-80, 80), cy + rand(-80, 80), { soft: true });
        e.swarm = { vx: -Math.cos(a), vy: -Math.sin(a), t: 7 };
      }
      this.hooks.banner('SWARM', 'swarm', '大群接近');
      audio.whoosh();
    } else if (ev.type === 'ring') {
      const R = this.viewR * 0.95;
      for (let i = 0; i < ev.n; i++) {
        const a = (i / ev.n) * TAU;
        this.spawnEnemy(ev.enemy, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R);
      }
      this.hooks.banner('SURROUNDED', 'swarm', '包囲された');
    } else if (ev.type === 'wall') {
      // 横一列の壁になって画面を横切る大群
      const a = rand(TAU), ux = Math.cos(a), uy = Math.sin(a);
      const cx = p.x - ux * (this.viewR + 40), cy = p.y - uy * (this.viewR + 40);
      const len = this.viewR * 2.2;
      for (let i = 0; i < ev.n; i++) {
        const k = (i / (ev.n - 1) - 0.5) * len;
        const e = this.spawnEnemy(ev.enemy, cx - uy * k + rand(-6, 6), cy + ux * k + rand(-6, 6), { soft: true });
        e.swarm = { vx: ux, vy: uy, t: 9 };
      }
      this.hooks.banner('WALL', 'swarm', '大群の壁が迫る');
      audio.whoosh();
    } else if (ev.type === 'vortex') {
      // 渦を巻きながら中心へ迫る大群（中心は出現時の自機の位置）
      const R = this.viewR * 1.05;
      for (let i = 0; i < ev.n; i++) {
        const a = (i / ev.n) * TAU * 2; // 2 周ぶん
        const r = R + (i / ev.n) * 80;
        const e = this.spawnEnemy(ev.enemy, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, { soft: true });
        e.vortex = { cx: p.x, cy: p.y, a, r, t: 11 };
      }
      this.hooks.banner('VORTEX', 'swarm', '渦を巻く大群');
      audio.whoosh();
    } else if (ev.type === 'thief') {
      const a = rand(TAU), d = this.viewR * 0.55;
      const e = this.spawnEnemy('thief', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
      e.life = 15;
      e.restT = -1;
      this.hooks.banner('JEWEL THIEF', 'elite', '撃破で原石と宝箱');
    } else if (ev.type === 'warning') {
      this.hooks.banner('WARNING', 'warning', '強大な反応が接近中');
      audio.warning();
      this.fx.shake(6);
    } else if (ev.type === 'boss') {
      const a = -Math.PI / 2 + rand(-0.5, 0.5);
      const e = this.spawnEnemy(ev.enemy, p.x + Math.cos(a) * (this.viewR * 0.8), p.y + Math.sin(a) * (this.viewR * 0.8), { mul: ev.mul || 1 });
      // 6:00 以降の中ボスは秘宝の宝箱を落とす
      e.artChest = ev.t !== undefined && ev.t >= 300 && ev.enemy !== this.stage.finalBoss;
      this.boss = e;
      e.atkT = 2;
      e.atk2 = 5;
      this.hooks.bossBar(e);
      this.hooks.banner(ENEMIES[ev.enemy].name, 'boss', ev.enemy === this.stage.finalBoss ? 'FINAL BOSS' : 'BOSS');
      audio.playBgm(ev.enemy === this.stage.finalBoss ? 'final' : 'boss');
      this.fx.shake(12);
      save.seen.enemies[ev.enemy] = true;
    }
  }

  spawnEnemy(type, x, y, o = {}) {
    const d = ENEMIES[type];
    const elite = !!o.elite;
    const mul = d.boss ? (o.mul || 1) * 1.15 * (1 + Math.max(0, this.level - 20) * 0.01) * this.stage.hp * this.heatM.hp
      : d.prop ? 1 : this.hpScale() * (elite ? 12 : 1) * (o.soft || elite || d.ai === 'thief' ? 1 : this.trashMul || 1); // 大群イベント・エリート・シーフは連動させない
    const e = {
      id: ++this.eid, type, x, y, r: d.r * (elite ? 1.5 : 1), hp: d.hp * mul, maxHp: d.hp * mul,
      speed: d.speed * rand(0.9, 1.1) * (elite ? 0.9 : 1) * this.heatM.speed * (this.hyper ? 1.65 : 1), dmg: d.dmg * (1 + Math.min(this.time, 900) / 600) * this.stageDmg, xp: d.xp,
      vx: 0, vy: 0, flash: 0, hitT: {}, alive: true, elite, boss: !!d.boss, prop: !!d.prop, segment: !!d.segment,
      frozenT: 0, slowT: 0, slowMul: 1, anim: rand(10), phase: rand(TAU),
      ai: d.ai || type, spr: d.sprite || type,
      tint: d.tint || (this.stage.tint && !d.boss && !d.prop && !d.segment && !d.ai ? TINT(type, this.stage.tint) : null),
    };
    this.enemies.push(e);
    if (!d.prop) save.seen.enemies[type] = true;
    return e;
  }

  // ---------------------------------------------------------------- てき
  updateEnemies(dt) {
    const p = this.player;
    const stop = this.timeStopT > 0;
    const Q = this._q || (this._q = []);
    const farR = this.viewR + 220;
    const mv = this._mv || (this._mv = { mx: 0, my: 0, spd: 0 });
    let removed = 0;
    for (const e of this.enemies) {
      if (!e.alive) { removed++; continue; }
      e.flash -= dt;
      if (stop && e.invulnT > 0) e.invulnT -= dt; // 時間停止中も無敵時間は進める
      if (e.prop) {
        if (Math.hypot(e.x - p.x, e.y - p.y) > this.viewR * 2.5) { e.alive = false; }
        continue;
      }
      // ワームの胴体は頭の通った道をなぞる
      if (e.segment) {
        const h = e.parent;
        if (!h || !h.alive) { e.alive = false; continue; }
        const tr = h.trail;
        const want = (e.idx + 1) * 24;
        let acc = 0, px = h.x, py = h.y;
        for (let i = tr.length - 1; i >= 0; i--) {
          const q = tr[i];
          const d = Math.hypot(q.x - px, q.y - py);
          if (acc + d >= want) {
            const k = (want - acc) / (d || 1);
            e.x = px + (q.x - px) * k;
            e.y = py + (q.y - py) * k;
            break;
          }
          acc += d; px = q.x; py = q.y;
          e.x = px; e.y = py;
        }
        if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r - 2) this.hurtPlayer(e.dmg);
        continue;
      }
      // ノックバック
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      const damp = Math.pow(0.82, dt * 60);
      e.vx *= damp;
      e.vy *= damp;
      if (e.frozenT > 0) e.frozenT -= dt;
      if (e.slowT > 0) e.slowT -= dt;
      if (!stop) { tickElements(this, e, dt); if (!e.alive) continue; }
      const dx = p.x - e.x, dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      // 魅了：ほかの敵を襲う
      if (e.charmT > 0) {
        e.charmT -= dt;
        if (e.charmT <= 0) {
          e.charmT = 0;
          if (e.charmBoom) {
            this.aoe(e.x, e.y, 55, this.charmDmg() * 1.0, 'moonstone', { kb: 120, exclude: e });
            this.fx.ring(e.x, e.y, 8, 55, 0.3, '#ffb3e6', 5);
          }
        } else {
          const tgt = e.charmTgt && e.charmTgt.alive && !e.charmTgt.charmT ? e.charmTgt : (e.charmTgt = this.nearestEnemies(e.x, e.y, 2, 260).find((o) => o !== e && !o.charmT));
          if (tgt && !stop) {
            const tx = tgt.x - e.x, ty = tgt.y - e.y, td = Math.hypot(tx, ty) || 1;
            e.x += (tx / td) * e.speed * 1.3 * dt;
            e.y += (ty / td) * e.speed * 1.3 * dt;
            if (td < e.r + tgt.r && (e.hitT.charm || 0) < this.time) {
              e.hitT.charm = this.time + 0.4;
              this.damage(tgt, this.charmDmg(), { wid: 'moonstone', kb: 80, kx: tx / td, ky: ty / td });
            }
          }
          continue;
        }
      }
      if (!stop && e.frozenT <= 0) {
        mv.spd = e.speed * (e.slowT > 0 ? e.slowMul : 1);
        mv.mx = dx / dist; mv.my = dy / dist;
        if (e.swarm && e.swarm.t > 0) {
          e.swarm.t -= dt;
          mv.mx = e.swarm.vx; mv.my = e.swarm.vy;
          mv.spd *= 1.6;
        } else if (e.vortex && e.vortex.t > 0) {
          // 渦：中心のまわりを回りながら半径を縮める
          const v = e.vortex;
          v.t -= dt;
          v.a += (0.75 + 30 / Math.max(60, v.r)) * dt;
          v.r = Math.max(0, v.r - 34 * dt);
          if (v.r < 30) v.t = 0;
          mv.mx = v.cx + Math.cos(v.a) * v.r - e.x;
          mv.my = v.cy + Math.sin(v.a) * v.r - e.y;
          mv.spd = Math.min(Math.hypot(mv.mx, mv.my) / dt, e.speed * 3);
        } else if (e.type === 'bat') {
          const w = Math.sin(this.time * 5 + e.phase) * 0.6;
          const mx = mv.mx; mv.mx += -mv.my * w; mv.my += mx * w;
        } else if (e.type === 'ghost') {
          const w = Math.sin(this.time * 2.5 + e.phase) * 0.9;
          const mx = mv.mx; mv.mx += -mv.my * w; mv.my += mx * w;
        }
        if (e.boss && e.breakT > 0) { e.breakT -= dt; mv.spd = 0; } // ブレイク中は動かず攻撃もしない
        else if (e.boss) this.bossAI(e, blindDt(e, dt), dist, mv);
        else if (AI[e.ai]) AI[e.ai](this, e, blindDt(e, dt), dist, mv);
        if (!e.alive) continue;
        elementMove(e, mv, dx, dy);
        if (e.dash > 0) { mv.spd = e.speed * 4.5; mv.mx = e.dvx; mv.my = e.dvy; e.dash -= dt; }
        if (e.windup > 0) { mv.spd = 0; e.windup -= dt; if (e.windup <= 0) { e.dash = 0.55; } }
        const ml = Math.hypot(mv.mx, mv.my) || 1;
        e.x += (mv.mx / ml) * mv.spd * dt;
        e.y += (mv.my / ml) * mv.spd * dt;
      }
      if (e.ai === 'worm') {
        const tr = e.trail || (e.trail = []);
        const last = tr[tr.length - 1];
        if (!last || Math.hypot(last.x - e.x, last.y - e.y) > 6) tr.push({ x: e.x, y: e.y });
        if (tr.length > 120) tr.shift();
      }
      // おしあい（かるく）
      if (((e.id + this.eid) % 2 === 0 || e.boss) && e.ai !== 'worm') {
        this.grid.query(e.x, e.y, e.r * 2, Q);
        for (const o of Q) {
          if (o === e || !o.alive || o.prop || o.segment) continue;
          const ox = e.x - o.x, oy = e.y - o.y;
          const rr = (e.r + o.r) * 0.85;
          const d2 = ox * ox + oy * oy;
          if (d2 < rr * rr && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const push = ((rr - d) / d) * (e.boss ? 0.05 : 0.35);
            e.x += ox * push;
            e.y += oy * push;
          }
        }
      }
      // プレイヤーに あたる
      if (dist < e.r + p.r - 2 && !(e.fade > 0) && e.dmg > 0 && !(e.breakT > 0)) {
        this.hurtPlayer(e.dmg * touchMul(this, e), { src: 'touch:' + e.type });
        if (e.ai === 'wisp') { p.slowT = 1.6; p.slowMul = 0.6; }
      }
      // とおすぎたら まえに もってくる
      if (dist > farR && !e.boss && e.ai !== 'thief') {
        const a = p.moving ? Math.atan2(p.dirY, p.dirX) + rand(-1, 1) : rand(TAU);
        const d = this.viewR + 30;
        e.x = p.x + Math.cos(a) * d;
        e.y = p.y + Math.sin(a) * d;
        e.swarm = null;
        e.vortex = null;
      }
    }
    if (removed > 60) this.enemies = this.enemies.filter((e) => e.alive);
  }

  charmDmg() {
    const w = this.getWeapon('moonstone');
    return w ? w.s.dmg * 0.6 : 50;
  }

  bossAI(e, dt, dist, mv) {
    const p = this.player;
    // にげても ワープで おいかけてくる
    if (dist > this.viewR * 0.95 && !(e.dash > 0)) {
      e.warpT = (e.warpT || 0) + dt;
      if (e.warpT > 1.5) {
        e.warpT = 0;
        if (e.trail) e.trail.length = 0;
        this.fx.burst(e.x, e.y, '#c43dff', 20, 200, 0.6, 14);
        const a = rand(TAU);
        e.x = p.x + Math.cos(a) * this.viewR * 0.55;
        e.y = p.y + Math.sin(a) * this.viewR * 0.55;
        this.fx.ring(e.x, e.y, 10, e.r * 2.5, 0.5, '#ff3ddc', 8);
        this.fx.text(e.x, e.y - e.r - 10, 'WARP', { size: 16, color: '#ffb3f0', stroke: 'rgba(40,0,40,0.8)', life: 0.8 });
        audio.whoosh();
      }
    } else e.warpT = 0;
    if (AI[e.ai]) AI[e.ai](this, e, dt, dist, mv);
    else this.bossAttack(e, dt, dist, mv);
    if (e.ai !== 'worm') this.bossMove(e, dt, dist, mv);
  }

  // ボスは常に追ってこない。一定距離を保って周回し、離れすぎたときだけ急いで寄ってくる
  bossMove(e, dt, dist, mv) {
    const k = mv.spd; // AI 側の減速（停止・鈍足）を尊重する
    if (k <= 0) return;
    const far = 170 + e.r, near = 60 + e.r, mid = (far + near) / 2;
    if (dist > far) {
      e.rushing = true;
    } else if (dist < mid) e.rushing = false;
    if (e.rushing) { mv.spd = k * 1.9; return; }
    if (!e.orbDir) e.orbDir = chance(0.5) ? 1 : -1;
    e.orbFlipT = (e.orbFlipT || rand(4, 8)) - dt;
    if (e.orbFlipT <= 0) { e.orbDir *= -1; e.orbFlipT = rand(4, 8); }
    // 接線方向＋半径方向の補正
    const rad = Math.max(-1, Math.min(1, (dist - mid) / (far - mid)));
    const tx = -mv.my * e.orbDir, ty = mv.mx * e.orbDir;
    mv.mx = tx + mv.mx * rad * 1.2;
    mv.my = ty + mv.my * rad * 1.2;
    mv.spd = k * 0.6;
  }

  bossAttack(e, dt, dist, mv) {
    const p = this.player;
    const enraged = e.hp < e.maxHp * 0.5;
    e.atkT -= dt * (enraged ? 1.4 : 1);
    e.atk2 -= dt;
    const shoot = (a, spd = 150, r = 8) => this.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r, dmg: e.dmg * 0.7, life: 6 });
    const kind = e.ai;
    const minion = this.stage.id === 'wastes' ? 'slime' : this.stage.waves[1][1][0];
    if (kind === 'boss1') {
      if (e.atkT <= 0) {
        e.atkT = 2.8;
        const n = 14, off = rand(TAU);
        for (let i = 0; i < n; i++) shoot(off + (i / n) * TAU, 140);
        this.fx.ring(e.x, e.y, e.r, e.r * 2, 0.3, '#b48cff', 5);
      }
      if (e.atk2 <= 0) {
        e.atk2 = 7;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          this.spawnEnemy(minion, e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70);
        }
      }
    } else if (kind === 'boss2') {
      if (e.atkT <= 0) {
        e.atkT = 2.2;
        e.spiral = (e.spiral || 0) + 0.4;
        for (let w = 0; w < 3; w++) {
          for (let i = 0; i < 8; i++) {
            const a = e.spiral + (i / 8) * TAU + w * 0.2;
            this.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * (120 + w * 30), vy: Math.sin(a) * (120 + w * 30), r: 8, dmg: e.dmg * 0.6, life: 6 });
          }
        }
      }
      if (e.atk2 <= 0 && !(e.dash > 0) && !(e.windup > 0)) {
        e.atk2 = 5;
        e.windup = 0.7;
        const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
        e.dvx = (p.x - e.x) / d;
        e.dvy = (p.y - e.y) / d;
      }
    } else if (kind === 'boss3') {
      if (e.atkT <= 0) {
        e.atkT = 1.9;
        const a0 = Math.atan2(p.y - e.y, p.x - e.x);
        const n = enraged ? 7 : 5;
        for (let i = 0; i < n; i++) shoot(a0 + (i - (n - 1) / 2) * 0.22, 190, 9);
      }
      if (e.atk2 <= 0) {
        e.atk2 = enraged ? 4 : 5.5;
        e.pat = ((e.pat || 0) + 1) % 3;
        if (e.pat === 0) {
          const n = 28, off = rand(TAU);
          for (let i = 0; i < n; i++) shoot(off + (i / n) * TAU, 120, 9);
        } else if (e.pat === 1) {
          const R = this.viewR * 0.9;
          for (let i = 0; i < 20; i++) {
            const a = (i / 20) * TAU;
            this.spawnEnemy('bat', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R);
          }
        } else {
          e.windup = 0.8;
          const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
          e.dvx = (p.x - e.x) / d;
          e.dvy = (p.y - e.y) / d;
        }
        this.fx.ring(e.x, e.y, e.r, e.r * 2.5, 0.4, '#ff3ddc', 6);
      }
    }
  }

  updateBullets(dt) {
    const p = this.player;
    for (const b of this.ebullets) {
      if (this.timeStopT > 0) continue;
      const bm = this.hyper ? 1.2 : 1;
      b.x += b.vx * dt * bm;
      b.y += b.vy * dt * bm;
      b.life -= dt;
      const rr = b.r + p.r - 3;
      if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < rr * rr) {
        this.hurtPlayer(b.dmg, { src: 'bullet' });
        if (b.freeze) { p.slowT = 1.8; p.slowMul = 0.55; }
        b.life = 0;
      }
    }
    this.ebullets = this.ebullets.filter((b) => b.life > 0);
  }

  // ボスのレーザーと 予告円
  updateLasers(dt) {
    const p = this.player;
    if (this.timeStopT > 0) return; // 時間停止中はレーザーも予告攻撃も止まる
    for (const L of this.lasers) {
      const o = L.owner;
      if (!o || !o.alive) { L.dur = 0; L.tele = 0; continue; }
      if (L.tele > 0) { L.tele -= dt; continue; }
      L.dur -= dt;
      L.a += L.va * dt;
      const bx = o.x + Math.cos(L.a) * L.len, by = o.y + Math.sin(L.a) * L.len;
      const dx = bx - o.x, dy = by - o.y;
      let t = ((p.x - o.x) * dx + (p.y - o.y) * dy) / (dx * dx + dy * dy);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = o.x + dx * t - p.x, cy = o.y + dy * t - p.y;
      if (cx * cx + cy * cy < (L.w / 2 + p.r - 3) ** 2) this.hurtPlayer(L.dmg, { src: 'laser' });
    }
    this.lasers = this.lasers.filter((L) => L.tele > 0 || L.dur > 0);
    for (const w of this.warns) {
      if (w.owner && !w.owner.alive) { w.done = true; continue; } // 撃破したボスの予告攻撃は消す
      w.t += dt;
      if (w.t >= w.T && !w.done) { w.done = true; w.fn(this); }
    }
    this.warns = this.warns.filter((w) => !w.done);
  }

  // ---------------------------------------------------------------- たま
  addProj(pr) {
    pr.hit = pr.hit || new Set();
    pr.max = pr.life;
    pr.rot = pr.rot || 0;
    pr.age = 0;
    this.projs.push(pr);
    return pr;
  }
  addArea(a) {
    a.max = a.life;
    a.tt = 0;
    this.areas.push(a);
    return a;
  }

  updateProjs(dt) {
    const Q = this._pq || (this._pq = []);
    for (const pr of this.projs) {
      pr.life -= dt;
      pr.age += dt;
      if (pr.fall) {
        pr.ft += dt;
        const t = Math.min(1, pr.ft / pr.fall);
        pr.x = pr.tx;
        pr.y = pr.ty - 360 * (1 - t * t);
        if (pr.spin) pr.rot += pr.spin * dt;
        if (t >= 1) {
          pr.land(this, pr);
          pr.life = 0;
        }
        continue;
      }
      if (pr.gravity) pr.vy += pr.gravity * dt;
      if (pr.homing) {
        pr.ht = (pr.ht || 0) - dt;
        if (!pr.tgt || !pr.tgt.alive || pr.ht <= 0) { pr.tgt = this.nearestEnemies(pr.x, pr.y, 1, 380, pr.hit)[0]; pr.ht = 0.25; }
        if (pr.tgt) {
          const cur = Math.atan2(pr.vy, pr.vx);
          let da = Math.atan2(pr.tgt.y - pr.y, pr.tgt.x - pr.x) - cur;
          while (da > Math.PI) da -= TAU;
          while (da < -Math.PI) da += TAU;
          const turn = pr.homing * dt;
          const na = cur + Math.max(-turn, Math.min(turn, da));
          pr.vx = Math.cos(na) * pr.spd;
          pr.vy = Math.sin(na) * pr.spd;
        }
      }
      if (pr.boomerang) {
        const b = pr.boomerang;
        if (b.out) {
          b.dist += Math.hypot(pr.vx, pr.vy) * dt;
          if (b.dist >= b.range) { b.out = false; pr.hit.clear(); }
        } else {
          const p = this.player;
          const dx = p.x - pr.x, dy = p.y - pr.y, d = Math.hypot(dx, dy) || 1;
          b.back = Math.min(760, (b.back || 150) + 1100 * dt);
          pr.vx = (dx / d) * b.back;
          pr.vy = (dy / d) * b.back;
          if (d < 18) pr.life = 0;
        }
      }
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.spin) pr.rot += pr.spin * dt;
      if (pr.trail && Math.random() < 0.14) this.fx.add(pr.x, pr.y, rand(-15, 15), rand(-15, 15), 0.3, 6, pr.trail, 'star');
      if (pr.grow) pr.r += pr.grow * dt * 10;
      this.grid.query(pr.x, pr.y, pr.r + 40, Q);
      for (const e of Q) {
        if (!e.alive || pr.hit.has(e)) continue;
        const rr = pr.r + e.r;
        const dx = e.x - pr.x, dy = e.y - pr.y;
        if (dx * dx + dy * dy > rr * rr) continue;
        pr.hit.add(e);
        const sp = Math.hypot(pr.vx, pr.vy) || 1;
        this.damage(e, pr.dmg, { wid: pr.wid, kx: pr.vx / sp, ky: pr.vy / sp, kb: pr.knock || 40, heal: pr.heal, forceCrit: pr.forceCrit });
        if (pr.explode) {
          this.aoe(pr.x, pr.y, pr.explode, pr.dmg * 0.6, pr.wid, { kb: 60, exclude: e });
          this.fx.ring(pr.x, pr.y, 5, pr.explode, 0.25, '#ff7a95', 5);
          this.fx.burst(pr.x, pr.y, '#ff5f7a', 6, 160, 0.35, 10);
        }
        if (pr.onHit) pr.onHit(this, pr, e);
        pr.pierce--;
        if (pr.pierce < 0) { pr.life = 0; break; }
      }
    }
    this.projs = this.projs.filter((pr) => pr.life > 0);
  }

  updateAreas(dt) {
    const Q = this._aq || (this._aq = []);
    for (const a of this.areas) {
      a.life -= dt;
      a.tt -= dt;
      if (a.slow) {
        this.grid.query(a.x, a.y, a.r + 30, Q);
        for (const e of Q) if (e.alive && !e.boss && (e.x - a.x) ** 2 + (e.y - a.y) ** 2 < (a.r + e.r) ** 2) { e.slowT = 0.2; e.slowMul = a.slow; }
      }
      if (a.tt <= 0) {
        a.tt += a.tick;
        this.grid.query(a.x, a.y, a.r + 30, Q);
        for (const e of Q) {
          if (!e.alive) continue;
          if ((e.x - a.x) ** 2 + (e.y - a.y) ** 2 > (a.r + e.r) ** 2) continue;
          const wasAlive = e.alive;
          this.damage(e, a.dmg, { wid: a.wid, kb: 0 });
          if (a.clover && wasAlive && !e.alive && chance(0.04 * this.stats.luck)) {
            this.dropPickup(chance(0.5) ? 'heart' : 'coin', e.x, e.y, 5);
          }
        }
      }
    }
    this.areas = this.areas.filter((a) => a.life > 0);
  }

  aoe(x, y, R, dmg, wid, o = {}) {
    const Q = this._oq || (this._oq = []);
    this.grid.query(x, y, R + 40, Q);
    for (const e of Q) {
      if (!e.alive || e === o.exclude) continue;
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy > (R + e.r) ** 2) continue;
      const d = Math.hypot(dx, dy) || 1;
      this.damage(e, dmg, { wid, kx: dx / d, ky: dy / d, kb: o.kb || 0, heal: o.heal });
    }
  }

  // ---------------------------------------------------------------- ダメージ
  damage(e, amount, o = {}) {
    if (!e.alive) return 0;
    const p = this.player;
    if (e.segment) {
      // 胴体へのダメージは頭へ
      e.flash = 0.08;
      if (!e.parent || !e.parent.alive) return 0;
      e = e.parent;
      amount *= 0.2;
      o = { ...o, kb: 0 };
    }
    if (e.invulnT > 0) return 0;
    if (e.prop) {
      e.hp = 0;
      this.killProp(e);
      return 0;
    }
    let dmg = amount;
    if (this.feverT > 0) dmg *= 1.5;
    if (e.breakT > 0) dmg *= 2; // ブレイク中のボスは被ダメージ 2 倍
    if (this.charId === 'ruby' && p.hp < p.maxHp * 0.5) dmg *= 1.3;
    const ev = elementVs(this, e);
    dmg *= ev.mul;
    const crit = o.forceCrit || (!o.dot && chance(this.stats.crit + ev.crit));
    if (crit) dmg *= 2.5;
    dmg *= rand(0.92, 1.08);
    dmg = Math.max(1, Math.round(dmg));
    const dealt = Math.min(dmg, e.hp);
    e.hp -= dmg;
    if (o.wid && !o.dot && !e.boss && !e.segment && this.artSet.has('loupe') && chance(0.08)) e.frozenT = Math.max(e.frozenT, 1.5); // 秘宝「氷晶のルーペ」
    // 形態のあるボスは、形態変化の処理（AI 側）を飛ばして次の形態へ進んだり倒れたりしないようにする
    if (e.ai === 'emperor' && e.phaseNow && e.phaseNow < 3) {
      const floor = e.maxHp * (e.phaseNow === 1 ? 0.66 : 0.33) - 1;
      if (e.hp < floor) e.hp = floor;
    }
    e.flash = 0.08;
    if (o.kb) {
      let kx = o.kx, ky = o.ky;
      if (kx === undefined) {
        const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
        kx = (e.x - p.x) / d; ky = (e.y - p.y) / d;
      }
      const k = e.boss ? 0.05 : e.elite || e.ai === 'thief' ? 0.3 : 1;
      e.vx += kx * o.kb * k;
      e.vy += ky * o.kb * k;
    }
    if (e.boss && !(e.breakT > 0) && e.hp > 0) this.addBreak(e, dealt);
    if (o.wid) this.dmgBy[o.wid] = (this.dmgBy[o.wid] || 0) + dealt;
    this.totalDmg += dealt;
    if (!o.silent) {
      if (o.miracle) {
        this.miracles++;
        this.fx.text(e.x, e.y - e.r - 18, 'MIRACLE', { size: 18, rainbow: true, life: 0.9, vy: -80 });
        this.fx.text(e.x, e.y - e.r, dmg, { size: 30, rainbow: true, life: 0.9, crit: true });
        this.fx.burst(e.x, e.y, 'rainbow', 14, 260, 0.6, 14);
        audio.miracle();
        this.fx.shake(3);
      } else if (crit) {
        this.fx.text(e.x, e.y - e.r, dmg, { size: 22, color: '#ffd23d', stroke: 'rgba(70,20,0,0.85)', life: 0.7, crit: true });
        audio.crit();
      } else {
        // 通常ヒットは敵ごとにまとめて表示（数字の洪水を防ぐ）
        e.dmgAcc = (e.dmgAcc || 0) + dmg;
        if (this.time - (e.dmgShowT || -1) > 0.3 || e.hp <= 0) {
          this.fx.text(e.x, e.y - e.r, e.dmgAcc, { size: 15, color: '#ece8ff', life: 0.55 });
          e.dmgAcc = 0;
          e.dmgShowT = this.time;
        }
      }
      audio.hit();
    }
    if (o.heal) this.heal(o.heal);
    onElementHit(this, e, dealt);
    if (o.wid && !o.dot && e.hp > 0) procElement(this, e, o.wid, dealt);
    if (e.hp <= 0) this.kill(e, o.wid);
    return dealt;
  }

  // ブレイクゲージ：ボスに与えたダメージでたまる。近くで戦うほど早くたまる
  // （ボスの体の縁からの距離が 70 以内で 2 倍、320 以上で 0.4 倍）。満タンで 4 秒ダウンし、被ダメージ 2 倍
  addBreak(e, dealt) {
    const p = this.player;
    const d = Math.max(0, Math.hypot(e.x - p.x, e.y - p.y) - e.r);
    const f = d <= 70 ? 2 : d >= 320 ? 0.4 : 2 - ((d - 70) / 250) * 1.6;
    e.breakG = (e.breakG || 0) + (dealt / (e.maxHp * 0.34 * (e.breakNeed || 1))) * f * earthBreak(this);
    e.breakNear = f;
    if (e.breakG >= 1) this.bossBreak(e);
  }
  bossBreak(e) {
    e.breakG = 0;
    e.breakNeed = (e.breakNeed || 1) * 1.4; // 次のブレイクは少し遠くなる
    e.breakT = 4;
    e.dash = 0;
    e.windup = 0;
    e.charging = false;
    this.lasers = this.lasers.filter((L) => L.owner !== e);
    this.warns = this.warns.filter((w) => w.owner !== e);
    this.fx.ring(e.x, e.y, e.r, e.r * 3, 0.5, '#ffe39a', 10);
    this.fx.burst(e.x, e.y, '#ffe39a', 30, 320, 0.7, 14);
    this.fx.shake(10);
    this.hooks.banner('BREAK', 'victory', '4秒間 被ダメージ×2');
    audio.crit();
    audio.bigWin();
  }

  kill(e, wid) {
    e.alive = false;
    onEnemyKilled(this, e);
    if (e.segs) for (const sg of e.segs) if (sg.alive) { sg.alive = false; this.fx.purify(sg.x, sg.y, '#ffb84a', true); }
    this.kills++;
    this.killsByType[e.type] = (this.killsByType[e.type] || 0) + 1;
    const col = pick(['#ffffff', '#ffd6f5', '#d6f0ff', '#fff3b0', GEMS[this.charId].color]);
    this.fx.purify(e.x, e.y, col, e.elite || e.boss);
    audio.kill();
    const xpMul = onElementKill(this, e);
    // けいけんち
    if (e.boss) {
      this.bossDefeated(e);
    } else {
      this.dropXp(e.x, e.y, e.xp * (e.elite ? 8 : 1) * xpMul);
      if (e.ai === 'thief') {
        // ジュエルシーフ：原石（原石以上）とコインと宝箱
        this.dropPickup('rough', e.x, e.y, upgradeTier(chance(0.3) ? 'large' : 'rough', this.stage.no, this.heat));
        for (let i = 0; i < 12; i++) this.dropPickup('coin', e.x, e.y, randi(3, 7));
        this.dropPickup('chest', e.x, e.y);
        this.fx.confetti(e.x, e.y, 40);
        this.fx.shake(6);
        this.hooks.banner('THIEF DEFEATED', 'item', '');
      }
      if (e.elite) {
        const t = eliteDrop();
        if (t) this.dropPickup('rough', e.x, e.y, upgradeTier(t, this.stage.no, this.heat));
        this.dropPickup('chest', e.x, e.y);
        this.fx.confetti(e.x, e.y, 30);
        this.fx.shake(6);
      }
    }
    // ゴールドフィーバー中は倒した敵がコインを落とす
    if (this.goldFeverT > 0 && chance(0.35)) this.dropPickup('coin', e.x, e.y, randi(1, 3));
    // コイン
    const coinP = (0.05 + (wid === 'amber' ? 0.25 : 0) + (wid === 'amber' && this.getWeapon('amber')?.evolved ? 0.75 : 0)) * this.stats.luck;
    if (chance(coinP)) this.dropPickup('coin', e.x, e.y, randi(1, 3));
    if (chance(0.003 * this.stats.luck)) this.dropPickup('heart', e.x, e.y);
    // コンボ / フィーバー
    this.combo++;
    this.comboT = 1.5;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    if (this.combo === 50 || this.combo === 100 || this.combo === 200 || this.combo % 500 === 0) {
      this.hooks.combo(this.combo);
    }
    if (this.feverT <= 0) {
      this.feverGauge += e.boss ? 60 : e.elite ? 15 : 1;
      if (this.feverGauge >= this.feverNeed) this.startFever();
    }
    if (this.milestoneIdx < KILL_MILESTONES.length && this.kills >= KILL_MILESTONES[this.milestoneIdx]) {
      const m = KILL_MILESTONES[this.milestoneIdx++];
      const bonus = Math.round(m / 10 * this.stats.greed);
      this.coins += bonus;
      this.hooks.banner(`${m} KILLS`, 'milestone', `ボーナス +${bonus} コイン`);
      audio.milestone();
    }
  }

  killProp(e) {
    e.alive = false;
    this.fx.burst(e.x, e.y, 'rainbow', 16, 220, 0.6, 12);
    this.fx.ring(e.x, e.y, 5, 40, 0.3, '#ffffff', 4);
    audio.crit();
    const r = weightedPick([
      ['heart', 30], ['coinbag', 25], ['magnet', 16], ['bomb', 10], ['clock', 9], ['bigxp', 10],
    ], (x) => x[1])[0];
    if (r === 'coinbag') for (let i = 0; i < 6; i++) this.dropPickup('coin', e.x, e.y, randi(2, 5));
    else if (r === 'bigxp') this.dropXp(e.x, e.y, 25 + Math.floor(this.time / 20));
    else this.dropPickup(r, e.x, e.y);
  }

  bossDefeated(e) {
    this.bosses++;
    (this.bossLog = this.bossLog || []).push(e.type + '@' + Math.round(this.time));
    // 別のボスがまだ生きていれば、そちらを表示対象にする
    const other = this.enemies.find((o) => o.alive && o.boss && o !== e && !o.segment) || null;
    if (this.boss === e || !this.boss || !this.boss.alive) {
      this.boss = other;
      this.hooks.bossBar(other);
    }
    this.fx.shake(20);
    this.fx.screenFlash(0.9);
    this.fx.confetti(e.x, e.y, 80, 500);
    this.fx.burst(e.x, e.y, 'rainbow', 60, 500, 1.2, 20);
    this.timeScale = 0.25;
    this.slowT = 1.2;
    audio.bossDie();
    setTimeout(() => audio.bigWin(), 400);
    this.hooks.banner('BOSS DEFEATED', 'victory', ENEMIES[e.type].name + ' 撃破');
    this.dropPickup('bigchest', e.x, e.y);
    if (e.artChest && this.arts.length < ARTIFACT_MAX && this.artifactChoices().length) this.modalQueue.push({ type: 'artifact' });
    this.dropPickup('rough', e.x, e.y, upgradeTier(bossDrop(e.type === this.stage.finalBoss, this.heat), this.stage.no, this.heat));
    // けいけんちの シャワー
    for (let i = 0; i < 30; i++) this.dropXp(e.x + rand(-60, 60), e.y + rand(-60, 60), Math.ceil(e.xp / 30));
    for (let i = 0; i < 25; i++) this.dropPickup('coin', e.x, e.y, randi(3, 8));
    if (this.state !== 'over' && !other) audio.playBgm(this.stage.bgm);
    this.lasers.length = 0;
    // 盤面の敵弾をすべて消す
    for (let i = 0; i < this.ebullets.length; i++) {
      const b = this.ebullets[i];
      if (i < 120) this.fx.burst(b.x, b.y, '#ffd6f5', 3, 90, 0.35, 6);
    }
    this.ebullets.length = 0;
    if (e.type === this.stage.finalBoss && !this.endless && !this.cleared) {
      this.cleared = true;
      setTimeout(() => {
        if (this.state === 'over') return;
        this.pendingClear = true;
      }, 2800);
    }
  }

  // ---------------------------------------------------------------- 秘宝
  hasArt(id) { return this.artSet.has(id); }
  artifactChoices() {
    return unlockedArtifacts().filter((id) => !this.artSet.has(id));
  }
  addArtifact(id, silent) {
    if (this.artSet.has(id)) return;
    this.arts.push(id);
    this.artSet.add(id);
    if (id === 'pendant' || id === 'box') this.revives += 1;
    this.computeStats();
    if (!silent) {
      const a = ARTIFACT_BY_ID[id];
      this.hooks.banner(a.name, 'item', '秘宝を獲得');
    }
  }
  updateArtifacts(dt) {
    const p = this.player;
    // ロードストーン：偶数分ごとに全部引き寄せる
    if (this.artSet.has('lodestone') && this.time >= this.lodestoneNext) {
      this.lodestoneNext += 120;
      for (const pk of this.pickups) {
        if (pk.kind === 'chest' || pk.kind === 'bigchest') { pk.x = p.x + rand(-50, 50); pk.y = p.y + rand(-50, 50); }
        else pk.vac = true;
      }
      this.hooks.banner('LODESTONE', 'item', 'すべてを引き寄せた');
      audio.levelUp();
    }
    // 呪われた宝石：1 分ごとにエリート
    if (this.artSet.has('hope') && this.time >= this.hopeNext) {
      this.hopeNext += 60;
      const types = this.wave()[1];
      const [x, y] = this.ringPos();
      this.spawnEnemy(pick(types), x, y, { elite: true });
      this.hooks.banner('ELITE', 'elite', '呪われた宝石が強敵を呼んだ');
    }
    // 分光プリズム：攻撃範囲の変動を反映
    if (this.artSet.has('prism')) {
      this.prismT -= dt;
      if (this.prismT <= 0) { this.prismT = 0.25; this.computeStats(); }
    }
    // 黄金の天秤
    if (this.goldFeverT > 0) {
      this.goldFeverT -= dt;
      if (this.goldFeverT <= 0) this.hooks.banner('GOLD FEVER END', 'item', '');
    }
    this.goldFeverCd = Math.max(0, this.goldFeverCd - dt);
  }
  goldScale() {
    if (this.goldFeverT > 0) { this.heal(1.5, true); return; }
    if (this.goldFeverCd <= 0 && chance(0.06)) {
      this.goldFeverT = 8;
      this.goldFeverCd = 30;
      this.hooks.banner('GOLD FEVER', 'fever', '8秒間 敵がコインを落とし、コインで回復');
      audio.bigWin();
    }
  }
  starfall() {
    const p = this.player;
    const kind = weightedPick([['heart', 30], ['magnet', 20], ['clock', 12], ['bomb', 15], ['coin', 23]], (x) => x[1])[0];
    const a = rand(TAU), d = rand(60, 150);
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    if (kind === 'coin') for (let i = 0; i < 5; i++) this.dropPickup('coin', x, y, randi(2, 5));
    else this.dropPickup(kind, x, y);
    this.fx.burst(x, y, '#fff6c9', 12, 200, 0.5, 10);
    this.fx.ring(x, y, 4, 40, 0.35, '#ffe39a', 4);
  }

  startFever() {
    this.feverT = 10;
    this.fevers++;
    this.feverGauge = 0;
    this.feverNeed = Math.round(this.feverNeed * 1.35);
    audio.fever();
    audio.tempoMul = 1.18;
    this.hooks.fever(true);
    this.fx.screenFlash(0.5, '#ffe6ff');
    this.fx.confetti(this.player.x, this.player.y, 50, 420);
  }

  // ---------------------------------------------------------------- プレイヤー
  heal(v, silent) {
    const p = this.player;
    if (p.hp >= p.maxHp) return;
    if (!silent) {
      // ハートかいふくは 1びょうに ちょっとまで
      if (this.healCap > 6) return;
      this.healCap += v;
    }
    if (this.artSet.has('grail')) v *= 2; // 秘宝「癒しの聖杯」
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + v);
    this.healShow += p.hp - before;
    this.healedTotal += p.hp - before;
  }

  hurtPlayer(dmg, o = {}) {
    const p = this.player;
    if ((p.iT > 0 && !o.ignoreIT) || this.god || this.state !== 'play') return;
    if (this.cleared && !this.endless) return; // 最終ボス撃破後、クリア画面までは被弾しない
    if (this.bot) { const k = o.src || 'other'; (this.dmgTaken = this.dmgTaken || {})[k] = (this.dmgTaken[k] || 0) + dmg; }
    dmg = Math.max(1, Math.round((dmg - this.stats.armor) * (1 - Math.min(0.6, this.stats.guard || 0)) * earthGuard(this)));
    p.hp -= dmg;
    if (!o.ignoreIT) p.iT = 0.45;
    p.hurtT = 0.3;
    this.fx.text(p.x, p.y - 22, '-' + dmg, { size: o.silent ? 13 : 17, color: '#ff4d6d', life: 0.6 });
    if (!o.silent) {
      this.fx.shake(5);
      audio.hurt();
      this.hooks.haptic();
    }
    if (p.hp <= 0) this.die();
  }

  die() {
    const p = this.player;
    if (this.revives > 0) {
      this.revives--;
      if (this.artSet.has('pendant')) { this.revBuff++; this.computeStats(); } // 秘宝「護石のペンダント」
      p.hp = p.maxHp;
      p.iT = 2.5;
      this.jewelFlash(true);
      this.hooks.banner('REVIVE', 'victory', '光は再び灯る');
      audio.heal();
      return;
    }
    p.hp = 0;
    this.state = 'dying';
    this.timeScale = 0.3;
    this.fx.burst(p.x, p.y, '#ffffff', 40, 300, 1, 14);
    audio.gameOver();
    audio.stopBgm();
    setTimeout(() => {
      this.state = 'over';
      this.hooks.gameOver(this.results(), false);
    }, 1600);
  }

  // ---------------------------------------------------------------- アイテム
  dropXp(x, y, v) {
    // おおすぎたら まとめる
    if (this.pickups.length > 380) {
      let best = null, bd = Infinity;
      for (const pk of this.pickups) {
        if (pk.kind !== 'xp' || pk.vac) continue;
        const d = (pk.x - x) ** 2 + (pk.y - y) ** 2;
        if (d < bd) { bd = d; best = pk; }
      }
      if (best) { best.value += v; return; }
    }
    this.pickups.push({ kind: 'xp', x: x + rand(-4, 4), y: y + rand(-4, 4), value: v, vx: 0, vy: 0, vac: false, t: 0 });
  }

  dropPickup(kind, x, y, value = 1) {
    const a = rand(TAU), s = rand(40, 140);
    this.pickups.push({ kind, x, y, value, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vac: false, t: 0 });
  }

  updatePickups(dt) {
    const p = this.player;
    // フィーバー中は回収範囲が 10 秒かけて外側へ広がる（近い石から順に少しずつ集まる）
    const mR = 62 * this.stats.magnet * (this.feverT > 0 ? 2 : 1) + (this.feverT > 0 ? (1 - this.feverT / 10) * 1500 : 0);
    const mR2 = mR * mR;
    const farItem2 = (this.viewR * 3) ** 2;
    let keep = 0;
    const list = this.pickups;
    for (let i = 0; i < list.length; i++) {
      const pk = list[i];
      pk.t += dt;
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      pk.vx *= Math.pow(0.88, dt * 60);
      pk.vy *= Math.pow(0.88, dt * 60);
      const dx = p.x - pk.x, dy = p.y - pk.y;
      const d2 = dx * dx + dy * dy;
      const isChest = pk.kind === 'chest' || pk.kind === 'bigchest';
      // 宝箱と原石が水晶柱の中に埋まって取れなくならないよう押し出す
      if (isChest || pk.kind === 'rough') this.hazards.collide(pk, 12);
      // 遠くに取り残したコイン・回復などは消す（エンドレスで溜まり続けないように）
      if (!isChest && pk.kind !== 'rough' && pk.kind !== 'xp' && d2 > farItem2) continue;
      if (!isChest && pk.t > 0.25 && (d2 < mR2 || pk.vac)) {
        pk.vac = true;
        const d = Math.sqrt(d2) || 1;
        pk.sp = (pk.sp || 120) + 900 * dt;
        pk.x += (dx / d) * pk.sp * dt;
        pk.y += (dy / d) * pk.sp * dt;
      }
      if (d2 < (p.r + (isChest ? 16 : 10)) ** 2) {
        this.collect(pk);
        continue;
      }
      list[keep++] = pk;
    }
    list.length = keep;
  }

  collect(pk) {
    const p = this.player;
    switch (pk.kind) {
      case 'xp': {
        const v = pk.value * this.stats.growth * (this.feverT > 0 ? 2 : 1);
        this.gainXp(v);
        audio.pickup();
        if (pk.value >= 20) this.fx.burst(p.x, p.y, '#ff9ec7', 6, 120, 0.4, 8);
        break;
      }
      case 'coin': {
        if (this.artSet.has('scale')) this.goldScale(); // 秘宝「黄金の天秤」
        const v = Math.max(1, Math.round(pk.value * this.stats.greed));
        this.coins += v;
        audio.coin();
        this.fx.text(p.x + rand(-10, 10), p.y - 26, '+' + v, { size: 14, color: '#ffd23d', life: 0.5, vy: -80 });
        this.hooks.coinPop();
        break;
      }
      case 'heart':
        this.heal(30, true); // 回復量は heal() が緑の数字で表示する（聖杯の 2 倍も効く）
        audio.heal();
        this.fx.burst(p.x, p.y, '#ff7ab8', 12, 150, 0.6, 12);
        break;
      case 'magnet':
        for (const q of this.pickups) if (q.kind === 'xp' || q.kind === 'coin') q.vac = true;
        this.hooks.banner('MAGNET', 'item', '全経験値を回収');
        audio.levelUp();
        break;
      case 'rough': {
        const R = ROUGH[pk.value];
        this.roughGot[pk.value]++;
        audio.chestOpen();
        this.fx.burst(p.x, p.y, R.color, 14, 160, 0.6, 10);
        this.fx.text(p.x, p.y - 30, R.name + ' 入手', { size: 15, color: R.color, stroke: 'rgba(0,0,0,0.7)', life: 1.1 });
        break;
      }
      case 'bomb':
        this.jewelFlash(false);
        break;
      case 'clock':
        this.timeStopT = 6;
        this.hooks.banner('TIME STOP', 'item', '6秒間 敵が停止');
        audio.miracle();
        break;
      case 'chest':
      case 'bigchest':
        this.modalQueue.push({ type: 'chest', big: pk.kind === 'bigchest' });
        audio.chestOpen();
        break;
    }
  }

  gainXp(v) {
    this.xp += v;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = xpFor(this.level);
      this.pendingLevels++;
      this.modalQueue.push({ type: 'level' });
      if (this.artSet.has('musicbox')) this.starfall(); // 秘宝「流星のオルゴール」
    }
  }

  // がめんの てきを いっそう！
  jewelFlash(fromRevive) {
    const p = this.player;
    this.fx.screenFlash(1);
    this.fx.shake(16);
    this.fx.ring(p.x, p.y, 10, this.viewR, 0.6, 'rainbow', 16);
    this.fx.confetti(p.x, p.y, 60, 500);
    audio.bomb();
    if (!fromRevive) this.hooks.banner('JEWEL FLASH', 'item', '画面内の敵を一掃');
    for (const e of this.enemies) {
      if (!e.alive || e.prop) continue;
      if (Math.abs(e.x - p.x) > this.viewW / 2 + 40 || Math.abs(e.y - p.y) > this.viewH / 2 + 40) continue;
      if (e.boss) this.damage(e, e.maxHp * 0.05, { wid: null });
      else this.damage(e, e.hp + 1, { wid: null, silent: true });
    }
    this.ebullets.length = 0;
    this.lasers.length = 0;
  }

  jackpot(x, y) {
    this.fx.text(x, y - 30, 'JACKPOT 777', { size: 26, rainbow: true, life: 1.2, crit: true });
    this.fx.confetti(x, y, 30, 300);
    for (let i = 0; i < 7; i++) this.dropPickup('coin', x, y, 7);
    audio.jackpot();
    this.fx.shake(5);
  }

  // ---------------------------------------------------------------- えらぶ
  rollChoices() {
    const n = this.stats.luck >= 1.3 ? 4 : 3;
    const pool = [];
    const evos = [];
    for (const w of this.weapons) {
      const def = WEAPONS[w.id];
      if (!w.evolved && w.level >= WEAPON_MAX && this.hasPassive(def.evo.with)) evos.push({ type: 'evo', id: w.id });
      else if (!w.evolved && w.level < WEAPON_MAX && !this.banished.has(w.id)) pool.push({ type: 'wup', id: w.id, weight: 10 });
    }
    for (const p of this.passives) if (p.level < PASSIVES[p.id].max && !this.banished.has(p.id)) pool.push({ type: 'pup', id: p.id, weight: 7 });
    for (const w of this.weapons) {
      const c = this.limitBreakChoice(w);
      if (c) pool.push({ ...c, weight: 6 });
    }
    if (this.weapons.length < MAX_WEAPONS) for (const id of WEAPON_IDS) if (!this.getWeapon(id) && !this.banished.has(id)) pool.push({ type: 'wnew', id, weight: 5 });
    if (this.passives.length < MAX_CHARMS) for (const id of PASSIVE_IDS) if (!this.getPassive(id) && !this.banished.has(id)) {
      // しんかに ひつようなら でやすく
      const need = this.weapons.some((w) => WEAPONS[w.id].evo.with === id && !w.evolved);
      pool.push({ type: 'pnew', id, weight: need ? 9 : 4 });
    }
    const out = evos.slice(0, n);
    const avail = pool.slice();
    while (out.length < n && avail.length) {
      const c = weightedPick(avail, (x) => x.weight);
      avail.splice(avail.indexOf(c), 1);
      out.push(c);
    }
    // ラッキー ×2
    for (const c of out) {
      if (c.type === 'wup') {
        const w = this.getWeapon(c.id);
        if (w.level + 2 <= WEAPON_MAX && chance(0.12 * this.stats.luck)) c.double = true;
      } else if (c.type === 'pup') {
        const p = this.getPassive(c.id);
        if (p.level + 2 <= PASSIVES[c.id].max && chance(0.12 * this.stats.luck)) c.double = true;
      }
    }
    if (!out.length) {
      out.push({ type: 'coins', value: 50 }, { type: 'heal' });
    } else {
      out.push({ type: 'heal25' }); // 常に選べる「HP 25% 回復」
    }
    return out;
  }

  // リミットブレイク：Lv8 の武器の小さな強化を 1 つ選ぶ。
  // 未進化の武器には、もう進化できないとき（進化用のチャームがなく、チャーム枠が埋まっているか、そのチャームを外した）だけ出す
  limitBreakChoice(w) {
    const def = WEAPONS[w.id];
    if (w.level < WEAPON_MAX || this.banished.has(w.id)) return null;
    if (!w.evolved) {
      const partner = def.evo.with;
      if (this.hasPassive(partner)) return null; // 進化できる
      if (this.passives.length < MAX_CHARMS && !this.banished.has(partner)) return null; // まだ進化用のチャームを取れる
    }
    const lb = w.lb || {};
    const has = (n) => [].concat(n).some((k) => def.base[k] !== undefined);
    const opts = LIMIT_BREAK.filter((o) => (!o.need || has(o.need)) && (!o.max || (lb[o.k] || 0) < o.max));
    if (!opts.length) return null;
    const o = weightedPick(opts, (x) => x.w);
    return { type: 'lb', id: w.id, stat: LIMIT_BREAK.indexOf(o) };
  }

  applyChoice(c) {
    let evolved = null;
    if (c.type === 'wnew') this.addWeapon(c.id);
    else if (c.type === 'wup') {
      const w = this.getWeapon(c.id);
      w.level = Math.min(WEAPON_MAX, w.level + (c.double ? 2 : 1));
    } else if (c.type === 'pnew') this.addPassive(c.id);
    else if (c.type === 'pup') {
      const p = this.getPassive(c.id);
      p.level = Math.min(PASSIVES[c.id].max, p.level + (c.double ? 2 : 1));
    } else if (c.type === 'evo') {
      const w = this.getWeapon(c.id);
      w.evolved = true;
      w.t = 0;
      this.evolvedCount++;
      save.seen.evos[c.id] = true;
      evolved = w;
    } else if (c.type === 'lb') {
      const w = this.getWeapon(c.id);
      const o = LIMIT_BREAK[c.stat];
      w.lb = w.lb || {};
      w.lb[o.k] = (w.lb[o.k] || 0) + o.v;
      w.lbN = (w.lbN || 0) + 1;
    } else if (c.type === 'coins') {
      this.coins += Math.round(c.value * this.stats.greed);
    } else if (c.type === 'heal') {
      this.heal(this.player.maxHp, true);
    } else if (c.type === 'heal25') {
      this.heal(this.player.maxHp * 0.25, true);
    }
    this.computeStats();
    return evolved;
  }

  // たからばこの なかみ
  rollChest(big) {
    const r = Math.random() / this.stats.luck;
    let n = big ? (r < 0.3 ? 5 : 3) : r < 0.05 ? 5 : r < 0.3 ? 3 : 1;
    const items = [];
    for (let i = 0; i < n; i++) {
      // しんか ゆうせん
      const evo = this.weapons.find((w) => !w.evolved && w.level >= WEAPON_MAX && this.hasPassive(WEAPONS[w.id].evo.with));
      let c;
      if (evo) c = { type: 'evo', id: evo.id };
      else {
        const pool = [];
        for (const w of this.weapons) if (!w.evolved && w.level < WEAPON_MAX) pool.push({ type: 'wup', id: w.id });
        for (const p of this.passives) if (p.level < PASSIVES[p.id].max) pool.push({ type: 'pup', id: p.id });
        if (!pool.length) for (const w of this.weapons) { const lb = this.limitBreakChoice(w); if (lb) pool.push(lb); }
        c = pool.length ? pick(pool) : { type: 'coins', value: 100 };
      }
      items.push(c);
      this.applyChoice(c);
    }
    const coins = Math.round((big ? rand(150, 400) : rand(30, 120)) * n * this.stats.greed);
    this.coins += coins;
    return { items, coins, n };
  }

  // ---------------------------------------------------------------- モーダル
  openModal() {
    const m = this.modalQueue.shift();
    if (!m) return;
    this.state = 'modal';
    this.input.x = this.input.y = 0;
    const done = () => {
      if (this.state === 'over') return;
      this.state = 'play';
      this.player.iT = Math.max(this.player.iT, 0.6);
      if (this.pendingClear) this.finishClear();
    };
    if (m.type === 'level') {
      this.pendingLevels = Math.max(0, this.pendingLevels - 1);
      const p = this.player;
      // もう えらぶものが ないときは じゃましない
      const cs = this.rollChoices();
      if (cs.every((c) => c.type === 'coins' || c.type === 'heal')) {
        const v = Math.round(30 * this.stats.greed);
        this.coins += v;
        this.heal(20, true);
        this.fx.ring(p.x, p.y, 10, 90, 0.4, 'rainbow', 6);
        this.fx.text(p.x, p.y - 34, `LEVEL UP +${v} COIN`, { size: 15, rainbow: true, stroke: 'rgba(0,0,0,0.7)', life: 0.9 });
        audio.coin();
        this.state = 'play';
        return;
      }
      this.fx.ring(p.x, p.y, 10, 120, 0.5, 'rainbow', 8);
      this.fx.confetti(p.x, p.y, 20, 250);
      audio.levelUp();
      this.hooks.levelUp(this, done);
    } else if (m.type === 'artifact') {
      audio.chestOpen();
      this.hooks.artifact(this, done);
    } else if (m.type === 'chest') {
      this.hooks.chest(this, m.big, done);
    }
  }

  finishClear() {
    if (this.state === 'over') return;
    this.pendingClear = false;
    // 拾い損ねた原石はクリア時に回収する
    for (const pk of this.pickups) if (pk.kind === 'rough') this.roughGot[pk.value]++;
    this.pickups = this.pickups.filter((pk) => pk.kind !== 'rough');
    this.state = 'over';
    audio.stopBgm();
    this.hooks.gameOver(this.results(), true);
  }

  pause() {
    if (this.state !== 'play') return false;
    this.state = 'paused';
    this.input.x = this.input.y = 0;
    return true;
  }
  resume() {
    if (this.state === 'paused') this.state = 'play';
  }

  results() {
    return {
      time: this.time, kills: this.kills, level: this.level, coins: this.coins, damage: this.totalDmg,
      roughGot: { ...this.roughGot }, hyper: this.hyper, hurry: this.hurry, arts: [...this.arts], healed: this.healedTotal, moved: this.moved, maxCombo: this.maxCombo, fevers: this.fevers, evolved: this.evolvedCount, bosses: this.bosses,
      miracles: this.miracles, weaponCount: this.weapons.length, cleared: this.cleared, dmgBy: { ...this.dmgBy },
      weapons: this.weapons.map((w) => ({ id: w.id, level: w.level, evolved: w.evolved })),
      passives: this.passives.map((p) => ({ id: p.id, level: p.level })),
      timeline: this.timeline, bossLog: this.bossLog,
      charId: this.charId, killsByType: { ...this.killsByType }, endless: this.endless,
      stageId: this.stage.id, heat: this.heat, charmed: this.charmed || 0, dmgTaken: this.dmgTaken,
    };
  }

  // ---------------------------------------------------------------- てきさがし
  nearestEnemies(x, y, n, maxD, exclude) {
    const out = [];
    const ds = [];
    const m2 = maxD * maxD;
    for (const e of this.enemies) {
      if (!e.alive || e.prop || (exclude && exclude.has(e))) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d > m2) continue;
      if (out.length < n) {
        out.push(e); ds.push(d);
      } else {
        let wi = 0;
        for (let i = 1; i < ds.length; i++) if (ds[i] > ds[wi]) wi = i;
        if (d < ds[wi]) { out[wi] = e; ds[wi] = d; }
      }
    }
    // ちかい じゅん
    const idx = out.map((_, i) => i).sort((a, b) => ds[a] - ds[b]);
    return idx.map((i) => out[i]);
  }
  strongestEnemies(x, y, n, maxD) {
    const m2 = maxD * maxD;
    const c = this.enemies.filter((e) => e.alive && !e.prop && (e.x - x) ** 2 + (e.y - y) ** 2 < m2);
    c.sort((a, b) => b.hp - a.hp);
    return c.slice(0, n);
  }
  inView(e, pad = 0) {
    const p = this.player;
    return Math.abs(e.x - p.x) < this.viewW / 2 + pad && Math.abs(e.y - p.y) < this.viewH / 2 + pad;
  }
  randomEnemyInView() {
    const es = this.enemies;
    if (!es.length) return null;
    for (let k = 0; k < 16; k++) {
      const e = es[Math.floor(Math.random() * es.length)];
      if (e.alive && !e.prop && this.inView(e, -10)) return e;
    }
    return this.nearestEnemies(this.player.x, this.player.y, 1, this.viewR)[0] || null;
  }
  randomEnemyNear(x, y, R) {
    const es = this.enemies;
    if (!es.length) return null;
    const R2 = R * R;
    for (let k = 0; k < 16; k++) {
      const e = es[Math.floor(Math.random() * es.length)];
      if (e.alive && !e.prop && (e.x - x) ** 2 + (e.y - y) ** 2 < R2) return e;
    }
    return this.nearestEnemies(x, y, 1, R)[0] || null;
  }

  // ---------------------------------------------------------------- テスト用 ボット
  botInput() {
    const p = this.player;
    let fx = 0, fy = 0;
    for (const e of this.enemies) {
      if (!e.alive || e.prop) continue;
      const dx = p.x - e.x, dy = p.y - e.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 200 * 200) continue;
      const w = (e.boss ? 2 : 1) / (d2 + 50);
      fx += dx * w; fy += dy * w;
    }
    for (const b of this.ebullets) {
      const dx = p.x - b.x, dy = p.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 120 * 120) continue;
      fx += dx * 3 / (d2 + 30); fy += dy * 3 / (d2 + 30);
    }
    // 予告円・レーザー・溶岩を避ける
    for (const w of this.warns) {
      const dx = p.x - w.x, dy = p.y - w.y, d = Math.hypot(dx, dy) || 1;
      if (d < w.r + 40) { fx += (dx / d) * 0.2; fy += (dy / d) * 0.2; }
    }
    for (const L of this.lasers) {
      const o = L.owner;
      if (!o) continue;
      const ax = Math.cos(L.a), ay = Math.sin(L.a);
      const t = (p.x - o.x) * ax + (p.y - o.y) * ay;
      if (t < 0 || t > L.len) continue;
      const nx = p.x - (o.x + ax * t), ny = p.y - (o.y + ay * t), d = Math.hypot(nx, ny) || 1;
      if (d < 70) { fx += (nx / d) * 0.25 + ay * Math.sign(L.va || 1) * 0.1; fy += (ny / d) * 0.25 - ax * Math.sign(L.va || 1) * 0.1; }
    }
    if (this.hazards.kind === 'lava') {
      for (const o of this.hazards.around(p.x, p.y, this._bl || (this._bl = []))) {
        const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 1;
        if (d < o.r + 30) { fx += (dx / d) * 0.15; fy += (dy / d) * 0.15; }
      }
    }
    // アイテムに ちかづく
    let best = null, bd = 250 * 250;
    for (const pk of this.pickups) {
      const d = (pk.x - p.x) ** 2 + (pk.y - p.y) ** 2;
      if (d < bd) { bd = d; best = pk; }
    }
    const danger = Math.hypot(fx, fy);
    if (best) {
      const d = Math.sqrt(bd) || 1;
      const k = danger < 0.01 ? 1 : danger < 0.03 ? 0.4 : 0.1;
      const dn = danger || 1;
      fx = (fx / dn) * (1 - k) + ((best.x - p.x) / d) * k;
      fy = (fy / dn) * (1 - k) + ((best.y - p.y) / d) * k;
    }
    // ぐるぐる まわる
    this.botAng = (this.botAng || 0) + 0.01;
    fx += Math.cos(this.botAng) * 0.004;
    fy += Math.sin(this.botAng) * 0.004;
    const l = Math.hypot(fx, fy) || 1;
    this.input.x = fx / l;
    this.input.y = fy / l;
  }

  // ---------------------------------------------------------------- えがく
  render() {
    const ctx = this.ctx;
    const p = this.player;
    const z = this.zoom * this.dpr;
    const camX = p.x + this.fx.shakeX, camY = p.y + this.fx.shakeY;
    ctx.setTransform(z, 0, 0, z, this.canvas.width / 2 - camX * z, this.canvas.height / 2 - camY * z);
    const L = camX - this.viewW / 2, T = camY - this.viewH / 2;

    // はいけい
    if (!this.bgPattern) this.bgPattern = ctx.createPattern(backgroundTile(this.stage.pal), 'repeat');
    ctx.fillStyle = this.bgPattern;
    ctx.fillRect(L - 2, T - 2, this.viewW + 4, this.viewH + 4);
    if (this.feverT > 0) {
      ctx.fillStyle = `hsla(${(this.time * 120) % 360},100%,60%,0.06)`;
      ctx.fillRect(L - 2, T - 2, this.viewW + 4, this.viewH + 4);
    }

    // じめん
    this.hazards.drawGround(ctx);
    for (const a of this.areas) if (this.inView(a, a.r)) drawArea(ctx, a, this.time);
    for (const w of this.weapons) if (w.id === 'angelite') LOGIC.angelite.draw(this, w, w.s, ctx);

    // アイテム
    for (const pk of this.pickups) {
      if (!this.inView(pk, 30)) continue;
      const bob = Math.sin(this.time * 5 + pk.x * 0.1) * 2;
      let spr;
      if (pk.kind === 'xp') spr = xpSprite(pk.value);
      else if (pk.kind === 'rough') spr = roughSprite(pk.value, ROUGH[pk.value].color, 13);
      else spr = itemSprite(pk.kind === 'coin' ? 'coin' : pk.kind);
      const L2 = spr.logical;
      if (pk.kind !== 'xp' && pk.kind !== 'coin') {
        ctx.globalCompositeOperation = 'lighter';
        const st = starSprite(pk.kind === 'heart' ? '#ff7ab8' : pk.kind === 'rough' ? ROUGH[pk.value].color : '#ffe9a0');
        const s = 26 + Math.sin(this.time * 6) * 4;
        ctx.drawImage(st, pk.x - s, pk.y - s + bob, s * 2, s * 2);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.drawImage(spr, pk.x - L2 / 2, pk.y - L2 / 2 + bob, L2, L2);
    }

    this.fx.drawBelow(ctx);
    this.hazards.drawObjects(ctx);

    // 予告円
    for (const w of this.warns) {
      const k = Math.min(1, w.t / w.T);
      ctx.globalAlpha = 0.25 + 0.35 * k;
      ctx.fillStyle = w.color;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r * k, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ぶき（うしろ）
    for (const w of this.weapons) if (w.id === 'aquamarine') LOGIC.aquamarine.draw(this, w, w.s, ctx);

    for (const w of this.weapons) {
      if (w.id === 'sapphire') LOGIC.sapphire.draw(this, w, w.s, ctx);
      else if (w.id === 'opal') LOGIC.opal.draw(this, w, w.s, ctx);
      else if (w.id === 'moonstone') LOGIC.moonstone.draw(this, w, w.s, ctx);
    }

    // たま
    for (const pr of this.projs) {
      if (!this.inView(pr, 60)) continue;
      if (pr.fall) {
        // かげ
        const t = Math.min(1, pr.ft / pr.fall);
        ctx.fillStyle = `rgba(80,30,90,${0.15 + t * 0.2})`;
        ctx.beginPath();
        ctx.ellipse(pr.tx, pr.ty, 8 + t * 10, 4 + t * 4, 0, 0, TAU);
        ctx.fill();
      }
      if (pr.flame) {
        const t = pr.life / pr.max;
        ctx.globalCompositeOperation = 'lighter';
        const spr = softSprite(t > 0.6 ? '#ffb84a' : t > 0.3 ? '#ff6a3d' : '#d62d6a');
        const s = pr.r * 0.9;
        ctx.globalAlpha = Math.min(1, t * 2.2) * (pr.fa || 1);
        // 進行方向に引き伸ばして、玉が途切れず炎の帯に見えるように
        const L = s + Math.hypot(pr.vx, pr.vy) * 0.09;
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.rotate(Math.atan2(pr.vy, pr.vx));
        ctx.drawImage(spr, -L, -s, L * 2, s * 2);
        ctx.restore();
        if (t > 0.25) {
          // 芯（白飛びしない程度の明るいオレンジ）
          const c = pr.r * 0.5;
          ctx.globalAlpha = Math.min(0.85, (t - 0.25) * 2) * (pr.fa || 1);
          ctx.drawImage(softSprite('#ffcf6a'), pr.x - c, pr.y - c, c * 2, c * 2);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        continue;
      }
      if (!pr.sprite) continue;
      const spr = pr.sprite;
      const Ls = pr.size ? spr.logical * (pr.size / (spr.base || spr.logical)) : spr.logical;
      ctx.save();
      ctx.translate(pr.x, pr.y);
      let rot = pr.rot;
      if (pr.rotToVel) rot = Math.atan2(pr.vy, pr.vx) + (pr.rotOff || Math.PI / 2);
      if (pr.coinFlip) ctx.scale(Math.abs(Math.cos(this.time * 12 + pr.tx)) * 0.8 + 0.2, 1);
      ctx.rotate(rot);
      ctx.drawImage(spr, -Ls / 2, -Ls / 2, Ls, Ls);
      ctx.restore();
    }

    this.fx.draw(ctx, this.time);

    // 敵と自機は攻撃エフェクトより上に描く（エフェクトが重なっても見失わないように）
    // てき
    for (const e of this.enemies) {
      if (!e.alive || !this.inView(e, e.r * 2)) continue;
      const fr = e.type === 'bat' ? Math.floor(this.time * 9 + e.anim) % 2 : (e.charging || e.fuse !== undefined) ? 1 : 0;
      const spr = enemySprite(e.spr, Math.round(e.r), fr, e.flash > 0, e.tint);
      if (e.fade > 0) ctx.globalAlpha = Math.abs(e.fade - 0.25) * 3.5;
      const sq = Math.sin(this.time * 9 + e.anim) * 0.06;
      const Ls = spr.logical;
      if (e.elite || e.boss || e.ai === 'thief') {
        ctx.globalCompositeOperation = 'lighter';
        const g = starSprite(e.boss ? '#ff3ddc' : '#ffd24a');
        const s = e.r * 2.4;
        ctx.drawImage(g, e.x - s, e.y - s, s * 2, s * 2);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (e.windup > 0) {
        ctx.strokeStyle = 'rgba(255,60,100,0.55)';
        ctx.lineWidth = e.boss ? 3 : 1.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + e.dvx * (e.boss ? 420 : 170), e.y + e.dvy * (e.boss ? 420 : 170));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (e.segment) ctx.drawImage(spr, e.x - Ls / 2, e.y - Ls / 2, Ls, Ls);
      else ctx.drawImage(spr, e.x - (Ls * (1 + sq)) / 2, e.y - (Ls * (1 - sq)) / 2, Ls * (1 + sq), Ls * (1 - sq));
      ctx.globalAlpha = 1;
      if (e.breakT > 0) {
        // ブレイク中：頭の上を星が回る
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const a = this.time * 4 + (i / 3) * TAU;
          const sx = e.x + Math.cos(a) * e.r * 0.7, sy = e.y - e.r * 1.05 + Math.sin(a) * e.r * 0.22;
          ctx.drawImage(starSprite('#ffe39a'), sx - 12, sy - 12, 24, 24);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      if (e.charmT > 0) {
        ctx.strokeStyle = 'rgba(255,150,220,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 1.2, 0, TAU);
        ctx.stroke();
      }
      if (e.fuse !== undefined) {
        ctx.strokeStyle = 'rgba(255,120,60,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 70 * (1 - e.fuse / 0.85), 0, TAU);
        ctx.stroke();
      }
      // 属性の状態異常：色の細い輪を 1 つだけ（画面がうるさくならないように）
      const st = e.burnT > 0 ? 'fire' : e.shockT > 0 ? 'thunder' : e.fearT > 0 ? 'dark' : e.wetT > 0 ? 'water' : e.parT > 0 ? 'grass' : e.blindT > 0 ? 'light' : e.chillT > 0 ? 'ice' : null;
      if (st && !(e.frozenT > 0)) {
        ctx.strokeStyle = ELEMENTS[st].color;
        ctx.globalAlpha = 0.5 + 0.25 * Math.sin(this.time * 10 + e.phase);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 1.12 + 2, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (e.frozenT > 0 || this.timeStopT > 0) {
        ctx.fillStyle = 'rgba(150,230,255,0.35)';
        ctx.strokeStyle = 'rgba(220,250,255,0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 1.15, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      if ((e.elite || e.ai === 'thief') && !e.boss) {
        // HPバー
        const w = e.r * 2;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w, 4);
        ctx.fillStyle = '#ffd24a';
        ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w * Math.max(0, e.hp / e.maxHp), 4);
      }
    }

    // プレイヤー（いちばん うえ）
    if (this.state !== 'dying' && this.state !== 'over') {
      if (p.iT > 0 && Math.floor(this.time * 20) % 2 === 0) ctx.globalAlpha = 0.5;
      drawPlayer(ctx, p, this.time, this.charId);
      if (this.earthT > 0) {
        // 土の加護：足元に回る土色の輪
        ctx.strokeStyle = ELEMENTS.earth.color;
        ctx.globalAlpha = Math.min(1, this.earthT) * 0.7;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.lineDashOffset = -this.time * 20;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 10, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = 1;
    }

    this.hazards.drawOverlay(ctx);

    // レーザー
    for (const L of this.lasers) {
      const o = L.owner;
      if (!o) continue;
      const bx = o.x + Math.cos(L.a) * L.len, by = o.y + Math.sin(L.a) * L.len;
      ctx.lineCap = 'round';
      if (L.tele > 0) {
        ctx.globalAlpha = 0.5 + 0.4 * Math.sin(this.time * 30);
        ctx.strokeStyle = L.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(bx, by); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = L.color;
        ctx.lineWidth = L.w * 1.4;
        ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(bx, by); ctx.stroke();
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = L.w * 0.35;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    // てきの たま
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.ebullets) {
      if (!this.inView(b, 20)) continue;
      const s = b.r * 2.2;
      ctx.drawImage(dotSprite(b.color || '#ff3ddc'), b.x - s, b.y - s, s * 2, s * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    // 敵弾は 黒の外縁 → 白の縁 → 色の芯 の順に重ねる（どんな背景・エフェクトの上でも見えるように）
    const vis = this._eb || (this._eb = []);
    vis.length = 0;
    for (const b of this.ebullets) if (this.inView(b, 20)) vis.push(b);
    const disc = (grow, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const b of vis) {
        const r = b.r * 0.55 + grow;
        ctx.moveTo(b.x + r, b.y);
        ctx.arc(b.x, b.y, r, 0, TAU);
      }
      ctx.fill();
    };
    disc(2.6, '#000000');
    disc(1.3, '#ffffff');
    for (const b of vis) {
      ctx.fillStyle = b.color || '#ff3ddc';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.55, 0, TAU);
      ctx.fill();
    }

    this.fx.drawTexts(ctx, this.time);

    // HP バー
    if (this.state !== 'dying') {
      const w = 34;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(p.x - w / 2 - 1, p.y + 21, w + 2, 6);
      const r = Math.max(0, p.hp / p.maxHp);
      ctx.fillStyle = r > 0.5 ? '#4ade80' : r > 0.25 ? '#ffc21a' : '#ff3d6e';
      ctx.fillRect(p.x - w / 2, p.y + 22, w * r, 4);
    }

    // がめんの はしの やじるし（ボス / たからばこ）
    this.drawIndicators(ctx, camX, camY);

    // スクリーン エフェクト
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const CW = this.canvas.width, CH = this.canvas.height;
    if (this.fx.flash > 0) {
      ctx.globalAlpha = Math.min(1, this.fx.flash);
      ctx.fillStyle = this.fx.flashColor;
      ctx.fillRect(0, 0, CW, CH);
      ctx.globalAlpha = 1;
    }
    this.hazards.drawScreen(ctx, CW, CH, this.dpr);
    if (this.timeStopT > 0) {
      ctx.fillStyle = 'rgba(120,200,255,0.12)';
      ctx.fillRect(0, 0, CW, CH);
    }
    const hpR = p.hp / p.maxHp;
    if (hpR < 0.3 && this.state === 'play') {
      const a = (0.3 - hpR) * 1.6 * (0.7 + Math.sin(this.time * 8) * 0.3);
      const g = ctx.createRadialGradient(CW / 2, CH / 2, Math.min(CW, CH) * 0.3, CW / 2, CH / 2, Math.max(CW, CH) * 0.7);
      g.addColorStop(0, 'rgba(255,0,60,0)');
      g.addColorStop(1, `rgba(255,0,60,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CW, CH);
    }
    if (this.feverT > 0) {
      const bw = 3 * this.dpr;
      ctx.lineWidth = bw;
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = `hsl(${(this.time * 360) % 360},100%,65%)`;
      ctx.strokeRect(bw / 2, bw / 2, CW - bw, CH - bw);
      ctx.globalAlpha = 1;
    }
  }

  drawIndicators(ctx, camX, camY) {
    const items = [];
    if (this.boss && this.boss.alive) items.push({ x: this.boss.x, y: this.boss.y, color: '#ff3ddc', label: 'BOSS' });
    for (const pk of this.pickups) if (pk.kind === 'chest' || pk.kind === 'bigchest') items.push({ x: pk.x, y: pk.y, color: '#ffc21a', label: 'CHEST' });
    for (const e of this.enemies) if (e.alive && e.ai === 'thief') items.push({ x: e.x, y: e.y, color: '#ffd24a', label: 'THIEF' });
    const hw = this.viewW / 2 - 18, hh = this.viewH / 2 - 60;
    for (const it of items) {
      const dx = it.x - camX, dy = it.y - camY;
      if (Math.abs(dx) < hw + 10 && Math.abs(dy) < hh + 50) continue;
      const s = Math.min(hw / Math.abs(dx || 1e-3), hh / Math.abs(dy || 1e-3));
      const x = camX + dx * s, y = camY + dy * s;
      const a = Math.atan2(dy, dx);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = it.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(12, 0); ctx.lineTo(-6, -9); ctx.lineTo(-6, 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.font = '700 11px "Rajdhani", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(it.label, x - Math.cos(a) * 18, y - Math.sin(a) * 18);
      ctx.fillStyle = it.color;
      ctx.fillText(it.label, x - Math.cos(a) * 18, y - Math.sin(a) * 18);
    }
  }
}

export { xpFor };
