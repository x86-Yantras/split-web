// Pure domain logic for SplitSplit. Browser global `window.SSDomain` AND Node module.
// NO DOM, NO network. Everything here is unit-tested.
(function (root, factory) {
  const mod = factory(root.CCY || (typeof require !== 'undefined' ? require('./currency') : null));
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  root.SSDomain = mod;
})(typeof window !== 'undefined' ? window : globalThis, function (CCY) {
  'use strict';

  // {personId: shareAmount} for an expense, handling all 4 split modes.
  function splitMap(e) {
    const parts = e.participants || [];
    const out = {};
    if (e.split === 'percent') {
      for (const p of parts) out[p] = e.amount * ((e.percents && e.percents[p] || 0) / 100);
    } else if (e.split === 'shares') {
      const total = Object.values(e.shares || {}).reduce((s, n) => s + n, 0) || 1;
      for (const p of parts) out[p] = e.amount * ((e.shares && e.shares[p] || 0) / total);
    } else if (e.split === 'exact') {
      for (const p of parts) out[p] = parseFloat(e.exacts && e.exacts[p]) || 0;
    } else { // 'equal' (default)
      const share = e.amount / (parts.length || 1);
      for (const p of parts) out[p] = share;
    }
    return out;
  }

  function shareOf(e, personId) {
    return splitMap(e)[personId] || 0;
  }

  // Group-wide per-person net: + = is owed by the group, - = owes the group.
  function memberNets(expenses, payments, members) {
    const net = {};
    for (const m of members) net[m] = 0;
    for (const e of expenses) {
      if (e.deleted) continue;
      if (net[e.paidBy] !== undefined) net[e.paidBy] += e.amount;
      const sm = splitMap(e);
      for (const p of Object.keys(sm)) if (net[p] !== undefined) net[p] -= sm[p];
    }
    for (const pay of (payments || [])) {
      if (net[pay.from] !== undefined) net[pay.from] += pay.amount;
      if (net[pay.to] !== undefined) net[pay.to] -= pay.amount;
    }
    return net;
  }

  // Per-member balance relative to me (excludes me). + = they owe me.
  function balancesWithMe(expenses, payments, members, meId) {
    meId = meId || 'me';
    const net = {};
    for (const m of members) if (m !== meId) net[m] = 0;
    for (const e of expenses) {
      if (e.deleted) continue;
      const sm = splitMap(e);
      if (e.paidBy === meId) {
        for (const p of e.participants) if (p !== meId && net[p] !== undefined) net[p] += sm[p];
      } else if (e.participants.includes(meId)) {
        if (net[e.paidBy] !== undefined) net[e.paidBy] -= sm[meId];
      }
    }
    for (const pay of (payments || [])) {
      if (pay.from === meId && net[pay.to] !== undefined) net[pay.to] += pay.amount;
      if (pay.to === meId && net[pay.from] !== undefined) net[pay.from] -= pay.amount;
    }
    return net;
  }

  // { youOwe, youAreOwed } — DERIVED, never stored.
  function groupSummary(expenses, payments, members, meId) {
    const b = balancesWithMe(expenses, payments, members, meId);
    let youOwe = 0, youAreOwed = 0;
    for (const v of Object.values(b)) {
      if (v > 0.005) youAreOwed += v;
      else if (v < -0.005) youOwe += -v;
    }
    return { youOwe, youAreOwed };
  }

  // [{ id, balance, currency }] aggregated across groups, per (friend,currency), nonzero only.
  function friendBalances(groups, expensesByGroup, paymentsByGroup, meId) {
    meId = meId || 'me';
    const acc = {};
    for (const g of groups) {
      const exps = expensesByGroup[g.id] || [];
      const pays = (paymentsByGroup || {})[g.id] || [];
      const b = balancesWithMe(exps, pays, g.members, meId);
      for (const [id, amt] of Object.entries(b)) {
        const key = id + '|' + g.currency;
        acc[key] = (acc[key] || 0) + amt;
      }
    }
    return Object.entries(acc)
      .filter(([, amt]) => Math.abs(amt) > 0.01)
      .map(([key, amt]) => {
        const [id, currency] = key.split('|');
        return { id, currency, balance: amt };
      });
  }

  // Greedy fewest-payments settlement from a net map (+ owed, - owes).
  function minimizeTransactions(netMap) {
    const creditors = [], debtors = [];
    for (const [id, amt] of Object.entries(netMap)) {
      if (amt > 0.01) creditors.push({ id, amt });
      else if (amt < -0.01) debtors.push({ id, amt: -amt });
    }
    creditors.sort((x, y) => y.amt - x.amt);
    debtors.sort((x, y) => y.amt - x.amt);
    const txns = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const pay = Math.min(debtors[i].amt, creditors[j].amt);
      txns.push({ from: debtors[i].id, to: creditors[j].id, amount: Math.round(pay * 100) / 100 });
      debtors[i].amt -= pay; creditors[j].amt -= pay;
      if (debtors[i].amt < 0.01) i++;
      if (creditors[j].amt < 0.01) j++;
    }
    return txns;
  }

  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCSV(group, expenses, people, meId) {
    meId = meId || 'me';
    const header = ['date', 'description', 'category', 'amount', 'currency', 'paid_by', 'split', 'your_share'];
    const rows = [header.join(',')];
    for (const e of expenses) {
      if (e.deleted) continue;
      const payer = (people[e.paidBy] && people[e.paidBy].name) || e.paidBy;
      const row = [e.date, e.desc, e.category || '', e.amount, e.currency, payer, e.split,
        Math.round(shareOf(e, meId) * 100) / 100];
      rows.push(row.map(csvCell).join(','));
    }
    return rows.join('\n') + '\n';
  }

  return { splitMap, shareOf, memberNets, balancesWithMe, groupSummary, friendBalances, minimizeTransactions, toCSV, _CCY: CCY };
});
