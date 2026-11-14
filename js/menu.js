// =====================================================================
//  画面下のメニュー（ホーム・強化・宝石・経営・記録・その他）と、カテゴリごとの入口（ハブ）。経営はハブを使わず地図の画面を開く
//  画面の data-nav にカテゴリを書くと、show() のときにメニューが出てそのカテゴリが光る。
//  data-nav の無い画面（ジュエル選択・研磨の本番・リザルトなど）ではメニューを隠す
//  新しい要素はハブのカード（HUBS）に足す
// =====================================================================
import { SHOP, UPPER_SHOP, ACHIEVEMENTS, ENEMIES, shopCost } from './data.js';
import { gemIcon, roughIcon, shopIcon, pickaxeIcon, gavelIcon, enemyIcon } from './render.js';
import { fmt } from './util.js';
import { audio } from './audio.js';
import { save } from './save.js';
import { ROUGH, totalRough, collectionCount, COLLECTION_IDS } from './atelier.js';
import { BEAST_IDS, BEAST_COST, beastLevel, beastIcon, jewelStock } from './beasts.js';
import { currentSession } from './auction.js';
import { rankState, rankClass } from './rank.js';
import { diagCrashes } from './diag.js';
import {
  show, el, $, showTitle, showShop, showGacha, showZukan, showSettings, showRank, showExchange,
  coinPill, rankStyle, rankColor, checkUpperShop, lastBackupText, homeGem, helpBtn, upperLv,
} from './ui.js';
import { showAtelier } from './atelier-ui.js';
import { showJukebox, trackList } from './jukebox.js';
import { showBiz, bizBadge } from './biz-ui.js';
import { showRebirth, rebirthCardText } from './rebirth.js';
import { showSlot, slotState } from './slot.js';
import { showLegends, legendCardText } from './legends.js';
import { showSandbox } from './sandbox.js';
import { showMyGems } from './mygems-ui.js';
import { myGems, registerMyGems, MY_MAX } from './mygems.js';
import { STAGES } from './stages.js';

// その章のステージをすべてクリアしたか（ジュエル・スロットは第2章、伝説の宝石は第3章で開く）
const chapterCleared = (ch) => STAGES.filter((st) => st.chapter === ch).every((st) => (save.stages[st.id] || {}).cleared);

export const NAV = [
  { id: 'home', jp: 'ホーム', en: 'HOME', c: '#b45cff' },
  { id: 'power', jp: '強化', en: 'POWER', c: '#ffd24a' },
  { id: 'jewel', jp: '宝石', en: 'JEWEL', c: '#e0b8ff' },
  { id: 'biz', jp: '経営', en: 'BUSINESS', c: '#4ade9a' },
  { id: 'archive', jp: '記録', en: 'ARCHIVE', c: '#7fd0ff' },
  { id: 'more', jp: 'その他', en: 'MORE', c: '#9a93b0' },
];

let navEl = null;
let navCat = null;

function navIcon(id) {
  if (id === 'home') return `<img src="${gemIcon(homeGem, 64)}" alt="">`;
  if (id === 'power') return `<img src="${shopIcon('might', 64)}" alt="">`;
  if (id === 'jewel') return `<img src="${roughIcon('large', ROUGH.large.color, 64)}" alt="">`;
  if (id === 'archive') return `<img src="${enemyIcon('boss3', 24)}" alt="">`;
  // 経営：地球と航路
  if (id === 'biz') return '<svg class="mn-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c3 2.6 3 14.4 0 17M12 3.5c-3 2.6-3 14.4 0 17"/><path d="M4 6.5C9 3 17 5 21 10" class="mn-arc"/></svg>';
  return '<span class="mn-glyph">⚙</span>';
}

function buildNav() {
  navEl = el(`<nav id="mnav" class="hidden">${NAV.map((n) => `<button id="nav-${n.id}" data-c="${n.id}" style="--c:${n.c}"><span class="mn-ic"></span><span class="mn-jp">${n.jp}</span><span class="mn-en">${n.en}</span></button>`).join('')}</nav>`);
  document.getElementById('screens').before(navEl);
  navEl.querySelectorAll('button').forEach((b) => (b.onclick = () => {
    audio.unlock();
    audio.tap();
    if (b.dataset.c === 'home') showTitle();
    else if (b.dataset.c === 'biz') showBiz();
    else showHub(b.dataset.c);
  }));
}

