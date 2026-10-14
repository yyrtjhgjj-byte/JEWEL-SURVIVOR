// =====================================================================
//  宝石の鑑賞画面（コレクションの宝石の詳細から開く）
//  大きな宝石をその場で描き（gem-gl.js の mountLiveGem に ctl を渡す）、ドラッグで回す・2 本指で拡大・
//  スライダーで明るさ・ファイア・きらめきを変える・背景を白黒で切り替える。値は保存しない
// =====================================================================
import { GEMS } from './data.js';
import { gemIcon } from './render.js';
import { GEM_LOOK, mountLiveGem } from './gem-gl.js';
import { el, $, topbar, gemColor } from './ui.js';
import { audio } from './audio.js';

// 背景の白黒だけは、アプリを閉じるまで覚えておく（続けて何個も見るときのため）
let lightBg = false;

const ZOOM_MAX = 3;
const PITCH_MAX = 90;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// スライダー：[キー, 名前, 最小, 最大, 刻み]
const SLIDERS = [
  ['exp', '明るさ', 0.3, 2.2, 0.05],
  ['fire', 'ファイア', 0, 4, 0.1],
  ['glint', 'きらめき', 0, 1.5, 0.05],
];
const defaults = (g) => ({ exp: g.exp || 1.2, fire: g.fire == null ? 1.6 : g.fire, glint: 0.6 });

// 虫眼鏡のアイコン
export const LOUPE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M14.6 14.6 20.5 20.5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';

// onClose：閉じたあとに呼ぶ（下の画面の宝石を描き直すため）
export function openGemView(id, onClose) {
  const g = GEMS[id], look = GEM_LOOK[id];
  if (!g || !look) return;
  const clear = look.mode === 'trace';
  const S = { yaw: 0, pitch: 0, zoom: 1, ...defaults(look), rock: true, light: lightBg, drag: false, vx: 0, vy: 0, clock: 0, at: 0, dirty: true, still: false };
  const sliders = SLIDERS.filter(([k]) => k !== 'fire' || clear);
  const node = el(`
    <div class="screen gem-view ${S.light ? 'light' : ''}" style="--c:${gemColor(id)}">
      ${topbar(g.en, g.jp, '<button class="iconbtn gv-bg" id="gvbg" aria-label="背景の白黒"><i></i></button>', 'collection#view')}
      <div class="gv-stage"><img class="gv-gem" src="${gemIcon(id)}" alt="" draggable="false"></div>
      <div class="gv-ctl">
        ${sliders.map(([k, name, lo, hi, st]) => `<label class="gv-sl"><span>${name}</span><input type="range" data-k="${k}" min="${lo}" max="${hi}" step="${st}"><output></output></label>`).join('')}
        <div class="gv-btns"><button class="btn small" id="gvrock">ゆらす</button><button class="btn small" id="gvreset">リセット</button></div>
      </div>
    </div>`);
  $('#screens').appendChild(node);
  const stage = $('.gv-stage', node);

  // スライダーの表示（つまみの位置まで色を塗る・数値）を今の値に合わせる
  const paint = (inp) => {
    const v = S[inp.dataset.k];
    inp.style.setProperty('--p', `${((v - inp.min) / (inp.max - inp.min)) * 100}%`);
    inp.nextElementSibling.textContent = v.toFixed(2);
  };
  const syncUi = () => {
    for (const inp of node.querySelectorAll('.gv-sl input')) {
      inp.value = S[inp.dataset.k];
      paint(inp);
    }
    $('#gvrock', node).classList.toggle('on', S.rock);
  };
  syncUi();
  for (const inp of node.querySelectorAll('.gv-sl input')) {
    inp.oninput = () => {
      S[inp.dataset.k] = +inp.value;
      paint(inp);
      S.dirty = true;
    };
  }
  $('#gvrock', node).onclick = () => { audio.tap(); S.rock = !S.rock; S.dirty = true; syncUi(); };
  $('#gvreset', node).onclick = () => {
    audio.tap();
    Object.assign(S, { yaw: 0, pitch: 0, zoom: 1, vx: 0, vy: 0, clock: 0, ...defaults(look), dirty: true });
    syncUi();
  };
  $('#gvbg', node).onclick = () => {
    audio.tap();
    S.light = lightBg = !S.light;
    node.classList.toggle('light', S.light);
    S.dirty = true;
  };
  const close = () => {
    node.remove();
    if (onClose) onClose();
  };
  $('#back', node).onclick = () => { audio.tap(); close(); };

  // 回す（1 本指）・拡大（2 本指・ホイール）。離したときの勢いで少し回り続ける
  const pts = new Map();
  let pinch = null, lastT = 0;
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    S.drag = true;
    S.vx = S.vy = 0;
    lastT = e.timeStamp;
    if (pts.size === 2) pinch = { d: dist(), z: S.zoom };
  });
  stage.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pinch) {
      if (pts.size >= 2) S.zoom = clamp(pinch.z * dist() / pinch.d, 1, ZOOM_MAX);
    } else {
      const ay = dx * 0.5, ap = dy * 0.4;
      S.yaw += ay;
      S.pitch = clamp(S.pitch + ap, -PITCH_MAX, PITCH_MAX);
      const dt = (e.timeStamp - lastT) / 1000;
      if (dt > 0) {
        S.vx = S.vx * 0.5 + (ay / dt) * 0.5;
        S.vy = S.vy * 0.5 + (ap / dt) * 0.5;
      }
      lastT = e.timeStamp;
    }
    S.dirty = true;
  });
  const up = (e) => {
    if (!pts.delete(e.pointerId)) return;
    if (pinch) {
      // 2 本指を離したら、残りの指では回さない（拡大のあとに急に回らないように）
      S.vx = S.vy = 0;
      if (!pts.size) pinch = null;
    }
    if (pts.size) return;
    S.drag = false;
    if (e.timeStamp - lastT > 80) S.vx = S.vy = 0;
    const v = Math.hypot(S.vx, S.vy);
    if (v > 720) { S.vx *= 720 / v; S.vy *= 720 / v; }
    S.dirty = true;
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    S.zoom = clamp(S.zoom * Math.exp(-e.deltaY * 0.002), 1, ZOOM_MAX);
    S.dirty = true;
  }, { passive: false });

  // gem-gl.js の tick から毎回呼ばれ、描く値を返す（動いていなければ、止まった直後の 1 回だけ返す）
  const ctl = {
    frame(now, force) {
      const dt = S.at ? Math.min(0.1, (now - S.at) / 1000) : 0;
      S.at = now;
      let moving = S.drag || S.dirty;
      if (!S.drag && (S.vx || S.vy)) {
        S.yaw += S.vx * dt;
        S.pitch = clamp(S.pitch + S.vy * dt, -PITCH_MAX, PITCH_MAX);
        const k = Math.exp(-dt * 3.5);
        S.vx *= k;
        S.vy *= k;
        if (Math.hypot(S.vx, S.vy) < 4) S.vx = S.vy = 0;
        moving = true;
      }
      if (S.rock && !S.drag) { S.clock += dt; moving = true; }
      if (!moving && !force) {
        if (S.still) return null;
        S.still = true;
      } else {
        S.still = false;
      }
      S.dirty = false;
      return {
        still: S.still,
        rockT: 10 * Math.sin(S.clock * 0.9),
        rockS: 14 * Math.cos(S.clock * 0.6),
        o: { yaw: S.yaw, pitch: S.pitch, zoom: S.zoom, exp: S.exp, fire: S.fire, glint: S.glint, light: S.light },
      };
    },
  };
  mountLiveGem($('.gv-gem', node), id, ctl);
}
