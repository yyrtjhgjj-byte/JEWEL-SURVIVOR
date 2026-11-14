// ジュエル・アトリエの画面：作った宝石の棚と、カット・色・質感を選んで作る画面
import { save, persist } from './save.js';
import { audio } from './audio.js';
import { show, el, $, topbar, toast } from './ui.js';
import { gemIcon } from './render.js';
import { GEM_LOOK, mountLiveGem, reloadLiveGem, forgetGemImage } from './gem-gl.js';
import { openGemView, LOUPE } from './gem-view.js';
import {
  MY_MAX, CLEAR_CUTS, CAB_CUTS, PATTERNS, usesColor2, blankGem, lookOf, myGems, myGem, registerMyGems, saveMyGem, deleteMyGem, hsv,
} from './mygems.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const nameOf = (g) => esc(g.name || '名前のない宝石');
const lite = () => document.documentElement.classList.contains('lite');

// ---------------------------------------------------------------- 棚
export function showMyGems(back) {
  registerMyGems();
  const list = myGems();
  const node = el(`
    <div class="screen mg-screen" data-nav="jewel">
      ${topbar('JEWEL ATELIER', 'ジュエル・アトリエ', `<div class="mg-count"><b>${list.length}</b><small>/ ${MY_MAX}</small></div>`, 'mygems')}
      <div class="mg-grid">
        ${list.map((g) => `<button class="mg-tile ${save.myHome === g.id ? 'home' : ''}" data-id="${g.id}" style="--c:${GEM_LOOK[g.id].meta.color}">
          <span class="mg-art"><img src="${gemIcon(g.id)}" alt=""></span><span class="mg-name">${nameOf(g)}</span>${save.myHome === g.id ? '<i class="mg-pin">HOME</i>' : ''}</button>`).join('')}
        ${list.length < MY_MAX ? '<button class="mg-tile mg-new" id="mgnew"><span class="mg-plus">＋</span><span class="mg-name">新しく作る</span></button>' : ''}
      </div>
    </div>`);
  show(node);
  $('#back', node).onclick = () => { audio.tap(); back(); };
  const nw = $('#mgnew', node);
  if (nw) nw.onclick = () => { audio.select(); openEditor(null, () => showMyGems(back)); };
  node.querySelectorAll('.mg-tile[data-id]').forEach((b) => (b.onclick = () => { audio.tap(); showMyGem(b.dataset.id, back); }));
}

