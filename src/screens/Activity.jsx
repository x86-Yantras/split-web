// Activity feed.

function ActivityScreen({ store, navigate }) {
  const { people, groups } = store.getSnapshot();
  const activity = store.allActivity();
  const groupBy = id => groups.find(g => g.id === id);

  return (
    <Screen>
      <Header title="Activity" sub="Across all groups" large trailing={<IconBtn name="bell" onClick={() => {}} />} />

      {activity.length === 0 ? (
        <EmptyState emoji="📭" title="Nothing yet" sub="Expenses, payments and comments across your groups will appear here." />
      ) : (
      <div style={{ padding: '0 12px' }}>
        <div style={{ background: SS.surface, borderRadius: 18, border: `1px solid ${SS.hairline}`, overflow: 'hidden' }}>
          {activity.map((a, i) => {
            const who = people[a.who] || { name: a.who, initials: '?', color: SS.muted };
            const grp = groupBy(a.group);
            return (
              <React.Fragment key={a.id}>
                {i > 0 && <HR inset={62} />}
                <div onClick={() => grp && navigate({ screen: 'group', id: grp.id })} style={{
                  display: 'flex', gap: 12, padding: '14px 16px', cursor: 'pointer',
                }}>
                  <Avatar person={who} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Geist, system-ui', fontSize: 14.5, color: SS.ink, lineHeight: 1.4 }}>
                      {a.type === 'expense' && (
                        <>
                          <b style={{ fontWeight: 600 }}>{a.who === 'me' ? 'You' : who.name.split(' ')[0]}</b>
                          {' added '}
                          <b style={{ fontWeight: 600 }}>{a.desc}</b>
                          {' in '}
                          <span style={{ color: SS.muted }}>{grp ? grp.name : ''}</span>
                        </>
                      )}
                      {a.type === 'payment' && (
                        <>
                          <b style={{ fontWeight: 600 }}>{who.name.split(' ')[0]}</b>{' '}
                          {a.desc}{' '}
                          <Money amount={a.amount} currency={a.currency} size={14.5} weight={600} color={SS.positive} />
                        </>
                      )}
                      {a.type === 'comment' && (
                        <>
                          <b style={{ fontWeight: 600 }}>{who.name.split(' ')[0]}</b>
                          {' commented '}{a.desc}
                        </>
                      )}
                      {a.type === 'group' && (
                        <>
                          <b style={{ fontWeight: 600 }}>{a.who === 'me' ? 'You' : who.name.split(' ')[0]}</b>
                          {' '}{a.desc}
                        </>
                      )}
                    </div>

                    {a.type === 'expense' && (
                      <div style={{ marginTop: 4, fontFamily: 'Geist, system-ui', fontSize: 12.5, color: SS.muted }}>
                        {a.you === 'owe' ? 'You owe ' : 'You lent '}
                        <Money amount={a.share} currency={a.currency} size={12.5} weight={600}
                          color={a.you === 'owe' ? SS.negative : SS.positive} />
                        {' · '}<Money amount={a.amount} currency={a.currency} size={12.5} weight={500} color={SS.muted} /> total
                      </div>
                    )}

                    {a.type === 'comment' && (
                      <div style={{
                        marginTop: 6, padding: '8px 12px', background: SS.surfaceAlt,
                        borderRadius: 12, borderTopLeftRadius: 4,
                        fontFamily: 'Geist, system-ui', fontSize: 13, color: SS.ink2,
                      }}>{a.text}</div>
                    )}

                    <div style={{ marginTop: 4, fontFamily: 'Geist, system-ui', fontSize: 11.5, color: SS.muted }}>{a.when}</div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
      )}

      <div style={{ height: 32 }} />
    </Screen>
  );
}

window.ActivityScreen = ActivityScreen;
