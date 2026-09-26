// =====================================================================
//  宝石の絵（カット別のテンプレートに、GEMS の色を乗せて描く）
//  ブリリアント系・ステップカット系・カボション・原石風の 4 系統
// =====================================================================
import { TAU, mix, rgba } from './util.js';

// 宝石ごとのカット
export const GEM_CUT = {
  diamond: 'brilliant', topaz: 'brilliant',
  sapphire: 'oval', ruby: 'oval',
  garnet: 'cushion', alexandrite: 'cushion', redberyl: 'cushion',
  emerald: 'step', aquamarine: 'step', citrine: 'step', peridot: 'step',
  iolite: 'pear',
  kyanite: 'baguette', tourmaline: 'baguette',
  titanite: 'trillion',
  opal: 'cabOval', amber: 'cabOval', angelite: 'cab', turquoise: 'cabOval', coral: 'cab',
  moonstone: 'cabOval', labradorite: 'cabOval', nephrite: 'cab', prase: 'cab', jasper: 'cabOval', rhodochrosite: 'cab',
  milkyquartz: 'crystal', granite: 'tumble', coal: 'lump',
};
export const CUT_NAMES = {
  brilliant: 'ラウンドブリリアント', oval: 'オーバル', cushion: 'クッション', pear: 'ペアシェイプ', trillion: 'トリリアント',
  step: 'エメラルドカット', baguette: 'バゲット', cab: 'カボション（丸）', cabOval: 'カボション（楕円）',
  crystal: '原石：結晶', tumble: '原石：丸石', lump: '原石：塊',
};

const LIGHT = Math.atan2(-0.8, -0.6); // 左上から光
const lit = (ang) => 0.5 + 0.5 * Math.cos(ang - LIGHT);
function shade(g, t) {
  t = Math.max(0, Math.min(1, t));
  return t < 0.5 ? mix(g.dark, g.color, t * 2) : mix(g.color, g.light, (t - 0.5) * 2);
}
// 同じ宝石なら毎回同じ模様になる乱数
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const seedOf = (g) => [...(g.en || g.color || 'x')].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);

function path(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}
function fillPoly(ctx, pts, style) { path(ctx, pts); ctx.fillStyle = style; ctx.fill(); }
function sparkle(ctx, x, y, s, color = '#fff') {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
}
function glow(ctx, g, r, pts) {
  ctx.save();
  ctx.shadowColor = g.rainbow ? '#ffffff' : g.color;
  ctx.shadowBlur = r * 0.45;
  fillPoly(ctx, pts, g.color);
  ctx.restore();
}
function rim(ctx, g, r, pts) {
  path(ctx, pts);
  ctx.strokeStyle = g.dark;
  ctx.lineWidth = Math.max(1, r * 0.07);
  ctx.lineJoin = 'round';
  ctx.stroke();
}

// ------------------------------------------------------------------ 外形（角度 → 半径）
// 外形を細かい点列で作り、角度から半径を引けるようにする
function outline(cut, r) {
  const N = 180, pts = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * TAU;
    let x, y;
    if (cut === 'brilliant') { x = Math.sin(t); y = -Math.cos(t); }
    else if (cut === 'oval') { x = Math.sin(t) * 0.76; y = -Math.cos(t); }
    else if (cut === 'cushion') {
      const c = Math.cos(t), s = Math.sin(t), n = 3.2;
      const k = Math.pow(Math.pow(Math.abs(s), n) + Math.pow(Math.abs(c), n), -1 / n);
      x = s * k * 0.88; y = -c * k * 0.88;
    } else if (cut === 'pear') {
      // 上がとがったしずく
      x = Math.sin(t) * Math.pow(Math.sin(t / 2), 1.1) * 0.8;
      y = -Math.cos(t) * 1.0;
      y = y * 1.0 + 0.05;
    } else if (cut === 'trillion') {
      // 辺が少しふくらんだ三角形
      const seg = TAU / 3;
      const a = ((t % seg) + seg) % seg - seg / 2;
      const tri = Math.cos(seg / 2) / Math.cos(a);
      const k = tri * 0.8 + 0.2 * 0.62;
      x = Math.sin(t) * k * 1.0; y = -Math.cos(t) * k * 1.0 + 0.12;
    }
    pts.push([x * r, y * r]);
  }
  const radAt = (ang) => {
    // ang の方向にいちばん近い点の半径
    let best = 0, bd = 9;
    for (const [x, y] of pts) {
      const a = Math.atan2(y, x);
      let d = Math.abs(a - ang); if (d > Math.PI) d = TAU - d;
      if (d < bd) { bd = d; best = Math.hypot(x, y); }
    }
    return best;
  };
  return { pts, radAt };
}

