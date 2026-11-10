// =====================================================================
//  ジュエル・スロット（コインを賭けて回す。抽選と払い戻しの計算は slot-core.js）
//  回した時点で結果を決めてセーブに書き、絵はあとから見せる（途中でアプリを閉じても結果は変わらない）
// =====================================================================
import { SLOT_BETS, SLOT_SYMS, SLOT_LINES, SLOT_JP, SLOT_FEVER, DUST_VALUE, ROUGH_VALUE, rollGrid, judge } from './slot-core.js';
import { save, persist } from './save.js';
import { gemIcon, roughIcon, coinIcon } from './render.js';
import { ROUGH } from './atelier.js';
import { fmt, rand, randi } from './util.js';
import { audio } from './audio.js';
import { show, el, $, topbar, coinPill, refreshCoinPill, haptic, getApp, wait, countUp } from './ui.js';

export function slotState() {
  if (!save.slot || typeof save.slot !== 'object') save.slot = {};
  const st = save.slot;
  if (!(st.pool >= SLOT_JP.seed)) st.pool = SLOT_JP.seed;
  for (const k of ['spins', 'bet', 'best', 'jp', 'free', 'freeBet']) if (typeof st[k] !== 'number') st[k] = 0;
  return st;
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
    };
  }
  if (id === 'star') return '<span class="sl-sym sl-star">★</span>';
  if (id === 'jp') return '<span class="sl-sym sl-jpsym">JP</span>';
  return `<img class="sl-sym s-${id}" src="${symImg[id]}" alt="">`;
}
const NAMES = { shard: '原石の欠片', ruby: 'ルビー', sapphire: 'サファイア', diamond: 'ダイヤモンド', mystic: '秘石' };
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

