// Main App — navigation stack & tweaks integration.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "displayCurrency": "USD",
  "notifications": true
}/*EDITMODE-END*/;

function App() {
  const [user, setUser] = React.useState(() => window.SSAuth?.getUser() || null);
  const signedIn = !!user;
  const [tab, setTab] = React.useState('home');
  const [stack, setStack] = React.useState([]); // pushed screens above tab
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  const store = window.useStore();

  // Subscribe to auth changes; (re)build the store when the user changes.
  React.useEffect(() => {
    if (!window.SSAuth) return;
    return window.SSAuth.onChange((u) => { window.SSResetStore(); setUser(u); });
  }, []);

  // Hydrate (or seed) the store once signed in.
  React.useEffect(() => {
    if (!signedIn) return;
    const s = window.SSGetStore();
    s.hydrate().then(() => { if (!s.getSnapshot().groups.length) window.SSSeedFromMock(s); })
      .catch(() => window.SSSeedFromMock(s));
  }, [signedIn]);

  const handleSignIn = (opts) => window.SSAuth?.signIn(opts);
  const handleSignOut = () => { window.SSAuth?.signOut(); setStack([]); setTab('home'); };

  const navigate = (entry) => setStack(s => [...s, entry]);
  const goBack = () => setStack(s => s.slice(0, -1));

  // Demo hook for previewing the deep-link landing.
  React.useEffect(() => {
    window.__previewJoin = () => { setStack([{ screen: 'join' }]); };
  }, []);

  const top = stack[stack.length - 1];

  let inner;
  if (!signedIn) {
    inner = <SignInScreen onSignIn={handleSignIn} />;
  } else if (top) {
    if (top.screen === 'group') inner = <GroupScreen store={store} groupId={top.id} navigate={navigate} goBack={goBack} />;
    else if (top.screen === 'addExpense') inner = <AddExpenseScreen store={store} groupId={top.groupId} goBack={goBack} navigate={navigate} />;
    else if (top.screen === 'settle') inner = <SettleScreen store={store} friendId={top.friendId} groupId={top.groupId} goBack={goBack} />;
    else if (top.screen === 'friend') inner = <FriendScreen store={store} friendId={top.friendId} goBack={goBack} navigate={navigate} />;
    else if (top.screen === 'newGroup') inner = <NewGroupScreen store={store} goBack={goBack} navigate={navigate} />;
    else if (top.screen === 'invite') inner = <InviteScreen store={store} groupId={top.groupId} goBack={goBack} />;
    else if (top.screen === 'join') inner = <JoinScreen store={store} goBack={goBack} navigate={navigate} onSignIn={handleSignIn} />;
    else if (top.screen === 'expense') inner = <ExpenseScreen store={store} groupId={top.groupId} expenseId={top.expenseId} goBack={goBack} />;
    else inner = <div>Unknown screen</div>;
  } else {
    if (tab === 'home') inner = <HomeScreen store={store} tweaks={tweaks} navigate={navigate} user={user} />;
    else if (tab === 'friends') inner = <FriendsScreen store={store} tweaks={tweaks} navigate={navigate} />;
    else if (tab === 'activity') inner = <ActivityScreen store={store} navigate={navigate} />;
    else if (tab === 'profile') inner = <ProfileScreen store={store} onSignOut={handleSignOut} tweaks={tweaks} setTweak={setTweak} user={user} />;
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: SS.bg }}>
      <div style={{ height: 62, flexShrink: 0, background: SS.bg }} />
      <div style={{ flex: 1, minHeight: 0 }}>{inner}</div>
      {signedIn && !top && (
        <TabBar active={tab} onChange={setTab} onAdd={() => navigate({ screen: 'newGroup' })} />
      )}
      {signedIn && top && (
        <div style={{ height: 34, flexShrink: 0, background: SS.bg }} />
      )}

      {/* Tweaks panel */}
      <window.TweaksPanel title="Tweaks">
        <window.TweakSection label="Currency">
          <window.TweakSelect
            label="Display currency"
            value={tweaks.displayCurrency}
            options={window.CCY.codes.map(c => ({ value: c, label: `${c} (${window.CCY.symbols[c]})` }))}
            onChange={v => setTweak('displayCurrency', v)}
          />
        </window.TweakSection>
        <window.TweakSection label="Notifications">
          <window.TweakToggle
            label="Push reminders"
            value={tweaks.notifications}
            onChange={v => setTweak('notifications', v)}
          />
        </window.TweakSection>
        <window.TweakSection label="Demo">
          <window.TweakButton label="Sign out" onClick={handleSignOut} />
          <window.TweakButton label="Open invite-link landing" onClick={() => setStack([{ screen: 'join' }])} />
        </window.TweakSection>
      </window.TweaksPanel>
    </div>
  );
}

