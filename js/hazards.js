// =====================================================================
//  ステージギミック：水晶柱 / 溶岩 / 吹雪 / 暗闇 / 泡の噴出口 / 歪んだ門 / お茶会の席 / 黒い星の夜 / 流れ星 / 混沌の泡 /
//  つむじ風 / 濁流 / 饕餮の鼎 / 舞の輪 / 炉 / 溶媒の池 / 分離の環 / 日と月の印 / 発酵 / 雫 / 黄金の波
// =====================================================================
import { TAU, rand } from './util.js';
import { pillarSprite, softSprite, starSprite, enemySprite } from './render.js';
import { audio } from './audio.js';
import { warn } from './enemies.js';
import { CHUNK, hashRng } from './gimmick-kit.js';
import { G2 } from './hazards2.js';

// 章ごとのギミック（kind ごとに init・terrain・update・描画などを持つ）
const GIMMICKS = { ...G2 };
// 濁流：横に流れる帯。RIVER_GAP ごとに幅 RIVER_W、向きは 1 本ごとに逆。自機は FLOW、雑魚は FLOW_E の速さで流される
const RIVER_GAP = 520, RIVER_W = 120, FLOW = 80, FLOW_E = 60;
// 炉：燃える範囲の半径。雫：落ちた所の半径
const BURN_R = 95, DROP_R = 72;

