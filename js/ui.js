// =====================================================================
//  UI：タイトル / レベルアップ / 宝箱 / ガチャ / 図鑑 / リザルト
// =====================================================================
import {
  GEMS, WEAPONS, WEAPON_IDS, WEAPON_MAX, PASSIVES, PASSIVE_IDS, MAX_WEAPONS, MAX_CHARMS, CHARACTERS, CHAR_IDS, ENEMIES, SHOP, shopCost,
  ACHIEVEMENTS, GACHA_COST, GACHA10_COST, GACHA_TABLE, EXCHANGE, AWAKEN_MAX,
} from './data.js';
import { gemIcon, coinIcon, roughIcon, artifactIcon, enemySprite } from './render.js';
import { ARTIFACTS, ARTIFACT_BY_ID, artifactUnlocked, unlockedArtifacts } from './artifacts.js';
import { STAGES, STAGE_BY_ID, HEAT_MAX, heatMods } from './stages.js';
import { fmt, fmtTime, pick } from './util.js';
import { audio } from './audio.js';
import { save, persist, resetSave, exportSave, parseBackup, importSave } from './save.js';
import { ROUGH, ROUGH_IDS, totalRough } from './atelier.js';
import { showAtelier } from './atelier-ui.js';

const $ = (s, r = document) => r.querySelector(s);
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
const screens = () => $('#screens');
function show(node) {
  const s = screens();
  s.innerHTML = '';
  s.appendChild(node);
  return node;
}
function clearScreens() { screens().innerHTML = ''; }
function guard(node, ms = 450) {
  node.style.pointerEvents = 'none';
  setTimeout(() => { node.style.pointerEvents = ''; }, ms);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let app = null;
export function initUI(a) {
  app = a;
  setupHaptic();
  setupWordBreaks();
}

// ------------------------------------------------------------------ 折り返し
// 「・」の直後に改行位置（<wbr>）を入れる。名前の欄は CSS の keep-all で単語の途中では改行せず、
// 「ゴールデン・／ジャックポット」のように「・」で分かれる
function addWbr(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const i = n.data.indexOf('・');
    if (i >= 0 && i < n.data.length - 1) hits.push(n);
  }
  for (let n of hits) {
    let i;
    while ((i = n.data.indexOf('・')) >= 0 && i < n.data.length - 1) {
      const rest = n.splitText(i + 1);
      n.parentNode.insertBefore(document.createElement('wbr'), rest);
      n = rest;
    }
  }
}
function setupWordBreaks() {
  const mo = new MutationObserver((list) => {
    for (const m of list) for (const n of m.addedNodes) {
      if (n.nodeType === 1) addWbr(n);
      else if (n.nodeType === 3 && n.parentNode) addWbr(n.parentNode);
    }
  });
  for (const id of ['screens', 'banners', 'toasts']) {
    const box = document.getElementById(id);
    if (box) mo.observe(box, { childList: true, subtree: true });
  }
}

// ------------------------------------------------------------------ 振動
let hapLabel = null, hapLast = 0;
function setupHaptic() {
  // iOS 18 以降の Safari は <input switch> のトグルで触覚フィードバックが出る
  const id = 'hapsw';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.setAttribute('switch', '');
  input.style.display = 'none';
  const label = document.createElement('label');
  label.htmlFor = id;
  label.style.display = 'none';
  document.body.append(input, label);
  hapLabel = label;
}
export function haptic() {
  if (!save.settings.haptic) return;
  const now = performance.now();
  if (now - hapLast < 90) return;
  hapLast = now;
  try {
    if (navigator.vibrate) navigator.vibrate(12);
    else if (hapLabel) hapLabel.click();
  } catch (e) { /* ignore */ }
}

// ------------------------------------------------------------------ 共通パーツ
function gemColor(id) { return GEMS[id].rainbow ? '#e6d4ff' : GEMS[id].color; }
function wordTag(gemId) {
  const c = gemColor(gemId);
  return `<span class="word-tag" style="color:${c};border-color:${c}66;background:${c}14">${GEMS[gemId].word}</span>`;
}
const coinIco = '<i class="coin-ico"></i>';
function coinPill() { return `<div class="coinpill" id="coinpill">${coinIco}<span>${fmt(save.coins)}</span></div>`; }
function refreshCoinPill() {
  const p = $('#coinpill span');
  if (!p) return;
  p.textContent = fmt(save.coins);
  const pill = $('#coinpill');
  pill.classList.remove('bump');
  void pill.offsetWidth;
  pill.classList.add('bump');
}
function topbar(en, jp, right = coinPill()) {
  return `<div class="topbar"><button class="iconbtn" id="back" aria-label="戻る">‹</button><h2><span class="en">${en}</span><span class="jp">${jp}</span></h2>${right}</div>`;
}
function countUp(elm, target, dur, fmtFn, tick = true) {
  const t0 = performance.now();
  return new Promise((resolve) => {
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / dur);
      elm.textContent = fmtFn(target * (1 - Math.pow(1 - t, 3)));
      if (tick) audio.countTick();
      if (t < 1) requestAnimationFrame(step); else resolve();
    };
    step();
  });
}

// ================================================================== タイトル
export function showTitle() {
  audio.playBgm('title');
  const cid = save.selected;
  const g = GEMS[cid];
  const node = el(`
    <div class="screen title-screen">
      <div class="title-top">${coinPill()}<button class="iconbtn" id="t-set" aria-label="設定">⚙</button></div>
      <div class="logo">
        <div class="main">JEWEL<br>SURVIVOR</div>
        <div class="line"></div>
      </div>
      <div class="title-hero">
        <img src="${gemIcon(cid, 160)}" alt="" style="filter:drop-shadow(0 0 24px ${gemColor(cid)})">
        <div class="word">${g.jp}<small>${g.en} — ${g.word}</small></div>
      </div>
      <div class="title-menu">
        <button class="btn big primary" id="t-play">START</button>
        <div class="title-row">
          <button class="btn" id="t-shop">WORKSHOP<span class="sub">工房</span></button>
          <button class="btn" id="t-atelier">ATELIER<span class="sub">研磨</span>${totalRough() ? `<b class="badge">${totalRough()}</b>` : ''}</button>
        </div>
        <div class="title-row">
          <button class="btn" id="t-gacha">SUMMON<span class="sub">原石ガチャ</span></button>
          <button class="btn" id="t-zukan">ARCHIVE<span class="sub">図鑑・実績</span></button>
        </div>
      </div>
    </div>`);
  show(node);
  const tap = (id, fn) => $(id, node).addEventListener('click', () => { audio.unlock(); audio.tap(); fn(); });
  tap('#t-play', showCharSelect);
  tap('#t-shop', showShop);
  tap('#t-gacha', showGacha);
  tap('#t-zukan', () => showZukan('gems'));
  tap('#t-atelier', () => showAtelier());
  tap('#t-set', () => showSettings(showTitle));
  loginBonus();
}

// ------------------------------------------------------------------ ログインボーナス
function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function loginBonus() {
  const today = todayStr();
  const L = save.login;
  if (L.last === today) return;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  L.streak = L.last === todayStr(y) ? L.streak + 1 : 1;
  L.last = today;
  const day = ((L.streak - 1) % 7) + 1;
  const reward = day === 7 ? 1000 : 100 + day * 50;
  save.coins += reward;
  persist();
  const node = el(`
    <div class="screen dim" style="justify-content:center;gap:14px;text-align:center">
      <div class="rays"></div>
      <div class="big-title prism-text">DAILY BONUS</div>
      <div class="sub-title">連続ログイン <b>${L.streak}</b> 日目</div>
      <div class="login-days">${Array.from({ length: 7 }, (_, i) => `<div class="lday ${i + 1 < day ? 'got' : ''} ${i + 1 === day ? 'today' : ''}"><span>DAY</span><b>${i + 1}</b><span>${i === 6 ? 1000 : 100 + (i + 1) * 50}</span></div>`).join('')}</div>
      <div class="chest-coins">${coinIco}+${fmt(reward)}</div>
      <button class="btn big primary" id="lok">CLAIM</button>
    </div>`);
  screens().appendChild(node);
  guard(node, 700);
  setTimeout(() => audio.bigWin(), 300);
  $('#lok', node).onclick = () => { audio.unlock(); audio.coin(); haptic(); node.remove(); refreshCoinPill(); };
}

