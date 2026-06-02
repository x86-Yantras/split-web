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

  const EVENT = {
    GROUP_CREATED: 'GROUP_CREATED', GROUP_EDITED: 'GROUP_EDITED',
    MEMBER_ADDED: 'MEMBER_ADDED', MEMBER_EDITED: 'MEMBER_EDITED',
    EXPENSE_ADDED: 'EXPENSE_ADDED', EXPENSE_EDITED: 'EXPENSE_EDITED', EXPENSE_DELETED: 'EXPENSE_DELETED',
    PAYMENT_RECORDED: 'PAYMENT_RECORDED', COMMENT_ADDED: 'COMMENT_ADDED', PAYPAL_SET: 'PAYPAL_SET',
  };

  // Fold an ordered event log into materialized group state.
  function foldEvents(events) {
    const ordered = [...events].sort((a, b) => (a.seq || 0) - (b.seq || 0));
    const g = { meta: {}, members: [], expenses: [], payments: [], comments: [] };
    const expIdx = {}, memIdx = {};
    for (const ev of ordered) {
      const p = ev.payload || {};
      switch (ev.type) {
        case EVENT.GROUP_CREATED:
        case EVENT.GROUP_EDITED:
          Object.assign(g.meta, p); break;
        case EVENT.MEMBER_ADDED:
          if (memIdx[p.person_id] == null) { memIdx[p.person_id] = g.members.length; g.members.push(Object.assign({}, p)); }
          else Object.assign(g.members[memIdx[p.person_id]], p);
          break;
        case EVENT.MEMBER_EDITED:
          if (memIdx[p.person_id] != null) Object.assign(g.members[memIdx[p.person_id]], p);
          break;
        case EVENT.PAYPAL_SET:
          if (memIdx[p.person_id] != null) g.members[memIdx[p.person_id]].paypal = p.paypal;
          break;
        case EVENT.EXPENSE_ADDED:
          expIdx[p.id] = g.expenses.length; g.expenses.push(Object.assign({}, p)); break;
        case EVENT.EXPENSE_EDITED:
          if (expIdx[p.id] != null) Object.assign(g.expenses[expIdx[p.id]], p); break;
        case EVENT.EXPENSE_DELETED:
          if (expIdx[p.id] != null) g.expenses[expIdx[p.id]].deleted = true; break;
        case EVENT.PAYMENT_RECORDED:
          g.payments.push(Object.assign({}, p)); break;
        case EVENT.COMMENT_ADDED:
          g.comments.push(Object.assign({}, p)); break;
      }
    }
    return g;
  }

  function relativeTime(ts, nowMs) {
    const diff = Math.max(0, (nowMs || 0) - ts);
    const h = diff / 3.6e6, d = h / 24;
    if (h < 1) return Math.max(1, Math.round(diff / 6e4)) + 'm ago';
    if (h < 24) return Math.round(h) + 'h ago';
    if (d < 2) return 'Yesterday';
    return Math.round(d) + 'd ago';
  }

  // Derive the activity feed (newest first) from one group's event log.
  function deriveActivity(events, groupId, meId, nowMs) {
    meId = meId || 'me';
    const out = [];
    for (const ev of events) {
      const p = ev.payload || {};
      const base = { id: ev.id || ('a' + ev.seq), who: ev.actor, group: groupId, when: relativeTime(ev.ts || 0, nowMs) };
      if (ev.type === EVENT.EXPENSE_ADDED) {
        const youArePayer = p.paidBy === meId;
        out.push(Object.assign(base, {
          type: 'expense', desc: p.desc, amount: p.amount, currency: p.currency,
          share: shareOf(p, meId), you: youArePayer ? 'lent' : 'owe',
        }));
      } else if (ev.type === EVENT.PAYMENT_RECORDED) {
        out.push(Object.assign(base, { type: 'payment', desc: p.to === meId ? 'paid you' : 'recorded a payment', amount: p.amount, currency: p.currency }));
      } else if (ev.type === EVENT.COMMENT_ADDED) {
        out.push(Object.assign(base, { type: 'comment', desc: 'on ' + (p.expenseDesc || 'an expense'), text: p.text }));
      } else if (ev.type === EVENT.GROUP_CREATED) {
        out.push(Object.assign(base, { type: 'group', desc: 'created ' + (p.name || 'a group') }));
      }
    }
    return out.reverse();
  }

  return { splitMap, shareOf, memberNets, balancesWithMe, groupSummary, friendBalances, minimizeTransactions, toCSV, EVENT, foldEvents, deriveActivity, relativeTime, _CCY: CCY };
});
