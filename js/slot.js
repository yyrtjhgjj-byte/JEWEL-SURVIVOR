// =====================================================================
//  ジュエル・スロット（コインを賭けて回す。抽選と払い戻しの計算は slot-core.js）
//  回した時点で結果を決めてセーブに書き、絵はあとから見せる（途中でアプリを閉じても結果は変わらない）
// =====================================================================
import { SLOT_BETS, SLOT_SYMS, SLOT_LINES, SLOT_JP, SLOT_FEVER, DUST_VALUE, ROUGH_VALUE, rollGrid, judge } from './slot-core.js';
import { save, persist } from './save.js';
import { gemIcon, roughIcon, coinIcon } from './render.js';
import { ROUGH } from './atelier.js';
import { fmt, rand, randi } from './util.js';
import { audio, FEVER_TEMPO } from './audio.js';
import { show, el, $, topbar, coinPill, refreshCoinPill, haptic, getApp, wait, countUp } from './ui.js';

export function slotState() {
  if (!save.slot || typeof save.slot !== 'object') save.slot = {};
  const st = save.slot;
  if (!(st.pool >= SLOT_JP.seed)) st.pool = SLOT_JP.seed;
  for (const k of ['spins', 'bet', 'best', 'jp', 'free', 'freeBet']) if (typeof st[k] !== 'number') st[k] = 0;
  return st;
}

// JP（虹色の 7 に金の縁）と ★（面取りした金の星）の絵。1 枚のキャンバスで 1 度だけ描いて使い回す
function drawSymArt() {
  const S = 160, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d'), out = {};
  // 7：斜めにした太い数字。黒の外縁 → 金の縁 → 虹色の中 → 上半分に光
  const seven = () => {
    x.beginPath();
    [[-38, -50], [42, -50], [42, -34], [2, 52], [-22, 52], [16, -32], [-38, -32]].forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
    x.closePath();
  };
  x.save();
  x.translate(S / 2 + 4, S / 2 + 2);
  x.transform(1, 0, -0.16, 1, 0, 0);
  x.lineJoin = 'round';
  seven(); x.strokeStyle = '#1a0a00'; x.lineWidth = 22; x.stroke();
  const gold = x.createLinearGradient(0, -56, 0, 56);
  gold.addColorStop(0, '#fff3b0'); gold.addColorStop(0.45, '#ffc53d'); gold.addColorStop(0.55, '#c88a10'); gold.addColorStop(1, '#ffe27a');
  seven(); x.strokeStyle = gold; x.lineWidth = 12; x.stroke();
  const pr = x.createLinearGradient(-40, -50, 40, 52);
  ['#ff2d55', '#ff8a3d', '#ffd23d', '#3fe0a0', '#3fc8ff', '#8a6dff', '#e25cff'].forEach((col, i, a) => pr.addColorStop(i / (a.length - 1), col));
  seven(); x.fillStyle = pr; x.fill();
  x.save(); seven(); x.clip();
  x.fillStyle = 'rgba(255,255,255,0.38)'; x.fillRect(-60, -60, 120, 46);
  x.restore();
  x.restore();
  out.jp = c.toDataURL();
  // ★：10 枚の三角を明るい金と暗い金で交互に塗って面取りに見せる
  x.clearRect(0, 0, S, S);
  x.save();
  x.translate(S / 2, S / 2 + 4);
  const R = 66, r = 28, pt = (k) => { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r : R; return [Math.cos(a) * rr, Math.sin(a) * rr]; };
  x.beginPath();
  for (let k = 0; k < 10; k++) { const [px, py] = pt(k); k ? x.lineTo(px, py) : x.moveTo(px, py); }
  x.closePath(); x.lineJoin = 'round'; x.strokeStyle = '#2a1600'; x.lineWidth = 12; x.stroke();
  for (let k = 0; k < 10; k++) {
    const [ax, ay] = pt(k), [bx, by] = pt(k + 1);
    x.beginPath(); x.moveTo(0, 0); x.lineTo(ax, ay); x.lineTo(bx, by); x.closePath();
    x.fillStyle = k % 2 ? '#ffe680' : '#e0a21a'; x.fill();
  }
  x.restore();
  out.star = c.toDataURL();
  c.width = c.height = 1;
  return out;
}
// 絵柄の絵（同じ絵を何度も使うので、画像の URL は 1 度だけ作る）
let symImg = null;
function symHTML(id) {
  if (!symImg) {
    symImg = {
      shard: roughIcon('shard', ROUGH.shard.color, 96),
      ruby: gemIcon('ruby', 96),
      sapphire: gemIcon('sapphire', 96),
      diamond: gemIcon('diamond', 96),
      mystic: roughIcon('mystic', ROUGH.mystic.color, 96),
      ...drawSymArt(),
    };
    for (const k of Object.keys(symImg)) {
      if (!String(symImg[k]).startsWith('data:')) continue;
      fetch(symImg[k]).then((r) => r.blob()).then((b) => { symImg[k] = URL.createObjectURL(b); }).catch(() => {});
    }
  }
  return `<img class="sl-sym s-${id}" src="${symImg[id]}" alt="">`;
}
// 当たりの列の色と、左右の番号の位置（%）。列は横 3 本（上・中・下）と斜め 2 本（左上から右下・左下から右上）
const LINE_COL = ['#ffd23d', '#ff5f8f', '#4fe0ff', '#7dff9a', '#c38bff'];
const TAB_L = [16.7, 50, 83.3, 3, 97], TAB_R = [16.7, 50, 83.3, 97, 3];
const LINE_PTS = ['0,50 300,50', '0,150 300,150', '0,250 300,250', '0,0 300,300', '0,300 300,0'];
// 列ごとの当たりの表示の位置（%）
const POP_AT = [[74, 16.7], [74, 50], [74, 83.3], [26, 30], [26, 70]];
const ROUGH_NAME = (t) => ROUGH[t].short;

