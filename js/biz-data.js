// =====================================================================
//  経営（宝石商社）のデータ：宝石の値打ち・地名と施設・会社のランク
//  仕組みは biz.js、画面は biz-ui.js、地図の形は biz-map.js
// =====================================================================

// 品質（atelier.js の GRADES と同じ並び：C B A S SS）ごとの値段の倍率
export const GRADE_MUL = [0.2, 0.45, 1, 2.6, 7];

// 宝石：base 品質 A・1 ct の磨いた石の $/ct、y 原石 → 磨いた石の歩留まり、size 磨いた石 1 個の大きさの目安（ct）、
// treat 処理できる石（処理すると品質が上がりやすいが値が下がる。処理していなければ「非処理」で少し高い）
export const BIZ_GEMS = {
  diamond: { base: 4000, y: 0.42, size: 0.8 },
  ruby: { base: 3000, y: 0.3, size: 1, treat: 'heat' },
  sapphire: { base: 1500, y: 0.32, size: 1.2, treat: 'heat' },
  emerald: { base: 2500, y: 0.28, size: 1.2, treat: 'oil' },
  alexandrite: { base: 6000, y: 0.3, size: 0.6 },
  redberyl: { base: 8000, y: 0.25, size: 0.3 },
  tourmaline: { base: 400, y: 0.35, size: 2 },
  aquamarine: { base: 350, y: 0.4, size: 3, treat: 'heat' },
  topaz: { base: 120, y: 0.4, size: 4, treat: 'heat' },
  garnet: { base: 150, y: 0.38, size: 2 },
  peridot: { base: 120, y: 0.38, size: 2.5 },
  citrine: { base: 40, y: 0.45, size: 5, treat: 'heat' },
  iolite: { base: 60, y: 0.38, size: 2 },
  kyanite: { base: 80, y: 0.3, size: 2 },
  titanite: { base: 250, y: 0.3, size: 1.5 },
  opal: { base: 300, y: 0.45, size: 3 },
  moonstone: { base: 60, y: 0.5, size: 4 },
  labradorite: { base: 15, y: 0.55, size: 15 },
  turquoise: { base: 20, y: 0.55, size: 10, treat: 'oil' },
  amber: { base: 25, y: 0.6, size: 8, treat: 'heat' },
  rhodochrosite: { base: 120, y: 0.45, size: 5 },
  jasper: { base: 4, y: 0.6, size: 20 },
  coral: { base: 150, y: 0.55, size: 5 },
  nephrite: { base: 30, y: 0.6, size: 20 },
  prase: { base: 50, y: 0.55, size: 6 },
  angelite: { base: 4, y: 0.6, size: 20 },
  obsidian: { base: 3, y: 0.65, size: 20 },
  milkyquartz: { base: 2, y: 0.65, size: 20 },
};
export const BIZ_GEM_IDS = Object.keys(BIZ_GEMS);

// 会社のランク：総資産 need で上がる（下がらない）。k 配当の上限の係数、off 放置の上限（時間）、
// std そのランクの標準的な手取り（$/時。tools/test/biz-sim.js で測った値。配当と出資の換算に使う）
export const RANKS = [
  { name: '露店', need: 0, k: 0.3, off: 8, std: 5000 },
  { name: '宝石店', need: 50e3, k: 0.5, off: 10, std: 60e3 },
  { name: '宝石商', need: 500e3, k: 0.75, off: 12, std: 300e3 },
  { name: '卸問屋', need: 5e6, k: 1, off: 14, std: 1e6 },
  { name: '宝石商社', need: 50e6, k: 1.3, off: 16, std: 3e6 },
  { name: '国際商社', need: 1e9, k: 1.6, off: 20, std: 10e6 },
  { name: '宝石財閥', need: 18e9, k: 2, off: 24, std: 30e6 },
];

