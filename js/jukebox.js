// =====================================================================
//  ジュークボックス：ゲームの BGM を聴く画面（記録のハブの JUKEBOX）
//  ステージの曲はそのステージを解放すると、ボス戦などの曲はゲーム中に一度流れると聴ける
// =====================================================================
import { ENEMIES } from './data.js';
import { STAGES, CHAPTERS } from './stages.js';
import { audio, FEVER_TEMPO } from './audio.js';
import { save, persist } from './save.js';
import { show, el, $, topbar, stageUnlocked } from './ui.js';
import { showHub } from './menu.js';

const heard = (id) => !!(save.seen.bgm && save.seen.bgm[id]);
// 章ごとのボス戦の曲（ステージの bossBgm・finalBgm。第1章は boss・final）
const BOSS_BGM = {
  boss: ['ボス戦', 'BOSS BATTLE', '#ff3ddc'],
  final: ['最終ボス戦', 'FINAL BOSS', '#ff5f7a'],
  boss2: ['ボス戦', 'BOSS BATTLE', '#5fd0ff'],
  final2: ['旧支配者との戦い', 'THE GREAT OLD ONES', '#7a6bff'],
  boss3: ['ボス戦', 'BOSS BATTLE', '#ffb03d'],
  shikyou: ['四凶との戦い', 'THE FOUR FIENDS', '#ff5a3d'],
  boss4: ['ボス戦', 'BOSS BATTLE', '#c8ccff'],
  opus: ['大いなる業', 'MAGNUM OPUS', '#ffd27a'],
};
// 旧曲のない曲（作り直したあとに足した曲）
export const NEW_ONLY = new Set(['casino', 'boss2', 'final2', 'boss3', 'calcinatio', 'solutio', 'separatio', 'coniunctio', 'fermentatio', 'distillatio', 'coagulatio', 'boss4', 'opus']);
// その章の中ボスに会ったか・ステージをどれかクリアしたか
const midSeen = (ch) => STAGES.some((s) => s.chapter === ch && s.events.some((e) => e.type === 'boss' && e.enemy !== s.finalBoss && save.seen.enemies && save.seen.enemies[e.enemy]));
const chCleared = (ch) => STAGES.some((s) => s.chapter === ch && save.stages[s.id] && save.stages[s.id].cleared);

// 曲の一覧（sec は見出し）。open は聴けるかどうか、lock は聴けないときの説明
export function trackList() {
  const list = [
    { sec: '共通' },
    { id: 'title', name: 'タイトル', en: 'TITLE', color: '#b45cff', open: true },
    { id: 'result', name: 'リザルト', en: 'RESULT', color: '#ffd24a', open: true },
    { id: 'business', name: '経営', en: 'BUSINESS', color: '#4ade9a', open: heard('business') || !!save.biz, lock: '🔒 経営を開くと解放' },
    { id: 'casino', name: 'ジュエル・スロット', en: 'CASINO', color: '#ff7ac8', open: heard('casino'), lock: '🔒 ジュエル・スロットを開くと解放' },
  ];
  for (const ch of CHAPTERS) {
    // 曲をまだ作っていない章（ステージの tempBgm。仮に既存の曲を流している）は出さない
    if (STAGES.some((s) => s.chapter === ch.no && s.tempBgm)) continue;
    list.push({ sec: ch.name });
    for (const st of STAGES.filter((s) => s.chapter === ch.no)) {
      const open = stageUnlocked(st);
      list.push({ id: st.bgm, name: st.name, en: st.en, no: st.no, color: st.pal.accent, open, lock: '🔒 前のステージをクリアで解放' });
      if (st.id === 'azathoth') {
        const cl = save.stages.azathoth && save.stages.azathoth.cleared;
        list.push({ id: 'azathoth', name: `${ENEMIES.azathoth.name}（目覚め）`, en: 'AWAKENING', no: st.no, color: '#ff5fd2', open: open && (heard('azathoth') || cl) });
      }
    }
    // 章のボス戦の曲。一度流れるか、中ボスは会うと・最終ボスはその章のステージをどれかクリアすると聴ける
    const sts = STAGES.filter((s) => s.chapter === ch.no);
    for (const [id, fin] of [[sts[0].bossBgm || 'boss', false], [sts[0].finalBgm || 'final', true]]) {
      const [name, en, color] = BOSS_BGM[id];
      list.push({ id, name, en, color, open: heard(id) || (fin ? chCleared(ch.no) : midSeen(ch.no) || chCleared(ch.no)), lock: '🔒 ゲーム中に流れると解放' });
    }
  }
  return list;
}

