// =====================================================================
//  追加の敵とボスの行動
//  mv = { mx, my, spd } を書き換えると移動が変わる
// =====================================================================
import { ENEMIES } from './data.js';
import { TAU, rand, chance } from './util.js';
import { audio } from './audio.js';

function aim(e, p) {
  const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
  return [(p.x - e.x) / d, (p.y - e.y) / d];
}

function shoot(g, e, a, spd = 150, r = 8, o = {}) {
  g.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r, dmg: e.dmg * (o.mul || 0.7), life: o.life || 6, freeze: o.freeze, color: o.color });
}

function startDash(e, p, windup = 0.6) {
  e.windup = windup;
  const [dx, dy] = aim(e, p);
  e.dvx = dx;
  e.dvy = dy;
}

// 回転レーザー（予告 → 照射）
function laser(g, e, a, o = {}) {
  g.lasers.push({ owner: e, a, va: o.va || 0, len: o.len || 700, w: o.w || 16, tele: o.tele || 1.0, dur: o.dur || 2.0, dmg: e.dmg * (o.mul || 0.9), color: o.color || '#ff3ddc' });
}

// 予告円 → 着弾
function warn(g, x, y, r, T, color, fn, owner = null) {
  g.warns.push({ x, y, r, t: 0, T, color, fn, owner });
}

