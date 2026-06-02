# SplitSplit PWA — Finish §6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SplitSplit's in-memory mock (`window.DATA`) with a real Google Sheets / Drive–backed reactive store, and finish every stub listed in `calude.md` §6.

**Architecture:** Keep the no-build, Babel-in-browser, single-page React prototype. Introduce four net-new **plain-JS** modules that are *both* browser globals *and* Node-`require`-able (so pure logic is unit-tested under `node --test`):
- `src/currency.js` — currency format/convert (extracted from `data.js`).
- `src/domain.js` — pure split math, balances, settle-up minimization, append-only event fold, activity derivation, CSV. **This is the DRY home for split math currently copy-pasted in `Group.jsx`, `AddExpense.jsx`, `Friend.jsx`.**
- `src/sheets.js` — thin Google Sheets + Drive REST client (factory injected with `fetch` + `getToken`).
- `src/store.js` — reactive store: append-only event log per group, local cache, write queue, poll-sync; exposes mutations and a `useStore` React hook via `React.useSyncExternalStore`.

Every write appends a domain **event** to the group's Sheet `events` tab (atomic row-append → no clobber). The UI updates instantly from the local fold; the sync engine flushes the queue and pulls peers in the background. Reads are always local. This is the contract `calude.md` §5.6 recommended.

**Tech Stack:** React 18 (UMD, via CDN) · Babel standalone · Google Identity Services (`SSAuth`, already wired) · Sheets v4 + Drive v3 REST · Node ≥18 built-in test runner (`node --test`) + global `fetch`. No bundler, no framework deps.

**The UI-facing data contract stays exactly as `calude.md` §3** (`Person`, `Group`, `Expense`, `Activity`, `CCY`). Field names/types do not change.

---

## Conventions used by every task

- **Run dir:** all paths below are relative to `/home/deathstar/x86/splitsplit-web` (the work happens there — Task 0 copies the prototype in).
- **Plain-JS module pattern** (used by `currency.js`, `domain.js`, `sheets.js`, `store.js`) so the same file is a browser global and a Node module:
  ```js
  (function (root, factory) {
    const mod = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = mod;
    root.SSXxx = mod;                       // browser global
  })(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';
    // ... pure code, NO DOM access at module top level ...
    return { /* public API */ };
  });
  ```
- **Test runner:** Node's built-in. Run a single file with `node --test test/<file>.test.js`. Run all with `npm test`.
- **Money equality in tests:** compare with a tolerance (`assertClose` helper, Task 1) — never `===` on floats.
- **Commit after every green task.** Conventional Commits. The repo is created in Task 0.

---

## File map (created / modified)

**Created:**
- `package.json` — test script only (no deps).
- `test/helpers.js` — `assertClose`, fixture builders.
- `src/currency.js` — CCY (moved out of `data.js`).
- `src/domain.js` — pure logic.
- `src/sheets.js` — Google REST client factory.
- `src/store.js` — reactive store + `useStore` hook.
- `src/screens/Expense.jsx` — new ExpenseDetail screen (§6.7).
- `src/screens/Empty.jsx` — shared empty-state component (§6.14).
- `manifest.webmanifest`, `sw.js`, `icons/` — PWA (§6.13).
- `test/domain.test.js`, `test/sheets.test.js`, `test/store.test.js`.

**Modified:**
- `src/data.js` — strip CCY (now a seed-only mock), add `rates`.
- `SplitSplit.html` — load new scripts in order; register service worker.
- `src/app.jsx` — store init, route `expense`, pass store down.
- `src/screens/*.jsx` — read from store instead of `window.DATA`; wire the dead save buttons.

---

## Phase ordering

1. **Foundation (Tasks 0–7):** repo + test harness → currency → domain (split/balances/minimize/fold/activity/CSV) → sheets client → store + hook. All TDD, mostly pure, no UI. Exit: `npm test` green; logic proven.
2. **Wire reads (Task 8):** swap every `window.DATA` read for the store. Exit: app renders from the store with seed data.
3. **Persistence fixes (Tasks 9–12):** new group, add expense, settle, PayPal write-back. Exit: full create→expense→settle cycle persists to a real Sheet and survives reload.
4. **Flows & breadth (Tasks 13–21):** invite, join + WrongAccount, native share, expense detail, settle-up banner, activity-from-events, CSV, rates, PWA install, empty states.

---
---

# PHASE 1 — FOUNDATION

## Task 0: Project setup — copy code, git, test harness

**Files:**
- Copy: `~/Downloads/SplitSplit/*` → `/home/deathstar/x86/splitsplit-web/`
- Create: `package.json`, `test/helpers.js`, `.gitignore`

- [ ] **Step 1: Copy the prototype into the project dir**

Run:
```bash
cp -R /home/deathstar/Downloads/SplitSplit/. /home/deathstar/x86/splitsplit-web/
cd /home/deathstar/x86/splitsplit-web
ls SplitSplit.html src/data.js src/screens/Home.jsx   # sanity: all exist
```
Expected: the three files list without error. `calude.md` already exists here and is untouched.

- [ ] **Step 2: Create `.gitignore`**

`/home/deathstar/x86/splitsplit-web/.gitignore`:
```
node_modules/
.DS_Store
*.log
```

