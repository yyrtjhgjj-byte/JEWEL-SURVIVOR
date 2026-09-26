// =====================================================================
//  ステージ定義
//  waves: [開始秒, 出現する敵, 同時出現上限, 1秒あたりの出現数]
// =====================================================================

// ステージ1（従来）の出現表
const WAVES_WASTES = [
  [0, ['slime'], 35, 3],
  [30, ['slime', 'bat'], 50, 4],
  [60, ['slime', 'bat', 'bat'], 65, 5],
  [90, ['slime', 'bat', 'ghost'], 80, 5.5],
  [120, ['bat', 'ghost', 'ghost', 'slime'], 95, 6.5],
  [150, ['ghost', 'toge', 'bat'], 110, 7],
  [180, ['slime', 'ghost'], 70, 4],
  [210, ['toge', 'ghost', 'bat'], 130, 8],
  [240, ['toge', 'golem', 'ghost'], 145, 8.5],
  [300, ['golem', 'toge', 'bat', 'ghost'], 170, 10],
  [360, ['bat', 'ghost'], 100, 5],
  [390, ['knight', 'toge', 'golem', 'bat'], 190, 11],
  [450, ['knight', 'golem', 'ghost', 'toge'], 210, 12],
  [510, ['knight', 'knight', 'golem', 'bat', 'toge'], 240, 14],
  [570, ['knight', 'golem', 'ghost', 'toge', 'bat'], 260, 15],
  [600, ['bat', 'ghost', 'knight'], 130, 6],
];

// 共通の時間割。数字は pools の添字、'b' はボス戦中の軽い出現
const TEMPLATE = [
  [0, 0, 35, 3], [30, 0, 50, 4], [60, 1, 65, 5], [90, 1, 80, 5.5], [120, 1, 95, 6.5], [150, 2, 110, 7],
  [180, 'b', 70, 4], [210, 2, 130, 8], [240, 2, 145, 8.5], [300, 3, 170, 10], [360, 'b', 100, 5],
  [390, 3, 190, 11], [450, 3, 210, 12], [510, 4, 240, 14], [570, 4, 260, 15], [600, 'b', 130, 6],
];
function makeWaves(pools, extra = []) {
  return [...TEMPLATE, ...extra].map(([t, k, max, rate]) => [t, k === 'b' ? pools.b : pools[k], max, rate]);
}

function makeEvents(o) {
  const ev = [
    { t: 40, type: 'elite', enemy: o.e[0] },
    { t: 75, type: 'swarm', enemy: o.sw, n: 24 },
    { t: 100, type: 'elite', enemy: o.e[1] },
    { t: 140, type: 'ring', enemy: o.r[0], n: 36 },
    { t: 172, type: 'warning' },
    { t: 180, type: 'boss', enemy: o.b[0] },
    { t: 230, type: 'swarm', enemy: o.sw, n: 40 },
    { t: 260, type: 'elite', enemy: o.e[2] },
    { t: 290, type: 'ring', enemy: o.r[1], n: 44 },
    { t: 320, type: 'elite', enemy: o.e[3] },
    { t: 352, type: 'warning' },
    { t: 360, type: 'boss', enemy: o.b[1] },
    { t: 420, type: 'swarm', enemy: o.sw, n: 60 },
    { t: 440, type: 'elite', enemy: o.e[4] },
    { t: 480, type: 'ring', enemy: o.r[2], n: 50 },
    { t: 500, type: 'elite', enemy: o.e[3] },
    { t: 540, type: 'swarm', enemy: o.sw, n: 70 },
    { t: 560, type: 'elite', enemy: o.e[4] },
    { t: 575, type: 'ring', enemy: o.r[1], n: 60 },
  ];
  // 7:00 以降：ジュエルシーフと大群ラッシュ（壁・渦）で、最終ボスまでの間にやることを作る
  ev.push(
    { t: 432, type: 'thief' }, { t: 462, type: 'wall', enemy: o.sw, n: 56 }, { t: 492, type: 'thief' },
    { t: 520, type: 'vortex', enemy: o.sw, n: 64 }, { t: 548, type: 'wall', enemy: o.sw, n: 64 }, { t: 582, type: 'thief' },
  );
  if (o.b.length === 3) {
    ev.push({ t: 592, type: 'warning' }, { t: 600, type: 'boss', enemy: o.b[2] });
  } else {
    // 12分ステージ：9:00 に中ボス、12:00 に最終ボス
    ev.push(
      { t: 532, type: 'warning' }, { t: 540, type: 'boss', enemy: o.b[2] },
      { t: 605, type: 'thief' }, { t: 635, type: 'vortex', enemy: o.sw, n: 72 }, { t: 665, type: 'thief' }, { t: 692, type: 'wall', enemy: o.sw, n: 72 },
      { t: 620, type: 'elite', enemy: o.e[4] }, { t: 650, type: 'ring', enemy: o.r[2], n: 70 },
      { t: 680, type: 'swarm', enemy: o.sw, n: 90 }, { t: 700, type: 'elite', enemy: o.e[4] },
      { t: 712, type: 'warning' }, { t: 720, type: 'boss', enemy: o.b[3] },
    );
    // 9:00 のボス戦用に 540 秒前後の出現を差し替え
  }
  return ev.sort((a, b) => a.t - b.t);
}

