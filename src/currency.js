// Currency helpers + pinned display rates. Browser global `window.CCY` AND Node module.
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  root.CCY = mod;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const symbols = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', INR: '₹', CAD: 'C$', AUD: 'A$' };
  // Default pinned rates relative to USD. store.js may overwrite via setRates() from the `rates` tab.
  let usdRates = { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 156, INR: 83.4, CAD: 1.36, AUD: 1.51 };

  function setRates(next) { if (next && typeof next === 'object') usdRates = Object.assign({}, usdRates, next); }

  function format(amount, code) {
    const sym = symbols[code] || code + ' ';
    const isWhole = code === 'JPY' || code === 'INR';
    const abs = Math.abs(amount);
    const str = isWhole
      ? Math.round(abs).toLocaleString()
      : abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sign = amount < 0 ? '-' : '';
    return sign + sym + str;
  }

  function convert(amount, from, to) {
    if (from === to) return amount;
    const inUsd = amount / (usdRates[from] || 1);
    return inUsd * (usdRates[to] || 1);
  }

  return { symbols, format, convert, setRates, codes: Object.keys(symbols), get rates() { return usdRates; } };
});
