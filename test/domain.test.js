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
