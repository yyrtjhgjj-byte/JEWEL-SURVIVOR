// =====================================================================
//  ステージギミック：水晶柱 / 溶岩 / 吹雪 / 暗闇
// =====================================================================
import { TAU, rand } from './util.js';
import { pillarSprite, softSprite, starSprite } from './render.js';
import { audio } from './audio.js';
import { warn } from './enemies.js';

const CHUNK = 360;

// 座標から決まる乱数（同じ場所には毎回同じ地形）
function hashRng(cx, cy, salt) {
  let h = (cx * 374761393 + cy * 668265263 + salt * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
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
  }

  // ---------------------------------------------------------- 地形（チャンク単位）
  chunk(cx, cy) {
    const k = cx * 100003 + cy;
    let c = this.chunks.get(k);
    if (c) return c;
    c = [];
    const r = hashRng(cx, cy, this.kind === 'lava' ? 7 : 3);
    const ox = cx * CHUNK, oy = cy * CHUNK;
    if (this.kind === 'pillars') {
      const n = r() < 0.25 ? 0 : r() < 0.6 ? 1 : 2;
      for (let i = 0; i < n; i++) c.push({ x: ox + 40 + r() * (CHUNK - 80), y: oy + 40 + r() * (CHUNK - 80), r: 22 + r() * 22, seed: r() });
    } else if (this.kind === 'lava') {
      if (r() < 0.6) c.push({ x: ox + 70 + r() * (CHUNK - 140), y: oy + 70 + r() * (CHUNK - 140), r: 42 + r() * 36, seed: r() * TAU });
    }
    // 開始地点の近くには置かない
    for (let i = c.length - 1; i >= 0; i--) if (Math.hypot(c[i].x, c[i].y) < 130) c.splice(i, 1);
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
    if (this.kind !== 'pillars') return false;
    const list = this.around(x, y, this._b || (this._b = []));
    for (const o of list) if ((x - o.x) ** 2 + (y - o.y) ** 2 < o.r * o.r) return true;
    return false;
  }

  // 移動速度への補正
  speedMul() {
    return this.kind === 'blizzard' && this.storm ? 0.72 : 1;
  }

  // ---------------------------------------------------------- 更新
  update(dt) {
    const g = this.g, p = g.player;
    this.t += dt;
    if (this.kind === 'pillars') {
      this.collide(p, p.r);
      // 敵も柱を避ける（押し出し）
      for (const e of g.enemies) if (e.alive && !e.prop && !e.boss && !e.segment && g.inView(e, 120)) this.collide(e, e.r * 0.8);
      // 敵弾は柱で止まる
      for (const b of g.ebullets) if (this.blocks(b.x, b.y)) { b.life = 0; g.fx.burst(b.x, b.y, '#8ff0ff', 3, 80, 0.25, 6); }
    } else if (this.kind === 'lava') {
      this.lavaT -= dt;
      const list = this.around(p.x, p.y, this._c || (this._c = []));
      let inLava = false;
      for (const o of list) if ((p.x - o.x) ** 2 + (p.y - o.y) ** 2 < (o.r - 4) ** 2) inLava = true;
      if (inLava && this.lavaT <= 0) {
        this.lavaT = 0.4;
        g.hurtPlayer(6 * g.stageDmg, { ignoreIT: true, silent: true });
        g.fx.burst(p.x, p.y, '#ff6a3d', 4, 120, 0.3, 8);
      }
      // 噴火
      this.eruptT -= dt;
      if (this.eruptT <= 0) {
        this.eruptT = g.time > 300 ? 3.8 : 5;
        const n = g.time > 300 ? 4 : 3;
        for (let i = 0; i < n; i++) {
          const x = p.x + (i ? rand(-150, 150) : p.dirX * (p.moving ? 60 : 0));
          const y = p.y + (i ? rand(-150, 150) : p.dirY * (p.moving ? 60 : 0));
          warn(g, x, y, 55, 1.3, '#ff6a3d', (g2) => {
            g2.fx.burst(x, y, '#ff8a3d', 16, 260, 0.6, 14);
            g2.fx.ring(x, y, 8, 60, 0.35, '#ffb84a', 6);
            g2.fx.shake(3);
            audio.bomb();
            if (Math.hypot(g2.player.x - x, g2.player.y - y) < 55 + g2.player.r) g2.hurtPlayer(16 * g2.stageDmg);
            g2.aoe(x, y, 55, 300 * g2.hpScale(), null, { kb: 150 });
          });
        }
      }
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
      }
    } else if (this.kind === 'darkness') {
      this.riftT -= dt;
      if (this.riftT <= 0) {
        this.riftT = g.time > 360 ? 18 : 25;
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
    if (this.kind === 'darkness') {
      const R = g.feverT > 0 ? 205 : 175;
      const grd = ctx.createRadialGradient(p.x, p.y, R * 0.35, p.x, p.y, R);
      grd.addColorStop(0, 'rgba(2,1,6,0)');
      grd.addColorStop(0.7, 'rgba(2,1,6,0.75)');
      grd.addColorStop(1, 'rgba(2,1,6,0.96)');
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
    // 雪
    while (this.snow.length < 90) this.snow.push({ x: Math.random(), y: Math.random(), s: rand(1, 3), v: rand(0.3, 0.8) });
    const wx = Math.cos(this.wind), wy = Math.sin(this.wind);
    ctx.strokeStyle = `rgba(240,248,255,${0.8 * k})`;
    for (const f of this.snow) {
      f.x += (wx * 0.6 + 0.05) * f.v * 0.016 * 3;
      f.y += (wy * 0.6 + 0.4) * f.v * 0.016 * 3;
      if (f.x > 1.05) f.x -= 1.1; if (f.x < -0.05) f.x += 1.1;
      if (f.y > 1.05) f.y -= 1.1; if (f.y < -0.05) f.y += 1.1;
      ctx.lineWidth = f.s * dpr;
      ctx.beginPath();
      ctx.moveTo(f.x * CW, f.y * CH);
      ctx.lineTo(f.x * CW - wx * 10 * f.s * dpr, f.y * CH - (wy + 0.6) * 10 * f.s * dpr);
      ctx.stroke();
    }
    void g;
  }
}
