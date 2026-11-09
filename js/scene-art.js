// =====================================================================
//  ステージの風景（ステージ選択のカードの背景）。1 度だけ描いて dataURL を使い回す
// =====================================================================
import { iconBegin } from './render.js';
import { TAU } from './util.js';

const W = 360, H = 130, K = 2;
const cache = new Map();

// 決まった乱数（ステージごとに同じ絵になるように）
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const lin = (ctx, x0, y0, x1, y1, stops) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
};
const rad = (ctx, x, y, r, stops) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
};
function sky(ctx, top, bottom) {
  ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, top], [1, bottom]]);
  ctx.fillRect(0, 0, W, H);
}
function glow(ctx, x, y, r, col) {
  ctx.fillStyle = rad(ctx, x, y, r, [[0, col], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
// 山並みの影（jag が大きいほどギザギザ）
function ridge(ctx, R, y0, amp, step, jag, fill) {
  ctx.beginPath();
  ctx.moveTo(0, H);
  let y = y0;
  for (let x = 0; x <= W + step; x += step) {
    y = Math.max(y0 - amp, Math.min(y0 + amp * 0.4, y + (R() - 0.5) * jag));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function dots(ctx, R, n, col, rMax, yMax = H) {
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = 0.3 + R() * 0.7;
    ctx.beginPath();
    ctx.arc(R() * W, R() * yMax, 0.3 + R() * rMax, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function spike(ctx, x, base, w, h, fill, edge) {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, base);
  ctx.lineTo(x + w * 0.1, base - h);
  ctx.lineTo(x + w / 2, base);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.1, base - h);
    ctx.lineTo(x + w / 2, base);
    ctx.stroke();
  }
}
// 水墨の山（上が濃く、下へ霞む）
function inkMountain(ctx, x, base, w, h, col) {
  ctx.fillStyle = lin(ctx, 0, base - h, 0, base, [[0, col], [1, 'rgba(0,0,0,0)']]);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, base);
  ctx.quadraticCurveTo(x - w * 0.22, base - h * 0.55, x - w * 0.06, base - h);
  ctx.quadraticCurveTo(x + w * 0.04, base - h * 1.04, x + w * 0.12, base - h * 0.86);
  ctx.quadraticCurveTo(x + w * 0.3, base - h * 0.4, x + w / 2, base);
  ctx.closePath();
  ctx.fill();
}

const SCENES = {
  // 黒曜の荒野：赤紫の地平と、黒曜石の尖った岩
  wastes(ctx, R) {
    sky(ctx, '#0b0716', '#2b0f30');
    glow(ctx, 250, 92, 120, 'rgba(255,70,140,0.42)');
    dots(ctx, R, 30, '#d8c8ff', 0.9, 60);
    ridge(ctx, R, 84, 14, 10, 10, '#1a0f28');
    // 黒曜石の塊：割れた面の片側だけ紫に光る
    for (let i = 0; i < 7; i++) {
      const x = 140 + i * 34 + R() * 12, h = 26 + R() * 50, w = 22 + R() * 22, tip = x + (R() - 0.3) * w * 0.5;
      const base = H - 4;
      ctx.fillStyle = '#08060e';
      ctx.beginPath();
      ctx.moveTo(x - w / 2, base);
      ctx.lineTo(x - w * 0.36, base - h * 0.55);
      ctx.lineTo(tip, base - h);
      ctx.lineTo(x + w * 0.42, base - h * 0.4);
      ctx.lineTo(x + w / 2, base);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = lin(ctx, tip, base - h, x + w / 2, base, [[0, 'rgba(190,120,255,0.55)'], [1, 'rgba(60,20,90,0.2)']]);
      ctx.beginPath();
      ctx.moveTo(tip, base - h);
      ctx.lineTo(x + w * 0.42, base - h * 0.4);
      ctx.lineTo(x + w / 2, base);
      ctx.lineTo(x + w * 0.08, base);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(225,180,255,0.8)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(tip, base - h);
      ctx.lineTo(x + w * 0.42, base - h * 0.4);
      ctx.stroke();
    }
    ctx.fillStyle = '#06040a';
    ctx.fillRect(0, 118, W, 12);
    for (let i = 0; i < 6; i++) glow(ctx, 160 + R() * 200, 112 + R() * 12, 6, 'rgba(190,110,255,0.8)');
  },
  // 水晶洞窟：天井のつららと、光る水晶柱
  cavern(ctx, R) {
    sky(ctx, '#03080f', '#0a1e30');
    glow(ctx, 270, 80, 110, 'rgba(60,180,255,0.3)');
    ctx.fillStyle = '#02060b';
    for (let x = 0; x < W; x += 14) spike(ctx, x, 0, 16, -(8 + R() * 26), '#02060b');
    for (let i = 0; i < 8; i++) {
      const x = 150 + i * 28 + R() * 14, h = 30 + R() * 64, w = 9 + R() * 8;
      ctx.save();
      ctx.shadowColor = '#5fd8ff';
      ctx.shadowBlur = 12;
      ctx.fillStyle = lin(ctx, x - w, 0, x + w, 0, [[0, 'rgba(70,170,230,0.85)'], [0.5, 'rgba(210,250,255,0.95)'], [1, 'rgba(40,120,200,0.85)']]);
      ctx.beginPath();
      ctx.moveTo(x - w / 2, H);
      ctx.lineTo(x - w / 2, H - h);
      ctx.lineTo(x, H - h - w * 0.9);
      ctx.lineTo(x + w / 2, H - h);
      ctx.lineTo(x + w / 2, H);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = lin(ctx, 0, 116, 0, H, [[0, 'rgba(10,40,60,0.9)'], [1, '#020810']]);
    ctx.fillRect(0, 116, W, 14);
    dots(ctx, R, 24, '#bff0ff', 0.8);
  },
  // 灼熱鉱脈：溶岩の川と火の粉
  magma(ctx, R) {
    sky(ctx, '#140504', '#3a0e05');
    glow(ctx, 260, 120, 140, 'rgba(255,110,30,0.45)');
    ridge(ctx, R, 70, 22, 12, 16, '#1c0806');
    ridge(ctx, R, 92, 12, 9, 10, '#100403');
    ctx.fillStyle = lin(ctx, 0, 104, 0, H, [[0, '#ffd27a'], [0.4, '#ff7a22'], [1, '#a82208']]);
    ctx.beginPath();
    ctx.moveTo(0, 112);
    for (let x = 0; x <= W; x += 12) ctx.lineTo(x, 108 + Math.sin(x * 0.05) * 3 + R() * 2);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
    dots(ctx, R, 40, '#ffb35a', 1.2, 100);
  },
  // 凍晶氷原：オーロラと雪原、氷の棘
  tundra(ctx, R) {
    sky(ctx, '#0a1424', '#28405a');
    ctx.fillStyle = lin(ctx, 0, 10, 0, 60, [[0, 'rgba(120,255,200,0)'], [0.5, 'rgba(120,255,200,0.28)'], [1, 'rgba(120,200,255,0)']]);
    ctx.beginPath();
    ctx.moveTo(0, 30);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 26 + Math.sin(x * 0.03) * 12);
    for (let x = W; x >= 0; x -= 20) ctx.lineTo(x, 56 + Math.sin(x * 0.03 + 1) * 10);
    ctx.fill();
    ridge(ctx, R, 88, 12, 18, 10, '#3e5a74');
    ridge(ctx, R, 104, 8, 16, 8, lin(ctx, 0, 96, 0, H, [[0, '#8fb0c8'], [1, '#2a3e52']]));
    for (let i = 0; i < 7; i++) spike(ctx, 160 + R() * 200, H - 4, 8 + R() * 10, 16 + R() * 34, 'rgba(190,235,255,0.9)', '#ffffff');
    dots(ctx, R, 60, '#ffffff', 1.1);
  },
  // 虚空聖堂：尖塔のアーチと、紫の裂け目
  void(ctx, R) {
    sky(ctx, '#020104', '#0a0412');
    glow(ctx, 250, 64, 70, 'rgba(200,80,255,0.45)');
    ctx.save();
    ctx.shadowColor = '#e05cff';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = '#f0b8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let y = 18;
    ctx.moveTo(250, y);
    while (y < 112) { y += 8; ctx.lineTo(250 + (R() - 0.5) * 12, y); }
    ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 5; i++) {
      const x = 120 + i * 58, w = 34, h = 96;
      ctx.strokeStyle = 'rgba(160,90,220,0.55)';
      ctx.fillStyle = '#05030a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, H);
      ctx.lineTo(x - w / 2, H - h * 0.55);
      ctx.quadraticCurveTo(x - w / 2, H - h, x, H - h - 6);
      ctx.quadraticCurveTo(x + w / 2, H - h, x + w / 2, H - h * 0.55);
      ctx.lineTo(x + w / 2, H);
      ctx.lineTo(x + w / 2 - 6, H);
      ctx.lineTo(x + w / 2 - 6, H - h * 0.55);
      ctx.quadraticCurveTo(x + w / 2 - 6, H - h + 10, x, H - h + 4);
      ctx.quadraticCurveTo(x - w / 2 + 6, H - h + 10, x - w / 2 + 6, H - h * 0.55);
      ctx.lineTo(x - w / 2 + 6, H);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    dots(ctx, R, 30, '#d9a8ff', 0.9);
  },
  // 深海：差し込む光の筋、海藻、泡
  deep(ctx, R) {
    sky(ctx, '#03203a', '#000308');
    for (let i = 0; i < 5; i++) {
      const x = 170 + i * 40 + R() * 20;
      ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, 'rgba(160,220,255,0.22)'], [1, 'rgba(160,220,255,0)']]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 14, 0);
      ctx.lineTo(x + 50, H);
      ctx.lineTo(x + 20, H);
      ctx.fill();
    }
    ctx.strokeStyle = '#04140f';
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const x = 130 + R() * 230, h = 30 + R() * 60;
      ctx.lineWidth = 3 + R() * 3;
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.bezierCurveTo(x - 10, H - h * 0.3, x + 10, H - h * 0.7, x - 4, H - h);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(190,235,255,0.7)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      ctx.arc(150 + R() * 210, R() * H, 1 + R() * 3, 0, TAU);
      ctx.stroke();
    }
  },
  // ルルイエ：傾いた巨石の都と緑の月
  rlyeh(ctx, R) {
    sky(ctx, '#020a07', '#0a2a1c');
    glow(ctx, 290, 34, 40, 'rgba(120,255,170,0.5)');
    ctx.fillStyle = '#c9ffd8';
    ctx.beginPath();
    ctx.arc(290, 34, 12, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 9; i++) {
      const x = 130 + i * 26 + R() * 10, w = 12 + R() * 14, h = 30 + R() * 40, sk = (R() - 0.5) * 18;
      ctx.fillStyle = 'rgba(20,70,50,0.5)';
      ctx.beginPath();
      ctx.moveTo(x, H - 10);
      ctx.lineTo(x + sk, H - 10 - h);
      ctx.lineTo(x + w + sk * 0.4, H - 10 - h - R() * 10);
      ctx.lineTo(x + w, H - 10);
      ctx.fill();
    }
    for (let i = 0; i < 8; i++) {
      const x = 140 + i * 28 + R() * 10, w = 16 + R() * 18, h = 40 + R() * 60, sk = (R() - 0.5) * 22;
      ctx.fillStyle = lin(ctx, x, H - h, x + w, H, [[0, '#0d3324'], [1, '#020a06']]);
      ctx.strokeStyle = 'rgba(80,230,150,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(x + sk, H - h);
      ctx.lineTo(x + w + sk * 0.4, H - h - R() * 14);
      ctx.lineTo(x + w, H);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(20,80,60,0.55)';
    ctx.fillRect(0, 112, W, 18);
  },
  // ハリ湖：月と湖面の光、岸辺のお茶会
  lake(ctx, R) {
    sky(ctx, '#0b1018', '#202a3a');
    glow(ctx, 250, 34, 50, 'rgba(220,230,255,0.4)');
    ctx.fillStyle = '#eef2ff';
    ctx.beginPath();
    ctx.arc(250, 34, 13, 0, TAU);
    ctx.fill();
    ridge(ctx, R, 74, 6, 12, 6, '#0d121c');
    ctx.fillStyle = lin(ctx, 0, 76, 0, H, [[0, '#1a2436'], [1, '#070a10']]);
    ctx.fillRect(0, 76, W, H - 76);
    ctx.fillStyle = 'rgba(230,236,255,0.5)';
    for (let i = 0; i < 9; i++) ctx.fillRect(244 - i * 1.5 + R() * 4, 80 + i * 5, 12 + i * 3, 1.4);
    ctx.fillStyle = 'rgba(200,210,240,0.12)';
    for (let i = 0; i < 3; i++) ctx.fillRect(0, 70 + i * 9, W, 4);
    // 岸のテーブルとティーポット
    ctx.fillStyle = '#05070b';
    ctx.fillRect(150, 108, 46, 3);
    ctx.fillRect(156, 111, 3, 14);
    ctx.fillRect(187, 111, 3, 14);
    ctx.beginPath();
    ctx.ellipse(170, 103, 7, 5, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(176, 101, 6, 2);
    ctx.fillRect(184, 104, 6, 4);
  },
  // カルコサ：二つの太陽と黒い星、尖塔の都
  carcosa(ctx, R) {
    sky(ctx, '#1a1206', '#5a3a0c');
    glow(ctx, 240, 82, 90, 'rgba(255,200,80,0.5)');
    for (const [x, r] of [[226, 14], [262, 9]]) {
      ctx.fillStyle = '#ffe9a0';
      ctx.beginPath();
      ctx.arc(x, 84, r, 0, TAU);
      ctx.fill();
    }
    for (let i = 0; i < 14; i++) {
      const x = 140 + R() * 220, y = 8 + R() * 40;
      glow(ctx, x, y, 5, 'rgba(255,220,120,0.5)');
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#0d0904';
    for (let i = 0; i < 10; i++) {
      const x = 130 + i * 24 + R() * 8, h = 22 + R() * 40;
      ctx.fillRect(x, H - h, 9, h);
      ctx.beginPath();
      ctx.moveTo(x - 2, H - h);
      ctx.lineTo(x + 4.5, H - h - 12 - R() * 10);
      ctx.lineTo(x + 11, H - h);
      ctx.fill();
    }
    ctx.fillRect(0, 118, W, 12);
  },
  // 宇宙の旅：星の海、環のある惑星、黒い石板
  space(ctx, R) {
    sky(ctx, '#020208', '#0a0a1c');
    dots(ctx, R, 120, '#ffffff', 0.9);
    glow(ctx, 300, 40, 60, 'rgba(130,150,255,0.35)');
    ctx.fillStyle = lin(ctx, 280, 20, 320, 60, [[0, '#a9b8ff'], [1, '#2a2f6a']]);
    ctx.beginPath();
    ctx.arc(300, 40, 18, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(210,220,255,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(300, 40, 32, 7, -0.3, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.strokeStyle = 'rgba(160,170,255,0.6)';
    ctx.lineWidth = 1;
    ctx.fillRect(196, 50, 18, 76);
    ctx.strokeRect(196, 50, 18, 76);
    ctx.fillStyle = '#05050a';
    ctx.fillRect(0, 124, W, 6);
  },
  // アザトース：渦巻く混沌と泡
  azathoth(ctx, R) {
    sky(ctx, '#05020a', '#120624');
    glow(ctx, 260, 64, 110, 'rgba(180,70,255,0.45)');
    glow(ctx, 220, 50, 60, 'rgba(255,90,200,0.35)');
    glow(ctx, 300, 90, 70, 'rgba(80,140,255,0.35)');
    ctx.strokeStyle = 'rgba(230,180,255,0.5)';
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      for (let t = 0; t < 26; t += 0.2) {
        const r = 4 + t * 3.2, a = t * 0.55 + k * (TAU / 4);
        const x = 260 + Math.cos(a) * r, y = 64 + Math.sin(a) * r * 0.6;
        t ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const x = 150 + R() * 210, y = 10 + R() * 110, r = 4 + R() * 9;
      ctx.fillStyle = rad(ctx, x - r * 0.3, y - r * 0.3, r, [[0, 'rgba(255,255,255,0.8)'], [0.4, 'rgba(200,140,255,0.35)'], [1, 'rgba(120,60,220,0.15)']]);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
  },
  // 窮奇（北・玄）：水墨の山と吹きすさぶ風
  yushu(ctx, R) {
    sky(ctx, '#0a0f1a', '#1c2636');
    ctx.fillStyle = '#d8e0f0';
    ctx.beginPath();
    ctx.arc(300, 30, 11, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1c2636';
    ctx.beginPath();
    ctx.arc(305, 27, 10, 0, TAU);
    ctx.fill();
    inkMountain(ctx, 200, 120, 140, 78, 'rgba(120,150,200,0.55)');
    inkMountain(ctx, 300, 125, 150, 92, 'rgba(70,95,140,0.75)');
    inkMountain(ctx, 250, 130, 120, 54, 'rgba(10,14,24,0.95)');
    ctx.strokeStyle = 'rgba(220,235,255,0.5)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const y = 30 + R() * 70, x = 130 + R() * 120;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 40, y - 10, x + 80, y + 10, x + 110, y - 4);
      ctx.stroke();
    }
  },
  // 檮杌（東・青）：青い山と逆巻く濁流
  uzan(ctx, R) {
    sky(ctx, '#06100f', '#123028');
    inkMountain(ctx, 230, 110, 150, 84, 'rgba(70,170,150,0.5)');
    inkMountain(ctx, 320, 112, 120, 66, 'rgba(40,110,100,0.7)');
    for (let row = 0; row < 3; row++) {
      const y0 = 96 + row * 11;
      ctx.fillStyle = ['#1f6a5e', '#14483f', '#0a2a25'][row];
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 6) ctx.lineTo(x, y0 + Math.sin(x * 0.06 + row) * 4);
      ctx.lineTo(W, H);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(220,255,245,0.75)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const x = 140 + i * 38 + R() * 10, y = 96 + R() * 8;
      ctx.beginPath();
      ctx.arc(x, y, 6, Math.PI, Math.PI * 2.3);
      ctx.stroke();
    }
  },
  // 饕餮（西・白）：三危山と青銅の鼎
  sanki(ctx, R) {
    sky(ctx, '#151410', '#3a362a');
    glow(ctx, 250, 70, 100, 'rgba(240,225,180,0.25)');
    inkMountain(ctx, 200, 112, 90, 60, 'rgba(200,190,160,0.45)');
    inkMountain(ctx, 255, 112, 110, 84, 'rgba(170,160,130,0.55)');
    inkMountain(ctx, 315, 112, 90, 56, 'rgba(200,190,160,0.45)');
    ctx.fillStyle = '#0e0c08';
    ctx.fillRect(0, 112, W, 18);
    // 鼎
    const x = 255, y = 112;
    ctx.fillStyle = lin(ctx, x - 16, 0, x + 16, 0, [[0, '#4a3a1c'], [0.5, '#b8955a'], [1, '#3a2c14']]);
    ctx.beginPath();
    ctx.moveTo(x - 15, y - 22);
    ctx.lineTo(x + 15, y - 22);
    ctx.quadraticCurveTo(x + 16, y - 6, x, y - 5);
    ctx.quadraticCurveTo(x - 16, y - 6, x - 15, y - 22);
    ctx.fill();
    ctx.fillRect(x - 12, y - 6, 3, 8);
    ctx.fillRect(x + 9, y - 6, 3, 8);
    ctx.fillRect(x - 1.5, y - 5, 3, 7);
    ctx.fillRect(x - 13, y - 28, 3, 7);
    ctx.fillRect(x + 10, y - 28, 3, 7);
    dots(ctx, R, 20, '#f0e8d0', 0.7, 90);
  },
  // 渾沌（中央・黄）：黄土の大地と舞の輪
  chuou(ctx, R) {
    sky(ctx, '#1a1006', '#4a2c0a');
    glow(ctx, 250, 70, 120, 'rgba(255,170,60,0.4)');
    ctx.fillStyle = '#ffd890';
    ctx.beginPath();
    ctx.arc(250, 62, 16, 0, TAU);
    ctx.fill();
    ctx.fillStyle = lin(ctx, 0, 84, 0, H, [[0, '#5a3610'], [1, '#1c1004']]);
    ctx.fillRect(0, 84, W, H - 84);
    ctx.strokeStyle = 'rgba(255,215,140,0.6)';
    for (let i = 1; i <= 4; i++) {
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(250, 108, i * 26, i * 6, 0, 0, TAU);
      ctx.stroke();
    }
    dots(ctx, R, 30, '#ffe0a0', 0.9);
  },
  // ---------------------------------------------------------------- 第4章（錬金術）
  // 焼成：灰の空と、火を噴く炉（アタノール）
  calcinatio(ctx, R) {
    sky(ctx, '#140806', '#3a160c');
    glow(ctx, 255, 92, 120, 'rgba(255,110,40,0.45)');
    ridge(ctx, R, 104, 10, 12, 8, '#1a0c08');
    // 炉の塔
    const x = 255, base = 118;
    ctx.fillStyle = lin(ctx, x - 26, 0, x + 26, 0, [[0, '#2a1810'], [0.5, '#5a3424'], [1, '#22140c']]);
    ctx.beginPath();
    ctx.moveTo(x - 28, base);
    ctx.lineTo(x - 22, base - 52);
    ctx.quadraticCurveTo(x, base - 74, x + 22, base - 52);
    ctx.lineTo(x + 28, base);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,100,70,0.5)';
    ctx.lineWidth = 0.8;
    for (let y = base - 8; y > base - 56; y -= 9) {
      ctx.beginPath();
      ctx.moveTo(x - 26, y);
      ctx.lineTo(x + 26, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#0c0402';
    ctx.beginPath();
    ctx.arc(x, base - 14, 11, Math.PI, 0);
    ctx.lineTo(x + 11, base);
    ctx.lineTo(x - 11, base);
    ctx.fill();
    glow(ctx, x, base - 10, 26, 'rgba(255,200,80,0.9)');
    // 煙突の炎
    ctx.fillStyle = '#ff8a3d';
    ctx.beginPath();
    ctx.moveTo(x - 8, base - 66);
    ctx.quadraticCurveTo(x - 6, base - 90, x + 2, base - 104);
    ctx.quadraticCurveTo(x + 6, base - 86, x + 8, base - 66);
    ctx.fill();
    glow(ctx, x, base - 78, 30, 'rgba(255,140,60,0.5)');
    ctx.fillStyle = '#0a0503';
    ctx.fillRect(0, base, W, H - base);
    dots(ctx, R, 40, '#ffb070', 0.9, 110);
  },
  // 溶解：上の空がそのまま湖に映る（下なるものは上なるもののごとし）
  solutio(ctx, R) {
    const hy = 72;
    sky(ctx, '#050c16', '#0a1e30');
    glow(ctx, 250, 40, 80, 'rgba(120,200,255,0.35)');
    ctx.fillStyle = '#e8f6ff';
    ctx.beginPath();
    ctx.arc(250, 38, 12, 0, TAU);
    ctx.fill();
    dots(ctx, R, 24, '#d8f0ff', 0.8, hy - 6);
    // 水面より下は、空を上下にひっくり返した映り込み
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, hy, W, H - hy);
    ctx.clip();
    ctx.fillStyle = lin(ctx, 0, hy, 0, H, [[0, '#0a1e30'], [1, '#04101c']]);
    ctx.fillRect(0, hy, W, H - hy);
    glow(ctx, 250, hy * 2 - 40, 70, 'rgba(120,200,255,0.25)');
    ctx.fillStyle = 'rgba(232,246,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(250, hy * 2 - 38, 12, 11, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,240,255,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const y = hy + 6 + i * 6, x = 180 + R() * 60, w = 30 + R() * 80;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(180,230,255,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, hy);
    ctx.lineTo(W, hy);
    ctx.stroke();
  },
  // 分離：上は白く軽いもの（昇る鷲）、下は重い大地。境に光の筋
  separatio(ctx, R) {
    sky(ctx, '#1a1a24', '#3a3a4a');
    glow(ctx, 250, 30, 110, 'rgba(240,240,255,0.3)');
    // 白い鷲の影
    ctx.fillStyle = 'rgba(245,248,255,0.9)';
    const ex = 255, ey = 34;
    ctx.beginPath();
    ctx.moveTo(ex, ey + 6);
    ctx.quadraticCurveTo(ex - 18, ey - 10, ex - 40, ey - 4);
    ctx.quadraticCurveTo(ex - 20, ey + 2, ex - 6, ey + 10);
    ctx.lineTo(ex, ey + 18);
    ctx.lineTo(ex + 6, ey + 10);
    ctx.quadraticCurveTo(ex + 20, ey + 2, ex + 40, ey - 4);
    ctx.quadraticCurveTo(ex + 18, ey - 10, ex, ey + 6);
    ctx.fill();
    dots(ctx, R, 20, '#ffffff', 0.7, 70);
    // 境の光
    ctx.fillStyle = lin(ctx, 0, 78, 0, 90, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(235,240,255,0.7)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 78, W, 12);
    // 重い大地と岩
    ctx.fillStyle = lin(ctx, 0, 88, 0, H, [[0, '#2a2620'], [1, '#0c0a08']]);
    ctx.fillRect(0, 88, W, H - 88);
    for (let i = 0; i < 6; i++) {
      const x = 150 + i * 36 + R() * 14, w = 18 + R() * 16, h = 8 + R() * 10;
      ctx.fillStyle = '#16120e';
      ctx.beginPath();
      ctx.ellipse(x, 104 + R() * 10, w, h, 0, 0, TAU);
      ctx.fill();
    }
  },
  // 結合：太陽と月が寄り添い、光が結ばれる
  coniunctio(ctx, R) {
    sky(ctx, '#0e0b06', '#2c2410');
    glow(ctx, 250, 56, 110, 'rgba(255,220,140,0.35)');
    dots(ctx, R, 26, '#fff2c0', 0.8, 90);
    // 太陽
    ctx.fillStyle = '#ffd23d';
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      ctx.beginPath();
      ctx.moveTo(228 + Math.cos(a - 0.12) * 18, 56 + Math.sin(a - 0.12) * 18);
      ctx.lineTo(228 + Math.cos(a) * 30, 56 + Math.sin(a) * 30);
      ctx.lineTo(228 + Math.cos(a + 0.12) * 18, 56 + Math.sin(a + 0.12) * 18);
      ctx.fill();
    }
    ctx.fillStyle = rad(ctx, 224, 52, 20, [[0, '#fff6c0'], [1, '#ffb03d']]);
    ctx.beginPath();
    ctx.arc(228, 56, 19, 0, TAU);
    ctx.fill();
    // 月（太陽に重なる）
    ctx.fillStyle = '#dfe6ff';
    ctx.beginPath();
    ctx.arc(266, 56, 19, Math.PI * 0.35, Math.PI * 1.65);
    ctx.arc(276, 56, 15, Math.PI * 1.55, Math.PI * 0.45, true);
    ctx.closePath();
    ctx.fill();
    glow(ctx, 248, 56, 30, 'rgba(255,255,255,0.45)');
    ctx.fillStyle = lin(ctx, 0, 100, 0, H, [[0, '#2a2210'], [1, '#0a0804']]);
    ctx.fillRect(0, 100, W, H - 100);
    ctx.strokeStyle = 'rgba(255,230,160,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(248, 112, 70, 7, 0, 0, TAU);
    ctx.stroke();
  },
  // 発酵：緑の霧の沼と、地平に広がる孔雀の尾の虹
  fermentatio(ctx, R) {
    sky(ctx, '#06100a', '#12301e');
    const cols = ['#ff5f7a', '#ffb03d', '#ffe85f', '#7fff8a', '#5fd0ff', '#9a7fff'];
    ctx.lineWidth = 5;
    cols.forEach((c, i) => {
      ctx.strokeStyle = c;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(250, 110, 92 - i * 7, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    // 目玉模様
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (1.12 + (i / 6) * 0.76);
      const x = 250 + Math.cos(a) * 100, y = 110 + Math.sin(a) * 100;
      ctx.fillStyle = '#e8c040';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#2f6aa8';
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = lin(ctx, 0, 96, 0, H, [[0, 'rgba(30,80,50,0.9)'], [1, '#04100a']]);
    ctx.fillRect(0, 96, W, H - 96);
    ctx.strokeStyle = 'rgba(180,255,210,0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.arc(140 + R() * 200, 100 + R() * 26, 1.5 + R() * 3, 0, TAU);
      ctx.stroke();
    }
    glow(ctx, 250, 100, 120, 'rgba(120,255,170,0.18)');
  },
  // 蒸留：ガラスの蒸留器から昇る湯気と、降る雫
  distillatio(ctx, R) {
    sky(ctx, '#0a0e12', '#1e2a34');
    glow(ctx, 250, 40, 100, 'rgba(200,235,255,0.3)');
    // 雲
    ctx.fillStyle = 'rgba(220,235,245,0.35)';
    for (const [x, y, w] of [[220, 26, 40], [260, 22, 46], [300, 28, 34]]) {
      ctx.beginPath();
      ctx.ellipse(x, y, w, 10, 0, 0, TAU);
      ctx.fill();
    }
    // 雫
    ctx.fillStyle = 'rgba(210,240,255,0.85)';
    for (let i = 0; i < 10; i++) {
      const x = 180 + R() * 150, y = 38 + R() * 40;
      ctx.beginPath();
      ctx.moveTo(x, y - 4);
      ctx.quadraticCurveTo(x + 2.5, y, x, y + 2.5);
      ctx.quadraticCurveTo(x - 2.5, y, x, y - 4);
      ctx.fill();
    }
    // 蒸留器（ガラスの球と首）
    const x = 250, y = 106;
    ctx.strokeStyle = 'rgba(220,245,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(160,220,255,0.18)';
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 17);
    ctx.lineTo(x - 4, y - 32);
    ctx.quadraticCurveTo(x + 10, y - 44, x + 36, y - 30);
    ctx.moveTo(x + 4, y - 17);
    ctx.lineTo(x + 4, y - 29);
    ctx.quadraticCurveTo(x + 14, y - 36, x + 36, y - 24);
    ctx.stroke();
    ctx.fillStyle = 'rgba(120,200,255,0.55)';
    ctx.beginPath();
    ctx.arc(x, y, 16, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = 'rgba(235,248,255,0.5)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x - 6 + i * 6, y - 36);
      ctx.bezierCurveTo(x - 12 + i * 6, y - 52, x + i * 6, y - 60, x - 6 + i * 6, y - 74);
      ctx.stroke();
    }
    ctx.fillStyle = '#0a0e12';
    ctx.fillRect(0, 124, W, 6);
  },
  // 凝固：紅の空に浮かぶ賢者の石と、それを囲む己の尾を噛む蛇
  coagulatio(ctx, R) {
    sky(ctx, '#140406', '#3a0c14');
    glow(ctx, 250, 62, 110, 'rgba(255,60,80,0.45)');
    dots(ctx, R, 30, '#ffd27a', 0.9, 120);
    // 輪になった蛇
    ctx.strokeStyle = '#3a8a4a';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(250, 62, 40, 0.35, TAU - 0.1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,215,120,0.8)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(250, 62, 40, 0.35, TAU - 0.1);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#4a9a5a';
    ctx.beginPath();
    ctx.ellipse(250 + Math.cos(0.2) * 40, 62 + Math.sin(0.2) * 40, 8, 6, 0.2 + Math.PI / 2, 0, TAU);
    ctx.fill();
    // 賢者の石（赤い宝石）
    const sx = 250, sy = 62;
    ctx.fillStyle = lin(ctx, sx - 16, sy - 18, sx + 16, sy + 18, [[0, '#ffb0c0'], [0.5, '#d82a4a'], [1, '#5a0a1a']]);
    ctx.beginPath();
    ctx.moveTo(sx, sy - 22);
    ctx.lineTo(sx + 16, sy - 6);
    ctx.lineTo(sx + 10, sy + 18);
    ctx.lineTo(sx - 10, sy + 18);
    ctx.lineTo(sx - 16, sy - 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,230,0.8)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 22);
    ctx.lineTo(sx, sy + 18);
    ctx.moveTo(sx - 16, sy - 6);
    ctx.lineTo(sx + 16, sy - 6);
    ctx.stroke();
    glow(ctx, sx, sy, 34, 'rgba(255,120,140,0.5)');
    ctx.fillStyle = lin(ctx, 0, 112, 0, H, [[0, '#2a0a0e'], [1, '#0a0204']]);
    ctx.fillRect(0, 112, W, H - 112);
  },
};

// ステージの風景の dataURL（JPEG。キャッシュする）
// 描き済みの風景（まだなら null）
export const stageSceneCached = (id) => cache.get(id) || null;

export function stageScene(id, seed = 1) {
  let u = cache.get(id);
  if (u) return u;
  const draw = SCENES[id];
  if (!draw) return null;
  const c = iconBegin(W * K, H * K);
  const ctx = c.getContext('2d');
  ctx.setTransform(K, 0, 0, K, 0, 0);
  draw(ctx, rng(seed * 7919 + 13));
  u = c.toDataURL('image/jpeg', 0.86);
  c.width = c.height = 1;
  cache.set(id, u);
  return u;
}
