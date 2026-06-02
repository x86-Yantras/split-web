// Shared empty-state block.
function EmptyState({ emoji, title, sub, cta, onCta }) {
  return (
    <div style={{ padding: '48px 28px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ fontSize: 44, lineHeight: 1 }}>{emoji}</div>
      <div style={{ fontFamily: 'Geist, system-ui', fontSize: 18, fontWeight: 600, color: SS.ink, letterSpacing: -0.3 }}>{title}</div>
      <div style={{ fontFamily: 'Geist, system-ui', fontSize: 13.5, color: SS.muted, maxWidth: 260, lineHeight: 1.5 }}>{sub}</div>
      {cta && <div style={{ marginTop: 8 }}><Button variant="accent" size="lg" onClick={onCta}>{cta}</Button></div>}
    </div>
  );
}
window.EmptyState = EmptyState;
