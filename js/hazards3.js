// =====================================================================
//  第3章のギミック：鎌鼬とつむじ風（窮奇）／鉄砲水と濁流（檮杌）／饕餮の大口と鼎（饕餮）／舞の拍子と七つの穴（渾沌）
// =====================================================================
import { TAU, rand, randi } from './util.js';
import { softSprite, enemySprite } from './render.js';
import { audio } from './audio.js';
import { inBeam, drawBeamWarn, minions } from './gimmick-kit.js';

const awayFrom = (p, x, y, r, w = 0.4) => {
  const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 1;
  return d < r ? [(dx / d) * w, (dy / d) * w] : null;
};
// 線の予告の上なら、線から離れる向き
function beamAway(p, list, extra = 30) {
  for (const b of list) {
    if (b.fired || !inBeam(p.x, p.y, b.x, b.y, b.a, b.len, b.w + extra, p.r)) continue;
    const nx = -Math.sin(b.a), ny = Math.cos(b.a);
    const side = (p.x - b.x) * nx + (p.y - b.y) * ny >= 0 ? 1 : -1;
    return [nx * side * 0.6, ny * side * 0.6];
  }
  return null;
}

// ================================================================ 窮奇：鎌鼬とつむじ風
const YUSHU = {
  init(h) {
    h.s = { whirls: [], whirlT: 5, boostT: 0, blades: [], bladeT: 5, stormT: 40, storm: [] };
  },
  update(h, dt) {
    const g = h.g, p = g.player, s = h.s;
    s.boostT -= dt;
    if (s.boostT > 0 && p.moving && Math.random() < 0.4) g.fx.add(p.x + rand(-8, 8), p.y + rand(-8, 8), -p.dirX * 60, -p.dirY * 60, 0.5, 5, '#bfe8ff', 'dot');
    if (g.timeStopT > 0) return;
    // つむじ風：経験値を巻き上げて集め、触れた雑魚を空へ巻き上げて叩きつける。自機が乗ると速く走れる
    s.whirlT -= dt;
    if (s.whirlT <= 0) {
      s.whirlT = rand(7, 10);
      const a = rand(TAU), d = rand(150, 230);
      s.whirls.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d - 60, vx: rand(-30, 30), vy: rand(30, 50), t: 0, T: 14, r: 58 });
    }
    for (const w of s.whirls) {
      w.t += dt;
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      const R = w.r * 2.8;
      for (const pk of g.pickups) {
        if (pk.kind !== 'xp' || pk.vac) continue;
        const dx = w.x - pk.x, dy = w.y - pk.y, d2 = dx * dx + dy * dy;
        if (d2 > R * R) continue;
        const d = Math.sqrt(d2) || 1;
        if (d > 10) { const sp = Math.min(160 * dt, d); pk.x += (dx / d) * sp; pk.y += (dy / d) * sp; } else { pk.x += w.vx * dt; pk.y += w.vy * dt; }
      }
      if (w.t < w.T - 0.8) {
        if ((p.x - w.x) ** 2 + (p.y - w.y) ** 2 < (w.r + p.r) ** 2) {
          if (s.boostT <= 0) { g.fx.ring(p.x, p.y, 6, 50, 0.35, '#bfe8ff', 5); audio.whoosh(); }
          s.boostT = 2.2;
        }
        for (const e of minions(g)) {
          if (e.lift || (e.x - w.x) ** 2 + (e.y - w.y) ** 2 > (w.r + e.r) ** 2) continue;
          e.lift = { w, t: 0, a: rand(TAU) };
        }
      }
      if (Math.random() < 0.5 && g.inView(w, 40)) g.fx.add(w.x + rand(-w.r, w.r), w.y + rand(-w.r, w.r) * 0.5, rand(-40, 40), -rand(40, 90), 0.6, 4, '#dff2ff', 'dot');
    }
    // 巻き上げた雑魚：1.2 秒つむじ風の中を回って、地面に叩きつけられる
    for (const e of minions(g)) {
      const L = e.lift;
      if (!L) continue;
      L.t += dt;
      L.a += dt * 9;
      e.x = L.w.x + Math.cos(L.a) * 26;
      e.y = L.w.y + Math.sin(L.a) * 12 - L.t * 30;
      e.frozenT = Math.max(e.frozenT, 0.1);
      if (L.t >= 1.2) {
        e.lift = null;
        e.y += 36;
        g.damage(e, e.maxHp * 0.45, { kb: 0 });
        if (g.inView(e, 20)) g.fx.burst(e.x, e.y, '#dff2ff', 8, 160, 0.4, 8);
      }
    }
    s.whirls = s.whirls.filter((w) => w.t < w.T);
    // 鎌鼬：白い線の予告のあと、風の刃が画面を横切る
    const L = g.viewR * 2 + 260;
    const blade = (a, off, T) => {
      const nx = -Math.sin(a), ny = Math.cos(a), cx = p.x + nx * off, cy = p.y + ny * off;
      s.blades.push({ x: cx - Math.cos(a) * L / 2, y: cy - Math.sin(a) * L / 2, a, len: L, w: 30, t: 0, T, fired: false });
    };
    s.bladeT -= dt;
    s.stormT -= dt;
    if (s.bladeT <= 0) {
      s.bladeT = rand(4, 6);
      for (let i = randi(1, 2); i > 0; i--) blade(rand(TAU), rand(-60, 60), 0.9);
    }
    if (s.stormT <= 0) {
      s.stormT = rand(36, 44);
      s.bladeT = Math.max(s.bladeT, 4);
      g.hooks.banner('KAMAITACHI', 'swarm', '鎌鼬 — 風の刃が続けて走る');
      audio.warning();
      const a0 = rand(TAU);
      for (let k = 0; k < 3; k++) s.storm.push({ t: -k * 1.1, a: a0 + k * (Math.PI / 3), done: false });
    }
    for (const st of s.storm) {
      st.t += dt;
      if (st.done || st.t < 0) continue;
      st.done = true;
      for (const off of [-150, 0, 150]) blade(st.a, off + rand(-20, 20), 1.2);
    }
    s.storm = s.storm.filter((st) => !st.done);
    for (const b of s.blades) {
      b.t += dt;
      if (b.fired || b.t < b.T) continue;
      b.fired = true;
      if (inBeam(p.x, p.y, b.x, b.y, b.a, b.len, b.w, p.r)) g.hurtPlayer(15 * g.stageDmg, { src: 'hazard' });
      for (const e of g.enemies) {
        if (!e.alive || e.prop || e.segment || !inBeam(e.x, e.y, b.x, b.y, b.a, b.len, b.w, e.r)) continue;
        g.damage(e, e.maxHp * (e.boss ? 0.015 : 0.6));
      }
      audio.whoosh();
    }
    s.blades = s.blades.filter((b) => b.t < b.T + 0.4);
  },
  speedMul(h) {
    return h.s.boostT > 0 ? 1.4 : 1;
  },
  avoid(h, p) {
    return beamAway(p, h.s.blades);
  },
  ground(h, ctx) {
    for (const b of h.s.blades) if (!b.fired) drawBeamWarn(ctx, { ...b, color: '#e8f4ff' });
  },
  objects(h, ctx) {
    const g = h.g;
    ctx.save();
    ctx.lineCap = 'round';
    for (const w of h.s.whirls) {
      if (!g.inView(w, w.r * 2)) continue;
      const k = Math.min(1, w.t / 0.6) * Math.min(1, (w.T - w.t) / 0.8);
      for (let i = 0; i < 5; i++) {
        const rr = w.r * (1 - i * 0.16);
        const a = h.t * (4 + i * 1.5) + i * 1.3;
        ctx.globalAlpha = (0.65 - i * 0.08) * k;
        ctx.strokeStyle = i % 2 ? '#bfe8ff' : '#ffffff';
        ctx.lineWidth = 3.4 - i * 0.4;
        ctx.beginPath();
        ctx.ellipse(w.x, w.y - i * 11, rr, rr * 0.42, 0, a, a + 3.8);
        ctx.stroke();
      }
    }
    // 走り抜けた刃の残像
    for (const b of h.s.blades) {
      if (!b.fired) continue;
      const k = 1 - (b.t - b.T) / 0.4;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.a);
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6 * k;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(b.len, 0);
      ctx.stroke();
      ctx.globalAlpha = 0.4 * k;
      ctx.strokeStyle = '#bfe8ff';
      ctx.lineWidth = b.w * k;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  },
};

