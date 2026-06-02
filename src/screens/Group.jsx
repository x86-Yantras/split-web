// Group detail screen.

function GroupScreen({ store, groupId, navigate, goBack }) {
  const snap = store.getSnapshot();
  const group = snap.groups.find(g => g.id === groupId);
  const expenses = (snap.expenses[groupId] || []).filter(e => !e.deleted);
  const people = snap.people;
  const [tab, setTab] = React.useState('expenses');

  if (!group) return null;

  const balance = group.youAreOwed - group.youOwe;
  const balanceCol = balance > 0 ? SS.positive : balance < 0 ? SS.negative : SS.muted;
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <Screen>
      <Header
        leading={<IconBtn name="chevL" onClick={goBack} />}
        title={group.name}
        trailing={<IconBtn name="more" onClick={() => {}} />}
      />

      {/* Cover hero */}
      <div style={{ padding: '0 20px' }}>
        <div style={{
          borderRadius: 24, padding: '22px 22px 18px',
          background: group.cover, color: '#fff', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', right: -10, top: -10, fontSize: 140, lineHeight: 1,
            opacity: 0.2, pointerEvents: 'none',
          }}>{group.emoji}</div>

          <div style={{ fontFamily: 'Geist, system-ui', fontSize: 11.5, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>
            {balance === 0 ? 'All settled' : balance > 0 ? 'You are owed' : 'You owe'}
          </div>
          <div style={{ marginTop: 4 }}>
            <Money amount={Math.abs(balance)} currency={group.currency} size={40} italic color="#fff" />
          </div>
          <div style={{
            marginTop: 14, display: 'flex', alignItems: 'center', gap: 12,
            paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.22)',
          }}>
            <AvatarStack ids={group.members} size={24} max={5} people={people} />
            <div style={{
              fontFamily: 'Geist, system-ui', fontSize: 12.5, color: 'rgba(255,255,255,0.92)',
            }}>{group.members.length} members · {expenses.length} expenses · <Money amount={totalSpent} currency={group.currency} size={12.5} weight={500} color="rgba(255,255,255,0.92)" /> total</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '16px 20px 4px', display: 'flex', gap: 8 }}>
        <Button variant="primary" icon="plus" fullWidth onClick={() => navigate({ screen: 'addExpense', groupId })}>Add expense</Button>
        <Button variant="ghost" icon="send" onClick={() => navigate({ screen: 'settle', groupId })}>Settle up</Button>
      </div>

      {/* Tabs */}
      <div style={{ padding: '14px 20px 0', display: 'flex', gap: 6 }}>
        {['expenses', 'balances', 'totals'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 14px', borderRadius: 999,
            background: tab === t ? SS.ink : 'transparent',
            color: tab === t ? '#FCFAF5' : SS.muted,
            border: tab === t ? 'none' : `1px solid ${SS.hairline}`,
            fontFamily: 'Geist, system-ui', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', textTransform: 'capitalize',
          }}>{t}</button>
        ))}
      </div>

      {tab === 'expenses' ? <ExpensesList expenses={expenses} group={group} people={people} navigate={navigate} />
        : tab === 'balances' ? <BalancesList group={group} expenses={expenses} payments={snap.payments[groupId] || []} people={people} navigate={navigate} store={store} />
        : <TotalsList group={group} expenses={expenses} people={people} />}

      <div style={{ height: 24 }} />
    </Screen>
  );
}

