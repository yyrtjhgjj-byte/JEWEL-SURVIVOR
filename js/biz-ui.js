// =====================================================================
//  経営の画面：世界地図をスクロールして、地名のピンを押すと下から操作の板（シート）が上がる
//  仕組みは biz.js、データは biz-data.js、地図の形は biz-map.js
// =====================================================================
import { save, persist } from './save.js';
import { audio } from './audio.js';
import { fmt, todayStr } from './util.js';
import { show, el, $, coinPill, refreshCoinPill, haptic, getApp, toast } from './ui.js';
import { gemIcon } from './render.js';
import { GEMS } from './data.js';
import { gradeBadge } from './atelier-ui.js';
import { refreshNav } from './menu.js';
import * as B from './biz.js';
import { PLACES, MINES, FACTORIES, EXCHANGES, RANKS, MINE_LV, STORE_LV, FACT_LV, CREW, BIZ_GEMS, FAC_KINDS, FAC_TABLE } from './biz-data.js';
import { worldSvg, projX, projY, MAP_W, MAP_H } from './biz-map.js';

// 今の版で使える施設の種類
const KINDS_ON = ['hq', 'mine', 'factory', 'exchange'];

// ---------------------------------------------------------------- 表記
export function usd(n) {
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a < 1e4) return `${s}$${fmt(a)}`;
  if (a < 1e6) return `${s}$${(a / 1e3).toFixed(a < 1e5 ? 1 : 0)}K`;
  if (a < 1e9) return `${s}$${(a / 1e6).toFixed(a < 1e8 ? 2 : 1)}M`;
  return `${s}$${(a / 1e9).toFixed(2)}B`;
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
    if (k === 'exchange' && EXCHANGES[pid].show) continue;
    out.push(k);
  }
  return out;
}
const facRank = (k, pid) => (k === 'hq' ? 1 : FAC_TABLE[k][pid].r);
const placeRank = (pid) => Math.min(...facsAt(pid).map((k) => facRank(k, pid)));
const owns = (st, k, pid) => (k === 'hq' ? true : k === 'mine' ? !!st.mines[pid] : k === 'factory' ? !!st.factories[pid] : false);
const PLACE_IDS = Object.keys(PLACES).filter((pid) => facsAt(pid).length);

// ---------------------------------------------------------------- 画面
let ui = null;

