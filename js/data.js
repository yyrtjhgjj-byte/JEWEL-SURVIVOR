// =====================================================================
//  ジュエルのデータ
//  宝石ことば（ジュエルパワー）は、サンリオ×セガトイズ「ジュエルペット」の
//  各ジュエルペットが担当する魔法の意味をベースにしています。
//  くわしくは docs/GEMS.md を見てください。
// =====================================================================

export const GEMS = {
  // ---------- ぶき（武器）になるジュエル ----------
  ruby: {
    jp: 'ルビー', en: 'RUBY', word: '勇気', kana: 'ゆうき',
    color: '#ff2d55', light: '#ffb3c4', dark: '#8c0022', cut: 'round',
    lore: 'まっかに もえる ゆうきの ジュエル。こわくても まえに すすむ ちからを くれるよ！',
  },
  sapphire: {
    jp: 'サファイア', en: 'SAPPHIRE', word: '友情', kana: 'ゆうじょう',
    color: '#2f6bff', light: '#b8ceff', dark: '#0a2380', cut: 'oval',
    lore: 'なかまと いっしょなら むてき！ ともだちの ジュエルが まわりを まもってくれる。',
  },
  garnet: {
    jp: 'ガーネット', en: 'GARNET', word: '愛', kana: 'あい',
    color: '#d6145f', light: '#ff9cc6', dark: '#5a0026', cut: 'heart',
    lore: 'だいすきの きもちが ハートに なって とんでいく。あたると ちょっぴり かいふく♡',
  },
  labradorite: {
    jp: 'ラブラドライト', en: 'LABRADORITE', word: '秘めた力', kana: 'ひめたちから',
    color: '#3fb6c9', light: '#d4fbff', dark: '#1b3f5c', cut: 'round', shimmer: true,
    lore: 'ちいさくても すごい まりょく！ いたずらな カミナリが どこかに おちるよ。',
  },
  opal: {
    jp: 'オパール', en: 'OPAL', word: '奇跡', kana: 'きせき',
    color: '#f4e9ff', light: '#ffffff', dark: '#b9a4d6', cut: 'oval', rainbow: true,
    lore: 'ねむっていた さいのうが めざめる にじいろの ジュエル。ときどき「キセキ」が おこる！',
  },
  amber: {
    jp: 'コハク', en: 'AMBER', word: '金運', kana: 'きんうん',
    color: '#ffab1a', light: '#ffe49a', dark: '#8f4a00', cut: 'drop',
    lore: 'リーダーの ジュエル。キラキラの コインが そらから ふってくる！',
  },
  angelite: {
    jp: 'エンジェライト', en: 'ANGELITE', word: '癒し', kana: 'いやし',
    color: '#8cc8ff', light: '#eaf6ff', dark: '#3a70a8', cut: 'round',
    lore: 'てんしの ひかりで つつみこむ。まわりの くすみを やさしく けしていくよ。',
  },
  diamond: {
    jp: 'ダイヤモンド', en: 'DIAMOND', word: 'カリスマ', kana: 'カリスマ',
    color: '#e6fbff', light: '#ffffff', dark: '#7fa9c2', cut: 'round',
    lore: 'みんなの あこがれ！ まぶしい かがやきが ぜんほうこうに はじけとぶ。',
  },
  emerald: {
    jp: 'エメラルド', en: 'EMERALD', word: '幸福と調和', kana: 'しあわせ',
    color: '#12c46e', light: '#a6ffd0', dark: '#005a2c', cut: 'emerald',
    lore: 'しあわせの クローバーが さきみだれる。ふんだ くすみは ダメージ！',
  },
  rhodochrosite: {
    jp: 'ロードクロサイト', en: 'RHODOCHROSITE', word: '情熱', kana: 'じょうねつ',
    color: '#ff5f8a', light: '#ffc6d6', dark: '#9c1f45', cut: 'round',
    lore: 'もえあがる じょうねつの ほのお！ まえに いる てきを まるごと こがす。',
  },
  kyanite: {
    jp: 'カイヤナイト', en: 'KYANITE', word: '決断', kana: 'けつだん',
    color: '#2250e0', light: '#9fb8ff', dark: '#0a1a66', cut: 'long',
    lore: 'まよわず いちばん つよい てきへ！ けつだんの ランスが つらぬく。',
  },
  aquamarine: {
    jp: 'アクアマリン', en: 'AQUAMARINE', word: '安らぎ', kana: 'やすらぎ',
    color: '#3fe0da', light: '#cffffd', dark: '#0f6f76', cut: 'emerald',
    lore: 'こころ おだやかな なみの ちから。まわりの てきを ザブーンと おしかえす。',
  },

  // ---------- チャーム（パッシブ）になるジュエル ----------
  topaz: { jp: 'トパーズ', en: 'TOPAZ', word: '自信', kana: 'じしん', color: '#ffc21a', light: '#fff0a8', dark: '#9a6200', cut: 'oval' },
  jasper: { jp: 'ジャスパー', en: 'JASPER', word: '強い意志', kana: 'つよいいし', color: '#d4552a', light: '#ffb592', dark: '#6e210a', cut: 'round' },
  nephrite: { jp: 'ネフライト', en: 'NEPHRITE', word: 'チームワーク', kana: 'チームワーク', color: '#52b35a', light: '#c4f5c0', dark: '#1d5a22', cut: 'drop' },
  milkyquartz: { jp: 'ミルキークオーツ', en: 'MILKY QUARTZ', word: '思いやり', kana: 'おもいやり', color: '#f4f1ff', light: '#ffffff', dark: '#bdb4dc', cut: 'heart' },
  coral: { jp: 'サンゴ', en: 'CORAL', word: '守護と幸運', kana: 'まもりとこううん', color: '#ff7a66', light: '#ffd0c7', dark: '#a3301f', cut: 'drop' },
  iolite: { jp: 'アイオライト', en: 'IOLITE', word: 'リフレッシュ', kana: 'リフレッシュ', color: '#6c5ce7', light: '#cfc8ff', dark: '#2a1f82', cut: 'oval' },
  prase: { jp: 'プレーズ', en: 'PRASE', word: '勉強', kana: 'べんきょう', color: '#7cb35a', light: '#d6f5bf', dark: '#355a1f', cut: 'emerald' },
  granite: { jp: 'グラナイト', en: 'GRANITE', word: '安心', kana: 'あんしん', color: '#b7aca3', light: '#f3ede8', dark: '#5c534c', cut: 'emerald' },
  coal: { jp: 'コール', en: 'COAL', word: '忍耐', kana: 'にんたい', color: '#4a4a58', light: '#a9a9c2', dark: '#15151c', cut: 'round' },
  titanite: { jp: 'チタナイト', en: 'TITANITE', word: '仕事運とバランス', kana: 'しごとうん', color: '#c9d63a', light: '#f6ffb0', dark: '#5f6a00', cut: 'long' },
  redberyl: { jp: 'レッドベリル', en: 'RED BERYL', word: '心身の浄化', kana: 'じょうか', color: '#e0245e', light: '#ffa3c0', dark: '#6b0626', cut: 'emerald' },
  peridot: { jp: 'ペリドット', en: 'PERIDOT', word: 'ポジティブ', kana: 'まえむき', color: '#9be22e', light: '#e4ffb2', dark: '#3f6a00', cut: 'oval' },

  // 敵ボスのジュエル
  obsidian: { jp: 'オブシディアン', en: 'OBSIDIAN', word: 'くすみ', kana: 'くすみ', color: '#3a2350', light: '#9b6fd0', dark: '#0d0414', cut: 'round' },
};