// New group screen — simple stub.
function NewGroupScreen({ store, goBack, navigate }) {
  const [name, setName] = React.useState('');
  const [emoji, setEmoji] = React.useState('🧳');
  const [currency, setCurrency] = React.useState('USD');
  const presets = ['🧳', '🏠', '⛩️', '🌊', '🍕', '🎉', '📚', '🎬', '⛰️', '🏝️'];
  const colors = [
    'linear-gradient(135deg, #E9B7A5 0%, #D97757 100%)',
    'linear-gradient(135deg, #C7CDA8 0%, #5E7A3F 100%)',
    'linear-gradient(135deg, #B9CFD8 0%, #3D6B7A 100%)',
    'linear-gradient(135deg, #D8C5B9 0%, #8B5E83 100%)',
    'linear-gradient(135deg, #E8D5A5 0%, #B7864A 100%)',
  ];
  const [cover, setCover] = React.useState(colors[0]);

  const [creating, setCreating] = React.useState(false);
  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const { id } = await store.createGroup({ name: name.trim(), emoji, cover, currency });
      goBack();
      navigate({ screen: 'group', id });
    } catch (e) {
      setCreating(false);
      alert('Could not create the group. Check your connection and try again.');
    }
  };

  return (
    <Screen scroll={false} style={{ display: 'flex', flexDirection: 'column' }}>
      <Header
        leading={<IconBtn name="close" onClick={goBack} />}
        title="New group"
        trailing={
          <button onClick={handleCreate} disabled={!name.trim() || creating} style={{
            background: 'none', border: 'none', cursor: name.trim() && !creating ? 'pointer' : 'default',
            color: name.trim() && !creating ? SS.accent : SS.muted,
            fontFamily: 'Geist, system-ui', fontSize: 15, fontWeight: 600, padding: 0,
          }}>{creating ? 'Creating…' : 'Create'}</button>
        }
      />
      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        {/* Cover preview */}
        <div style={{
          background: cover, borderRadius: 24, padding: 24, marginTop: 4,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          color: '#fff', textAlign: 'center',
        }}>
          <div style={{ fontSize: 56, lineHeight: 1 }}>{emoji}</div>
          <div style={{ fontFamily: 'Geist, system-ui', fontSize: 20, fontWeight: 600, letterSpacing: -0.3, minHeight: 26 }}>
            {name || 'Group name'}
          </div>
        </div>

        <SectionLabel>Name</SectionLabel>
        <div style={{ padding: '0 0' }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Roommates, Trip to Tokyo"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: SS.surface, border: `1px solid ${SS.hairline}`, borderRadius: 14,
              padding: '14px 16px', fontFamily: 'Geist, system-ui', fontSize: 15, color: SS.ink,
              outline: 'none',
            }} />
        </div>

        <SectionLabel>Icon</SectionLabel>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {presets.map(e => (
            <button key={e} onClick={() => setEmoji(e)} style={{
              width: 44, height: 44, borderRadius: 12, fontSize: 22,
              background: emoji === e ? SS.ink : SS.surface,
              border: emoji === e ? 'none' : `1px solid ${SS.hairline}`,
              cursor: 'pointer',
            }}>{e}</button>
          ))}
        </div>

        <SectionLabel>Color</SectionLabel>
        <div style={{ display: 'flex', gap: 10 }}>
          {colors.map((c, i) => (
            <button key={i} onClick={() => setCover(c)} style={{
              width: 44, height: 44, borderRadius: 12, background: c,
              border: cover === c ? `3px solid ${SS.ink}` : `1px solid ${SS.hairline}`,
              cursor: 'pointer',
            }} />
          ))}
        </div>

        <SectionLabel>Currency</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {window.CCY.codes.map(c => (
            <button key={c} onClick={() => setCurrency(c)} style={{
              padding: '8px 14px', borderRadius: 999,
              background: currency === c ? SS.ink : SS.surface,
              color: currency === c ? '#FCFAF5' : SS.ink,
              border: currency === c ? 'none' : `1px solid ${SS.hairline}`,
              fontFamily: 'Geist, system-ui', fontSize: 13.5, fontWeight: 600,
              cursor: 'pointer',
            }}>{c}</button>
          ))}
        </div>

        <SectionLabel>Members</SectionLabel>
        <div style={{ padding: '0 0 8px' }}>
          <div style={{ background: SS.surface, borderRadius: 16, border: `1px solid ${SS.hairline}`, overflow: 'hidden' }}>
            <Row left={<Avatar person={store.getSnapshot().me} size={38} />} title="You" sub="admin" right={null} />
            <HR inset={62} />
            <Row left={<div style={{
              width: 38, height: 38, borderRadius: 999, background: SS.surfaceAlt,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Icon name="plus" size={18} color={SS.muted} /></div>} title="Invite people" sub="Share a link or add by email"
              right={<Icon name="chev" size={16} color={SS.muted} />} onClick={() => {}} />
          </div>
        </div>

        <div style={{ height: 24 }} />
      </div>
    </Screen>
  );
}

window.App = App;
