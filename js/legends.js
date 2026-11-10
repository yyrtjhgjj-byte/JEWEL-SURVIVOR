// =====================================================================
//  伝説の宝石の画面：名石の一覧 → 来歴の工程（1 つずつ払って進める。割る・磨く・彫るはミニゲーム）→ 完成のお披露目
//  中身（名石と工程と値段）は legends-data.js
// =====================================================================
import { LEGENDS, LEGEND_BY_ID, LEGEND_GAMES, LEGEND_PASS, LEGEND_DMG, legendTotal, legendsDone } from './legends-data.js';
import { save, persist } from './save.js';
import { coinIcon } from './render.js';
import { gemImage, mountLiveGem } from './gem-gl.js';
import { fmt } from './util.js';
import { audio } from './audio.js';
import { show, el, $, topbar, coinPill, refreshCoinPill, haptic, getApp, guard } from './ui.js';
import { polishMini } from './atelier-ui.js';

export function legendState(id) {
  if (!save.legends || typeof save.legends !== 'object') save.legends = {};
  const st = save.legends[id] || (save.legends[id] = { step: 0, paid: 0, done: false });
  return st;
}
export const legendCardText = () => `完成 ${legendsDone(save)} / ${LEGENDS.length}`;
const coinTag = (n) => `<span class="lg-coin"><img src="${coinIcon(40)}" alt="">${fmt(n)}</span>`;
// 名石の絵：本物のカットで書き出した画像（gem-gl.js の GEM_LOOK の lg_〜）。詳細とお披露目はその場で描く
const lookId = (L) => `lg_${L.id}`;
const icon = (L, cls = 'lg-ic') => `<span class="${cls}"><img src="${gemImage(lookId(L))}" alt=""></span>`;
// 高い支払いは 2 回押す
const BIG_PAY = 1000000;

// ---------------------------------------------------------------- 一覧
export function showLegends(back) {
  const n = legendsDone(save);
  const node = el(`
    <div class="screen legends-screen" data-nav="jewel">
      ${topbar('LEGENDS', '伝説の宝石', coinPill(), 'legends')}
      <div class="lg-sum">完成 <b>${n}</b> / ${LEGENDS.length}<span>与ダメージ <b>+${Math.round(n * LEGEND_DMG * 100)}%</b></span></div>
      <div class="lg-list">${LEGENDS.map((L) => {
        const st = legendState(L.id), total = legendTotal(L), left = L.steps.slice(st.step).reduce((a, s) => a + s.cost, 0);
        return `<button class="lg-card ${st.done ? 'done' : ''}" data-id="${L.id}">
          ${icon(L)}
          <div class="lg-ct"><div class="lg-en">${L.en}</div><div class="lg-name">${L.name}</div>
            <div class="lg-spec">${L.cut}・${L.ct} ct</div>
            <div class="lg-bar"><i style="width:${(st.step / L.steps.length) * 100}%"></i></div>
            <div class="lg-left">${st.done ? '<b class="lg-ok">完成</b>' : `工程 ${st.step} / ${L.steps.length}・のこり ${coinTag(left)}`}</div>
          </div>
          ${st.done ? '' : `<small class="lg-total">合計 ${fmt(total)}</small>`}
        </button>`;
      }).join('')}</div>
    </div>`);
  show(node);
  $('#back', node).onclick = () => { audio.tap(); back(); };
  node.querySelectorAll('.lg-card').forEach((b) => (b.onclick = () => { audio.select(); openLegend(b.dataset.id, back); }));
}

// ---------------------------------------------------------------- 名石の工程
export function openLegend(id, back, afterShow) {
  const L = LEGEND_BY_ID[id];
  const st = legendState(id);
  const node = el(`
    <div class="screen legend-screen" data-nav="jewel">
      ${topbar(L.en, L.name, coinPill(), 'legends')}
      <div class="lg-head">${icon(L, 'lg-big')}
        <div class="lg-rows">
          <div><span>カット</span><b>${L.cut}</b></div>
          <div><span>カラット</span><b>${L.ct} ct</b></div>
          <div><span>色</span><b>${L.color}</b></div>
          <div><span>今ある場所</span><b>${L.home}</b></div>
          ${L.value ? `<div><span>値打ち</span><b>${L.value}</b></div>` : ''}
        </div>
      </div>
      <div class="lg-steps" id="lgs"></div>
    </div>`);
  show(node);
  $('#back', node).onclick = () => { audio.tap(); showLegends(back); };
  let armed = -1;
  const render = () => {
    const box = $('#lgs', node);
    box.innerHTML = L.steps.map((s, i) => {
      const cls = st.done || i < st.step ? 'done' : i === st.step ? 'now' : 'next';
      const G = s.game && LEGEND_GAMES[s.game];
      const can = save.coins >= s.cost;
      return `<div class="lg-step ${cls}">
        <div class="lg-y">${s.y || '—'}</div>
        <div class="lg-sb">
          <div class="lg-st"><b>${s.t}</b>${G ? `<span class="lg-gm">${G.jp}</span>` : ''}</div>
          <p>${s.d}</p>
          <div class="lg-cost">${coinTag(s.cost)}${s.est ? '<small>推定</small>' : ''}${cls === 'done' ? '<i class="lg-chk">✓</i>' : ''}</div>
          ${cls === 'now' ? `<button class="btn small primary lg-pay" data-i="${i}" ${can ? '' : 'disabled'}>${armed === i ? 'もう一度押すと払う' : G ? `払って${G.jp}` : s.cost ? '払う' : '進める'}</button>` : ''}
        </div>
      </div>`;
    }).join('') + (st.done ? `<div class="lg-fin">完成<span>与ダメージ +${Math.round(LEGEND_DMG * 100)}%</span></div>` : '');
    const pay = $('.lg-pay', box);
    if (pay) pay.onclick = () => {
      const i = +pay.dataset.i, s = L.steps[i];
      if (st.done || i !== st.step || save.coins < s.cost) return;
      if (s.cost >= BIG_PAY && armed !== i) { armed = i; audio.tap(); render(); return; }
      armed = -1;
      save.coins -= s.cost;
      st.paid += s.cost;
      persist();
      refreshCoinPill();
      if (s.cost) audio.coin(); else audio.select();
      if (s.game) { playStep(L, i, back); return; }
      advance(L, back, render);
    };
  };
  render();
  mountLiveGem($('.lg-big img', node), lookId(L));
  if (afterShow) afterShow();
}

