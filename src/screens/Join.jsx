// Join screen — landing page for an invite deep link: /join/<groupId>?s=<sheetId>&t=<token>.
// Self-contained (own spinner + Google glyph) so it doesn't depend on helpers defined in
// other modules (which are module-local under the Vite/ESM build).

function JoinScreen({ store, joinLink, onSignIn, goBack, onEntered }) {
  const groupId = joinLink && joinLink.groupId;
  const sheetId = (joinLink && joinLink.sheetId) || (store.index && store.index[groupId]);

  const [stage, setStage] = React.useState('landing'); // landing | signing | verifying | joined | wrong | error
  const [errEmail, setErrEmail] = React.useState(null);

  // Group meta is only known after a successful join (we read the Sheet then).
  const known = store.getSnapshot().groups.find(g => g.id === groupId) || null;

  const verify = async () => {
    setStage('verifying');
    try {
      if (!groupId || !sheetId) { setStage('error'); return; }
      // Use the live instance — auth changes rebuild the store, and joinGroup needs the
      // signed-in user's email for the ACL check.
      const s = window.SSGetStore ? window.SSGetStore() : store;
      const res = await s.joinGroup(groupId, sheetId);
      if (res && res.ok) setStage('joined');
      else { setErrEmail(res && res.email); setStage('wrong'); }
    } catch (e) { setStage('error'); }
  };

  const handleSignIn = () => {
    const u = window.SSAuth && window.SSAuth.getUser();
    if (u) { verify(); return; }            // already signed in → verify immediately
    setStage('signing');
    const off = window.SSAuth.onChange((nu) => { if (!nu) return; off(); verify(); });
    if (onSignIn) { try { onSignIn({ anchorEl: document.getElementById('__google_anchor_join') }); } catch (e) {} }
  };

  return (
    <Screen scroll={false} style={{ display: 'flex', flexDirection: 'column' }}>
      <Header leading={<IconBtn name="close" onClick={goBack} />} title="SplitSplit" />
      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px' }}>
        {stage === 'landing' && <JoinLanding group={known} onSignIn={handleSignIn} />}
        {stage === 'signing' && <JoinStatus label="Signing you in with Google" sub="One second…" />}
        {stage === 'verifying' && <JoinStatus label="Verifying access" sub="Checking the group's invite list…" />}
        {stage === 'joined' && <JoinDone groupId={groupId} onEnter={() => onEntered && onEntered(groupId)} />}
        {stage === 'wrong' && <JoinWrong email={errEmail} onRetry={() => { window.SSAuth.signOut(); setStage('landing'); }} />}
        {stage === 'error' && <JoinError onRetry={() => setStage('landing')} onClose={goBack} />}
      </div>
      <div id="__google_anchor_join" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
    </Screen>
  );
}

