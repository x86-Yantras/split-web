# SplitSplit — Handoff Doc

A free, original Splitwise alternative. **Data plane: Google Sheets per group. Metadata: Google Drive.** Mobile-first PWA.

---

## 0 · TL;DR for Claude Code

The prototype lives at [`SplitSplit.html`](./SplitSplit.html). It is a fully interactive React + Babel single-file mobile prototype rendered inside an iOS device frame. **All state is mock**, persisted in-memory only. Google Sign-In is the only real integration wired so far.

**Your job:** swap the mock data layer (`src/data.js`) for a real Sheets-backed store and finish the bits flagged as "stub" in §6.

```
SplitSplit.html              ← entry; loads everything below
src/
  data.js                    ← MOCK store + currency helpers — REPLACE
  auth.js                    ← Google Identity Services + token client (DONE)
  ui.jsx                     ← design tokens + shared components
  ios-frame.jsx              ← device chrome (starter)
  tweaks-panel.jsx           ← dev-only design tweaks (starter, can remove)
  app.jsx                    ← root + nav stack + screen routing
  screens/
    SignIn.jsx               ← Google CTA, value props
    Home.jsx                 ← groups list + balance hero
    Group.jsx                ← expenses + balances + totals tabs
    AddExpense.jsx           ← amount, payer, split-mode sheet, participants
    Friends.jsx              ← contacts by balance
    Friend.jsx               ← single-friend history
    Settle.jsx               ← PayPal redirect or "mark paid"
    Activity.jsx             ← cross-group feed
    Profile.jsx              ← account, currency pref, sign out
    Invite.jsx               ← email → silent permissions.create → deep link
    Join.jsx                 ← deep-link landing → sign in → verify → enter
```

---

## 1 · Design system (already in code)