// ================================================================== キャラ選択
export function showCharSelect() {
  let sel = save.unlocked[save.selected] ? save.selected : 'ruby';
  const node = el(`
    <div class="screen">
      ${topbar('SELECT', 'ジュエル選択')}
      <div class="panel" id="detail"></div>
      <div class="char-grid" id="grid"></div>
      <div class="center-col">
        <button class="btn big primary" id="go" style="width:100%;max-width:360px">NEXT</button>
      </div>
    </div>`);
  show(node);
  $('#back', node).onclick = () => { audio.tap(); showTitle(); };
  const grid = $('#grid', node);
  const renderDetail = () => {
    const c = CHARACTERS[sel];
    const g = GEMS[sel];
    const w = WEAPONS[c.weapon];
    const unlocked = !!save.unlocked[sel];
    const aw = save.awaken[sel] || 0;
    $('#detail', node).innerHTML = `
      <div class="char-detail">
        <img src="${gemIcon(sel, 160)}" style="${unlocked ? `filter:drop-shadow(0 0 18px ${gemColor(sel)})` : 'filter:grayscale(1) brightness(.3)'}">
        <div>
          <div class="name">${unlocked ? g.jp : '???'}</div>
          <div class="sub"><span class="en">${g.en}</span><span class="rarbadge r-${c.rarity}">${c.rarity}</span>${wordTag(sel)}</div>
          <div class="row">武器 <b>${w.name}</b></div>
          <div class="row">特性 <b>${c.perk}</b>${aw ? ` ／ 覚醒+${aw}（攻撃力+${aw * 5}%）` : ''}</div>
        </div>
      </div>
      <div class="lore">${unlocked ? g.lore : '🔒 解放条件：' + (c.unlock || 'ガチャ')}</div>`;
    $('#go', node).disabled = !unlocked;
  };
  CHAR_IDS.forEach((id) => {
    const c = CHARACTERS[id];
    const cell = el(`<button class="char-cell ${save.unlocked[id] ? '' : 'locked'} ${id === sel ? 'sel' : ''}" style="--c:${gemColor(id)}">
      <img src="${gemIcon(id, 96)}"><span class="rar rarbadge r-${c.rarity}">${c.rarity}</span>
      ${save.awaken[id] ? `<span class="aw">★${save.awaken[id]}</span>` : ''}</button>`);
    cell.onclick = () => {
      audio.cardFlip(CHAR_IDS.indexOf(id) % 5);
      sel = id;
      grid.querySelectorAll('.char-cell').forEach((x) => x.classList.remove('sel'));
      cell.classList.add('sel');
      renderDetail();
    };
    grid.appendChild(cell);
  });
  renderDetail();
  $('#go', node).onclick = () => {
    if (!save.unlocked[sel]) return;
    audio.select();
    save.selected = sel;
    persist();
    showStageSelect();
  };
}

// ================================================================== ステージ選択
function stageRec(id) { return save.stages[id] || {}; }
function stageUnlocked(st) {
  return st.no === 1 || !!stageRec(STAGES[st.no - 2].id).cleared;
}
export function showStageSelect() {
  let sel = STAGE_BY_ID[save.selectedStage] && stageUnlocked(STAGE_BY_ID[save.selectedStage]) ? save.selectedStage : 'wastes';
  const node = el(`
    <div class="screen">
      ${topbar('STAGE', 'ステージ選択')}
      <div class="stage-list" id="list"></div>
      <div class="panel" id="opts"></div>
      <div class="center-col" style="margin-top:12px">
        <button class="btn big primary" id="go" style="width:100%;max-width:360px">DEPLOY</button>
      </div>
    </div>`);
  show(node);
  $('#back', node).onclick = () => { audio.tap(); showCharSelect(); };
  const list = $('#list', node);
  const renderOpts = () => {
    const rec = stageRec(sel);
    const maxHeat = rec.cleared ? Math.min(HEAT_MAX, (rec.heat ?? 0) + 1) : 0;
    if ((save.heatSel || 0) > maxHeat) save.heatSel = maxHeat;
    const h = save.heatSel || 0;
    const m = heatMods(h);
    const arts = unlockedArtifacts();
    if (save.artSel && !arts.includes(save.artSel)) save.artSel = null;
    const artA = save.artSel ? ARTIFACT_BY_ID[save.artSel] : null;
    $('#opts', node).innerHTML = `
      <div class="toggle-row art-row" style="margin-bottom:10px"><span>ARTIFACT<small>${arts.length ? (artA ? `${artA.no}　${artA.name}` : '持ち込まない') : '実績を達成すると解放'}</small></span>
        <button class="btn small" id="artsel" ${arts.length ? '' : 'disabled'}>${artA ? '変更' : '選ぶ'}</button></div>
      <div class="toggle-row"><span>HEAT<small>${rec.cleared ? `敵HP ×${m.hp.toFixed(2)} ／ 敵攻撃 ×${m.dmg.toFixed(2)} ／ 獲得コイン ×${m.coin.toFixed(1)}` : 'このステージをクリアすると解放'}</small></span>
        <div class="heat-ctl"><button class="iconbtn" id="hm" ${h <= 0 ? 'disabled' : ''}>−</button><b class="heat-val h${h}">${h}</b><button class="iconbtn" id="hp" ${h >= maxHeat ? 'disabled' : ''}>＋</button></div></div>
      ${rec.cleared ? `<div class="toggle-row" style="margin-top:10px"><span>ENDLESS<small>最終ボス撃破後も続行（敵が際限なく強化）</small></span><button class="switch ${save.endless ? 'on' : ''}" id="en"></button></div>
      <div class="toggle-row" style="margin-top:10px"><span>HYPER<small>自機・敵の移動速度 ×1.65、敵弾 ×1.2、獲得コイン ×1.5</small></span><button class="switch ${save.hyper ? 'on' : ''}" id="hy"></button></div>
      <div class="toggle-row" style="margin-top:10px"><span>HURRY<small>ステージの時間が 2 倍速で進む</small></span><button class="switch ${save.hurry ? 'on' : ''}" id="hu"></button></div>` : ''}`;
    const hm = $('#hm', node), hp = $('#hp', node);
    hm.onclick = () => { save.heatSel = Math.max(0, h - 1); audio.tap(); renderOpts(); };
    hp.onclick = () => { save.heatSel = Math.min(maxHeat, h + 1); audio.tap(); renderOpts(); };
    $('#artsel', node).onclick = () => { audio.tap(); pickArtifact(arts, (id) => { save.artSel = id; persist(); renderOpts(); }, true); };
    const en = $('#en', node);
    if (en) en.onclick = () => { save.endless = !save.endless; en.classList.toggle('on', save.endless); audio.tap(); persist(); };
    for (const [id, k] of [['#hy', 'hyper'], ['#hu', 'hurry']]) {
      const b = $(id, node);
      if (b) b.onclick = () => { save[k] = !save[k]; b.classList.toggle('on', save[k]); audio.tap(); persist(); };
    }
  };
  const render = () => {
    list.innerHTML = '';
    for (const st of STAGES) {
      const open = stageUnlocked(st);
      const rec = stageRec(st.id);
      const card = el(`<button class="stage-card ${open ? '' : 'locked'} ${st.id === sel ? 'sel' : ''}" style="--sc:${st.pal.accent};--sg:${st.pal.glow}">
        <div class="st-head"><span class="st-no">STAGE ${st.no}</span>${rec.cleared ? `<span class="st-clear">CLEAR${rec.heat ? ` ・ HEAT ${rec.heat}` : ''}</span>` : ''}</div>
        <div class="st-name">${open ? st.name : '？？？'}<span class="en">${st.en}</span></div>
        <div class="st-desc">${open ? st.desc : `🔒 ${STAGES[st.no - 2].name} をクリアで解放`}</div>
        ${open ? `<div class="st-meta"><span>${st.hazardText}</span><span>${Math.round(st.time / 60)}分</span>${rec.best ? `<span>最長 ${fmtTime(rec.best)}</span>` : ''}</div>` : ''}
      </button>`);
      if (open) card.onclick = () => { sel = st.id; audio.cardFlip(st.no); render(); renderOpts(); };
      list.appendChild(card);
    }
  };
  render();
  renderOpts();
  $('#go', node).onclick = () => {
    audio.select();
    save.selectedStage = sel;
    persist();
    const rec = stageRec(sel);
    app.startGame(save.selected, { stageId: sel, heat: save.heatSel || 0, endless: !!rec.cleared && save.endless, hyper: !!rec.cleared && save.hyper, hurry: !!rec.cleared && save.hurry, artifact: save.artSel || null });
  };
}

