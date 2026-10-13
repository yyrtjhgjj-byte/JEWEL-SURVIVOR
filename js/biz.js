// =====================================================================
//  経営（宝石商社）の仕組み：状態・追いつき計算・鉱区・出荷・工場・在庫・売却・配当と出資・ランク
//  DOM と save.js は読まない（Node の tools/test/biz-sim.js からも動かす）。状態は save.biz
// =====================================================================
import { BIZ_GEMS, GRADE_MUL, RANKS, TIER, PLACES, MINES, MINE_LV, STORE_LV, FACTORIES, FACT_LV, CREW, EXCHANGES } from './biz-data.js';

const HOUR = 3600e3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 在庫・原石のキー：宝石|品質|産地（鉱区の id）|処理（0/1）|鑑定書（0/1）
export const lotKey = (gem, g, origin, treat = 0, cert = 0) => `${gem}|${g}|${origin}|${treat}|${cert}`;
export function parseKey(k) {
  const [gem, g, origin, treat, cert] = k.split('|');
  return { gem, g: +g, origin, treat: +treat || 0, cert: +cert || 0 };
}

// ---------------------------------------------------------------- 値打ちの基準
// 原石 1 ct を標準の腕で磨いたときの値打ち（品質 A・相場 1）。工場の仕事の量もこの値で数える
export const refVal = (gem) => { const G = BIZ_GEMS[gem]; return G.base * G.y * Math.pow(G.size, 0.3); };
// 品質の分布（C B A S SS）。q が高いほど良い品質が出る
const LOW = [0.5, 0.3, 0.14, 0.05, 0.01], HIGH = [0.12, 0.28, 0.32, 0.2, 0.08];
export const gradeDist = (q) => { q = clamp(q, 0, 1); return LOW.map((v, i) => v + (HIGH[i] - v) * q); };
const mixTotal = (mix) => Object.values(mix).reduce((a, b) => a + b, 0);
// 鉱区の原石 1 ct の値打ち（磨いた場合。品質の分布込み）
function mineVpc(id) {
  const M = MINES[id];
  const gm = gradeDist(M.q).reduce((s, p, i) => s + p * GRADE_MUL[i], 0);
  const sum = mixTotal(M.mix);
  let v = 0;
  for (const [g, w] of Object.entries(M.mix)) v += (w / sum) * refVal(g);
  return v * gm;
}
export const mineBaseOut = (id) => (TIER.earn[MINES[id].r] * (MINES[id].e || 1)) / mineVpc(id);
export const minePrice = (id) => Math.round(TIER.mine[MINES[id].r] * (MINES[id].e || 1));
export const factPrice = (id) => TIER.factory[FACTORIES[id].r];
export const mineQ = (id, lv) => MINES[id].q + 0.08 * (lv - 1);
export const mineOut = (st, id) => mineBaseOut(id) * MINE_LV[st.mines[id].lv - 1].out;
export const storeCap = (st, id) => mineOut(st, id) * STORE_LV[st.mines[id].sl].h;
export const storeTotal = (m) => { let s = 0; for (const k in m.store) s += m.store[k]; return s; };
// 処理量（1 時間に磨ける原石の値打ち）。Lv1 で同じランクの鉱区の Lv1 をおよそ磨き切れる
export const factCap = (st, id) => TIER.earn[FACTORIES[id].r] * 1.6 * (FACTORIES[id].cap || 1) * FACT_LV[st.factories[id].lv - 1].cap;
export const factSkill = (st, id) => FACTORIES[id].skill + CREW[st.factories[id].crew].skill;
export const canCut = (fid, gem) => (FACTORIES[fid].only ? FACTORIES[fid].only.includes(gem) : gem !== 'diamond');
export const queueWork = (f) => f.queue.reduce((s, e) => s + e.ct * refVal(e.k.split('|')[0]), 0);

// ---------------------------------------------------------------- 状態
export function newBiz(now) {
  return {
    v: 1, cash: 12000, last: now, rank: 1, view: null,
    mines: {}, factories: {}, ships: [], stock: {},
    market: { idx: {} },
    div: { day: '', paid: 0 },
    spent: 0, earned: 0, invested: 0, divTotal: 0, n: 0,
  };
}

// 時刻 now まで進める。60 秒刻み。放置の上限（ランクで伸びる）を超えた分は捨てる
export function catchUp(st, now) {
  if (!(now > st.last)) { st.last = Math.min(st.last, now); return; }
  const cap = RANKS[st.rank - 1].off * HOUR;
  let t = Math.max(st.last, now - cap);
  while (t < now) {
    const dt = Math.min(60e3, now - t);
    t += dt;
    step(st, t, dt / 1000);
  }
  st.last = now;
}

