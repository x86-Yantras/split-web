# Per-User Profile Sheet (Friends + Sent Invites) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private, per-user, event-sourced "profile" Sheet that stores the user's friends (for invite autocomplete) and the invites they have sent.

**Architecture:** A second spreadsheet per user (tabs `_meta` + `events`), created by the user so existing `drive.file`/`spreadsheets` scopes cover it — no new OAuth scopes. It is tracked in the existing appData `index.json` under the reserved key `__profile__`, lazily created on login, never shared. The store holds it as a pseudo-group `G['__profile__']` to reuse `appendLocal`/`flush`/`pullGroup`, folded by a new `foldProfile()` in `domain.js` and excluded from all group iteration.

**Tech Stack:** Plain JS dual browser/Node modules (UMD wrapper), `node --test` for unit tests, React 18 via Vite. No build step for logic modules.

Spec: `docs/superpowers/specs/2026-06-11-splitsplit-profile-sheet-design.md`

---

## File Structure

- `src/domain.js` — add `EVENT.FRIEND_SEEN`, `EVENT.INVITE_SENT`, and `foldProfile(events)`. Pure, unit-tested.
- `src/store.js` — profile lifecycle (`PROFILE_KEY`, `ensureProfile`, `profileState`, `appendProfile`, `rememberFriend`), exclude `__profile__` from group iteration in `rebuild`/`hydrate`/`allActivity`, collect friends in `inviteByEmail` and during hydrate, expose `friends`/`sentInvites` on the snapshot.
- `src/screens/Invite.jsx` — email input autocomplete backed by `snapshot.friends`.
- `test/domain.test.js` — `foldProfile` unit tests.
- `test/store.test.js` — invite→friend+sent-invite, co-member→friend, `__profile__` is not a group.

Conventions: profile Drive name `SplitSplit · Profile`; friends keyed by lowercased email; reserved index key the literal string `__profile__`.

---

## Task 1: domain — profile event types + `foldProfile`

**Files:**
- Modify: `src/domain.js` (the `EVENT` object near line 142, the exports `return {...}` near line 218)
- Test: `test/domain.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `test/domain.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/domain.test.js`
Expected: FAIL — `D.foldProfile is not a function` / `D.EVENT.FRIEND_SEEN` is undefined.

- [ ] **Step 3: Add the event constants**

In `src/domain.js`, the `EVENT` object currently ends:

```js
    PAYMENT_RECORDED: 'PAYMENT_RECORDED', COMMENT_ADDED: 'COMMENT_ADDED', PAYPAL_SET: 'PAYPAL_SET',
  };
```

Change the last line to add the two profile types:

```js
    PAYMENT_RECORDED: 'PAYMENT_RECORDED', COMMENT_ADDED: 'COMMENT_ADDED', PAYPAL_SET: 'PAYPAL_SET',
    FRIEND_SEEN: 'FRIEND_SEEN', INVITE_SENT: 'INVITE_SENT',
  };
```

Note: there are TWO `const EVENT = {...}` blocks in the file (one near line 142, one near the bottom just before the exports). Edit the one immediately above `return { ... EVENT, foldEvents ... }` (the bottom one is the live export). To be safe, apply the same two added keys to BOTH blocks so they stay identical.

- [ ] **Step 4: Implement `foldProfile`**

In `src/domain.js`, add this function just above the final `return { ... }` export line:

```js
  // Fold the per-user profile event log into { friends, sentInvites }.
  // Friends are keyed by lowercased email; the latest FRIEND_SEEN wins.
  function foldProfile(events) {
    const friends = {};
    const sentInvites = [];
    for (const ev of (events || [])) {
      const p = ev.payload || {};
      if (ev.type === EVENT.FRIEND_SEEN) {
        const email = (p.email || '').toLowerCase();
        if (!email) continue;
        const prev = friends[email] || {};
        friends[email] = {
          email,
          name: p.name || prev.name || email.split('@')[0],
          paypal: p.paypal != null ? p.paypal : prev.paypal,
          color: p.color != null ? p.color : prev.color,
          ts: ev.ts || prev.ts || 0,
        };
      } else if (ev.type === EVENT.INVITE_SENT) {
        sentInvites.push({ groupId: p.groupId, sheetId: p.sheetId, email: (p.email || '').toLowerCase(), token: p.token, ts: ev.ts || p.ts || 0 });
      }
    }
    return { friends, sentInvites };
  }