export const AI = {
  // ------------------------------------------------ 遠距離型
  spitter(g, e, dt, dist, mv) {
    const p = g.player;
    if (dist < 150) { mv.mx = -mv.mx; mv.my = -mv.my; mv.spd *= 0.8; }
    else if (dist < 250) mv.spd = 0;
    if (e.shotT === undefined) e.shotT = rand(1, 2.5);
    e.shotT -= dt;
    if (e.shotT < 0.45) e.charging = true;
    if (e.shotT <= 0 && dist < 340) {
      e.shotT = 2.8;
      e.charging = false;
      shoot(g, e, Math.atan2(p.y - e.y, p.x - e.x), 165, 7, { color: '#5fe0ff' });
    } else if (e.shotT <= 0) { e.shotT = 1; e.charging = false; }
  },

  // ------------------------------------------------ 突進型
  charger(g, e, dt, dist) {
    e.dashCd = (e.dashCd === undefined ? rand(1, 3) : e.dashCd) - dt;
    if (e.dashCd <= 0 && dist < 240 && !(e.dash > 0) && !(e.windup > 0)) {
      e.dashCd = 3.6;
      startDash(e, g.player, 0.65);
    }
  },

  // ------------------------------------------------ 自爆型
  bomber(g, e, dt, dist, mv) {
    if (e.fuse !== undefined) {
      mv.spd = 0;
      e.fuse -= dt;
      e.flash = Math.floor(e.fuse * 12) % 2 ? 0.05 : 0;
      if (e.fuse <= 0) {
        e.alive = false;
        const p = g.player;
        const R = 70;
        g.fx.ring(e.x, e.y, 10, R, 0.35, '#ff8a3d', 8);
        g.fx.burst(e.x, e.y, '#ff6a3d', 18, 260, 0.5, 14);
        g.fx.shake(5);
        audio.bomb();
        if (Math.hypot(p.x - e.x, p.y - e.y) < R + p.r) g.hurtPlayer(e.dmg * 3);
        g.aoe(e.x, e.y, R, 250 * g.hpScale(), null, { kb: 200 });
      }
      return;
    }
    if (dist < 50 && !e.elite) { // エリートは自爆しない（撃破して宝箱を落とすため）
      e.fuse = 0.85;
      audio.thunder();
    }
  },

  // ------------------------------------------------ 冷気
  wisp(g, e, dt, dist, mv) {
    const w = Math.sin(g.time * 3 + e.phase) * 0.7;
    const mx = mv.mx, my = mv.my;
    mv.mx = mx - my * w;
    mv.my = my + mx * w;
  },

  // ------------------------------------------------ 瞬間移動
  phantom(g, e, dt, dist, mv) {
    const p = g.player;
    e.blinkCd = (e.blinkCd === undefined ? rand(2, 4) : e.blinkCd) - dt;
    if (e.fade > 0) {
      e.fade -= dt;
      mv.spd = 0;
      if (e.fade <= 0.2 && !e.blinked) {
        e.blinked = true;
        const a = Math.atan2(-p.dirY, -p.dirX) + rand(-0.6, 0.6);
        e.x = p.x + Math.cos(a) * 95;
        e.y = p.y + Math.sin(a) * 95;
        g.fx.burst(e.x, e.y, '#c45cff', 8, 120, 0.4, 10);
      }
      return;
    }
    if (e.blinkCd <= 0 && dist < 320) {
      e.blinkCd = rand(3.5, 5);
      e.fade = 0.5;
      e.blinked = false;
      g.fx.burst(e.x, e.y, '#c45cff', 8, 120, 0.4, 10);
    }
  },

  // ================================================= ボス
  prism(g, e, dt, dist, mv) {
    const enr = e.hp < e.maxHp * 0.5;
    mv.spd *= 0.7;
    e.atkT = (e.atkT ?? 3) - dt;
    e.atk2 = (e.atk2 ?? 2) - dt;
    if (e.atkT <= 0) {
      e.atkT = enr ? 6 : 7.5;
      const n = enr ? 4 : 3;
      const off = rand(TAU);
      const dir = chance(0.5) ? 1 : -1;
      for (let i = 0; i < n; i++) laser(g, e, off + (i / n) * TAU, { va: dir * (enr ? 0.65 : 0.5), tele: 1.3, dur: 2.4, color: '#5fe0ff', mul: 0.6 });
      audio.warning();
    }
    if (e.atk2 <= 0) {
      e.atk2 = enr ? 2.4 : 3.2;
      const n = enr ? 22 : 16, off = rand(TAU);
      for (let i = 0; i < n; i++) shoot(g, e, off + (i / n) * TAU, 130, 8, { color: '#8ff0ff' });
      g.fx.ring(e.x, e.y, e.r, e.r * 2, 0.3, '#8ff0ff', 5);
    }
  },

  worm(g, e, dt, dist, mv) {
    const p = g.player;
    const enr = e.hp < e.maxHp * 0.5;
    // 蛇行
    const w = Math.sin(g.time * 2.2) * 0.55;
    const mx = mv.mx, my = mv.my;
    mv.mx = mx - my * w;
    mv.my = my + mx * w;
    mv.spd = enr ? 125 : 105;
    if (!e.segs) {
      e.segs = [];
      e.trail = [];
      for (let i = 0; i < 16; i++) {
        const s = g.spawnEnemy('wormseg', e.x, e.y);
        s.parent = e;
        s.idx = i;
        s.r = 26 - i * 0.6;
        s.dmg = e.dmg * 0.45;
        e.segs.push(s);
      }
    }
    e.atkT = (e.atkT ?? 3) - dt;
    e.atk2 = (e.atk2 ?? 7) - dt;
    if (e.atkT <= 0) {
      e.atkT = enr ? 3.4 : 4.4;
      for (let i = 2; i < e.segs.length; i += 4) {
        const s = e.segs[i];
        if (!s.alive) continue;
        const a = Math.atan2(p.y - s.y, p.x - s.x);
        g.ebullets.push({ x: s.x, y: s.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, r: 8, dmg: e.dmg * 0.6, life: 5, color: '#ff8a3d' });
      }
    }
    if (e.atk2 <= 0 && !(e.dash > 0) && !(e.windup > 0)) {
      e.atk2 = enr ? 6 : 8;
      startDash(e, p, 0.8);
    }
  },

  lich(g, e, dt, dist, mv) {
    const p = g.player;
    const enr = e.hp < e.maxHp * 0.5;
    mv.spd *= 0.6;
    e.atkT = (e.atkT ?? 2) - dt;
    e.atk2 = (e.atk2 ?? 5) - dt;
    e.atk3 = (e.atk3 ?? 9) - dt;
    e.blinkCd = (e.blinkCd ?? 8) - dt;
    if (e.atkT <= 0) {
      // 氷柱：自機の現在地と進行方向の先に予告円
      e.atkT = enr ? 2.2 : 3;
      const n = enr ? 6 : 4;
      for (let i = 0; i < n; i++) {
        const lead = i === 0 ? 0 : rand(40, 140);
        const x = p.x + p.dirX * lead * (p.moving ? 1 : 0.3) + (i ? rand(-70, 70) : 0);
        const y = p.y + p.dirY * lead * (p.moving ? 1 : 0.3) + (i ? rand(-70, 70) : 0);
        warn(g, x, y, 42, 1.15, '#9fe4ff', (g2) => {
          g2.fx.burst(x, y, '#dff6ff', 10, 200, 0.45, 12);
          g2.fx.ring(x, y, 6, 42, 0.3, '#dff6ff', 5);
          if (Math.hypot(g2.player.x - x, g2.player.y - y) < 42 + g2.player.r) g2.hurtPlayer(e.dmg);
        }, e);
      }
    }
    if (e.atk2 <= 0) {
      // 冷気の輪：当たると凍えて減速
      e.atk2 = enr ? 5 : 6.5;
      const n = enr ? 26 : 20, off = rand(TAU);
      for (let i = 0; i < n; i++) shoot(g, e, off + (i / n) * TAU, 110, 9, { freeze: true, color: '#9fe4ff' });
      g.fx.ring(e.x, e.y, e.r, e.r * 3, 0.5, '#bfefff', 6);
    }
    if (e.atk3 <= 0) {
      e.atk3 = 12;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        g.spawnEnemy('wisp', e.x + Math.cos(a) * 80, e.y + Math.sin(a) * 80);
      }
    }
    if (e.blinkCd <= 0) {
      e.blinkCd = enr ? 6 : 9;
      g.fx.burst(e.x, e.y, '#bfefff', 20, 220, 0.6, 14);
      const a = rand(TAU);
      e.x = p.x + Math.cos(a) * 210;
      e.y = p.y + Math.sin(a) * 210;
      g.fx.ring(e.x, e.y, 10, 80, 0.4, '#bfefff', 6);
      audio.whoosh();
    }
  },

  emperor(g, e, dt, dist, mv) {
    const p = g.player;
    const ph = e.hp > e.maxHp * 0.66 ? 1 : e.hp > e.maxHp * 0.33 ? 2 : 3;
    if (e.phaseNow !== ph) {
      if (e.phaseNow) {
        // 形態変化：一瞬無敵＋衝撃波で弾を消す
        e.invulnT = 1.8;
        g.ebullets.length = 0;
        g.lasers.length = 0;
        g.fx.shake(14);
        g.fx.screenFlash(0.7, '#e0a0ff');
        g.fx.ring(e.x, e.y, 20, g.viewR, 0.8, '#e05cff', 14);
        g.hooks.banner(`PHASE ${ph}`, 'boss', ph === 3 ? '最終形態' : '形態変化');
        audio.evolve();
      }
      e.phaseNow = ph;
      e.atkT = 2; e.atk2 = 3; e.atk3 = 4;
    }
    if (e.invulnT > 0) { e.invulnT -= dt; mv.spd = 0; return; }
    mv.spd *= ph === 3 ? 0.9 : 0.7;
    e.atkT -= dt; e.atk2 -= dt; e.atk3 -= dt;
    // 共通：らせん弾
    e.spin = (e.spin || 0) + dt * (ph === 3 ? 1.6 : 1.1);
    e.spT = (e.spT || 0) - dt;
    if (e.spT <= 0) {
      e.spT = ph === 1 ? 0.2 : 0.16;
      const arms = ph === 3 ? 3 : 2;
      for (let i = 0; i < arms; i++) shoot(g, e, e.spin + (i / arms) * TAU, 120, 7, { color: '#e05cff', mul: 0.5 });
    }
    if (ph === 1) {
      if (e.atkT <= 0) {
        e.atkT = 2.2;
        const a0 = Math.atan2(p.y - e.y, p.x - e.x);
        for (let i = -2; i <= 2; i++) shoot(g, e, a0 + i * 0.18, 200, 9, { color: '#ff5fd2' });
      }
    } else if (ph === 2) {
      // ブラックホール：自機を引き寄せる
      if (e.atk2 <= 0) {
        e.atk2 = 10;
        e.pullT = 4;
        g.hooks.banner('GRAVITY', 'warning', '引き寄せられる');
      }
      if (e.pullT > 0) {
        e.pullT -= dt;
        const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
        p.x += ((e.x - p.x) / d) * 70 * dt;
        p.y += ((e.y - p.y) / d) * 70 * dt;
        if (Math.random() < 0.5) g.fx.add(p.x + rand(-80, 80), p.y + rand(-80, 80), (e.x - p.x) / d * 200, (e.y - p.y) / d * 200, 0.5, 6, '#c45cff', 'dot');
        e.ringT = (e.ringT || 0) - dt;
        if (e.ringT <= 0) {
          e.ringT = 1;
          const n = 18, off = rand(TAU);
          for (let i = 0; i < n; i++) shoot(g, e, off + (i / n) * TAU, 110, 8, { color: '#c45cff' });
        }
      }
      if (e.atk3 <= 0) {
        e.atk3 = 8;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          g.spawnEnemy('phantom', p.x + Math.cos(a) * 180, p.y + Math.sin(a) * 180);
        }
      }
    } else {
      if (e.atkT <= 0) {
        e.atkT = 6;
        const off = rand(TAU), dir = chance(0.5) ? 1 : -1;
        for (let i = 0; i < 4; i++) laser(g, e, off + (i / 4) * TAU, { va: dir * 0.75, tele: 1.0, dur: 3, color: '#ff3ddc' });
        audio.warning();
      }
      if (e.atk2 <= 0) {
        e.atk2 = 3.5;
        for (let i = 0; i < 3; i++) {
          const x = p.x + rand(-90, 90), y = p.y + rand(-90, 90);
          warn(g, x, y, 55, 1.2, '#e05cff', (g2) => {
            g2.fx.burst(x, y, '#e05cff', 14, 240, 0.5, 14);
            if (Math.hypot(g2.player.x - x, g2.player.y - y) < 55 + g2.player.r) g2.hurtPlayer(e.dmg);
          }, e);
        }
      }
    }
  },
};

// 分裂型が倒れたとき
export function onEnemyKilled(g, e) {
  const def = ENEMIES[e.type];
  if (def.ai === 'splitter' && !e.elite) {
    for (let i = 0; i < 2; i++) {
      const m = g.spawnEnemy('mini', e.x + rand(-10, 10), e.y + rand(-10, 10));
      m.vx = rand(-120, 120);
      m.vy = rand(-120, 120);
    }
  } else if (def.ai === 'splitter' && e.elite) {
    for (let i = 0; i < 6; i++) g.spawnEnemy('splitter', e.x + rand(-30, 30), e.y + rand(-30, 30));
  }
}

export { laser, warn };