// ------------------------------------------------------------------ ブリリアント系
function drawBrilliant(ctx, r, g, cut) {
  const { pts, radAt } = outline(cut, r);
  const M = cut === 'trillion' ? 6 : 8;
  const off = cut === 'trillion' ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / M;
  const P = (a, k) => { const R = radAt(a) * k; return [Math.cos(a) * R, Math.sin(a) * R]; };
  const ang = (i) => off + (i / M) * TAU;
  const T = [], S = [], G = [];
  for (let i = 0; i < M; i++) {
    T.push(P(ang(i), 0.52));
    S.push(P(ang(i + 0.5), 0.78));
  }
  for (let i = 0; i < M * 2; i++) G.push(P(ang(i / 2), 1));
  glow(ctx, g, r, pts);
  fillPoly(ctx, pts, g.dark);
  const rnd = rng(seedOf(g));
  const face = (poly, a, bias) => {
    let t = lit(a) * 0.78 + bias + (rnd() - 0.5) * 0.05;
    if (g.rainbow) fillPoly(ctx, poly, mix('#ffffff', ['#ffd6f2', '#d6f0ff', '#e8ffd6', '#fff3c4'][Math.floor(rnd() * 4)], 0.6));
    else fillPoly(ctx, poly, shade(g, t));
  };
  for (let i = 0; i < M; i++) {
    const j = (i + 1) % M, h = (i - 1 + M) % M;
    // ガードル付近の三角形（上面の外周）
    // 左右で明暗を分け、きらめく縞にする
    face([S[i], G[2 * i + 1], G[(2 * i + 2) % (2 * M)]], ang(i + 0.75), 0.14);
    face([S[i], G[2 * i + 1], G[2 * i]], ang(i + 0.25), -0.16);
    // 凧形（ベゼル）
    face([T[i], S[h], G[2 * i], S[i]], ang(i), 0.1);
    // 星形
    face([T[i], T[j], S[i]], ang(i + 0.5), 0.2);
  }
  // テーブル面
  const grd = ctx.createLinearGradient(-r * 0.4, -r * 0.45, r * 0.4, r * 0.45);
  grd.addColorStop(0, g.rainbow ? '#ffffff' : g.light);
  grd.addColorStop(0.5, g.rainbow ? '#e9e0ff' : g.color);
  grd.addColorStop(1, g.rainbow ? '#d6f7ff' : mix(g.color, g.dark, 0.45));
  fillPoly(ctx, T, grd);
  // 面の境目の線
  ctx.strokeStyle = rgba('#ffffff', 0.32);
  ctx.lineWidth = Math.max(0.4, r * 0.025);
  path(ctx, T); ctx.stroke();
  for (let i = 0; i < M; i++) {
    const j = (i + 1) % M;
    ctx.beginPath();
    ctx.moveTo(T[i][0], T[i][1]); ctx.lineTo(S[i][0], S[i][1]); ctx.lineTo(T[j][0], T[j][1]);
    ctx.moveTo(S[i][0], S[i][1]); ctx.lineTo(G[2 * i + 1][0], G[2 * i + 1][1]);
    ctx.moveTo(T[i][0], T[i][1]); ctx.lineTo(G[2 * i][0], G[2 * i][1]);
    ctx.stroke();
  }
  rim(ctx, g, r, pts);
  // 光
  ctx.fillStyle = rgba('#ffffff', 0.5);
  ctx.beginPath();
  ctx.ellipse(-r * 0.2, -r * 0.24, r * 0.16, r * 0.07, -0.6, 0, TAU);
  ctx.fill();
  sparkle(ctx, -r * 0.34, -r * 0.4, r * 0.26);
  sparkle(ctx, r * 0.3, r * 0.22, r * 0.1, rgba('#ffffff', 0.8));
}

