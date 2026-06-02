// Settle up flow.

function SettleScreen({ store, friendId, groupId, goBack }) {
  const snap = store.getSnapshot();
  const { people, friends, me } = snap;

  function groupForFriend(fid, ccy) {
    if (groupId) return groupId;
    // pick the group with this friend where our balance is largest in that currency
    const cands = snap.groups.filter(g => g.members.includes(fid) && g.currency === ccy);
    return (cands[0] && cands[0].id) || (snap.groups.find(g => g.members.includes(fid)) || {}).id;
  }
  const [selectedFriend, setSelectedFriend] = React.useState(friendId || null);
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState('paypal');
  const [step, setStep] = React.useState(friendId ? 'amount' : 'who');

  const f = selectedFriend ? friends.find(x => x.id === selectedFriend) : null;
  const p = selectedFriend ? people[selectedFriend] : null;
  const currency = f ? f.currency : 'USD';
  const suggested = f ? Math.abs(f.balance) : 0;

  React.useEffect(() => {
    if (suggested && !amount) setAmount(String(suggested));
  }, [selectedFriend]);

  return (
    <Screen scroll={false} style={{ display: 'flex', flexDirection: 'column' }}>
      <Header
        leading={step === 'who' ? <IconBtn name="close" onClick={goBack} /> : <IconBtn name="chevL" onClick={() => setStep('who')} />}
        title="Settle up"
      />

      {step === 'who' ? (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <SectionLabel>Who are you settling with?</SectionLabel>
          <div style={{ padding: '0 12px' }}>
            <div style={{ background: SS.surface, borderRadius: 16, border: `1px solid ${SS.hairline}`, overflow: 'hidden' }}>
              {friends.filter(fr => fr.balance !== 0).map((fr, i) => {
                const person = people[fr.id];
                return (
                  <React.Fragment key={fr.id}>
                    {i > 0 && <HR inset={62} />}
                    <Row
                      left={<Avatar person={person} size={42} />}
                      title={person.name}
                      sub={fr.balance > 0 ? 'owes you' : 'you owe'}
                      right={<Money amount={Math.abs(fr.balance)} currency={fr.currency} size={15} weight={600}
                        color={fr.balance > 0 ? SS.positive : SS.negative} />}
                      onClick={() => { setSelectedFriend(fr.id); setAmount(String(Math.abs(fr.balance))); setStep('amount'); }}
                    />
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <AmountStep
          p={p}
          f={f}
          me={me}
          amount={amount}
          setAmount={setAmount}
          currency={currency}
          suggested={suggested}
          method={method}
          setMethod={setMethod}
          goBack={goBack}
          store={store}
          friendId={selectedFriend}
          groupId={groupForFriend(selectedFriend, currency)}
        />
      )}
    </Screen>
  );
}

function AmountStep({ p, f, me, amount, setAmount, currency, suggested, method, setMethod, goBack, store, friendId, groupId }) {
  const youArePayer = f.balance < 0; // you owe them → you pay
  // The receiver is whoever is getting money: you (if they owe) or them (if you owe).
  const receiver = youArePayer ? p : me;

  // PayPal handle state (preserve any value the user types even if data has none)
  const [paypalHandle, setPaypalHandle] = React.useState(receiver.paypal || '');
  React.useEffect(() => { setPaypalHandle(receiver.paypal || ''); }, [receiver.id]);

  const [busy, setBusy] = React.useState(false);
  const record = async (method, note) => {
    if (busy || !groupId) { if (!groupId) alert('No shared group to record this in yet.'); return; }
    setBusy(true);
    const amt = parseFloat(amount) || 0;
    const payment = {
      date: new Date().toISOString().slice(0, 10),
      from: youArePayer ? me.id : friendId,
      to: youArePayer ? friendId : me.id,
      amount: amt, currency, method, note: note || '',
    };
    try {
      if (youArePayer && receiver.paypal) {
        window.open('https://www.paypal.com/paypalme/' + receiver.paypal + '/' + amt, '_blank', 'noopener');
      }
      await store.recordPayment(groupId, payment);
      goBack();
    } catch (e) { setBusy(false); alert('Could not record the payment. Try again.'); }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 20px 0' }}>
        {/* Avatars */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 0 16px' }}>
          <Avatar person={me} size={64} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: 999, background: SS.hairline }} />)}
            <Icon name={youArePayer ? 'chev' : 'chevL'} size={18} color={SS.accent} />
            {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: 999, background: SS.hairline }} />)}
          </div>
          <Avatar person={p} size={64} />
        </div>

        <div style={{ textAlign: 'center', marginBottom: 14, fontFamily: 'Geist, system-ui', fontSize: 14, color: SS.muted }}>
          {youArePayer ? <>You pay <b style={{ color: SS.ink }}>{p.name.split(' ')[0]}</b></> : <><b style={{ color: SS.ink }}>{p.name.split(' ')[0]}</b> pays you</>}
        </div>

        {/* Amount */}
        <div style={{
          background: SS.surface, borderRadius: 20, border: `1px solid ${SS.hairline}`,
          padding: '20px 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <span style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: 'italic', fontSize: 48, color: SS.muted }}>{window.CCY.symbols[currency]}</span>
          <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            style={{
              width: 180, border: 'none', outline: 'none', background: 'transparent',
              fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: 'italic',
              fontSize: 56, color: SS.ink, textAlign: 'center', padding: 0, letterSpacing: -1.5,
            }}
          />
        </div>

        {suggested > 0 && parseFloat(amount) !== suggested && (
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button onClick={() => setAmount(String(suggested))} style={{
              background: SS.surfaceAlt, border: 'none', borderRadius: 999,
              padding: '6px 12px', cursor: 'pointer',
              fontFamily: 'Geist, system-ui', fontSize: 12.5, fontWeight: 500, color: SS.ink2,
            }}>Pay full balance · <Money amount={suggested} currency={currency} size={12.5} weight={500} color={SS.ink2} /></button>
          </div>
        )}

        {/* Method */}
        <SectionLabel style={{ padding: '20px 0 8px' }}>How</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <MethodTile id="paypal" cur={method} setCur={setMethod} label="PayPal" sub="Send via paypal.me" glyph={<PayPalGlyph dark={method !== 'paypal'} />} />
          <MethodTile id="cash" cur={method} setCur={setMethod} label="Cash / other" sub="Just mark it paid" icon="wallet" />
        </div>

        {/* PayPal context card */}
        {method === 'paypal' && (
          <PaypalCard
            receiver={receiver}
            youArePayer={youArePayer}
            paypalHandle={paypalHandle}
            setPaypalHandle={setPaypalHandle}
          />
        )}

        <div style={{ height: 24 }} />
      </div>

      {/* Action bar */}
      <div style={{ padding: '12px 20px 16px', borderTop: `1px solid ${SS.hairline}`, background: SS.bg }}>
        {method === 'paypal' ? (
          <Button
            variant="accent" size="lg" fullWidth
            icon={youArePayer ? 'send' : 'check'}
            disabled={busy || !parseFloat(amount) || (youArePayer && !paypalHandle.trim())}
            onClick={() => record('paypal')}
          >
            {youArePayer ? `Open paypal.me/${paypalHandle || '…'}` : 'Mark as received'}
          </Button>
        ) : (
          <Button
            variant="accent" size="lg" fullWidth icon="check"
            disabled={busy || !parseFloat(amount)} onClick={() => record('cash')}
          >
            Mark as paid
          </Button>
        )}
      </div>
    </div>
  );
}

