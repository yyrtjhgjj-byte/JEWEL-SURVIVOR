// =====================================================================
//  武器・チャームのくわしいページ（図鑑のカードを押すと開く）
//  数値はどれも強化（攻撃力・工房・チャームなど）を入れない素の値。くわしい動きの文は WEAPON_SPEC・CHARM_SPEC
// =====================================================================
import { GEMS, WEAPONS, PASSIVES, CHARACTERS, LIMIT_BREAK, WEAPON_MAX, charmLbText, charmLbMax, WEAPON_IDS } from './data.js';
import { ELEMENTS, elemOf } from './elements.js';
import { MASTERY_BONUS, statText } from './atelier.js';
import { gemIcon } from './render.js';
import { el, $, topbar, gemColor, wordTag } from './ui.js';
import { save } from './save.js';
import { audio } from './audio.js';

// 武器のくわしい動き（base：いつもの動き、evo：進化で変わること）
export const WEAPON_SPEC = {
  ruby: {
    base: [
      '弾数の分だけ 0.07 秒おきに続けて撃つ',
      '弾数が 2 以上なら、近い順に別々の敵を狙う（5 体まで）',
      '近くに敵がいないときは、進んでいた向きへ撃つ',
      '1 発は貫通の数 +1 体まで当たる（同じ敵には 1 回）',
      '弾は 1.4 秒飛んで消える。持続で長く飛ぶ',
      '攻撃範囲で弾が大きく、弾速で速く遠くまで届く',
    ],
    evo: [
      '撃つ間隔が CD の 55% になる（最短 0.2 秒）',
      '弾数 +1・貫通 +2。弾は少しずつ扇状に広がる',
      '弾 1 発はダメージの 150%。弾も少し大きく速くなる',
      '当たるたびに爆発し、周りの敵へ弾の 60% のダメージ',
      'HP 50% 未満のときに撃った弾は、爆発も含めて 2 倍',
    ],
  },
  sapphire: {
    base: [
      '持続の秒数だけ回り、CD の秒数だけ消える',
      '蒼玉は弾数の分だけ等間隔に並び、輪は広がったり縮んだりする',
      '触れた敵にダメージを与え、外へはじく',
      '同じ敵へは、全部の蒼玉あわせて 0.45 秒に 1 回まで',
      '出ている間は 1.6 秒ごとに、3 個までの蒼玉が近くの敵へ撃つ',
      '援護射撃は 1 体に当たり、ダメージの 70%。クールダウン短縮で早まる',
      '攻撃範囲で輪と蒼玉が大きく、弾速で速く回る（1 周約 2 秒）',
    ],
    evo: [
      '消えずにずっと回り続ける（CD・持続は関係なくなる）',
      '外側にもう 1 周、同じ数の蒼玉が逆向きに回る（広がり縮みはしない）',
      '蒼玉が少し大きくなり、当たるとダメージの 150%',
      '援護射撃はダメージの 70% のまま',
    ],
  },
  garnet: {
    base: [
      'CD ごとに、弾数の分だけ 0.09 秒おきにハートを投げる',
      'ハートは上へ放り上げられ、左右ばらばらに落ちる',
      '敵は狙わない。進んでいた左右の向きへ少し寄る',
      '1 個のハートは貫通の数 +1 体まで当たる（同じ敵には 1 回）',
      '当てた敵 1 体ごとに HP 0.4 回復（1 秒あたり約 6 まで）',
      '攻撃範囲でハートが大きく、弾速で高く投げ上げる',
      'ハートは 2.4 秒で消える（持続は関係しない）',
    ],
    evo: [
      '投げるのをやめ、自分の周りのランダムな場所へハートが降り続ける',
      '降る間隔は弾数が多いほど短い（弾数 3 で約 0.24 秒）',
      'クールダウン短縮でも間隔が縮む。CD と弾速は関係しない',
      '着地すると周りの敵すべてにダメージの 190%。攻撃範囲で広がる',
      '当てた敵 1 体ごとに HP 0.5 回復（1 秒あたり約 6 まで）',
    ],
  },
  labradorite: {
    base: [
      'CD ごとに、弾数の分だけ 0.1 秒おきに雷を落とす',
      '落ちる先は画面内の敵からランダム（同じ敵に重なることもある）',
      '落ちた場所の周りの敵すべてにダメージ',
      '攻撃範囲で雷の当たる範囲が広がる',
      '弾速と持続は関係しない',
    ],
    evo: [
      '落とす雷が 1 本増える',
      '落ちた敵から近くの敵へ、1 体ずつ最大 6 回連鎖する',
      '連鎖のダメージは 1 回ごとに前の 88%（6 回目で 46%）',
      '1 回の連鎖で同じ敵には戻らない',
    ],
  },
  opal: {
    base: [
      '自分から伸びる虹の光線が回る（1 周約 2.6 秒）',
      '持続の秒数だけ照射し、CD の秒数だけ休む',
      '光線は弾数の分だけ等間隔に出る',
      '触れている敵すべてに 0.2 秒に 1 回当たる（光線が何本でも共通）',
      '当たるたびに 5% で「奇跡」になり、ダメージ 10 倍',
      '奇跡の確率は幸運に比例する。クリティカルとも重なる',
      '攻撃範囲で光線が長く太く、弾速で速く回る',
    ],
    evo: [
      '消えずにずっと照射する（CD・持続は関係なくなる）',
      '光線が 1 本増える',
      '奇跡の確率が 18% になる（幸運に比例）',
    ],
  },
  amber: {
    base: [
      'CD ごとに、弾数の分だけ 0.06 秒おきに金貨を落とす',
      '自分の近くの敵からランダムに狙う。いなければ自分の周りに落ちる',
      '金貨は約 0.4 秒で落ち、狙ったときの敵の位置に着地する',
      '着地した場所の周りの敵すべてにダメージ。攻撃範囲で広がる',
      'この武器で倒した敵は 30% でコイン 1〜3 枚を落とす（ほかは 5%）',
      'コインを落とす確率は幸運に比例する',
      '弾速と持続は関係しない',
    ],
    evo: [
      '落とす間隔が CD の 75% になり、金貨が 2 枚増える',
      'この武器で倒した敵は必ずコインを落とす',
      '金貨が着地するたび 2.5% でジャックポット（幸運に比例）',
      'ジャックポットではコイン 49 枚分が散らばる',
    ],
  },
  angelite: {
    base: [
      'クールダウンごとに、オーラ内の敵すべてにダメージ',
      'オーラの広さは攻撃範囲に比例する',
      '当たった敵を軽く押し返す',
      'HP を毎秒 0.75（Lv1）〜 1.8（Lv8）回復し続ける',
      'HP 30% 未満の間はオーラが 1.5 倍に広がり、回復が 3 倍',
      '弾数・弾速・持続の影響は受けない',
    ],
    evo: [
      'オーラが 1.5 倍に広がる',
      'オーラ内の敵は移動速度が 55% に落ちる（ボス以外）',
      'HP 18% 未満の敵は、オーラが当たるとその場で倒す（ボス以外）',
      '回復が毎秒 3 になる（HP 30% 未満なら 9）',
    ],
  },
  diamond: {
    base: [
      'クールダウンごとに、弾数の数だけ破片を全方位へ等間隔に放つ',
      '敵は狙わず、放つ向きは毎回ランダムにずれる',
      '破片は貫通し、Lv1〜2 は 2 体、Lv3 から 3 体まで当たる',
      '射程は弾速と持続に比例する',
      '破片の当たる大きさは攻撃範囲に比例する',
    ],
    evo: [
      '0.13 秒ごとに、回転しながら反対向きの 2 方向へ破片を連射する',
      '連射の間隔はクールダウン短縮で縮み、弾数の影響は受けない',
      '破片はダメージの 170% で、必ずクリティカルになる',
      '貫通 +1（4 体まで）、射程 1.4 倍',
    ],
  },
  emerald: {
    base: [
      'クールダウンごとに、弾数の数だけ畑を置く',
      '畑は近くの敵からランダムに選んだ敵の足元に置く（いなければ自分の近く）',
      '畑の上の敵すべてに 0.35 秒ごとにダメージ',
      '畑の広さは攻撃範囲、残る時間は持続に比例する',
      '畑で倒した敵は 3% でアイテムを落とす（3 秒に 1 回まで）',
      '確率は幸運に比例。中身はコイン 50%・ハート 35%・ボム 10%・マグネット 5%',
    ],
    evo: [
      '畑の広さ 1.5 倍、残る時間 1.3 倍',
      '畑は 0.35 秒ごとにダメージの 130% を与える',
      '畑の上の敵は移動速度が 65% に落ちる（ボス以外）',
      'アイテムを落とす確率が 5% に上がる',
    ],
  },
  rhodochrosite: {
    base: [
      '持続の秒数だけ炎を噴き、クールダウンの秒数だけ休む',
      '炎は進む向き（止まっているときは最後に動いた向き）へ出る',
      '噴いている間、炎の粒が 0.085 秒ごとに出て敵を貫通する',
      '炎の粒は当たるたびにダメージの 160%',
      '弾数 1 ごとに炎が 1 本増え、扇形に広がる',
      '射程は攻撃範囲と弾速、炎の太さは攻撃範囲に比例する',
      '低いレベルほど射程が長い（Lv1 で +60%、Lv8 で 0）',
    ],
    evo: [
      '休まずに炎を噴き続ける（クールダウンと持続の影響は受けない）',
      '炎が 1 本増え、射程が 1.5 倍になる',
      '炎の粒のダメージが 1.2 倍（ダメージの 192%）',
      '炎の先に 1.6 秒燃える火だまりを 0.22 秒ごとに残す',
      '火だまりは 0.3 秒ごとにダメージの 80%。広さは攻撃範囲に比例',
    ],
  },
  kyanite: {
    base: [
      'クールダウンごとに、近くで残り HP が最も高い敵へ槍を投げる',
      '槍が複数なら、HP の高い順に別々の敵を狙う（敵が少なければ同じ敵へ）',
      '敵がいなければ進む向きへ投げる',
      '槍は無限に貫通し、同じ敵には 1 回だけ当たる',
      '当たった敵を強く押し返す',
      '射程は弾速に比例し、持続の影響は受けない。当たる幅は攻撃範囲に比例',
    ],
    evo: [
      '槍が最初に敵に当たると、4 方向へ分かれた槍を放つ',
      '分かれた槍はダメージの 75%。無限に貫通し、それ以上は分かれない',
      '分かれた槍は、最初に当たった敵には当たらない',
      '元の槍はそのまま飛び続ける',
    ],
  },
  aquamarine: {
    base: [
      'クールダウンごとに、自分を中心に波動を広げる',
      '波動は 0.6 秒で広がりきり、範囲の敵すべてに 1 回ずつ当たる',
      '当たった敵を強く押し返す（ボスはほとんど動かない）',
      '弾数 1 ごとに波動が 1 つ増え、0.25 秒ずつずれて出る',
      '波動の広さは攻撃範囲に比例する',
      '弾速と持続の影響は受けない',
    ],
    evo: [
      '波動が 1 つ増え、広さが 1.4 倍になる',
      '当たった敵を泡で 1.2 秒その場に止める（ボスとジュエルシーフ以外）',
      '泡で止めた敵にも、触れるとダメージを受ける',
    ],
  },
  alexandrite: {
    base: [
      'クールダウンごとに弾数ぶんの光弾を、近い敵から順に狙って撃つ',
      '撃つたびに紅と翠が入れ替わる（最初は紅。1 回に撃つ弾は同じ色）',
      '翠の弾は貫通 +1（Lv1 で 3 体、Lv6 から 4 体に当たる）',
      '紅の弾は 1 体に当たると爆発し、周りの敵にダメージの 60%',
      '弾は左右にばらけて飛び、近くのまだ当てていない敵へ曲がって追う',
      '弾は 2.2 秒で消える。持続で伸び、弾速で速くなる',
      '攻撃範囲で弾と爆発が大きくなる',
    ],
    evo: [
      '光弾が 2 発増える',
      'すべての弾が翠と紅を兼ね、4 体まで貫きながら当たるたびに爆発する',
      '追尾の曲がる速さが約 1.6 倍になる',
    ],
  },
  tourmaline: {
    base: [
      'クールダウンごとに弾数ぶんの雷光を、近い敵から順に狙って放つ',
      '当たると、近くのまだ当てていない敵へ跳ね移る',
      '跳ねる回数は Lv1 で 3 回、Lv8 で 8 回（1 本で最大 9 体）',
      '跳ねてもダメージは減らない',
      '近くに跳ね先がないと、そこで消える',
      '攻撃範囲で雷光の当たる幅が広がり、弾速で速くなる',
    ],
    evo: [
      '跳ねる回数 +8（16 回。1 本で最大 17 体）',
      'あと 3 回以上跳ねられるとき、跳ねるたび 30% で枝分かれする',
      '枝の雷光はダメージの 80%。元の残りより 3 回少なく跳ねる',
      '枝は元の雷光が当てた敵には当たらず、さらに分かれることはない',
    ],
  },
  moonstone: {
    base: [
      'クールダウンごとに弾数ぶんの刃を、近い敵から順に向けて投げる',
      '刃は一定の距離まで飛んで自機へ戻る。すべての敵を貫く',
      '行きと帰りで、同じ敵に 1 回ずつ当たる',
      '当てた敵を確率で 3 秒魅了する（Lv1 で 12%、Lv8 で 24%）',
      '魅了された敵は自機を襲わず、近くの敵にぶつかって 0.4 秒ごとにダメージの 60%',
      'ボスとジュエルシーフは魅了されない',
      '攻撃範囲で刃が大きく遠くまで飛び、弾速で投げる速さが上がる',
    ],
    evo: [
      '満月が 1 つ、自機のまわりを約 2.9 秒で 1 周する（刃も投げ続ける）',
      '満月は触れた敵に 0.4 秒ごとにダメージを与える',
      '魅了の確率は刃で 31%、満月で 58%。魅了は 4 秒続く',
      '魅了が解けるとき爆ぜ、周りの敵にダメージの 60%',
      '攻撃範囲で満月が大きくなり、回る輪も広がる',
    ],
  },
  obsidian: {
    base: [
      'クールダウンごとに弾数ぶんの斬撃を、近い敵から順に向けて振る',
      '1 振りで自機の前方約 140° の間近を薙ぎ、範囲の敵すべてに当たる',
      '狙える敵が 1 体なら、すべての斬撃がその敵に向く',
      'この武器の攻撃はクリティカル率が 10% 低い',
      '攻撃範囲で斬撃の届く距離が伸びる',
    ],
    evo: [
      '前方だけでなく自機の全周を薙ぎ、届く距離が 1.25 倍',
      '斬った敵 1 体ごとに 35% で、その場に闇の裂け目が残る',
      '裂け目は 1.2 秒残り、0.3 秒ごとに上の敵へダメージの 18%',
      '裂け目の大きさは攻撃範囲で広がる',
    ],
  },
  pectolite: {
    base: [
      'イルカは弾数ぶん、自機のまわりを泳ぐ（泳いでいる間は当たらない）',
      'クールダウンごとに、泳いでいるイルカが画面の中の近い敵へ順に跳ぶ',
      '敵を跳び越えた先まで跳び、道筋の敵すべてに当たる（1 回の跳びで同じ敵に 1 回）',
      '当たるたび 50% でしずくが飛び散る（0.18 秒に 1 つ、盤面に 30 個まで）',
      'しずくは 0.7 秒たつと回収範囲で吸い寄せられる',
      'しずく 1 つで HP 回復（Lv1 で 0.79、Lv8 で 1.42）',
      '攻撃範囲でイルカの当たる幅と敵の先へ跳ぶ距離が広がり、弾速で跳ぶのが速くなる',
    ],
    evo: [
      'イルカが 2 頭増え、跳ぶ間隔が 0.7 倍に縮む',
      '着水の波で周りの敵にダメージの 60%（攻撃範囲で広がる）',
      'しずくが出る確率 60%、0.14 秒に 1 つまで',
      'しずく 1 つの回復量が 1.8 になる',
    ],
  },
  amethyst: {
    base: [
      '近くにいる中で HP が最も高い敵（ボスなど）を狙い、倒れるか遠く離れるまで変えない',
      'クールダウンごとに弾数ぶんの結晶を撃つ。途中の敵はすり抜ける',
      '刺さるとダメージを与え、その敵に結晶が 1 つ育つ（倒れるまで消えない）',
      '結晶が 5 つで砕け、その敵にダメージの 9 倍、周りの敵にダメージの 80%',
      '狙った敵が先に倒れたら、飛んでいる結晶は次の狙いへ向かう',
      '攻撃範囲で砕けたときの範囲が広がり、弾速で結晶が速くなる',
    ],
    evo: [
      '結晶が 4 つで砕け、その敵へのダメージが 10 倍になる',
      '撃つ間隔が 0.85 倍に縮む',
      '砕けると欠片が 8 方向へ飛び、1 つでダメージの 80%（3 体まで貫く）',
    ],
  },
};

