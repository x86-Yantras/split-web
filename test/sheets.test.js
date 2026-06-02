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
