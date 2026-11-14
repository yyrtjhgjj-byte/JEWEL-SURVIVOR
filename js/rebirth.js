// =====================================================================
//  転生：今のセーブを「前世」としてしまい、まっさらから遊び直す。前世はいつでも今の人生と合わせられる（合流）。
//  合流は前世を土台に、今の人生の分を足す（財布は足す・使った分は戻して足す・記録はよい方・解放はどちらか）。
//  経営・ログインボーナス・設定・スロットは人生をまたいで続く（転生でも消さない）
// =====================================================================
import { save, defaults, replaceSave, pastLife, writePast, clearPast, persist } from './save.js';
import { rankNeed } from './rank.js';
import { BEAST_COST } from './beasts.js';
import { EXCHANGE } from './data.js';
import { STAGES } from './stages.js';
import { fmt } from './util.js';
import { audio } from './audio.js';
import { show, el, $, topbar, coinPill, showTitle, banner, exportBackup, getApp } from './ui.js';

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
const clone = (o) => JSON.parse(JSON.stringify(o));
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// 項目ごとの合わせ方
const addMap = (a = {}, b = {}) => { const r = { ...a }; for (const k in b) r[k] = num(r[k]) + num(b[k]); return r; };
const maxMap = (a = {}, b = {}) => { const r = { ...a }; for (const k in b) r[k] = Math.max(num(r[k]), num(b[k])); return r; };
const orMap = (a = {}, b = {}) => { const r = { ...a }; for (const k in b) if (b[k]) r[k] = r[k] || b[k]; return r; };
// 記録の表（ステージごとの { cleared, heat, best } など）：数はよい方、印はどちらか
function recMap(a = {}, b = {}) {
  const r = clone(a);
  for (const k in b) {
    const x = r[k] || (r[k] = {}), y = b[k] || {};
    for (const f in y) {
      if (typeof y[f] === 'number') x[f] = Math.max(num(x[f]), y[f]);
      else if (y[f]) x[f] = x[f] || y[f];
    }
  }
  return r;
}
// ユーザーランク：経験値の合計にして足し、ランクを数え直す
const rankXp = (r) => { let t = num(r && r.xp); for (let l = 1; l < num(r && r.lv); l++) t += rankNeed(l); return t; };
function rankFromXp(t) {
  let lv = 1;
  while (t >= rankNeed(lv)) { t -= rankNeed(lv); lv++; }
  return { lv, xp: t };
}
// 今の人生で使った分（戻して足す）：工房・上位工房に払ったコイン、覚醒に使ったジェムダスト、百獣に使った宝石
const paidCoins = (N) => num((N.shopPaid || {}).front) + num((N.shopPaid || {}).upper);
const awakenDust = (N) => Object.values(N.awaken || {}).reduce((a, v) => a + num(v), 0) * EXCHANGE.awaken;

// 前世 P と今の人生 N を合わせたセーブ（どちらも書き換えない）。ここに無い項目は前世のまま。
// 経営・ログインボーナス・設定は人生をまたいで続くので、今の人生のものを使う
export function mergeLives(P, N) {
  const R = clone(P);
  R.coins = num(P.coins) + num(N.coins) + paidCoins(N);
  R.totalCoins = num(P.totalCoins) + num(N.totalCoins);
  R.dust = num(P.dust) + num(N.dust) + awakenDust(N);
  R.rough = addMap(P.rough, N.rough);
  R.pickRough = addMap(P.pickRough, N.pickRough);
  const J = R.jewels || (R.jewels = {});
  const nb = N.beasts || {};
  for (const id of new Set([...Object.keys(N.jewels || {}), ...Object.keys(nb)])) {
    const a = J[id] || (J[id] = { n: 0, best: -1, ct: 0, have: 0 }), b = (N.jewels || {})[id] || {};
    a.n = num(a.n) + num(b.n);
    a.have = num(a.have) + num(b.have) + num(nb[id]) * BEAST_COST;
    if (typeof b.best === 'number') a.best = Math.max(typeof a.best === 'number' ? a.best : -1, b.best);
    a.ct = Math.max(num(a.ct), num(b.ct));
  }
  R.stats = addMap(P.stats, N.stats);
  R.kills = addMap(P.kills, N.kills);
  R.best = maxMap(P.best, N.best);
  R.stages = recMap(P.stages, N.stages);
  R.chaosRec = recMap(P.chaosRec, N.chaosRec);
  R.bossRush = maxMap(P.bossRush, N.bossRush);
  R.achievements = orMap(P.achievements, N.achievements);
  R.unlocked = orMap(P.unlocked, N.unlocked);
  R.migrated = orMap(P.migrated, N.migrated);
  const seen = R.seen || (R.seen = {});
  for (const k in N.seen || {}) {
    const v = N.seen[k];
    seen[k] = v && typeof v === 'object' ? orMap(seen[k], v) : seen[k] || v;
  }
  R.chaosOpen = !!(P.chaosOpen || N.chaosOpen);
  R.upperShop = !!(P.upperShop || N.upperShop);
  R.rank = rankFromXp(rankXp(P.rank) + rankXp(N.rank));
  R.lastBackup = Math.max(num(P.lastBackup), num(N.lastBackup));
  for (const k of ['biz', 'login', 'settings', 'slot']) { const v = N[k] === undefined ? P[k] : N[k]; R[k] = v === undefined ? undefined : clone(v); }
  // 伝説の宝石：進んでいる方を残し、もう片方に払った分は戻す（コインはコインへ、会社の資金で払った分は会社へ）
  const PL = P.legends || {}, NL = N.legends || {};
  const prog = (x) => (x ? (x.done ? 1e9 : num(x.step)) : -1);
  const back = (x) => {
    if (!x) return;
    R.coins += Math.max(0, num(x.paid) - num(x.paidBiz));
    if (R.biz && num(x.usd) > 0) { R.biz.cash = num(R.biz.cash) + num(x.usd); R.biz.legendPaid = Math.max(0, num(R.biz.legendPaid) - num(x.paidBiz)); }
    else R.coins += num(x.paidBiz);
  };
  R.legends = clone(PL);
  for (const id in NL) {
    const a = PL[id], b = NL[id];
    if (prog(b) > prog(a)) { R.legends[id] = clone(b); back(a); }
    else back(b);
  }
  delete R.pendingRun;
  return R;
}

