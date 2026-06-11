'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { assertClose } = require('./helpers');
const CCY = require('../src/currency');

test('currency: symbols + codes present', () => {
  assert.equal(CCY.symbols.USD, '$');
  assert.ok(CCY.codes.includes('JPY'));
});

test('currency: format whole-number currencies without decimals', () => {
  assert.equal(CCY.format(18420, 'JPY'), '¥18,420');
  assert.equal(CCY.format(142.5, 'USD'), '$142.50');
  assert.equal(CCY.format(-53.3, 'USD'), '-$53.30');
});

test('currency: convert via USD pivot, identity when same', () => {
  assert.equal(CCY.convert(100, 'USD', 'USD'), 100);
  assertClose(CCY.convert(92, 'EUR', 'USD'), 100, 'EUR→USD');
});

// ── CYCLE A: split math ─────────────────────────────────────────────────────
const D = require('../src/domain');
const { expense } = require('./helpers');

test('splitMap: equal divides amount across participants', () => {
  const m = D.splitMap(expense({ amount: 90, participants: ['me', 'a', 'b'] }));
  assertClose(m.me, 30, 'me'); assertClose(m.a, 30, 'a'); assertClose(m.b, 30, 'b');
});

test('splitMap: shares weights by ratio', () => {
  const m = D.splitMap(expense({ amount: 100, split: 'shares', participants: ['me', 'a'], shares: { me: 1, a: 3 } }));
  assertClose(m.me, 25, 'me'); assertClose(m.a, 75, 'a');
});

test('splitMap: percent uses 0..100', () => {
  const m = D.splitMap(expense({ amount: 200, split: 'percent', participants: ['me', 'a'], percents: { me: 30, a: 70 } }));
  assertClose(m.me, 60, 'me'); assertClose(m.a, 140, 'a');
});

test('splitMap: exact reads explicit amounts', () => {
  const m = D.splitMap(expense({ amount: 50, split: 'exact', participants: ['me', 'a'], exacts: { me: '20', a: '30' } }));
  assertClose(m.me, 20, 'me'); assertClose(m.a, 30, 'a');
});

test('shareOf: returns one person, 0 if not a participant', () => {
  const e = expense({ amount: 90 });
  assertClose(D.shareOf(e, 'me'), 30, 'me');
  assert.equal(D.shareOf(e, 'zzz'), 0);
});

// ── CYCLE B: balances + summaries ───────────────────────────────────────────
const { payment } = require('./helpers');

test('memberNets: payer credited, participants debited', () => {
  const exps = [expense({ amount: 90, paidBy: 'me', participants: ['me', 'a', 'b'] })];
  const net = D.memberNets(exps, [], ['me', 'a', 'b']);
  assertClose(net.me, 60, 'me net = paid 90 - used 30');
  assertClose(net.a, -30, 'a'); assertClose(net.b, -30, 'b');
});

test('memberNets: a payment from debtor to creditor moves both toward 0', () => {
  const exps = [expense({ amount: 90, paidBy: 'me', participants: ['me', 'a', 'b'] })];
  const net = D.memberNets(exps, [payment({ from: 'a', to: 'me', amount: 30 })], ['me', 'a', 'b']);
  assertClose(net.a, 0, 'a paid back');
  assertClose(net.me, 30, 'me now owed 30 (b still owes)');
});

test('memberNets: deleted expenses are ignored', () => {
  const exps = [expense({ amount: 90, deleted: true })];
  const net = D.memberNets(exps, [], ['me', 'a', 'b']);
  assertClose(net.me, 0, 'me'); assertClose(net.a, 0, 'a');
});

test('balancesWithMe: positive means they owe me', () => {
  const exps = [expense({ amount: 100, paidBy: 'me', participants: ['me', 'a'] })];
  const b = D.balancesWithMe(exps, [], ['me', 'a']);
  assertClose(b.a, 50, 'a owes me half');
});

test('balancesWithMe: when other paid and I am in, I owe them (negative)', () => {
  const exps = [expense({ amount: 100, paidBy: 'a', participants: ['me', 'a'] })];
  const b = D.balancesWithMe(exps, [], ['me', 'a']);
  assertClose(b.a, -50, 'I owe a');
});

test('groupSummary: splits net into youOwe / youAreOwed', () => {
  const exps = [
    expense({ amount: 100, paidBy: 'me', participants: ['me', 'a'] }),
    expense({ amount: 40, paidBy: 'b', participants: ['me', 'b'] }),
  ];
  const s = D.groupSummary(exps, [], ['me', 'a', 'b']);
  assertClose(s.youAreOwed, 50, 'owed'); assertClose(s.youOwe, 20, 'owe');
});