function step(st, t, sec) {
  // 鉱区：倉庫が満杯か、埋蔵量が尽きると止まる
  for (const id in st.mines) {
    const m = st.mines[id];
    const free = storeCap(st, id) - storeTotal(m);
    const amt = Math.min(mineOut(st, id) * (sec / 3600), free, m.reserve);
    if (amt <= 1e-9) continue;
    const M = MINES[id], sum = mixTotal(M.mix), dist = gradeDist(mineQ(id, m.lv));
    for (const [g, w] of Object.entries(M.mix)) {
      for (let q = 0; q < 5; q++) {
        const k = `${g}|${q}`;
        m.store[k] = (m.store[k] || 0) + (amt * w * dist[q]) / sum;
      }
    }
    m.reserve -= amt;
  }
  // 荷の到着
  for (let i = st.ships.length - 1; i >= 0; i--) {
    const s = st.ships[i];
    if (s.arrive > t) continue;
    const f = st.factories[s.to];
    for (const k in s.items) {
      const qk = `${k}|${s.from}`;
      const e = f.queue.find((x) => x.k === qk);
      if (e) e.ct += s.items[k];
      else f.queue.push({ k: qk, ct: s.items[k] });
    }
    st.ships.splice(i, 1);
  }
  // 工場：順番に磨く。手間賃が払えなければ止まる
  for (const id in st.factories) {
    const f = st.factories[id];
    f.nofund = false;
    let budget = factCap(st, id) * (sec / 3600);
    while (budget > 1e-9 && f.queue.length) {
      const e = f.queue[0];
      const [gem, g, origin] = e.k.split('|');
      const per = refVal(gem);
      const use = Math.min(budget, e.ct * per);
      const fee = FACTORIES[id].fee * use * GRADE_MUL[+g];
      if (st.cash < fee) { f.nofund = true; break; }
      st.cash -= fee;
      const ct = use / per;
      cut(st, id, gem, +g, origin, ct);
      e.ct -= ct;
      budget -= use;
      if (e.ct < 1e-6) f.queue.shift();
    }
  }
}

// 研磨：歩留まりと品質の上振れは、腕前・得意・方針・処理で決まる
export function cutParams(st, fid, gem) {
  const F = FACTORIES[fid], f = st.factories[fid];
  const skill = factSkill(st, fid), spec = F.spec.includes(gem), pol = f.policy || 'normal';
  const yieldMul = (0.85 + 0.3 * skill) * (spec ? 1.08 : 1) * (pol === 'yield' ? 1.12 : pol === 'shine' ? 0.88 : 1);
  let up = Math.min(0.6, 0.04 + 0.22 * skill + (spec ? 0.08 : 0) + (pol === 'shine' ? 0.12 : 0));
  const treat = !!(f.treat && BIZ_GEMS[gem].treat);
  if (treat) up = 1 - (1 - up) * (1 - (F.heat ? 0.5 : 0.35));
  return { yieldMul, up, treat };
}
function cut(st, fid, gem, g, origin, ctRough) {
  const { yieldMul, up, treat } = cutParams(st, fid, gem);
  const ct = ctRough * BIZ_GEMS[gem].y * yieldMul;
  const u = g >= 4 ? 0 : up;
  addStock(st, lotKey(gem, g, origin, treat ? 1 : 0), ct * (1 - u));
  if (u) addStock(st, lotKey(gem, g + 1, origin, treat ? 1 : 0), ct * u);
}
export function addStock(st, k, ct) {
  if (ct <= 0) return;
  const s = st.stock[k] || (st.stock[k] = { n: 0, ct: 0 });
  s.ct += ct;
  s.n += ct / BIZ_GEMS[k.split('|')[0]].size;
}

