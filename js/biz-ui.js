// =====================================================================
//  経営の画面：世界地図をスクロールして、地名のピンを押すと下から操作の板（シート）が上がる
//  仕組みは biz.js、データは biz-data.js、地図の形は biz-map.js
// =====================================================================
import { save, persist } from './save.js';
import { audio } from './audio.js';
import { fmt, todayStr } from './util.js';
import { show, el, $, coinPill, refreshCoinPill, haptic, getApp, toast, gemColor } from './ui.js';
import { gemIcon, coinIcon, roughIcon } from './render.js';
import { mountLiveGem } from './gem-gl.js';
import { GEMS } from './data.js';
import { gradeBadge, polishMini } from './atelier-ui.js';
import { refreshNav } from './menu.js';
import * as B from './biz.js';
import {
  PLACES, MINES, FACTORIES, EXCHANGES, SHOPS, SHOP_LV, STAFF, BOSS_SHIP, RANKS, MINE_LV, STORE_LV, FACT_LV, CREW, BIZ_GEMS, BIZ_GEM_IDS, FAC_KINDS, FAC_TABLE,
  LABS, AUCTIONS, SIGHTS, ORDERS, CLIENT_KINDS, FIND, DEALS,
} from './biz-data.js';
import { worldSvg, projX, projY, MAP_W, MAP_H } from './biz-map.js';

// 地図に出す施設の種類
const KINDS_ON = ['hq', 'mine', 'factory', 'exchange', 'shop', 'lab', 'auction', 'sight'];

// ---------------------------------------------------------------- 表記
export function usd(n) {
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a < 1e4) return `${s}$${fmt(a)}`;
  if (a < 1e6) return `${s}$${(a / 1e3).toFixed(a < 1e5 ? 1 : 0)}K`;
  if (a < 1e9) return `${s}$${(a / 1e6).toFixed(a < 1e8 ? 2 : 1)}M`;
  if (a < 1e12) return `${s}$${(a / 1e9).toFixed(a < 1e11 ? 2 : 1)}B`;
  return `${s}$${(a / 1e12).toFixed(2)}T`;
}
const ctf = (n) => (n < 10 ? n.toFixed(2) : n < 1000 ? n.toFixed(1) : n < 1e6 ? fmt(n) : (n / 1e6).toFixed(2) + 'M');
const minf = (m) => { m = Math.max(0, Math.ceil(m)); return m < 60 ? `${m} 分` : `${Math.floor(m / 60)} 時間${m % 60 ? ` ${m % 60} 分` : ''}`; };
const avgRun = () => (save.stats.runs ? (save.stats.runCoins || 0) / save.stats.runs : 0);
const metaAch = () => { const a = getApp(); if (a && a.checkMetaAchievements) a.checkMetaAchievements(); };

// 施設の種類のアイコン（線で描く）
const ICON = {
  hq: '<path d="M12 2.8l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 17l-5.8 3.3 1.4-6.4L2.7 9.5l6.5-.7z"/>',
  mine: '<path d="M4.5 19.5L13 11"/><path d="M6 7.2C9.6 4 15.4 3.8 19.6 7.4"/><path d="M12.2 5.2l3.4 3.4"/>',
  factory: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2.1 2.1M15.9 15.9L18 18M6 18l2.1-2.1M15.9 8.1L18 6"/>',
  exchange: '<path d="M12 4v15M7 19.5h10M5 7.5h14"/><path d="M7.5 7.5L4.5 13h6zM16.5 7.5L13.5 13h6z"/>',
  shop: '<path d="M5.5 8.5h13l-1 11.5h-11z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
  lab: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="M14.6 14.6L20 20"/>',
  auction: '<path d="M13.5 4.5l6 6M10.5 7.5l6 6M12 6l-4.5 4.5M4 20l6.5-6.5"/>',
  sight: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  market: '<path d="M4 19.5h16"/><path d="M5 15l4.5-4.5 3.5 3 6-6.5"/><path d="M15 7h4v4"/>',
};
const icon = (k) => `<svg viewBox="0 0 24 24" class="bz-ico" aria-hidden="true">${ICON[k]}</svg>`;
const kindName = (k) => FAC_KINDS.find((x) => x.id === k).name;

// ---------------------------------------------------------------- 地名と施設
function facsAt(pid) {
  const out = [];
  if (pid === 'tokyo') out.push('hq');
  for (const k of KINDS_ON) {
    const T = FAC_TABLE[k];
    if (!T || !T[pid]) continue;
    out.push(k);
  }
  return out;
}
const facRank = (k, pid) => (k === 'hq' ? 1 : FAC_TABLE[k][pid].r);
const placeRank = (pid) => Math.min(...facsAt(pid).map((k) => facRank(k, pid)));
const owns = (st, k, pid) => (k === 'hq' ? true : k === 'mine' ? !!st.mines[pid] : k === 'factory' ? !!st.factories[pid] : k === 'shop' ? !!st.shops[pid] : false);
const PLACE_IDS = Object.keys(PLACES).filter((pid) => facsAt(pid).length);

// ---------------------------------------------------------------- 画面
let ui = null;

export function showBiz() {
  const now = Date.now();
  let first = false;
  if (!save.biz) { save.biz = B.newBiz(now); first = true; persist(); }
  const st = save.biz;
  B.migrateBiz(st);
  // 前に見ていたときの控え（留守中のまとめに使う）
  const mark = st.away;
  B.catchUp(st, now);
  B.updateRank(st);
  // チュートリアル：まだ小さい会社なら案内する（途中の手順は持っているものに合わせて飛ばす）
  if (st.tut == null) st.tut = st.rank === 1 && Object.keys(st.mines).length <= 1 ? 0 : -1;
  const node = el(`<div class="screen biz-screen" data-nav="biz">
    <div class="bz-top">
      <div class="bz-rank"><b id="bzrk"></b><span class="bz-rbar"><i id="bzrb"></i></span></div>
      <div class="bz-cash"><small>資金</small><b id="bzcash"></b></div>
      <button class="bz-div" id="bzdiv"><small>配当</small><b id="bzdivv"></b></button>
      ${coinPill()}
    </div>
    <button class="bz-goal" id="bzgoal" hidden></button>
    <div class="bz-chips"><button class="bz-findchip" id="bzfind" hidden><small>名石</small><b id="bzfindn"></b></button><button class="bz-findchip" id="bzdeal" hidden><small>案件</small><b>1</b></button></div>
    <div class="bz-map" id="bzmap"><div class="bz-world" id="bzworld">${worldSvg()}<svg class="bz-routes" id="bzroutes" viewBox="0 0 ${MAP_W} ${MAP_H}" preserveAspectRatio="none" aria-hidden="true"></svg><div class="bz-pins" id="bzpins"></div></div></div>
    <div class="bz-tools"><button id="bzzoom" aria-label="拡大"></button><button id="bzmk">${icon('market')}<span>相場</span></button><button id="bzhq">${icon('hq')}<span>本社</span></button></div>
    <div class="bz-sheet" id="bzsheet"></div>
    <div class="bz-modal" id="bzmodal" hidden></div>
  </div>`);
  show(node);
  ui = { node, st, zoom: (st.view && st.view.z) || 1, sheet: null, touching: false, ships: '', t: 0, lastSave: now, modals: [], modal: null, findLater: false, dealLater: false };
  layoutMap(true);
  renderPins();
  renderTop();
  renderRoutes();
  $('#bzzoom', node).onclick = () => { audio.tap(); ui.zoom = ui.zoom === 1 ? 2 : 1; layoutMap(false); renderPins(); };
  $('#bzhq', node).onclick = () => { audio.tap(); openSheet('tokyo', 'hq'); };
  $('#bzmk', node).onclick = () => { audio.tap(); openSheet(null, 'market'); };
  $('#bzdiv', node).onclick = () => { audio.tap(); openSheet('tokyo', 'hq'); };
  $('#bzgoal', node).onclick = onGoal;
  $('#bzfind', node).onclick = () => { audio.tap(); ui.findLater = false; checkFinds(); };
  $('#bzdeal', node).onclick = () => { audio.tap(); if (!ui.modal && ui.st.deal) queueModal({ kind: 'deal' }); };
  $('#bzmodal', node).addEventListener('click', onModalClick);
  const map = $('#bzmap', node);
  let saveT = 0;
  map.addEventListener('scroll', () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => { st.view = { x: (map.scrollLeft + map.clientWidth / 2) / map.scrollWidth, y: (map.scrollTop + map.clientHeight / 2) / map.scrollHeight, z: ui.zoom }; }, 200);
  }, { passive: true });
  const sh = $('#bzsheet', node);
  sh.addEventListener('pointerdown', () => { ui.touching = true; });
  const up = () => { setTimeout(() => { ui.touching = false; }, 300); };
  sh.addEventListener('pointerup', up);
  sh.addEventListener('pointercancel', up);
  sh.addEventListener('click', onSheetClick);
  if (st.tut >= 0) startTut();
  else if (first) openSheet('ratnapura', 'mine');
  // 留守中のまとめ（15 分以上空けて、何か起きていたとき）
  if (mark && st.tut < 0) {
    const a = B.awaySince(st, mark, now);
    if (a.gone >= 15 * 60e3 && (a.mined > 0.01 || a.earned > 0.5 || a.finds || a.events.length || a.orders)) queueModal({ kind: 'away', a, rank: st.rank });
  }
  st.away = B.awayMark(st, now);
  checkFinds();
  const tick = () => {
    if (!ui || ui.node !== node || !node.isConnected) { if (ui && ui.node === node) ui = null; return; }
    const t = Date.now();
    B.catchUp(st, t);
    afterChange(false);
    tutCheck();
    st.away = B.awayMark(st, t);
    if (t - ui.lastSave > 15000) { ui.lastSave = t; persist(); }
    setTimeout(tick, 1000);
  };
  setTimeout(tick, 1000);
  requestAnimationFrame(animRoutes);
}

// 地図の大きさ（高さに合わせた幅 × 拡大）と、見ていた場所
function layoutMap(restore) {
  const map = $('#bzmap', ui.node), world = $('#bzworld', ui.node);
  const view = ui.st.view;
  const cx = restore ? (view ? view.x : projX(110) / MAP_W) : (map.scrollLeft + map.clientWidth / 2) / (map.scrollWidth || 1);
  const cy = restore ? (view ? view.y : 0.45) : (map.scrollTop + map.clientHeight / 2) / (map.scrollHeight || 1);
  const h = map.clientHeight * ui.zoom;
  const w = (h * MAP_W) / MAP_H;
  world.style.width = `${w}px`;
  world.style.height = `${h}px`;
  map.scrollLeft = cx * w - map.clientWidth / 2;
  map.scrollTop = cy * h - map.clientHeight / 2;
  ui.w = w; ui.h = h;
  $('#bzzoom', ui.node).textContent = ui.zoom === 1 ? '＋' : '－';
  ui.node.classList.toggle('zoomed', ui.zoom > 1);
}

