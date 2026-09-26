// =====================================================================
//  秘宝の絵（すべてコードで描く）
//  drawArtifact(ctx, id, size) … 原点を中心に、一辺 size の正方形に収まるように描く。
//  内部では -50〜50 の座標で描いて拡大縮小する。
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

const ART = {
  // ---------------------------------------------------------- ロードストーン（磁鉄鉱）
  lodestone(ctx) {
    // 磁力線：N 極（左端）から外へ出て、上下を大きく回り込み S 極（右端）へ戻る
    const N = [-17, 3], S = [17, 3];
    const curves = []; // 3 次ベジェの区間 [p0, c1, c2, p1]
    for (let k = 1; k <= 3; k++) {
      const w = 16 + k * 9, h = 10 + k * 9;
      for (const dir of [-1, 1]) {
        const top = [0, 3 + dir * h];
        curves.push([N, [N[0] - w, N[1] + dir * 2], [-w * 0.9, top[1]], top]);
        curves.push([top, [w * 0.9, top[1]], [S[0] + w, S[1] + dir * 2], S]);
      }
    }
    ctx.strokeStyle = 'rgba(150,190,255,0.3)';
    ctx.lineWidth = 1.1;
    for (const [p0, c1, c2, p1] of curves) {
      ctx.beginPath(); ctx.moveTo(...p0); ctx.bezierCurveTo(...c1, ...c2, ...p1); ctx.stroke();
    }
    // 磁力線に沿って並ぶ砂鉄
    ctx.fillStyle = '#b4c6e8';
    for (const [p0, c1, c2, p1] of curves) {
      for (let i = 1; i < 9; i++) {
        const t = i / 9, u = 1 - t;
        const x = u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0];
        const y = u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1];
        if (Math.abs(x) < 19 && Math.abs(y - 2) < 17) continue; // 岩に隠れる部分は描かない
        ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
      }
    }
    // 岩（黒い金属光沢）。小さめにして、磁力線と釘が見えるように
    ctx.save();
    ctx.scale(0.78, 0.78);
    glow(ctx, 'rgba(120,160,255,0.6)', 14);
    ctx.fillStyle = lin(ctx, -22, -18, 20, 22, [[0, '#6c7384'], [0.45, '#2b2f3a'], [1, '#0d0f14']]);
    ctx.beginPath();
    ctx.moveTo(-22, 2); ctx.lineTo(-14, -16); ctx.lineTo(4, -21); ctx.lineTo(20, -10); ctx.lineTo(23, 8); ctx.lineTo(10, 21); ctx.lineTo(-12, 19);
    ctx.closePath();
    ctx.fill();
    noGlow(ctx);
    // 面
    ctx.strokeStyle = 'rgba(200,215,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-14, -16); ctx.lineTo(-4, -2); ctx.lineTo(20, -10);
    ctx.moveTo(-4, -2); ctx.lineTo(10, 21);
    ctx.moveTo(-4, -2); ctx.lineTo(-22, 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(210,225,255,0.25)';
    ctx.beginPath(); ctx.moveTo(-14, -16); ctx.lineTo(4, -21); ctx.lineTo(20, -10); ctx.lineTo(-4, -2); ctx.closePath(); ctx.fill();
    // N / S の印
    ctx.font = '700 9px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6b7d'; ctx.fillText('N', -13, 8);
    ctx.fillStyle = '#6bb6ff'; ctx.fillText('S', 14, 8);
    ctx.restore();
    // 両端にくっついた鉄の釘
    const nail = (x, y, a, l) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = lin(ctx, 0, -1.2, 0, 1.2, [[0, '#d8dee8'], [1, '#6a7282']]);
      ctx.fillRect(0, -1, l, 2);
      ctx.fillRect(-1, -2.4, 2, 4.8); // 頭
      ctx.beginPath(); ctx.moveTo(l, -1); ctx.lineTo(l + 3, 0); ctx.lineTo(l, 1); ctx.fill();
      ctx.restore();
    };
    nail(-17, 2, Math.PI + 0.35, 11);
    nail(-16, 8, Math.PI - 0.25, 9);
    nail(17, -2, -0.3, 11);
    nail(16, 5, 0.25, 9);
  },

  // ---------------------------------------------------------- 護石のペンダント
  pendant(ctx) {
    // 鎖：左右の上から留め具へ向かう V 字に、交互の向きの輪をつなげる
    ctx.strokeStyle = '#e8c56a';
    ctx.lineWidth = 1.3;
    for (const side of [-1, 1]) {
      const x0 = side * 30, y0 = -44, x1 = side * 3, y1 = -14;
      const n = 8;
      const ang = Math.atan2(y1 - y0, x1 - x0);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        // 少したわませる
        const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 3;
        ctx.beginPath();
        if (i % 2) ctx.ellipse(x, y, 1.2, 2.2, ang, 0, TAU);
        else ctx.ellipse(x, y, 3, 1.8, ang, 0, TAU);
        ctx.stroke();
      }
    }
    // 留め具（鎖とペンダントをつなぐ輪）
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -12, 3.6, 4.6, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#e8c56a';
    ctx.fillRect(-2.5, -9, 5, 3);
    // 台座（金のしずく型の枠）
    glow(ctx, 'rgba(47,201,184,0.8)', 16);
    ctx.fillStyle = lin(ctx, -18, -8, 18, 34, [[0, '#fff0b0'], [0.5, '#d9a94a'], [1, '#7a5418']]);
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.bezierCurveTo(20, 4, 20, 28, 0, 36);
    ctx.bezierCurveTo(-20, 28, -20, 4, 0, -8);
    ctx.fill();
    noGlow(ctx);
    // 石（ターコイズ）
    ctx.fillStyle = rad(ctx, -4, 8, 1, 18, [[0, '#d2fff8'], [0.45, '#2fc9b8'], [1, '#0d5e57']]);
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.bezierCurveTo(14, 8, 14, 25, 0, 30);
    ctx.bezierCurveTo(-14, 25, -14, 8, 0, -1);
    ctx.fill();
    // ターコイズの網目模様
    ctx.strokeStyle = 'rgba(40,40,30,0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-7, 10); ctx.lineTo(-2, 14); ctx.lineTo(5, 12); ctx.moveTo(-2, 14); ctx.lineTo(-1, 22); ctx.lineTo(6, 24);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.ellipse(-4, 7, 3, 5, -0.4, 0, TAU); ctx.fill();
    star(ctx, 20, 4, 3.5, '#d2fff8');
    star(ctx, -18, 22, 2.4, '#d2fff8');
  },

  // ---------------------------------------------------------- 癒しの聖杯
  grail(ctx) {
    // 後光
    ctx.fillStyle = rad(ctx, 0, -12, 2, 40, [[0, 'rgba(160,255,200,0.55)'], [1, 'rgba(160,255,200,0)']]);
    ctx.beginPath(); ctx.arc(0, -12, 40, 0, TAU); ctx.fill();
    const gold = lin(ctx, -22, 0, 22, 0, [[0, '#7a5418'], [0.35, '#f7dd8c'], [0.55, '#fff6cf'], [1, '#8a6020']]);
    // 杯
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.moveTo(-22, -24);
    ctx.lineTo(22, -24);
    ctx.bezierCurveTo(22, -2, 10, 6, 4, 8);
    ctx.lineTo(4, 22);
    ctx.lineTo(16, 30);
    ctx.lineTo(-16, 30);
    ctx.lineTo(-4, 22);
    ctx.lineTo(-4, 8);
    ctx.bezierCurveTo(-10, 6, -22, -2, -22, -24);
    ctx.fill();
    // 縁
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.ellipse(0, -24, 22, 5, 0, 0, TAU); ctx.fill();
    // 満ちた癒しの水
    ctx.fillStyle = rad(ctx, 0, -24, 1, 20, [[0, '#eafff2'], [0.5, '#6dffb0'], [1, '#1f9e62']]);
    ctx.beginPath(); ctx.ellipse(0, -24, 19, 3.6, 0, 0, TAU); ctx.fill();
    // 装飾の宝石
    gemlet(ctx, 0, -10, 4.5, '#8cc8ff', '#eaf6ff', '#3a70a8');
    gemlet(ctx, -12, -14, 2.6, '#5dff9a', '#e0ffe9', '#1f8a4a', 4);
    gemlet(ctx, 12, -14, 2.6, '#5dff9a', '#e0ffe9', '#1f8a4a', 4);
    // 立ちのぼる光の粒
    ctx.fillStyle = '#c8ffdc';
    glow(ctx, '#6dffb0', 6);
    for (const [x, y, r] of [[-9, -32, 1.6], [-3, -38, 1.2], [4, -34, 1.8], [9, -41, 1.2], [-6, -44, 1], [1, -47, 1.4]]) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    noGlow(ctx);
    star(ctx, 16, -38, 3, '#d8ffe6');
    star(ctx, -15, -34, 2.2, '#d8ffe6');
  },

  // ---------------------------------------------------------- 空の宝石箱
  casket(ctx) {
    const wood = lin(ctx, 0, -10, 0, 30, [[0, '#6a3a24'], [1, '#2a140c']]);
    // 開いた蓋
    ctx.fillStyle = lin(ctx, 0, -40, 0, -6, [[0, '#8a4e30'], [1, '#4a2616']]);
    ctx.beginPath();
    ctx.moveTo(-30, -6); ctx.lineTo(-26, -36); ctx.quadraticCurveTo(0, -46, 26, -36); ctx.lineTo(30, -6);
    ctx.closePath();
    ctx.fill();
    // 蓋の内張り（ベルベット）
    ctx.fillStyle = lin(ctx, 0, -38, 0, -8, [[0, '#5a1840'], [1, '#2a0820']]);
    ctx.beginPath();
    ctx.moveTo(-25, -9); ctx.lineTo(-22, -32); ctx.quadraticCurveTo(0, -40, 22, -32); ctx.lineTo(25, -9);
    ctx.closePath();
    ctx.fill();
    // 本体
    ctx.fillStyle = wood;
    ctx.fillRect(-32, -6, 64, 36);
    // 中（空のくぼみ）
    ctx.fillStyle = '#1a0612';
    ctx.fillRect(-27, -6, 54, 10);
    ctx.fillStyle = 'rgba(120,40,90,0.9)';
    for (const x of [-16, 0, 16]) {
      ctx.beginPath(); ctx.ellipse(x, -2, 5.5, 3, 0, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (const x of [-16, 0, 16]) {
      ctx.beginPath(); ctx.ellipse(x, -1.4, 4, 2, 0, 0, TAU); ctx.fill();
    }
    // 金具
    ctx.fillStyle = '#e8c56a';
    ctx.fillRect(-32, 4, 64, 3);
    ctx.fillRect(-32, 24, 64, 3);
    ctx.beginPath(); ctx.arc(0, 15, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a140c';
    ctx.beginPath(); ctx.arc(0, 14, 1.6, 0, TAU); ctx.fill(); ctx.fillRect(-0.8, 14, 1.6, 4);
    // 空っぽの中から漏れる光
    ctx.fillStyle = rad(ctx, 0, -6, 1, 30, [[0, 'rgba(255,220,140,0.55)'], [1, 'rgba(255,220,140,0)']]);
    ctx.beginPath(); ctx.moveTo(-26, -6); ctx.lineTo(-38, -44); ctx.lineTo(38, -44); ctx.lineTo(26, -6); ctx.closePath(); ctx.fill();
    star(ctx, -18, -24, 2.5, '#fff0c0');
    star(ctx, 14, -30, 3.2, '#fff0c0');
  },

  // ---------------------------------------------------------- 研磨ホイール
  wheel(ctx) {
    // 回転の残像
    ctx.strokeStyle = 'rgba(200,230,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-4, -2, 34, -2.6, -1.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(-4, -2, 34, 0.5, 1.6); ctx.stroke();
    // 砥石の円盤
    glow(ctx, 'rgba(180,220,255,0.6)', 12);
    ctx.fillStyle = rad(ctx, -10, -10, 2, 30, [[0, '#d6dde8'], [0.6, '#8a93a3'], [1, '#4a5160']]);
    ctx.beginPath(); ctx.arc(-4, -2, 28, 0, TAU); ctx.fill();
    noGlow(ctx);
    // 粒度の模様
    ctx.fillStyle = 'rgba(40,45,60,0.35)';
    for (let i = 0; i < 60; i++) {
      const a = i * 2.4, d = 8 + (i * 7) % 18;
      ctx.fillRect(-4 + Math.cos(a) * d, -2 + Math.sin(a) * d, 1.2, 1.2);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(-4, -2, 22, 0, TAU); ctx.stroke();
    // 軸（金属のハブと六角ナット）
    ctx.fillStyle = lin(ctx, -12, -10, 4, 6, [[0, '#e8ecf2'], [1, '#5a6272']]);
    ctx.beginPath(); ctx.arc(-4, -2, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a404c';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx[i ? 'lineTo' : 'moveTo'](-4 + Math.cos(a) * 4, -2 + Math.sin(a) * 4); }
    ctx.closePath(); ctx.fill();
    // 当てられているダイヤ（砥石の縁に接する位置）
    const ca = 0.63, cx = -4 + Math.cos(ca) * 28, cy = -2 + Math.sin(ca) * 28;
    gemlet(ctx, -4 + Math.cos(ca) * 35, -2 + Math.sin(ca) * 35, 7, '#e6fbff', '#ffffff', '#7fa9c2', 8);
    // 火花：接点から回転の接線方向（右上）へ飛び散る
    ctx.strokeStyle = '#ffe9a0';
    ctx.lineWidth = 1.4;
    glow(ctx, '#ffd24a', 6);
    for (const [a, l] of [[-1.25, 16], [-0.95, 20], [-0.7, 13], [-1.5, 11], [-0.45, 9]]) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3);
      ctx.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l);
      ctx.stroke();
    }
    noGlow(ctx);
  },

  // ---------------------------------------------------------- 氷晶のルーペ
  loupe(ctx) {
    // 持ち手：レンズの枠の右下から、斜め右下へまっすぐ伸ばす
    const cx = -6, cy = -6, R = 22;
    const d = Math.SQRT1_2;
    ctx.save();
    ctx.translate(cx + R * d, cy + R * d);
    ctx.rotate(-Math.PI / 4); // +y 方向が右下を向く
    ctx.fillStyle = '#e8c56a';
    ctx.fillRect(-4, -2, 8, 7); // 枠とつながる金の口金
    ctx.fillStyle = lin(ctx, -4.5, 0, 4.5, 0, [[0, '#1a2636'], [0.5, '#6c86a8'], [1, '#1a2636']]);
    ctx.beginPath();
    ctx.moveTo(-3.5, 5); ctx.lineTo(3.5, 5); ctx.lineTo(4.5, 30); ctx.quadraticCurveTo(0, 34, -4.5, 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-1.5, 7, 1.4, 20);
    ctx.restore();
    // 枠
    glow(ctx, 'rgba(160,230,255,0.8)', 14);
    ctx.strokeStyle = lin(ctx, -26, -26, 14, 14, [[0, '#fff0b0'], [0.5, '#d9a94a'], [1, '#7a5418']]);
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(-6, -6, 22, 0, TAU); ctx.stroke();
    noGlow(ctx);
    // レンズ
    ctx.fillStyle = rad(ctx, -12, -12, 2, 24, [[0, 'rgba(230,250,255,0.9)'], [0.6, 'rgba(120,200,240,0.55)'], [1, 'rgba(40,110,170,0.6)']]);
    ctx.beginPath(); ctx.arc(-6, -6, 19.5, 0, TAU); ctx.fill();
    // 拡大された雪の結晶
    ctx.save();
    ctx.translate(-6, -6);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    glow(ctx, '#bff2ff', 6);
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, -12);
      ctx.moveTo(0, -6); ctx.lineTo(-3.5, -9.5);
      ctx.moveTo(0, -6); ctx.lineTo(3.5, -9.5);
      ctx.stroke();
    }
    ctx.restore();
    noGlow(ctx);
    // レンズの反射
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-6, -6, 15, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
    star(ctx, 20, -24, 3, '#dff6ff');
  },

  // ---------------------------------------------------------- 黄金の天秤
  scale(ctx) {
    const gold = lin(ctx, -30, 0, 30, 0, [[0, '#8a6020'], [0.5, '#fff0b0'], [1, '#8a6020']]);
    // 支柱と台
    ctx.fillStyle = gold;
    ctx.fillRect(-2.5, -26, 5, 50);
    ctx.beginPath(); ctx.moveTo(-16, 32); ctx.lineTo(16, 32); ctx.lineTo(8, 24); ctx.lineTo(-8, 24); ctx.closePath(); ctx.fill();
    // 天秤棒（少し傾いている）
    ctx.save();
    ctx.translate(0, -24);
    ctx.rotate(-0.12);
    ctx.fillRect(-32, -2, 64, 4);
    // 吊り糸と皿
    ctx.strokeStyle = '#e8c56a';
    ctx.lineWidth = 1;
    for (const [x, drop] of [[-28, 30], [28, 30]]) {
      ctx.save();
      ctx.translate(x, 0);
      ctx.rotate(0.12);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-9, drop); ctx.moveTo(0, 0); ctx.lineTo(9, drop); ctx.stroke();
      ctx.fillStyle = gold;
      ctx.beginPath(); ctx.ellipse(0, drop, 11, 3.5, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath(); ctx.ellipse(0, drop, 11, 2, 0, 0, TAU); ctx.fill();
      if (x < 0) {
        // 左の皿：皿の上に積んだ金貨（重い）
        const coin = (x, y) => {
          ctx.fillStyle = '#b07a10';
          ctx.beginPath(); ctx.ellipse(x, y + 1.2, 4.6, 1.7, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffd24a';
          ctx.beginPath(); ctx.ellipse(x, y, 4.6, 1.7, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#8a5a10'; ctx.lineWidth = 0.6; ctx.stroke();
        };
        coin(-4, drop - 1.5); coin(4, drop - 1.5); coin(0, drop - 4); coin(-2, drop - 6.5); coin(1, drop - 9);
      } else {
        // 右の皿：宝石
        gemlet(ctx, 0, drop - 5, 4.5, '#c9d63a', '#f6ffb0', '#5f6a00');
      }
      ctx.restore();
    }
    ctx.restore();
    // 頂点の飾り
    gemlet(ctx, 0, -30, 3.8, '#ffc21a', '#fff0a8', '#9a6200');
    star(ctx, -24, 12, 3, '#fff0c0');
  },

  // ---------------------------------------------------------- 職人の王冠
  crown(ctx) {
    const gold = lin(ctx, 0, -26, 0, 18, [[0, '#fff3c4'], [0.4, '#f0c850'], [1, '#8a5a18']]);
    glow(ctx, 'rgba(255,210,90,0.7)', 14);
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.moveTo(-30, 16);
    ctx.lineTo(-32, -14);
    ctx.lineTo(-16, 0);
    ctx.lineTo(-8, -24);
    ctx.lineTo(0, -4);
    ctx.lineTo(8, -24);
    ctx.lineTo(16, 0);
    ctx.lineTo(32, -14);
    ctx.lineTo(30, 16);
    ctx.closePath();
    ctx.fill();
    noGlow(ctx);
    // 帯
    ctx.fillStyle = lin(ctx, 0, 10, 0, 24, [[0, '#fff0b0'], [1, '#8a5a18']]);
    ctx.fillRect(-31, 10, 62, 12);
    ctx.strokeStyle = 'rgba(90,50,10,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-31, 10, 62, 12);
    // 先端の玉
    ctx.fillStyle = '#fff3c4';
    for (const [x, y] of [[-32, -14], [-8, -24], [8, -24], [32, -14]]) { ctx.beginPath(); ctx.arc(x, y, 2.8, 0, TAU); ctx.fill(); }
    // 宝石
    gemlet(ctx, 0, 16, 5, '#ff2d55', '#ffb3c4', '#8c0022');
    gemlet(ctx, -17, 16, 3.5, '#2f6bff', '#b8ceff', '#0a2380');
    gemlet(ctx, 17, 16, 3.5, '#12c46e', '#a6ffd0', '#005a2c');
    gemlet(ctx, 0, 2, 3, '#ffffff', '#ffffff', '#9fb8d8', 4);
    star(ctx, 26, -26, 3, '#fff0c0');
  },

  // ---------------------------------------------------------- 呪われた宝石（ホープダイヤ）
  hope(ctx) {
    // 呪いの靄
    ctx.fillStyle = rad(ctx, 0, 0, 4, 44, [[0, 'rgba(90,20,120,0.6)'], [1, 'rgba(40,0,60,0)']]);
    ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(190,80,255,0.45)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 18);
      ctx.quadraticCurveTo(Math.cos(a + 0.6) * 32, Math.sin(a + 0.6) * 32, Math.cos(a + 0.2) * 40, Math.sin(a + 0.2) * 40);
      ctx.stroke();
    }
    // 深い青のクッションカット
    glow(ctx, 'rgba(60,110,255,0.9)', 18);
    const r = 20;
    ctx.fillStyle = lin(ctx, -r, -r, r, r, [[0, '#9bb8ff'], [0.4, '#1f45c8'], [1, '#050c3a']]);
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r); ctx.lineTo(r * 0.7, -r); ctx.lineTo(r, -r * 0.6); ctx.lineTo(r, r * 0.6);
    ctx.lineTo(r * 0.7, r); ctx.lineTo(-r * 0.7, r); ctx.lineTo(-r, r * 0.6); ctx.lineTo(-r, -r * 0.6);
    ctx.closePath();
    ctx.fill();
    noGlow(ctx);
    // テーブル面
    ctx.fillStyle = 'rgba(160,190,255,0.35)';
    ctx.fillRect(-r * 0.45, -r * 0.45, r * 0.9, r * 0.9);
    ctx.strokeStyle = 'rgba(200,220,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(x * r * 0.45, y * r * 0.45); ctx.lineTo(x * r * 0.85, y * r * 0.85); }
    ctx.stroke();
    // 周りのダイヤの縁取り
    ctx.fillStyle = '#e6f0ff';
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 26, Math.sin(a) * 26, 2, 0, TAU); ctx.fill();
    }
    // 赤い不吉な光
    ctx.fillStyle = '#ff3d6e';
    glow(ctx, '#ff3d6e', 8);
    ctx.beginPath(); ctx.arc(6, -6, 2.2, 0, TAU); ctx.fill();
    noGlow(ctx);
  },

  // ---------------------------------------------------------- 流星のオルゴール
  musicbox(ctx) {
    // 流れ星
    ctx.strokeStyle = lin(ctx, -30, -40, 20, -14, [[0, 'rgba(255,240,200,0)'], [1, 'rgba(255,240,200,0.9)']]);
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-34, -42); ctx.lineTo(18, -16); ctx.stroke();
    star(ctx, 20, -15, 5, '#fff6d0');
    star(ctx, -22, -18, 2.5, '#e0d0ff');
    star(ctx, 30, -34, 2.2, '#e0d0ff');
    // 箱の本体
    ctx.fillStyle = lin(ctx, 0, -2, 0, 32, [[0, '#3a2a60'], [1, '#140c26']]);
    ctx.fillRect(-26, 0, 52, 30);
    // 開いた蓋
    ctx.fillStyle = lin(ctx, 0, -14, 0, 0, [[0, '#4a3878'], [1, '#231640']]);
    ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-22, -12); ctx.lineTo(22, -12); ctx.lineTo(26, 0); ctx.closePath(); ctx.fill();
    // 金の縁
    ctx.strokeStyle = '#e8c56a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-26, 0, 52, 30);
    ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-22, -12); ctx.lineTo(22, -12); ctx.lineTo(26, 0); ctx.stroke();
    // 前面の星座の装飾
    ctx.fillStyle = '#e8c56a';
    const pts = [[-14, 12], [-4, 20], [6, 10], [15, 18]];
    ctx.strokeStyle = 'rgba(232,197,106,0.6)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    pts.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x, y));
    ctx.stroke();
    for (const [x, y] of pts) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill(); }
    // ねじ巻き
    ctx.fillStyle = '#e8c56a';
    ctx.fillRect(26, 12, 6, 3);
    ctx.beginPath(); ctx.ellipse(34, 13.5, 3, 6, 0, 0, TAU); ctx.fill();
    // 音符
    ctx.fillStyle = '#fff0c0';
    ctx.font = '700 12px serif';
    ctx.fillText('♪', -12, -18);
    ctx.fillText('♫', 4, -24);
  },

  // ---------------------------------------------------------- 分光プリズム
  prism(ctx) {
    // 入射する白い光
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2.4;
    glow(ctx, '#ffffff', 8);
    ctx.beginPath(); ctx.moveTo(-44, 6); ctx.lineTo(-10, -2); ctx.stroke();
    noGlow(ctx);
    // 虹の帯
    const cols = ['#ff3d5a', '#ff9a3d', '#ffe03d', '#5dff7a', '#3dc8ff', '#7a5dff', '#d05dff'];
    cols.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(10, -4 + i * 1.6);
      ctx.lineTo(46, -12 + i * 6);
      ctx.lineTo(46, -6 + i * 6);
      ctx.lineTo(10, -2.4 + i * 1.6);
      ctx.closePath();
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    // 三角柱
    glow(ctx, 'rgba(220,200,255,0.8)', 12);
    ctx.fillStyle = lin(ctx, -18, -28, 18, 22, [[0, 'rgba(255,255,255,0.75)'], [0.5, 'rgba(180,200,255,0.4)'], [1, 'rgba(120,100,200,0.55)']]);
    ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(22, 20); ctx.lineTo(-22, 20); ctx.closePath(); ctx.fill();
    noGlow(ctx);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // 奥の稜線
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(6, 24); ctx.moveTo(22, 20); ctx.lineTo(6, 24); ctx.moveTo(-22, 20); ctx.lineTo(6, 24); ctx.stroke();
    // 中の光路
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-10, -2); ctx.lineTo(10, -3); ctx.stroke();
    star(ctx, -2, -32, 3, '#ffffff');
  },
};

// 秘宝 id → 絵の関数（空の宝石箱は id が box）
const MAP = { lodestone: 'lodestone', pendant: 'pendant', grail: 'grail', box: 'casket', wheel: 'wheel', loupe: 'loupe', scale: 'scale', crown: 'crown', hope: 'hope', musicbox: 'musicbox', prism: 'prism' };

export function drawArtifact(ctx, id, size) {
  const f = ART[MAP[id]];
  if (!f) return;
  ctx.save();
  const k = size / 100;
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  f(ctx);
  ctx.restore();
}
