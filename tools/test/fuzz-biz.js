// 経営のでたらめ操作：でたらめな操作と時計（戻る・大きく飛ぶ）で状態を回し、例外・NaN・負の数・上限の超過を拾う（ブラウザ不要）
// 使い方：node tools/test/fuzz-biz.js [種の数=30] [1 つの種の手数=4000]   （V=1 で種ごとの様子）
(async () => {
  const B = await import('../../js/biz.js');
  const D = await import('../../js/biz-data.js');
  const SEEDS = +(process.argv[2] || 30), STEPS = +(process.argv[3] || 4000);
  const H = 3600e3;
  const found = new Map();
  const note = (k, d) => { if (!found.has(k)) found.set(k, d); };
  function scan(v, path, out) {
    if (typeof v === 'number') { if (!Number.isFinite(v)) out.push(path + '=' + v); return; }
    if (!v || typeof v !== 'object') return;
    for (const k in v) scan(v[k], path + '.' + k, out);
  }
  function neg(st, out) {
    if (st.cash < -1e-6) out.push('cash<0 ' + st.cash);
    for (const k in st.stock) { const s = st.stock[k]; if (s.n < -1e-9 || s.ct < -1e-9) out.push(`stock<0 ${k} ${s.n}`); if (s.n === 0 && s.ct === 0) out.push('stock empty kept ' + k); }
    for (const id in st.mines) { const m = st.mines[id]; if (m.reserve < -1e-6) out.push('reserve<0 ' + id); for (const k in m.store) if (m.store[k] < -1e-9) out.push('store<0 ' + id); if (B.storeTotal(m) > B.storeCap(st, id) * 1.001 + 1e-6) out.push(`store>cap ${id} ${B.storeTotal(m)}/${B.storeCap(st, id)}`); }
    for (const id in st.shops) for (const k in st.shops[id].shelf) { const e = st.shops[id].shelf[k]; if (e.n < -1e-9) out.push('shelf<0'); }
    if (st.div && st.div.paid < 0) out.push('div.paid<0');
    if (st.finds.length > D.FIND.max + 1) out.push('finds>max ' + st.finds.length);
    if (st.vault.length > D.FIND.vaultCap) out.push('vault>cap');
  }
  for (let seed = 1; seed <= SEEDS; seed++) {
    let r = seed * 2654435761 % 4294967296;
    const rnd = () => (r = (r * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    let now = Date.UTC(2026, 0, 1 + (seed % 60), 7);
    const st = B.newBiz(now);
    const rich = seed % 3 === 0;
    const hist = [];
    let total0 = null;
    for (let i = 0; i < STEPS; i++) {
      if (rich && rnd() < 0.05) st.cash += B.companyValue(st) * 0.5 + 1e4;
      const keys = () => Object.keys(st.stock);
      const mines = () => Object.keys(st.mines), facts = () => Object.keys(st.factories), shops = () => Object.keys(st.shops);
      const today = new Date(now).toISOString().slice(0, 10);
      const acts = [
        ['time', () => { const x = rnd(); now += x < 0.5 ? 60e3 * (1 + rnd() * 30) : x < 0.9 ? H * rnd() * 8 : x < 0.97 ? H * 24 * rnd() * 3 : x < 0.985 ? -H * rnd() * 30 : H * 24 * 400 * rnd(); B.catchUp(st, now); }],
        ['time', () => { now += 60e3 * (1 + rnd() * 90); B.catchUp(st, now); }],
        ['buyMine', () => B.buyMine(st, pick(Object.keys(D.MINES)))],
        ['upMine', () => mines().length && B.upgradeMine(st, pick(mines()))],
        ['upStore', () => mines().length && B.upgradeStore(st, pick(mines()))],
        ['explore', () => mines().length && rnd() < 0.2 && B.explore(st, pick(mines()))],
        ['buyFact', () => B.buyFactory(st, pick(Object.keys(D.FACTORIES)))],
        ['upFact', () => facts().length && B.upgradeFactory(st, pick(facts()))],
        ['crew', () => facts().length && B.hireCrew(st, pick(facts()))],
        ['policy', () => facts().length && B.setPolicy(st, pick(facts()), pick(['yield', 'normal', 'shine']))],
        ['treat', () => facts().length && B.setTreat(st, pick(facts()), rnd() < 0.5)],
        ['boss', () => { const kind = pick(['mine', 'factory', 'shop']); const ids = kind === 'mine' ? mines() : kind === 'factory' ? facts() : shops(); return ids.length && B.hireBoss(st, kind, pick(ids)); }],
        ['mineTo', () => mines().length && facts().length && B.setMineTo(st, pick(mines()), pick(facts()))],
        ['factOut', () => facts().length && B.setFactOut(st, pick(facts()), pick(['stock', ...Object.keys(D.EXCHANGES), ...Object.keys(D.LABS).map((l) => 'lab:' + l)]))],
        ['ship', () => mines().length && facts().length && B.ship(st, pick([...mines(), ...Object.keys(D.SIGHTS)]), pick(facts()), now)],
        ['sellRough', () => mines().length && rnd() < 0.3 && B.sellRough(st, pick(mines()))],
        ['sellLot', () => keys().length && B.sellLot(st, pick(keys()), pick(Object.keys(D.EXCHANGES).filter((e) => B.exOpen(st, e, now))))],
        ['buyShop', () => B.buyShop(st, pick(Object.keys(D.SHOPS)))],
        ['upShop', () => shops().length && B.upgradeShop(st, pick(shops()))],
        ['shelve', () => shops().length && keys().length && B.shelve(st, pick(shops()), pick(keys()))],
        ['unshelve', () => { if (!shops().length) return; const id = pick(shops()); const ks = Object.keys(st.shops[id].shelf); return ks.length && B.unshelve(st, id, pick(ks)); }],
        ['autoShelf', () => shops().length && B.autoShelf(st, pick(shops()))],
        ['lab', () => keys().length && B.sendLab(st, pick(Object.keys(D.LABS)), pick(keys()), now)],
        ['consign', () => keys().length && B.consign(st, pick(Object.keys(D.AUCTIONS)), pick(keys()), now)],
        ['withdraw', () => { const id = pick(Object.keys(D.AUCTIONS)); const a = st.auctions[id]; return a && a.lots.length && B.withdraw(st, id, pick(a.lots).k); }],
        ['sight', () => B.buySight(st, pick(Object.keys(D.SIGHTS)), now)],
        ['deliver', () => st.orders.list.length && B.deliver(st, pick(st.orders.list).id, now)],
        ['polish', () => { const f = st.finds.find((x) => x.raw); return f && B.polishFind(st, f.id, rnd(), Math.floor(rnd() * 5)); }],
        ['keep', () => st.finds.length && B.keepFind(st, pick(st.finds).id)],
        ['sellFind', () => { const all = [...st.finds, ...st.vault]; return all.length && rnd() < 0.3 && B.sellFind(st, pick(all).id); }],
        ['deal', () => st.deal && B.resolveDeal(st, rnd() < 0.6, now)],
        ['vipAsk', () => { const v = st.vip; if (!v) return; const ks = B.vipLots(st, v); if (!ks.length) return; const k = pick(ks); const q = B.vipQuote(st, k); const base = typeof q === 'number' ? q : (q && (q.v || q.m || q.ask)) || 100; return B.vipAsk(st, k, base * (0.5 + rnd() * 1.2), now); }],
        ['vipAns', () => st.vip && st.vip.counter && B.vipAnswer(st, rnd() < 0.7, now)],
        ['goal', () => B.claimGoal(st)],
        ['rank', () => B.updateRank(st)],
        ['div', () => B.payDividend(st, pick([0, 300, 1500, 40000]), today)],
        ['invest', () => rnd() < 0.1 && B.invest(st, Math.floor(rnd() * 5000), pick([0, 1500, 40000]))],
        ['alerts', () => B.bizAlerts(st, 1500, today)],
        ['value', () => B.companyValue(st)],
        ['away', () => { const m = B.awayMark(st, now - H * 3); return B.awaySince(st, m, now); }],
        ['json', () => { const c = JSON.parse(JSON.stringify(st)); for (const k in st) delete st[k]; Object.assign(st, c); }],
      ];
      const [name, fn] = pick(acts);
      hist.push(name);
      try { fn(); } catch (e) { note('THROW ' + name + ': ' + String(e.stack).split('\n').slice(0, 3).join(' | '), `seed ${seed} step ${i} rank ${st.rank}`); }
      const out = [];
      scan(st, 'st', out);
      neg(st, out);
      for (const o of out) note(`BAD after ${name}: ` + o.replace(/[-\d.e+]{6,}/g, '#'), `seed ${seed} step ${i} rank ${st.rank} :: ${o}`);
      if (out.some((o) => /=NaN|=Infinity/.test(o))) break;
    }
    if (process.env.V) console.log('  size', JSON.stringify(st).length, Object.entries(st).map(([k, v]) => [k, JSON.stringify(v).length]).sort((a, b) => b[1] - a[1]).slice(0, 5).map((x) => x.join(':')).join(' '));
    if (process.env.V) console.log(`seed ${seed}: rank ${st.rank} cash ${Math.round(st.cash)} mines ${Object.keys(st.mines).length} facts ${Object.keys(st.factories).length} shops ${Object.keys(st.shops).length} finds ${st.stat.finds} vault ${st.vault.length}`);
  }
  for (const [k, d] of found) console.log(k + '\n     @ ' + d);
  console.log(`biz fuzz: ${SEEDS} seeds x ${STEPS} steps, ${found.size} kinds of problems`);
})();