// ---------------------------------------------------------------- 転生と合流
// 前世には、その中に入っている人生の印（folded）と、続く人生の印（next）を書く。書いている途中で落ちても、
// 次の起動の checkPast で、二重に足したり失ったりしないように直す
const lifeOf = (s) => s.life || { id: null, n: 0 };

// まっさらな人生（経営・ログインボーナス・設定・研磨の練習を見たかは引き継ぐ）
function freshLife(id, n) {
  const d = defaults();
  d.biz = save.biz;
  d.slot = save.slot;
  d.login = save.login;
  d.settings = save.settings;
  d.lastBackup = save.lastBackup;
  d.migrated = { ...save.migrated };
  d.seen.polishTut = (save.seen || {}).polishTut;
  d.life = { id, n };
  return d;
}

// 転生する。前世があれば先に今の人生を合わせてから、まとめてしまう。うまくいけば true
export function rebirth() {
  if (save.pendingRun) return false;
  if (!save.life || !save.life.id) {
    save.life = { id: newId(), n: lifeOf(save).n };
    if (!persist()) return false;
  }
  const P = pastLife();
  const base = P ? mergeLives(P, save) : clone(save);
  delete base.pendingRun;
  base.biz = null;
  base.folded = [...((P && P.folded) || []), save.life.id];
  base.next = newId();
  delete base.merging;
  if (!writePast(base)) return false;
  if (finishRebirth(base)) return true;
  // まっさらにできなかった：前世を元に戻す（今の人生はそのまま続ける）
  if (P) writePast(P);
  else clearPast();
  return false;
}
// 前世をしまったあと、今の人生をまっさらにする
function finishRebirth(P) {
  return replaceSave(freshLife(P.next, lifeOf(save).n + 1));
}

// 前世と合わせて、今の人生を終える。うまくいけば true
export function mergePast() {
  const P = pastLife();
  if (!P || save.pendingRun) return false;
  const R = mergeLives(P, save);
  delete R.folded;
  delete R.next;
  delete R.merging;
  R.life = { id: newId(), n: lifeOf(save).n };
  // 先に「合わせている途中」の印を前世に書く（合わせたセーブを書いたあと落ちても、前世をもう一度足さないように）
  if (!writePast({ ...P, merging: R.life.id })) return false;
  if (!replaceSave(R)) {
    writePast(P);
    return false;
  }
  clearPast();
  return true;
}

// 起動時：転生・合流の途中で落ちていたら続きをする
export function checkPast() {
  const P = pastLife();
  if (!P) return;
  const id = lifeOf(save).id;
  if (P.merging) {
    if (P.merging === id) clearPast();
    else { const { merging, ...rest } = P; writePast(rest); }
    return;
  }
  // 前世をしまったが、今の人生をまっさらにする前に落ちた
  if (P.next !== id && (P.folded || []).includes(id)) finishRebirth(P);
}

// ---------------------------------------------------------------- 画面
const jewelCount = (s) => Object.values(s.jewels || {}).reduce((a, r) => a + num(r.have), 0);
const roughCount = (s) => Object.values(s.rough || {}).reduce((a, v) => a + num(v), 0);
const clearCount = (s) => STAGES.filter((st) => ((s.stages || {})[st.id] || {}).cleared).length;
const achCount = (s) => Object.values(s.achievements || {}).filter(Boolean).length;
const SUM_ROWS = [
  ['コイン', (s) => fmt(num(s.coins))],
  ['宝石', (s) => `${fmt(jewelCount(s))} 個`],
  ['原石', (s) => `${fmt(roughCount(s))} 個`],
  ['クリアしたステージ', (s) => `${clearCount(s)} / ${STAGES.length}`],
  ['実績', (s) => achCount(s)],
  ['ユーザーランク', (s) => num((s.rank || {}).lv) || 1],
];

