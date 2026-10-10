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

// 渾沌の穴（竅）が開いたときの説明
const HOLE_TEXT = [
  '目が開いた — 狙って撃ってくる',
  'もう一つの目が開いた',
  '耳が開いた — 足音を聴いて狙ってくる',
  'もう一つの耳が開いた',
  '鼻が開いた — 吸い込んで、吐き出す',
  'もう一つの鼻が開いた — 残るは口ひとつ',
];

// 檮杌の洪水：画面の外から、隙間（弾 5 つぶん）のある水の弾の壁が押し寄せる。怒ると 2 枚
function floodWall(g, e, enraged) {
  const p = g.player;
  const a = Math.floor(rand(4)) * (Math.PI / 2);
  const ux = Math.cos(a), uy = Math.sin(a);
  const nx = -uy, ny = ux;
  const step = 26;
  const n = Math.floor((Math.max(g.viewW, g.viewH) * 1.3) / step);
  for (let w = 0; w < (enraged ? 2 : 1); w++) {
    const gap = Math.floor(rand(n * 0.25, n * 0.75));
    const start = g.viewR + 40 + w * 150;
    const cx = p.x - ux * start, cy = p.y - uy * start;
    for (let i = 0; i < n; i++) {
      if (Math.abs(i - gap) <= 2) continue;
      const k = (i - n / 2) * step;
      g.ebullets.push({ x: cx + nx * k, y: cy + ny * k, vx: ux * 115, vy: uy * 115, r: 9, dmg: e.dmg * 0.6, life: 12, color: '#3fd8b0' });
    }
  }
  g.hooks.banner('FLOOD', 'warning', '洪水が押し寄せる — 隙間を抜けろ');
  audio.whoosh();
}

