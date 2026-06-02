// Join screen — the page invitees land on when they tap a deep link.

function JoinScreen({ goBack, navigate, onSignIn }) {
  const group = window.DATA.groups.find(g => g.id === 'kyoto'); // demo
  const inviter = window.DATA.people.alex;
  const [stage, setStage] = React.useState('landing'); // landing | signing | verifying | joined

  const handleSignIn = () => {
    setStage('signing');
    // Kick off the real Google sign-in too (no-op if user already signed in).
    if (onSignIn) {
      try { onSignIn({ anchorEl: document.getElementById('__google_anchor_join') }); }
      catch (e) { /* ignore */ }
    }
    setTimeout(() => {
      setStage('verifying');
      setTimeout(() => setStage('joined'), 1400);
    }, 1100);
  };

  return (
    <Screen scroll={false} style={{ display: 'flex', flexDirection: 'column' }}>
      <Header
        leading={<IconBtn name="close" onClick={goBack} />}
        title="SplitSplit"
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px' }}>
        {stage === 'landing' && <Landing group={group} inviter={inviter} onSignIn={handleSignIn} />}
        {stage === 'signing' && <SigningIn />}
        {stage === 'verifying' && <Verifying group={group} />}
        {stage === 'joined' && <Joined group={group} onEnter={() => { goBack(); navigate({ screen: 'group', id: group.id }); }} />}
      </div>
    </Screen>
  );
}

