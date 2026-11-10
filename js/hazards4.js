// =====================================================================
//  第4章のギミック：炉が噴く（焼成）／満ち潮（溶解）／分かつ光の刃（分離）／近づく日と月（結合）／
//  腐敗の沼と孔雀の尾（発酵）／蒸気口と雫の雨（蒸留）／金に変わる世界（凝固）
// =====================================================================
import { TAU, rand, randi, pick } from './util.js';
import { softSprite } from './render.js';
import { audio } from './audio.js';
import { inBeam, drawBeamWarn, drawCircleWarn, minions } from './gimmick-kit.js';

const awayFrom = (p, x, y, r, w = 0.4) => {
  const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 1;
  return d < r ? [(dx / d) * w, (dy / d) * w] : null;
};
function beamAway(p, list, extra = 30) {
  for (const b of list) {
    if (b.fired || !inBeam(p.x, p.y, b.x, b.y, b.a, b.len, b.w + extra, p.r)) continue;
    const nx = -Math.sin(b.a), ny = Math.cos(b.a);
    const side = (p.x - b.x) * nx + (p.y - b.y) * ny >= 0 ? 1 : -1;
    return [nx * side * 0.6, ny * side * 0.6];
  }
  return null;
}
// 自機の近くを通る、画面を横切る線
function crossLine(g, a, off, w, T) {
  const p = g.player, L = g.viewR * 2 + 260, nx = -Math.sin(a), ny = Math.cos(a), cx = p.x + nx * off, cy = p.y + ny * off;
  return { x: cx - Math.cos(a) * L / 2, y: cy - Math.sin(a) * L / 2, a, len: L, w, t: 0, T, fired: false };
}
// 線に当たったものへ
function fireBeam(g, b, hurt, dmg, bossDmg) {
  const p = g.player;
  if (inBeam(p.x, p.y, b.x, b.y, b.a, b.len, b.w, p.r)) g.hurtPlayer(hurt * g.stageDmg, { src: 'hazard' });
  for (const e of g.enemies) {
    if (!e.alive || e.prop || e.segment || !inBeam(e.x, e.y, b.x, b.y, b.a, b.len, b.w, e.r)) continue;
    g.damage(e, e.maxHp * (e.boss ? bossDmg : dmg));
  }
}

