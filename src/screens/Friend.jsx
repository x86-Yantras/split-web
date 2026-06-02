// Friend detail — shared expenses across groups with one person.

function FriendScreen({ friendId, goBack, navigate }) {
  const { people, friends, expenses, groups } = window.DATA;
  const p = people[friendId];
  const f = friends.find(x => x.id === friendId);
  if (!p) return null;

  const balance = f ? f.balance : 0;
  const currency = f ? f.currency : 'USD';

  // Collect expenses across all groups that include this friend and me
  const items = [];
  for (const g of groups) {
    if (!g.members.includes(friendId) || !g.members.includes('me')) continue;
    for (const e of (expenses[g.id] || [])) {
      if (!e.participants.includes(friendId) && e.paidBy !== friendId) continue;
      if (!e.participants.includes('me') && e.paidBy !== 'me') continue;
      items.push({ ...e, groupName: g.name, groupEmoji: g.emoji, groupCover: g.cover, groupId: g.id });
    }
  }
  items.sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Screen>
      <Header
        leading={<IconBtn name="chevL" onClick={goBack} />}
        title={p.name.split(' ')[0]}
        trailing={<IconBtn name="more" onClick={() => {}} />}
      />

      {/* Hero */}
      <div style={{ padding: '4px 20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <Avatar person={p} size={80} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Geist, system-ui', fontSize: 20, fontWeight: 600, color: SS.ink, letterSpacing: -0.3 }}>{p.name}</div>
          <div style={{ fontFamily: 'Geist, system-ui', fontSize: 12.5, color: SS.muted, marginTop: 2 }}>{groups.filter(g => g.members.includes(friendId)).length} shared groups</div>
        </div>

        {balance !== 0 ? (
          <div style={{
            background: balance > 0 ? '#EFF4E6' : '#FBE9E2',
            border: `1px solid ${balance > 0 ? '#D5E2BC' : '#F0CFC2'}`,
            borderRadius: 18, padding: '14px 18px', width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontFamily: 'Geist, system-ui', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: balance > 0 ? SS.positive : SS.negative }}>
                {balance > 0 ? `${p.name.split(' ')[0]} owes you` : `You owe ${p.name.split(' ')[0]}`}
              </div>
              <div style={{ marginTop: 4 }}>
                <Money amount={Math.abs(balance)} currency={currency} size={28} italic color={balance > 0 ? SS.positive : SS.negative} />
              </div>
            </div>
            <Button variant={balance > 0 ? 'ghost' : 'accent'} icon="send" onClick={() => navigate({ screen: 'settle', friendId })}>
              {balance > 0 ? 'Remind' : 'Settle up'}
            </Button>
          </div>
        ) : (
          <div style={{ fontFamily: 'Geist, system-ui', fontSize: 13, color: SS.muted }}>All settled up ✨</div>
        )}
      </div>

      <SectionLabel>Shared history</SectionLabel>
      <div style={{ padding: '0 12px' }}>
        <div style={{ background: SS.surface, borderRadius: 16, border: `1px solid ${SS.hairline}`, overflow: 'hidden' }}>
          {items.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: SS.muted, fontFamily: 'Geist, system-ui', fontSize: 14 }}>
              No shared expenses yet.
            </div>
          )}
          {items.map((e, i) => {
            const payerIsMe = e.paidBy === 'me';
            const partCount = e.participants.length;
            const share = e.split === 'percent' ? e.amount * ((e.percents.me || 0) / 100)
              : e.split === 'shares' ? e.amount * ((e.shares.me || 0) / Object.values(e.shares).reduce((s, n) => s + n, 0))
              : e.amount / partCount;
            const impact = payerIsMe ? e.amount - share : -share;
            return (
              <React.Fragment key={e.id + i}>
                {i > 0 && <HR inset={62} />}
                <Row
                  left={<div style={{ width: 42, height: 42, borderRadius: 12, background: e.groupCover, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{e.emoji}</div>}
                  title={e.desc}
                  sub={`${e.groupName} · ${payerIsMe ? 'You' : people[e.paidBy].name.split(' ')[0]} paid`}
                  right={
                    <div style={{ textAlign: 'right' }}>
                      <Money amount={Math.abs(impact)} currency={e.currency} size={14} weight={600}
                        color={impact > 0 ? SS.positive : impact < 0 ? SS.negative : SS.muted} />
                      <div style={{ fontFamily: 'Geist, system-ui', fontSize: 11, color: SS.muted, marginTop: 2 }}>
                        {impact > 0 ? 'you lent' : impact < 0 ? 'you owe' : ''}
                      </div>
                    </div>
                  }
                />
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div style={{ height: 32 }} />
    </Screen>
  );
}

window.FriendScreen = FriendScreen;
