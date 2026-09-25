// =====================================================================
//  ジュエルのデータ
//  ジュエルパワーは、サンリオ×セガトイズ『ジュエルペット』の
//  各ジュエルペットが担当する魔法の意味をベースにしている。
//  詳細は docs/GEMS.md。
// =====================================================================

export const GEMS = {
  // ---------- 武器になるジュエル ----------
  ruby: {
    jp: 'ルビー', en: 'RUBY', word: '勇気', kana: 'ゆうき',
    color: '#ff2d55', light: '#ffb3c4', dark: '#8c0022', cut: 'round',
    lore: '燃え上がる勇気の紅玉。恐怖を焼き払い、前へ進む力を与える。',
  },
  sapphire: {
    jp: 'サファイア', en: 'SAPPHIRE', word: '友情', kana: 'ゆうじょう',
    color: '#2f6bff', light: '#b8ceff', dark: '#0a2380', cut: 'oval',
    lore: '友情の蒼玉。絆で結ばれた石が主を囲み、共に戦う。',
  },
  garnet: {
    jp: 'ガーネット', en: 'GARNET', word: '愛', kana: 'あい',
    color: '#d6145f', light: '#ff9cc6', dark: '#5a0026', cut: 'heart',
    lore: '愛の柘榴石。放たれた想いは敵を貫き、その命を少しだけ主へ還す。',
  },
  labradorite: {
    jp: 'ラブラドライト', en: 'LABRADORITE', word: '秘めた力', kana: 'ひめたちから',
    color: '#3fb6c9', light: '#d4fbff', dark: '#1b3f5c', cut: 'round', shimmer: true,
    lore: '秘めた力を宿す曹灰長石。気まぐれな雷がどこかへ落ちる。',
  },
  opal: {
    jp: 'オパール', en: 'OPAL', word: '奇跡', kana: 'きせき',
    color: '#f4e9ff', light: '#ffffff', dark: '#b9a4d6', cut: 'oval', rainbow: true,
    lore: '眠れる才能を目覚めさせる遊色の石。時に「奇跡」を起こす。',
  },
  amber: {
    jp: 'コハク', en: 'AMBER', word: '金運', kana: 'きんうん',
    color: '#ffab1a', light: '#ffe49a', dark: '#8f4a00', cut: 'drop',
    lore: '導く者の琥珀。金運を呼び、黄金の雨を降らせる。',
  },
  angelite: {
    jp: 'エンジェライト', en: 'ANGELITE', word: '癒し', kana: 'いやし',
    color: '#8cc8ff', light: '#eaf6ff', dark: '#3a70a8', cut: 'round',
    lore: '天使の光をまとう石。周囲の闇を静かに祓い、傷を癒す。',
  },
  diamond: {
    jp: 'ダイヤモンド', en: 'DIAMOND', word: 'カリスマ', kana: 'カリスマ',
    color: '#e6fbff', light: '#ffffff', dark: '#7fa9c2', cut: 'round',
    lore: '誰もが焦がれる金剛石。放たれる輝きは全方位を切り裂く。',
  },
  emerald: {
    jp: 'エメラルド', en: 'EMERALD', word: '幸福と調和', kana: 'しあわせ',
    color: '#12c46e', light: '#a6ffd0', dark: '#005a2c', cut: 'emerald',
    lore: '幸福と調和の翠玉。足元に咲く光の野が闇を蝕む。',
  },
  rhodochrosite: {
    jp: 'ロードクロサイト', en: 'RHODOCHROSITE', word: '情熱', kana: 'じょうねつ',
    color: '#ff5f8a', light: '#ffc6d6', dark: '#9c1f45', cut: 'round',
    lore: '情熱のインカローズ。進む先のすべてを焼き尽くす。',
  },
  kyanite: {
    jp: 'カイヤナイト', en: 'KYANITE', word: '決断', kana: 'けつだん',
    color: '#2250e0', light: '#9fb8ff', dark: '#0a1a66', cut: 'long',
    lore: '決断の藍晶石。迷わず最強の敵を穿つ一条の槍。',
  },
  aquamarine: {
    jp: 'アクアマリン', en: 'AQUAMARINE', word: '安らぎ', kana: 'やすらぎ',
    color: '#3fe0da', light: '#cffffd', dark: '#0f6f76', cut: 'emerald',
    lore: '安らぎの藍玉。静かな波紋が敵を押し返す。',
  },

  alexandrite: {
    jp: 'アレキサンドライト', en: 'ALEXANDRITE', word: '夢の実現と可能性', kana: 'ゆめ',
    color: '#1fb58a', light: '#ff9ab8', dark: '#5a1640', cut: 'oval',
    lore: '光によって色を変える希少石。放たれた光弾は敵を追い続け、翠と紅の二つの顔を持つ。',
  },
  tourmaline: {
    jp: 'トルマリン', en: 'TOURMALINE', word: '絆と冒険', kana: 'きずな',
    color: '#ff5f9a', light: '#c8ffd8', dark: '#1d7a45', cut: 'long',
    lore: '桃と翠が同居する電気石。放たれた雷光は敵から敵へ跳ね渡り、冒険を続ける。',
  },
  moonstone: {
    jp: 'ムーンストーン', en: 'MOONSTONE', word: '魅力', kana: 'みりょく',
    color: '#c9d8ff', light: '#ffffff', dark: '#5b6fb0', cut: 'oval',
    lore: '青い月光を宿す石。三日月の刃は往復し、触れた敵を魅了して同士討ちさせる。',
  },

  // ---------- チャーム（パッシブ）になるジュエル ----------
  topaz: { jp: 'トパーズ', en: 'TOPAZ', word: '自信', kana: 'じしん', color: '#ffc21a', light: '#fff0a8', dark: '#9a6200', cut: 'oval',
    lore: '自信の黄玉。揺るがぬ確信が、放つ一撃すべてを重くする。' },
  jasper: { jp: 'ジャスパー', en: 'JASPER', word: '強い意志', kana: 'つよいいし', color: '#d4552a', light: '#ffb592', dark: '#6e210a', cut: 'round',
    lore: '強い意志の碧玉。折れない心が、身体をも頑丈にする。' },
  nephrite: { jp: 'ネフライト', en: 'NEPHRITE', word: 'チームワーク', kana: 'チームワーク', color: '#52b35a', light: '#c4f5c0', dark: '#1d5a22', cut: 'drop',
    lore: 'チームワークの軟玉。仲間の数だけ、放たれる光も増えていく。' },
  milkyquartz: { jp: 'ミルキークオーツ', en: 'MILKY QUARTZ', word: '思いやり', kana: 'おもいやり', color: '#f4f1ff', light: '#ffffff', dark: '#bdb4dc', cut: 'heart',
    lore: '思いやりの乳白石。やわらかな光が、手の届く範囲を広げる。' },
  coral: { jp: 'サンゴ', en: 'CORAL', word: '守護と幸運', kana: 'まもりとこううん', color: '#ff7a66', light: '#ffd0c7', dark: '#a3301f', cut: 'drop',
    lore: '海が育んだ守護と幸運の石。思わぬ幸運と会心の一撃を呼び込む。' },
  iolite: { jp: 'アイオライト', en: 'IOLITE', word: 'リフレッシュ', kana: 'リフレッシュ', color: '#6c5ce7', light: '#cfc8ff', dark: '#2a1f82', cut: 'oval',
    lore: 'リフレッシュの菫青石。澄んだ心が、次の一手を早くする。' },
  prase: { jp: 'プレーズ', en: 'PRASE', word: '勉強', kana: 'べんきょう', color: '#7cb35a', light: '#d6f5bf', dark: '#355a1f', cut: 'emerald',
    lore: '学びの石。倒した敵の一体一体から、より多くを学び取る。' },
  granite: { jp: 'グラナイト', en: 'GRANITE', word: '安心', kana: 'あんしん', color: '#b7aca3', light: '#f3ede8', dark: '#5c534c', cut: 'emerald',
    lore: '安心の花崗岩。大地のように揺るがず、主を攻撃から守る。' },
  coal: { jp: 'コール', en: 'COAL', word: '忍耐', kana: 'にんたい', color: '#4a4a58', light: '#a9a9c2', dark: '#15151c', cut: 'round',
    lore: '忍耐の石炭。燃え尽きることなく、静かに傷を癒し続ける。' },
  titanite: { jp: 'チタナイト', en: 'TITANITE', word: '仕事運とバランス', kana: 'しごとうん', color: '#c9d63a', light: '#f6ffb0', dark: '#5f6a00', cut: 'long',
    lore: '仕事運とバランスの榍石。働きに見合った報酬を約束する。' },
  redberyl: { jp: 'レッドベリル', en: 'RED BERYL', word: '心身の浄化', kana: 'じょうか', color: '#e0245e', light: '#ffa3c0', dark: '#6b0626', cut: 'emerald',
    lore: '心身を浄化する赤い緑柱石。散らばった輝きを主のもとへ呼び寄せる。' },
  turquoise: { jp: 'ターコイズ', en: 'TURQUOISE', word: '勇気', kana: 'ゆうき', color: '#2fc9b8', light: '#b8fff4', dark: '#0f6b66', cut: 'round',
    lore: '旅人を守る勇気のトルコ石。受ける痛みを和らげる。' },
  peridot: { jp: 'ペリドット', en: 'PERIDOT', word: 'ポジティブ', kana: 'まえむき', color: '#9be22e', light: '#e4ffb2', dark: '#3f6a00', cut: 'oval',
    lore: '前向きな橄欖石。踏み出す足も、放つ光も軽くする。' },

  // 敵ボスのジュエル
  obsidian: { jp: 'オブシディアン', en: 'OBSIDIAN', word: '闇', kana: 'やみ', color: '#3a2350', light: '#9b6fd0', dark: '#0d0414', cut: 'round' },
};

