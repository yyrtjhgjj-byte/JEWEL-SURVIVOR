// =====================================================================
//  実績のメダルの絵（ブロンズ・カッパー・シルバー・ゴールド）
//  凹凸の高さ（縁・粒の輪・面取りした星・旋盤の細い筋）から面の向きを求め、金属の反射（色つきのフレネル）と
//  宝石の撮影と同じ黒い背景のソフトボックスで 1 画素ずつ色を決める。起動のあとに 1 度だけ描いて、
//  CSS の変数（--medal-<種類>）に画像として渡す（.medal の背景。css/style.css）
// =====================================================================

// f0：真上から見たときの反射の色（金属の色）。star：星の先の数と、くびれの強さ
// 青銅は暗い黄土色、銅は赤みの強い桃色がかった色。いちばん上の金だけ星を 8 本にする
const KINDS = {
  bronze: { f0: [0.5, 0.33, 0.17], star: [5, 2.6] },
  copper: { f0: [0.96, 0.52, 0.38], star: [5, 2.6] },
  silver: { f0: [0.93, 0.93, 0.94], star: [5, 2.6] },
  gold: { f0: [1.0, 0.74, 0.16], star: [8, 3.4] },
};

const SIZE = 128;
const SS = 2;

// 星の形の距離（内側が負）。n：先の数、m：くびれ（2 で直線の辺、大きいほど細い）
function sdStar(x, y, r, n, m) {
  const an = Math.PI / n, en = Math.PI / m;
  const acx = Math.cos(an), acy = Math.sin(an), ecx = Math.cos(en), ecy = Math.sin(en);
  let a = Math.atan2(x, y);
  a = ((a % (2 * an)) + 2 * an) % (2 * an) - an;
  const l = Math.hypot(x, y);
  let px = l * Math.cos(a), py = l * Math.abs(Math.sin(a));
  px -= r * acx; py -= r * acy;
  const t = Math.max(0, Math.min((r * acy) / ecy, -(px * ecx + py * ecy)));
  px += ecx * t; py += ecy * t;
  return Math.hypot(px, py) * Math.sign(px);
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 高さ（単位円の中。外は -1）
function height(x, y, K) {
  const r = Math.hypot(x, y);
  if (r > 1) return -1;
  // 外の縁：丸く盛り上がり、いちばん外は面取りして落ちる
  if (r > 0.83) {
    const t = (r - 0.83) / 0.17;
    return 0.06 + 0.1 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (t > 0.87 ? 1 - smooth(0.87, 1, t) * 0.7 : 1);
  }
  // 縁の内側の溝と、粒の輪
  if (r > 0.79) return 0.0;
  const bead = (() => {
    const N = 36, a = Math.atan2(y, x), k = Math.round((a / (2 * Math.PI)) * N);
    const ba = (k / N) * 2 * Math.PI, bx = Math.cos(ba) * 0.745, by = Math.sin(ba) * 0.745;
    const d = Math.hypot(x - bx, y - by), br = 0.026;
    return d < br ? 0.02 + Math.sqrt(br * br - d * d) * 1.4 : 0;
  })();
  if (bead) return bead;
  // 地：旋盤で挽いた細い同心の筋（わずかな凹凸）
  // 地はわずかに盛り上げる（照明の映り込みに濃淡が出るように）
  let h = 0.02 + 0.05 * (1 - (r / 0.72) ** 2);
  // 星：辺からの距離に比例して高くする（面取りした宝石のように稜線が立つ）
  const [n, m] = K.star;
  const d = sdStar(x, -y, 0.56, n, m);
  if (d < 0) h = Math.max(h, 0.07 + Math.min(0.14, -d * 0.4));
  // 星の中央の丸い台
  const c = Math.hypot(x, y);
  if (c < 0.1) h = Math.max(h, 0.12 + Math.sqrt(0.1 * 0.1 - c * c) * 0.6);
  return h;
}

// 照明（宝石の撮影と同じく、黒い背景に左上の大きなソフトボックス・右の小さな箱・下からの弱い反射）。y は画面の下向き
const LIGHTS = [
  { d: [-0.18, -0.32, 0.93], r: 0.5, I: 0.9 },
  { d: [-0.55, -0.62, 0.56], r: 0.42, I: 2.6 },
  { d: [0.72, -0.28, 0.63], r: 0.22, I: 1.6 },
  { d: [0.15, 0.82, 0.55], r: 0.4, I: 1.1 },
  { d: [-0.85, 0.3, 0.42], r: 0.18, I: 0.8 },
];
for (const L of LIGHTS) { const l = Math.hypot(...L.d); L.d = L.d.map((v) => v / l); }
function env(dx, dy, dz) {
  let v = 0.07 + 0.16 * Math.max(0, -dy) * Math.max(0, dz);
  for (const L of LIGHTS) {
    const c = dx * L.d[0] + dy * L.d[1] + dz * L.d[2];
    const a = Math.acos(Math.max(-1, Math.min(1, c)));
    v += L.I * (1 - smooth(L.r * 0.55, L.r, a));
  }
  return v;
}

function paint(kind) {
  const K = KINDS[kind];
  const W = SIZE * SS;
  const can = document.createElement('canvas');
  can.width = can.height = W;
  const ctx = can.getContext('2d');
  const img = ctx.createImageData(W, W);
  const e = 2 / W;
  for (let j = 0; j < W; j++) {
    for (let i = 0; i < W; i++) {
      const x = (i + 0.5) / W * 2 - 1, y = (j + 0.5) / W * 2 - 1;
      const h = height(x, y, K);
      const o = (j * W + i) * 4;
      if (h < 0) { img.data[o + 3] = 0; continue; }
      // 面の向き（高さの傾き。高さは見た目より強めに効かせる）
      const hx = (height(x + e, y, K) - height(x - e, y, K)) / (2 * e);
      const hy = (height(x, y + e, K) - height(x, y - e, K)) / (2 * e);
      const S = 1.6;
      let nx = -hx * S, ny = -hy * S, nz = 1;
      if (height(x + e, y, K) < 0 || height(x - e, y, K) < 0 || height(x, y + e, K) < 0 || height(x, y - e, K) < 0) { const r = Math.hypot(x, y) || 1; nx = x / r * 1.4; ny = y / r * 1.4; }
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      // 見る向きは (0,0,1)。反射の向き
      const rx = 2 * nz * nx, ry = 2 * nz * ny, rz = 2 * nz * nz - 1;
      const L = env(rx, ry, rz);
      const f = Math.pow(1 - nz, 5);
      // 溝・地の低いところは少し暗く（くぼみに光が入りにくい）
      const occ = 0.55 + 0.45 * smooth(0, 0.05, h);
      const col = K.f0.map((c) => (c + (1 - c) * f) * L * occ);
      // 明るさを丸めて 0〜1 に（白飛びしないように）
      for (let k = 0; k < 3; k++) {
        const v = col[k] * 1.45;
        img.data[o + k] = Math.round(255 * Math.pow(v / (1 + v * 0.55), 1 / 2.2));
      }
      // 外周のなめらかさ
      const r = Math.hypot(x, y);
      img.data[o + 3] = Math.round(255 * (1 - smooth(1 - e * 1.5, 1, r)));
    }
  }
  ctx.putImageData(img, 0, 0);
  const out = document.createElement('canvas');
  out.width = out.height = SIZE;
  const oc = out.getContext('2d');
  oc.imageSmoothingQuality = 'high';
  oc.drawImage(can, 0, 0, SIZE, SIZE);
  const url = out.toDataURL('image/png');
  can.width = can.height = 1;
  out.width = out.height = 1;
  return url;
}

// 起動のあとに 1 種類ずつ間をあけて描き、CSS の変数に渡す（.medal-art が付くと CSS の仮の絵から切り替わる）
export { paint as paintMedal };
export function paintMedals() {
  const ids = Object.keys(KINDS);
  const root = document.documentElement;
  let k = 0;
  const next = () => {
    if (k >= ids.length) { root.classList.add('medal-art'); return; }
    const id = ids[k++];
    try { root.style.setProperty(`--medal-${id}`, `url(${paint(id)})`); } catch (e) { return; }
    setTimeout(next, 30);
  };
  setTimeout(next, 300);
}
