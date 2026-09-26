// =====================================================================
//  ぶきの うごき
// =====================================================================
import { WEAPONS } from './data.js';
import { TAU, rand, randi, chance, ease } from './util.js';
import { gemSprite, starSprite, softSprite, itemSprite, moonSprite, sparkle } from './render.js';
import { audio } from './audio.js';

export function weaponStats(g, w) {
  const def = WEAPONS[w.id];
  const s = { ...def.base };
  for (let i = 0; i < w.level - 1 && i < def.levels.length; i++) {
    const d = def.levels[i];
    for (const k in d) if (k !== 't') s[k] = (s[k] || 0) + d[k];
  }
  const P = g.stats;
  const lb = w.lb || {}; // リミットブレイク
  return {
    dmg: s.dmg * P.might * (def.dmgMul || 1) * (w.evolved ? def.evo.mul || 1 : 1 + (def.lowBoost || 0) * Math.max(0, 8 - w.level) / 7) * (1 + (lb.dmg || 0)),
    cd: Math.max(0.08, s.cd * P.cooldown * (1 - (lb.cd || 0))),
    amount: (s.amount || 0) + P.amount + (lb.amount || 0) + (g.hasArt && g.hasArt('crown') && w.id === g.startWeapon ? 3 : 0), // 秘宝「職人の王冠」
    speed: (s.speed || 1) * P.speed * (1 + (lb.speed || 0)),
    area: (s.area || 1) * P.area * (1 + (lb.area || 0)),
    pierce: s.pierce || 0,
    duration: (s.duration || 0) * P.duration * (1 + (lb.dur || 0)),
    life: (s.life || 1) * P.duration * (1 + (lb.dur || 0)),
    knock: s.knock || 1,
    bounce: s.bounce || 0,
    charm: s.charm || 0,
  };
}

// 射撃を すこしずつ ずらして「ダダダッ」とうつ
function burst(w, n, gap, fn) {
  w.bq = (w.bq || []);
  for (let i = 0; i < n; i++) w.bq.push({ t: i * gap, i, fn });
}
function runBurst(w, dt) {
  if (!w.bq || !w.bq.length) return;
  for (const b of w.bq) b.t -= dt;
  while (w.bq.length && w.bq[0].t <= 0) {
    const b = w.bq.shift();
    b.fn(b.i);
  }
}

function aimAt(g, x, y, i) {
  const targets = g.nearestEnemies(x, y, 5, 700);
  if (targets.length) {
    const e = targets[i % targets.length];
    return Math.atan2(e.y - y, e.x - x);
  }
  return Math.atan2(g.player.dirY, g.player.dirX);
}

function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + dx * t - px, cy = ay + dy * t - py;
  return cx * cx + cy * cy;
}

const Q = []; // 使いまわしの クエリ配列