// ================================================================== 工房
// 工房：現在の効果量と次のレベルの効果量
function shopEffect(it, lv, max) {
  // 最大 Lv1 の強化（リバイブなど）は数値を増やす形ではないので、説明文をそのまま出す
  if (it.max === 1) return lv ? `<b class="scur">${it.t}</b>` : it.t;
  const m = it.t.match(/^(.*?)([+-]?)(\d+(?:\.\d+)?)(.*)$/);
  if (!m) return it.t;
  const [, label, sign, num, suf] = m;
  const v = (n) => (n ? sign : '') + +(parseFloat(num) * n).toFixed(2) + suf;
  return `${label}<b class="scur">${v(lv)}</b>${max ? '' : `<span class="snext"> → ${v(lv + 1)}</span>`}`;
}

export function showShop() {
  const node = el(`
    <div class="screen">
      ${topbar('WORKSHOP', '工房 — 永続強化')}
      <div class="shop-list" id="list"></div>
      <div class="refund-row"><button class="btn small" id="refund"></button><span>最大まで上げた強化は ON／OFF を切り替えられます</span></div>
    </div>`);
  show(node);
  $('#back', node).onclick = () => { audio.tap(); showTitle(); };
  const list = $('#list', node);
  const spent = () => SHOP.reduce((a, it) => { let t = 0; for (let i = 0; i < (save.upgrades[it.id] || 0); i++) t += shopCost(it, i); return a + t; }, 0);
  // 全額返金：強化をすべて Lv0 に戻し、使ったコインを返す
  $('#refund', node).onclick = () => {
    const v = spent();
    if (!v) return;
    audio.tap();
    if (!confirm(`工房の強化をすべて Lv0 に戻し、${fmt(v)} コインを返金します。よろしいですか？`)) return;
    save.coins += v;
    save.upgrades = {};
    save.upgradesOff = {};
    persist();
    audio.coin();
    render();
    refreshCoinPill();
  };
  const render = () => {
    list.innerHTML = '';
    const v = spent();
    $('#refund', node).innerHTML = `全額返金 ${coinIco}${fmt(v)}`;
    $('#refund', node).disabled = !v;
    for (const it of SHOP) {
      const lv = save.upgrades[it.id] || 0;
      const max = lv >= it.max;
      const cost = max ? 0 : shopCost(it, lv);
      const off = max && !!save.upgradesOff[it.id];
      const row = el(`<div class="shop-item ${off ? 'off' : ''}">
        <img src="${gemIcon(it.gem, 72)}">
        <div class="sbody"><div class="sname">${it.name}<small>LV ${lv}/${it.max}</small></div>
          <div class="sdesc">${shopEffect(it, lv, max)}</div>
          <div class="pips">${Array.from({ length: it.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div></div>
        <button class="btn small ${max ? 'maxsw' : 'gold'}" ${!max && save.coins < cost ? 'disabled' : ''}>${max ? (off ? 'OFF' : 'MAX ON') : coinIco + fmt(cost)}</button>
      </div>`);
      $('.btn', row).onclick = () => {
        if (max) {
          // 最大まで上げた強化は無効にできる
          if (save.upgradesOff[it.id]) delete save.upgradesOff[it.id];
          else save.upgradesOff[it.id] = true;
          persist();
          audio.tap();
          render();
          return;
        }
        if (save.coins < cost) return;
        save.coins -= cost;
        save.upgrades[it.id] = lv + 1;
        persist();
        audio.levelUp();
        haptic();
        render();
        refreshCoinPill();
        const nr = list.children[SHOP.indexOf(it)];
        if (nr) nr.classList.add('bought');
      };
      list.appendChild(row);
    }
  };
  render();
}

// ================================================================== ガチャ
// 1 回分を抽選。minRank 以上を保証する（10 連の確定枠）
function gachaRoll(minRank = 'R') {
  const minN = rankNum(minRank);
  const table = GACHA_TABLE.filter((t) => rankNum(t.rank) >= minN);
  const total = table.reduce((a, t) => a + t.p, 0);
  let r = Math.random() * total;
  let row = table[table.length - 1];
  for (const t of table) { r -= t.p; if (r <= 0) { row = t; break; } }
  save.rough[row.tier] = (save.rough[row.tier] || 0) + row.n;
  save.dust = (save.dust || 0) + row.dust;
  return { rank: row.rank, tier: row.tier, n: row.n, dust: row.dust };
}
const RANK_COLOR = { R: '#4da3ff', SR: '#ffc53d', SSR: '#ff4fd8', UR: '#ffffff' };

export function showGacha() {
  const node = el(`
    <div class="screen gacha-screen">
      ${topbar('SUMMON', '原石ガチャ')}
      <div class="altar" id="altar"><div class="ring"></div><div class="ring r2"></div><div class="core"></div></div>
      <div id="gres" class="center-col"></div>
      <div class="rbtns" id="gbtns">
        <button class="btn gold" id="g1">×1<span class="sub">${fmt(GACHA_COST)} コイン</span></button>
        <button class="btn primary" id="g10">×10<span class="sub">${fmt(GACHA10_COST)} コイン・大原石以上1枠確定</span></button>
      </div>
      <button class="btn dust-btn" id="gex">EXCHANGE<span class="sub">交換所 ／ ジェムダスト <b id="dustn">${fmt(save.dust || 0)}</b></span></button>
      <div class="odds">UR 3%：秘石 ／ SSR 10%：大原石 ／ SR 27%：原石 ／ R 60%：原石の欠片 ×2<br>引くたびにジェムダスト（UR 10 ／ SSR 5 ／ SR 2 ／ R 1）が貯まり、交換所で秘石・大原石・覚醒と交換できます</div>
    </div>`);
  show(node);
  $('#back', node).onclick = () => { audio.tap(); showTitle(); };
  const btns = $('#gbtns', node);
  const altar = $('#altar', node);
  const upd = () => {
    $('#g1', node).disabled = save.coins < GACHA_COST;
    $('#g10', node).disabled = save.coins < GACHA10_COST;
    $('#dustn', node).textContent = fmt(save.dust || 0);
  };
  $('#gex', node).onclick = () => { audio.tap(); showExchange(upd); };
  upd();
  const run = async (n) => {
    const cost = n === 1 ? GACHA_COST : GACHA10_COST;
    if (save.coins < cost) return;
    save.coins -= cost;
    save.stats.gacha += n;
    const results = [];
    for (let i = 0; i < n; i++) results.push(gachaRoll(n === 10 && i === 9 && !results.some((r) => rankNum(r.rank) >= 3) ? 'SSR' : 'R'));
    persist();
    refreshCoinPill();
    btns.style.visibility = 'hidden';
    const res = $('#gres', node);
    res.innerHTML = '';
    altar.classList.remove('hidden', 'burst');
    const best = results.reduce((a, b) => (rankNum(b.rank) > rankNum(a.rank) ? b : a));
    // 溜め → 最高レアの色へ変化 → 炸裂
    altar.style.setProperty('--cc', '#b45cff');
    altar.classList.add('charge');
    audio.drumroll(1.2);
    await wait(700);
    altar.style.setProperty('--cc', RANK_COLOR[best.rank]);
    await wait(rankNum(best.rank) >= 3 ? 900 : 500);
    altar.classList.remove('charge');
    altar.classList.add('burst');
    const fl = el('<div class="flash"></div>');
    node.appendChild(fl);
    setTimeout(() => fl.remove(), 800);
    audio.capsule(rankNum(best.rank));
    haptic();
    await wait(300);
    altar.classList.add('hidden');
    if (n === 1) {
      res.appendChild(el(gachaCardHTML(results[0], true)));
    } else {
      const wrap = el('<div class="gacha-result"></div>');
      res.appendChild(wrap);
      for (let i = 0; i < results.length; i++) {
        const c = el(gachaCardHTML(results[i], false));
        c.style.animationDelay = i * 0.1 + 's';
        wrap.appendChild(c);
        setTimeout(() => audio.cardFlip(i % 6), i * 100);
      }
      await wait(results.length * 100);
      if (rankNum(best.rank) >= 3) audio.bigWin();
    }
    btns.style.visibility = '';
    upd();
    getApp().checkMetaAchievements && getApp().checkMetaAchievements();
    refreshCoinPill();
  };
  $('#g1', node).onclick = () => run(1);
  $('#g10', node).onclick = () => run(10);
}
const rankNum = (r) => ({ R: 1, SR: 2, SSR: 3, UR: 4 })[r] || 0;
function gachaCardHTML(r, big) {
  const R = ROUGH[r.tier];
  const icon = roughIcon(r.tier, R.color, big ? 120 : 72);
  const name = `${R.name}${r.n > 1 ? ` ×${r.n}` : ''}`;
  if (big) {
    return `<div class="gacha-big"><span class="rarbadge r-${r.rank}" style="font-size:16px;line-height:22px;padding:0 10px">${r.rank}</span><img src="${icon}"><div class="gname">${name}</div>
      <div class="hint">ジェムダスト +${r.dust}</div></div>`;
  }
  return `<div class="gcard r-${r.rank}"><span class="rarbadge r-${r.rank}">${r.rank}</span><img src="${icon}"><div class="gn">${name}</div></div>`;
}