- [ ] **Step 3: Create `package.json`** (no dependencies — Node's built-in runner only)

`/home/deathstar/x86/splitsplit-web/package.json`:
```json
{
  "name": "splitsplit-web",
  "version": "1.0.0",
  "private": true,
  "description": "SplitSplit — free, serverless Splitwise alternative (Sheets-backed PWA)",
  "scripts": {
    "test": "node --test",
    "serve": "node --version >/dev/null && python3 -m http.server 5174"
  }
}
```

- [ ] **Step 4: Create the test helper**

`/home/deathstar/x86/splitsplit-web/test/helpers.js`:
```js
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
```

- [ ] **Step 5: Verify the runner works with an empty suite**

Run: `cd /home/deathstar/x86/splitsplit-web && npm test`
Expected: exits 0 with "tests 0" (no test files yet) — confirms Node + runner work.

- [ ] **Step 6: Init git and commit the baseline**

```bash
cd /home/deathstar/x86/splitsplit-web
git init
git add -A
git commit -m "chore: import SplitSplit prototype + node test harness"
```

---

## Task 1: Extract currency into a testable module

**Files:**
- Create: `src/currency.js`
- Test: `test/domain.test.js` (currency block; same file used by Task 2–6)
- Modify: `src/data.js` (remove the `window.CCY` IIFE), `SplitSplit.html` (load `currency.js` first)

The currency helpers currently live inside `data.js` and are only a browser global. Move them verbatim into a dual browser/Node module so domain math can `require` them.

- [ ] **Step 1: Write the failing test**

`/home/deathstar/x86/splitsplit-web/test/domain.test.js`:
```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/domain.test.js`
Expected: FAIL — `Cannot find module '../src/currency'`.

- [ ] **Step 3: Create `src/currency.js`** (same logic as the old `data.js` CCY block, dual-export)

`/home/deathstar/x86/splitsplit-web/src/currency.js`:
```js
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/domain.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Remove the duplicate CCY from `data.js`**

In `src/data.js`, delete the entire trailing block starting at `// Currency helpers + display rates (mock, FYI-only)` and the `window.CCY = (function () { ... })();` IIFE (the last ~25 lines, from line 114 to EOF). Leave the `window.DATA` IIFE intact.

- [ ] **Step 6: Load `currency.js` before everything in `SplitSplit.html`**

In `SplitSplit.html`, find:
```html
<!-- Data + Auth -->
<script src="src/data.js"></script>
<script src="src/auth.js"></script>
```
Replace with:
```html
<!-- Currency + Data + Auth -->
<script src="src/currency.js"></script>
<script src="src/data.js"></script>
<script src="src/auth.js"></script>
```

- [ ] **Step 7: Commit**

```bash
git add src/currency.js src/data.js SplitSplit.html test/
git commit -m "refactor: extract currency into node-testable currency.js"
```

---

## Task 2: Domain — split math (the DRY core)

**Files:**
- Create: `src/domain.js` (first slice: `splitMap`, `shareOf`)
- Test: append to `test/domain.test.js`

Split math is currently duplicated in `Group.jsx` (`ExpenseRow`, `BalancesList`, `TotalsList`), `AddExpense.jsx` (preview), and `Friend.jsx`. `splitMap` becomes the one implementation; later tasks re-point the screens at it.

- [ ] **Step 1: Write the failing test** (append to `test/domain.test.js`)

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/domain.test.js`
Expected: FAIL — `Cannot find module '../src/domain'`.

- [ ] **Step 3: Create `src/domain.js` with the split slice**

`/home/deathstar/x86/splitsplit-web/src/domain.js`:
```js
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/domain.test.js`
Expected: PASS (currency tests + 5 split tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain.js test/domain.test.js
git commit -m "feat(domain): split math (equal/shares/percent/exact)"
```

---

## Task 3: Domain — balances, group summary, friend rollup

**Files:**
- Modify: `src/domain.js` (add `memberNets`, `balancesWithMe`, `groupSummary`, `friendBalances`)
- Test: append to `test/domain.test.js`

`balancesWithMe` reproduces the current `Group.jsx` `BalancesList` math (per-member net relative to me, in-group). `memberNets` is the group-wide per-person net (paid − used + payments) used by Totals and settle-up minimization. `groupSummary` derives `{youOwe, youAreOwed}` (`calude.md` §3 says these are DERIVED, not stored). `friendBalances` aggregates across groups into the `friends` shape.

- [ ] **Step 1: Write the failing test** (append to `test/domain.test.js`)

```js
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
    expense({ amount: 100, paidBy: 'me', participants: ['me', 'a'] }),  // a owes me 50
    expense({ amount: 40, paidBy: 'b', participants: ['me', 'b'] }),    // I owe b 20
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
    g1: [expense({ amount: 100, currency: 'USD', paidBy: 'me', participants: ['me', 'a'] })], // a owes me 50 USD
    g2: [expense({ amount: 60, currency: 'EUR', paidBy: 'b', participants: ['me', 'b'] })],   // I owe b 30 EUR
  };
  const fb = D.friendBalances(groups, expensesByGroup, {}, 'me');
  const aUsd = fb.find(x => x.id === 'a' && x.currency === 'USD');
  const bEur = fb.find(x => x.id === 'b' && x.currency === 'EUR');
  assertClose(aUsd.balance, 50, 'a USD'); assertClose(bEur.balance, -30, 'b EUR');
  assert.ok(!fb.some(x => x.balance === 0), 'no settled rows');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/domain.test.js`
Expected: FAIL — `D.memberNets is not a function`.

- [ ] **Step 3: Add the functions to `src/domain.js`** (insert before the `return { ... }` line)

```js
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

  // { youOwe, youAreOwed } — DERIVED, never stored (calude.md §3).
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
    const acc = {}; // `${id}|${ccy}` -> amount
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
```

Then extend the return object:
```js
  return { splitMap, shareOf, memberNets, balancesWithMe, groupSummary, friendBalances, _CCY: CCY };
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/domain.test.js`
Expected: PASS (all prior + 7 new).

- [ ] **Step 5: Commit**

```bash
git add src/domain.js test/domain.test.js
git commit -m "feat(domain): balances, group summary, friend rollup"
```

---

## Task 4: Domain — settle-up minimization + CSV

**Files:**
- Modify: `src/domain.js` (add `minimizeTransactions`, `toCSV`)
- Test: append to `test/domain.test.js`

`minimizeTransactions` is `calude.md` §6's "killer move" — fewest payments to settle a group (greedy debtor/creditor matching). `toCSV` is the §6 CSV export.

- [ ] **Step 1: Write the failing test** (append to `test/domain.test.js`)

```js
test('minimizeTransactions: 3-way settles in 2 payments', () => {
  // me +60, a -30, b -30  → a→me 30, b→me 30
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
  // a owes 50; me +30, b +20
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
  assert.match(lines[1], /50/); // my share of 100 between 2
});

test('toCSV: escapes commas/quotes in description', () => {
  const csv = D.toCSV({ name: 'G', currency: 'USD' }, [expense({ desc: 'Taxi, tip "big"' })], { me: { name: 'You' } }, 'me');
  assert.match(csv, /"Taxi, tip ""big"""/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/domain.test.js`
Expected: FAIL — `D.minimizeTransactions is not a function`.

- [ ] **Step 3: Add to `src/domain.js`** (before the `return`)

```js
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
```

Extend the return:
```js
  return { splitMap, shareOf, memberNets, balancesWithMe, groupSummary, friendBalances,
           minimizeTransactions, toCSV, _CCY: CCY };
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/domain.test.js`
Expected: PASS (all prior + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/domain.js test/domain.test.js
git commit -m "feat(domain): settle-up minimization + CSV export"
```

---

## Task 5: Domain — append-only event model (fold) + activity derivation

**Files:**
- Modify: `src/domain.js` (add `EVENT`, `foldEvents`, `deriveActivity`, `relativeTime`)
- Test: append to `test/domain.test.js`

This is the data-plane core (`calude.md` §5.6): every mutation is one immutable event; materialized state is the fold. The store appends these to the Sheet `events` tab and folds them back. `deriveActivity` replaces the mock `activity` array (§6.10).

- [ ] **Step 1: Write the failing test** (append to `test/domain.test.js`)

```js
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
  assert.equal(feed[0].type, 'expense');     // newest first
  assert.equal(feed[0].who, 'a');
  assert.equal(feed[0].you, 'owe');          // a paid, I owe my share
  assert.equal(feed[1].type, 'group');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/domain.test.js`
Expected: FAIL — `D.foldEvents is not a function`.

- [ ] **Step 3: Add to `src/domain.js`** (before the `return`)

```js
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
    return out.reverse(); // events are seq-ascending; feed is newest-first
  }
```

Extend the return:
```js
  return { splitMap, shareOf, memberNets, balancesWithMe, groupSummary, friendBalances,
           minimizeTransactions, toCSV, EVENT, foldEvents, deriveActivity, relativeTime, _CCY: CCY };
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/domain.test.js`
Expected: PASS (all prior + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/domain.js test/domain.test.js
git commit -m "feat(domain): append-only event fold + activity derivation"
```

---

## Task 6: Google Sheets + Drive REST client

**Files:**
- Create: `src/sheets.js`
- Test: `test/sheets.test.js`

A thin factory `createSheetsClient({ fetchFn, getToken, appOrigin })` returning only what the store needs. Injecting `fetchFn`/`getToken` makes it testable with a fake fetch. The browser instantiates it with the real `window.fetch` + `SSAuth.getAccessToken`. Endpoints: Sheets v4 (`spreadsheets.create`, `values.append`, `values.get`, `batchUpdate`), Drive v3 (`files.create` for the spreadsheet name, `permissions.create`/`list`, app-data `index.json` via `files` with `spaces=appDataFolder`).

- [ ] **Step 1: Write the failing test**

`/home/deathstar/x86/splitsplit-web/test/sheets.test.js`:
```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { createSheetsClient } = require('../src/sheets');

// A fake fetch that records calls and returns queued JSON responses.
function fakeFetch(responses) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    const r = responses.shift();
    if (!r) throw new Error('no queued response for ' + url);
    return { ok: r.ok !== false, status: r.status || 200, json: async () => r.body };
  };
  fn.calls = calls;
  return fn;
}

function client(fetchFn) {
  return createSheetsClient({ fetchFn, getToken: async () => 'TKN', appOrigin: 'https://splitsplit.app' });
}

test('createSpreadsheet posts to sheets API with bearer token, returns id', async () => {
  const f = fakeFetch([{ body: { spreadsheetId: 'SHEET1' } }]);
  const c = client(f);
  const id = await c.createSpreadsheet('SplitSplit · Trip');
  assert.equal(id, 'SHEET1');
  assert.match(f.calls[0].url, /spreadsheets/);
  assert.equal(f.calls[0].opts.headers.Authorization, 'Bearer TKN');
});

test('appendEvent posts USER_ENTERED row to events tab', async () => {
  const f = fakeFetch([{ body: { updates: { updatedRange: 'events!A7' } } }]);
  const c = client(f);
  const res = await c.appendEvent('SHEET1', ['7', 'id', 'EXPENSE_ADDED', 'me', '123', '{}']);
  assert.match(f.calls[0].url, /events!A:F:append/);
  assert.match(f.calls[0].url, /valueInputOption=USER_ENTERED/);
  assert.deepEqual(JSON.parse(f.calls[0].opts.body).values[0].length, 6);
  assert.equal(res.updates.updatedRange, 'events!A7');
});

test('readEventsSince fetches the events range and returns rows after lastSeq', async () => {
  const f = fakeFetch([{ body: { values: [
    ['seq', 'id', 'type', 'actor', 'ts', 'payload_json'],
    ['1', 'a', 'GROUP_CREATED', 'me', '1', '{}'],
    ['2', 'b', 'EXPENSE_ADDED', 'me', '2', '{"id":"e1"}'],
  ] } }]);
  const c = client(f);
  const rows = await c.readEventsSince('SHEET1', 1);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].seq, 2);
  assert.equal(rows[0].type, 'EXPENSE_ADDED');
  assert.equal(rows[0].payload.id, 'e1');
});

test('permissionsCreate sends writer role, no notification email', async () => {
  const f = fakeFetch([{ body: { id: 'perm1' } }]);
  const c = client(f);
  await c.permissionsCreate('SHEET1', 'friend@gmail.com');
  assert.match(f.calls[0].url, /permissions/);
  assert.match(f.calls[0].url, /sendNotificationEmail=false/);
  const body = JSON.parse(f.calls[0].opts.body);
  assert.equal(body.role, 'writer'); assert.equal(body.emailAddress, 'friend@gmail.com');
});

test('permissionsList returns the emails on the ACL', async () => {
  const f = fakeFetch([{ body: { permissions: [
    { emailAddress: 'OWNER@x.com', role: 'owner' }, { emailAddress: 'Friend@Gmail.com', role: 'writer' },
  ] } }]);
  const c = client(f);
  const emails = await c.permissionsList('SHEET1');
  assert.deepEqual(emails, ['owner@x.com', 'friend@gmail.com']); // lowercased
});

test('401 forces one token refresh + retry', async () => {
  const f = fakeFetch([{ ok: false, status: 401, body: {} }, { body: { spreadsheetId: 'S2' } }]);
  const c = client(f);
  const id = await c.createSpreadsheet('x');
  assert.equal(id, 'S2');
  assert.equal(f.calls.length, 2);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/sheets.test.js`
Expected: FAIL — `Cannot find module '../src/sheets'`.

- [ ] **Step 3: Create `src/sheets.js`**

`/home/deathstar/x86/splitsplit-web/src/sheets.js`:
```js
// Google Sheets v4 + Drive v3 client factory. Browser global `window.SSSheets` (instance) AND Node module (factory).
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  root.createSheetsClient = mod.createSheetsClient;
  // Lazy browser instance once SSAuth exists.
  if (typeof window !== 'undefined') {
    root.SSSheets = mod.createSheetsClient({
      fetchFn: (u, o) => window.fetch(u, o),
      getToken: () => window.SSAuth.getAccessToken(),
      appOrigin: window.location.origin,
    });
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
  const DRIVE = 'https://www.googleapis.com/drive/v3/files';

  function createSheetsClient({ fetchFn, getToken, appOrigin }) {
    let token = null;

    async function call(url, opts, _retried) {
      if (!token) token = await getToken();
      const headers = Object.assign({ Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, opts.headers || {});
      const res = await fetchFn(url, Object.assign({}, opts, { headers }));
      if (res.status === 401 && !_retried) { token = await getToken(); return call(url, opts, true); }
      if (!res.ok) throw new Error('Google API ' + res.status + ' for ' + url);
      return res.json();
    }

    async function createSpreadsheet(title) {
      const body = { properties: { title }, sheets: [
        { properties: { title: '_meta' } }, { properties: { title: 'members' } },
        { properties: { title: 'events' } }, { properties: { title: 'rates' } },
      ] };
      const j = await call(SHEETS, { method: 'POST', body: JSON.stringify(body) });
      return j.spreadsheetId;
    }

    // Seed the header rows for each tab.
    async function initTabs(sheetId, meta, members) {
      const data = [
        { range: '_meta!A1', values: [['key', 'value'], ...Object.entries(meta)] },
        { range: 'members!A1', values: [['person_id', 'email', 'name', 'color', 'role', 'paypal'],
          ...members.map(m => [m.person_id, m.email || '', m.name, m.color, m.role || 'member', m.paypal || ''])] },
        { range: 'events!A1', values: [['seq', 'id', 'type', 'actor', 'ts', 'payload_json']] },
        { range: 'rates!A1', values: [['code', 'usd_rate', 'updated_at']] },
      ];
      return call(SHEETS + '/' + sheetId + '/values:batchUpdate',
        { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data }) });
    }

    function appendEvent(sheetId, row /* [seq,id,type,actor,ts,payload_json] */) {
      const url = SHEETS + '/' + sheetId + '/values/events!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS';
      return call(url, { method: 'POST', body: JSON.stringify({ values: [row] }) });
    }

    async function readEventsSince(sheetId, lastSeq) {
      const j = await call(SHEETS + '/' + sheetId + '/values/events!A2:F', { method: 'GET' });
      const rows = j.values || [];
      const out = [];
      for (const r of rows) {
        const seq = parseInt(r[0], 10);
        if (!seq || seq <= lastSeq) continue;
        let payload = {};
        try { payload = JSON.parse(r[5] || '{}'); } catch (e) { payload = {}; }
        out.push({ seq, id: r[1], type: r[2], actor: r[3], ts: parseInt(r[4], 10) || 0, payload });
      }
      return out;
    }

    async function readMembers(sheetId) {
      const j = await call(SHEETS + '/' + sheetId + '/values/members!A2:F', { method: 'GET' });
      return (j.values || []).map(r => ({ person_id: r[0], email: r[1], name: r[2], color: r[3], role: r[4], paypal: r[5] || undefined }));
    }

    async function readMeta(sheetId) {
      const j = await call(SHEETS + '/' + sheetId + '/values/_meta!A2:B', { method: 'GET' });
      const meta = {};
      for (const r of (j.values || [])) meta[r[0]] = r[1];
      return meta;
    }

    async function readRates(sheetId) {
      const j = await call(SHEETS + '/' + sheetId + '/values/rates!A2:B', { method: 'GET' });
      const out = {};
      for (const r of (j.values || [])) { const n = parseFloat(r[1]); if (r[0] && n) out[r[0]] = n; }
      return out;
    }

    function permissionsCreate(sheetId, email) {
      const url = DRIVE + '/' + sheetId + '/permissions?sendNotificationEmail=false';
      return call(url, { method: 'POST', body: JSON.stringify({ role: 'writer', type: 'user', emailAddress: email }) });
    }

    async function permissionsList(sheetId) {
      const j = await call(DRIVE + '/' + sheetId + '/permissions?fields=permissions(emailAddress,role)', { method: 'GET' });
      return (j.permissions || []).map(p => (p.emailAddress || '').toLowerCase()).filter(Boolean);
    }

    // App-data index.json: { [groupId]: sheetId }
    async function readIndex() {
      const list = await call(DRIVE + '?spaces=appDataFolder&q=' + encodeURIComponent("name='index.json'") + '&fields=files(id)', { method: 'GET' });
      const file = (list.files || [])[0];
      if (!file) return { fileId: null, map: {} };
      const url = 'https://www.googleapis.com/drive/v3/files/' + file.id + '?alt=media';
      let map = {};
      try { map = await call(url, { method: 'GET' }); } catch (e) { map = {}; }
      return { fileId: file.id, map: map || {} };
    }

    async function writeIndex(fileId, map) {
      const meta = { name: 'index.json', parents: ['appDataFolder'], mimeType: 'application/json' };
      if (fileId) {
        const url = 'https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media';
        await call(url, { method: 'PATCH', body: JSON.stringify(map) });
        return fileId;
      }
      // multipart create
      const boundary = 'ssb' + '0000';
      const body =
        '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
        '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' + JSON.stringify(map) +
        '\r\n--' + boundary + '--';
      const j = await call('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body });
      return j.id;
    }

    return { createSpreadsheet, initTabs, appendEvent, readEventsSince, readMembers, readMeta, readRates,
             permissionsCreate, permissionsList, readIndex, writeIndex };
  }

  return { createSheetsClient };
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/sheets.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sheets.js test/sheets.test.js
git commit -m "feat(sheets): Sheets+Drive REST client with 401 retry"
```

---

## Task 7: Reactive store + `useStore` hook

**Files:**
- Create: `src/store.js`
- Test: `test/store.test.js`

The store holds per-group event logs, folds them to materialized state, exposes derived selectors (groups with `youOwe`/`youAreOwed`, `friends`, `people`), and mutations that append events. Every mutation: (1) optimistically append to the in-memory log + notify subscribers, (2) enqueue a write, (3) flush via the sheets client. Constructed with injected deps (`sheets`, `storage`, `now`, `genId`) for testability. The browser builds it with `SSSheets`, `localStorage`, `Date.now`, and a uuid.

**Store shape (the snapshot the UI reads):**
```
{
  ready: bool,
  me: { id:'me', name, email, initials, color, paypal },
  groups: [{ id, name, emoji, cover, currency, members:[id], youOwe, youAreOwed }],   // youOwe/youAreOwed DERIVED
  people: { [id]: { id, name, initials, color, paypal } },
  expenses: { [groupId]: [Expense] },
  payments: { [groupId]: [Payment] },
  friends: [{ id, balance, currency }],
}
```

- [ ] **Step 1: Write the failing test**

`/home/deathstar/x86/splitsplit-web/test/store.test.js`:
```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { createStore } = require('../src/store');

// In-memory fake of the sheets client. One spreadsheet = one event array.
function fakeSheets() {
  const sheets = {}; // sheetId -> { meta, members, events:[] }
  let n = 0;
  return {
    _sheets: sheets,
    async createSpreadsheet() { const id = 'S' + (++n); sheets[id] = { meta: {}, members: [], events: [] }; return id; },
    async initTabs(id, meta, members) { sheets[id].meta = meta; sheets[id].members = members.map(m => ({ ...m })); },
    async appendEvent(id, row) {
      const seq = sheets[id].events.length + 1;
      sheets[id].events.push({ seq, id: row[1], type: row[2], actor: row[3], ts: +row[4], payload: JSON.parse(row[5]) });
      return { updates: { updatedRange: 'events!A' + (seq + 1) } };
    },
    async readEventsSince(id, last) { return sheets[id].events.filter(e => e.seq > last).map(e => ({ ...e })); },
    async readMembers(id) { return sheets[id].members.map(m => ({ ...m })); },
    async readMeta(id) { return { ...sheets[id].meta }; },
    async readRates() { return {}; },
    async permissionsCreate() { return { id: 'perm' }; },
    async permissionsList() { return ['me@x.com']; },
    async readIndex() { return { fileId: null, map: {} }; },
    async writeIndex() { return 'idx1'; },
  };
}

function memStorage() {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } };
}

function newStore(sheets) {
  let t = 1000;
  let c = 0;
  return createStore({
    sheets, storage: memStorage(),
    now: () => t++, genId: () => 'id' + (++c),
    user: { sub: 'u1', email: 'me@x.com', name: 'Sam Park', givenName: 'Sam' },
  });
}

test('createGroup: writes a sheet, records it, appears in snapshot', async () => {
  const sheets = fakeSheets();
  const store = newStore(sheets);
  const g = await store.createGroup({ name: 'Trip', emoji: '⛩️', cover: 'grad', currency: 'JPY' });
  const snap = store.getSnapshot();
  assert.equal(snap.groups.length, 1);
  assert.equal(snap.groups[0].name, 'Trip');
  assert.equal(snap.groups[0].members[0], 'me');
  // the underlying sheet got GROUP_CREATED + MEMBER_ADDED events
  const evs = sheets._sheets[g.sheetId].events;
  assert.equal(evs[0].type, 'GROUP_CREATED');
  assert.equal(evs[1].type, 'MEMBER_ADDED');
});

test('addExpense: persists event + derives group summary', async () => {
  const sheets = fakeSheets();
  const store = newStore(sheets);
  const g = await store.createGroup({ name: 'Trip', emoji: '⛩️', cover: 'grad', currency: 'USD' });
  // add a second member so balances are meaningful
  await store.addMember(g.id, { person_id: 'a', name: 'Alex', email: 'a@x.com', color: '#5E7A3F' });
  await store.addExpense(g.id, { desc: 'Lunch', amount: 100, currency: 'USD', emoji: '🍱', category: 'Food', paidBy: 'me', split: 'equal', participants: ['me', 'a'], date: '2026-05-01' });
  const snap = store.getSnapshot();
  const grp = snap.groups.find(x => x.id === g.id);
  assert.equal(snap.expenses[g.id].length, 1);
  assert.ok(Math.abs(grp.youAreOwed - 50) < 0.01, 'owed 50');
});

test('recordPayment: appends PAYMENT_RECORDED and shifts balance', async () => {
  const sheets = fakeSheets();
  const store = newStore(sheets);
  const g = await store.createGroup({ name: 'T', emoji: '🏠', cover: 'g', currency: 'USD' });
  await store.addMember(g.id, { person_id: 'a', name: 'Alex', color: '#000' });
  await store.addExpense(g.id, { desc: 'x', amount: 100, currency: 'USD', paidBy: 'me', split: 'equal', participants: ['me', 'a'], date: '2026-05-01', emoji: '🧾', category: 'Food' });
  await store.recordPayment(g.id, { from: 'a', to: 'me', amount: 50, currency: 'USD', method: 'cash', date: '2026-05-02' });
  const snap = store.getSnapshot();
  assert.equal(snap.payments[g.id].length, 1);
  assert.ok(Math.abs(snap.groups.find(x => x.id === g.id).youAreOwed) < 0.01, 'settled');
});

test('setPayPalHandle: updates the member record via PAYPAL_SET', async () => {
  const sheets = fakeSheets();
  const store = newStore(sheets);
  const g = await store.createGroup({ name: 'T', emoji: '🏠', cover: 'g', currency: 'USD' });
  await store.addMember(g.id, { person_id: 'a', name: 'Alex', color: '#000' });
  await store.setPayPalHandle(g.id, 'a', 'alex88');
  assert.equal(store.getSnapshot().people.a.paypal, 'alex88');
});

test('subscribe: fires on mutation; getSnapshot is stable between mutations', async () => {
  const store = newStore(fakeSheets());
  let fires = 0;
  store.subscribe(() => { fires++; });
  const s1 = store.getSnapshot();
  await store.createGroup({ name: 'T', emoji: '🏠', cover: 'g', currency: 'USD' });
  assert.ok(fires >= 1, 'subscriber notified');
  assert.notStrictEqual(store.getSnapshot(), s1, 'new snapshot identity after change');
});

test('hydrate: rebuilds state from sheets + index on init', async () => {
  const sheets = fakeSheets();
  const a = newStore(sheets);
  const g = await a.createGroup({ name: 'Trip', emoji: '⛩️', cover: 'grad', currency: 'USD' });
  // a second store with the same sheets backend + a pre-seeded index hydrates the group
  let t = 5000, c = 100;
  const b = createStore({
    sheets, storage: (function () { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; } }; })(),
    now: () => t++, genId: () => 'z' + (++c), user: { sub: 'u1', email: 'me@x.com', name: 'Sam', givenName: 'Sam' },
    index: { [g.id]: g.sheetId },
  });
  await b.hydrate();
  assert.equal(b.getSnapshot().groups.length, 1);
  assert.equal(b.getSnapshot().groups[0].name, 'Trip');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/store.test.js`
Expected: FAIL — `Cannot find module '../src/store'`.

- [ ] **Step 3: Create `src/store.js`**

`/home/deathstar/x86/splitsplit-web/src/store.js`:
```js
// Reactive Sheets-backed store + useStore hook. Browser global `window.SSStore` (instance) AND Node module (factory).
(function (root, factory) {
  const mod = factory(root.SSDomain || (typeof require !== 'undefined' ? require('./domain') : null));
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  root.createStore = mod.createStore;
})(typeof window !== 'undefined' ? window : globalThis, function (D) {
  'use strict';

  function initialsFor(name) {
    const parts = String(name || '').trim().split(/\s+/);
    return ((parts[0] || '')[0] || '?').toUpperCase() + ((parts[1] || '')[0] || '').toUpperCase();
  }
  const PALETTE = ['#D97757', '#5E7A3F', '#8B5E83', '#3D6B7A', '#B7864A', '#7A5C3D', '#5C5C7A', '#7A3D5C'];

  function createStore(deps) {
    const { sheets, storage, now, genId, user } = deps;
    const meId = 'me';

    // group state: id -> { sheetId, meta, members:[], events:[], lastSeq }
    const G = {};
    let index = deps.index || loadIndex();        // { groupId: sheetId }
    let snapshot = null;
    const subs = new Set();
    const queue = [];                              // pending {sheetId, row, groupId}

    function loadIndex() {
      try { return JSON.parse(storage.getItem('splitsplit.index.v1') || '{}'); } catch (e) { return {}; }
    }
    function saveIndex() { storage.setItem('splitsplit.index.v1', JSON.stringify(index)); }
    function cacheKey(id) { return 'splitsplit.events.' + id; }
    function loadCachedEvents(id) { try { return JSON.parse(storage.getItem(cacheKey(id)) || '[]'); } catch (e) { return []; } }
    function saveCachedEvents(id) { storage.setItem(cacheKey(id), JSON.stringify(G[id].events)); }

    // ---- derive the public snapshot from folded group state ----
    function rebuild() {
      const groups = [], people = {}, expenses = {}, payments = {};
      people[meId] = { id: meId, name: (user && user.name) || 'You', email: user && user.email,
        initials: initialsFor((user && user.givenName) || 'You'), color: PALETTE[0], paypal: undefined };
      const groupsArr = Object.values(G);
      const expensesByGroup = {}, paymentsByGroup = {};
      for (const g of groupsArr) {
        const folded = D.foldEvents(g.events);
        const memberIds = folded.members.map(m => m.person_id);
        for (const m of folded.members) {
          const id = m.person_id;
          people[id] = people[id] || {};
          Object.assign(people[id], { id, name: id === meId ? people[meId].name : m.name,
            initials: initialsFor(m.name), color: m.color || PALETTE[memberIds.indexOf(id) % PALETTE.length],
            paypal: m.paypal, email: m.email });
        }
        const exps = folded.expenses;
        expenses[g.id] = exps; payments[g.id] = folded.payments;
        expensesByGroup[g.id] = exps; paymentsByGroup[g.id] = folded.payments;
        const summary = D.groupSummary(exps, folded.payments, memberIds, meId);
        groups.push({ id: g.id, name: folded.meta.name, emoji: folded.meta.emoji,
          cover: folded.meta.cover, currency: folded.meta.currency, members: memberIds,
          youOwe: summary.youOwe, youAreOwed: summary.youAreOwed });
      }
      const friends = D.friendBalances(groups, expensesByGroup, paymentsByGroup, meId);
      snapshot = { ready: true, me: people[meId], groups, people, expenses, payments, friends };
    }

    function notify() { rebuild(); for (const cb of subs) cb(); }
    function getSnapshot() { if (!snapshot) rebuild(); return snapshot; }
    function subscribe(cb) { subs.add(cb); return () => subs.delete(cb); }

    // ---- event append (optimistic local + queued remote) ----
    function appendLocal(groupId, type, payload, actor) {
      const g = G[groupId];
      const seq = g.events.length ? g.events[g.events.length - 1].seq + 1 : 1;
      const ev = { seq, id: genId(), type, actor: actor || meId, ts: now(), payload };
      g.events.push(ev);
      saveCachedEvents(groupId);
      queue.push({ groupId, sheetId: g.sheetId, row: [String(seq), ev.id, type, ev.actor, String(ev.ts), JSON.stringify(payload)] });
      notify();
      return ev;
    }

    async function flush() {
      while (queue.length) {
        const item = queue[0];
        try { await sheets.appendEvent(item.sheetId, item.row); queue.shift(); }
        catch (e) { break; } // keep in queue; retried on next flush/poll
      }
    }

    // ---- mutations ----
    async function createGroup({ name, emoji, cover, currency }) {
      const groupId = genId();
      const sheetId = await sheets.createSpreadsheet('SplitSplit · ' + name);
      const meta = { group_id: groupId, name, emoji, cover, currency, schema_version: '1' };
      const meMember = { person_id: meId, email: user && user.email, name: (user && user.name) || 'You', color: PALETTE[0], role: 'admin' };
      await sheets.initTabs(sheetId, meta, [meMember]);
      G[groupId] = { id: groupId, sheetId, events: [], lastSeq: 0 };
      index[groupId] = sheetId; saveIndex();
      appendLocal(groupId, D.EVENT.GROUP_CREATED, { name, emoji, cover, currency });
      appendLocal(groupId, D.EVENT.MEMBER_ADDED, meMember);
      await flush();
      try { const idx = await sheets.readIndex(); index = Object.assign(idx.map || {}, index); await sheets.writeIndex(idx.fileId, index); } catch (e) {}
      return { id: groupId, sheetId };
    }

    async function addMember(groupId, { person_id, name, email, color, role }) {
      appendLocal(groupId, D.EVENT.MEMBER_ADDED, { person_id, name, email, color: color || PALETTE[Object.keys(G[groupId]).length % PALETTE.length], role: role || 'member' });
      await flush();
    }

    async function addExpense(groupId, expense) {
      const payload = Object.assign({ id: genId() }, expense);
      appendLocal(groupId, D.EVENT.EXPENSE_ADDED, payload);
      await flush();
      return payload.id;
    }
    async function editExpense(groupId, expense) { appendLocal(groupId, D.EVENT.EXPENSE_EDITED, expense); await flush(); }
    async function deleteExpense(groupId, expenseId) { appendLocal(groupId, D.EVENT.EXPENSE_DELETED, { id: expenseId }); await flush(); }

    async function recordPayment(groupId, payment) {
      appendLocal(groupId, D.EVENT.PAYMENT_RECORDED, Object.assign({ id: genId() }, payment));
      await flush();
    }
    async function addComment(groupId, comment) {
      appendLocal(groupId, D.EVENT.COMMENT_ADDED, Object.assign({ id: genId() }, comment));
      await flush();
    }
    async function setPayPalHandle(groupId, personId, paypal) {
      appendLocal(groupId, D.EVENT.PAYPAL_SET, { person_id: personId, paypal });
      await flush();
    }

    // ---- sync ----
    async function pullGroup(groupId) {
      const g = G[groupId];
      const fresh = await sheets.readEventsSince(g.sheetId, g.lastSeq);
      if (fresh.length) {
        // merge by seq (skip any we already have locally from our own appends)
        const have = new Set(g.events.map(e => e.id));
        for (const ev of fresh) if (!have.has(ev.id)) g.events.push(ev);
        g.events.sort((a, b) => a.seq - b.seq);
        g.lastSeq = g.events[g.events.length - 1].seq;
        saveCachedEvents(groupId);
        notify();
      }
    }

    async function hydrate() {
      // resolve index: injected > drive > cache
      if (!Object.keys(index).length) {
        try { const idx = await sheets.readIndex(); index = idx.map || {}; saveIndex(); } catch (e) { index = loadIndex(); }
      }
      for (const [groupId, sheetId] of Object.entries(index)) {
        G[groupId] = G[groupId] || { id: groupId, sheetId, events: loadCachedEvents(groupId), lastSeq: 0 };
        G[groupId].lastSeq = G[groupId].events.reduce((m, e) => Math.max(m, e.seq), 0);
        try { await pullGroup(groupId); } catch (e) {}
      }
      notify();
    }

    return {
      getSnapshot, subscribe, hydrate, flush, pullGroup,
      createGroup, addMember, addExpense, editExpense, deleteExpense, recordPayment, addComment, setPayPalHandle,
      get index() { return index; },
    };
  }

  return { createStore };
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/store.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — all of `domain.test.js`, `sheets.test.js`, `store.test.js`.

- [ ] **Step 6: Commit**

```bash
git add src/store.js test/store.test.js
git commit -m "feat(store): reactive event-sourced store with optimistic writes + hydrate"
```

---
---

# PHASE 2 — WIRE READS

## Task 8: Mount the store in the app and read from it

**Files:**
- Create: nothing (hook lives in `store.js` browser section — add it)
- Modify: `src/store.js` (add browser instance + `useStore`), `SplitSplit.html`, `src/app.jsx`, and all screens that read `window.DATA`.

The store is already pure-tested. Now expose a browser singleton + a React hook, init it after sign-in, and replace every `window.DATA` read with `useStore()`. No persistence-button wiring yet (that's Phase 3) — this task only makes the UI render from the store using the **seed import** so nothing visually regresses.

- [ ] **Step 1: Add the browser instance + `useStore` hook to `src/store.js`**

At the very end of `src/store.js`, *after* the closing `});` of the UMD wrapper, append:
```js
// ----- Browser singleton + React hook (no-op under Node) -----
if (typeof window !== 'undefined') {
  (function () {
    function uuid() {
      // RFC4122-ish; fine for client-minted ids.
      return 'xxxxxxxxyxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      }) + '-' + Date.now().toString(36);
    }
    let instance = null;
    window.SSGetStore = function () {
      if (!instance) {
        instance = window.createStore({
          sheets: window.SSSheets, storage: window.localStorage,
          now: () => Date.now(), genId: uuid, user: window.SSAuth.getUser(),
        });
      }
      return instance;
    };
    window.SSResetStore = function () { instance = null; };
    // React hook: subscribe to the store; returns the live snapshot.
    window.useStore = function () {
      const store = window.SSGetStore();
      return React.useSyncExternalStore(store.subscribe, store.getSnapshot);
    };
  })();
}
```

- [ ] **Step 2: Load the new scripts in `SplitSplit.html`**

In `SplitSplit.html`, after the `auth.js` line, add `domain.js`, `sheets.js`, `store.js` (plain scripts, before the Babel UI scripts):
```html
<!-- Currency + Data + Auth -->
<script src="src/currency.js"></script>
<script src="src/data.js"></script>
<script src="src/auth.js"></script>

