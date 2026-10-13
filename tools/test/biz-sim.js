// 経営のバランスを、決まった遊び方で回して確かめる（ブラウザ不要）
// 使い方：node tools/test/biz-sim.js [日数=30] [確認の間隔（分）=45] [1 ランの平均コイン=1500]
// 遊び方：起きている 16 時間は間隔ごとに開いて、出荷・棚に並べる・売却・いちばん得な買い物・人を雇う。寝ている 8 時間は放置。毎日配当を受け取る
(async () => {
  const B = await import('../../js/biz.js');
  const D = await import('../../js/biz-data.js');
  const DAYS = +(process.argv[2] || 30), GAP = +(process.argv[3] || 45), AVG = +(process.argv[4] || 1500);
  const H = 3600e3;
  let now = Date.UTC(2026, 0, 1, 7);
  const st = B.newBiz(now);
  const log = [];
  let coins = 0, lastRank = 1;
  const rankAt = {};
  // 鉱区が出す価値（$/時）と工場の処理量の合計
  const mineEarn = () => Object.keys(st.mines).reduce((s, id) => s + D.TIER.earn[D.MINES[id].r] * (D.MINES[id].e || 1) * D.MINE_LV[st.mines[id].lv - 1].out * (st.mines[id].reserve > 1 ? 1 : 0), 0);
  const factWork = (pred) => Object.keys(st.factories).filter(pred || (() => true)).reduce((s, id) => s + B.factCap(st, id), 0);
  const hasDiamond = () => Object.keys(st.mines).some((id) => D.MINES[id].mix.diamond);
  function options() {
    const o = [];
    const earn = mineEarn(), work = factWork((id) => !D.FACTORIES[id].only), dwork = factWork((id) => D.FACTORIES[id].only);
    const needFactory = earn > work * 0.9;
    for (const id in D.MINES) {
      const M = D.MINES[id];
      if (M.r > st.rank) continue;
      const gain = D.TIER.earn[M.r] * (M.e || 1);
      if (!st.mines[id]) o.push({ cost: B.minePrice(id), gain: gain * (needFactory ? 0.4 : 1), act: () => B.buyMine(st, id), what: 'mine ' + id });
      else {
        const m = st.mines[id];
        const c = B.mineUpCost(st, id);
        if (c) o.push({ cost: c, gain: gain * (D.MINE_LV[m.lv].out - D.MINE_LV[m.lv - 1].out) * (needFactory ? 0.4 : 1), act: () => B.upgradeMine(st, id), what: 'mineup ' + id });
        if (m.reserve < B.mineBaseOut(id) * 24 * 5) o.push({ cost: B.exploreCost(st, id), gain: gain * 3, act: () => B.explore(st, id), what: 'explore ' + id });
      }
    }
    for (const id in D.FACTORIES) {
      const F = D.FACTORIES[id];
      if (F.r > st.rank) continue;
      const dia = !!F.only;
      if (dia && !hasDiamond()) continue;
      // 工場 1 つで増える売り上げの見積もり（処理量に、原石の品質の平均ぶん約 0.6 を掛ける）
      const w = D.TIER.earn[F.r] * 1.6 * 0.6 * (F.cap || 1);
      const want = dia ? 1.5 : needFactory ? 1.5 : 0.3;
      if (!st.factories[id]) o.push({ cost: B.factPrice(id), gain: w * want, act: () => B.buyFactory(st, id), what: 'fact ' + id });
      else {
        const f = st.factories[id];
        const c = B.factUpCost(st, id);
        if (c) o.push({ cost: c, gain: w * (D.FACT_LV[f.lv].cap - D.FACT_LV[f.lv - 1].cap) * want, act: () => B.upgradeFactory(st, id), what: 'factup ' + id });
        const cc = B.crewCost(st, id);
        if (cc) o.push({ cost: cc, gain: work * 0.1, act: () => B.hireCrew(st, id), what: 'crew ' + id });
      }
    }
    // 直営店：卸との差（相場の約 85%）が増える売り上げ
    for (const id in D.SHOPS) {
      if (D.SHOPS[id].r > st.rank) continue;
      const sh = st.shops[id];
      if (!sh) o.push({ cost: B.shopPrice(id), gain: B.shopCapAt(id, 1) * 0.85, act: () => B.buyShop(st, id), what: 'shop ' + id });
      else {
        const c = B.shopUpCost(st, id);
        if (c) o.push({ cost: c, gain: (B.shopCapAt(id, sh.lv + 1) - B.shopCapAt(id, sh.lv)) * 0.85, act: () => B.upgradeShop(st, id), what: 'shopup ' + id });
      }
    }
    return o.filter((x) => x.cost > 0).sort((a, b) => b.gain / b.cost - a.gain / a.cost);
  }
  function visit() {
    B.catchUp(st, now);
    // 出荷：磨ける工場のうち待ちが一番少ないところへ
    for (const id in st.mines) {
      const fs = Object.keys(st.factories).filter((f) => Object.keys(st.mines[id].store).some((k) => B.canCut(f, k.split('|')[0])));
      if (fs.length) { fs.sort((a, b) => B.queueWork(st.factories[a]) / B.factCap(st, a) - B.queueWork(st.factories[b]) / B.factCap(st, b)); B.ship(st, id, fs[0], now); }
      if (B.storeTotal(st.mines[id]) > 0 && !fs.length) B.sellRough(st, id);
    }
    // 直営店の棚に並べてから、残りを卸す
    for (const id in st.shops) B.autoShelf(st, id);
    for (const k of Object.keys(st.stock)) { const b = B.bestExchange(st, (ex) => B.sellPrice(st, k, ex)); B.sellLot(st, k, b.id); }
    // 人を雇う：資金の 5% 以下で雇えるなら雇う（鉱山長と店長）
    if (st.rank >= D.STAFF.r) {
      for (const id in st.mines) if (!st.mines[id].boss && B.staffCost('mine', id) < st.cash * 0.05) B.hireBoss(st, 'mine', id);
      for (const id in st.shops) if (!st.shops[id].boss && B.staffCost('shop', id) < st.cash * 0.05) B.hireBoss(st, 'shop', id);
    }
    // 買い物：手間賃の分を少し残して、得な順に
    for (let i = 0; i < 20; i++) {
      const o = options()[0];
      if (!o || st.cash - o.cost < mineEarn() * 0.15) break;
      if (!o.act()) break;
      log.push(`d${((now - Date.UTC(2026, 0, 1, 7)) / 864e5).toFixed(2)} ${o.what} $${Math.round(o.cost)}`);
    }
    B.updateRank(st);
    if (st.rank !== lastRank) { rankAt[st.rank] = ((now - Date.UTC(2026, 0, 1, 7)) / 864e5).toFixed(2); lastRank = st.rank; }
  }
  // 最初：ラトナプラの鉱区と工場
  B.buyMine(st, 'ratnapura'); B.buyFactory(st, 'ratnapura');
  const rows = [];
  for (let d = 0; d < DAYS; d++) {
    const day = 'd' + d;
    for (let m = 0; m < 16 * 60; m += GAP) { now += GAP * 60e3; visit(); }
    coins += B.payDividend(st, AVG, day);
    const v = B.companyValue(st);
    rows.push(`day ${String(d + 1).padStart(2)}  rank ${st.rank} ${D.RANKS[st.rank - 1].name.padEnd(5, '　')}  value $${(v / 1e6).toFixed(2)}M  cash $${(st.cash / 1e6).toFixed(2)}M  mines ${Object.keys(st.mines).length} facts ${Object.keys(st.factories).length}  earn/h $${(mineEarn() / 1e3).toFixed(0)}K  div ${st.div.paid}/${B.divCap(st, AVG)}  coins ${coins}`);
    now += 8 * H;
  }
  console.log(rows.join('\n'));
  console.log('rank reached (day):', JSON.stringify(rankAt));
  const shops = Object.entries(st.shops).map(([id, sh]) => `${id} Lv${sh.lv} $${(sh.sales / 1e6).toFixed(1)}M`).join(', ');
  console.log('shops:', shops || 'none', ' bosses:', Object.values(st.mines).filter((m) => m.boss).length, 'mines', Object.values(st.shops).filter((m) => m.boss).length, 'shops');
  if (process.env.LOG) console.log(log.slice(0, +process.env.LOG).join('\n'));
})();