// ------------------------------------------------------------------ 交換所
function showExchange(onClose) {
  const ov = el(`<div class="screen dim at-over">
    <div class="panel exch">
      <div class="exch-head"><span>EXCHANGE <small>交換所</small></span><span class="dustv">ジェムダスト <b id="xd"></b></span></div>
      <div id="xl"></div>
      <button class="btn" id="xok">閉じる</button>
    </div></div>`);
  const render = () => {
    $('#xd', ov).textContent = fmt(save.dust || 0);
    const xl = $('#xl', ov);
    xl.innerHTML = '';
    const row = (icon, name, sub, cost, can, fn) => {
      const r = el(`<div class="exch-row"><img src="${icon}"><div class="xb"><div class="xn">${name}</div><div class="xs">${sub}</div></div>
        <button class="btn small gold" ${can && (save.dust || 0) >= cost ? '' : 'disabled'}>${cost}</button></div>`);
      $('button', r).onclick = () => {
        if ((save.dust || 0) < cost || !can) return;
        save.dust -= cost;
        fn();
        persist();
        audio.levelUp();
        haptic();
        render();
      };
      xl.appendChild(r);
    };
    for (const t of ['mystic', 'large']) {
      row(roughIcon(t, ROUGH[t].color, 72), ROUGH[t].name, `所持 ${save.rough[t] || 0}`, EXCHANGE[t], true, () => { save.rough[t] = (save.rough[t] || 0) + 1; });
    }
    xl.appendChild(el('<div class="exch-label">覚醒（攻撃力 +5% ／ 最大 5 段階）</div>'));
    for (const id of CHAR_IDS) {
      if (!save.unlocked[id]) continue;
      const aw = save.awaken[id] || 0;
      row(gemIcon(id, 72), GEMS[id].jp, aw >= AWAKEN_MAX ? '覚醒 MAX' : `覚醒 ★${aw} → ★${aw + 1}`, EXCHANGE.awaken, aw < AWAKEN_MAX, () => { save.awaken[id] = aw + 1; });
    }
  };
  render();
  screens().appendChild(ov);
  $('#xok', ov).onclick = () => { audio.tap(); ov.remove(); if (onClose) onClose(); };
}

// ================================================================== 図鑑
export function showZukan(tab = 'gems') {
  const node = el(`
    <div class="screen">
      ${topbar(tab === 'trophy' ? 'RECORDS' : 'ARCHIVE', tab === 'trophy' ? '実績' : '図鑑', '<div style="width:44px"></div>')}
      <div class="tabs">
        <button class="tab ${tab === 'gems' ? 'on' : ''}" data-t="gems">武器</button>
        <button class="tab ${tab === 'charms' ? 'on' : ''}" data-t="charms">チャーム</button>
        <button class="tab ${tab === 'enemies' ? 'on' : ''}" data-t="enemies">敵</button>
        <button class="tab ${tab === 'arts' ? 'on' : ''}" data-t="arts">秘宝</button>
        <button class="tab ${tab === 'stages' ? 'on' : ''}" data-t="stages">ステージ</button>
        <button class="tab ${tab === 'trophy' ? 'on' : ''}" data-t="trophy">実績</button>
      </div>
      <div class="zlist" id="zl"></div>
    </div>`);
  show(node);
  $('#back', node).onclick = () => { audio.tap(); showTitle(); };
  node.querySelectorAll('.tab').forEach((b) => (b.onclick = () => { audio.tap(); showZukan(b.dataset.t); }));
  const zl = $('#zl', node);
  if (tab === 'gems') {
    for (const id of WEAPON_IDS) {
      const w = WEAPONS[id];
      const g = GEMS[w.gem];
      const seen = save.seen.weapons[id] || save.unlocked[id];
      const evoSeen = save.seen.evos[id];
      zl.appendChild(el(`<div class="zitem ${seen ? '' : 'unk'}">
        <img src="${gemIcon(w.gem, 96)}">
        <div><div class="zname">${g.jp}<span class="en">${g.en}</span></div>${wordTag(w.gem)}
          <div class="ztext"><b>${seen ? w.name : '???'}</b> — ${seen ? w.desc : '未発見'}</div>
          <div class="ztext">${seen ? g.lore : ''}</div>
          <div class="zevo">EVOLUTION：${evoSeen ? w.evo.name : '???'}（Lv${WEAPON_MAX} ＋ ${GEMS[w.evo.with].jp}）</div>
        </div></div>`));
    }
  } else if (tab === 'charms') {
    for (const id of PASSIVE_IDS) {
      const p = PASSIVES[id];
      const g = GEMS[p.gem];
      const seen = save.seen.passives[id];
      const evoFor = WEAPON_IDS.filter((w) => WEAPONS[w].evo.with === id).map((w) => WEAPONS[w].name);
      zl.appendChild(el(`<div class="zitem ${seen ? '' : 'unk'}">
        <img src="${gemIcon(p.gem, 96)}">
        <div><div class="zname">${g.jp}<span class="en">${g.en}</span></div>${wordTag(p.gem)}
          <div class="ztext">${seen ? `${p.t}（最大Lv${p.max}）` : '未発見'}</div>
          <div class="ztext">${seen ? g.lore || '' : ''}</div>
          ${evoFor.length ? `<div class="zevo">${evoFor.join('・')} の進化素材</div>` : ''}
        </div></div>`));
    }
  } else if (tab === 'enemies') {
    for (const id of Object.keys(ENEMIES)) {
      const e = ENEMIES[id];
      if (e.prop || e.segment) continue;
      const seen = save.seen.enemies[id];
      const spr = enemySprite(e.sprite || id, Math.min(e.r, 40), 0, false, e.tint);
      zl.appendChild(el(`<div class="zitem ${seen ? '' : 'unk'}">
        <img src="${spr.toDataURL()}">
        <div><div class="zname">${seen ? e.name : '???'} ${e.boss ? '<span class="rarbadge r-SSR">BOSS</span>' : ''}</div>
          <div class="ztext">${seen ? e.desc : '未遭遇'}</div>
          <div class="ztext muted">撃破数 <b style="color:#fff">${fmt(save.kills[id] || 0)}</b></div>
        </div></div>`));
    }
  } else if (tab === 'arts') {
    for (const a of ARTIFACTS) {
      const ok = artifactUnlocked(a.id);
      const ach = ACHIEVEMENTS.find((x) => x.id === a.ach);
      zl.appendChild(el(`<div class="zitem ${ok ? '' : 'unk'}">
        <img src="${artifactIcon(a.id, 96)}" style="${ok ? '' : 'filter:grayscale(1) brightness(.4)'}">
        <div><div class="zname">${a.no}　${ok ? a.name : '???'}<span class="en">${a.en}</span></div>
          <div class="ztext">${ok ? a.desc : '未解放'}</div>
          ${ok ? '' : `<div class="zevo">解放条件：${ach ? ach.t : '???'}</div>`}
        </div></div>`));
    }
  } else if (tab === 'stages') {
    for (const st of STAGES) {
      const rec = stageRec(st.id);
      const open = stageUnlocked(st);
      const bosses = st.events.filter((e) => e.type === 'boss').map((e) => (save.seen.enemies[e.enemy] ? ENEMIES[e.enemy].name : '???'));
      zl.appendChild(el(`<div class="zitem ${open ? '' : 'unk'}" style="border-left:3px solid ${st.pal.accent}">
        <div><div class="zname">STAGE ${st.no}　${open ? st.name : '???'}<span class="en">${st.en}</span></div>
          <div class="ztext">${open ? st.desc : '未解放'}</div>
          <div class="ztext muted">ギミック：${open ? st.hazardText : '???'} ／ ボス：${bosses.join(' → ')}</div>
          <div class="zevo">${rec.cleared ? `クリア済み ・ 最高HEAT ${rec.heat || 0} ・ 最長 ${fmtTime(rec.best || 0)}` : rec.best ? `最長 ${fmtTime(rec.best)}` : '未挑戦'}</div>
        </div></div>`));
    }
  } else {
    const done = ACHIEVEMENTS.filter((a) => save.achievements[a.id]).length;
    zl.appendChild(el(`<div class="hint">${done} / ${ACHIEVEMENTS.length} 達成</div>`));
    for (const a of ACHIEVEMENTS) {
      const ok = save.achievements[a.id];
      zl.appendChild(el(`<div class="zitem ${ok ? 'done' : ''}">
        <div class="trophy">${ok ? '◆' : '◇'}</div>
        <div><div class="zname">${a.name}</div><div class="ztext">${a.t}</div>
        <div class="zevo">報酬 ${fmt(a.coins)} コイン${a.unlock ? ` ＋ ${GEMS[a.unlock].jp} 解放` : ''}</div></div></div>`));
    }
  }
}