// 押した宝石の画面：大きく見せて、眺める（鑑賞モード）・作り直す・ホームに飾る・複製・消す
const kindName = (g) => (g.kind === 'clear' ? '透明な石' : '丸く磨いた石');
const cutName = (g) => ((g.kind === 'clear' ? CLEAR_CUTS : CAB_CUTS).find((c) => c[0] === g.cut) || [0, '-'])[1];
const swatch = (h, s, v) => { const [r, gg, b] = hsv(h, s, v).map((c) => Math.round(c * 255)); return `<i class="mg-sw" style="background:rgb(${r},${gg},${b})"></i>`; };
const pct = (v) => `${Math.round(v * 100)}`;
function showMyGem(id, back) {
  const g = myGem(id);
  if (!g) { showMyGems(back); return; }
  const clear = g.kind === 'clear';
  const rows = [
    ['種類', kindName(g)],
    ['カット', cutName(g)],
    ['色', `${swatch(g.h, g.s, clear ? 1 : 1 - g.v * 0.6)}${clear && g.bi ? swatch(g.h2, g.s2, 1) : ''}${!clear && usesColor2(g) ? swatch(g.h2, g.s2, 0.9) : ''}`],
    ...(clear
      ? [['輝き', pct(g.brill)], ['ファイア', pct(g.fire)], ['にごり', pct(g.fog)]]
      : [['模様', (PATTERNS.find((p) => p[0] === g.pat) || PATTERNS[0])[1]]]),
  ];
  const node = el(`
    <div class="screen mg-detail" data-nav="jewel" style="--c:${GEM_LOOK[id].meta.color}">
      ${topbar('MY JEWEL', nameOf(g), null, 'mygems')}
      <div class="mg-stage"><img class="mg-hero" src="${gemIcon(id)}" alt=""><button class="mg-loupe" id="mgview" aria-label="眺める">${LOUPE}</button></div>
      <div class="mg-spec">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
      <div class="mg-acts">
        <button class="btn primary" id="mgedit">作り直す</button>
        <button class="btn" id="mghome">${save.myHome === id ? 'ホームから外す' : 'ホームに飾る'}</button>
        ${myGems().length < MY_MAX ? '<button class="btn" id="mgcopy">複製</button>' : ''}
        <button class="btn" id="mgdel">消す</button>
      </div>
    </div>`);
  show(node);
  const img = $('.mg-hero', node);
  setTimeout(() => mountLiveGem(img, id), 60);
  $('#back', node).onclick = () => { audio.tap(); showMyGems(back); };
  $('#mgview', node).onclick = () => { audio.select(); openGemView(id, () => mountLiveGem(img, id)); };
  $('#mgedit', node).onclick = () => { audio.select(); openEditor(g, () => showMyGem(id, back)); };
  $('#mghome', node).onclick = (e) => {
    audio.select();
    const on = save.myHome !== id;
    save.myHome = on ? id : null;
    persist();
    e.currentTarget.textContent = on ? 'ホームから外す' : 'ホームに飾る';
    toast(on ? 'ホームに飾りました' : 'ホームから外しました', g.name || '名前のない宝石', 'MY JEWEL');
  };
  const cp = $('#mgcopy', node);
  if (cp) cp.onclick = () => { audio.select(); openEditor({ ...g, id: '', name: g.name ? `${g.name.slice(0, 13)} 2` : '' }, () => showMyGems(back)); };
  let armed = false;
  $('#mgdel', node).onclick = (e) => {
    if (!armed) { armed = true; e.currentTarget.textContent = 'もう一度押して消す'; e.currentTarget.classList.add('warn'); audio.tap(); return; }
    audio.whoosh();
    deleteMyGem(id);
    showMyGems(back);
  };
}

// ---------------------------------------------------------------- 作る
const DRAFT = 'my__draft';
const sl = (k, name, cls = '') => `<label class="gv-sl mg-sl ${cls}"><span>${name}</span><input type="range" data-k="${k}" min="0" max="1" step="0.005"><output></output></label>`;
const chips = (key, items, on) => `<div class="mg-chips" data-key="${key}">${items.map(([v, t]) => `<button class="chip ${v === on ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}</div>`;