// ---------------------------------------------------------------------
//  ぶき
//  base: Lv1 の性能 / levels: Lv2〜8 で足される値 / evo: しんか
// ---------------------------------------------------------------------
export const WEAPONS = {
  ruby: {
    gem: 'ruby', name: 'ブレイブ・ショット',
    desc: 'ちかくの てきに ルビーの たまを うつ',
    base: { dmg: 70, cd: 1.0, amount: 1, speed: 1, pierce: 0, area: 1, life: 1.4 },
    levels: [
      { amount: 1, t: 'たまが 1こ ふえる' },
      { dmg: 30, t: 'ダメージ +30' },
      { pierce: 1, cd: -0.1, t: 'かんつう +1 / はやく うつ' },
      { amount: 1, t: 'たまが 1こ ふえる' },
      { dmg: 40, t: 'ダメージ +40' },
      { cd: -0.15, t: 'もっと はやく うつ' },
      { amount: 1, dmg: 50, pierce: 1, t: 'たま+1 / ダメージ+50 / かんつう+1' },
    ],
    evo: {
      with: 'jasper', name: 'ブレイブハート・バースト',
      desc: 'ゆうきの ばくはつ！ ピンチのとき ダメージ 2ばい',
    },
  },
  sapphire: {
    gem: 'sapphire', name: 'フレンド・オービット',
    desc: 'ともだちの サファイアが まわりを ぐるぐる まもる',
    base: { dmg: 65, cd: 1.6, amount: 2, speed: 1, area: 1, duration: 4 },
    levels: [
      { amount: 1, t: 'ともだち +1' },
      { dmg: 20, speed: 0.3, t: 'ダメージ +20 / はやく まわる' },
      { duration: 0.5, area: 0.15, t: 'ながく / ひろく' },
      { amount: 1, t: 'ともだち +1' },
      { dmg: 30, t: 'ダメージ +30' },
      { duration: 0.5, area: 0.15, t: 'ながく / ひろく' },
      { amount: 1, dmg: 30, t: 'ともだち +1 / ダメージ +30' },
    ],
    evo: { with: 'nephrite', name: 'エターナル・フレンズ', desc: 'ずっと いっしょ！ ふたえの わが きえずに まわりつづける' },
  },
  garnet: {
    gem: 'garnet', name: 'ラブ・ハート',
    desc: 'ハートを なげる。あてると HPが ちょっと かいふく',
    base: { dmg: 110, cd: 1.4, amount: 1, speed: 1, area: 1, pierce: 4 },
    levels: [
      { amount: 1, t: 'ハート +1' },
      { dmg: 40, t: 'ダメージ +40' },
      { area: 0.2, pierce: 2, t: 'おおきく / かんつう +2' },
      { amount: 1, t: 'ハート +1' },
      { dmg: 50, cd: -0.15, t: 'ダメージ +50 / はやく なげる' },
      { pierce: 3, t: 'かんつう +3' },
      { amount: 1, dmg: 60, t: 'ハート +1 / ダメージ +60' },
    ],
    evo: { with: 'milkyquartz', name: 'ラブラブ・スコール', desc: 'あいの ハートが どしゃぶり！ いっぱい かいふく' },
  },
  labradorite: {
    gem: 'labradorite', name: 'いたずらサンダー',
    desc: 'がめんの どこかの てきに カミナリが おちる',
    base: { dmg: 150, cd: 2.0, amount: 2, area: 1 },
    levels: [
      { amount: 1, t: 'カミナリ +1' },
      { dmg: 50, t: 'ダメージ +50' },
      { area: 0.25, t: 'ばくはつ はんい アップ' },
      { amount: 1, cd: -0.2, t: 'カミナリ +1 / はやく' },
      { dmg: 60, t: 'ダメージ +60' },
      { amount: 1, t: 'カミナリ +1' },
      { dmg: 80, area: 0.25, cd: -0.2, t: 'ダメージ+80 / はんい / はやく' },
    ],
    evo: { with: 'iolite', name: 'ひめたちから・ストーム', desc: 'カミナリが つぎつぎ れんさする だいあらし！' },
  },
  opal: {
    gem: 'opal', name: 'ミラクル・プリズム',
    desc: 'にじいろビームが ぐるっと まわる。ときどき キセキの 10ばい！',
    base: { dmg: 40, cd: 3.5, amount: 1, area: 1, speed: 1, duration: 2 },
    levels: [
      { dmg: 15, t: 'ダメージ +15' },
      { duration: 0.5, t: 'ながく でる' },
      { area: 0.2, t: 'ながい ビーム' },
      { amount: 1, t: 'ビーム +1' },
      { dmg: 20, cd: -0.3, t: 'ダメージ +20 / はやく' },
      { duration: 0.5, area: 0.2, t: 'ながく / ながい' },
      { amount: 1, dmg: 25, t: 'ビーム +1 / ダメージ +25' },
    ],
    evo: { with: 'coral', name: 'ミラクル・レインボー', desc: 'にじが きえない！ キセキが おこりまくる' },
  },
  amber: {
    gem: 'amber', name: 'ゴールド・レイン',
    desc: 'てきに キンキラ コインが ふってくる。たおすと コインを おとす',
    base: { dmg: 90, cd: 1.6, amount: 2, area: 1 },
    levels: [
      { amount: 1, t: 'コイン +1' },
      { dmg: 30, t: 'ダメージ +30' },
      { area: 0.2, t: 'はんい アップ' },
      { amount: 1, cd: -0.2, t: 'コイン +1 / はやく' },
      { dmg: 40, t: 'ダメージ +40' },
      { amount: 1, t: 'コイン +1' },
      { dmg: 50, area: 0.2, t: 'ダメージ +50 / はんい' },
    ],
    evo: { with: 'titanite', name: 'ゴールデン・ジャックポット', desc: 'コインの おおあめ！ ときどき 777 ジャックポット！' },
  },
  angelite: {
    gem: 'angelite', name: 'エンジェル・オーラ',
    desc: 'まわりに いやしの オーラ。ちかづく てきに ダメージ＆じわじわ かいふく',
    base: { dmg: 25, cd: 0.5, area: 1, knock: 0.4 },
    levels: [
      { area: 0.15, t: 'ひろく' },
      { dmg: 10, t: 'ダメージ +10' },
      { cd: -0.05, t: 'はやく' },
      { area: 0.15, t: 'ひろく' },
      { dmg: 12, t: 'ダメージ +12' },
      { area: 0.15, t: 'ひろく' },
      { dmg: 15, cd: -0.05, t: 'ダメージ +15 / はやく' },
    ],
    evo: { with: 'redberyl', name: 'ホーリー・サンクチュアリ', desc: 'せいなる ばしょ。よわった くすみを いっしゅんで じょうか！' },
  },
  diamond: {
    gem: 'diamond', name: 'ダイヤ・スプラッシュ',
    desc: 'ダイヤの かけらが ぜんほうこうに はじける',
    base: { dmg: 60, cd: 1.3, amount: 6, speed: 1, pierce: 1, life: 0.5 },
    levels: [
      { amount: 2, t: 'かけら +2' },
      { dmg: 20, t: 'ダメージ +20' },
      { pierce: 1, t: 'かんつう +1' },
      { amount: 2, t: 'かけら +2' },
      { dmg: 25, cd: -0.15, t: 'ダメージ +25 / はやく' },
      { life: 0.2, t: 'とおくまで とぶ' },
      { amount: 4, dmg: 30, t: 'かけら +4 / ダメージ +30' },
    ],
    evo: { with: 'topaz', name: 'カリスマ・スターダスト', desc: 'ほしくずの うずまき！ ぜんぶ クリティカル！' },
  },
  emerald: {
    gem: 'emerald', name: 'ハピネス・リーフ',
    desc: 'しあわせの クローバー ばたけが ダメージを あたえる',
    base: { dmg: 30, cd: 2.5, amount: 1, area: 1, duration: 2.5 },
    levels: [
      { amount: 1, t: 'はたけ +1' },
      { dmg: 10, t: 'ダメージ +10' },
      { area: 0.2, t: 'ひろく' },
      { amount: 1, duration: 0.5, t: 'はたけ +1 / ながく' },
      { dmg: 12, cd: -0.3, t: 'ダメージ +12 / はやく' },
      { area: 0.2, t: 'ひろく' },
      { amount: 1, dmg: 15, t: 'はたけ +1 / ダメージ +15' },
    ],
    evo: { with: 'granite', name: 'ハピネス・ガーデン', desc: 'よつばの おはなばたけ！ てきが おそくなって アイテムも でる' },
  },
  rhodochrosite: {
    gem: 'rhodochrosite', name: 'パッション・フレイム',
    desc: 'むいている ほうこうに じょうねつの ほのおを ふく',
    base: { dmg: 22, cd: 2.2, amount: 1, area: 1, duration: 1.2 },
    levels: [
      { dmg: 6, t: 'ダメージ +6' },
      { duration: 0.4, t: 'ながく ふく' },
      { area: 0.2, t: 'とおくまで とどく' },
      { amount: 1, t: 'うしろにも ふく' },
      { dmg: 8, cd: -0.3, t: 'ダメージ +8 / はやく' },
      { duration: 0.4, t: 'ながく ふく' },
      { dmg: 10, area: 0.2, t: 'ダメージ +10 / とおく' },
    ],
    evo: { with: 'peridot', name: 'パッション・インフェルノ', desc: 'ほのおの たつまき！ ずっと もえつづける' },
  },
  kyanite: {
    gem: 'kyanite', name: 'けつだんランス',
    desc: 'いちばん つよい てきに むけて ランスを なげる。どこまでも つらぬく',
    base: { dmg: 300, cd: 2.2, amount: 1, speed: 1, area: 1 },
    levels: [
      { dmg: 100, t: 'ダメージ +100' },
      { cd: -0.2, t: 'はやく なげる' },
      { amount: 1, t: 'ランス +1' },
      { dmg: 150, area: 0.2, t: 'ダメージ +150 / おおきく' },
      { cd: -0.2, t: 'はやく なげる' },
      { amount: 1, t: 'ランス +1' },
      { dmg: 250, t: 'ダメージ +250' },
    ],
    evo: { with: 'prase', name: 'ディサイシブ・ブレード', desc: 'あたると 6ほんに ぶんれつ！' },
  },
  aquamarine: {
    gem: 'aquamarine', name: 'アクア・ウェーブ',
    desc: 'まわりに なみを おこして てきを おしかえす',
    base: { dmg: 70, cd: 2.4, amount: 1, area: 1, knock: 2 },
    levels: [
      { dmg: 25, t: 'ダメージ +25' },
      { area: 0.15, t: 'ひろく' },
      { cd: -0.3, t: 'はやく' },
      { amount: 1, t: 'なみ +1' },
      { dmg: 30, t: 'ダメージ +30' },
      { area: 0.2, t: 'ひろく' },
      { dmg: 40, cd: -0.3, t: 'ダメージ +40 / はやく' },
    ],
    evo: { with: 'coal', name: 'ディープ・オーシャン', desc: 'しんかいの ちから！ あたった てきを アワで とじこめる' },
  },
};
export const WEAPON_IDS = Object.keys(WEAPONS);
export const WEAPON_MAX = 8;