// ---------------------------------------------------------------------
//  武器
//  base: Lv1 の性能 / levels: Lv2〜8 で加算 / evo: 進化
// ---------------------------------------------------------------------
export const WEAPONS = {
  ruby: {
    gem: 'ruby', name: 'ブレイブ・バレット',
    dmgMul: 2.5, // バランス調整（Lv帯）
    desc: '最も近い敵へ紅玉の弾丸を撃ち込む',
    base: { dmg: 95, cd: 1.1, amount: 1, speed: 1, pierce: 0, area: 1, life: 1.4 },
    levels: [
      { dmg: 35, t: 'ダメージ +35' },
      { amount: 1, t: '弾数 +1' },
      { pierce: 1, cd: -0.1, t: '貫通 +1 / 連射速度アップ' },
      { dmg: 55, t: 'ダメージ +55' },
      { amount: 1, t: '弾数 +1' },
      { cd: -0.15, t: '連射速度アップ' },
      { dmg: 90, pierce: 1, t: 'ダメージ +90 / 貫通 +1' },
    ],
    evo: {
      mul: 0.22, with: 'jasper', name: 'ブレイブハート・バースト',
      desc: '着弾時に爆発。HP50%以下でダメージ2倍',
    },
  },
  sapphire: {
    gem: 'sapphire', name: 'ボンド・オービット',
    dmgMul: 2.8, // バランス調整（Lv帯）
    lowBoost: 0.7, // 低レベル時の補正（Lv1 で ×1.7、Lv8 で ×1）
    desc: '周囲を旋回する蒼玉。近くの敵へ援護射撃も行う',
    base: { dmg: 85, cd: 1.8, amount: 2, speed: 1, area: 1, duration: 4 },
    levels: [
      { dmg: 25, speed: 0.3, t: 'ダメージ +25 / 回転速度アップ' },
      { duration: 0.5, area: 0.15, t: '持続・範囲アップ' },
      { amount: 1, t: 'オーブ +1' },
      { dmg: 35, t: 'ダメージ +35' },
      { duration: 0.5, area: 0.15, t: '持続・範囲アップ' },
      { dmg: 40, t: 'ダメージ +40' },
      { amount: 1, dmg: 30, t: 'オーブ +1 / ダメージ +30' },
    ],
    evo: { mul: 0.6, with: 'nephrite', name: 'エターナル・ボンド', desc: '二重の軌道が途切れることなく回り続ける' },
  },
  garnet: {
    gem: 'garnet', name: 'アムール・ハート',
    dmgMul: 1.2, // バランス調整（Lv帯）
    desc: '放物線を描くハートを投擲。命中するとHPを吸収',
    base: { dmg: 150, cd: 1.5, amount: 1, speed: 1, area: 1, pierce: 4 },
    levels: [
      { dmg: 45, t: 'ダメージ +45' },
      { area: 0.2, pierce: 2, t: 'サイズアップ / 貫通 +2' },
      { amount: 1, t: '投擲数 +1' },
      { dmg: 55, cd: -0.15, t: 'ダメージ +55 / 投擲速度アップ' },
      { pierce: 3, t: '貫通 +3' },
      { dmg: 70, t: 'ダメージ +70' },
      { amount: 1, t: '投擲数 +1' },
    ],
    evo: { mul: 1.25, with: 'milkyquartz', name: 'アムール・テンペスト', desc: '周囲にハートが降り注ぐ。吸収量アップ' },
  },
  labradorite: {
    gem: 'labradorite', name: 'ヒドゥン・ボルト',
    dmgMul: 1.0, // バランス調整（Lv帯）
    desc: '画面内のランダムな敵へ落雷',
    base: { dmg: 190, cd: 2.2, amount: 2, area: 1 },
    levels: [
      { dmg: 60, t: 'ダメージ +60' },
      { area: 0.25, t: '爆発範囲アップ' },
      { amount: 1, cd: -0.2, t: '落雷数 +1 / クールダウン短縮' },
      { dmg: 70, t: 'ダメージ +70' },
      { area: 0.25, t: '爆発範囲アップ' },
      { dmg: 90, cd: -0.2, t: 'ダメージ +90 / クールダウン短縮' },
      { amount: 1, t: '落雷数 +1' },
    ],
    evo: { mul: 1.4, with: 'iolite', name: 'ヒドゥン・ストーム', desc: '落雷が次々と敵を連鎖する' },
  },
  opal: {
    gem: 'opal', name: 'ミラクル・プリズム',
    dmgMul: 1.5, // バランス調整（Lv帯）
    desc: '回転する虹色の光線。確率で10倍ダメージの「奇跡」',
    base: { dmg: 45, cd: 3.5, amount: 1, area: 1, speed: 1, duration: 2 },
    levels: [
      { dmg: 15, t: 'ダメージ +15' },
      { duration: 0.5, t: '照射時間アップ' },
      { area: 0.2, t: '射程アップ' },
      { amount: 1, t: 'ビーム +1' },
      { dmg: 20, cd: -0.3, t: 'ダメージ +20 / クールダウン短縮' },
      { duration: 0.5, area: 0.2, t: '照射時間・射程アップ' },
      { dmg: 40, t: 'ダメージ +40' },
    ],
    evo: { mul: 0.55, with: 'coral', name: 'ミラクル・スペクトラム', desc: '常時照射。奇跡の発生率が大幅アップ' },
  },
  amber: {
    gem: 'amber', name: 'ゴールド・レイン',
    dmgMul: 0.8, // バランス調整（Lv帯）
    desc: '敵の頭上に金貨を落とす。この武器で倒すとコインをドロップ',
    base: { dmg: 120, cd: 1.7, amount: 2, area: 1 },
    levels: [
      { dmg: 40, t: 'ダメージ +40' },
      { area: 0.2, t: '範囲アップ' },
      { amount: 1, cd: -0.2, t: '金貨 +1 / クールダウン短縮' },
      { dmg: 50, t: 'ダメージ +50' },
      { area: 0.2, t: '範囲アップ' },
      { dmg: 70, t: 'ダメージ +70' },
      { amount: 1, t: '金貨 +1' },
    ],
    evo: { mul: 1.6, with: 'titanite', name: 'ゴールデン・ジャックポット', desc: '金貨の豪雨。確率で777ジャックポットが発生' },
  },
  angelite: {
    gem: 'angelite', name: 'セラフ・オーラ',
    dmgMul: 1.0, // バランス調整（Lv帯）
    desc: '周囲に光のオーラを展開。接近した敵にダメージ、自身はHP回復',
    base: { dmg: 25, cd: 0.5, area: 1, knock: 0.4 },
    levels: [
      { area: 0.15, t: '範囲アップ' },
      { dmg: 10, t: 'ダメージ +10' },
      { cd: -0.05, t: 'ヒット間隔短縮' },
      { area: 0.15, t: '範囲アップ' },
      { dmg: 12, t: 'ダメージ +12' },
      { area: 0.15, t: '範囲アップ' },
      { dmg: 15, cd: -0.05, t: 'ダメージ +15 / ヒット間隔短縮' },
    ],
    evo: { mul: 1.0, with: 'redberyl', name: 'サンクチュアリ', desc: '聖域化。敵を減速させ、弱った敵を即座に浄化する' },
  },
  diamond: {
    gem: 'diamond', name: 'ブリリアント・カット',
    dmgMul: 2.6, // バランス調整（Lv帯）
    desc: '金剛石の破片を全方位へ炸裂させる',
    base: { dmg: 90, cd: 1.4, amount: 5, speed: 1, pierce: 1, life: 0.5 },
    levels: [
      { dmg: 30, t: 'ダメージ +30' },
      { pierce: 1, t: '貫通 +1' },
      { amount: 1, t: '破片 +1' },
      { dmg: 35, cd: -0.15, t: 'ダメージ +35 / クールダウン短縮' },
      { life: 0.2, t: '射程アップ' },
      { dmg: 45, t: 'ダメージ +45' },
      { amount: 2, t: '破片 +2' },
    ],
    evo: { mul: 0.2, with: 'topaz', name: 'スターダスト・カリスマ', desc: '螺旋状に破片を連射。全弾クリティカル' },
  },
  emerald: {
    gem: 'emerald', name: 'ハーモニー・フィールド',
    dmgMul: 0.7, // バランス調整（Lv帯）
    desc: '地面に光のクローバー畑を展開し、上の敵に継続ダメージ',
    base: { dmg: 40, cd: 2.6, amount: 1, area: 1, duration: 2.5 },
    levels: [
      { dmg: 6, t: 'ダメージ +6' },
      { area: 0.2, t: '範囲アップ' },
      { amount: 1, duration: 0.5, t: 'フィールド +1 / 持続アップ' },
      { dmg: 8, cd: -0.3, t: 'ダメージ +8 / クールダウン短縮' },
      { area: 0.2, t: '範囲アップ' },
      { dmg: 8, t: 'ダメージ +8' },
      { amount: 1, t: 'フィールド +1' },
    ],
    evo: { mul: 1.35, with: 'granite', name: 'エデン・ガーデン', desc: '範囲拡大＋敵を減速。四つ葉がアイテムを落とす' },
  },
  rhodochrosite: {
    gem: 'rhodochrosite', name: 'パッション・フレイム',
    dmgMul: 2.0, // バランス調整（Lv帯）
    lowBoost: 2.5, // 低レベル時の補正（Lv1 で ×3.5、Lv8 で ×1）
    desc: '進行方向へ炎を放射する',
    base: { dmg: 22, cd: 2.2, amount: 1, area: 1, duration: 1.2 },
    levels: [
      { dmg: 6, t: 'ダメージ +6' },
      { duration: 0.4, t: '放射時間アップ' },
      { area: 0.2, t: '射程アップ' },
      { amount: 1, t: '後方にも放射' },
      { dmg: 8, cd: -0.3, t: 'ダメージ +8 / クールダウン短縮' },
      { duration: 0.4, t: '放射時間アップ' },
      { dmg: 10, area: 0.2, t: 'ダメージ +10 / 射程アップ' },
    ],
    evo: { mul: 0.65, with: 'peridot', name: 'パッション・インフェルノ', desc: '四方へ回転する炎の渦。通った跡も燃え続ける' },
  },
  kyanite: {
    gem: 'kyanite', name: 'ディサイシブ・ランス',
    dmgMul: 0.65, // バランス調整（Lv帯）
    desc: '最もHPの高い敵へ槍を投擲。無限貫通',
    base: { dmg: 300, cd: 2.2, amount: 1, speed: 1, area: 1 },
    levels: [
      { dmg: 60, t: 'ダメージ +60' },
      { cd: -0.2, t: 'クールダウン短縮' },
      { amount: 1, t: '槍 +1' },
      { dmg: 80, area: 0.2, t: 'ダメージ +80 / サイズアップ' },
      { cd: -0.2, t: 'クールダウン短縮' },
      { amount: 1, t: '槍 +1' },
      { dmg: 120, t: 'ダメージ +120' },
    ],
    evo: { mul: 0.9, with: 'prase', name: 'ディサイシブ・ブレード', desc: '命中時に4本へ分裂する' },
  },
  aquamarine: {
    gem: 'aquamarine', name: 'タイダル・ウェーブ',
    dmgMul: 1.6, // バランス調整（Lv帯）
    desc: '周囲に波動を放ち、敵を押し返す',
    base: { dmg: 70, cd: 2.4, amount: 1, area: 1, knock: 2 },
    levels: [
      { dmg: 25, t: 'ダメージ +25' },
      { area: 0.15, t: '範囲アップ' },
      { cd: -0.3, t: 'クールダウン短縮' },
      { amount: 1, t: '波動 +1' },
      { dmg: 30, t: 'ダメージ +30' },
      { area: 0.2, t: '範囲アップ' },
      { dmg: 40, cd: -0.3, t: 'ダメージ +40 / クールダウン短縮' },
    ],
    evo: { mul: 0.7, with: 'coal', name: 'アビサル・タイド', desc: '深海の圧力。命中した敵を泡で拘束する' },
  },
  alexandrite: {
    gem: 'alexandrite', name: 'ドリーム・シフト',
    dmgMul: 3.0, // バランス調整（Lv帯）
    desc: '敵を追尾する光弾を放つ。翠の弾は貫通、紅の弾は爆発と交互に変化',
    base: { dmg: 110, cd: 1.5, amount: 2, speed: 1, pierce: 1, area: 1, life: 2.2 },
    levels: [
      { dmg: 30, t: 'ダメージ +30' },
      { amount: 1, t: '光弾 +1' },
      { area: 0.2, t: '爆発範囲アップ' },
      { dmg: 40, cd: -0.15, t: 'ダメージ +40 / クールダウン短縮' },
      { pierce: 1, t: '貫通 +1' },
      { dmg: 50, t: 'ダメージ +50' },
      { amount: 1, t: '光弾 +1' },
    ],
    evo: { mul: 0.55, with: 'turquoise', name: 'ポッシビリティ', desc: '翠と紅が同時に宿る。全弾が貫通しつつ爆発し、追尾性能も上昇' },
  },
  tourmaline: {
    gem: 'tourmaline', name: 'ボンド・リコシェ',
    dmgMul: 1.2, // バランス調整（Lv帯）
    desc: '命中するたびに近くの敵へ跳ね移る雷光を放つ',
    base: { dmg: 100, cd: 1.3, amount: 1, speed: 1, bounce: 3, area: 1 },
    levels: [
      { bounce: 1, t: '跳弾 +1' },
      { dmg: 30, t: 'ダメージ +30' },
      { amount: 1, t: '雷光 +1' },
      { bounce: 2, t: '跳弾 +2' },
      { dmg: 40, cd: -0.15, t: 'ダメージ +40 / クールダウン短縮' },
      { bounce: 2, t: '跳弾 +2' },
      { dmg: 50, amount: 1, t: 'ダメージ +50 / 雷光 +1' },
    ],
    evo: { mul: 0.67, with: 'nephrite', name: 'グランド・アドベンチャー', desc: '跳弾が大幅に増え、跳ねるたびに分岐する' },
  },
  moonstone: {
    gem: 'moonstone', name: 'ルナ・ハロ',
    dmgMul: 0.7, // バランス調整（Lv帯）
    desc: '往復する三日月の刃。命中した敵を確率で魅了し、他の敵を襲わせる',
    base: { dmg: 90, cd: 1.8, amount: 1, speed: 1, area: 1, charm: 0.12 },
    levels: [
      { dmg: 25, t: 'ダメージ +25' },
      { area: 0.2, t: 'サイズアップ' },
      { amount: 1, t: '刃 +1' },
      { charm: 0.06, t: '魅了率アップ' },
      { dmg: 35, cd: -0.2, t: 'ダメージ +35 / クールダウン短縮' },
      { area: 0.2, charm: 0.06, t: 'サイズ・魅了率アップ' },
      { amount: 1, dmg: 40, t: '刃 +1 / ダメージ +40' },
    ],
    evo: { mul: 1.15, with: 'milkyquartz', name: 'フルムーン・グレイス', desc: '満月が周囲を巡り、魅了された敵は解除時に爆ぜる' },
  },
};
export const WEAPON_IDS = Object.keys(WEAPONS);
export const WEAPON_MAX = 8;