export function openEditor(src, back) {
  const d = src ? { ...src } : blankGem(false);
  const node = el(`
    <div class="screen mg-edit">
      ${topbar(src && src.id ? 'REMAKE' : 'CREATE', src && src.id ? '作り直す' : '宝石を作る', null, 'mygems#make')}
      <div class="mg-prev"><img class="mg-big" alt=""></div>
      <div class="mg-ctl" id="mgctl"></div>
      <div class="mg-foot"><button class="btn" id="mgrand">ランダム</button><button class="btn primary" id="mgsave">${src && src.id ? '保存' : '作る'}</button></div>
    </div>`);
  show(node);
  const img = $('.mg-big', node);
  const ctl = $('#mgctl', node);
  $('#back', node).onclick = () => { audio.tap(); back(); };

  // 見本：見た目を登録し直して、その場で描き直す（低負荷モードは画像を描き直す）
  let queued = false, bakeT = 0;
  const preview = (now = false) => {
    GEM_LOOK[DRAFT] = lookOf(d);
    node.style.setProperty('--c', GEM_LOOK[DRAFT].meta.color);
    if (lite() || !img.src) {
      clearTimeout(bakeT);
      bakeT = setTimeout(() => { forgetGemImage(DRAFT); img.src = gemIcon(DRAFT); }, now ? 0 : 180);
      if (lite()) return;
    }
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; if (node.isConnected && !reloadLiveGem(img, DRAFT)) mountLiveGem(img, DRAFT); });
  };

  const paint = (inp) => { inp.style.setProperty('--p', `${inp.value * 100}%`); inp.nextElementSibling.textContent = Math.round(inp.value * 100); };
  // 色合いのつまみの帯は虹、鮮やかさ・濃さはいまの色合いのグラデーション
  const tracks = () => {
    const css = (h, s, v) => { const [r, g, b] = hsv(h, s, v).map((c) => Math.round(c * 255)); return `rgb(${r},${g},${b})`; };
    const set = (k, a, b) => { const i = ctl.querySelector(`input[data-k="${k}"]`); if (i) i.parentElement.style.setProperty('--track', `linear-gradient(90deg, ${a}, ${b})`); };
    set('s', css(d.h, 0, 0.9), css(d.h, 1, 1));
    set('v', css(d.h, d.s, 1), css(d.h, d.s, 0.25));
    set('s2', css(d.h2, 0, 0.9), css(d.h2, 1, 1));
  };
  const render = () => {
    const clear = d.kind === 'clear';
    ctl.innerHTML = `
      <div class="mg-h">種類</div>
      ${chips('kind', [['clear', '透明な石'], ['cab', '丸く磨いた石']], d.kind)}
      <div class="mg-h">カット</div>
      ${chips('cut', clear ? CLEAR_CUTS : CAB_CUTS, d.cut)}
      ${clear ? '' : `<div class="mg-h">模様</div>${chips('pat', PATTERNS.map(([v, t]) => [v, t]), d.pat)}`}
      <div class="mg-h">色</div>
      ${sl('h', '色合い', 'hue')}${sl('s', '鮮やかさ', 'grad')}${sl('v', '濃さ', 'grad')}
      ${clear ? `<div class="mg-h">2 色目</div>${chips('bi', [['0', 'なし'], ['1', 'バイカラー']], d.bi ? '1' : '0')}` : ''}
      ${usesColor2(d) ? `${clear ? '' : `<div class="mg-h">${d.pat === 'sheen' ? '光の色' : '2 色目'}</div>`}${sl('h2', '色合い', 'hue')}${sl('s2', '鮮やかさ', 'grad')}` : ''}
      ${clear ? `<div class="mg-h">質感</div>${sl('brill', '輝き')}${sl('fire', 'ファイア')}${sl('fog', 'にごり')}` : ''}
      <div class="mg-h">名前</div>
      <input class="mg-name-in" id="mgname" maxlength="16" placeholder="名前のない宝石" value="${esc(d.name || '')}">`;
    for (const inp of ctl.querySelectorAll('input[type=range]')) { inp.value = d[inp.dataset.k]; paint(inp); }
    tracks();
  };
  ctl.addEventListener('input', (e) => {
    const inp = e.target;
    if (inp.id === 'mgname') { d.name = inp.value.slice(0, 16); return; }
    if (!inp.dataset.k) return;
    d[inp.dataset.k] = +inp.value;
    paint(inp);
    tracks();
    preview();
  });
  ctl.addEventListener('click', (e) => {
    const b = e.target.closest('.mg-chips button');
    if (!b) return;
    const key = b.parentElement.dataset.key, v = b.dataset.v;
    audio.tap();
    if (key === 'kind') { if (d.kind === v) return; d.kind = v; d.cut = v === 'clear' ? 'brilliant' : 'cabOval'; }
    else if (key === 'bi') d.bi = v === '1';
    else d[key] = v;
    render();
    preview();
  });
  $('#mgrand', node).onclick = () => {
    audio.select();
    const name = d.name;
    Object.assign(d, blankGem(true), { id: d.id, name });
    render();
    preview(true);
  };
  $('#mgsave', node).onclick = () => {
    const g = saveMyGem({ ...d });
    if (!g) { toast(`作れるのは ${MY_MAX} 個までです`, '', 'MY JEWEL'); return; }
    audio.chestOpen();
    delete GEM_LOOK[DRAFT];
    forgetGemImage(DRAFT);
    back();
  };
  render();
  preview(true);
}