// ---------------------------------------------------------------------
//  チャーム（パッシブ）
// ---------------------------------------------------------------------
export const PASSIVES = {
  topaz: { gem: 'topaz', name: 'じしんの トパーズ', max: 5, per: { might: 0.1 }, t: 'こうげきりょく +10%' },
  jasper: { gem: 'jasper', name: 'いしの ジャスパー', max: 5, per: { maxHp: 20 }, t: 'さいだいHP +20' },
  nephrite: { gem: 'nephrite', name: 'チームの ネフライト', max: 2, per: { amount: 1 }, t: 'たまの かず +1' },
  milkyquartz: { gem: 'milkyquartz', name: 'おもいやりの ミルキー', max: 5, per: { area: 0.1 }, t: 'こうげき はんい +10%' },
  coral: { gem: 'coral', name: 'まもりの サンゴ', max: 5, per: { luck: 0.15, crit: 0.01 }, t: 'ラッキー +15% / クリティカル +1%' },
  iolite: { gem: 'iolite', name: 'リフレッシュ アイオライト', max: 5, per: { cooldown: -0.08 }, t: 'クールダウン -8%' },
  prase: { gem: 'prase', name: 'べんきょうの プレーズ', max: 5, per: { growth: 0.1 }, t: 'けいけんち +10%' },
  granite: { gem: 'granite', name: 'あんしんの グラナイト', max: 5, per: { armor: 1 }, t: 'ぼうぎょ +1' },
  coal: { gem: 'coal', name: 'にんたいの コール', max: 5, per: { regen: 0.25 }, t: 'しぜんかいふく +0.25/びょう' },
  titanite: { gem: 'titanite', name: 'しごとうんの チタナイト', max: 5, per: { greed: 0.2 }, t: 'コイン +20%' },
  redberyl: { gem: 'redberyl', name: 'じょうかの レッドベリル', max: 5, per: { magnet: 0.3 }, t: 'ひろう はんい +30%' },
  peridot: { gem: 'peridot', name: 'まえむき ペリドット', max: 5, per: { moveSpeed: 0.08, speed: 0.08, duration: 0.08 }, t: 'いどう / だんそく / じぞく +8%' },
};
export const PASSIVE_IDS = Object.keys(PASSIVES);