// ランクごとの目安：鉱区の Lv1 の産出の値打ち（$/時）と、元が取れるまでの時間（産出の値打ちで何時間分か）。
// 上のランクほど元が取れるまで長くして、育ち方がゆるやかになるようにする（tools/test/biz-sim.js で確かめる）
const EARN = [0, 7000, 30e3, 140e3, 650e3, 3e6, 14e6, 60e6];
const PAYBACK = [0, 0.6, 3, 10, 24, 48, 90, 150];
export const TIER = {
  earn: EARN,
  mine: EARN.map((e, i) => e * PAYBACK[i]),
  factory: EARN.map((e, i) => e * PAYBACK[i] * 0.7),
  shop: EARN.map((e, i) => e * PAYBACK[i] * 0.9),
};

// 地名（経度・緯度）。1 つの地名に施設が複数あってよい
export const PLACES = {
  tokyo: { name: '東京', country: '日本', lon: 139.77, lat: 35.71 },
  ratnapura: { name: 'ラトナプラ', country: 'スリランカ', lon: 80.4, lat: 6.68 },
  minas: { name: 'ミナスジェライス', country: 'ブラジル', lon: -44, lat: -18.5 },
  odisha: { name: 'オディシャ', country: 'インド', lon: 84, lat: 20.3 },
  jalisco: { name: 'マグダレナ', country: 'メキシコ（ハリスコ）', lon: -103.98, lat: 20.91 },
  lima: { name: 'カサパルカ', country: 'ペルー（リマ県）', lon: -76.23, lat: -11.65 },
  ilakaka: { name: 'イラカカ', country: 'マダガスカル', lon: 45.2, lat: -22.65 },
  mogok: { name: 'モゴック', country: 'ミャンマー', lon: 96.51, lat: 22.92 },
  sancarlos: { name: 'サンカルロス', country: 'アメリカ（アリゾナ）', lon: -110.45, lat: 33.35 },
  gdansk: { name: 'グダニスク', country: 'ポーランド', lon: 18.65, lat: 54.35 },
  dominica: { name: 'サンティアゴ', country: 'ドミニカ共和国', lon: -70.7, lat: 19.45 },
  dease: { name: 'ダース湖', country: 'カナダ', lon: -130, lat: 58.4 },
  marlborough: { name: 'マールボロ', country: 'オーストラリア', lon: 149.9, lat: -22.8 },
  coober: { name: 'クーバーペディ', country: 'オーストラリア', lon: 134.75, lat: -29.01 },
  welo: { name: 'ウェロ', country: 'エチオピア', lon: 39.22, lat: 11.58 },
  nain: { name: 'ナイン', country: 'カナダ', lon: -61.7, lat: 56.5 },
  capillitas: { name: 'カピジタス', country: 'アルゼンチン', lon: -66.4, lat: -27.3 },
  tosa: { name: '土佐沖', country: '日本', lon: 133.5, lat: 32.6 },
  montepuez: { name: 'モンテプエス', country: 'モザンビーク', lon: 39, lat: -13.1 },
  muzo: { name: 'ムソー', country: 'コロンビア', lon: -74.11, lat: 5.53 },
  kafubu: { name: 'カフブ', country: 'ザンビア', lon: 28.14, lat: -13.09 },
  ylamaa: { name: 'イレマー', country: 'フィンランド', lon: 27.1, lat: 60.6 },
  lightning: { name: 'ライトニングリッジ', country: 'オーストラリア', lon: 147.98, lat: -29.43 },
  batalha: { name: 'サン・ジョゼ・ダ・バターリャ', country: 'ブラジル（パライバ）', lon: -36.82, lat: -7.07 },
  diavik: { name: 'ディアヴィク', country: 'カナダ', lon: -110.28, lat: 64.5 },
  jwaneng: { name: 'ジュワネング', country: 'ボツワナ', lon: 24.73, lat: -24.56 },
  wahwah: { name: 'ワーワー山地', country: 'アメリカ（ユタ）', lon: -113.4, lat: 38.5 },
  meetiyagoda: { name: 'ミーティヤゴダ', country: 'スリランカ', lon: 80.1, lat: 6.2 },
  marovato: { name: 'マロヴァト', country: 'マダガスカル', lon: 47.7, lat: -14.4 },
  nishapur: { name: 'ニーシャープール', country: 'イラン', lon: 58.33, lat: 36.47 },
  jaipur: { name: 'ジャイプル', country: 'インド', lon: 75.79, lat: 26.91 },
  kofu: { name: '甲府', country: '日本', lon: 138.57, lat: 35.66 },
  bangkok: { name: 'バンコク', country: 'タイ', lon: 100.52, lat: 13.75 },
  chanthaburi: { name: 'チャンタブリー', country: 'タイ', lon: 102.1, lat: 12.61 },
  surat: { name: 'スーラト', country: 'インド', lon: 72.83, lat: 21.17 },
  torre: { name: 'トッレ・デル・グレコ', country: 'イタリア', lon: 14.37, lat: 40.79 },
  idar: { name: 'イーダー・オーバーシュタイン', country: 'ドイツ', lon: 7.31, lat: 49.71 },
  antwerp: { name: 'アントワープ', country: 'ベルギー', lon: 4.4, lat: 51.22 },
  hongkong: { name: '香港', country: '中国', lon: 114.17, lat: 22.3 },
  dubai: { name: 'ドバイ', country: 'アラブ首長国連邦', lon: 55.27, lat: 25.2 },
  newyork: { name: 'ニューヨーク', country: 'アメリカ', lon: -73.98, lat: 40.76 },
  tucson: { name: 'ツーソン', country: 'アメリカ（アリゾナ）', lon: -110.97, lat: 32.22 },
  carlsbad: { name: 'カールスバッド', country: 'アメリカ', lon: -117.35, lat: 33.16 },
  lucerne: { name: 'ルツェルン', country: 'スイス', lon: 8.31, lat: 47.05 },
  paris: { name: 'パリ', country: 'フランス', lon: 2.33, lat: 48.87 },
  london: { name: 'ロンドン', country: 'イギリス', lon: -0.145, lat: 51.51 },
  shanghai: { name: '上海', country: '中国', lon: 121.47, lat: 31.23 },
  singapore: { name: 'シンガポール', country: 'シンガポール', lon: 103.85, lat: 1.29 },
  geneva: { name: 'ジュネーブ', country: 'スイス', lon: 6.14, lat: 46.2 },
  gaborone: { name: 'ハボローネ', country: 'ボツワナ', lon: 25.91, lat: -24.65 },
};