test('friendBalances: rolls up per (friend,currency), drops settled', () => {
  const groups = [
    { id: 'g1', currency: 'USD', members: ['me', 'a'] },
    { id: 'g2', currency: 'EUR', members: ['me', 'a', 'b'] },
  ];
  const expensesByGroup = {
    g1: [expense({ amount: 100, currency: 'USD', paidBy: 'me', participants: ['me', 'a'] })],
    g2: [expense({ amount: 60, currency: 'EUR', paidBy: 'b', participants: ['me', 'b'] })],
  };
  const fb = D.friendBalances(groups, expensesByGroup, {}, 'me');
  const aUsd = fb.find(x => x.id === 'a' && x.currency === 'USD');
  const bEur = fb.find(x => x.id === 'b' && x.currency === 'EUR');
  assertClose(aUsd.balance, 50, 'a USD'); assertClose(bEur.balance, -30, 'b EUR');
  assert.ok(!fb.some(x => x.balance === 0), 'no settled rows');
});

// ── CYCLE C: minimization + CSV ─────────────────────────────────────────────
test('minimizeTransactions: 3-way settles in 2 payments', () => {
  const txns = D.minimizeTransactions({ me: 60, a: -30, b: -30 });
  assert.equal(txns.length, 2);
  const total = txns.reduce((s, t) => s + t.amount, 0);
  assertClose(total, 60, 'total moved');
  assert.ok(txns.every(t => t.to === 'me'), 'everyone pays me');
});

test('minimizeTransactions: already settled → no payments', () => {
  assert.deepEqual(D.minimizeTransactions({ me: 0, a: 0 }), []);
});

test('minimizeTransactions: chains debtor to multiple creditors', () => {
  const txns = D.minimizeTransactions({ a: -50, me: 30, b: 20 });
  assert.equal(txns.length, 2);
  assert.ok(txns.every(t => t.from === 'a'));
  assertClose(txns.reduce((s, t) => s + t.amount, 0), 50, 'sum');
});

test('toCSV: header + one row per expense with your share', () => {
  const people = { me: { name: 'You' }, a: { name: 'Alex Chen' } };
  const exps = [expense({ id: 'x1', desc: 'Lunch', amount: 100, currency: 'USD', paidBy: 'me', participants: ['me', 'a'] })];
  const csv = D.toCSV({ name: 'Trip', currency: 'USD' }, exps, people, 'me');
  const lines = csv.trim().split('\n');
  assert.match(lines[0], /date,description,category,amount,currency,paid_by,split,your_share/);
  assert.match(lines[1], /Lunch/);
  assert.match(lines[1], /50/);
});

test('toCSV: escapes commas/quotes in description', () => {
  const csv = D.toCSV({ name: 'G', currency: 'USD' }, [expense({ desc: 'Taxi, tip "big"' })], { me: { name: 'You' } }, 'me');
  assert.match(csv, /"Taxi, tip ""big"""/);
});

// ── CYCLE D: event fold + activity ──────────────────────────────────────────
test('foldEvents: builds members + expenses + payments from the log', () => {
  const events = [
    { seq: 1, id: 'v1', type: 'GROUP_CREATED', actor: 'me', ts: 1, payload: { name: 'Trip', emoji: '⛩️', cover: 'grad', currency: 'JPY' } },
    { seq: 2, id: 'v2', type: 'MEMBER_ADDED', actor: 'me', ts: 2, payload: { person_id: 'me', name: 'You', email: 'me@x.com', color: '#D97757', role: 'admin' } },
    { seq: 3, id: 'v3', type: 'MEMBER_ADDED', actor: 'me', ts: 3, payload: { person_id: 'a', name: 'Alex', email: 'a@x.com', color: '#5E7A3F', role: 'member' } },
    { seq: 4, id: 'v4', type: 'EXPENSE_ADDED', actor: 'me', ts: 4, payload: { id: 'e1', desc: 'Ryokan', amount: 100, currency: 'JPY', paidBy: 'me', split: 'equal', participants: ['me', 'a'], date: '2026-05-01', emoji: '🏯', category: 'Lodging' } },
    { seq: 5, id: 'v5', type: 'PAYMENT_RECORDED', actor: 'a', ts: 5, payload: { id: 'p1', from: 'a', to: 'me', amount: 50, currency: 'JPY', method: 'cash', date: '2026-05-02' } },
  ];
  const g = D.foldEvents(events);
  assert.equal(g.meta.name, 'Trip');
  assert.equal(g.members.length, 2);
  assert.equal(g.expenses.length, 1);
  assert.equal(g.expenses[0].desc, 'Ryokan');
  assert.equal(g.payments.length, 1);
});