export const STAGES = [
  {
    id: 'wastes', no: 1, name: '黒曜の荒野', en: 'OBSIDIAN WASTES', time: 600,
    desc: 'ダスクの侵攻が始まった最前線。すべてはここから。',
    hazard: null, hazardText: 'ギミックなし',
    hp: 1.0, dmg: 1.0, reward: 1000, bgm: 'stage',
    pal: { bg: '#07070d', grid: '160,140,255', mark: '200,180,255', dust: '210,200,255', glow: 'rgba(110,60,200,0.28)', accent: '#b45cff' },
    tint: null,
    waves: WAVES_WASTES,
    events: makeEvents({ e: ['slime', 'ghost', 'toge', 'golem', 'knight'], sw: 'bat', r: ['slime', 'ghost', 'toge'], b: ['boss1', 'boss2', 'boss3'] }),
    finalBoss: 'boss3',
  },
  {
    id: 'cavern', no: 2, name: '水晶洞窟', en: 'CRYSTAL CAVERN', time: 600,
    desc: '巨大な水晶柱が乱立する地下洞窟。柱は通り抜けられない。狙撃してくる敵に注意。',
    hazard: 'pillars', hazardText: '水晶柱（通行不可）',
    hp: 1.25, dmg: 1.1, reward: 1500, bgm: 'cavern', unlockChar: 'tourmaline',
    pal: { bg: '#050a10', grid: '90,200,255', mark: '140,230,255', dust: '180,240,255', glow: 'rgba(40,140,220,0.26)', accent: '#3fc8ff' },
    tint: '#3a8fb8',
    waves: makeWaves({
      0: ['slime', 'bat', 'spitter'], 1: ['bat', 'spitter', 'splitter', 'ghost'], 2: ['splitter', 'spitter', 'toge', 'ghost'],
      3: ['golem', 'splitter', 'spitter', 'toge'], 4: ['knight', 'golem', 'splitter', 'spitter', 'toge'], b: ['bat', 'spitter'],
    }),
    events: makeEvents({ e: ['spitter', 'splitter', 'toge', 'golem', 'knight'], sw: 'bat', r: ['splitter', 'spitter', 'toge'], b: ['boss1_cavern', 'boss2_cavern', 'prism'] }),
    finalBoss: 'prism',
  },
  {
    id: 'magma', no: 3, name: '灼熱鉱脈', en: 'MAGMA VEIN', time: 600,
    desc: '溶岩が噴き出す鉱脈の底。溶岩だまりは踏むとダメージ、足元が光ったら噴火の合図。',
    hazard: 'lava', hazardText: '溶岩だまり・噴火',
    hp: 1.5, dmg: 1.2, reward: 2000, bgm: 'magma', unlockChar: 'alexandrite',
    pal: { bg: '#0d0605', grid: '255,120,60', mark: '255,160,90', dust: '255,190,140', glow: 'rgba(220,70,20,0.26)', accent: '#ff6a3d' },
    tint: '#b8502a',
    waves: makeWaves({
      0: ['slime', 'bomber'], 1: ['bomber', 'bat', 'charger'], 2: ['charger', 'bomber', 'toge', 'ghost'],
      3: ['golem', 'charger', 'bomber', 'toge'], 4: ['knight', 'golem', 'charger', 'bomber'], b: ['bat', 'bomber'],
    }),
    events: makeEvents({ e: ['bomber', 'charger', 'toge', 'golem', 'knight'], sw: 'bomber', r: ['charger', 'bomber', 'golem'], b: ['boss1_magma', 'boss2_magma', 'worm'] }),
    finalBoss: 'worm',
  },
  {
    id: 'tundra', no: 4, name: '凍晶氷原', en: 'FROST EXPANSE', time: 600,
    desc: '凍てついた白銀の平原。定期的に吹雪が吹き荒れ、視界と足が奪われる。',
    hazard: 'blizzard', hazardText: '吹雪（減速・視界不良）',
    hp: 1.85, dmg: 1.3, reward: 2500, bgm: 'tundra', unlockChar: 'moonstone',
    pal: { bg: '#070a0f', grid: '200,230,255', mark: '220,240,255', dust: '235,245,255', glow: 'rgba(150,200,255,0.22)', accent: '#bfe6ff' },
    tint: '#6f8fb8',
    waves: makeWaves({
      0: ['slime', 'wisp'], 1: ['wisp', 'bat', 'splitter'], 2: ['wisp', 'charger', 'splitter', 'ghost'],
      3: ['golem', 'wisp', 'charger', 'spitter'], 4: ['knight', 'golem', 'wisp', 'charger', 'splitter'], b: ['wisp', 'bat'],
    }),
    events: makeEvents({ e: ['wisp', 'charger', 'splitter', 'golem', 'knight'], sw: 'wisp', r: ['wisp', 'splitter', 'charger'], b: ['boss1_tundra', 'boss3_tundra', 'lich'] }),
    finalBoss: 'lich',
  },
  {
    id: 'void', no: 5, name: '虚空聖堂', en: 'VOID SANCTUM', time: 720,
    desc: 'ダスクの本拠地。光は届かず、見えるのは自分の周囲だけ。歴代の強敵が待ち受ける12分間。',
    hazard: 'darkness', hazardText: '暗闇（視界縮小）・虚空の裂け目',
    hp: 1.9, dmg: 1.35, reward: 5000, bgm: 'void',
    pal: { bg: '#040308', grid: '200,90,255', mark: '230,140,255', dust: '220,170,255', glow: 'rgba(150,40,220,0.3)', accent: '#e05cff' },
    tint: '#4a2a6a',
    waves: makeWaves({
      0: ['slime', 'phantom', 'bat'], 1: ['phantom', 'spitter', 'bomber', 'ghost'], 2: ['phantom', 'splitter', 'charger', 'wisp'],
      3: ['golem', 'phantom', 'charger', 'spitter', 'bomber'], 4: ['knight', 'golem', 'phantom', 'splitter', 'charger', 'spitter'], b: ['phantom', 'bat'],
    }, [[630, 4, 270, 16], [690, 4, 280, 17], [720, 'b', 140, 6]]),
    events: makeEvents({ e: ['phantom', 'charger', 'splitter', 'golem', 'knight'], sw: 'phantom', r: ['phantom', 'spitter', 'bomber'], b: ['boss1_void', 'boss2', 'boss3_void', 'emperor'] }),
    finalBoss: 'emperor',
  },
];
// 12分ステージの 540秒前後はボス戦なので軽めに
{
  const v = STAGES[4].waves;
  const i = v.findIndex((w) => w[0] === 510);
  v.splice(i + 1, 0, [540, ['phantom', 'bat'], 120, 5], [555, v[i][1], 250, 14]);
  v.sort((a, b) => a[0] - b[0]);
}

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));

// ヒート（難易度上昇）。レベルごとの補正
export const HEAT_MAX = 5;
export function heatMods(h) {
  return {
    hp: 1 + 0.25 * h,
    dmg: 1 + 0.12 * h,
    speed: 1 + 0.05 * h,
    spawn: 1 + 0.1 * h,
    coin: 1 + 0.3 * h,
  };
}
