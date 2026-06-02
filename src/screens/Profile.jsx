// Profile / account.

function ProfileScreen({ store, onSignOut, tweaks, setTweak, user }) {
  const fallback = store.getSnapshot().me;
  const name = user?.name || 'Sam Park';
  const email = user?.email || 'sam.park@gmail.com';
  const initials = (user?.givenName?.[0] || 'S').toUpperCase();
  return (
    <Screen>
      <Header title="You" sub="Account" large />

      {/* Identity */}
      <div style={{ padding: '4px 20px 16px' }}>
        <div style={{
          background: SS.surface, borderRadius: 20, border: `1px solid ${SS.hairline}`,
          padding: '20px', display: 'flex', alignItems: 'center', gap: 14,
        }}>
          {user?.picture ? (
            <img src={user.picture} alt="" referrerPolicy="no-referrer" style={{
              width: 56, height: 56, borderRadius: 999, objectFit: 'cover',
              background: SS.surfaceAlt, flexShrink: 0,
            }} />
          ) : (
            <Avatar person={{ ...fallback, color: SS.accent, initials }} size={56} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Geist, system-ui', fontSize: 17, fontWeight: 600, color: SS.ink, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
            <div style={{ fontFamily: 'Geist, system-ui', fontSize: 12.5, color: SS.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>
          </div>
          {user && (
            <div style={{
              padding: '4px 8px', borderRadius: 999, background: '#EFF4E6',
              border: `1px solid #D5E2BC`, fontFamily: 'Geist, system-ui',
              fontSize: 10.5, fontWeight: 600, color: SS.positive, letterSpacing: 0.4, textTransform: 'uppercase',
            }}>Connected</div>
          )}
        </div>
      </div>

      <SectionLabel>Preferences</SectionLabel>
      <div style={{ padding: '0 12px' }}>
        <div style={{ background: SS.surface, borderRadius: 16, border: `1px solid ${SS.hairline}`, overflow: 'hidden' }}>
          <Row
            left={<div style={{ width: 36, height: 36, borderRadius: 10, background: SS.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="globe" size={18} color={SS.accentInk} /></div>}
            title="Display currency"
            sub="Used for your overall balance"
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontFamily: 'Geist, system-ui', fontSize: 14, fontWeight: 600, color: SS.ink }}>{tweaks.displayCurrency}</span>
                <Icon name="chev" size={16} color={SS.muted} />
              </div>
            }
            onClick={() => {
              const codes = window.CCY.codes;
              const i = codes.indexOf(tweaks.displayCurrency);
              setTweak('displayCurrency', codes[(i + 1) % codes.length]);
            }}
          />
          <HR inset={56} />
          <Row
            left={<div style={{ width: 36, height: 36, borderRadius: 10, background: SS.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="bell" size={18} color={SS.accentInk} /></div>}
            title="Notifications"
            sub="Expenses, settle-up reminders"
            right={<Toggle on={tweaks.notifications} onChange={v => setTweak('notifications', v)} />}
          />
          <HR inset={56} />
          <Row
            left={<div style={{ width: 36, height: 36, borderRadius: 10, background: SS.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="lock" size={18} color={SS.accentInk} /></div>}
            title="Privacy & data"
            sub="Backed by your Google account"
            right={<Icon name="chev" size={16} color={SS.muted} />}
            onClick={() => {}}
          />
        </div>
      </div>

      <SectionLabel>About</SectionLabel>
      <div style={{ padding: '0 12px' }}>
        <div style={{ background: SS.surface, borderRadius: 16, border: `1px solid ${SS.hairline}`, overflow: 'hidden' }}>
          <Row title="Help & FAQs" right={<Icon name="chev" size={16} color={SS.muted} />} onClick={() => {}} />
          <HR inset={20} />
          <Row title="Send feedback" right={<Icon name="chev" size={16} color={SS.muted} />} onClick={() => {}} />
          <HR inset={20} />
          <Row title="Version 1.0.0 · SplitSplit" right={<span style={{ fontFamily: 'Geist, system-ui', fontSize: 12, color: SS.muted }}>Free forever</span>} />
        </div>
      </div>

      <div style={{ padding: '20px 20px 32px' }}>
        <Button variant="ghost" fullWidth onClick={onSignOut}>Sign out</Button>
      </div>
    </Screen>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: 44, height: 26, borderRadius: 999, padding: 2,
      background: on ? SS.accent : SS.hairline, border: 'none',
      display: 'flex', alignItems: 'center', justifyContent: on ? 'flex-end' : 'flex-start',
      cursor: 'pointer', transition: 'background .15s',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 999, background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)', transition: 'transform .15s',
      }} />
    </button>
  );
}

window.ProfileScreen = ProfileScreen;
