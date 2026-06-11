# SplitSplit — Per-User Profile Sheet (Friends + Sent Invites)

**Date:** 2026-06-11
**Status:** Approved design

## Summary

Add a private, per-user **profile Sheet** that stores the user's **friends list**
(for invite autocomplete) and a log of **invites they have sent**. It is created
lazily on login (reused if it already exists), is **never shared** with anyone,
and is event-sourced like the group Sheets.

This removes the need to type emails by hand when inviting, and gives the inviter
a record of who they have invited.

## Non-goals (explicitly out of scope)

- **In-app invite inbox / direct accept.** Not feasible serverlessly: with the
  `drive.file` scope the invitee's app cannot list "files shared with me", so it
  cannot discover an invite without the deep link. The existing link-based join
  flow stays the accept path. (Broadening to `drive.readonly`/`drive` would
  require Google's restricted-scope security review; a backend is out by the
  project's serverless constraint.)
- **Activity cache.** Activity is already derivable from group events via
  `allActivity()`; a personal copy would duplicate it. Skipped (YAGNI).
- **Email-on-invite flag.** Not changing `sendNotificationEmail` in this work.
- **Manual friend management UI.** Friends are auto-collected only.

## Architecture

A new spreadsheet per user — **the profile Sheet** — with tabs `_meta` and
`events`, created and owned by the user. Because the user creates it, the existing
`drive.file` + `spreadsheets` scopes cover it fully; **no new OAuth scopes**.

### Discovery & lifecycle

- The appData `index.json` (already used for `groupId → sheetId`) gains one
  reserved key: `__profile__ → sheetId`.
- On hydrate (every login):
  1. Read the index. If `__profile__` is present **and** `fileExists(sheetId)` is
     true → use it.
  2. Otherwise create a new profile Sheet, record `__profile__` in the index, and
     write the index back to Drive.
- This is idempotent: lazy create on first login, reuse thereafter. A deleted
  profile Sheet (404) is recreated on the next login.
- The reserved `__profile__` key must be **excluded** from group iteration in
  hydrate (it is not a group) and from the group-pruning/writeback logic.

## Data model

The profile Sheet's `events` tab uses the same row shape as group events
(`seq, id, type, actor, ts, payload`). Two event types, folded by a new
`foldProfile(events)` in `domain.js` (kept separate from the group `foldEvents`):

- `FRIEND_SEEN` — `{ email, name, paypal?, color? }`
  Upserts a friend, keyed by **lowercased email**. Latest event wins for
  name/paypal/color.
- `INVITE_SENT` — `{ groupId, sheetId, email, token, ts }`
  Appends a sent-invite record.

`foldProfile(events) → { friends: { [email]: {email,name,paypal,color} },
sentInvites: [ {groupId,sheetId,email,token,ts} ] }`.

New event-type constants live alongside the existing ones in `domain.js`.

## Flows

### Collecting friends

- **On `inviteByEmail(groupId, email)`** (after the existing
  `permissions.create` + group `MEMBER_ADDED`): append to the **profile** Sheet
  `FRIEND_SEEN { email, name: email.split('@')[0] }` and
  `INVITE_SENT { groupId, sheetId, email, token, ts }`.
- **On group member discovery** (during `hydrate`/`pullGroup`/`joinGroup`, when
  folding a group's members): for each member that has an email and is **not the
  current user** and is **not already a friend**, append `FRIEND_SEEN`. Dedup
  against the current folded `friends` set so we don't append duplicates every
  load.

### Autocomplete

- `Invite.jsx`'s email input is backed by the friends list from the snapshot
  (a native `<datalist>` of `email — name`, or a simple suggestion dropdown).
  Selecting a friend fills the email field; manual typing still works.

### Snapshot

- The store snapshot gains `friends` (array, sorted by most-recently-seen) and
  `sentInvites` (array). `rebuild()` reads them from the folded profile state held
  in the store.

## Components / files touched

- `src/domain.js` — `foldProfile(events)`; `EVENT.FRIEND_SEEN`,
  `EVENT.INVITE_SENT` constants.
- `src/store.js` — profile lifecycle (`ensureProfile()` in hydrate),
  `appendProfile(type, payload)` (append + queue + flush to the profile Sheet),
  friend-collection hooks in `inviteByEmail` and member discovery, expose
  `friends` / `sentInvites` on the snapshot. Exclude `__profile__` from group
  iteration/pruning.
- `src/sheets.js` — no new methods; profile Sheet reuses `createSpreadsheet`,
  `initTabs` (with `_meta` + `events`), `appendEvent`, `readEventsSince`.
- `src/screens/Invite.jsx` — autocomplete input sourced from `snapshot.friends`.
- Tests — `test/domain.test.js`: `foldProfile` (upsert by email, latest wins,
  sentInvites accumulation). `test/store.test.js`: invite adds a friend +
  sent-invite; a co-member with an email becomes a friend; `__profile__` is not
  treated as a group.

## Error handling

The profile Sheet is **best-effort**. If create/read/append fails (offline, API
disabled, 404), the app continues normally — autocomplete is simply empty and
friends don't populate. All profile operations are wrapped in try/catch and never
block group flows or sign-in. A profile append failure stays queued/retried like
group events, or is dropped silently if it cannot be reconciled.

## Conventions

- Profile Sheet Drive name: `SplitSplit · Profile`.
- Friends keyed by **lowercased email**. Members without an email are not added.
- Reserved index key: the literal string `__profile__`.

## Testing strategy

- Unit (`node --test`): `foldProfile` correctness; store invite→friend and
  co-member→friend behavior; `__profile__` exclusion from group logic.
- Manual: sign in (profile Sheet appears in Drive once); invite someone → their
  email shows in autocomplete next time; second device login reuses the same
  profile Sheet (no duplicate).