// 払い戻しの表（選んでいる賭け金での額）
function payTable(bet) {
  const rows = SLOT_SYMS.filter((s) => s.pay).map((s) => {
    const p = s.pay;
    const what = p.coins ? `${coinTag()}${fmt(bet * p.coins)}` : p.dust ? `ジェムダスト ${fmt((bet * p.dust) / DUST_VALUE)}` : `${ROUGH_NAME(p.rough)} ×${fmt((bet * p.v) / ROUGH_VALUE[p.rough])}`;
    return `<div class="sl-prow"><span class="sl-p3">${symHTML(s.id).repeat(3)}</span><b>${what}</b></div>`;
  });
  rows.push(`<div class="sl-prow"><span class="sl-p3">${symHTML('jp').repeat(3)}</span><b>ジャックポット</b></div>`);
  rows.push(`<div class="sl-prow"><span class="sl-p3">${symHTML('star').repeat(3)}</span><b>どこでも 3 つでフィーバー</b></div>`);
  return rows.join('');
}
const coinTag = () => `<img class="sl-ci" src="${coinIcon(40)}" alt="">`;

// 1 本の列の払い戻し（judge と同じ計算。列ごとの表示に使う）
function lineReward(id, bet, mul) {
  const p = (SLOT_SYMS.find((x) => x.id === id) || {}).pay;
  if (id === 'jp') return 'JACKPOT';
  if (!p) return '';
  if (p.coins) return `${coinTag()}+${fmt(Math.round(bet * p.coins * mul))}`;
  if (p.dust) return `ダスト +${fmt(Math.round((bet * p.dust * mul) / DUST_VALUE))}`;
  return `${ROUGH_NAME(p.rough)} ×${fmt(Math.round((bet * p.v * mul) / ROUGH_VALUE[p.rough]))}`;
}