export function showSlot(back) {
  const st = slotState();
  const node = el(`
    <div class="screen slot-screen" data-nav="jewel">
      ${topbar('SLOT', 'ジュエル・スロット', coinPill(), 'slot')}
      <div class="sl-jpbox"><span>JACKPOT</span><b id="sljp">${fmt(st.pool)}</b></div>
      <div class="sl-machine" id="slm">
        <div class="sl-reels">${[0, 1, 2].map((c) => `<div class="sl-reel"><div class="sl-strip" id="slr${c}"></div></div>`).join('')}</div>
        <svg class="sl-lines" id="sllines" viewBox="0 0 300 300" preserveAspectRatio="none"></svg>
        <div class="sl-fx" id="slfx"></div>
      </div>
      <div class="sl-win" id="slwin"></div>
      <div class="panel sl-pay"><div class="sl-ph">払い戻し（1 列に 3 つ。横 3 本・斜め 2 本）</div><div id="slpay"></div>
        <p class="sl-note">フィーバーは ${SLOT_FEVER.spins} 回ただで回せて、払い戻しが ${SLOT_FEVER.mul} 倍。ジャックポットは積み立て × 賭け金 ÷ ${fmt(SLOT_BETS[SLOT_BETS.length - 1])}（いちばん高い賭けで全額）と秘石。</p></div>
      <div class="dock sl-dock">
        <div class="sl-bets" id="slbets">${SLOT_BETS.map((b, i) => `<button class="btn small sl-bet" data-i="${i}">${b >= 1e6 ? `${b / 1e6}00万` : `${b / 1e4}万`}</button>`).join('')}</div>
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
  };
  sync();

  $('#back', node).onclick = () => { if (busy) return; audio.tap(); back(); };
  node.querySelectorAll('.sl-bet').forEach((b) => (b.onclick = () => {
    if (busy) return;
    audio.select();
    st.bet = +b.dataset.i;
    persist();
    sync();
  }));

  // 1 回まわす（フィーバーの残りがあればそれを使う）。fast は 10 回のとき
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
    $('#slwin', node).innerHTML = '';
    $('#sllines', node).innerHTML = '';
    node.querySelectorAll('.sl-cell.win').forEach((c) => c.classList.remove('win'));
    refreshCoinPill();
    if (!res.jp) $('#sljp', node).textContent = fmt(st.pool);
    await spinReels(grid, fast);
    await showWin(res, bet, fast, free);
    if (res.jp) $('#sljp', node).textContent = fmt(st.pool);
    if (res.jp && getApp() && getApp().checkMetaAchievements) getApp().checkMetaAchievements();
    return true;
  }

  // リールを回して止める。2 列目までで大きい当たりが見えたら、3 列目をゆっくり止める（リーチ）
  async function spinReels(grid, fast) {
    const cs = $('.sl-reel', node).offsetHeight / 3;
    const reach = SLOT_LINES.some((l) => {
      const a = grid[l[0][0]][l[0][1]], b = grid[l[1][0]][l[1][1]];
      return a === b && (a === 'jp' || a === 'diamond' || a === 'mystic');
    }) || grid.flat().filter((x, i) => i % 3 < 2 && x === 'star').length >= 2;
    audio.select();
    const stops = [];
    for (let c = 0; c < 3; c++) {
      const strip = $(`#slr${c}`, node);
      const cur = [...strip.children].slice(-3).map((x) => x.innerHTML);
      const k = (fast ? 6 : 12) + c * (fast ? 3 : 6) + (c === 2 && reach ? (fast ? 8 : 18) : 0);
      const mid = Array.from({ length: k }, () => symHTML(SLOT_SYMS[randi(0, SLOT_SYMS.length - 1)].id));
      const fin = [0, 1, 2].map((r) => symHTML(grid[r][c]));
      strip.style.transition = 'none';
      strip.style.transform = 'translateY(0)';
      strip.innerHTML = [...cur, ...mid, ...fin].map((h) => `<div class="sl-cell">${h}</div>`).join('');
      void strip.offsetHeight;
      const dur = (fast ? 0.45 : 0.85) + c * (fast ? 0.18 : 0.35) + (c === 2 && reach ? (fast ? 0.7 : 1.5) : 0);
      strip.style.transition = `transform ${dur}s cubic-bezier(.2,.75,.25,1.03)`;
      strip.style.transform = `translateY(${-(cur.length + k) * cs}px)`;
      if (c === 2 && reach) {
        setTimeout(() => { strip.parentElement.classList.add('reach'); audio.drumroll(Math.max(0.6, dur - 0.9)); }, (fast ? 0.6 : 1.4) * 1000);
      }
      stops.push(wait(dur * 1000).then(() => {
        audio.slotTick(c);
        strip.style.transition = 'none';
        strip.style.transform = 'translateY(0)';
        strip.innerHTML = fin.map((h) => `<div class="sl-cell">${h}</div>`).join('');
        strip.parentElement.classList.remove('reach');
      }));
    }
    await Promise.all(stops);
  }

  // 当たりを見せる（列を光らせ、額を数え上げ、大きい当たりは画面いっぱいに）
  async function showWin(res, bet, fast, free) {
    const box = $('#slwin', node);
    if (res.lines.length) {
      const pts = (l) => SLOT_LINES[l.i].map(([r, c]) => `${c * 100 + 50},${r * 100 + 50}`).join(' ');
      $('#sllines', node).innerHTML = res.lines.map((l) => `<polyline points="${pts(l)}" class="${l.id === 'jp' ? 'jp' : ''}"/>`).join('');
      for (const l of res.lines) for (const [r, c] of SLOT_LINES[l.i]) $(`#slr${c}`, node).children[r].classList.add('win');
    }
    const parts = [];
    if (res.coins + res.jp) parts.push(`${coinTag()}<b id="slwc">0</b>`);
    if (res.dust) parts.push(`<span>ジェムダスト +${fmt(res.dust)}</span>`);
    for (const [t, n] of Object.entries(res.rough)) parts.push(`<span><img class="sl-ci" src="${roughIcon(t, ROUGH[t].color, 40)}" alt="">${ROUGH_NAME(t)} ×${fmt(n)}</span>`);
    const x = res.value / bet;
    const kind = res.jp ? 'JACKPOT' : x >= 30 ? 'MEGA WIN' : x >= 10 ? 'BIG WIN' : '';
    if (kind) {
      big(kind, res.jp ? 'jp' : x >= 30 ? 'mega' : 'big');
      if (res.jp) audio.jackpot(); else audio.bigWin();
      haptic();
    } else if (res.value > 0) audio.coin();
    if (parts.length) {
      box.innerHTML = `${free ? '<i>FEVER ×2</i>' : ''}${parts.join('')}`;
      const c = $('#slwc', box);
      if (c) await countUp(c, res.coins + res.jp, fast && !kind ? 250 : kind ? 1600 : 600, (v) => '+' + fmt(v));
    }
    if (res.fever) {
      big('FEVER', 'fever');
      audio.fever();
      await wait(fast ? 700 : 1100);
    }
    await wait(kind ? 900 : fast ? 150 : 250);
  }

  // 大きい当たりの文字とコインの雨（粒の数は決めた数まで）
  function big(text, cls) {
    const fx = $('#slfx', node);
    const n = cls === 'jp' ? 28 : cls === 'mega' ? 20 : cls === 'big' ? 12 : 0;
    const coins = Array.from({ length: n }, () => `<img class="sl-coin" src="${coinIcon(48)}" style="left:${rand(4, 92).toFixed(1)}%;animation-delay:${rand(0, 0.5).toFixed(2)}s;animation-duration:${rand(1, 1.6).toFixed(2)}s" alt="">`).join('');
    fx.innerHTML = `${coins}<div class="sl-bigbox"><div class="sl-big ${cls}">${text}</div></div>`;
    setTimeout(() => { if (fx.isConnected) fx.innerHTML = ''; }, 2200);
  }

  // n 回まわす。フィーバーの残りから始めたときは、残りを回しきったら止める（続けて賭けない）
  async function run(n) {
    if (busy) return;
    busy = true;
    sync();
    if (st.free > 0) n = 0;
    let i = 0;
    while (node.isConnected) {
      if (st.free > 0) { await spinOnce(true); sync(); continue; }
      if (i >= n || !(await spinOnce(n > 1))) break;
      i++;
      sync();
    }
    busy = false;
    sync();
  }
  $('#slgo', node).onclick = () => run(1);
  $('#slten', node).onclick = () => run(10);
}
