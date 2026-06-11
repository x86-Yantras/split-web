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

test('joinGroup: email on ACL hydrates the group and returns ok', async () => {
  const sheets = fakeSheets();
  // seed a real group on one store
  const a = newStore(sheets);
  const g = await a.createGroup({ name: 'Trip', emoji: '⛩️', cover: 'grad', currency: 'USD' });
  // fresh store for the joiner whose email is on the ACL
  let t = 7000, c = 200;
  const b = createStore({
    sheets, storage: memStorage(),
    now: () => t++, genId: () => 'j' + (++c),
    user: { sub: 'u2', email: 'me@x.com', name: 'Sam Park', givenName: 'Sam' },
  });
  sheets.permissionsList = async () => ['me@x.com', 'someone-else@x.com'];
  const res = await b.joinGroup(g.id, g.sheetId);
  assert.equal(res.ok, true);
  assert.equal(b.index[g.id], g.sheetId);
  assert.equal(b.getSnapshot().groups.find(x => x.id === g.id).name, 'Trip');
});

test('joinGroup: no Sheet access (403) returns ok:false / not-on-acl', async () => {
  const sheets = fakeSheets();
  // Not on the ACL → the Sheets read is denied (Drive ACL is no longer consulted).
  sheets.readMeta = async () => { throw new Error('Google API 403 for sheets read'); };
  const store = newStore(sheets);
  const res = await store.joinGroup('g1', 'S1');
  assert.equal(res.ok, false);
  assert.equal(res.email, 'me@x.com');
  assert.equal(res.reason, 'not-on-acl');
});

test('inviteByEmail: grants writer perm, adds member, returns a link', async () => {
  const sheets = fakeSheets();
  let granted = null;
  sheets.permissionsCreate = async (id, email) => { granted = email; return { id: 'perm' }; };
  const store = newStore(sheets);
  const g = await store.createGroup({ name: 'T', emoji: '🏠', cover: 'g', currency: 'USD' });
  const { link } = await store.inviteByEmail(g.id, 'Friend@Gmail.com');
  assert.equal(granted, 'friend@gmail.com');
  // link carries the sheetId (?s=) and the token (&t=) so the invitee can verify.
  assert.match(link, /\/join\/.+\?s=.+&t=.+/);
  assert.ok(store.getSnapshot().groups.find(x => x.id === g.id).members.some(m => m.startsWith('p_')));
});

test('multi-user identity: payer is not "me" for the other member', async () => {
  const sheets = fakeSheets();
  const mk = (email, name) => {
    let t = 1000, c = 0;
    return createStore({
      sheets, storage: memStorage(), now: () => t++, genId: () => email[0] + (++c),
      user: { sub: email, email, name, givenName: name },
    });
  };
  // Owner creates the group, invites friend, and logs an expense they paid.
  const owner = mk('owner@x.com', 'Owner');
  const g = await owner.createGroup({ name: 'Trip', emoji: '⛩️', cover: 'grad', currency: 'USD' });
  await owner.inviteByEmail(g.id, 'friend@x.com');
  const friendId = 'p_' + 'friend@x.com'.replace(/[^a-z0-9]/g, '').slice(0, 12);
  await owner.addExpense(g.id, { desc: 'Lunch', amount: 100, currency: 'USD', emoji: '🍱', category: 'Food', paidBy: 'me', split: 'equal', participants: ['me', friendId], date: '2026-05-01' });

  // Friend joins the same backend and reads the same expense.
  const friend = mk('friend@x.com', 'Friend');
  const res = await friend.joinGroup(g.id, g.sheetId);
  assert.equal(res.ok, true);

  const ownerExp = owner.getSnapshot().expenses[g.id][0];
  const friendExp = friend.getSnapshot().expenses[g.id][0];
  assert.equal(ownerExp.paidBy, 'me', 'owner sees themselves as the payer');
  assert.notEqual(friendExp.paidBy, 'me', 'friend must NOT see themselves as the payer');
  // Owner is owed; friend owes. Signs must be opposite.
  const ownerGrp = owner.getSnapshot().groups.find(x => x.id === g.id);
  const friendGrp = friend.getSnapshot().groups.find(x => x.id === g.id);
  assert.ok(ownerGrp.youAreOwed > 0, 'owner is owed');
  assert.ok(friendGrp.youOwe > 0, 'friend owes');
});
