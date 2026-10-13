// =====================================================================
//  画面下のメニュー（ホーム・強化・宝石・記録・その他）と、カテゴリごとの入口（ハブ）
//  画面の data-nav にカテゴリを書くと、show() のときにメニューが出てそのカテゴリが光る。
//  data-nav の無い画面（ジュエル選択・研磨の本番・リザルトなど）ではメニューを隠す
//  新しい要素はハブのカード（HUBS）に足す
// =====================================================================
import { SHOP, UPPER_SHOP, ACHIEVEMENTS, ENEMIES } from './data.js';
import { gemIcon, roughIcon, shopIcon, pickaxeIcon, gavelIcon, enemyIcon } from './render.js';
import { fmt } from './util.js';
import { audio } from './audio.js';
import { save } from './save.js';
import { ROUGH, totalRough, collectionCount, COLLECTION_IDS } from './atelier.js';
import { BEAST_IDS, beastLevel, beastIcon } from './beasts.js';
import { currentSession } from './auction.js';
import { rankState, rankClass } from './rank.js';
import { diagCrashes } from './diag.js';
import {
  show, el, $, showTitle, showShop, showGacha, showZukan, showSettings, showRank, showExchange,
  coinPill, rankStyle, rankColor, checkUpperShop, lastBackupText, homeGem,
} from './ui.js';
import { showAtelier } from './atelier-ui.js';
import { showJukebox, trackList } from './jukebox.js';

export const NAV = [
  { id: 'home', jp: 'ホーム', en: 'HOME', c: '#b45cff' },
  { id: 'power', jp: '強化', en: 'POWER', c: '#ffd24a' },
  { id: 'jewel', jp: '宝石', en: 'JEWEL', c: '#e0b8ff' },
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
  return '<span class="mn-glyph">⚙</span>';
}

function buildNav() {
  navEl = el(`<nav id="mnav" class="hidden">${NAV.map((n) => `<button id="nav-${n.id}" data-c="${n.id}" style="--c:${n.c}"><span class="mn-ic"></span><span class="mn-jp">${n.jp}</span><span class="mn-en">${n.en}</span></button>`).join('')}</nav>`);
  document.getElementById('screens').before(navEl);
  navEl.querySelectorAll('button').forEach((b) => (b.onclick = () => {
    audio.unlock();
    audio.tap();
    if (b.dataset.c === 'home') showTitle();
    else showHub(b.dataset.c);
  }));
}

// show() から呼ぶ。cat が無ければ隠す。メニューのある画面ではタイトルの曲に戻す（ジュークボックスは除く）
export function syncNav(cat, node) {
  if (!navEl) buildNav();
  navCat = cat || null;
  navEl.classList.toggle('hidden', !navCat);
  if (!navCat) return;
  refreshNav();
  if (!(node && node.classList.contains('jukebox-screen'))) audio.playBgm('title');
}

// 光るカテゴリ・アイコン・印（宝石：磨いていない原石の数）を描き直す
export function refreshNav() {
  if (!navEl || !navCat) return;
  for (const b of navEl.querySelectorAll('button')) {
    const id = b.dataset.c;
    b.classList.toggle('on', id === navCat);
    $('.mn-ic', b).innerHTML = navIcon(id);
    const old = $('.mn-badge', b);
    if (old) old.remove();
    const n = id === 'jewel' ? totalRough() : 0;
    if (n) b.appendChild(el(`<b class="mn-badge">${n > 99 ? '99+' : n}</b>`));
  }
}

// ---------------------------------------------------------------- ハブのカード
const img = (src) => `<img class="hc-ic" src="${src}" alt="">`;
const glyph = (g) => `<span class="hc-ic hc-glyph">${g}</span>`;
const maxed = (items, lv) => items.filter((it) => (lv[it.id] || 0) >= it.max).length;

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
      { id: 'polish', en: 'POLISH', jp: '研磨', c: '#e0b8ff', wide: true, icon: img(roughIcon('mystic', ROUGH.mystic.color, 120)), s: `原石 ${rough} 個`, badge: rough ? String(rough > 99 ? '99+' : rough) : '', go: () => showAtelier('polish') },
      { id: 'mining', en: 'MINING', jp: '採掘', c: '#c9a36a', icon: img(pickaxeIcon(96)), s: `ジェムダスト ${fmt(save.dust || 0)}`, go: showGacha },
      { id: 'auction', en: 'AUCTION', jp: 'オークション', c: '#ffd24a', icon: img(gavelIcon(96)), s: lot ? `開催中 LOT ${sess.cur + 1} / ${sess.lots.length}` : 'この回は終了', badge: lot && sess.cur === 0 ? 'NEW' : '', go: () => showAtelier('auction') },
      { id: 'collection', en: 'COLLECTION', jp: 'コレクション', c: '#ff4d6d', icon: img(gemIcon('ruby', 96)), s: `${collectionCount()} / ${COLLECTION_IDS.length} 種`, go: () => showAtelier('collection') },
      { id: 'beasts', en: 'BEASTS', jp: '百獣', c: '#7fd0ff', icon: img(beastIcon(beasts[0] || 'sapphire', 96)), s: `召喚 ${beasts.length} / ${BEAST_IDS.length}`, go: () => showAtelier('beasts') },
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
    ];
  } },
};

export function showHub(cat) {
  const H = HUBS[cat];
  const cards = H.cards();
  const node = el(`<div class="screen hub-screen" data-nav="${cat}">
    <div class="topbar"><div style="width:44px"></div><h2><span class="en">${H.en}</span><span class="jp">${H.jp}</span></h2>${coinPill()}</div>
    <div class="hub-grid">${cards.map((c) => `<button class="hub-card ${c.wide ? 'wide' : ''} ${c.locked ? 'locked' : ''}" id="h-${c.id}" style="--c:${c.c}">
      ${c.icon}<div class="hc-t"><div class="hc-en">${c.en}</div><div class="hc-jp">${c.jp}</div><div class="hc-s">${c.s}</div></div>
      ${c.badge ? `<b class="mn-badge">${c.badge}</b>` : ''}
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