// ---------------------------------------------------------------------
//  チャーム（パッシブ）
// ---------------------------------------------------------------------
export const PASSIVES = {
  topaz: { gem: 'topaz', name: 'トパーズ', max: 5, per: { might: 0.1 }, t: '攻撃力 +10%' },
  jasper: { gem: 'jasper', name: 'ジャスパー', max: 5, per: { maxHp: 20 }, t: '最大HP +20' },
  nephrite: { gem: 'nephrite', name: 'ネフライト', max: 1, per: { amount: 1 }, t: '弾数 +1' },
  milkyquartz: { gem: 'milkyquartz', name: 'ミルキークオーツ', max: 5, per: { area: 0.1 }, t: '攻撃範囲 +10%' },
  coral: { gem: 'coral', name: 'サンゴ', max: 5, per: { luck: 0.15, crit: 0.01 }, t: '幸運 +15% / クリティカル率 +1%' },
  iolite: { gem: 'iolite', name: 'アイオライト', max: 5, per: { cooldown: -0.08 }, t: 'クールダウン短縮 8%' },
  prase: { gem: 'prase', name: 'プレーズ', max: 5, per: { growth: 0.1 }, t: '経験値 +10%' },
  granite: { gem: 'granite', name: 'グラナイト', max: 5, per: { armor: 1 }, t: 'アーマー +1' },
  coal: { gem: 'coal', name: 'コール', max: 5, per: { regen: 0.25 }, t: 'HP自然回復 +0.25/秒' },
  titanite: { gem: 'titanite', name: 'チタナイト', max: 5, per: { greed: 0.2 }, t: '獲得コイン +20%' },
  redberyl: { gem: 'redberyl', name: 'レッドベリル', max: 5, per: { magnet: 0.3 }, t: '回収範囲 +30%' },
  turquoise: { gem: 'turquoise', name: 'ターコイズ', max: 5, per: { guard: 0.06 }, t: '被ダメージ -6%' },
  peridot: { gem: 'peridot', name: 'ペリドット', max: 5, per: { moveSpeed: 0.08, speed: 0.08, duration: 0.08 }, t: '移動速度・弾速・持続 +8%' },
};
export const PASSIVE_IDS = Object.keys(PASSIVES);