// show() から呼ぶ。cat が無ければ隠す。メニューのある画面ではタイトルの曲に戻す（ジュークボックスは除く。経営は経営の曲）。
// ジュークボックスの FEVER で速くした曲も、ほかの画面に移ったらふつうの速さに戻す
export function syncNav(cat, node) {
  if (!navEl) buildNav();
  navCat = cat || null;
  navEl.classList.toggle('hidden', !navCat);
  if (!navCat) return;
  refreshNav();
  if (node && node.classList.contains('jukebox-screen')) return;
  audio.tempoMul = 1;
  audio.playBgm(node && node.classList.contains('biz-screen') ? 'business' : node && node.classList.contains('slot-screen') ? 'casino' : 'title');
}

// 光るカテゴリ・アイコン・印（宝石：磨いていない原石の数、経営：配当・満杯の倉庫・止まった工場）を、変わったところだけ描き直す
export function refreshNav() {
  if (!navEl || !navCat) return;
  for (const b of navEl.querySelectorAll('button')) {
    const id = b.dataset.c;
    b.classList.toggle('on', id === navCat);
    // アイコンと印は、中身が変わったときだけ書き換える（画像を作り直すと読み込み直しで一瞬消えるため）
    const ic = $('.mn-ic', b), icon = navIcon(id);
    if (ic.dataset.h !== icon) { ic.dataset.h = icon; ic.innerHTML = icon; }
    // 宝石は磨いていない原石の数。ほかは、そのハブのカードに印があれば点（経営は bizBadge）
    const n = id === 'jewel' ? totalRough() : 0;
    const dot = id === 'biz' ? bizBadge() : !n && HUB_BADGES[id] && Object.values(HUB_BADGES[id]()).some(Boolean);
    const badge = (n ? `<b class="mn-badge">${n > 99 ? '99+' : n}</b>` : '') + (dot ? '<b class="mn-badge dot"></b>' : '');
    if (b.dataset.badge !== badge) {
      b.dataset.badge = badge;
      for (const old of b.querySelectorAll('.mn-badge')) old.remove();
      if (badge) b.insertAdjacentHTML('beforeend', badge);
    }
  }
}

// ---------------------------------------------------------------- ハブのカード
const img = (src) => `<img class="hc-ic" src="${src}" alt="">`;
const glyph = (g) => `<span class="hc-ic hc-glyph">${g}</span>`;
const maxed = (items, lv) => items.filter((it) => (lv[it.id] || 0) >= it.max).length;

// ハブのカードの印。数（磨いていない原石・召喚／強化できる百獣）・NEW（まだ開いていないオークションの回）・点（買える強化がある）・FEVER。
// 下のメニューの点もここから決める（refreshNav）
const DOT = '•';
const canBuy = (items, lv, cost) => items.some((it) => (lv[it.id] || 0) < it.max && save.coins >= cost(it, lv[it.id] || 0));
const unseenAuction = () => {
  const sess = currentSession(false);
  if (sess.lots[sess.cur] && !sess.seen) return true;
  const b = save.auction2;
  return !!(upperLv('blackAuction') && b && b.lots && b.lots[b.cur] && !b.seen);
};
const HUB_BADGES = {
  power: () => ({
    workshop: canBuy(SHOP, save.upgrades, shopCost) ? DOT : '',
    masterworks: save.upperShop && canBuy(UPPER_SHOP, save.upgrades2 || {}, (it, lv) => it.cost[lv]) ? DOT : '',
  }),
  jewel: () => {
    const rough = totalRough();
    const beasts = BEAST_IDS.filter((id) => jewelStock(id) >= BEAST_COST).length;
    return {
      polish: rough ? String(rough > 99 ? '99+' : rough) : '',
      auction: unseenAuction() ? 'NEW' : '',
      beasts: beasts ? String(beasts) : '',
      slot: chapterCleared(2) && slotState().free ? 'FEVER' : '',
    };
  },
};