function JoinLanding({ group, onSignIn }) {
  return (
    <>
      <div style={{ padding: '24px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        {/* Wordmark */}
        <div style={{ position: 'relative', width: 72, height: 72 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 22, background: SS.ink, transform: 'rotate(-6deg)' }} />
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 22, background: SS.accent,
            transform: 'translate(6px, 3px) rotate(4deg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: 'italic', fontSize: 40, color: '#fff', lineHeight: 1, paddingBottom: 4 }}>$</div>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Geist, system-ui', fontSize: 13.5, color: SS.muted }}>You've been invited to</div>
          <div style={{ fontFamily: 'Geist, system-ui', fontSize: 26, fontWeight: 600, letterSpacing: -0.5, color: SS.ink, marginTop: 2 }}>
            {group ? group.name : 'a group on SplitSplit'}
          </div>
        </div>
      </div>

      {/* Group card (rich if we already know it; generic otherwise) */}
      <div style={{
        background: group ? group.cover : 'linear-gradient(135deg, #E9B7A5 0%, #D97757 100%)',
        borderRadius: 24, padding: '24px 22px', color: '#fff',
        display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -12, top: -12, fontSize: 130, opacity: 0.18 }}>{group ? group.emoji : '🧾'}</div>
        <div style={{ fontFamily: 'Geist, system-ui', fontSize: 11, fontWeight: 600, letterSpacing: 1.3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>Group invite</div>
        <div style={{ fontFamily: 'Geist, system-ui', fontSize: 14, color: 'rgba(255,255,255,0.92)', lineHeight: 1.5 }}>
          Sign in with the Google account this invite was sent to. We'll confirm you're on the group's shared sheet, then drop you straight in.
        </div>
      </div>

      {/* Value props */}
      <div style={{ marginTop: 18, padding: '14px 16px', background: SS.surface, border: `1px solid ${SS.hairline}`, borderRadius: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <JoinPitch icon="wallet" title="Free forever" sub="No ads, no premium tier." />
        <JoinPitch icon="lock" title="Your data stays in your Drive" sub="The group is a Google Sheet you can open anytime." />
        <JoinPitch icon="globe" title="Works with any currency" sub="Track shared spending in any currency." />
      </div>

      <div style={{ height: 24 }} />
      <button onClick={onSignIn} style={{
        height: 56, width: '100%', borderRadius: 16, background: SS.ink, color: '#FCFAF5',
        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        fontFamily: 'Geist, system-ui', fontSize: 16, fontWeight: 600, cursor: 'pointer',
        boxShadow: '0 6px 16px rgba(31,27,22,0.18)',
      }}>
        <JoinGoogleG size={20} />
        Continue with Google
      </button>
      <div style={{ marginTop: 12, padding: '0 16px', textAlign: 'center', fontFamily: 'Geist, system-ui', fontSize: 11.5, color: SS.muted, lineHeight: 1.5 }}>
        We verify your access via the group's Google Sheet. We never see your expenses.
      </div>
      <div style={{ height: 32 }} />
    </>
  );
}

function JoinPitch({ icon, title, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: SS.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={16} color={SS.accentInk} />
      </div>
      <div>
        <div style={{ fontFamily: 'Geist, system-ui', fontSize: 14, fontWeight: 600, color: SS.ink, letterSpacing: -0.1 }}>{title}</div>
        <div style={{ fontFamily: 'Geist, system-ui', fontSize: 12.5, color: SS.muted, marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  );
}

function JoinStatus({ label, sub }) {
  return (
    <div style={{ padding: '72px 0 0', textAlign: 'center' }}>
      <JoinSpinner />
      <div style={{ marginTop: 22, fontFamily: 'Geist, system-ui', fontSize: 16, fontWeight: 600, color: SS.ink, letterSpacing: -0.2 }}>{label}</div>
      <div style={{ marginTop: 4, fontFamily: 'Geist, system-ui', fontSize: 12.5, color: SS.muted }}>{sub}</div>
    </div>
  );
}

function JoinDone({ groupId, onEnter }) {
  const group = window.SSGetStore().getSnapshot().groups.find(g => g.id === groupId) || null;
  return (
    <div style={{ padding: '40px 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', width: 90, height: 90 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 26,
          background: group ? group.cover : 'linear-gradient(135deg, #C7CDA8 0%, #5E7A3F 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, transform: 'rotate(-4deg)',
        }}>{group ? group.emoji : '🎉'}</div>
        <div style={{
          position: 'absolute', bottom: -6, right: -6, width: 32, height: 32, borderRadius: 999,
          background: SS.positive, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `3px solid ${SS.bg}`,
        }}>
          <Icon name="check" size={16} color="#fff" stroke={3} />
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Geist, system-ui', fontSize: 24, fontWeight: 600, color: SS.ink, letterSpacing: -0.4 }}>You're in.</div>
        <div style={{ marginTop: 6, fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: 'italic', fontSize: 18, color: SS.muted }}>
          welcome to {group ? group.name : 'the group'}.
        </div>
      </div>
      <div style={{ height: 8 }} />
      <Button variant="accent" size="lg" fullWidth onClick={onEnter}>Open group</Button>
    </div>
  );
}

function JoinWrong({ email, onRetry }) {
  return (
    <div style={{ padding: '48px 0 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 64, height: 64, borderRadius: 999, background: '#FBE9E2', border: `2px solid #F0CFC2`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="close" size={28} color={SS.negative} stroke={2.4} />
      </div>
      <div style={{ fontFamily: 'Geist, system-ui', fontSize: 19, fontWeight: 600, color: SS.ink, letterSpacing: -0.3 }}>Wrong account</div>
      <div style={{ fontFamily: 'Geist, system-ui', fontSize: 13.5, color: SS.muted, maxWidth: 280, lineHeight: 1.5 }}>
        {email ? <>You're signed in as <b style={{ color: SS.ink }}>{email}</b>, which isn't on this group's invite list.</> : <>This account isn't on the group's invite list.</>} Sign in with the email the invite was sent to.
      </div>
      <div style={{ height: 8 }} />
      <Button variant="accent" size="lg" fullWidth onClick={onRetry}>Try another account</Button>
    </div>
  );
}

function JoinError({ onRetry, onClose }) {
  return (
    <div style={{ padding: '48px 0 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 64, height: 64, borderRadius: 999, background: SS.surfaceAlt, border: `1px solid ${SS.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>⚠️</div>
      <div style={{ fontFamily: 'Geist, system-ui', fontSize: 19, fontWeight: 600, color: SS.ink, letterSpacing: -0.3 }}>Couldn't open this invite</div>
      <div style={{ fontFamily: 'Geist, system-ui', fontSize: 13.5, color: SS.muted, maxWidth: 280, lineHeight: 1.5 }}>
        The link may be incomplete, or the group's Sheet isn't reachable. Ask the person who invited you to resend the link.
      </div>
      <div style={{ height: 16 }} />
      <div style={{ display: 'flex', gap: 10, width: '100%' }}>
        <Button variant="ghost" fullWidth onClick={onClose}>Close</Button>
        <Button variant="accent" fullWidth onClick={onRetry}>Try again</Button>
      </div>
    </div>
  );
}

function JoinSpinner() {
  return (
    <div style={{ display: 'inline-block', position: 'relative', width: 44, height: 44 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 999, border: `3px solid ${SS.hairline}`, borderTopColor: SS.accent, animation: 'ssjoinspin 0.9s linear infinite' }} />
      <style>{`@keyframes ssjoinspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function JoinGoogleG({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3.1 0 5.9 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.3 5.3C40.6 36.1 44 30.5 44 24c0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

window.JoinScreen = JoinScreen;