export const AI = {
  // ------------------------------------------------ ジュエルシーフ（逃げ回る。時間がたつと消える）
  thief(g, e, dt, dist, mv) {
    // ときどき立ち止まって振り返る（追いつける隙）
    e.restT -= dt;
    if (e.restT <= -2.4) e.restT = 0.7;
    if (e.restT > 0) { mv.spd = 0; return; }
    const w = Math.sin(g.time * 3 + e.phase) * 0.7;
    mv.mx = -mv.mx; mv.my = -mv.my;
    const mx = mv.mx; mv.mx += -mv.my * w; mv.my += mx * w;
    // 画面の外へは逃げない（端に着いたら端に沿って走る）
    const rx = e.x - g.player.x, ry = e.y - g.player.y;
    const bx = g.viewW * 0.4, by = g.viewH * 0.36;
    if (rx > bx && mv.mx > 0) mv.mx = -0.3;
    if (rx < -bx && mv.mx < 0) mv.mx = 0.3;
    if (ry > by && mv.my > 0) mv.my = -0.3;
    if (ry < -by && mv.my < 0) mv.my = 0.3;
  },

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
      shoot(g, e, Math.atan2(p.y - e.y, p.x - e.x), 165, 7, { color: ENEMIES[e.type].shotColor || '#5fe0ff' });
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

  // ------------------------------------------------ 深海（第2章）
  drift(g, e, dt, dist, mv) {
    const w = Math.sin(g.time * 2.2 + e.phase) * 0.8;
    const mx = mv.mx, my = mv.my;
    mv.mx = mx - my * w;
    mv.my = my + mx * w;
  },
  eel(g, e, dt, dist, mv) {
    const w = Math.sin(g.time * 6 + e.phase) * 0.8;
    const mx = mv.mx, my = mv.my;
    mv.mx = mx - my * w;
    mv.my = my + mx * w;
  },
  crab(g, e, dt, dist, mv) {
    // 横歩き（進む向きに少し横のずれを足す）
    const s = Math.sin(g.time * 1.3 + e.phase) > 0 ? 0.6 : -0.6;
    const mx = mv.mx;
    mv.mx += -mv.my * s;
    mv.my += mx * s;
  },
  deepone(g, e, dt, dist, mv) {
    // 近づくと一気に距離を詰める
    if (dist < 160 && dist > 50) mv.spd *= 1.35;
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
    mv.spd *= enr ? 1.3 : 1.1; // ヒート・HYPER の速度補正が効くように、基本の速度から掛ける
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

  // ダゴン：隙間のある津波の輪／水柱・眷属・突進を順番に
  dagon(g, e, dt, dist, mv) {
    const p = g.player;
    const enraged = e.hp < e.maxHp * 0.5;
    if (e.dgT === undefined) { e.dgT = 2; e.dg2 = 4; e.dgPat = 0; }
    mv.spd *= 0.8;
    e.dgT -= dt * (enraged ? 1.3 : 1);
    e.dg2 -= dt;
    if (e.dgT <= 0) {
      e.dgT = 2.6;
      const n = 26, a0 = rand(TAU);
      for (let w = 0; w < (enraged ? 2 : 1); w++) {
        for (let i = 2; i < n - 1; i++) shoot(g, e, a0 + (i / n) * TAU + w * (TAU / n / 2), 110 + w * 28, 8, { color: '#3fa8ff' });
      }
      g.fx.ring(e.x, e.y, e.r, e.r * 2.2, 0.4, '#3fa8ff', 6);
    }
    if (e.dg2 <= 0 && !(e.dash > 0) && !(e.windup > 0)) {
      e.dg2 = enraged ? 4 : 5.5;
      e.dgPat = (e.dgPat + 1) % 3;
      if (e.dgPat === 0) {
        // 水柱：自機の位置と周りに予告 → 噴き上がる
        const pts = [[p.x + p.dirX * (p.moving ? 50 : 0), p.y + p.dirY * (p.moving ? 50 : 0)]];
        for (let i = 0; i < (enraged ? 6 : 4); i++) pts.push([p.x + rand(-170, 170), p.y + rand(-170, 170)]);
        for (const [x, y] of pts) {
          warn(g, x, y, 50, 1.2, '#3fa8ff', (g2) => {
            g2.fx.burst(x, y, '#9fdcff', 16, 240, 0.6, 12);
            g2.fx.ring(x, y, 8, 55, 0.35, '#3fa8ff', 6);
            if (Math.hypot(g2.player.x - x, g2.player.y - y) < 50 + g2.player.r) g2.hurtPlayer(e.dmg);
          }, e);
        }
        audio.whoosh();
      } else if (e.dgPat === 1) {
        // 眷属：深きものどもを呼ぶ
        const R = g.viewR * 0.75;
        for (let i = 0; i < (enraged ? 5 : 3); i++) {
          const a = rand(TAU);
          g.spawnEnemy('deepone', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R);
        }
      } else {
        startDash(e, p, 0.8);
      }
    }
  },

  // クトゥルフ：触手の薙ぎ払い（一列の予告）／狂気の波・落とし子・翼の突風を順番に
  cthulhu(g, e, dt, dist, mv) {
    const p = g.player;
    const enraged = e.hp < e.maxHp * 0.5;
    if (e.ctT === undefined) { e.ctT = 2.5; e.ct2 = 4.5; e.ctPat = 0; }
    mv.spd *= 0.75;
    e.ctT -= dt * (enraged ? 1.3 : 1);
    e.ct2 -= dt;
    if (e.gustT > 0) {
      // 翼の突風：自機を押し返す
      e.gustT -= dt;
      const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      p.x += ((p.x - e.x) / d) * 90 * dt;
      p.y += ((p.y - e.y) / d) * 90 * dt;
      if (Math.random() < 0.5) g.fx.add(p.x + rand(-60, 60), p.y + rand(-60, 60), (p.x - e.x) / d * 220, (p.y - e.y) / d * 220, 0.4, 5, '#9fffd0', 'dot');
    }
    if (e.ctT <= 0) {
      e.ctT = 3;
      // 触手：ボスから自機へ向かって順に叩きつける
      const a = Math.atan2(p.y - e.y, p.x - e.x) + rand(-0.15, 0.15);
      const n = enraged ? 7 : 5;
      for (let i = 1; i <= n; i++) {
        const x = e.x + Math.cos(a) * (e.r + i * 55), y = e.y + Math.sin(a) * (e.r + i * 55);
        warn(g, x, y, 34, 0.7 + i * 0.12, '#3fe08a', (g2) => {
          g2.fx.burst(x, y, '#3fe08a', 10, 200, 0.5, 10);
          if (Math.hypot(g2.player.x - x, g2.player.y - y) < 34 + g2.player.r) g2.hurtPlayer(e.dmg * 0.9);
        }, e);
      }
    }
    if (e.ct2 <= 0 && !(e.dash > 0) && !(e.windup > 0)) {
      e.ct2 = enraged ? 4.2 : 5.5;
      e.ctPat = (e.ctPat + 1) % 3;
      if (e.ctPat === 0) {
        // 狂気の波：回転の向きが違う 2 重の輪
        const n = 20, off = rand(TAU);
        for (let i = 0; i < n; i++) {
          shoot(g, e, off + (i / n) * TAU, 115, 8, { color: '#c78bff' });
          if (enraged) shoot(g, e, off + ((i + 0.5) / n) * TAU, 85, 8, { color: '#3fe08a' });
        }
        g.fx.ring(e.x, e.y, e.r, e.r * 2.4, 0.5, '#c78bff', 8);
      } else if (e.ctPat === 1) {
        const R = g.viewR * 0.75;
        for (let i = 0; i < (enraged ? 3 : 2); i++) {
          const a = rand(TAU);
          g.spawnEnemy('starspawn', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R);
        }
      } else {
        e.gustT = 1.6;
        g.hooks.banner('GUST', 'warning', '翼の突風');
        const a0 = Math.atan2(p.y - e.y, p.x - e.x);
        for (let i = -3; i <= 3; i++) shoot(g, e, a0 + i * 0.16, 170, 9, { color: '#3fe08a' });
        audio.whoosh();
      }
    }
  },

  // グラーキ：狙いの棘（3 方向の扇）／棘の雨・従者・湖のうねりを順番に
  glaaki(g, e, dt, dist, mv) {
    const p = g.player;
    const enraged = e.hp < e.maxHp * 0.5;
    if (e.glT === undefined) { e.glT = 2; e.gl2 = 4; e.glPat = 0; }
    mv.spd *= 0.7;
    e.glT -= dt * (enraged ? 1.3 : 1);
    e.gl2 -= dt;
    if (e.glT <= 0) {
      e.glT = 2.4;
      const a0 = Math.atan2(p.y - e.y, p.x - e.x);
      for (const off of [-0.5, 0, 0.5]) for (let i = -2; i <= 2; i++) shoot(g, e, a0 + off + i * 0.06, 185, 7, { color: '#d8e0ff', mul: 0.55 });
    }
    if (e.gl2 <= 0) {
      e.gl2 = enraged ? 4.2 : 5.5;
      e.glPat = (e.glPat + 1) % 3;
      if (e.glPat === 0) {
        // 棘の雨
        for (let i = 0; i < (enraged ? 12 : 8); i++) {
          const x = p.x + rand(-200, 200), y = p.y + rand(-200, 200);
          warn(g, x, y, 30, 1.0 + i * 0.05, '#d8e0ff', (g2) => {
            g2.fx.burst(x, y, '#d8e0ff', 8, 180, 0.4, 8);
            if (Math.hypot(g2.player.x - x, g2.player.y - y) < 30 + g2.player.r) g2.hurtPlayer(e.dmg * 0.8);
          }, e);
        }
      } else if (e.glPat === 1) {
        const R = g.viewR * 0.75;
        for (let i = 0; i < (enraged ? 4 : 3); i++) {
          const a = rand(TAU);
          g.spawnEnemy('servant', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R);
        }
      } else {
        // 湖のうねり：速さの違う 2 重の輪
        const off = rand(TAU);
        for (let i = 0; i < 26; i++) shoot(g, e, off + (i / 26) * TAU, 90, 9, { color: '#8fb8ff' });
        for (let i = 0; i < 22; i++) shoot(g, e, off + ((i + 0.5) / 22) * TAU, 130, 8, { color: '#8fb8ff' });
        g.fx.ring(e.x, e.y, e.r, e.r * 2.4, 0.5, '#8fb8ff', 8);
      }
    }
  },

  // 黄衣の王：黄衣の翻り（狙いの扇）／黄の印の爆発・眷属・黒い星の雨を順番に
  kingyellow(g, e, dt, dist, mv) {
    const p = g.player;
    const enraged = e.hp < e.maxHp * 0.5;
    if (e.kyT === undefined) { e.kyT = 2; e.ky2 = 4; e.kyPat = 0; }
    mv.spd *= 0.75;
    e.kyT -= dt * (enraged ? 1.3 : 1);
    e.ky2 -= dt;
    if (e.kyT <= 0) {
      e.kyT = 2.2;
      const a0 = Math.atan2(p.y - e.y, p.x - e.x);
      const n = enraged ? 9 : 7;
      for (let i = 0; i < n; i++) shoot(g, e, a0 + (i - (n - 1) / 2) * 0.17, 175, 8, { color: '#ffd24a' });
    }
    if (e.ky2 <= 0) {
      e.ky2 = enraged ? 4.2 : 5.5;
      e.kyPat = (e.kyPat + 1) % 3;
      if (e.kyPat === 0) {
        // 黄の印：大きな予告 → 爆発
        for (let i = 0; i < (enraged ? 4 : 3); i++) {
          const a = rand(TAU), d = i ? rand(90, 200) : 0;
          const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
          warn(g, x, y, 70, 1.6, '#ffd24a', (g2) => {
            g2.fx.ring(x, y, 10, 75, 0.4, '#ffd24a', 8);
            g2.fx.burst(x, y, '#ffe38a', 14, 220, 0.5, 10);
            if (Math.hypot(g2.player.x - x, g2.player.y - y) < 70 + g2.player.r) g2.hurtPlayer(e.dmg);
          }, e);
        }
      } else if (e.kyPat === 1) {
        // 眷属：仮面の貴族とバイアクヘーの輪
        const R = g.viewR * 0.8;
        for (let i = 0; i < 2; i++) { const a = rand(TAU); g.spawnEnemy('masked', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); }
        for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.spawnEnemy('byakhee', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); }
      } else {
        // 黒い星の雨：画面の上から降ってくる
        const n = enraged ? 18 : 13;
        for (let i = 0; i < n; i++) {
          const x = p.x + (i / (n - 1) - 0.5) * g.viewW * 0.95 + rand(-12, 12);
          g.ebullets.push({ x, y: p.y - g.viewH * 0.55 - rand(0, 120), vx: 0, vy: 150, r: 8, dmg: e.dmg * 0.6, life: 7, color: '#2a1a3a' });
        }
        g.hooks.banner('STARFALL', 'warning', '黒い星が降る');
      }
    }
  },

  // ニャルラトホテプ（黒き石板）：回転レーザー／瞬間移動・H.A.L.の召喚・十字の弾幕を順番に
  monolith(g, e, dt, dist, mv) {
    const p = g.player;
    const enraged = e.hp < e.maxHp * 0.5;
    if (e.moT === undefined) { e.moT = 3; e.mo2 = 4.5; e.moPat = 0; }
    mv.spd *= 0.6;
    e.moT -= dt;
    e.mo2 -= dt;
    if (e.moT <= 0) {
      e.moT = enraged ? 6 : 7.5;
      const n = enraged ? 3 : 2, off = rand(TAU), dir = chance(0.5) ? 1 : -1;
      for (let i = 0; i < n; i++) laser(g, e, off + (i / n) * TAU, { va: dir * (enraged ? 0.6 : 0.45), tele: 1.2, dur: 2.6, color: '#ff5a2d', mul: 0.6 });
      audio.warning();
    }
    if (e.mo2 <= 0) {
      e.mo2 = enraged ? 4 : 5.2;
      e.moPat = (e.moPat + 1) % 3;
      if (e.moPat === 0) {
        // 瞬間移動：消えて自機の近くに現れ、弾の輪を放つ
        g.fx.burst(e.x, e.y, '#b45cff', 20, 220, 0.6, 14);
        const a = rand(TAU);
        e.x = p.x + Math.cos(a) * 230;
        e.y = p.y + Math.sin(a) * 230;
        g.fx.ring(e.x, e.y, 10, e.r * 2.5, 0.5, '#b45cff', 8);
        const n = enraged ? 22 : 16, off = rand(TAU);
        for (let i = 0; i < n; i++) shoot(g, e, off + (i / n) * TAU, 120, 8, { color: '#b45cff' });
        audio.whoosh();
      } else if (e.moPat === 1) {
        const R = g.viewR * 0.75;
        for (let i = 0; i < (enraged ? 4 : 3); i++) { const a = rand(TAU); g.spawnEnemy('hal', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); }
      } else {
        // 十字（斜めを交互）の 3 段の弾
        const base = e.moCross = !e.moCross ? Math.PI / 4 : 0;
        for (let k = 0; k < 8; k++) {
          if (!enraged && k % 2) continue;
          for (let s = 0; s < 3; s++) shoot(g, e, base + (k / 8) * TAU, 110 + s * 40, 8, { color: '#ff5a2d' });
        }
      }
    }
  },

  // 外なる奏者：眠るアザトースの周りを回り、音の弾を撃つ。HP は代表の 1 体（lead）が持つ（damage() の shareTo）
  piper(g, e, dt, dist, mv) {
    const p = g.player;
    const az = e.azOwner;
    if (!az || !az.alive) { e.alive = false; return; }
    const lead = e.shareTo || e;
    const n = lead.pipeN || 5;
    const enraged = lead.hp < lead.maxHp * 0.5;
    // 周回
    const a = g.time * (enraged ? 0.6 : 0.45) + (e.orbI / n) * TAU;
    const R = az.r + 110;
    mv.mx = az.x + Math.cos(a) * R - e.x;
    mv.my = az.y + Math.sin(a) * R - e.y;
    mv.spd = Math.min(Math.hypot(mv.mx, mv.my) / Math.max(dt, 0.001), 420);
    // それぞれが順番に、自機を狙った 3 方向の音
    e.ptT = (e.ptT ?? 1.2 + e.orbI * 0.65) - dt;
    e.charging = e.ptT < 0.35;
    if (e.ptT <= 0) {
      e.ptT = enraged ? 2.6 : 3.3;
      const a0 = Math.atan2(p.y - e.y, p.x - e.x);
      for (let i = -1; i <= 1; i++) shoot(g, e, a0 + i * 0.22, 140, 7, { color: '#9fffe0', mul: 0.5 });
    }
    // 代表が合図：全員で音の輪
    if (e === lead) {
      lead.ringT = (lead.ringT ?? 6) - dt;
      if (lead.ringT <= 0) {
        lead.ringT = enraged ? 5 : 7;
        for (const o of az.pipers || []) {
          if (!o.alive) continue;
          const off = rand(TAU);
          for (let i = 0; i < 8; i++) shoot(g, o, off + (i / 8) * TAU, 105, 7, { color: '#c78bff', mul: 0.5 });
          g.fx.ring(o.x, o.y, 6, 50, 0.4, '#9fffe0', 5);
        }
        audio.warning();
      }
    }
  },

  // アザトース：第一形態は中心で眠るだけ（無敵・動かない・接触なし）。奏者を倒すと目覚める
  azathoth(g, e, dt, dist, mv) {
    const p = g.player;
    if (!e.azInit) {
      e.azInit = true;
      e.asleep = true;
      e.invulnT = 1e9;
      const n = 5;
      e.pipers = [];
      for (let i = 0; i < n; i++) {
        const o = g.spawnEnemy('piper', e.x, e.y);
        o.azOwner = e;
        o.orbI = i;
        if (i) { o.shareTo = e.pipers[0]; o.hp = o.maxHp = 1e12; }
        e.pipers.push(o);
      }
      e.pipers[0].pipeN = n;
      g.boss = e.pipers[0];
      g.hooks.bossBar(g.boss);
      g.hooks.banner('THE OUTER PIPERS', 'boss', '眠れる王を取り巻く奏者を倒せ');
    }
    if (!e.azWoke) {
      mv.spd = 0;
      e.invulnT = 1e9;
      if (Math.random() < 0.15) g.fx.add(e.x + rand(-e.r, e.r), e.y - e.r * 0.8, 0, -25, 1.2, 8, '#c78bff', 'dot');
      if (!e.pipers[0].alive) {
        // 目覚め：残りの奏者も消え、曲が変わる
        e.azWoke = true;
        e.asleep = false;
        e.invulnT = 0;
        e.charging = true;
        for (const o of e.pipers) o.alive = false;
        g.boss = e;
        g.hooks.bossBar(e);
        g.hooks.banner('AZATHOTH AWAKENS', 'boss', '盲目白痴の王が目覚めた');
        g.fx.shake(22);
        g.fx.screenFlash(0.8, '#ff5fd2');
        g.fx.ring(e.x, e.y, 20, g.viewR, 0.9, '#ff5fd2', 14);
        audio.playBgm('azathoth');
        e.azT = 2; e.az2 = 3.5; e.azPat = 0;
      }
      return;
    }
    // ---- 第二形態
    const enraged = e.hp < e.maxHp * 0.5;
    e.charging = true;
    mv.spd *= 0.7;
    e.azT -= dt * (enraged ? 1.35 : 1);
    e.az2 -= dt;
    if (e.azT <= 0) {
      // 混沌の弾：ばらばらの向きと速さ
      e.azT = 2;
      for (let i = 0; i < (enraged ? 30 : 22); i++) shoot(g, e, rand(TAU), rand(90, 190), 7, { color: chance(0.5) ? '#ff5fd2' : '#7f5fff', mul: 0.55 });
    }
    if (e.az2 <= 0) {
      e.az2 = enraged ? 4 : 5.2;
      e.azPat = (e.azPat + 1) % 3;
      if (e.azPat === 0) {
        // 創造の泡：予告の円がはじけて、小さな弾の輪になる
        for (let i = 0; i < (enraged ? 7 : 5); i++) {
          const x = p.x + rand(-190, 190), y = p.y + rand(-190, 190);
          warn(g, x, y, 40, 1.3, '#ff5fd2', (g2) => {
            g2.fx.burst(x, y, '#ff9ad2', 12, 200, 0.5, 10);
            if (Math.hypot(g2.player.x - x, g2.player.y - y) < 40 + g2.player.r) g2.hurtPlayer(e.dmg * 0.8);
            const off = rand(TAU);
            for (let k = 0; k < 6; k++) g2.ebullets.push({ x, y, vx: Math.cos(off + (k / 6) * TAU) * 110, vy: Math.sin(off + (k / 6) * TAU) * 110, r: 6, dmg: e.dmg * 0.4, life: 4, color: '#ff9ad2' });
          }, e);
        }
      } else if (e.azPat === 1) {
        // 奏者の残響：下位の奏者と異形の群れ
        const R = g.viewR * 0.8;
        for (let i = 0; i < (enraged ? 4 : 3); i++) { const a = rand(TAU); g.spawnEnemy('flutist', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); }
        for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; g.spawnEnemy('spawn', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); }
      } else {
        // 引き寄せ＋弾の輪
        e.pullT = 3;
        g.hooks.banner('GRAVITY', 'warning', '中心へ引き寄せられる');
      }
    }
    if (e.pullT > 0) {
      e.pullT -= dt;
      const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
      p.x += ((e.x - p.x) / d) * 65 * dt;
      p.y += ((e.y - p.y) / d) * 65 * dt;
      e.ringT = (e.ringT || 0) - dt;
      if (e.ringT <= 0) {
        e.ringT = 1;
        const off = rand(TAU);
        for (let i = 0; i < 16; i++) shoot(g, e, off + (i / 16) * TAU, 105, 8, { color: '#7f5fff' });
      }
    }
  },

  // ================================================= 第3章：四凶
  // 窮奇：羽の扇（狙い）／続けざまの飛びかかり・北風・眷属を順番に
  kyuki(g, e, dt, dist, mv) {
    const p = g.player;
    const enraged = e.hp < e.maxHp * 0.5;
    if (e.qkT === undefined) { e.qkT = 2; e.qk2 = 4; e.qkPat = 0; e.pounce = 0; }
    mv.spd *= 0.85;
    e.qkT -= dt * (enraged ? 1.3 : 1);
    e.qk2 -= dt;
    // 飛びかかる構えの間は口を開ける
    e.charging = e.windup > 0;
    // 続けざまの飛びかかり：突進が終わるたびに狙い直す
    if (e.pounce > 0 && !(e.dash > 0) && !(e.windup > 0)) {
      e.pounce--;
      startDash(e, p, enraged ? 0.45 : 0.55);
    }
    if (e.qkT <= 0) {
      e.qkT = 2.4;
      const a0 = Math.atan2(p.y - e.y, p.x - e.x);
      const n = enraged ? 9 : 7;
      for (let i = 0; i < n; i++) shoot(g, e, a0 + (i - (n - 1) / 2) * 0.13, 195, 7, { color: '#bfe8ff', mul: 0.55 });
    }
    if (e.northT > 0) {
      // 北風：自機を南（画面の下）へ押し流し、上から風の刃が降る
      e.northT -= dt;
      p.y += 70 * dt;
      e.windT = (e.windT || 0) - dt;
      if (e.windT <= 0) {
        e.windT = enraged ? 0.28 : 0.38;
        for (let i = 0; i < 2; i++) {
          const x = p.x + rand(-g.viewW * 0.5, g.viewW * 0.5);
          g.ebullets.push({ x, y: p.y - g.viewH * 0.55 - rand(0, 60), vx: rand(-15, 15), vy: 200, r: 7, dmg: e.dmg * 0.5, life: 6, color: '#bfe8ff' });
        }
      }
      if (Math.random() < 0.6) g.fx.add(p.x + rand(-g.viewW / 2, g.viewW / 2), p.y - g.viewH / 2 + rand(0, g.viewH), rand(-10, 10), 420, 0.5, 4, '#dff2ff', 'dot');
    }
    if (e.qk2 <= 0 && !(e.dash > 0) && !(e.windup > 0) && !(e.pounce > 0) && !(e.northT > 0)) {
      e.qk2 = enraged ? 4.2 : 5.5;
      e.qkPat = (e.qkPat + 1) % 3;
      if (e.qkPat === 0) {
        e.pounce = enraged ? 3 : 2;
        g.hooks.banner('POUNCE', 'warning', '続けざまに飛びかかってくる');
      } else if (e.qkPat === 1) {
        e.northT = 3.4;
        g.hooks.banner('NORTH WIND', 'warning', '北風 — 上から風の刃が降る');
        audio.whoosh();
      } else {
        const R = g.viewR * 0.8;
        for (let i = 0; i < (enraged ? 3 : 2); i++) { const a = rand(TAU); g.spawnEnemy('yokko', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); }
        for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.spawnEnemy('kochou', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); }
      }
    }
  },

  // 檮杌：咆哮の輪（隙間あり）／尾の薙ぎ払い・洪水の壁・眷属を順番に
  tokotsu(g, e, dt, dist, mv) {
    const p = g.player;
    const enraged = e.hp < e.maxHp * 0.5;
    if (e.tkT === undefined) { e.tkT = 2.5; e.tk2 = 4; e.tkPat = 0; }
    mv.spd *= 0.75;
    e.tkT -= dt * (enraged ? 1.3 : 1);
    e.tk2 -= dt;
    if (e.tkT <= 0) {
      e.tkT = 2.6;
      const n = 28, a0 = rand(TAU);
      for (let w = 0; w < (enraged ? 2 : 1); w++) {
        for (let i = 2; i < n - 1; i++) shoot(g, e, a0 + (i / n) * TAU + w * Math.PI, 105 + w * 30, 8, { color: '#3fd8b0', mul: 0.6 });
      }
      g.fx.ring(e.x, e.y, e.r, e.r * 2.2, 0.4, '#3fd8b0', 6);
    }
    if (e.tk2 <= 0) {
      e.tk2 = enraged ? 4.4 : 5.6;
      e.tkPat = (e.tkPat + 1) % 3;
      if (e.tkPat === 0) {
        // 尾の薙ぎ払い：自機のいる側を、弧を描くように順に叩く（一丈八尺の尾）
        const a0 = Math.atan2(p.y - e.y, p.x - e.x);
        const dir = chance(0.5) ? 1 : -1;
        const n = enraged ? 11 : 9;
        for (let k = 0; k < 2; k++) {
          const R = e.r + 70 + k * 75;
          for (let i = 0; i < n; i++) {
            const a = a0 + dir * (-1.4 + (i / (n - 1)) * 2.8);
            const x = e.x + Math.cos(a) * R, y = e.y + Math.sin(a) * R;
            warn(g, x, y, 40, 0.75 + i * 0.07, '#e8c070', (g2) => {
              g2.fx.burst(x, y, '#e8c070', 8, 180, 0.4, 8);
              if (Math.hypot(g2.player.x - x, g2.player.y - y) < 40 + g2.player.r) g2.hurtPlayer(e.dmg * 0.9);
            }, e);
          }
        }
        audio.whoosh();
      } else if (e.tkPat === 1) {
        floodWall(g, e, enraged);
      } else {
        const R = g.viewR * 0.8;
        for (let i = 0; i < (enraged ? 4 : 3); i++) { const a = rand(TAU); g.spawnEnemy('tsuchi', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); }
        const a = rand(TAU);
        g.spawnEnemy('kui', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R);
      }
    }
  },

  // 饕餮：青銅のかけら（狙いの扇）／吸い込み・三青鳥と狍鴞・噛みつきを順番に。
  // 吸い込んだ経験値とコインは、ダウン（ブレイク）か撃破のときに 1.5 倍にして吐き出す（spillEaten）
  totetsu(g, e, dt, dist, mv) {
    const p = g.player;
    const enraged = e.hp < e.maxHp * 0.5;
    if (e.ttT === undefined) { e.ttT = 2; e.tt2 = 4; e.ttPat = 0; }
    mv.spd *= e.devourT > 0 ? 0 : 0.75;
    e.ttT -= dt * (enraged ? 1.3 : 1);
    e.tt2 -= dt;
    if (e.devourT > 0) {
      e.devourT -= dt;
      e.charging = true;
      const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
      p.x += ((e.x - p.x) / d) * 75 * dt;
      p.y += ((e.y - p.y) / d) * 75 * dt;
      let ate = false;
      for (const pk of g.pickups) {
        if ((pk.kind !== 'xp' && pk.kind !== 'coin') || pk.vac) continue;
        const dx = e.x - pk.x, dy = e.y - pk.y, dd = Math.hypot(dx, dy) || 1;
        if (dd > g.viewR * 1.2) continue;
        if (dd < e.r * 0.7) {
          if (pk.kind === 'xp') e.eatXp = (e.eatXp || 0) + pk.value;
          else e.eatCoin = (e.eatCoin || 0) + pk.value;
          pk.eaten = true;
          ate = true;
          continue;
        }
        pk.x += (dx / dd) * 280 * dt;
        pk.y += (dy / dd) * 280 * dt;
      }
      if (ate) g.pickups = g.pickups.filter((pk) => !pk.eaten);
      if (Math.random() < 0.7) {
        const a = rand(TAU), R = rand(120, 260);
        g.fx.add(e.x + Math.cos(a) * R, e.y + Math.sin(a) * R, -Math.cos(a) * R * 2.2, -Math.sin(a) * R * 2.2, 0.45, 5, '#e8c070', 'dot');
      }
      if (e.devourT <= 0) {
        // 吐き出す：骨の弾を扇状に
        e.charging = false;
        const a0 = Math.atan2(p.y - e.y, p.x - e.x);
        for (let i = -6; i <= 6; i++) shoot(g, e, a0 + i * 0.09, rand(150, 220), 8, { color: '#f6f0e2', mul: 0.55 });
        g.fx.ring(e.x, e.y, e.r, e.r * 2.2, 0.4, '#e8c070', 6);
      }
      return;
    }
    if (e.ttT <= 0) {
      e.ttT = 2.2;
      const a0 = Math.atan2(p.y - e.y, p.x - e.x);
      const n = enraged ? 7 : 5;
      for (let i = 0; i < n; i++) shoot(g, e, a0 + (i - (n - 1) / 2) * 0.2, 180, 8, { color: '#e8c070', mul: 0.6 });
    }
    if (e.tt2 <= 0 && !(e.dash > 0) && !(e.windup > 0)) {
      e.tt2 = enraged ? 4.4 : 5.6;
      e.ttPat = (e.ttPat + 1) % 3;
      if (e.ttPat === 0) {
        e.devourT = 3.2;
        g.hooks.banner('DEVOUR', 'warning', '吸い込まれる — 食べたものはダウンで吐き出す');
        audio.warning();
      } else if (e.ttPat === 1) {
        const R = g.viewR * 0.8;
        for (let i = 0; i < 2; i++) { const a = rand(TAU); g.spawnEnemy('seicho', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); }
        for (let i = 0; i < (enraged ? 3 : 2); i++) { const a = rand(TAU); g.spawnEnemy('houkyou', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); }
      } else {
        startDash(e, p, 0.75);
      }
    }
  },

  // 渾沌：HP を 7 等分した境目を越えるたびに、顔に穴（竅）が一つ開く（左目・右目・左耳・右耳・左の鼻・右の鼻。七つ目で死ぬ）。
  // 拍に合わせた輪は最初から。目が開くと狙い撃ち、耳が開くと自機の足あとへの予告、鼻が開くと吸って吐く息が加わる。穴が六つで速くなる
  konton(g, e, dt, dist, mv) {
    const p = g.player;
    const holes = Math.max(0, Math.min(6, Math.floor((1 - e.hp / e.maxHp) * 7)));
    if (e.holes === undefined) { e.holes = holes; e.knT = 1.5; e.kn2 = 2.5; e.kn3 = 3.5; e.kn4 = 5; e.kn5 = 8; e.steps = []; e.stepT = 0; }
    if (holes > e.holes) {
      // 穴が開く：弾を消して、少しの間だけ無敵
      e.holes = holes;
      e.invulnT = 1.2;
      e.breathT = 0;
      g.ebullets.length = 0;
      g.fx.shake(14);
      g.fx.screenFlash(0.6, '#ff8a3d');
      g.fx.ring(e.x, e.y, 20, g.viewR, 0.8, '#ffa040', 12);
      g.hooks.banner(`第${'一二三四五六'[holes - 1]}の竅`, 'boss', HOLE_TEXT[holes - 1]);
      audio.evolve();
    }
    e.sprFrame = e.holes;
    if (e.invulnT > 0) { e.invulnT -= dt; mv.spd = 0; return; }
    const fast = e.holes >= 6 ? 1.3 : 1;
    // 舞：体を揺らしながら回る
    const sway = Math.sin(g.time * 2.9) * 0.9;
    const mx = mv.mx;
    mv.mx += -mv.my * sway;
    mv.my += mx * sway;
    mv.spd *= 0.8;
    // 自機の足あと（耳で聴く）
    e.stepT -= dt;
    if (e.stepT <= 0) { e.stepT = 0.25; e.steps.push([p.x, p.y]); if (e.steps.length > 8) e.steps.shift(); }
    // 歌と舞：4 拍ごとの輪（BGM と同じ 140 BPM）
    e.knT -= dt * fast;
    if (e.knT <= 0) {
      e.knT = (60 / 140) * 4;
      e.spin = (e.spin || 0) + 0.35;
      const n = 12;
      for (let i = 0; i < n; i++) shoot(g, e, e.spin + (i / n) * TAU, 105, 7, { color: i % 2 ? '#ffd27a' : '#ff6a3d', mul: 0.5 });
    }
    // 目：狙い撃ち
    if (e.holes >= 1) {
      e.kn2 -= dt * fast;
      if (e.kn2 <= 0) {
        e.kn2 = 2.2;
        const a0 = Math.atan2(p.y - e.y, p.x - e.x);
        const n = e.holes >= 2 ? 5 : 3;
        for (let i = 0; i < n; i++) shoot(g, e, a0 + (i - (n - 1) / 2) * 0.16, 200, 7, { color: '#fff2c0', mul: 0.55 });
      }
    }
    // 耳：少し前の足あとに予告
    if (e.holes >= 3) {
      e.kn3 -= dt * fast;
      if (e.kn3 <= 0) {
        e.kn3 = 3.4;
        const st = e.steps;
        const pts = [st[st.length - 1], st[st.length - 4]];
        if (e.holes >= 4) pts.push(st[0]);
        for (const pt of pts) {
          if (!pt) continue;
          const [x, y] = pt;
          warn(g, x, y, 50, 1.0, '#ff8a3d', (g2) => {
            g2.fx.burst(x, y, '#ffb84a', 12, 200, 0.5, 10);
            g2.fx.ring(x, y, 6, 52, 0.3, '#ff8a3d', 5);
            if (Math.hypot(g2.player.x - x, g2.player.y - y) < 50 + g2.player.r) g2.hurtPlayer(e.dmg * 0.9);
          }, e);
        }
      }
    }
    // 鼻：吸って、吐く
    if (e.holes >= 5) {
      e.kn4 -= dt * fast;
      if (e.kn4 <= 0 && !(e.breathT > 0)) {
        e.kn4 = 7;
        e.breathT = 2.2;
        e.blown = false;
        g.hooks.banner('BREATH', 'warning', '吸い込んで、吐き出す');
      }
    }
    if (e.breathT > 0) {
      e.breathT -= dt;
      const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
      const k = e.breathT > 0.7 ? 70 : -140;
      p.x += ((e.x - p.x) / d) * k * dt;
      p.y += ((e.y - p.y) / d) * k * dt;
      if (e.breathT <= 0.7 && !e.blown) {
        e.blown = true;
        const off = rand(TAU);
        for (let i = 0; i < 24; i++) shoot(g, e, off + (i / 24) * TAU, 150, 8, { color: '#ff6a3d', mul: 0.55 });
        if (e.holes >= 6) for (let i = 0; i < 24; i++) shoot(g, e, off + ((i + 0.5) / 24) * TAU, 110, 8, { color: '#ffd27a', mul: 0.55 });
        g.fx.ring(e.x, e.y, e.r, e.r * 3, 0.5, '#ff8a3d', 8);
        audio.whoosh();
      }
    }
    // 子：舞子と鑿
    e.kn5 -= dt;
    if (e.kn5 <= 0) {
      e.kn5 = 11;
      const R = g.viewR * 0.8;
      for (let i = 0; i < 2; i++) { const a = rand(TAU); g.spawnEnemy('maiko', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); }
      for (let i = 0; i < (e.holes >= 3 ? 3 : 2); i++) { const a = rand(TAU); g.spawnEnemy('nomi', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); }
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

// ジュエルシーフの逃走までの時間（AI の外で進める。凍結や目くらましで延びないように）。逃げたら true
export function thiefTick(g, e, dt) {
  e.life -= dt;
  if (e.life > 0) return false;
  e.alive = false;
  g.fx.burst(e.x, e.y, '#ffd24a', 14, 220, 0.5, 10);
  g.hooks.banner('ESCAPED', 'item', 'ジュエルシーフに逃げられた');
  return true;
}

// 饕餮が食べたものを 1.5 倍にして吐き出す（ダウンか撃破のとき）
export function spillEaten(g, e) {
  if (!e.eatXp && !e.eatCoin) return;
  const xp = (e.eatXp || 0) * 1.5, coin = Math.round((e.eatCoin || 0) * 1.5);
  e.eatXp = 0;
  e.eatCoin = 0;
  if (xp > 0) {
    const n = Math.min(24, Math.max(4, Math.ceil(xp / 20)));
    for (let i = 0; i < n; i++) g.dropPickup('xp', e.x, e.y, Math.max(1, Math.round(xp / n)));
  }
  if (coin > 0) {
    const n = Math.min(20, coin);
    for (let i = 0; i < n; i++) g.dropPickup('coin', e.x, e.y, Math.max(1, Math.round(coin / n)));
  }
  g.fx.burst(e.x, e.y, '#ffd23d', 24, 300, 0.7, 12);
  g.fx.text(e.x, e.y - e.r - 24, '吐き出した！', { size: 18, color: '#ffe38a', stroke: 'rgba(60,30,0,0.85)', life: 1.1 });
}

// 倒れたとき（分裂型の分裂、饕餮の吐き出し）
export function onEnemyKilled(g, e) {
  const def = ENEMIES[e.type];
  if (e.ai === 'totetsu') spillEaten(g, e);
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

export { warn };