// ゲーム中に装備できる武器・チャームの数（各）
export const MAX_SLOTS = 4;

export const BASE_STATS = {
  maxHp: 100, might: 1, armor: 0, regen: 0, cooldown: 1, area: 1, speed: 1, duration: 1,
  amount: 0, moveSpeed: 1, magnet: 1, luck: 1, growth: 1, greed: 1, crit: 0.05, revive: 0, reroll: 2, guard: 0,
};

// ---------------------------------------------------------------------
//  キャラ（初期ジュエル）
// ---------------------------------------------------------------------
export const CHARACTERS = {
  ruby: { weapon: 'ruby', perk: 'HP50%以下で攻撃力 +30%', stats: { might: 0.1 }, rarity: 'R', start: true },
  sapphire: { weapon: 'sapphire', perk: '回収範囲 +20% / クールダウン短縮 5%', stats: { magnet: 0.2, cooldown: -0.05 }, rarity: 'R', start: true },
  garnet: { weapon: 'garnet', perk: '最大HP +20 / 自然回復 +0.2', stats: { maxHp: 20, regen: 0.2 }, rarity: 'R', start: true },
  labradorite: { weapon: 'labradorite', perk: 'クリティカル率 +5%', stats: { crit: 0.05 }, rarity: 'SR', unlock: '1回のプレイで1000体撃破' },
  amber: { weapon: 'amber', perk: 'コイン +30%', stats: { greed: 0.3 }, rarity: 'SR', unlock: '1回のプレイでコイン500枚獲得' },
  angelite: { weapon: 'angelite', perk: 'HP自然回復 +0.4', stats: { regen: 0.4 }, rarity: 'SR', unlock: '5分間生存' },
  diamond: { weapon: 'diamond', perk: '攻撃範囲 +10% / クリティカル率 +3%', stats: { area: 0.1, crit: 0.03 }, rarity: 'UR', unlock: 'ステージクリア' },
  opal: { weapon: 'opal', perk: '幸運 +25%', stats: { luck: 0.25 }, rarity: 'UR', unlock: 'ガチャ' },
  emerald: { weapon: 'emerald', perk: '経験値 +10% / 幸運 +10%', stats: { growth: 0.1, luck: 0.1 }, rarity: 'SR', unlock: 'ガチャ' },
  rhodochrosite: { weapon: 'rhodochrosite', perk: '攻撃力 +15% / 最大HP -10', stats: { might: 0.15, maxHp: -10 }, rarity: 'SR', unlock: 'ガチャ' },
  kyanite: { weapon: 'kyanite', perk: '弾速 +20%', stats: { speed: 0.2 }, rarity: 'SR', unlock: 'ガチャ' },
  aquamarine: { weapon: 'aquamarine', perk: '持続 +15% / アーマー +1', stats: { duration: 0.15, armor: 1 }, rarity: 'SR', unlock: 'ガチャ' },
  tourmaline: { weapon: 'tourmaline', perk: '移動速度 +8% / 幸運 +10%', stats: { moveSpeed: 0.08, luck: 0.1 }, rarity: 'SR', unlock: '水晶洞窟をクリア' },
  alexandrite: { weapon: 'alexandrite', perk: '経験値 +15%', stats: { growth: 0.15 }, rarity: 'SR', unlock: '灼熱鉱脈をクリア' },
  moonstone: { weapon: 'moonstone', perk: '攻撃範囲 +10% / 回収範囲 +20%', stats: { area: 0.1, magnet: 0.2 }, rarity: 'UR', unlock: '凍晶氷原をクリア' },
};
export const CHAR_IDS = Object.keys(CHARACTERS);