// 工程を 1 つ進める（最後なら完成）
function advance(L, back, render) {
  const st = legendState(L.id);
  st.step++;
  if (st.step >= L.steps.length) {
    st.done = true;
    st.at = Date.now();
    persist();
    const app = getApp();
    if (app && app.checkMetaAchievements) app.checkMetaAchievements();
    openLegend(L.id, back, () => complete(L));
    return;
  }
  persist();
  if (render) render();
}

// ミニゲームの工程：合格（精度 LEGEND_PASS 以上）なら進む。不合格は払ったまま、もう一度払ってやり直す。始める前のやめるは返金
function playStep(L, i, back) {
  const s = L.steps[i], G = LEGEND_GAMES[s.game], st = legendState(L.id);
  audio.select();
  polishMini({
    tier: 'mystic', gemId: L.gem, en: G.en, jp: `${L.name}を${G.jp}`, R: G.R,
    quit: () => {
      save.coins += s.cost;
      st.paid -= s.cost;
      persist();
      openLegend(L.id, back);
    },
    done: (score) => {
      const pass = score + 1e-9 >= LEGEND_PASS;
      if (pass) {
        haptic();
        audio.levelUp();
        const last = st.step + 1 >= L.steps.length;
        if (last) { advance(L, back); return; }
        st.step++;
        persist();
        openLegend(L.id, back, () => stepResult(true, score, G));
      } else {
        audio.gameOver();
        openLegend(L.id, back, () => stepResult(false, score, G));
      }
    },
  });
}
function stepResult(ok, score, G) {
  const ov = el(`<div class="screen dim lg-over"><div class="panel lg-res">
    <div class="lg-rt ${ok ? 'ok' : 'ng'}">${ok ? 'SUCCESS' : 'FAILED'}</div>
    <p>${G.jp}　精度 <b>${Math.round(score * 100)}%</b></p>
    <p class="muted">${ok ? '次の工程へ進みます。' : `精度 ${Math.round(LEGEND_PASS * 100)}% 以上で成功です。もう一度払うと、やり直せます。`}</p>
    <button class="btn primary" id="lgok">OK</button></div></div>`);
  $('#screens').appendChild(ov);
  guard(ov, 400);
  $('#lgok', ov).onclick = () => { audio.tap(); ov.remove(); };
}

// 完成のお披露目
function complete(L) {
  const ov = el(`<div class="screen dim lg-over lg-reveal">
    <div class="rays"></div>
    <div class="big-title prism-text">LEGEND</div>
    ${icon(L, 'lg-hero')}
    <div class="lg-rname">${L.name}<span>${L.en}</span></div>
    <div class="panel lg-rinfo">
      <div><span>カット</span><b>${L.cut}</b></div>
      <div><span>カラット</span><b>${L.ct} ct</b></div>
      ${L.value ? `<div><span>値打ち</span><b>${L.value}</b></div>` : ''}
      <div><span>完成した名石</span><b>${legendsDone(save)} / ${LEGENDS.length}・与ダメージ +${Math.round(legendsDone(save) * LEGEND_DMG * 100)}%</b></div>
    </div>
    <button class="btn big primary" id="lgok">OK</button>
  </div>`);
  $('#screens').appendChild(ov);
  mountLiveGem($('.lg-hero img', ov), lookId(L));
  guard(ov, 900);
  audio.bigWin();
  haptic();
  $('#lgok', ov).onclick = () => {
    audio.tap();
    ov.remove();
    const big = document.querySelector('.lg-big img');
    if (big) mountLiveGem(big, lookId(L));
  };
}
