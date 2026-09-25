// =====================================================================
//  UI：タイトル / レベルアップ / たからばこ / ガチャ / ずかん / リザルト
// =====================================================================
import {
  GEMS, WEAPONS, WEAPON_IDS, WEAPON_MAX, PASSIVES, PASSIVE_IDS, CHARACTERS, CHAR_IDS, ENEMIES, SHOP, shopCost,
  ACHIEVEMENTS, GACHA_COST, GACHA10_COST,
} from './data.js';
import { gemIcon, enemySprite } from './render.js';
import { fmt, fmtTime, pick, rand } from './util.js';
import { audio } from './audio.js';
import { save, persist, resetSave } from './save.js';

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
}

// ------------------------------------------------------------------ しんどう
let hapLabel = null, hapLast = 0;
function setupHaptic() {
  // iOS 18 の Safari は <input switch> を タップすると ブルッとする
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
function wordBadge(gemId) {
  const g = GEMS[gemId];
  const bg = g.rainbow ? 'linear-gradient(90deg,#ff9ad5,#9ad5ff,#c9a4ff)' : g.color;
  const fg = ['diamond', 'opal', 'milkyquartz', 'angelite'].includes(gemId) ? '#3a1450' : '#fff';
  return `<span class="zword" style="background:${bg};color:${fg}">「${g.word}」</span>`;
}
function coinPill() { return `<div class="coinpill" id="coinpill">🪙 <span>${fmt(save.coins)}</span></div>`; }
function refreshCoinPill() {
  const p = $('#coinpill span');
  if (p) {
    p.textContent = fmt(save.coins);
    const pill = $('#coinpill');
    pill.classList.remove('bump');
    void pill.offsetWidth;
    pill.classList.add('bump');
  }
}

// ================================================================== タイトル
export function showTitle() {
  audio.playBgm('title');
  const cid = save.selected;
  const g = GEMS[cid];
  const node = el(`
    <div class="screen title-screen">
      <div class="title-top">${coinPill()}<button class="iconbtn" id="t-set" aria-label="せってい">⚙️</button></div>
      <div class="logo">
        <div class="en">JEWEL<br>SURVIVOR</div>
        <div class="jp">ジュエル・サバイバー</div>
        <div class="tag">✨ キラキラで くすみを ぶっとばせ！ ✨</div>
      </div>
      <div class="title-hero">
        <img src="${gemIcon(cid, 160)}" alt="">
        <div class="word">${g.jp}「${g.word}」</div>
      </div>
      <div class="title-menu">
        <button class="btn big pulse" id="t-play">▶ あそぶ！</button>
        <div class="title-row">
          <button class="btn gold" id="t-shop">💎 ジュエル工房</button>
          <button class="btn rainbowbtn" id="t-gacha">🎰 ガチャ</button>
        </div>
        <div class="title-row">
          <button class="btn blue" id="t-zukan">📖 ずかん</button>
          <button class="btn purple" id="t-trophy">🏆 トロフィー</button>
        </div>
        <div class="credit">宝石ことばは サンリオ×セガトイズ『ジュエルペット』の<br>ジュエルパワーを もとにした ファンメイド ゲームです</div>
      </div>
    </div>`);
  show(node);
  const tap = (id, fn) => $(id, node).addEventListener('click', () => { audio.unlock(); audio.tap(); fn(); });
  tap('#t-play', showCharSelect);
  tap('#t-shop', showShop);
  tap('#t-gacha', showGacha);
  tap('#t-zukan', () => showZukan('gems'));
  tap('#t-trophy', () => showZukan('trophy'));
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
    <div class="screen dim" style="justify-content:center;gap:12px;text-align:center">
      <div class="rays"></div>
      <div class="lvl-title">ログイン<br>ボーナス！</div>
      <div class="lvl-sub">${L.streak}にちめ！ まいにち くると どんどん ふえる！</div>
      <div class="login-days">${Array.from({ length: 7 }, (_, i) => `<div class="lday ${i + 1 < day ? 'got' : ''} ${i + 1 === day ? 'today' : ''}"><b>${i + 1}</b><span>${i === 6 ? '🎁' : '🪙'}</span><small>${i === 6 ? 1000 : 100 + (i + 1) * 50}</small></div>`).join('')}</div>
      <div class="chest-coins">🪙 +${fmt(reward)}</div>
      <button class="btn big gold" id="lok">うけとる！</button>
    </div>`);
  screens().appendChild(node);
  guard(node, 700);
  setTimeout(() => audio.bigWin(), 300);
  $('#lok', node).onclick = () => { audio.unlock(); audio.coin(); haptic(); node.remove(); refreshCoinPill(); };
}

// ================================================================== キャラえらび
export function showCharSelect() {
  let sel = save.unlocked[save.selected] ? save.selected : 'ruby';
  const node = el(`
    <div class="screen">
      <div class="topbar"><button class="iconbtn" id="back">◀</button><h2>ジュエルを えらぼう</h2>${coinPill()}</div>
      <div class="panel" id="detail"></div>
      <div class="char-grid" id="grid"></div>
      <div class="center-col">
        <div id="endlessrow"></div>
        <button class="btn big pulse" id="go">✨ スタート！ ✨</button>
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
        <img src="${gemIcon(sel, 160)}" style="${unlocked ? '' : 'filter:brightness(0) opacity(.3)'}">
        <div>
          <div class="name">${unlocked ? g.jp : '？？？'} <span class="rarbadge r-${c.rarity}">${c.rarity}</span></div>
          ${wordBadge(sel)}
          <div class="wname">ぶき：${w.name}</div>
          <div class="perk">とくせい：${c.perk}${aw ? ` / かくせい+${aw}（こうげき+${aw * 5}%）` : ''}</div>
        </div>
      </div>
      <div class="lore">${unlocked ? g.lore : '🔒 かいほう じょうけん：' + (c.unlock || 'ガチャ')}</div>`;
    $('#go', node).disabled = !unlocked;
  };
  CHAR_IDS.forEach((id) => {
    const c = CHARACTERS[id];
    const cell = el(`<button class="char-cell ${save.unlocked[id] ? '' : 'locked'} ${id === sel ? 'sel' : ''}">
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
  if (save.stats.clears > 0) {
    const row = el(`<div class="toggle-row panel" style="padding:10px 14px"><span>♾️ エンドレス モード<br><small class="small">クイーンを たおしても つづく！</small></span><button class="switch ${save.endless ? 'on' : ''}"></button></div>`);
    $('#endlessrow', node).appendChild(row);
    const sw = $('.switch', row);
    sw.onclick = () => { save.endless = !save.endless; sw.classList.toggle('on', save.endless); audio.tap(); persist(); };
  }
  $('#go', node).onclick = () => {
    if (!save.unlocked[sel]) return;
    audio.select();
    save.selected = sel;
    persist();
    app.startGame(sel, save.stats.clears > 0 && save.endless);
  };
}

// ================================================================== ショップ
export function showShop() {
  const node = el(`
    <div class="screen">
      <div class="topbar"><button class="iconbtn" id="back">◀</button><h2>ジュエル工房</h2>${coinPill()}</div>
      <div class="hint" style="margin-bottom:10px">コインで ずっと つよくなれる！</div>
      <div class="shop-list" id="list"></div>
    </div>`);
  show(node);
  $('#back', node).onclick = () => { audio.tap(); showTitle(); };
  const list = $('#list', node);
  const render = () => {
    list.innerHTML = '';
    for (const it of SHOP) {
      const lv = save.upgrades[it.id] || 0;
      const max = lv >= it.max;
      const cost = max ? 0 : shopCost(it, lv);
      const row = el(`<div class="shop-item">
        <img src="${gemIcon(it.gem, 72)}">
        <div class="sbody"><div class="sname">${it.name} <span class="small">Lv${lv}/${it.max}</span></div>
          <div class="sdesc">${it.t}</div>
          <div class="pips">${Array.from({ length: it.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div></div>
        <button class="btn ${max ? 'gray' : 'gold'}" ${max || save.coins < cost ? 'disabled' : ''}>${max ? 'MAX' : '🪙' + fmt(cost)}</button>
      </div>`);
      $('.btn', row).onclick = () => {
        if (max || save.coins < cost) return;
        save.coins -= cost;
        save.upgrades[it.id] = lv + 1;
        persist();
        audio.levelUp();
        haptic();
        render();
        refreshCoinPill();
        const nr = list.children[SHOP.indexOf(it)];
        nr && nr.classList.add('bought');
      };
      list.appendChild(row);
    }
  };
  render();
}

// ================================================================== ガチャ
const CAP_COLORS = ['#ff9ccb', '#8fd0ff', '#ffe07a', '#b8f5c9', '#d5b8ff', '#ffc2a8'];
function gachaRoll(guarantee) {
  const r = Math.random();
  const locked = CHAR_IDS.filter((id) => !CHARACTERS[id].start);
  let rank;
  if (r < 0.03) rank = 'UR';
  else if (r < 0.13) rank = 'SSR';
  else if (r < 0.4) rank = 'SR';
  else rank = 'R';
  if (guarantee && rank === 'R') rank = 'SR';
  if (rank === 'UR' || rank === 'SSR') {
    const poolIds = locked.filter((id) => (rank === 'UR' ? CHARACTERS[id].rarity === 'UR' : CHARACTERS[id].rarity !== 'UR'));
    const id = pick(poolIds);
    if (!save.unlocked[id]) {
      save.unlocked[id] = true;
      return { rank, kind: 'char', id, isNew: true };
    }
    const aw = save.awaken[id] || 0;
    if (aw < 5) {
      save.awaken[id] = aw + 1;
      return { rank, kind: 'awaken', id, level: aw + 1 };
    }
    save.coins += 800;
    return { rank, kind: 'coins', value: 800 };
  }
  const value = rank === 'SR' ? 300 : 80;
  save.coins += value;
  return { rank, kind: 'coins', value };
}

export function showGacha() {
  const node = el(`
    <div class="screen gacha-screen">
      <div class="topbar"><button class="iconbtn" id="back">◀</button><h2>キラキラ ガチャ</h2>${coinPill()}</div>
      <div class="machine" id="machine">
        <div class="globe" id="globe"></div>
        <div class="base"><div class="knob" id="knob"></div><div class="slot-out"></div></div>
      </div>
      <div id="gres" class="center-col"></div>
      <div class="rbtns" id="gbtns">
        <button class="btn gold" id="g1">1かい<span class="sub">🪙${GACHA_COST}</span></button>
        <button class="btn rainbowbtn" id="g10">10れん！<span class="sub">🪙${fmt(GACHA10_COST)}・SRいじょう かくてい</span></button>
      </div>
      <div class="odds">UR 3%（ダイヤモンド・オパール）/ SSR 10%（ほかの ジュエル）<br>SR 27%（300コイン）/ R 60%（80コイン）<br>もってる ジュエルが でたら「かくせい」で つよくなる！</div>
    </div>`);
  show(node);
  $('#back', node).onclick = () => { audio.tap(); showTitle(); };
  const globe = $('#globe', node);
  for (let i = 0; i < 14; i++) {
    const c = el(`<div class="cap" style="left:${rand(5, 140)}px;top:${rand(60, 150)}px;background:linear-gradient(180deg,#fff 50%,${pick(CAP_COLORS)} 50%)"></div>`);
    globe.appendChild(c);
  }
  const btns = $('#gbtns', node);
  const upd = () => {
    $('#g1', node).disabled = save.coins < GACHA_COST;
    $('#g10', node).disabled = save.coins < GACHA10_COST;
  };
  upd();
  const run = async (n) => {
    const cost = n === 1 ? GACHA_COST : GACHA10_COST;
    if (save.coins < cost) return;
    save.coins -= cost;
    save.stats.gacha += n;
    const results = [];
    for (let i = 0; i < n; i++) results.push(gachaRoll(n === 10 && i === 9 && !results.some((r) => r.rank !== 'R')));
    persist();
    refreshCoinPill();
    btns.style.visibility = 'hidden';
    const res = $('#gres', node);
    res.innerHTML = '';
    // ハンドル ぐるぐる
    const machine = $('#machine', node);
    machine.classList.remove('hidden');
    $('#knob', node).style.transform = 'rotate(360deg)';
    machine.classList.add('shake');
    audio.drumroll(0.9);
    await wait(900);
    machine.classList.remove('shake');
    $('#knob', node).style.transform = '';
    const best = results.reduce((a, b) => (rankNum(b.rank) > rankNum(a.rank) ? b : a));
    const capColor = best.rank === 'UR' ? 'conic-gradient(#ff4d6d,#ffe14d,#4ade80,#38bdf8,#e879f9,#ff4d6d)' : best.rank === 'SSR' ? '#ff5fd2' : best.rank === 'SR' ? '#ffc21a' : '#8fd0ff';
    const cap = el(`<div class="capsule-drop" style="background:${capColor}"></div>`);
    machine.appendChild(cap);
    audio.tap();
    await wait(700);
    cap.classList.add('wobble');
    audio.drumroll(0.8);
    await wait(rankNum(best.rank) >= 3 ? 1300 : 800);
    cap.remove();
    machine.classList.add('hidden');
    audio.capsule(rankNum(best.rank));
    haptic();
    if (n === 1) {
      const r = results[0];
      res.appendChild(el(`<div class="gacha-big">${gachaCardHTML(r, true)}</div>`));
    } else {
      const wrap = el('<div class="gacha-result"></div>');
      res.appendChild(wrap);
      for (let i = 0; i < results.length; i++) {
        const c = el(gachaCardHTML(results[i], false));
        c.style.animationDelay = i * 0.12 + 's';
        wrap.appendChild(c);
        setTimeout(() => audio.cardFlip(i % 6), i * 120);
      }
      await wait(results.length * 120);
      if (rankNum(best.rank) >= 3) audio.bigWin();
    }
    btns.style.visibility = '';
    upd();
  };
  $('#g1', node).onclick = () => run(1);
  $('#g10', node).onclick = () => run(10);
}
const rankNum = (r) => ({ R: 1, SR: 2, SSR: 3, UR: 4 })[r] || 0;
function gachaCardHTML(r, big) {
  let icon, name;
  if (r.kind === 'coins') { icon = gemIcon('amber', 96); name = `🪙${r.value}コイン`; }
  else if (r.kind === 'char') { icon = gemIcon(r.id, 120); name = `${GEMS[r.id].jp}「${GEMS[r.id].word}」`; }
  else { icon = gemIcon(r.id, 120); name = `${GEMS[r.id].jp} かくせい★${r.level}`; }
  if (big) {
    return `<div class="gacha-big"><span class="rarbadge r-${r.rank}" style="font-size:18px">${r.rank}</span><img src="${icon}"><div class="gname">${name}</div>
      ${r.kind === 'char' ? '<div class="hint">🎉 あたらしい ジュエルを てにいれた！</div>' : ''}</div>`;
  }
  return `<div class="gcard r-${r.rank}">${r.kind === 'char' ? '<span class="gnew">NEW</span>' : ''}<span class="rarbadge r-${r.rank}">${r.rank}</span><img src="${icon}"><div class="gn">${name}</div></div>`;
}

// ================================================================== ずかん
export function showZukan(tab = 'gems') {
  const node = el(`
    <div class="screen">
      <div class="topbar"><button class="iconbtn" id="back">◀</button><h2>${tab === 'trophy' ? 'トロフィー' : 'ずかん'}</h2><div style="width:48px"></div></div>
      <div class="tabs">
        <button class="tab ${tab === 'gems' ? 'on' : ''}" data-t="gems">💎 ぶき</button>
        <button class="tab ${tab === 'charms' ? 'on' : ''}" data-t="charms">🔮 チャーム</button>
        <button class="tab ${tab === 'enemies' ? 'on' : ''}" data-t="enemies">👾 てき</button>
        <button class="tab ${tab === 'trophy' ? 'on' : ''}" data-t="trophy">🏆</button>
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
        <div><div class="zname">${g.jp}</div>${wordBadge(w.gem)}
          <div class="ztext"><b>${seen ? w.name : '？？？'}</b> … ${seen ? w.desc : 'まだ みつけていない'}</div>
          <div class="ztext">${seen ? g.lore : ''}</div>
          <div class="zevo">🌈 しんか：${evoSeen ? w.evo.name : '？？？'}（Lv${WEAPON_MAX} ＋ ${GEMS[w.evo.with].jp}）</div>
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
        <div><div class="zname">${g.jp}</div>${wordBadge(p.gem)}
          <div class="ztext">${seen ? p.t + '（さいだい Lv' + p.max + '）' : '？？？'}</div>
          ${evoFor.length ? `<div class="zevo">🌈 ${evoFor.join('・')} の しんかに つかう</div>` : ''}
        </div></div>`));
    }
  } else if (tab === 'enemies') {
    for (const id of Object.keys(ENEMIES)) {
      const e = ENEMIES[id];
      if (e.prop) continue;
      const seen = save.seen.enemies[id];
      const spr = enemySprite(id, Math.min(e.r, 40));
      zl.appendChild(el(`<div class="zitem ${seen ? '' : 'unk'}">
        <img src="${spr.toDataURL()}">
        <div><div class="zname">${seen ? e.name : '？？？'} ${e.boss ? '<span class="rarbadge r-SSR">BOSS</span>' : ''}</div>
          <div class="ztext">${seen ? e.desc : 'まだ であっていない'}</div>
          <div class="ztext">たおした かず：<b>${fmt(save.kills[id] || 0)}</b></div>
        </div></div>`));
    }
  } else {
    const done = ACHIEVEMENTS.filter((a) => save.achievements[a.id]).length;
    zl.appendChild(el(`<div class="hint">${done} / ${ACHIEVEMENTS.length} たっせい！</div>`));
    for (const a of ACHIEVEMENTS) {
      const ok = save.achievements[a.id];
      zl.appendChild(el(`<div class="zitem ${ok ? 'done' : ''}">
        <div style="font-size:36px;width:48px;text-align:center">${ok ? '🏆' : '🔒'}</div>
        <div><div class="zname">${a.name}</div><div class="ztext">${a.t}</div>
        <div class="zevo">ほうび：🪙${a.coins}${a.unlock ? ` ＋ ${GEMS[a.unlock].jp} かいほう！` : ''}</div></div></div>`));
    }
  }
}