// ------------------------------------------------------------------ ステップカット系
function rectOct(w, h, c) {
  return [[-w + c, -h], [w - c, -h], [w, -h + c], [w, h - c], [w - c, h], [-w + c, h], [-w, h - c], [-w, -h + c]];
}
function drawStep(ctx, r, g, cut) {
  const long = cut === 'baguette';
  const W = long ? r * 0.44 : r * 0.74, H = r, C = long ? r * 0.06 : r * 0.24;
  const rings = [1, 0.8, 0.62, 0.46].map((k) => rectOct(W * k, H * (long ? 0.94 + k * 0.06 : k), C * k));
  const outer = rings[0];
  glow(ctx, g, r, outer);
  fillPoly(ctx, outer, g.dark);
  // 側面の向き（上・右上・右・右下・下・左下・左・左上）
  const dirs = [-Math.PI / 2, -Math.PI / 4, 0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, (-3 * Math.PI) / 4];
  for (let k = 0; k < rings.length - 1; k++) {
    const a = rings[k], b = rings[k + 1];
    for (let i = 0; i < 8; i++) {
      const i2 = (i + 1) % 8;
      // 段ごとに明暗を入れ替え、合わせ鏡のような縞を作る
      const t = lit(dirs[(i + 1) % 8] ?? 0) * 0.75 + (k % 2 ? -0.12 : 0.12);
      fillPoly(ctx, [a[i], a[i2], b[i2], b[i]], g.rainbow ? mix('#ffffff', '#e0d6ff', t) : shade(g, t));
    }
  }
  const table = rings[rings.length - 1];
  const grd = ctx.createLinearGradient(-W * 0.4, -H * 0.4, W * 0.4, H * 0.4);
  grd.addColorStop(0, g.light);
  grd.addColorStop(0.55, g.color);
  grd.addColorStop(1, mix(g.color, g.dark, 0.35));
  fillPoly(ctx, table, grd);
  ctx.strokeStyle = rgba('#ffffff', 0.3);
  ctx.lineWidth = Math.max(0.4, r * 0.025);
  for (const rg of rings.slice(1)) { path(ctx, rg); ctx.stroke(); }
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(rings[0][i][0], rings[0][i][1]);
    ctx.lineTo(table[i][0], table[i][1]);
    ctx.stroke();
  }
  rim(ctx, g, r, outer);
  ctx.fillStyle = rgba('#ffffff', 0.45);
  ctx.fillRect(-W * 0.34, -H * 0.36, W * 0.2, H * 0.08);
  sparkle(ctx, -W * 0.5, -H * 0.5, r * 0.24);
  sparkle(ctx, W * 0.4, H * 0.3, r * 0.1, rgba('#ffffff', 0.8));
}