// ================================================================ 檮杌：鉄砲水と濁流
// 濁流：横に流れる帯。RIVER_GAP ごとに幅 RIVER_W、向きは 1 本ごとに逆。自機は FLOW、雑魚は FLOW_E の速さで流される
const RIVER_GAP = 520, RIVER_W = 120, FLOW = 80, FLOW_E = 60;
function flowAt(y) {
  const k = Math.floor(y / RIVER_GAP);
  if (Math.abs(y - (k * RIVER_GAP + RIVER_GAP / 2)) > RIVER_W / 2) return 0;
  return k & 1 ? -1 : 1;
}
const WAVE_V = 520, WAVE_W = 70;
const UZAN = {
  init(h) {
    h.s = { waveT: 18, wave: null, wash: null };
  },
  terrain(h, r, ox, oy, c) {
    // 大岩（通れない。鉄砲水の陰になる）
    if (r() < 0.4) c.push({ x: ox + 60 + r() * 240, y: oy + 60 + r() * 240, r: 26 + r() * 10, seed: r() * TAU });
  },
  // 波を受けない：大岩のすぐ下流にいる
  sheltered(h, o, dir) {
    for (const b of h.around(o.x, o.y, h._s || (h._s = []))) {
      const dx = o.x - b.x, dy = o.y - b.y;
      const along = dx * Math.cos(dir) + dy * Math.sin(dir), side = -dx * Math.sin(dir) + dy * Math.cos(dir);
      if (along > 0 && along < 110 && Math.abs(side) < b.r + 4) return true;
    }
    return false;
  },
  update(h, dt) {
    const g = h.g, p = g.player, s = h.s;
    this.collide(h, p, p.r);
    for (const e of g.enemies) if (e.alive && !e.prop && !e.boss && !e.segment && g.inView(e, 120)) this.collide(h, e, e.r * 0.8);
    // 濁流の帯
    const f = flowAt(p.y);
    if (f) {
      p.x += f * FLOW * dt;
      if (Math.random() < 0.3) g.fx.add(p.x + rand(-10, 10), p.y + rand(-6, 6), f * 60, rand(-20, 20), 0.5, 5, '#bff5e6', 'dot');
    }
    if (s.wash) {
      s.wash.t -= dt;
      const k = Math.max(0, s.wash.t / 0.6);
      p.x += s.wash.vx * k * dt;
      p.y += s.wash.vy * k * dt;
      if (s.wash.t <= 0) s.wash = null;
    }
    if (g.timeStopT > 0) return;
    for (const e of minions(g)) { const fe = flowAt(e.y); if (fe) e.x += fe * FLOW_E * dt; }
    // 鉄砲水：画面の端から大波が押し寄せ、触れたものを押し流す（大岩の陰は流されない）
    s.waveT -= dt;
    if (s.waveT <= 0 && !s.wave) {
      s.waveT = rand(20, 26);
      const a = rand(TAU), R = g.viewR + 100;
      s.wave = { a, x0: p.x - Math.cos(a) * R, y0: p.y - Math.sin(a) * R, d: 0, D: R * 2, t: 0, warn: 1.6, hitP: false, hit: new Set() };
      g.hooks.banner('FLASH FLOOD', 'swarm', '鉄砲水 — 大岩の陰に隠れて');
      audio.warning();
    }
    const w = s.wave;
    if (w) {
      w.t += dt;
      if (w.t > w.warn) {
        w.d += WAVE_V * dt;
        const ca = Math.cos(w.a), sa = Math.sin(w.a);
        const front = (o) => (o.x - w.x0) * ca + (o.y - w.y0) * sa;
        const pf = front(p);
        if (!w.hitP && pf < w.d && pf > w.d - WAVE_W) {
          w.hitP = true;
          if (!this.sheltered(h, p, w.a)) {
            s.wash = { vx: ca * 520, vy: sa * 520, t: 0.6 };
            g.hurtPlayer(10 * g.stageDmg, { src: 'hazard' });
          }
        }
        for (const e of minions(g)) {
          if (w.hit.has(e)) continue;
          const ef = front(e);
          if (ef < w.d && ef > w.d - WAVE_W) {
            w.hit.add(e);
            if (this.sheltered(h, e, w.a)) continue;
            e.vx += ca * 420 * (e.kbk ?? 1);
            e.vy += sa * 420 * (e.kbk ?? 1);
            g.damage(e, e.maxHp * 0.35, { dot: true, silent: true });
          }
        }
        if (w.d > w.D) s.wave = null;
      } else if (Math.random() < 0.7) {
        // 予告：押し寄せてくる側の端に水しぶき
        const off = rand(-g.viewR, g.viewR);
        g.fx.add(w.x0 - Math.sin(w.a) * off + Math.cos(w.a) * 60, w.y0 + Math.cos(w.a) * off + Math.sin(w.a) * 60, Math.cos(w.a) * 120, Math.sin(w.a) * 120, 0.6, 7, '#d8fff4', 'dot');
      }
    }
  },
  collide(h, obj, r) {
    for (const b of h.around(obj.x, obj.y, h._k || (h._k = []))) {
      const dx = obj.x - b.x, dy = obj.y - b.y, rr = b.r + r, d2 = dx * dx + dy * dy;
      if (d2 < rr * rr) { const d = Math.sqrt(d2) || 0.01; obj.x = b.x + (dx / d) * rr; obj.y = b.y + (dy / d) * rr; }
    }
  },
  blocks(h, x, y) {
    for (const b of h.around(x, y, h._k || (h._k = []))) if ((x - b.x) ** 2 + (y - b.y) ** 2 < b.r * b.r) return true;
    return false;
  },
  avoid(h, p) {
    const w = h.s.wave;
    if (!w || w.hitP) return null;
    // 一番近い大岩の下流へ
    let best = null, bd = 1e9;
    for (const b of h.around(p.x, p.y, h._s2 || (h._s2 = []))) {
      const tx = b.x + Math.cos(w.a) * (b.r + 30), ty = b.y + Math.sin(w.a) * (b.r + 30), d = Math.hypot(tx - p.x, ty - p.y);
      if (d < bd) { bd = d; best = [tx, ty]; }
    }
    if (!best || bd < 8) return null;
    return [((best[0] - p.x) / bd) * 0.6, ((best[1] - p.y) / bd) * 0.6];
  },
  ground(h, ctx) {
    const g = h.g, p = g.player, s = h.s;
    const x0 = p.x - g.viewW / 2 - 40, W = g.viewW + 80;
    const k0 = Math.floor((p.y - g.viewH / 2 - RIVER_W) / RIVER_GAP), k1 = Math.floor((p.y + g.viewH / 2 + RIVER_W) / RIVER_GAP);
    for (let k = k0; k <= k1; k++) {
      const cy = k * RIVER_GAP + RIVER_GAP / 2, top = cy - RIVER_W / 2, dir = k & 1 ? -1 : 1;
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
      ctx.strokeStyle = 'rgba(200,255,240,0.35)';
      ctx.beginPath();
      for (let i = 0; i < 18; i++) {
        const ly = top + 14 + ((i * 37) % (RIVER_W - 28)), span = 220 + (i % 5) * 40;
        const off = (((i * 131 + h.t * dir * FLOW * 1.4) % span) + span) % span;
        for (let x = Math.floor(x0 / span) * span + off; x < x0 + W; x += span) { ctx.moveTo(x, ly); ctx.lineTo(x + dir * 26, ly); }
      }
      ctx.stroke();
    }
    const w = s.wave;
    if (w && w.t > w.warn) {
      // 波頭：進む向きに垂直な帯
      ctx.save();
      ctx.translate(w.x0, w.y0);
      ctx.rotate(w.a);
      const L = g.viewR * 2 + 300;
      const grd = ctx.createLinearGradient(w.d - WAVE_W * 2.5, 0, w.d, 0);
      grd.addColorStop(0, 'rgba(40,140,110,0)');
      grd.addColorStop(0.7, 'rgba(60,180,150,0.55)');
      grd.addColorStop(1, 'rgba(220,255,245,0.95)');
      ctx.fillStyle = grd;
      ctx.fillRect(w.d - WAVE_W * 2.5, -L / 2, WAVE_W * 2.5, L);
      ctx.restore();
    }
  },
  objects(h, ctx) {
    const p = h.g.player;
    for (const b of h.inView(p.x, p.y, h._v || (h._v = []))) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + b.r * 0.45, b.r * 1.05, b.r * 0.4, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#3a4a44';
      ctx.strokeStyle = '#6a8a7e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + b.seed, rr = b.r * (0.85 + 0.15 * Math.sin(i * 2.3 + b.seed));
        i ? ctx.lineTo(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr * 0.85) : ctx.moveTo(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr * 0.85);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  },
};