// チャームの特別な決まり
export const CHARM_SPEC = {
  malachite: [
    '取ったときに復活の回数が 1 増える',
    '復活はマラカイトの分から先に使う',
    '使うと砕けてチャームの枠から消え、枠が 1 つ空く',
    '砕けたあとは、そのランではもう候補に出ない',
  ],
};

// 表の列：[キー, 見出し, 書き方]
const COLS = [
  ['dmg', 'ダメージ', (v) => String(Math.round(v))],
  ['cd', 'CD', (v) => `${+v.toFixed(2)}秒`],
  ['amount', '数', (v) => String(v)],
  ['area', '範囲', (v) => `×${+v.toFixed(2)}`],
  ['pierce', '貫通', (v) => String(v)],
  ['duration', '持続', (v) => `${+v.toFixed(1)}秒`],
  ['speed', '速さ', (v) => `×${+v.toFixed(2)}`],
  ['life', '射程', (v) => `${+v.toFixed(1)}秒`],
  ['bounce', '跳弾', (v) => String(v)],
  ['charm', '魅了', (v) => `${Math.round(v * 100)}%`],
];

// Lv ごとの素の性能（weaponStats から強化を抜いたもの）
function levelStats(def, lv) {
  const s = { ...def.base };
  for (let i = 0; i < lv - 1 && i < def.levels.length; i++) {
    for (const k in def.levels[i]) if (k !== 't') s[k] = (s[k] || 0) + def.levels[i][k];
  }
  return s;
}
const baseDmg = (def, s, lv, evo) => s.dmg * (def.dmgMul || 1) * (evo ? def.evo.mul || 1 : 1 + (def.lowBoost || 0) * Math.max(0, WEAPON_MAX - lv) / 7);

