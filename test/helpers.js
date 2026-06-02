'use strict';
const assert = require('node:assert');

// Float-safe equality for money math.
function assertClose(actual, expected, msg, eps = 0.01) {
  assert.ok(Math.abs(actual - expected) <= eps,
    `${msg || 'assertClose'}: expected ${expected}, got ${actual} (eps ${eps})`);
}

// Minimal expense fixture builder. Overrides win.
function expense(over = {}) {
  return Object.assign({
    id: 'e1', date: '2026-05-01', desc: 'Test', emoji: '🧾', category: 'Food',
    amount: 100, currency: 'USD', paidBy: 'me', split: 'equal',
    participants: ['me', 'a', 'b'],
  }, over);
}

function payment(over = {}) {
  return Object.assign({
    id: 'p1', date: '2026-05-02', from: 'me', to: 'a', amount: 10,
    currency: 'USD', method: 'cash',
  }, over);
}

module.exports = { assertClose, expense, payment };
