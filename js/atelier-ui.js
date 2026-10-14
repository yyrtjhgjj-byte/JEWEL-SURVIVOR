// =====================================================================
//  研磨工房の画面（研磨ミニゲーム・一括研磨・コレクション）
// =====================================================================
import { GEMS } from './data.js';
import { GEM_FACTS } from './gem-facts.js';
import { gemIcon, roughIcon, drawRough } from './render.js';
import { fmt, rand } from './util.js';
import { audio } from './audio.js';
import { save, persist } from './save.js';
import {
  ROUGH, ROUGH_IDS, GRADES, gradeFromScore, COLLECTION_IDS, MASTERY_MAX,
  mastery, nextMilestone, collectionStats, gemBonusText, statText, nextGem, rollCarat, applyPolish, autoGrade,
  collectionCount,
} from './atelier.js';
import { show, el, $, topbar, gemColor, wordTag, refreshCoinPill, guard, haptic, getApp, upperLv, toast } from './ui.js';
import { showHub } from './menu.js';
import { mountLiveGem } from './gem-gl.js';
import { currentSession, awardLot, rivalsOf, rivalMax, startPrice, settleWithoutYou, wantLabel } from './auction.js';
import { BEASTS, BEAST_IDS, BEAST_COST, jewelStock, beastLevel, beastValue, beastStats, raiseBeast, beastIcon } from './beasts.js';

const TAU = Math.PI * 2;

export function gradeBadge(g, big) {
  const G = GRADES[g];
  return `<span class="grade ${G.color === 'rainbow' ? 'g-rainbow' : ''} ${big ? 'big' : ''}" style="${G.color === 'rainbow' ? '' : `color:${G.color};border-color:${G.color}`}">${G.id}</span>`;
}
function pips(m) {
  return `<span class="mpips">${Array.from({ length: MASTERY_MAX }, (_, i) => `<i class="${i < m ? 'on' : ''}"></i>`).join('')}</span>`;
}
const metaAch = () => { const a = getApp(); if (a && a.checkMetaAchievements) a.checkMetaAchievements(); };

// ================================================================== 画面
// 宝石のハブ（menu.js）から開く：研磨 ／ コレクション ／ 百獣 ／ オークション（表・裏）
const ATELIER_TITLE = { polish: ['POLISH', '研磨'], collection: ['COLLECTION', 'コレクション'], beasts: ['BEASTS', '百獣'], auction: ['AUCTION', 'オークション'], auction2: ['AUCTION', 'オークション'] };
export function showAtelier(tab = 'polish') {
  const [en, jp] = ATELIER_TITLE[tab];
  const node = el(`
    <div class="screen" data-nav="jewel">
      ${topbar(en, jp)}
      <div id="at"></div>
    </div>`);
  show(node);
  $('#back', node).onclick = () => { audio.tap(); showHub('jewel'); };
  const box = $('#at', node);
  if (tab === 'polish') renderPolish(box);
  else if (tab === 'auction') renderAuction(box, false);
  else if (tab === 'auction2') renderAuction(box, true);
  else if (tab === 'beasts') renderBeasts(box);
  else renderCollection(box);
}
// 同じタブを描き直す（スクロールの位置はそのまま）
function reopen(tab) {
  const prev = $('#screens > .screen');
  const y = prev ? prev.scrollTop : 0;
  showAtelier(tab);
  const s = $('#screens > .screen');
  if (s) s.scrollTop = y;
}

// ---------------------------------------------------------------- 研磨タブ
function renderPolish(box) {
  box.innerHTML = '';
  // チュートリアル：一度も開いていなければ枠を虹色に光らせる
  const tut = el(`<button class="btn tut-btn ${save.seen.polishTut ? '' : 'fresh'}">TUTORIAL<span class="sub">研磨のチュートリアル</span></button>`);
  tut.onclick = () => {
    audio.select();
    save.seen.polishTut = true;
    persist();
    startPolish('shard', true);
  };
  box.appendChild(tut);
  const list = el('<div class="rough-list"></div>');
  for (const t of ROUGH_IDS) {
    const R = ROUGH[t];
    const n = save.rough[t] || 0;
    const can = n > 0 && save.coins >= R.cost;
    const bulk = Math.min(n, Math.floor(save.coins / R.cost));
    const row = el(`<div class="rough-item ${n ? '' : 'none'}">
      <img src="${roughIcon(t, R.color, 72)}">
      <div class="rbody">
        <div class="rname">${R.name}<small>×${n}</small></div>
        <div class="rdesc">${R.ct[0]}〜${R.ct[1]}ct ／ 研磨 ${R.facets} 面 ／ <i class="coin-ico"></i>${fmt(R.cost)}</div>
      </div>
      <div class="rbtns2">
        <button class="btn small gold" data-a="play" ${can ? '' : 'disabled'}>研磨</button>
        <button class="btn small" data-a="auto" ${bulk > 0 ? '' : 'disabled'}>自動${bulk > 1 ? ` ×${bulk}` : ''}</button>
      </div>
    </div>`);
    $('[data-a=play]', row).onclick = () => { audio.select(); startPolish(t); };
    $('[data-a=auto]', row).onclick = () => { audio.tap(); autoPolish(t, bulk, box); };
    list.appendChild(row);
  }
  box.appendChild(list);
  box.appendChild(el(`<div class="at-note">
    リングを回る針が光る面に重なった瞬間にタップすると研磨できます。精度が高いほど品質が上がります（C〜SS）。<br>
    自動研磨はまとめて磨けますが、品質は C か B になります。<br>
    原石はエリートやボスを倒すか、採掘で手に入ります。ステージやヒートが高いほど上位の原石が出やすくなります。
  </div>`));
}