function ExpensesList({ expenses, group, people, navigate }) {
  // Group by month
  const byMonth = {};
  for (const e of expenses) {
    const d = new Date(e.date);
    const key = d.toLocaleDateString('en', { month: 'long', year: 'numeric' });
    (byMonth[key] = byMonth[key] || []).push(e);
  }

  return (
    <div style={{ padding: '8px 0 0' }}>
      {Object.entries(byMonth).map(([month, items]) => (
        <div key={month}>
          <SectionLabel>{month}</SectionLabel>
          <div style={{ padding: '0 12px' }}>
            <div style={{ background: SS.surface, borderRadius: 16, border: `1px solid ${SS.hairline}`, overflow: 'hidden' }}>
              {items.map((e, i) => (
                <React.Fragment key={e.id}>
                  {i > 0 && <HR inset={56} />}
                  <ExpenseRow expense={e} group={group} people={people} onClick={() => navigate({ screen: 'expense', groupId: group.id, expenseId: e.id })} />
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ExpenseRow({ expense, group, people, onClick }) {
  const payer = people[expense.paidBy];
  const payerIsMe = expense.paidBy === 'me';
  // your share
  let myShare = 0;
  if (expense.participants.includes('me')) {
    if (expense.split === 'percent') {
      myShare = expense.amount * (expense.percents.me / 100);
    } else if (expense.split === 'shares') {
      const totalShares = Object.values(expense.shares).reduce((s, n) => s + n, 0);
      myShare = expense.amount * (expense.shares.me / totalShares);
    } else {
      myShare = expense.amount / expense.participants.length;
    }
  }
  const yourImpact = payerIsMe ? expense.amount - myShare : -myShare; // + means you lent, - means you owe

  const d = new Date(expense.date);
  const day = d.getDate();
  const mon = d.toLocaleDateString('en', { month: 'short' });

  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      cursor: 'pointer',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 12, background: SS.surfaceAlt,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Geist, system-ui', flexShrink: 0,
      }}>
        <div style={{ fontSize: 9.5, fontWeight: 600, color: SS.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>{mon}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: SS.ink, lineHeight: 1 }}>{day}</div>
      </div>

      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: SS.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>{expense.emoji}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'Geist, system-ui', fontSize: 14.5, fontWeight: 500,
          color: SS.ink, letterSpacing: -0.1, whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{expense.desc}</div>
        <div style={{
          fontFamily: 'Geist, system-ui', fontSize: 12, color: SS.muted, marginTop: 2,
        }}>{payerIsMe ? 'You' : payer.name.split(' ')[0]} paid <Money amount={expense.amount} currency={expense.currency} size={12} weight={500} color={SS.muted} /></div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontFamily: 'Geist, system-ui', fontSize: 10.5, fontWeight: 600,
          letterSpacing: 0.7, textTransform: 'uppercase', whiteSpace: 'nowrap',
          color: yourImpact > 0 ? SS.positive : yourImpact < 0 ? SS.negative : SS.muted,
        }}>{yourImpact > 0 ? 'you lent' : yourImpact < 0 ? 'you owe' : 'not in'}</div>
        <div style={{ marginTop: 2 }}>
          {yourImpact !== 0 ? (
            <Money amount={Math.abs(yourImpact)} currency={expense.currency} size={14}
              color={yourImpact > 0 ? SS.positive : SS.negative} weight={600} />
          ) : (
            <span style={{ fontFamily: 'Geist, system-ui', fontSize: 12, color: SS.muted }}>—</span>
          )}
        </div>
      </div>
    </div>
  );
}

function BalancesList({ group, expenses, payments, people, navigate, store }) {
  const D = window.SSDomain;
  const nets = D.memberNets(expenses, payments || [], group.members);
  const suggestions = D.minimizeTransactions(nets);

  // Compute net per-member (excluding me) — what they owe me or I owe them in this group.
  const net = {}; // memberId -> amount, positive = they owe me
  for (const m of group.members) if (m !== 'me') net[m] = 0;

  for (const e of expenses) {
    // shares per person
    let shares = {};
    if (e.split === 'percent') {
      for (const p of e.participants) shares[p] = e.amount * ((e.percents[p] || 0) / 100);
    } else if (e.split === 'shares') {
      const total = Object.values(e.shares).reduce((s, n) => s + n, 0);
      for (const p of e.participants) shares[p] = e.amount * ((e.shares[p] || 0) / total);
    } else {
      for (const p of e.participants) shares[p] = e.amount / e.participants.length;
    }
    if (e.paidBy === 'me') {
      for (const p of e.participants) if (p !== 'me') net[p] = (net[p] || 0) + shares[p];
    } else if (e.participants.includes('me')) {
      net[e.paidBy] = (net[e.paidBy] || 0) - shares.me;
    }
  }

  const rows = Object.entries(net).filter(([, v]) => Math.abs(v) > 0.01);

  return (
    <div style={{ padding: '8px 0 0' }}>
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
      <SectionLabel>Who owes who</SectionLabel>
      <div style={{ padding: '0 12px' }}>
        <div style={{ background: SS.surface, borderRadius: 16, border: `1px solid ${SS.hairline}`, overflow: 'hidden' }}>
          {rows.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: SS.muted, fontFamily: 'Geist, system-ui', fontSize: 14 }}>
              Everyone is settled up in this group.
            </div>
          )}
          {rows.map(([id, amt], i) => {
            const p = people[id];
            const theyOweMe = amt > 0;
            return (
              <React.Fragment key={id}>
                {i > 0 && <HR inset={62} />}
                <Row
                  left={<Avatar person={p} size={42} />}
                  title={p.name}
                  sub={theyOweMe ? 'owes you' : 'you owe'}
                  right={<Money amount={Math.abs(amt)} currency={group.currency} size={16} weight={600} color={theyOweMe ? SS.positive : SS.negative} />}
                  onClick={() => navigate({ screen: 'friend', friendId: id })}
                />
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <SectionLabel>Members</SectionLabel>
      <div style={{ padding: '0 12px' }}>
        <div style={{ background: SS.surface, borderRadius: 16, border: `1px solid ${SS.hairline}`, overflow: 'hidden' }}>
          {group.members.map((id, i) => {
            const p = people[id];
            return (
              <React.Fragment key={id}>
                {i > 0 && <HR inset={62} />}
                <Row
                  left={<Avatar person={p} size={42} />}
                  title={id === 'me' ? 'You' : p.name}
                  sub={id === 'me' ? 'admin' : 'member'}
                  right={<Icon name="chev" size={16} color={SS.muted} />}
                  onClick={() => {}}
                />
              </React.Fragment>
            );
          })}
          <HR inset={62} />
          <Row
            left={<div style={{
              width: 42, height: 42, borderRadius: 999, background: SS.surfaceAlt,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Icon name="plus" size={18} color={SS.accentInk} /></div>}
            title="Invite people"
            sub="Send a deep link via WhatsApp"
            right={<Icon name="chev" size={16} color={SS.muted} />}
            onClick={() => navigate({ screen: 'invite', groupId: group.id })}
          />
        </div>
      </div>
    </div>
  );
}

function TotalsList({ group, expenses, people }) {
  // Compute per-person paid + share, plus by-category totals.
  const totals = {}; // id -> { paid, share }
  for (const id of group.members) totals[id] = { paid: 0, share: 0 };
  const byCat = {}; // category -> amount
  let total = 0;

  for (const e of expenses) {
    total += e.amount;
    byCat[e.category] = (byCat[e.category] || 0) + e.amount;
    if (totals[e.paidBy]) totals[e.paidBy].paid += e.amount;
    let shares = {};
    if (e.split === 'percent') {
      for (const p of e.participants) shares[p] = e.amount * ((e.percents[p] || 0) / 100);
    } else if (e.split === 'shares') {
      const totalShares = Object.values(e.shares).reduce((s, n) => s + n, 0);
      for (const p of e.participants) shares[p] = e.amount * ((e.shares[p] || 0) / totalShares);
    } else {
      for (const p of e.participants) shares[p] = e.amount / e.participants.length;
    }
    for (const [p, v] of Object.entries(shares)) {
      if (totals[p]) totals[p].share += v;
    }
  }

  const perHead = total / group.members.length;
  const sortedCats = Object.entries(byCat).sort(([, a], [, b]) => b - a);
  const catColor = (cat) => ({
    Lodging: '#8B5E83', Food: '#D97757', Transport: '#3D6B7A',
    Rent: '#5E7A3F', Utilities: '#B7864A', Home: '#7A5C3D',
  }[cat] || SS.muted);
  const sortedMembers = [...group.members].sort((a, b) => totals[b].paid - totals[a].paid);

  return (
    <div style={{ padding: '8px 0 0' }}>
      {/* Totals hero */}
      <div style={{ padding: '0 20px' }}>
        <div style={{
          background: SS.surface, border: `1px solid ${SS.hairline}`, borderRadius: 20,
          padding: '18px 20px', display: 'flex', gap: 14,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Geist, system-ui', fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: SS.muted, whiteSpace: 'nowrap' }}>
              Total spent
            </div>
            <div style={{ marginTop: 4 }}>
              <Money amount={total} currency={group.currency} size={30} italic />
            </div>
          </div>
          <div style={{ width: 1, background: SS.hairline }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Geist, system-ui', fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: SS.muted, whiteSpace: 'nowrap' }}>
              Per head
            </div>
            <div style={{ marginTop: 4 }}>
              <Money amount={perHead} currency={group.currency} size={30} italic color={SS.ink2} />
            </div>
          </div>
        </div>
      </div>

      {/* By category */}
      <SectionLabel>By category</SectionLabel>
      <div style={{ padding: '0 12px' }}>
        <div style={{ background: SS.surface, borderRadius: 16, border: `1px solid ${SS.hairline}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Stacked bar */}
          <div style={{
            height: 12, borderRadius: 999, background: SS.surfaceAlt, display: 'flex', overflow: 'hidden',
          }}>
            {sortedCats.map(([cat, amt]) => (
              <div key={cat} title={cat} style={{
                width: `${(amt / total) * 100}%`, background: catColor(cat),
              }} />
            ))}
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedCats.map(([cat, amt]) => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: catColor(cat), flexShrink: 0 }} />
                <div style={{ flex: 1, fontFamily: 'Geist, system-ui', fontSize: 13.5, color: SS.ink, fontWeight: 500 }}>{cat}</div>
                <div style={{ fontFamily: 'Geist, system-ui', fontSize: 12, color: SS.muted }}>
                  {((amt / total) * 100).toFixed(0)}%
                </div>
                <Money amount={amt} currency={group.currency} size={13.5} weight={600} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* By person */}
      <SectionLabel>By person</SectionLabel>
      <div style={{ padding: '0 12px' }}>
        <div style={{ background: SS.surface, borderRadius: 16, border: `1px solid ${SS.hairline}`, padding: '4px 14px' }}>
          {sortedMembers.map((id, i) => {
            const p = people[id];
            const t = totals[id];
            const net = t.paid - t.share;
            const maxOfPair = Math.max(t.paid, t.share, 1);
            return (
              <div key={id} style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 8, borderTop: i === 0 ? 'none' : `1px solid ${SS.hairlineSoft}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar person={p} size={28} />
                  <div style={{
                    flex: 1, fontFamily: 'Geist, system-ui', fontSize: 14, fontWeight: 600, color: SS.ink, letterSpacing: -0.1,
                  }}>{id === 'me' ? 'You' : p.name}</div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontFamily: 'Geist, system-ui', fontSize: 11, fontWeight: 600,
                    letterSpacing: 0.7, textTransform: 'uppercase', whiteSpace: 'nowrap',
                    color: net > 0 ? SS.positive : net < 0 ? SS.negative : SS.muted,
                  }}>
                    <span>{net > 0 ? 'net +' : net < 0 ? 'net −' : '±'}</span>
                    <Money amount={Math.abs(net)} currency={group.currency} size={12} weight={600}
                      color={net > 0 ? SS.positive : net < 0 ? SS.negative : SS.muted} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingLeft: 38 }}>
                  <BarRow label="paid" amount={t.paid} pct={(t.paid / maxOfPair) * 100} currency={group.currency} color={p.color} />
                  <BarRow label="used" amount={t.share} pct={(t.share / maxOfPair) * 100} currency={group.currency} color={p.color} outline />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}

function BarRow({ label, amount, pct, currency, color, outline }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 32, fontFamily: 'Geist, system-ui', fontSize: 10, fontWeight: 600,
        letterSpacing: 0.7, textTransform: 'uppercase', color: SS.muted,
      }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: SS.surfaceAlt, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.max(2, pct)}%`, height: '100%',
          background: outline ? 'transparent' : color,
          border: outline ? `1.5px solid ${color}` : 'none',
          borderRadius: 999, boxSizing: 'border-box',
        }} />
      </div>
      <div style={{ minWidth: 60, textAlign: 'right' }}>
        <Money amount={amount} currency={currency} size={12} weight={500} color={SS.ink2} />
      </div>
    </div>
  );
}

window.GroupScreen = GroupScreen;
