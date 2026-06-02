// Friends list — single contact aggregated across groups.

function FriendsScreen({ store, navigate, tweaks }) {
  const { friends, people } = store.getSnapshot();
  const display = tweaks.displayCurrency;

  const owedToMe = friends.filter(f => f.balance > 0).sort((a, b) =>
    window.CCY.convert(b.balance, b.currency, display) - window.CCY.convert(a.balance, a.currency, display));
  const iOwe = friends.filter(f => f.balance < 0).sort((a, b) =>
    window.CCY.convert(a.balance, a.currency, display) - window.CCY.convert(b.balance, b.currency, display));

  return (
    <Screen>
      <Header
        leading={null}
        title="Friends"
        sub="People & balances"
        large
        trailing={<IconBtn name="plus" onClick={() => navigate({ screen: 'invite' })} />}
      />

      {friends.length === 0 && Object.keys(people).length <= 1 && (
        <EmptyState emoji="👋" title="No friends yet" sub="Invite people to a group — they'll show up here with running balances." cta="Invite friends" onCta={() => navigate({ screen: 'invite' })} />
      )}

      {owedToMe.length > 0 && (
        <>
          <SectionLabel>Owed to you</SectionLabel>
          <div style={{ padding: '0 12px' }}>
            <div style={{ background: SS.surface, borderRadius: 16, border: `1px solid ${SS.hairline}`, overflow: 'hidden' }}>
              {owedToMe.map((f, i) => {
                const p = people[f.id];
                return (
                  <React.Fragment key={f.id}>
                    {i > 0 && <HR inset={62} />}
                    <Row
                      left={<Avatar person={p} size={42} />}
                      title={p.name}
                      sub="owes you"
                      right={<Money amount={f.balance} currency={f.currency} size={16} weight={600} color={SS.positive} />}
                      onClick={() => navigate({ screen: 'friend', friendId: f.id })}
                    />
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </>
      )}

      {iOwe.length > 0 && (
        <>
          <SectionLabel>You owe</SectionLabel>
          <div style={{ padding: '0 12px' }}>
            <div style={{ background: SS.surface, borderRadius: 16, border: `1px solid ${SS.hairline}`, overflow: 'hidden' }}>
              {iOwe.map((f, i) => {
                const p = people[f.id];
                return (
                  <React.Fragment key={f.id}>
                    {i > 0 && <HR inset={62} />}
                    <Row
                      left={<Avatar person={p} size={42} />}
                      title={p.name}
                      sub="you owe"
                      right={<Money amount={Math.abs(f.balance)} currency={f.currency} size={16} weight={600} color={SS.negative} />}
                      onClick={() => navigate({ screen: 'friend', friendId: f.id })}
                    />
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </>
      )}

      <SectionLabel>All contacts</SectionLabel>
      <div style={{ padding: '0 12px 20px' }}>
        <div style={{ background: SS.surface, borderRadius: 16, border: `1px solid ${SS.hairline}`, overflow: 'hidden' }}>
          {Object.values(people).filter(p => p.id !== 'me').map((p, i, arr) => {
            const f = friends.find(x => x.id === p.id);
            const isSettled = !f || f.balance === 0;
            return (
              <React.Fragment key={p.id}>
                {i > 0 && <HR inset={62} />}
                <Row
                  left={<Avatar person={p} size={42} />}
                  title={p.name}
                  sub={isSettled ? 'settled up' : (f.balance > 0 ? 'owes you' : 'you owe')}
                  right={isSettled
                    ? <span style={{ fontFamily: 'Geist, system-ui', fontSize: 13, color: SS.muted }}>—</span>
                    : <Money amount={Math.abs(f.balance)} currency={f.currency} size={15} weight={600} color={f.balance > 0 ? SS.positive : SS.negative} />}
                  onClick={() => navigate({ screen: 'friend', friendId: p.id })}
                />
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div style={{ height: 24 }} />
    </Screen>
  );
}

window.FriendsScreen = FriendsScreen;