export function showSlot(back) {
  const st = slotState();
  const tabs = (side, at) => `<div class="sl-tabs ${side}">${at.map((y, i) => `<i data-l="${i}" style="top:${y}%;--lc:${LINE_COL[i]}">${i + 1}</i>`).join('')}</div>`;
  const node = el(`
    <div class="screen slot-screen" data-nav="jewel">
      ${topbar('SLOT', 'ジュエル・スロット', coinPill(), 'slot')}
      <div class="sl-jpbox"><span>JACKPOT</span><b id="sljp">${fmt(st.pool)}</b></div>
      <div class="sl-machine" id="slm">
        ${tabs('l', TAB_L)}
        <div class="sl-reels" id="slreels">${[0, 1, 2].map((c) => `<div class="sl-reel"><div class="sl-strip" id="slr${c}"></div></div>`).join('')}
          <svg class="sl-lines" id="sllines" viewBox="0 0 300 300" preserveAspectRatio="none"></svg>
          <div class="sl-pops" id="slpops"></div>
        </div>
        ${tabs('r', TAB_R)}
        <div class="sl-reachb" id="slreach">REACH!</div>
      </div>
      <div class="sl-res" id="slres"></div>
      <div class="panel sl-pay"><div class="sl-ph">払い戻し（1 列に 3 つ。横 3 本・斜め 2 本）</div><div id="slpay"></div>
        <p class="sl-note">フィーバーは ${SLOT_FEVER.spins} 回ただで回せて、払い戻しが ${SLOT_FEVER.mul} 倍。ジャックポットは積み立て × 賭け金 ÷ ${fmt(SLOT_BETS[SLOT_BETS.length - 1])}（いちばん高い賭けで全額）と秘石。</p></div>
      <div class="dock sl-dock">
        <div class="sl-bets" id="slbets">${SLOT_BETS.map((b, i) => `<button class="btn small sl-bet" data-i="${i}">${b >= 1e6 ? `${b / 1e6}M` : `${b / 1e3}K`}</button>`).join('')}</div>
        <div class="sl-go"><button class="btn small sl-ten" id="slten">10 回</button><button class="btn big primary" id="slgo">SPIN</button></div>
      </div>
    </div>`);
  show(node);
  let busy = false;
  // 最初の絵柄
  const first = rollGrid();
  for (let c = 0; c < 3; c++) $(`#slr${c}`, node).innerHTML = [0, 1, 2].map((r) => `<div class="sl-cell">${symHTML(first[r][c])}</div>`).join('');

  const betOf = () => SLOT_BETS[Math.min(st.bet, SLOT_BETS.length - 1)];
  const sync = () => {
    $('#sljp', node).textContent = fmt(st.pool);
    $('#slpay', node).innerHTML = payTable(st.free > 0 ? st.freeBet : betOf());
    node.querySelectorAll('.sl-bet').forEach((b) => {
      const i = +b.dataset.i;
      b.classList.toggle('on', i === st.bet);
      b.disabled = busy || st.free > 0 || save.coins < SLOT_BETS[i];
    });
    const go = $('#slgo', node), ten = $('#slten', node);
    if (st.free > 0) {
      go.innerHTML = `FEVER<small>のこり ${st.free} 回</small>`;
      go.disabled = busy;
      ten.disabled = true;
    } else {
      go.textContent = 'SPIN';
      go.disabled = busy || save.coins < betOf();
      ten.disabled = busy || save.coins < betOf();
    }
    $('#slm', node).classList.toggle('fever', st.free > 0);
    // フィーバーの間は曲を速く（ゲームのフィーバーと同じ速さ）
    audio.tempoMul = st.free > 0 ? FEVER_TEMPO : 1;
  };
  sync();

  $('#back', node).onclick = () => { if (busy) return; audio.tap(); audio.tempoMul = 1; back(); };
  node.querySelectorAll('.sl-bet').forEach((b) => (b.onclick = () => {
    if (busy) return;
    audio.select();
    st.bet = +b.dataset.i;
    persist();
    sync();
  }));

  // 前の当たりの表示を消す
  const clearWin = () => {
    $('#sllines', node).innerHTML = '';
    $('#slpops', node).innerHTML = '';
    $('#slreels', node).classList.remove('dim');
    node.querySelectorAll('.sl-cell.win').forEach((c) => c.classList.remove('win'));
    node.querySelectorAll('.sl-tabs i.on').forEach((t) => t.classList.remove('on'));
  };

  // 1 回まわす（フィーバーの残りがあればそれを使う）。fast は 10 回とフィーバーのとき
  async function spinOnce(fast) {
    const free = st.free > 0;
    const bet = free ? st.freeBet : betOf();
    if (!free && save.coins < bet) return false;
    if (free) st.free--;
    else { save.coins -= bet; st.pool += Math.round(bet * SLOT_JP.rate); }
    st.spins++;
    const grid = rollGrid();
    const res = judge(grid, bet, st.pool, free ? SLOT_FEVER.mul : 1);
    // 結果は先にセーブへ
    save.coins += res.coins + res.jp;
    save.dust = (save.dust || 0) + res.dust;
    for (const [t, n] of Object.entries(res.rough)) save.rough[t] = (save.rough[t] || 0) + n;
    if (res.jp) { st.pool = Math.max(SLOT_JP.seed, st.pool - res.jp); st.jp++; }
    if (res.fever) { st.free += SLOT_FEVER.spins; st.freeBet = bet; }
    st.best = Math.max(st.best, res.value);
    persist();
    clearWin();
    $('#slres', node).innerHTML = '';
    if (!res.jp) $('#sljp', node).textContent = fmt(st.pool);
    await spinReels(grid, fast);
    await showWin(res, bet, fast, free);
    refreshCoinPill();
    if (res.jp) $('#sljp', node).textContent = fmt(st.pool);
    if (res.jp && getApp() && getApp().checkMetaAchievements) getApp().checkMetaAchievements();
    return true;
  }

  // リールを回して止める。2 列目までで大きい当たりが見えたら、3 列目をゆっくり止める（リーチ）。
  // 動きは毎フレーム経過時間から決める（CSS の transition とタイマーだと、絵の準備などで動き出しが遅れたとき、
  // 回りきる前にタイマーが止めて最後の位置へ飛んでしまうため）。止めるのは動きが終わってから
  async function spinReels(grid, fast) {
    const cs = $('.sl-reel', node).offsetHeight / 3;
    const reach = SLOT_LINES.some((l) => {
      const a = grid[l[0][0]][l[0][1]], b = grid[l[1][0]][l[1][1]];
      return a === b && (a === 'jp' || a === 'diamond' || a === 'mystic');
    }) || grid.flat().filter((x, i) => i % 3 < 2 && x === 'star').length >= 2;
    audio.slotSpin();
    const anims = [];
    for (let c = 0; c < 3; c++) {
      const strip = $(`#slr${c}`, node), reel = strip.parentElement;
      const cur = [...strip.children].slice(-3).map((x) => x.innerHTML);
      const k = (fast ? 6 : 12) + c * (fast ? 3 : 6) + (c === 2 && reach ? (fast ? 8 : 18) : 0);
      const mid = Array.from({ length: k }, () => symHTML(SLOT_SYMS[randi(0, SLOT_SYMS.length - 1)].id));
      const fin = [0, 1, 2].map((r) => symHTML(grid[r][c]));
      strip.style.transform = 'translate3d(0,0,0)';
      strip.innerHTML = [...cur, ...mid, ...fin].map((h) => `<div class="sl-cell">${h}</div>`).join('');
      const dur = ((fast ? 0.45 : 0.85) + c * (fast ? 0.18 : 0.35) + (c === 2 && reach ? (fast ? 0.7 : 1.5) : 0)) * 1000;
      anims.push({ c, strip, reel, fin, dist: (cur.length + k) * cs, dur, done: false });
    }
    // 少しだけ行き過ぎて戻る止まり方
    const ease = (t) => { const u = t - 1; return 1 + 1.3 * u * u * u + 0.3 * u * u; };
    const land = (a) => {
      audio.slotStop(a.c);
      a.strip.style.transform = 'translate3d(0,0,0)';
      a.strip.innerHTML = a.fin.map((h) => `<div class="sl-cell">${h}</div>`).join('');
      a.reel.classList.remove('spin', 'reach');
      a.reel.classList.add('land');
      setTimeout(() => a.reel.classList.remove('land'), 220);
    };
    // 描き終わってから動かし始める
    await new Promise((r) => requestAnimationFrame(() => r()));
    for (const a of anims) a.reel.classList.add('spin');
    const t0 = performance.now();
    let reachOn = false;
    await new Promise((resolve) => {
      const tick = (now) => {
        const el2 = now - t0;
        let left = 0;
        if (reach && !reachOn && el2 > (fast ? 600 : 1300)) {
          reachOn = true;
          anims[2].reel.classList.add('reach');
          $('#slm', node).classList.add('reach');
          audio.slotReach();
        }
        for (const a of anims) {
          if (a.done) continue;
          const t = Math.min(1, el2 / a.dur);
          a.strip.style.transform = `translate3d(0,${(-a.dist * ease(t)).toFixed(1)}px,0)`;
          if (t > 0.9) a.reel.classList.remove('spin');
          if (t >= 1) { a.done = true; land(a); } else left++;
        }
        if (left && node.isConnected) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    $('#slm', node).classList.remove('reach');
  }

  // 当たりを見せる：はずれの絵を暗くし、当たりの列を 1 本ずつ色の線で引いて、その列の払い戻しを出す。
  // 合計は下の帯で数え上げ、大きい当たりは画面いっぱいに出す
  async function showWin(res, bet, fast, free) {
    const mul = free ? SLOT_FEVER.mul : 1;
    const x = res.value / bet;
    const kind = res.jp ? 'jp' : x >= 30 ? 'mega' : x >= 10 ? 'big' : '';
    if (res.lines.length) {
      $('#slreels', node).classList.add('dim');
      for (let k = 0; k < res.lines.length; k++) {
        const l = res.lines[k];
        const col = l.id === 'jp' ? '#ffffff' : LINE_COL[l.i];
        $('#sllines', node).insertAdjacentHTML('beforeend', `<g class="ln ${l.id === 'jp' ? 'jp' : ''}" style="--lc:${col}"><polyline class="g" pathLength="1" points="${LINE_PTS[l.i]}"/><polyline class="c" pathLength="1" points="${LINE_PTS[l.i]}"/></g>`);
        for (const [r, c] of SLOT_LINES[l.i]) $(`#slr${c}`, node).children[r].classList.add('win');
        node.querySelectorAll(`.sl-tabs i[data-l="${l.i}"]`).forEach((t) => t.classList.add('on'));
        const [px, py] = POP_AT[l.i];
        $('#slpops', node).insertAdjacentHTML('beforeend', `<div class="sl-pop" style="left:${px}%;top:${py}%;--lc:${col}">${lineReward(l.id, bet, mul)}</div>`);
        audio.slotLine(k);
        await wait(fast ? 160 : 420);
      }
    }
    // 下の帯：合計
    const box = $('#slres', node);
    const parts = [];
    if (res.dust) parts.push(`<span>ジェムダスト +${fmt(res.dust)}</span>`);
    for (const [t, n] of Object.entries(res.rough)) parts.push(`<span><img class="sl-ci" src="${roughIcon(t, ROUGH[t].color, 40)}" alt="">${ROUGH_NAME(t)} ×${fmt(n)}</span>`);
    const coins = res.coins + res.jp;
    if (res.value > 0) {
      box.innerHTML = `<div class="sl-rt">${free ? `<i>FEVER ×${SLOT_FEVER.mul}</i>` : ''}WIN</div>${coins ? `<div class="sl-rc">${coinTag()}<b id="slrc">+0</b></div>` : ''}${parts.length ? `<div class="sl-rx">${parts.join('')}</div>` : ''}`;
      box.className = `sl-res on ${kind}`;
      if (!kind) audio.slotWin();
    } else {
      box.innerHTML = '<div class="sl-rt">NO WIN</div>';
      box.className = 'sl-res off';
      if (!fast) audio.slotLose();
    }
    if (kind === 'jp') await jackpot(res, coins);
    else if (kind) await bigWin(kind, res, coins, bet);
    else if (coins) await countUp($('#slrc', box), coins, fast ? 250 : 650, (v) => '+' + fmt(v));
    if (kind && coins) $('#slrc', box).textContent = '+' + fmt(coins);
    if (res.fever) await feverIn();
    await wait(res.value > 0 ? (fast ? 350 : 700) : fast ? 150 : 300);
  }

  // BIG WIN・MEGA WIN・JACKPOT：画面いっぱいの光と、額の数え上げと、画面全体のコインの雨（押すと閉じる）
  function bigWin(kind, res, coins, bet) {
    return new Promise((resolve) => {
      const title = kind === 'jp' ? 'JACKPOT' : kind === 'mega' ? 'MEGA WIN' : 'BIG WIN';
      const n = kind === 'jp' ? 40 : kind === 'mega' ? 30 : 20;
      const rain = Array.from({ length: n }, () => `<img class="sl-coin" src="${coinIcon(48)}" style="left:${rand(2, 94).toFixed(1)}%;animation-delay:${rand(0, 1.2).toFixed(2)}s;animation-duration:${rand(1.2, 2).toFixed(2)}s" alt="">`).join('');
      // 数え上げるのはコイン。コインの無い当たり（秘石・ジェムダストだけ）は、その数を数え上げる（コインに直した額は出さない）
      const items = [];
      if (res.dust) items.push({ ico: '', name: 'ジェムダスト', n: res.dust });
      for (const [t, k] of Object.entries(res.rough)) items.push({ ico: `<img class="sl-ci" src="${roughIcon(t, ROUGH[t].color, 56)}" alt="">`, name: ROUGH_NAME(t), n: k });
      const main = coins ? null : items.shift();
      const head = main ? `${main.ico}<span class="sl-bn">${main.name} ×</span><b>0</b>` : `${coinTag()}<b>0</b>`;
      const rest = items.length ? `<div class="sl-bi">${items.map((it) => `<span>${it.ico}${it.name} ×${fmt(it.n)}</span>`).join('')}</div>` : '';
      const ov = el(`<div class="sl-bigov ${kind}"><div class="sl-flash"></div><div class="sl-rays"></div>${rain}
        <div class="sl-bt">${title}</div>
        <div class="sl-ba">${head}</div>${rest}
        <div class="sl-bx">×${(res.value / bet).toFixed(1)}</div></div>`);
      node.appendChild(ov);
      $('#slm', node).classList.add('shake');
      setTimeout(() => $('#slm', node).classList.remove('shake'), 600);
      if (kind === 'jp') audio.slotJackpot(); else audio.slotBig();
      haptic();
      let done = false;
      const close = () => { if (done) return; done = true; ov.classList.add('out'); setTimeout(() => ov.remove(), 260); resolve(); };
      ov.onclick = close;
      countUp($('.sl-ba b', ov), coins || (main ? main.n : 0), kind === 'jp' ? 2600 : 1800, (v) => fmt(v)).then(() => setTimeout(close, kind === 'jp' ? 1800 : 1200));
    });
  }

  // ジャックポット：サイレンと回る光 → JACKPOT の文字が 1 つずつ落ちる → 花火とコインと宝石の雨の中で額を数え上げ
  // → 額が決まると金管のファンファーレ。勝手には閉じず、画面を押すまで残る（数え上げの途中で押すと、額まで飛ばす）
  function jackpot(res, coins) {
    return new Promise((resolve) => {
      const W = 'JACKPOT';
      const gems = ['diamond', 'ruby', 'sapphire', 'emerald'];
      const rain = Array.from({ length: 46 }, (_, i) => {
        const gem = i % 4 === 3;
        const sz = gem ? rand(26, 40) : rand(24, 44);
        return `<img class="sl-coin jr" src="${gem ? gemIcon(gems[(i >> 2) % gems.length], 64) : coinIcon(48)}" style="left:${rand(0, 96).toFixed(1)}%;width:${sz.toFixed(0)}px;height:${sz.toFixed(0)}px;animation-delay:${rand(1.1, 3.2).toFixed(2)}s;animation-duration:${rand(1.4, 2.6).toFixed(2)}s" alt="">`;
      }).join('');
      const myst = res.rough.mystic || 0;
      const ov = el(`<div class="sl-bigov jp sl-jp">
        <div class="sl-beam"></div><div class="sl-beam b2"></div>
        <div class="sl-bulbs t"></div><div class="sl-bulbs b"></div><div class="sl-bulbs l"></div><div class="sl-bulbs r"></div>
        <div class="sl-rays"></div><div class="sl-fws"></div>${rain}
        <div class="sl-flash"></div>
        <div class="sl-jt">${[...W].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}</div>
        <div class="sl-ja"><img class="sl-ci" src="${coinIcon(64)}" alt=""><b>0</b></div>
        ${myst ? `<div class="sl-jm"><img class="sl-ci" src="${roughIcon('mystic', ROUGH.mystic.color, 56)}" alt="">秘石 ×${fmt(myst)}</div>` : ''}
        <div class="sl-tap">画面を押すと閉じる</div>
      </div>`);
      node.appendChild(ov);
      const slm = $('#slm', node);
      audio.slotJackpot();
      haptic();
      let stage = 0, closed = false, fwT = 0;
      const timers = [];
      const later = (ms, f) => timers.push(setTimeout(f, ms));
      // 花火：ランダムな場所で弾ける光の粒（閉じるまで続く）
      const firework = () => {
        if (closed) return;
        const box = $('.sl-fws', ov);
        const hue = randi(0, 359);
        const fw = el(`<div class="sl-fw" style="left:${rand(10, 90).toFixed(0)}%;top:${rand(8, 58).toFixed(0)}%;--h:${hue}">${Array.from({ length: 14 }, (_, k) => `<i style="--a:${(k * 360) / 14}deg;--d:${rand(90, 160).toFixed(0)}px"></i>`).join('')}</div>`);
        box.appendChild(fw);
        setTimeout(() => fw.remove(), 1300);
        audio.jpPop();
        fwT = setTimeout(firework, rand(380, 800));
      };
      const amount = $('.sl-ja b', ov);
      const total = coins || res.value;
      let skip = false;
      const settle = () => {
        if (stage >= 2) return;
        stage = 2;
        amount.textContent = fmt(total);
        ov.classList.add('done');
        slm.classList.add('shake');
        setTimeout(() => slm.classList.remove('shake'), 600);
        audio.jpFanfare();
        haptic();
        // 額が決まった直後の押し間違いで閉じないように、少しだけ待ってから閉じられるようにする
        later(900, () => { stage = 3; ov.classList.add('ready'); });
      };
      // 入りのあと（文字が落ちきったころ）に光を広げて、数え上げを始める
      later(1150, () => {
        if (closed) return;
        ov.classList.add('lit');
        slm.classList.add('shake');
        setTimeout(() => slm.classList.remove('shake'), 700);
        haptic();
        firework();
        stage = 1;
        audio.jpRoll(3.2);
        const t0 = performance.now();
        const step = () => {
          if (closed || stage >= 2) return;
          const t = skip ? 1 : Math.min(1, (performance.now() - t0) / 3200);
          amount.textContent = fmt(total * (1 - Math.pow(1 - t, 3)));
          if (t < 1) requestAnimationFrame(step); else settle();
        };
        step();
      });
      ov.onclick = () => {
        if (stage === 1) { skip = true; return; }
        if (stage < 3 || closed) return;
        closed = true;
        clearTimeout(fwT);
        timers.forEach(clearTimeout);
        audio.tap();
        ov.classList.add('out');
        setTimeout(() => ov.remove(), 300);
        resolve();
      };
    });
  }

  // フィーバーに入る：画面いっぱいの文字
  function feverIn() {
    return new Promise((resolve) => {
      const ov = el(`<div class="sl-bigov fever"><div class="sl-flash"></div><div class="sl-rays"></div><div class="sl-bt">FEVER</div><div class="sl-bx">${SLOT_FEVER.spins} 回ただ・払い戻し ×${SLOT_FEVER.mul}</div></div>`);
      node.appendChild(ov);
      audio.fever();
      haptic();
      let done = false;
      const close = () => { if (done) return; done = true; ov.classList.add('out'); setTimeout(() => ov.remove(), 260); resolve(); };
      ov.onclick = close;
      setTimeout(close, 1500);
    });
  }

  // n 回まわす。フィーバーの残りから始めたときは、残りを回しきったら止める（続けて賭けない）。
  // 2 回以上まわしたら、終わったあとに下の帯でまとめの収支を出す
  async function run(n) {
    if (busy) return;
    busy = true;
    sync();
    if (st.free > 0) n = 0;
    const c0 = save.coins, d0 = save.dust || 0, r0 = { ...save.rough };
    let i = 0, spins = 0, frees = 0;
    while (node.isConnected) {
      if (st.free > 0) { await spinOnce(true); spins++; frees++; sync(); continue; }
      if (i >= n || !(await spinOnce(n > 1))) break;
      i++;
      spins++;
      sync();
    }
    busy = false;
    sync();
    if (spins >= 2 && node.isConnected) summary(spins, frees, save.coins - c0, (save.dust || 0) - d0, r0);
  }
  // まとめの収支（コインの増減と、もらったジェムダスト・原石）
  function summary(spins, frees, net, dust, r0) {
    const box = $('#slres', node);
    const got = Object.keys(save.rough).filter((t) => (save.rough[t] || 0) > (r0[t] || 0))
      .map((t) => `<span><img class="sl-ci" src="${roughIcon(t, ROUGH[t].color, 40)}" alt="">${ROUGH_NAME(t)} ×${fmt(save.rough[t] - (r0[t] || 0))}</span>`);
    if (dust > 0) got.unshift(`<span>ジェムダスト +${fmt(dust)}</span>`);
    box.className = `sl-res sum ${net >= 0 ? 'plus' : 'minus'}`;
    box.innerHTML = `<div class="sl-rt">${spins} 回の収支${frees ? `<i>うちフィーバー ${frees} 回</i>` : ''}</div>
      <div class="sl-rc">${coinTag()}<b>${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}</b></div>${got.length ? `<div class="sl-rx">${got.join('')}</div>` : ''}`;
  }
  $('#slgo', node).onclick = () => run(1);
  $('#slten', node).onclick = () => run(10);
}
