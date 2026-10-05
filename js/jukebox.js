// =====================================================================
//  ジュークボックス：ゲームの BGM を聴く画面（タイトルの JUKEBOX）
//  ステージの曲はそのステージを解放すると、ボス戦などの曲はゲーム中に一度流れると聴ける
// =====================================================================
import { ENEMIES } from './data.js';
import { STAGES, CHAPTERS } from './stages.js';
import { audio } from './audio.js';
import { save } from './save.js';
import { show, el, $, topbar, showTitle, stageUnlocked } from './ui.js';

const heard = (id) => !!(save.seen.bgm && save.seen.bgm[id]);
const anyCleared = () => STAGES.some((st) => save.stages[st.id] && save.stages[st.id].cleared);
const bossSeen = () => Object.keys(save.seen.enemies || {}).some((id) => ENEMIES[id] && ENEMIES[id].boss);

// 曲の一覧（sec は見出し）。open は聴けるかどうか、lock は聴けないときの説明
function trackList() {
  const list = [
    { sec: '共通' },
    { id: 'title', name: 'タイトル', en: 'TITLE', color: '#b45cff', open: true },
    { id: 'boss', name: 'ボス戦', en: 'BOSS BATTLE', color: '#ff3ddc', open: heard('boss') || bossSeen() },
    { id: 'final', name: '最終ボス戦', en: 'FINAL BOSS', color: '#ff5f7a', open: heard('final') || anyCleared() },
    { id: 'result', name: 'リザルト', en: 'RESULT', color: '#ffd24a', open: true },
  ];
  for (const ch of CHAPTERS) {
    list.push({ sec: ch.name });
    for (const st of STAGES.filter((s) => s.chapter === ch.no)) {
      const open = stageUnlocked(st);
      list.push({ id: st.bgm, name: st.name, en: st.en, no: st.no, color: st.pal.accent, open, lock: '🔒 前のステージをクリアで解放' });
      if (st.id === 'azathoth') {
        const cl = save.stages.azathoth && save.stages.azathoth.cleared;
        list.push({ id: 'azathoth', name: `${ENEMIES.azathoth.name}（目覚め）`, en: 'AWAKENING', no: st.no, color: '#ff5fd2', open: open && (heard('azathoth') || cl) });
      }
    }
  }
  return list;
}

export function showJukebox() {
  const node = el(`
    <div class="screen jukebox-screen">
      ${topbar('JUKEBOX', 'ジュークボックス', '<div style="width:44px"></div>')}
      <div class="panel jb-now">
        <div class="jb-disc" id="jbd"></div>
        <div class="jb-nb"><div class="label">NOW PLAYING</div><b id="jbn"></b></div>
        <button class="btn small" id="jbs">停止</button>
      </div>
      ${save.settings.bgm <= 0 ? '<div class="hint">BGM の音量が 0 です（設定で変更できます）</div>' : ''}
      <div class="jb-list" id="jbl"></div>
    </div>`);
  show(node);
  const list = trackList();
  const byId = Object.fromEntries(list.filter((t) => t.id).map((t) => [t.id, t]));
  const playing = () => (audio.bgmTrack ? audio.bgmTrack.name : audio.ready ? null : audio.pendingTrack || null);
  const render = () => {
    const cur = playing();
    const t = cur && byId[cur];
    $('#jbn', node).textContent = t && t.open ? t.name : '—';
    $('#jbd', node).style.setProperty('--c', t ? t.color : '#5a5670');
    $('#jbd', node).classList.toggle('on', !!t);
    $('#jbs', node).disabled = !cur;
    node.querySelectorAll('.jb-row').forEach((r) => r.classList.toggle('on', r.dataset.id === cur));
  };
  const box = $('#jbl', node);
  let n = 0;
  for (const t of list) {
    if (t.sec) { box.appendChild(el(`<div class="label jb-sec">${t.sec}</div>`)); continue; }
    n++;
    const row = el(`<button class="jb-row ${t.open ? '' : 'locked'}" data-id="${t.id}" style="--c:${t.color}">
      <span class="jb-no">${String(n).padStart(2, '0')}</span>
      <span class="jb-body"><span class="jb-name">${t.open ? t.name : '？？？'}</span><span class="jb-en">${t.open ? (t.no ? `STAGE ${t.no} ・ ` : '') + t.en : t.lock || '🔒 ゲーム中に流れると解放'}</span></span>
      <span class="jb-eq"><i></i><i></i><i></i></span>
    </button>`);
    row.disabled = !t.open;
    row.onclick = () => {
      if (!t.open) return;
      audio.unlock();
      audio.tempoMul = 1;
      if (playing() === t.id) audio.stopBgm();
      else audio.playBgm(t.id);
      render();
    };
    box.appendChild(row);
  }
  $('#jbs', node).onclick = () => { audio.tap(); audio.stopBgm(); audio.pendingTrack = null; render(); };
  $('#back', node).onclick = () => { audio.tap(); showTitle(); };
  render();
}