<!-- Domain + data layer -->
<script src="src/domain.js"></script>
<script src="src/sheets.js"></script>
<script src="src/store.js"></script>
```

- [ ] **Step 3: Seed the store from the mock on first run (dev convenience)**

So the UI still shows the rich demo data until you create real groups, add a one-time seeding path. Add to `src/store.js` browser block (inside the IIFE, before the `useStore` definition):
```js
    window.SSSeedFromMock = function (store) {
      // Dev-only: import window.DATA into the store WITHOUT touching Sheets (in-memory only).
      if (!window.DATA || store.getSnapshot().groups.length) return;
      // Build synthetic event logs per group so the fold path is exercised.
      const D = window.SSDomain;
      for (const g of window.DATA.groups) {
        const sheetId = 'mock:' + g.id;
        const ev = [];
        let seq = 0;
        const push = (type, payload) => ev.push({ seq: ++seq, id: 'mock' + seq + g.id, type, actor: 'me', ts: Date.now(), payload });
        push(D.EVENT.GROUP_CREATED, { name: g.name, emoji: g.emoji, cover: g.cover, currency: g.currency });
        for (const id of g.members) {
          const p = window.DATA.people[id];
          push(D.EVENT.MEMBER_ADDED, { person_id: id, name: p.name, color: p.color, role: id === 'me' ? 'admin' : 'member', paypal: p.paypal });
        }
        for (const e of (window.DATA.expenses[g.id] || [])) push(D.EVENT.EXPENSE_ADDED, e);
        store._injectMockGroup(g.id, sheetId, ev);
      }
    };