export const BASE_STATS = {
  maxHp: 100, might: 1, armor: 0, regen: 0, cooldown: 1, area: 1, speed: 1, duration: 1,
  amount: 0, moveSpeed: 1, magnet: 1, luck: 1, growth: 1, greed: 1, crit: 0.05, revive: 0, reroll: 2,
};

// ---------------------------------------------------------------------
//  キャラ（はじめに もつ ジュエル）
// ---------------------------------------------------------------------
export const CHARACTERS = {
  ruby: { weapon: 'ruby', perk: 'ピンチのとき こうげき +30%', stats: { might: 0.1 }, rarity: 'R', start: true },
  sapphire: { weapon: 'sapphire', perk: 'ひろう はんい +20% / クールダウン -5%', stats: { magnet: 0.2, cooldown: -0.05 }, rarity: 'R', start: true },
  garnet: { weapon: 'garnet', perk: 'さいだいHP +20 / かいふく +0.2', stats: { maxHp: 20, regen: 0.2 }, rarity: 'R', start: true },
  labradorite: { weapon: 'labradorite', perk: 'クリティカル +5%', stats: { crit: 0.05 }, rarity: 'SR', unlock: '1かいで 1000たい たおす' },
  amber: { weapon: 'amber', perk: 'コイン +30%', stats: { greed: 0.3 }, rarity: 'SR', unlock: '1かいで コイン 500まい あつめる' },
  angelite: { weapon: 'angelite', perk: 'しぜんかいふく +0.4', stats: { regen: 0.4 }, rarity: 'SR', unlock: '5ふん いきのこる' },
  diamond: { weapon: 'diamond', perk: 'はんい +10% / クリティカル +3%', stats: { area: 0.1, crit: 0.03 }, rarity: 'UR', unlock: 'ステージ クリア' },
  opal: { weapon: 'opal', perk: 'ラッキー +25%', stats: { luck: 0.25 }, rarity: 'UR', unlock: 'ガチャ' },
  emerald: { weapon: 'emerald', perk: 'けいけんち +10% / ラッキー +10%', stats: { growth: 0.1, luck: 0.1 }, rarity: 'SR', unlock: 'ガチャ' },
  rhodochrosite: { weapon: 'rhodochrosite', perk: 'こうげき +15% / さいだいHP -10', stats: { might: 0.15, maxHp: -10 }, rarity: 'SR', unlock: 'ガチャ' },
  kyanite: { weapon: 'kyanite', perk: 'だんそく +20%', stats: { speed: 0.2 }, rarity: 'SR', unlock: 'ガチャ' },
  aquamarine: { weapon: 'aquamarine', perk: 'じぞく +15% / ぼうぎょ +1', stats: { duration: 0.15, armor: 1 }, rarity: 'SR', unlock: 'ガチャ' },
};
export const CHAR_IDS = Object.keys(CHARACTERS);