// ---------------------------------------------------------------- ピン
function pinState(pid) {
  const st = ui.st, ks = facsAt(pid);
  const lock = placeRank(pid) > st.rank;
  const own = ks.some((k) => k !== 'hq' && owns(st, k, pid)) || ks.includes('hq');
  let alert = false;
  if (st.mines[pid] && st.mines[pid].reserve > 1 && B.storeTotal(st.mines[pid]) >= B.storeCap(st, pid) * 0.98) alert = true;
  if (st.factories[pid] && st.factories[pid].nofund) alert = true;
  const shop = st.shops[pid], shelf = shop ? Object.keys(shop.shelf).length : 0;
  if (shop && !shop.boss && !shelf && Object.keys(st.stock).length) alert = true;
  const work = (st.factories[pid] && st.factories[pid].queue.length > 0) || (st.mines[pid] && st.mines[pid].reserve > 1 && !alert) || shelf > 0;
  // 相場の出来事が起きている地名（上げは金、下げは青の印）
  const ev = st.market.events.find((e) => e.p === pid);
  // 知らせ（金の輪）：オークションの結果が出た・納められる注文がある（本社）
  const au = st.auctions[pid];
  const news = !!(au && au.last && !au.last.seen) || (pid === 'tokyo' && st.orders.list.some((o) => B.orderReady(st, o, Date.now())));
  return { ks, lock, own, alert, work, news, main: ks[0], ev: ev ? (ev.mul >= 1 ? 'up' : 'dn') : '' };
}
function renderPins() {
  const box = $('#bzpins', ui.node);
  // 近いピンどうしは少し離す（画面の上での位置で）
  // 地図に出すのは、今のランクの 1 つ先までの地名と、持っている施設のある地名
  const shown = PLACE_IDS.filter((pid) => placeRank(pid) <= ui.st.rank + 1 || facsAt(pid).some((k) => k !== 'hq' && owns(ui.st, k, pid)));
  const pos = shown.map((pid) => ({ pid, x: (projX(PLACES[pid].lon) / MAP_W) * ui.w, y: (projY(PLACES[pid].lat) / MAP_H) * ui.h, dx: 0, dy: 0 }));
  const R = 26;
  for (let it = 0; it < 6; it++) {
    for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
      const a = pos[i], b = pos[j];
      const vx = b.x + b.dx - (a.x + a.dx), vy = b.y + b.dy - (a.y + a.dy);
      const d = Math.hypot(vx, vy);
      if (d >= R) continue;
      const push = (R - d) / 2, ux = d ? vx / d : 1, uy = d ? vy / d : 0;
      a.dx -= ux * push; a.dy -= uy * push; b.dx += ux * push; b.dy += uy * push;
    }
  }
  box.innerHTML = pos.map((p) => {
    const s = pinState(p.pid);
    const cls = ['bzpin', `k-${s.main}`, s.lock ? 'lock' : '', s.own ? 'own' : '', s.alert ? 'alert' : '', s.work ? 'work' : '', s.news ? 'news' : '', s.ev ? `ev-${s.ev}` : ''].join(' ');
    return `<button class="${cls}" data-p="${p.pid}" style="left:${p.x}px;top:${p.y}px;--dx:${p.dx.toFixed(1)}px;--dy:${p.dy.toFixed(1)}px">
      <span class="bp-ic">${icon(s.main)}${s.ks.length > 1 ? `<i class="bp-more">${s.ks.length}</i>` : ''}</span><span class="bp-nm">${PLACES[p.pid].name}</span></button>`;
  }).join('');
  box.querySelectorAll('.bzpin').forEach((b) => (b.onclick = () => { audio.tap(); openSheet(b.dataset.p); tutCheck(); }));
}
function refreshPins() {
  for (const b of $('#bzpins', ui.node).querySelectorAll('.bzpin')) {
    const s = pinState(b.dataset.p);
    b.classList.toggle('lock', s.lock);
    b.classList.toggle('own', s.own);
    b.classList.toggle('alert', s.alert);
    b.classList.toggle('work', s.work);
    b.classList.toggle('news', s.news);
    b.classList.toggle('ev-up', s.ev === 'up');
    b.classList.toggle('ev-dn', s.ev === 'dn');
  }
}

// ---------------------------------------------------------------- 上の帯
function renderTop() {
  const st = ui.st, r = st.rank;
  $('#bzrk', ui.node).textContent = RANKS[r - 1].name;
  const v = B.companyValue(st);
  const prev = RANKS[r - 1].need, next = r < RANKS.length ? RANKS[r].need : 0;
  $('#bzrb', ui.node).style.width = next ? `${Math.max(0, Math.min(100, ((v - prev) / (next - prev)) * 100)).toFixed(1)}%` : '100%';
  $('#bzcash', ui.node).textContent = usd(st.cash);
  const today = todayStr();
  const left = B.divLeft(st, avgRun(), today);
  $('#bzdivv', ui.node).textContent = left ? fmt(B.divPayable(st, avgRun(), today)) : '済';
  $('#bzdiv', ui.node).classList.toggle('ready', B.bizAlerts(st, avgRun(), today).div);
  $('#bzmk', ui.node).hidden = r < 2;
  renderGoal();
}

// ---------------------------------------------------------------- 目標（次にやることを 1 つ。達成したら押して受け取る）
function renderGoal() {
  const st = ui.st, g = B.goalNow(st), e = $('#bzgoal', ui.node);
  if (!g) { e.hidden = true; return; }
  const [a, b] = g.n(st), done = a >= b;
  const prog = b > 1 ? `<span class="bg-p">${g.money ? `${usd(a)} / ${usd(b)}` : `${fmt(a)} / ${fmt(b)}`}</span>` : '';
  const html = `<small>${done ? '達成' : '目標'}</small><b>${g.t}</b>${prog}<em><img src="${coinIcon(36)}" alt="">${fmt(g.coins)}</em>`;
  if (e.dataset.h !== html) { e.dataset.h = html; e.innerHTML = html; }
  e.classList.toggle('done', done);
  e.hidden = false;
}
function onGoal() {
  const st = ui.st, g = B.goalNow(st);
  if (!g) return;
  if (B.goalDone(st, g)) {
    const n = B.claimGoal(st);
    save.coins += n;
    save.totalCoins += n;
    audio.bigWin();
    haptic();
    toast(g.t, `+${fmt(n)} コイン`, 'GOAL');
    afterChange(true);
    return;
  }
  audio.tap();
  if (g.id === 'deal1' && st.deal && !ui.modal) { queueModal({ kind: 'deal' }); return; }
  // 目標のための場所を開く（まだ行けない地名なら何もしない）
  if (g.go && placeRank(g.go[0]) <= st.rank) {
    centerOn(g.go[0]);
    openSheet(g.go[0], g.go[1]);
    if (g.go[2]) { ui.sheet.tab = g.go[2]; renderSheet(); }
  }
}

// ---------------------------------------------------------------- 航路（輸送中の荷）
function routeGeom(s) {
  const a = PLACES[s.from], b = PLACES[s.to];
  const x0 = projX(a.lon), y0 = projY(a.lat), x1 = projX(b.lon), y1 = projY(b.lat);
  const d = Math.hypot(x1 - x0, y1 - y0);
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 - d * 0.25 };
}
function renderRoutes() {
  const svg = $('#bzroutes', ui.node);
  ui.ships = ui.st.ships.map((s) => s.id).join(',');
  svg.innerHTML = ui.st.ships.map((s) => {
    const g = routeGeom(s);
    return `<path d="M${g.x0},${g.y0}Q${g.cx},${g.cy} ${g.x1},${g.y1}" class="bz-route"/><circle r="0.7" class="bz-boat" data-s="${s.id}"/>`;
  }).join('');
}
function animRoutes() {
  if (!ui || !ui.node.isConnected) return;
  const now = Date.now();
  for (const c of $('#bzroutes', ui.node).querySelectorAll('.bz-boat')) {
    const s = ui.st.ships.find((x) => x.id === +c.dataset.s);
    if (!s) continue;
    const g = routeGeom(s), p = Math.max(0, Math.min(1, (now - s.dep) / (s.arrive - s.dep))), q = 1 - p;
    c.setAttribute('cx', (q * q * g.x0 + 2 * q * p * g.cx + p * p * g.x1).toFixed(2));
    c.setAttribute('cy', (q * q * g.y0 + 2 * q * p * g.cy + p * p * g.y1).toFixed(2));
  }
  requestAnimationFrame(animRoutes);
}

// 時間が進んだあと・操作のあと：数字・ピン・航路・シートを描き直す
function afterChange(acted) {
  const st = ui.st;
  const up = B.updateRank(st);
  if (up) {
    toast(RANKS[st.rank - 1].name, '会社のランクが上がりました', 'RANK UP');
    renderPins();
    metaAch();
  } else refreshPins();
  renderTop();
  if (st.ships.map((s) => s.id).join(',') !== ui.ships) renderRoutes();
  if (ui.sheet && (acted || !ui.touching)) renderSheet();
  if (acted) { persist(); refreshCoinPill(); refreshNav(); metaAch(); tutCheck(); }
  checkFinds();
}