const HUBS = {
  power: { en: 'POWER', jp: '強化', cards: () => {
    const open = checkUpperShop();
    return [
      { id: 'workshop', en: 'WORKSHOP', jp: '工房', c: '#ffd24a', wide: true, icon: img(shopIcon('might', 120)), s: `最大 ${maxed(SHOP, save.upgrades)} / ${SHOP.length}`, go: () => showShop(false) },
      { id: 'masterworks', en: 'MASTERWORKS', jp: '上位工房', c: '#b45cff', icon: img(shopIcon('crit', 96)), locked: !open,
        s: open ? `最大 ${maxed(UPPER_SHOP, save.upgrades2 || {})} / ${UPPER_SHOP.length}` : '工房の強化をすべて最大にすると解放', go: () => showShop(true) },
      { id: 'exchange', en: 'EXCHANGE', jp: '交換所・覚醒', c: '#ff9f1c', icon: glyph('✦'), s: `ジェムダスト ${fmt(save.dust || 0)}`, go: () => showExchange(() => showHub('power')) },
    ];
  } },
  jewel: { en: 'JEWEL', jp: '宝石', cards: () => {
    const rough = totalRough();
    const sess = currentSession(false);
    const lot = sess.lots[sess.cur];
    const beasts = BEAST_IDS.filter((id) => beastLevel(id) > 0);
    return [
      { id: 'polish', en: 'POLISH', jp: '研磨', c: '#e0b8ff', wide: true, icon: img(roughIcon('mystic', ROUGH.mystic.color, 120)), s: `原石 ${rough} 個`, go: () => showAtelier('polish') },
      { id: 'mining', en: 'MINING', jp: '採掘', c: '#c9a36a', icon: img(pickaxeIcon(96)), s: `ジェムダスト ${fmt(save.dust || 0)}`, go: showGacha },
      { id: 'auction', en: 'AUCTION', jp: 'オークション', c: '#ffd24a', icon: img(gavelIcon(96)), s: lot ? `開催中 LOT ${sess.cur + 1} / ${sess.lots.length}` : 'この回は終了', go: () => showAtelier('auction') },
      { id: 'collection', en: 'COLLECTION', jp: 'コレクション', c: '#ff4d6d', icon: img(gemIcon('ruby', 96)), s: `${collectionCount()} / ${COLLECTION_IDS.length} 種`, go: () => showAtelier('collection') },
      { id: 'beasts', en: 'BEASTS', jp: '百獣', c: '#7fd0ff', icon: img(beastIcon(beasts[0] || 'sapphire', 96)), s: `召喚 ${beasts.length} / ${BEAST_IDS.length}`, go: () => showAtelier('beasts') },
      { id: 'slot', en: 'JEWEL SLOT', jp: 'ジュエル・スロット', c: '#ff7ac8', icon: img(gemIcon('diamond', 96)), locked: !chapterCleared(2), s: chapterCleared(2) ? `JACKPOT ${fmt(slotState().pool)}` : '第2章をクリアで解放', go: () => showSlot(() => showHub('jewel')) },
      { id: 'legends', en: 'LEGENDS', jp: '伝説の宝石', c: '#ffd24a', icon: img(gemIcon('emerald', 96)), locked: !chapterCleared(3), s: chapterCleared(3) ? legendCardText() : '第3章をクリアで解放', go: () => showLegends(() => showHub('jewel')) },
      { id: 'mygems', en: 'JEWEL ATELIER', jp: 'ジュエル・アトリエ', c: '#ffb3e6', icon: img(gemIcon((registerMyGems(), (myGems()[0] || {}).id) || 'tourmaline', 96)), s: `${myGems().length} / ${MY_MAX}`, go: () => showMyGems(() => showHub('jewel')) },
      { id: 'sandbox', en: 'SANDBOX', jp: '宝石の砂場', c: '#8fe8ff', icon: img(gemIcon('opal', 96)), s: `${COLLECTION_IDS.length} 種`, go: () => showSandbox(() => showHub('jewel')) },
    ];
  } },
  archive: { en: 'ARCHIVE', jp: '記録', cards: () => {
    const enemies = Object.keys(ENEMIES).filter((id) => !ENEMIES[id].prop && !ENEMIES[id].segment && !ENEMIES[id].dummy);
    const seen = enemies.filter((id) => save.seen.enemies[id]).length;
    const ach = ACHIEVEMENTS.filter((a) => save.achievements[a.id]).length;
    const r = rankState();
    const tracks = trackList().filter((t) => !t.sec);
    return [
      { id: 'library', en: 'LIBRARY', jp: '図鑑', c: '#7fd0ff', icon: img(enemyIcon('boss3', 40)), s: `敵 ${seen} / ${enemies.length}`, go: () => showZukan(save.tabs.zukan === 'trophy' ? 'gems' : save.tabs.zukan) },
      { id: 'records', en: 'RECORDS', jp: '実績', c: '#ffd24a', icon: '<span class="hc-ic medal m-gold"></span>', s: `${ach} / ${ACHIEVEMENTS.length}`, go: () => showZukan('trophy') },
      { id: 'rank', en: 'RANK', jp: 'ユーザーランク', c: rankColor(r.lv), icon: `<span class="hc-ic hc-rank rk-mat ${rankStyle(r.lv)}" style="--rk:${rankColor(r.lv)}"><b>${r.lv}</b></span>`, s: rankClass(r.lv).name, go: showRank },
      { id: 'jukebox', en: 'JUKEBOX', jp: 'ジュークボックス', c: '#b45cff', icon: glyph('♪'), s: `${tracks.filter((t) => t.open).length} / ${tracks.length} 曲`, go: showJukebox },
    ];
  } },
  more: { en: 'MORE', jp: 'その他', cards: () => {
    const back = () => showHub('more');
    const crashes = diagCrashes().length;
    return [
      { id: 'settings', en: 'SETTINGS', jp: '設定', c: '#9a93b0', icon: glyph('⚙'), s: '音量・表示・データ削除', go: () => showSettings(back) },
      { id: 'backup', en: 'BACKUP', jp: 'バックアップ', c: '#7fd0ff', icon: glyph('⇅'), s: lastBackupText(), go: () => showSettings(back, false, 'sec-backup') },
      { id: 'log', en: 'LOG', jp: '動作の記録', c: '#ff9f1c', icon: glyph('≡'), s: crashes ? `記録 ${crashes} 件` : '記録なし', go: () => showSettings(back, false, 'sec-diag') },
      { id: 'rebirth', en: 'REBIRTH', jp: '転生', c: '#ff7ac8', icon: glyph('↻'), s: rebirthCardText(), go: () => showRebirth(back) },
    ];
  } },
};