export const LOGIC = {
  // ------------------------------------------------------------- ルビー
  ruby: {
    update(g, w, s, dt) {
      runBurst(w, dt);
      w.t -= dt;
      if (w.t > 0) return;
      const evo = w.evolved;
      w.t = evo ? Math.max(0.2, s.cd * 0.55) : s.cd;
      const n = s.amount + (evo ? 1 : 0);
      const p = g.player;
      burst(w, n, evo ? 0.03 : 0.07, (i) => {
        let a = aimAt(g, p.x, p.y, i);
        if (evo) a += (i - (n - 1) / 2) * 0.12;
        const spd = 480 * s.speed * (evo ? 1.15 : 1);
        const pinch = evo && p.hp < p.maxHp * 0.5 ? 2 : 1;
        g.addProj({
          x: p.x, y: p.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
          r: 7 * s.area * (evo ? 1.3 : 1), dmg: s.dmg * pinch * (evo ? 1.5 : 1), pierce: s.pierce + (evo ? 2 : 0),
          life: 1.4 * s.life / 1.4, wid: 'ruby', sprite: gemSprite('ruby', evo ? 18 : 14), rotToVel: true,
          trail: '#ff2d55', explode: evo ? 48 * s.area : 0, knock: 90,
        });
        audio.shoot();
      });
    },
  },

  // ------------------------------------------------------------- サファイア
  sapphire: {
    update(g, w, s, dt) {
      const evo = w.evolved;
      w.ang = (w.ang || 0) + dt * 3.2 * s.speed;
      if (evo) {
        w.on = true;
        w.scale = Math.min(1, (w.scale || 0) + dt * 3);
      } else {
        w.t -= dt;
        if (w.t <= 0) {
          w.on = !w.on;
          w.t = w.on ? Math.max(1, s.duration) : s.cd;
          if (w.on) { audio.whoosh(); w.scale = 0; }
        }
        w.scale = w.on ? Math.min(1, (w.scale || 0) + dt * 5) : Math.max(0, (w.scale || 0) - dt * 5);
      }
      if (!w.on && !(w.scale > 0)) return;
      const p = g.player;
      const orbs = this.orbs(w, s, p);
      // ともだちも たまを うって てつだう
      w.st = (w.st || 0) - dt;
      if (w.on && w.st <= 0) {
        w.st = 1.6 * g.stats.cooldown;
        for (let k = 0; k < Math.min(orbs.length, 3); k++) {
          const o = orbs[k];
          const e = g.nearestEnemies(o.x, o.y, 1, 320)[0];
          if (!e) break;
          const a = Math.atan2(e.y - o.y, e.x - o.x);
          const spd = 420 * s.speed;
          g.addProj({
            x: o.x, y: o.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: 6 * s.area, dmg: s.dmg * 0.7, pierce: 0,
            life: 0.9, wid: 'sapphire', sprite: gemSprite('sapphire', 10), rotToVel: true, trail: '#8fb4ff', knock: 40,
          });
        }
        audio.shoot();
      }
      const hitR = 13 * s.area * (evo ? 1.3 : 1);
      const dmg = s.dmg * (evo ? 1.5 : 1);
      for (const o of orbs) {
        g.grid.query(o.x, o.y, hitR + 30, Q);
        for (const e of Q) {
          if (!e.alive) continue;
          const rr = hitR + e.r;
          const dx = e.x - o.x, dy = e.y - o.y;
          if (dx * dx + dy * dy > rr * rr) continue;
          if ((e.hitT.sapphire || 0) > g.time) continue;
          e.hitT.sapphire = g.time + 0.45;
          const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
          g.damage(e, dmg, { wid: 'sapphire', kx: (e.x - p.x) / d, ky: (e.y - p.y) / d, kb: 120 });
        }
      }
    },
    orbs(w, s, p) {
      const out = [];
      const sc = ease.outBack(Math.min(1, w.scale || 0));
      // こきゅうするように ひろがったり ちぢんだり
      const breathe = 1 + 0.55 * Math.sin((w.ang || 0) * 0.55);
      const R = 62 * s.area * sc * breathe;
      const n = s.amount;
      for (let k = 0; k < n; k++) {
        const a = w.ang + (k / n) * TAU;
        out.push({ x: p.x + Math.cos(a) * R, y: p.y + Math.sin(a) * R, a });
      }
      if (w.evolved) {
        const R2 = 62 * s.area * sc * 1.9;
        for (let k = 0; k < n; k++) {
          const a = -w.ang * 0.8 + (k / n) * TAU;
          out.push({ x: p.x + Math.cos(a) * R2, y: p.y + Math.sin(a) * R2, a });
        }
      }
      return out;
    },
    draw(g, w, s, ctx) {
      if (!(w.scale > 0)) return;
      const p = g.player;
      const orbs = this.orbs(w, s, p);
      const size = 22 * s.area * (w.evolved ? 1.25 : 1);
      const spr = gemSprite('sapphire', 22);
      ctx.globalCompositeOperation = 'lighter';
      const glow = starSprite('#6fa0ff');
      for (const o of orbs) ctx.drawImage(glow, o.x - size, o.y - size, size * 2, size * 2);
      ctx.globalCompositeOperation = 'source-over';
      for (const o of orbs) {
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.a + Math.PI / 2);
        const L = spr.logical * size / 22;
        ctx.drawImage(spr, -L / 2, -L / 2, L, L);
        ctx.restore();
      }
      if (Math.random() < 0.5) {
        const o = orbs[randi(0, orbs.length - 1)];
        g.fx.add(o.x, o.y, rand(-20, 20), rand(-20, 20), 0.35, 7, '#9fc0ff', 'star');
      }
    },
  },

  // ------------------------------------------------------------- ガーネット
  garnet: {
    update(g, w, s, dt) {
      runBurst(w, dt);
      const p = g.player;
      if (w.evolved) {
        w.t -= dt;
        while (w.t <= 0) {
          w.t += Math.max(0.12, 0.42 / (1 + s.amount * 0.25)) * g.stats.cooldown;
          const a = rand(TAU), d = rand(30, 250);
          const tx = p.x + Math.cos(a) * d, ty = p.y + Math.sin(a) * d;
          g.addProj({
            x: tx, y: ty - 340, tx, ty, fall: 0.38, ft: 0, r: 0, dmg: 0, life: 1, wid: 'garnet',
            sprite: gemSprite('garnet', 24, 'heart'), spin: 4,
            land: (g2, pr) => {
              g2.aoe(pr.tx, pr.ty, 56 * s.area, s.dmg * 1.9, 'garnet', { heal: 0.5, kb: 80 });
              g2.fx.burst(pr.tx, pr.ty, '#ff6fa8', 6, 140, 0.4, 10);
              g2.fx.ring(pr.tx, pr.ty, 8, 52 * s.area, 0.3, '#ff9cc6', 4);
            },
          });
        }
        return;
      }
      w.t -= dt;
      if (w.t > 0) return;
      w.t = s.cd;
      burst(w, s.amount, 0.09, () => {
        const vx = rand(-170, 170) + p.face * 40;
        g.addProj({
          x: p.x, y: p.y, vx, vy: -rand(430, 530) * Math.sqrt(s.speed), gravity: 900,
          r: 12 * s.area, dmg: s.dmg, pierce: s.pierce, life: 2.4, wid: 'garnet',
          sprite: gemSprite('garnet', 22, 'heart'), size: 22 * s.area, spin: vx > 0 ? 6 : -6, heal: 0.4, knock: 60,
        });
        audio.whoosh();
      });
    },
  },

  // ------------------------------------------------------------- ラブラドライト
  labradorite: {
    update(g, w, s, dt) {
      runBurst(w, dt);
      w.t -= dt;
      if (w.t > 0) return;
      w.t = s.cd;
      const evo = w.evolved;
      const n = s.amount + (evo ? 1 : 0);
      burst(w, n, 0.1, () => {
        const e = g.randomEnemyInView();
        if (!e) return;
        this.strike(g, s, e, evo);
      });
    },
    strike(g, s, e, evo) {
      const R = 38 * s.area;
      g.fx.bolt(e.x + rand(-40, 40), e.y - 420, e.x, e.y, '#7fe8ff', 0.25, 5);
      g.fx.ring(e.x, e.y, 6, R * 1.3, 0.3, '#bff6ff', 5);
      g.fx.burst(e.x, e.y, '#9ff0ff', 8, 200, 0.4, 10);
      g.fx.shake(2);
      audio.thunder();
      const x = e.x, y = e.y;
      g.aoe(x, y, R, s.dmg, 'labradorite', { kb: 40 });
      if (evo) {
        // れんさ カミナリ
        let cx = x, cy = y;
        const hit = new Set([e]);
        let dmg = s.dmg;
        for (let k = 0; k < 6; k++) {
          const nx = g.nearestEnemies(cx, cy, 1, 190, hit)[0];
          if (!nx) break;
          hit.add(nx);
          dmg *= 0.88;
          g.fx.bolt(cx, cy, nx.x, nx.y, '#c9a4ff', 0.25, 3.5);
          g.fx.burst(nx.x, nx.y, '#d8c4ff', 5, 150, 0.35, 8);
          g.damage(nx, dmg, { wid: 'labradorite' });
          cx = nx.x; cy = nx.y;
        }
      }
    },
  },

  // ------------------------------------------------------------- オパール
  opal: {
    update(g, w, s, dt) {
      const evo = w.evolved;
      w.ang = (w.ang || 0) + dt * 2.4 * s.speed;
      if (evo) {
        w.on = true;
        w.scale = Math.min(1, (w.scale || 0) + dt * 3);
      } else {
        w.t -= dt;
        if (w.t <= 0) {
          w.on = !w.on;
          w.t = w.on ? Math.max(0.8, s.duration) : s.cd;
          if (w.on) { audio.miracle(); w.scale = 0; }
        }
        w.scale = w.on ? Math.min(1, (w.scale || 0) + dt * 4) : Math.max(0, (w.scale || 0) - dt * 4);
      }
      if (!(w.scale > 0.1)) return;
      const p = g.player;
      const L = 175 * s.area * w.scale;
      const W = 12 * s.area;
      const n = s.amount + (evo ? 1 : 0);
      const mir = (evo ? 0.18 : 0.05) * g.stats.luck;
      g.grid.query(p.x, p.y, L + 30, Q);
      for (let k = 0; k < n; k++) {
        const a = w.ang + (k / n) * TAU;
        const bx = p.x + Math.cos(a) * L, by = p.y + Math.sin(a) * L;
        for (const e of Q) {
          if (!e.alive) continue;
          const rr = W + e.r;
          if (segDist2(e.x, e.y, p.x, p.y, bx, by) > rr * rr) continue;
          if ((e.hitT.opal || 0) > g.time) continue;
          e.hitT.opal = g.time + 0.2;
          const miracle = chance(mir);
          g.damage(e, s.dmg * (miracle ? 10 : 1), { wid: 'opal', miracle, kb: 20, kx: Math.cos(a + 1.57), ky: Math.sin(a + 1.57) });
        }
      }
    },
    draw(g, w, s, ctx) {
      if (!(w.scale > 0.05)) return;
      const p = g.player;
      const L = 175 * s.area * w.scale;
      const W = 12 * s.area * (0.85 + 0.15 * Math.sin(g.time * 30));
      const n = s.amount + (w.evolved ? 1 : 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (let k = 0; k < n; k++) {
        const a = w.ang + (k / n) * TAU;
        const bx = p.x + Math.cos(a) * L, by = p.y + Math.sin(a) * L;
        const grd = ctx.createLinearGradient(p.x, p.y, bx, by);
        const h = (g.time * 300 + k * 60) % 360;
        for (let i = 0; i <= 6; i++) grd.addColorStop(i / 6, `hsla(${(h + i * 55) % 360},95%,62%,${0.32 - i * 0.03})`);
        // うすい グロー
        ctx.strokeStyle = grd;
        ctx.lineWidth = W * 1.1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(bx, by);
        ctx.stroke();
        // 細い芯
        const core = ctx.createLinearGradient(p.x, p.y, bx, by);
        for (let i = 0; i <= 4; i++) core.addColorStop(i / 4, `hsla(${(h + i * 80) % 360},100%,75%,${0.75 - i * 0.1})`);
        ctx.strokeStyle = core;
        ctx.lineWidth = 2.2;
        ctx.stroke();
        const st = starSprite('#ffffff');
        ctx.globalAlpha = 0.7;
        ctx.drawImage(st, bx - 11, by - 11, 22, 22);
        ctx.globalAlpha = 1;
        if (Math.random() < 0.15) g.fx.add(bx, by, rand(-40, 40), rand(-40, 40), 0.35, 6, 'rainbow', 'star');
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  },

  // ------------------------------------------------------------- コハク
  amber: {
    update(g, w, s, dt) {
      runBurst(w, dt);
      w.t -= dt;
      if (w.t > 0) return;
      const evo = w.evolved;
      w.t = evo ? s.cd * 0.75 : s.cd;
      const n = s.amount + (evo ? 2 : 0);
      const p = g.player;
      burst(w, n, 0.06, () => {
        const e = g.randomEnemyNear(p.x, p.y, 380);
        let tx, ty;
        if (e) { tx = e.x + rand(-10, 10); ty = e.y + rand(-10, 10); }
        else { const a = rand(TAU), d = rand(60, 250); tx = p.x + Math.cos(a) * d; ty = p.y + Math.sin(a) * d; }
        g.addProj({
          x: tx, y: ty - 360, tx, ty, fall: 0.4, ft: 0, r: 0, dmg: 0, life: 1, wid: 'amber',
          sprite: itemSprite('bigcoin'), size: 34 * Math.sqrt(s.area), spin: 0, coinFlip: true,
          land: (g2, pr) => {
            const R = 44 * s.area;
            g2.aoe(pr.tx, pr.ty, R, s.dmg, 'amber', { kb: 60 });
            g2.fx.burst(pr.tx, pr.ty, '#ffd24a', 7, 180, 0.45, 10);
            g2.fx.ring(pr.tx, pr.ty, 6, R, 0.28, '#ffe07a', 5);
            audio.coin();
            if (evo && chance(0.025 * g2.stats.luck)) g2.jackpot(pr.tx, pr.ty);
          },
        });
      });
    },
  },

  // ------------------------------------------------------------- エンジェライト
  angelite: {
    update(g, w, s, dt) {
      const evo = w.evolved;
      const p = g.player;
      const R = 62 * s.area * (evo ? 1.5 : 1);
      w.R = R;
      // 毎秒の回復量：Lv1 0.75 〜 Lv8 1.8、進化後 3.0
      g.heal((evo ? 3.0 : 0.6 + w.level * 0.15) * dt, true);
      w.t -= dt;
      if (w.t > 0) {
        if (evo) {
          g.grid.query(p.x, p.y, R + 30, Q);
          for (const e of Q) if (e.alive && !e.boss && Math.hypot(e.x - p.x, e.y - p.y) < R + e.r) { e.slowT = 0.2; e.slowMul = 0.55; }
        }
        return;
      }
      w.t = s.cd;
      w.pulse = 1;
      g.grid.query(p.x, p.y, R + 30, Q);
      for (const e of Q) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d > R + e.r) continue;
        if (evo && !e.boss && !e.prop && e.hp < e.maxHp * 0.18) {
          g.fx.text(e.x, e.y - 14, 'PURIFY', { color: '#fff6c9', size: 12, stroke: 'rgba(0,0,0,0.7)', life: 0.6 });
          g.damage(e, e.hp + 1, { wid: 'angelite', silent: true });
          continue;
        }
        g.damage(e, s.dmg, { wid: 'angelite', kx: (e.x - p.x) / (d || 1), ky: (e.y - p.y) / (d || 1), kb: 50 * s.knock });
      }
    },
    draw(g, w, s, ctx) {
      const p = g.player;
      const R = w.R || 60;
      w.pulse = Math.max(0, (w.pulse || 0) - 0.06);
      const rr = R * (1 + (w.pulse || 0) * 0.06);
      const grd = ctx.createRadialGradient(p.x, p.y, rr * 0.2, p.x, p.y, rr);
      grd.addColorStop(0, 'rgba(200,235,255,0.05)');
      grd.addColorStop(0.75, w.evolved ? 'rgba(255,240,180,0.22)' : 'rgba(140,200,255,0.2)');
      grd.addColorStop(1, w.evolved ? 'rgba(255,230,140,0.5)' : 'rgba(140,200,255,0.45)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rr, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = w.evolved ? 'rgba(255,230,150,0.8)' : 'rgba(170,220,255,0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = -g.time * 30;
      ctx.stroke();
      ctx.setLineDash([]);
      if (Math.random() < 0.35) {
        const a = rand(TAU), d = rand(rr);
        g.fx.add(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 0, -40, 0.7, 6, w.evolved ? '#ffe9a0' : '#cfeaff', 'star');
      }
    },
  },

  // ------------------------------------------------------------- ダイヤ
  diamond: {
    update(g, w, s, dt) {
      const p = g.player;
      if (w.evolved) {
        w.t -= dt;
        w.ang = (w.ang || 0) + dt * 5;
        while (w.t <= 0) {
          w.t += 0.13 * g.stats.cooldown;
          const arms = 2;
          for (let k = 0; k < arms; k++) this.shard(g, s, p, w.ang + (k / arms) * TAU, true);
          audio.shoot();
        }
        return;
      }
      w.t -= dt;
      if (w.t > 0) return;
      w.t = s.cd;
      const n = s.amount;
      const off = rand(TAU);
      for (let k = 0; k < n; k++) this.shard(g, s, p, off + (k / n) * TAU, false);
      g.fx.ring(p.x, p.y, 5, 40, 0.25, '#e6fbff', 3);
      audio.crit();
    },
    shard(g, s, p, a, evo) {
      const spd = 420 * s.speed;
      g.addProj({
        x: p.x, y: p.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: 7 * s.area, dmg: s.dmg * (evo ? 1.7 : 1),
        pierce: s.pierce + (evo ? 1 : 0), life: s.life * (evo ? 1.4 : 1), wid: 'diamond', sprite: gemSprite('diamond', 12),
        rotToVel: true, trail: '#dff8ff', forceCrit: evo, knock: 50,
      });
    },
  },

  // ------------------------------------------------------------- エメラルド
  emerald: {
    update(g, w, s, dt) {
      runBurst(w, dt);
      w.t -= dt;
      if (w.t > 0) return;
      w.t = s.cd;
      const evo = w.evolved;
      const p = g.player;
      burst(w, s.amount, 0.12, () => {
        const e = g.randomEnemyNear(p.x, p.y, 260);
        let x, y;
        if (e) { x = e.x; y = e.y; } else { const a = rand(TAU), d = rand(40, 160); x = p.x + Math.cos(a) * d; y = p.y + Math.sin(a) * d; }
        const R = 48 * s.area * (evo ? 1.5 : 1);
        g.addArea({
          x, y, r: R, life: s.duration * (evo ? 1.3 : 1), tick: 0.35, dmg: s.dmg * (evo ? 1.3 : 1), wid: 'emerald',
          slow: evo ? 0.65 : 0, clover: evo, kind: 'clover', seed: rand(TAU),
        });
        g.fx.burst(x, y, '#5dffb0', 8, 120, 0.5, 10);
      });
    },
  },

  // ------------------------------------------------------------- ロードクロサイト
  rhodochrosite: {
    update(g, w, s, dt) {
      const evo = w.evolved;
      const p = g.player;
      if (evo) w.on = true;
      else {
        w.t -= dt;
        if (w.t <= 0) {
          w.on = !w.on;
          w.t = w.on ? Math.max(0.5, s.duration) : s.cd;
        }
      }
      if (!w.on) return;
      w.ft = (w.ft || 0) - dt;
      // 炎はすべて前方（進行方向）へ。弾数が増えると扇が広がり、進化すると途切れず噴き出して射程が伸びる
      const base = Math.atan2(p.dirY, p.dirX);
      const n = Math.max(1, s.amount) + (evo ? 1 : 0);
      // 低レベル時は射程を補正（Lv1 で +60%、Lv8 で補正なし）。進化後は射程 1.5 倍
      const reach = evo ? 1.5 : 1 + 0.6 * Math.max(0, 8 - w.level) / 7;
      if (evo) {
        // 炎の先に燃え続ける火だまりを残す
        w.trail = (w.trail || 0) - dt;
        if (w.trail <= 0) {
          w.trail = 0.22;
          const d = 270 * s.speed * 0.4 * s.area * reach * 0.8;
          g.addArea({ x: p.x + Math.cos(base) * d, y: p.y + Math.sin(base) * d, r: 30 * s.area, life: 1.6, tick: 0.3, dmg: s.dmg * 0.8, wid: 'rhodochrosite', kind: 'fire' });
        }
      }
      while (w.ft <= 0) {
        w.ft += 0.085;
        const dirs = [];
        for (let k = 0; k < n; k++) dirs.push(base + (k - (n - 1) / 2) * 0.24);
        for (const a0 of dirs) {
          const a = a0 + rand(-0.28, 0.28);
          const spd = 270 * s.speed * rand(0.85, 1.15);
          g.addProj({
            x: p.x + Math.cos(a) * 10, y: p.y + Math.sin(a) * 10, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            r: 12 * s.area, dmg: s.dmg * 1.6 * (evo ? 1.2 : 1), pierce: 99, life: 0.4 * s.area * reach, wid: 'rhodochrosite', flame: true, knock: 20,
            fa: n > 1 ? 1.25 / n + 0.2 : 1, // 炎が重なって白飛びしないよう、本数が多いほど 1 本ずつを薄く
            grow: 1.8,
          });
        }
      }
    },
  },

  // ------------------------------------------------------------- カイヤナイト
  kyanite: {
    update(g, w, s, dt) {
      runBurst(w, dt);
      w.t -= dt;
      if (w.t > 0) return;
      w.t = s.cd;
      const p = g.player;
      const targets = g.strongestEnemies(p.x, p.y, s.amount, 480);
      burst(w, s.amount, 0.12, (i) => {
        let a;
        const e = targets[i % Math.max(1, targets.length)];
        if (e && e.alive) a = Math.atan2(e.y - p.y, e.x - p.x);
        else a = Math.atan2(p.dirY, p.dirX) + rand(-0.3, 0.3);
        this.lance(g, s, p.x, p.y, a, 1, w.evolved);
        audio.whoosh();
      });
    },
    lance(g, s, x, y, a, mul, split, hit) {
      const spd = 650 * s.speed;
      g.addProj({
        hit: hit ? new Set(hit) : undefined, // 分裂した槍が元の敵に当たり直さないように
        x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: 12 * s.area * (mul < 1 ? 0.7 : 1), dmg: s.dmg * mul, pierce: 999,
        life: 1.3, wid: 'kyanite', sprite: gemSprite('kyanite', mul < 1 ? 20 : 30, 'long'), rotToVel: true, rotOff: Math.PI / 2,
        trail: '#6f8cff', knock: 220,
        onHit: split ? (g2, pr, e) => {
          if (pr.split) return;
          pr.split = true;
          for (let k = 0; k < 4; k++) this.lance(g2, s, e.x, e.y, a + (k / 4) * TAU + 0.4, 0.75, false, [e]);
          g2.fx.ring(e.x, e.y, 5, 60, 0.3, '#9fb8ff', 5);
        } : null,
      });
    },
  },

  // ------------------------------------------------------------- アクアマリン
  aquamarine: {
    update(g, w, s, dt) {
      runBurst(w, dt);
      w.waves = w.waves || [];
      const evo = w.evolved;
      const p = g.player;
      w.t -= dt;
      if (w.t <= 0) {
        w.t = s.cd;
        const n = s.amount + (evo ? 1 : 0);
        burst(w, n, 0.25, () => {
          w.waves.push({ t: 0, T: 0.6, R: 135 * s.area * (evo ? 1.4 : 1), hit: new Set() });
          audio.splash();
        });
      }
      for (const wv of w.waves) {
        wv.t += dt;
        const r = wv.R * ease.outCubic(Math.min(1, wv.t / wv.T));
        wv.r = r;
        g.grid.query(p.x, p.y, r + 40, Q);
        for (const e of Q) {
          if (!e.alive || wv.hit.has(e)) continue;
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d > r + e.r) continue;
          wv.hit.add(e);
          g.damage(e, s.dmg, { wid: 'aquamarine', kx: (e.x - p.x) / (d || 1), ky: (e.y - p.y) / (d || 1), kb: 160 * s.knock });
          if (evo && !e.boss) e.frozenT = 1.2;
        }
        if (Math.random() < 0.6) {
          const a = rand(TAU);
          g.fx.add(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 0, -30, 0.5, 6, '#b8fffb', 'dot');
        }
      }
      w.waves = w.waves.filter((wv) => wv.t < wv.T + 0.15);
    },
    draw(g, w, s, ctx) {
      if (!w.waves) return;
      const p = g.player;
      for (const wv of w.waves) {
        const t = Math.min(1, wv.t / (wv.T + 0.15));
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = w.evolved ? '#3f8cff' : '#3fe0da';
        ctx.lineWidth = 14 * (1 - t * 0.5);
        ctx.beginPath();
        ctx.arc(p.x, p.y, wv.r || 1, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = '#e6fffe';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
  },

  // ------------------------------------------------------------- アレキサンドライト
  alexandrite: {
    update(g, w, s, dt) {
      runBurst(w, dt);
      w.t -= dt;
      if (w.t > 0) return;
      w.t = s.cd;
      const evo = w.evolved;
      w.red = !w.red;
      const red = w.red;
      const p = g.player;
      const n = s.amount + (evo ? 2 : 0);
      burst(w, n, 0.08, (i) => {
        const a = aimAt(g, p.x, p.y, i) + rand(-0.9, 0.9);
        const spd = 260 * s.speed;
        const green = evo || !red, boom = evo || red;
        g.addProj({
          x: p.x, y: p.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: 8 * s.area,
          dmg: s.dmg, pierce: green ? s.pierce + 1 : 0, life: s.life, wid: 'alexandrite',
          sprite: gemSprite(evo ? 'alexandrite' : red ? ALEX_RED : ALEX_GREEN, 14), rotToVel: true,
          trail: red && !evo ? '#ff5f8a' : '#3fe0a0', explode: boom ? 42 * s.area : 0, knock: 60,
          homing: evo ? 7 : 4.5, spd,
        });
        audio.shoot();
      });
    },
  },

  // ------------------------------------------------------------- トルマリン
  tourmaline: {
    update(g, w, s, dt) {
      runBurst(w, dt);
      w.t -= dt;
      if (w.t > 0) return;
      w.t = s.cd;
      const evo = w.evolved;
      const p = g.player;
      burst(w, s.amount, 0.12, (i) => {
        const a = aimAt(g, p.x, p.y, i);
        this.bolt(g, s, p.x, p.y, a, s.bounce + (evo ? 8 : 0), evo, s.dmg);
        audio.shoot();
      });
    },
    bolt(g, s, x, y, a, bounces, evo, dmg, hit) {
      const spd = 520 * s.speed;
      g.addProj({
        hit: hit ? new Set(hit) : undefined,
        x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: 7 * s.area, dmg, pierce: 999, life: 1.2,
        wid: 'tourmaline', sprite: gemSprite('tourmaline', 13, 'long'), rotToVel: true, trail: chance(0.5) ? '#ff5f9a' : '#5fffa0',
        knock: 40, bounces,
        onHit: (g2, pr, e) => {
          if (pr.bounces <= 0) { pr.life = 0; return; }
          const nx = g2.nearestEnemies(e.x, e.y, 1, 230, pr.hit)[0];
          if (!nx) { pr.life = 0; return; }
          pr.bounces--;
          g2.fx.bolt(e.x, e.y, nx.x, nx.y, pr.bounces % 2 ? '#ff8fbf' : '#8fffc0', 0.18, 2.5);
          const d = Math.hypot(nx.x - e.x, nx.y - e.y) || 1;
          pr.x = e.x; pr.y = e.y;
          pr.vx = ((nx.x - e.x) / d) * spd;
          pr.vy = ((nx.y - e.y) / d) * spd;
          pr.life = Math.max(pr.life, 0.6);
          if (evo && pr.bounces > 2 && chance(0.3)) {
            const a2 = Math.atan2(pr.vy, pr.vx) + rand(-1.2, 1.2);
            this.bolt(g2, s, e.x, e.y, a2, pr.bounces - 3, false, pr.dmg * 0.8, pr.hit);
          }
        },
      });
    },
  },

  // ------------------------------------------------------------- ムーンストーン
  moonstone: {
    update(g, w, s, dt) {
      runBurst(w, dt);
      const p = g.player;
      const evo = w.evolved;
      if (evo) {
        // 周回する満月
        w.ang = (w.ang || 0) + dt * 2.2;
        const R = 105 * s.area;
        const Q2 = this._q || (this._q = []);
        for (let k = 0; k < 2; k++) {
          const a = w.ang + k * Math.PI;
          const x = p.x + Math.cos(a) * R, y = p.y + Math.sin(a) * R;
          g.grid.query(x, y, 50, Q2);
          for (const e of Q2) {
            if (!e.alive || (e.x - x) ** 2 + (e.y - y) ** 2 > (22 * s.area + e.r) ** 2) continue;
            if ((e.hitT.moon || 0) > g.time) continue;
            e.hitT.moon = g.time + 0.4;
            g.damage(e, s.dmg * 0.5, { wid: 'moonstone', kb: 60 });
            if (e.alive && !e.boss && !e.segment && !e.charmT && chance(s.charm * 1.2)) this.charm(g, e, 4, true);
          }
        }
      }
      w.t -= dt;
      if (w.t > 0) return;
      w.t = s.cd;
      burst(w, s.amount, 0.15, (i) => {
        const a = aimAt(g, p.x, p.y, i) + (i ? rand(-0.5, 0.5) : 0);
        g.addProj({
          x: p.x, y: p.y, vx: Math.cos(a) * 360 * s.speed, vy: Math.sin(a) * 360 * s.speed, r: 14 * s.area, dmg: s.dmg,
          pierce: 999, life: 3, wid: 'moonstone', sprite: moonSprite(26, false), size: 26 * s.area, spin: 12,
          boomerang: { out: true, range: 210 * s.area, dist: 0 }, knock: 70,
          onHit: (g2, pr, e) => {
            if (e.alive && !e.boss && !e.segment && !e.charmT && chance(s.charm * (evo ? 1.3 : 1))) this.charm(g2, e, evo ? 4 : 3, evo);
          },
        });
        audio.whoosh();
      });
    },
    charm(g, e, T, boom) {
      e.charmT = T;
      e.charmBoom = boom;
      g.charmed = (g.charmed || 0) + 1;
      g.fx.text(e.x, e.y - e.r - 8, 'CHARM', { size: 12, color: '#ffb3e6', life: 0.6 });
      g.fx.burst(e.x, e.y, '#ffb3e6', 6, 100, 0.4, 9);
    },
    draw(g, w, s, ctx) {
      if (!w.evolved) return;
      const p = g.player;
      const R = 105 * s.area;
      const spr = moonSprite(34, true);
      for (let k = 0; k < 2; k++) {
        const a = (w.ang || 0) + k * Math.PI;
        const x = p.x + Math.cos(a) * R, y = p.y + Math.sin(a) * R;
        const L = spr.logical * s.area;
        ctx.drawImage(spr, x - L / 2, y - L / 2, L, L);
      }
    },
  },
};

const ALEX_GREEN = { color: '#1fb58a', light: '#b8ffe0', dark: '#0a5a3a', cut: 'oval' };
const ALEX_RED = { color: '#e0306a', light: '#ffb3c8', dark: '#5a1030', cut: 'oval' };

// 地面エリア（エメラルド・ほのおの あと）の え
export function drawArea(ctx, a, time) {
  const t = a.life / a.max;
  const fadeIn = Math.min(1, (a.max - a.life) / 0.15);
  const alpha = Math.min(1, t * 3) * fadeIn;
  if (a.kind === 'clover') {
    ctx.globalAlpha = alpha * 0.9;
    const grd = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, a.r);
    grd.addColorStop(0, 'rgba(120,255,180,0.15)');
    grd.addColorStop(0.8, 'rgba(40,210,120,0.35)');
    grd.addColorStop(1, 'rgba(20,180,100,0.6)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.r, 0, TAU);
    ctx.fill();
    // クローバー
    const n = Math.max(3, Math.floor(a.r / 14));
    for (let i = 0; i < n; i++) {
      const ang = a.seed + i * 2.4 + time * 0.5;
      const d = a.r * (0.25 + ((i * 37) % 10) / 14);
      const x = a.x + Math.cos(ang) * d, y = a.y + Math.sin(ang) * d;
      drawClover(ctx, x, y, 5 + (i % 3), a.clover && i % 4 === 0, time + i);
    }
  } else if (a.kind === 'fire') {
    ctx.globalAlpha = alpha * 0.28;
    ctx.globalCompositeOperation = 'lighter';
    const spr = softSprite('#ff5a3d');
    const s = a.r * (1.0 + Math.sin(time * 20 + a.x) * 0.08);
    ctx.drawImage(spr, a.x - s, a.y - s, s * 2, s * 2);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
}

function drawClover(ctx, x, y, s, four, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.8);
  ctx.fillStyle = four ? '#ffe14d' : '#2fd47a';
  const leaves = four ? 4 : 3;
  for (let i = 0; i < leaves; i++) {
    ctx.rotate(TAU / leaves);
    ctx.beginPath();
    ctx.arc(0, -s * 0.6, s * 0.55, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export { sparkle };