// ================================================================ 焼成：炉が噴く
const BURN_R = 95, SEA_R = 170;
// 炉（アタノール）：レンガの塔と、焚き口の炎。光は加算で重ねる
function drawFurnace(ctx, o, t) {
  const x = o.x, y = o.y, r = o.r, ready = o.cd <= 0;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = (ready ? 0.6 : 0.3) + Math.sin(t * 7 + o.seed) * 0.12;
  ctx.drawImage(softSprite('#ff7a3d'), x - r * 1.8, y - r * 2.3, r * 3.6, r * 3.6);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#3a2a24';
  ctx.strokeStyle = ready ? '#ffb070' : '#8a6a58';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - r, y + r * 0.6);
  ctx.lineTo(x - r * 0.8, y - r * 0.6);
  ctx.quadraticCurveTo(x, y - r * 1.4, x + r * 0.8, y - r * 0.6);
  ctx.lineTo(x + r, y + r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(140,100,80,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.9, y - r * 0.1);
  ctx.lineTo(x + r * 0.9, y - r * 0.1);
  ctx.moveTo(x - r * 0.85, y - r * 0.45);
  ctx.lineTo(x + r * 0.85, y - r * 0.45);
  ctx.stroke();
  ctx.fillStyle = '#1a0a06';
  ctx.beginPath();
  ctx.arc(x, y + r * 0.2, r * 0.42, Math.PI, 0);
  ctx.lineTo(x + r * 0.42, y + r * 0.6);
  ctx.lineTo(x - r * 0.42, y + r * 0.6);
  ctx.closePath();
  ctx.fill();
  const f = Math.sin(t * 9 + o.seed) * 0.15, big = ready ? 1.4 : 1;
  ctx.fillStyle = '#ff8a3d';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.32, y + r * 0.6);
  ctx.quadraticCurveTo(x - r * 0.2, y - r * (0.1 + f) * big, x, y - r * (0.25 + f) * big);
  ctx.quadraticCurveTo(x + r * 0.2, y - r * (0.1 - f) * big, x + r * 0.32, y + r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd23d';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.16, y + r * 0.6);
  ctx.quadraticCurveTo(x, y - r * (0.05 + f), x + r * 0.16, y + r * 0.6);
  ctx.closePath();
  ctx.fill();
}
const CALC = {
  init(h) {
    h.s = { burnT: 0, seas: [], lines: [], lineT: 8, bigT: 40 };
  },
  terrain(h, r, ox, oy, c) {
    if (r() < 0.4) c.push({ x: ox + 70 + r() * 220, y: oy + 70 + r() * 220, r: 24, seed: r() * TAU, cd: 0 });
  },
  erupt(h, o) {
    const g = h.g;
    o.cd = 14;
    h.s.seas.push({ x: o.x, y: o.y, t: 0, T: 6, tick: 0 });
    g.fx.burst(o.x, o.y - 10, '#ff8a3d', 26, 300, 0.7, 12);
    g.fx.ring(o.x, o.y, 8, SEA_R, 0.45, '#ffb84a', 7);
    g.fx.shake(4);
    audio.bomb(false, 2);
  },
  update(h, dt) {
    const g = h.g, p = g.player, s = h.s;
    const fs = h.around(p.x, p.y, h._c || (h._c = []));
    for (const o of fs) {
      if (o.cd > 0) { o.cd -= dt; continue; }
      // 炉に触れると火を噴き、まわりが炎の海になる
      if ((p.x - o.x) ** 2 + (p.y - o.y) ** 2 < (o.r + p.r + 6) ** 2) this.erupt(h, o);
    }
    // 炉の近くを通る雑魚は燃える
    s.burnT -= dt;
    if (s.burnT <= 0) {
      s.burnT = 0.5;
      for (const e of minions(g)) {
        for (const o of fs) {
          if ((e.x - o.x) ** 2 + (e.y - o.y) ** 2 > BURN_R * BURN_R) continue;
          g.damage(e, e.maxHp * 0.06, { dot: true, silent: true });
          break;
        }
      }
    }
    // 炎の海：雑魚は燃え尽き、自機は少しずつ削られる
    for (const sea of s.seas) {
      sea.t += dt;
      sea.tick -= dt;
      if (sea.tick > 0) continue;
      sea.tick = 0.5;
      for (const e of g.enemies) {
        if (!e.alive || e.prop || e.segment || (e.x - sea.x) ** 2 + (e.y - sea.y) ** 2 > (SEA_R + e.r) ** 2) continue;
        g.damage(e, e.maxHp * (e.boss ? 0.006 : 0.18), { dot: true, silent: true });
      }
      if ((p.x - sea.x) ** 2 + (p.y - sea.y) ** 2 < SEA_R * SEA_R) g.hurtPlayer(4 * g.stageDmg, { ignoreIT: true, silent: true, src: 'hazard' });
    }
    s.seas = s.seas.filter((sea) => sea.t < sea.T);
    if (g.timeStopT > 0) return;
    // 火柱：炉どうしを結ぶ線を走る（炉が近くに 1 つなら、炉から自機の近くを通る線）
    s.lineT -= dt;
    s.bigT -= dt;
    if (s.lineT <= 0) {
      s.lineT = rand(8, 12);
      const near = fs.filter((o) => g.inView(o, 120));
      if (near.length >= 2) {
        const a = pick(near);
        let b = pick(near);
        if (b === a) b = near.find((o) => o !== a);
        const ang = Math.atan2(b.y - a.y, b.x - a.x), len = Math.hypot(b.x - a.x, b.y - a.y);
        s.lines.push({ x: a.x - Math.cos(ang) * 120, y: a.y - Math.sin(ang) * 120, a: ang, len: len + 240, w: 46, t: 0, T: 1.3, fired: false });
      } else s.lines.push(crossLine(g, rand(TAU), rand(-60, 60), 46, 1.3));
    }
    if (s.bigT <= 0) {
      s.bigT = rand(38, 46);
      g.hooks.banner('CALCINATIO', 'swarm', '焼成 — 近くの炉が一斉に噴く');
      audio.warning();
      for (const o of fs) if (g.inView(o, 60)) this.erupt(h, o);
      for (let i = 0; i < 2; i++) s.lines.push(crossLine(g, rand(TAU), rand(-90, 90), 46, 1.5));
    }
    for (const b of s.lines) {
      b.t += dt;
      if (b.fired || b.t < b.T) continue;
      b.fired = true;
      fireBeam(g, b, 16, 0.6, 0.015);
      audio.bomb(false, 2);
    }
    s.lines = s.lines.filter((b) => b.t < b.T + 0.6);
  },
  avoid(h, p) {
    for (const sea of h.s.seas) { const v = awayFrom(p, sea.x, sea.y, SEA_R + 10, 0.4); if (v) return v; }
    return beamAway(p, h.s.lines);
  },
  ground(h, ctx) {
    const g = h.g, p = g.player, s = h.s;
    for (const o of h.inView(p.x, p.y, h._v || (h._v = []))) {
      ctx.globalAlpha = 0.16 + 0.05 * Math.sin(h.t * 4 + o.seed);
      ctx.drawImage(softSprite('#ff7a3d'), o.x - BURN_R, o.y - BURN_R, BURN_R * 2, BURN_R * 2);
      ctx.globalAlpha = 1;
    }
    for (const sea of s.seas) {
      if (!g.inView(sea, SEA_R)) continue;
      const k = Math.min(1, sea.t / 0.3, (sea.T - sea.t) / 0.6);
      const grd = ctx.createRadialGradient(sea.x, sea.y, 0, sea.x, sea.y, SEA_R);
      grd.addColorStop(0, 'rgba(255,200,80,0.55)');
      grd.addColorStop(0.6, 'rgba(255,100,30,0.45)');
      grd.addColorStop(1, 'rgba(160,30,0,0)');
      ctx.globalAlpha = k;
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(sea.x, sea.y, SEA_R, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffb84a';
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4 + sea.x, rr = SEA_R * ((i * 0.37) % 0.9), fh = 10 + 8 * Math.sin(h.t * 9 + i);
        const x = sea.x + Math.cos(a) * rr, y = sea.y + Math.sin(a) * rr;
        ctx.beginPath();
        ctx.moveTo(x - 5, y);
        ctx.quadraticCurveTo(x, y - fh, x + 5, y);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    for (const b of s.lines) if (!b.fired) drawBeamWarn(ctx, { ...b, color: '#ff8a3d' });
  },
  objects(h, ctx) {
    const p = h.g.player;
    for (const o of h.inView(p.x, p.y, h._v || (h._v = []))) drawFurnace(ctx, o, h.t);
    // 走った火柱
    for (const b of h.s.lines) {
      if (!b.fired) continue;
      const k = 1 - (b.t - b.T) / 0.6;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.a);
      ctx.globalAlpha = k;
      const grd = ctx.createLinearGradient(0, -b.w / 2, 0, b.w / 2);
      grd.addColorStop(0, 'rgba(255,90,20,0)');
      grd.addColorStop(0.5, 'rgba(255,220,120,0.95)');
      grd.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, -b.w / 2 * k, b.len, b.w * k);
      ctx.restore();
    }
  },
};