// ---------------------------------------------------------------------
//  敵勢力「ダスク」— 宝石の輝きを喰らう闇
// ---------------------------------------------------------------------
export const ENEMIES = {
  slime: { name: 'シェイドスライム', hp: 70, speed: 48, dmg: 6, r: 13, xp: 1, color: '#6b5a8e', desc: '光を吸って膨らむ粘体。最も数が多い。' },
  bat: { name: 'ナイトバット', hp: 45, speed: 88, dmg: 5, r: 11, xp: 1, color: '#4a3a6a', desc: '蛇行しながら高速で迫る。群れで来ることも。' },
  ghost: { name: 'レイス', hp: 140, speed: 60, dmg: 8, r: 15, xp: 2, color: '#8a7fb0', desc: '揺らめきながら接近する亡霊。' },
  toge: { name: 'ソーンコア', hp: 300, speed: 62, dmg: 10, r: 16, xp: 3, color: '#5a3a5e', desc: '棘に覆われた核。硬く、接触ダメージが高い。' },
  golem: { name: 'ロックゴーレム', hp: 800, speed: 36, dmg: 14, r: 24, xp: 6, color: '#6e5f58', desc: '鈍重だが非常にタフな岩塊。' },
  knight: { name: 'オブシディアンナイト', hp: 1200, speed: 55, dmg: 16, r: 20, xp: 8, color: '#3c3456', desc: '黒曜の鎧を纏うダスクの精鋭。' },
  boss1: { name: 'ダスク・キング', hp: 30000, speed: 50, dmg: 20, r: 48, xp: 200, boss: true, color: '#5b3f8a', desc: '粘体の王。3:00に出現。全方位弾と眷属召喚。' },
  boss2: { name: 'ヴォイド・ドラゴン', hp: 90000, speed: 62, dmg: 26, r: 52, xp: 500, boss: true, color: '#2e1f4f', desc: '夜空を塗り潰す竜。6:00に出現。螺旋弾と突進。' },
  boss3: { name: 'オブシディアン・クイーン', hp: 260000, speed: 55, dmg: 32, r: 58, xp: 2000, boss: true, color: '#1a0d2a', desc: 'ダスクの女王。黒曜石の力で世界の輝きを奪う。10:00に出現。' },
  // ---- 新種
  spitter: { name: 'クリスタル・スピッター', hp: 160, speed: 42, dmg: 7, r: 14, xp: 2, ai: 'spitter', desc: '距離を取って結晶弾を撃ってくる。近づいて倒せ。' },
  splitter: { name: 'スプリット・ジェル', hp: 240, speed: 46, dmg: 9, r: 17, xp: 2, ai: 'splitter', desc: '倒すと2体の小さな粘体に分裂する。' },
  mini: { name: 'ジェル・フラグメント', hp: 70, speed: 72, dmg: 5, r: 10, xp: 1, sprite: 'splitter', desc: 'スプリット・ジェルの破片。すばしこい。' },
  charger: { name: 'ホーン・ビースト', hp: 420, speed: 50, dmg: 14, r: 18, xp: 4, ai: 'charger', desc: '一瞬溜めてから一直線に突進してくる。赤い線から逃げろ。' },
  bomber: { name: 'マグマ・ボム', hp: 130, speed: 78, dmg: 6, r: 13, xp: 2, ai: 'bomber', desc: '近づくと点火して爆発する。点火したら即離脱。' },
  wisp: { name: 'フロスト・ウィスプ', hp: 170, speed: 66, dmg: 6, r: 13, xp: 2, ai: 'wisp', desc: '触れると体が凍えて足が鈍る。' },
  phantom: { name: 'ヴォイド・ファントム', hp: 280, speed: 52, dmg: 10, r: 15, xp: 3, ai: 'phantom', desc: '闇に溶け、背後へ瞬間移動してくる。' },
  // ---- ステージ別の中ボス
  boss1_cavern: { name: 'クリスタル・キング', hp: 36000, speed: 50, dmg: 20, r: 48, xp: 200, boss: true, ai: 'boss1', sprite: 'boss1', tint: '#2f7fb0', desc: '水晶洞窟の粘体王。3:00に出現。' },
  boss2_cavern: { name: 'ジェム・ドラゴン', hp: 100000, speed: 62, dmg: 26, r: 52, xp: 500, boss: true, ai: 'boss2', sprite: 'boss2', tint: '#1f4f8a', desc: '宝石を喰らって育った竜。6:00に出現。' },
  boss1_magma: { name: 'ブレイズ・キング', hp: 36000, speed: 52, dmg: 22, r: 48, xp: 200, boss: true, ai: 'boss1', sprite: 'boss1', tint: '#b8401f', desc: '溶岩をまとう粘体王。3:00に出現。' },
  boss2_magma: { name: 'インフェルノ・ドラゴン', hp: 100000, speed: 64, dmg: 28, r: 52, xp: 500, boss: true, ai: 'boss2', sprite: 'boss2', tint: '#8a1f1f', desc: '灼熱の吐息を放つ竜。6:00に出現。' },
  boss1_tundra: { name: 'グレイシャー・キング', hp: 36000, speed: 48, dmg: 22, r: 48, xp: 200, boss: true, ai: 'boss1', sprite: 'boss1', tint: '#7fa8d0', desc: '氷河を背負う粘体王。3:00に出現。' },
  boss3_tundra: { name: 'スノウ・クイーン', hp: 120000, speed: 56, dmg: 28, r: 58, xp: 800, boss: true, ai: 'boss3', sprite: 'boss3', tint: '#3a5a8a', desc: '氷原を統べる女王。6:00に出現。' },
  boss1_void: { name: 'ヴォイド・キング', hp: 40000, speed: 52, dmg: 24, r: 48, xp: 200, boss: true, ai: 'boss1', sprite: 'boss1', tint: '#3a1a5a', desc: '虚空の粘体王。3:00に出現。' },
  boss3_void: { name: 'クイーン・シャドウ', hp: 150000, speed: 58, dmg: 30, r: 58, xp: 800, boss: true, ai: 'boss3', sprite: 'boss3', tint: '#2a0a3a', desc: '女王の残影。虚空聖堂の9:00に出現。' },
  // ---- 最終ボス
  prism: { name: 'プリズム・コロッサス', hp: 260000, speed: 40, dmg: 30, r: 62, xp: 2000, boss: true, ai: 'prism', desc: '水晶洞窟の主。回転するレーザーで空間を切り裂く。10:00に出現。' },
  worm: { name: 'マグマ・ワーム', hp: 340000, speed: 95, dmg: 30, r: 34, xp: 2000, boss: true, ai: 'worm', desc: '溶岩の中を泳ぐ大蛇。胴体も攻撃が通る。10:00に出現。' },
  wormseg: { name: 'マグマ・ワーム（胴）', hp: 1, speed: 0, dmg: 22, r: 26, xp: 0, segment: true, sprite: 'wormseg', desc: '' },
  lich: { name: 'フロスト・リッチ', hp: 260000, speed: 45, dmg: 30, r: 50, xp: 2000, boss: true, ai: 'lich', desc: '氷原に眠っていた魔導士。氷柱と冷気で逃げ場を奪う。10:00に出現。' },
  emperor: { name: 'ヴォイド・エンペラー', hp: 300000, speed: 50, dmg: 34, r: 66, xp: 4000, boss: true, ai: 'emperor', desc: 'ダスクを生み出した虚空の皇帝。3つの形態を持つ。12:00に出現。' },
  crystal: { name: 'ライトクリスタル', hp: 1, speed: 0, dmg: 0, r: 16, xp: 0, prop: true, color: '#ffffff', desc: '破壊するとアイテムを落とす。' },
};