// 鉱区：r ランク、q 品質の良さ（0〜1）、mix 出る宝石の割合、bonus 鑑定書の産地証明の上乗せ、e 産出の値打ちの補正
// 産出（原石 ct/時）は「TIER.earn × e ÷ 原石 1 ct の値打ち」で決める（安い石の鉱区ほど量が多い）
export const MINES = {
  ratnapura: { r: 1, q: 0.1, mix: { sapphire: 60, garnet: 30, alexandrite: 7 }, bonus: { sapphire: 1.3 } },
  minas: { r: 1, q: 0.1, e: 0.95, mix: { aquamarine: 25, topaz: 20, tourmaline: 15, citrine: 12, milkyquartz: 10, alexandrite: 5, titanite: 5, kyanite: 3 }, bonus: { topaz: 2.5, alexandrite: 1.6 } },
  odisha: { r: 1, q: 0.05, e: 0.85, mix: { iolite: 60, garnet: 40 } },
  jalisco: { r: 1, q: 0, e: 0.7, mix: { obsidian: 70, opal: 30 } },
  lima: { r: 1, q: 0, e: 0.7, mix: { angelite: 100 } },
  ilakaka: { r: 2, q: 0.1, mix: { sapphire: 55, garnet: 20, tourmaline: 10, topaz: 7, ruby: 5, alexandrite: 3 } },
  meetiyagoda: { r: 2, q: 0.15, e: 0.85, mix: { moonstone: 100 } },
  marovato: { r: 2, q: 0.1, e: 0.8, mix: { jasper: 100 } },
  mogok: { r: 2, q: 0.3, e: 1.15, mix: { ruby: 45, sapphire: 25, peridot: 15, moonstone: 15 }, bonus: { ruby: 1.8 } },
  sancarlos: { r: 2, q: 0.1, e: 0.9, mix: { peridot: 100 } },
  gdansk: { r: 2, q: 0.1, e: 0.85, mix: { amber: 100 } },
  dominica: { r: 2, q: 0.15, e: 0.9, mix: { amber: 100 }, bonus: { amber: 1.5 } },
  dease: { r: 2, q: 0.1, e: 0.85, mix: { nephrite: 100 } },
  marlborough: { r: 2, q: 0.1, e: 0.85, mix: { prase: 100 } },
  coober: { r: 3, q: 0.15, mix: { opal: 100 } },
  welo: { r: 3, q: 0.1, e: 0.9, mix: { opal: 100 } },
  nain: { r: 3, q: 0.1, e: 0.85, mix: { labradorite: 100 } },
  capillitas: { r: 3, q: 0.2, e: 0.95, mix: { rhodochrosite: 100 }, bonus: { rhodochrosite: 1.2 } },
  nishapur: { r: 3, q: 0.2, e: 0.95, mix: { turquoise: 100 }, bonus: { turquoise: 2 } },
  tosa: { r: 3, q: 0.2, e: 1.05, mix: { coral: 100 }, bonus: { coral: 2 }, harvest: true },
  montepuez: { r: 4, q: 0.2, mix: { ruby: 85, sapphire: 15 } },
  muzo: { r: 4, q: 0.3, e: 1.15, mix: { emerald: 100 }, bonus: { emerald: 1.6 } },
  kafubu: { r: 4, q: 0.15, mix: { emerald: 100 } },
  ylamaa: { r: 4, q: 0.25, e: 0.85, mix: { labradorite: 100 }, bonus: { labradorite: 2.5 } },
  lightning: { r: 5, q: 0.25, mix: { opal: 100 }, bonus: { opal: 5 } },
  batalha: { r: 5, q: 0.2, e: 0.9, mix: { tourmaline: 100 }, bonus: { tourmaline: 10 } },
  diavik: { r: 5, q: 0.2, e: 1.1, mix: { diamond: 100 } },
  jwaneng: { r: 6, q: 0.3, e: 1.15, mix: { diamond: 100 } },
  wahwah: { r: 6, q: 0.2, e: 0.95, mix: { redberyl: 100 } },
};
// 鉱区の設備（産出の倍率と、開拓権の値段に対する強化の値段）
export const MINE_LV = [
  { name: '手掘り', out: 1, cost: 0 },
  { name: '小型機械', out: 2.2, cost: 1.5 },
  { name: '重機', out: 4.5, cost: 4 },
  { name: '大規模採掘', out: 9, cost: 10 },
];
// 倉庫：産出の何時間分をためられるか（段階ごと）と、強化の値段（開拓権の値段に対する倍率）
export const STORE_LV = [{ h: 6, cost: 0 }, { h: 9, cost: 0.3 }, { h: 13, cost: 0.8 }, { h: 18, cost: 2 }, { h: 24, cost: 5 }];

