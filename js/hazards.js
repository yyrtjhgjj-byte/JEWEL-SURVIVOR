// =====================================================================
//  ステージギミック：水晶柱 / 溶岩 / 吹雪 / 暗闇 / 泡の噴出口 / 歪んだ門 / お茶会の席
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
    this.boostT = 0; // 泡の噴出口：入ると少しの間だけ速く泳げる
    this.portalCd = 0; // 歪んだ門：続けて跳ばないように
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
    } else if (this.kind === 'teatime') {
      if (r() < 0.3) c.push({ x: ox + 70 + r() * (CHUNK - 140), y: oy + 70 + r() * (CHUNK - 140), r: 60, seed: r() * TAU });
    } else if (this.kind === 'portals') {
      if (r() < 0.4) c.push({ x: ox + 60 + r() * (CHUNK - 120), y: oy + 60 + r() * (CHUNK - 120), r: 26, seed: r() * TAU });
    } else if (this.kind === 'bubbles') {
      if (r() < 0.55) c.push({ x: ox + 60 + r() * (CHUNK - 120), y: oy + 60 + r() * (CHUNK - 120), r: 30 + r() * 10, seed: r() * TAU });
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

  // (x, y) から角度 a へ伸びる長さ len の線が、最初に柱に当たるまでの長さ（ボスのレーザーを柱で遮る）
  rayCut(x, y, a, len) {
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

  // 移動速度への補正
  speedMul() {
    if (this.kind === 'bubbles' && this.boostT > 0) return 1.35;
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
    } else if (this.kind === 'teatime') {
      // お茶会の席：近く（半径 60）にいる間、毎秒 2.5 回復
      this.resting = false;
      for (const o of this.around(p.x, p.y, this._c || (this._c = []))) {
        if ((p.x - o.x) ** 2 + (p.y - o.y) ** 2 > o.r * o.r) continue;
        this.resting = true;
        g.heal(2.5 * dt, true);
        if (Math.random() < 0.1) g.fx.add(p.x + rand(-10, 10), p.y - 10, 0, -30, 0.8, 5, '#ffe9c0', 'star');
        break;
      }
    } else if (this.kind === 'portals') {
      this.portalCd -= dt;
      if (this.portalCd <= 0) {
        for (const o of this.around(p.x, p.y, this._c || (this._c = []))) {
          if ((p.x - o.x) ** 2 + (p.y - o.y) ** 2 > o.r * o.r) continue;
          // 進んでいる向き（止まっていれば門の中心から外向き）へ 260 跳ぶ。着地の直後は少しだけ無敵
          let dx = p.moving ? p.dirX : p.x - o.x, dy = p.moving ? p.dirY : p.y - o.y;
          if (Math.hypot(dx, dy) < 0.01) { const a = rand(TAU); dx = Math.cos(a); dy = Math.sin(a); }
          const d = Math.hypot(dx, dy);
          g.fx.burst(p.x, p.y, '#3fe08a', 14, 200, 0.5, 10);
          p.x = o.x + (dx / d) * 260;
          p.y = o.y + (dy / d) * 260;
          p.iT = Math.max(p.iT, 0.6);
          g.fx.ring(p.x, p.y, 6, 60, 0.4, '#3fe08a', 6);
          audio.whoosh();
          this.portalCd = 1.5;
          break;
        }
      }
    } else if (this.kind === 'bubbles') {
      this.boostT -= dt;
      for (const o of this.around(p.x, p.y, this._c || (this._c = []))) {
        if ((p.x - o.x) ** 2 + (p.y - o.y) ** 2 > o.r * o.r) continue;
        if (this.boostT <= 0) { g.fx.burst(p.x, p.y, '#bfe8ff', 10, 160, 0.5, 8); audio.pickup(); }
        this.boostT = 1.6;
      }
      if (this.boostT > 0 && p.moving && Math.random() < 0.4) g.fx.add(p.x + rand(-8, 8), p.y + rand(-8, 8), 0, -40, 0.6, 5, '#bfe8ff', 'dot');
    } else if (this.kind === 'lava') {
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
            audio.bomb();
            if (Math.hypot(g2.player.x - x, g2.player.y - y) < 55 + g2.player.r) g2.hurtPlayer(32 * g2.stageDmg); // 噴火（2 倍）
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
    if (this.kind === 'teatime') {
      for (const o of this.inView(p.x, p.y, this._v || (this._v = []))) {
        // 回復の範囲（うすい円）
        ctx.strokeStyle = 'rgba(255,233,192,0.18)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        // テーブル
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
        // カップとポット
        ctx.fillStyle = '#c8b8d8';
        ctx.beginPath();
        ctx.ellipse(o.x - 9, o.y - 4, 5, 3, 0, 0, TAU);
        ctx.ellipse(o.x + 10, o.y + 2, 5, 3, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#e8c860';
        ctx.beginPath();
        ctx.arc(o.x + 2, o.y - 7, 5, 0, TAU);
        ctx.fill();
        // 湯気
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 2; i++) {
          const k = (this.t * 0.6 + i * 0.5 + o.seed) % 1;
          ctx.globalAlpha = 1 - k;
          ctx.beginPath();
          ctx.moveTo(o.x + 2 + i * 3, o.y - 12 - k * 16);
          ctx.quadraticCurveTo(o.x + 6 + i * 3, o.y - 18 - k * 16, o.x + 2 + i * 3, o.y - 24 - k * 16);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      return;
    }
    if (this.kind === 'portals') {
      for (const o of this.inView(p.x, p.y, this._v || (this._v = []))) {
        const grd = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        grd.addColorStop(0, 'rgba(10,30,20,0.9)');
        grd.addColorStop(0.75, 'rgba(40,200,120,0.3)');
        grd.addColorStop(1, 'rgba(40,200,120,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, TAU);
        ctx.fill();
        // ねじれた縁（回る）
        ctx.strokeStyle = 'rgba(120,255,180,0.7)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const a = this.t * 1.5 + o.seed + (i / 3) * TAU;
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.r * 0.85, a, a + 1.2);
          ctx.stroke();
        }
      }
      return;
    }
    if (this.kind === 'bubbles') {
      for (const o of this.inView(p.x, p.y, this._v || (this._v = []))) {
        const grd = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        grd.addColorStop(0, 'rgba(120,210,255,0.35)');
        grd.addColorStop(0.7, 'rgba(40,120,200,0.18)');
        grd.addColorStop(1, 'rgba(40,120,200,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(150,220,255,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(o.x, o.y, o.r * 0.45, o.r * 0.22, 0, 0, TAU);
        ctx.stroke();
      }
      return;
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
    if (this.kind === 'bubbles') {
      // 噴出口から立ちのぼる泡
      const p = this.g.player;
      ctx.strokeStyle = 'rgba(190,235,255,0.6)';
      ctx.lineWidth = 1.2;
      for (const o of this.inView(p.x, p.y, this._v || (this._v = []))) {
        for (let i = 0; i < 6; i++) {
          const k = ((this.t * 0.7 + i / 6 + o.seed) % 1);
          const x = o.x + Math.sin(o.seed * 5 + i * 2.1 + this.t * 2) * o.r * 0.45;
          const y = o.y - k * 70;
          ctx.globalAlpha = 1 - k;
          ctx.beginPath();
          ctx.arc(x, y, 2 + (i % 3) * 1.5, 0, TAU);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
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