// ================================================================ 溶解：満ち潮
const SOLU = {
  init(h) {
    h.s = { solvT: 0, tideT: 20, tide: null, tick: 0 };
  },
  terrain(h, r, ox, oy, c) {
    if (r() < 0.42) c.push({ x: ox + 90 + r() * 180, y: oy + 90 + r() * 180, r: 62 + r() * 26, seed: r() * TAU, pool: true });
    if (r() < 0.32) c.push({ x: ox + 60 + r() * 240, y: oy + 60 + r() * 240, r: 46, seed: r() * TAU, island: true });
  },
  // 満ち潮の強さ（0〜1）
  level(h) {
    const t = h.s.tide;
    if (!t || t.t < t.warn) return 0;
    const u = t.t - t.warn;
    return Math.max(0, Math.min(1, u / 1.2, (t.T - u) / 1.5));
  },
  onIsland(h, o) {
    for (const c of h.around(o.x, o.y, h._i || (h._i = []))) if (c.island && (o.x - c.x) ** 2 + (o.y - c.y) ** 2 < c.r * c.r) return true;
    return false;
  },
  update(h, dt) {
    const g = h.g, p = g.player, s = h.s;
    const lv = this.level(h);
    // 溶媒の池（満ち潮の間は島の外がすべて池）：中の雑魚は遅く、受けるダメージ ×1.5（game.js の damage）
    s.solvT -= dt;
    if (s.solvT <= 0) {
      s.solvT = 0.2;
      const ps = h.inView(p.x, p.y, h._v2 || (h._v2 = []));
      for (const e of minions(g)) {
        let inside = lv > 0.5 && !this.onIsland(h, e);
        if (!inside) for (const o of ps) if (o.pool && (e.x - o.x) ** 2 + (e.y - o.y) ** 2 < o.r * o.r) { inside = true; break; }
        e.solv = inside;
        if (inside) {
          if (!(e.slowT > 0) || e.slowMul > 0.6) e.slowMul = 0.6;
          e.slowT = Math.max(e.slowT, 0.3);
        }
      }
    }
    if (lv > 0.5) {
      // 満ち潮：雑魚は溶けて削れ続け、自機は島の外では遅くなる
      s.tick -= dt;
      if (s.tick <= 0) {
        s.tick = 0.5;
        for (const e of minions(g)) if (e.solv) g.damage(e, e.maxHp * 0.08, { dot: true, silent: true });
      }
      if (!this.onIsland(h, p)) { p.slowT = Math.max(p.slowT, 0.2); p.slowMul = 0.7; }
    }
    if (g.timeStopT > 0) return;
    s.tideT -= dt;
    if (s.tideT <= 0 && !s.tide) {
      s.tideT = rand(24, 30);
      s.tide = { t: 0, warn: 2, T: 10.5 };
      g.hooks.banner('HIGH TIDE', 'swarm', '満ち潮 — 塩の島の上へ');
      audio.warning();
    }
    if (s.tide) {
      s.tide.t += dt;
      if (s.tide.t > s.tide.warn + s.tide.T) s.tide = null;
    }
  },
  avoid(h, p) {
    const t = h.s.tide;
    if (!t) return null;
    let best = null, bd = 1e9;
    for (const c of h.around(p.x, p.y, h._i2 || (h._i2 = []))) {
      if (!c.island) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best && bd > best.r * 0.5 ? [((best.x - p.x) / bd) * 0.6, ((best.y - p.y) / bd) * 0.6] : null;
  },
  ground(h, ctx) {
    const g = h.g, p = g.player, s = h.s, lv = this.level(h);
    const list = h.inView(p.x, p.y, h._v || (h._v = []));
    if (lv > 0) {
      // 満ち潮：画面いっぱいの溶媒
      ctx.globalAlpha = 0.55 * lv;
      ctx.fillStyle = '#1a5a8a';
      ctx.fillRect(p.x - g.viewW, p.y - g.viewH, g.viewW * 2, g.viewH * 2);
      ctx.strokeStyle = 'rgba(200,240,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const y = p.y - g.viewH / 2 + ((i * 67 + h.t * 20) % g.viewH), x = p.x - g.viewW / 2 + ((i * 131) % g.viewW);
        ctx.moveTo(x, y);
        ctx.lineTo(x + 40 + Math.sin(h.t + i) * 10, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (s.tide) {
      // 予告：画面の縁から青がにじむ
      const k = s.tide.t / s.tide.warn;
      ctx.globalAlpha = 0.25 * k * (0.6 + 0.4 * Math.sin(h.t * 10));
      ctx.strokeStyle = '#4fc8ff';
      ctx.lineWidth = 30;
      ctx.strokeRect(p.x - g.viewW / 2, p.y - g.viewH / 2, g.viewW, g.viewH);
      ctx.globalAlpha = 1;
    }
    for (const o of list) {
      if (o.pool) {
        if (lv > 0.99) continue;
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
        continue;
      }
      // 塩の島：白い結晶
      ctx.fillStyle = lv > 0 ? '#e8f4f8' : 'rgba(232,244,248,0.55)';
      ctx.strokeStyle = '#9ac8dc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + o.seed, rr = o.r * (0.85 + 0.15 * ((i * 7) % 3) / 2);
        i ? ctx.lineTo(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr) : ctx.moveTo(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  },
};

// ================================================================ 分離：分かつ光の刃と光の壁
const SEPA = {
  init(h) {
    h.s = { bladeT: 8, bigT: 40, blades: [], walls: [] };
  },
  terrain(h, r, ox, oy, c) {
    if (r() < 0.36) c.push({ x: ox + 70 + r() * 220, y: oy + 70 + r() * 220, r: 54, seed: r() * TAU, hold: 0, cd: 0 });
  },
  update(h, dt) {
    const g = h.g, p = g.player, s = h.s;
    // 分離の環：1 秒立つと、重いもの（雑魚）を押し返し、精妙なもの（経験値）を引き寄せる。そのあと 9 秒休む
    for (const o of h.around(p.x, p.y, h._c || (h._c = []))) {
      if (o.cd > 0) { o.cd -= dt; continue; }
      if ((p.x - o.x) ** 2 + (p.y - o.y) ** 2 > o.r * o.r) { o.hold = 0; continue; }
      o.hold += dt;
      if (o.hold < 1) continue;
      o.hold = 0;
      o.cd = 9;
      for (const e of minions(g)) {
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
    // 光の壁：雑魚は通り抜けられない（壁に近づくと元の側へ押し戻す）。敵の弾は壁で消える
    for (const w of s.walls) {
      w.t += dt;
      const nx = -Math.sin(w.a), ny = Math.cos(w.a), ax = Math.cos(w.a), ay = Math.sin(w.a);
      for (const e of minions(g)) {
        const along = (e.x - w.x) * ax + (e.y - w.y) * ay;
        if (along < 0 || along > w.len) continue;
        const d = (e.x - w.x) * nx + (e.y - w.y) * ny;
        let side = w.side.get(e);
        if (side === undefined) { side = d >= 0 ? 1 : -1; w.side.set(e, side); }
        if (d * side < e.r + 6) {
          const push = e.r + 6 - d * side;
          e.x += nx * side * push;
          e.y += ny * side * push;
        }
      }
      for (const b of g.ebullets) {
        const along = (b.x - w.x) * ax + (b.y - w.y) * ay;
        if (along >= 0 && along <= w.len && Math.abs((b.x - w.x) * nx + (b.y - w.y) * ny) < 8) b.life = 0;
      }
    }
    s.walls = s.walls.filter((w) => w.t < w.T);
    if (g.timeStopT > 0) return;
    // 光の刃：線の予告のあと画面を横切り、跡に光の壁を残す
    s.bladeT -= dt;
    s.bigT -= dt;
    if (s.bladeT <= 0) {
      s.bladeT = rand(10, 14);
      s.blades.push(crossLine(g, rand(TAU), rand(-90, 90), 36, 1.2));
    }
    if (s.bigT <= 0) {
      s.bigT = rand(38, 46);
      s.bladeT = Math.max(s.bladeT, 5);
      g.hooks.banner('SEPARATIO', 'swarm', '分離 — 光の刃が四方を囲む');
      audio.warning();
      // 自機を囲む四角（中に入った雑魚は外へ出られず、外の雑魚は入れない）
      const a0 = rand(TAU);
      for (let i = 0; i < 4; i++) {
        const a = a0 + (i % 2) * (Math.PI / 2);
        s.blades.push(crossLine(g, a, i < 2 ? -160 : 160, 36, 1.5));
      }
    }
    for (const b of s.blades) {
      b.t += dt;
      if (b.fired || b.t < b.T) continue;
      b.fired = true;
      fireBeam(g, b, 18, 0.7, 0.02);
      s.walls.push({ x: b.x, y: b.y, a: b.a, len: b.len, t: 0, T: 8, side: new WeakMap() });
      g.fx.screenFlash(0.12, '#e8ecff');
      audio.whoosh();
    }
    s.blades = s.blades.filter((b) => !b.fired);
  },
  blocks(h, x, y) {
    void x; void y;
    return false;
  },
  avoid(h, p) {
    return beamAway(p, h.s.blades);
  },
  ground(h, ctx) {
    const g = h.g, p = g.player;
    for (const o of h.inView(p.x, p.y, h._v || (h._v = []))) {
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
    for (const b of h.s.blades) drawBeamWarn(ctx, { ...b, color: '#e8ecff' });
  },
  objects(h, ctx) {
    for (const w of h.s.walls) {
      const k = Math.min(1, w.t / 0.15, (w.T - w.t) / 0.8);
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.rotate(w.a);
      ctx.globalAlpha = 0.35 * k;
      ctx.fillStyle = '#c8d0ff';
      ctx.fillRect(0, -9, w.len, 18);
      ctx.globalAlpha = 0.9 * k;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, -2, w.len, 4);
      ctx.restore();
    }
    void h;
  },
};

// ================================================================ 結合：近づく日と月
const SEAL_R = 30, AURA_R = 130;
const CONI = {
  init(h) {
    h.s = { pair: null, nextT: 6 };
  },
  spawn(h) {
    const g = h.g, p = g.player, a = rand(TAU), d = 170;
    h.s.pair = {
      sun: { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d },
      moon: { x: p.x - Math.cos(a) * d, y: p.y - Math.sin(a) * d },
      t: 0,
    };
    g.hooks.banner('SOL ET LUNA', 'item', '太陽と月が近づいていく — 押すと早く結ばれる');
    audio.warning();
  },
  update(h, dt) {
    const g = h.g, p = g.player, s = h.s;
    if (!s.pair) {
      s.nextT -= dt;
      if (s.nextT <= 0) this.spawn(h);
      return;
    }
    const P = s.pair, A = P.sun, B = P.moon;
    P.t += dt;
    // 遠く離れたら、近くに出し直す
    if (Math.hypot(A.x - p.x, A.y - p.y) > 700 && Math.hypot(B.x - p.x, B.y - p.y) > 700) { this.spawn(h); return; }
    // 少しずつ近づく。自機が触れると押せる
    const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1;
    if (!(g.timeStopT > 0)) {
      const v = 14 * dt;
      A.x += (dx / d) * v; A.y += (dy / d) * v;
      B.x -= (dx / d) * v; B.y -= (dy / d) * v;
    }
    for (const S of [A, B]) {
      const ex = S.x - p.x, ey = S.y - p.y, ed = Math.hypot(ex, ey) || 1, rr = SEAL_R + p.r;
      if (ed < rr) { S.x = p.x + (ex / ed) * rr; S.y = p.y + (ey / ed) * rr; }
    }
    // 太陽のそばは攻撃力アップ、月のそばは回復
    s.nearSun = (p.x - A.x) ** 2 + (p.y - A.y) ** 2 < AURA_R * AURA_R;
    if ((p.x - B.x) ** 2 + (p.y - B.y) ** 2 < AURA_R * AURA_R) g.heal(3 * dt, true);
    if (Math.hypot(A.x - B.x, A.y - B.y) < SEAL_R * 1.4) {
      // 化学の結婚：画面の雑魚をすべて焼く
      const cx = (A.x + B.x) / 2, cy = (A.y + B.y) / 2;
      for (const e of g.enemies) {
        if (!e.alive || e.prop || e.segment || !g.inView(e, 40)) continue;
        g.damage(e, e.maxHp * (e.boss ? 0.025 : 0.85), { kb: 260, kx: Math.sign(e.x - cx) || 1, ky: Math.sign(e.y - cy) || 0 });
      }
      g.fx.ring(cx, cy, 10, g.viewR, 0.7, '#fff2c0', 12);
      g.fx.ring(cx, cy, 10, g.viewR * 0.8, 0.6, '#cfd8ff', 8);
      g.fx.screenFlash(0.45, '#fff2c0');
      g.fx.shake(12);
      g.hooks.banner('CONIUNCTIO', 'victory', '太陽と月が結ばれた');
      audio.bomb(true);
      s.pair = null;
      s.nextT = 12;
    }
  },
  dmgMul(h) {
    return h.s.pair && h.s.nearSun ? 1.3 : 1;
  },
  avoid(h, p) {
    const P = h.s.pair;
    if (!P) return null;
    // 太陽を月の方へ押しに行く
    const tx = P.sun.x - (P.moon.x - P.sun.x) * 0.15, ty = P.sun.y - (P.moon.y - P.sun.y) * 0.15, d = Math.hypot(tx - p.x, ty - p.y) || 1;
    return [((tx - p.x) / d) * 0.25, ((ty - p.y) / d) * 0.25];
  },
  ground(h, ctx) {
    const P = h.s.pair;
    if (!P) return;
    const A = P.sun, B = P.moon;
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#fff2c0';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const [S, col] of [[A, '#ffd23d'], [B, '#cfd8ff']]) {
      ctx.globalAlpha = 0.12;
      ctx.drawImage(softSprite(col), S.x - AURA_R, S.y - AURA_R, AURA_R * 2, AURA_R * 2);
      ctx.globalAlpha = 0.3;
      ctx.setLineDash([4, 8]);
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.arc(S.x, S.y, AURA_R, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  },
  objects(h, ctx) {
    const P = h.s.pair;
    if (!P) return;
    for (const [S, sun] of [[P.sun, true], [P.moon, false]]) {
      const col = sun ? '#ffd23d' : '#cfd8ff', r = SEAL_R;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(softSprite(col), S.x - r * 2, S.y - r * 2, r * 4, r * 4);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(S.x, S.y, r, 0, TAU);
      ctx.stroke();
      if (sun) {
        ctx.beginPath();
        ctx.arc(S.x, S.y, r * 0.5, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(S.x, S.y, r * 0.13, 0, TAU);
        ctx.fill();
        for (let i = 0; i < 8; i++) {
          const a = h.t + (i / 8) * TAU;
          ctx.beginPath();
          ctx.moveTo(S.x + Math.cos(a) * r * 1.15, S.y + Math.sin(a) * r * 1.15);
          ctx.lineTo(S.x + Math.cos(a) * r * 1.4, S.y + Math.sin(a) * r * 1.4);
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.arc(S.x, S.y, r * 0.55, Math.PI * 0.35, Math.PI * 1.65);
        ctx.arc(S.x + r * 0.22, S.y, r * 0.42, Math.PI * 1.55, Math.PI * 0.45, true);
        ctx.closePath();
        ctx.fill();
      }
    }
  },
};

// ================================================================ 発酵：腐敗の沼と孔雀の尾
const PAVO = [
  { col: '#ff5f7a', name: '攻撃力アップ' },
  { col: '#ffb03d', name: '攻撃速度アップ' },
  { col: '#ffe85f', name: '経験値 ×1.5' },
  { col: '#7fff8a', name: '回復' },
  { col: '#5fd0ff', name: '移動速度アップ' },
  { col: '#9a7fff', name: '経験値を引き寄せる' },
];
const PUD_R = 70;
const FERM = {
  init(h) {
    h.s = { puds: [], tailT: 18, zones: [], buff: null, buffT: 0 };
  },
  onKill(h, e) {
    const s = h.s;
    if (e.boss || e.prop || e.segment || s.puds.length >= 10 || Math.random() > 0.35) return;
    s.puds.push({ x: e.x, y: e.y, t: 0, T: 4.5, seed: rand(TAU) });
  },
  update(h, dt) {
    const g = h.g, p = g.player, s = h.s;
    s.buffT -= dt;
    if (s.buffT <= 0) s.buff = null;
    if (s.buff === 3) g.heal(4 * dt, true);
    if (g.timeStopT > 0) return;
    // 腐敗の沼：泡立って広がり、弾けて周りに大ダメージ（自機も近いと毒）
    for (const u of s.puds) {
      u.t += dt;
      if (u.done || u.t < u.T) continue;
      u.done = true;
      for (const e of minions(g)) if ((e.x - u.x) ** 2 + (e.y - u.y) ** 2 < (PUD_R + e.r) ** 2) g.damage(e, e.maxHp * 0.5);
      if ((p.x - u.x) ** 2 + (p.y - u.y) ** 2 < PUD_R * PUD_R) g.hurtPlayer(6 * g.stageDmg, { src: 'hazard' });
      if (g.inView(u, PUD_R)) {
        g.fx.burst(u.x, u.y, '#7fe080', 14, 220, 0.5, 10);
        g.fx.ring(u.x, u.y, 8, PUD_R, 0.35, '#5fe0a0', 6);
        audio.splash();
      }
    }
    s.puds = s.puds.filter((u) => !u.done);
    // 孔雀の尾：6 色の光の輪が扇に並び、入るとその色の力（10 秒）
    s.tailT -= dt;
    if (s.tailT <= 0) {
      s.tailT = rand(22, 28);
      const a0 = p.moving ? Math.atan2(p.dirY, p.dirX) : rand(TAU);
      s.zones = PAVO.map((z, i) => {
        const a = a0 + (i - 2.5) * 0.42;
        return { x: p.x + Math.cos(a) * 190, y: p.y + Math.sin(a) * 190, i, t: 0, T: 9 };
      });
      g.hooks.banner('CAUDA PAVONIS', 'item', '孔雀の尾 — 色の輪に入るとその力');
      audio.warning();
    }
    for (const z of s.zones) {
      z.t += dt;
      if ((p.x - z.x) ** 2 + (p.y - z.y) ** 2 > (48 + p.r) ** 2) continue;
      z.used = true;
      s.buff = z.i;
      s.buffT = 10;
      if (z.i === 5) for (const pk of g.pickups) if (pk.kind === 'xp') pk.vac = true;
      g.fx.burst(z.x, z.y, PAVO[z.i].col, 20, 240, 0.6, 10);
      g.hooks.banner(PAVO[z.i].name, 'item', '');
      audio.pickup();
    }
    s.zones = s.zones.filter((z) => !z.used && z.t < z.T);
  },
  dmgMul(h) { return h.s.buff === 0 ? 1.35 : 1; },
  fireMul(h) { return h.s.buff === 1 ? 1.3 : 1; },
  xpMul(h) { return h.s.buff === 2 ? 1.5 : 1; },
  speedMul(h) { return h.s.buff === 4 ? 1.25 : 1; },
  avoid(h, p) {
    for (const u of h.s.puds) if (u.t > u.T - 1.5) { const v = awayFrom(p, u.x, u.y, PUD_R + 10, 0.3); if (v) return v; }
    return null;
  },
  ground(h, ctx) {
    const g = h.g, s = h.s;
    for (const u of s.puds) {
      if (!g.inView(u, PUD_R)) continue;
      const k = u.t / u.T, r = 24 + (PUD_R - 24) * k;
      ctx.globalAlpha = 0.45 + 0.25 * k;
      ctx.fillStyle = '#2a5a2a';
      ctx.beginPath();
      ctx.arc(u.x, u.y, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = k > 0.7 ? '#bfff9a' : '#5fe0a0';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.arc(u.x, u.y, PUD_R, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#9af08a';
      for (let i = 0; i < 4; i++) {
        const q = (h.t * 1.5 + i * 0.25 + u.seed) % 1;
        ctx.globalAlpha = 1 - q;
        ctx.beginPath();
        ctx.arc(u.x + Math.cos(u.seed + i * 1.7) * r * 0.5, u.y + Math.sin(u.seed + i * 1.7) * r * 0.5, 2 + q * 5, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    for (const z of s.zones) {
      const k = Math.min(1, z.t / 0.4, (z.T - z.t) / 0.6), col = PAVO[z.i].col;
      ctx.globalAlpha = 0.35 * k;
      ctx.drawImage(softSprite(col), z.x - 60, z.y - 60, 120, 120);
      ctx.globalAlpha = 0.9 * k;
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(z.x, z.y, 48, 0, TAU);
      ctx.stroke();
      // 孔雀の羽の目
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(z.x, z.y, 14, 20, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#10204a';
      ctx.beginPath();
      ctx.ellipse(z.x, z.y + 2, 7, 10, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  },
  overlay(h, ctx) {
    const s = h.s, p = h.g.player;
    if (s.buff === null || s.buffT <= 0) return;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, s.buffT) * 0.45;
    ctx.drawImage(softSprite(PAVO[s.buff].col), p.x - 36, p.y - 36, 72, 72);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },
};

// ================================================================ 蒸留：蒸気口と雫の雨
const VENT_R = 30;
const DIST = {
  init(h) {
    h.s = { hurtT: 0, burnT: 0, rain: 0, rainT: 16, dropT: 0, drops: [] };
  },
  terrain(h, r, ox, oy, c) {
    if (r() < 0.4) c.push({ x: ox + 60 + r() * 240, y: oy + 60 + r() * 240, r: VENT_R, seed: r() * TAU });
  },
  update(h, dt) {
    const g = h.g, p = g.player, s = h.s;
    const vs = h.around(p.x, p.y, h._c || (h._c = []));
    // 蒸気口：触れると熱い。近くの雑魚も蒸される
    s.hurtT -= dt;
    for (const o of vs) {
      if (s.hurtT <= 0 && (p.x - o.x) ** 2 + (p.y - o.y) ** 2 < (o.r + p.r) ** 2) {
        s.hurtT = 0.6;
        g.hurtPlayer(6 * g.stageDmg, { ignoreIT: true, silent: true, src: 'hazard' });
      }
      if (g.inView(o, 40) && Math.random() < 0.5) g.fx.add(o.x + rand(-12, 12), o.y - rand(0, 10), rand(-8, 8), -rand(70, 120), 0.8, 7, '#e8f8ff', 'dot');
    }
    s.burnT -= dt;
    if (s.burnT <= 0) {
      s.burnT = 0.5;
      for (const e of minions(g)) for (const o of vs) if ((e.x - o.x) ** 2 + (e.y - o.y) ** 2 < (o.r + e.r + 20) ** 2) { g.damage(e, e.maxHp * 0.08, { dot: true, silent: true }); break; }
    }
    if (g.timeStopT > 0) return;
    // 雫の雨：湯気が一斉に冷えて降る。浴びた雑魚は凍って固まる
    s.rainT -= dt;
    if (s.rainT <= 0) {
      s.rainT = rand(16, 22);
      s.rain = 5;
      g.hooks.banner('DISTILLATIO', 'swarm', '雫の雨 — 予告の円から離れて');
      audio.warning();
    }
    if (s.rain > 0) {
      s.rain -= dt;
      s.dropT -= dt;
      if (s.dropT <= 0) {
        s.dropT = 0.25;
        let x, y;
        if (Math.random() < 0.4) { x = p.x + (p.moving ? p.dirX * 100 : 0) + rand(-30, 30); y = p.y + (p.moving ? p.dirY * 100 : 0) + rand(-30, 30); } else { const a = rand(TAU), d = rand(40, 280); x = p.x + Math.cos(a) * d; y = p.y + Math.sin(a) * d; }
        s.drops.push({ x, y, r: rand(50, 70), t: 0, T: 1.2, done: false });
      }
    }
    for (const o of s.drops) {
      o.t += dt;
      if (o.done || o.t < o.T) continue;
      o.done = true;
      if ((p.x - o.x) ** 2 + (p.y - o.y) ** 2 < (o.r + p.r) ** 2) g.hurtPlayer(14 * g.stageDmg, { src: 'hazard' });
      for (const e of g.enemies) {
        if (!e.alive || e.prop || e.segment || (e.x - o.x) ** 2 + (e.y - o.y) ** 2 > (o.r + e.r) ** 2) continue;
        g.damage(e, e.maxHp * (e.boss ? 0.01 : 0.45));
        if (!e.boss && e.ai !== 'thief') e.frozenT = Math.max(e.frozenT, 2);
      }
      if (g.inView(o, o.r)) { g.fx.burst(o.x, o.y, '#d0f0ff', 12, 200, 0.5, 9); g.fx.ring(o.x, o.y, 6, o.r, 0.35, '#bfe8ff', 6); audio.splash(); }
    }
    s.drops = s.drops.filter((o) => !o.done);
  },
  avoid(h, p) {
    for (const o of h.s.drops) { const v = awayFrom(p, o.x, o.y, o.r + 20, 0.5); if (v) return v; }
    for (const o of h.around(p.x, p.y, h._c2 || (h._c2 = []))) { const v = awayFrom(p, o.x, o.y, o.r + 24, 0.3); if (v) return v; }
    return null;
  },
  ground(h, ctx) {
    const p = h.g.player;
    for (const o of h.inView(p.x, p.y, h._v || (h._v = []))) {
      const grd = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      grd.addColorStop(0, 'rgba(255,255,255,0.55)');
      grd.addColorStop(0.5, 'rgba(160,210,240,0.3)');
      grd.addColorStop(1, 'rgba(120,180,220,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(220,240,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r * 0.45, 0, TAU);
      ctx.stroke();
    }
    for (const o of h.s.drops) drawCircleWarn(ctx, o.x, o.y, o.r, Math.min(1, o.t / o.T), '#bfe8ff');
  },
  objects(h, ctx) {
    for (const o of h.s.drops) {
      const k = Math.min(1, o.t / o.T), y = o.y - (1 - k) * 300;
      ctx.fillStyle = '#e8f8ff';
      ctx.beginPath();
      ctx.moveTo(o.x, y - 16);
      ctx.quadraticCurveTo(o.x + 10, y, o.x, y + 9);
      ctx.quadraticCurveTo(o.x - 10, y, o.x, y - 16);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,190,230,0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  },
};

// ================================================================ 凝固：金に変わる世界
const COAG = {
  init(h) {
    h.s = { waveT: 12, waves: [], opusT: 45 };
  },
  goldify(h, e) {
    const g = h.g;
    e.gold = true;
    e.frozenT = Math.max(e.frozenT, 8);
    e.tint = '#e8c050';
    if (g.inView(e, 20)) g.fx.burst(e.x, e.y, '#ffd23d', 4, 100, 0.35, 6);
  },
  update(h, dt) {
    const g = h.g, p = g.player, s = h.s;
    // 金になった雑魚：自機が体当たりすると砕けて、コインと経験値（コインは game.js の kill）
    for (const e of minions(g)) {
      if (!e.gold || !(e.frozenT > 0)) continue;
      if ((p.x - e.x) ** 2 + (p.y - e.y) ** 2 < (e.r + p.r + 4) ** 2) {
        g.damage(e, e.maxHp * 10, { dot: true, silent: true });
        g.fx.burst(e.x, e.y, '#ffd23d', 10, 200, 0.45, 8);
        audio.coin();
      }
    }
    if (g.timeStopT > 0) return;
    s.waveT -= dt;
    s.opusT -= dt;
    if (s.waveT <= 0) {
      s.waveT = rand(12, 16);
      s.waves.push({ x: p.x + rand(-100, 100), y: p.y + rand(-100, 100), t: 0, T: 1.6, R: 420 });
      g.hooks.banner('CHRYSOPOEIA', 'item', '黄金の波 — 触れた雑魚が金に変わる');
      audio.whoosh();
    }
    if (s.opusT <= 0) {
      s.opusT = rand(42, 50);
      g.hooks.banner('MAGNUM OPUS', 'victory', '完成の光 — 画面の雑魚がすべて金に変わる');
      g.fx.screenFlash(0.5, '#ffe9a0');
      audio.bomb(true);
      for (const e of minions(g)) if (g.inView(e, 40) && !e.gold && e.ai !== 'thief') this.goldify(h, e);
    }
    for (const w of s.waves) {
      w.t += dt;
      const rr = (w.t / w.T) * w.R;
      for (const e of minions(g)) {
        if (e.gold || e.ai === 'thief') continue;
        const d = Math.hypot(e.x - w.x, e.y - w.y);
        if (d > rr + e.r || d < rr - 50) continue;
        this.goldify(h, e);
      }
    }
    s.waves = s.waves.filter((w) => w.t < w.T);
  },
  avoid(h, p) {
    // 近くの金の雑魚を砕きに行く
    let best = null, bd = 220;
    for (const e of h.g.enemies) {
      if (!e.alive || !e.gold || !(e.frozenT > 0)) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best ? [((best.x - p.x) / bd) * 0.25, ((best.y - p.y) / bd) * 0.25] : null;
  },
  ground(h, ctx) {
    for (const w of h.s.waves) {
      const rr = (w.t / w.T) * w.R;
      ctx.globalAlpha = Math.min(1, (w.T - w.t) / 0.4) * 0.85;
      ctx.strokeStyle = '#ffd23d';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(w.x, w.y, rr, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = '#fff6c0';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },
};

// ステージの kind → ギミック
export const G4 = { athanor: CALC, solvent: SOLU, sieve: SEPA, sunmoon: CONI, ferment: FERM, vapor: DIST, gold: COAG };
void randi;