// ================================================================== 設定
function lastBackupText() {
  if (!save.lastBackup) return '最終：なし';
  const d = Math.floor((Date.now() - save.lastBackup) / 86400000);
  return '最終：' + (d <= 0 ? '今日' : `${d}日前`);
}

function setupBackup(node) {
  const out = $('#bkout', node), inp = $('#bkin', node), file = $('#bkfile', node);
  const done = () => {
    save.lastBackup = Date.now();
    persist();
    $('#bklast', node).textContent = lastBackupText();
    audio.coin();
  };
  out.onclick = async () => {
    audio.tap();
    const prev = save.lastBackup;
    save.lastBackup = Date.now(); // 書き出すデータにも記録しておく
    const text = exportSave();
    save.lastBackup = prev;
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const name = `jewel-survivor-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
    // iPhone：共有メニューから「"ファイル"に保存」
    for (const type of ['application/json', 'text/plain']) {
      const f = new File([text], name, { type });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        try {
          await navigator.share({ files: [f] });
          done();
        } catch (e) { /* キャンセル */ }
        return;
      }
    }
    // 共有できない環境：ダウンロード
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    done();
  };
  inp.onclick = () => { audio.tap(); file.value = ''; file.click(); };
  file.onchange = async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    let data;
    try {
      data = parseBackup(await f.text());
    } catch (e) {
      alert('読み込めませんでした。\n' + (e.message.includes('JEWEL') ? e.message : 'ファイルが壊れているか、形式が違います。'));
      return;
    }
    const clears = Object.values(data.stages || {}).filter((x) => x && x.cleared).length;
    const chars = Object.values(data.unlocked || {}).filter(Boolean).length;
    const when = data.lastBackup ? new Date(data.lastBackup).toLocaleString('ja-JP') : '不明';
    const msg = `このバックアップで現在のデータを上書きします。\n\n書き出し日時：${when}\nコイン：${fmt(data.coins)}\nクリア済みステージ：${clears}\n解放ジュエル：${chars}\n\nよろしいですか？`;
    if (!confirm(msg)) return;
    const login = { ...save.login }; // ログインボーナスを二重に受け取れないよう、今の受け取り状況は引き継ぐ
    importSave(data);
    save.login = login;
    persist();
    audio.applyVolume();
    audio.levelUp();
    showTitle();
    banner('LOADED', 'item', 'バックアップを読み込みました');
  };
}

export function showSettings(back, asOverlay) {
  const node = el(`
    <div class="screen ${asOverlay ? 'dim' : ''}">
      ${topbar('SETTINGS', '設定', '<div style="width:44px"></div>')}
      <div class="panel">
        <div class="setting"><span>BGM</span><input type="range" min="0" max="1" step="0.05" value="${save.settings.bgm}" id="bgm"></div>
        <div class="setting"><span>効果音</span><input type="range" min="0" max="1" step="0.05" value="${save.settings.sfx}" id="sfx"></div>
        <div class="setting"><span>ダメージ表示</span><button class="switch ${save.settings.dmgNum ? 'on' : ''}" data-k="dmgNum"></button></div>
        <div class="setting"><span>画面の揺れ</span><button class="switch ${save.settings.shake ? 'on' : ''}" data-k="shake"></button></div>
        <div class="setting"><span>振動（iOS 18以降）</span><button class="switch ${save.settings.haptic ? 'on' : ''}" data-k="haptic"></button></div>
        ${asOverlay ? '' : '<div class="setting"><span>セーブデータ削除</span><button class="btn small" id="reset">RESET</button></div>'}
      </div>
      ${asOverlay ? '' : `<div class="panel backup">
        <div class="bk-head"><span>バックアップ</span><small id="bklast">${lastBackupText()}</small></div>
        <div class="bk-btns">
          <button class="btn small" id="bkout">書き出す</button>
          <button class="btn small" id="bkin">読み込む</button>
          <input type="file" id="bkfile" accept=".json,application/json,text/plain" hidden>
        </div>
        <div class="bk-note">書き出したファイルは共有メニューの「"ファイル"に保存」で iCloud Drive に保存できます。</div>
      </div>`}
      <div class="credit" style="margin-top:14px">Safari の共有メニュー →「ホーム画面に追加」で全画面プレイできます</div>
    </div>`);
  if (asOverlay) screens().appendChild(node); else show(node);
  $('#back', node).onclick = () => { audio.tap(); persist(); if (asOverlay) node.remove(); if (back) back(); };
  $('#bgm', node).oninput = (e) => { save.settings.bgm = +e.target.value; audio.applyVolume(); };
  $('#sfx', node).oninput = (e) => { save.settings.sfx = +e.target.value; audio.applyVolume(); audio.coin(); };
  node.querySelectorAll('.switch').forEach((sw) => (sw.onclick = () => {
    const k = sw.dataset.k;
    save.settings[k] = !save.settings[k];
    sw.classList.toggle('on', save.settings[k]);
    audio.tap();
    if (k === 'haptic') haptic();
    persist();
  }));
  if (!asOverlay) setupBackup(node);
  const reset = $('#reset', node);
  if (reset) {
    let n = 0;
    reset.onclick = () => {
      n++;
      if (n === 1) { reset.textContent = '本当に？'; return; }
      if (n === 2) { reset.textContent = 'もう一度で削除'; return; }
      resetSave();
      audio.gameOver();
      showTitle();
    };
  }
}

// ================================================================== HUD
const H = {};
let lastSlots = '', lastCoins = -1, lastKills = -1, lastCombo = 0, lastLv = -1;
export function hudShow(on) {
  $('#hud').classList.toggle('hidden', !on);
  if (on) {
    Object.assign(H, {
      xp: $('#xpfill'), lv: $('#lvtext'), timer: $('#timer'), kills: $('#kills'), coins: $('#coins'),
      coinstat: $('#coinstat'), slots: $('#slots'), fever: $('#feverfill'), combo: $('#combo'), comboB: $('#combo b'),
      boss: $('#bossbar'), bossFill: $('#bossbar .bfill'), bossName: $('#bossbar .bname'), hud: $('#hud'),
    });
    lastSlots = ''; lastCoins = -1; lastKills = -1; lastCombo = 0; lastLv = -1;
    H.boss.classList.add('hidden');
    H.hud.classList.remove('fever');
    H.combo.classList.add('hidden');
  }
}
export function hud(g) {
  H.xp.style.transform = `scaleX(${Math.min(1, g.xp / g.xpNext)})`;
  if (g.level !== lastLv) { H.lv.textContent = `LV ${g.level}`; lastLv = g.level; }
  const t = fmtTime(g.time);
  if (H.timer.textContent !== t) H.timer.textContent = t;
  if (g.kills !== lastKills) { H.kills.textContent = fmt(g.kills); lastKills = g.kills; }
  if (g.coins !== lastCoins) {
    H.coins.textContent = fmt(g.coins);
    if (lastCoins >= 0) { H.coinstat.classList.remove('bump'); void H.coinstat.offsetWidth; H.coinstat.classList.add('bump'); }
    lastCoins = g.coins;
  }
  const key = g.weapons.map((w) => w.id + w.level + (w.evolved ? 'e' : '')).join() + '|' + g.passives.map((p) => p.id + p.level).join() + '|' + g.arts.join();
  if (key !== lastSlots) {
    lastSlots = key;
    const empty = (n, max) => '<div class="slotico empty"></div>'.repeat(Math.max(0, max - n));
    H.slots.innerHTML = g.weapons.map((w) => `<div class="slotico ${w.evolved ? 'evo' : ''}"><img src="${gemIcon(WEAPONS[w.id].gem, 48)}"><b>${w.evolved ? '★' : w.level}</b></div>`).join('') + empty(g.weapons.length, MAX_WEAPONS) +
      '<i style="grid-column:1/-1;height:0"></i>' +
      g.passives.map((p) => `<div class="slotico"><img src="${gemIcon(PASSIVES[p.id].gem, 48)}"><b>${p.level}</b></div>`).join('') + empty(g.passives.length, MAX_CHARMS) +
      (g.arts.length ? '<i style="grid-column:1/-1;height:0"></i>' + g.arts.map((id) => `<div class="slotico art"><img src="${artifactIcon(id, 48)}"></div>`).join('') : '');
  }
  const f = g.feverT > 0 ? g.feverT / 10 : g.feverGauge / g.feverNeed;
  H.fever.style.transform = `scaleX(${Math.min(1, f)})`;
  if (g.combo >= 5) {
    H.combo.classList.remove('hidden');
    if (g.combo !== lastCombo) {
      H.comboB.textContent = g.combo;
      H.combo.classList.remove('pop'); void H.combo.offsetWidth; H.combo.classList.add('pop');
      H.combo.classList.toggle('hot', g.combo >= 100);
    }
  } else H.combo.classList.add('hidden');
  lastCombo = g.combo;
  if (g.boss && g.boss.alive) H.bossFill.style.transform = `scaleX(${Math.max(0, g.boss.hp / g.boss.maxHp)})`;
}
export function bossBar(e) {
  if (!e) { H.boss.classList.add('hidden'); return; }
  H.boss.classList.remove('hidden');
  H.bossName.textContent = ENEMIES[e.type].name;
}
export function feverUI(on) {
  H.hud.classList.toggle('fever', on);
  if (on) banner('FEVER', 'fever', '10秒間 与ダメージ×1.5 ／ 経験値×2');
}
export function comboBanner(n) {
  banner(`${n} COMBO`, 'combo');
  audio.milestone();
}
export function coinPop() { /* HUD の bump で表現 */ }

// ------------------------------------------------------------------ バナー / トースト
export function banner(text, kind = '', sub = '') {
  const box = $('#banners');
  while (box.children.length >= 2) box.firstChild.remove();
  const b = el(`<div class="banner ${kind}"></div>`);
  b.textContent = text;
  if (sub) { const s = document.createElement('small'); s.textContent = sub; b.appendChild(s); }
  box.appendChild(b);
  setTimeout(() => b.remove(), kind === 'warning' ? 2500 : 2300);
}
export function toast(title, sub, label = 'ACHIEVEMENT UNLOCKED') {
  const box = $('#toasts');
  const t = el('<div class="toast"><span class="label"></span><span class="tt"></span><small></small></div>');
  $('.label', t).textContent = label;
  $('.tt', t).textContent = title;
  $('small', t).textContent = sub;
  box.appendChild(t);
  while (box.children.length > 3) box.firstElementChild.remove(); // 同時に出すのは 3 件まで
  audio.milestone();
  setTimeout(() => t.remove(), 3300);
}

// ================================================================== レベルアップ
// カードの目印：図鑑未登録 / 進化との関係
const T_NEW = '<span class="ctag2 t-new">図鑑未登録</span>';
function evoTagsForCharm(g, id, owned) {
  const ws = g.weapons.filter((w) => !w.evolved && WEAPONS[w.id].evo.with === id).map((w) => WEAPONS[w.id].name);
  if (!ws.length) return '';
  return ws.map((n) => `<span class="ctag2 ${owned ? 't-pair' : 't-evo'}">${owned ? '所持済・' : ''}進化素材：${n}</span>`).join('');
}
function evoTagForWeapon(g, def) {
  const has = g.hasPassive(def.evo.with);
  const cj = GEMS[def.evo.with].jp;
  return has
    ? `<span class="ctag2 t-evo">進化チャーム所持：${cj}</span>`
    : `<span class="ctag2 t-plain">進化：Lv${WEAPON_MAX} ＋ ${cj}</span>`;
}

function choiceInfo(g, c) {
  if (c.type === 'wnew' || c.type === 'wup' || c.type === 'evo') {
    const def = WEAPONS[c.id];
    const gem = GEMS[def.gem];
    const word = `${gem.jp}「${gem.word}」`;
    if (c.type === 'wnew') {
      const tags = (save.seen.weapons[c.id] ? '' : T_NEW) + evoTagForWeapon(g, def);
      return { icon: gemIcon(def.gem, 96), name: def.name, lv: 'NEW', desc: def.desc, word, rar: g.hasPassive(def.evo.with) ? 'SR' : 'R', tags };
    }
    if (c.type === 'evo') {
      return { icon: gemIcon(def.gem, 96), name: def.evo.name, lv: 'EVOLUTION', desc: def.evo.desc, word: `${def.name} ＋ ${GEMS[def.evo.with].jp}`, rar: 'UR', tags: save.seen.evos[c.id] ? '' : T_NEW };
    }
    const w = g.getWeapon(c.id);
    const next = Math.min(WEAPON_MAX, w.level + (c.double ? 2 : 1));
    // 表示するダメージ値はバランス倍率込みの実数に
    const real = (t) => t.replace(/ダメージ \+(\d+)/g, (_, n) => `ダメージ +${Math.round(n * (def.dmgMul || 1))}`);
    let desc = real(def.levels[w.level - 1].t);
    if (c.double && def.levels[w.level]) desc += ' ／ ' + real(def.levels[w.level].t);
    return { icon: gemIcon(def.gem, 96), name: def.name, lv: `LV ${w.level} → ${next}${next >= WEAPON_MAX ? ' MAX' : ''}`, desc, word, rar: c.double ? 'SSR' : next >= WEAPON_MAX ? 'SR' : 'N', tags: evoTagForWeapon(g, def) };
  }
  if (c.type === 'pnew' || c.type === 'pup') {
    const P = PASSIVES[c.id];
    const gem = GEMS[P.gem];
    const word = `ジュエルパワー「${gem.word}」`;
    if (c.type === 'pnew') {
      const evoTags = evoTagsForCharm(g, c.id, false);
      return { icon: gemIcon(P.gem, 96), name: P.name, lv: 'NEW', desc: P.t, word, rar: evoTags ? 'SR' : 'R', tags: (save.seen.passives[c.id] ? '' : T_NEW) + evoTags };
    }
    const p = g.getPassive(c.id);
    const next = Math.min(P.max, p.level + (c.double ? 2 : 1));
    return { icon: gemIcon(P.gem, 96), name: P.name, lv: `LV ${p.level} → ${next}`, desc: P.t + (c.double ? ' ×2' : ''), word, rar: c.double ? 'SSR' : 'N', tags: evoTagsForCharm(g, c.id, true) };
  }
  if (c.type === 'coins') return { icon: coinIcon(96), name: 'コイン', lv: '', desc: `${c.value} コイン獲得`, word: '', rar: 'N' };
  return { icon: gemIcon('garnet', 96), name: '全回復', lv: '', desc: 'HPを全回復', word: '', rar: 'N' };
}

// ------------------------------------------------------------------ 秘宝の選択
// ids から 1 つ選ぶ（「選ばない」も選べる）。cb(id | null)
function pickArtifact(ids, cb, isStart) {
  const ov = el(`<div class="screen dim art-screen">
    <div class="rays"></div>
    <div class="big-title prism-text">ARTIFACT</div>
    <div class="sub-title">${isStart ? '持ち込む秘宝を選択' : '秘宝を1つ選択'}</div>
    ${isStart ? '<button class="btn" id="anone">選ばない</button>' : ''}
    <div class="cards" id="acards"></div>
    ${isStart ? '' : '<button class="btn" id="anone">選ばない</button>'}
  </div>`);
  if (isStart) ov.classList.add('scroll');
  const box = $('#acards', ov);
  ids.forEach((id, i) => {
    const a = ARTIFACT_BY_ID[id];
    const card = el(`<button class="card r-SSR art-card">
      <img src="${artifactIcon(a.id, 96)}">
      <div class="cbody"><div class="clv">${a.no} ・ ${a.en}</div><div class="cname">${a.name}</div><div class="cdesc">${a.desc}</div></div>
    </button>`);
    card.style.animationDelay = i * 0.08 + 's';
    card.onclick = () => { audio.select(); haptic(); ov.remove(); cb(id); };
    box.appendChild(card);
  });
  $('#anone', ov).onclick = () => { audio.tap(); ov.remove(); cb(null); };
  screens().appendChild(ov);
  guard(box, 450);
}
// 中ボス撃破時の秘宝の宝箱：未所持から 3 つ
export function artifactChoice(g, done) {
  const pool = g.artifactChoices();
  const ids = [];
  while (ids.length < 3 && pool.length) ids.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  audio.bigWin();
  pickArtifact(ids, (id) => { if (id) g.addArtifact(id); done(); }, false);
}

export function levelUp(g, done) {
  haptic();
  const node = el(`
    <div class="screen dim lvl-screen">
      <div class="rays"></div>
      <div class="big-title prism-text">LEVEL UP</div>
      <div class="sub-title"><b>LV ${g.level - g.pendingLevels}</b>　強化を1つ選択</div>
      <div class="cards" id="cards"></div>
      <div class="lvl-actions"><button class="btn small" id="reroll"></button><button class="btn small" id="skip"></button><button class="btn small" id="banish"></button></div>
      <div class="banish-hint">除外する候補をタップ（このランでは二度と出なくなります）</div>
    </div>`);
  screens().appendChild(node);
  const cardsEl = $('#cards', node);
  const rr = $('#reroll', node), sk = $('#skip', node), bn = $('#banish', node);
  let locked = false;
  let banishMode = false;
  let cur = [];
  // バニッシュ：その武器・チャームをこのランの候補から外し、カードを消す
  const banish = (c) => {
    if (c.type === 'evo' || g.banishes <= 0) return;
    g.banishes--;
    g.banished.add(c.id);
    audio.whoosh();
    haptic();
    banishMode = false;
    let next = cur.filter((x) => x !== c);
    if (!next.some((x) => x.type !== 'heal25')) next = g.rollChoices();
    render(next);
  };
  const render = (choices) => {
    cur = choices;
    cardsEl.innerHTML = '';
    node.classList.toggle('banishing', banishMode);
    node.classList.toggle('many', choices.length >= 5); // 選択肢が多いときは詰めて表示
    choices.forEach((c, i) => {
      if (c.type === 'heal25') {
        const p = g.player;
        const v = Math.min(Math.round(p.maxHp * 0.25), Math.ceil(p.maxHp - p.hp));
        const card = el(`<button class="card slim"><span class="heal-ico">＋</span><span class="cname">HP 25% 回復</span><span class="hv">${v > 0 ? `+${v} HP` : 'HP 満タン'}</span></button>`);
        card.style.animationDelay = i * 0.07 + 's';
        card.onclick = () => {
          if (locked || banishMode) return;
          locked = true;
          audio.heal();
          haptic();
          cardsEl.querySelectorAll('.card').forEach((x) => x.classList.add(x === card ? 'chosen' : 'notchosen'));
          g.applyChoice(c);
          setTimeout(() => { node.remove(); done(); }, 420);
        };
        cardsEl.appendChild(card);
        return;
      }
      const info = choiceInfo(g, c);
      const card = el(`<button class="card r-${info.rar}">
        <img src="${info.icon}">
        <div class="cbody"><div class="clv">${info.lv}</div><div class="cname">${info.name}</div>
          ${info.tags ? `<div class="ctags">${info.tags}</div>` : ''}
          <div class="cdesc">${info.desc}</div><div class="cword">${info.word}</div></div>
        <span class="ctag rarbadge r-${info.rar}">${info.rar}</span>
        ${c.double ? '<span class="cdouble">LUCKY ×2</span>' : ''}
      </button>`);
      card.style.animationDelay = i * 0.07 + 's';
      setTimeout(() => audio.cardFlip(i), i * 70);
      card.onclick = () => {
        if (locked) return;
        if (banishMode) { banish(c); return; }
        locked = true;
        audio.select();
        haptic();
        cardsEl.querySelectorAll('.card').forEach((x) => x.classList.add(x === card ? 'chosen' : 'notchosen'));
        const evolved = g.applyChoice(c);
        setTimeout(() => {
          node.remove();
          if (evolved) evolveScene(evolved, done);
          else done();
        }, 420);
      };
      cardsEl.appendChild(card);
    });
    if (choices.some((c) => c.type === 'evo')) setTimeout(() => audio.bigWin(), 200);
    rr.textContent = `REROLL ×${g.rerolls}`;
    rr.disabled = g.rerolls <= 0 || banishMode;
    sk.textContent = `SKIP ×${g.skips}`;
    sk.disabled = g.skips <= 0 || banishMode;
    bn.textContent = banishMode ? 'CANCEL' : `BANISH ×${g.banishes}`;
    bn.disabled = !banishMode && g.banishes <= 0;
    guard(cardsEl, 480);
  };
  sk.onclick = () => {
    if (locked || g.skips <= 0) return;
    locked = true;
    g.skips--;
    audio.whoosh();
    node.remove();
    done();
  };
  bn.onclick = () => {
    if (locked) return;
    if (!banishMode && g.banishes <= 0) return;
    banishMode = !banishMode;
    audio.tap();
    node.classList.toggle('banishing', banishMode);
    render(cur);
  };
  rr.onclick = () => {
    if (locked || g.rerolls <= 0 || banishMode) return;
    g.rerolls--;
    audio.whoosh();
    render(g.rollChoices());
  };
  render(g.rollChoices());
}

// ================================================================== 進化
export function evolveScene(w, done) {
  const def = WEAPONS[w.id];
  save.seen.evos[w.id] = true;
  audio.evolve();
  haptic();
  const node = el(`
    <div class="screen dark evo-screen">
      <div class="rays"></div>
      <img class="evo-gem" src="${gemIcon(def.gem, 200)}" style="filter:drop-shadow(0 0 30px #fff) drop-shadow(0 0 60px ${gemColor(def.gem)})">
      <div class="big-title prism-text">EVOLUTION</div>
      <div class="evo-from">${def.name} ＋ ${GEMS[def.evo.with].jp}「${GEMS[def.evo.with].word}」</div>
      <div class="evo-name">${def.evo.name}</div>
      <div class="evo-desc">${def.evo.desc}</div>
      <div class="tap-hint" id="tap">TAP TO CONTINUE</div>
      <div class="flash"></div>
    </div>`);
  screens().appendChild(node);
  setTimeout(() => audio.bigWin(), 700);
  guard(node, 1300);
  setTimeout(() => { const t = $('#tap', node); if (t) t.style.opacity = 1; }, 1300);
  node.onclick = () => { audio.tap(); node.remove(); done(); };
}

// ================================================================== 宝箱
function itemIcon(c) {
  if (c.type === 'coins') return coinIcon(72);
  if (c.type === 'wup' || c.type === 'evo') return gemIcon(WEAPONS[c.id].gem, 72);
  return gemIcon(PASSIVES[c.id].gem, 72);
}
function itemLabel(g, c) {
  if (c.type === 'evo') return 'EVOLVE';
  if (c.type === 'wup') return `LV ${g.getWeapon(c.id).level}`;
  if (c.type === 'pup') return `LV ${g.getPassive(c.id).level}`;
  return 'COIN';
}

export function chest(g, big, done) {
  haptic();
  const node = el(`
    <div class="screen dim chest-screen">
      <div class="chest-msg"><div class="big-title prism-text" style="font-size:min(10vw,44px)">${big ? 'BOSS TREASURE' : 'TREASURE'}</div></div>
      <div class="chest-stage">
        <div class="chest-beam" id="beam"></div>
        <div class="chest" id="chest"><div class="body"><div class="band"></div></div><div class="lid"><div class="band"></div></div><div class="rim"></div><img class="lock" src="${gemIcon('ruby', 72)}"></div>
      </div>
      <div class="slots" id="cslots"></div>
      <div class="chest-coins" id="ccoins"></div>
      <button class="btn big primary hidden" id="ok">OK</button>
    </div>`);
  screens().appendChild(node);
  const chestEl = $('#chest', node);
  const allIcons = [...WEAPON_IDS.map((id) => gemIcon(WEAPONS[id].gem, 72)), ...PASSIVE_IDS.map((id) => gemIcon(PASSIVES[id].gem, 72))];
  (async () => {
    await wait(250);
    chestEl.classList.add('shake');
    audio.drumroll(1.0);
    await wait(1000);
    chestEl.classList.remove('shake');
    chestEl.classList.add('open');
    audio.chestOpen();
    haptic();
    const res = g.rollChest(big);
    const hasEvo = res.items.some((c) => c.type === 'evo');
    const beam = $('#beam', node);
    beam.classList.add('on');
    if (hasEvo || res.n >= 5) beam.classList.add('prism');
    const slotsEl = $('#cslots', node);
    const slots = res.items.map(() => {
      const s = el(`<div class="slot spin"><img src="${pick(allIcons)}"><div class="sl">???</div></div>`);
      slotsEl.appendChild(s);
      return s;
    });
    let tick = 0;
    const iv = setInterval(() => {
      slots.forEach((s) => { if (s.classList.contains('spin')) $('img', s).src = pick(allIcons); });
      audio.slotTick(tick++);
    }, 70);
    await wait(500);
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i], c = res.items[i];
      s.classList.remove('spin');
      s.classList.add('stop');
      if (c.type === 'evo') s.classList.add('evo');
      $('img', s).src = itemIcon(c);
      $('.sl', s).textContent = itemLabel(g, c);
      audio.cardFlip(i);
      haptic();
      await wait(c.type === 'evo' ? 600 : 330);
    }
    clearInterval(iv);
    const cc = $('#ccoins', node);
    cc.innerHTML = `${coinIco}<span></span>`;
    await countUp($('span', cc), res.coins, 700, (v) => '+' + fmt(v));
    audio.bigWin();
    const ok = $('#ok', node);
    ok.classList.remove('hidden');
    guard(ok, 400);
    ok.onclick = async () => {
      audio.tap();
      node.remove();
      const evos = res.items.filter((c) => c.type === 'evo');
      for (const e of evos) await new Promise((r) => evolveScene(g.getWeapon(e.id), r));
      done();
    };
  })();
}

// ================================================================== ポーズ
export function pauseMenu(g, onResume, onQuit) {
  const node = el(`
    <div class="screen dim" style="justify-content:center;gap:14px">
      <div class="big-title" style="animation:none;color:#fff">PAUSED</div>
      <div class="panel" style="text-align:center">
        <div class="label">LOADOUT</div>
        <div class="pause-build">
          ${g.weapons.map((w) => `<div class="slotico ${w.evolved ? 'evo' : ''}"><img src="${gemIcon(WEAPONS[w.id].gem, 64)}"><b>${w.evolved ? '★' : w.level}</b></div>`).join('')}
        </div>
        <div class="pause-build">
          ${g.passives.map((p) => `<div class="slotico"><img src="${gemIcon(PASSIVES[p.id].gem, 64)}"><b>${p.level}</b></div>`).join('')}
        </div>
        <div class="hint">${fmtTime(g.time)} ／ ${fmt(g.kills)} KILLS ／ ${fmt(g.coins)} COINS</div>
      </div>
      <button class="btn big primary" id="resume">RESUME</button>
      <div class="rbtns" style="margin:0">
        <button class="btn" id="set">設定</button>
        <button class="btn" id="quit">リタイア</button>
      </div>
    </div>`);
  screens().appendChild(node);
  $('#resume', node).onclick = () => { audio.tap(); node.remove(); onResume(); };
  $('#set', node).onclick = () => { audio.tap(); showSettings(null, true); };
  let q = 0;
  $('#quit', node).onclick = (e) => {
    q++;
    if (q === 1) { e.target.textContent = 'もう一度で確定'; return; }
    node.remove();
    onQuit();
  };
}

// ================================================================== リザルト
function roughResultHTML(got) {
  const items = ROUGH_IDS.filter((t) => got && got[t]);
  if (!items.length) return '';
  return `<div class="rrough">${items.map((t) => `<span><img src="${roughIcon(t, ROUGH[t].color, 48)}">${ROUGH[t].short} ×${got[t]}</span>`).join('')}</div>`;
}

export function results(res, cleared, extra) {
  audio.playBgm('result');
  const node = el(`
    <div class="screen dim result-screen">
      <div class="rays"></div>
      <div class="result-head">
        ${cleared ? '<div class="big-title prism-text">STAGE CLEAR</div>' : '<div class="big-title lose">GAME OVER</div>'}
        <div class="sub-title" style="margin-top:6px">STAGE ${STAGE_BY_ID[res.stageId].no}　${STAGE_BY_ID[res.stageId].name}${res.heat ? `　HEAT ${res.heat}` : ''}${res.endless ? '　ENDLESS' : ''}${res.hyper ? '　HYPER' : ''}${res.hurry ? '　HURRY' : ''}</div>
        ${extra.firstClear ? `<div class="hint" style="margin-top:6px;color:#ffe39a">初クリア報酬 ${fmt(STAGE_BY_ID[res.stageId].reward)} コイン${extra.unlocked ? ` ／ ${GEMS[extra.unlocked].jp} 解放` : ''}${extra.nextStage ? ` ／ ${extra.nextStage} 解放` : ''}</div>` : ''}
      </div>
      <div class="panel" id="rows"></div>
      <div class="rcoins">${coinIco}<span id="rc">+0</span></div>
      ${roughResultHTML(res.roughGot)}
      <div class="rbtns">
        <button class="btn big primary" id="again">RETRY</button>
        <button class="btn" id="home">TITLE</button>
      </div>
      <div class="panel newach hidden" id="ach"></div>
      <div class="panel" id="dmg" style="margin-bottom:20px"><div class="label" style="margin-bottom:4px">DAMAGE BY WEAPON</div></div>
    </div>`);
  show(node);
  guard($('.rbtns', node), 1500);
  $('#again', node).onclick = () => { audio.select(); app.startGame(res.charId, { stageId: res.stageId, heat: res.heat, endless: res.endless, hyper: res.hyper, hurry: res.hurry, artifact: save.artSel || null }); };
  $('#home', node).onclick = () => { audio.tap(); app.toTitle(); };
  const rowsEl = $('#rows', node);
  const rows = [
    ['生存時間', fmtTime(res.time), extra.newBest.time],
    ['撃破数', fmt(res.kills), extra.newBest.kills],
    ['レベル', 'LV ' + res.level, extra.newBest.level],
    ['総ダメージ', fmt(res.damage), extra.newBest.damage],
    ['最大コンボ', fmt(res.maxCombo), false],
    ['進化', String(res.evolved), false],
    ['フィーバー', String(res.fevers), false],
  ];
  rows.forEach(([k, v, nb]) => rowsEl.appendChild(el(`<div class="rrow"><span>${k}</span><b>${v}${nb ? '<span class="new">NEW RECORD</span>' : ''}</b></div>`)));
  const dmgEl = $('#dmg', node);
  const total = Math.max(1, ...Object.values(res.dmgBy));
  const sorted = Object.entries(res.dmgBy).filter(([id]) => WEAPONS[id]).sort((a, b) => b[1] - a[1]);
  for (const [id, v] of sorted) {
    const w = res.weapons.find((x) => x.id === id);
    const c = gemColor(WEAPONS[id].gem);
    const r = el(`<div class="dmgrow"><img src="${gemIcon(WEAPONS[id].gem, 48)}"><div style="flex:1"><div>${w && w.evolved ? WEAPONS[id].evo.name : WEAPONS[id].name}</div><div class="bar"><i style="background:${c};box-shadow:0 0 8px ${c}"></i></div></div><div class="num">${fmt(v)}</div></div>`);
    dmgEl.appendChild(r);
    setTimeout(() => ($('.bar i', r).style.width = (v / total) * 100 + '%'), 300);
  }
  (async () => {
    for (const r of rowsEl.querySelectorAll('.rrow')) {
      await wait(160);
      r.classList.add('show');
      audio.cardFlip(2);
    }
    await wait(250);
    await countUp($('#rc', node), extra.coinsEarned, Math.min(2000, 500 + extra.coinsEarned * 2), (v) => '+' + fmt(v));
    audio.bigWin();
    haptic();
    if (extra.newAch.length) {
      const ach = $('#ach', node);
      ach.classList.remove('hidden');
      ach.innerHTML = '<div class="label">ACHIEVEMENTS UNLOCKED</div>' +
        extra.newAch.map((a) => { const art = ARTIFACTS.find((x) => x.ach === a.id); return `<div>◆ ${a.name} <span class="muted">+${fmt(a.coins)}${a.unlock ? ` ／ ${GEMS[a.unlock].jp} 解放` : ''}${art ? ` ／ 秘宝「${art.name}」解放` : ''}</span></div>`; }).join('');
    }
  })();
}

export { clearScreens, show, el, $, topbar, gemColor, wordTag, refreshCoinPill, guard, wait, countUp };
export const getApp = () => app;
