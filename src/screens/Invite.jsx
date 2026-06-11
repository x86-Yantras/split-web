// Invite flow — enter Gmail → add as Sheets editor (silently) → share deep link.

function InviteScreen({ store, groupId, goBack, navigate }) {
  const groups = store.getSnapshot().groups;
  const [group, setGroup] = React.useState(groupId ? groups.find(g => g.id === groupId) : groups[0]);
  const [email, setEmail] = React.useState('');
  const [stage, setStage] = React.useState('email'); // email | provisioning | ready
  const [link, setLink] = React.useState('');

  // Invites add someone to a specific group's sheet — there must be a group.
  // Reached with no groupId from Home/Friends "Invite friends" on a fresh account.
  if (!group) {
    return (
      <Screen scroll={false} style={{ display: 'flex', flexDirection: 'column' }}>
        <Header leading={<IconBtn name="close" onClick={goBack} />} title="Invite to group" />
        <EmptyState
          emoji="🧳"
          title="Create a group first"
          sub="Invites add someone to a specific group's shared sheet. Make a group, then invite people to it."
          cta="New group"
          onCta={() => { goBack(); if (navigate) navigate({ screen: 'newGroup' }); }}
        />
      </Screen>
    );
  }

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleAdd = async () => {
    setStage('provisioning');
    try {
      const { link } = await store.inviteByEmail(group.id, email.trim());
      setLink(link); // full URL incl. scheme (http on local dev, https in prod)
      setStage('ready');
    } catch (e) {
      setStage('email');
      if (e && e.code === 'sheet-gone') {
        alert(e.message);
        goBack(); // the group was pruned — bail out of its (now dead) invite screen
        return;
      }
      alert('Could not add them. Make sure the group has a real Sheet and you are online.');
    }
  };

  return (
    <Screen scroll={false} style={{ display: 'flex', flexDirection: 'column' }}>
      <Header
        leading={<IconBtn name={stage === 'ready' ? 'check' : 'close'} onClick={goBack} />}
        title={stage === 'ready' ? 'Invite ready' : 'Invite to group'}
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        {/* Group context */}
        <div style={{
          background: SS.surface, border: `1px solid ${SS.hairline}`,
          borderRadius: 16, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: group.cover,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>{group.emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Geist, system-ui', fontSize: 11, color: SS.muted, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Inviting to</div>
            <div style={{ fontFamily: 'Geist, system-ui', fontSize: 15, fontWeight: 600, color: SS.ink, marginTop: 1 }}>{group.name}</div>
          </div>
          <div style={{ fontFamily: 'Geist, system-ui', fontSize: 12, color: SS.muted }}>{group.members.length} members</div>
        </div>

        {stage === 'email' && (
          <EmailStage email={email} setEmail={setEmail} group={group} valid={valid} onAdd={handleAdd} />
        )}
        {stage === 'provisioning' && (
          <ProvisioningStage email={email} />
        )}
        {stage === 'ready' && (
          <ReadyStage email={email} group={group} link={link} goBack={goBack} />
        )}
      </div>
    </Screen>
  );
}

function EmailStage({ email, setEmail, group, valid, onAdd }) {
  return (
    <>
      <SectionLabel>Their email</SectionLabel>
      <div style={{
        background: SS.surface, border: `1px solid ${SS.hairline}`, borderRadius: 14,
        padding: '4px 14px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Icon name="globe" size={18} color={SS.muted} />
        <input
          type="email" autoComplete="off" autoCapitalize="none"
          placeholder="friend@gmail.com" value={email}
          onChange={e => setEmail(e.target.value)}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'Geist, system-ui', fontSize: 15, color: SS.ink,
            padding: '14px 0',
          }}
        />
      </div>
      <div style={{
        fontFamily: 'Geist, system-ui', fontSize: 12, color: SS.muted,
        padding: '8px 4px 0', lineHeight: 1.5,
      }}>
        We'll add this email as an editor of <b>{group.name}'s</b> data sheet — silently, without an email from Google.
      </div>

      {/* How it works */}
      <SectionLabel>What happens next</SectionLabel>
      <div style={{ background: SS.surface, border: `1px solid ${SS.hairline}`, borderRadius: 16, padding: '6px 0', overflow: 'hidden' }}>
        <StepRow n={1} title="We add them as editor" sub="Quiet — no email from Google." />
        <HR inset={60} />
        <StepRow n={2} title="You get a shareable link" sub="Send it via WhatsApp, Messages, anywhere." />
        <HR inset={60} />
        <StepRow n={3} title="They tap, sign in, they're in" sub="The app checks they can read the sheet." />
      </div>

      <div style={{ height: 24 }} />

      <Button variant="accent" size="lg" fullWidth icon="people" onClick={onAdd} disabled={!valid}>
        Add to group
      </Button>

      <div style={{ height: 32 }} />
    </>
  );
}

function StepRow({ n, title, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
      <div style={{
        width: 28, height: 28, borderRadius: 999, background: SS.surfaceAlt,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: 'italic',
        fontSize: 17, color: SS.accentInk, fontWeight: 500,
      }}>{n}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'Geist, system-ui', fontSize: 14.5, fontWeight: 500, color: SS.ink, letterSpacing: -0.1 }}>{title}</div>
        <div style={{ fontFamily: 'Geist, system-ui', fontSize: 12.5, color: SS.muted, marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

function ProvisioningStage({ email }) {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 480);
    return () => clearInterval(i);
  }, []);
  const steps = [
    'Adding to your shared sheet',
    'Granting editor access',
    'Skipping Google notification',
  ];
  return (
    <div style={{ padding: '32px 0 0', textAlign: 'center' }}>
      <Spinner />
      <div style={{
        marginTop: 22, fontFamily: 'Geist, system-ui', fontSize: 16, fontWeight: 600,
        color: SS.ink, letterSpacing: -0.2,
      }}>Setting up access for</div>
      <div style={{
        marginTop: 2, fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: 'italic',
        fontSize: 22, color: SS.accentInk, letterSpacing: -0.3,
      }}>{email}</div>

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

function ReadyStage({ email, group, link, goBack }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    setCopied(true);
    if (navigator.clipboard) navigator.clipboard.writeText(link).catch(() => {});
    setTimeout(() => setCopied(false), 1400);
  };

  const url = link;
  const msg = `Join our ${group.name} on SplitSplit ✌️ ${url}`;
  const share = {
    WhatsApp: () => window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener'),
    Messages: () => window.open('sms:?&body=' + encodeURIComponent(msg), '_blank'),
    Mail: () => window.open('mailto:' + encodeURIComponent(email) + '?subject=' + encodeURIComponent('Join ' + group.name + ' on SplitSplit') + '&body=' + encodeURIComponent(msg), '_blank'),
    More: async () => {
      if (navigator.share) { try { await navigator.share({ title: 'SplitSplit', text: `Join ${group.name} on SplitSplit`, url }); return; } catch (e) {} }
      if (navigator.clipboard) { try { await navigator.clipboard.writeText(url); alert('Link copied'); } catch (e) {} }
    },
  };

  return (
    <>
      {/* Success badge */}
      <div style={{ padding: '20px 0 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 999, background: '#EFF4E6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `2px solid #D5E2BC`,
        }}>
          <Icon name="check" size={30} color={SS.positive} stroke={2.4} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Geist, system-ui', fontSize: 19, fontWeight: 600, color: SS.ink, letterSpacing: -0.3 }}>
            <span style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: 'italic', fontWeight: 400, fontSize: 22, color: SS.accentInk }}>{email.split('@')[0]}</span> can join
          </div>
          <div style={{ fontFamily: 'Geist, system-ui', fontSize: 13, color: SS.muted, marginTop: 4 }}>
            Send them this link to drop them right into <b>{group.name}</b>.
          </div>
        </div>
      </div>

      {/* Link card */}
      <SectionLabel>Invite link</SectionLabel>
      <div style={{
        background: SS.surface, border: `1px solid ${SS.hairline}`, borderRadius: 16,
        padding: '14px 14px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: SS.surfaceAlt,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="globe" size={18} color={SS.accentInk} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Geist Mono, ui-monospace, monospace',
            fontSize: 12.5, color: SS.ink, fontWeight: 500,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{link}</div>
          <div style={{ fontFamily: 'Geist, system-ui', fontSize: 11.5, color: SS.muted, marginTop: 2 }}>
            Expires in 7 days · single use
          </div>
        </div>
        <button onClick={handleCopy} style={{
          background: copied ? SS.positive : SS.ink, color: '#FCFAF5', border: 'none',
          borderRadius: 999, padding: '7px 12px', cursor: 'pointer',
          fontFamily: 'Geist, system-ui', fontSize: 12.5, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
        }}>
          {copied ? <><Icon name="check" size={12} color="#fff" stroke={3} /> Copied</> : 'Copy'}
        </button>
      </div>

      {/* Share targets */}
      <SectionLabel>Share with</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <ShareTile label="WhatsApp" color="#25D366" onClick={share.WhatsApp} glyph={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.4 5L2 22l5.1-1.3c1.4.8 3.1 1.3 4.9 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2zm5.4 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1.1.1-1.7-.1-.4-.1-1-.3-1.7-.6-3-1.3-5-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3 0-1.4.7-2.1 1-2.4.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .7.5l.9 2.2c.1.2.1.4 0 .6-.1.2-.2.3-.3.5-.2.2-.3.4-.5.6-.2.2-.3.3-.1.7.2.4.9 1.4 1.8 2.3 1.2 1.1 2.2 1.4 2.5 1.6.3.2.5.1.7-.1.2-.2.8-.9 1-1.2.2-.3.4-.3.6-.2l2.1.9c.3.1.4.2.5.3.1.2 0 .8-.2 1.1z"/></svg>
        } />
        <ShareTile label="Messages" color="#34C759" onClick={share.Messages} glyph={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.5 2 2 6 2 11c0 2.4 1.1 4.6 3 6.2V22l3.8-2.5c1 .3 2.1.5 3.2.5 5.5 0 10-4 10-9s-4.5-9-10-9z"/></svg>
        } />
        <ShareTile label="Mail" color="#4F81E0" onClick={share.Mail} glyph={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 8l9 6 9-6"/></svg>
        } />
        <ShareTile label="More" color={SS.ink} onClick={share.More} glyph={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M12 4v12M6 10l6-6 6 6M5 20h14"/></svg>
        } />
      </div>

      {/* Pre-baked WhatsApp preview */}
      <SectionLabel>Preview</SectionLabel>
      <div style={{
        background: '#DCF8C6', borderRadius: 16, borderBottomLeftRadius: 4,
        padding: '10px 12px', maxWidth: 280, marginLeft: 'auto',
        boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
      }}>
        <div style={{ fontFamily: 'Geist, system-ui', fontSize: 14, color: '#0B141A', lineHeight: 1.45 }}>
          Hey! Join our <b>{group.name}</b> on SplitSplit ✌️
        </div>
        <a style={{
          display: 'block', marginTop: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.7)',
          borderRadius: 8, fontFamily: 'Geist Mono, ui-monospace, monospace',
          fontSize: 11.5, color: '#075E54', textDecoration: 'none',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{link}</a>
        <div style={{ fontFamily: 'Geist, system-ui', fontSize: 10, color: '#667781', textAlign: 'right', marginTop: 4 }}>9:41 ✓✓</div>
      </div>

      <div style={{ height: 20 }} />
      <Button variant="ghost" fullWidth onClick={goBack}>Done</Button>
      <div style={{ height: 32 }} />
    </>
  );
}

function ShareTile({ label, color, glyph, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14, background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 4px 10px ${color}40`,
      }}>{glyph}</div>
      <div style={{ fontFamily: 'Geist, system-ui', fontSize: 11.5, color: SS.ink2, fontWeight: 500 }}>{label}</div>
    </button>
  );
}

function Spinner() {
  return (
    <div style={{ display: 'inline-block', position: 'relative', width: 44, height: 44 }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 999,
        border: `3px solid ${SS.hairline}`,
        borderTopColor: SS.accent,
        animation: 'spin 0.9s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

window.InviteScreen = InviteScreen;
