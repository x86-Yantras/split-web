// Sign-in screen — Google OAuth entry point.

function SignInScreen({ onSignIn }) {
  return (
    <Screen scroll={false} style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Top spacer so content sits below status bar */}
      <div style={{ height: 60 }} />

      {/* Hero */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 32px', textAlign: 'center', gap: 28,
      }}>
        {/* Wordmark / lockup */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <div style={{ position: 'relative', width: 96, height: 96 }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 28,
              background: SS.ink, transform: 'rotate(-6deg)',
            }} />
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 28,
              background: SS.accent, transform: 'translate(8px, 4px) rotate(4deg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: 'italic',
                fontSize: 56, color: '#fff', lineHeight: 1, paddingBottom: 6,
              }}>$</div>
            </div>
          </div>

          <div>
            <div style={{
              fontFamily: 'Geist, system-ui', fontSize: 38, fontWeight: 600,
              letterSpacing: -1.2, color: SS.ink, lineHeight: 1,
            }}>SplitSplit</div>
            <div style={{
              fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: 'italic',
              fontSize: 19, color: SS.muted, marginTop: 8, letterSpacing: -0.2,
            }}>split bills, not friendships.</div>
          </div>
        </div>

        {/* Bullet pitch */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 12,
          background: SS.surface, padding: '16px 18px', borderRadius: 18,
          border: `1px solid ${SS.hairline}`, width: '100%', marginTop: 8,
        }}>
          {[
            ['Free forever, no ads', 'wallet'],
            ['Your data lives in your Drive', 'lock'],
            ['Works with any currency', 'globe'],
          ].map(([t, ic]) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 10, background: SS.surfaceAlt,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={ic} size={16} color={SS.accentInk} />
              </div>
              <div style={{ fontFamily: 'Geist, system-ui', fontSize: 14.5, color: SS.ink, fontWeight: 500 }}>{t}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sign-in CTA */}
      <div style={{ padding: '0 24px 36px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ position: 'relative' }}>
          <button onClick={() => onSignIn({ anchorEl: document.getElementById('__google_anchor_signin') })} style={{
            height: 56, width: '100%', borderRadius: 16, background: SS.ink, color: '#FCFAF5',
            border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 12, fontFamily: 'Geist, system-ui', fontSize: 16, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 6px 16px rgba(31,27,22,0.18)',
          }}>
            <GoogleG size={20} />
            Continue with Google
          </button>
          {/* GIS button fallback anchor (rendered behind ours; clickable if One Tap is blocked) */}
          <div id="__google_anchor_signin" style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }} />
        </div>
        <div style={{
          fontFamily: 'Geist, system-ui', fontSize: 11.5, color: SS.muted,
          textAlign: 'center', lineHeight: 1.5, padding: '0 12px',
        }}>
          We use your Google account to store your data in your own Drive. We never see your expenses.
        </div>
      </div>
    </Screen>
  );
}

function GoogleG({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3.1 0 5.9 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.3 5.3C40.6 36.1 44 30.5 44 24c0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

window.SignInScreen = SignInScreen;