// ---------------------------------------------------------------------
//  工房（永続強化）
// ---------------------------------------------------------------------
export const SHOP = [
  { id: 'might', name: '攻撃力', gem: 'topaz', max: 5, base: 120, per: { might: 0.05 }, t: '攻撃力 +5%' },
  { id: 'maxHp', name: '最大HP', gem: 'jasper', max: 5, base: 100, per: { maxHp: 10 }, t: '最大HP +10' },
  { id: 'armor', name: 'アーマー', gem: 'granite', max: 3, base: 250, per: { armor: 1 }, t: '被ダメージ -1' },
  { id: 'regen', name: '自然回復', gem: 'coal', max: 5, base: 150, per: { regen: 0.1 }, t: 'HP回復 +0.1/秒' },
  { id: 'cooldown', name: 'クールダウン', gem: 'iolite', max: 3, base: 400, per: { cooldown: -0.03 }, t: 'クールダウン短縮 3%' },
  { id: 'area', name: '攻撃範囲', gem: 'milkyquartz', max: 3, base: 300, per: { area: 0.05 }, t: '攻撃範囲 +5%' },
  { id: 'speed', name: '弾速', gem: 'kyanite', max: 3, base: 150, per: { speed: 0.05 }, t: '弾速 +5%' },
  { id: 'duration', name: '持続', gem: 'aquamarine', max: 3, base: 200, per: { duration: 0.07 }, t: '効果時間 +7%' },
  { id: 'moveSpeed', name: '移動速度', gem: 'peridot', max: 3, base: 200, per: { moveSpeed: 0.04 }, t: '移動速度 +4%' },
  { id: 'magnet', name: '回収範囲', gem: 'redberyl', max: 3, base: 150, per: { magnet: 0.15 }, t: '回収範囲 +15%' },
  { id: 'luck', name: '幸運', gem: 'coral', max: 3, base: 300, per: { luck: 0.08 }, t: '幸運 +8%' },
  { id: 'growth', name: '成長', gem: 'prase', max: 5, base: 250, per: { growth: 0.04 }, t: '経験値 +4%' },
  { id: 'greed', name: '強欲', gem: 'titanite', max: 5, base: 150, per: { greed: 0.1 }, t: '獲得コイン +10%' },
  { id: 'crit', name: 'クリティカル', gem: 'diamond', max: 5, base: 250, per: { crit: 0.02 }, t: 'クリティカル率 +2%' },
  { id: 'reroll', name: 'リロール', gem: 'labradorite', max: 5, base: 200, per: { reroll: 1 }, t: 'リロール回数 +1' },
  { id: 'revive', name: 'リバイブ', gem: 'angelite', max: 1, base: 3000, per: { revive: 1 }, t: '倒れても1度だけ復活' },
  { id: 'amount', name: '弾数', gem: 'nephrite', max: 1, base: 5000, per: { amount: 1 }, t: '全武器の弾数 +1' },
];
export function shopCost(item, lv) {
  return Math.round(item.base * [1, 2.2, 3.8, 6, 9, 13][lv] / 10) * 10;
}