export function showJukebox() {
  const node = el(`
    <div class="screen jukebox-screen" data-nav="archive">
      ${topbar('JUKEBOX', 'ジュークボックス', null, 'records#jukebox')}
      <div class="panel jb-now">
        <div class="jb-disc" id="jbd"></div>
        <div class="jb-nb"><div class="label">NOW PLAYING</div><b id="jbn"></b></div>
        <button class="btn small" id="jbs">停止</button>
      </div>
      <div class="tabs sub jb-mode">${[['new', '新曲'], ['old', '旧曲']].map(([k, n]) => `<button class="tab" data-m="${k}">${n}</button>`).join('')}</div>
      ${save.settings.bgm <= 0 ? '<div class="hint">BGM の音量が 0 です（設定で変更できます）</div>' : ''}
      <div class="jb-list" id="jbl"></div>
      <div class="jb-fever-dock"><button class="jb-fever" id="jbf">FEVER</button></div>
    </div>`);
  show(node);
  const list = trackList();
  const byId = Object.fromEntries(list.filter((t) => t.id).map((t) => [t.id, t]));
  const playing = () => (audio.bgmTrack ? audio.bgmTrack.name : audio.ready ? null : audio.pendingTrack || null);
  // 新曲（チップ音源）と旧曲（前の BGM）の切り替え。save.tabs.jbOld に覚える
  const isOld = () => !!save.tabs.jbOld;
  const play = (id) => (isOld() ? audio.playOldBgm(id) : audio.playBgm(id));
  // FEVER：ゲームのフィーバーと同じ速さで流す（切り替え式。ほかの画面に移ると menu.js の syncNav が戻す）
  let fever = false;
  const tempo = () => { audio.tempoMul = fever ? FEVER_TEMPO : 1; };
  // 旧曲のときは、旧曲のない曲を押せなくする
  const avail = (t) => t.open && !(isOld() && NEW_ONLY.has(t.id));
  const enText = (t) => (!t.open ? t.lock || '🔒 ゲーム中に流れると解放' : !avail(t) ? '旧曲なし' : (t.no ? `STAGE ${t.no} ・ ` : '') + t.en);
  const render = () => {
    const cur = playing();
    const t = cur && byId[cur];
    $('#jbn', node).textContent = t && t.open ? `${t.name}${audio.bgmTrack && audio.bgmTrack.old ? '（旧曲）' : ''}` : '—';
    node.querySelectorAll('.jb-mode .tab').forEach((b) => b.classList.toggle('on', (b.dataset.m === 'old') === isOld()));
    $('#jbd', node).style.setProperty('--c', t ? t.color : '#5a5670');
    $('#jbd', node).classList.toggle('on', !!t);
    $('#jbs', node).disabled = !cur;
    node.querySelectorAll('.jb-row').forEach((r) => {
      const tr = byId[r.dataset.id];
      r.classList.toggle('on', r.dataset.id === cur);
      r.classList.toggle('locked', !avail(tr));
      r.disabled = !avail(tr);
      r.querySelector('.jb-en').textContent = enText(tr);
    });
  };
  const box = $('#jbl', node);
  let n = 0;
  for (const t of list) {
    if (t.sec) { box.appendChild(el(`<div class="label jb-sec">${t.sec}</div>`)); continue; }
    n++;
    const row = el(`<button class="jb-row" data-id="${t.id}" style="--c:${t.color}">
      <span class="jb-no">${String(n).padStart(2, '0')}</span>
      <span class="jb-body"><span class="jb-name">${t.open ? t.name : '？？？'}</span><span class="jb-en"></span></span>
      <span class="jb-eq"><i></i><i></i><i></i></span>
    </button>`);
    row.onclick = () => {
      if (!avail(t)) return;
      audio.unlock();
      tempo();
      if (playing() === t.id && !!(audio.bgmTrack && audio.bgmTrack.old) === isOld()) audio.stopBgm();
      else play(t.id);
      render();
    };
    box.appendChild(row);
  }
  $('#jbs', node).onclick = () => { audio.tap(); audio.stopBgm(); audio.pendingTrack = null; render(); };
  // 切り替えると、流れている曲をもう一方で流し直す
  node.querySelectorAll('.jb-mode .tab').forEach((b) => {
    b.onclick = () => {
      const old = b.dataset.m === 'old';
      if (old === isOld()) return;
      audio.tap();
      save.tabs.jbOld = old;
      persist();
      const cur = audio.bgmTrack && audio.bgmTrack.name;
      if (cur && byId[cur] && avail(byId[cur])) { audio.unlock(); tempo(); play(cur); }
      else if (cur && byId[cur]) audio.stopBgm();
      render();
    };
  });
  const fb = $('#jbf', node);
  fb.onclick = () => {
    fever = !fever;
    audio.unlock();
    audio.tap();
    tempo();
    fb.classList.toggle('on', fever);
  };
  $('#back', node).onclick = () => { audio.tap(); showHub('archive'); };
  render();
}
