// Home screen — your overall balance + list of groups.

function HomeScreen({ tweaks, navigate, user }) {
  const { groups, friends, people } = window.DATA;
  const greetingName = (user?.givenName) || 'Sam';

  // Personal net balance in display currency
  const displayCcy = tweaks.displayCurrency;
  const netInDisplay = React.useMemo(() => {
    let total = 0;
    for (const f of friends) {
      total += window.CCY.convert(f.balance, f.currency, displayCcy);
    }
    return total;
  }, [displayCcy]);

  const owed = friends.filter(f => f.balance > 0);
  const owes = friends.filter(f => f.balance < 0);
  const owedSum = owed.reduce((s, f) => s + window.CCY.convert(f.balance, f.currency, displayCcy), 0);
  const owesSum = Math.abs(owes.reduce((s, f) => s + window.CCY.convert(f.balance, f.currency, displayCcy), 0));

  return (
    <Screen>
      <Header
        leading={<div style={{
          width: 32, height: 32, borderRadius: 12,
          background: SS.ink, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontFamily: '"Instrument Serif", serif', fontStyle: 'italic',
          fontSize: 22, lineHeight: 1, paddingBottom: 3,
        }}>$</div>}
        title="Groups"
        sub={`Hello, ${greetingName}`}
        large
        trailing={<IconBtn name="search" onClick={() => {}} />}
      />

      {/* Balance hero */}
      <div style={{ padding: '4px 20px 20px' }}>
        <div style={{
          background: SS.ink, color: '#FCFAF5', borderRadius: 22,
          padding: '20px 22px', position: 'relative', overflow: 'hidden',
        }}>
          {/* decorative dollar */}
          <div style={{
            position: 'absolute', right: -14, bottom: -28, fontSize: 180, lineHeight: 1,
            fontFamily: '"Instrument Serif", serif', fontStyle: 'italic',
            color: 'rgba(255,255,255,0.05)', pointerEvents: 'none',
          }}>$</div>

          <div style={{
            fontFamily: 'Geist, system-ui', fontSize: 11.5, fontWeight: 600,
            letterSpacing: 1.4, textTransform: 'uppercase', color: '#FCFAF599',
          }}>
            {netInDisplay >= 0 ? 'You are net owed' : 'You owe net'}
          </div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <Money
              amount={Math.abs(netInDisplay)}
              currency={displayCcy}
              size={44} italic
              color={netInDisplay >= 0 ? '#C7E2A1' : '#F2B19F'}
            />
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: '#FCFAF599' }}>You're owed</div>
              <div style={{ marginTop: 2 }}>
                <Money amount={owedSum} currency={displayCcy} size={18} color="#C7E2A1" />
              </div>
            </div>
            <div style={{ flex: 1, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: '#FCFAF599' }}>You owe</div>
              <div style={{ marginTop: 2 }}>
                <Money amount={owesSum} currency={displayCcy} size={18} color="#F2B19F" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <SectionLabel action="New group" onAction={() => navigate({ screen: 'newGroup' })}>Your groups</SectionLabel>

      <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {groups.map(g => <GroupCard key={g.id} group={g} people={people} onClick={() => navigate({ screen: 'group', id: g.id })} />)}
      </div>

      <SectionLabel>Quick actions</SectionLabel>
      <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <QuickAction icon="send" label="Settle up" sub="With anyone" onClick={() => navigate({ screen: 'settle' })} />
        <QuickAction icon="people" label="Invite friends" sub="Share a link" onClick={() => navigate({ screen: 'invite' })} />
      </div>

      <div style={{ height: 24 }} />
    </Screen>
  );
}

function GroupCard({ group, people, onClick }) {
  const balance = group.youAreOwed - group.youOwe;
  const balanceCol = balance > 0 ? SS.positive : balance < 0 ? SS.negative : SS.muted;
  return (
    <div onClick={onClick} style={{
      background: SS.surface, borderRadius: 18, padding: '14px 14px 14px 14px',
      display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
      border: `1px solid ${SS.hairline}`,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: group.cover,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, flexShrink: 0,
      }}>{group.emoji}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{
            fontFamily: 'Geist, system-ui', fontSize: 16.5, fontWeight: 600,
            color: SS.ink, letterSpacing: -0.2, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{group.name}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <AvatarStack ids={group.members} size={20} max={4} people={people} />
          <div style={{
            fontFamily: 'Geist, system-ui', fontSize: 12, color: SS.muted,
          }}>{group.members.length} people · {group.currency}</div>
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {balance === 0 ? (
          <div style={{ fontFamily: 'Geist, system-ui', fontSize: 12, color: SS.muted }}>settled up</div>
        ) : (
          <>
            <div style={{
              fontFamily: 'Geist, system-ui', fontSize: 10.5, fontWeight: 600,
              letterSpacing: 0.9, textTransform: 'uppercase', color: SS.muted,
              whiteSpace: 'nowrap',
            }}>{balance > 0 ? 'You get' : 'You owe'}</div>
            <div style={{ marginTop: 2 }}>
              <Money amount={Math.abs(balance)} currency={group.currency} size={16} weight={600} color={balanceCol} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function QuickAction({ icon, label, sub, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: SS.surface, border: `1px solid ${SS.hairline}`,
      borderRadius: 16, padding: '14px 14px', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 8, minHeight: 92,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 12, background: SS.surfaceAlt,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={18} color={SS.accentInk} />
      </div>
      <div>
        <div style={{ fontFamily: 'Geist, system-ui', fontSize: 14.5, fontWeight: 600, color: SS.ink, letterSpacing: -0.1 }}>{label}</div>
        <div style={{ fontFamily: 'Geist, system-ui', fontSize: 12, color: SS.muted, marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  );
}

window.HomeScreen = HomeScreen;
