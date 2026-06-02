// Add Expense screen — flows for amount, description, payer, split.

function AddExpenseScreen({ groupId, goBack, navigate }) {
  const allGroups = window.DATA.groups;
  const people = window.DATA.people;

  const [group, setGroup] = React.useState(groupId ? allGroups.find(g => g.id === groupId) : allGroups[0]);
  const [amount, setAmount] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const [emoji, setEmoji] = React.useState('🧾');
  const [currency, setCurrency] = React.useState(group.currency);
  const [paidBy, setPaidBy] = React.useState('me');
  const [splitMode, setSplitMode] = React.useState('equal');
  const [participants, setParticipants] = React.useState(new Set(group.members));
  const [showSplitSheet, setShowSplitSheet] = React.useState(false);

  React.useEffect(() => {
    setParticipants(new Set(group.members));
    setCurrency(group.currency);
  }, [group.id]);

  const amountNum = parseFloat(amount) || 0;
  const partCount = participants.size;
  const yourSharePreview = participants.has('me') ? amountNum / Math.max(1, partCount) : 0;

  const splitLabel = (() => {
    if (splitMode === 'equal') return `Equally between ${partCount}`;
    if (splitMode === 'shares') return 'By shares';
    if (splitMode === 'percent') return 'By percentage';
    if (splitMode === 'exact') return 'Exact amounts';
    return splitMode;
  })();

  return (
    <Screen scroll={false} style={{ display: 'flex', flexDirection: 'column' }}>
      <Header
        leading={<IconBtn name="close" onClick={goBack} />}
        title="New expense"
        trailing={
          <button onClick={goBack} disabled={!amountNum || !desc.trim()} style={{
            background: 'none', border: 'none', cursor: amountNum && desc.trim() ? 'pointer' : 'default',
            color: amountNum && desc.trim() ? SS.accent : SS.muted,
            fontFamily: 'Geist, system-ui', fontSize: 15, fontWeight: 600, padding: 0,
          }}>Save</button>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        {/* Group picker */}
        <button onClick={() => {}} style={{
          width: '100%', background: SS.surface, border: `1px solid ${SS.hairline}`,
          borderRadius: 14, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: group.cover,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>{group.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Geist, system-ui', fontSize: 11, color: SS.muted, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Group</div>
            <div style={{ fontFamily: 'Geist, system-ui', fontSize: 14.5, fontWeight: 600, color: SS.ink, marginTop: 1 }}>{group.name}</div>
          </div>
          <Icon name="chevD" size={18} color={SS.muted} />
        </button>

        {/* Amount + description hero */}
        <div style={{
          marginTop: 18, background: SS.surface, borderRadius: 20,
          border: `1px solid ${SS.hairline}`, padding: '20px 18px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setEmoji(nextEmoji(emoji))} style={{
              width: 48, height: 48, borderRadius: 14, background: SS.surfaceAlt,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', cursor: 'pointer', fontSize: 24,
            }}>{emoji}</button>
            <input
              type="text" placeholder="What was it?" value={desc} onChange={e => setDesc(e.target.value)}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontFamily: 'Geist, system-ui', fontSize: 17, fontWeight: 500,
                color: SS.ink, letterSpacing: -0.2, padding: 0,
              }}
            />
          </div>
          <HR inset={0} style={{ marginTop: 14, marginBottom: 14 }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <CcyPicker code={currency} onChange={setCurrency} />
            <input
              type="text" inputMode="decimal" placeholder="0.00"
              value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: 'italic',
                fontSize: 52, fontWeight: 400, color: SS.ink,
                letterSpacing: -1.5, padding: 0, lineHeight: 1, minWidth: 0,
              }}
            />
          </div>
        </div>

        {/* Paid by + split rows */}
        <div style={{
          marginTop: 14, background: SS.surface, borderRadius: 16,
          border: `1px solid ${SS.hairline}`, overflow: 'hidden',
        }}>
          <Row
            left={<div style={{ width: 36, height: 36, borderRadius: 10, background: SS.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="wallet" size={18} color={SS.accentInk} /></div>}
            title="Paid by"
            sub={paidBy === 'me' ? 'You' : people[paidBy].name}
            right={<Icon name="chev" size={16} color={SS.muted} />}
            onClick={() => {}}
          />
          <HR inset={56} />
          <Row
            left={<div style={{ width: 36, height: 36, borderRadius: 10, background: SS.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="split" size={18} color={SS.accentInk} /></div>}
            title="Split"
            sub={splitLabel}
            right={<Icon name="chev" size={16} color={SS.muted} />}
            onClick={() => setShowSplitSheet(true)}
          />
          <HR inset={56} />
          <Row
            left={<div style={{ width: 36, height: 36, borderRadius: 10, background: SS.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="cal" size={18} color={SS.accentInk} /></div>}
            title="Today"
            sub="Tap to change date"
            right={<Icon name="chev" size={16} color={SS.muted} />}
            onClick={() => {}}
          />
        </div>

        {/* Participants */}
        <SectionLabel>Splitting with</SectionLabel>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 0 4px' }}>
          {group.members.map(id => {
            const p = people[id];
            const sel = participants.has(id);
            return (
              <button key={id} onClick={() => {
                const next = new Set(participants);
                if (sel) next.delete(id); else next.add(id);
                setParticipants(next);
              }} style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                minWidth: 64, opacity: sel ? 1 : 0.4,
              }}>
                <div style={{ position: 'relative' }}>
                  <Avatar person={p} size={48} />
                  {sel && (
                    <div style={{
                      position: 'absolute', bottom: -3, right: -3, width: 20, height: 20,
                      borderRadius: 999, background: SS.accent, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `2px solid ${SS.surface}`,
                    }}>
                      <Icon name="check" size={11} color="#fff" stroke={3} />
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: 'Geist, system-ui', fontSize: 11.5, color: SS.ink, fontWeight: 500 }}>
                  {id === 'me' ? 'You' : p.name.split(' ')[0]}
                </div>
              </button>
            );
          })}
        </div>

        {/* Preview */}
        {amountNum > 0 && participants.size > 0 && (
          <div style={{
            marginTop: 18, padding: '14px 16px', borderRadius: 16,
            background: SS.surfaceAlt, border: `1px dashed ${SS.hairline}`,
          }}>
            <div style={{ fontFamily: 'Geist, system-ui', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: SS.muted }}>Preview</div>
            <div style={{ marginTop: 6, fontFamily: 'Geist, system-ui', fontSize: 14, color: SS.ink, lineHeight: 1.5 }}>
              {paidBy === 'me' ? 'You' : people[paidBy].name.split(' ')[0]} paid <Money amount={amountNum} currency={currency} size={14} weight={600} />, split equally between {participants.size}.
              {participants.has('me') && paidBy === 'me' && (
                <> You'll be owed <Money amount={amountNum - yourSharePreview} currency={currency} size={14} weight={600} color={SS.positive} />.</>
              )}
              {participants.has('me') && paidBy !== 'me' && (
                <> You'll owe <Money amount={yourSharePreview} currency={currency} size={14} weight={600} color={SS.negative} />.</>
              )}
            </div>
          </div>
        )}

        <div style={{ height: 32 }} />
      </div>

      {/* Save bar */}
      <div style={{
        padding: '12px 20px 16px', background: SS.bg,
        borderTop: `1px solid ${SS.hairline}`,
      }}>
        <Button variant="accent" size="lg" fullWidth onClick={goBack}
          disabled={!amountNum || !desc.trim()}>
          Add expense
        </Button>
      </div>

      {showSplitSheet && <SplitSheet mode={splitMode} setMode={setSplitMode} amount={amountNum} currency={currency} participants={participants} people={people} onClose={() => setShowSplitSheet(false)} />}
    </Screen>
  );
}

function CcyPicker({ code, onChange }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: SS.surfaceAlt, border: 'none', borderRadius: 10,
        padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4,
        cursor: 'pointer', fontFamily: 'Geist, system-ui', fontSize: 14, fontWeight: 600,
        color: SS.ink2,
      }}>
        {code}
        <Icon name="chevD" size={12} color={SS.muted} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 38, left: 0, zIndex: 30,
          background: SS.surface, border: `1px solid ${SS.hairline}`,
          borderRadius: 12, boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
          minWidth: 110, padding: 4, maxHeight: 220, overflow: 'auto',
        }}>
          {window.CCY.codes.map(c => (
            <button key={c} onClick={() => { onChange(c); setOpen(false); }} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', width: '100%', background: c === code ? SS.surfaceAlt : 'transparent',
              border: 'none', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'Geist, system-ui', fontSize: 13, fontWeight: 500, color: SS.ink,
            }}>
              <span>{c}</span>
              <span style={{ color: SS.muted }}>{window.CCY.symbols[c]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SplitSheet({ mode, setMode, amount, currency, participants, people, onClose }) {
  const partList = [...participants];
  const equalShare = amount / Math.max(1, partList.length);
  const [shares, setShares] = React.useState(() => Object.fromEntries(partList.map(p => [p, 1])));
  const [percents, setPercents] = React.useState(() => {
    const eq = 100 / partList.length;
    return Object.fromEntries(partList.map(p => [p, Math.round(eq)]));
  });
  const [exacts, setExacts] = React.useState(() => Object.fromEntries(partList.map(p => [p, equalShare.toFixed(2)])));

  const modes = [
    { id: 'equal', label: 'Equally', sub: 'Same for everyone' },
    { id: 'shares', label: 'By shares', sub: 'e.g. 1, 1, 2' },
    { id: 'percent', label: 'By %', sub: 'Add up to 100' },
    { id: 'exact', label: 'Exact', sub: 'Type each amount' },
  ];

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(31,27,22,0.4)',
      display: 'flex', alignItems: 'flex-end', zIndex: 40,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: SS.bg, width: '100%', borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: '8px 0 28px', maxHeight: '78%', overflow: 'auto',
        boxShadow: '0 -10px 30px rgba(0,0,0,0.15)',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: SS.hairline, margin: '6px auto 6px' }} />
        <Header title="Split" trailing={<button onClick={onClose} style={{ background: 'none', border: 'none', color: SS.accent, fontFamily: 'Geist, system-ui', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Done</button>} />

        {/* Mode tabs */}
        <div style={{ padding: '0 16px 6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {modes.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              padding: '12px 14px', borderRadius: 14, textAlign: 'left',
              background: mode === m.id ? SS.ink : SS.surface,
              color: mode === m.id ? '#FCFAF5' : SS.ink,
              border: mode === m.id ? 'none' : `1px solid ${SS.hairline}`,
              cursor: 'pointer',
            }}>
              <div style={{ fontFamily: 'Geist, system-ui', fontSize: 14, fontWeight: 600, letterSpacing: -0.1 }}>{m.label}</div>
              <div style={{ fontFamily: 'Geist, system-ui', fontSize: 11.5, marginTop: 2, color: mode === m.id ? 'rgba(252,250,245,0.6)' : SS.muted }}>{m.sub}</div>
            </button>
          ))}
        </div>

        {/* Participant rows */}
        <SectionLabel>{
          mode === 'equal' ? 'Split equally' :
          mode === 'shares' ? 'How many shares each?' :
          mode === 'percent' ? 'Percentage each' : 'Exact amount each'
        }</SectionLabel>

        <div style={{ padding: '0 12px' }}>
          <div style={{ background: SS.surface, borderRadius: 16, border: `1px solid ${SS.hairline}`, overflow: 'hidden' }}>
            {partList.map((id, i) => {
              const p = people[id];
              let rightContent;
              if (mode === 'equal') {
                rightContent = <Money amount={equalShare} currency={currency} size={15} weight={600} />;
              } else if (mode === 'shares') {
                rightContent = (
                  <Stepper value={shares[id]} onChange={v => setShares({ ...shares, [id]: v })} />
                );
              } else if (mode === 'percent') {
                rightContent = (
                  <PctInput value={percents[id]} onChange={v => setPercents({ ...percents, [id]: v })} />
                );
              } else {
                rightContent = (
                  <ExactInput value={exacts[id]} onChange={v => setExacts({ ...exacts, [id]: v })} currency={currency} />
                );
              }
              return (
                <React.Fragment key={id}>
                  {i > 0 && <HR inset={62} />}
                  <Row
                    left={<Avatar person={p} size={38} />}
                    title={id === 'me' ? 'You' : p.name}
                    right={rightContent}
                  />
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Status footer */}
        <div style={{ padding: '16px 24px 0' }}>
          {mode === 'percent' && (() => {
            const sum = Object.values(percents).reduce((s, n) => s + (+n || 0), 0);
            const off = 100 - sum;
            return (
              <div style={{ fontFamily: 'Geist, system-ui', fontSize: 13, color: off === 0 ? SS.positive : SS.warn, textAlign: 'center' }}>
                {off === 0 ? 'Adds up to 100% ✓' : `${off > 0 ? off + '% to go' : Math.abs(off) + '% over'}`}
              </div>
            );
          })()}
          {mode === 'exact' && (() => {
            const sum = Object.values(exacts).reduce((s, n) => s + (parseFloat(n) || 0), 0);
            const off = amount - sum;
            return (
              <div style={{ fontFamily: 'Geist, system-ui', fontSize: 13, color: Math.abs(off) < 0.01 ? SS.positive : SS.warn, textAlign: 'center' }}>
                {Math.abs(off) < 0.01 ? 'Adds up ✓' : <>Off by <Money amount={Math.abs(off)} currency={currency} size={13} color={SS.warn} weight={600} /></>}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function Stepper({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => onChange(Math.max(0, value - 1))} style={{ width: 30, height: 30, borderRadius: 999, border: `1px solid ${SS.hairline}`, background: 'white', cursor: 'pointer', fontSize: 18, color: SS.ink, padding: 0 }}>−</button>
      <div style={{ fontFamily: 'Geist, system-ui', fontSize: 15, fontWeight: 600, minWidth: 18, textAlign: 'center' }}>{value}</div>
      <button onClick={() => onChange(value + 1)} style={{ width: 30, height: 30, borderRadius: 999, border: `1px solid ${SS.hairline}`, background: 'white', cursor: 'pointer', fontSize: 18, color: SS.ink, padding: 0 }}>+</button>
    </div>
  );
}

function PctInput({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: SS.surfaceAlt, borderRadius: 10, padding: '4px 8px' }}>
      <input value={value} onChange={e => onChange(e.target.value.replace(/[^\d]/g, ''))} style={{
        width: 32, border: 'none', outline: 'none', background: 'transparent',
        fontFamily: 'Geist, system-ui', fontSize: 14, fontWeight: 600, color: SS.ink, textAlign: 'right',
      }} />
      <span style={{ color: SS.muted, fontFamily: 'Geist, system-ui', fontSize: 13 }}>%</span>
    </div>
  );
}

function ExactInput({ value, onChange, currency }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: SS.surfaceAlt, borderRadius: 10, padding: '4px 8px' }}>
      <span style={{ color: SS.muted, fontFamily: 'Geist, system-ui', fontSize: 13 }}>{window.CCY.symbols[currency]}</span>
      <input value={value} onChange={e => onChange(e.target.value.replace(/[^\d.]/g, ''))} style={{
        width: 58, border: 'none', outline: 'none', background: 'transparent',
        fontFamily: 'Geist, system-ui', fontSize: 14, fontWeight: 600, color: SS.ink, textAlign: 'right',
      }} />
    </div>
  );
}

// cycle suggested emojis
function nextEmoji(cur) {
  const pool = ['🧾','🍱','🍣','🚄','🏯','☕','🥬','🍔','🍕','🍷','🏠','📡','🚕','🥐','🌊','🎟️','📚','🛒'];
  const i = pool.indexOf(cur);
  return pool[(i + 1) % pool.length];
}

window.AddExpenseScreen = AddExpenseScreen;