// 饕餮の鼎（ためた経験値があると中身が光る。吐いたあとの休みの間は暗い）。絵は render.js の鼎（f=2 暗い・f=3 光る）
function drawCauldron(ctx, o, t) {
  const lit = o.store > 0 && o.cd <= 0;
  if (lit) {
    const full = Math.min(1, o.store / 60);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.3 + 0.5 * full + Math.sin(t * 5 + o.seed) * 0.1;
    const s = o.r * (1.6 + full);
    ctx.drawImage(softSprite('#ffb84a'), o.x - s, o.y - o.r * 0.4 - s, s * 2, s * 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  const spr = enemySprite('kanae', o.r, lit ? 3 : 2);
  const L = spr.logical;
  ctx.drawImage(spr, o.x - L / 2, o.y - L / 2, L, L);
}

// 炉（アタノール）：レンガの塔と、焚き口の炎。光は加算で重ねる
function drawFurnace(ctx, o, t) {
  const x = o.x, y = o.y, r = o.r;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.5 + Math.sin(t * 7 + o.seed) * 0.12;
  ctx.drawImage(softSprite('#ff7a3d'), x - r * 1.8, y - r * 2.3, r * 3.6, r * 3.6);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#3a2a24';
  ctx.strokeStyle = '#8a6a58';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - r, y + r * 0.6);
  ctx.lineTo(x - r * 0.8, y - r * 0.6);
  ctx.quadraticCurveTo(x, y - r * 1.4, x + r * 0.8, y - r * 0.6);
  ctx.lineTo(x + r, y + r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // レンガの目地
  ctx.strokeStyle = 'rgba(140,100,80,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.9, y - r * 0.1);
  ctx.lineTo(x + r * 0.9, y - r * 0.1);
  ctx.moveTo(x - r * 0.85, y - r * 0.45);
  ctx.lineTo(x + r * 0.85, y - r * 0.45);
  ctx.stroke();
  // 焚き口と炎
  ctx.fillStyle = '#1a0a06';
  ctx.beginPath();
  ctx.arc(x, y + r * 0.2, r * 0.42, Math.PI, 0);
  ctx.lineTo(x + r * 0.42, y + r * 0.6);
  ctx.lineTo(x - r * 0.42, y + r * 0.6);
  ctx.closePath();
  ctx.fill();
  const f = Math.sin(t * 9 + o.seed) * 0.15;
  ctx.fillStyle = '#ff8a3d';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.32, y + r * 0.6);
  ctx.quadraticCurveTo(x - r * 0.2, y - r * (0.1 + f), x, y - r * (0.25 + f));
  ctx.quadraticCurveTo(x + r * 0.2, y - r * (0.1 - f), x + r * 0.32, y + r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd23d';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.16, y + r * 0.6);
  ctx.quadraticCurveTo(x, y - r * (0.05 + f), x + r * 0.16, y + r * 0.6);
  ctx.closePath();
  ctx.fill();
}

export class Hazards {
  constructor(g, stage) {
    this.g = g;
    this.kind = stage.hazard;
    this.chunks = new Map();
    this.near = [];
    this.t = 0;
    this.eruptT = 6;
    this.storm = false;
    this.stormT = 45; // 最初の吹雪まで
    this.snow = [];
    this.riftT = 30;
    this.rifts = [];
    this.lavaT = 0;
    this.whirls = []; // つむじ風
    this.whirlT = 6;
    this.whirlBoostT = 0;
    this.dancing = false; // 舞の輪の中にいるか
    // 第4章
    this.burnT = 0; // 炉：燃やす間隔
    this.solvT = 0; // 溶媒の池：中にいる雑魚の印を付け直す間隔
    this.charge = null; // 日と月の印：先に触れた印（kind・残り秒・seal）
    this.drops = []; // 雫（昇る湯気 → 降る雫）
    this.vaporT = 6;
    this.goldWaves = []; // 黄金の波
    this.goldT = 14;
    this.gm = GIMMICKS[this.kind] || null;
    if (this.gm && this.gm.init) this.gm.init(this);
  }

  // ---------------------------------------------------------- 地形（チャンク単位）
  chunk(cx, cy) {
    const k = cx * 100003 + cy;
    let c = this.chunks.get(k);
    if (c) return c;
    c = [];
    const r = hashRng(cx, cy, this.kind === 'lava' ? 7 : 3);
    const ox = cx * CHUNK, oy = cy * CHUNK;
    if (this.gm) {
      if (this.gm.terrain) this.gm.terrain(this, r, ox, oy, c);
    } else if (this.kind === 'pillars') {
      const n = r() < 0.25 ? 0 : r() < 0.6 ? 1 : 2;
      for (let i = 0; i < n; i++) c.push({ x: ox + 40 + r() * (CHUNK - 80), y: oy + 40 + r() * (CHUNK - 80), r: 22 + r() * 22, seed: r() });
    } else if (this.kind === 'cauldron') {
      if (r() < 0.35) c.push({ x: ox + 60 + r() * (CHUNK - 120), y: oy + 60 + r() * (CHUNK - 120), r: 24, seed: r() * TAU, store: 0, cd: 0 });
    } else if (this.kind === 'dance') {
      if (r() < 0.32) c.push({ x: ox + 80 + r() * (CHUNK - 160), y: oy + 80 + r() * (CHUNK - 160), r: 72, seed: r() * TAU });
    } else if (this.kind === 'lava') {
      if (r() < 0.6) c.push({ x: ox + 70 + r() * (CHUNK - 140), y: oy + 70 + r() * (CHUNK - 140), r: 42 + r() * 36, seed: r() * TAU });
    } else if (this.kind === 'athanor') {
      if (r() < 0.4) c.push({ x: ox + 70 + r() * (CHUNK - 140), y: oy + 70 + r() * (CHUNK - 140), r: 24, seed: r() * TAU });
    } else if (this.kind === 'solvent') {
      if (r() < 0.42) c.push({ x: ox + 90 + r() * (CHUNK - 180), y: oy + 90 + r() * (CHUNK - 180), r: 62 + r() * 26, seed: r() * TAU });
    } else if (this.kind === 'sieve') {
      if (r() < 0.36) c.push({ x: ox + 70 + r() * (CHUNK - 140), y: oy + 70 + r() * (CHUNK - 140), r: 54, seed: r() * TAU, hold: 0, cd: 0 });
    } else if (this.kind === 'sunmoon') {
      // 太陽の印と月の印を 1 組で置く
      if (r() < 0.42) {
        const x = ox + 110 + r() * (CHUNK - 220), y = oy + 110 + r() * (CHUNK - 220), a = r() * TAU;
        const sun = { x: x - Math.cos(a) * 75, y: y - Math.sin(a) * 75, r: 26, kind: 'sun', seed: r() * TAU, cd: 0 };
        const moon = { x: x + Math.cos(a) * 75, y: y + Math.sin(a) * 75, r: 26, kind: 'moon', seed: r() * TAU, cd: 0 };
        sun.pair = moon;
        moon.pair = sun;
        c.push(sun, moon);
      }
    }
    // 開始地点の近くには置かない
    for (let i = c.length - 1; i >= 0; i--) if (Math.hypot(c[i].x, c[i].y) < 130) c.splice(i, 1);
    // 日と月の印は、相方が消えたら一緒に消す
    if (this.kind === 'sunmoon') for (let i = c.length - 1; i >= 0; i--) if (!c.includes(c[i].pair)) c.splice(i, 1);
    this.chunks.set(k, c);
    return c;
  }

  // x,y の周囲 9 チャンクぶん
  around(x, y, out) {
    out.length = 0;
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const o of this.chunk(cx + i, cy + j)) out.push(o);
    return out;
  }

  inView(x, y, out) {
    const g = this.g;
    out.length = 0;
    const x0 = Math.floor((x - g.viewW / 2 - 80) / CHUNK), x1 = Math.floor((x + g.viewW / 2 + 80) / CHUNK);
    const y0 = Math.floor((y - g.viewH / 2 - 80) / CHUNK), y1 = Math.floor((y + g.viewH / 2 + 80) / CHUNK);
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) for (const o of this.chunk(i, j)) out.push(o);
    return out;
  }

  // 柱から押し出す
  collide(obj, r) {
    if (this.gm) { if (this.gm.collide) this.gm.collide(this, obj, r); return; }
    if (this.kind !== 'pillars') return;
    const list = this.around(obj.x, obj.y, this._c || (this._c = []));
    for (const o of list) {
      const dx = obj.x - o.x, dy = obj.y - o.y;
      const rr = o.r + r;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 0.01;
        obj.x = o.x + (dx / d) * rr;
        obj.y = o.y + (dy / d) * rr;
      }
    }
  }

  blocks(x, y) {
    if (this.gm) return this.gm.blocks ? this.gm.blocks(this, x, y) : false;
    if (this.kind !== 'pillars') return false;
    const list = this.around(x, y, this._b || (this._b = []));
    for (const o of list) if ((x - o.x) ** 2 + (y - o.y) ** 2 < o.r * o.r) return true;
    return false;
  }

  // (x, y) から角度 a へ伸びる長さ len の線が、最初に柱に当たるまでの長さ（ボスのレーザーを柱で遮る）
  rayCut(x, y, a, len) {
    if (this.gm) return this.gm.rayCut ? this.gm.rayCut(this, x, y, a, len) : len;
    if (this.kind !== 'pillars') return len;
    const ax = Math.cos(a), ay = Math.sin(a);
    const ex = x + ax * len, ey = y + ay * len;
    const x0 = Math.floor((Math.min(x, ex) - 50) / CHUNK), x1 = Math.floor((Math.max(x, ex) + 50) / CHUNK);
    const y0 = Math.floor((Math.min(y, ey) - 50) / CHUNK), y1 = Math.floor((Math.max(y, ey) + 50) / CHUNK);
    let best = len;
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
      for (const o of this.chunk(i, j)) {
        if ((o.x - x) ** 2 + (o.y - y) ** 2 < o.r * o.r) continue; // 柱の中から撃つ場合（ボスは柱をすり抜ける）は遮らない
        const t = (o.x - x) * ax + (o.y - y) * ay;
        if (t < 0 || t - o.r > best) continue;
        const cx = x + ax * t - o.x, cy = y + ay * t - o.y;
        const d2 = cx * cx + cy * cy;
        if (d2 >= o.r * o.r) continue;
        best = Math.min(best, Math.max(0, t - Math.sqrt(o.r * o.r - d2)));
      }
    }
    return best;
  }

  // 経験値への補正
  xpMul() {
    if (this.gm) return this.gm.xpMul ? this.gm.xpMul(this) : 1;
    return 1;
  }

  // 与ダメージへの補正（舞の輪）
  dmgMul() {
    if (this.gm) return this.gm.dmgMul ? this.gm.dmgMul(this) : 1;
    return this.kind === 'dance' && this.dancing ? 1.3 : 1;
  }

  // 濁流の向き（帯の中なら ±1、外なら 0）
  flowAt(y) {
    const k = Math.floor(y / RIVER_GAP);
    if (Math.abs(y - (k * RIVER_GAP + RIVER_GAP / 2)) > RIVER_W / 2) return 0;
    return k & 1 ? -1 : 1;
  }

  // 移動速度への補正
  speedMul() {
    if (this.gm) return this.gm.speedMul ? this.gm.speedMul(this) : 1;
    if (this.kind === 'whirl' && this.whirlBoostT > 0) return 1.4;
    return this.kind === 'blizzard' && this.storm ? 0.72 : 1;
  }

  // 攻撃の速さへの補正（武器の時間の進み）
  fireMul() {
    return this.gm && this.gm.fireMul ? this.gm.fireMul(this) : 1;
  }

  // 雑魚の出現の数とペースへの補正
  spawnMul() {
    return this.gm && this.gm.spawnMul ? this.gm.spawnMul(this) : 1;
  }

  // 自動プレイ（テスト）がギミックを避ける向き [x, y]。なければ null
  botAvoid(p) {
    return this.gm && this.gm.avoid ? this.gm.avoid(this, p) : null;
  }

  // ---------------------------------------------------------- 更新
  update(dt) {
    const g = this.g, p = g.player;
    this.t += dt;
    if (this.gm) { this.gm.update(this, dt); return; }
    if (this.kind === 'pillars') {
      this.collide(p, p.r);
      // 敵も柱を避ける（押し出し）
      for (const e of g.enemies) if (e.alive && !e.prop && !e.boss && !e.segment && g.inView(e, 120)) this.collide(e, e.r * 0.8);
      // 敵弾は柱で止まる
      for (const b of g.ebullets) if (this.blocks(b.x, b.y)) { b.life = 0; g.fx.burst(b.x, b.y, '#8ff0ff', 3, 80, 0.25, 6); }
    } else if (this.kind === 'lava') {
      // 時間停止中は、溶岩のダメージも噴火の予告も止める（止まっている間に予告がたまって、解除直後にまとめて噴火しないように）
      if (g.timeStopT > 0) return;
      this.lavaT -= dt;
      const list = this.around(p.x, p.y, this._c || (this._c = []));
      let inLava = false;
      for (const o of list) if ((p.x - o.x) ** 2 + (p.y - o.y) ** 2 < (o.r - 4) ** 2) inLava = true;
      if (inLava && this.lavaT <= 0) {
        this.lavaT = 0.4;
        g.hurtPlayer(12 * g.stageDmg, { ignoreIT: true, silent: true }); // 溶岩（敵の攻撃力と合わせて 2 倍）
        g.fx.burst(p.x, p.y, '#ff6a3d', 4, 120, 0.3, 8);
      }
      // 噴火
      this.eruptT -= dt;
      if (this.eruptT <= 0) {
        this.eruptT = g.progress() > 300 ? 3.8 : 5;
        const n = g.progress() > 300 ? 4 : 3;
        for (let i = 0; i < n; i++) {
          const x = p.x + (i ? rand(-150, 150) : p.dirX * (p.moving ? 60 : 0));
          const y = p.y + (i ? rand(-150, 150) : p.dirY * (p.moving ? 60 : 0));
          warn(g, x, y, 55, 1.3, '#ff6a3d', (g2) => {
            g2.fx.burst(x, y, '#ff8a3d', 16, 260, 0.6, 14);
            g2.fx.ring(x, y, 8, 60, 0.35, '#ffb84a', 6);
            g2.fx.shake(3);
            audio.bomb(false, 2); // 噴火の音は同時に 2 つまで
            if (Math.hypot(g2.player.x - x, g2.player.y - y) < 55 + g2.player.r) g2.hurtPlayer(32 * g2.stageDmg); // 噴火（2 倍）
            g2.aoe(x, y, 55, 300 * g2.hpScale(), null, { kb: 150 });
          });
        }
      }
    } else if (this.kind === 'whirl') {
      // つむじ風：北から南へ流れながら、近くの経験値を巻き上げて中心に集める。触れると少しの間だけ速く走れる
      if (g.timeStopT > 0) return;
      this.whirlBoostT -= dt;
      this.whirlT -= dt;
      if (this.whirlT <= 0) {
        this.whirlT = rand(9, 13);
        const a = rand(TAU), d = rand(150, 230);
        this.whirls.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d - 60, vx: rand(-25, 25), vy: rand(30, 50), t: 0, T: 14, r: 44 });
      }
      for (const w of this.whirls) {
        w.t += dt;
        w.x += w.vx * dt;
        w.y += w.vy * dt;
        const R = w.r * 2.8;
        for (const pk of g.pickups) {
          if (pk.kind !== 'xp' || pk.vac) continue;
          const dx = w.x - pk.x, dy = w.y - pk.y, d2 = dx * dx + dy * dy;
          if (d2 > R * R) continue;
          const d = Math.sqrt(d2) || 1;
          if (d > 10) { const sp = Math.min(150 * dt, d); pk.x += (dx / d) * sp; pk.y += (dy / d) * sp; } else { pk.x += w.vx * dt; pk.y += w.vy * dt; }
        }
        if (w.t < w.T - 0.8 && (p.x - w.x) ** 2 + (p.y - w.y) ** 2 < (w.r + p.r) ** 2) {
          if (this.whirlBoostT <= 0) { g.fx.ring(p.x, p.y, 6, 50, 0.35, '#bfe8ff', 5); audio.whoosh(); }
          this.whirlBoostT = 2.2;
        }
        if (Math.random() < 0.5 && g.inView(w, 40)) g.fx.add(w.x + rand(-w.r, w.r), w.y + rand(-w.r, w.r) * 0.5, rand(-40, 40), -rand(40, 90), 0.6, 4, '#dff2ff', 'dot');
      }
      this.whirls = this.whirls.filter((w) => w.t < w.T);
      if (this.whirlBoostT > 0 && p.moving && Math.random() < 0.4) g.fx.add(p.x + rand(-8, 8), p.y + rand(-8, 8), -p.dirX * 60, -p.dirY * 60, 0.5, 5, '#bfe8ff', 'dot');
    } else if (this.kind === 'flood') {
      // 濁流：帯の中では自機も雑魚も流される（ボスは流されない。時間停止中は雑魚も止まったまま）
      const f = this.flowAt(p.y);
      if (f) {
        p.x += f * FLOW * dt;
        if (Math.random() < 0.3) g.fx.add(p.x + rand(-10, 10), p.y + rand(-6, 6), f * 60, rand(-20, 20), 0.5, 5, '#bff5e6', 'dot');
      }
      if (!(g.timeStopT > 0)) {
        for (const e of g.enemies) {
          if (!e.alive || e.boss || e.prop || e.segment) continue;
          const fe = this.flowAt(e.y);
          if (fe) e.x += fe * FLOW_E * dt;
        }
      }
    } else if (this.kind === 'cauldron') {
      // 饕餮の鼎：近くの経験値を吸い込んでためる。触れると 1.5 倍にして吐き出し、しばらく休む
      const list = this.around(p.x, p.y, this._c || (this._c = []));
      let ate = false;
      for (const o of list) {
        if (o.cd > 0) { o.cd -= dt; continue; }
        for (const pk of g.pickups) {
          if (pk.kind !== 'xp' || pk.vac) continue;
          const dx = o.x - pk.x, dy = o.y - pk.y, d2 = dx * dx + dy * dy;
          if (d2 > 130 * 130) continue;
          const d = Math.sqrt(d2) || 1;
          if (d < 16) { o.store += pk.value; pk.eaten = true; ate = true; continue; }
          pk.x += (dx / d) * 110 * dt;
          pk.y += (dy / d) * 110 * dt;
        }
        if (o.store > 0 && (p.x - o.x) ** 2 + (p.y - o.y) ** 2 < (o.r + p.r) ** 2) {
          const v = o.store * 1.5;
          o.store = 0;
          o.cd = 6;
          const n = Math.min(16, Math.max(3, Math.ceil(v / 15)));
          for (let i = 0; i < n; i++) g.dropPickup('xp', o.x, o.y, Math.max(1, Math.round(v / n)));
          g.fx.burst(o.x, o.y - 10, '#ffd23d', 18, 240, 0.6, 10);
          g.fx.ring(o.x, o.y, 6, 50, 0.35, '#e8c070', 5);
          audio.chestOpen();
        }
      }
      if (ate) g.pickups = g.pickups.filter((pk) => !pk.eaten);
    } else if (this.kind === 'dance') {
      // 舞の輪：中にいる間は与ダメージ ×1.3（dmgMul）
      this.dancing = false;
      for (const o of this.around(p.x, p.y, this._c || (this._c = []))) {
        if ((p.x - o.x) ** 2 + (p.y - o.y) ** 2 > o.r * o.r) continue;
        this.dancing = true;
        break;
      }
      if (this.dancing && Math.random() < 0.25) g.fx.add(p.x + rand(-12, 12), p.y + rand(-6, 6), 0, -50, 0.7, 5, '#ffd27a', 'star');
    } else if (this.kind === 'athanor') {
      // 炉：近く（半径 BURN_R）を通る雑魚が燃える（0.5 秒ごとに最大 HP の 6%）
      this.burnT -= dt;
      if (this.burnT <= 0) {
        this.burnT = 0.5;
        const fs = this.around(p.x, p.y, this._c || (this._c = []));
        if (fs.length) {
          for (const e of g.enemies) {
            if (!e.alive || e.boss || e.prop || e.segment) continue;
            for (const o of fs) {
              if ((e.x - o.x) ** 2 + (e.y - o.y) ** 2 > BURN_R * BURN_R) continue;
              e.athT = 0.6;
              g.damage(e, e.maxHp * 0.06, { dot: true, silent: true });
              break;
            }
          }
        }
      }
      for (const e of g.enemies) {
        if (!(e.athT > 0)) continue;
        e.athT -= dt;
        if (e.alive && Math.random() < 0.15 && g.inView(e, 20)) g.fx.add(e.x + rand(-e.r, e.r) * 0.6, e.y - e.r * 0.4, rand(-10, 10), -rand(40, 80), 0.5, 5, '#ff8a3d', 'dot');
      }
    } else if (this.kind === 'solvent') {
      // 溶媒の池：中にいる雑魚に印（e.solv）を付ける。印のある雑魚は遅くなり、受けるダメージ ×1.5（game.js の damage）
      this.solvT -= dt;
      if (this.solvT <= 0) {
        this.solvT = 0.2;
        const ps = this.inView(p.x, p.y, this._v2 || (this._v2 = []));
        for (const e of g.enemies) {
          if (!e.alive || e.boss || e.prop || e.segment) continue;
          let inside = false;
          for (const o of ps) if ((e.x - o.x) ** 2 + (e.y - o.y) ** 2 < o.r * o.r) { inside = true; break; }
          e.solv = inside;
          if (inside) {
            if (!(e.slowT > 0) || e.slowMul > 0.6) e.slowMul = 0.6;
            e.slowT = Math.max(e.slowT, 0.3);
          }
        }
      }
    } else if (this.kind === 'sieve') {
      // 分離の環：1 秒立つと、重いもの（雑魚）を押し返し、精妙なもの（経験値）を引き寄せる。そのあと 9 秒休む
      for (const o of this.around(p.x, p.y, this._c || (this._c = []))) {
        if (o.cd > 0) { o.cd -= dt; continue; }
        if ((p.x - o.x) ** 2 + (p.y - o.y) ** 2 > o.r * o.r) { o.hold = 0; continue; }
        o.hold += dt;
        if (o.hold < 1) continue;
        o.hold = 0;
        o.cd = 9;
        for (const e of g.enemies) {
          if (!e.alive || e.boss || e.prop || e.segment) continue;
          const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || 1;
          if (d > 240) continue;
          const k = (e.kbk ?? 1) * 520 * (1 - d / 300);
          e.vx += (dx / d) * k;
          e.vy += (dy / d) * k;
        }
        for (const pk of g.pickups) if (pk.kind === 'xp' && (pk.x - p.x) ** 2 + (pk.y - p.y) ** 2 < 480 * 480) pk.vac = true;
        g.fx.ring(o.x, o.y, o.r, 240, 0.5, '#e8ecff', 6);
        g.fx.burst(o.x, o.y, '#ffffff', 16, 260, 0.5, 9);
        audio.whoosh();
      }
    } else if (this.kind === 'sunmoon') {
      // 日と月の印：片方に触れると 12 秒だけその光をまとい、その間にもう片方の種類に触れると、結合の光で周りの敵を焼く。使った印は 14 秒休む
      if (this.charge) { this.charge.t -= dt; if (this.charge.t <= 0) this.charge = null; }
      for (const o of this.around(p.x, p.y, this._c || (this._c = []))) {
        if (o.cd > 0) { o.cd -= dt; continue; }
        if ((p.x - o.x) ** 2 + (p.y - o.y) ** 2 > (o.r + p.r) ** 2) continue;
        if (this.charge && this.charge.kind !== o.kind) {
          o.cd = 14;
          this.charge.seal.cd = 14;
          this.charge = null;
          const R = 260;
          for (const e of g.enemies) {
            if (!e.alive || e.prop || e.segment) continue;
            if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > (R + e.r) ** 2) continue;
            g.damage(e, e.maxHp * (e.boss ? 0.015 : 0.85), { kb: 260 });
          }
          g.fx.ring(p.x, p.y, 10, R, 0.6, '#fff2c0', 10);
          g.fx.ring(p.x, p.y, 10, R * 0.8, 0.5, '#cfd8ff', 6);
          g.fx.screenFlash(0.35, '#fff2c0');
          g.fx.shake(10);
          g.hooks.banner('CONIUNCTIO', 'item', '太陽と月が結ばれた');
          audio.bomb(true);
        } else if (!this.charge || this.charge.seal !== o) {
          this.charge = { kind: o.kind, t: 12, seal: o };
          g.fx.ring(o.x, o.y, 6, 60, 0.4, o.kind === 'sun' ? '#ffd23d' : '#cfd8ff', 5);
          audio.pickup();
        }
      }
    } else if (this.kind === 'ferment') {
      // 発酵：落ちたまま 6 秒たった経験値は 1.5 倍になる（1 度だけ）
      for (const pk of g.pickups) {
        if (pk.kind !== 'xp' || pk.fer || pk.vac || pk.t < 6) continue;
        pk.fer = true;
        pk.value = Math.max(pk.value + 1, Math.round(pk.value * 1.5));
        if (Math.random() < 0.5 && g.inView(pk, 20)) g.fx.add(pk.x, pk.y - 6, 0, -40, 0.6, 5, '#7fffb0', 'star');
      }
    } else if (this.kind === 'vapor') {
      // 天と地を巡る雫：地面から湯気が昇り（1.4 秒）、雫になって降る（1.2 秒）。落ちた所（半径 DROP_R）の敵を打つ
      if (g.timeStopT > 0) return;
      this.vaporT -= dt;
      if (this.vaporT <= 0) {
        this.vaporT = rand(6, 9);
        const n = Math.random() < 0.5 ? 4 : 3;
        for (let i = 0; i < n; i++) {
          const a = rand(TAU), d = rand(80, 230);
          this.drops.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, t: -i * 0.25, hit: false });
        }
      }
      for (const o of this.drops) {
        o.t += dt;
        if (o.t > 0 && o.t < 1.4 && Math.random() < 0.5 && g.inView(o, 40)) g.fx.add(o.x + rand(-14, 14), o.y - rand(0, 10), rand(-8, 8), -rand(60, 110), 0.7, 6, '#e8f8ff', 'dot');
        if (!o.hit && o.t >= 2.6) {
          o.hit = true;
          for (const e of g.enemies) {
            if (!e.alive || e.prop || e.segment) continue;
            if ((e.x - o.x) ** 2 + (e.y - o.y) ** 2 > (DROP_R + e.r) ** 2) continue;
            g.damage(e, e.maxHp * (e.boss ? 0.008 : 0.6));
          }
          g.fx.ring(o.x, o.y, 6, DROP_R, 0.4, '#bfe8ff', 6);
          g.fx.burst(o.x, o.y, '#d0f0ff', 12, 200, 0.5, 9);
          if (g.inView(o, 40)) audio.splash();
        }
      }
      this.drops = this.drops.filter((o) => o.t < 3);
    } else if (this.kind === 'gold') {
      // 黄金の波：ときどき自機の近くから金色の輪が広がり、触れた雑魚は金になって 5 秒止まる。金の雑魚は倒すとコインを落とす（game.js の kill）
      if (g.timeStopT > 0) return;
      this.goldT -= dt;
      if (this.goldT <= 0) {
        this.goldT = rand(15, 21);
        this.goldWaves.push({ x: p.x + rand(-100, 100), y: p.y + rand(-100, 100), t: 0, T: 1.5, R: 300 });
        g.hooks.banner('CHRYSOPOEIA', 'item', '黄金の波 — 触れた雑魚が金に変わる');
        audio.whoosh();
      }
      for (const w of this.goldWaves) {
        w.t += dt;
        const rr = (w.t / w.T) * w.R;
        for (const e of g.enemies) {
          if (!e.alive || e.boss || e.prop || e.segment || e.gold || e.ai === 'thief') continue;
          const d = Math.hypot(e.x - w.x, e.y - w.y);
          if (d > rr + e.r || d < rr - 40) continue;
          e.gold = true;
          e.frozenT = Math.max(e.frozenT, 5);
          e.tint = '#e8c050';
          if (g.inView(e, 20)) g.fx.burst(e.x, e.y, '#ffd23d', 4, 100, 0.35, 6);
        }
      }
      this.goldWaves = this.goldWaves.filter((w) => w.t < w.T);
    } else if (this.kind === 'blizzard') {
      this.stormT -= dt;
      if (this.stormT <= 0) {
        this.storm = !this.storm;
        this.stormT = this.storm ? 14 : 38;
        if (this.storm) {
          this.wind = rand(TAU);
          g.hooks.banner('BLIZZARD', 'item', '吹雪 — 移動速度・視界低下');
          audio.whoosh();
        }
      }
      if (this.storm) {
        p.x += Math.cos(this.wind) * 28 * dt;
        p.y += Math.sin(this.wind) * 28 * dt;
        // 雪（画面に対する割合の座標。フレームレートによらず同じ速さで流れるよう、ここで動かす）
        while (this.snow.length < 90) this.snow.push({ x: Math.random(), y: Math.random(), s: rand(1, 3), v: rand(0.3, 0.8) });
        const wx = Math.cos(this.wind), wy = Math.sin(this.wind);
        for (const f of this.snow) {
          f.x += (wx * 0.6 + 0.05) * f.v * 3 * dt;
          f.y += (wy * 0.6 + 0.4) * f.v * 3 * dt;
          if (f.x > 1.05) f.x -= 1.1; if (f.x < -0.05) f.x += 1.1;
          if (f.y > 1.05) f.y -= 1.1; if (f.y < -0.05) f.y += 1.1;
        }
      }
    } else if (this.kind === 'darkness') {
      if (g.timeStopT > 0) return; // 時間停止中は裂け目も止まる（敵が湧かない）
      this.riftT -= dt;
      if (this.riftT <= 0) {
        this.riftT = g.progress() > 360 ? 18 : 25;
        const a = rand(TAU);
        this.rifts.push({ x: p.x + Math.cos(a) * 230, y: p.y + Math.sin(a) * 230, t: 0, T: 6, n: 0 });
        g.hooks.banner('RIFT', 'swarm', '虚空の裂け目が開いた');
      }
      for (const r of this.rifts) {
        r.t += dt;
        if (r.n < Math.floor(r.t / 0.9) && r.t < r.T - 0.5) {
          r.n++;
          for (let i = 0; i < 2; i++) g.spawnEnemy('phantom', r.x + rand(-20, 20), r.y + rand(-20, 20));
        }
      }
      this.rifts = this.rifts.filter((r) => r.t < r.T);
    }
  }

  // ---------------------------------------------------------- 描画（地面）
  drawGround(ctx) {
    const g = this.g, p = g.player;
    if (this.gm) { if (this.gm.ground) this.gm.ground(this, ctx); return; }
    if (this.kind === 'flood') {
      const x0 = p.x - g.viewW / 2 - 40, W = g.viewW + 80;
      const k0 = Math.floor((p.y - g.viewH / 2 - RIVER_W) / RIVER_GAP), k1 = Math.floor((p.y + g.viewH / 2 + RIVER_W) / RIVER_GAP);
      for (let k = k0; k <= k1; k++) {
        const cy = k * RIVER_GAP + RIVER_GAP / 2, top = cy - RIVER_W / 2;
        const dir = k & 1 ? -1 : 1;
        const grd = ctx.createLinearGradient(0, top, 0, top + RIVER_W);
        grd.addColorStop(0, 'rgba(40,110,90,0.45)');
        grd.addColorStop(0.5, 'rgba(30,80,70,0.3)');
        grd.addColorStop(1, 'rgba(40,110,90,0.45)');
        ctx.fillStyle = grd;
        ctx.fillRect(x0, top, W, RIVER_W);
        ctx.strokeStyle = 'rgba(160,240,215,0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0, top);
        ctx.lineTo(x0 + W, top);
        ctx.moveTo(x0, top + RIVER_W);
        ctx.lineTo(x0 + W, top + RIVER_W);
        ctx.stroke();
        // 流れの筋
        ctx.strokeStyle = 'rgba(200,255,240,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 18; i++) {
          const ly = top + 14 + ((i * 37) % (RIVER_W - 28));
          const span = 220 + (i % 5) * 40;
          const off = (((i * 131 + this.t * dir * FLOW * 1.4) % span) + span) % span;
          for (let x = Math.floor(x0 / span) * span + off; x < x0 + W; x += span) {
            ctx.moveTo(x, ly);
            ctx.lineTo(x + dir * 26, ly);
          }
        }
        ctx.stroke();
      }
    }
    if (this.kind === 'athanor') {
      // 炉の火が届く範囲（うすい光と点線）
      for (const o of this.inView(p.x, p.y, this._v || (this._v = []))) {
        ctx.globalAlpha = 0.16 + 0.05 * Math.sin(this.t * 4 + o.seed);
        ctx.drawImage(softSprite('#ff7a3d'), o.x - BURN_R, o.y - BURN_R, BURN_R * 2, BURN_R * 2);
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#ff9a5a';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 7]);
        ctx.beginPath();
        ctx.arc(o.x, o.y, BURN_R, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }
    if (this.kind === 'solvent') {
      // 溶媒の池：空を映す水面（ゆらぐ光の筋）
      for (const o of this.inView(p.x, p.y, this._v || (this._v = []))) {
        const grd = ctx.createRadialGradient(o.x, o.y, o.r * 0.2, o.x, o.y, o.r);
        grd.addColorStop(0, 'rgba(60,170,220,0.26)');
        grd.addColorStop(1, 'rgba(30,110,170,0.42)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(160,230,255,0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(220,245,255,0.35)';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 3; i++) {
          const yy = o.y - o.r * 0.4 + i * o.r * 0.35;
          const w = Math.sqrt(Math.max(0, o.r * o.r - (yy - o.y) ** 2)) * 0.7;
          const sh = Math.sin(this.t * 1.5 + o.seed + i) * 8;
          ctx.beginPath();
          ctx.moveTo(o.x - w + sh, yy);
          ctx.lineTo(o.x + w * 0.5 + sh, yy);
          ctx.stroke();
        }
      }
    }
    if (this.kind === 'sieve') {
      // 分離の環：二重の輪と、回る火と水の記号（△・▽）。立っている間は進み具合の弧
      for (const o of this.inView(p.x, p.y, this._v || (this._v = []))) {
        const ready = o.cd <= 0;
        ctx.globalAlpha = ready ? 0.75 : 0.22;
        ctx.strokeStyle = '#e8ecff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r * 0.72, 0, TAU);
        ctx.stroke();
        const a0 = this.t * 0.6 + o.seed;
        for (let i = 0; i < 4; i++) {
          const a = a0 + (i / 4) * TAU;
          const x = o.x + Math.cos(a) * o.r * 0.86, y = o.y + Math.sin(a) * o.r * 0.86;
          const up = i % 2 ? -1 : 1;
          ctx.beginPath();
          ctx.moveTo(x, y - 5 * up);
          ctx.lineTo(x - 4.5, y + 4 * up);
          ctx.lineTo(x + 4.5, y + 4 * up);
          ctx.closePath();
          ctx.stroke();
        }
        if (o.hold > 0) {
          ctx.globalAlpha = 0.95;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.r, -Math.PI / 2, -Math.PI / 2 + Math.min(1, o.hold) * TAU);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
    if (this.kind === 'sunmoon') {
      // 日と月の印：組を結ぶ点線と、☉・☽ の印（使ったあとの休みの間は暗い）
      for (const o of this.inView(p.x, p.y, this._v || (this._v = []))) {
        if (o.kind === 'sun') {
          ctx.globalAlpha = 0.25;
          ctx.strokeStyle = '#fff2c0';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 8]);
          ctx.beginPath();
          ctx.moveTo(o.x, o.y);
          ctx.lineTo(o.pair.x, o.pair.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        const ready = o.cd <= 0;
        const lit = this.charge && this.charge.seal === o;
        const col = o.kind === 'sun' ? '#ffd23d' : '#cfd8ff';
        ctx.globalAlpha = ready ? (lit ? 0.6 : 0.35) : 0.12;
        ctx.drawImage(softSprite(col), o.x - o.r * 1.8, o.y - o.r * 1.8, o.r * 3.6, o.r * 3.6);
        ctx.globalAlpha = ready ? 0.95 : 0.3;
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, TAU);
        ctx.stroke();
        if (o.kind === 'sun') {
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.r * 0.5, 0, TAU);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.r * 0.13, 0, TAU);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.r * 0.55, Math.PI * 0.35, Math.PI * 1.65);
          ctx.arc(o.x + o.r * 0.22, o.y, o.r * 0.42, Math.PI * 1.55, Math.PI * 0.45, true);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    if (this.kind === 'ferment') {
      // 発酵した経験値の下に、うすい緑の光
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      const spr = softSprite('#5fe0a0');
      for (const pk of g.pickups) {
        if (!pk.fer || !g.inView(pk, 20)) continue;
        ctx.drawImage(spr, pk.x - 13, pk.y - 13, 26, 26);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (this.kind === 'vapor') {
      // 雫の落ちる所（降ってくる間はくっきり）
      for (const o of this.drops) {
        if (o.t < 0 || o.hit) continue;
        ctx.globalAlpha = o.t < 1.4 ? 0.25 : 0.25 + ((o.t - 1.4) / 1.2) * 0.5;
        ctx.strokeStyle = '#d0f0ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(o.x, o.y, DROP_R, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }
    if (this.kind === 'gold') {
      // 黄金の波
      for (const w of this.goldWaves) {
        const rr = (w.t / w.T) * w.R;
        ctx.globalAlpha = Math.min(1, (w.T - w.t) / 0.4) * 0.85;
        ctx.strokeStyle = '#ffd23d';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(w.x, w.y, rr, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = '#fff6c0';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    if (this.kind === 'dance') {
      const beat = 1 - ((this.t * 140) / 60) % 1;
      for (const o of this.inView(p.x, p.y, this._v || (this._v = []))) {
        const inside = this.dancing && (p.x - o.x) ** 2 + (p.y - o.y) ** 2 <= o.r * o.r;
        ctx.globalAlpha = inside ? 0.45 : 0.22;
        ctx.drawImage(softSprite('#ffa040'), o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
        ctx.globalAlpha = 0.35 + 0.4 * beat;
        ctx.strokeStyle = '#ffc070';
        ctx.lineWidth = 2 + beat * 2;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r * (0.96 + 0.04 * beat), 0, TAU);
        ctx.stroke();
        // 回る足あとの印
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#ffe0a0';
        for (let i = 0; i < 8; i++) {
          const a = this.t * 0.9 + o.seed + (i / 8) * TAU;
          ctx.beginPath();
          ctx.arc(o.x + Math.cos(a) * o.r * 0.78, o.y + Math.sin(a) * o.r * 0.78, 3, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    if (this.kind === 'lava') {
      const list = this.inView(p.x, p.y, this._v || (this._v = []));
      for (const o of list) {
        // 暗い縁 → 橙の芯
        const grd = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        grd.addColorStop(0, '#ffb84a');
        grd.addColorStop(0.45, '#ff5a1f');
        grd.addColorStop(0.85, '#8a1a08');
        grd.addColorStop(1, 'rgba(40,5,0,0.9)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        for (let i = 0; i <= 16; i++) {
          const a = (i / 16) * TAU;
          const rr = o.r * (0.9 + 0.1 * Math.sin(a * 3 + o.seed + g.time * 0.8));
          i ? ctx.lineTo(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr) : ctx.moveTo(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr);
        }
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25 + 0.1 * Math.sin(g.time * 3 + o.seed);
        const s = o.r * 1.6;
        ctx.drawImage(softSprite('#ff6a3d'), o.x - s, o.y - s, s * 2, s * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        if (Math.random() < 0.05) g.fx.add(o.x + rand(-o.r, o.r) * 0.6, o.y + rand(-o.r, o.r) * 0.6, 0, -40, 0.8, 6, '#ffb84a', 'star');
      }
    }
    if (this.kind === 'darkness') {
      for (const r of this.rifts) {
        const k = Math.min(1, r.t / 0.5) * Math.min(1, (r.T - r.t) / 0.5);
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(g.time * 2);
        ctx.globalAlpha = k;
        ctx.strokeStyle = '#e05cff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#e05cff';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.ellipse(0, 0, 34, 12, 0, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
  }

  // 柱など（敵と同じ高さ）
  drawObjects(ctx) {
    if (this.gm) { if (this.gm.objects) this.gm.objects(this, ctx); return; }
    if (this.kind === 'athanor') {
      const p = this.g.player;
      for (const o of this.inView(p.x, p.y, this._v || (this._v = []))) drawFurnace(ctx, o, this.t);
      return;
    }
    if (this.kind === 'vapor') {
      // 降ってくる雫（高い所から落ちる）
      for (const o of this.drops) {
        if (o.t < 1.4 || o.hit) continue;
        const k = (o.t - 1.4) / 1.2;
        const y = o.y - (1 - k) * 260;
        ctx.fillStyle = '#e8f8ff';
        ctx.beginPath();
        ctx.moveTo(o.x, y - 14);
        ctx.quadraticCurveTo(o.x + 9, y, o.x, y + 8);
        ctx.quadraticCurveTo(o.x - 9, y, o.x, y - 14);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,190,230,0.9)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      return;
    }
    if (this.kind === 'whirl') {
      const g = this.g;
      ctx.save();
      ctx.lineCap = 'round';
      for (const w of this.whirls) {
        if (!g.inView(w, w.r * 2)) continue;
        const k = Math.min(1, w.t / 0.6) * Math.min(1, (w.T - w.t) / 0.8);
        for (let i = 0; i < 4; i++) {
          const rr = w.r * (1 - i * 0.2);
          const a = this.t * (4 + i * 1.5) + i * 1.3;
          ctx.globalAlpha = (0.6 - i * 0.08) * k;
          ctx.strokeStyle = i % 2 ? '#bfe8ff' : '#ffffff';
          ctx.lineWidth = 3 - i * 0.4;
          ctx.beginPath();
          ctx.ellipse(w.x, w.y - i * 9, rr, rr * 0.42, 0, a, a + 3.8);
          ctx.stroke();
        }
      }
      ctx.restore();
      return;
    }
    if (this.kind === 'cauldron') {
      const p = this.g.player;
      for (const o of this.inView(p.x, p.y, this._v || (this._v = []))) drawCauldron(ctx, o, this.t);
      return;
    }
    if (this.kind !== 'pillars') return;
    const p = this.g.player;
    const list = this.inView(p.x, p.y, this._v || (this._v = []));
    for (const o of list) {
      const spr = pillarSprite(Math.round(o.r / 4) * 4, Math.floor(o.seed * 4));
      const L = spr.logical;
      ctx.drawImage(spr, o.x - L / 2, o.y - L * 0.62, L, L);
    }
  }

  // ---------------------------------------------------------- 画面全体（ワールド座標）
  drawOverlay(ctx) {
    const g = this.g, p = g.player;
    if (this.gm) { if (this.gm.overlay) this.gm.overlay(this, ctx); return; }
    if (this.kind === 'sunmoon' && this.charge) {
      // 先に触れた印の光が、自機の周りを回る
      const col = this.charge.kind === 'sun' ? '#ffd23d' : '#cfd8ff';
      const a = this.t * 3, x = p.x + Math.cos(a) * 26, y = p.y + Math.sin(a) * 26;
      ctx.globalAlpha = Math.min(1, this.charge.t / 2) * 0.9;
      ctx.drawImage(softSprite(col), x - 10, y - 10, 20, 20);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (this.kind === 'darkness') {
      const R = g.feverT > 0 ? 260 : 225;
      const grd = ctx.createRadialGradient(p.x, p.y, R * 0.45, p.x, p.y, R);
      grd.addColorStop(0, 'rgba(2,1,6,0)');
      grd.addColorStop(0.7, 'rgba(2,1,6,0.5)');
      grd.addColorStop(1, 'rgba(2,1,6,0.82)');
      ctx.fillStyle = grd;
      const L = p.x - g.viewW, T = p.y - g.viewH;
      ctx.fillRect(L, T, g.viewW * 2, g.viewH * 2);
      // 闇の中でも 敵の目だけは光る
      ctx.fillStyle = 'rgba(255,70,140,0.75)';
      for (const e of g.enemies) {
        if (!e.alive || e.prop || e.segment || !g.inView(e, 20)) continue;
        const s = Math.max(1.2, e.r * 0.09);
        ctx.fillRect(e.x - e.r * 0.3 - s, e.y - e.r * 0.1 - s / 2, s * 2, s);
        ctx.fillRect(e.x + e.r * 0.3 - s, e.y - e.r * 0.1 - s / 2, s * 2, s);
      }
      // 裂け目は暗闇越しにも見える
      ctx.globalCompositeOperation = 'lighter';
      for (const r of this.rifts) ctx.drawImage(starSprite('#e05cff'), r.x - 40, r.y - 40, 80, 80);
      // 強敵の気配
      for (const e of g.enemies) {
        if (!e.alive || !(e.boss || e.elite)) continue;
        ctx.globalAlpha = 0.5;
        ctx.drawImage(starSprite(e.boss ? '#ff3ddc' : '#ffd24a'), e.x - e.r * 1.5, e.y - e.r * 1.5, e.r * 3, e.r * 3);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // 画面座標
  drawScreen(ctx, CW, CH, dpr) {
    if (this.gm) { if (this.gm.screen) this.gm.screen(this, ctx, CW, CH, dpr); return; }
    if (this.kind !== 'blizzard') return;
    const g = this.g;
    const k = this.storm ? Math.min(1, (14 - this.stormT) / 1.5, this.stormT / 1.5) : 0;
    if (k <= 0.01) return;
    // 霧
    const grd = ctx.createRadialGradient(CW / 2, CH / 2, Math.min(CW, CH) * 0.15, CW / 2, CH / 2, Math.max(CW, CH) * 0.6);
    grd.addColorStop(0, 'rgba(220,235,255,0)');
    grd.addColorStop(1, `rgba(220,235,255,${0.55 * k})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, CW, CH);
    // 雪（動きは update で進める）
    const wx = Math.cos(this.wind), wy = Math.sin(this.wind);
    ctx.strokeStyle = `rgba(240,248,255,${0.8 * k})`;
    for (const f of this.snow) {
      ctx.lineWidth = f.s * dpr;
      ctx.beginPath();
      ctx.moveTo(f.x * CW, f.y * CH);
      ctx.lineTo(f.x * CW - wx * 10 * f.s * dpr, f.y * CH - (wy + 0.6) * 10 * f.s * dpr);
      ctx.stroke();
    }
    void g;
  }
}
