// =====================================================================
//  工房の強化のアイコン（すべてコードで描く）
//  drawShopIcon(ctx, id, size) … 原点を中心に、一辺 size の正方形に収まるように描く。
//  内部では -50〜50 の座標で描いて拡大縮小する（秘宝の絵 artifact-art.js と同じ作り）。
// =====================================================================
const TAU = Math.PI * 2;

function glow(ctx, color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
function noGlow(ctx) { ctx.shadowBlur = 0; }
function lin(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}
function rad(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}
function halo(ctx, x, y, r, color) {
  ctx.fillStyle = rad(ctx, x, y, 1, r, [[0, color], [1, 'rgba(0,0,0,0)']]);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
function star(ctx, x, y, s, color = '#fff') {
  ctx.save();
  ctx.fillStyle = color;
  glow(ctx, color, s * 1.5);
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
  ctx.restore();
}
// 小さなカット宝石（多角形＋ハイライト）
function gemlet(ctx, x, y, r, c, light, dark, n = 6) {
  ctx.save();
  ctx.translate(x, y);
  glow(ctx, c, r * 1.2);
  ctx.fillStyle = lin(ctx, -r, -r, r, r, [[0, light], [0.5, c], [1, dark]]);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * TAU;
    ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  noGlow(ctx);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.moveTo(-r * 0.45, -r * 0.35); ctx.lineTo(0, -r * 0.7); ctx.lineTo(r * 0.1, -r * 0.2); ctx.closePath();
  ctx.fill();
  ctx.restore();
}
const STEEL = (ctx, x0, x1) => lin(ctx, x0, 0, x1, 0, [[0, '#5b6275'], [0.45, '#e9eefa'], [0.55, '#ffffff'], [1, '#6b7388']]);
const GOLD = (ctx, x0, x1) => lin(ctx, x0, 0, x1, 0, [[0, '#7a5418'], [0.4, '#f7dd8c'], [0.55, '#fff6cf'], [1, '#8a6020']]);

const ICON = {
  // ---------------------------------------------------------- 攻撃力：黄玉をはめた剣
  might(ctx) {
    halo(ctx, 0, -6, 38, 'rgba(255,200,80,0.35)');
    ctx.save();
    ctx.rotate(Math.PI / 4);
    // 刃
    glow(ctx, 'rgba(255,230,160,0.7)', 8);
    ctx.fillStyle = STEEL(ctx, -6, 6);
    ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(6, -32); ctx.lineTo(6, 14); ctx.lineTo(-6, 14); ctx.lineTo(-6, -32); ctx.closePath(); ctx.fill();
    noGlow(ctx);
    ctx.strokeStyle = 'rgba(80,90,110,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(0, 12); ctx.stroke();
    // 鍔
    ctx.fillStyle = GOLD(ctx, -18, 18);
    ctx.beginPath(); ctx.moveTo(-18, 14); ctx.quadraticCurveTo(0, 10, 18, 14); ctx.lineTo(18, 20); ctx.quadraticCurveTo(0, 17, -18, 20); ctx.closePath(); ctx.fill();
    // 柄と柄頭
    ctx.fillStyle = '#3a2a4a'; ctx.fillRect(-3.5, 20, 7, 18);
    ctx.strokeStyle = '#b89a4a'; ctx.lineWidth = 1.2;
    for (let y = 23; y < 38; y += 4) { ctx.beginPath(); ctx.moveTo(-3.5, y); ctx.lineTo(3.5, y + 2); ctx.stroke(); }
    ctx.fillStyle = GOLD(ctx, -5, 5); ctx.beginPath(); ctx.arc(0, 41, 5, 0, TAU); ctx.fill();
    gemlet(ctx, 0, 16, 5, '#ffc53d', '#fff4c4', '#a86a00');
    ctx.restore();
    star(ctx, -24, -26, 4); star(ctx, 26, 18, 2.6, '#ffe39a');
  },

  // ---------------------------------------------------------- 最大HP：碧玉のハート
  maxHp(ctx) {
    halo(ctx, 0, 0, 40, 'rgba(255,110,70,0.35)');
    ctx.scale(1.2, 1.2);
    const heart = () => {
      ctx.beginPath();
      ctx.moveTo(0, 30);
      ctx.bezierCurveTo(-36, 6, -30, -30, 0, -14);
      ctx.bezierCurveTo(30, -30, 36, 6, 0, 30);
      ctx.closePath();
    };
    glow(ctx, '#ff6a3d', 12);
    ctx.fillStyle = lin(ctx, -28, -26, 26, 30, [[0, '#ffb89a'], [0.45, '#e2502c'], [1, '#6e1a0c']]);
    heart(); ctx.fill();
    noGlow(ctx);
    // カット面
    ctx.save(); heart(); ctx.clip();
    ctx.strokeStyle = 'rgba(255,220,200,0.35)'; ctx.lineWidth = 1.2;
    for (const [x, y] of [[-16, -16], [16, -16], [-22, 4], [22, 4]]) { ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(x, y); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, 30); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.moveTo(-20, -14); ctx.lineTo(-8, -18); ctx.lineTo(-14, -4); ctx.closePath(); ctx.fill();
    ctx.restore();
    // ＋
    ctx.fillStyle = '#fff4ee'; glow(ctx, '#ffffff', 6);
    ctx.fillRect(-2.5, -6, 5, 16); ctx.fillRect(-8, -0.5, 16, 5);
    noGlow(ctx);
    star(ctx, 26, -24, 3.4);
  },

  // ---------------------------------------------------------- アーマー：花崗岩の盾
  armor(ctx) {
    halo(ctx, 0, 0, 40, 'rgba(200,190,170,0.28)');
    const shield = (s) => {
      ctx.beginPath();
      ctx.moveTo(0, -34 * s);
      ctx.quadraticCurveTo(16 * s, -26 * s, 30 * s, -26 * s);
      ctx.quadraticCurveTo(30 * s, 12 * s, 0, 36 * s);
      ctx.quadraticCurveTo(-30 * s, 12 * s, -30 * s, -26 * s);
      ctx.quadraticCurveTo(-16 * s, -26 * s, 0, -34 * s);
      ctx.closePath();
    };
    glow(ctx, 'rgba(230,230,255,0.6)', 8);
    ctx.fillStyle = STEEL(ctx, -30, 30); shield(1); ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = lin(ctx, 0, -28, 0, 30, [[0, '#4a4658'], [1, '#1c1a26']]); shield(0.78); ctx.fill();
    // 中央の筋
    ctx.strokeStyle = 'rgba(220,225,240,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(0, 26); ctx.moveTo(-20, -6); ctx.lineTo(20, -6); ctx.stroke();
    gemlet(ctx, 0, -6, 8, '#d8cfc0', '#ffffff', '#6e6456', 8);
    star(ctx, 24, -30, 3);
  },

  // ---------------------------------------------------------- 自然回復：石炭の火から立つ癒しのしずく
  regen(ctx) {
    halo(ctx, 0, -2, 40, 'rgba(90,255,160,0.28)');
    // しずく
    glow(ctx, '#5dff9a', 12);
    ctx.fillStyle = lin(ctx, -18, -30, 18, 26, [[0, '#d8ffe6'], [0.5, '#4ee08a'], [1, '#12663a']]);
    ctx.beginPath();
    ctx.moveTo(0, -36);
    ctx.bezierCurveTo(8, -20, 22, -6, 22, 8);
    ctx.bezierCurveTo(22, 22, 12, 30, 0, 30);
    ctx.bezierCurveTo(-12, 30, -22, 22, -22, 8);
    ctx.bezierCurveTo(-22, -6, -8, -20, 0, -36);
    ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(-9, 2, 4, 9, -0.3, 0, TAU); ctx.fill();
    // ＋
    ctx.fillStyle = '#0d4a2a';
    ctx.fillRect(-2.5, 2, 5, 16); ctx.fillRect(-8, 7.5, 16, 5);
    // 立ちのぼる光
    ctx.fillStyle = '#c8ffdc'; glow(ctx, '#6dffb0', 6);
    for (const [x, y, r] of [[26, -18, 1.8], [30, -28, 1.3], [-27, -14, 1.5], [-31, -26, 1.1], [22, -36, 1.2]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    noGlow(ctx);
    gemlet(ctx, 0, 38, 5, '#444050', '#9a95ad', '#141218', 6);
  },

  // ---------------------------------------------------------- クールダウン：菫青石の砂時計
  cooldown(ctx) {
    halo(ctx, 0, 0, 40, 'rgba(130,110,255,0.32)');
    // ガラス
    const glass = () => {
      ctx.beginPath();
      ctx.moveTo(-18, -30); ctx.lineTo(18, -30);
      ctx.bezierCurveTo(18, -12, 4, -6, 3, 0);
      ctx.bezierCurveTo(4, 6, 18, 12, 18, 30);
      ctx.lineTo(-18, 30);
      ctx.bezierCurveTo(-18, 12, -4, 6, -3, 0);
      ctx.bezierCurveTo(-4, -6, -18, -12, -18, -30);
      ctx.closePath();
    };
    ctx.fillStyle = 'rgba(200,210,255,0.12)'; glass(); ctx.fill();
    ctx.save(); glass(); ctx.clip();
    // 砂（上は少なく、下に積もる）
    glow(ctx, '#8a7dff', 8);
    ctx.fillStyle = lin(ctx, 0, -20, 0, 30, [[0, '#d8d0ff'], [1, '#5a44d8']]);
    ctx.beginPath(); ctx.moveTo(-10, -12); ctx.lineTo(10, -12); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-18, 30); ctx.quadraticCurveTo(0, 8, 18, 30); ctx.closePath(); ctx.fill();
    ctx.fillRect(-0.8, 0, 1.6, 22);
    noGlow(ctx);
    ctx.restore();
    ctx.strokeStyle = 'rgba(230,235,255,0.85)'; ctx.lineWidth = 1.6; glass(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-14, -26, 2.5, 12);
    // 枠
    ctx.fillStyle = GOLD(ctx, -24, 24);
    ctx.fillRect(-24, -37, 48, 7); ctx.fillRect(-24, 30, 48, 7);
    ctx.fillRect(-22, -30, 3, 60); ctx.fillRect(19, -30, 3, 60);
    gemlet(ctx, 0, -33.5, 3.6, '#7c6bff', '#e0dbff', '#2a1f8a', 4);
    gemlet(ctx, 0, 33.5, 3.6, '#7c6bff', '#e0dbff', '#2a1f8a', 4);
    star(ctx, 30, -22, 2.6);
  },

  // ---------------------------------------------------------- 攻撃範囲：広がる光の輪
  area(ctx) {
    halo(ctx, 0, 0, 44, 'rgba(230,225,255,0.25)');
    for (const [r, a, w] of [[38, 0.25, 2], [29, 0.45, 2.4], [20, 0.75, 2.8]]) {
      ctx.strokeStyle = `rgba(240,236,255,${a})`; ctx.lineWidth = w;
      glow(ctx, '#e6e0ff', 8);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    }
    noGlow(ctx);
    // 外向きの矢印
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i / 4) * TAU;
      ctx.save(); ctx.rotate(a); ctx.translate(34, 0);
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(0, -5); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    gemlet(ctx, 0, 0, 10, '#f2eefc', '#ffffff', '#a79fc6', 8);
  },

  // ---------------------------------------------------------- 弾速：藍晶石の弾丸と速度線
  speed(ctx) {
    ctx.save();
    ctx.rotate(-Math.PI / 5);
    // 速度線
    ctx.lineCap = 'round';
    for (const [y, x0, len, a] of [[-10, -40, 30, 0.35], [0, -44, 36, 0.6], [10, -40, 30, 0.35], [-18, -30, 18, 0.2], [18, -30, 18, 0.2]]) {
      ctx.strokeStyle = `rgba(140,180,255,${a})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + len, y); ctx.stroke();
    }
    // 弾
    glow(ctx, '#5a8cff', 14);
    ctx.fillStyle = lin(ctx, 0, -10, 0, 10, [[0, '#cfe0ff'], [0.5, '#2f62f0'], [1, '#0a1a66']]);
    ctx.beginPath(); ctx.moveTo(38, 0); ctx.lineTo(18, -11); ctx.lineTo(-4, -8); ctx.lineTo(-10, 0); ctx.lineTo(-4, 8); ctx.lineTo(18, 11); ctx.closePath(); ctx.fill();
    noGlow(ctx);
    ctx.strokeStyle = 'rgba(220,235,255,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(38, 0); ctx.lineTo(-10, 0); ctx.moveTo(18, -11); ctx.lineTo(18, 11); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.moveTo(30, -2); ctx.lineTo(18, -9); ctx.lineTo(6, -6); ctx.closePath(); ctx.fill();
    ctx.restore();
    star(ctx, 26, -30, 3.2);
  },

  // ---------------------------------------------------------- 持続：藍玉の懐中時計
  duration(ctx) {
    halo(ctx, 0, 4, 40, 'rgba(80,230,220,0.28)');
    // 竜頭と鎖
    ctx.strokeStyle = '#d9c27a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -36, 5, 0, TAU); ctx.stroke();
    ctx.fillStyle = GOLD(ctx, -5, 5); ctx.fillRect(-4, -32, 8, 6);
    // 本体
    glow(ctx, '#3fe0da', 10);
    ctx.fillStyle = GOLD(ctx, -30, 30); ctx.beginPath(); ctx.arc(0, 4, 30, 0, TAU); ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = rad(ctx, -6, -2, 2, 26, [[0, '#f4fffe'], [1, '#bfe8e6']]);
    ctx.beginPath(); ctx.arc(0, 4, 25, 0, TAU); ctx.fill();
    // 目盛り
    ctx.strokeStyle = '#2a5a60';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, r0 = i % 3 ? 21 : 18;
      ctx.lineWidth = i % 3 ? 1 : 2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, 4 + Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * 23, 4 + Math.sin(a) * 23); ctx.stroke();
    }
    // 針
    ctx.strokeStyle = '#123a40'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, -12); ctx.stroke();
    ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(12, 10); ctx.stroke();
    gemlet(ctx, 0, 4, 4, '#3fe0da', '#dffffd', '#0f6f76', 6);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(-10, -8, 9, 4, -0.6, 0, TAU); ctx.fill();
    star(ctx, 28, -26, 3);
  },

  // ---------------------------------------------------------- 移動速度：橄欖石の翼
  moveSpeed(ctx) {
    halo(ctx, 4, 0, 40, 'rgba(170,230,80,0.25)');
    // 翼：付け根から左上へ扇状に広がる羽根
    const base = [14, 10];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + 0.15 + i * 0.26; // 左〜左上
      const len = 44 - i * 4;
      ctx.save();
      ctx.translate(...base);
      ctx.rotate(a);
      glow(ctx, 'rgba(210,255,170,0.6)', 6);
      ctx.fillStyle = lin(ctx, 0, 0, len, 0, [[0, '#8cc83a'], [1, 'rgba(244,255,230,0.96)']]);
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(len * 0.55, -9, len, 0); ctx.quadraticCurveTo(len * 0.55, 6, 0, 4); ctx.closePath(); ctx.fill();
      noGlow(ctx);
      ctx.strokeStyle = 'rgba(70,110,25,0.55)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(len * 0.92, 0); ctx.stroke();
      ctx.restore();
    }
    // 付け根の宝石
    gemlet(ctx, 14, 10, 8, '#a8e04a', '#f0ffd0', '#4a7a10', 6);
    // 速度線
    ctx.strokeStyle = 'rgba(200,255,150,0.45)'; ctx.lineWidth = 2.4;
    for (const [y, x] of [[24, 18], [32, 10], [40, 20]]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18, y); ctx.stroke(); }
    star(ctx, -26, 26, 2.6, '#f0ffd0');
  },

  // ---------------------------------------------------------- 回収範囲：赤いU字磁石
  magnet(ctx) {
    halo(ctx, 0, 6, 40, 'rgba(255,90,110,0.28)');
    ctx.save();
    ctx.rotate(-Math.PI / 4);
    const U = (w) => {
      ctx.beginPath();
      ctx.moveTo(-22, -26); ctx.lineTo(-22, 2);
      ctx.arc(0, 2, 22, Math.PI, 0, true);
      ctx.lineTo(22, -26);
      ctx.lineWidth = w; ctx.stroke();
    };
    ctx.lineCap = 'butt';
    glow(ctx, '#ff4d6d', 10);
    ctx.strokeStyle = lin(ctx, -30, 0, 30, 0, [[0, '#7a0a22'], [0.4, '#ff4d6d'], [0.55, '#ffb3c0'], [1, '#8a0f2a']]);
    U(15);
    noGlow(ctx);
    // 極の銀
    ctx.fillStyle = STEEL(ctx, -30, -14); ctx.fillRect(-29.5, -38, 15, 12);
    ctx.fillStyle = STEEL(ctx, 14, 30); ctx.fillRect(14.5, -38, 15, 12);
    ctx.restore();
    // 引き寄せられる宝石と光の線
    ctx.strokeStyle = 'rgba(255,200,210,0.5)'; ctx.lineWidth = 1.4; ctx.setLineDash([3, 4]);
    for (const [x, y] of [[-30, -28], [-14, -40], [-36, -12]]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x * 0.55, y * 0.55); ctx.stroke(); }
    ctx.setLineDash([]);
    gemlet(ctx, -32, -30, 4, '#ff7ab8', '#ffe0ee', '#9a1f55', 4);
    gemlet(ctx, -14, -42, 3.4, '#3fc8ff', '#e0f6ff', '#10608a', 4);
    gemlet(ctx, -38, -12, 3, '#ffd23d', '#fff5c4', '#9a6a00', 4);
  },

  // ---------------------------------------------------------- 幸運：珊瑚をあしらった四つ葉
  luck(ctx) {
    halo(ctx, 0, -2, 40, 'rgba(120,255,150,0.25)');
    // 茎
    ctx.strokeStyle = '#2f9a4a'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(2, 4); ctx.quadraticCurveTo(8, 26, 20, 38); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(Math.PI / 4 + (i / 4) * TAU);
      glow(ctx, '#4dff88', 6);
      ctx.fillStyle = lin(ctx, 0, 0, 0, -28, [[0, '#1f8a3e'], [0.6, '#4ee07a'], [1, '#c8ffd6']]);
      // ハート形の葉
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.bezierCurveTo(-20, -12, -16, -32, 0, -24);
      ctx.bezierCurveTo(16, -32, 20, -12, 0, -2);
      ctx.fill();
      noGlow(ctx);
      ctx.strokeStyle = 'rgba(220,255,230,0.45)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, -22); ctx.stroke();
      ctx.restore();
    }
    gemlet(ctx, 0, 0, 6.5, '#ff7a6b', '#ffe0da', '#9a2a1f', 6);
    star(ctx, -28, -28, 3.2); star(ctx, 30, -14, 2.2, '#dfffe6');
  },

  // ---------------------------------------------------------- 成長：積み上がる経験値の結晶と上向きの矢印
  growth(ctx) {
    halo(ctx, 0, 0, 40, 'rgba(150,220,100,0.25)');
    // 上向きの光の矢印
    glow(ctx, '#b4ff6a', 10);
    ctx.fillStyle = lin(ctx, 0, 34, 0, -38, [[0, 'rgba(150,230,80,0)'], [0.5, 'rgba(170,240,100,0.6)'], [1, '#eaffd0']]);
    ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(16, -20); ctx.lineTo(6, -20); ctx.lineTo(6, 34); ctx.lineTo(-6, 34); ctx.lineTo(-6, -20); ctx.lineTo(-16, -20); ctx.closePath(); ctx.fill();
    noGlow(ctx);
    // 段々に大きくなる経験値の結晶
    gemlet(ctx, -24, 26, 5, '#7cb35a', '#e6ffd6', '#355a1f', 4);
    gemlet(ctx, -24, 8, 7, '#7cb35a', '#e6ffd6', '#355a1f', 4);
    gemlet(ctx, 24, 18, 9, '#7cb35a', '#e6ffd6', '#355a1f', 4);
    gemlet(ctx, 26, -8, 6, '#3fc8ff', '#e0f6ff', '#10608a', 4);
    star(ctx, -26, -22, 3); star(ctx, 30, -30, 2.4, '#eaffd0');
  },

  // ---------------------------------------------------------- 強欲：金貨があふれる袋
  greed(ctx) {
    halo(ctx, 0, 4, 42, 'rgba(255,200,80,0.3)');
    // 袋
    glow(ctx, 'rgba(255,210,120,0.5)', 8);
    ctx.fillStyle = lin(ctx, -26, 0, 26, 0, [[0, '#4a2e14'], [0.45, '#a8743a'], [0.6, '#c89452'], [1, '#4a2e14']]);
    ctx.beginPath();
    ctx.moveTo(-10, -12);
    ctx.bezierCurveTo(-32, 0, -30, 32, -4, 34);
    ctx.lineTo(4, 34);
    ctx.bezierCurveTo(30, 32, 32, 0, 10, -12);
    ctx.closePath(); ctx.fill();
    noGlow(ctx);
    // 口の紐
    ctx.fillStyle = '#6e4a22'; ctx.fillRect(-12, -16, 24, 6);
    ctx.strokeStyle = '#e8c56a'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-12, -13); ctx.quadraticCurveTo(-20, -4, -16, 2); ctx.stroke();
    // 袋の宝石
    gemlet(ctx, 0, 14, 6, '#ffd23d', '#fff5c4', '#9a6a00', 6);
    // あふれる金貨
    const coin = (x, y, r) => {
      ctx.fillStyle = GOLD(ctx, x - r, x + r);
      glow(ctx, '#ffd23d', 6);
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.9, 0, 0, TAU); ctx.fill();
      noGlow(ctx);
      ctx.strokeStyle = 'rgba(120,80,10,0.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y, r * 0.65, r * 0.58, 0, 0, TAU); ctx.stroke();
    };
    coin(-6, -24, 7); coin(8, -30, 6); coin(4, -18, 6.5); coin(22, -18, 5);
    star(ctx, -24, -32, 3.2); star(ctx, 30, -34, 2.4, '#fff6cf');
  },

  // ---------------------------------------------------------- クリティカル：照準とダイヤモンドの閃光
  crit(ctx) {
    halo(ctx, 0, 0, 40, 'rgba(210,240,255,0.25)');
    ctx.strokeStyle = 'rgba(255,90,110,0.9)'; ctx.lineWidth = 2.4;
    glow(ctx, '#ff4d6d', 6);
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.rotate((i / 4) * TAU);
      ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(0, -24); ctx.stroke();
      ctx.restore();
    }
    noGlow(ctx);
    // 閃光
    ctx.save();
    glow(ctx, '#ffffff', 16);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU, r = i % 2 ? 7 : 22;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.globalAlpha = 0.55; ctx.fill();
    ctx.restore();
    gemlet(ctx, 0, 0, 9, '#e6f4ff', '#ffffff', '#8aa6c8', 8);
  },

  // ---------------------------------------------------------- リロール：回る二本の矢印とラブラドライト
  reroll(ctx) {
    halo(ctx, 0, 0, 40, 'rgba(90,150,255,0.28)');
    const arcArrow = (a0, a1, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.lineCap = 'round';
      glow(ctx, color, 8);
      ctx.beginPath(); ctx.arc(0, 0, 28, a0, a1); ctx.stroke();
      const x = Math.cos(a1) * 28, y = Math.sin(a1) * 28;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a1 + Math.PI / 2);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-4, -9); ctx.lineTo(-4, 9); ctx.closePath(); ctx.fill();
      ctx.restore();
      noGlow(ctx);
    };
    arcArrow(-Math.PI * 0.95, -Math.PI * 0.15, '#6aa8ff');
    arcArrow(Math.PI * 0.05, Math.PI * 0.85, '#7ae0c8');
    gemlet(ctx, 0, 0, 11, '#5a6aa8', '#bfe8ff', '#1c2450', 6);
    // ラブラドレッセンス（遊色）
    ctx.fillStyle = 'rgba(120,255,220,0.35)';
    ctx.beginPath(); ctx.moveTo(-5, 4); ctx.lineTo(4, -2); ctx.lineTo(6, 6); ctx.closePath(); ctx.fill();
  },

  // ---------------------------------------------------------- スキップ：早送りの二重三角
  skip(ctx) {
    halo(ctx, 0, 0, 40, 'rgba(170,230,80,0.25)');
    const tri = (x) => {
      ctx.beginPath(); ctx.moveTo(x - 14, -22); ctx.lineTo(x + 14, 0); ctx.lineTo(x - 14, 22); ctx.closePath();
    };
    glow(ctx, '#b4f05a', 10);
    ctx.fillStyle = lin(ctx, -30, -20, 30, 20, [[0, '#f0ffd0'], [0.5, '#a8e04a'], [1, '#4a7a10']]);
    tri(-8); ctx.fill(); tri(14); ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.moveTo(-22, -18); ctx.lineTo(-2, -2); ctx.lineTo(-22, -6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#eaffd0'; ctx.fillRect(30, -22, 5, 44);
    star(ctx, -30, -28, 3);
  },

  // ---------------------------------------------------------- バニッシュ：黒曜石と禁止の輪
  banish(ctx) {
    halo(ctx, 0, 0, 40, 'rgba(170,90,255,0.25)');
    gemlet(ctx, 0, 0, 20, '#3a3050', '#9a8ab8', '#0c0a14', 6);
    ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 6;
    glow(ctx, '#ff4d6d', 10);
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-21, 21); ctx.lineTo(21, -21); ctx.stroke();
    noGlow(ctx);
    // 砕けて散る欠片
    ctx.fillStyle = '#9a8ab8';
    for (const [x, y, r] of [[34, -30, 3], [38, -18, 2], [26, -38, 2.2]]) {
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
    }
  },

  // ---------------------------------------------------------- リバイブ：天使石の光輪と翼
  revive(ctx) {
    halo(ctx, 0, 0, 44, 'rgba(160,210,255,0.38)');
    // 翼
    for (const s of [-1, 1]) {
      ctx.save(); ctx.scale(s, 1);
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.translate(8, 6);
        ctx.rotate(-0.9 + i * 0.32);
        glow(ctx, 'rgba(220,240,255,0.8)', 6);
        ctx.fillStyle = lin(ctx, 0, 0, 34, 0, [[0, '#8cc8ff'], [1, 'rgba(250,253,255,0.95)']]);
        const len = 34 - i * 4;
        ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(len * 0.6, -9, len, 0); ctx.quadraticCurveTo(len * 0.6, 5, 0, 4); ctx.closePath(); ctx.fill();
        noGlow(ctx);
        ctx.restore();
      }
      ctx.restore();
    }
    // 光輪
    ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 3;
    glow(ctx, '#ffe39a', 10);
    ctx.beginPath(); ctx.ellipse(0, -26, 16, 5, 0, 0, TAU); ctx.stroke();
    noGlow(ctx);
    gemlet(ctx, 0, 6, 10, '#8cc8ff', '#eaf6ff', '#3a70a8', 8);
    star(ctx, 0, 26, 3.4); star(ctx, -30, -30, 2.2, '#eaf6ff'); star(ctx, 30, -30, 2.2, '#eaf6ff');
  },

  // ---------------------------------------------------------- 弾数：扇状に飛ぶ三つの宝石弾
  amount(ctx) {
    halo(ctx, -6, 6, 40, 'rgba(120,220,160,0.25)');
    const shot = (a, c, light, dark) => {
      ctx.save();
      ctx.translate(-22, 22);
      ctx.rotate(a);
      ctx.strokeStyle = 'rgba(200,255,220,0.35)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(34, 0); ctx.stroke();
      gemlet(ctx, 46, 0, 8, c, light, dark, 4);
      ctx.restore();
    };
    shot(-Math.PI / 4 - 0.5, '#4ecb8a', '#e0ffec', '#1a6a40');
    shot(-Math.PI / 4, '#4ecb8a', '#e0ffec', '#1a6a40');
    shot(-Math.PI / 4 + 0.5, '#4ecb8a', '#e0ffec', '#1a6a40');
    // 発射口の光
    glow(ctx, '#bfffd6', 12);
    ctx.fillStyle = '#eafff2';
    ctx.beginPath(); ctx.arc(-22, 22, 5, 0, TAU); ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = '#ffffff'; glow(ctx, '#ffffff', 6);
    ctx.fillRect(-36, -34, 4, 14); ctx.fillRect(-41, -29, 14, 4);
    noGlow(ctx);
  },
};

export const SHOP_ICON_IDS = Object.keys(ICON);

export function drawShopIcon(ctx, id, size) {
  const f = ICON[id];
  if (!f) return false;
  ctx.save();
  const k = size / 100;
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  f(ctx);
  ctx.restore();
  return true;
}
