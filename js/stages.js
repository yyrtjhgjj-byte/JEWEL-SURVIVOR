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
    { t: 180, type: 'boss', enemy: o.b[0], mul: (o.bm || [])[0] },
    { t: 230, type: 'swarm', enemy: o.sw, n: 40 },
    { t: 260, type: 'elite', enemy: o.e[2] },
    { t: 290, type: 'ring', enemy: o.r[1], n: 44 },
    { t: 320, type: 'elite', enemy: o.e[3] },
    { t: 352, type: 'warning' },
    { t: 360, type: 'boss', enemy: o.b[1], mul: (o.bm || [])[1] },
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
    id: 'wastes', no: 1, chapter: 1, name: '黒曜の荒野', en: 'OBSIDIAN WASTES', time: 600,
    desc: 'すべてはここから。',
    hazard: null, hazardText: 'ギミックなし',
    hp: 1.0, dmg: 1.0, reward: 1000, bgm: 'stage',
    pal: { bg: '#100c1c', grid: '160,140,255', mark: '200,180,255', dust: '210,200,255', glow: 'rgba(110,60,200,0.28)', accent: '#b45cff' },
    tint: null,
    waves: WAVES_WASTES,
    events: makeEvents({ e: ['slime', 'ghost', 'toge', 'golem', 'knight'], sw: 'bat', r: ['slime', 'ghost', 'toge'], b: ['boss1', 'boss2', 'boss3'] }),
    finalBoss: 'boss3',
  },
  {
    id: 'cavern', no: 2, chapter: 1, name: '水晶洞窟', en: 'CRYSTAL CAVERN', time: 600,
    desc: '巨大な水晶柱が乱立する地下洞窟。柱は通り抜けられない。狙撃してくる敵に注意。',
    hazard: 'pillars', hazardText: '水晶柱（通行不可）',
    hp: 1.0, dmg: 1.1, reward: 1500, bgm: 'cavern', unlockChar: 'tourmaline',
    pal: { bg: '#0a1622', grid: '90,200,255', mark: '140,230,255', dust: '180,240,255', glow: 'rgba(40,140,220,0.26)', accent: '#3fc8ff' },
    tint: '#3a8fb8',
    waves: makeWaves({
      0: ['slime', 'bat', 'spitter'], 1: ['bat', 'spitter', 'splitter', 'ghost'], 2: ['splitter', 'spitter', 'toge', 'ghost'],
      3: ['golem', 'splitter', 'spitter', 'toge'], 4: ['knight', 'golem', 'splitter', 'spitter', 'toge'], b: ['bat', 'spitter'],
    }),
    events: makeEvents({ e: ['spitter', 'splitter', 'toge', 'golem', 'knight'], sw: 'bat', r: ['splitter', 'spitter', 'toge'], b: ['boss1_cavern', 'boss2_cavern', 'prism'] }),
    finalBoss: 'prism',
  },
  {
    id: 'magma', no: 3, chapter: 1, name: '灼熱鉱脈', en: 'MAGMA VEIN', time: 600,
    desc: '溶岩が噴き出す鉱脈の底。溶岩だまりは踏むとダメージ、足元が光ったら噴火の合図。',
    hazard: 'lava', hazardText: '溶岩だまり・噴火',
    hp: 1.2, dmg: 1.2, reward: 2000, bgm: 'magma', unlockChar: 'alexandrite',
    pal: { bg: '#1c0c08', grid: '255,120,60', mark: '255,160,90', dust: '255,190,140', glow: 'rgba(220,70,20,0.26)', accent: '#ff6a3d' },
    tint: '#b8502a',
    waves: makeWaves({
      0: ['slime', 'bomber'], 1: ['bomber', 'bat', 'charger'], 2: ['charger', 'bomber', 'toge', 'ghost'],
      3: ['golem', 'charger', 'bomber', 'toge'], 4: ['knight', 'golem', 'charger', 'bomber'], b: ['bat', 'bomber'],
    }),
    events: makeEvents({ e: ['bomber', 'charger', 'toge', 'golem', 'knight'], sw: 'bomber', r: ['charger', 'bomber', 'golem'], b: ['boss1_magma', 'boss2_magma', 'worm'] }),
    finalBoss: 'worm',
  },
  {
    id: 'tundra', no: 4, chapter: 1, name: '凍晶氷原', en: 'FROST EXPANSE', time: 600,
    desc: '凍てついた白銀の平原。定期的に吹雪が吹き荒れ、視界と足が奪われる。',
    hazard: 'blizzard', hazardText: '吹雪（減速・視界不良）',
    hp: 1.0, dmg: 1.3, reward: 2500, bgm: 'tundra', unlockChar: 'moonstone',
    pal: { bg: '#101824', grid: '200,230,255', mark: '220,240,255', dust: '235,245,255', glow: 'rgba(150,200,255,0.22)', accent: '#bfe6ff' },
    tint: '#6f8fb8',
    waves: makeWaves({
      0: ['slime', 'wisp'], 1: ['wisp', 'bat', 'splitter'], 2: ['wisp', 'charger', 'splitter', 'ghost'],
      3: ['golem', 'wisp', 'charger', 'spitter'], 4: ['knight', 'golem', 'wisp', 'charger', 'splitter'], b: ['wisp', 'bat'],
    }),
    events: makeEvents({ e: ['wisp', 'charger', 'splitter', 'golem', 'knight'], sw: 'wisp', r: ['wisp', 'splitter', 'charger'], b: ['boss1_tundra', 'boss3_tundra', 'lich'] }),
    finalBoss: 'lich',
  },
  {
    id: 'void', no: 5, chapter: 1, name: '虚空聖堂', en: 'VOID SANCTUM', time: 720,
    desc: '光は届かず、見えるのは自分の周囲だけ。歴代の強敵が待ち受ける。',
    hazard: 'darkness', hazardText: '暗闇（視界縮小）・虚空の裂け目',
    hp: 1.0, dmg: 1.35, reward: 5000, bgm: 'void', unlockChar: 'obsidian',
    pal: { bg: '#040308', grid: '200,90,255', mark: '230,140,255', dust: '220,170,255', glow: 'rgba(150,40,220,0.3)', accent: '#e05cff' },
    tint: '#4a2a6a',
    waves: makeWaves({
      0: ['slime', 'phantom', 'bat'], 1: ['phantom', 'spitter', 'bomber', 'ghost'], 2: ['phantom', 'splitter', 'charger', 'wisp'],
      3: ['golem', 'phantom', 'charger', 'spitter', 'bomber'], 4: ['knight', 'golem', 'phantom', 'splitter', 'charger', 'spitter'], b: ['phantom', 'bat'],
    }, [[630, 4, 270, 16], [690, 4, 280, 17], [720, 'b', 140, 6]]),
    events: makeEvents({ e: ['phantom', 'charger', 'splitter', 'golem', 'knight'], sw: 'phantom', r: ['phantom', 'spitter', 'bomber'], b: ['boss1_void', 'boss2', 'boss3_void', 'emperor'], bm: [1, 0.59] }), // bm：ボスの HP の倍率（ほかのステージと共通のボス用）
    finalBoss: 'emperor',
  },
  // ---------------------------------------------------------------- 第2章
  {
    id: 'deep', no: 6, chapter: 2, name: 'ドキドキ！？深海探索ツアー！', en: 'DEEP SEA TOUR', time: 600,
    desc: '光の届かない海の底へご招待。泡の噴き出す場所に入ると、しばらく速く泳げる。',
    hazard: 'bubbles', hazardText: '泡の噴出口（入ると加速）',
    hp: 1.4, dmg: 1.45, reward: 6000, bgm: 'deep',
    pal: { bg: '#02060c', grid: '60,140,220', mark: '90,190,255', dust: '160,220,255', glow: 'rgba(20,90,180,0.28)', accent: '#3fa8ff' },
    tint: null,
    waves: makeWaves({
      0: ['jelly', 'eel'], 1: ['jelly', 'eel', 'angler'], 2: ['angler', 'squid', 'crab', 'jelly'],
      3: ['crab', 'squid', 'angler', 'eel'], 4: ['deepone', 'crab', 'squid', 'angler', 'eel'], b: ['eel', 'jelly'],
    }),
    events: makeEvents({ e: ['angler', 'squid', 'crab', 'crab', 'deepone'], sw: 'eel', r: ['jelly', 'angler', 'crab'], b: ['boss1_deep', 'boss2_deep', 'dagon'] }),
    finalBoss: 'dagon',
  },
  {
    id: 'rlyeh', no: 7, chapter: 2, name: 'ワクワク！？ルルイエ探検ツアー！', en: "R'LYEH EXPEDITION", time: 600,
    desc: '海の底から浮かび上がった、角度の狂った石の都。歪んだ門に入ると、その先へ跳ばされる。',
    hazard: 'portals', hazardText: '歪んだ門（入ると先へ跳ぶ）',
    hp: 1.6, dmg: 1.55, reward: 7000, bgm: 'rlyeh',
    pal: { bg: '#08140f', grid: '80,220,150', mark: '120,255,180', dust: '160,255,200', glow: 'rgba(30,160,90,0.26)', accent: '#3fe08a' },
    tint: '#3a8a6a',
    waves: makeWaves({
      0: ['spawn', 'byakhee'], 1: ['spawn', 'byakhee', 'eyes'], 2: ['eyes', 'thorn', 'mindeye', 'byakhee'],
      3: ['crawler', 'thorn', 'mindeye', 'eyes'], 4: ['cultist', 'crawler', 'starspawn', 'thorn', 'byakhee'], b: ['byakhee', 'spawn'],
    }),
    events: makeEvents({ e: ['eyes', 'mindeye', 'thorn', 'crawler', 'starspawn'], sw: 'byakhee', r: ['spawn', 'eyes', 'thorn'], b: ['boss1_rlyeh', 'boss2_rlyeh', 'cthulhu'] }),
    finalBoss: 'cthulhu',
  },
  {
    id: 'lake', no: 8, chapter: 2, name: 'ハリ湖のほとりでお茶しましょ？', en: 'TEA BY LAKE HALI', time: 600,
    desc: '霧の立ちこめる黄昏の湖畔で、優雅なお茶会を。お茶会の席の近くにいると、少しずつ体力が戻る。',
    hazard: 'teatime', hazardText: 'お茶会の席（近くにいると回復）',
    hp: 1.8, dmg: 1.65, reward: 8000, bgm: 'lake',
    pal: { bg: '#0e1219', grid: '170,190,230', mark: '200,215,255', dust: '220,225,255', glow: 'rgba(120,140,200,0.22)', accent: '#a9b8ff' },
    tint: '#6a7aa8',
    waves: makeWaves({
      0: ['spawn', 'byakhee'], 1: ['spawn', 'eyes', 'teapot'], 2: ['eyes', 'thorn', 'teapot', 'byakhee'],
      3: ['crawler', 'servant', 'thorn', 'teapot'], 4: ['cultist', 'servant', 'crawler', 'thorn', 'byakhee'], b: ['byakhee', 'spawn'],
    }),
    events: makeEvents({ e: ['eyes', 'teapot', 'servant', 'crawler', 'cultist'], sw: 'byakhee', r: ['spawn', 'eyes', 'servant'], b: ['boss1_lake', 'boss2_lake', 'glaaki'] }),
    finalBoss: 'glaaki',
  },
  {
    id: 'carcosa', no: 9, chapter: 2, name: 'ぶらりカルコサ巡りの旅', en: 'CARCOSA STROLL', time: 600,
    desc: '双子の太陽が沈む黄昏の都。黒い星が昇っている間は、経験値が多く手に入る。',
    hazard: 'blackstars', hazardText: '黒い星の夜（経験値 ×1.5）',
    hp: 2.0, dmg: 1.75, reward: 9000, bgm: 'carcosa',
    pal: { bg: '#16120a', grid: '230,200,110', mark: '255,220,130', dust: '255,230,170', glow: 'rgba(200,160,40,0.22)', accent: '#ffd24a' },
    tint: '#a08a3a',
    waves: makeWaves({
      0: ['spawn', 'byakhee'], 1: ['spawn', 'byakhee', 'yellowsign'], 2: ['eyes', 'thorn', 'yellowsign', 'masked'],
      3: ['crawler', 'masked', 'thorn', 'yellowsign'], 4: ['cultist', 'crawler', 'masked', 'thorn', 'byakhee'], b: ['byakhee', 'spawn'],
    }),
    events: makeEvents({ e: ['eyes', 'yellowsign', 'masked', 'crawler', 'cultist'], sw: 'byakhee', r: ['spawn', 'eyes', 'masked'], b: ['boss1_carcosa', 'boss2_carcosa', 'kingyellow'] }),
    finalBoss: 'kingyellow',
  },
  {
    id: 'space', no: 10, chapter: 2, name: '2026年宇宙の旅', en: 'A SPACE ODYSSEY', time: 600,
    desc: '星々の彼方、黒い石板が待つ宇宙の果てへ。ときどき流れ星が横切り、通り道に経験値を落としていく。',
    hazard: 'meteor', hazardText: '流れ星（通り道に経験値）',
    hp: 2.2, dmg: 1.85, reward: 10000, bgm: 'space',
    pal: { bg: '#05050c', grid: '150,170,255', mark: '190,205,255', dust: '230,235,255', glow: 'rgba(100,110,220,0.22)', accent: '#8fa8ff' },
    tint: '#7a9ab8',
    waves: makeWaves({
      0: ['spawn', 'byakhee'], 1: ['spawn', 'byakhee', 'hal'], 2: ['eyes', 'thorn', 'hal', 'migo'],
      3: ['crawler', 'migo', 'thorn', 'hal'], 4: ['cultist', 'crawler', 'migo', 'hal', 'byakhee'], b: ['byakhee', 'spawn'],
    }),
    events: makeEvents({ e: ['eyes', 'hal', 'migo', 'crawler', 'cultist'], sw: 'byakhee', r: ['spawn', 'eyes', 'migo'], b: ['boss1_space', 'boss2_space', 'monolith'] }),
    finalBoss: 'monolith',
  },
  {
    id: 'azathoth', no: 11, chapter: 2, name: '宇宙の中心で惰眠を貪るけもの', en: 'THE BLIND IDIOT GOD', time: 600,
    desc: '狂った笛の音が響く宇宙の中心。漂う混沌の泡に触れると、何かが出てくる。',
    hazard: 'chaos', hazardText: '混沌の泡（触れるとアイテム）',
    hp: 2.4, dmg: 1.95, reward: 15000, bgm: 'pipers', keepBgm: true,
    pal: { bg: '#07040c', grid: '190,130,255', mark: '220,170,255', dust: '240,210,255', glow: 'rgba(160,80,240,0.24)', accent: '#c78bff' },
    tint: '#8a5ac8',
    waves: makeWaves({
      0: ['spawn', 'byakhee'], 1: ['spawn', 'byakhee', 'flutist'], 2: ['eyes', 'thorn', 'flutist', 'byakhee'],
      3: ['crawler', 'thorn', 'flutist', 'eyes'], 4: ['cultist', 'crawler', 'flutist', 'thorn', 'byakhee'], b: ['byakhee', 'spawn'],
    }),
    events: makeEvents({ e: ['eyes', 'flutist', 'thorn', 'crawler', 'cultist'], sw: 'byakhee', r: ['spawn', 'eyes', 'thorn'], b: ['boss1_azath', 'boss2_azath', 'azathoth'] }),
    finalBoss: 'azathoth',
  },
  // ---------------------------------------------------------------- 第3章（四凶。ステージ名は漢文の書き下し、英語名の欄は白文）
  {
    id: 'yushu', no: 12, chapter: 3, name: '人ヲ食ラフコト首ヨリ始ム', en: '食人從首始', time: 600,
    desc: '北の果て、幽州。北風に乗ってつむじ風が吹き抜け、経験値を巻き上げて集める。触れると風に押されて速く走れる。',
    hazard: 'whirl', hazardText: 'つむじ風（経験値を集める・触れると加速）',
    hp: 2.6, dmg: 2.05, reward: 16000, bgm: 'yushu', finalBgm: 'shikyou',
    pal: { bg: '#080b12', grid: '120,160,220', mark: '160,200,255', dust: '200,225,255', glow: 'rgba(60,110,200,0.24)', accent: '#7fb8ff' },
    tint: '#4a5a8a',
    waves: makeWaves({
      0: ['moryo', 'kochou'], 1: ['moryo', 'kochou', 'hippou'], 2: ['chimi', 'kyubi', 'hippou', 'kochou'],
      3: ['kui', 'yokko', 'kyubi', 'hippou'], 4: ['keiten', 'kui', 'yokko', 'kyubi', 'kochou'], b: ['kochou', 'moryo'],
    }),
    events: makeEvents({ e: ['chimi', 'hippou', 'yokko', 'kui', 'keiten'], sw: 'kochou', r: ['moryo', 'chimi', 'kyubi'], b: ['kyuei', 'taifu', 'kyuki'] }),
    finalBoss: 'kyuki',
  },
  {
    id: 'uzan', no: 13, chapter: 3, name: '浩浩トシテ天ニ滔ル', en: '浩浩滔天', time: 600,
    desc: '東の果て、羽山。洪水があふれ、大地を濁流が横切る。流れに入ると、自分も敵も押し流される。',
    hazard: 'flood', hazardText: '濁流（入ると流される）',
    hp: 2.8, dmg: 2.15, reward: 18000, bgm: 'uzan', finalBgm: 'shikyou',
    pal: { bg: '#06100e', grid: '80,200,170', mark: '120,230,200', dust: '170,240,220', glow: 'rgba(30,150,120,0.24)', accent: '#3fd8b0' },
    tint: '#3a8a7a',
    waves: makeWaves({
      0: ['moryo', 'kochou'], 1: ['moryo', 'kochou', 'bunyo'], 2: ['chimi', 'kyubi', 'bunyo', 'kochou'],
      3: ['kui', 'tsuchi', 'kyubi', 'bunyo'], 4: ['keiten', 'kui', 'tsuchi', 'kyubi', 'kochou'], b: ['kochou', 'moryo'],
    }),
    events: makeEvents({ e: ['chimi', 'bunyo', 'tsuchi', 'kui', 'keiten'], sw: 'kochou', r: ['moryo', 'chimi', 'tsuchi'], b: ['fuki', 'shuda', 'tokotsu'] }),
    finalBoss: 'tokotsu',
  },
  {
    id: 'sanki', no: 14, chapter: 3, name: '首有リテ身無シ', en: '有首無身', time: 600,
    desc: '西の果て、三危山。あちこちに置かれた饕餮の鼎が、近くの経験値を吸い込む。鼎に触れると、1.5 倍にして吐き出す。',
    hazard: 'cauldron', hazardText: '饕餮の鼎（経験値を吸い込む。触れると 1.5 倍で吐き出す）',
    hp: 3.0, dmg: 2.25, reward: 20000, bgm: 'sanki', finalBgm: 'shikyou',
    pal: { bg: '#100d08', grid: '220,190,130', mark: '240,215,160', dust: '250,235,200', glow: 'rgba(190,150,70,0.22)', accent: '#e8c070' },
    tint: '#9a8a6a',
    waves: makeWaves({
      0: ['moryo', 'kochou'], 1: ['moryo', 'kochou', 'seicho'], 2: ['chimi', 'kyubi', 'seicho', 'kochou'],
      3: ['kui', 'houkyou', 'kyubi', 'seicho'], 4: ['keiten', 'kui', 'houkyou', 'kyubi', 'kochou'], b: ['kochou', 'moryo'],
    }),
    events: makeEvents({ e: ['chimi', 'seicho', 'houkyou', 'kui', 'keiten'], sw: 'kochou', r: ['moryo', 'chimi', 'seicho'], b: ['atsuyu', 'sakushi', 'totetsu'] }),
    finalBoss: 'totetsu',
  },
  {
    id: 'chuou', no: 15, chapter: 3, name: '七日ニシテ渾沌死ス', en: '七日而渾沌死', time: 600,
    desc: '天地の分かれる前の、中央の地。歌と舞が満ち、光る舞の輪の中にいる間は、与えるダメージが上がる。',
    hazard: 'dance', hazardText: '舞の輪（中にいると与ダメージ ×1.3）',
    hp: 3.2, dmg: 2.35, reward: 25000, bgm: 'chuou', finalBgm: 'shikyou',
    pal: { bg: '#120a05', grid: '255,160,80', mark: '255,190,110', dust: '255,215,160', glow: 'rgba(230,110,30,0.24)', accent: '#ffa040' },
    tint: '#c8803a',
    waves: makeWaves({
      0: ['moryo', 'kochou'], 1: ['moryo', 'kochou', 'maiko'], 2: ['chimi', 'kyubi', 'maiko', 'kochou'],
      3: ['kui', 'nomi', 'kyubi', 'maiko'], 4: ['keiten', 'kui', 'nomi', 'kyubi', 'kochou'], b: ['kochou', 'moryo'],
    }),
    events: makeEvents({ e: ['chimi', 'maiko', 'nomi', 'kui', 'keiten'], sw: 'kochou', r: ['moryo', 'chimi', 'maiko'], b: ['shuku', 'kotsu', 'konton'] }),
    finalBoss: 'konton',
  },
];

