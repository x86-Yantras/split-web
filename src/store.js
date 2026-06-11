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

    // Identity translation. "me" is a per-device alias for the signed-in user —
    // it must NOT be written literally into the shared Sheet, or every member
    // would read each other's "me" as themselves. On the wire we use a stable,
    // email-derived id (same scheme as inviteByEmail), and we remap that id back
    // to "me" only in *our own* local snapshot so the UI keeps using "me".
    function myId() {
      const e = (user && user.email || '').toLowerCase();
      return e ? 'p_' + e.replace(/[^a-z0-9]/g, '').slice(0, 12) : meId;
    }
    const ID_FIELDS = ['paidBy', 'from', 'to', 'person_id'];
    function mapPayloadIds(payload, fn) {
      if (!payload || typeof payload !== 'object') return payload;
      const o = Object.assign({}, payload);
      for (const k of ID_FIELDS) if (o[k] != null) o[k] = fn(o[k]);
      if (Array.isArray(o.participants)) o.participants = o.participants.map(fn);
      return o;
    }
    const delocalizeId = (id) => (id === meId ? myId() : id); // UI "me" -> wire id
    const localizeId = (id) => (id === myId() ? meId : id);    // my wire id -> "me"
    function localizeEvent(e) {
      return Object.assign({}, e, { actor: localizeId(e.actor), payload: mapPayloadIds(e.payload, localizeId) });
    }

    // group state: id -> { sheetId, meta, members:[], events:[], lastSeq }
    const G = {};
    let index = deps.index || loadIndex();        // { groupId: sheetId }
    let snapshot = null;
    let hydrating = true; // spinner until the first hydrate() settles
    const subs = new Set();
    const queue = [];                              // pending {sheetId, row, groupId}

    function loadIndex() {
      try { return JSON.parse(storage.getItem('splitsplit.index.v1') || '{}'); } catch (e) { return {}; }
    }
    function saveIndex() { storage.setItem('splitsplit.index.v1', JSON.stringify(index)); }
    function cacheKey(id) { return 'splitsplit.events.' + id; }
    function loadCachedEvents(id) { try { return JSON.parse(storage.getItem(cacheKey(id)) || '[]'); } catch (e) { return []; } }
    function saveCachedEvents(id) { storage.setItem(cacheKey(id), JSON.stringify(G[id].events)); }
    // Drop an orphaned group from local state (Sheet deleted / access revoked).
    function removeGroupLocal(id) {
      delete G[id];
      delete index[id];
      saveIndex();
      try { storage.removeItem(cacheKey(id)); } catch (e) {}
    }

    // User-initiated: remove a group from *my* list. Unlinks locally and pushes
    // the cleaned index back to Drive so it stays gone across my devices. Does
    // NOT delete the shared Sheet — other members keep their data.
    async function forgetGroup(groupId) {
      removeGroupLocal(groupId);
      notify();
      try { const idx = await sheets.readIndex(); await sheets.writeIndex(idx.fileId, index); } catch (e) {}
    }

    // ---- derive the public snapshot from folded group state ----
    function rebuild() {
      const groups = [], people = {}, expenses = {}, payments = {};
      people[meId] = { id: meId, name: (user && user.name) || 'You', email: user && user.email,
        initials: initialsFor((user && user.givenName) || 'You'), color: PALETTE[0], paypal: undefined };
      const groupsArr = Object.values(G);
      const expensesByGroup = {}, paymentsByGroup = {};
      for (const g of groupsArr) {
        // Remap our own stable id back to "me" so all downstream logic/UI (which
        // uses the "me" sentinel) treats the current user correctly; other members
        // keep their stable ids.
        const folded = D.foldEvents(g.events.map(localizeEvent));
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
      snapshot = { ready: true, hydrating, me: people[meId], groups, people, expenses, payments, friends };
    }

    function notify() { rebuild(); for (const cb of subs) cb(); }
    function getSnapshot() { if (!snapshot) rebuild(); return snapshot; }
    function subscribe(cb) { subs.add(cb); return () => subs.delete(cb); }

    // ---- event append (optimistic local + queued remote) ----
    function appendLocal(groupId, type, payload, actor) {
      const g = G[groupId];
      const seq = g.events.length ? g.events[g.events.length - 1].seq + 1 : 1;
      // Store events in wire form (stable ids), matching what we read from the Sheet.
      const wirePayload = mapPayloadIds(payload, delocalizeId);
      const wireActor = delocalizeId(actor || meId);
      const ev = { seq, id: genId(), type, actor: wireActor, ts: now(), payload: wirePayload };
      g.events.push(ev);
      saveCachedEvents(groupId);
      queue.push({ groupId, sheetId: g.sheetId, eventId: ev.id, row: [String(seq), ev.id, type, wireActor, String(ev.ts), JSON.stringify(wirePayload)] });
      notify();
      return ev;
    }

    async function flush() {
      let reconciled = false;
      while (queue.length) {
        const item = queue[0];
        try {
          const res = await sheets.appendEvent(item.sheetId, item.row);
          // The Sheet row is authoritative ordering. Reconcile the local event's seq with it.
          const range = res && res.updates && res.updates.updatedRange;
          const m = range && /!([A-Z]+)(\d+)/.exec(range);
          if (m) {
            const realSeq = parseInt(m[2], 10) - 1; // row 1 is the header
            const g = G[item.groupId];
            const ev = g && g.events.find(e => e.id === item.eventId);
            if (ev && realSeq > 0 && ev.seq !== realSeq) {
              ev.seq = realSeq;
              g.events.sort((a, b) => a.seq - b.seq);
              g.lastSeq = Math.max(g.lastSeq, realSeq);
              saveCachedEvents(item.groupId);
              reconciled = true;
            } else if (g) {
              g.lastSeq = Math.max(g.lastSeq, ev ? ev.seq : g.lastSeq);
            }
          }
          queue.shift();
        } catch (e) { break; } // keep in queue; retried on next flush/poll
      }
      if (reconciled) notify();
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

    async function inviteByEmail(groupId, email) {
      const g = G[groupId];
      email = email.toLowerCase();
      try {
        await sheets.permissionsCreate(g.sheetId, email);
      } catch (e) {
        if (/\b(404|410)\b/.test(String(e && e.message))) {
          removeGroupLocal(groupId); notify();
          const err = new Error("This group's Google Sheet no longer exists, so it's been removed from your list.");
          err.code = 'sheet-gone';
          throw err;
        }
        throw e;
      }
      const personId = 'p_' + email.replace(/[^a-z0-9]/g, '').slice(0, 12);
      appendLocal(groupId, D.EVENT.MEMBER_ADDED, {
        person_id: personId, email: email.toLowerCase(),
        name: email.split('@')[0], color: PALETTE[(Object.keys(G).length + email.length) % PALETTE.length], role: 'member',
      });
      await flush();
      const raw = groupId + ':' + email.toLowerCase() + ':' + now();
      const token = (typeof btoa !== 'undefined' ? btoa(raw) : Buffer.from(raw).toString('base64')).replace(/=/g, '').slice(0, 16);
      // The link carries the sheetId so the invitee can resolve which Sheet to verify
      // against. The sheetId is not a secret — access is gated by the Drive ACL.
      const origin = deps.appOrigin || 'https://splitsplit.app';
      return { token, link: origin + '/join/' + groupId + '?s=' + g.sheetId + '&t=' + token };
    }

    async function joinGroup(groupId, sheetId) {
      const email = (user && user.email || '').toLowerCase();
      // Verify access by READING the Sheet (Sheets API, account-wide spreadsheets
      // scope) — not Drive permissions.list. The drive.file scope can't see a
      // Sheet this app didn't create, so Drive 404s even when the inviter granted
      // us writer. A successful read => we're on the ACL; 403 => not granted;
      // 404/410 => the Sheet was deleted.
      try {
        await sheets.readMeta(sheetId);
      } catch (e) {
        const m = String(e && e.message);
        if (/\b403\b/.test(m)) return { ok: false, email, reason: 'not-on-acl' };
        if (/\b(404|410)\b/.test(m)) return { ok: false, email, reason: 'sheet-gone' };
        throw e;
      }
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
      hydrating = true;
      try {
      // Drive index.json is the source of truth. Read it every load and merge any
      // local-only (offline-created) groups on top, so deletions made on another
      // device propagate here automatically — no manual cache clearing.
      let driveFileId = null, driveSynced = false;
      if (!deps.index) {
        try {
          const idx = await sheets.readIndex();
          driveFileId = idx.fileId; driveSynced = true;
          index = Object.assign({}, idx.map || {}, index); // local-only entries survive
          saveIndex();
        } catch (e) { index = loadIndex(); } // offline / API off → fall back to cache
      }
      const indexBefore = JSON.stringify(index);
      for (const [groupId, sheetId] of Object.entries(index)) {
        // Deterministic existence check: drops Sheets the user trashed or deleted
        // in Drive (Sheets API alone reports these inconsistently). null = unknown
        // (transient) → keep the group and try again next load.
        if (sheets.fileExists) {
          let exists = null;
          try { exists = await sheets.fileExists(sheetId); } catch (e) {}
          if (exists === false) { removeGroupLocal(groupId); continue; }
        }
        G[groupId] = G[groupId] || { id: groupId, sheetId, events: loadCachedEvents(groupId), lastSeq: 0 };
        G[groupId].lastSeq = G[groupId].events.reduce((m, e) => Math.max(m, e.seq), 0);
        try {
          await pullGroup(groupId);
          // Pull succeeded but the Sheet has no events → ghost (emptied/deleted).
          // Prune so it doesn't render as an "undefined / 0 people / settled" card.
          if (!G[groupId].events || G[groupId].events.length === 0) { removeGroupLocal(groupId); continue; }
        } catch (e) {
          // Sheet is definitively gone (404/410) → forget the orphaned local entry.
          // 403/network are deliberately NOT pruned: they can be transient (API
          // disabled, rate limit) and would otherwise wipe still-valid groups.
          if (/\b(404|410)\b/.test(String(e && e.message))) { removeGroupLocal(groupId); continue; }
        }
      }
      // If pruning changed the map, push the cleaned index back to Drive so every
      // device converges on the same group list.
      if (driveSynced && JSON.stringify(index) !== indexBefore) {
        try { await sheets.writeIndex(driveFileId, index); } catch (e) {}
      }
      notify();
      // Pull pinned rates from the first group that has any; fall back to bundled.
      for (const g of Object.values(G)) {
        try { const r = await sheets.readRates(g.sheetId); if (r && Object.keys(r).length) { (D._CCY || (typeof window !== 'undefined' && window.CCY)).setRates(r); break; } } catch (e) {}
      }
      notify();
      } finally { hydrating = false; notify(); }
    }

    function allActivity() {
      const out = [];
      const nowMs = now();
      for (const g of Object.values(G)) {
        const evs = g.events.map(localizeEvent);
        const folded = D.foldEvents(evs);
        const feed = D.deriveActivity(evs, g.id, meId, nowMs);
        for (const item of feed) out.push(Object.assign({ _ts: (evs.find(e => (e.id || ('a' + e.seq)) === item.id) || {}).ts || 0 }, item, { groupName: folded.meta.name }));
      }
      out.sort((a, b) => b._ts - a._ts);
      return out;
    }

    function commentsFor(groupId, expenseId) {
      const folded = D.foldEvents(G[groupId] ? G[groupId].events.map(localizeEvent) : []);
      return folded.comments.filter(c => c.expense_id === expenseId);
    }

    function _injectMockGroup(groupId, sheetId, events) {
      G[groupId] = { id: groupId, sheetId, events, lastSeq: events.length };
      notify();
    }

    return {
      getSnapshot, subscribe, hydrate, flush, pullGroup, joinGroup,
      createGroup, forgetGroup, addMember, addExpense, editExpense, deleteExpense, recordPayment, addComment, setPayPalHandle, inviteByEmail,
      allActivity, commentsFor,
      _injectMockGroup,
      get index() { return index; },
    };
  }

  return { createStore };
});

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
          appOrigin: window.location.origin,
        });
      }
      return instance;
    };
    window.SSResetStore = function () { instance = null; };
    window.SSActivity = (store) => store.allActivity();
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
    // React hook: subscribe so the component re-renders on store changes, and return the
    // store INSTANCE. Screens call both reads (store.getSnapshot()) and mutations
    // (store.addExpense/createGroup/...), so they need the instance, not the snapshot.
    window.useStore = function () {
      const store = window.SSGetStore();
      React.useSyncExternalStore(store.subscribe, store.getSnapshot);
      return store;
    };
  })();
}