// ================================================================== せってい
export function showSettings(back, asOverlay) {
  const node = el(`
    <div class="screen ${asOverlay ? 'dim' : ''}">
      <div class="topbar"><button class="iconbtn" id="back">◀</button><h2>せってい</h2><div style="width:48px"></div></div>
      <div class="panel">
        <div class="setting"><span>🎵 BGM</span><input type="range" min="0" max="1" step="0.05" value="${save.settings.bgm}" id="bgm"></div>
        <div class="setting"><span>🔊 こうかおん</span><input type="range" min="0" max="1" step="0.05" value="${save.settings.sfx}" id="sfx"></div>
        <div class="setting"><span>💯 ダメージ すうじ</span><button class="switch ${save.settings.dmgNum ? 'on' : ''}" data-k="dmgNum"></button></div>
        <div class="setting"><span>📳 がめん ゆれ</span><button class="switch ${save.settings.shake ? 'on' : ''}" data-k="shake"></button></div>
        <div class="setting"><span>📱 しんどう（iOS 18〜）</span><button class="switch ${save.settings.haptic ? 'on' : ''}" data-k="haptic"></button></div>
        ${asOverlay ? '' : '<div class="setting"><span>🗑 データを けす</span><button class="btn gray" id="reset" style="font-size:14px;padding:8px 14px">リセット</button></div>'}
      </div>
      <div class="credit" style="margin-top:14px">ホーム画面に 追加すると ぜんがめんで あそべるよ！<br>（Safari の 共有ボタン → ホーム画面に追加）</div>
    </div>`);
  if (asOverlay) screens().appendChild(node); else show(node);
  $('#back', node).onclick = () => { audio.tap(); persist(); if (asOverlay) node.remove(); back && back(); };
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
  const reset = $('#reset', node);
  if (reset) {
    let n = 0;
    reset.onclick = () => {
      n++;
      if (n === 1) { reset.textContent = 'ほんとに？'; return; }
      if (n === 2) { reset.textContent = 'ほんとの ほんと？'; return; }
      resetSave();
      audio.gameOver();
      showTitle();
    };
  }
}