// 工場：skill 腕前（0〜1）、fee 手間賃（研磨した石の値打ちに対する割合）、spec 得意な石、only その石しか磨けない、
// heat 加熱処理が得意、cap 処理量の補正
export const FACTORIES = {
  ratnapura: { r: 1, skill: 0.1, fee: 0.12, spec: ['sapphire', 'moonstone', 'garnet', 'alexandrite'] },
  jaipur: { r: 1, skill: 0.15, fee: 0.08, spec: ['emerald', 'garnet', 'iolite', 'moonstone', 'ruby', 'sapphire'] },
  kofu: { r: 2, skill: 0.35, fee: 0.14, spec: ['citrine', 'topaz', 'aquamarine', 'milkyquartz', 'tourmaline'] },
  chanthaburi: { r: 2, skill: 0.3, fee: 0.1, spec: ['ruby', 'sapphire'], heat: true },
  gdansk: { r: 2, skill: 0.3, fee: 0.1, spec: ['amber'] },
  torre: { r: 3, skill: 0.4, fee: 0.12, spec: ['coral'] },
  idar: { r: 4, skill: 0.7, fee: 0.2, spec: ['tourmaline', 'aquamarine', 'topaz', 'opal', 'rhodochrosite', 'labradorite', 'nephrite', 'prase', 'jasper'] },
  surat: { r: 4, skill: 0.3, fee: 0.07, spec: ['diamond'], only: ['diamond'], cap: 2 },
  antwerp: { r: 5, skill: 0.75, fee: 0.18, spec: ['diamond'], only: ['diamond'] },
};
// 工場の強化（処理量の倍率と、工場の値段に対する強化の値段）と職人（腕前の上乗せ）
export const FACT_LV = [{ cap: 1, cost: 0 }, { cap: 2, cost: 1.2 }, { cap: 4, cost: 3 }, { cap: 7, cost: 8 }, { cap: 12, cost: 20 }];
export const CREW = [{ skill: 0, cost: 0 }, { skill: 0.12, cost: 0.8 }, { skill: 0.24, cost: 2 }, { skill: 0.36, cost: 5 }];

