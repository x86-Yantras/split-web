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
