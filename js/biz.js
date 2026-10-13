// =====================================================================
//  経営（宝石商社）の仕組み：状態・追いつき計算・鉱区・出荷・工場・在庫・相場・売却・直営店・人を雇う・
//  鑑定・オークション・サイト・注文・配当と出資・ランク
//  DOM と save.js は読まない（Node の tools/test/biz-sim.js からも動かす）。状態は save.biz
// =====================================================================
import {
  BIZ_GEMS, BIZ_GEM_IDS, GRADE_MUL, RANKS, TIER, PLACES, MINES, MINE_LV, STORE_LV, FACTORIES, FACT_LV, CREW, EXCHANGES,
  SHOPS, SHOP_LV, SHOP_CAP, STAFF, BOSS_SHIP, MARKET_EVENTS,
  LABS, LAB_MIN, AUCTIONS, AUCTION_MUL, SIGHTS, ORDERS, CLIENT_PLACES, CLIENT_KINDS, SHOW_SEASON,
} from './biz-data.js';

const HOUR = 3600e3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r4 = (v) => Math.round(v * 1e4) / 1e4;

// 乱数（状態の種 rng から。追いつき計算の結果を、開き直しで変えないため）
function rand(st) {
  let t = (st.rng = (st.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const gauss = (st) => Math.sqrt(-2 * Math.log(Math.max(1e-9, rand(st)))) * Math.cos(2 * Math.PI * rand(st));
const pick = (st, arr) => arr[Math.floor(rand(st) * arr.length)];
function pickW(st, mix) {
  let r = rand(st) * Object.values(mix).reduce((a, b) => a + b, 0);
  for (const k in mix) { r -= mix[k]; if (r <= 0) return k; }
  return Object.keys(mix)[0];
}

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
export const BIZ_VER = 4;
export function newBiz(now) {
  const st = {
    v: BIZ_VER, cash: 12000, last: now, rank: 1, view: null, rng: (now ^ 0x9e3779b9) >>> 0, tut: 0, goals: {},
    mines: {}, factories: {}, ships: [], stock: {}, shops: {},
    market: null,
    labs: [], auctions: {}, orders: { list: [], next: now }, sight: { next: 0, store: {} },
    div: { day: '', paid: 0 },
    spent: 0, earned: 0, invested: 0, divTotal: 0, n: 0,
    stat: { cert: 0, auction: 0, order: 0, sight: 0 },
  };
  newMarket(st, now);
  return st;
}
// 古い形の状態を今の形にする（v1：相場・直営店・人を雇う より前、v2：鑑定・オークション・サイト・注文 より前、
// v3：タイの工場がバンコクにあったころ。実際の研磨と加熱処理の中心のチャンタブリーへ移す）
export function migrateBiz(st) {
  if (st.v >= BIZ_VER) return;
  if (st.v < 2) {
    if (st.rng == null) st.rng = (st.last ^ 0x9e3779b9) >>> 0;
    if (!st.shops) st.shops = {};
    if (!st.market || !st.market.walk) newMarket(st, st.last);
    for (const id in st.mines) if (st.mines[id].boss == null) { st.mines[id].boss = false; st.mines[id].to = null; }
    for (const id in st.factories) if (st.factories[id].boss == null) { st.factories[id].boss = false; st.factories[id].out = 'stock'; }
  }
  if (st.v < 3) {
    st.labs = []; st.auctions = {}; st.orders = { list: [], next: st.last }; st.sight = { next: 0, store: {} };
    st.stat = { cert: 0, auction: 0, order: 0, sight: 0 };
  }
  if (st.v < 4 && st.factories.bangkok) {
    st.factories.chanthaburi = st.factories.bangkok;
    delete st.factories.bangkok;
    for (const sh of st.ships) if (sh.to === 'bangkok') sh.to = 'chanthaburi';
    for (const id in st.mines) if (st.mines[id].to === 'bangkok') st.mines[id].to = 'chanthaburi';
  }
  st.v = BIZ_VER;
}

// 時刻 now まで進める。60 秒刻み。放置の上限（ランクで伸びる）を超えた分は捨てる
export function catchUp(st, now) {
  migrateBiz(st);
  if (!(now > st.last)) { st.last = Math.min(st.last, now); return; }
  const cap = RANKS[st.rank - 1].off * HOUR;
  let t = Math.max(st.last, now - cap);
  // 捨てた時間が長いときも、相場は最後の 1 日分だけ動かす
  const M = st.market;
  if (M.nextH < t - 24 * HOUR) M.nextH += Math.floor((t - 24 * HOUR - M.nextH) / HOUR) * HOUR;
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
    if (amt > 1e-9) produce(id, m, amt);
  }
  // 鉱山長：倉庫が BOSS_SHIP までたまったら、決めた工場へ出荷
  for (const id in st.mines) {
    const m = st.mines[id];
    if (m.boss && m.to && st.factories[m.to] && storeTotal(m) >= storeCap(st, id) * BOSS_SHIP) ship(st, id, m.to, t);
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
      cut(st, id, gem, +g, origin, ct, t);
      e.ct -= ct;
      budget -= use;
      if (e.ct < 1e-6) f.queue.shift();
    }
  }
  // 直営店：棚の石が売れていく
  for (const id in st.shops) shopSell(st, id, sec);
  // 鑑定の完了
  for (let i = st.labs.length - 1; i >= 0; i--) {
    const j = st.labs[i];
    if (j.done > t) continue;
    const p = parseKey(j.k), ck = lotKey(p.gem, p.g, p.origin, p.treat, 1);
    const s = st.stock[ck] || (st.stock[ck] = { n: 0, ct: 0 });
    s.n += j.n; s.ct += j.ct;
    st.stat.cert += j.n;
    st.labs.splice(i, 1);
  }
  // オークションの開催
  for (const id in AUCTIONS) {
    if (!aucOpen(st, id)) continue;
    const a = aucState(st, id, t);
    while (a.next <= t) { if (a.lots.length) runAuction(st, id, a.next); a.next += AUCTIONS[id].every * HOUR; }
  }
  // 注文が届く
  if (t >= st.orders.next) rollOrders(st, t);
  // 売りすぎで下がった相場は、時間で戻る
  const M = st.market, dec = Math.exp((-sec * 1000) / PRESS_TAU);
  for (const g in M.press) { M.press[g] *= dec; if (M.press[g] < 0.002) delete M.press[g]; }
  while (M.nextH <= t) { hourly(st, M.nextH); M.nextH += HOUR; }
}

// 鉱区の倉庫に原石 amt ct を足す（宝石の割合と品質の分布どおり）
function produce(id, m, amt) {
  const M = MINES[id], sum = mixTotal(M.mix), dist = gradeDist(mineQ(id, m.lv));
  for (const [g, w] of Object.entries(M.mix)) {
    for (let q = 0; q < 5; q++) {
      const k = `${g}|${q}`;
      m.store[k] = (m.store[k] || 0) + (amt * w * dist[q]) / sum;
    }
  }
  m.reserve -= amt;
}
// 工場の待ちの原石を、手間賃を払える分だけすぐに磨き上げる（チュートリアルの最初の出荷で使う）
export function finishQueue(st, fid, t) {
  const f = st.factories[fid];
  while (f && f.queue.length) {
    const e = f.queue[0], [gem, g, origin] = e.k.split('|');
    const fee = FACTORIES[fid].fee * e.ct * refVal(gem) * GRADE_MUL[+g];
    if (st.cash < fee) break;
    st.cash -= fee;
    cut(st, fid, gem, +g, origin, e.ct, t);
    f.queue.shift();
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
function cut(st, fid, gem, g, origin, ctRough, t) {
  const { yieldMul, up, treat } = cutParams(st, fid, gem);
  const ct = ctRough * BIZ_GEMS[gem].y * yieldMul;
  const u = g >= 4 ? 0 : up;
  const f = st.factories[fid];
  // 工場長：出来上がりを決めた取引所でそのまま売る。鑑定所なら品質 A 以上を鑑定に出す（費用が払えなければ在庫へ）
  const lab = f.boss && typeof f.out === 'string' && f.out.startsWith('lab:') ? f.out.slice(4) : null;
  const put = lab ? (k, c) => { if (!(c > 0 && labOk(k) && sendLab(st, lab, k, t, { n: c / BIZ_GEMS[gem].size, ct: c }))) addStock(st, k, c); }
    : f.boss && EXCHANGES[f.out] && exOpen(st, f.out, t) ? (k, c) => sellNew(st, k, c, f.out) : (k, c) => addStock(st, k, c);
  put(lotKey(gem, g, origin, treat ? 1 : 0), ct * (1 - u));
  if (u) put(lotKey(gem, g + 1, origin, treat ? 1 : 0), ct * u);
}
export function addStock(st, k, ct) {
  if (ct <= 0) return;
  const s = st.stock[k] || (st.stock[k] = { n: 0, ct: 0 });
  s.ct += ct;
  s.n += ct / BIZ_GEMS[k.split('|')[0]].size;
}

// ---------------------------------------------------------------- 相場
// 宝石ごとの相場 = ゆらぎ（1 に戻ろうとする）× 流行 × 出来事 × 売りすぎの下げ
const PRESS_K = 0.1, PRESS_MAX = 0.4, PRESS_TAU = 3 * HOUR;
function newMarket(st, now) {
  st.market = { walk: {}, trend: {}, press: {}, events: [], prev: {}, nextH: now + HOUR, nextD: now + 24 * HOUR };
  rollTrends(st, now);
}
export function evMul(st, gem) { let m = 1; for (const e of st.market.events) if (e.g === gem) m *= e.mul; return m; }
export const idxOf = (st, gem) => {
  const M = st.market;
  return clamp((M.walk[gem] || 1) * (M.trend[gem] || 1) * evMul(st, gem) * (1 - (M.press[gem] || 0)), 0.45, 2.5);
};
const ownGems = (st) => [...new Set(Object.keys(st.mines).flatMap((id) => Object.keys(MINES[id].mix)))];
// 流行：1 日ごとに 2 種が上がり（1 つは自社の鉱区の石から）、1 種が下がる
function rollTrends(st, t) {
  const M = st.market, own = ownGems(st);
  const up1 = pick(st, own.length ? own : BIZ_GEM_IDS);
  let up2 = up1, dn = up1;
  while (up2 === up1) up2 = pick(st, BIZ_GEM_IDS);
  while (dn === up1 || dn === up2) dn = pick(st, BIZ_GEM_IDS);
  M.trend = { [up1]: r4(1.15 + rand(st) * 0.2), [up2]: r4(1.15 + rand(st) * 0.2), [dn]: r4(0.75 + rand(st) * 0.13) };
  M.nextD = t + 24 * HOUR;
}
// 出来事：鉱区の天気や鉱脈、街の話題など。半分ほどは自社の鉱区で起きる
function spawnEvent(st, t) {
  const k = pick(st, Object.keys(MARKET_EVENTS)), E = MARKET_EVENTS[k];
  let p = null, g;
  if (E.at === 'mine') {
    const own = Object.keys(st.mines);
    p = pick(st, own.length && rand(st) < 0.5 ? own : Object.keys(MINES).filter((id) => MINES[id].r <= st.rank + 1));
    g = pickW(st, MINES[p].mix);
  } else if (E.at === 'shop') {
    p = pick(st, Object.keys(SHOPS));
    g = pick(st, SHOPS[p].likes);
  } else g = pick(st, E.gems);
  if (st.market.events.some((e) => e.g === g)) return;
  const mul = E.mul[0] + rand(st) * (E.mul[1] - E.mul[0]);
  const h = Math.round(E.h[0] + rand(st) * (E.h[1] - E.h[0]));
  st.market.events.push({ k, p, g, mul: r4(mul), until: t + h * HOUR });
}
function hourly(st, t) {
  const M = st.market;
  for (const g of BIZ_GEM_IDS) M.prev[g] = r4(idxOf(st, g));
  for (const g of BIZ_GEM_IDS) M.walk[g] = r4(Math.exp(Math.log(M.walk[g] || 1) * 0.9 + gauss(st) * 0.035));
  M.events = M.events.filter((e) => e.until > t);
  if (t >= M.nextD) rollTrends(st, t);
  if (M.events.length < 3 && rand(st) < 0.1) spawnEvent(st, t);
}
// 同じ石を一度にたくさん卸すと相場が下がる。v の売り上げで下がる分 d と、その売り上げに掛かる倍率（下がる途中の平均）
function pressOf(st, gem, v) {
  const p0 = st.market.press[gem] || 0;
  const d = Math.max(0, Math.min(PRESS_MAX - p0, (PRESS_K * v) / RANKS[st.rank - 1].std));
  return { d, mul: 1 - d / 2 / (1 - p0) };
}
function addPress(st, gem, d) { if (d > 0) st.market.press[gem] = r4((st.market.press[gem] || 0) + d); }
function income(st, v) { st.cash += v; st.earned += v; }

// ---------------------------------------------------------------- 値段と売却
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
// ツーソンは毎年の宝石ショーの期間（SHOW_SEASON）だけ開く
export function showOpen(t) {
  const d = new Date(t), md = (d.getMonth() + 1) * 100 + d.getDate();
  const { from, to } = SHOW_SEASON;
  return md >= from[0] * 100 + from[1] && md <= to[0] * 100 + to[1];
}
export const exOpen = (st, id, t = st.last) => EXCHANGES[id].r <= st.rank && (!EXCHANGES[id].show || showOpen(t));
export function exMul(id, gem, size) {
  const E = EXCHANGES[id];
  let m = E.mul;
  if (E.spec && E.spec.includes(gem)) m += 0.08;
  if (E.big && size >= 3) m += 0.06;
  return m;
}
const rawSell = (st, k, exId, s = st.stock[k]) => lotValue(st, k, s, exMul(exId, k.split('|')[0], s.ct / s.n));
// 取引所での買い取り値（売りすぎの下げ込み）
export const sellPrice = (st, k, exId) => { const v = rawSell(st, k, exId); return v * pressOf(st, k.split('|')[0], v).mul; };
export function sellLot(st, k, exId) {
  if (!st.stock[k]) return 0;
  const gem = k.split('|')[0], v0 = rawSell(st, k, exId), pr = pressOf(st, gem, v0);
  delete st.stock[k];
  addPress(st, gem, pr.d);
  income(st, v0 * pr.mul);
  return v0 * pr.mul;
}
// 磨き上がったばかりの石をそのまま売る（工場長）
function sellNew(st, k, ct, exId) {
  if (ct <= 0) return;
  const s = { n: ct / BIZ_GEMS[k.split('|')[0]].size, ct };
  const gem = k.split('|')[0], v0 = rawSell(st, k, exId, s), pr = pressOf(st, gem, v0);
  addPress(st, gem, pr.d);
  income(st, v0 * pr.mul);
}
// 原石のまま売る値（倉庫の中身 items）。宝石ごとの値（売りすぎの下げの前）
function roughByGem(st, items, exId) {
  const E = EXCHANGES[exId], by = {};
  for (const k in items) {
    const [gem, g] = k.split('|');
    by[gem] = (by[gem] || 0) + items[k] * refVal(gem) * GRADE_MUL[+g] * idxOf(st, gem) * 0.2 * (E.rough || 1) * (E.spec && E.spec.includes(gem) ? 1.1 : 1);
  }
  return by;
}
export function roughValue(st, items, origin, exId) {
  const by = roughByGem(st, items, exId);
  let v = 0;
  for (const g in by) v += by[g] * pressOf(st, g, by[g]).mul;
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
  const store = storeAt(st, mineId);
  if (!store) return null;
  const b = bestExchange(st, (ex) => roughValue(st, store, mineId, ex));
  if (!b.id || b.value <= 0) return null;
  const by = roughByGem(st, store, b.id);
  for (const g in by) addPress(st, g, pressOf(st, g, by[g]).d);
  for (const k in store) delete store[k];
  income(st, b.value);
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
// 原石の置き場：鉱区の倉庫か、サイトで買った箱（ハボローネ）
export const storeAt = (st, id) => (st.mines[id] ? st.mines[id].store : SIGHTS[id] ? st.sight.store : null);
export function ship(st, mineId, factId, now) {
  const store = storeAt(st, mineId);
  if (!store || !st.factories[factId]) return 0;
  const items = {};
  let ct = 0;
  for (const k in store) {
    if (!canCut(factId, k.split('|')[0]) || store[k] <= 1e-6) continue;
    items[k] = store[k];
    ct += store[k];
    delete store[k];
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
  const first = !Object.keys(st.mines).length;
  st.mines[id] = { lv: 1, sl: 0, reserve: reserveFull(id), store: {}, ex: 0, boss: false, to: null };
  // 最初の鉱区は、1 時間分の原石がたまった状態から始める（すぐに出荷を試せるように）
  if (first) produce(id, st.mines[id], mineOut(st, id));
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
  st.factories[id] = { lv: 1, crew: 0, queue: [], policy: 'normal', treat: false, boss: false, out: 'stock' };
  return true;
}
export function upgradeFactory(st, id) { const c = factUpCost(st, id); if (!c || !pay(st, c)) return false; st.factories[id].lv++; return true; }
export function hireCrew(st, id) { const c = crewCost(st, id); if (!c || !pay(st, c)) return false; st.factories[id].crew++; return true; }
export function setPolicy(st, id, pol) { if (['yield', 'normal', 'shine'].includes(pol)) st.factories[id].policy = pol; return true; }
export function setTreat(st, id, on) { st.factories[id].treat = !!on; return true; }

// ---------------------------------------------------------------- 人を雇う
// 鉱山長（自動で出荷）・工場長（出来上がりを売る）・店長（棚に並べる）
const bossOf = (st, kind, id) => (kind === 'mine' ? st.mines : kind === 'factory' ? st.factories : st.shops)[id];
export const staffCost = (kind, id) => Math.round((kind === 'mine' ? minePrice(id) : kind === 'factory' ? factPrice(id) : shopPrice(id)) * STAFF[kind]);
export function hireBoss(st, kind, id) {
  const o = bossOf(st, kind, id);
  if (st.rank < STAFF.r || !o || o.boss || !pay(st, staffCost(kind, id))) return false;
  o.boss = true;
  // 鉱山長の出荷先は、その鉱区の石を磨けるいちばん近い工場から始める
  if (kind === 'mine' && !o.to) o.to = nearFactory(st, id);
  return true;
}
export function nearFactory(st, mineId) {
  let best = null, bt = Infinity;
  for (const fid in st.factories) {
    if (!Object.keys(MINES[mineId].mix).some((g) => canCut(fid, g))) continue;
    const t = shipMin(mineId, fid);
    if (t < bt) { bt = t; best = fid; }
  }
  return best;
}
export function setMineTo(st, id, fid) { if (!st.factories[fid]) return false; st.mines[id].to = fid; return true; }
export function setFactOut(st, id, out) {
  const ok = out === 'stock' || (EXCHANGES[out] && EXCHANGES[out].r <= st.rank) || (out.startsWith('lab:') && LABS[out.slice(4)] && labOpen(st, out.slice(4)));
  if (!ok) return false;
  st.factories[id].out = out;
  return true;
}

// ---------------------------------------------------------------- 直営店
// 棚は段ごとに 1 種類の石。1 段には店が 1 日に売る量の 1/段数（＝その段が 1 日ほどで売り切れる量）まで並べる
export const shopPrice = (id) => TIER.shop[SHOPS[id].r];
export const shopCapAt = (id, lv) => TIER.earn[SHOPS[id].r] * SHOP_CAP * SHOP_LV[lv - 1].rate;
export const shopCap = (st, id) => shopCapAt(id, st.shops[id].lv);
export const shopSlots = (st, id) => SHOP_LV[st.shops[id].lv - 1].slots;
export const slotCap = (st, id) => (shopCap(st, id) * 24) / shopSlots(st, id);
export const shopLikes = (id, gem) => SHOPS[id].likes.includes(gem);
export const shopMul = (id, gem) => SHOPS[id].mul * (shopLikes(id, gem) ? 1.1 : 1);
export const shopOk = (id, k) => parseKey(k).g >= (SHOPS[id].min || 0);
const shopWeight = (id, k, s) => (shopLikes(id, k.split('|')[0]) ? 2 : 1) * (SHOPS[id].big && s.ct / s.n >= 3 ? 1.5 : 1);
export const shopUpCost = (st, id) => { const sh = st.shops[id]; return sh.lv < SHOP_LV.length ? shopPrice(id) * SHOP_LV[sh.lv].cost : 0; };
export function buyShop(st, id) {
  if (st.shops[id] || SHOPS[id].r > st.rank || !pay(st, shopPrice(id))) return false;
  st.shops[id] = { lv: 1, shelf: {}, boss: false, sales: 0 };
  return true;
}
export function upgradeShop(st, id) { const c = shopUpCost(st, id); if (!c || !pay(st, c)) return false; st.shops[id].lv++; return true; }
// 在庫から棚へ（その段に並べられる分だけ）。並べた割合を返す
export function shelve(st, id, k) {
  const sh = st.shops[id], s = st.stock[k];
  if (!s || !shopOk(id, k)) return 0;
  if (!sh.shelf[k] && Object.keys(sh.shelf).length >= shopSlots(st, id)) return 0;
  const e = sh.shelf[k] || { n: 0, ct: 0 };
  const room = slotCap(st, id) - (e.n > 0 ? lotValue(st, k, e) : 0);
  const v = lotValue(st, k, s);
  if (room <= 0 || v <= 0) return 0;
  const f = Math.min(1, room / v);
  sh.shelf[k] = e;
  e.n += s.n * f; e.ct += s.ct * f;
  if (f >= 1 - 1e-9) delete st.stock[k];
  else { s.n -= s.n * f; s.ct -= s.ct * f; }
  return f;
}
export function unshelve(st, id, k) {
  const sh = st.shops[id], e = sh.shelf[k];
  if (!e) return false;
  const s = st.stock[k] || (st.stock[k] = { n: 0, ct: 0 });
  s.n += e.n; s.ct += e.ct;
  delete sh.shelf[k];
  return true;
}
// 店長：半分より減った段に足し、空いた段には好まれる石・高く売れる石から並べる
export function autoShelf(st, id) {
  const sh = st.shops[id], cap = slotCap(st, id);
  for (const k in sh.shelf) if (st.stock[k] && lotValue(st, k, sh.shelf[k]) < cap * 0.5) shelve(st, id, k);
  let free = shopSlots(st, id) - Object.keys(sh.shelf).length;
  if (free <= 0) return;
  const cand = [];
  for (const k in st.stock) {
    const s = st.stock[k];
    if (sh.shelf[k] || !shopOk(id, k) || s.n < 0.5) continue;
    cand.push({ k, sc: shopWeight(id, k, s) * shopMul(id, k.split('|')[0]) * Math.min(lotValue(st, k, s), cap) });
  }
  cand.sort((a, b) => b.sc - a.sc);
  for (const c of cand) { if (free <= 0) break; if (shelve(st, id, c.k) > 0) free--; }
}
// 1 刻みの販売：1 時間に売れる量を、段ごとに好みの重みで分ける
function shopSell(st, id, sec) {
  const sh = st.shops[id];
  if (sh.boss) autoShelf(st, id);
  const keys = Object.keys(sh.shelf);
  if (!keys.length) return;
  const ws = keys.map((k) => shopWeight(id, k, sh.shelf[k]));
  const W = ws.reduce((a, b) => a + b, 0), V = shopCap(st, id) * (sec / 3600);
  keys.forEach((k, i) => {
    const e = sh.shelf[k], val = lotValue(st, k, e);
    if (!(val > 0) || e.n < 1e-4) { delete sh.shelf[k]; return; }
    const f = Math.min(1, (V * ws[i]) / W / val);
    const got = val * f * shopMul(id, k.split('|')[0]);
    if (f >= 1) delete sh.shelf[k];
    else { e.n -= e.n * f; e.ct -= e.ct * f; }
    sh.sales += got;
    income(st, got);
  });
}

// ---------------------------------------------------------------- 鑑定所
// 品質 A 以上の、鑑定書の付いていない石に鑑定書を付ける。費用は先に払い、LABS.min 分で在庫に戻る
export const labOpen = (st, lab) => LABS[lab].r <= st.rank;
export const labOk = (k) => { const p = parseKey(k); return !p.cert && p.g >= LAB_MIN; };
export const labFee = (st, lab, k, s) => lotValue(st, k, s) * LABS[lab].fee;
export function sendLab(st, lab, k, now, s = st.stock[k]) {
  if (!s || !labOk(k) || !labOpen(st, lab)) return false;
  const fee = labFee(st, lab, k, s);
  if (st.cash < fee) return false;
  st.cash -= fee;
  // 同じ鑑定所でまだ終わっていない同じ石の件があれば、そこにまとめる
  const job = st.labs.find((j) => j.lab === lab && j.k === k && j.done > now);
  if (job) { job.n += s.n; job.ct += s.ct; } else st.labs.push({ id: ++st.n, lab, k, n: s.n, ct: s.ct, done: now + LABS[lab].min * 60e3 });
  if (s === st.stock[k]) delete st.stock[k];
  return true;
}

// ---------------------------------------------------------------- オークション
// 開催ごとに、相場での値打ちが上限（aucCap。会社のランクで伸びる）に収まるまで出品できる。落札値は相場の 1.3〜3 倍
export const aucOpen = (st, id) => AUCTIONS[id].r <= st.rank;
export const aucCap = (st, id) => TIER.earn[Math.max(AUCTIONS[id].r, st.rank)] * AUCTIONS[id].cap;
export function aucState(st, id, t) {
  const every = AUCTIONS[id].every * HOUR;
  return st.auctions[id] || (st.auctions[id] = { next: Math.ceil(t / every) * every, lots: [], last: null });
}
export const aucUsed = (st, id) => (st.auctions[id] ? st.auctions[id].lots.reduce((s, l) => s + lotValue(st, l.k, l), 0) : 0);
export function consign(st, id, k, now) {
  const s = st.stock[k];
  if (!s || !aucOpen(st, id) || parseKey(k).g < AUCTIONS[id].min) return 0;
  const a = aucState(st, id, now);
  const room = aucCap(st, id) - aucUsed(st, id), v = lotValue(st, k, s);
  if (room <= 0 || v <= 0) return 0;
  const f = Math.min(1, room / v);
  let l = a.lots.find((x) => x.k === k);
  if (!l) a.lots.push((l = { k, n: 0, ct: 0 }));
  l.n += s.n * f; l.ct += s.ct * f;
  if (f >= 1 - 1e-9) delete st.stock[k];
  else { s.n -= s.n * f; s.ct -= s.ct * f; }
  return f;
}
export function withdraw(st, id, k) {
  const a = st.auctions[id], i = a ? a.lots.findIndex((l) => l.k === k) : -1;
  if (i < 0) return false;
  const l = a.lots[i], s = st.stock[k] || (st.stock[k] = { n: 0, ct: 0 });
  s.n += l.n; s.ct += l.ct;
  a.lots.splice(i, 1);
  return true;
}
function runAuction(st, id, t) {
  const a = st.auctions[id], A = AUCTIONS[id], res = [];
  for (const l of a.lots) {
    const p = parseKey(l.k);
    const bias = (p.g >= 4 ? 0.25 : 0) + (p.cert ? 0.2 : 0) + (A.top ? 0.2 : 0);
    const r = clamp(Math.pow(rand(st), 1.6) + bias * rand(st), 0, 1);
    const m = AUCTION_MUL.lo + (AUCTION_MUL.hi - AUCTION_MUL.lo) * r;
    const v = lotValue(st, l.k, l) * m;
    income(st, v);
    st.stat.auction++;
    res.push({ k: l.k, n: r4(l.n), v: Math.round(v), m: Math.round(m * 100) / 100 });
  }
  a.last = { t, res, seen: false };
  a.lots = [];
}

// ---------------------------------------------------------------- サイト（ダイヤの原石の箱）
// 間隔ごとに 1 箱。値段（会社のランクで大きくなる）は決まっていて、中身（原石の量と品質）は開けるまでわからない
export const sightPrice = (st, id) => TIER.earn[Math.max(SIGHTS[id].r, st.rank)] * SIGHTS[id].price;
export const sightReady = (st, id, now) => SIGHTS[id].r <= st.rank && now >= st.sight.next;
export function buySight(st, id, now) {
  const S = SIGHTS[id], price = sightPrice(st, id);
  if (!sightReady(st, id, now) || st.cash < price) return null;
  st.cash -= price;
  const value = price * S.value * Math.max(0.35, 1 + S.spread * gauss(st) * 0.6);
  const dist = gradeDist(0.1 + rand(st) * 0.35);
  const vpc = refVal('diamond') * dist.reduce((a, p, i) => a + p * GRADE_MUL[i], 0);
  const ct = value / vpc;
  for (let q = 0; q < 5; q++) { const k = `diamond|${q}`; st.sight.store[k] = (st.sight.store[k] || 0) + ct * dist[q]; }
  st.sight.next = now + S.every * HOUR;
  st.stat.sight++;
  return { ct, value };
}

// ---------------------------------------------------------------- 注文
// ORDERS.every 時間ごとに、自社の鉱区の石の注文が最大 ORDERS.max 件まで届く。期限までに納めると相場より高い報酬
function rollOrders(st, t) {
  const O = st.orders, gems = ownGems(st).filter((g) => gemRate(st, g) > 0);
  O.list = O.list.filter((o) => o.until > t);
  while (gems.length && O.list.length < ORDERS.max) O.list.push(newOrder(st, t, gems));
  O.next = t + ORDERS.every * HOUR;
}
const span = (st, a) => a[0] + rand(st) * (a[1] - a[0]);
// 自社の鉱区がその石を産む量（標準の腕で磨いた場合の値打ち $/時）
export const gemRate = (st, gem) => Object.keys(st.mines).reduce((s, id) => {
  const mix = MINES[id].mix, w = mix[gem];
  return w && st.mines[id].reserve > 1 ? s + (mineOut(st, id) * w * refVal(gem)) / mixTotal(mix) : s;
}, 0);
function newOrder(st, t, gems) {
  const gem = pick(st, gems), g = rand(st) < 0.65 ? 2 : 3, G = BIZ_GEMS[gem];
  const per = G.base * GRADE_MUL[g] * Math.pow(G.size, 1.3) * idxOf(st, gem);
  const n = Math.max(1, Math.round((gemRate(st, gem) * GRADE_MUL[g] * ORDERS.share[g] * span(st, ORDERS.size)) / per));
  return {
    id: ++st.n, p: pick(st, CLIENT_PLACES), who: Math.floor(rand(st) * CLIENT_KINDS.length), gem, g, n,
    reward: Math.round(n * per * span(st, ORDERS.reward)), until: t + Math.round(span(st, ORDERS.h)) * HOUR,
  };
}
// 納められる石（同じ宝石で品質が条件以上）の数
export const orderHave = (st, o) => Object.keys(st.stock).reduce((s, k) => { const p = parseKey(k); return p.gem === o.gem && p.g >= o.g ? s + st.stock[k].n : s; }, 0);
export const orderReady = (st, o, now) => o.until > now && orderHave(st, o) >= o.n - 1e-6;
// 納める：条件を満たす石のうち、品質の低いほうから使う
export function deliver(st, id, now) {
  const i = st.orders.list.findIndex((o) => o.id === id), o = st.orders.list[i];
  if (!o || !orderReady(st, o, now)) return 0;
  let need = o.n;
  const keys = Object.keys(st.stock).filter((k) => { const p = parseKey(k); return p.gem === o.gem && p.g >= o.g; })
    .sort((a, b) => parseKey(a).g - parseKey(b).g || parseKey(a).cert - parseKey(b).cert);
  for (const k of keys) {
    if (need <= 1e-9) break;
    const s = st.stock[k], f = Math.min(1, need / s.n);
    need -= s.n * f;
    if (f >= 1 - 1e-9) delete st.stock[k];
    else { s.n -= s.n * f; s.ct -= s.ct * f; }
  }
  st.orders.list.splice(i, 1);
  income(st, o.reward);
  st.stat.order++;
  return o.reward;
}

// ---------------------------------------------------------------- 目標（会社の沿革）
// 次にやることを 1 つずつ示す。達成して受け取るとコイン。進み具合は受け取った目標の id（save.biz.goals）
// n は [今, 必要]、go はその目標のための地名とシートの種類（目標を押すと開く）
const cnt = (o) => Object.keys(o || {}).length;
const anyBoss = (st) => ['mines', 'factories', 'shops'].some((t) => Object.values(st[t] || {}).some((o) => o.boss));
const rankGoal = (r, coins) => ({ id: 'rank' + r, t: `会社のランクを「${RANKS[r - 1].name}」にする`, coins, n: (st) => [st.rank >= r ? 1 : 0, 1] });
export const GOALS = [
  { id: 'mine1', t: '鉱区を手に入れる', coins: 100, go: ['ratnapura', 'mine'], n: (st) => [cnt(st.mines), 1] },
  { id: 'fact1', t: '工場を手に入れる', coins: 100, go: ['ratnapura', 'factory'], n: (st) => [cnt(st.factories), 1] },
  { id: 'sell1', t: '取引所で宝石を売る', coins: 150, go: ['tokyo', 'exchange'], n: (st) => [st.earned > 0 ? 1 : 0, 1] },
  { id: 'div1', t: '配当を受け取る', coins: 150, go: ['tokyo', 'hq'], n: (st) => [st.divTotal > 0 ? 1 : 0, 1] },
  { id: 'mine3', t: '鉱区を 3 つにする', coins: 200, n: (st) => [cnt(st.mines), 3] },
  { id: 'mineup', t: '鉱区の設備を強化する', coins: 200, n: (st) => [Object.values(st.mines).some((m) => m.lv >= 2) ? 1 : 0, 1] },
  rankGoal(2, 300),
  { id: 'boss1', t: '人を雇う（鉱山長・工場長・店長）', coins: 300, n: (st) => [anyBoss(st) ? 1 : 0, 1] },
  { id: 'shop1', t: '直営店を出す', coins: 400, go: ['tokyo', 'shop'], n: (st) => [cnt(st.shops), 1] },
  { id: 'sales1', t: '累計の売上を $1M にする', coins: 500, n: (st) => [Math.min(st.earned, 1e6), 1e6], money: true },
  { id: 'mine6', t: '鉱区を 6 つにする', coins: 500, n: (st) => [cnt(st.mines), 6] },
  rankGoal(3, 800),
  { id: 'cert1', t: '鑑定所で鑑定書を付ける', coins: 600, go: ['carlsbad', 'lab'], n: (st) => [(st.stat.cert || 0) > 0 ? 1 : 0, 1] },
  { id: 'order1', t: '本社に届いた注文を納める', coins: 600, go: ['tokyo', 'hq', 'order'], n: (st) => [Math.min(st.stat.order || 0, 1), 1] },
  { id: 'fact4', t: '工場を 4 つにする', coins: 700, n: (st) => [cnt(st.factories), 4] },
  rankGoal(4, 1500),
  { id: 'auction1', t: 'オークションで石を落札させる', coins: 1500, go: ['hongkong', 'auction'], n: (st) => [Math.min(st.stat.auction || 0, 1), 1] },
  rankGoal(5, 3000),
  { id: 'sight1', t: 'ハボローネのサイトで原石の箱を買う', coins: 2000, go: ['gaborone', 'sight'], n: (st) => [Math.min(st.stat.sight || 0, 1), 1] },
  { id: 'shop4', t: '直営店を 4 つにする', coins: 2500, n: (st) => [cnt(st.shops), 4] },
  rankGoal(6, 6000),
  { id: 'mine20', t: '鉱区を 20 にする', coins: 4000, n: (st) => [cnt(st.mines), 20] },
  rankGoal(7, 12000),
];
export const goalNow = (st) => GOALS.find((g) => !(st.goals || {})[g.id]) || null;
export const goalDone = (st, g) => { const [a, b] = g.n(st); return a >= b; };
// 受け取る（入るコインの数を返す。コインを save に足すのは呼ぶ側）
export function claimGoal(st) {
  const g = goalNow(st);
  if (!g || !goalDone(st, g)) return 0;
  (st.goals || (st.goals = {}))[g.id] = 1;
  return g.coins;
}

// ---------------------------------------------------------------- 会社の値打ちとランク
// 総資産 = 資金 + 施設に払った額の半分 + 在庫（卸した場合）+ 原石（倉庫・輸送中・工場の待ち。原石で売った場合）
export function companyValue(st) {
  let v = st.cash + st.spent * 0.5;
  for (const k in st.stock) v += lotValue(st, k, st.stock[k], 0.6);
  for (const id in st.shops) for (const k in st.shops[id].shelf) v += lotValue(st, k, st.shops[id].shelf[k], 0.6);
  for (const j of st.labs) v += lotValue(st, j.k, j, 0.6);
  for (const id in st.auctions) for (const l of st.auctions[id].lots) v += lotValue(st, l.k, l, 0.6);
  const rough = (items) => { let s = 0; for (const k in items) { const [gem, g] = k.split('|'); s += items[k] * refVal(gem) * GRADE_MUL[+g] * 0.2; } return s; };
  for (const id in st.mines) v += rough(st.mines[id].store);
  v += rough(st.sight.store);
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
  const order = st.orders.list.filter((o) => orderReady(st, o, st.last)).length;
  const g = goalNow(st), goal = !!(g && goalDone(st, g));
  return { full, nofund, div, order, goal, any: !!(full || nofund || div || order || goal) };
}
