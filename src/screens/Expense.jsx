// Expense detail — split breakdown, comments, edit, delete.
function ExpenseScreen({ store, groupId, expenseId, goBack }) {
  const snap = store.getSnapshot();
  const group = snap.groups.find(g => g.id === groupId);
  const expense = (snap.expenses[groupId] || []).find(e => e.id === expenseId);
  const people = snap.people;
  const [comment, setComment] = React.useState('');
  if (!group || !expense) return (
    <Screen><Header leading={<IconBtn name="chevL" onClick={goBack} />} title="Expense" /></Screen>
  );

  const D = window.SSDomain;
  const split = D.splitMap(expense);
  const payer = people[expense.paidBy] || { name: expense.paidBy };
  const comments = (store.commentsFor ? store.commentsFor(groupId, expenseId) : []);

  const handleDelete = async () => {
    if (!confirm('Delete this expense? This cannot be undone.')) return;
    try { await store.deleteExpense(groupId, expenseId); goBack(); }
    catch (e) { alert('Could not delete. Try again.'); }
  };
  const handleComment = async () => {
    const text = comment.trim();
    if (!text) return;
    setComment('');
    try { await store.addComment(groupId, { expense_id: expenseId, expenseDesc: expense.desc, author: 'me', text }); }
    catch (e) { alert('Could not post comment.'); }
  };

  return (
    <Screen>
      <Header
        leading={<IconBtn name="chevL" onClick={goBack} />}
        title={expense.desc}
        trailing={<IconBtn name="trash" color={SS.negative} onClick={handleDelete} />}
      />
      {/* Hero */}
      <div style={{ padding: '4px 20px 8px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, lineHeight: 1 }}>{expense.emoji}</div>
        <div style={{ marginTop: 8 }}>
          <Money amount={expense.amount} currency={expense.currency} size={40} italic />
        </div>
        <div style={{ fontFamily: 'Geist, system-ui', fontSize: 13, color: SS.muted, marginTop: 4 }}>
          {expense.paidBy === 'me' ? 'You' : payer.name.split(' ')[0]} paid · {expense.date}
        </div>
      </div>

      <SectionLabel>Split {expense.split === 'equal' ? 'equally' : 'by ' + expense.split}</SectionLabel>
      <div style={{ padding: '0 12px' }}>
        <div style={{ background: SS.surface, borderRadius: 16, border: `1px solid ${SS.hairline}`, overflow: 'hidden' }}>
          {expense.participants.map((id, i) => (
            <React.Fragment key={id}>
              {i > 0 && <HR inset={62} />}
              <Row left={<Avatar person={people[id] || { name: id, initials: '?', color: SS.muted }} size={38} />}
                title={id === 'me' ? 'You' : (people[id] ? people[id].name : id)}
                right={<Money amount={split[id] || 0} currency={expense.currency} size={15} weight={600} />} />
            </React.Fragment>
          ))}
        </div>
      </div>

      <SectionLabel>Comments</SectionLabel>
      <div style={{ padding: '0 20px' }}>
        {comments.length === 0 && <div style={{ fontFamily: 'Geist, system-ui', fontSize: 13, color: SS.muted, padding: '4px 0 10px' }}>No comments yet.</div>}
        {comments.map(c => (
          <div key={c.id} style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: 'Geist, system-ui', fontSize: 12, color: SS.muted }}>{c.author === 'me' ? 'You' : (people[c.author] ? people[c.author].name.split(' ')[0] : c.author)}</div>
            <div style={{ background: SS.surfaceAlt, borderRadius: 12, borderTopLeftRadius: 4, padding: '8px 12px', fontFamily: 'Geist, system-ui', fontSize: 13.5, color: SS.ink2, marginTop: 2 }}>{c.text}</div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment…"
            onKeyDown={e => { if (e.key === 'Enter') handleComment(); }}
            style={{ flex: 1, border: `1px solid ${SS.hairline}`, borderRadius: 12, padding: '10px 12px', fontFamily: 'Geist, system-ui', fontSize: 14, outline: 'none', background: SS.surface, color: SS.ink }} />
          <Button variant="primary" onClick={handleComment} disabled={!comment.trim()}>Post</Button>
        </div>
      </div>
      <div style={{ height: 32 }} />
    </Screen>
  );
}
window.ExpenseScreen = ExpenseScreen;