// ------------------------------------------------------------------ カボション
function ellipsePts(rx, ry, n = 48) {
  const p = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; p.push([Math.cos(a) * rx, Math.sin(a) * ry]); }
  return p;
}
function drawCab(ctx, r, g, cut, id) {
  const rx = cut === 'cabOval' ? r * 0.76 : r * 0.92, ry = cut === 'cabOval' ? r : r * 0.92;
  const shape = ellipsePts(rx, ry);
  glow(ctx, g, r, shape);
  // ドームの明暗
  const grd = ctx.createRadialGradient(-rx * 0.35, -ry * 0.4, r * 0.05, 0, 0, Math.max(rx, ry));
  grd.addColorStop(0, g.light);
  grd.addColorStop(0.45, g.color);
  grd.addColorStop(1, g.dark);
  fillPoly(ctx, shape, grd);
  ctx.save();
  path(ctx, shape);
  ctx.clip();
  const rnd = rng(seedOf(g));
  // 石ごとの模様
  if (id === 'opal' || g.rainbow) {
    // 遊色：色の斑点
    ctx.globalCompositeOperation = 'lighter';
    const cols = ['#ff7ad0', '#6ad8ff', '#8dff9a', '#ffd86a', '#b98cff', '#5affe0'];
    for (let i = 0; i < 16; i++) {
      const x = (rnd() - 0.5) * rx * 1.6, y = (rnd() - 0.5) * ry * 1.6, s = r * (0.12 + rnd() * 0.16);
      ctx.fillStyle = rgba(cols[i % cols.length], 0.45);
      ctx.beginPath();
      ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.8, y); ctx.lineTo(x, y + s * 0.7); ctx.lineTo(x - s * 0.9, y + s * 0.1);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  } else if (id === 'labradorite' || g.shimmer) {
    // 本体は暗い灰色、斜めに青と金の光の帯
    fillPoly(ctx, shape, rgba('#26323d', 0.7));
    const band = ctx.createLinearGradient(-rx, ry * 0.6, rx, -ry * 0.6);
    band.addColorStop(0.2, 'rgba(0,0,0,0)');
    band.addColorStop(0.42, rgba('#3fb6ff', 0.85));
    band.addColorStop(0.55, rgba('#6affd8', 0.7));
    band.addColorStop(0.66, rgba('#ffd24a', 0.55));
    band.addColorStop(0.8, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    fillPoly(ctx, shape, band);
    ctx.globalCompositeOperation = 'source-over';
  } else if (id === 'moonstone') {
    // 青白い揺らめき
    const s = ctx.createRadialGradient(rx * 0.1, -ry * 0.1, 0, rx * 0.1, -ry * 0.1, r * 0.5);
    s.addColorStop(0, rgba('#bfe0ff', 0.4));
    s.addColorStop(1, rgba('#bfe0ff', 0));
    ctx.globalCompositeOperation = 'lighter';
    fillPoly(ctx, shape, s);
    ctx.globalCompositeOperation = 'source-over';
  } else if (id === 'turquoise') {
    // 母岩の黒い網目
    ctx.strokeStyle = rgba('#3a2e22', 0.55);
    ctx.lineWidth = Math.max(0.5, r * 0.035);
    for (let i = 0; i < 6; i++) {
      let x = (rnd() - 0.5) * rx * 2, y = (rnd() - 0.5) * ry * 2;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * r * 0.5; y += (rnd() - 0.5) * r * 0.5; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  } else if (id === 'rhodochrosite') {
    // 断面の縞：ゆるく波打つ平行な帯を、白と濃いピンクで交互に重ねる（インカローズの縞模様）
    ctx.save();
    ctx.rotate(-0.35);
    let y = -r * 1.1;
    let k = 0;
    while (y < r * 1.1) {
      const h = r * (0.06 + rnd() * 0.12);
      const light = k % 2 === 0;
      ctx.fillStyle = light ? rgba('#fff0f3', 0.32 + rnd() * 0.2) : rgba(g.dark, 0.18 + rnd() * 0.15);
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const x = -r * 1.2 + (i / 24) * r * 2.4;
        const w = Math.sin(i * 0.5 + k) * r * 0.04;
        i ? ctx.lineTo(x, y + w) : ctx.moveTo(x, y + w);
      }
      for (let i = 24; i >= 0; i--) {
        const x = -r * 1.2 + (i / 24) * r * 2.4;
        const w = Math.sin(i * 0.5 + k + 0.6) * r * 0.04;
        ctx.lineTo(x, y + h + w);
      }
      ctx.fill();
      y += h + r * (0.02 + rnd() * 0.08);
      k++;
    }
    ctx.restore();
  } else if (id === 'jasper') {
    // 流れるような縞
    ctx.strokeStyle = rgba(g.dark, 0.28);
    ctx.lineWidth = Math.max(0.5, r * 0.05);
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const x = -rx + (i / 20) * rx * 2, y = k * ry * 0.38 + Math.sin(i * 0.35 + k * 1.7) * r * 0.2 + (rnd() - 0.5) * r * 0.03;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  } else if (id === 'amber') {
    // 内側からの温かい光と小さな気泡
    const s = ctx.createRadialGradient(0, ry * 0.15, 0, 0, ry * 0.15, r * 0.7);
    s.addColorStop(0, rgba('#fff0a0', 0.6));
    s.addColorStop(1, rgba('#fff0a0', 0));
    fillPoly(ctx, shape, s);
    ctx.fillStyle = rgba('#fff6d0', 0.5);
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc((rnd() - 0.5) * rx, (rnd() - 0.3) * ry, r * (0.03 + rnd() * 0.03), 0, TAU); ctx.fill(); }
  } else if (id === 'nephrite' || id === 'prase' || id === 'angelite' || id === 'coral') {
    // やわらかい雲のような濃淡
    for (let i = 0; i < 7; i++) {
      const x = (rnd() - 0.5) * rx * 1.5, y = (rnd() - 0.5) * ry * 1.5, s = r * (0.2 + rnd() * 0.25);
      const c = ctx.createRadialGradient(x, y, 0, x, y, s);
      c.addColorStop(0, rgba(rnd() < 0.5 ? g.light : g.dark, 0.22));
      c.addColorStop(1, rgba(g.color, 0));
      fillPoly(ctx, shape, c);
    }
  }
  // 縁の影と、下からの照り返し
  const edge = ctx.createRadialGradient(0, 0, Math.min(rx, ry) * 0.7, 0, 0, Math.max(rx, ry));
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,0.35)');
  fillPoly(ctx, shape, edge);
  ctx.restore();
  rim(ctx, g, r * 0.8, shape);
  // つやの光（ドームなので大きめのハイライト）
  ctx.fillStyle = rgba('#ffffff', 0.6);
  ctx.beginPath();
  ctx.ellipse(-rx * 0.34, -ry * 0.44, rx * 0.3, ry * 0.13, -0.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.18);
  ctx.beginPath();
  ctx.ellipse(rx * 0.3, ry * 0.5, rx * 0.28, ry * 0.08, -0.4, 0, TAU);
  ctx.fill();
  sparkle(ctx, -rx * 0.46, -ry * 0.5, r * 0.18);
}