```

Then add `foldProfile` to the export object. The current export line is:

```js
  return { splitMap, shareOf, memberNets, balancesWithMe, groupSummary, friendBalances, minimizeTransactions, toCSV, EVENT, foldEvents, deriveActivity, relativeTime, _CCY: CCY };
```

Change it to include `foldProfile`:

```js
  return { splitMap, shareOf, memberNets, balancesWithMe, groupSummary, friendBalances, minimizeTransactions, toCSV, EVENT, foldEvents, foldProfile, deriveActivity, relativeTime, _CCY: CCY };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/domain.test.js`
Expected: PASS (all foldProfile tests green).

- [ ] **Step 6: Commit**

```bash
git add src/domain.js test/domain.test.js
git commit -m "feat(domain): foldProfile + FRIEND_SEEN/INVITE_SENT event types"
```

---

## Task 2: store — profile lifecycle + exclude `__profile__` from group logic

**Files:**
- Modify: `src/store.js` (top-of-`createStore` constants; `rebuild` group iteration ~line 56; `allActivity`; `hydrate`)
- Test: `test/store.test.js`

- [ ] **Step 1: Write the failing test**

Append to `test/store.test.js`:

```js
test('hydrate: creates a profile Sheet and does not treat it as a group', async () => {
  const sheets = fakeSheets();
  const store = newStore(sheets);
  await store.createGroup({ name: 'Trip', emoji: '⛩️', cover: 'grad', currency: 'USD' });
  await store.hydrate();
  const snap = store.getSnapshot();
  // exactly one real group; the profile sheet is NOT listed as a group
  assert.equal(snap.groups.length, 1);
  assert.ok(!snap.groups.some(g => g.id === '__profile__'), 'profile is not a group');
  // the store exposes contacts + sentInvites containers (contacts = profile
  // friends, kept separate from the existing balance-derived snap.friends)
  assert.ok(Array.isArray(snap.contacts));
  assert.ok(Array.isArray(snap.sentInvites));
  // the index gained a reserved profile entry
  assert.ok(store.index['__profile__'], 'profile sheetId recorded in index');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/store.test.js`
Expected: FAIL — `snap.friends` is undefined / `store.index['__profile__']` is undefined.

- [ ] **Step 3: Add the profile constants + helpers**

In `src/store.js`, find the identity helpers block that ends with:

```js
    function localizeEvent(e) {
      return Object.assign({}, e, { actor: localizeId(e.actor), payload: mapPayloadIds(e.payload, localizeId) });
    }
```

Immediately after it, add:

```js
    // The per-user profile Sheet is tracked in the same appData index under a
    // reserved key and held as a pseudo-group so it can reuse appendLocal/flush/
    // pullGroup. It is NEVER a real group (excluded from rebuild/hydrate/activity).
    const PROFILE_KEY = '__profile__';

    function profileState() {
      const g = G[PROFILE_KEY];
      return g ? D.foldProfile(g.events) : { friends: {}, sentInvites: [] };
    }

    // Idempotent: ensure a profile Sheet exists, is indexed, and is loaded into G.
    async function ensureProfile() {
      if (G[PROFILE_KEY]) return G[PROFILE_KEY];
      let sheetId = index[PROFILE_KEY];
      if (sheetId && sheets.fileExists) {
        let ok = null;
        try { ok = await sheets.fileExists(sheetId); } catch (e) {}
        if (ok === false) sheetId = null; // was deleted → recreate
      }
      if (!sheetId) {
        sheetId = await sheets.createSpreadsheet('SplitSplit · Profile');
        await sheets.initTabs(sheetId, { kind: 'profile', schema_version: '1' }, []);
        index[PROFILE_KEY] = sheetId; saveIndex();
        try { const idx = await sheets.readIndex(); index = Object.assign(idx.map || {}, index); await sheets.writeIndex(idx.fileId, index); } catch (e) {}
      }
      G[PROFILE_KEY] = { id: PROFILE_KEY, sheetId, events: loadCachedEvents(PROFILE_KEY), lastSeq: 0 };
      G[PROFILE_KEY].lastSeq = G[PROFILE_KEY].events.reduce((m, e) => Math.max(m, e.seq), 0);
      try { await pullGroup(PROFILE_KEY); } catch (e) {}
      return G[PROFILE_KEY];
    }
```

- [ ] **Step 4: Exclude `__profile__` from `rebuild`**

In `rebuild()`, the group iteration starts:

```js
      const groupsArr = Object.values(G);
```

Change it to filter out the profile pseudo-group, and compute profile-derived snapshot fields. Replace that single line with:

```js
      const groupsArr = Object.values(G).filter(g => g.id !== PROFILE_KEY);
```

Then find the end of `rebuild` where the snapshot is assembled:

```js
      snapshot = { ready: true, hydrating, me: people[meId], groups, people, expenses, payments, friends };
```

Note this `friends` is the existing balance-derived `friends` from `D.friendBalances`. Do NOT clobber it. Add the profile-derived contacts under distinct keys. Replace that line with:

```js
      const prof = profileState();
      const contacts = Object.values(prof.friends).sort((a, b) => (b.ts || 0) - (a.ts || 0));
      snapshot = { ready: true, hydrating, me: people[meId], groups, people, expenses, payments, friends,
        contacts, sentInvites: prof.sentInvites };
```

The autocomplete field is `contacts` (profile friends), kept separate from the existing balance-derived `friends` (from `D.friendBalances`) so neither clobbers the other. Task 5 and all profile tests use `contacts`.

- [ ] **Step 5: Exclude `__profile__` from `allActivity`**

In `allActivity()`:

```js
      for (const g of Object.values(G)) {
        const evs = g.events.map(localizeEvent);
```

Change the loop header to skip the profile:

```js
      for (const g of Object.values(G)) {
        if (g.id === PROFILE_KEY) continue;
        const evs = g.events.map(localizeEvent);
```

- [ ] **Step 6: Skip `__profile__` in the `hydrate` group loop + ensure profile**

In `hydrate()`, the group loop header is:

```js
      const indexBefore = JSON.stringify(index);
      for (const [groupId, sheetId] of Object.entries(index)) {
```

Change it to skip the reserved key:

```js
      const indexBefore = JSON.stringify(index);
      for (const [groupId, sheetId] of Object.entries(index)) {
        if (groupId === PROFILE_KEY) continue;
```

Then, still inside the `try {` of hydrate, just before the existing rates loop comment `// Pull pinned rates from the first group...`, add the profile setup:

```js
      try { await ensureProfile(); } catch (e) {} // best-effort: friends/autocomplete
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `node --test test/store.test.js`
Expected: PASS (the new hydrate/profile test green; all prior tests still green).

- [ ] **Step 8: Commit**

```bash
git add src/store.js test/store.test.js
git commit -m "feat(store): profile Sheet lifecycle; exclude __profile__ from group logic"
```

---

## Task 3: store — collect friend + sent-invite on `inviteByEmail`; expose on snapshot

**Files:**
- Modify: `src/store.js` (`inviteByEmail`; add `appendProfile`, `rememberFriend`)
- Test: `test/store.test.js`

- [ ] **Step 1: Write the failing test**

Append to `test/store.test.js`:

```js
test('inviteByEmail: records the invitee as a contact and logs the sent invite', async () => {
  const sheets = fakeSheets();
  const store = newStore(sheets);
  const g = await store.createGroup({ name: 'T', emoji: '🏠', cover: 'g', currency: 'USD' });
  await store.inviteByEmail(g.id, 'Friend@Gmail.com');
  const snap = store.getSnapshot();
  assert.ok(snap.contacts.some(c => c.email === 'friend@gmail.com'), 'invitee is a contact');
  assert.equal(snap.sentInvites.length, 1);
  assert.equal(snap.sentInvites[0].email, 'friend@gmail.com');
  assert.equal(snap.sentInvites[0].groupId, g.id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/store.test.js`
Expected: FAIL — `snap.contacts` is empty (no FRIEND_SEEN appended) and `snap.sentInvites` is empty.

- [ ] **Step 3: Add `appendProfile` + `rememberFriend` helpers**

In `src/store.js`, immediately after the `ensureProfile` function added in Task 2, add:

```js
    // Append a profile event (best-effort; assumes ensureProfile has run).
    function appendProfile(type, payload) {
      if (!G[PROFILE_KEY]) return;
      appendLocal(PROFILE_KEY, type, payload);
    }

    // Record an email as a contact if not already known (and not ourselves).
    async function rememberFriend(email, name) {
      email = (email || '').toLowerCase();
      if (!email || email === (user && user.email || '').toLowerCase()) return;
      await ensureProfile();
      if (profileState().friends[email]) return;
      appendProfile(D.EVENT.FRIEND_SEEN, { email, name: name || email.split('@')[0] });
    }
```

- [ ] **Step 4: Hook `inviteByEmail`**

Find the end of `inviteByEmail`, which currently is:

```js
      const origin = deps.appOrigin || 'https://splitsplit.app';
      return { token, link: origin + '/join/' + groupId + '?s=' + g.sheetId + '&t=' + token };
    }
```

Insert the profile writes before the `return`:

```js
      const origin = deps.appOrigin || 'https://splitsplit.app';
      try {
        await ensureProfile();
        appendProfile(D.EVENT.FRIEND_SEEN, { email, name: email.split('@')[0] });
        appendProfile(D.EVENT.INVITE_SENT, { groupId, sheetId: g.sheetId, email, token, ts: now() });
        await flush();
      } catch (e) {} // best-effort: never block the invite on profile bookkeeping
      return { token, link: origin + '/join/' + groupId + '?s=' + g.sheetId + '&t=' + token };
    }
```

Note: `email` at this point is already lowercased (the function does `email = email.toLowerCase()` near its top) and `token` is already computed above this block.

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test test/store.test.js`
Expected: PASS (invite→contact+sent-invite green; all prior tests still green).

- [ ] **Step 6: Commit**

```bash
git add src/store.js test/store.test.js
git commit -m "feat(store): record contact + sent invite on inviteByEmail"
```

---

## Task 4: store — collect contacts from co-members during hydrate

**Files:**
- Modify: `src/store.js` (`hydrate` — after the group loop, before/with `ensureProfile`)
- Test: `test/store.test.js`

- [ ] **Step 1: Write the failing test**

Append to `test/store.test.js`:

```js
test('hydrate: co-members with an email become contacts', async () => {
  const sheets = fakeSheets();
  // store A creates a group and adds a member that has an email
  const a = newStore(sheets);
  const g = await a.createGroup({ name: 'Trip', emoji: '⛩️', cover: 'grad', currency: 'USD' });
  await a.addMember(g.id, { person_id: 'p_zoe', name: 'Zoe', email: 'zoe@x.com', color: '#000' });

  // a fresh store for the same user hydrates from the shared backend
  let t = 9000, c = 500;
  const b = createStore({
    sheets, storage: memStorage(),
    now: () => t++, genId: () => 'k' + (++c),
    user: { sub: 'u1', email: 'me@x.com', name: 'Sam', givenName: 'Sam' },
    index: { [g.id]: g.sheetId },
  });
  await b.hydrate();
  const snap = b.getSnapshot();
  assert.ok(snap.contacts.some(x => x.email === 'zoe@x.com'), 'co-member Zoe is a contact');
  assert.ok(!snap.contacts.some(x => x.email === 'me@x.com'), 'self is not a contact');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/store.test.js`
Expected: FAIL — `snap.contacts` does not contain `zoe@x.com`.

- [ ] **Step 3: Implement co-member collection in `hydrate`**

In `hydrate()`, locate the line added in Task 2:

```js
      try { await ensureProfile(); } catch (e) {} // best-effort: friends/autocomplete
```

Replace it with a version that, after ensuring the profile, walks every loaded group's members and remembers the ones with emails, then flushes:

```js
      try {
        await ensureProfile();
        for (const g of Object.values(G)) {
          if (g.id === PROFILE_KEY) continue;
          const folded = D.foldEvents(g.events.map(localizeEvent));
          for (const m of folded.members) await rememberFriend(m.email, m.name);
        }
        await flush();
      } catch (e) {} // best-effort: friends/autocomplete
```

Note: `rememberFriend` skips the current user and de-dupes against already-known contacts, so repeated hydrates do not append duplicates. The `me@x.com` localize→`me` member has `email: 'me@x.com'`, which `rememberFriend` rejects as self.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/store.test.js`
Expected: PASS (co-member→contact green; self excluded; all prior tests still green).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests PASS (no regressions).

- [ ] **Step 6: Commit**

```bash
git add src/store.js test/store.test.js
git commit -m "feat(store): collect contacts from co-members on hydrate"
```

---

## Task 5: Invite screen — email autocomplete from contacts

**Files:**
- Modify: `src/screens/Invite.jsx` (the email `<input>` and its surrounding block)

- [ ] **Step 1: Locate the email input**

Open `src/screens/Invite.jsx`. Find the controlled email `<input>` (value `email`, `onChange` calling `setEmail`). It is in the `stage === 'email'` portion of the form (search for `setEmail`).

- [ ] **Step 2: Add a datalist of contacts and bind the input to it**

At the top of the `InviteScreen` component body, read contacts from the store snapshot. Find:

```jsx
function InviteScreen({ store, groupId, goBack, navigate }) {
  const groups = store.getSnapshot().groups;
```

Change to also capture contacts:

```jsx
function InviteScreen({ store, groupId, goBack, navigate }) {
  const snap = store.getSnapshot();
  const groups = snap.groups;
  const contacts = (snap.contacts || []).filter(c => c.email);
```

Then add `list="ss-contacts"` to the email `<input>` and render a `<datalist>` next to it. The email input currently looks similar to (match the real attributes in the file; keep them, just add `list`):

```jsx
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            list="ss-contacts"
            ...existing props (placeholder, type, style) unchanged...
          />
          <datalist id="ss-contacts">
            {contacts.map(c => (
              <option key={c.email} value={c.email}>{c.name ? c.name + ' — ' + c.email : c.email}</option>
            ))}
          </datalist>
```

If the input is self-closing (`<input ... />`), add `list="ss-contacts"` to its props and place the `<datalist>` immediately after it as a sibling.

- [ ] **Step 3: Verify JSX transpiles + the app builds**

Run: `npm run build`
Expected: build succeeds (no JSX/syntax error), bundle emitted.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests PASS (this task is UI-only; no unit test, covered by build + manual check).

- [ ] **Step 5: Commit**

```bash
git add src/screens/Invite.jsx
git commit -m "feat(invite): autocomplete the email field from saved contacts"
```

---

## Final verification

- [ ] **Run the whole suite + build**

Run: `npm test && npm run build`
Expected: all unit tests PASS; production build succeeds.

- [ ] **Manual smoke (real app, signed in):**
  - First sign-in: a `SplitSplit · Profile` spreadsheet appears once in Drive.
  - Invite someone by email → reopen the invite screen → their email appears in the autocomplete dropdown.
  - Create/join a group with another member who has an email → that email appears in autocomplete.
  - Sign in on a second device → no duplicate profile Sheet is created (the `__profile__` index entry is reused).