// ================================================================== HUD
const H = {};
let lastSlots = '', lastCoins = -1, lastKills = -1, lastCombo = 0;
export function hudShow(on) {
  $('#hud').classList.toggle('hidden', !on);
  if (on) {
    Object.assign(H, {
      xp: $('#xpfill'), lv: $('#lvtext'), timer: $('#timer'), kills: $('#kills'), coins: $('#coins'),
      coinstat: $('#coinstat'), slots: $('#slots'), fever: $('#feverfill'), combo: $('#combo'), comboB: $('#combo b'),
      boss: $('#bossbar'), bossFill: $('#bossbar .bfill'), bossName: $('#bossbar .bname'), hud: $('#hud'),
    });
    lastSlots = ''; lastCoins = -1; lastKills = -1; lastCombo = 0;
    H.boss.classList.add('hidden');
    H.hud.classList.remove('fever');
    H.combo.classList.add('hidden');
  }
}
export function hud(g) {
  H.xp.style.transform = `scaleX(${Math.min(1, g.xp / g.xpNext)})`;
  H.lv.textContent = `Lv ${g.level}`;
  const t = fmtTime(g.time);
  if (H.timer.textContent !== t) H.timer.textContent = t;
  if (g.kills !== lastKills) { H.kills.textContent = fmt(g.kills); lastKills = g.kills; }
  if (g.coins !== lastCoins) {
    H.coins.textContent = fmt(g.coins);
    if (lastCoins >= 0) { H.coinstat.classList.remove('bump'); void H.coinstat.offsetWidth; H.coinstat.classList.add('bump'); }
    lastCoins = g.coins;
  }
  const key = g.weapons.map((w) => w.id + w.level + (w.evolved ? 'e' : '')).join() + '|' + g.passives.map((p) => p.id + p.level).join();
  if (key !== lastSlots) {
    lastSlots = key;
    H.slots.innerHTML = g.weapons.map((w) => `<div class="slotico ${w.evolved ? 'evo' : ''}"><img src="${gemIcon(WEAPONS[w.id].gem, 48)}"><b>${w.evolved ? '★' : w.level}</b></div>`).join('') +
      '<i style="grid-column:1/-1;height:0"></i>' +
      g.passives.map((p) => `<div class="slotico passive"><img src="${gemIcon(PASSIVES[p.id].gem, 48)}"><b>${p.level}</b></div>`).join('');
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
  H.bossName.textContent = '👑 ' + ENEMIES[e.type].name;
}
export function feverUI(on) {
  H.hud.classList.toggle('fever', on);
  if (on) banner('FEVER!!', 'fever');
}
export function comboBanner(n) {
  const words = { 50: 'ナイス！', 100: 'すごい！！', 200: 'ヤバい！！！' };
  banner(`${n} COMBO ${words[n] || 'かみ！！！'}`, 'combo');
  audio.milestone();
}
export function coinPop() { /* HUD の bump で ひょうげん */ }

// ------------------------------------------------------------------ バナー / トースト
export function banner(text, kind = '') {
  const box = $('#banners');
  while (box.children.length >= 2) box.firstChild.remove();
  const b = el(`<div class="banner ${kind}"></div>`);
  b.textContent = text;
  box.appendChild(b);
  setTimeout(() => b.remove(), kind === 'warning' ? 2500 : 2300);
}
export function toast(title, sub) {
  const box = $('#toasts');
  const t = el(`<div class="toast">🏆 ${title}<small>${sub}</small></div>`);
  box.appendChild(t);
  audio.milestone();
  setTimeout(() => t.remove(), 3300);
}

// ================================================================== レベルアップ
function choiceInfo(g, c) {
  if (c.type === 'wnew' || c.type === 'wup' || c.type === 'evo') {
    const def = WEAPONS[c.id];
    const gem = GEMS[def.gem];
    const word = `${gem.jp}「${gem.word}」`;
    if (c.type === 'wnew') return { icon: gemIcon(def.gem, 96), name: def.name, lv: 'NEW!', desc: def.desc, word, rar: 'R' };
    if (c.type === 'evo') return { icon: gemIcon(def.gem, 96), name: def.evo.name, lv: '🌈 しんか！！', desc: def.evo.desc, word: `${def.name} ＋ ${GEMS[def.evo.with].jp}`, rar: 'UR' };
    const w = g.getWeapon(c.id);
    const next = Math.min(WEAPON_MAX, w.level + (c.double ? 2 : 1));
    let desc = def.levels[w.level - 1].t;
    if (c.double && def.levels[w.level]) desc += ' ＆ ' + def.levels[w.level].t;
    if (next >= WEAPON_MAX) desc += `<br>🌈 しんか：${GEMS[def.evo.with].jp} を もってると しんか！`;
    return { icon: gemIcon(def.gem, 96), name: def.name, lv: `Lv ${w.level} → ${next}${next >= WEAPON_MAX ? ' MAX!' : ''}`, desc, word, rar: c.double ? 'SSR' : next >= WEAPON_MAX ? 'SR' : 'N' };
  }
  if (c.type === 'pnew' || c.type === 'pup') {
    const P = PASSIVES[c.id];
    const gem = GEMS[P.gem];
    const word = `${gem.jp}「${gem.word}」`;
    const evoFor = g.weapons.filter((w) => !w.evolved && WEAPONS[w.id].evo.with === c.id).map((w) => WEAPONS[w.id].name);
    const evoText = evoFor.length ? `<br>🌈 ${evoFor.join('・')} の しんかに ひつよう！` : '';
    if (c.type === 'pnew') return { icon: gemIcon(P.gem, 96), name: P.name, lv: 'NEW!', desc: P.t + evoText, word, rar: evoFor.length ? 'SR' : 'R' };
    const p = g.getPassive(c.id);
    const next = Math.min(P.max, p.level + (c.double ? 2 : 1));
    return { icon: gemIcon(P.gem, 96), name: P.name, lv: `Lv ${p.level} → ${next}`, desc: P.t + (c.double ? ' ×2' : ''), word, rar: c.double ? 'SSR' : 'N' };
  }
  if (c.type === 'coins') return { icon: gemIcon('amber', 96), name: 'コイン ぶくろ', lv: '', desc: `🪙${c.value} コイン ゲット！`, word: '', rar: 'N' };
  return { icon: gemIcon('garnet', 96), name: 'ハート かいふく', lv: '', desc: 'HP ぜんかい！', word: '', rar: 'N' };
}

export function levelUp(g, done) {
  haptic();
  const node = el(`
    <div class="screen dim lvl-screen">
      <div class="rays"></div>
      <div class="lvl-title">LEVEL UP!!</div>
      <div class="lvl-sub">Lv ${g.level - g.pendingLevels} ・ ひとつ えらんでね！</div>
      <div class="cards" id="cards"></div>
      <div class="lvl-actions"><button class="btn purple" id="reroll"></button></div>
    </div>`);
  screens().appendChild(node);
  const cardsEl = $('#cards', node);
  const rr = $('#reroll', node);
  let locked = false;
  const render = (choices) => {
    cardsEl.innerHTML = '';
    choices.forEach((c, i) => {
      const info = choiceInfo(g, c);
      const card = el(`<button class="card r-${info.rar}">
        <img src="${info.icon}">
        <div class="cbody"><div class="cname">${info.name}</div><div class="clv">${info.lv}</div>
          <div class="cdesc">${info.desc}</div><div class="cword">${info.word}</div></div>
        <span class="ctag rarbadge r-${info.rar}">${info.rar}</span>
        ${c.double ? '<span class="cdouble">ラッキー ×2！</span>' : ''}
      </button>`);
      card.style.animationDelay = i * 0.08 + 's';
      setTimeout(() => audio.cardFlip(i), i * 80);
      card.onclick = () => {
        if (locked) return;
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
    rr.textContent = `🔄 えらびなおす（のこり ${g.rerolls}）`;
    rr.disabled = g.rerolls <= 0;
    guard(cardsEl, 480);
  };
  rr.onclick = () => {
    if (locked || g.rerolls <= 0) return;
    g.rerolls--;
    audio.whoosh();
    render(g.rollChoices());
  };
  render(g.rollChoices());
}

// ================================================================== しんか
export function evolveScene(w, done) {
  const def = WEAPONS[w.id];
  save.seen.evos[w.id] = true;
  audio.evolve();
  haptic();
  const node = el(`
    <div class="screen dark evo-screen">
      <div class="rays"></div>
      <img class="evo-gem" src="${gemIcon(def.gem, 200)}">
      <div class="evo-title rainbow-text">しんか！！</div>
      <div class="evo-from">${def.name} ＋ ${GEMS[def.evo.with].jp}「${GEMS[def.evo.with].word}」</div>
      <div class="evo-name">${def.evo.name}</div>
      <div class="evo-desc">${def.evo.desc}</div>
      <div class="hint" style="margin-top:16px;opacity:0" id="tap">タップで つづける</div>
      <div class="evo-flash"></div>
    </div>`);
  screens().appendChild(node);
  setTimeout(() => audio.bigWin(), 700);
  guard(node, 1300);
  setTimeout(() => { const t = $('#tap', node); if (t) t.style.opacity = 1; }, 1300);
  node.onclick = () => { audio.tap(); node.remove(); done(); };
}

// ================================================================== たからばこ
function itemIcon(c) {
  if (c.type === 'coins') return gemIcon('amber', 72);
  if (c.type === 'wup' || c.type === 'evo') return gemIcon(WEAPONS[c.id].gem, 72);
  return gemIcon(PASSIVES[c.id].gem, 72);
}
function itemLabel(g, c) {
  if (c.type === 'evo') return 'しんか!!';
  if (c.type === 'wup') { const w = g.getWeapon(c.id); return `Lv${w.level}`; }
  if (c.type === 'pup') { const p = g.getPassive(c.id); return `Lv${p.level}`; }
  return '+コイン';
}

export function chest(g, big, done) {
  haptic();
  const node = el(`
    <div class="screen dim chest-screen">
      <div class="chest-msg">${big ? '👑 ボスの たからばこ！ 👑' : '🎁 たからばこ ゲット！'}</div>
      <div class="chest-stage">
        <div class="chest-beam" id="beam"></div>
        <div class="chest" id="chest"><div class="body"><div class="band"></div></div><div class="lid"><div class="band"></div></div><div class="rim"></div><img class="lock" src="${gemIcon('ruby', 72)}"></div>
      </div>
      <div class="slots" id="cslots"></div>
      <div class="chest-coins" id="ccoins"></div>
      <button class="btn big hidden" id="ok">やったー！</button>
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
    if (hasEvo || res.n >= 5) beam.classList.add('rainbow');
    const slotsEl = $('#cslots', node);
    const slots = res.items.map(() => {
      const s = el(`<div class="slot spin"><img src="${pick(allIcons)}"><div class="sl">???</div></div>`);
      slotsEl.appendChild(s);
      return s;
    });
    let spinning = true;
    let tick = 0;
    const iv = setInterval(() => {
      if (!spinning) return;
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
    spinning = false;
    clearInterval(iv);
    // コイン カウントアップ
    const cc = $('#ccoins', node);
    const dur = 700, t0 = performance.now();
    await new Promise((r) => {
      const step = () => {
        const t = Math.min(1, (performance.now() - t0) / dur);
        cc.textContent = '🪙 +' + fmt(res.coins * t);
        audio.countTick();
        if (t < 1) requestAnimationFrame(step); else r();
      };
      step();
    });
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
      <div class="lvl-title" style="animation:none">PAUSE</div>
      <div class="panel" style="text-align:center">
        <div style="font-weight:900">いまの ジュエル</div>
        <div class="pause-build">
          ${g.weapons.map((w) => `<div class="slotico ${w.evolved ? 'evo' : ''}"><img src="${gemIcon(WEAPONS[w.id].gem, 64)}"><b>${w.evolved ? '★' : w.level}</b></div>`).join('')}
        </div>
        <div class="pause-build">
          ${g.passives.map((p) => `<div class="slotico passive"><img src="${gemIcon(PASSIVES[p.id].gem, 64)}"><b>${p.level}</b></div>`).join('')}
        </div>
        <div class="small">⏱ ${fmtTime(g.time)} ／ 💎 ${fmt(g.kills)}たい ／ 🪙 ${fmt(g.coins)}</div>
      </div>
      <button class="btn big" id="resume">▶ つづける</button>
      <div class="rbtns" style="margin:0">
        <button class="btn blue" id="set">⚙️ せってい</button>
        <button class="btn gray" id="quit">🏳 あきらめる</button>
      </div>
    </div>`);
  screens().appendChild(node);
  $('#resume', node).onclick = () => { audio.tap(); node.remove(); onResume(); };
  $('#set', node).onclick = () => { audio.tap(); showSettings(null, true); };
  let q = 0;
  $('#quit', node).onclick = (e) => {
    q++;
    if (q === 1) { e.target.textContent = 'ほんとに？'; return; }
    node.remove();
    onQuit();
  };
}

// ================================================================== リザルト
export function results(res, cleared, extra) {
  audio.playBgm('result');
  const node = el(`
    <div class="screen dim result-screen">
      <div class="rays"></div>
      <div class="result-title ${cleared ? 'rainbow-text' : 'lose'}">${cleared ? 'STAGE CLEAR!!' : 'おつかれさま！'}</div>
      ${cleared ? '<div class="hint">🎉 ダーク・クイーンを たおして せかいに かがやきが もどった！ 🎉</div>' : '<div class="hint">くすみに まけちゃった… でも つぎは きっと かてる！</div>'}
      <div class="panel" id="rows"></div>
      <div class="rcoins" id="rc">🪙 +0</div>
      <div class="rbtns">
        <button class="btn big pulse" id="again">🔁 もういっかい！</button>
        <button class="btn blue" id="home">🏠 タイトル</button>
      </div>
      <div class="panel newach hidden" id="ach"></div>
      <div class="panel" id="dmg" style="margin-bottom:20px"><div style="font-weight:900;margin-bottom:4px">ぶきべつ ダメージ</div></div>
    </div>`);
  show(node);
  guard($('.rbtns', node), 1500);
  $('#again', node).onclick = () => { audio.select(); app.startGame(res.charId, res.endless); };
  $('#home', node).onclick = () => { audio.tap(); app.toTitle(); };
  const rowsEl = $('#rows', node);
  const rows = [
    ['⏱ いきのこった じかん', fmtTime(res.time), extra.newBest.time],
    ['💎 たおした くすみ', fmt(res.kills) + ' たい', extra.newBest.kills],
    ['⭐ レベル', 'Lv ' + res.level, extra.newBest.level],
    ['💥 そうダメージ', fmt(res.damage), extra.newBest.damage],
    ['🔥 さいだい コンボ', fmt(res.maxCombo), false],
    ['🌈 しんか', res.evolved + ' こ', false],
    ['🎉 フィーバー', res.fevers + ' かい', false],
  ];
  rows.forEach(([k, v, nb]) => rowsEl.appendChild(el(`<div class="rrow"><span>${k}</span><b>${v}${nb ? '<span class="new">NEW RECORD!</span>' : ''}</b></div>`)));
  const dmgEl = $('#dmg', node);
  const total = Math.max(1, ...Object.values(res.dmgBy));
  const sorted = Object.entries(res.dmgBy).filter(([id]) => WEAPONS[id]).sort((a, b) => b[1] - a[1]);
  for (const [id, v] of sorted) {
    const gem = GEMS[WEAPONS[id].gem];
    const w = res.weapons.find((x) => x.id === id);
    const r = el(`<div class="dmgrow"><img src="${gemIcon(WEAPONS[id].gem, 48)}"><div style="flex:1"><div>${w && w.evolved ? WEAPONS[id].evo.name : WEAPONS[id].name}</div><div class="bar"><i style="background:${gem.rainbow ? 'linear-gradient(90deg,#ff9ad5,#9ad5ff,#c9a4ff)' : gem.color}"></i></div></div><div class="num">${fmt(v)}</div></div>`);
    dmgEl.appendChild(r);
    setTimeout(() => ($('.bar i', r).style.width = (v / total) * 100 + '%'), 300);
  }
  (async () => {
    const rs = rowsEl.querySelectorAll('.rrow');
    for (const r of rs) {
      await wait(180);
      r.classList.add('show');
      audio.cardFlip(2);
    }
    await wait(250);
    const rc = $('#rc', node);
    const target = extra.coinsEarned;
    const t0 = performance.now(), dur = Math.min(2000, 500 + target * 2);
    await new Promise((resolve) => {
      const step = () => {
        const t = Math.min(1, (performance.now() - t0) / dur);
        rc.textContent = '🪙 +' + fmt(target * (1 - Math.pow(1 - t, 3)));
        audio.countTick();
        if (t < 1) requestAnimationFrame(step); else resolve();
      };
      step();
    });
    audio.bigWin();
    haptic();
    if (extra.newAch.length) {
      const ach = $('#ach', node);
      ach.classList.remove('hidden');
      ach.innerHTML = '<div style="font-weight:900">🏆 あたらしい トロフィー！</div>' +
        extra.newAch.map((a) => `<div>✨ ${a.name} <span class="small">+🪙${a.coins}${a.unlock ? ` ／ ${GEMS[a.unlock].jp} かいほう！` : ''}</span></div>`).join('');
    }
  })();
}

export { clearScreens, show, el };