// 取引所（卸）：mul 相場に対する買い取りの割合、spec 得意な石（高めに買う）、big 大きい石を高めに買う、rough 原石を高めに買う、
// show 宝石ショーの間だけ開く
export const EXCHANGES = {
  tokyo: { r: 1, mul: 0.58, name: '御徒町' },
  bangkok: { r: 1, mul: 0.6, spec: ['ruby', 'sapphire', 'garnet', 'peridot', 'moonstone'] },
  jaipur: { r: 1, mul: 0.58, spec: ['emerald', 'iolite', 'garnet', 'moonstone'] },
  hongkong: { r: 2, mul: 0.63, spec: ['ruby', 'nephrite', 'coral', 'amber'] },
  dubai: { r: 3, mul: 0.6, spec: ['emerald', 'ruby', 'diamond'], big: true, rough: 1.2 },
  newyork: { r: 3, mul: 0.6, spec: ['diamond', 'sapphire'], name: '47 丁目' },
  antwerp: { r: 4, mul: 0.62, spec: ['diamond'], rough: 1.3 },
  tucson: { r: 2, mul: 0.78, show: true },
};

// 直営店：mul 相場に対する売値、rate 1 時間に売れる数（Lv1）、likes 好まれる石、big 大きい石が好まれる、min 置く石の最低品質
export const SHOPS = {
  tokyo: { r: 2, name: '銀座', mul: 1.45, rate: 5, likes: ['sapphire', 'diamond', 'coral', 'moonstone'] },
  hongkong: { r: 3, mul: 1.5, rate: 7, likes: ['ruby', 'nephrite', 'coral', 'amber'] },
  singapore: { r: 3, mul: 1.45, rate: 6, likes: ['sapphire', 'ruby', 'emerald', 'opal'] },
  shanghai: { r: 4, mul: 1.5, rate: 8, likes: ['nephrite', 'ruby', 'diamond', 'amber'] },
  dubai: { r: 4, mul: 1.6, rate: 6, likes: ['emerald', 'ruby', 'diamond'], big: true },
  newyork: { r: 5, name: '5 番街', mul: 1.65, rate: 7, likes: ['diamond', 'sapphire', 'tourmaline'] },
  london: { r: 5, name: 'ボンド・ストリート', mul: 1.7, rate: 5, likes: ['sapphire', 'emerald', 'alexandrite'], min: 3 },
  paris: { r: 6, name: 'ヴァンドーム広場', mul: 1.8, rate: 5, likes: ['diamond', 'ruby', 'emerald', 'redberyl'], min: 3 },
};
// 直営店の強化：rate 1 時間に売れる量の倍率、slots 棚の段数（1 段に 1 種類の石を並べる）、cost 店の値段に対する強化の値段
export const SHOP_LV = [{ rate: 1, slots: 4, cost: 0 }, { rate: 1.8, slots: 6, cost: 1.5 }, { rate: 3, slots: 8, cost: 4 }, { rate: 5, slots: 10, cost: 10 }];
// 直営店が 1 時間に売れる量（相場での値打ち）。その店のランクの鉱区 Lv1 の産出の値打ち × SHOP_CAP × rate
export const SHOP_CAP = 0.8;