// 一括の自動研磨
function autoPolish(tier, count, box) {
  const R = ROUGH[tier];
  if (count <= 0) return;
  const res = [];
  for (let i = 0; i < count; i++) {
    if (save.coins < R.cost || !save.rough[tier]) break;
    save.coins -= R.cost;
    res.push(applyPolish(tier, nextGem(tier), autoGrade(), rollCarat(tier)));
  }
  persist();
  metaAch();
  refreshCoinPill(); // 実績のコインも反映してから表示
  audio.levelUp();
  haptic();
  const ov = el(`<div class="screen dim at-over">
    <div class="panel at-sum">
      <div class="label">自動研磨 — ${R.name} ×${res.length}</div>
      <div class="sum-list"></div>
      <button class="btn primary" id="ok">OK</button>
    </div></div>`);
  const sl = $('.sum-list', ov);
  // 同じ宝石はまとめて表示
  const by = {};
  for (const r of res) (by[r.gemId] = by[r.gemId] || []).push(r);
  for (const [id, rs] of Object.entries(by)) {
    const best = Math.max(...rs.map((r) => r.grade));
    const tags = [rs.some((r) => r.isNew) ? '<span class="ctag2 t-new">NEW</span>' : '', rs.some((r) => r.mAfter > r.mBefore) ? '<span class="ctag2 t-evo">練度UP</span>' : ''].join('');
    sl.appendChild(el(`<div class="sum-row"><img src="${gemIcon(id, 48)}"><span>${GEMS[id].jp}${rs.length > 1 ? ` ×${rs.length}` : ''}</span>${tags}${gradeBadge(best)}</div>`));
  }
  $('#screens').appendChild(ov);
  guard($('#ok', ov), 400);
  $('#ok', ov).onclick = () => { audio.tap(); ov.remove(); renderPolish(box); };
}