// ---------------------------------------------------------------------
//  てき「くすみ団」
// ---------------------------------------------------------------------
export const ENEMIES = {
  slime: { name: 'くすみスライム', hp: 70, speed: 48, dmg: 6, r: 13, xp: 1, color: '#6b5a8e', desc: 'ジュエルの かがやきを すいとる べとべと。' },
  bat: { name: 'ヤミバット', hp: 45, speed: 88, dmg: 5, r: 11, xp: 1, color: '#4a3a6a', desc: 'くらやみから とんでくる。はやい！' },
  ghost: { name: 'カゲおばけ', hp: 140, speed: 60, dmg: 8, r: 15, xp: 2, color: '#8a7fb0', desc: 'ふわふわ ゆれながら ちかづいてくる。' },
  toge: { name: 'トゲくすみ', hp: 300, speed: 62, dmg: 10, r: 16, xp: 3, color: '#5a3a5e', desc: 'トゲトゲで いたい。ちょっと かたい。' },
  golem: { name: 'ドロゴーレム', hp: 800, speed: 36, dmg: 14, r: 24, xp: 6, color: '#6e5f58', desc: 'どろの かたまり。とっても タフ。' },
  knight: { name: 'くすみナイト', hp: 1200, speed: 55, dmg: 16, r: 20, xp: 8, color: '#3c3456', desc: 'くすみ団の エリート へいし。' },
  boss1: { name: 'くすみキング', hp: 30000, speed: 50, dmg: 20, r: 48, xp: 200, boss: true, color: '#5b3f8a', desc: 'スライムたちの おうさま。3ぷんに あらわれる。' },
  boss2: { name: 'ヤミドラゴン', hp: 90000, speed: 62, dmg: 26, r: 52, xp: 500, boss: true, color: '#2e1f4f', desc: 'よぞらを くろく ぬりつぶす りゅう。6ぷんに あらわれる。' },
  boss3: { name: 'ダーク・クイーン', hp: 260000, speed: 55, dmg: 32, r: 58, xp: 2000, boss: true, color: '#1a0d2a', desc: 'くすみ団の ボス。オブシディアンの ちからで せかいの かがやきを うばおうとしている。' },
  crystal: { name: 'キラキラクリスタル', hp: 1, speed: 0, dmg: 0, r: 16, xp: 0, prop: true, color: '#ffffff', desc: 'こわすと アイテムが でてくる！' },
};