const list = (items) => `<ul class="sp-list">${items.map((t) => `<li>${t}</li>`).join('')}</ul>`;
const sec = (title, body) => `<section class="sp-sec"><h3>${title}</h3>${body}</section>`;

function elementSec(gem) {
  const k = elemOf(gem);
  if (!k) return '';
  const E = ELEMENTS[k];
  const rows = [`<b style="color:${E.color}">${E.jp}</b>　${E.st}：${E.d}`];
  if (E.vs) rows.push(E.vs);
  return sec('属性', list(rows));
}
function masterySec(gem) {
  const m = MASTERY_BONUS[gem];
  if (!m) return '';
  return sec('練度', list([`練度 1 ごとに ${Object.entries(m).map(([k, v]) => statText(k, v)).join(' / ')}`]));
}

function weaponBody(id) {
  const def = WEAPONS[id];
  const evoSeen = save.seen.evos[id];
  const lvs = Array.from({ length: WEAPON_MAX }, (_, i) => levelStats(def, i + 1));
  // ダメージ・CD・数はいつも出す。ほかの列は Lv で値が変わるものだけ
  const keys = COLS.filter(([k]) => (k in def.base || def.levels.some((l) => k in l)) &&
    (['dmg', 'cd', 'amount'].includes(k) || new Set(lvs.map((s) => s[k] || 0)).size > 1));
  const rows = lvs.map((s, i) => [`Lv${i + 1}`, ...keys.map(([k, , f]) => f(k === 'dmg' ? baseDmg(def, s, i + 1, false) : s[k] || 0))]);
  const table = `<div class="sp-tbl-wrap"><table class="sp-tbl"><tr><th></th>${keys.map(([, h]) => `<th>${h}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${c}</td>` : `<th>${c}</th>`)).join('')}</tr>`).join('')}</table></div>
    <p class="sp-note">ダメージは 1 回あたりの素の値（攻撃力などの強化とクリティカルを入れない）。${def.lowBoost > 0 ? `Lv${WEAPON_MAX} より前は補正で高めになる` : def.lowBoost < 0 ? `Lv${WEAPON_MAX} より前は補正で低めになる` : ''}</p>`;
  const spec = WEAPON_SPEC[id] || {};
  const evoDmg = Math.round(baseDmg(def, lvs[WEAPON_MAX - 1], WEAPON_MAX, true));
  const evoBody = evoSeen
    ? `<p class="sp-lead"><b>${def.evo.name}</b> — ${def.evo.desc}</p>${list([`1 回あたりのダメージ ${evoDmg}`, ...(spec.evo || [])])}`
    : '<p class="sp-lead">???</p>';
  // リミットブレイク：この武器が持っている性能だけが候補になる
  const has = (need) => (Array.isArray(need) ? need : [need]).some((k) => k in def.base || def.levels.some((l) => k in l));
  const lbs = LIMIT_BREAK.filter((o) => !o.need || has(o.need)).map((o) => {
    const extra = o.cap ? `（1 つの武器で ${Math.round(o.cap * 100)}% まで）` : o.max ? `（${o.max} 回まで）` : '';
    const skip = def.evo.lbSkip && def.evo.lbSkip.includes(o.k) && evoSeen ? '（進化後は出ない）' : '';
    return `${o.t}${extra}${skip}`;
  });
  const ch = CHARACTERS[def.gem];
  return sec('レベルごとの数値', table) +
    (spec.base ? sec('くわしい動き', list(spec.base)) : '') +
    sec('進化', `<p class="sp-cond">Lv${WEAPON_MAX} でチャーム「${GEMS[def.evo.with].jp}」を持つ</p>${evoBody}`) +
    sec('リミットブレイク', `<p class="sp-cond">Lv${WEAPON_MAX}（進化済みか、もう進化できないとき）のレベルアップで、次の中から出る</p>${list(lbs)}`) +
    elementSec(def.gem) +
    (ch ? sec('ジュエル', list([`特性：${ch.perk}`, `解放：${ch.start ? '最初から使える' : ch.unlock || ''}`])) : '') +
    masterySec(def.gem);
}

function charmBody(id) {
  const p = PASSIVES[id];
  const rows = [];
  for (let lv = 1; lv <= p.max; lv++) {
    const per = Object.entries(p.per);
    rows.push(`<tr><th>Lv${lv}</th><td>${per.length ? per.map(([k, v]) => statText(k, v * lv)).join(' / ') : p.t}</td></tr>`);
  }
  const lbN = charmLbMax(id);
  const evoFor = WEAPON_IDS.filter((w) => WEAPONS[w].evo.with === id);
  return sec('レベルごとの効果', `<div class="sp-tbl-wrap"><table class="sp-tbl lt"><tr><th></th><th>効果（合計）</th></tr>${rows.join('')}</table></div>`) +
    (CHARM_SPEC[id] ? sec('特別な決まり', list(CHARM_SPEC[id])) : '') +
    sec('リミットブレイク', lbN ? list([`上位工房で解放。最大 Lv のとき 1 回ごとに ${charmLbText(id)}（${lbN} 回まで）`]) : '<p class="sp-cond">なし</p>') +
    sec('進化素材', evoFor.length ? list(evoFor.map((w) => `${GEMS[WEAPONS[w].gem].jp}の「${save.seen.weapons[w] || save.unlocked[w] ? WEAPONS[w].name : '???'}」`)) : '<p class="sp-cond">なし</p>') +
    elementSec(p.gem) +
    masterySec(p.gem);
}

// kind：'weapon' か 'charm'
export function openSpec(kind, id) {
  const isW = kind === 'weapon';
  const gem = isW ? WEAPONS[id].gem : PASSIVES[id].gem;
  const g = GEMS[gem];
  const head = isW
    ? `<b>${WEAPONS[id].name}</b> — ${WEAPONS[id].desc}`
    : `<b>${PASSIVES[id].t}</b>（最大 Lv${PASSIVES[id].max}）`;
  const node = el(`
    <div class="screen spec-page" style="--c:${gemColor(gem)}">
      ${topbar(g.en, g.jp, null, 'records#library')}
      <div class="sp-body">
        <div class="sp-head">
          <img src="${gemIcon(gem, 96)}" alt="">
          <div><div class="sp-name">${g.jp}<span class="en">${g.en}</span></div>${wordTag(gem)}<p class="sp-lead">${head}</p></div>
        </div>
        ${isW ? weaponBody(id) : charmBody(id)}
      </div>
    </div>`);
  $('#screens').appendChild(node);
  $('#back', node).onclick = () => { audio.tap(); node.remove(); };
}