```
And add `_injectMockGroup` to the store's returned API (in the factory, before `return {`):
```js
    function _injectMockGroup(groupId, sheetId, events) {
      G[groupId] = { id: groupId, sheetId, events, lastSeq: events.length };
      notify();
    }
```
Add `_injectMockGroup` to the returned object.

> NOTE: this seed is dev scaffolding. Task 21 removes the seed call once empty states land; for now it keeps the demo looking right.

- [ ] **Step 4: Init the store in `app.jsx`**

In `src/app.jsx`, replace the auth `useEffect` block (lines ~16–19) and add store init. Find:
```js
  // Subscribe to auth changes from anywhere in the app.
  React.useEffect(() => {
    if (!window.SSAuth) return;
    return window.SSAuth.onChange((u) => setUser(u));
  }, []);
```
Replace with:
```js
  const store = window.useStore();

  // Subscribe to auth changes; (re)build the store when the user changes.
  React.useEffect(() => {
    if (!window.SSAuth) return;
    return window.SSAuth.onChange((u) => { window.SSResetStore(); setUser(u); });
  }, []);

  // Hydrate (or seed) the store once signed in.
  React.useEffect(() => {
    if (!signedIn) return;
    const s = window.SSGetStore();
    s.hydrate().then(() => { if (!s.getSnapshot().groups.length) window.SSSeedFromMock(s); })
      .catch(() => window.SSSeedFromMock(s));
  }, [signedIn]);
```

> `useStore()` is called unconditionally at the top of `App` (hook rules). `store` is now available to pass into screens.

- [ ] **Step 5: Pass `store` to screens that mutate; pass snapshot reads where needed**

In `src/app.jsx`, update the screen routing so each screen receives `store`. Replace the routing block (the `if (top) { ... } else { ... }`) so every `<XScreen .../>` also gets `store={store}`. Example for the two we wire first:
```js
    else if (top.screen === 'addExpense') inner = <AddExpenseScreen store={store} groupId={top.groupId} goBack={goBack} navigate={navigate} />;
    else if (top.screen === 'settle') inner = <SettleScreen store={store} friendId={top.friendId} groupId={top.groupId} goBack={goBack} />;
    else if (top.screen === 'newGroup') inner = <NewGroupScreen store={store} goBack={goBack} />;
    else if (top.screen === 'invite') inner = <InviteScreen store={store} groupId={top.groupId} goBack={goBack} />;
    else if (top.screen === 'join') inner = <JoinScreen store={store} goBack={goBack} navigate={navigate} onSignIn={handleSignIn} />;
    else if (top.screen === 'group') inner = <GroupScreen store={store} groupId={top.id} navigate={navigate} goBack={goBack} />;
    else if (top.screen === 'friend') inner = <FriendScreen store={store} friendId={top.friendId} goBack={goBack} navigate={navigate} />;
    else if (top.screen === 'expense') inner = <ExpenseScreen store={store} groupId={top.groupId} expenseId={top.expenseId} goBack={goBack} />;
```
And for the tab screens:
```js
    if (tab === 'home') inner = <HomeScreen store={store} tweaks={tweaks} navigate={navigate} user={user} />;
    else if (tab === 'friends') inner = <FriendsScreen store={store} tweaks={tweaks} navigate={navigate} />;
    else if (tab === 'activity') inner = <ActivityScreen store={store} navigate={navigate} />;
    else if (tab === 'profile') inner = <ProfileScreen store={store} onSignOut={handleSignOut} tweaks={tweaks} setTweak={setTweak} user={user} />;
```
(The `ExpenseScreen` route is added now; the screen file is built in Task 18.)

- [ ] **Step 6: Repoint each reader screen from `window.DATA` to the store snapshot**

For each screen, replace the `window.DATA` destructure with a snapshot read. The store snapshot has the same shape as `window.DATA` for `groups`, `people`, `expenses`, `friends` (plus `payments`). Apply these edits:

**`src/screens/Home.jsx`** — replace `const { groups, friends, people } = window.DATA;` with:
```js
  const snap = props.store ? props.store.getSnapshot() : window.useStore();
  const { groups, friends, people } = snap;
```
…and change the function signature `function HomeScreen({ tweaks, navigate, user })` to `function HomeScreen({ store, tweaks, navigate, user })` and read via `store.getSnapshot()`:
```js
function HomeScreen({ store, tweaks, navigate, user }) {
  const snap = store.getSnapshot();
  const { groups, friends, people } = snap;
```
Remove the old `window.DATA` line.

**`src/screens/Group.jsx`** — change `function GroupScreen({ groupId, navigate, goBack })` to include `store`, and replace lines 4–6:
```js
function GroupScreen({ store, groupId, navigate, goBack }) {
  const snap = store.getSnapshot();
  const group = snap.groups.find(g => g.id === groupId);
  const expenses = (snap.expenses[groupId] || []).filter(e => !e.deleted);
  const people = snap.people;
```
Also pass `payments` into `BalancesList` so settle-up reflects payments — change the balances tab line to:
```js
        : tab === 'balances' ? <BalancesList group={group} expenses={expenses} payments={snap.payments[groupId] || []} people={people} navigate={navigate} store={store} />
```

**`src/screens/Friends.jsx`** — `function FriendsScreen({ store, navigate, tweaks })` and `const { friends, people } = store.getSnapshot();`.

**`src/screens/Friend.jsx`** — `function FriendScreen({ store, friendId, goBack, navigate })` and `const { people, friends, expenses, groups } = store.getSnapshot();`.

**`src/screens/Activity.jsx`** — `function ActivityScreen({ store, navigate })`; replace `const { activity, people, groups } = window.DATA;` with `const { people, groups } = store.getSnapshot();` and compute activity (Task 19 fills this; for now): `const activity = window.SSActivity ? window.SSActivity(store) : [];`. (Temporary — Task 19 implements `SSActivity`.) To avoid an empty feed meanwhile, fall back: `const activity = (window.SSActivity && window.SSActivity(store)) || [];`

**`src/screens/Profile.jsx`** — `function ProfileScreen({ store, onSignOut, tweaks, setTweak, user })`; replace `const fallback = window.DATA.me;` with `const fallback = store.getSnapshot().me;`.

**`src/screens/Settle.jsx`** — `function SettleScreen({ store, friendId, groupId, goBack })`; replace `const { people, friends, me } = window.DATA;` with `const { people, friends, me } = store.getSnapshot();`.

**`src/screens/AddExpense.jsx`** — `function AddExpenseScreen({ store, groupId, goBack, navigate })`; replace lines 4–5:
```js
  const snap = store.getSnapshot();
  const allGroups = snap.groups;
  const people = snap.people;
```

**`src/screens/Invite.jsx`** — `function InviteScreen({ store, groupId, goBack })`; replace `const groups = window.DATA.groups;` with `const groups = store.getSnapshot().groups;`.

**`src/screens/Join.jsx`** — `function JoinScreen({ store, goBack, navigate, onSignIn })`; the demo currently reads `window.DATA.groups.find(... 'kyoto')`. Leave the demo landing as-is for now (Task 17 rewrites Join for real verification). Change reads of `window.DATA.people`/`groups` to `store.getSnapshot()` equivalents only where a group exists; the demo path may keep a fallback: `const snap = store.getSnapshot(); const group = snap.groups[0] || window.DATA.groups[0];`.

- [ ] **Step 7: Manual verification in the browser**

Run: `python3 -m http.server 5174` (from the project dir) and open `http://localhost:5174/SplitSplit.html`.
Expected: sign in with Google → Home shows the seeded demo groups (Kyoto, Mission Apt, …) exactly as before, balances correct, tabs work. The data now flows through the store (confirm: in DevTools console, `SSGetStore().getSnapshot().groups.length` → 4).

- [ ] **Step 8: Commit**

```bash
git add src/store.js src/app.jsx SplitSplit.html src/screens/*.jsx
git commit -m "feat: render UI from reactive store (seeded from mock)"
```

---
---

# PHASE 3 — PERSISTENCE FIXES

## Task 9: New group persists (§6.1)

**Files:**
- Modify: `src/app.jsx` (`NewGroupScreen` — wire "Create" to `store.createGroup`)

The "Create" button currently calls `goBack()` only. Wire it to `store.createGroup(...)`, then navigate to the new group.

- [ ] **Step 1: Add `store` + `navigate` to `NewGroupScreen` signature**

In `src/app.jsx`, change `function NewGroupScreen({ goBack })` to `function NewGroupScreen({ store, goBack, navigate })`. In the router (Task 8 Step 5), update the `newGroup` route to also pass `navigate`:
```js
    else if (top.screen === 'newGroup') inner = <NewGroupScreen store={store} goBack={goBack} navigate={navigate} />;
```

- [ ] **Step 2: Wire the Create button to the store**

In `NewGroupScreen`, add a handler above the `return`:
```js
  const [creating, setCreating] = React.useState(false);
  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const { id } = await store.createGroup({ name: name.trim(), emoji, cover, currency });
      goBack();
      navigate({ screen: 'group', id });
    } catch (e) {
      setCreating(false);
      alert('Could not create the group. Check your connection and try again.');
    }
  };
```
Then change the header trailing button `onClick={goBack}` → `onClick={handleCreate}` and its label/disabled to reflect creating:
```js
        trailing={
          <button onClick={handleCreate} disabled={!name.trim() || creating} style={{
            background: 'none', border: 'none', cursor: name.trim() && !creating ? 'pointer' : 'default',
            color: name.trim() && !creating ? SS.accent : SS.muted,
            fontFamily: 'Geist, system-ui', fontSize: 15, fontWeight: 600, padding: 0,
          }}>{creating ? 'Creating…' : 'Create'}</button>
        }
```

- [ ] **Step 3: Manual verification**

Reload the app → tap the center FAB → New Group → name it "Test Trip", pick emoji/color/currency → Create.
Expected: lands on the new group's detail (empty expenses). In DevTools: `SSGetStore().getSnapshot().groups.find(g=>g.name==='Test Trip')` exists. Reload the page → the group is still listed (it hydrated from Drive `index.json` + the new Sheet). Confirm a real spreadsheet "SplitSplit · Test Trip" exists in the Google account's Drive.

- [ ] **Step 4: Commit**

```bash
git add src/app.jsx
git commit -m "fix(group): New Group persists to Sheets + Drive (calude §6.1)"
```

---

## Task 10: Add expense persists (§6.2)

**Files:**
- Modify: `src/screens/AddExpense.jsx` (capture split details, wire Save)

Both the header "Save" and the bottom "Add expense" currently call `goBack()`. They must build a full `Expense` (including the active split mode's `shares`/`percents`/`exacts`) and call `store.addExpense`. The split details currently live in local state inside `SplitSheet` and are lost on close — lift them so the parent can persist them.

- [ ] **Step 1: Lift split detail state into `AddExpenseScreen`**

In `AddExpenseScreen`, after the existing `useState` lines, add:
```js
  const [shares, setShares] = React.useState({});
  const [percents, setPercents] = React.useState({});
  const [exacts, setExacts] = React.useState({});
```
Reset them whenever participants change (extend the existing effect on `group.id`, or add):
```js
  React.useEffect(() => {
    const list = [...participants];
    setShares(Object.fromEntries(list.map(p => [p, 1])));
    const eq = list.length ? Math.round(100 / list.length) : 0;
    setPercents(Object.fromEntries(list.map(p => [p, eq])));
    const share = amountNum / Math.max(1, list.length);
    setExacts(Object.fromEntries(list.map(p => [p, share.toFixed(2)])));
  }, [participants, amountNum]);
```

- [ ] **Step 2: Pass the lifted state into `SplitSheet` instead of its internal state**

Change the `SplitSheet` render at the bottom of `AddExpenseScreen`:
```js
      {showSplitSheet && <SplitSheet mode={splitMode} setMode={setSplitMode} amount={amountNum} currency={currency}
        participants={participants} people={people}
        shares={shares} setShares={setShares} percents={percents} setPercents={setPercents}
        exacts={exacts} setExacts={setExacts}
        onClose={() => setShowSplitSheet(false)} />}
```
In `function SplitSheet(...)`, change the signature to accept these props and **delete** its three internal `useState` lines for `shares`/`percents`/`exacts` (lines ~247–252). New signature:
```js
function SplitSheet({ mode, setMode, amount, currency, participants, people, shares, setShares, percents, setPercents, exacts, setExacts, onClose }) {
  const partList = [...participants];
  const equalShare = amount / Math.max(1, partList.length);
```

- [ ] **Step 3: Build the expense + wire Save**

Add a handler in `AddExpenseScreen` above the `return`:
```js
  const [saving, setSaving] = React.useState(false);
  const handleSave = async () => {
    if (!amountNum || !desc.trim() || saving) return;
    setSaving(true);
    const partList = [...participants];
    const expense = {
      date: new Date().toISOString().slice(0, 10),
      desc: desc.trim(), emoji, category: 'Other',
      amount: amountNum, currency, paidBy, split: splitMode,
      participants: partList,
    };
    if (splitMode === 'shares') expense.shares = Object.fromEntries(partList.map(p => [p, +shares[p] || 0]));
    if (splitMode === 'percent') expense.percents = Object.fromEntries(partList.map(p => [p, +percents[p] || 0]));
    if (splitMode === 'exact') expense.exacts = Object.fromEntries(partList.map(p => [p, String(exacts[p] || '0')]));
    try { await store.addExpense(group.id, expense); goBack(); }
    catch (e) { setSaving(false); alert('Could not save the expense. Try again.'); }
  };
```
Change both buttons: the header `onClick={goBack}` → `onClick={handleSave}` and the bottom `<Button ... onClick={goBack} ...>Add expense</Button>` → `onClick={handleSave}` with `disabled={!amountNum || !desc.trim() || saving}`.

- [ ] **Step 4: Manual verification**

Open a real group → Add expense → "Lunch", $40, keep Equally, Save.
Expected: returns to the group; the expense appears under the current month; group balance updates; "you lent/owe" math is right. Reload → still there. Repeat with **By shares / By % / Exact** → verify the Balances tab reflects the chosen split (e.g. percent 30/70 splits unevenly).

- [ ] **Step 5: Commit**

```bash
git add src/screens/AddExpense.jsx
git commit -m "fix(expense): Add Expense persists all split modes (calude §6.2)"
```

---

## Task 11: Settle up persists + payment method (§6.3, §6.5)

**Files:**
- Modify: `src/screens/Settle.jsx` (wire both CTAs to `store.recordPayment`; open paypal.me for the PayPal path)

Both action-bar buttons call `goBack()`. Wire them to record a `payment` event. Cash → just record. PayPal (you are payer) → open `paypal.me/<handle>?amount=` in a new tab, then record on "Mark as paid". The `friendId`/`groupId` reach the screen via the router; payments need a `groupId` — when settling from Friends (no group), record into the group where the balance lives.

- [ ] **Step 1: Resolve the target group for the payment**

The `Settle` screen knows `friendId` and sometimes `groupId`. Add a resolver in `SettleScreen` after the snapshot read:
```js
  const snap = store.getSnapshot();
  function groupForFriend(fid, ccy) {
    if (groupId) return groupId;
    // pick the group with this friend where our balance is largest in that currency
    const cands = snap.groups.filter(g => g.members.includes(fid) && g.currency === ccy);
    return (cands[0] && cands[0].id) || (snap.groups.find(g => g.members.includes(fid)) || {}).id;
  }
```

- [ ] **Step 2: Pass `store` + a confirm handler into `AmountStep`**

Change the `<AmountStep .../>` render to also pass `store`, `selectedFriend`, and an `onDone`:
```js
        <AmountStep
          p={p} f={f} me={me}
          amount={amount} setAmount={setAmount}
          currency={currency} suggested={suggested}
          method={method} setMethod={setMethod}
          goBack={goBack} store={store}
          friendId={selectedFriend}
          groupId={groupForFriend(selectedFriend, currency)}
        />
```
Update `function AmountStep({ ... })` signature to include `store, friendId, groupId`.

- [ ] **Step 3: Wire the action buttons**

In `AmountStep`, add a handler before its `return`:
```js
  const [busy, setBusy] = React.useState(false);
  const record = async (method, note) => {
    if (busy || !groupId) { if (!groupId) alert('No shared group to record this in yet.'); return; }
    setBusy(true);
    const amt = parseFloat(amount) || 0;
    const payment = {
      date: new Date().toISOString().slice(0, 10),
      from: youArePayer ? me.id : friendId,
      to: youArePayer ? friendId : me.id,
      amount: amt, currency, method, note: note || '',
    };
    try {
      if (youArePayer && receiver.paypal) {
        window.open('https://www.paypal.com/paypalme/' + receiver.paypal + '/' + amt, '_blank', 'noopener');
      }
      await store.recordPayment(groupId, payment);
      goBack();
    } catch (e) { setBusy(false); alert('Could not record the payment. Try again.'); }
  };
```
Replace the PayPal button `onClick={goBack}` with `onClick={() => record('paypal')}` and the Cash button `onClick={goBack}` with `onClick={() => record('cash')}`. Disable while `busy`.

- [ ] **Step 4: Manual verification**

In a group where someone owes you, Settle up → pick them → confirm amount → **Cash / other** → Mark as paid.
Expected: balance drops by the amount; reload → still settled. For PayPal where you are the payer and they have a handle, a `paypal.me` tab opens and the payment records.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Settle.jsx
git commit -m "fix(settle): record payments (cash + PayPal) (calude §6.3, §6.5)"
```

---

## Task 12: PayPal handle write-back (§6.4)

**Files:**
- Modify: `src/screens/Settle.jsx` (persist a newly typed handle to the member record)

When the user types a PayPal handle for someone who has none, it currently lives only in `useState`. On confirm, write it back via `store.setPayPalHandle`.

- [ ] **Step 1: Persist the handle inside `record`**

In `AmountStep.record` (Task 11), before recording the payment, add:
```js
    // Save a freshly typed handle back to the member record.
    const handle = (typeof paypalHandle === 'string') ? paypalHandle.trim() : '';
    if (groupId && handle && receiver.paypal !== handle) {
      try { await store.setPayPalHandle(groupId, receiver.id, handle); } catch (e) {}
    }
```
`paypalHandle` is already in scope in `AmountStep` (it's the lifted state). Ensure `receiver.id` exists — `receiver` is `p` or `me`, both have `id`.

- [ ] **Step 2: Manual verification**

Settle with a friend who has **no** PayPal handle (e.g. Jordan/Leo in the seed) → choose PayPal → type a handle → Mark as paid / Open paypal.me.
Expected: next time you open Settle with that friend, the handle is pre-filled (it folded into the member record). Reload to confirm it persisted.

- [ ] **Step 3: Commit**

```bash
git add src/screens/Settle.jsx
git commit -m "fix(settle): persist PayPal handle to member record (calude §6.4)"
```

---
---

# PHASE 4 — FLOWS & BREADTH

## Task 13: Invite — real silent share (§6 invite)

**Files:**
- Modify: `src/screens/Invite.jsx` (call `store.inviteByEmail` instead of `setTimeout`)
- Modify: `src/store.js` (add `inviteByEmail` + token mint)

The invite "provisioning" is a fake `setTimeout`. Replace it with the real `drive.permissions.create` (writer, no email) + add the invitee to the `members` log + mint a deep-link token.

- [ ] **Step 1: Add `inviteByEmail` to the store**

In `src/store.js` factory, add a mutation:
```js
    async function inviteByEmail(groupId, email) {
      const g = G[groupId];
      await sheets.permissionsCreate(g.sheetId, email);
      const personId = 'p_' + email.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
      appendLocal(groupId, D.EVENT.MEMBER_ADDED, {
        person_id: personId, email: email.toLowerCase(),
        name: email.split('@')[0], color: PALETTE[(Object.keys(G).length + email.length) % PALETTE.length], role: 'member',
      });
      await flush();
      const raw = groupId + ':' + email.toLowerCase() + ':' + now();
      const token = (typeof btoa !== 'undefined' ? btoa(raw) : Buffer.from(raw).toString('base64')).replace(/=/g, '').slice(0, 16);
      return { token, link: deps.appOrigin ? deps.appOrigin + '/join/' + groupId + '?t=' + token : 'splitsplit.app/join/' + groupId + '?t=' + token };
    }
```
Add `inviteByEmail` to the returned API object. (Pass `appOrigin` into `createStore` from the browser block: add `appOrigin: window.location.origin` to the `SSGetStore` config.)

- [ ] **Step 2: Add a store test** (append to `test/store.test.js`)

```js
test('inviteByEmail: grants writer perm, adds member, returns a link', async () => {
  const sheets = fakeSheets();
  let granted = null;
  sheets.permissionsCreate = async (id, email) => { granted = email; return { id: 'perm' }; };
  const store = newStore(sheets);
  const g = await store.createGroup({ name: 'T', emoji: '🏠', cover: 'g', currency: 'USD' });
  const { link } = await store.inviteByEmail(g.id, 'Friend@Gmail.com');
  assert.equal(granted, 'friend@gmail.com');
  assert.match(link, /\/join\/.+\?t=.+/);
  assert.ok(store.getSnapshot().groups.find(x => x.id === g.id).members.some(m => m.startsWith('p_')));
});
```
Run: `node --test test/store.test.js` → add `inviteByEmail` until PASS.

- [ ] **Step 3: Wire `Invite.jsx`**

Change `handleAdd` in `InviteScreen` to call the store:
```js
  const handleAdd = async () => {
    setStage('provisioning');
    try {
      const { link } = await store.inviteByEmail(group.id, email.trim());
      setLink(link.replace(/^https?:\/\//, ''));
      setStage('ready');
    } catch (e) {
      setStage('email');
      alert('Could not add them. Make sure the group has a real Sheet and you are online.');
    }
  };
```
The `ProvisioningStage` animation can stay (it now overlaps a real network call).

- [ ] **Step 4: Manual verification**

Open a real group → Invite people → enter a Gmail you control → Add to group.
Expected: the provisioning checklist runs, then the Ready screen shows a `…/join/<groupId>?t=…` link. In Drive, the target Sheet now lists that email as an editor (Share dialog), with **no** notification email sent.

- [ ] **Step 5: Commit**

```bash
git add src/store.js src/screens/Invite.jsx test/store.test.js
git commit -m "feat(invite): real silent Drive share + deep link (calude §6 invite)"
```

---

## Task 14: Join — real verification + WrongAccount state (§6.8)

**Files:**
- Modify: `src/screens/Join.jsx` (verify ACL via `permissions.list`; add WrongAccount)
- Modify: `src/store.js` (add `joinGroup(groupId)`)

Replace the fake verify timers with a real flow: sign in → get the sheetId for the deep-linked group (from the invite link's `groupId`; the store resolves the Sheet via Drive `index.json` once shared, or via a provided `sheetId`) → `permissions.list` → confirm the signed-in email is on the ACL → hydrate + enter. If not on the ACL, show **WrongAccount**.

- [ ] **Step 1: Add `joinGroup` to the store**

```js
    async function joinGroup(groupId, sheetId) {
      const email = (user && user.email || '').toLowerCase();
      const acl = await sheets.permissionsList(sheetId);
      if (!acl.includes(email)) return { ok: false, email, reason: 'not-on-acl' };
      G[groupId] = G[groupId] || { id: groupId, sheetId, events: [], lastSeq: 0 };
      index[groupId] = sheetId; saveIndex();
      await pullGroup(groupId);
      // record our membership if missing
      const folded = D.foldEvents(G[groupId].events);
      if (!folded.members.some(m => (m.email || '').toLowerCase() === email)) {
        appendLocal(groupId, D.EVENT.MEMBER_ADDED, { person_id: 'me', email, name: (user && user.name) || email, color: PALETTE[0], role: 'member' });
        await flush();
      }
      return { ok: true };
    }
```
Add to the returned API. Add a store test mirroring the ACL allow/deny paths.

- [ ] **Step 2: Add WrongAccount UI + real timers in `Join.jsx`**

Add a `WrongAccount` component:
```js
function WrongAccount({ expectedHint, currentEmail, onRetry }) {
  return (
    <div style={{ padding: '48px 0 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 64, height: 64, borderRadius: 999, background: '#FBE9E2', border: `2px solid #F0CFC2`,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="close" size={28} color={SS.negative} stroke={2.4} />
      </div>
      <div style={{ fontFamily: 'Geist, system-ui', fontSize: 19, fontWeight: 600, color: SS.ink, letterSpacing: -0.3 }}>Wrong account</div>
      <div style={{ fontFamily: 'Geist, system-ui', fontSize: 13.5, color: SS.muted, maxWidth: 280, lineHeight: 1.5 }}>
        You're signed in as <b style={{ color: SS.ink }}>{currentEmail}</b>, which isn't on this group's invite list. Sign in with the email the invite was sent to.
      </div>
      <div style={{ height: 8 }} />
      <Button variant="accent" size="lg" fullWidth onClick={onRetry}>Try another account</Button>
    </div>
  );
}
```
Change `JoinScreen` to drive a real verify. Replace `handleSignIn`'s timer chain with:
```js
  const [error, setError] = React.useState(null);
  const handleSignIn = () => {
    setStage('signing');
    if (onSignIn) { try { onSignIn({ anchorEl: document.getElementById('__google_anchor_join') }); } catch (e) {} }
    // wait for SSAuth to report a user, then verify
    const off = window.SSAuth.onChange(async (u) => {
      if (!u) return;
      off();
      setStage('verifying');
      try {
        const sheetId = window.SSJoinSheetId || (store.index && store.index[group.id]);
        const res = await store.joinGroup(group.id, sheetId);
        if (res.ok) setStage('joined');
        else { setError(res); setStage('wrong'); }
      } catch (e) { setError({ email: (window.SSAuth.getUser() || {}).email }); setStage('wrong'); }
    });
  };
```
Add to the stage switch:
```js
        {stage === 'wrong' && <WrongAccount currentEmail={error && error.email} onRetry={() => { window.SSAuth.signOut(); setStage('landing'); }} />}
```

> NOTE: a true deep-link entry needs the `groupId`+`sheetId` parsed from the URL (`/join/:groupId?t=`). Until App-Links routing exists, the demo "Open invite-link landing" path sets `window.SSJoinSheetId` to a real shared sheet for testing. Document this as the manual test path.

- [ ] **Step 3: Manual verification**

With the email you invited in Task 13: set `window.SSJoinSheetId = '<that sheetId>'` in the console, open the invite-link landing (Tweaks → "Open invite-link landing"), Continue with Google as the invited account → verifying → "You're in." → Open group shows the shared data. Repeat signed in as a **non-invited** account → WrongAccount appears with a "Try another account" button.

- [ ] **Step 4: Commit**

```bash
git add src/store.js src/screens/Join.jsx test/store.test.js
git commit -m "feat(join): real ACL verification + WrongAccount state (calude §6.8)"
```

---

## Task 15: "More" share tile → native share (§6.6)

**Files:**
- Modify: `src/screens/Invite.jsx` (`ShareTile` → real share targets)

Wire the four share tiles. "More" uses `navigator.share`; WhatsApp/Messages/Mail use URL schemes; all fall back to clipboard.

- [ ] **Step 1: Pass an `onShare` into each tile and implement targets**

In `ReadyStage`, build handlers and pass `onClick` to each `ShareTile`:
```js
  const url = 'https://' + link;
  const msg = `Join our ${group.name} on SplitSplit ✌️ ${url}`;
  const share = {
    WhatsApp: () => window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener'),
    Messages: () => window.open('sms:?&body=' + encodeURIComponent(msg), '_blank'),
    Mail: () => window.open('mailto:' + encodeURIComponent(email) + '?subject=' + encodeURIComponent('Join ' + group.name + ' on SplitSplit') + '&body=' + encodeURIComponent(msg), '_blank'),
    More: async () => {
      if (navigator.share) { try { await navigator.share({ title: 'SplitSplit', text: `Join ${group.name} on SplitSplit`, url }); return; } catch (e) {} }
      if (navigator.clipboard) { try { await navigator.clipboard.writeText(url); alert('Link copied'); } catch (e) {} }
    },
  };
```
Change each `<ShareTile label="WhatsApp" .../>` to add `onClick={share.WhatsApp}` (and the rest), and update `function ShareTile({ label, color, glyph, onClick })` to put `onClick` on its `<button>`.

- [ ] **Step 2: Manual verification**

On the Ready screen, tap **More** → the OS share sheet opens (or link is copied with an alert if `navigator.share` is unavailable, e.g. desktop). WhatsApp/Messages/Mail open their compose targets with the prefilled message.

- [ ] **Step 3: Commit**

```bash
git add src/screens/Invite.jsx
git commit -m "feat(invite): wire share tiles incl. navigator.share (calude §6.6)"
```

---

## Task 16: Settle-up minimization banner (§6.9)

**Files:**
- Modify: `src/screens/Group.jsx` (Balances tab banner using `SSDomain.minimizeTransactions`)

Show a banner in the Balances tab: "N payments settle everyone up — review?" computed from the group's full member nets.

- [ ] **Step 1: Compute suggestions in `BalancesList`**

Update `function BalancesList({ group, expenses, payments, people, navigate, store })` and add at the top:
```js
  const D = window.SSDomain;
  const nets = D.memberNets(expenses, payments || [], group.members);
  const suggestions = D.minimizeTransactions(nets);
```

- [ ] **Step 2: Render the banner above "Who owes who"**

Insert just inside the returned `<div style={{ padding: '8px 0 0' }}>`, before `<SectionLabel>Who owes who</SectionLabel>`:
```js
      {suggestions.length > 0 && (
        <div style={{ padding: '0 20px 4px' }}>
          <div style={{ background: SS.surfaceAlt, border: `1px solid ${SS.hairline}`, borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Geist, system-ui', fontSize: 13.5, fontWeight: 600, color: SS.ink }}>
                {suggestions.length} payment{suggestions.length > 1 ? 's' : ''} settle everyone up
              </div>
              <div style={{ fontFamily: 'Geist, system-ui', fontSize: 12, color: SS.muted, marginTop: 2 }}>
                {suggestions.slice(0, 3).map(s => `${people[s.from] ? (s.from === 'me' ? 'You' : people[s.from].name.split(' ')[0]) : s.from} → ${s.to === 'me' ? 'you' : (people[s.to] ? people[s.to].name.split(' ')[0] : s.to)}`).join(', ')}
              </div>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 3: Manual verification**

Open a group with ≥2 unsettled members (e.g. Kyoto). The Balances tab shows the banner with the minimized payment count and a preview like "Alex → you, Priya → you".

- [ ] **Step 4: Commit**

```bash
git add src/screens/Group.jsx
git commit -m "feat(balances): settle-up minimization banner (calude §6.9)"
```

---

## Task 17: Activity feed derived from events (§6.10)

**Files:**
- Modify: `src/store.js` (expose raw events for activity), `src/screens/Activity.jsx`

Replace the mock `activity` with one derived from all groups' event logs via `SSDomain.deriveActivity`, merged and sorted newest-first.

- [ ] **Step 1: Expose a cross-group activity selector**

In `src/store.js` factory, add:
```js
    function allActivity() {
      const out = [];
      const nowMs = now();
      for (const g of Object.values(G)) {
        const folded = D.foldEvents(g.events);
        const feed = D.deriveActivity(g.events, g.id, meId, nowMs);
        for (const item of feed) out.push(Object.assign({ _ts: (g.events.find(e => (e.id || ('a' + e.seq)) === item.id) || {}).ts || 0 }, item, { groupName: folded.meta.name }));
      }
      out.sort((a, b) => b._ts - a._ts);
      return out;
    }
```
Add `allActivity` to the returned API. In the browser block, add `window.SSActivity = (store) => store.allActivity();`.

- [ ] **Step 2: Read it in `Activity.jsx`**

Replace the temporary line from Task 8 with:
```js
  const { people, groups } = store.getSnapshot();
  const activity = store.allActivity();
  const groupBy = id => groups.find(g => g.id === id);
```
The existing render already handles `type` of `expense|payment|comment|group`. Where `who` is a synthetic invitee id not in `people`, guard: change `const who = people[a.who];` to `const who = people[a.who] || { name: a.who, initials: '?', color: SS.muted };`.

- [ ] **Step 3: Manual verification**

Add an expense and record a payment in a real group, then open the Activity tab.
Expected: newest-first entries — "You added <desc> in <group>", "<name> paid you …" — with correct share/amount. Seeded mock groups also surface their `EXPENSE_ADDED` events.

- [ ] **Step 4: Commit**

```bash
git add src/store.js src/screens/Activity.jsx
git commit -m "feat(activity): derive feed from append-only events (calude §6.10)"
```

---

## Task 18: Expense detail screen — comments / edit / delete (§6.7)

**Files:**
- Create: `src/screens/Expense.jsx`
- Modify: `SplitSplit.html` (load it), `src/app.jsx` (route already added in Task 8)

A new screen reached by tapping an expense row (the row already navigates to `{ screen: 'expense', groupId, expenseId }`). Shows the expense, the per-person split, a comment thread (`store.addComment`), and edit/delete actions (`store.deleteExpense`; edit reuses the AddExpense flow via a prefill — for v1, support **delete + comments**, and a minimal inline edit of amount/description).

- [ ] **Step 1: Create `src/screens/Expense.jsx`**

`/home/deathstar/x86/splitsplit-web/src/screens/Expense.jsx`:
```js
// Expense detail — split breakdown, comments, edit, delete.
function ExpenseScreen({ store, groupId, expenseId, goBack }) {
  const snap = store.getSnapshot();
  const group = snap.groups.find(g => g.id === groupId);
  const expense = (snap.expenses[groupId] || []).find(e => e.id === expenseId);
  const people = snap.people;
  const [comment, setComment] = React.useState('');
  if (!group || !expense) return (
    <Screen><Header leading={<IconBtn name="chevL" onClick={goBack} />} title="Expense" /></Screen>
  );

  const D = window.SSDomain;
  const split = D.splitMap(expense);
  const payer = people[expense.paidBy] || { name: expense.paidBy };
  const comments = (store.commentsFor ? store.commentsFor(groupId, expenseId) : []);

  const handleDelete = async () => {
    if (!confirm('Delete this expense? This cannot be undone.')) return;
    try { await store.deleteExpense(groupId, expenseId); goBack(); }
    catch (e) { alert('Could not delete. Try again.'); }
  };
  const handleComment = async () => {
    const text = comment.trim();
    if (!text) return;
    setComment('');
    try { await store.addComment(groupId, { expense_id: expenseId, expenseDesc: expense.desc, author: 'me', text }); }
    catch (e) { alert('Could not post comment.'); }
  };

  return (
    <Screen>
      <Header
        leading={<IconBtn name="chevL" onClick={goBack} />}
        title={expense.desc}
        trailing={<IconBtn name="trash" color={SS.negative} onClick={handleDelete} />}
      />
      {/* Hero */}
      <div style={{ padding: '4px 20px 8px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, lineHeight: 1 }}>{expense.emoji}</div>
        <div style={{ marginTop: 8 }}>
          <Money amount={expense.amount} currency={expense.currency} size={40} italic />
        </div>
        <div style={{ fontFamily: 'Geist, system-ui', fontSize: 13, color: SS.muted, marginTop: 4 }}>
          {expense.paidBy === 'me' ? 'You' : payer.name.split(' ')[0]} paid · {expense.date}
        </div>
      </div>

      <SectionLabel>Split {expense.split === 'equal' ? 'equally' : 'by ' + expense.split}</SectionLabel>
      <div style={{ padding: '0 12px' }}>
        <div style={{ background: SS.surface, borderRadius: 16, border: `1px solid ${SS.hairline}`, overflow: 'hidden' }}>
          {expense.participants.map((id, i) => (
            <React.Fragment key={id}>
              {i > 0 && <HR inset={62} />}
              <Row left={<Avatar person={people[id] || { name: id, initials: '?', color: SS.muted }} size={38} />}
                title={id === 'me' ? 'You' : (people[id] ? people[id].name : id)}
                right={<Money amount={split[id] || 0} currency={expense.currency} size={15} weight={600} />} />
            </React.Fragment>
          ))}
        </div>
      </div>

      <SectionLabel>Comments</SectionLabel>
      <div style={{ padding: '0 20px' }}>
        {comments.length === 0 && <div style={{ fontFamily: 'Geist, system-ui', fontSize: 13, color: SS.muted, padding: '4px 0 10px' }}>No comments yet.</div>}
        {comments.map(c => (
          <div key={c.id} style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: 'Geist, system-ui', fontSize: 12, color: SS.muted }}>{c.author === 'me' ? 'You' : (people[c.author] ? people[c.author].name.split(' ')[0] : c.author)}</div>
            <div style={{ background: SS.surfaceAlt, borderRadius: 12, borderTopLeftRadius: 4, padding: '8px 12px', fontFamily: 'Geist, system-ui', fontSize: 13.5, color: SS.ink2, marginTop: 2 }}>{c.text}</div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment…"
            onKeyDown={e => { if (e.key === 'Enter') handleComment(); }}
            style={{ flex: 1, border: `1px solid ${SS.hairline}`, borderRadius: 12, padding: '10px 12px', fontFamily: 'Geist, system-ui', fontSize: 14, outline: 'none', background: SS.surface, color: SS.ink }} />
          <Button variant="primary" onClick={handleComment} disabled={!comment.trim()}>Post</Button>
        </div>
      </div>
      <div style={{ height: 32 }} />
    </Screen>
  );
}
window.ExpenseScreen = ExpenseScreen;
```

- [ ] **Step 2: Add `commentsFor` to the store**

In `src/store.js` factory, add:
```js
    function commentsFor(groupId, expenseId) {
      const folded = D.foldEvents(G[groupId] ? G[groupId].events : []);
      return folded.comments.filter(c => c.expense_id === expenseId);
    }
```
Add `commentsFor` to the returned API.

- [ ] **Step 3: Load the screen in `SplitSplit.html`**

Add after the `Join.jsx` script line:
```html
<script type="text/babel" src="src/screens/Expense.jsx"></script>
```

- [ ] **Step 4: Manual verification**

Open a group → tap an expense row → detail shows the per-person split. Post a comment → it appears (and survives reload). Tap the trash icon → confirm → the expense disappears from the list and balances update (tombstoned, not row-deleted).

- [ ] **Step 5: Commit**

```bash
git add src/screens/Expense.jsx src/store.js SplitSplit.html
git commit -m "feat(expense): detail screen with comments + delete (calude §6.7)"
```

---

## Task 19: CSV export (§6.11)

**Files:**
- Modify: `src/screens/Group.jsx` (wire the header "more" menu → Export CSV), uses `SSDomain.toCSV`

Add an export action to the group's header `more` button: build CSV via `SSDomain.toCSV` and trigger a download.

- [ ] **Step 1: Add an export handler in `GroupScreen`**

After the snapshot reads in `GroupScreen`, add:
```js
  const exportCSV = () => {
    const csv = window.SSDomain.toCSV(group, expenses, people, 'me');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (group.name || 'splitsplit').replace(/\s+/g, '-').toLowerCase() + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
```
Change the header trailing from `<IconBtn name="more" onClick={() => {}} />` to `<IconBtn name="more" onClick={exportCSV} />`.

> (A full action menu can come later; for v1 the `more` button exports CSV directly. Mention this in the commit so it isn't mistaken for a generic menu.)

- [ ] **Step 2: Manual verification**

Open a group → tap the ⋯ (more) icon in the header → a `<group>.csv` downloads. Open it: header row + one line per expense with date, description (commas/quotes escaped), amount, currency, payer, split, your_share.

- [ ] **Step 3: Commit**

```bash
git add src/screens/Group.jsx
git commit -m "feat(group): CSV export via header action (calude §6.11)"
```

---

## Task 20: Multi-currency rates from the sheet (§6.12)

**Files:**
- Modify: `src/data.js` (add a `rates` seed), `src/store.js` (load rates → `CCY.setRates`)

`CCY.convert` uses hardcoded rates. Load pinned rates from each group's `rates` tab when available (falling back to the bundled defaults), and feed them into `CCY.setRates`. The home/friends cross-currency aggregate stays approximate (accepted by `calude.md` §269).

- [ ] **Step 1: Load rates during hydrate**

In `src/store.js` `hydrate()`, after the group loop, add:
```js
      // Pull pinned rates from the first group that has any; fall back to bundled.
      for (const g of Object.values(G)) {
        try { const r = await sheets.readRates(g.sheetId); if (r && Object.keys(r).length) { (D._CCY || (typeof window !== 'undefined' && window.CCY)).setRates(r); break; } } catch (e) {}
      }
```

- [ ] **Step 2: Add a bundled fallback note in `data.js`**

In `src/data.js`, append a small exported default so a future backend/daily job can overwrite it:
```js
// Bundled fallback USD rates (overwritten by each group's `rates` tab when present).
window.SS_DEFAULT_RATES = { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 156, INR: 83.4, CAD: 1.36, AUD: 1.51 };
```
(`currency.js` already ships these defaults; this global just documents the source-of-truth for ops.)

- [ ] **Step 3: Manual verification**

In a real group's Sheet, add rows to the `rates` tab (e.g. `EUR | 0.90`). Reload the app → Home's display-currency aggregate uses the new rate (e.g. converting EUR balances shifts slightly). With an empty `rates` tab, the bundled defaults are used (no error).

- [ ] **Step 4: Commit**

```bash
git add src/store.js src/data.js
git commit -m "feat(currency): load pinned rates from the sheet (calude §6.12)"
```

---

## Task 21: PWA install — manifest + service worker (§6.13)

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `icons/icon-192.png`, `icons/icon-512.png`
- Modify: `SplitSplit.html` (link manifest, register SW)

Make the app installable and shell-cacheable. The service worker caches the app shell (HTML + local `src/*` + manifest) for offline launch; Google API calls always go to network. (Full offline write replay already exists in the store's `queue` — the SW just keeps the shell loadable.)

- [ ] **Step 1: Create `manifest.webmanifest`**

`/home/deathstar/x86/splitsplit-web/manifest.webmanifest`:
```json
{
  "name": "SplitSplit",
  "short_name": "SplitSplit",
  "description": "Free, serverless expense splitting.",
  "start_url": "/SplitSplit.html",
  "display": "standalone",
  "background_color": "#FAF7F2",
  "theme_color": "#FAF7F2",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 2: Generate placeholder icons**

Run (creates simple terracotta squares so the manifest validates; replace with branded art later):
```bash
cd /home/deathstar/x86/splitsplit-web && mkdir -p icons
printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' | base64 -d > /tmp/px.png
# scale the 1px seed up with sips if available, else just copy (placeholder)
command -v sips >/dev/null && { sips -z 192 192 /tmp/px.png --out icons/icon-192.png; sips -z 512 512 /tmp/px.png --out icons/icon-512.png; } || { cp /tmp/px.png icons/icon-192.png; cp /tmp/px.png icons/icon-512.png; }
ls -la icons/
```
Expected: both icon files exist. (On Linux without `sips`, the copies are 1×1 placeholders — fine for install; swap in real 192/512 PNGs before release.)

- [ ] **Step 3: Create `sw.js`** (shell cache, network-first for Google)

`/home/deathstar/x86/splitsplit-web/sw.js`:
```js
const CACHE = 'splitsplit-shell-v1';
const SHELL = [
  '/SplitSplit.html', '/manifest.webmanifest',
  '/src/currency.js', '/src/data.js', '/src/auth.js',
  '/src/domain.js', '/src/sheets.js', '/src/store.js',
  '/src/ui.jsx', '/src/ios-frame.jsx', '/src/tweaks-panel.jsx', '/src/app.jsx',
  '/src/screens/SignIn.jsx', '/src/screens/Home.jsx', '/src/screens/Group.jsx',
  '/src/screens/AddExpense.jsx', '/src/screens/Friends.jsx', '/src/screens/Friend.jsx',
  '/src/screens/Settle.jsx', '/src/screens/Activity.jsx', '/src/screens/Profile.jsx',
  '/src/screens/Invite.jsx', '/src/screens/Join.jsx', '/src/screens/Expense.jsx',
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // never cache Google APIs/CDN
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
  }).catch(() => hit)));
});
```

- [ ] **Step 4: Link manifest + register SW in `SplitSplit.html`**

In `<head>`, after the fonts `<link>`, add:
```html
<link rel="manifest" href="manifest.webmanifest" />
<meta name="theme-color" content="#FAF7F2" />
```
Before `</body>`, after the mount script, add:
```html
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
</script>
```

- [ ] **Step 5: Manual verification**

Serve over `http://localhost:5174` and open DevTools → Application: Manifest is detected (name "SplitSplit", icons listed), a Service Worker is "activated and running". Go offline (DevTools → Network → Offline) and reload → the app shell still loads (Google sign-in/network calls fail gracefully, but the UI renders from cache).

- [ ] **Step 6: Commit**

```bash
git add manifest.webmanifest sw.js icons SplitSplit.html
git commit -m "feat(pwa): manifest + service worker shell cache (calude §6.13)"
```

---

## Task 22: Empty states + drop the mock seed (§6.14)

**Files:**
- Create: `src/screens/Empty.jsx`
- Modify: `SplitSplit.html` (load it), `src/screens/Home.jsx`, `src/screens/Friends.jsx`, `src/screens/Activity.jsx`, `src/store.js` (stop auto-seeding)

Real accounts start empty. Add a shared `EmptyState` and render it where lists are empty. Finally, remove the dev mock-seed so new users see empty states (keep `SSSeedFromMock` available behind a Tweaks button for demos).

- [ ] **Step 1: Create `src/screens/Empty.jsx`**

`/home/deathstar/x86/splitsplit-web/src/screens/Empty.jsx`:
```js
// Shared empty-state block.
function EmptyState({ emoji, title, sub, cta, onCta }) {
  return (
    <div style={{ padding: '48px 28px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ fontSize: 44, lineHeight: 1 }}>{emoji}</div>
      <div style={{ fontFamily: 'Geist, system-ui', fontSize: 18, fontWeight: 600, color: SS.ink, letterSpacing: -0.3 }}>{title}</div>
      <div style={{ fontFamily: 'Geist, system-ui', fontSize: 13.5, color: SS.muted, maxWidth: 260, lineHeight: 1.5 }}>{sub}</div>
      {cta && <div style={{ marginTop: 8 }}><Button variant="accent" size="lg" onClick={onCta}>{cta}</Button></div>}
    </div>
  );
}
window.EmptyState = EmptyState;
```

- [ ] **Step 2: Load it in `SplitSplit.html`** (before the screens that use it, after `ui.jsx`)

```html
<script type="text/babel" src="src/screens/Empty.jsx"></script>
```
(Place it right after the `ui.jsx` line so `EmptyState` is defined before screens render.)

- [ ] **Step 3: Use it in Home, Friends, Activity**

**`Home.jsx`** — wrap the groups list. Replace the groups `.map` block:
```js
      <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {groups.length === 0
          ? <EmptyState emoji="🧳" title="No groups yet" sub="Create your first group to start splitting expenses with friends." cta="New group" onCta={() => navigate({ screen: 'newGroup' })} />
          : groups.map(g => <GroupCard key={g.id} group={g} people={people} onClick={() => navigate({ screen: 'group', id: g.id })} />)}
      </div>
```

**`Friends.jsx`** — before the "All contacts" section, if there are no friends at all show empty. Add right after the `large` Header:
```js
      {friends.length === 0 && Object.keys(people).length <= 1 && (
        <EmptyState emoji="👋" title="No friends yet" sub="Invite people to a group — they'll show up here with running balances." cta="Invite friends" onCta={() => navigate({ screen: 'invite' })} />
      )}
```

**`Activity.jsx`** — when `activity.length === 0`, render empty instead of the card:
```js
      {activity.length === 0 ? (
        <EmptyState emoji="📭" title="Nothing yet" sub="Expenses, payments and comments across your groups will appear here." />
      ) : (
        /* existing card+map block */
      )}
```
(Wrap the existing `<div style={{ padding: '0 12px' }}>…</div>` in the `:` branch.)

- [ ] **Step 4: Stop auto-seeding; keep a manual demo button**

In `src/app.jsx`, change the hydrate effect to **not** seed automatically:
```js
  React.useEffect(() => {
    if (!signedIn) return;
    window.SSGetStore().hydrate().catch(() => {});
  }, [signedIn]);
```
In `src/app.jsx`'s Tweaks `Demo` section, add a button to seed on demand:
```js
          <window.TweakButton label="Load demo data" onClick={() => { window.SSSeedFromMock(window.SSGetStore()); }} />
```

- [ ] **Step 5: Manual verification**

Sign in with a fresh Google account (or clear `localStorage` + the app-data `index.json`): Home shows the "No groups yet" empty state with a "New group" CTA; Friends and Activity show their empty states. Create a group → empty states disappear. Tweaks → "Load demo data" repopulates the mock for screenshots.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Empty.jsx SplitSplit.html src/screens/Home.jsx src/screens/Friends.jsx src/screens/Activity.jsx src/app.jsx
git commit -m "feat(ux): empty states + remove auto mock-seed (calude §6.14)"
```

---
---

## Final verification

- [ ] **Run the full unit suite:** `npm test` → all green (`domain`, `sheets`, `store`).
- [ ] **End-to-end manual smoke (real Google account):**
  1. Sign in → empty states show.
  2. Create group → persists, lands on detail.
  3. Add expenses in all 4 split modes → balances correct, survive reload.
  4. Settle (cash + PayPal) → balances update, PayPal handle saved.
  5. Invite a second account → silent Drive share + link.
  6. Join as the invited account → verify → enter; join as a non-invited account → WrongAccount.
  7. Expense detail → comment + delete.
  8. Balances banner shows minimized payments; Activity shows real events; CSV downloads.
  9. DevTools → installable PWA; offline reload loads the shell.
- [ ] **Confirm brand preserved (`calude.md` §9):** warm-cream/terracotta/olive/clay palette intact, Instrument Serif italic only on money/`$`, center-FAB → New Group, silent-invite flow unchanged, no "your Sheet/Drive" surfaced beyond the Sign-in/Profile trust copy.

---

## Self-review notes (gaps & decisions, surfaced honestly)

- **§6 coverage:** every checkbox in `calude.md` §6 maps to a task — new-group(9), add-expense(10), settle(11), PayPal(12), payment tiles(11), More share(15), expense detail(18), wrong-account(14), settle minimization(16), activity-from-events(17), CSV(19), multi-currency(20), PWA(21), empty states(22). Invite real-API(13) and the read-wiring(8) are the connective tissue.
- **Friend balances are per-(friend,currency).** Screens that do `friends.find(x => x.id === id)` get the first currency entry. This matches the seed (each friend single-currency) but is a known limitation for a friend who owes you in two currencies — note for a follow-up.
- **Deep-link routing isn't real yet.** Task 14 verifies ACL correctly but the `groupId`/`sheetId` still come from a test hook (`window.SSJoinSheetId`) / the in-app demo entry, because there's no server/App-Links host. True `/join/:groupId?t=` URL parsing belongs to a hosting/routing follow-up (the Flutter spec's P5 analog).
- **`category` on new expenses defaults to `'Other'`** — the AddExpense UI has no category picker (the prototype never built one). Totals-by-category will bucket new expenses under "Other" until a picker is added. Flagged, not silently dropped.
- **Edit-expense** is delete-capable in Task 18; full inline edit reuses the AddExpense flow and is left as a thin follow-up (the event + store method `editExpense` already exist and are tested).
- **Icons in Task 21 are placeholders** on Linux without `sips` — explicitly called out; swap real art before release.
- **Type consistency check:** store mutation names (`createGroup`, `addExpense`, `recordPayment`, `setPayPalHandle`, `inviteByEmail`, `joinGroup`, `addComment`, `deleteExpense`, `commentsFor`, `allActivity`) are used identically across tasks 8–22; `SSDomain` functions (`splitMap`, `memberNets`, `balancesWithMe`, `groupSummary`, `friendBalances`, `minimizeTransactions`, `toCSV`, `foldEvents`, `deriveActivity`) match their test names; `EVENT.*` constants match between `domain.js`, `store.js`, and the seed.
