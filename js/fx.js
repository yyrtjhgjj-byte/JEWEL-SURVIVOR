// =====================================================================
//  エフェクト：パーティクル / ダメージすうじ / リング / カミナリ
// =====================================================================
import { TAU, rand, pick, RAINBOW, fmtShort } from './util.js';
import { starSprite, dotSprite } from './render.js';
import { save } from './save.js';

const MAX_PARTS = 500;
const MAX_TEXTS = 40;

export class FX {
  constructor() {
    this.parts = [];
    this.texts = [];
    this.rings = [];
    this.bolts = [];
    this.shakeMag = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.flash = 0;
    this.flashColor = '#fff';
  }

  // ----- パーティクル
  // kind: 'star' | 'dot' | 'conf' | 'smoke'
  add(x, y, vx, vy, life, size, color, kind = 'dot', extra) {
    if (this.parts.length >= MAX_PARTS) {
      // ふるいのを うわがき
      this.parts.shift();
    }
    const p = { x, y, vx, vy, life, max: life, size, color, kind, rot: rand(TAU), vr: rand(-8, 8), g: 0, drag: 0.92 };
    if (extra) Object.assign(p, extra);
    this.parts.push(p);
    return p;
  }

  burst(x, y, color, n = 10, speed = 160, life = 0.5, size = 10, kind = 'star') {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), s = rand(0.3, 1) * speed;
      this.add(x, y, Math.cos(a) * s, Math.sin(a) * s, life * rand(0.6, 1.2), size * rand(0.6, 1.2), color, kind);
    }
  }

  confetti(x, y, n = 30, speed = 300) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), s = rand(0.3, 1) * speed;
      this.add(x, y, Math.cos(a) * s, Math.sin(a) * s - 120, rand(0.9, 1.6), rand(4, 8), pick(RAINBOW), 'conf', { g: 420, drag: 0.96 });
    }
  }

  // くすみが キラキラに かわる（じょうか）演出
  purify(x, y, color, big = false) {
    const n = big ? 22 : 4;
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), s = rand(40, big ? 320 : 150);
      this.add(x, y, Math.cos(a) * s, Math.sin(a) * s - 30, rand(0.35, 0.7), rand(6, big ? 18 : 11), i % 3 === 0 ? '#ffffff' : color, 'star');
    }
    this.add(x, y, 0, -20, 0.35, big ? 60 : 22, '#b89ad8', 'smoke');
  }

  // ----- テキスト
  text(x, y, str, { color = '#fff', size = 16, stroke = 'rgba(0,0,0,0.75)', life = 0.7, vy = -60, crit = false, rainbow = false, pop = 1 } = {}) {
    if (!save.settings.dmgNum && !crit && !rainbow && typeof str === 'number') return;
    if (this.texts.length >= MAX_TEXTS) {
      // クリティカルじゃない ふるい すうじを すてる
      const idx = this.texts.findIndex((t) => !t.crit && !t.rainbow);
      if (idx >= 0) this.texts.splice(idx, 1);
      else return;
    }
    this.texts.push({
      x: x + rand(-6, 6), y, str: typeof str === 'number' ? fmtShort(str) : str,
      color, size, stroke, life, max: life, vy, crit, rainbow, pop,
    });
  }

  ring(x, y, r0, r1, life, color, width = 4, fill = false) {
    this.rings.push({ x, y, r0, r1, life, max: life, color, width, fill });
  }

  bolt(x0, y0, x1, y1, color = '#bff6ff', life = 0.22, width = 4) {
    const pts = [];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const j = i === 0 || i === n ? 0 : rand(-18, 18);
      pts.push([x0 + (x1 - x0) * t + j, y0 + (y1 - y0) * t + j * 0.3]);
    }
    this.bolts.push({ pts, life, max: life, color, width });
  }

  shake(mag) {
    if (!save.settings.shake) return;
    this.shakeMag = Math.min(24, Math.max(this.shakeMag, mag));
  }

  screenFlash(a = 0.6, color = '#fff') {
    this.flash = Math.max(this.flash, a);
    this.flashColor = color;
  }

  update(dt) {
    const ps = this.parts;
    let w = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      ps[w++] = p;
    }
    ps.length = w;

    const ts = this.texts;
    w = 0;
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      t.life -= dt;
      if (t.life <= 0) continue;
      t.y += t.vy * dt;
      t.vy *= Math.pow(0.9, dt * 60);
      ts[w++] = t;
    }
    ts.length = w;

    this.rings = this.rings.filter((r) => (r.life -= dt) > 0);
    this.bolts = this.bolts.filter((b) => (b.life -= dt) > 0);

    if (this.shakeMag > 0.1) {
      this.shakeX = rand(-1, 1) * this.shakeMag;
      this.shakeY = rand(-1, 1) * this.shakeMag;
      this.shakeMag *= Math.pow(0.86, dt * 60);
    } else {
      this.shakeX = this.shakeY = this.shakeMag = 0;
    }
    this.flash = Math.max(0, this.flash - dt * 2.5);
  }

  drawBelow(ctx) {
    // けむり（ふつう合成）
    for (const p of this.parts) {
      if (p.kind !== 'smoke') continue;
      const t = p.life / p.max;
      ctx.globalAlpha = t * 0.35;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.4 - t * 0.6), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  draw(ctx, time) {
    // リング
    for (const r of this.rings) {
      const t = 1 - r.life / r.max;
      const rad = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - t, 3));
      ctx.globalAlpha = Math.max(0, 1 - t);
      if (r.fill) {
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.arc(r.x, r.y, rad, 0, TAU);
        ctx.fill();
      } else {
        ctx.strokeStyle = r.color === 'rainbow' ? `hsl(${(time * 400) % 360},100%,65%)` : r.color;
        ctx.lineWidth = r.width * (1 - t * 0.6);
        ctx.beginPath();
        ctx.arc(r.x, r.y, rad, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // かさんごうせい
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bolts) {
      const t = b.life / b.max;
      ctx.globalAlpha = t;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.width * 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      b.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = b.width * 0.8;
      ctx.stroke();
    }
    for (const p of this.parts) {
      if (p.kind === 'smoke' || p.kind === 'conf') continue;
      const t = p.life / p.max;
      ctx.globalAlpha = Math.min(1, t * 1.6);
      const s = p.size * (p.kind === 'star' ? 0.6 + t * 0.6 : t);
      const col = p.color === 'rainbow' ? RAINBOW[((Math.floor(time * 20 + p.rot * 3) % RAINBOW.length) + RAINBOW.length) % RAINBOW.length] : p.color;
      const spr = p.kind === 'star' ? starSprite(col) : dotSprite(col);
      if (p.kind === 'star') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * 0.3);
        ctx.drawImage(spr, -s, -s, s * 2, s * 2);
        ctx.restore();
      } else {
        ctx.drawImage(spr, p.x - s, p.y - s, s * 2, s * 2);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    // 光の破片
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      if (p.kind !== 'conf') continue;
      const t = p.life / p.max;
      ctx.globalAlpha = Math.min(1, t * 2);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -0.8, p.size, 1.6 + Math.abs(Math.cos(p.rot * 2)));
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  drawTexts(ctx, time) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const t of this.texts) {
      const age = t.max - t.life;
      const popT = Math.min(1, age / 0.12);
      let sc = t.pop * (popT < 1 ? 0.4 + popT * 1.0 : 1.4 - Math.min(0.4, (age - 0.12) * 2));
      const alpha = Math.min(1, t.life / 0.25);
      ctx.globalAlpha = alpha;
      const size = Math.round(t.size * sc);
      if (size < 2) continue;
      ctx.font = `${t.crit || t.rainbow ? 'italic ' : ''}700 ${size}px "Rajdhani", "Zen Kaku Gothic New", sans-serif`;
      ctx.lineWidth = Math.max(2, size * 0.18);
      ctx.strokeStyle = t.stroke;
      ctx.strokeText(t.str, t.x, t.y);
      if (t.rainbow) {
        ctx.fillStyle = `hsl(${(time * 500 + t.x) % 360},100%,62%)`;
      } else ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
