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

  return { splitMap, shareOf, _CCY: CCY };
});
