// =====================================================================
//  第2章のギミック：大渦（深海）／浮上する都市（ルルイエ）／グラーキの棘とお茶会（ハリ湖）／
//  昼と夜（カルコサ）／隕石雨とモノリス（宇宙）／混沌のルーレット（宇宙の中心）
//  どれも「いつもある地形」＋「旗で知らせる出来事」。危ないものは円か線で予告する
// =====================================================================
import { TAU, rand, randi, pick } from './util.js';
import { softSprite, starSprite } from './render.js';
import { audio } from './audio.js';
import { inBeam, drawBeamWarn, drawCircleWarn, minions } from './gimmick-kit.js';

// ---------------------------------------------------------------- 共通の部品
// 渦・引力の井戸：w = { x, y, t, T, R, spin, hurtT, crushT }。k は強さ（出始めと消え際は弱い）
function vortexK(w) {
  return Math.max(0, Math.min(1, w.t / 1.2, (w.T - w.t) / 1.0));
}
function updateVortex(h, w, dt, o) {
  const g = h.g, p = g.player;
  w.t += dt;
  const k = vortexK(w);
  if (k <= 0) return;
  const dx = w.x - p.x, dy = w.y - p.y, d = Math.hypot(dx, dy) || 1;
  if (d < w.R && !o.free) {
    const f = k * (1 - (d / w.R) * 0.5);
    const pull = o.pull * f, sw = o.swirl * f * w.spin;
    p.x += ((dx / d) * pull - (dy / d) * sw) * dt;
    p.y += ((dy / d) * pull + (dx / d) * sw) * dt;
  }
  w.hurtT -= dt;
  if (k > 0.5 && d < o.core && w.hurtT <= 0) {
    w.hurtT = 0.5;
    g.hurtPlayer(o.hurt * g.stageDmg, { ignoreIT: true, silent: true, src: 'hazard' });
    g.fx.burst(p.x, p.y, o.color, 5, 120, 0.3, 7);
  }
  for (const e of minions(g)) {
    const ex = w.x - e.x, ey = w.y - e.y, ed = Math.hypot(ex, ey) || 1;
    if (ed > w.R) continue;
    const f = k * (1.2 - (ed / w.R) * 0.6) * (e.kbk ?? 1);
    e.x += ((ex / ed) * 125 - (ey / ed) * 110 * w.spin) * f * dt;
    e.y += ((ey / ed) * 125 + (ex / ed) * 110 * w.spin) * f * dt;
  }
  w.crushT -= dt;
  if (w.crushT <= 0 && k > 0.5) {
    w.crushT = 0.4;
    for (const e of minions(g)) if ((e.x - w.x) ** 2 + (e.y - w.y) ** 2 < (o.core + e.r) ** 2) g.damage(e, e.maxHp * 0.3, { dot: true, silent: true });
  }
  for (const pk of g.pickups) {
    if (pk.kind !== 'xp' || pk.vac) continue;
    const px = w.x - pk.x, py = w.y - pk.y, pd = Math.hypot(px, py) || 1;
    if (pd > w.R || pd < 14) continue;
    pk.x += ((px / pd) * 90 - (py / pd) * 70 * w.spin) * k * dt;
    pk.y += ((py / pd) * 90 + (px / pd) * 70 * w.spin) * k * dt;
  }
  if (g.inView(w, w.R) && Math.random() < 0.6) {
    const a = rand(TAU), rr = rand(30, w.R);
    g.fx.add(w.x + Math.cos(a) * rr, w.y + Math.sin(a) * rr, -Math.sin(a) * 90 * w.spin, Math.cos(a) * 90 * w.spin, 0.6, 4, o.foam, 'dot');
  }
}
function drawVortex(ctx, w, t, c) {
  const k = vortexK(w);
  if (k <= 0) return;
  const grd = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.R);
  grd.addColorStop(0, c.core);
  grd.addColorStop(0.35, c.mid);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.85 * k;
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(w.x, w.y, w.R, 0, TAU);
  ctx.fill();
  // 渦の腕
  ctx.strokeStyle = c.arm;
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    ctx.globalAlpha = 0.55 * k;
    ctx.beginPath();
    for (let j = 0; j <= 24; j++) {
      const q = j / 24;
      const a = t * 2.2 * w.spin + (i / 5) * TAU + q * 3.4 * w.spin;
      const rr = 30 + q * (w.R - 30);
      const x = w.x + Math.cos(a) * rr, y = w.y + Math.sin(a) * rr;
      j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  // 中心（ここに入ると痛い）
  ctx.globalAlpha = 0.9 * k;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(w.x, w.y, 42, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = c.rim;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(w.x, w.y, 48, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

// 空から落ちてくる岩・星：r = { x, y, r, t, T, ... }。予告の円を地面に、落ちてくる物は objects で描く
function spawnRock(h, list, o) {
  const g = h.g, p = g.player;
  let x, y;
  if (Math.random() < 0.45) {
    // 自機の行く先
    x = p.x + (p.moving ? p.dirX * 110 : 0) + rand(-30, 30);
    y = p.y + (p.moving ? p.dirY * 110 : 0) + rand(-30, 30);
  } else {
    const a = rand(TAU), d = rand(40, o.spread || 260);
    x = p.x + Math.cos(a) * d;
    y = p.y + Math.sin(a) * d;
  }
  list.push({ x, y, r: rand(o.rmin || 44, o.rmax || 64), t: 0, T: o.T || 1.4, done: false });
}
function updateRocks(h, list, dt, o) {
  const g = h.g, p = g.player;
  for (const r of list) {
    r.t += dt;
    if (r.done || r.t < r.T) continue;
    r.done = true;
    if (Math.hypot(p.x - r.x, p.y - r.y) < r.r + p.r) g.hurtPlayer(o.hurt * g.stageDmg, { src: 'hazard' });
    for (const e of g.enemies) {
      if (!e.alive || e.prop || e.segment) continue;
      if ((e.x - r.x) ** 2 + (e.y - r.y) ** 2 > (r.r + e.r) ** 2) continue;
      const d = Math.hypot(e.x - r.x, e.y - r.y) || 1;
      g.damage(e, e.maxHp * (e.boss ? 0.02 : o.dmg), { kb: 200, kx: (e.x - r.x) / d, ky: (e.y - r.y) / d });
    }
    if (g.inView(r, r.r)) {
      g.fx.burst(r.x, r.y, o.color, 16, 260, 0.6, 12);
      g.fx.ring(r.x, r.y, 8, r.r * 1.2, 0.35, o.ring, 6);
      g.fx.shake(4);
      audio.bomb(false, 2);
    }
  }
  return list.filter((r) => r.t < r.T + 0.2);
}
function drawRockWarns(ctx, list, color) {
  for (const r of list) if (!r.done) drawCircleWarn(ctx, r.x, r.y, r.r, Math.min(1, r.t / r.T), color);
}
// 落ちてくる物（右上から斜めに）
function drawFalling(ctx, list, t, body, trail) {
  for (const r of list) {
    if (r.done) continue;
    const k = Math.min(1, r.t / r.T);
    const H = (1 - k) * 420;
    const x = r.x + H * 0.55, y = r.y - H;
    const grd = ctx.createLinearGradient(x + 60, y - 110, x, y);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, trail);
    ctx.strokeStyle = grd;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 60, y - 110);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, 9 + r.r * 0.12, 0, TAU);
    ctx.fill();
    void t;
  }
}