function MethodTile({ id, cur, setCur, label, sub, icon, glyph }) {
  const active = cur === id;
  return (
    <button onClick={() => setCur(id)} style={{
      padding: '12px 12px', borderRadius: 14, textAlign: 'left',
      background: active ? SS.ink : SS.surface,
      border: active ? 'none' : `1px solid ${SS.hairline}`,
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: active ? 'rgba(255,255,255,0.08)' : SS.surfaceAlt,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {glyph || <Icon name={icon} size={16} color={active ? '#FCFAF5' : SS.ink} />}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: 'Geist, system-ui', fontSize: 13.5, fontWeight: 600,
          color: active ? '#FCFAF5' : SS.ink, letterSpacing: -0.1,
        }}>{label}</div>
        <div style={{
          fontFamily: 'Geist, system-ui', fontSize: 11.5,
          color: active ? 'rgba(252,250,245,0.6)' : SS.muted, marginTop: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{sub}</div>
      </div>
    </button>
  );
}

function PayPalGlyph({ dark }) {
  // Generic stylized "P" wordmark — blue when active (on dark), white tint otherwise.
  const c1 = dark ? '#003087' : '#FFFFFF';
  const c2 = dark ? '#0070BA' : '#FFFFFF';
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M7 4h7c3.3 0 5.5 1.8 5 5.2C18.4 13.2 15.4 15 12 15H9.6L8.2 21H4L7 4z" fill={c1} opacity={dark ? 0.85 : 1}/>
      <path d="M9 7h5.5c2.6 0 4.2 1.3 3.8 3.8-.5 3-3 4.5-5.7 4.5H10L9 7z" fill={c2} opacity={dark ? 1 : 0.55}/>
    </svg>
  );
}

function PaypalCard({ receiver, youArePayer, paypalHandle, setPaypalHandle }) {
  const hasHandle = !!receiver.paypal;
  return (
    <div style={{ marginTop: 14, background: SS.surface, border: `1px solid ${SS.hairline}`, borderRadius: 16, padding: '14px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, background: '#003087',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <PayPalGlyph dark={false} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Geist, system-ui', fontSize: 12, color: SS.muted, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' }}>
            {youArePayer ? `${receiver.name.split(' ')[0]}'s PayPal` : 'Your PayPal'}
          </div>
          {hasHandle ? (
            <div style={{
              marginTop: 2, fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 14, color: SS.ink, fontWeight: 500,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>paypal.me/{paypalHandle}</div>
          ) : (
            <div style={{
              marginTop: 6, display: 'flex', alignItems: 'center', gap: 4,
              background: SS.surfaceAlt, borderRadius: 10, padding: '6px 10px',
            }}>
              <span style={{ color: SS.muted, fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 13 }}>paypal.me/</span>
              <input
                value={paypalHandle} onChange={e => setPaypalHandle(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, ''))}
                autoCapitalize="none" autoComplete="off" placeholder="username"
                style={{
                  flex: 1, border: 'none', outline: 'none', background: 'transparent',
                  fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 13,
                  color: SS.ink, fontWeight: 500, padding: 0, minWidth: 0,
                }}
              />
            </div>
          )}
        </div>
      </div>

      <div style={{
        marginTop: 12, padding: '10px 12px', background: SS.surfaceAlt, borderRadius: 12,
        fontFamily: 'Geist, system-ui', fontSize: 12.5, color: SS.ink2, lineHeight: 1.5,
      }}>
        {youArePayer ? (
          hasHandle
            ? <>We'll open <b>paypal.me/{paypalHandle}</b> with the amount filled in. After paying, come back and tap <b>Mark as paid</b>.</>
            : <>Ask <b>{receiver.name.split(' ')[0]}</b> for their PayPal username, or paste the part after <b>paypal.me/</b> from any of their links. We'll save it for next time.</>
        ) : (
          <>Share <b>paypal.me/{paypalHandle || 'your-username'}</b> with <b>{/* */}</b>. They'll see the amount pre-filled.</>
        )}
      </div>
    </div>
  );
}

window.SettleScreen = SettleScreen;