export function rebirthCardText() {
  const P = pastLife();
  return P ? `転生 ${lifeOf(save).n} 回目` : 'まっさらから遊び直す';
}

export function showRebirth(back) {
  const P = pastLife();
  const R = P ? mergeLives(P, save) : null;
  const n = lifeOf(save).n;
  const busy = !!save.pendingRun;
  const rows = (s) => SUM_ROWS.map(([k, f]) => `<div class="rb-row"><span>${k}</span><b>${f(s)}</b></div>`).join('');
  const node = el(`
    <div class="screen rebirth-screen" data-nav="more">
      ${topbar('REBIRTH', '転生', coinPill(), 'rebirth')}
      ${P ? `
      <div class="rb-life">転生 <b>${n}</b> 回目</div>
      <div class="panel rb-panel"><div class="rb-h">前世</div>${rows(P)}</div>
      <div class="panel rb-panel"><div class="rb-h">前世と合わせると</div>${SUM_ROWS.map(([k, f]) => `<div class="rb-row"><span>${k}</span><b><small>${f(save)} →</small> ${f(R)}</b></div>`).join('')}</div>
      <p class="rb-note">合わせると、今の人生は終わって前世に戻ります。工房に払ったコインと、百獣に使った宝石も戻して足します。</p>
      <button class="btn big primary rb-go" id="rb-merge" ${busy ? 'disabled' : ''}>前世と合わせる</button>
      <button class="btn small rb-again" id="rb-again" ${busy ? 'disabled' : ''}>合わせてから、もう一度転生する</button>`
      : `
      <div class="panel rb-panel">
        <p class="rb-lead">今のデータを「前世」としてしまい、まっさらから遊び直します。前世とは、いつでも合わせられます。</p>
        <div class="rb-h">まっさらに戻るもの</div>
        <p class="rb-p">コイン・工房・ステージ・ジュエル・宝石と原石・百獣・実績・図鑑・ユーザーランク など</p>
        <div class="rb-h">そのまま続くもの</div>
        <p class="rb-p">経営・ログインボーナス・設定・スロット</p>
      </div>
      <div class="panel rb-panel"><div class="rb-h">今のデータ</div>${rows(save)}</div>
      <button class="btn big primary rb-go" id="rb-go" ${busy ? 'disabled' : ''}>転生する</button>`}
      ${busy ? '<p class="rb-note">中断したランがあります。先にランを終えてください。</p>' : ''}
    </div>`);
  show(node);
  $('#back', node).onclick = () => { audio.tap(); back(); };
  const go = $('#rb-go', node), merge = $('#rb-merge', node), again = $('#rb-again', node);
  if (go) go.onclick = () => { audio.tap(); confirmBox('rebirth', back); };
  if (merge) merge.onclick = () => { audio.tap(); confirmBox('merge', back); };
  if (again) again.onclick = () => { audio.tap(); confirmBox('again', back); };
}

// 確かめる画面：バックアップの書き出しをすすめ、2 回押すと実行する
const CONFIRM = {
  rebirth: { t: '転生する', p: '今のデータを前世としてしまい、まっさらから始めます。', run: rebirth, done: ['REBIRTH', '前世をしまいました'] },
  merge: { t: '前世と合わせる', p: '前世に今の人生の分を足して、今の人生を終えます。', run: mergePast, done: ['REUNION', '前世と合わせました'] },
  again: { t: 'もう一度転生する', p: '前世に今の人生の分を足してしまい、また まっさらから始めます。', run: rebirth, done: ['REBIRTH', '前世に足してしまいました'] },
};
function confirmBox(kind, back) {
  const C = CONFIRM[kind];
  const ov = el(`<div class="screen dim rb-over">
    <div class="panel rb-confirm">
      <div class="rb-ct">${C.t}</div>
      <p class="rb-p">${C.p}</p>
      <p class="rb-p muted">念のため、先にバックアップを書き出しておくと安心です。</p>
      <button class="btn small" id="rb-bk">バックアップを書き出す</button>
      <button class="btn primary" id="rb-yes">${C.t}</button>
      <button class="btn small" id="rb-no">やめる</button>
    </div></div>`);
  $('#screens').appendChild(ov);
  let armed = false;
  $('#rb-bk', ov).onclick = async () => { audio.tap(); if (await exportBackup()) $('#rb-bk', ov).textContent = '書き出しました'; };
  $('#rb-no', ov).onclick = () => { audio.tap(); ov.remove(); };
  $('#rb-yes', ov).onclick = () => {
    if (!armed) { armed = true; audio.tap(); $('#rb-yes', ov).textContent = 'もう一度押すと実行'; return; }
    const ok = C.run();
    ov.remove();
    if (!ok) {
      audio.tap();
      alert('保存できませんでした。端末の空き容量を確認してください。データはそのままです。');
      showRebirth(back);
      return;
    }
    const app = getApp();
    if (app && app.migrateSave) app.migrateSave();
    persist();
    audio.levelUp();
    showTitle();
    banner(C.done[0], 'item', C.done[1]);
  };
}