export function showBiz() {
  const now = Date.now();
  let first = false;
  if (!save.biz) { save.biz = B.newBiz(now); first = true; persist(); }
  const st = save.biz;
  B.catchUp(st, now);
  B.updateRank(st);
  const node = el(`<div class="screen biz-screen" data-nav="biz">
    <div class="bz-top">
      <div class="bz-rank"><b id="bzrk"></b><span class="bz-rbar"><i id="bzrb"></i></span></div>
      <div class="bz-cash"><small>資金</small><b id="bzcash"></b></div>
      <button class="bz-div" id="bzdiv"><small>配当</small><b id="bzdivv"></b></button>
      ${coinPill()}
    </div>
    <div class="bz-map" id="bzmap"><div class="bz-world" id="bzworld">${worldSvg()}<svg class="bz-routes" id="bzroutes" viewBox="0 0 ${MAP_W} ${MAP_H}" preserveAspectRatio="none" aria-hidden="true"></svg><div class="bz-pins" id="bzpins"></div></div></div>
    <div class="bz-tools"><button id="bzzoom" aria-label="拡大"></button><button id="bzhq">${icon('hq')}<span>本社</span></button></div>
    <div class="bz-sheet" id="bzsheet"></div>
  </div>`);
  show(node);
  ui = { node, st, zoom: (st.view && st.view.z) || 1, sheet: null, touching: false, ships: '', t: 0, lastSave: now };
  layoutMap(true);
  renderPins();
  renderTop();
  renderRoutes();
  $('#bzzoom', node).onclick = () => { audio.tap(); ui.zoom = ui.zoom === 1 ? 2 : 1; layoutMap(false); renderPins(); };
  $('#bzhq', node).onclick = () => { audio.tap(); openSheet('tokyo', 'hq'); };
  $('#bzdiv', node).onclick = () => { audio.tap(); openSheet('tokyo', 'hq'); };
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
  if (first) openSheet('ratnapura', 'mine');
  const tick = () => {
    if (!ui || ui.node !== node || !node.isConnected) { if (ui && ui.node === node) ui = null; return; }
    const t = Date.now();
    B.catchUp(st, t);
    afterChange(false);
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
  const work = (st.factories[pid] && st.factories[pid].queue.length > 0) || (st.mines[pid] && st.mines[pid].reserve > 1 && !alert);
  return { ks, lock, own, alert, work, main: ks[0] };
}
function renderPins() {
  const box = $('#bzpins', ui.node);
  // 近いピンどうしは少し離す（画面の上での位置で）
  const pos = PLACE_IDS.map((pid) => ({ pid, x: (projX(PLACES[pid].lon) / MAP_W) * ui.w, y: (projY(PLACES[pid].lat) / MAP_H) * ui.h, dx: 0, dy: 0 }));
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
    const cls = ['bzpin', `k-${s.main}`, s.lock ? 'lock' : '', s.own ? 'own' : '', s.alert ? 'alert' : '', s.work ? 'work' : ''].join(' ');
    return `<button class="${cls}" data-p="${p.pid}" style="left:${p.x}px;top:${p.y}px;--dx:${p.dx.toFixed(1)}px;--dy:${p.dy.toFixed(1)}px">
      <span class="bp-ic">${icon(s.main)}${s.ks.length > 1 ? `<i class="bp-more">${s.ks.length}</i>` : ''}</span><span class="bp-nm">${PLACES[p.pid].name}</span></button>`;
  }).join('');
  box.querySelectorAll('.bzpin').forEach((b) => (b.onclick = () => { audio.tap(); openSheet(b.dataset.p); }));
}
function refreshPins() {
  for (const b of $('#bzpins', ui.node).querySelectorAll('.bzpin')) {
    const s = pinState(b.dataset.p);
    b.classList.toggle('lock', s.lock);
    b.classList.toggle('own', s.own);
    b.classList.toggle('alert', s.alert);
    b.classList.toggle('work', s.work);
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
  if (acted) { persist(); refreshCoinPill(); refreshNav(); metaAch(); }
}

// ---------------------------------------------------------------- シート
function openSheet(pid, kind) {
  const ks = facsAt(pid);
  ui.sheet = { pid, kind: kind && ks.includes(kind) ? kind : ks.find((k) => owns(ui.st, k, pid) && k !== 'hq') || ks[0], pick: null, tab: 'co' };
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
  const P = PLACES[S.pid], ks = facsAt(S.pid);
  const top = sh.scrollTop;
  const body = { hq: hqSheet, mine: mineSheet, factory: factorySheet, exchange: exchangeSheet }[S.kind](S.pid);
  const html = `<div class="bs-head"><div><b>${P.name}</b><small>${P.country}</small></div><button class="bs-x" data-act="close" aria-label="閉じる">×</button></div>
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
  let ship = '';
  if (ui.sheet.pick === 'ship') {
    const fs = Object.keys(st.factories);
    ship = `<div class="bs-pick">${fs.length ? fs.map((fid) => {
      const can = Object.keys(m.store).some((k) => B.canCut(fid, k.split('|')[0]));
      return `<button class="bs-prow" data-act="ship" data-id="${pid}" data-f="${fid}" ${can && tot > 0 ? '' : 'disabled'}><span>${icon('factory')}${PLACES[fid].name}</span><small>${can ? `${minf(B.shipMin(pid, fid))}` : '磨けない石'}</small></button>`;
    }).join('') : '<div class="bs-note">工場がありません</div>'}</div>`;
  }
  const best = B.bestExchange(st, (ex) => B.roughValue(st, m.store, pid, ex));
  const nl = m.lv < MINE_LV.length ? MINE_LV[m.lv] : null;
  const ns = m.sl < STORE_LV.length - 1 ? STORE_LV[m.sl + 1] : null;
  return `${head}
    <div class="bs-rows">
      <div><span>設備</span><b>${MINE_LV[m.lv - 1].name}</b></div>
      <div><span>産出</span><b>${m.reserve > 1 ? `${ctf(out)} ct/時` : '枯渇'}</b></div>
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
      <div><span>探鉱<small>埋蔵量 +30 日分（手掘りの産出で）</small></span>${btn('explore', '探す', B.exploreCost(st, pid), `data-id="${pid}"`)}</div>
    </div>`;
}
const exName = (id) => (EXCHANGES[id].name ? `${PLACES[id].name}・${EXCHANGES[id].name}` : PLACES[id].name);

function factorySheet(pid) {
  const st = ui.st, F = FACTORIES[pid], f = st.factories[pid];
  const head = `<div class="bs-sub">得意な石</div>${specChips(F.spec)}${F.only ? '<div class="bs-note">ダイヤモンドだけを磨く工場</div>' : ''}`;
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
    <div class="bs-h">強化</div>
    <div class="bs-ups">
      ${nl ? `<div><span>処理の速さ Lv ${f.lv + 1}<small>×${nl.cap}</small></span>${btn('upFact', '強化', B.factUpCost(st, pid), `data-id="${pid}"`)}</div>` : '<div><span>処理の速さ：最大</span></div>'}
      ${nc ? `<div><span>職人 ${f.crew + 1} 人目<small>腕前 +${Math.round((nc.skill - CREW[f.crew].skill) * 100)}</small></span>${btn('crew', '雇う', B.crewCost(st, pid), `data-id="${pid}"`)}</div>` : '<div><span>職人：最大</span></div>'}
    </div>`;
}

function stockRows(exId) {
  const st = ui.st;
  const keys = Object.keys(st.stock).filter((k) => st.stock[k].n >= 0.005);
  if (!keys.length) return { html: '<div class="bs-note">在庫はありません</div>', total: 0 };
  const rows = keys.map((k) => ({ k, p: B.parseKey(k), s: st.stock[k], v: B.sellPrice(st, k, exId) })).sort((a, b) => b.v - a.v);
  return {
    total: rows.reduce((s, r) => s + r.v, 0),
    html: `<div class="bs-stock">${rows.map((r) => `<div class="bs-srow"><img src="${gemIcon(r.p.gem)}" alt=""><span class="bs-sn">${GEMS[r.p.gem].jp}<small>${PLACES[r.p.origin] ? PLACES[r.p.origin].name : ''}${r.p.treat ? '・処理' : ''}</small></span>${gradeBadge(r.p.g)}<span class="bs-sc">${r.s.n < 10 ? r.s.n.toFixed(1) : fmt(r.s.n)} 個</span><button class="btn small" data-act="sell" data-k="${r.k}" data-ex="${exId}">${usd(r.v)}</button></div>`).join('')}</div>`,
  };
}
function exchangeSheet(pid) {
  const st = ui.st, E = EXCHANGES[pid];
  if (E.r > st.rank) return lockLine(E.r);
  const r = stockRows(pid);
  return `${E.spec ? `<div class="bs-sub">高く買う石</div>${specChips(E.spec)}` : ''}
    <div class="bs-rows"><div><span>買い取り</span><b>相場の ${Math.round(E.mul * 100)}%${E.spec ? '（得意な石は +8%）' : ''}</b></div></div>
    <div class="bs-acts">${btn('sellAll', 'すべて売る', null, `data-ex="${pid}" ${r.total > 0 ? '' : 'disabled'}`, 'primary')}<span class="bs-total">${usd(r.total)}</span></div>
    ${r.html}`;
}

function hqSheet() {
  const st = ui.st, S = ui.sheet;
  const tabs = `<div class="bs-tabs sm"><button class="${S.tab === 'co' ? 'on' : ''}" data-act="tab" data-t="co">会社</button><button class="${S.tab === 'stock' ? 'on' : ''}" data-act="tab" data-t="stock">在庫</button></div>`;
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
    </div>`;
}

// ---------------------------------------------------------------- 操作
function onSheetClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
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

// ---------------------------------------------------------------- メニューの印
export function bizBadge() {
  const st = save.biz;
  if (!st) return false;
  B.catchUp(st, Date.now());
  return B.bizAlerts(st, avgRun(), todayStr()).any;
}