test('foldEvents: EXPENSE_EDITED replaces, EXPENSE_DELETED tombstones', () => {
  const events = [
    { seq: 1, type: 'EXPENSE_ADDED', payload: { id: 'e1', desc: 'A', amount: 10, split: 'equal', participants: ['me'], currency: 'USD', paidBy: 'me' } },
    { seq: 2, type: 'EXPENSE_EDITED', payload: { id: 'e1', desc: 'B', amount: 20, split: 'equal', participants: ['me'], currency: 'USD', paidBy: 'me' } },
    { seq: 3, type: 'EXPENSE_DELETED', payload: { id: 'e1' } },
  ];
  const g = D.foldEvents(events);
  const e = g.expenses.find(x => x.id === 'e1');
  assert.equal(e.desc, 'B');
  assert.equal(e.deleted, true);
});

test('foldEvents: PAYPAL_SET updates member handle', () => {
  const events = [
    { seq: 1, type: 'MEMBER_ADDED', payload: { person_id: 'a', name: 'Alex', color: '#000' } },
    { seq: 2, type: 'PAYPAL_SET', payload: { person_id: 'a', paypal: 'alex88' } },
  ];
  const g = D.foldEvents(events);
  assert.equal(g.members.find(m => m.person_id === 'a').paypal, 'alex88');
});

test('deriveActivity: newest first, maps event types to feed items', () => {
  const events = [
    { seq: 1, type: 'GROUP_CREATED', actor: 'me', ts: 1000, payload: { name: 'Trip' } },
    { seq: 2, type: 'EXPENSE_ADDED', actor: 'a', ts: 2000, payload: { id: 'e1', desc: 'Lunch', amount: 20, currency: 'USD', split: 'equal', participants: ['me', 'a'], paidBy: 'a' } },
  ];
  const feed = D.deriveActivity(events, 'g1', 'me', 5000);
  assert.equal(feed[0].type, 'expense');
  assert.equal(feed[0].who, 'a');
  assert.equal(feed[0].you, 'owe');
  assert.equal(feed[1].type, 'group');
});

test('foldProfile: upserts friends by email, latest event wins', () => {
  const D = require('../src/domain');
  const events = [
    { seq: 1, type: D.EVENT.FRIEND_SEEN, ts: 100, payload: { email: 'a@x.com', name: 'a' } },
    { seq: 2, type: D.EVENT.FRIEND_SEEN, ts: 200, payload: { email: 'A@x.com', name: 'Alex', paypal: 'alexpp' } },
    { seq: 3, type: D.EVENT.FRIEND_SEEN, ts: 300, payload: { email: 'b@x.com', name: 'Bee' } },
  ];
  const { friends } = D.foldProfile(events);
  assert.equal(Object.keys(friends).length, 2, 'A@ and a@ collapse to one');
  assert.equal(friends['a@x.com'].name, 'Alex');
  assert.equal(friends['a@x.com'].paypal, 'alexpp');
  assert.equal(friends['a@x.com'].ts, 200);
  assert.equal(friends['b@x.com'].name, 'Bee');
});

test('foldProfile: accumulates sent invites in order', () => {
  const D = require('../src/domain');
  const events = [
    { seq: 1, type: D.EVENT.INVITE_SENT, ts: 10, payload: { groupId: 'g1', sheetId: 's1', email: 'a@x.com', token: 't1' } },
    { seq: 2, type: D.EVENT.INVITE_SENT, ts: 20, payload: { groupId: 'g2', sheetId: 's2', email: 'b@x.com', token: 't2' } },
  ];
  const { sentInvites } = D.foldProfile(events);
  assert.equal(sentInvites.length, 2);
  assert.equal(sentInvites[0].email, 'a@x.com');
  assert.equal(sentInvites[1].groupId, 'g2');
});

test('foldProfile: ignores unknown event types and empty input', () => {
  const D = require('../src/domain');
  assert.deepEqual(D.foldProfile([]), { friends: {}, sentInvites: [] });
  const { friends, sentInvites } = D.foldProfile([{ seq: 1, type: 'NOPE', payload: {} }]);
  assert.deepEqual(friends, {});
  assert.deepEqual(sentInvites, []);
});