// ---------------------------------------------------------------- 研磨ミニゲーム
// tut = true でチュートリアル（原石もコインも使わない練習。1 面目は針が止まるのを待ってタップ、2 面目はゆっくり、3 面目は本番の速さ）
const TUT_SPEED = [0.4, 0.65, 1];
const TUT_HINT = [
  '針がゆっくり回ります。光る面の真ん中で止まったらタップ',
  '次は止まりません。光る面に針が重なった瞬間にタップ',
  '最後は本番と同じ速さです',
];
function startPolish(tier, tut = false) {
  const R = ROUGH[tier];
  if (!tut && (!save.rough[tier] || save.coins < R.cost)) return;
  // コインは研磨が終わったとき（原石を消費するのと同時）に払う。途中でアプリが落ちてもコインだけ失わないように
  const gemId = tut ? 'diamond' : nextGem(tier);
  if (!tut) persist();
  polishMini({
    tier, gemId, tut, en: tut ? 'TUTORIAL' : 'POLISHING', jp: tut ? '研磨のチュートリアル' : R.name,
    quit: () => showAtelier('polish'),
    done: (score, grade) => {
      if (tut) { tutorialResult(score, grade); return; }
      const ct = rollCarat(tier);
      save.coins = Math.max(0, save.coins - R.cost);
      const res = applyPolish(tier, gemId, grade, ct);
      persist();
      reveal(res, score);
    },
  });
}
// 研磨のミニゲーム（針がリングを回り、光る面に重なったらタップ）。研磨工房と経営の名石で使う。
// o：tier 原石の等級（面の数・速さ・幅）、gemId 光の色、tut 練習、en / jp 見出し、quit 始める前にやめたとき、done(精度, 品質)
export function polishMini(o) {
  const { tier, gemId, tut } = o;
  const R = ROUGH[tier];
  const hint = gemColor(gemId);

  const node = el(`<div class="screen polish-screen">
    <div class="pol-head"><div class="en">${o.en}</div><div class="jp">${o.jp}</div>
      <div class="facets">${Array.from({ length: R.facets }, () => '<i></i>').join('')}</div></div>
    <canvas id="pc"></canvas>
    <div class="pol-hint" id="ph">${tut ? 'タップで練習開始' : 'タップで研磨開始'}</div>
    ${tut ? '<div class="pol-tip" id="pt"><div>リングの光っている所が、研磨する面です。</div><div>真ん中の白い帯ほど高い評価になります。</div></div><button class="btn small" id="tq">やめる</button>' : '<button class="btn small" id="tq">やめる</button>'}
  </div>`);
  show(node);
  const cv = $('#pc', node);
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const W = Math.min(360, window.innerWidth - 24);
  cv.style.width = cv.style.height = W + 'px';
  cv.width = cv.height = Math.round(W * dpr);
  const ctx = cv.getContext('2d');
  const C = W / 2, RING = W * 0.4;

  const st = {
    facet: 0, ang: -Math.PI / 2, target: 0, results: [], cuts: [], pops: [], lockT: 0, done: false, t: 0, flash: 0,
    ready: false, goT: 0, // 最初のタップで開始し、少し間を置いてから針が動く
  };
  const zone = { p: 0.2 * R.zone, g: 0.4 * R.zone, ok: 0.64 * R.zone };
  const speed = () => 2.2 * R.speed * (1 + 0.1 * st.facet) * (tut ? TUT_SPEED[Math.min(st.facet, TUT_SPEED.length - 1)] : 1);
  const tip = (t) => { const e = $('#pt', node); if (e) e.innerHTML = t; };
  // やめる：チュートリアルはいつでも。本番は始める前だけ（原石とコインは研磨が終わったときに使うので、何も減らない）
  $('#tq', node).onclick = (e) => { e.stopPropagation(); audio.tap(); st.done = true; o.quit(); };
  const place = () => { st.target = st.ang + rand(1.8, 4.3); };
  place();

  const judge = (diff) => {
    const a = Math.abs(diff);
    if (a <= zone.p) return [1, 'PERFECT', '#ffffff'];
    if (a <= zone.g) return [0.7, 'GREAT', '#ffd24a'];
    if (a <= zone.ok) return [0.4, 'GOOD', '#7fd0ff'];
    return [0, 'MISS', '#ff6b8a'];
  };
  const resolve = (diff) => {
    const [sc, label, col] = judge(diff);
    if (tut) {
      // 判定のわけを説明する
      const why = sc >= 1 ? '真ん中の白い帯：PERFECT' : sc >= 0.7 ? '金色の帯：GREAT' : sc > 0 ? '水色の帯：GOOD' : diff < 0 ? '早すぎました：MISS' : '通り過ぎました：MISS';
      const next = TUT_HINT[st.facet + 1];
      tip(`<div><b style="color:${col}">${why}</b></div>${next ? `<div>${next}</div>` : ''}`);
      $('#ph', node).textContent = '';
      st.hold = false;
    }
    st.results.push(sc);
    st.cuts.push({ a: st.target, sc });
    st.pops.push({ label, col, t: 0 });
    const dots = node.querySelectorAll('.facets i');
    if (dots[st.facet]) { dots[st.facet].classList.add('on'); dots[st.facet].style.background = col; dots[st.facet].style.boxShadow = `0 0 8px ${col}`; }
    if (sc >= 1) { audio.crit(); haptic(); st.flash = 1; } else if (sc > 0) audio.cardFlip(st.facet % 5); else audio.tap();
    st.facet++;
    st.lockT = 0.18;
    if (st.facet >= R.facets) { st.done = true; setTimeout(finish, 650); } else place();
  };
  node.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    if (!st.ready) {
      st.ready = true;
      st.goT = 0.8;
      if (!tut) $('#tq', node).remove(); // 始めたら本番はやめられない
      audio.select();
      $('#ph', node).textContent = tut ? '' : '光る面に針が重なったらタップ';
      if (tut) tip(`<div>${TUT_HINT[0]}</div>`);
      return;
    }
    if (st.done || st.lockT > 0 || st.goT > 0) return;
    if (tut && st.facet === 0 && !st.hold) return; // 1 面目は、針が止まるまで待つ
    let diff = (st.ang - st.target) % TAU;
    if (diff > Math.PI) diff -= TAU;
    if (diff < -Math.PI) diff += TAU;
    resolve(diff);
  });

  let last = performance.now();
  let raf = 0;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    st.t += dt;
    st.lockT = Math.max(0, st.lockT - dt);
    st.flash = Math.max(0, st.flash - dt * 3);
    if (st.goT > 0) st.goT -= dt;
    else if (!st.done && st.ready && !st.hold) {
      st.ang += speed() * dt;
      // チュートリアルの 1 面目：光る面の真ん中で針を止めて、タップを待つ
      if (tut && st.facet === 0 && st.ang >= st.target) {
        st.ang = st.target;
        st.hold = true;
        $('#ph', node).textContent = '今！ タップ';
        audio.countTick();
      }
      // 通り過ぎたら MISS
      if (st.ang - st.target > zone.ok) resolve(st.ang - st.target);
    }
    for (const p of st.pops) p.t += dt;
    draw();
    if (node.isConnected && !st.revealed) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, W);
    const bg = ctx.createRadialGradient(C, C, 0, C, C, C);
    bg.addColorStop(0, 'rgba(120,80,200,0.18)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, W);
    // リング
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(C, C, RING, 0, TAU); ctx.stroke();
    // 狙う面
    if (!st.done) {
      const arc = (w, col, lw) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(C, C, RING, st.target - w, st.target + w); ctx.stroke(); };
      arc(zone.ok, 'rgba(127,208,255,0.35)', 10);
      arc(zone.g, 'rgba(255,210,74,0.7)', 12);
      ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 12;
      arc(zone.p, '#ffffff', 14);
      ctx.shadowBlur = 0;
    }
    // 石
    ctx.save();
    ctx.translate(C, C);
    const prog = st.facet / R.facets;
    const r = W * 0.2 * (1 + 0.04 * Math.sin(st.t * 3));
    drawRough(ctx, r, tier, hint);
    // 研磨の筋
    for (const c of st.cuts) {
      ctx.strokeStyle = c.sc > 0 ? `rgba(255,255,255,${0.35 + c.sc * 0.5})` : 'rgba(255,90,120,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(c.a) * r * 1.05, Math.sin(c.a) * r * 1.05);
      ctx.lineTo(Math.cos(c.a + 2.2) * r * 0.5, Math.sin(c.a + 2.2) * r * 0.5);
      ctx.stroke();
    }
    // 中から漏れる光
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.15 + prog * 0.5 + st.flash * 0.3;
    const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.6);
    gl.addColorStop(0, hint);
    gl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    // 針
    const nx = C + Math.cos(st.ang) * RING, ny = C + Math.sin(st.ang) * RING;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(C + Math.cos(st.ang) * (RING - 26), C + Math.sin(st.ang) * (RING - 26)); ctx.lineTo(nx, ny); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = hint; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(nx, ny, 7, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // チュートリアル：針が止まっている間は「TAP」を点滅
    if (st.hold) {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(st.t * 10);
      ctx.font = '700 26px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAP!', C, C - W * 0.3);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(255,210,74,${0.55 + 0.45 * Math.sin(st.t * 10)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(nx, ny, 13 + 3 * Math.sin(st.t * 10), 0, TAU); ctx.stroke();
    }
    // 開始前の表示
    if (!st.ready || st.goT > 0) {
      ctx.fillStyle = st.ready ? '#ffd24a' : '#ffffff';
      ctx.globalAlpha = st.ready ? 1 : 0.6 + 0.4 * Math.sin(st.t * 4);
      ctx.font = '700 24px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(st.ready ? 'READY' : 'TAP TO START', C, C - W * 0.3);
      ctx.globalAlpha = 1;
    }
    // 判定表示
    for (const p of st.pops) {
      if (p.t > 0.8) continue;
      ctx.globalAlpha = 1 - p.t / 0.8;
      ctx.fillStyle = p.col;
      ctx.font = `700 ${22}px Rajdhani, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(p.label, C, C - W * 0.3 - p.t * 30);
      ctx.globalAlpha = 1;
    }
  }
  function finish() {
    const score = st.results.reduce((a, b) => a + b, 0) / st.results.length;
    const grade = gradeFromScore(score);
    if (!node.isConnected) return;
    st.revealed = true;
    cancelAnimationFrame(raf);
    o.done(score, grade);
  }
}

// チュートリアルの結果：精度と品質の関係をまとめる
function tutorialResult(score, grade) {
  const rows = GRADES.map((G, i) => `<div class="rrow2 ${i === grade ? 'tut-now' : ''}"><span>${gradeBadge(i)}</span><b>精度 ${i ? `${Math.round(G.min * 100)}% 以上` : `${Math.round(GRADES[1].min * 100)}% 未満`}</b></div>`).reverse().join('');
  const node = el(`<div class="screen dim reveal-screen">
    <div class="rays"></div>
    <div class="big-title prism-text">PRACTICE</div>
    <div class="rv-grade">${gradeBadge(grade, true)}</div>
    <div class="sub-title">精度 <b>${Math.round(score * 100)}%</b></div>
    <div class="panel rv-m">
      ${rows}
      <div class="at-note">本番では原石の面の数（欠片 3 〜 秘石 6）だけ繰り返し、その平均の精度で品質が決まります。上位の原石ほど針が速く、光る面が細くなります。</div>
    </div>
    <div class="rbtns">
      <button class="btn big primary" id="again">もう一度</button>
      <button class="btn" id="back2">戻る</button>
    </div>
  </div>`);
  show(node);
  guard($('.rbtns', node), 700);
  if (grade >= 3) audio.levelUp(); else audio.chestOpen();
  $('#again', node).onclick = () => { audio.select(); startPolish('shard', true); };
  $('#back2', node).onclick = () => { audio.tap(); showAtelier('polish'); };
}

// ---------------------------------------------------------------- 研磨結果
function reveal(res, score) {
  const g = GEMS[res.gemId];
  const col = gemColor(res.gemId);
  const R = ROUGH[res.tier];
  const tags = [
    res.isNew ? '<span class="ctag2 t-new">NEW</span>' : '',
    res.bestUp ? '<span class="ctag2 t-evo">最高品質 更新</span>' : '',
    res.ctUp ? '<span class="ctag2 t-pair">最大カラット 更新</span>' : '',
  ].join('');
  const mUp = res.mAfter > res.mBefore;
  const node = el(`<div class="screen dim reveal-screen">
    <div class="rays"></div>
    <div class="rv-gem"><img src="${gemIcon(res.gemId, 200)}" style="filter:drop-shadow(0 0 28px ${col})"></div>
    <div class="rv-grade">${gradeBadge(res.grade, true)}</div>
    <div class="rv-name">${g.jp}<small>${g.en}</small></div>
    <div class="rv-sub">${wordTag(res.gemId)}<span class="rv-ct">${res.ct.toFixed(2)} ct</span></div>
    <div class="rv-tags">${tags}</div>
    <div class="panel rv-m">
      <div class="rrow2"><span>練度</span><b>${res.mBefore} → ${res.mAfter}${mUp ? ' <span class="up">UP</span>' : ''}</b></div>
      <div class="rrow2"><span>ボーナス</span><b>${gemBonusText(res.gemId, res.mAfter)}</b></div>
      <div class="rrow2 muted"><span>精度</span><b>${Math.round(score * 100)}%</b></div>
    </div>
    <div class="rbtns">
      <button class="btn big primary" id="again" ${save.rough[res.tier] > 0 && save.coins >= R.cost ? '' : 'disabled'}>もう一度<span class="sub">${R.short} ×${save.rough[res.tier] || 0}</span></button>
      <button class="btn" id="back2">戻る</button>
    </div>
  </div>`);
  show(node);
  guard($('.rbtns', node), 900);
  // 演出
  const big = res.grade >= 3;
  if (res.grade === 4) { audio.bigWin(); haptic(); } else if (big) { audio.levelUp(); haptic(); } else audio.chestOpen();
  node.classList.add(`rv-g${res.grade}`);
  metaAch();
  refreshCoinPill();
  $('#again', node).onclick = () => { audio.select(); startPolish(res.tier); };
  $('#back2', node).onclick = () => { audio.tap(); showAtelier('polish'); };
}

// ---------------------------------------------------------------- コレクションタブ

function renderCollection(box) {
  box.innerHTML = '';
  const bonus = collectionStats();
  const bonusText = Object.entries(bonus).map(([k, v]) => statText(k, v)).join(' ／ ');
  box.appendChild(el(`<div class="panel coll-sum">
    <div class="coll-count"><b>${collectionCount()}</b> / ${COLLECTION_IDS.length}<small>研磨数 ${fmt(save.stats.polished || 0)}</small></div>
    <div class="coll-bonus">${bonusText || 'ボーナスなし'}</div>
  </div>`));
  const grid = el('<div class="coll-grid"></div>');
  for (const id of COLLECTION_IDS) {
    const rec = save.jewels[id];
    const has = rec && rec.n;
    const m = mastery(rec);
    const name = GEMS[id].jp;
    const cell = el(`<button class="coll-cell ${has ? '' : 'none'}" style="--c:${gemColor(id)}">
      <img src="${gemIcon(id, 80)}">
      ${has ? `<span class="cq">${gradeBadge(rec.best)}<span class="cmv">${m}</span></span>` : ''}
      ${rec && rec.have ? `<span class="chave">×${rec.have >= 100 ? '99+' : rec.have}</span>` : ''}
      <span class="cm ${name.length >= 9 ? 'xlong' : name.length >= 7 ? 'long' : ''}">${name}</span>
    </button>`);
    cell.onclick = () => { audio.tap(); gemDetail(id); };
    grid.appendChild(cell);
  }
  box.appendChild(grid);
}

// 実在の宝石としての情報（研磨して入手するまでは伏せる）
function factsHtml(id, has) {
  const f = GEM_FACTS[id];
  if (!f) return '';
  const q = '？？？';
  const [lo, hi] = f.h;
  const hs = lo === hi ? `${lo}` : `${lo}〜${hi}`;
  let bar = '';
  for (let i = 1; i <= 10; i++) bar += `<i class="${has && i <= Math.ceil(hi) ? (i <= Math.floor(lo) ? 'on' : 'rng') : ''}"></i>`;
  return `<div class="gd-facts">
    <div class="gd-fh">GEM DATA</div>
    <div class="rrow2"><span>モース硬度</span><b class="gd-hard">${has ? hs : q}<span class="hbar">${bar}</span></b></div>
    <div class="gd-fr"><span>主な産地</span><p>${has ? f.o.split('・').map((s) => `<span class="nw">${s}</span>`).join('・<wbr>') : q}</p></div>
    <div class="gd-fr"><span>名前の由来</span><p>${has ? f.n : q}</p></div>
    <div class="gd-trivia">${has ? `${f.d ? `<p>${f.d}</p>` : ''}<p>${f.t}</p>` : q}</div>
  </div>`;
}

function gemDetail(id) {
  const g = GEMS[id];
  const rec = save.jewels[id];
  const has = rec && rec.n;
  const m = mastery(rec);
  const nm = nextMilestone(rec);
  const next = [];
  if (!has) next.push('研磨して入手すると練度 1');
  else {
    if (rec.best < GRADES.length - 1) next.push(`品質 ${GRADES[rec.best + 1].id} 以上で練度 +1`);
    if (nm) next.push(`研磨数 ${nm} で練度 +1（現在 ${rec.n}）`);
  }
  const ov = el(`<div class="screen dim at-over">
    <div class="panel gem-detail" style="--c:${gemColor(id)}">
      <div class="gd-top">
        <img src="${gemIcon(id, 120)}" style="${has ? `filter:drop-shadow(0 0 16px ${gemColor(id)})` : 'filter:grayscale(1) brightness(.35)'}">
        <div>
          <div class="gd-name">${g.jp}</div>
          <div class="gd-en">${g.en}</div>
          ${wordTag(id)}
        </div>
      </div>
      <div class="rrow2"><span>最高品質</span><b>${has ? gradeBadge(rec.best) : '—'}</b></div>
      <div class="rrow2"><span>最大カラット</span><b>${has ? rec.ct.toFixed(2) + ' ct' : '—'}</b></div>
      <div class="rrow2"><span>所持数</span><b>${jewelStock(id)}</b></div>
      <div class="rrow2"><span>研磨数</span><b>${has ? rec.n : 0}</b></div>
      <div class="rrow2"><span>練度</span><b>${m} / ${MASTERY_MAX} ${pips(m)}</b></div>
      <div class="rrow2"><span>ボーナス</span><b>${m ? gemBonusText(id, m) : '—'}</b></div>
      <div class="gd-next">${next.length ? next.join('<br>') : '練度は最大です'}</div>
      ${g.lore ? `<div class="gd-lore">${has ? g.lore : ''}</div>` : ''}
      ${factsHtml(id, has)}
      <button class="btn" id="ok">閉じる</button>
    </div></div>`);
  $('#screens').appendChild(ov);
  $('#ok', ov).onclick = () => { audio.tap(); ov.remove(); };
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  // 持っている宝石は、その場で描いて揺らす
  if (has) mountLiveGem($('.gd-top img', ov), id);
}


// ---------------------------------------------------------------- 百獣
function renderBeasts(box) {
  box.innerHTML = '';
  const bonusText = Object.entries(beastStats()).map(([k, v]) => statText(k, v)).join(' ／ ');
  box.appendChild(el(`<div class="panel coll-sum"><div class="coll-bonus">${bonusText || 'ボーナスなし'}</div></div>`));
  const grid = el('<div class="beast-grid"></div>');
  for (const id of BEAST_IDS) {
    const lv = beastLevel(id);
    const n = jewelStock(id);
    const cell = el(`<button class="beast-cell ${lv ? '' : 'none'} ${n >= BEAST_COST ? 'ready' : ''}" style="--c:${gemColor(id)}">
      <img src="${beastIcon(id, 96)}">
      <span class="bn">${BEASTS[id].name}</span>
      <span class="bl">${lv ? `Lv ${lv}` : '未召喚'}</span>
      <span class="bh"><img src="${gemIcon(id, 32)}">${n}</span>
    </button>`);
    cell.onclick = () => { audio.tap(); beastDetail(id); };
    grid.appendChild(cell);
  }
  box.appendChild(grid);
}

function beastDetail(id) {
  const B = BEASTS[id], g = GEMS[id];
  const lv = beastLevel(id), n = jewelStock(id);
  const now = lv ? statText(B.stat, beastValue(id)) : '—';
  const next = statText(B.stat, beastValue(id, lv + 1));
  const ov = el(`<div class="screen dim at-over">
    <div class="panel gem-detail beast-detail" style="--c:${gemColor(id)}">
      <div class="bd-art ${lv ? '' : 'none'}"><img src="${beastIcon(id, 200)}"></div>
      <div class="gd-name">${B.name}</div>
      <div class="rrow2"><span>レベル</span><b>${lv ? `Lv ${lv}` : '未召喚'}</b></div>
      <div class="rrow2"><span>効果</span><b>${now}</b></div>
      <div class="rrow2"><span>${lv ? '強化後' : '召喚後'}</span><b>${next}</b></div>
      <div class="rrow2"><span>${g.jp}の所持数</span><b>${n}</b></div>
      <button class="btn big primary" id="bup" ${n >= BEAST_COST ? '' : 'disabled'}>${lv ? '強化' : '召喚'}<span class="sub">${g.jp} ×${BEAST_COST}</span></button>
      <button class="btn" id="ok">閉じる</button>
    </div></div>`);
  $('#screens').appendChild(ov);
  const close = () => { ov.remove(); reopen('beasts'); };
  $('#ok', ov).onclick = () => { audio.tap(); close(); };
  ov.onclick = (e) => { if (e.target === ov) close(); };
  $('#bup', ov).onclick = () => {
    if (!raiseBeast(id)) return;
    persist();
    metaAch();
    haptic();
    lv ? audio.levelUp() : audio.bigWin();
    ov.remove();
    beastDetail(id);
    const art = $('.bd-art', $('#screens').lastElementChild);
    if (art) art.classList.add('pop');
  };
}

// ---------------------------------------------------------------- オークション
const r100 = (v) => Math.round(v / 100) * 100;
const rnd = (a, b) => a + Math.random() * (b - a);
const ROUGH_ORDER = ['mystic', 'large', 'rough', 'shard'];

// 品の絵と名前（宝石：品質とカラット ／ 詰め合わせ：原石の山と中身）
function lotArt(lot, size) {
  if (lot.kind === 'bundle') {
    const ts = ROUGH_ORDER.filter((t) => lot.rough[t]);
    return `<div class="lot-art bundle" style="--c:${ROUGH[ts[0]].color}">${ts.map((t, i) => `<img src="${roughIcon(t, ROUGH[t].color, size)}" style="--i:${i}">`).join('')}</div>`;
  }
  return `<div class="lot-art" style="--c:${gemColor(lot.gem)}"><img src="${gemIcon(lot.gem, size)}"></div>`;
}
function lotName(lot) {
  if (lot.kind === 'bundle') return `原石の詰め合わせ<small>${ROUGH_ORDER.filter((t) => lot.rough[t]).map((t) => `${ROUGH[t].short} ×${lot.rough[t]}`).join('　')}</small>`;
  const g = GEMS[lot.gem];
  return `${g.jp}<small>${gradeBadge(lot.grade)} <span class="rv-ct">${lot.ct.toFixed(2)} ct</span></small>`;
}
// 研磨コレクションに対して新しいか（未所持・最高品質・最大カラットの更新）
function lotTags(lot) {
  if (lot.kind === 'bundle') return '';
  const rec = save.jewels[lot.gem];
  if (!rec || !rec.n) return '<span class="ctag2 t-new">未所持</span>';
  return [lot.grade > rec.best ? '<span class="ctag2 t-evo">最高品質 更新</span>' : '', lot.ct > rec.ct ? '<span class="ctag2 t-pair">最大カラット 更新</span>' : ''].join('');
}
// ライバルの席：印・名前・財布の残り・この品への欲しがり具合
function rivalSeat(sess, lot, r) {
  const s = sess.rivals[r.id];
  const want = lot ? lot.want[r.id] : 0;
  return `<div class="seat" data-r="${r.id}" style="--rc:${r.color}">
    <div class="seat-face"><b>${r.mark}</b></div>
    <div class="seat-name">${r.name}</div>
    <div class="seat-wallet"><i style="width:${Math.max(0, (s.left / s.budget) * 100)}%"></i></div>
    ${lot ? `<div class="seat-want w${want >= 1.15 ? 3 : want >= 0.95 ? 2 : 1}">${wantLabel(want)}</div>` : ''}
    <div class="seat-bub"></div>
  </div>`;
}

// 上位工房「裏オークション」を解放していれば、表と裏を切り替えるタブを出す
function auctionTabs(box, black) {
  if (!upperLv('blackAuction')) return;
  const t = el(`<div class="tabs sub">
    <button class="tab ${black ? '' : 'on'}" data-t="auction">オークション</button>
    <button class="tab ${black ? 'on' : ''}" data-t="auction2">裏オークション</button>
  </div>`);
  t.querySelectorAll('.tab').forEach((b) => (b.onclick = () => { audio.tap(); showAtelier(b.dataset.t); }));
  box.appendChild(t);
}

// カタログ：この回の 3 点と、ライバル。今の品は「競りに参加」か「見送る」
function renderAuction(box, black) {
  if (black && !upperLv('blackAuction')) black = false;
  const sess = currentSession(black);
  persist();
  const R = rivalsOf(black);
  const lot = sess.lots[sess.cur];
  const tab = black ? 'auction2' : 'auction';
  const status = (l, i) => (l.state === 'won' ? `<b class="ls won">落札 ${fmt(l.price)}</b>`
    : l.state === 'lost' ? `<b class="ls lost">${R.find((r) => r.id === l.winner).name}が ${fmt(l.price)} で落札</b>`
      : l.state === 'unsold' ? '<b class="ls">流れた</b>' : i === sess.cur ? '<b class="ls now">NOW</b>' : '<b class="ls">これから</b>');
  box.innerHTML = '';
  auctionTabs(box, black);
  box.insertAdjacentHTML('beforeend', `<div class="panel auc-cat ${black ? 'black' : ''}">
    <div class="label">${black ? 'BLACK MARKET' : 'AUCTION'}　・　${lot ? `LOT ${sess.cur + 1} / ${sess.lots.length}` : '閉会'}</div>
    <div class="cat-lots">${sess.lots.map((l, i) => `<div class="cat-lot ${i === sess.cur ? 'cur' : ''} ${l.state}">
      <span class="cat-no">LOT ${i + 1}</span>${lotArt(l, 72)}
      <div class="cat-body"><div class="cat-name">${lotName(l)}</div><div class="cat-est">予想 ${fmt(r100(l.est * 0.8))} 〜 ${fmt(r100(l.est * 1.3))}</div><div class="rv-tags">${l.state === 'open' ? lotTags(l) : ''}</div></div>
      ${status(l, i)}
    </div>`).join('')}</div>
    <div class="label" style="margin-top:6px">RIVALS${lot ? `　・　LOT ${sess.cur + 1} への気配` : ''}</div>
    <div class="seats">${R.map((r) => rivalSeat(sess, lot, r)).join('')}</div>
    <div class="rrow2"><span>所持コイン</span><b>${fmt(save.coins)}</b></div>
    ${lot ? `<div class="cat-btns"><button class="btn" id="auc-pass">見送る</button><button class="btn big primary" id="auc-go">競りに参加</button></div>`
    : '<div class="at-note" style="text-align:center">この回は終わりました。ランを 1 回終えると、次の回が開かれます</div>'}
  </div>
  <div class="at-note">ライバルは回ごとに予算を持っていて、落札するたびに財布が減ります。「本命」の品にはお金を惜しみません。見送った品は、ライバルどうしで競り落とします。</div>`);
  if (!lot) return;
  $('#auc-go', box).onclick = () => { audio.select(); startBidding(sess, lot, black); };
  $('#auc-pass', box).onclick = () => {
    audio.tap();
    const res = settleWithoutYou(sess, lot, black);
    sess.cur++;
    persist();
    reopen(tab);
    if (res) toast(`LOT ${sess.cur}`, `${res.rival.name}が ${fmt(res.price)} コインで落札`, 'AUCTION');
  };
}

// 競り：幕と照明の会場。ライバルは上限まで競り上げ、ハンマーの時間が切れたら最高額で落札
function startBidding(sess, lot, black) {
  const HAM = 4; // ハンマーの時間（入札のたびに戻る）
  const tab = black ? 'auction2' : 'auction';
  const R = rivalsOf(black);
  const st = { price: startPrice(lot), leader: null, hammer: HAM, over: false, you: false };
  const rivals = R.map((r) => ({ ...r, max: rivalMax(sess, lot, r), next: rnd(0.3, 1.2), out: false }));
  const node = el(`<div class="screen auc-hall ${black ? 'black' : ''}">
    <div class="hall-curtain l"></div><div class="hall-curtain r"></div><div class="hall-spot"></div>
    <div class="auc-top"><span class="en">${black ? 'BLACK AUCTION' : 'AUCTION'}</span><small>LOT ${sess.cur + 1} / ${sess.lots.length}</small></div>
    <div class="hall-stage">${lotArt(lot, 160)}<div class="hall-ped"></div></div>
    <div class="auc-name">${lotName(lot)}</div>
    <div class="rv-tags">${lotTags(lot)}</div>
    <div class="auc-board"><small>現在の価格</small><b id="ap">0</b><span id="al"></span></div>
    <div class="auc-ham"><div class="gavel" id="gv"><i></i><b></b></div><div class="ham-bar"><i id="ah"></i></div><span id="ahl"></span></div>
    <div class="seats hall" id="ar">${R.map((r) => rivalSeat(sess, lot, r)).join('')}</div>
    <div class="auc-bids" id="ab"></div>
    <div class="hall-foot"><span>所持コイン <b>${fmt(save.coins)}</b></span><button class="btn small" id="aq">見送る</button></div>
  </div>`);
  show(node);
  // 宝石の品は、その場で描いて揺らす（落札の画面に移っても続ける）
  if (lot.kind !== 'bundle') mountLiveGem($('.hall-stage .lot-art img', node), lot.gem);
  const bids = [[0.05, '小刻み'], [0.1, '強気'], [0.25, '勝負']];
  const price = $('#ap', node), lead = $('#al', node), hamBar = $('#ah', node), hamLbl = $('#ahl', node), gavel = $('#gv', node);
  const seat = (r) => $(`.seat[data-r="${r.id}"]`, node);
  const bubble = (r, t) => {
    const s = seat(r);
    const b = $('.seat-bub', s);
    b.textContent = t;
    s.classList.remove('raise'); void s.offsetWidth; s.classList.add('raise');
  };
  const renderSeats = () => rivals.forEach((r) => { const s = seat(r); s.classList.toggle('out', r.out); s.classList.toggle('lead', st.leader === r); });
  const renderBids = () => {
    $('#ab', node).innerHTML = bids.map(([k, n], i) => { const v = r100(st.price * (1 + k)); return `<button class="btn gold" data-i="${i}" ${st.over || st.leader === 'you' || v > save.coins ? 'disabled' : ''}>${n}<span class="sub">+${Math.round(k * 100)}%　${fmt(v)}</span></button>`; }).join('');
    $('#ab', node).querySelectorAll('button').forEach((b) => (b.onclick = () => {
      if (st.over || st.leader === 'you') return;
      const k = bids[+b.dataset.i][0];
      const v = r100(st.price * (1 + k));
      if (v > save.coins) return;
      audio.coin(); haptic();
      if (!st.you) { lot.joined = true; persist(); $('#aq', node).textContent = '降りる'; }
      st.you = true;
      place('you', v);
      // 大きく競り上げると、上限が近いライバルは気圧されて降りることがある
      for (const r of rivals) {
        if (r.out) continue;
        if (v >= r.max || (k >= 0.25 && v > r.max * 0.85 && Math.random() < 0.5)) { r.out = true; bubble(r, v >= r.max ? '降りた' : '気圧された…'); }
        else r.next = Math.min(r.next, rnd(0.4, 1.3));
      }
      renderSeats();
    }));
  };
  const place = (who, v) => {
    st.price = v; st.leader = who; st.hammer = HAM;
    price.textContent = fmt(v);
    price.classList.remove('bump'); void price.offsetWidth; price.classList.add('bump');
    if (who === 'you') { lead.textContent = 'あなたが最高額'; lead.style.color = '#5dff9a'; }
    else { lead.textContent = `${who.name}が最高額`; lead.style.color = who.color; audio.tap(); }
    renderSeats(); renderBids();
  };
  price.textContent = fmt(st.price);
  lead.textContent = '開始価格';
  renderSeats(); renderBids();
  let last = performance.now(), phase = 0;
  const frame = (now) => {
    if (!node.isConnected || st.over) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (const r of rivals) {
      if (r.out || st.leader === r) continue;
      r.next -= dt;
      if (r.next > 0) continue;
      r.next = rnd(...r.wait);
      const k = rnd(...r.step);
      const v = r100(st.price * (1 + k));
      // 上限を超えるか、成金は相場を超えると降りやすい
      if (v > r.max || (r.rash && st.price > lot.est * 0.85 && Math.random() < 0.5)) { r.out = true; bubble(r, '降りた'); renderSeats(); continue; }
      bubble(r, `+${Math.round(k * 100)}%`);
      place(r, v);
    }
    // 誰も競らなくなったら、ハンマーを早める
    if (st.leader && st.leader !== 'you' && rivals.every((r) => r.out || r === st.leader) && !st.you) st.hammer = Math.min(st.hammer, 1.2);
    st.hammer -= dt;
    hamBar.style.transform = `scaleX(${Math.max(0, st.hammer / HAM)})`;
    const ph = st.hammer > 2.6 ? 0 : st.hammer > 1.3 ? 1 : st.hammer > 0 ? 2 : 3;
    if (ph !== phase) {
      phase = ph;
      hamLbl.textContent = ['', 'GOING ONCE…', 'GOING TWICE…', 'SOLD!'][ph];
      if (ph) { gavel.classList.remove('hit'); void gavel.offsetWidth; gavel.classList.add('hit'); }
      if (ph === 1 || ph === 2) audio.countTick();
    }
    if (st.hammer <= 0 && st.leader) { finish(); return; }
    if (st.hammer <= 0) {
      // 開始価格で誰も入らなければ流れる
      if (rivals.every((r) => r.out || r.max <= st.price)) { st.over = true; lot.state = 'unsold'; sess.cur++; persist(); showAtelier(tab); toast(`LOT ${sess.cur}`, '入札がなく流れました', 'AUCTION'); return; }
      st.hammer = HAM;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  $('#aq', node).onclick = () => {
    audio.tap();
    st.over = true;
    // 見送る・降りる：残りのライバルどうしで決まる
    const res = settleWithoutYou(sess, lot, black, st.you ? st.price : startPrice(lot));
    sess.cur++;
    persist();
    showAtelier(tab);
    if (res) toast(`LOT ${sess.cur}`, `${res.rival.name}が ${fmt(res.price)} コインで落札`, 'AUCTION');
  };
  function finish() {
    st.over = true;
    renderBids();
    const won = st.leader === 'you';
    audio.bigWin(); haptic();
    let r = null;
    lot.price = st.price;
    if (won) { save.coins -= st.price; r = awardLot(lot); lot.state = 'won'; save.stats.auctionWins = (save.stats.auctionWins || 0) + 1; }
    else { lot.state = 'lost'; lot.winner = st.leader.id; sess.rivals[st.leader.id].left -= st.price; }
    sess.cur++;
    persist();
    metaAch();
    refreshCoinPill();
    setTimeout(() => {
      const tags = won && r ? [r.isNew ? '<span class="ctag2 t-new">NEW</span>' : '', r.bestUp ? '<span class="ctag2 t-evo">最高品質 更新</span>' : '', r.ctUp ? '<span class="ctag2 t-pair">最大カラット 更新</span>' : ''].join('') : '';
      const ov = el(`<div class="screen reveal-screen auc-sold ${black ? 'black' : ''} ${won ? 'won' : ''}">
        <div class="rays-clip"><div class="rays"></div></div>
        <div class="sold-stamp">SOLD</div>
        <div class="sub-title">${won ? `${fmt(st.price)} コインで落札` : `${st.leader.name}が ${fmt(st.price)} コインで落札`}</div>
        <div class="hall-stage">${lotArt(lot, 160)}<div class="hall-ped"></div></div>
        <div class="auc-name">${lotName(lot)}</div>
        <div class="rv-tags">${tags}</div>
        <button class="btn big primary" id="aok">${sess.cur < sess.lots.length ? `次の品へ（LOT ${sess.cur + 1}）` : '閉じる'}</button>
      </div>`);
      $('#screens').appendChild(ov);
      if (lot.kind !== 'bundle') mountLiveGem($('.hall-stage .lot-art img', ov), lot.gem);
      guard($('#aok', ov), 600);
      $('#aok', ov).onclick = () => { audio.tap(); showAtelier(tab); };
    }, 900);
  }
}