// ------------------------------------------------------------------ 原石風
function drawCrystal(ctx, r, g) {
  // 六角柱の結晶（上がとがる）。少し傾ける
  ctx.save();
  ctx.rotate(0.22);
  const w = r * 0.42, top = -r, shoulder = -r * 0.45, bot = r * 0.95;
  const outer = [[0, top], [w, shoulder], [w, bot], [-w, bot], [-w, shoulder]];
  glow(ctx, g, r, outer);
  // 面：左・中央・右
  fillPoly(ctx, [[-w, shoulder], [-w * 0.3, shoulder + r * 0.08], [-w * 0.3, bot], [-w, bot]], shade(g, 0.8));
  fillPoly(ctx, [[-w * 0.3, shoulder + r * 0.08], [w * 0.35, shoulder + r * 0.08], [w * 0.35, bot], [-w * 0.3, bot]], shade(g, 0.55));
  fillPoly(ctx, [[w * 0.35, shoulder + r * 0.08], [w, shoulder], [w, bot], [w * 0.35, bot]], shade(g, 0.25));
  // とがった先
  fillPoly(ctx, [[0, top], [-w, shoulder], [-w * 0.3, shoulder + r * 0.08]], shade(g, 0.95));
  fillPoly(ctx, [[0, top], [-w * 0.3, shoulder + r * 0.08], [w * 0.35, shoulder + r * 0.08]], shade(g, 0.7));
  fillPoly(ctx, [[0, top], [w * 0.35, shoulder + r * 0.08], [w, shoulder]], shade(g, 0.35));
  // 乳白の濁り（下ほど白く濁る）
  const m = ctx.createLinearGradient(0, bot, 0, top);
  m.addColorStop(0, rgba('#ffffff', 0.45));
  m.addColorStop(0.7, rgba('#ffffff', 0.05));
  fillPoly(ctx, outer, m);
  ctx.strokeStyle = rgba('#ffffff', 0.35);
  ctx.lineWidth = Math.max(0.4, r * 0.025);
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, bot); ctx.lineTo(-w * 0.3, shoulder + r * 0.08); ctx.lineTo(0, top);
  ctx.moveTo(w * 0.35, bot); ctx.lineTo(w * 0.35, shoulder + r * 0.08); ctx.lineTo(0, top);
  ctx.moveTo(-w * 0.3, shoulder + r * 0.08); ctx.lineTo(w * 0.35, shoulder + r * 0.08);
  ctx.stroke();
  rim(ctx, g, r, outer);
  sparkle(ctx, -w * 0.55, shoulder + r * 0.1, r * 0.2);
  ctx.restore();
}
function blob(r, seed, n = 11, jitter = 0.16, sx = 0.92, sy = 0.8) {
  const rnd = rng(seed), p = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, k = 1 - jitter + rnd() * jitter * 2;
    p.push([Math.cos(a) * r * sx * k, Math.sin(a) * r * sy * k + r * 0.05]);
  }
  return p;
}
function drawTumble(ctx, r, g) {
  // 丸く磨かれた石。黒・白・桃色の粒が混ざる（花崗岩）
  const shape = blob(r, seedOf(g), 16, 0.07, 0.95, 0.78);
  glow(ctx, g, r * 0.6, shape);
  const grd = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.05, 0, 0, r);
  grd.addColorStop(0, g.light);
  grd.addColorStop(0.5, g.color);
  grd.addColorStop(1, g.dark);
  fillPoly(ctx, shape, grd);
  ctx.save();
  path(ctx, shape);
  ctx.clip();
  const rnd = rng(seedOf(g) + 3);
  const cols = ['#1c1c22', '#f4f0ec', '#d9a8a0', '#5a5660', '#ffffff'];
  for (let i = 0; i < 70; i++) {
    const x = (rnd() - 0.5) * r * 1.9, y = (rnd() - 0.5) * r * 1.6, s = r * (0.03 + rnd() * 0.07);
    ctx.fillStyle = rgba(cols[Math.floor(rnd() * cols.length)], 0.75);
    ctx.beginPath();
    ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x + s * 0.2, y + s); ctx.lineTo(x - s, y + s * 0.2);
    ctx.fill();
  }
  const edge = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, r);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,0.4)');
  fillPoly(ctx, shape, edge);
  ctx.restore();
  rim(ctx, g, r * 0.7, shape);
  ctx.fillStyle = rgba('#ffffff', 0.45);
  ctx.beginPath();
  ctx.ellipse(-r * 0.36, -r * 0.34, r * 0.24, r * 0.1, -0.5, 0, TAU);
  ctx.fill();
}
function drawLump(ctx, r, g) {
  // 角ばった黒い塊。割れ面がつやつやと光る（石炭）
  const shape = blob(r, seedOf(g), 8, 0.2, 0.95, 0.85);
  glow(ctx, g, r * 0.5, shape);
  fillPoly(ctx, shape, g.dark);
  const c = [r * 0.05, r * 0.02];
  const rnd = rng(seedOf(g) + 9);
  for (let i = 0; i < shape.length; i++) {
    const a = shape[i], b = shape[(i + 1) % shape.length];
    const mid = Math.atan2((a[1] + b[1]) / 2, (a[0] + b[0]) / 2);
    const t = lit(mid) * 0.9 + (rnd() - 0.5) * 0.3;
    fillPoly(ctx, [a, b, c], shade(g, t * 0.8));
  }
  ctx.strokeStyle = rgba('#ffffff', 0.25);
  ctx.lineWidth = Math.max(0.4, r * 0.025);
  for (const p of shape) { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); }
  rim(ctx, g, r, shape);
  ctx.fillStyle = rgba('#ffffff', 0.55);
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.35); ctx.lineTo(-r * 0.15, -r * 0.55); ctx.lineTo(-r * 0.25, -r * 0.4);
  ctx.fill();
  sparkle(ctx, -r * 0.4, -r * 0.45, r * 0.16);
}

// ------------------------------------------------------------------ 入口
// 原点に半径 r の宝石を描く。cut を省くと GEM_CUT から選ぶ
export function drawCutGem(ctx, r, g, id, cut = GEM_CUT[id] || 'brilliant') {
  ctx.save();
  if (cut === 'step' || cut === 'baguette') drawStep(ctx, r, g, cut);
  else if (cut === 'cab' || cut === 'cabOval') drawCab(ctx, r, g, cut, id);
  else if (cut === 'crystal') drawCrystal(ctx, r, g);
  else if (cut === 'tumble') drawTumble(ctx, r, g);
  else if (cut === 'lump') drawLump(ctx, r, g);
  else drawBrilliant(ctx, r, g, cut);
  ctx.restore();
}