function Landing({ group, inviter, onSignIn }) {
  const people = window.DATA.people;
  const handleClick = () => onSignIn({ anchorEl: document.getElementById('__google_anchor_join') });
  return (
    <>
      {/* Invite envelope */}
      <div style={{ padding: '20px 0 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ position: 'relative' }}>
          <Avatar person={inviter} size={56} />
          <div style={{
            position: 'absolute', bottom: -4, right: -4, width: 24, height: 24,
            borderRadius: 999, background: SS.accent, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${SS.bg}`,
          }}>
            <Icon name="send" size={11} color="#fff" stroke={2.4} />
          </div>
        </div>
        <div style={{ fontFamily: 'Geist, system-ui', fontSize: 13.5, color: SS.muted, textAlign: 'center' }}>
          <b style={{ color: SS.ink, fontWeight: 600 }}>{inviter.name}</b> invited you to
        </div>
      </div>

      {/* Group card */}
      <div style={{
        background: group.cover, borderRadius: 24, padding: '24px 22px',
        color: '#fff', display: 'flex', flexDirection: 'column', gap: 16,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', right: -12, top: -12, fontSize: 140, opacity: 0.18,
        }}>{group.emoji}</div>
        <div>
          <div style={{ fontFamily: 'Geist, system-ui', fontSize: 11, fontWeight: 600, letterSpacing: 1.3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>Group invite</div>
          <div style={{
            fontFamily: 'Geist, system-ui', fontSize: 30, fontWeight: 600,
            letterSpacing: -0.6, marginTop: 4,
          }}>{group.name}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.22)' }}>
          <AvatarStack ids={group.members.filter(m => m !== 'me')} size={26} max={5} people={people} />
          <div style={{ fontFamily: 'Geist, system-ui', fontSize: 13, color: 'rgba(255,255,255,0.92)' }}>
            {group.members.length} people · {group.currency}
          </div>
        </div>
      </div>

      {/* Pitch */}
      <div style={{
        marginTop: 18, padding: '14px 16px',
        background: SS.surface, border: `1px solid ${SS.hairline}`, borderRadius: 18,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <PitchRow icon="wallet" title="Free forever" sub="No ads, no premium tier." />
        <PitchRow icon="lock" title="Your data stays in your Drive" sub="The group's data is a sheet you can open anytime." />
        <PitchRow icon="globe" title="Works with any currency" sub="This group tracks in {ccy}." replacements={{ ccy: group.currency }} />
      </div>

      <div style={{ height: 24 }} />

      <button onClick={handleClick} style={{
        height: 56, width: '100%', borderRadius: 16, background: SS.ink, color: '#FCFAF5',
        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 12, fontFamily: 'Geist, system-ui', fontSize: 16, fontWeight: 600,
        cursor: 'pointer', boxShadow: '0 6px 16px rgba(31,27,22,0.18)',
      }}>
        <GoogleG size={20} />
        Continue with Google
      </button>
      <div id="__google_anchor_join" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
      <div style={{
        marginTop: 12, padding: '0 16px', textAlign: 'center',
        fontFamily: 'Geist, system-ui', fontSize: 11.5, color: SS.muted, lineHeight: 1.5,
      }}>
        Sign in with the email <b>{inviter.name.split(' ')[0]}</b> invited. We'll verify you have access to the group's data.
      </div>

      <div style={{ height: 32 }} />
    </>
  );
}

function PitchRow({ icon, title, sub, replacements = {} }) {
  let resolved = sub;
  for (const [k, v] of Object.entries(replacements)) resolved = resolved.replace(`{${k}}`, v);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, background: SS.surfaceAlt,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon name={icon} size={16} color={SS.accentInk} />
      </div>
      <div>
        <div style={{ fontFamily: 'Geist, system-ui', fontSize: 14, fontWeight: 600, color: SS.ink, letterSpacing: -0.1 }}>{title}</div>
        <div style={{ fontFamily: 'Geist, system-ui', fontSize: 12.5, color: SS.muted, marginTop: 1 }}>{resolved}</div>
      </div>
    </div>
  );
}

function SigningIn() {
  return (
    <div style={{ padding: '80px 0 0', textAlign: 'center' }}>
      <Spinner />
      <div style={{
        marginTop: 22, fontFamily: 'Geist, system-ui', fontSize: 16, fontWeight: 600, color: SS.ink, letterSpacing: -0.2,
      }}>Signing you in with Google</div>
      <div style={{
        marginTop: 4, fontFamily: 'Geist, system-ui', fontSize: 12.5, color: SS.muted,
      }}>One second…</div>
    </div>
  );
}

function Verifying({ group }) {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 380);
    return () => clearInterval(i);
  }, []);
  const steps = [
    'Found your Google account',
    `Checking access to ${group.name}'s data`,
    'You\'re on the editor list',
  ];
  return (
    <div style={{ padding: '60px 0 0', textAlign: 'center' }}>
      <Spinner />
      <div style={{
        marginTop: 22, fontFamily: 'Geist, system-ui', fontSize: 16, fontWeight: 600, color: SS.ink, letterSpacing: -0.2,
      }}>Verifying access</div>

      <div style={{
        marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12,
        maxWidth: 280, margin: '28px auto 0',
      }}>
        {steps.map((s, i) => {
          const done = i < Math.min(tick, steps.length);
          const inProgress = i === Math.min(tick, steps.length - 1) && !done;
          return (
            <div key={s} style={{
              display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
              opacity: done || inProgress ? 1 : 0.4,
              transition: 'opacity .2s',
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: 999,
                background: done ? SS.positive : 'transparent',
                border: done ? 'none' : `1.5px solid ${SS.hairline}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {done && <Icon name="check" size={11} color="#fff" stroke={3} />}
              </div>
              <div style={{ fontFamily: 'Geist, system-ui', fontSize: 13.5, color: SS.ink2 }}>{s}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Joined({ group, onEnter }) {
  return (
    <div style={{ padding: '40px 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', width: 90, height: 90 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 26, background: group.cover,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44,
          transform: 'rotate(-4deg)',
        }}>{group.emoji}</div>
        <div style={{
          position: 'absolute', bottom: -6, right: -6, width: 32, height: 32,
          borderRadius: 999, background: SS.positive, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `3px solid ${SS.bg}`,
        }}>
          <Icon name="check" size={16} color="#fff" stroke={3} />
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'Geist, system-ui', fontSize: 24, fontWeight: 600, color: SS.ink, letterSpacing: -0.4,
        }}>You're in.</div>
        <div style={{
          marginTop: 6, fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: 'italic',
          fontSize: 18, color: SS.muted,
        }}>welcome to {group.name}.</div>
      </div>
      <div style={{ height: 8 }} />
      <Button variant="accent" size="lg" fullWidth onClick={onEnter}>Open group</Button>
    </div>
  );
}

window.JoinScreen = JoinScreen;