// ---------------------------------------------------------------- 値段と売却
export const idxOf = (st, gem) => st.market.idx[gem] || 1;
// 在庫の石（まとまり s）の値打ち。mul は売り先の掛け率
export function lotValue(st, k, s, mul = 1) {
  const p = parseKey(k), G = BIZ_GEMS[p.gem];
  let v = G.base * GRADE_MUL[p.g] * Math.pow(s.ct / s.n, 0.3) * s.ct * idxOf(st, p.gem) * mul;
  if (p.treat) v *= 0.7;
  else if (G.treat) v *= 1.1;
  if (p.cert) {
    v *= 1.15;
    const b = MINES[p.origin] && MINES[p.origin].bonus && MINES[p.origin].bonus[p.gem];
    if (b) v *= b;
  }
  return v;
}
export const exOpen = (st, id) => EXCHANGES[id].r <= st.rank && !EXCHANGES[id].show;
export function exMul(id, gem, size) {
  const E = EXCHANGES[id];
  let m = E.mul;
  if (E.spec && E.spec.includes(gem)) m += 0.08;
  if (E.big && size >= 3) m += 0.06;
  return m;
}
export const sellPrice = (st, k, exId) => { const s = st.stock[k]; return lotValue(st, k, s, exMul(exId, k.split('|')[0], s.ct / s.n)); };
export function sellLot(st, k, exId) {
  if (!st.stock[k]) return 0;
  const v = sellPrice(st, k, exId);
  delete st.stock[k];
  st.cash += v;
  st.earned += v;
  return v;
}
// 原石のまま売る値（倉庫の中身 items）
export function roughValue(st, items, origin, exId) {
  const E = EXCHANGES[exId];
  let v = 0;
  for (const k in items) {
    const [gem, g] = k.split('|');
    v += items[k] * refVal(gem) * GRADE_MUL[+g] * idxOf(st, gem) * 0.2 * (E.rough || 1) * (E.spec && E.spec.includes(gem) ? 1.1 : 1);
  }
  return v;
}
// いちばん高く売れる取引所（開いているところだけ）
export function bestExchange(st, valueOf) {
  let best = null, bv = -1;
  for (const id in EXCHANGES) {
    if (!exOpen(st, id)) continue;
    const v = valueOf(id);
    if (v > bv) { bv = v; best = id; }
  }
  return { id: best, value: Math.max(0, bv) };
}
export function sellRough(st, mineId) {
  const m = st.mines[mineId];
  const b = bestExchange(st, (ex) => roughValue(st, m.store, mineId, ex));
  if (!b.id || b.value <= 0) return null;
  m.store = {};
  st.cash += b.value;
  st.earned += b.value;
  return b;
}