// 鑑定所：fee 値打ちに対する費用、min 1 件にかかる時間（分）。鑑定書を付けられるのは品質 LAB_MIN（A）以上
export const LABS = {
  carlsbad: { r: 3, fee: 0.05, min: 20 },
  lucerne: { r: 4, fee: 0.06, min: 12 },
};
export const LAB_MIN = 2;
// オークション：every 開催の間隔（時間）、min 出品できる最低品質、cap 1 回に出品できる量（相場での値打ち。そのランクの鉱区 Lv1 の産出の何時間分か）、
// top 落札値が上に寄る
export const AUCTIONS = {
  hongkong: { r: 4, every: 4, min: 3, cap: 0.6 },
  newyork: { r: 5, every: 4, min: 3, cap: 0.6 },
  geneva: { r: 5, every: 6, min: 3, cap: 1, top: true },
};
// 落札値は相場の lo〜hi 倍（SS・鑑定書・top で上に寄る）
export const AUCTION_MUL = { lo: 1.3, hi: 3 };
// サイト（ダイヤの原石の箱）：every 間隔（時間）、price 値段（ランク 5 の鉱区 Lv1 の産出の何時間分か）、
// value 中身の値打ち（標準の腕で磨いた場合）の値段に対する倍率の平均と、ばらつき
export const SIGHTS = { gaborone: { r: 5, every: 8, price: 3, value: 1.6, spread: 0.45 } };
// 注文：every 届く間隔（時間）、max 同時に受けられる数、reward 報酬（相場に対する倍率の幅）、h 期限（時間）の幅、
// size 1 件の量（自社の鉱区がその石を産む量の何時間分か）の幅、share 品質ごとの割合の目安（A 以上・S 以上が産出に占める割合）
export const ORDERS = { every: 3, max: 3, reward: [1.5, 2], h: [12, 24], size: [2, 6], share: { 2: 0.25, 3: 0.08 } };
// 注文の依頼主（地名 ＋ 業種）
export const CLIENT_PLACES = ['paris', 'london', 'newyork', 'geneva', 'dubai', 'hongkong', 'shanghai', 'singapore', 'tokyo', 'antwerp'];
export const CLIENT_KINDS = ['老舗ジュエラー', '宝飾ブランド', '百貨店', '個人のコレクター', '時計メーカー', 'ホテル', '王室御用達の宝飾店'];
// ツーソンの宝石ショー：毎年この期間だけ開く（[月, 日]。実際の開催は 1 月末〜2 月中旬）
export const SHOW_SEASON = { from: [1, 25], to: [2, 15] };

// 人を雇う値段（その施設の値段に対する倍率）とランク
export const STAFF = { r: 2, mine: 0.5, factory: 0.5, shop: 0.4 };
// 鉱山長は倉庫がこの割合までたまると出荷する
export const BOSS_SHIP = 0.25;

// 相場の出来事：mul 相場の倍率の幅、h 続く時間の幅、at どこで起きるか（mine 鉱区の石・shop 直営店の街の好み・gems 決まった石）
export const MARKET_EVENTS = {
  rain: { mul: [1.2, 1.3], h: [6, 14], at: 'mine' },
  strike: { mul: [1.25, 1.4], h: [8, 16], at: 'mine' },
  vein: { mul: [0.75, 0.85], h: [10, 20], at: 'mine' },
  buzz: { mul: [1.3, 1.45], h: [6, 12], at: 'shop' },
  bridal: { mul: [1.15, 1.25], h: [12, 24], gems: ['diamond'] },
  synth: { mul: [0.8, 0.88], h: [12, 24], gems: ['diamond', 'ruby', 'sapphire', 'emerald'] },
};

// 施設の種類（地図のピンの優先順と名前）
export const FAC_KINDS = [
  { id: 'hq', name: '本社' },
  { id: 'mine', name: '鉱区' },
  { id: 'factory', name: '工場' },
  { id: 'exchange', name: '取引所' },
  { id: 'shop', name: '直営店' },
  { id: 'lab', name: '鑑定所' },
  { id: 'auction', name: 'オークション' },
  { id: 'sight', name: 'サイト' },
];
export const FAC_TABLE = { mine: MINES, factory: FACTORIES, exchange: EXCHANGES, shop: SHOPS, lab: LABS, auction: AUCTIONS, sight: SIGHTS };