// ---------------------------------------------------------------------
//  ジュエル工房（えいきゅう強化）
// ---------------------------------------------------------------------
export const SHOP = [
  { id: 'might', name: 'パワー', gem: 'topaz', max: 5, base: 120, per: { might: 0.05 }, t: 'こうげき +5%' },
  { id: 'maxHp', name: 'たいりょく', gem: 'jasper', max: 5, base: 100, per: { maxHp: 10 }, t: 'さいだいHP +10' },
  { id: 'armor', name: 'まもり', gem: 'granite', max: 3, base: 250, per: { armor: 1 }, t: 'ぼうぎょ +1' },
  { id: 'regen', name: 'かいふく', gem: 'coal', max: 5, base: 150, per: { regen: 0.1 }, t: 'しぜんかいふく +0.1' },
  { id: 'cooldown', name: 'クールダウン', gem: 'iolite', max: 3, base: 400, per: { cooldown: -0.03 }, t: 'クールダウン -3%' },
  { id: 'area', name: 'はんい', gem: 'milkyquartz', max: 3, base: 300, per: { area: 0.05 }, t: 'はんい +5%' },
  { id: 'speed', name: 'だんそく', gem: 'kyanite', max: 3, base: 150, per: { speed: 0.05 }, t: 'だんそく +5%' },
  { id: 'duration', name: 'じぞく', gem: 'aquamarine', max: 3, base: 200, per: { duration: 0.07 }, t: 'じぞく +7%' },
  { id: 'moveSpeed', name: 'いどう', gem: 'peridot', max: 3, base: 200, per: { moveSpeed: 0.04 }, t: 'いどう そくど +4%' },
  { id: 'magnet', name: 'マグネット', gem: 'redberyl', max: 3, base: 150, per: { magnet: 0.15 }, t: 'ひろう はんい +15%' },
  { id: 'luck', name: 'ラッキー', gem: 'coral', max: 3, base: 300, per: { luck: 0.08 }, t: 'ラッキー +8%' },
  { id: 'growth', name: 'せいちょう', gem: 'prase', max: 5, base: 250, per: { growth: 0.04 }, t: 'けいけんち +4%' },
  { id: 'greed', name: 'コイン', gem: 'titanite', max: 5, base: 150, per: { greed: 0.1 }, t: 'コイン +10%' },
  { id: 'crit', name: 'クリティカル', gem: 'diamond', max: 5, base: 250, per: { crit: 0.02 }, t: 'クリティカル +2%' },
  { id: 'reroll', name: 'リロール', gem: 'labradorite', max: 5, base: 200, per: { reroll: 1 }, t: 'えらびなおし +1かい' },
  { id: 'revive', name: 'ふっかつ', gem: 'angelite', max: 1, base: 3000, per: { revive: 1 }, t: 'やられても 1かい ふっかつ' },
  { id: 'amount', name: 'だんすう', gem: 'nephrite', max: 1, base: 5000, per: { amount: 1 }, t: 'たまの かず +1' },
];
export function shopCost(item, lv) {
  return Math.round(item.base * [1, 2.2, 3.8, 6, 9, 13][lv] / 10) * 10;
}