// ================================================================ 饕餮：大口と鼎
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
const MAW_R = 360, MAW_CORE = 50;
const SANKI = {
  init(h) {
    h.s = { mawT: 16, maw: null };
  },
  terrain(h, r, ox, oy, c) {
    if (r() < 0.35) c.push({ x: ox + 60 + r() * 240, y: oy + 60 + r() * 240, r: 24, seed: r() * TAU, store: 0, cd: 0 });
  },
  update(h, dt) {
    const g = h.g, p = g.player, s = h.s;
    // 鼎：近くの経験値を吸い込んでためる。触れると 1.5 倍にして吐き出し、しばらく休む
    let ate = false;
    for (const o of h.around(p.x, p.y, h._c || (h._c = []))) {
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
    if (g.timeStopT > 0) { if (ate) g.pickups = g.pickups.filter((pk) => !pk.eaten); return; }
    // 大口：開く（0.9 秒）→ 吸い込む（6 秒）→ 閉じて、呑んだ経験値を 2 倍にして吐き出す
    s.mawT -= dt;
    if (s.mawT <= 0 && !s.maw) {
      s.mawT = rand(22, 28);
      const a = rand(TAU), d = rand(180, 240);
      s.maw = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, t: 0, open: 0.9, T: 6.9, store: 0, biteT: 0 };
      g.hooks.banner('MAW OF TAOTIE', 'swarm', '饕餮の大口 — 呑まれないように');
      audio.warning();
    }
    const m = s.maw;
    if (m) {
      m.t += dt;
      if (m.t > m.open && m.t < m.T) {
        const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1;
        if (d < MAW_R) { const f = 85 * (1 - (d / MAW_R) * 0.5); p.x += (dx / d) * f * dt; p.y += (dy / d) * f * dt; }
        m.biteT -= dt;
        if (d < MAW_CORE && m.biteT <= 0) {
          m.biteT = 1;
          g.hurtPlayer(22 * g.stageDmg, { src: 'hazard' });
          g.fx.shake(6);
        }
        for (const e of minions(g)) {
          const ex = m.x - e.x, ey = m.y - e.y, ed = Math.hypot(ex, ey) || 1;
          if (ed > MAW_R) continue;
          const f = 170 * (1.1 - ed / MAW_R) * (e.kbk ?? 1);
          e.x += (ex / ed) * f * dt;
          e.y += (ey / ed) * f * dt;
          if (ed < MAW_CORE) {
            // 丸呑み：その雑魚のぶんの経験値を口にためる
            m.store += Math.max(2, Math.round((e.xp || 2) * 1.5));
            g.damage(e, e.maxHp * 10, { dot: true, silent: true });
          }
        }
        for (const pk of g.pickups) {
          if (pk.kind !== 'xp' || pk.vac) continue;
          const px = m.x - pk.x, py = m.y - pk.y, pd = Math.hypot(px, py) || 1;
          if (pd > MAW_R) continue;
          if (pd < 30) { m.store += pk.value; pk.eaten = true; ate = true; continue; }
          pk.x += (px / pd) * 200 * dt;
          pk.y += (py / pd) * 200 * dt;
        }
        if (g.inView(m, MAW_R) && Math.random() < 0.7) {
          const a = rand(TAU), rr = rand(120, MAW_R);
          g.fx.add(m.x + Math.cos(a) * rr, m.y + Math.sin(a) * rr, -Math.cos(a) * 220, -Math.sin(a) * 220, 0.5, 4, '#ffcf7a', 'dot');
        }
      }
      if (m.t >= m.T) {
        const v = m.store * 2;
        if (v > 0) {
          const n = Math.min(24, Math.max(4, Math.ceil(v / 15)));
          for (let i = 0; i < n; i++) g.dropPickup('xp', m.x + rand(-40, 40), m.y + rand(-40, 40), Math.max(1, Math.round(v / n)));
          g.fx.burst(m.x, m.y, '#ffd23d', 26, 300, 0.7, 12);
          audio.chestOpen();
        }
        g.fx.shake(5);
        s.maw = null;
      }
    }
    if (ate) g.pickups = g.pickups.filter((pk) => !pk.eaten);
  },
  avoid(h, p) {
    const m = h.s.maw;
    return m ? awayFrom(p, m.x, m.y, MAW_R * 0.7, 0.55) : null;
  },
  ground(h, ctx) {
    const g = h.g, m = h.s.maw;
    if (!m || !g.inView(m, MAW_R)) return;
    const k = Math.min(1, m.t / m.open, Math.max(0, (m.T - m.t) / 0.4));
    // 吸い込む範囲
    ctx.globalAlpha = 0.25 * k;
    ctx.strokeStyle = '#ffcf7a';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.arc(m.x, m.y, MAW_R, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    // 口：上下の顎と牙（饕餮紋の目）
    const W = 120 * k, Hh = 70 * k * (0.75 + 0.25 * Math.sin(h.t * 6));
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#1a0606';
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, W, Hh, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8dcc0';
    for (let i = 0; i < 9; i++) {
      const x = m.x - W * 0.85 + (i / 8) * W * 1.7;
      const top = m.y - Hh * Math.sqrt(Math.max(0, 1 - ((x - m.x) / W) ** 2));
      const bot = m.y + Hh * Math.sqrt(Math.max(0, 1 - ((x - m.x) / W) ** 2));
      ctx.beginPath();
      ctx.moveTo(x - 7, top);
      ctx.lineTo(x, top + 18 * k);
      ctx.lineTo(x + 7, top);
      ctx.moveTo(x - 7, bot);
      ctx.lineTo(x, bot - 18 * k);
      ctx.lineTo(x + 7, bot);
      ctx.fill();
    }
    ctx.strokeStyle = '#c8a050';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, W, Hh, 0, 0, TAU);
    ctx.stroke();
    // 目
    ctx.fillStyle = '#ffcf7a';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(m.x + sx * W * 0.7, m.y - Hh - 36 * k, 16 * k, 9 * k, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
  objects(h, ctx) {
    const p = h.g.player;
    for (const o of h.inView(p.x, p.y, h._v || (h._v = []))) drawCauldron(ctx, o, h.t);
  },
};

// ================================================================ 渾沌：舞の拍子と七つの穴
// 140 BPM（渾沌の曲）。1 小節 = 4 拍。小節の頭に舞の輪の中にいると、衝撃波（続けて決めると強くなる）
const BEAT = 60 / 140, BAR = BEAT * 4, RING_R = 84, HOLE_R = 58;
const HOLE_NAME = ['一つ目', '二つ目', '三つ目', '四つ目', '五つ目', '六つ目', '七つ目'];
const CHUOU = {
  init(h) {
    h.s = { rings: [], bar: 0, combo: 0, holes: [], holeT: 30, inRing: false, burst: [] };
  },
  update(h, dt) {
    const g = h.g, p = g.player, s = h.s;
    // 舞の輪：3 つが自機のまわりをゆっくり漂う。遠くへ離れたら近くに出し直す
    while (s.rings.length < 3) {
      const a = rand(TAU), d = rand(120, 260);
      s.rings.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, vx: rand(-25, 25), vy: rand(-25, 25), seed: rand(TAU) });
    }
    s.inRing = false;
    for (const r of s.rings) {
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      if (Math.random() < dt * 0.3) { r.vx = rand(-30, 30); r.vy = rand(-30, 30); }
      if ((p.x - r.x) ** 2 + (p.y - r.y) ** 2 < RING_R * RING_R) s.inRing = true;
    }
    s.rings = s.rings.filter((r) => (r.x - p.x) ** 2 + (r.y - p.y) ** 2 < 520 * 520);
    const bar = Math.floor(h.t / BAR);
    if (bar !== s.bar) {
      s.bar = bar;
      if (s.inRing && !(g.timeStopT > 0)) {
        s.combo = Math.min(5, s.combo + 1);
        const R = 140 + s.combo * 25, mul = Math.min(0.7, 0.25 + s.combo * 0.09);
        for (const e of g.enemies) {
          if (!e.alive || e.prop || e.segment) continue;
          const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
          if (d > R + e.r) continue;
          g.damage(e, e.maxHp * (e.boss ? 0.01 : mul), { kb: 220, kx: dx / d, ky: dy / d });
        }
        s.burst.push({ x: p.x, y: p.y, R, t: 0 });
        g.fx.text(p.x, p.y - 30, `♪ ×${s.combo}`, { size: 16 + s.combo * 2, color: '#ffc070', life: 0.7 });
        audio.bomb(false, 1);
      } else s.combo = 0;
    }
    for (const b of s.burst) b.t += dt;
    s.burst = s.burst.filter((b) => b.t < 0.45);
    if (g.timeStopT > 0) return;
    // 七つの穴：30 秒たつと 1 つ目、そのあと 1 分ごとに 1 つずつ（7 つまで）。雑魚を吸い寄せて落とし、自機も落ちると痛い
    s.holeT -= dt;
    if (s.holeT <= 0 && s.holes.length < 7) {
      s.holeT = 60;
      const a = rand(TAU), d = rand(180, 260);
      s.holes.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, t: 0, hurtT: 0 });
      g.hooks.banner('HOLE', 'swarm', `${HOLE_NAME[s.holes.length - 1]}の穴が開いた`);
      audio.warning();
    }
    for (const o of s.holes) {
      o.t += dt;
      const k = Math.min(1, o.t / 1.2);
      if (k < 1) continue;
      for (const e of minions(g)) {
        const dx = o.x - e.x, dy = o.y - e.y, d = Math.hypot(dx, dy) || 1;
        if (d > 230) continue;
        e.x += (dx / d) * 55 * dt;
        e.y += (dy / d) * 55 * dt;
        if (d < HOLE_R * 0.8) {
          g.damage(e, e.maxHp * 10, { dot: true, silent: true });
          if (g.inView(e, 20)) g.fx.burst(e.x, e.y, '#3a2a1a', 6, 80, 0.4, 7);
        }
      }
      o.hurtT -= dt;
      if (o.hurtT <= 0 && (p.x - o.x) ** 2 + (p.y - o.y) ** 2 < (HOLE_R * 0.8) ** 2) {
        o.hurtT = 0.5;
        g.hurtPlayer(12 * g.stageDmg, { ignoreIT: true, silent: true, src: 'hazard' });
        p.slowT = 0.6;
        p.slowMul = 0.6;
      }
    }
  },
  dmgMul(h) {
    return h.s.inRing ? 1.2 : 1;
  },
  avoid(h, p) {
    for (const o of h.s.holes) { const v = awayFrom(p, o.x, o.y, HOLE_R + 30, 0.5); if (v) return v; }
    // 舞の輪へ寄る
    let best = null, bd = 1e9;
    for (const r of h.s.rings) { const d = Math.hypot(r.x - p.x, r.y - p.y); if (d < bd) { bd = d; best = r; } }
    return best && bd > 30 ? [((best.x - p.x) / bd) * 0.2, ((best.y - p.y) / bd) * 0.2] : null;
  },
  ground(h, ctx) {
    const g = h.g, s = h.s;
    // 拍：小節の頭で 1、その後 0 へ
    const ph = (h.t % BAR) / BAR, beat = 1 - ((h.t % BEAT) / BEAT);
    for (const o of s.holes) {
      if (!g.inView(o, HOLE_R * 4)) continue;
      const k = Math.min(1, o.t / 1.2);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(softSprite('#2a1a0a'), o.x - HOLE_R * 2.2, o.y - HOLE_R * 2.2, HOLE_R * 4.4, HOLE_R * 4.4);
      ctx.globalAlpha = 1;
      const grd = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, HOLE_R * k);
      grd.addColorStop(0, '#000');
      grd.addColorStop(0.75, '#0a0604');
      grd.addColorStop(1, 'rgba(60,40,20,0.9)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(o.x, o.y, HOLE_R * k, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#8a6a40';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (const r of s.rings) {
      if (!g.inView(r, RING_R)) continue;
      const inside = (g.player.x - r.x) ** 2 + (g.player.y - r.y) ** 2 < RING_R * RING_R;
      ctx.globalAlpha = inside ? 0.5 : 0.25;
      ctx.drawImage(softSprite('#ffa040'), r.x - RING_R, r.y - RING_R, RING_R * 2, RING_R * 2);
      ctx.globalAlpha = 0.4 + 0.5 * beat;
      ctx.strokeStyle = '#ffc070';
      ctx.lineWidth = 2 + beat * 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, RING_R * (0.95 + 0.05 * beat), 0, TAU);
      ctx.stroke();
      // 小節の頭までの残り（縮んでいく内側の輪）
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#fff0c0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, RING_R * (1 - ph) + 4, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#ffe0a0';
      for (let i = 0; i < 8; i++) {
        const a = h.t * 0.9 + r.seed + (i / 8) * TAU;
        ctx.beginPath();
        ctx.arc(r.x + Math.cos(a) * RING_R * 0.78, r.y + Math.sin(a) * RING_R * 0.78, 3, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    for (const b of s.burst) {
      ctx.globalAlpha = 1 - b.t / 0.45;
      ctx.strokeStyle = '#ffc070';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.R * (0.3 + 0.7 * (b.t / 0.45)), 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },
};

export const G3 = { whirl: YUSHU, flood: UZAN, cauldron: SANKI, dance: CHUOU };