// 12分ステージの 540秒前後はボス戦なので軽めに
{
  const v = STAGES[4].waves;
  const i = v.findIndex((w) => w[0] === 510);
  v.splice(i + 1, 0, [540, ['phantom', 'bat'], 120, 5], [555, v[i][1], 250, 14]);
  v.sort((a, b) => a[0] - b[0]);
}

// 1 戦の長さの調整：もとは 10 分（虚空聖堂は 12 分）で作った予定表を、まとめて 0.7 倍に縮める（10 分 → 7 分、12 分 → 8 分。ボスの時刻とステージの長さは分単位に切り捨て）。
// 敵の硬さなどの曲線も game.js で同じ倍率で縮める（progress）。ボスの前の予告（warning）は、ボスの 8 秒前のまま
export const TIME_SCALE = 0.7;
for (const st of STAGES) {
  st.time = Math.floor((st.time * TIME_SCALE) / 60) * 60; // ステージの長さは分単位（秒は切り捨て）
  st.waves = st.waves.map(([t, ...rest]) => [Math.round(t * TIME_SCALE), ...rest]);
  st.events = st.events.map((e) => ({ ...e, t: Math.round(e.t * TIME_SCALE) }));
  for (const e of st.events) if (e.type === 'boss') e.t = Math.floor(e.t / 60) * 60; // ボスの時刻は分単位（秒は切り捨て）
  // 最終ボスを分単位に早めたぶん、その予告より後ろに来た出来事は外す（もとはすべて最終ボスより前の出来事）
  st.events = st.events.filter((e) => e.type === 'boss' || e.t < st.time - 8);
  // ボスの予告は付け直す（各ボスの 8 秒前）
  st.events = st.events.filter((e) => e.type !== 'warning');
  for (const e of st.events.filter((x) => x.type === 'boss')) st.events.push({ t: e.t - 8, type: 'warning' });
  st.events.sort((a, b) => a.t - b.t);
}

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));

// 章（ステージ選択と敵図鑑のタブ）。ステージの chapter で分ける
export const CHAPTERS = [...new Set(STAGES.map((s) => s.chapter))].map((no) => ({ no, name: `第${no}章`, en: `CHAPTER ${no}` }));
// 敵が最初に登場する章（ステージの出現表・イベントから。ボスの眷属など、どこにも書いていない敵は第1章）
export function enemyChapter(id) {
  for (const st of STAGES) {
    if (st.waves.some((w) => w[1].includes(id)) || st.events.some((e) => e.enemy === id) || st.finalBoss === id) return st.chapter;
  }
  return 1;
}

// ヒート（難易度上昇）。レベルごとの補正
export const HEAT_MAX = 10;
export function heatMods(h) {
  return {
    hp: 1 + 0.25 * h,
    dmg: 1 + 0.12 * h,
    speed: 1 + 0.05 * h,
    spawn: 1 + 0.1 * h,
    coin: 1 + 0.3 * h,
  };
}