// ---------------------------------------------------------------------
//  トロフィー
// ---------------------------------------------------------------------
export const ACHIEVEMENTS = [
  { id: 'kill1', name: 'はじめての じょうか', t: 'くすみを 1たい たおす', coins: 20, check: (r) => r.kills >= 1 },
  { id: 'kill100', name: '100たい げきは！', t: '1かいで 100たい たおす', coins: 50, check: (r) => r.kills >= 100 },
  { id: 'kill500', name: '500たい げきは！！', t: '1かいで 500たい たおす', coins: 150, check: (r) => r.kills >= 500 },
  { id: 'kill1000', name: 'せんにん ぎり', t: '1かいで 1000たい たおす', coins: 300, unlock: 'labradorite', check: (r) => r.kills >= 1000 },
  { id: 'kill3000', name: 'くすみハンター', t: '1かいで 3000たい たおす', coins: 800, check: (r) => r.kills >= 3000 },
  { id: 'lv10', name: 'レベル10！', t: 'レベル10に なる', coins: 50, check: (r) => r.level >= 10 },
  { id: 'lv30', name: 'レベル30！！', t: 'レベル30に なる', coins: 200, check: (r) => r.level >= 30 },
  { id: 'lv50', name: 'レベル50！！！', t: 'レベル50に なる', coins: 600, check: (r) => r.level >= 50 },
  { id: 'time3', name: '3ぷん サバイバー', t: '3ぷん いきのこる', coins: 80, check: (r) => r.time >= 180 },
  { id: 'time5', name: '5ふん サバイバー', t: '5ふん いきのこる', coins: 200, unlock: 'angelite', check: (r) => r.time >= 300 },
  { id: 'clear', name: 'キラキラ マスター', t: 'ダーク・クイーンを たおして クリア', coins: 2000, unlock: 'diamond', check: (r) => r.cleared },
  { id: 'evo', name: 'はじめての しんか', t: 'ぶきを しんか させる', coins: 200, check: (r) => r.evolved >= 1 },
  { id: 'evo3', name: 'しんかの たつじん', t: '1かいで 3つ しんか させる', coins: 800, check: (r) => r.evolved >= 3 },
  { id: 'fever', name: 'フィーバー！', t: 'フィーバーを おこす', coins: 50, check: (r) => r.fevers >= 1 },
  { id: 'fever5', name: 'フィーバー中毒', t: '1かいで 5かい フィーバー', coins: 300, check: (r) => r.fevers >= 5 },
  { id: 'boss1', name: 'キング たおし', t: 'くすみキングを たおす', coins: 150, check: (r) => r.bosses >= 1 },
  { id: 'boss2', name: 'ドラゴン たおし', t: 'ヤミドラゴンを たおす', coins: 400, check: (r) => r.bosses >= 2 },
  { id: 'coin500', name: 'おかねもち', t: '1かいで コイン 500まい', coins: 100, unlock: 'amber', check: (r) => r.coins >= 500 },
  { id: 'miracle', name: 'キセキの しゅんかん', t: 'オパールの キセキを おこす', coins: 100, check: (r) => r.miracles >= 1 },
  { id: 'full', name: 'ジュエル コレクター', t: 'ぶきを 6こ そろえる', coins: 200, check: (r) => r.weaponCount >= 6 },
  { id: 'dmg1m', name: 'ミリオン ダメージ', t: '1かいで 100まん ダメージ', coins: 300, check: (r) => r.damage >= 1e6 },
  { id: 'dmg10m', name: 'ギガ ダメージ', t: '1かいで 1000まん ダメージ', coins: 1000, check: (r) => r.damage >= 1e7 },
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
export const STAGE_TIME = 600; // 10ぷん