// ハブの ? で開くヘルプ（見出しごとの項目の一覧）
const HUB_HELP = { power: '@power', jewel: '@jewel', archive: '@more', more: '@more' };
export function showHub(cat) {
  const H = HUBS[cat];
  const cards = H.cards();
  const bd = HUB_BADGES[cat] ? HUB_BADGES[cat]() : {};
  for (const c of cards) if (!c.locked && bd[c.id]) c.badge = bd[c.id];
  const node = el(`<div class="screen hub-screen" data-nav="${cat}">
    <div class="topbar">${helpBtn(HUB_HELP[cat])}<h2><span class="en">${H.en}</span><span class="jp">${H.jp}</span></h2>${coinPill()}</div>
    <div class="hub-grid">${cards.map((c) => `<button class="hub-card ${c.wide ? 'wide' : ''} ${c.locked ? 'locked' : ''}" id="h-${c.id}" style="--c:${c.c}">
      ${c.icon}<div class="hc-t"><div class="hc-en">${c.en}</div><div class="hc-jp">${c.jp}</div><div class="hc-s">${c.s}</div></div>
      ${c.badge ? `<b class="mn-badge ${c.badge === DOT ? 'dot' : ''}">${c.badge === DOT ? '' : c.badge}</b>` : ''}
    </button>`).join('')}</div>
  </div>`);
  show(node);
  for (const c of cards) {
    $(`#h-${c.id}`, node).onclick = () => {
      if (c.locked) return;
      audio.select();
      c.go();
    };
  }
}