// ---------------------------------------------------------------- シート
function openSheet(pid, kind) {
  const ks = pid ? facsAt(pid) : [kind];
  ui.sheet = { pid, kind: kind && ks.includes(kind) ? kind : ks.find((k) => owns(ui.st, k, pid) && k !== 'hq') || ks[0], pick: null, tab: 'co', mtab: 'own' };
  ui.sheetHtml = '';
  const sh = $('#bzsheet', ui.node);
  sh.scrollTop = 0;
  renderSheet();
  sh.classList.add('open');
}
function closeSheet() {
  ui.sheet = null;
  $('#bzsheet', ui.node).classList.remove('open');
}
function renderSheet() {
  const sh = $('#bzsheet', ui.node), S = ui.sheet;
  const P = S.pid ? PLACES[S.pid] : null, ks = S.pid ? facsAt(S.pid) : [];
  const top = sh.scrollTop;
  const body = { hq: hqSheet, mine: mineSheet, factory: factorySheet, exchange: exchangeSheet, shop: shopSheet, market: marketSheet, lab: labSheet, auction: auctionSheet, sight: sightSheet }[S.kind](S.pid);
  const html = `<div class="bs-head">${P ? `<div><b>${P.name}</b><small>${P.country}</small></div>` : '<div><b>相場</b></div>'}<button class="bs-x" data-act="close" aria-label="閉じる">×</button></div>
    ${ks.length > 1 ? `<div class="bs-tabs">${ks.map((k) => `<button class="${k === S.kind ? 'on' : ''}" data-act="kind" data-k="${k}">${icon(k)}${kindName(k)}</button>`).join('')}</div>` : ''}
    <div class="bs-body">${body}</div>`;
  if (html === ui.sheetHtml) return;
  ui.sheetHtml = html;
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  patch(sh, tpl.content);
  sh.scrollTop = top;
}
// 変わったところだけ書き換える（同じ img を作り直すと、読み込み直しで一瞬消えるため）
function patch(dst, src) {
  const a = dst.childNodes, b = src.childNodes;
  let i = 0;
  for (; i < b.length; i++) {
    const n = b[i], o = a[i];
    if (!o) { dst.appendChild(n.cloneNode(true)); continue; }
    if (o.nodeType !== n.nodeType || o.nodeName !== n.nodeName) { dst.replaceChild(n.cloneNode(true), o); continue; }
    if (n.nodeType === 3) { if (o.data !== n.data) o.data = n.data; continue; }
    if (n.nodeType !== 1) continue;
    for (const at of [...o.attributes]) if (!n.hasAttribute(at.name)) o.removeAttribute(at.name);
    for (const at of [...n.attributes]) if (o.getAttribute(at.name) !== at.value) o.setAttribute(at.name, at.value);
    if (n.nodeName === 'BUTTON') o.disabled = n.hasAttribute('disabled');
    patch(o, n);
  }
  while (a.length > b.length) dst.removeChild(a[a.length - 1]);
}
const btn = (act, label, cost, attrs = '', cls = '') => {
  const ok = cost == null || ui.st.cash >= cost;
  return `<button class="btn small ${cls}" data-act="${act}" ${attrs} ${ok ? '' : 'disabled'}>${label}${cost != null ? `<span class="sub">${usd(cost)}</span>` : ''}</button>`;
};
const bar = (p, cls = '') => `<span class="bs-bar ${cls}"><i style="width:${Math.max(0, Math.min(100, p * 100)).toFixed(1)}%"></i></span>`;
const lockLine = (r) => `<div class="bs-lock">🔒 会社のランク ${r}（${RANKS[r - 1].name}）で開放</div>`;
const gemChips = (mix) => {
  const sum = Object.values(mix).reduce((a, b) => a + b, 0);
  return `<div class="bs-gems">${Object.entries(mix).map(([g, w]) => `<span><img src="${gemIcon(g)}" alt="">${GEMS[g].jp}<small>${Math.round((w / sum) * 100)}%</small></span>`).join('')}</div>`;
};
const specChips = (list) => `<div class="bs-gems">${list.map((g) => `<span><img src="${gemIcon(g)}" alt="">${GEMS[g].jp}</span>`).join('')}</div>`;
// 切り替えのボタンの列（on の値が選ばれている）
const seg = (act, id, items, on) => `<div class="bs-seg">${items.map(([v, label]) => `<button class="${v === on ? 'on' : ''}" data-act="${act}" data-id="${id}" data-v="${v}">${label}</button>`).join('')}</div>`;
// 人を雇う行（まだ雇っていないとき）
const BOSS_NAME = { mine: '鉱山長', factory: '工場長', shop: '店長' };
const BOSS_DO = { mine: `倉庫が ${Math.round(BOSS_SHIP * 100)}% たまると自動で出荷`, factory: '磨き上がった石を、決めた取引所でそのまま売る', shop: '空いた段に自動で並べる' };
function bossRow(kind, id, o) {
  if (o.boss) return '';
  const st = ui.st;
  if (st.rank < STAFF.r) return `<div><span>${BOSS_NAME[kind]}<small>会社のランク ${STAFF.r} から</small></span></div>`;
  return `<div><span>${BOSS_NAME[kind]}<small>${BOSS_DO[kind]}</small></span>${btn('boss', '雇う', B.staffCost(kind, id), `data-kind="${kind}" data-id="${id}"`)}</div>`;
}
const pct = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))}%`;

function mineSheet(pid) {
  const st = ui.st, M = MINES[pid], m = st.mines[pid];
  const head = `${gemChips(M.mix)}`;
  if (!m) {
    if (M.r > st.rank) return head + lockLine(M.r);
    return `${head}<div class="bs-rows"><div><span>産出</span><b>${ctf(B.mineBaseOut(pid))} ct/時</b></div><div><span>埋蔵量</span><b>45 日分</b></div></div>
      <div class="bs-acts">${btn('buyMine', '開拓権を買う', B.minePrice(pid), `data-id="${pid}"`, 'primary')}</div>`;
  }
  const out = B.mineOut(st, pid), cap = B.storeCap(st, pid), tot = B.storeTotal(m);
  const days = out > 0 ? m.reserve / out / 24 : 0;
  const full = tot >= cap * 0.98;
  const ship = ui.sheet.pick === 'ship' ? shipPick(pid, m.store) : '';
  const best = B.bestExchange(st, (ex) => B.roughValue(st, m.store, pid, ex));
  const nl = m.lv < MINE_LV.length ? MINE_LV[m.lv] : null;
  const ns = m.sl < STORE_LV.length - 1 ? STORE_LV[m.sl + 1] : null;
  return `${head}
    <div class="bs-rows">
      <div><span>設備</span><b>${MINE_LV[m.lv - 1].name}</b></div>
      <div><span>産出</span><b>${m.stop > Date.now() ? `落盤で停止中（あと ${minf((m.stop - Date.now()) / 60e3)}）` : m.reserve > 1 ? `${ctf(out)} ct/時` : '枯渇'}</b></div>
      <div class="bs-col"><span>倉庫 ${full ? '<em class="bs-warn">満杯</em>' : ''}</span>${bar(tot / cap, full ? 'warn' : '')}<b>${ctf(tot)} / ${ctf(cap)} ct</b></div>
      <div class="bs-col"><span>埋蔵量</span>${bar(m.reserve / B.reserveFull(pid))}<b>${m.reserve > 1 ? `あと ${days < 1 ? minf(days * 1440) : `${days.toFixed(1)} 日`}` : '枯渇'}</b></div>
    </div>
    <div class="bs-acts">
      <button class="btn small primary" data-act="pickShip" ${tot > 0 ? '' : 'disabled'}>工場へ出荷</button>
      <button class="btn small" data-act="sellRough" data-id="${pid}" ${tot > 0 && best.value > 0 ? '' : 'disabled'}>原石のまま売る<span class="sub">${usd(best.value)}${best.id ? `・${exName(best.id)}` : ''}</span></button>
    </div>${ship}
    <div class="bs-h">強化</div>
    <div class="bs-ups">
      ${nl ? `<div><span>設備：${nl.name}<small>産出 ×${nl.out}</small></span>${btn('upMine', '強化', B.mineUpCost(st, pid), `data-id="${pid}"`)}</div>` : '<div><span>設備：最大</span></div>'}
      ${ns ? `<div><span>倉庫：${ns.h} 時間分<small>今 ${STORE_LV[m.sl].h} 時間分</small></span>${btn('upStore', '広げる', B.storeUpCost(st, pid), `data-id="${pid}"`)}</div>` : '<div><span>倉庫：最大</span></div>'}
      ${m.reserve < B.reserveFull(pid) * 0.6 ? `<div><span>探鉱<small>埋蔵量 +30 日分（手掘りの産出で）</small></span>${btn('explore', '探す', B.exploreCost(st, pid), `data-id="${pid}"`)}</div>` : ''}
      ${bossRow('mine', pid, m)}
    </div>${m.boss ? mineBoss(pid, m) : ''}`;
}
// 鉱山長の出荷先
function mineBoss(pid, m) {
  const st = ui.st, fs = Object.keys(st.factories).filter((fid) => Object.keys(MINES[pid].mix).some((g) => B.canCut(fid, g)));
  return `<div class="bs-h">鉱山長の出荷先</div>
    ${fs.length ? `<div class="bs-pick">${fs.map((fid) => `<button class="bs-prow ${m.to === fid ? 'on' : ''}" data-act="mineTo" data-id="${pid}" data-f="${fid}"><span>${icon('factory')}${PLACES[fid].name}</span><small>${minf(B.shipMin(pid, fid))}</small></button>`).join('')}</div>` : '<div class="bs-note">この鉱区の石を磨ける工場がありません</div>'}`;
}
const exName = (id) => (EXCHANGES[id].name ? `${PLACES[id].name}・${EXCHANGES[id].name}` : PLACES[id].name);
// 出荷先の工場を選ぶ列（置き場 store の原石を磨ける工場だけ押せる）
function shipPick(pid, store) {
  const st = ui.st, fs = Object.keys(st.factories), tot = Object.values(store).reduce((a, b) => a + b, 0);
  return `<div class="bs-pick">${fs.length ? fs.map((fid) => {
    const can = Object.keys(store).some((k) => B.canCut(fid, k.split('|')[0]));
    return `<button class="bs-prow" data-act="ship" data-id="${pid}" data-f="${fid}" ${can && tot > 0 ? '' : 'disabled'}><span>${icon('factory')}${PLACES[fid].name}</span><small>${can ? `${minf(B.shipMin(pid, fid))}` : '磨けない石'}</small></button>`;
  }).join('') : '<div class="bs-note">工場がありません</div>'}</div>`;
}
// 在庫の石の小さな説明（産地・処理・鑑定書）
const lotNote = (p) => `${PLACES[p.origin] ? PLACES[p.origin].name : ''}${p.treat ? '・処理' : ''}${p.cert ? '・鑑定書' : ''}`;
const nf = (n) => (n < 10 ? n.toFixed(1) : fmt(n));

function factorySheet(pid) {
  const st = ui.st, F = FACTORIES[pid], f = st.factories[pid];
  const head = `<div class="bs-sub">得意な石</div>${specChips(F.spec)}${F.only ? '<div class="bs-note">ダイヤモンドだけを磨く工場</div>' : ''}${F.heat ? '<div class="bs-note">加熱処理が得意</div>' : ''}`;
  const rows = (skill) => `<div><span>腕前</span><b>${Math.round(skill * 100)}</b></div><div><span>手間賃</span><b>石の値打ちの ${Math.round(F.fee * 100)}%</b></div>`;
  if (!f) {
    if (F.r > st.rank) return head + lockLine(F.r);
    return `${head}<div class="bs-rows">${rows(F.skill)}</div><div class="bs-acts">${btn('buyFact', '工場を買う', B.factPrice(pid), `data-id="${pid}"`, 'primary')}</div>`;
  }
  const work = B.queueWork(f), cap = B.factCap(st, pid);
  const inbound = st.ships.filter((s) => s.to === pid);
  const q = {};
  for (const e of f.queue) { const g = e.k.split('|')[0]; q[g] = (q[g] || 0) + e.ct; }
  const nl = f.lv < FACT_LV.length ? FACT_LV[f.lv] : null;
  const nc = f.crew < CREW.length - 1 ? CREW[f.crew + 1] : null;
  return `${head}
    <div class="bs-rows">
      ${rows(B.factSkill(st, pid))}
      <div><span>待っている原石</span><b>${work > 0 ? `${ctf(f.queue.reduce((s, e) => s + e.ct, 0))} ct・あと ${minf((work / cap) * 60)}` : 'なし'}</b></div>
      ${inbound.length ? `<div><span>輸送中</span><b>${inbound.length} 件・${ctf(inbound.reduce((s, x) => s + x.ct, 0))} ct</b></div>` : ''}
    </div>
    ${f.nofund ? '<div class="bs-note warn">資金が足りず、研磨が止まっています</div>' : ''}
    ${Object.keys(q).length ? `<div class="bs-gems">${Object.entries(q).map(([g, ct]) => `<span><img src="${gemIcon(g)}" alt="">${GEMS[g].jp}<small>${ctf(ct)} ct</small></span>`).join('')}</div>` : ''}
    ${st.rank >= 2 ? cutPanel(pid, f) : ''}
    <div class="bs-h">強化</div>
    <div class="bs-ups">
      ${nl ? `<div><span>処理の速さ Lv ${f.lv + 1}<small>×${nl.cap}</small></span>${btn('upFact', '強化', B.factUpCost(st, pid), `data-id="${pid}"`)}</div>` : '<div><span>処理の速さ：最大</span></div>'}
      ${nc ? `<div><span>職人 ${f.crew + 1} 人目<small>腕前 +${Math.round((nc.skill - CREW[f.crew].skill) * 100)}</small></span>${btn('crew', '雇う', B.crewCost(st, pid), `data-id="${pid}"`)}</div>` : '<div><span>職人：最大</span></div>'}
      ${bossRow('factory', pid, f)}
    </div>${f.boss ? factBoss(pid, f) : ''}`;
}
// 磨き方と処理。歩留まりと品質の上振れは、得意でも処理できる石でもない石での値
function cutPanel(pid, f) {
  const plain = BIZ_GEM_IDS.find((g) => B.canCut(pid, g) && !FACTORIES[pid].spec.includes(g) && !BIZ_GEMS[g].treat) || FACTORIES[pid].spec[0];
  const c = B.cutParams(ui.st, pid, plain);
  return `<div class="bs-h">磨き方</div>
    ${seg('policy', pid, [['yield', '歩留まり重視'], ['normal', 'ふつう'], ['shine', '輝き重視']], f.policy || 'normal')}
    <div class="bs-rows"><div><span>歩留まり</span><b>×${c.yieldMul.toFixed(2)}</b></div><div><span>品質が 1 段上がる</span><b>${Math.round(c.up * 100)}%</b></div></div>
    ${FACTORIES[pid].only ? '' : `<div class="bs-sub">処理（加熱・含浸）</div>${seg('treat', pid, [['0', 'しない'], ['1', 'する']], f.treat ? '1' : '0')}`}`;
}
// 工場長の売り先
function factBoss(pid, f) {
  const st = ui.st, exs = Object.keys(EXCHANGES).filter((id) => EXCHANGES[id].r <= st.rank && !EXCHANGES[id].show);
  return `<div class="bs-h">工場長の売り先</div>
    <div class="bs-pick"><button class="bs-prow ${f.out === 'stock' ? 'on' : ''}" data-act="factOut" data-id="${pid}" data-v="stock"><span>${icon('hq')}在庫にためる</span></button>
    ${exs.map((ex) => `<button class="bs-prow ${f.out === ex ? 'on' : ''}" data-act="factOut" data-id="${pid}" data-v="${ex}"><span>${icon('exchange')}${exName(ex)}</span><small>相場の ${Math.round(EXCHANGES[ex].mul * 100)}%</small></button>`).join('')}
    ${Object.keys(LABS).filter((id) => B.labOpen(st, id)).map((id) => `<button class="bs-prow ${f.out === 'lab:' + id ? 'on' : ''}" data-act="factOut" data-id="${pid}" data-v="lab:${id}"><span>${icon('lab')}${PLACES[id].name}で鑑定</span><small>品質 A 以上</small></button>`).join('')}</div>`;
}

// 在庫を宝石ごとにまとめた行。押すと品質・産地ごとの内訳を開く
function stockRows(exId) {
  const st = ui.st;
  const keys = Object.keys(st.stock).filter((k) => st.stock[k].n >= 0.005);
  if (!keys.length) return { html: '<div class="bs-note">在庫はありません</div>', total: 0 };
  const by = {};
  for (const k of keys) {
    const p = B.parseKey(k), v = B.sellPrice(st, k, exId), g = by[p.gem] || (by[p.gem] = { gem: p.gem, n: 0, v: 0, lots: [] });
    g.n += st.stock[k].n; g.v += v;
    g.lots.push({ k, p, s: st.stock[k], v });
  }
  const groups = Object.values(by).sort((a, b) => b.v - a.v);
  const lot = (r) => `<div class="bs-srow bs-lot">${gradeBadge(r.p.g)}<span class="bs-sn"><small>${lotNote(r.p)}</small></span><span class="bs-sc">${nf(r.s.n)} 個</span><button class="btn small" data-act="sell" data-k="${r.k}" data-ex="${exId}">${usd(r.v)}</button></div>`;
  return {
    total: groups.reduce((s, g) => s + g.v, 0),
    html: `<div class="bs-stock">${groups.map((g) => `<div class="bs-srow"><button class="bs-gt" data-act="open" data-g="${g.gem}"><img src="${gemIcon(g.gem)}" alt=""><span class="bs-sn">${GEMS[g.gem].jp}<small>内訳 ${g.lots.length} ${ui.sheet.open === g.gem ? '▲' : '▼'}</small></span></button><span class="bs-sc">${nf(g.n)} 個</span><button class="btn small" data-act="sellGem" data-g="${g.gem}" data-ex="${exId}">${usd(g.v)}</button></div>${ui.sheet.open === g.gem ? g.lots.sort((a, b) => b.v - a.v).map(lot).join('') : ''}`).join('')}</div>`,
  };
}
function exchangeSheet(pid) {
  const st = ui.st, E = EXCHANGES[pid];
  if (E.r > st.rank) return lockLine(E.r);
  if (E.show && !B.exOpen(st, pid)) return `<div class="bs-note">毎年の宝石ショーの時期（1 月末〜2 月中旬）だけ開きます</div><div class="bs-rows"><div><span>買い取り</span><b>相場の ${Math.round(E.mul * 100)}%</b></div></div>`;
  const r = stockRows(pid);
  return `${E.spec ? `<div class="bs-sub">高く買う石</div>${specChips(E.spec)}` : ''}
    <div class="bs-rows"><div><span>買い取り</span><b>相場の ${Math.round(E.mul * 100)}%${E.spec ? '（得意な石は +8%）' : ''}</b></div></div>
    <div class="bs-acts">${btn('sellAll', 'すべて売る', null, `data-ex="${pid}" ${r.total > 0 ? '' : 'disabled'}`, 'primary')}<span class="bs-total">${usd(r.total)}</span></div>
    ${r.html}`;
}

function shopSheet(pid) {
  const st = ui.st, S0 = SHOPS[pid], sh = st.shops[pid];
  const head = `<div class="bs-sub">好まれる石</div>${specChips(S0.likes)}${S0.min ? `<div class="bs-note">品質 ${['C', 'B', 'A', 'S', 'SS'][S0.min]} 以上の石だけ</div>` : ''}${S0.big ? '<div class="bs-note">大きい石が好まれる</div>' : ''}`;
  const rate = `<div><span>売値</span><b>相場の ${Math.round(S0.mul * 100)}%（好まれる石は +10%）</b></div>`;
  if (!sh) {
    if (S0.r > st.rank) return head + lockLine(S0.r);
    return `${head}<div class="bs-rows">${rate}<div><span>1 時間に売れる量</span><b>${usd(B.shopCapAt(pid, 1))} まで</b></div></div>
      <div class="bs-acts">${btn('buyShop', '出店する', B.shopPrice(pid), `data-id="${pid}"`, 'primary')}</div>`;
  }
  const cap = B.slotCap(st, pid), slots = B.shopSlots(st, pid);
  const keys = Object.keys(sh.shelf);
  const rows = keys.map((k) => {
    const p = B.parseKey(k), e = sh.shelf[k], v = B.lotValue(st, k, e);
    return `<div class="bs-slot"><img src="${gemIcon(p.gem)}" alt=""><span class="bs-sn">${GEMS[p.gem].jp}<small>${e.n < 10 ? e.n.toFixed(1) : fmt(e.n)} 個・${usd(v * B.shopMul(pid, p.gem))}</small>${bar(v / cap)}</span>${gradeBadge(p.g)}<button class="btn small" data-act="unshelve" data-id="${pid}" data-k="${k}">下げる</button></div>`;
  }).join('');
  const empty = slots - keys.length;
  let pick = '';
  if (ui.sheet.pick === 'shelf') {
    const cand = Object.keys(st.stock).filter((k) => B.shopOk(pid, k) && st.stock[k].n >= 0.005)
      .map((k) => ({ k, p: B.parseKey(k), s: st.stock[k], v: B.lotValue(st, k, st.stock[k]) })).sort((a, b) => (B.shopLikes(pid, b.p.gem) - B.shopLikes(pid, a.p.gem)) || b.v - a.v);
    pick = `<div class="bs-stock">${cand.length ? cand.map((r) => `<div class="bs-srow"><img src="${gemIcon(r.p.gem)}" alt=""><span class="bs-sn">${GEMS[r.p.gem].jp}${B.shopLikes(pid, r.p.gem) ? '<em class="bs-like">♥</em>' : ''}<small>${lotNote(r.p)}</small></span>${gradeBadge(r.p.g)}<span class="bs-sc">${nf(r.s.n)} 個</span><button class="btn small" data-act="shelve" data-id="${pid}" data-k="${r.k}" ${empty > 0 || sh.shelf[r.k] ? '' : 'disabled'}>並べる</button></div>`).join('') : '<div class="bs-note">並べられる石の在庫はありません</div>'}</div>`;
  }
  const nl = sh.lv < SHOP_LV.length ? SHOP_LV[sh.lv] : null;
  return `${head}
    <div class="bs-rows">${rate}
      <div><span>1 時間に売れる量</span><b>${usd(B.shopCap(st, pid))} まで</b></div>
      <div><span>累計の売上</span><b>${usd(sh.sales)}</b></div>
    </div>
    <div class="bs-h">棚 ${keys.length} / ${slots} 段</div>
    <div class="bs-slots">${rows}${empty > 0 ? `<div class="bs-slot empty"><span>空き ${empty} 段</span></div>` : ''}</div>
    <div class="bs-acts"><button class="btn small ${ui.sheet.pick === 'shelf' ? '' : 'primary'}" data-act="pickShelf">${ui.sheet.pick === 'shelf' ? '閉じる' : '在庫から並べる'}</button></div>${pick}
    <div class="bs-h">強化</div>
    <div class="bs-ups">
      ${nl ? `<div><span>店を広げる<small>棚 ${nl.slots} 段・売れる量 ×${nl.rate}</small></span>${btn('upShop', '強化', B.shopUpCost(st, pid), `data-id="${pid}"`)}</div>` : '<div><span>店：最大</span></div>'}
      ${bossRow('shop', pid, sh)}
    </div>`;
}

// 相場の出来事の文
const EV_TEXT = {
  rain: (e) => `${PLACES[e.p].name}で大雨`,
  strike: (e) => `${PLACES[e.p].name}でストライキ`,
  vein: (e) => `${PLACES[e.p].name}で大きな鉱脈`,
  buzz: (e) => `${PLACES[e.p].name}で${GEMS[e.g].jp}が話題`,
  bridal: () => 'ブライダルの季節',
  synth: (e) => `合成${GEMS[e.g].jp}の流通`,
};
function marketSheet() {
  const st = ui.st, M = st.market, S = ui.sheet, now = Date.now();
  const evs = M.events.filter((e) => e.until > now);
  const own = new Set(Object.keys(st.mines).flatMap((id) => Object.keys(MINES[id].mix)));
  for (const k in st.stock) own.add(k.split('|')[0]);
  const list = (S.mtab === 'own' ? BIZ_GEM_IDS.filter((g) => own.has(g)) : BIZ_GEM_IDS).map((g) => ({ g, v: B.idxOf(st, g) })).sort((a, b) => b.v - a.v);
  const rows = list.map(({ g, v }) => {
    const prev = M.prev[g] || v, tags = [];
    if (M.trend[g]) tags.push(`<em class="${M.trend[g] > 1 ? 'up' : 'dn'}">流行 ${pct(M.trend[g] - 1)}</em>`);
    for (const e of evs) if (e.g === g) tags.push(`<em class="${e.mul > 1 ? 'up' : 'dn'}">出来事 ${pct(e.mul - 1)}</em>`);
    if ((M.press[g] || 0) >= 0.01) tags.push(`<em class="dn">売りすぎ ${pct(-M.press[g])}</em>`);
    const arrow = v > prev * 1.005 ? '<i class="up">▲</i>' : v < prev * 0.995 ? '<i class="dn">▼</i>' : '<i></i>';
    return `<div class="bs-mrow"><img src="${gemIcon(g)}" alt=""><span class="bs-sn">${GEMS[g].jp}<small>${tags.join('')}</small></span><b class="${v >= 1 ? 'up' : 'dn'}">${pct(v - 1)}</b>${arrow}</div>`;
  }).join('');
  return `${evs.length ? `<div class="bs-sub">出来事</div><div class="bs-evs">${evs.map((e) => `<div><span>${EV_TEXT[e.k](e)}</span><b class="${e.mul > 1 ? 'up' : 'dn'}">${GEMS[e.g].jp} ${pct(e.mul - 1)}</b><small>あと ${minf((e.until - now) / 60e3)}</small></div>`).join('')}</div>` : ''}
    <div class="bs-tabs sm"><button class="${S.mtab === 'own' ? 'on' : ''}" data-act="mtab" data-t="own">自社の石</button><button class="${S.mtab === 'all' ? 'on' : ''}" data-act="mtab" data-t="all">すべて</button></div>
    ${rows ? `<div class="bs-market">${rows}</div>` : '<div class="bs-note">鉱区を持つと、その石の相場が出ます</div>'}`;
}

// 鑑定所：品質 A 以上の石に鑑定書を付ける
function labSheet(pid) {
  const st = ui.st, L = LABS[pid], now = Date.now();
  if (L.r > st.rank) return lockLine(L.r);
  const jobs = st.labs.filter((j) => j.lab === pid);
  const cand = Object.keys(st.stock).filter((k) => B.labOk(k) && st.stock[k].n >= 0.005)
    .map((k) => ({ k, p: B.parseKey(k), s: st.stock[k], fee: B.labFee(st, pid, k, st.stock[k]) })).sort((a, b) => b.fee - a.fee);
  const bonus = (p) => { const b = MINES[p.origin] && MINES[p.origin].bonus && MINES[p.origin].bonus[p.gem]; return b ? `<em class="bs-tag">産地 ×${b}</em>` : ''; };
  return `<div class="bs-rows">
      <div><span>費用</span><b>石の値打ちの ${Math.round(L.fee * 100)}%</b></div>
      <div><span>かかる時間</span><b>${L.min} 分</b></div>
      <div><span>鑑定書で値打ち</span><b>×1.15</b></div>
    </div>
    <div class="bs-note">有名な産地の石（産地 ×）は、さらに上がります</div>
    ${jobs.length ? `<div class="bs-h">鑑定中</div><div class="bs-stock">${jobs.map((j) => { const p = B.parseKey(j.k); return `<div class="bs-srow"><img src="${gemIcon(p.gem)}" alt=""><span class="bs-sn">${GEMS[p.gem].jp}<small>${lotNote(p)}</small></span>${gradeBadge(p.g)}<span class="bs-sc">${nf(j.n)} 個</span><span class="bs-sc">あと ${minf((j.done - now) / 60e3)}</span></div>`; }).join('')}</div>` : ''}
    <div class="bs-h">在庫から出す（品質 A 以上）</div>
    ${cand.length ? `<div class="bs-stock">${cand.map((r) => `<div class="bs-srow"><img src="${gemIcon(r.p.gem)}" alt=""><span class="bs-sn">${GEMS[r.p.gem].jp}${bonus(r.p)}<small>${lotNote(r.p)}</small></span>${gradeBadge(r.p.g)}<span class="bs-sc">${nf(r.s.n)} 個</span>${btn('lab', '出す', r.fee, `data-id="${pid}" data-k="${r.k}"`)}</div>`).join('')}</div>` : '<div class="bs-note">鑑定できる石の在庫はありません</div>'}`;
}

// オークション：開催ごとに品質 S 以上の石を出品。落札値は相場の 1.3〜3 倍
function auctionSheet(pid) {
  const st = ui.st, A = AUCTIONS[pid], now = Date.now();
  if (A.r > st.rank) return lockLine(A.r);
  const a = st.auctions[pid];
  const every = A.every * 3600e3, next = a ? a.next : Math.ceil(now / every) * every;
  const cap = B.aucCap(st, pid), used = B.aucUsed(st, pid);
  const lots = a ? a.lots : [];
  let pick = '';
  if (ui.sheet.pick === 'consign') {
    const cand = Object.keys(st.stock).filter((k) => B.parseKey(k).g >= A.min && st.stock[k].n >= 0.005)
      .map((k) => ({ k, p: B.parseKey(k), s: st.stock[k], v: B.lotValue(st, k, st.stock[k]) })).sort((x, y) => y.v - x.v);
    pick = `<div class="bs-stock">${cand.length ? cand.map((r) => `<div class="bs-srow"><img src="${gemIcon(r.p.gem)}" alt=""><span class="bs-sn">${GEMS[r.p.gem].jp}<small>${lotNote(r.p)}・相場 ${usd(r.v)}</small></span>${gradeBadge(r.p.g)}<span class="bs-sc">${nf(r.s.n)} 個</span><button class="btn small" data-act="consign" data-id="${pid}" data-k="${r.k}" ${used < cap ? '' : 'disabled'}>出品</button></div>`).join('') : '<div class="bs-note">出品できる石（品質 S 以上）の在庫はありません</div>'}</div>`;
  }
  let last = '';
  if (a && a.last) {
    a.last.seen = true;
    last = `<div class="bs-h">前回の結果</div><div class="bs-stock">${a.last.res.map((r) => { const p = B.parseKey(r.k); return `<div class="bs-srow"><img src="${gemIcon(p.gem)}" alt=""><span class="bs-sn">${GEMS[p.gem].jp}<small>${lotNote(p)}・${nf(r.n)} 個</small></span>${gradeBadge(p.g)}<span class="bs-sc ${r.m >= 2 ? 'up' : ''}">相場の ×${r.m.toFixed(2)}</span><b class="bs-sv">${usd(r.v)}</b></div>`; }).join('')}</div>`;
  }
  return `<div class="bs-rows">
      <div><span>次の開催</span><b>あと ${minf((next - now) / 60e3)}（${A.every} 時間ごと）</b></div>
      <div><span>出品できる石</span><b>品質 S 以上</b></div>
      <div class="bs-col"><span>出品の上限（相場で）</span>${bar(used / cap)}<b>${usd(used)} / ${usd(cap)}</b></div>
      <div><span>落札値</span><b>相場の ×1.3〜3${A.top ? '（高値が付きやすい）' : ''}</b></div>
    </div>
    ${lots.length ? `<div class="bs-h">出品中</div><div class="bs-stock">${lots.map((l) => { const p = B.parseKey(l.k); return `<div class="bs-srow"><img src="${gemIcon(p.gem)}" alt=""><span class="bs-sn">${GEMS[p.gem].jp}<small>${lotNote(p)}</small></span>${gradeBadge(p.g)}<span class="bs-sc">${nf(l.n)} 個</span><button class="btn small" data-act="withdraw" data-id="${pid}" data-k="${l.k}">下げる</button></div>`; }).join('')}</div>` : ''}
    <div class="bs-acts"><button class="btn small ${ui.sheet.pick === 'consign' ? '' : 'primary'}" data-act="pickConsign">${ui.sheet.pick === 'consign' ? '閉じる' : '在庫から出品する'}</button></div>${pick}
    ${last}`;
}

// サイト：ダイヤの原石の箱を買う
function sightSheet(pid) {
  const st = ui.st, S = SIGHTS[pid], now = Date.now();
  if (S.r > st.rank) return lockLine(S.r);
  const price = B.sightPrice(st, pid), ready = B.sightReady(st, pid, now);
  const store = st.sight.store, tot = Object.values(store).reduce((a, b) => a + b, 0);
  const best = B.bestExchange(st, (ex) => B.roughValue(st, store, pid, ex));
  const grades = [4, 3, 2, 1, 0].filter((q) => (store[`diamond|${q}`] || 0) > 0.005);
  return `<div class="bs-gems"><span><img src="${gemIcon('diamond')}" alt="">ダイヤモンドの原石</span></div>
    <div class="bs-rows">
      <div><span>1 箱の値段</span><b>${usd(price)}</b></div>
      <div><span>買える間隔</span><b>${S.every} 時間ごとに 1 箱</b></div>
      <div><span>中身</span><b>開けるまでわからない</b></div>
    </div>
    <div class="bs-acts">${ready ? btn('buySight', '箱を買う', price, `data-id="${pid}"`, 'primary') : `<button class="btn small" disabled>次の箱まで あと ${minf((st.sight.next - now) / 60e3)}</button>`}</div>
    ${tot > 0.005 ? `<div class="bs-h">買った原石 ${ctf(tot)} ct</div>
      <div class="bs-gems">${grades.map((q) => `<span>${gradeBadge(q)}<small>${ctf(store[`diamond|${q}`])} ct</small></span>`).join('')}</div>
      <div class="bs-acts">
        <button class="btn small primary" data-act="pickShip">工場へ出荷</button>
        <button class="btn small" data-act="sellRough" data-id="${pid}" ${best.value > 0 ? '' : 'disabled'}>原石のまま売る<span class="sub">${usd(best.value)}${best.id ? `・${exName(best.id)}` : ''}</span></button>
      </div>${ui.sheet.pick === 'ship' ? shipPick(pid, store) : ''}` : ''}`;
}

// 本社の注文の欄
function ordersPanel() {
  const st = ui.st, now = Date.now();
  const list = st.orders.list.filter((o) => o.until > now);
  const rows = list.map((o) => {
    const have = B.orderHave(st, o), ok = have >= o.n - 1e-6;
    return `<div class="bs-order">
      <div class="bo-h"><b>${PLACES[o.p].name}の${CLIENT_KINDS[o.who]}</b><small>あと ${minf((o.until - now) / 60e3)}</small></div>
      <div class="bo-b"><img src="${gemIcon(o.gem)}" alt=""><span>${GEMS[o.gem].jp}</span>${gradeBadge(o.g)}<span>以上 × ${fmt(o.n)} 個</span><small class="${ok ? 'up' : ''}">在庫 ${nf(have)}</small></div>
      <div class="bo-f"><b class="bs-sv">${usd(o.reward)}</b><button class="btn small ${ok ? 'primary' : ''}" data-act="deliver" data-o="${o.id}" ${ok ? '' : 'disabled'}>納める</button></div>
    </div>`;
  }).join('');
  return `${rows || '<div class="bs-note">注文はありません。鉱区の石の注文が届きます</div>'}
    ${list.length < ORDERS.max ? `<div class="bs-note">次の注文まで あと ${minf((st.orders.next - now) / 60e3)}</div>` : ''}`;
}

// ---------------------------------------------------------------- 知らせの板（留守中のまとめ・名石の発見・宝物庫の名石）
// 地図とシートの上に重ねる。順番待ちは ui.modals、いま出しているのは ui.modal
function queueModal(m) { ui.modals.push(m); if (!ui.modal) nextModal(); }
function nextModal() {
  const box = $('#bzmodal', ui.node);
  ui.modal = ui.modals.shift() || null;
  if (!ui.modal) { box.hidden = true; box.innerHTML = ''; return; }
  renderModal();
  box.hidden = false;
}
// 名石の値と見た目（見つけたばかりの石・宝物庫の石）
function findCard(f, label, acts) {
  const st = ui.st, P = PLACES[f.mine];
  if (f.raw) {
    return `<div class="bm-card bm-find">
      <div class="bm-label">名石の原石</div>
      <div class="bm-gem"><img class="bm-rough" src="${roughIcon('mystic', gemColor(f.gem), 120)}" alt=""></div>
      <b class="bm-name">${f.name}</b>
      <small class="bm-sub">${P.name}（${P.country}）で見つかった${GEMS[f.gem].jp}の原石・${f.raw.toFixed(2)} ct</small>
      ${acts}
    </div>`;
  }
  const v = B.findValue(st, f);
  return `<div class="bm-card bm-find">
    <div class="bm-label">${label}</div>
    <div class="bm-gem"><img src="${gemIcon(f.gem)}" alt=""></div>
    <b class="bm-name">${f.name}</b>
    <small class="bm-sub">${P.name}（${P.country}）の${GEMS[f.gem].jp}${f.score != null ? `・研磨の精度 ${Math.round(f.score * 100)}%` : ''}</small>
    <div class="bm-stats">${gradeBadge(f.g)}<span>${f.ct.toFixed(2)} ct</span><span>相場 ${usd(v)}</span></div>
    ${f.lent > Date.now() ? `<div class="bs-note">展示中（あと ${minf((f.lent - Date.now()) / 60e3)}）</div>` : ''}
    ${acts}
  </div>`;
}
function renderModal() {
  const st = ui.st, M = ui.modal, box = $('#bzmodal', ui.node);
  let html = '';
  if (M.kind === 'away') {
    const a = M.a, rows = [];
    if (a.mined > 0.01) rows.push(['掘った原石', `${ctf(a.mined)} ct`]);
    if (a.cut > 0.01) rows.push(['磨いた宝石', `${nf(a.cut)} 個`]);
    if (a.earned > 0.5) rows.push(['売上', usd(a.earned)]);
    if (a.finds > 0) rows.push(['見つかった名石', `${a.finds} 個`]);
    if (a.auction > 0) rows.push(['オークションの落札', `${a.auction} 件`]);
    if (a.orders > 0) rows.push(['届いた注文', `${a.orders} 件`]);
    if (a.rank > 0) rows.push(['会社のランク', RANKS[st.rank - 1].name]);
    html = `<div class="bm-card bm-away">
      <div class="bm-label">留守の間に</div>
      <b class="bm-time">${minf(a.gone / 60e3)}</b>
      ${a.capped ? `<small class="bm-sub">進んだのは放置の上限の ${RANKS[M.rank - 1].off} 時間ぶん（会社のランクで伸びます）</small>` : ''}
      <div class="bs-rows">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
      ${a.events.length ? `<div class="bs-sub">出来事</div><div class="bs-evs">${a.events.map((e) => `<div><span>${EV_TEXT[e.k](e)}</span><b class="${e.mul > 1 ? 'up' : 'dn'}">${GEMS[e.g].jp} ${pct(e.mul - 1)}</b></div>`).join('')}</div>` : ''}
      <button class="btn primary" data-m="next">OK</button>
    </div>`;
  } else if (M.kind === 'find' || M.kind === 'vault') {
    const f = (M.kind === 'find' ? st.finds : st.vault).find((x) => x.id === M.id);
    if (!f && !M.res) { nextModal(); return; }
    const ff = f || M.res.f;
    const acts = ff.raw
      ? `<div class="bm-acts"><button class="btn primary" data-m="polish">磨く<span class="sub">研磨の精度で品質と大きさが決まる</span></button></div><button class="bm-later" data-m="later">あとで決める</button>`
      : M.res
      ? `<div class="bm-res">相場の ×${M.res.m.toFixed(2)} で落札<b>${usd(M.res.v)}</b></div><button class="btn primary" data-m="next">OK</button>`
      : M.kind === 'find'
        ? `<div class="bm-acts">
            <button class="btn primary" data-m="keep" ${B.vaultFull(st) ? 'disabled' : ''}>宝物庫に飾る<span class="sub">${B.vaultFull(st) ? '宝物庫がいっぱい' : `配当の上限 +${Math.round(FIND.vaultBonus * 100)}%`}</span></button>
            <button class="btn" data-m="sell">オークションに出す<span class="sub">相場の ×${FIND.sell[0]}〜${FIND.sell[1]}</span></button>
          </div><button class="bm-later" data-m="later">あとで決める</button>`
        : `<div class="bm-acts"><button class="btn" data-m="sell" ${ff.lent > Date.now() ? 'disabled' : ''}>オークションに出す<span class="sub">相場の ×${FIND.sell[0]}〜${FIND.sell[1]}</span></button><button class="btn" data-m="next">閉じる</button></div>`;
    html = findCard(ff, M.kind === 'find' ? '名石' : '宝物庫', acts);
  } else if (M.kind === 'deal') {
    const d = M.res ? M.res.d : st.deal;
    if (!d) { nextModal(); return; }
    if (!M.res) d.seen = true;
    const u = DEAL_UI[d.k](d);
    const body = M.res
      ? `<div class="bm-res"><b class="bm-rt">${dealResult(d, M.res.r)}</b></div><button class="btn primary" data-m="next">OK</button>`
      : `<div class="bm-acts">
          <button class="btn primary" data-m="yes" ${u.yes[2] != null && st.cash < u.yes[2] ? 'disabled' : ''} ${u.yesOk === false ? 'disabled' : ''}>${u.yes[0]}<span class="sub">${u.yes[2] != null && st.cash < u.yes[2] ? '資金が足りません' : u.yes[1]}</span></button>
          <button class="btn" data-m="no">${u.no[0]}${u.no[1] ? `<span class="sub">${u.no[1]}</span>` : ''}</button>
        </div><button class="bm-later" data-m="dlater">あとで決める（あと ${minf((d.until - Date.now()) / 60e3)}）</button>`;
    html = `<div class="bm-card bm-deal"><div class="bm-label">案件</div><b class="bm-time">${u.t}</b><p class="bm-body">${u.b}</p>${body}</div>`;
  }
  box.innerHTML = `<div class="bm-back"></div>${html}`;
  const img = $('.bm-gem img:not(.bm-rough)', box);
  if (img) mountLiveGem(img, (M.res ? M.res.f : (M.kind === 'find' ? st.finds : st.vault).find((x) => x.id === M.id)).gem);
}
function onModalClick(e) {
  const b = e.target.closest('[data-m]');
  if (!b || b.disabled || !ui.modal) return;
  const st = ui.st, M = ui.modal;
  switch (b.dataset.m) {
    case 'next': audio.tap(); nextModal(); break;
    case 'later': audio.tap(); ui.findLater = true; nextModal(); break;
    case 'dlater': audio.tap(); ui.dealLater = true; nextModal(); break;
    case 'polish': {
      // 研磨のミニゲームで磨く（終わったら経営の画面に戻り、仕上がった名石を見せる）
      const f = st.finds.find((x) => x.id === M.id);
      if (!f) break;
      audio.select();
      polishMini({
        tier: 'mystic', gemId: f.gem, en: 'MASTERPIECE', jp: f.name,
        quit: () => showBiz(),
        done: (score, grade) => {
          B.polishFind(save.biz, f.id, score, grade);
          persist();
          if (grade >= 4) { audio.bigWin(); haptic(); } else if (grade >= 3) audio.levelUp(); else audio.chestOpen();
          showBiz();
        },
      });
      break;
    }
    case 'yes': case 'no': {
      const d = st.deal, r = d && B.resolveDeal(st, b.dataset.m === 'yes', Date.now());
      if (!r) { audio.tap(); break; }
      M.res = { d, r };
      if (r.yes && (r.v || r.hit || d.k === 'loan')) audio.coin(); else audio.select();
      renderModal();
      afterChange(true);
      break;
    }
    case 'keep':
      if (B.keepFind(st, M.id)) { audio.levelUp(); haptic(); nextModal(); afterChange(true); }
      break;
    case 'sell': {
      const r = B.sellFind(st, M.id);
      if (r) { M.res = r; audio.bigWin(); haptic(); renderModal(); afterChange(true); }
      break;
    }
    default:
  }
}
// 見つかった名石と届いた案件を、順に知らせる（チュートリアルの間と「あとで」を選んだあとは出さない）
function checkFinds() {
  const st = ui.st;
  $('#bzfind', ui.node).hidden = !st.finds.length;
  $('#bzfindn', ui.node).textContent = st.finds.length;
  $('#bzdeal', ui.node).hidden = !st.deal;
  if (ui.modal || (st.tut != null && st.tut >= 0)) return;
  if (st.finds.length && !ui.findLater) queueModal({ kind: 'find', id: st.finds[0].id });
  else if (st.deal && !st.deal.seen && !ui.dealLater) queueModal({ kind: 'deal' });
}

// 案件の文（題・本文・答えのボタン）と、答えたあとの結果
const vaultName = (id) => { const f = ui.st.vault.find((x) => x.id === id); return f ? f.name : ''; };
const DEAL_UI = {
  bulk: (d) => { const v = B.dealBulkValue(ui.st, d); return { t: '大口の買い付け', b: `${PLACES[d.p].name}の${CLIENT_KINDS[d.who]}が、在庫の${GEMS[d.gem].jp}をまとめて買いたいと言っています`, yes: ['売る', `相場の ×${d.mul.toFixed(2)}・${usd(v)}`], yesOk: v > 0, no: ['断る'] }; },
  cavein: (d) => ({ t: '落盤', b: `${PLACES[d.mine].name}の鉱区で落盤がありました`, yes: ['すぐ直す', usd(d.cost), d.cost], no: ['自分たちで直す', `${DEALS.caveinStop} 時間 採掘が止まる`] }),
  offer: (d) => ({ t: '原石の売り込み', b: `${PLACES[d.p].name}の業者が、${GEMS[d.gem].jp}の原石 ${fmt(Math.round(d.ct))} ct を売りたいと言っています。品質は磨くまでわかりません`, yes: ['買う', `${usd(d.price)}・${PLACES[d.fid].name}の工場へ届く`, d.price], no: ['見送る'] }),
  loan: (d) => ({ t: '展示の依頼', b: `${PLACES[d.p].name}の美術館が、宝物庫の「${vaultName(d.fid)}」を展示したいと言っています`, yes: ['貸し出す', `謝礼 ${usd(d.fee)}・${DEALS.loanHours} 時間 宝物庫を離れる`], no: ['断る'] }),
  prospect: (d) => ({ t: '鉱脈の噂', b: `${PLACES[d.mine].name}の近くに、新しい鉱脈があるという噂です`, yes: ['調べる', `${usd(d.cost)}・見つかる見込み ${Math.round(DEALS.prospectP * 100)}%`, d.cost], no: ['見送る'] }),
  scout: (d) => ({ t: '名工の移籍', b: `腕の良い職人が、${PLACES[d.fid].name}の工場で働きたいと言っています`, yes: ['雇う', `${usd(d.cost)}・腕前 +${Math.round(DEALS.scoutSkill * 100)}`, d.cost], no: ['見送る'] }),
};
function dealResult(d, r) {
  if (!r.yes) return d.k === 'cavein' ? `${PLACES[d.mine].name}の採掘が ${DEALS.caveinStop} 時間止まります` : '見送りました';
  if (d.k === 'bulk') return `${usd(r.v)} で売れました`;
  if (d.k === 'cavein') return '修理しました';
  if (d.k === 'offer') return `${PLACES[d.fid].name}の工場に届きました`;
  if (d.k === 'loan') return `謝礼 ${usd(d.fee)} を受け取りました`;
  if (d.k === 'prospect') return r.hit ? '鉱脈が見つかりました。埋蔵量 +30 日分' : '今回は見つかりませんでした';
  return '名工が加わりました';
}

// 本社の宝物庫の欄
function vaultPanel() {
  const st = ui.st, list = st.vault;
  return `<div class="bs-rows"><div><span>飾っている名石</span><b>${list.length} / ${FIND.vaultCap}</b></div><div><span>配当の上限</span><b>+${Math.round(B.vaultBonus(st) * 100)}%</b></div></div>
    ${list.length ? `<div class="bs-vault">${list.map((f) => `<button class="bv-item" data-act="vaultOpen" data-id="${f.id}"><img src="${gemIcon(f.gem)}" alt=""><b>${f.name}</b><small>${f.lent > Date.now() ? '展示中' : `${GEMS[f.gem].jp}・${f.ct.toFixed(2)} ct`}</small>${gradeBadge(f.g)}</button>`).join('')}</div>` : '<div class="bs-note">鉱区でときどき名石が見つかります。飾ると配当の上限が上がります</div>'}`;
}

function hqSheet() {
  const st = ui.st, S = ui.sheet;
  const ready = st.orders.list.filter((o) => B.orderReady(st, o, Date.now())).length;
  const tabs = `<div class="bs-tabs sm"><button class="${S.tab === 'co' ? 'on' : ''}" data-act="tab" data-t="co">会社</button><button class="${S.tab === 'stock' ? 'on' : ''}" data-act="tab" data-t="stock">在庫</button><button class="${S.tab === 'order' ? 'on' : ''}" data-act="tab" data-t="order">注文${ready ? `<i class="bs-cnt">${ready}</i>` : ''}</button><button class="${S.tab === 'vault' ? 'on' : ''}" data-act="tab" data-t="vault">宝物庫</button></div>`;
  if (S.tab === 'order') return tabs + ordersPanel();
  if (S.tab === 'vault') return tabs + vaultPanel();
  if (S.tab === 'stock') {
    // 在庫は宝石ごとにまとめ、いちばん高く売れる取引所の値で出す
    const by = {};
    for (const k in st.stock) {
      const s = st.stock[k], g = k.split('|')[0];
      const b = B.bestExchange(st, (ex) => B.sellPrice(st, k, ex));
      (by[g] || (by[g] = { n: 0, v: 0 })).n += s.n;
      by[g].v += b.value;
    }
    let rough = 0;
    for (const id in st.mines) rough += B.storeTotal(st.mines[id]);
    let way = 0;
    for (const s of st.ships) way += s.ct;
    for (const id in st.factories) for (const e of st.factories[id].queue) way += e.ct;
    const list = Object.entries(by).sort((a, b) => b[1].v - a[1].v);
    return `${tabs}<div class="bs-rows"><div><span>鉱区の倉庫の原石</span><b>${ctf(rough)} ct</b></div><div><span>輸送中・研磨待ちの原石</span><b>${ctf(way)} ct</b></div></div>
      ${list.length ? `<div class="bs-stock">${list.map(([g, x]) => `<div class="bs-srow"><img src="${gemIcon(g)}" alt=""><span class="bs-sn">${GEMS[g].jp}</span><span class="bs-sc">${x.n < 10 ? x.n.toFixed(1) : fmt(x.n)} 個</span><b class="bs-sv">${usd(x.v)}</b></div>`).join('')}</div>` : '<div class="bs-note">磨いた石の在庫はありません</div>'}`;
  }
  const avg = avgRun(), today = todayStr();
  const v = B.companyValue(st), r = st.rank;
  const next = r < RANKS.length ? RANKS[r] : null;
  const pay = B.divPayable(st, avg, today), left = B.divLeft(st, avg, today), cap = B.divCap(st, avg);
  const rate = B.divRate(st, avg), irate = B.investRate(st, avg);
  return `${tabs}
    <div class="bs-rows">
      <div><span>資金</span><b>${usd(st.cash)}</b></div>
      <div><span>総資産</span><b>${usd(v)}</b></div>
      <div class="bs-col"><span>会社のランク ${r}：${RANKS[r - 1].name}</span>${next ? `${bar((v - RANKS[r - 1].need) / (next.need - RANKS[r - 1].need))}<b>次の「${next.name}」まで ${usd(Math.max(0, next.need - v))}</b>` : '<b>最高ランク</b>'}</div>
    </div>
    <div class="bs-h">配当</div>
    <div class="bs-rows"><div><span>今日の配当</span><b>${fmt(cap - left)} / ${fmt(cap)} コイン</b></div><div><span>換算</span><b>1 コイン = ${usd(rate)}</b></div></div>
    <div class="bs-acts">${pay > 0 ? `<button class="btn small primary" data-act="div">受け取る<span class="sub">＋${fmt(pay)} コイン・${usd(pay * rate)}</span></button>` : `<button class="btn small" disabled>${left ? '資金が足りません' : '今日の分は受け取りました'}</button>`}</div>
    <div class="bs-h">出資</div>
    <div class="bs-rows"><div><span>換算</span><b>1 コイン = ${usd(irate)}</b></div></div>
    <div class="bs-acts">${[100, 1000, 10000].map((n) => `<button class="btn small" data-act="invest" data-n="${n}" ${save.coins >= n ? '' : 'disabled'}>${fmt(n)} コイン<span class="sub">＋${usd(n * irate)}</span></button>`).join('')}</div>
    <div class="bs-h">記録</div>
    <div class="bs-rows">
      <div><span>放置で進む上限</span><b>${RANKS[r - 1].off} 時間</b></div>
      <div><span>累計の売上</span><b>${usd(st.earned)}</b></div>
      <div><span>累計の配当</span><b>${fmt(st.divTotal)} コイン</b></div>
      <div><span>累計の出資</span><b>${fmt(st.invested)} コイン</b></div>
    </div>
    <div class="bs-acts"><button class="btn small" data-act="tut">チュートリアルをもう一度</button></div>`;
}

// ---------------------------------------------------------------- 操作
function onSheetClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled || !ui.sheet) return;
  const st = ui.st, d = b.dataset, now = Date.now();
  B.catchUp(st, now);
  let ok = true, sound = 'tap';
  switch (d.act) {
    case 'close': audio.tap(); closeSheet(); return;
    case 'kind': ui.sheet.kind = d.k; ui.sheet.pick = null; $('#bzsheet', ui.node).scrollTop = 0; break;
    case 'tab': ui.sheet.tab = d.t; break;
    case 'pickShip': ui.sheet.pick = ui.sheet.pick === 'ship' ? null : 'ship'; break;
    case 'ship': ok = B.ship(st, d.id, d.f, now) > 0; ui.sheet.pick = null; sound = 'select'; break;
    case 'sellRough': ok = !!B.sellRough(st, d.id); sound = 'coin'; break;
    case 'buyMine': ok = B.buyMine(st, d.id); sound = 'buy'; break;
    case 'upMine': ok = B.upgradeMine(st, d.id); sound = 'buy'; break;
    case 'upStore': ok = B.upgradeStore(st, d.id); sound = 'buy'; break;
    case 'explore': ok = B.explore(st, d.id); sound = 'buy'; break;
    case 'buyFact': ok = B.buyFactory(st, d.id); sound = 'buy'; break;
    case 'upFact': ok = B.upgradeFactory(st, d.id); sound = 'buy'; break;
    case 'crew': ok = B.hireCrew(st, d.id); sound = 'buy'; break;
    case 'boss': ok = B.hireBoss(st, d.kind, d.id); sound = 'buy'; break;
    case 'mineTo': ok = B.setMineTo(st, d.id, d.f); break;
    case 'factOut': ok = B.setFactOut(st, d.id, d.v); break;
    case 'policy': ok = B.setPolicy(st, d.id, d.v); break;
    case 'treat': ok = B.setTreat(st, d.id, d.v === '1'); break;
    case 'buyShop': ok = B.buyShop(st, d.id); sound = 'buy'; break;
    case 'upShop': ok = B.upgradeShop(st, d.id); sound = 'buy'; break;
    case 'pickShelf': ui.sheet.pick = ui.sheet.pick === 'shelf' ? null : 'shelf'; break;
    case 'shelve': ok = B.shelve(st, d.id, d.k) > 0; sound = 'select'; break;
    case 'unshelve': ok = B.unshelve(st, d.id, d.k); break;
    case 'mtab': ui.sheet.mtab = d.t; break;
    case 'vaultOpen': audio.tap(); queueModal({ kind: 'vault', id: +d.id }); return;
    case 'open': ui.sheet.open = ui.sheet.open === d.g ? null : d.g; break;
    case 'sellGem': { let v = 0; for (const k of Object.keys(st.stock)) if (k.split('|')[0] === d.g) v += B.sellLot(st, k, d.ex); ok = v > 0; sound = 'coin'; break; }
    case 'tut': st.tut = 0; closeSheet(); startTut(); return;
    case 'lab': ok = B.sendLab(st, d.id, d.k, now); sound = 'select'; break;
    case 'pickConsign': ui.sheet.pick = ui.sheet.pick === 'consign' ? null : 'consign'; break;
    case 'consign': ok = B.consign(st, d.id, d.k, now) > 0; sound = 'select'; break;
    case 'withdraw': ok = B.withdraw(st, d.id, d.k); break;
    case 'buySight': ok = !!B.buySight(st, d.id, now); sound = 'buy'; break;
    case 'deliver': ok = B.deliver(st, +d.o, now) > 0; sound = 'coin'; break;
    case 'sell': ok = B.sellLot(st, d.k, d.ex) > 0; sound = 'coin'; break;
    case 'sellAll': { let v = 0; for (const k of Object.keys(st.stock)) v += B.sellLot(st, k, d.ex); ok = v > 0; sound = 'coin'; break; }
    case 'div': {
      const n = B.payDividend(st, avgRun(), todayStr());
      ok = n > 0;
      if (ok) { save.coins += n; save.totalCoins += n; }
      sound = 'win';
      break;
    }
    case 'invest': {
      const n = +d.n;
      ok = save.coins >= n;
      if (ok) { save.coins -= n; B.invest(st, n, avgRun()); }
      sound = 'coin';
      break;
    }
    default: return;
  }
  if (!ok) { audio.tap(); return; }
  if (sound === 'buy') { audio.levelUp(); haptic(); } else if (sound === 'coin') audio.coin(); else if (sound === 'win') audio.bigWin(); else if (sound === 'select') audio.select(); else audio.tap();
  afterChange(true);
}

// ---------------------------------------------------------------- チュートリアル
// 初めての流れ（鉱区 → 工場 → 出荷 → 売る → 配当）を、押す場所だけ明るくして 1 つずつ案内する。
// 進み具合は save.biz.tut（-1 で終わり）。手順ごとに done で次へ進み、skip か押せない的なら飛ばす
const tst = () => ui.st;
const stockN = () => Object.values(tst().stock).reduce((a, s) => a + s.n, 0);
const roughAt = (pid) => (tst().mines[pid] ? B.storeTotal(tst().mines[pid]) : 0);
const inFlight = () => tst().ships.some((s) => s.to === 'ratnapura') || !!(tst().factories.ratnapura && tst().factories.ratnapura.queue.length);
const onSheet = (pid, kind) => !!(ui.sheet && ui.sheet.pid === pid && (!kind || ui.sheet.kind === kind));
// 案内のためにシートを開く（違う地名・種類なら開き直す）
function ensureSheet(pid, kind, pick) {
  if (!onSheet(pid)) openSheet(pid, kind);
  else if (kind && ui.sheet.kind !== kind) { ui.sheet.kind = kind; ui.sheet.pick = null; }
  if (pick) ui.sheet.pick = pick;
  renderSheet();
}
// 地図をその地名が真ん中に来るように動かす
function centerOn(pid) {
  const map = $('#bzmap', ui.node), P = PLACES[pid];
  map.scrollLeft = (projX(P.lon) / MAP_W) * ui.w - map.clientWidth / 2;
  map.scrollTop = (projY(P.lat) / MAP_H) * ui.h - map.clientHeight * 0.4;
}
const TUT = [
  { t: 'ラトナプラの鉱区を開きます', sel: '.bzpin[data-p="ratnapura"]', prep: () => { closeSheet(); centerOn('ratnapura'); }, done: () => onSheet('ratnapura'), skip: () => !!(tst().mines.ratnapura && tst().factories.ratnapura) },
  { t: '開拓権を買うと、原石が掘れて倉庫にたまります', sel: '[data-act="buyMine"]', prep: () => ensureSheet('ratnapura', 'mine'), done: () => !!tst().mines.ratnapura },
  { t: '原石は工場で磨くと宝石になります。同じラトナプラの工場を開きます', sel: '[data-act="kind"][data-k="factory"]', prep: () => ensureSheet('ratnapura'), done: () => onSheet('ratnapura', 'factory'), skip: () => !!tst().factories.ratnapura },
  { t: '工場を買います', sel: '[data-act="buyFact"]', prep: () => ensureSheet('ratnapura', 'factory'), done: () => !!tst().factories.ratnapura },
  { t: '鉱区に戻って、たまった原石を工場へ出荷します', sel: '[data-act="kind"][data-k="mine"]', prep: () => ensureSheet('ratnapura'), done: () => onSheet('ratnapura', 'mine'), skip: () => roughAt('ratnapura') < 0.01 },
  { t: '「工場へ出荷」を押します', sel: '[data-act="pickShip"]', prep: () => ensureSheet('ratnapura', 'mine'), done: () => ui.sheet && ui.sheet.pick === 'ship', skip: () => roughAt('ratnapura') < 0.01 },
  { t: 'ラトナプラの工場へ送ります', sel: '[data-act="ship"][data-f="ratnapura"]', prep: () => ensureSheet('ratnapura', 'mine', 'ship'), done: () => inFlight(), skip: () => roughAt('ratnapura') < 0.01 && !inFlight() },
  { t: '原石が工場に届くと、順に磨かれて宝石の在庫になります', sel: null, wait: true, done: () => !inFlight() && stockN() > 0.01, skip: () => !inFlight() && stockN() < 0.01 },
  { t: '磨いた宝石は取引所で売ります。東京を開きます', sel: '.bzpin[data-p="tokyo"]', prep: () => { closeSheet(); centerOn('tokyo'); }, done: () => onSheet('tokyo'), skip: () => stockN() < 0.01 },
  { t: '取引所を開きます', sel: '[data-act="kind"][data-k="exchange"]', prep: () => ensureSheet('tokyo'), done: () => onSheet('tokyo', 'exchange'), skip: () => stockN() < 0.01 },
  { t: '在庫の宝石をすべて売ります', sel: '[data-act="sellAll"]', prep: () => ensureSheet('tokyo', 'exchange'), done: () => stockN() < 0.01 },
  { t: '本社では、会社の資金を配当でコインに換えられます（1 日に上限があります）', sel: '[data-act="kind"][data-k="hq"]', prep: () => ensureSheet('tokyo'), done: () => onSheet('tokyo', 'hq') },
  { t: '鉱区や工場を増やして、会社を大きくしましょう。会社のランクが上がると、新しい場所が開きます', sel: null, ok: true },
];
let tut = null;
function startTut() {
  if (!ui || tst().tut == null || tst().tut < 0) return;
  const app = document.getElementById('app');
  const el0 = document.createElement('div');
  el0.id = 'bztut';
  el0.innerHTML = '<div class="tut-block"></div><div class="tut-block"></div><div class="tut-block"></div><div class="tut-block"></div><div class="tut-hole"></div><div class="tut-bub"><p></p><div class="tut-row"><span class="tut-n"></span><span><button class="tut-skip">スキップ</button><button class="btn small primary tut-ok">OK</button></span></div></div>';
  app.appendChild(el0);
  tut = { el: el0, i: -1, node: ui.node };
  $('.tut-skip', el0).onclick = () => { audio.tap(); endTut(); };
  $('.tut-ok', el0).onclick = () => { audio.tap(); tst().tut++; tutCheck(); };
  tutCheck();
  requestAnimationFrame(tutFrame);
}
function endTut() {
  if (!tut) return;
  tst().tut = -1;
  tut.el.remove();
  tut = null;
  persist();
}
// 手順を進める：終わった手順・飛ばす手順を越えて、新しい手順に入ったら準備する
function tutCheck() {
  if (!tut) return;
  const st = tst();
  for (;;) {
    if (st.tut >= TUT.length) { endTut(); return; }
    const s = TUT[st.tut];
    if (s.ok) break;
    const tgt = s.sel && $(s.sel, ui.node);
    if ((s.skip && s.skip()) || s.done() || (tgt && tgt.disabled && st.tut !== tut.i)) { st.tut++; continue; }
    break;
  }
  if (st.tut !== tut.i) {
    tut.i = st.tut;
    const s = TUT[st.tut];
    if (s.prep) s.prep();
    $('p', tut.el).textContent = s.t;
    $('.tut-n', tut.el).textContent = `${st.tut + 1} / ${TUT.length}`;
    $('.tut-ok', tut.el).style.display = s.ok ? '' : 'none';
    $('.tut-skip', tut.el).style.display = s.ok ? 'none' : '';
    persist();
    requestAnimationFrame(() => { const tgt = s.sel && $(s.sel, ui.node); if (tgt && tgt.closest('#bzsheet')) tgt.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
  }
  // 最初の出荷は、届いたらすぐに磨き上げる（待たずに続きへ進めるように）
  const s = TUT[st.tut];
  if (s.wait) {
    for (const sh of st.ships) if (sh.to === 'ratnapura' && sh.arrive > Date.now() + 3000) { sh.arrive = Date.now() + 3000; }
    const f = st.factories.ratnapura;
    if (f && f.queue.length && !st.ships.some((x) => x.to === 'ratnapura')) { B.finishQueue(st, 'ratnapura', Date.now()); afterChange(true); }
  }
}
// 明るくする枠と、まわりを押せなくする板・吹き出しの位置を毎フレーム合わせる
function tutFrame() {
  if (!tut) return;
  if (!ui || ui.node !== tut.node || !tut.node.isConnected) { tut.el.remove(); tut = null; return; }
  const s = TUT[tut.i], W = innerWidth, H = innerHeight;
  const tgt = s && s.sel && $(s.sel, ui.node);
  let r = null;
  if (tgt) { const b = tgt.getBoundingClientRect(); if (b.width) r = { l: b.left - 6, t: b.top - 6, r: b.right + 6, b: b.bottom + 6 }; }
  const [bt, bb, bl, br] = tut.el.querySelectorAll('.tut-block');
  const hole = $('.tut-hole', tut.el), bub = $('.tut-bub', tut.el);
  const set = (e, x, y, w, h) => { e.style.cssText = `left:${x}px;top:${y}px;width:${Math.max(0, w)}px;height:${Math.max(0, h)}px`; };
  if (r) {
    set(bt, 0, 0, W, r.t); set(bb, 0, r.b, W, H - r.b); set(bl, 0, r.t, r.l, r.b - r.t); set(br, r.r, r.t, W - r.r, r.b - r.t);
    set(hole, r.l, r.t, r.r - r.l, r.b - r.t);
    hole.classList.remove('none');
    const below = (r.t + r.b) / 2 < H * 0.5;
    bub.style.top = below ? `${r.b + 12}px` : '';
    bub.style.bottom = below ? '' : `${H - r.t + 12}px`;
  } else {
    set(bt, 0, 0, W, H); set(bb, 0, 0, 0, 0); set(bl, 0, 0, 0, 0); set(br, 0, 0, 0, 0);
    set(hole, W / 2, H / 2, 0, 0);
    hole.classList.add('none');
    bub.style.top = `${H * 0.38}px`;
    bub.style.bottom = '';
  }
  requestAnimationFrame(tutFrame);
}

// ---------------------------------------------------------------- メニューの印
export function bizBadge() {
  const st = save.biz;
  if (!st) return false;
  B.catchUp(st, Date.now());
  return B.bizAlerts(st, avgRun(), todayStr()).any;
}
