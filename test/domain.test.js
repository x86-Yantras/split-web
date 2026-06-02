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
