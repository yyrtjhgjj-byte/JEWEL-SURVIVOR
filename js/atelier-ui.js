// =====================================================================
//  研磨工房の画面（研磨ミニゲーム・一括研磨・コレクション）
// =====================================================================
import { GEMS } from './data.js';
import { gemIcon, roughIcon, drawRough } from './render.js';
import { fmt, rand } from './util.js';
import { audio } from './audio.js';
import { save, persist } from './save.js';
import {
  ROUGH, ROUGH_IDS, GRADES, gradeFromScore, COLLECTION_IDS, MASTERY_MAX,
  mastery, nextMilestone, collectionStats, gemBonusText, statText, rollGem, rollCarat, applyPolish, autoGrade,
  collectionCount,
} from './atelier.js';
import { show, el, $, topbar, gemColor, wordTag, refreshCoinPill, guard, haptic, showTitle, getApp } from './ui.js';

const TAU = Math.PI * 2;

function gradeBadge(g, big) {
  const G = GRADES[g];
  return `<span class="grade ${G.color === 'rainbow' ? 'g-rainbow' : ''} ${big ? 'big' : ''}" style="${G.color === 'rainbow' ? '' : `color:${G.color};border-color:${G.color}`}">${G.id}</span>`;
}
function pips(m) {
  return `<span class="mpips">${Array.from({ length: MASTERY_MAX }, (_, i) => `<i class="${i < m ? 'on' : ''}"></i>`).join('')}</span>`;
}
const metaAch = () => { const a = getApp(); if (a && a.checkMetaAchievements) a.checkMetaAchievements(); };

// ================================================================== 画面
export function showAtelier(tab = 'polish') {
  const node = el(`
    <div class="screen">
      ${topbar('ATELIER', '研磨工房')}
      <div class="tabs">
        <button class="tab ${tab === 'polish' ? 'on' : ''}" data-t="polish">研磨</button>
        <button class="tab ${tab === 'collection' ? 'on' : ''}" data-t="collection">コレクション</button>
      </div>
      <div id="at"></div>
    </div>`);
  show(node);
  $('#back', node).onclick = () => { audio.tap(); showTitle(); };
  node.querySelectorAll('.tab').forEach((b) => (b.onclick = () => { audio.tap(); showAtelier(b.dataset.t); }));
  const box = $('#at', node);
  if (tab === 'polish') renderPolish(box);
  else renderCollection(box);
}

// ---------------------------------------------------------------- 研磨タブ
function renderPolish(box) {
  box.innerHTML = '';
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
    原石はエリートやボスを倒すと手に入ります。ステージやヒートが高いほど上位の原石が出やすくなります。
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
    res.push(applyPolish(tier, rollGem(tier), autoGrade(), rollCarat(tier)));
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
function startPolish(tier) {
  const R = ROUGH[tier];
  if (!save.rough[tier] || save.coins < R.cost) return;
  // コインは研磨が終わったとき（原石を消費するのと同時）に払う。途中でアプリが落ちてもコインだけ失わないように
  const gemId = rollGem(tier);
  const g = GEMS[gemId];
  const hint = gemColor(gemId);

  const node = el(`<div class="screen polish-screen">
    <div class="pol-head"><div class="en">POLISHING</div><div class="jp">${R.name}</div>
      <div class="facets">${Array.from({ length: R.facets }, () => '<i></i>').join('')}</div></div>
    <canvas id="pc"></canvas>
    <div class="pol-hint" id="ph">タップで研磨開始</div>
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
  const speed = () => 2.2 * R.speed * (1 + 0.1 * st.facet);
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
    e.preventDefault();
    if (!st.ready) {
      st.ready = true;
      st.goT = 0.8;
      audio.select();
      $('#ph', node).textContent = '光る面に針が重なったらタップ';
      return;
    }
    if (st.done || st.lockT > 0 || st.goT > 0) return;
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
    else if (!st.done && st.ready) {
      st.ang += speed() * dt;
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
    const ct = rollCarat(tier);
    save.coins = Math.max(0, save.coins - R.cost);
    const res = applyPolish(tier, gemId, grade, ct);
    persist();
    st.revealed = true;
    cancelAnimationFrame(raf);
    reveal(res, score);
  }
}

// ---------------------------------------------------------------- 研磨結果
function reveal(res, score) {
  const g = GEMS[res.gemId];
  const G = GRADES[res.grade];
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
    const cell = el(`<button class="coll-cell ${has ? '' : 'none'}" style="--c:${gemColor(id)}">
      <img src="${gemIcon(id, 80)}">
      ${has ? gradeBadge(rec.best) : ''}
      <span class="cm">${has ? `練度 ${m}` : '未入手'}</span>
    </button>`);
    cell.onclick = () => { audio.tap(); gemDetail(id); };
    grid.appendChild(cell);
  }
  box.appendChild(grid);
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
    <div class="panel gem-detail">
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
      <div class="rrow2"><span>研磨数</span><b>${has ? rec.n : 0}</b></div>
      <div class="rrow2"><span>練度</span><b>${m} / ${MASTERY_MAX} ${pips(m)}</b></div>
      <div class="rrow2"><span>ボーナス</span><b>${m ? gemBonusText(id, m) : '—'}</b></div>
      <div class="gd-next">${next.length ? next.join('<br>') : '練度は最大です'}</div>
      ${g.lore ? `<div class="gd-lore">${has ? g.lore : ''}</div>` : ''}
      <button class="btn" id="ok">閉じる</button>
    </div></div>`);
  $('#screens').appendChild(ov);
  $('#ok', ov).onclick = () => { audio.tap(); ov.remove(); };
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
}