// 画面の外にある目印へ向かう矢印（画面座標）
function edgeArrow(h, ctx, CW, CH, dpr, x, y, color) {
  const g = h.g, p = g.player;
  const dx = x - p.x, dy = y - p.y;
  if (Math.abs(dx) < g.viewW / 2 - 10 && Math.abs(dy) < g.viewH / 2 - 10) return;
  const a = Math.atan2(dy, dx);
  const m = 34 * dpr;
  const sx = Math.max(m, Math.min(CW - m, CW / 2 + Math.cos(a) * CW)), sy = Math.max(m, Math.min(CH - m, CH / 2 + Math.sin(a) * CH));
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(a);
  ctx.globalAlpha = 0.6 + 0.3 * Math.sin(h.t * 6);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(14 * dpr, 0);
  ctx.lineTo(-8 * dpr, -10 * dpr);
  ctx.lineTo(-4 * dpr, 0);
  ctx.lineTo(-8 * dpr, 10 * dpr);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// 円の中の点を、外へ押し出す（自動プレイの回避に使う）
function awayFrom(p, x, y, r, w = 0.4) {
  const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 1;
  return d < r ? [(dx / d) * w, (dy / d) * w] : null;
}

// ================================================================ 深海：大渦
const DEEP = {
  init(h) {
    h.s = { boostT: 0, pools: [], poolT: 12 };
  },
  terrain(h, r, ox, oy, c) {
    if (r() < 0.45) c.push({ x: ox + 60 + r() * 240, y: oy + 60 + r() * 240, r: 30 + r() * 10, seed: r() * TAU });
  },
  update(h, dt) {
    const g = h.g, p = g.player, s = h.s;
    s.boostT -= dt;
    // 泡の噴出口：入ると勢いよく泳げる（その間は渦に引かれない）
    for (const o of h.around(p.x, p.y, h._c || (h._c = []))) {
      if ((p.x - o.x) ** 2 + (p.y - o.y) ** 2 > o.r * o.r) continue;
      if (s.boostT <= 0) { g.fx.burst(p.x, p.y, '#bfe8ff', 14, 200, 0.5, 9); audio.pickup(); }
      s.boostT = 1.8;
    }
    if (s.boostT > 0 && p.moving && Math.random() < 0.5) g.fx.add(p.x + rand(-8, 8), p.y + rand(-8, 8), -p.dirX * 80, -p.dirY * 80, 0.6, 5, '#bfe8ff', 'dot');
    if (g.timeStopT > 0) return;
    s.poolT -= dt;
    if (s.poolT <= 0) {
      s.poolT = rand(15, 21);
      const a = p.moving ? Math.atan2(p.dirY, p.dirX) + rand(-0.9, 0.9) : rand(TAU), d = rand(140, 220);
      s.pools.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, t: 0, T: 9, R: 280, spin: Math.random() < 0.5 ? 1 : -1, hurtT: 0, crushT: 0 });
      g.hooks.banner('MAELSTROM', 'swarm', '大渦 — 中心へ引き込まれる');
      audio.whoosh();
    }
    for (const w of s.pools) updateVortex(h, w, dt, { free: s.boostT > 0, pull: 95, swirl: 85, core: 48, hurt: 10, color: '#3fa8ff', foam: '#d8f2ff' });
    s.pools = s.pools.filter((w) => w.t < w.T);
  },
  speedMul(h) {
    return h.s.boostT > 0 ? 1.5 : 1;
  },
  avoid(h, p) {
    for (const w of h.s.pools) { const v = awayFrom(p, w.x, w.y, w.R * 0.6, 0.5); if (v) return v; }
    return null;
  },
  ground(h, ctx) {
    const g = h.g, p = g.player;
    for (const w of h.s.pools) if (g.inView(w, w.R)) drawVortex(ctx, w, h.t, { core: 'rgba(0,10,30,0.95)', mid: 'rgba(20,70,140,0.5)', arm: '#7fd0ff', rim: '#bfe8ff' });
    for (const o of h.inView(p.x, p.y, h._v || (h._v = []))) {
      const grd = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      grd.addColorStop(0, 'rgba(120,210,255,0.4)');
      grd.addColorStop(0.7, 'rgba(40,120,200,0.2)');
      grd.addColorStop(1, 'rgba(40,120,200,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,220,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(o.x, o.y, o.r * 0.45, o.r * 0.22, 0, 0, TAU);
      ctx.stroke();
    }
  },
  objects(h, ctx) {
    const p = h.g.player;
    ctx.strokeStyle = 'rgba(190,235,255,0.6)';
    ctx.lineWidth = 1.2;
    for (const o of h.inView(p.x, p.y, h._v || (h._v = []))) {
      for (let i = 0; i < 6; i++) {
        const k = (h.t * 0.7 + i / 6 + o.seed) % 1;
        const x = o.x + Math.sin(o.seed * 5 + i * 2.1 + h.t * 2) * o.r * 0.45;
        ctx.globalAlpha = 1 - k;
        ctx.beginPath();
        ctx.arc(x, o.y - k * 70, 2 + (i % 3) * 1.5, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  },
};

// ================================================================ ルルイエ：浮上する都市
// 石柱 c = { x, y, r, t, W（予告の長さ）, up（立っている長さ） }
const COL_FALL = 0.6;
const colUp = (c) => c.t >= c.W && c.t < c.W + c.up;
function colScale(c) {
  if (c.t < c.W) return 0;
  if (c.t < c.W + 0.18) return (c.t - c.W) / 0.18;
  if (c.t < c.W + c.up) return 1;
  return Math.max(0, 1 - (c.t - c.W - c.up) / COL_FALL);
}
const GATE_JUMP = 520;
const RLYEH = {
  init(h) {
    h.s = { gateCd: 0, cols: [], colT: 6, riseT: 34, exits: [] };
  },
  terrain(h, r, ox, oy, c) {
    if (r() < 0.4) c.push({ x: ox + 60 + r() * 240, y: oy + 60 + r() * 240, r: 28, seed: r() * TAU, a: r() * TAU });
  },
  update(h, dt) {
    const g = h.g, p = g.player, s = h.s;
    s.gateCd -= dt;
    // 門：入ると、門の向きの先（GATE_JUMP）にあるもう片方の門から出る。出た所の雑魚は弾き飛ばす
    if (s.gateCd <= 0) {
      for (const o of h.around(p.x, p.y, h._c || (h._c = []))) {
        if ((p.x - o.x) ** 2 + (p.y - o.y) ** 2 > o.r * o.r) continue;
        g.fx.burst(p.x, p.y, '#3fe08a', 16, 220, 0.5, 10);
        p.x = o.x + Math.cos(o.a) * GATE_JUMP;
        p.y = o.y + Math.sin(o.a) * GATE_JUMP;
        p.iT = Math.max(p.iT, 0.8);
        for (const e of minions(g)) {
          const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
          if (d > 160) continue;
          g.damage(e, e.maxHp * 0.2, { kb: 320, kx: dx / d, ky: dy / d });
        }
        s.exits.push({ x: p.x, y: p.y, t: 0 });
        g.fx.ring(p.x, p.y, 8, 160, 0.45, '#3fe08a', 7);
        audio.whoosh();
        s.gateCd = 1.2;
        break;
      }
    }
    for (const x of s.exits) x.t += dt;
    s.exits = s.exits.filter((x) => x.t < 1.2);
    // 石柱は立っている間、自機と雑魚を押し出し、敵の弾を止める
    this.collide(h, p, p.r);
    for (const e of g.enemies) if (e.alive && !e.prop && !e.boss && !e.segment && g.inView(e, 120)) this.collide(h, e, e.r * 0.8);
    for (const b of g.ebullets) if (this.blocks(h, b.x, b.y)) { b.life = 0; g.fx.burst(b.x, b.y, '#7fe0a0', 3, 80, 0.25, 6); }
    if (g.timeStopT > 0) return;
    s.colT -= dt;
    s.riseT -= dt;
    if (s.colT <= 0) {
      s.colT = rand(5.5, 8);
      const n = randi(2, 3);
      for (let i = 0; i < n; i++) {
        const a = i === 0 && p.moving ? Math.atan2(p.dirY, p.dirX) + rand(-0.3, 0.3) : rand(TAU);
        const d = i === 0 && p.moving ? rand(90, 150) : rand(120, 260);
        this.raise(h, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1.1, 9);
      }
    }
    if (s.riseT <= 0) {
      s.riseT = rand(32, 40);
      g.hooks.banner("R'LYEH RISES", 'swarm', 'ルルイエ浮上 — 石柱が一斉に突き上がる');
      audio.warning();
      const a0 = rand(TAU);
      for (let i = 0; i < 10; i++) {
        if (i === 3 || i === 8) continue;
        const a = a0 + (i / 10) * TAU, d = i % 2 ? 170 : 290;
        this.raise(h, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1.4, 12);
      }
    }
    for (const c of s.cols) {
      const was = c.t;
      c.t += dt;
      if (was < c.W && c.t >= c.W) {
        // 突き上がる：真上の雑魚は潰れ、自機は弾き飛ばされる
        const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy) || 1;
        if (d < c.r + p.r) {
          g.hurtPlayer(14 * g.stageDmg, { src: 'hazard' });
          p.x = c.x + (dx / d) * (c.r + p.r + 4);
          p.y = c.y + (dy / d) * (c.r + p.r + 4);
        }
        for (const e of g.enemies) {
          if (!e.alive || e.prop || e.segment) continue;
          const ex = e.x - c.x, ey = e.y - c.y, ed = Math.hypot(ex, ey) || 1;
          if (ed > c.r + e.r + 12) continue;
          g.damage(e, e.maxHp * (e.boss ? 0.015 : 0.6), { kb: 260, kx: ex / ed, ky: ey / ed });
        }
        if (g.inView(c, 40)) {
          g.fx.burst(c.x, c.y, '#7fe0a0', 14, 220, 0.5, 10);
          g.fx.burst(c.x, c.y, '#5a6a60', 10, 160, 0.6, 12);
          g.fx.shake(3);
          audio.bomb(false, 2);
        }
      }
    }
    s.cols = s.cols.filter((c) => c.t < c.W + c.up + COL_FALL);
  },
  raise(h, x, y, W, up) {
    const s = h.s;
    // 立っている柱が多すぎたら古いものから沈める
    const standing = s.cols.filter((c) => c.t < c.W + c.up);
    if (standing.length >= 18) standing[0].up = Math.min(standing[0].up, standing[0].t - standing[0].W);
    s.cols.push({ x, y, r: rand(26, 34), t: 0, W, up, seed: rand(TAU) });
  },
  collide(h, obj, r) {
    for (const c of h.s.cols) {
      if (!colUp(c)) continue;
      const dx = obj.x - c.x, dy = obj.y - c.y, rr = c.r + r, d2 = dx * dx + dy * dy;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 0.01;
        obj.x = c.x + (dx / d) * rr;
        obj.y = c.y + (dy / d) * rr;
      }
    }
  },
  blocks(h, x, y) {
    for (const c of h.s.cols) if (colUp(c) && (x - c.x) ** 2 + (y - c.y) ** 2 < c.r * c.r) return true;
    return false;
  },
  rayCut(h, x, y, a, len) {
    const ax = Math.cos(a), ay = Math.sin(a);
    let best = len;
    for (const c of h.s.cols) {
      if (!colUp(c)) continue;
      if ((c.x - x) ** 2 + (c.y - y) ** 2 < c.r * c.r) continue;
      const t = (c.x - x) * ax + (c.y - y) * ay;
      if (t < 0 || t - c.r > best) continue;
      const cx = x + ax * t - c.x, cy = y + ay * t - c.y, d2 = cx * cx + cy * cy;
      if (d2 >= c.r * c.r) continue;
      best = Math.min(best, Math.max(0, t - Math.sqrt(c.r * c.r - d2)));
    }
    return best;
  },
  avoid(h, p) {
    for (const c of h.s.cols) if (c.t < c.W) { const v = awayFrom(p, c.x, c.y, c.r + 40, 0.4); if (v) return v; }
    return null;
  },
  ground(h, ctx) {
    const g = h.g, p = g.player, s = h.s;
    // 門：向きの先に出口がある（短い矢印）
    for (const o of h.inView(p.x, p.y, h._v || (h._v = []))) {
      const grd = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      grd.addColorStop(0, 'rgba(10,30,20,0.9)');
      grd.addColorStop(0.75, 'rgba(40,200,120,0.35)');
      grd.addColorStop(1, 'rgba(40,200,120,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,255,180,0.75)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = h.t * 1.5 + o.seed + (i / 3) * TAU;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r * 0.85, a, a + 1.2);
        ctx.stroke();
      }
      const ax = Math.cos(o.a), ay = Math.sin(o.a), k = (h.t * 0.8 + o.seed) % 1;
      ctx.globalAlpha = 0.6 * (1 - k);
      ctx.fillStyle = '#7fffb8';
      const bx = o.x + ax * (o.r + 8 + k * 26), by = o.y + ay * (o.r + 8 + k * 26);
      ctx.beginPath();
      ctx.moveTo(bx + ax * 9, by + ay * 9);
      ctx.lineTo(bx - ay * 7, by + ax * 7);
      ctx.lineTo(bx + ay * 7, by - ax * 7);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const x of s.exits) {
      ctx.globalAlpha = 1 - x.t / 1.2;
      ctx.strokeStyle = '#7fffb8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x.x, x.y, 30 + x.t * 40, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 石柱の予告：地面のひび
    for (const c of s.cols) {
      if (c.t >= c.W || !g.inView(c, 40)) continue;
      const k = c.t / c.W;
      drawCircleWarn(ctx, c.x, c.y, c.r + 6, k, '#5fd890');
      ctx.strokeStyle = `rgba(150,255,190,${0.4 + 0.5 * k})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = c.seed + (i / 6) * TAU, L = (c.r + 14) * k;
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + Math.cos(a) * L * 0.6, c.y + Math.sin(a) * L * 0.6 + 3);
        ctx.lineTo(c.x + Math.cos(a + 0.3) * L, c.y + Math.sin(a + 0.3) * L);
      }
      ctx.stroke();
    }
  },
  objects(h, ctx) {
    const g = h.g;
    // 石柱：傾いた黒緑の石に、光る刻み目
    for (const c of h.s.cols) {
      const k = colScale(c);
      if (k <= 0 || !g.inView(c, 60)) continue;
      const w = c.r, H = c.r * 2.6 * k, lean = Math.sin(c.seed) * 0.25;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + 4, w * 1.05, w * 0.42, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1c2a24';
      ctx.strokeStyle = '#3a5a4a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c.x - w, c.y);
      ctx.lineTo(c.x - w * 0.8 + lean * H, c.y - H);
      ctx.lineTo(c.x + w * 0.5 + lean * H, c.y - H - w * 0.45);
      ctx.lineTo(c.x + w, c.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = `rgba(110,255,170,${0.45 + 0.25 * Math.sin(h.t * 3 + c.seed)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 1; i <= 3; i++) {
        const y = c.y - H * (i / 4);
        ctx.moveTo(c.x - w * 0.5 + lean * H * (i / 4), y);
        ctx.lineTo(c.x + w * 0.3 + lean * H * (i / 4), y - 4);
      }
      ctx.stroke();
    }
  },
};

// ================================================================ ハリ湖：グラーキの棘とお茶会
const SPIKE_W = 38;
const LAKE = {
  init(h) {
    h.s = { sitT: 0, teaT: 0, spikes: [], spikeT: 7, waveT: 38 };
  },
  terrain(h, r, ox, oy, c) {
    if (r() < 0.3) c.push({ x: ox + 70 + r() * 220, y: oy + 70 + r() * 220, r: 60, seed: r() * TAU, cd: 0 });
  },
  update(h, dt) {
    const g = h.g, p = g.player, s = h.s;
    // お茶会の席：3 秒座ると「お茶の時間」（10 秒：回復しながら攻撃力アップ）。使った席は 25 秒休む
    s.teaT -= dt;
    let seat = null;
    for (const o of h.around(p.x, p.y, h._c || (h._c = []))) {
      if (o.cd > 0) o.cd -= dt;
      if (o.cd <= 0 && (p.x - o.x) ** 2 + (p.y - o.y) ** 2 < o.r * o.r) seat = o;
    }
    if (seat) {
      s.sitT += dt;
      s.seat = seat;
      g.heal(1 * dt, true);
      if (s.sitT >= 3) {
        s.sitT = 0;
        seat.cd = 25;
        s.teaT = 10;
        g.hooks.banner('TEA TIME', 'item', 'お茶の時間 — 回復しながら攻撃力アップ');
        g.fx.burst(p.x, p.y, '#ffe9c0', 20, 200, 0.7, 10);
        audio.heal();
      }
    } else { s.sitT = 0; s.seat = null; }
    if (s.teaT > 0) {
      g.heal(3 * dt, true);
      if (Math.random() < 0.15) g.fx.add(p.x + rand(-12, 12), p.y - 10, 0, -40, 0.8, 5, '#ffe9c0', 'star');
    }
    if (g.timeStopT > 0) return;
    // グラーキの棘：線の予告のあと、湖から一直線に突き出す
    s.spikeT -= dt;
    s.waveT -= dt;
    const L = g.viewR * 2 + 260;
    const line = (a, off) => {
      const nx = -Math.sin(a), ny = Math.cos(a);
      const cx = p.x + nx * off, cy = p.y + ny * off;
      s.spikes.push({ x: cx - Math.cos(a) * L / 2, y: cy - Math.sin(a) * L / 2, a, len: L, w: SPIKE_W, t: 0, T: 1.15, fired: false });
    };
    if (s.spikeT <= 0) {
      s.spikeT = rand(5.5, 8);
      const n = randi(2, 3);
      for (let i = 0; i < n; i++) line(rand(TAU), rand(-70, 70));
    }
    if (s.waveT <= 0) {
      s.waveT = rand(36, 44);
      g.hooks.banner('SPINES OF GLAAKI', 'swarm', 'グラーキの棘 — 線の上から離れて');
      audio.warning();
      const a0 = rand(TAU);
      for (let i = 0; i < 6; i++) line(a0 + (i / 6) * Math.PI, (i % 2 ? 1 : -1) * rand(70, 120));
    }
    for (const sp of s.spikes) {
      sp.t += dt;
      if (sp.fired || sp.t < sp.T) continue;
      sp.fired = true;
      if (inBeam(p.x, p.y, sp.x, sp.y, sp.a, sp.len, sp.w, p.r)) g.hurtPlayer(16 * g.stageDmg, { src: 'hazard' });
      for (const e of g.enemies) {
        if (!e.alive || e.prop || e.segment || !inBeam(e.x, e.y, sp.x, sp.y, sp.a, sp.len, sp.w, e.r)) continue;
        g.damage(e, e.maxHp * (e.boss ? 0.015 : 0.55), { kb: 120, kx: -Math.sin(sp.a), ky: Math.cos(sp.a) });
      }
      audio.whoosh();
    }
    s.spikes = s.spikes.filter((sp) => sp.t < sp.T + 0.7);
  },
  dmgMul(h) {
    return h.s.teaT > 0 ? 1.3 : 1;
  },
  avoid(h, p) {
    for (const sp of h.s.spikes) {
      if (sp.fired || !inBeam(p.x, p.y, sp.x, sp.y, sp.a, sp.len, sp.w + 30, p.r)) continue;
      const nx = -Math.sin(sp.a), ny = Math.cos(sp.a);
      const side = (p.x - sp.x) * nx + (p.y - sp.y) * ny >= 0 ? 1 : -1;
      return [nx * side * 0.6, ny * side * 0.6];
    }
    return null;
  },
  ground(h, ctx) {
    const g = h.g, p = g.player, s = h.s;
    for (const o of h.inView(p.x, p.y, h._v || (h._v = []))) {
      const ready = o.cd <= 0;
      ctx.strokeStyle = ready ? 'rgba(255,233,192,0.35)' : 'rgba(255,233,192,0.12)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      if (s.seat === o && s.sitT > 0) {
        ctx.strokeStyle = '#ffe9c0';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, -Math.PI / 2, -Math.PI / 2 + (s.sitT / 3) * TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = ready ? 1 : 0.45;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(o.x, o.y + 12, 26, 8, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f4f0e6';
      ctx.beginPath();
      ctx.ellipse(o.x, o.y, 24, 12, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#e8c860';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#c8b8d8';
      ctx.beginPath();
      ctx.ellipse(o.x - 9, o.y - 4, 5, 3, 0, 0, TAU);
      ctx.ellipse(o.x + 10, o.y + 2, 5, 3, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e8c860';
      ctx.beginPath();
      ctx.arc(o.x + 2, o.y - 7, 5, 0, TAU);
      ctx.fill();
      if (ready) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 2; i++) {
          const k = (h.t * 0.6 + i * 0.5 + o.seed) % 1;
          ctx.globalAlpha = 1 - k;
          ctx.beginPath();
          ctx.moveTo(o.x + 2 + i * 3, o.y - 12 - k * 16);
          ctx.quadraticCurveTo(o.x + 6 + i * 3, o.y - 18 - k * 16, o.x + 2 + i * 3, o.y - 24 - k * 16);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
    for (const sp of s.spikes) if (!sp.fired) drawBeamWarn(ctx, { ...sp, color: '#7fe0a0' });
  },
  objects(h, ctx) {
    // 突き出した棘の列（引っ込んでいく）
    for (const sp of h.s.spikes) {
      if (!sp.fired) continue;
      const k = 1 - (sp.t - sp.T) / 0.7;
      if (k <= 0) continue;
      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.rotate(sp.a);
      ctx.fillStyle = '#9af0b8';
      ctx.strokeStyle = '#2a6a48';
      ctx.lineWidth = 1.5;
      for (let x = 10; x < sp.len; x += 26) {
        const hgt = (14 + ((x * 7) % 11)) * k;
        ctx.beginPath();
        ctx.moveTo(x - 7, 6);
        ctx.lineTo(x, -hgt);
        ctx.lineTo(x + 7, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  },
  overlay(h, ctx) {
    const s = h.s, p = h.g.player;
    if (s.teaT <= 0) return;
    ctx.globalAlpha = Math.min(1, s.teaT) * 0.45;
    ctx.drawImage(softSprite('#ffd27a'), p.x - 36, p.y - 36, 72, 72);
    ctx.globalAlpha = 1;
  },
};

// ================================================================ カルコサ：昼と夜
const CARCOSA = {
  init(h) {
    h.s = { night: false, cycT: 20, k: 0, stars: [], starT: 1, signs: [], signT: 3 };
  },
  update(h, dt) {
    const g = h.g, p = g.player, s = h.s;
    s.cycT -= dt;
    if (s.cycT <= 0) {
      s.night = !s.night;
      s.cycT = s.night ? 18 : 26;
      if (s.night) {
        g.hooks.banner('BLACK STARS', 'swarm', '夜 — 経験値 ×2・雑魚が増え、黒い星が降る');
        audio.whoosh();
        s.signT = 2;
      } else {
        s.signs.length = 0;
        g.hooks.banner('TWIN SUNS', 'item', '夜明け');
      }
    }
    s.k += ((s.night ? 1 : 0) - s.k) * Math.min(1, dt * 1.2);
    if (g.timeStopT > 0) return;
    s.stars = updateRocks(h, s.stars, dt, { hurt: 18, dmg: 0.5, color: '#c78bff', ring: '#7a4ab8' });
    if (!s.night) return;
    s.starT -= dt;
    if (s.starT <= 0) {
      s.starT = rand(1.6, 2.4);
      for (let i = randi(1, 2); i > 0; i--) spawnRock(h, s.stars, { rmin: 52, rmax: 66, T: 1.3, spread: 240 });
    }
    // 黄の印：踏むと、周りの雑魚が狂って逃げ惑う（恐怖）
    s.signT -= dt;
    if (s.signT <= 0 && s.signs.length < 2) {
      s.signT = 8;
      const a = rand(TAU), d = rand(150, 240);
      s.signs.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: 34, t: 0 });
    }
    for (const sg of s.signs) {
      sg.t += dt;
      if ((p.x - sg.x) ** 2 + (p.y - sg.y) ** 2 > (sg.r + p.r) ** 2) continue;
      sg.used = true;
      for (const e of minions(g)) {
        if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > 340 * 340 || e.ai === 'thief') continue;
        e.fearT = 4;
        g.damage(e, e.maxHp * 0.2, { dot: true, silent: true });
      }
      g.hooks.banner('THE YELLOW SIGN', 'item', '黄の印 — 雑魚が狂って逃げ惑う');
      g.fx.ring(sg.x, sg.y, 10, 340, 0.6, '#ffe14a', 8);
      g.fx.screenFlash(0.2, '#ffe14a');
      audio.thunder();
    }
    s.signs = s.signs.filter((sg) => !sg.used);
  },
  xpMul(h) {
    return h.s.night ? 2 : 1;
  },
  spawnMul(h) {
    return h.s.night ? 1.5 : 1;
  },
  avoid(h, p) {
    for (const r of h.s.stars) if (!r.done) { const v = awayFrom(p, r.x, r.y, r.r + 20, 0.5); if (v) return v; }
    return null;
  },
  ground(h, ctx) {
    const g = h.g, s = h.s;
    drawRockWarns(ctx, s.stars, '#b07aff');
    for (const sg of s.signs) {
      if (!g.inView(sg, 40)) continue;
      ctx.save();
      ctx.translate(sg.x, sg.y);
      ctx.rotate(h.t * 0.5);
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(h.t * 4);
      ctx.drawImage(softSprite('#ffe14a'), -sg.r * 1.6, -sg.r * 1.6, sg.r * 3.2, sg.r * 3.2);
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = '#ffe14a';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      // 黄の印：中心から 3 本、ねじれて伸びる腕
      for (let i = 0; i < 3; i++) {
        ctx.rotate(TAU / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(sg.r * 0.6, -sg.r * 0.2, sg.r * 0.55, sg.r * 0.45);
        ctx.quadraticCurveTo(sg.r * 0.45, sg.r * 0.8, sg.r * 0.1, sg.r * 0.75);
        ctx.stroke();
      }
      ctx.restore();
    }
  },
  objects(h, ctx) {
    drawFalling(ctx, h.s.stars, h.t, '#1a0a2a', 'rgba(199,139,255,0.9)');
  },
  overlay(h, ctx) {
    const g = h.g, p = g.player, s = h.s;
    if (s.k < 0.02) return;
    // 夜：見えるのは自機のまわりだけ（敵の目と、黄の印は闇越しにも見える）
    const R = (g.feverT > 0 ? 280 : 245) + (1 - s.k) * 500;
    const grd = ctx.createRadialGradient(p.x, p.y, R * 0.45, p.x, p.y, R);
    grd.addColorStop(0, 'rgba(6,2,12,0)');
    grd.addColorStop(0.7, `rgba(6,2,12,${0.5 * s.k})`);
    grd.addColorStop(1, `rgba(6,2,12,${0.85 * s.k})`);
    ctx.fillStyle = grd;
    ctx.fillRect(p.x - g.viewW, p.y - g.viewH, g.viewW * 2, g.viewH * 2);
    ctx.fillStyle = `rgba(255,225,90,${0.75 * s.k})`;
    for (const e of g.enemies) {
      if (!e.alive || e.prop || e.segment || !g.inView(e, 20)) continue;
      const sz = Math.max(1.2, e.r * 0.09);
      ctx.fillRect(e.x - e.r * 0.3 - sz, e.y - e.r * 0.1 - sz / 2, sz * 2, sz);
      ctx.fillRect(e.x + e.r * 0.3 - sz, e.y - e.r * 0.1 - sz / 2, sz * 2, sz);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const sg of s.signs) ctx.drawImage(starSprite('#ffe14a'), sg.x - 34, sg.y - 34, 68, 68);
    for (const r of s.stars) if (!r.done) { ctx.globalAlpha = 0.6; ctx.drawImage(starSprite('#c78bff'), r.x - r.r, r.y - r.r, r.r * 2, r.r * 2); }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },
  screen(h, ctx, CW, CH) {
    const s = h.s;
    if (s.k < 0.02) return;
    ctx.fillStyle = `rgba(30,10,45,${0.22 * s.k})`;
    ctx.fillRect(0, 0, CW, CH);
  },
};

// ================================================================ 宇宙：隕石雨とモノリス（流れ星は経験値を落とす）
const SPACE = {
  init(h) {
    h.s = { meteors: [], meteorT: 12, shower: 0, showerT: 25, rocks: [], rockT: 0, mono: null, monoT: 15, evoT: 0 };
  },
  update(h, dt) {
    const g = h.g, p = g.player, s = h.s;
    s.evoT -= dt;
    if (s.evoT > 0 && Math.random() < 0.3) g.fx.add(p.x + rand(-14, 14), p.y + rand(-14, 14), 0, -60, 0.6, 5, '#e8e0ff', 'star');
    // モノリス：触れると「進化」（15 秒：攻撃力・攻撃速度・移動速度アップ）
    s.monoT -= dt;
    if (!s.mono && s.monoT <= 0) {
      const a = rand(TAU), d = rand(230, 320);
      s.mono = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, t: 0, T: 24 };
      g.hooks.banner('MONOLITH', 'item', 'モノリス — 触れると進化する');
      audio.warning();
    }
    if (s.mono) {
      const m = s.mono;
      m.t += dt;
      if ((p.x - m.x) ** 2 + (p.y - m.y) ** 2 < (24 + p.r) ** 2) {
        s.evoT = 15;
        s.mono = null;
        s.monoT = rand(28, 34);
        g.hooks.banner('EVOLUTION', 'victory', '進化 — 攻撃力・攻撃速度アップ');
        g.fx.screenFlash(0.3, '#ffffff');
        g.fx.ring(p.x, p.y, 10, 220, 0.6, '#e8e0ff', 8);
        audio.evolve();
      } else if (m.t > m.T) { s.mono = null; s.monoT = 8; }
    }
    // 流れ星：通り道に経験値を落とす
    s.meteorT -= dt;
    if (s.meteorT <= 0) {
      s.meteorT = rand(14, 20);
      const a = rand(TAU), off = rand(-90, 90), nx = -Math.sin(a), ny = Math.cos(a), R = g.viewR + 80;
      s.meteors.push({ x: p.x - Math.cos(a) * R + nx * off, y: p.y - Math.sin(a) * R + ny * off, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, t: 0, drop: 0 });
      audio.whoosh();
    }
    for (const m of s.meteors) {
      m.t += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.drop -= dt;
      if (m.drop <= 0 && g.inView(m, 40)) { m.drop = 0.06; g.dropXp(m.x + rand(-10, 10), m.y + rand(-10, 10), 3); }
      if (Math.random() < 0.8) g.fx.add(m.x, m.y, -m.vx * 0.1, -m.vy * 0.1, 0.5, 5, '#fff2c0', 'dot');
    }
    s.meteors = s.meteors.filter((m) => m.t < 2.2);
    if (g.timeStopT > 0) return;
    // 隕石雨
    s.showerT -= dt;
    if (s.showerT <= 0) {
      s.showerT = rand(24, 30);
      s.shower = 6;
      g.hooks.banner('METEOR SHOWER', 'swarm', '隕石雨 — 予告の円から離れて');
      audio.warning();
    }
    if (s.shower > 0) {
      s.shower -= dt;
      s.rockT -= dt;
      if (s.rockT <= 0) { s.rockT = 0.32; spawnRock(h, s.rocks, { rmin: 46, rmax: 68, T: 1.4 }); }
    }
    s.rocks = updateRocks(h, s.rocks, dt, { hurt: 20, dmg: 0.7, color: '#ffb84a', ring: '#ff7a3d' });
  },
  dmgMul(h) {
    return h.s.evoT > 0 ? 1.4 : 1;
  },
  fireMul(h) {
    return h.s.evoT > 0 ? 1.35 : 1;
  },
  speedMul(h) {
    return h.s.evoT > 0 ? 1.15 : 1;
  },
  avoid(h, p) {
    for (const r of h.s.rocks) if (!r.done) { const v = awayFrom(p, r.x, r.y, r.r + 20, 0.5); if (v) return v; }
    if (h.s.mono) { const m = h.s.mono, d = Math.hypot(m.x - p.x, m.y - p.y) || 1; return [((m.x - p.x) / d) * 0.25, ((m.y - p.y) / d) * 0.25]; }
    return null;
  },
  ground(h, ctx) {
    drawRockWarns(ctx, h.s.rocks, '#ff9a3d');
  },
  objects(h, ctx) {
    const s = h.s;
    for (const m of s.meteors) {
      const L = 90, d = Math.hypot(m.vx, m.vy), tx = m.x - (m.vx / d) * L, ty = m.y - (m.vy / d) * L;
      const grd = ctx.createLinearGradient(tx, ty, m.x, m.y);
      grd.addColorStop(0, 'rgba(255,240,190,0)');
      grd.addColorStop(1, 'rgba(255,240,190,0.9)');
      ctx.strokeStyle = grd;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 5, 0, TAU);
      ctx.fill();
    }
    drawFalling(ctx, s.rocks, h.t, '#6a4a3a', 'rgba(255,170,90,0.95)');
    if (s.mono) {
      const m = s.mono, k = Math.min(1, m.t / 0.6, (m.T - m.t) / 0.6);
      ctx.globalAlpha = k;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 * k + 0.15 * Math.sin(h.t * 3);
      ctx.drawImage(softSprite('#cfc8ff'), m.x - 50, m.y - 90, 100, 120);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(m.x, m.y + 2, 22, 7, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#050508';
      ctx.strokeStyle = '#8a86b8';
      ctx.lineWidth = 1.5;
      ctx.fillRect(m.x - 14, m.y - 66, 28, 66);
      ctx.strokeRect(m.x - 14, m.y - 66, 28, 66);
      ctx.globalAlpha = 1;
    }
  },
  overlay(h, ctx) {
    const s = h.s, p = h.g.player;
    if (s.evoT <= 0) return;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, s.evoT) * (0.4 + 0.15 * Math.sin(h.t * 8));
    ctx.drawImage(softSprite('#cfc8ff'), p.x - 40, p.y - 40, 80, 80);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },
  screen(h, ctx, CW, CH, dpr) {
    if (h.s.mono) edgeArrow(h, ctx, CW, CH, dpr, h.s.mono.x, h.s.mono.y, '#cfc8ff');
  },
};

// ================================================================ 宇宙の中心：混沌のルーレット（泡は触れるとアイテム）
const CHAOS_EV = [
  { id: 'well', name: 'GRAVITY WELL', text: '引力の井戸 — 何もかもが 1 点へ落ちていく', T: 7 },
  { id: 'items', name: 'ITEM RAIN', text: 'アイテムの雨', T: 4 },
  { id: 'frenzy', name: 'FRENZY', text: '狂騒 — 雑魚が速くなるが、経験値 ×2', T: 9 },
  { id: 'stars', name: 'STARFALL', text: '星の雨 — 予告の円から離れて', T: 6 },
  { id: 'still', name: 'STAGNANT TIME', text: '時の淀み — 雑魚が遅くなる', T: 8 },
  { id: 'flash', name: 'CHAOS FLASH', text: '混沌の閃光 — 画面の雑魚に大ダメージ', T: 1.8 },
];
const CHAOS = {
  init(h) {
    h.s = { evT: 15, ev: null, last: -1, rocks: [], rockT: 0, itemT: 0 };
  },
  terrain(h, r, ox, oy, c) {
    if (r() < 0.45) c.push({ x: ox + 50 + r() * 260, y: oy + 50 + r() * 260, r: 20, seed: r() * TAU, popped: false });
  },
  update(h, dt) {
    const g = h.g, p = g.player, s = h.s;
    // 混沌の泡：触れるとはじけて、ランダムなアイテムを落とす（一度きり）
    for (const o of h.around(p.x, p.y, h._c || (h._c = []))) {
      if (o.popped || (p.x - o.x) ** 2 + (p.y - o.y) ** 2 > (o.r + p.r) ** 2) continue;
      o.popped = true;
      g.dropPickup(pick(['heart', 'magnet', 'bomb', 'clock', 'coin', 'coin']), o.x, o.y, 5);
      g.fx.burst(o.x, o.y, '#ff9ad2', 14, 200, 0.5, 10);
      g.fx.ring(o.x, o.y, 6, 40, 0.3, '#c78bff', 4);
      audio.pickup();
    }
    s.rocks = updateRocks(h, s.rocks, dt, { hurt: 18, dmg: 0.6, color: '#e05cff', ring: '#ff9ad2' });
    if (g.timeStopT > 0) return;
    s.evT -= dt;
    if (s.evT <= 0 && !s.ev) {
      s.evT = 20;
      let i;
      do i = Math.floor(Math.random() * CHAOS_EV.length); while (i === s.last);
      s.last = i;
      const E = CHAOS_EV[i];
      s.ev = { ...E, t: 0 };
      if (E.id === 'well') {
        const a = rand(TAU), d = rand(150, 220);
        s.ev.w = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, t: 0, T: E.T, R: 300, spin: 1, hurtT: 0, crushT: 0 };
      }
      g.hooks.banner(E.name, 'swarm', E.text);
      audio.warning();
    }
    const ev = s.ev;
    if (!ev) return;
    ev.t += dt;
    if (ev.id === 'well') updateVortex(h, ev.w, dt, { free: false, pull: 70, swirl: 50, core: 44, hurt: 9, color: '#e05cff', foam: '#ffc8f0' });
    else if (ev.id === 'items') {
      s.itemT -= dt;
      if (s.itemT <= 0) {
        s.itemT = 0.5;
        const a = rand(TAU), d = rand(60, 200);
        g.dropPickup(pick(['heart', 'magnet', 'bomb', 'clock', 'coin']), p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 5);
        g.fx.burst(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, '#ff9ad2', 8, 160, 0.4, 8);
      }
    } else if (ev.id === 'frenzy' || ev.id === 'still') {
      for (const e of minions(g)) { e.slowT = Math.max(e.slowT, 0.2); e.slowMul = ev.id === 'frenzy' ? 1.5 : 0.4; }
    } else if (ev.id === 'stars') {
      s.rockT -= dt;
      if (s.rockT <= 0) { s.rockT = 0.3; spawnRock(h, s.rocks, { rmin: 44, rmax: 62, T: 1.3 }); }
    } else if (ev.id === 'flash' && !ev.done && ev.t >= ev.T - 0.2) {
      ev.done = true;
      for (const e of minions(g)) if (g.inView(e, 0)) g.damage(e, e.maxHp * 0.45);
      g.fx.screenFlash(0.45, '#ffc8f0');
      g.fx.shake(8);
      audio.bomb(true);
    }
    if (ev.t >= ev.T) s.ev = null;
  },
  xpMul(h) {
    return h.s.ev && h.s.ev.id === 'frenzy' ? 2 : 1;
  },
  avoid(h, p) {
    const ev = h.s.ev;
    if (ev && ev.id === 'well') { const v = awayFrom(p, ev.w.x, ev.w.y, ev.w.R * 0.6, 0.5); if (v) return v; }
    for (const r of h.s.rocks) if (!r.done) { const v = awayFrom(p, r.x, r.y, r.r + 20, 0.5); if (v) return v; }
    return null;
  },
  ground(h, ctx) {
    const ev = h.s.ev;
    if (ev && ev.id === 'well' && h.g.inView(ev.w, ev.w.R)) drawVortex(ctx, ev.w, h.t, { core: 'rgba(20,0,30,0.95)', mid: 'rgba(120,40,180,0.45)', arm: '#ff9ad2', rim: '#ffc8f0' });
    drawRockWarns(ctx, h.s.rocks, '#e05cff');
  },
  objects(h, ctx) {
    const p = h.g.player;
    drawFalling(ctx, h.s.rocks, h.t, '#3a1050', 'rgba(255,150,230,0.9)');
    for (const o of h.inView(p.x, p.y, h._v || (h._v = []))) {
      if (o.popped) continue;
      const bob = Math.sin(h.t * 2 + o.seed) * 4;
      const grd = ctx.createRadialGradient(o.x - 5, o.y - 6 + bob, 2, o.x, o.y + bob, o.r);
      grd.addColorStop(0, 'rgba(255,255,255,0.7)');
      grd.addColorStop(0.35, 'rgba(255,150,220,0.35)');
      grd.addColorStop(1, 'rgba(120,90,255,0.25)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(o.x, o.y + bob, o.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(220,190,255,0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  },
  screen(h, ctx, CW, CH) {
    const ev = h.s.ev;
    if (!ev) return;
    // 出来事の間は、画面の縁がその色で脈打つ
    const col = { well: '224,92,255', items: '255,154,210', frenzy: '255,90,90', stars: '224,92,255', still: '120,180,255', flash: '255,220,240' }[ev.id];
    const k = ev.id === 'flash' ? ev.t / ev.T : 0.5 + 0.3 * Math.sin(h.t * 6);
    const grd = ctx.createRadialGradient(CW / 2, CH / 2, Math.min(CW, CH) * 0.3, CW / 2, CH / 2, Math.max(CW, CH) * 0.7);
    grd.addColorStop(0, `rgba(${col},0)`);
    grd.addColorStop(1, `rgba(${col},${0.35 * k})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, CW, CH);
  },
};

export const G2 = { bubbles: DEEP, portals: RLYEH, teatime: LAKE, blackstars: CARCOSA, meteor: SPACE, chaos: CHAOS };