// ---------------------------------------------------------------------
//  実績
// ---------------------------------------------------------------------
export const ACHIEVEMENTS = [
  { id: 'kill1', name: 'ファーストブラッド', t: '敵を1体倒す', coins: 20, check: (r) => r.kills >= 1 },
  { id: 'kill100', name: '100 KILLS', t: '1回のプレイで100体撃破', coins: 50, check: (r) => r.kills >= 100 },
  { id: 'kill500', name: '500 KILLS', t: '1回のプレイで500体撃破', coins: 150, check: (r) => r.kills >= 500 },
  { id: 'kill1000', name: '千人斬り', t: '1回のプレイで1000体撃破', coins: 300, unlock: 'labradorite', check: (r) => r.kills >= 1000 },
  { id: 'kill3000', name: 'ダスクハンター', t: '1回のプレイで3000体撃破', coins: 800, check: (r) => r.kills >= 3000 },
  { id: 'lv10', name: 'Lv.10', t: 'レベル10到達', coins: 50, check: (r) => r.level >= 10 },
  { id: 'lv30', name: 'Lv.30', t: 'レベル30到達', coins: 200, check: (r) => r.level >= 30 },
  { id: 'lv50', name: 'Lv.50', t: 'レベル50到達', coins: 600, check: (r) => r.level >= 50 },
  { id: 'time3', name: 'サバイバー I', t: '3分間生存', coins: 80, check: (r) => r.time >= 180 },
  { id: 'time5', name: 'サバイバー II', t: '5分間生存', coins: 200, unlock: 'angelite', check: (r) => r.time >= 300 },
  { id: 'clear', name: 'ブリリアンス', t: '黒曜の荒野をクリア', coins: 2000, unlock: 'diamond', check: (r) => r.cleared && r.stageId === 'wastes' },
  { id: 'clear2', name: 'プリズム・ブレイカー', t: '水晶洞窟をクリア', coins: 2500, check: (r) => r.cleared && r.stageId === 'cavern' },
  { id: 'clear3', name: 'マグマ・ダイバー', t: '灼熱鉱脈をクリア', coins: 3000, check: (r) => r.cleared && r.stageId === 'magma' },
  { id: 'clear4', name: 'アブソリュート・ゼロ', t: '凍晶氷原をクリア', coins: 3500, check: (r) => r.cleared && r.stageId === 'tundra' },
  { id: 'clear5', name: 'ヴォイド・ウォーカー', t: '虚空聖堂をクリア', coins: 8000, check: (r) => r.cleared && r.stageId === 'void' },
  { id: 'heat1', name: 'ヒートアップ', t: 'HEAT 1以上でクリア', coins: 500, check: (r) => r.cleared && r.heat >= 1 },
  { id: 'heat3', name: 'オーバーヒート', t: 'HEAT 3以上でクリア', coins: 2000, check: (r) => r.cleared && r.heat >= 3 },
  { id: 'heat5', name: 'メルトダウン', t: 'HEAT 5でクリア', coins: 6000, check: (r) => r.cleared && r.heat >= 5 },
  { id: 'heat5void', name: '極光', t: '虚空聖堂を HEAT 5 でクリア', coins: 15000, check: (r) => r.cleared && r.heat >= 5 && r.stageId === 'void' },
  { id: 'charm100', name: 'チャーマー', t: '1回のプレイで100体を魅了', coins: 400, check: (r) => r.charmed >= 100 },
  { id: 'endless20', name: 'エンドレス・ナイト', t: 'エンドレスで20分生存', coins: 3000, check: (r) => r.endless && r.time >= 1200 },
  { id: 'evo', name: 'エヴォリューション', t: '武器を進化させる', coins: 200, check: (r) => r.evolved >= 1 },
  { id: 'evo3', name: 'トリプル・エヴォ', t: '1回のプレイで3つ進化', coins: 800, check: (r) => r.evolved >= 3 },
  { id: 'fever', name: 'FEVER', t: 'フィーバーを発動', coins: 50, check: (r) => r.fevers >= 1 },
  { id: 'fever5', name: 'フィーバー中毒', t: '1回のプレイで5回フィーバー', coins: 300, check: (r) => r.fevers >= 5 },
  { id: 'boss1', name: 'レジサイド', t: 'ダスク・キングを倒す', coins: 150, check: (r) => r.bosses >= 1 },
  { id: 'boss2', name: 'ドラゴンスレイヤー', t: 'ヴォイド・ドラゴンを倒す', coins: 400, check: (r) => r.bosses >= 2 },
  { id: 'coin500', name: 'リッチ', t: '1回のプレイでコイン500枚', coins: 100, unlock: 'amber', check: (r) => r.coins >= 500 },
  { id: 'miracle', name: 'ミラクル', t: 'オパールの奇跡を発生させる', coins: 100, check: (r) => r.miracles >= 1 },
  { id: 'full', name: 'フルセット', t: '武器を4種類そろえる', coins: 200, check: (r) => r.weaponCount >= 4 },
  { id: 'dmg1m', name: 'ミリオン', t: '1回のプレイで100万ダメージ', coins: 300, check: (r) => r.damage >= 1e6 },
  { id: 'dmg10m', name: 'テンミリオン', t: '1回のプレイで1000万ダメージ', coins: 1000, check: (r) => r.damage >= 1e7 },
];

// ---------------------------------------------------------------------
//  ガチャ
// ---------------------------------------------------------------------
export const GACHA_COST = 300;
export const GACHA10_COST = 2700;
export const RARITY = {
  N: { name: 'N', color: '#c9c9d9', rank: 0 },
  R: { name: 'R', color: '#5ab0ff', rank: 1 },
  SR: { name: 'SR', color: '#ffc21a', rank: 2 },
  SSR: { name: 'SSR', color: '#ff5fd2', rank: 3 },
  UR: { name: 'UR', color: 'rainbow', rank: 4 },
};

// ステージの時間
export const STAGE_TIME = 600; // 10分