| Token            | Value                                            |
| ---------------- | ------------------------------------------------ |
| Background       | `#FAF7F2` warm cream                             |
| Surface          | `#FFFFFF`                                        |
| Surface alt      | `#F4EFE7`                                        |
| Ink              | `#1F1B16`                                        |
| Ink 2            | `#4A4640`                                        |
| Muted            | `#837C73`                                        |
| Accent           | `#D97757` terracotta                             |
| Accent ink       | `#8E3F25` (darker accent for icons-on-surfaceAlt)|
| Positive         | `#5E7A3F` olive (you're owed)                    |
| Negative         | `#B7503A` clay (you owe)                         |
| Hairline         | `#ECE5D9`                                        |
| Warn             | `#C28A2C`                                        |

- **UI font:** `Geist` (Google Fonts), weights 400/500/600/700
- **Numerals / playful accent:** `Instrument Serif` italic — used ONLY for big money figures, the "$" wordmark, and 1–2 tasteful labels. Don't lean on it.
- Corners: 12–20px on cards, 999 on chips/pills, 24px on hero blocks
- Tab bar: 5 slots, center FAB pokes 22px above the bar, navigates to **New Group**
- iOS 26 safe areas: 62px top spacer + 34px bottom spacer baked into `app.jsx`

---

## 2 · Screens & flows

### 2.1 Sign-in
- Wordmark = stacked terracotta + ink rounded squares with italic `$` glyph
- "Continue with Google" → GIS One Tap (with rendered-button fallback)
- Value-prop card: free / your Drive / any currency
- Footer microcopy: "We never see your expenses."

### 2.2 Home (Groups tab)
- **Hero**: net-balance card (ink background). Big italic numeral in display currency. Below: split tiles for "You're owed" + "You owe".
- **Groups list**: cover-gradient + emoji on left, name + member stack + member count + currency code, right-side per-group balance pill ("YOU GET ¥18,420" or "settled up").
- **Quick actions** row: Settle up · Invite friends
- **Tab bar FAB → New Group**

### 2.3 Group detail
- Cover-gradient hero with: balance label, italic balance number, member stack, total expenses, count
- Action row: **Add expense** (primary, ink) + **Settle up** (ghost)
- **Tabs**: Expenses · Balances · Totals
  - **Expenses**: grouped by month → date chip + emoji + desc + "X paid Y" + per-row "you lent / you owe / not in" with amount
  - **Balances**: net-per-member rows (Avatar · name · owes/owed · amount). Tap → Friend.
  - **Totals**: hero (total spent | per-head), stacked bar by category w/ legend, per-person twin bars (`paid` solid + `used` outlined) with net pill
- Members section with "Invite people" row at bottom → InviteScreen

### 2.4 Add Expense
- Sticky top: close × · "New expense" · Save (disabled until amount + desc)
- Group picker card
- Big card: emoji button (cycles) + "What was it?" input + Currency picker + huge italic numeral input
- Rows: Paid by · Split (label like "Equally between 5") · Date
- **Splitting with**: horizontal avatar chip row, toggleable
- Split sheet (bottom sheet): 2×2 mode picker — `Equally · By shares · By % · Exact` — each with its own input UI (stepper / %-input / amount-input) and live "off by" feedback
- Save bar at bottom (accent button)

### 2.5 Settle up
- **Step 1: Who?** — list filtered to friends with non-zero balance
- **Step 2: Amount + method**
  - Avatars facing each other with chevron showing money direction
  - Italic numeral input with currency symbol prefix
  - "Pay full balance · ¥X" chip below
  - Method tiles: **PayPal** (with stylized P glyph) and **Cash / other**
  - **PayPal card** (shown when method=PayPal):
    - If payee has a `paypal` handle: renders `paypal.me/<handle>` with explainer copy
    - If not: input `paypal.me/____` that saves to payee's record on submit
  - CTA: "Open paypal.me/<handle>" (opens external) or "Mark as received"
  - Cash path: "Mark as paid" — just a flag

### 2.6 Friends · Friend · Activity · Profile
Straightforward — see file headers.

### 2.7 Invite flow
- **Step 1 — Email**: group context card, gmail input, 3-step "what happens next" explainer ("We add them as editor → You get a shareable link → They tap, sign in, they're in")
- **Step 2 — Provisioning**: spinner + checklist ("Adding to your shared sheet" → "Granting editor access" → "Skipping Google notification") — should drive the real `drive.permissions.create` calls
- **Step 3 — Ready**: success badge, generated link `splitsplit.app/join/<groupId>?t=<token>`, copy button, 4 share tiles (WhatsApp/Messages/Mail/More), pre-baked WhatsApp message preview

### 2.8 Join flow (deep-link landing)
- **Landing**: inviter avatar + "Alex Chen invited you to" + big group card with cover + member stack + value props + "Continue with Google"
- **Signing in** spinner
- **Verifying**: checklist ("Found your Google account" → "Checking access to <Group>'s data" → "You're on the editor list") — drive `drive.permissions.list` then membership check
- **Joined**: tilted group emblem with green check + "You're in." + italic "welcome to <Group>." + "Open group" CTA

---

## 3 · Data model — current shape (`src/data.js`)

This is the contract the UI expects. **Keep the field names and types stable** as you replace the mock with Sheets.

### Person
```js
{ id, name, initials, color, paypal? }
```

### Group
```js
{
  id, name, emoji,
  cover,                 // CSS gradient string for now; later a hex pair
  currency,              // ISO 4217
  members: [personId],
  youOwe, youAreOwed,    // DERIVED — compute, don't store
}
```

### Expense
```js
{
  id, date,              // YYYY-MM-DD
  desc, emoji, category,
  amount, currency,
  paidBy: personId,
  participants: [personId],
  split: 'equal' | 'shares' | 'percent' | 'exact',
  shares?:   { [personId]: number },   // ratio
  percents?: { [personId]: number },   // 0..100
  exacts?:   { [personId]: number },   // currency units
}
```

### Activity (derived)
```js
{ id, type: 'expense'|'payment'|'comment'|'group', who, desc, group, when, amount?, currency?, share?, you?, text? }
```

### Currency helpers
`window.CCY.format(amount, code)` · `convert(amount, from, to)` · `codes` · `symbols`.
Right now there are mock USD-rates baked in for the home-screen aggregation. Replace with a real rates feed (ExchangeRate API or pinned daily rates from a sheet).

---

## 4 · Auth — what's done

`src/auth.js` exposes `window.SSAuth`:

```js
SSAuth.init()           // idempotent, called on load
SSAuth.signIn({anchorEl?})
SSAuth.signOut()
SSAuth.getUser()        // → { sub, email, name, givenName, picture, idToken } or null
SSAuth.onChange(cb)     // subscribe
SSAuth.getAccessToken() // Promise<string> for Drive/Sheets calls
```

- **Client ID:** `310293753844-3dr3e4jsmc556k1hnbulvup7mhr17eqj.apps.googleusercontent.com`
- **Scopes requested for the token client:** `drive.file` + `spreadsheets`
- ID-token JWT is decoded client-side; profile is persisted to `localStorage` under `splitsplit.user.v1`. **The `idToken` is also stashed — verify it server-side if/when you add a backend.**
- Auth state changes are broadcast through `SSAuth.onChange`; `App` subscribes and re-renders.
- Sign-out clears storage and calls `google.accounts.id.disableAutoSelect()`.

---

## 5 · Sheets / Drive integration plan

> The prototype's invite flow is built to mimic this exact shape — when you wire it up, the loading checklists ("Adding to your shared sheet" / "Granting editor access" / "Checking access") map 1:1 to API calls.

### 5.1 Per-group sheet layout

One Google Sheet per group, owned by the creator. Suggested tabs:

| Tab        | Columns                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------- |
| `_meta`    | key, value — group_id, name, emoji, cover, currency, created_at, schema_version           |
| `members`  | person_id, email, name, color, joined_at, role (admin/member), paypal                     |
| `expenses` | id, date, desc, emoji, category, amount, currency, paid_by, split_mode, participants_json, shares_json, percents_json, exacts_json, created_by, created_at, deleted_at |
| `payments` | id, date, from, to, amount, currency, method, note, created_at                            |
| `comments` | id, expense_id, author, text, created_at                                                  |
| `activity` | id, type, who, desc, group, ts, payload_json — *optional, can derive*                     |

JSON-encode the `participants`, `shares`, etc. into single cells to keep schema simple.

### 5.2 Metadata in Drive

A single Drive file `splitsplit/index.json` per user (in their app-data folder) maps `groupId → sheetId`. Created on first launch, written via the `drive.file` scope so we never see other files.

### 5.3 Group creation

1. `drive.files.create` with `mimeType: application/vnd.google-apps.spreadsheet` and `name: 'SplitSplit · <Group name>'`
2. Initialize tabs via `sheets.spreadsheets.batchUpdate` (addSheet + setValues for headers)
3. Append the creator to `members`
4. Update `index.json` in Drive: `{ [groupId]: sheetId }`
5. Push the new group into local state and navigate to the group detail

**⚠️ Bug to fix:** the user reported new groups don't appear in the list. In the current prototype, `NewGroupScreen` doesn't dispatch any state change — `goBack` just pops the stack and `DATA.groups` is still the original mock array. Once you replace `DATA` with a real store (Zustand / Redux / Context + `useSyncExternalStore`), creation needs to call `store.createGroup(...)` which both writes to Sheets AND mutates the in-memory state. Today there's nowhere for the new row to land.

### 5.4 Inviting (silent share)

```js
gapi.client.drive.permissions.create({
  fileId: sheetId,
  sendNotificationEmail: false,
  resource: { role: 'writer', type: 'user', emailAddress: email },
});
```

Then mint a deep-link token (any opaque string is fine — the real authn happens via the Google account at the destination):

```
splitsplit.app/join/<groupId>?t=<token>
```

### 5.5 Join flow verification

When an invitee opens the deep link:

1. `SSAuth.signIn()` → get id-token
2. `SSAuth.getAccessToken()` → Drive scope
3. `drive.permissions.list({ fileId: sheetId })` and check the signed-in user's email is in the editor list
4. On success: append a row to `members`, fetch the rest of the sheet, hydrate state, route to group detail
5. On failure: show a "wrong account?" state (not built — see §6)

### 5.6 Conflict handling

Two clients editing the same expense row simultaneously. The cheap correct answer: **append-only events**. Each mutation is an event row (`expense_added`, `expense_updated`, `expense_deleted`, `payment_recorded`), with the materialized expense being the fold of all events. Sheets' append + `valueInputOption: USER_ENTERED` is atomic at the row level. Cheaper still: poll every N seconds. Real-time push is not worth the complexity.

---

## 6 · Known stubs / things to finish

- [ ] **New group doesn't persist** — see §5.3. The button is wired (`createGroup`) but there's no store to write into.
- [ ] **Add expense doesn't persist** — same reason. The Save button just calls `goBack()`.
- [ ] **Settle up doesn't persist** — same.
- [ ] **PayPal handle save** — when a user types a new handle, it should write back to that person's row in `members`. Currently held only in `useState`.
- [ ] **Payment method tiles** are placeholder beyond PayPal — wire Cash to actually create a `payments` row.
- [ ] **"More" share tile** in invite — wire to `navigator.share({ url, title, text })`.
- [ ] **Expense detail** screen (tap an expense row) — not built. Should support comments, edit, delete.
- [ ] **Wrong-account error state** for Join — when verification fails because user signed in with the wrong email.
- [ ] **Settle-up suggestions** — minimize transaction count (Splitwise's killer move). Run on `balances` per group; show as a banner in the Balances tab: "3 payments settles everyone up — review?"
- [ ] **Activity feed** is mock — derive from append-only events.
- [ ] **CSV export** — promised in product list, not built.
- [ ] **Multi-currency conversion** — currently uses hardcoded rates in `data.js`. Either ship pinned rates daily via a backend or accept that the home-screen aggregate is approximate.
- [ ] **PWA install** — add a manifest + service worker for offline (Sheets queue + replay).
- [ ] **Empty states** for Friends, Activity, Groups (zero-data) — most screens assume data exists.

---

## 7 · Out of scope (intentional, do not build)

- Native iOS / Android apps. PWA only.
- Premium tier / paid features. "Free forever" is in the value prop copy.
- A custom backend that sits between client and Google. The whole point is no servers — auth + storage are Google.

---

## 8 · How to run

```
python3 -m http.server 8000
# → http://localhost:8000/SplitSplit.html
```

`localhost` is already an authorized origin on the OAuth client. No build step — Babel transpiles in the browser via CDN. For prod, precompile the JSX.

---

## 9 · Things to preserve when refactoring

- The **warm-cream + terracotta + olive + clay** palette is the brand identity. Don't drift it to a generic cool palette.
- The **Instrument Serif italic numerals** are the one playful signature. Keep them.
- The **center-FAB → New Group** wiring (groups are the top-level thing; expenses are contextual).
- The **silent invite → deep link → verify** flow is the point of difference — don't replace it with a Splitwise-style "send email invite from our domain" flow.
- "**Hidden Google plumbing**" — don't surface "your sheet" / "your Drive" as a feature. The one approved mention is the trust microcopy in Sign-in and Profile.