// ---------------------------------------------------------------- 出荷
function distKm(a, b) {
  const A = PLACES[a], B = PLACES[b], r = Math.PI / 180;
  const dLat = (B.lat - A.lat) * r, dLon = (B.lon - A.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(A.lat * r) * Math.cos(B.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
// 輸送の時間（分）：同じ地名なら 1 分、遠いほど長く（2〜30 分）
export const shipMin = (from, to) => (from === to ? 1 : Math.round(clamp(2 + distKm(from, to) / 600, 2, 30)));
// 鉱区の倉庫から、その工場で磨ける原石を出荷する。出荷した量（ct）を返す
export function ship(st, mineId, factId, now) {
  const m = st.mines[mineId];
  const items = {};
  let ct = 0;
  for (const k in m.store) {
    if (!canCut(factId, k.split('|')[0]) || m.store[k] <= 1e-6) continue;
    items[k] = m.store[k];
    ct += m.store[k];
    delete m.store[k];
  }
  if (ct <= 0) return 0;
  st.ships.push({ id: ++st.n, from: mineId, to: factId, items, ct, dep: now, arrive: now + shipMin(mineId, factId) * 60e3 });
  return ct;
}

// ---------------------------------------------------------------- 施設を買う・強化する
function pay(st, cost) {
  if (!(cost > 0) || st.cash < cost) return false;
  st.cash -= cost;
  st.spent += cost;
  return true;
}
export const mineUpCost = (st, id) => { const m = st.mines[id]; return m.lv < MINE_LV.length ? minePrice(id) * MINE_LV[m.lv].cost : 0; };
export const storeUpCost = (st, id) => { const m = st.mines[id]; return m.sl < STORE_LV.length - 1 ? minePrice(id) * STORE_LV[m.sl + 1].cost : 0; };
export const exploreCost = (st, id) => Math.round(minePrice(id) * 0.6 * Math.pow(1.6, st.mines[id].ex));
export const factUpCost = (st, id) => { const f = st.factories[id]; return f.lv < FACT_LV.length ? factPrice(id) * FACT_LV[f.lv].cost : 0; };
export const crewCost = (st, id) => { const f = st.factories[id]; return f.crew < CREW.length - 1 ? factPrice(id) * CREW[f.crew + 1].cost : 0; };
export const reserveFull = (id) => mineBaseOut(id) * 24 * 45;

export function buyMine(st, id) {
  if (st.mines[id] || MINES[id].r > st.rank || !pay(st, minePrice(id))) return false;
  st.mines[id] = { lv: 1, sl: 0, reserve: reserveFull(id), store: {}, ex: 0 };
  return true;
}
export function upgradeMine(st, id) { const c = mineUpCost(st, id); if (!c || !pay(st, c)) return false; st.mines[id].lv++; return true; }
export function upgradeStore(st, id) { const c = storeUpCost(st, id); if (!c || !pay(st, c)) return false; st.mines[id].sl++; return true; }
export function explore(st, id) {
  const c = exploreCost(st, id);
  if (!pay(st, c)) return false;
  const m = st.mines[id];
  m.ex++;
  m.reserve += mineBaseOut(id) * 24 * 30;
  return true;
}
export function buyFactory(st, id) {
  if (st.factories[id] || FACTORIES[id].r > st.rank || !pay(st, factPrice(id))) return false;
  st.factories[id] = { lv: 1, crew: 0, queue: [], policy: 'normal', treat: false };
  return true;
}
export function upgradeFactory(st, id) { const c = factUpCost(st, id); if (!c || !pay(st, c)) return false; st.factories[id].lv++; return true; }
export function hireCrew(st, id) { const c = crewCost(st, id); if (!c || !pay(st, c)) return false; st.factories[id].crew++; return true; }

// ---------------------------------------------------------------- 会社の値打ちとランク
// 総資産 = 資金 + 施設に払った額の半分 + 在庫（卸した場合）+ 原石（倉庫・輸送中・工場の待ち。原石で売った場合）
export function companyValue(st) {
  let v = st.cash + st.spent * 0.5;
  for (const k in st.stock) v += lotValue(st, k, st.stock[k], 0.6);
  const rough = (items) => { let s = 0; for (const k in items) { const [gem, g] = k.split('|'); s += items[k] * refVal(gem) * GRADE_MUL[+g] * 0.2; } return s; };
  for (const id in st.mines) v += rough(st.mines[id].store);
  for (const s of st.ships) v += rough(s.items);
  for (const id in st.factories) for (const e of st.factories[id].queue) { const [gem, g] = e.k.split('|'); v += e.ct * refVal(gem) * GRADE_MUL[+g] * 0.2; }
  return v;
}
// ランクは上がるだけ。上がった数を返す
export function updateRank(st) {
  const v = companyValue(st);
  const before = st.rank;
  while (st.rank < RANKS.length && v >= RANKS[st.rank].need) st.rank++;
  return st.rank - before;
}

// ---------------------------------------------------------------- 配当と出資
// avgRun：1 ランで得るコインの平均（save.stats から）。today：日付（ui.js の todayStr と同じ形）
export const divCap = (st, avgRun) => Math.round(Math.max(300, avgRun || 0) * RANKS[st.rank - 1].k);
// 1 コインあたりの $。そのランクの標準的な稼ぎで、1 日の上限におよそ 8 時間で届く
export const divRate = (st, avgRun) => (RANKS[st.rank - 1].std * 8) / divCap(st, avgRun);
// 出資は配当の 1/3 の有利さ（行って帰るだけで増えないように）
export const investRate = (st, avgRun) => divRate(st, avgRun) / 3;
function divDay(st, today) { if (st.div.day !== today) st.div = { day: today, paid: 0 }; }
export function divLeft(st, avgRun, today) { divDay(st, today); return Math.max(0, divCap(st, avgRun) - st.div.paid); }
// 配当は売上が出てから。運転資金として、そのランクの標準的な手取りの 1 時間分は残す
export const divPayable = (st, avgRun, today) => (st.earned > 0 ? Math.max(0, Math.min(divLeft(st, avgRun, today), Math.floor((st.cash - RANKS[st.rank - 1].std) / divRate(st, avgRun)))) : 0);
// 配当を払う（受け取るコインの数を返す。コインを save に足すのは呼ぶ側）
export function payDividend(st, avgRun, today) {
  const n = divPayable(st, avgRun, today);
  if (n <= 0) return 0;
  st.cash -= n * divRate(st, avgRun);
  st.div.paid += n;
  st.divTotal += n;
  return n;
}
// 出資（受け取る $ を返す。コインを save から引くのは呼ぶ側）
export function invest(st, coins, avgRun) {
  const usd = coins * investRate(st, avgRun);
  st.cash += usd;
  st.invested += coins;
  return usd;
}

// ---------------------------------------------------------------- 知らせ（メニューの印）
export function bizAlerts(st, avgRun, today) {
  let full = 0, nofund = 0;
  for (const id in st.mines) { const m = st.mines[id]; if (m.reserve > 1 && storeTotal(m) >= storeCap(st, id) * 0.98) full++; }
  for (const id in st.factories) if (st.factories[id].nofund) nofund++;
  const claimed = st.div.day === today && st.div.paid > 0;
  // 配当は、その日の上限の 2 割以上（残りが少なければ残り全部）を受け取れるときだけ知らせる
  const pay = divPayable(st, avgRun, today), left = divLeft(st, avgRun, today);
  const div = !claimed && pay > 0 && pay >= Math.min(left, Math.ceil(divCap(st, avgRun) * 0.2));
  return { full, nofund, div, any: !!(full || nofund || div) };
}
