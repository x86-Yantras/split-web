// Shared UI primitives for SplitSplit.

const SS = {
  bg: '#FAF7F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F4EFE7',
  ink: '#1F1B16',
  ink2: '#4A4640',
  muted: '#837C73',
  hairline: '#ECE5D9',
  hairlineSoft: '#F2ECDF',
  accent: '#D97757',
  accentInk: '#8E3F25',
  positive: '#5E7A3F',
  negative: '#B7503A',
  warn: '#C28A2C',
};

// Generic avatar circle with initials
function Avatar({ person, size = 36, ring = false }) {
  if (!person) return null;
  return (
    <div style={{
      width: size, height: size, borderRadius: size,
      background: person.color || '#888', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Geist, system-ui', fontWeight: 600,
      fontSize: size * 0.38, letterSpacing: 0.2,
      boxShadow: ring ? `0 0 0 2px ${SS.surface}, 0 0 0 3.5px ${person.color}` : 'none',
      flexShrink: 0,
    }}>
      {person.initials}
    </div>
  );
}

// Stack of avatars
function AvatarStack({ ids, size = 24, max = 4, people }) {
  const list = ids.slice(0, max);
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {list.map((id, i) => (
        <div key={id} style={{ marginLeft: i === 0 ? 0 : -size * 0.35 }}>
          <Avatar person={people[id]} size={size} ring />
        </div>
      ))}
      {ids.length > max && (
        <div style={{
          marginLeft: -size * 0.35,
          width: size, height: size, borderRadius: size,
          background: SS.surfaceAlt, color: SS.muted,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Geist, system-ui', fontWeight: 600,
          fontSize: size * 0.36, boxShadow: `0 0 0 2px ${SS.surface}`,
        }}>+{ids.length - max}</div>
      )}
    </div>
  );
}

// Icon glyphs — simple, line-based SVG.
function Icon({ name, size = 22, color = 'currentColor', stroke = 1.6 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'groups': return (<svg {...common}><circle cx="9" cy="9" r="3.2"/><circle cx="17" cy="10.5" r="2.5"/><path d="M3 19c0-3 2.8-5 6-5s6 2 6 5"/><path d="M14.5 18.5c.3-2.2 2-3.5 4-3.5s3.3 1 3.5 2.5"/></svg>);
    case 'friends': return (<svg {...common}><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6"/></svg>);
    case 'activity': return (<svg {...common}><path d="M3 12h4l2.5-7 5 14 2.5-7H21"/></svg>);
    case 'profile': return (<svg {...common}><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6"/></svg>);
    case 'plus': return (<svg {...common} strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>);
    case 'chev': return (<svg {...common}><path d="M9 6l6 6-6 6"/></svg>);
    case 'chevL': return (<svg {...common}><path d="M15 6l-6 6 6 6"/></svg>);
    case 'chevD': return (<svg {...common}><path d="M6 9l6 6 6-6"/></svg>);
    case 'close': return (<svg {...common}><path d="M6 6l12 12M18 6L6 18"/></svg>);
    case 'check': return (<svg {...common}><path d="M5 13l4 4 10-10"/></svg>);
    case 'search': return (<svg {...common}><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>);
    case 'settings': return (<svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4.9a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2L5 5.8 3 9.3l2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-.9a7 7 0 0 0 2 1.2L10 21h4l.5-2.5a7 7 0 0 0 2-1.2l2.5.9 2-3.5-2-1.5c.1-.4.1-.8.1-1.2z"/></svg>);
    case 'receipt': return (<svg {...common}><path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>);
    case 'split': return (<svg {...common}><path d="M4 7l16 0M4 17l16 0"/><circle cx="8" cy="7" r="1.5"/><circle cx="16" cy="17" r="1.5"/></svg>);
    case 'wallet': return (<svg {...common}><path d="M3 7v12a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1 0-4h14"/><circle cx="17" cy="14" r="1.2" fill={color} stroke="none"/></svg>);
    case 'send': return (<svg {...common}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>);
    case 'camera': return (<svg {...common}><path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/></svg>);
    case 'cal': return (<svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>);
    case 'tag': return (<svg {...common}><path d="M12 3H5a2 2 0 0 0-2 2v7l9 9 9-9-9-9z"/><circle cx="8" cy="8" r="1.2" fill={color} stroke="none"/></svg>);
    case 'more': return (<svg {...common}><circle cx="5" cy="12" r="1.3" fill={color} stroke="none"/><circle cx="12" cy="12" r="1.3" fill={color} stroke="none"/><circle cx="19" cy="12" r="1.3" fill={color} stroke="none"/></svg>);
    case 'people': return (<svg {...common}><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.3"/><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5"/><path d="M15 19c0-2 1.8-3.5 4-3.5"/></svg>);
    case 'sheet': return (<svg {...common}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/></svg>);
    case 'edit': return (<svg {...common}><path d="M4 20h4l10-10-4-4L4 16v4z"/></svg>);
    case 'trash': return (<svg {...common}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>);
    case 'bell': return (<svg {...common}><path d="M6 15V10a6 6 0 0 1 12 0v5l2 3H4l2-3z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>);
    case 'globe': return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>);
    case 'lock': return (<svg {...common}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>);
    default: return null;
  }
}

// Big numeric balance with currency
function Money({ amount, currency, size = 24, weight = 600, color, italic = false, sign = false }) {
  const txt = window.CCY.format(amount, currency);
  return (
    <span style={{
      fontFamily: italic ? '"Instrument Serif", Georgia, serif' : 'Geist, system-ui',
      fontStyle: italic ? 'italic' : 'normal',
      fontWeight: italic ? 400 : weight,
      fontSize: size, letterSpacing: italic ? -0.5 : -0.2,
      color: color || SS.ink, lineHeight: 1, whiteSpace: 'nowrap',
    }}>
      {sign && amount > 0 ? '+' : ''}{txt}
    </span>
  );
}

// Simple pill / chip
function Chip({ children, color, bg, border, style }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 9px', borderRadius: 999,
      background: bg || SS.surfaceAlt, color: color || SS.ink2,
      border: border ? `1px solid ${border}` : '1px solid transparent',
      fontFamily: 'Geist, system-ui', fontSize: 11.5, fontWeight: 500,
      letterSpacing: 0.1, ...style,
    }}>{children}</span>
  );
}

// Filled button
function Button({ children, onClick, variant = 'primary', size = 'md', fullWidth, icon, style, disabled }) {
  const sizes = {
    sm: { h: 36, px: 14, fs: 14, r: 12 },
    md: { h: 48, px: 18, fs: 15, r: 14 },
    lg: { h: 54, px: 22, fs: 16, r: 16 },
  };
  const s = sizes[size];
  const variants = {
    primary: { bg: SS.ink, fg: '#FCFAF5', bd: 'transparent' },
    accent: { bg: SS.accent, fg: '#fff', bd: 'transparent' },
    ghost: { bg: 'transparent', fg: SS.ink, bd: SS.hairline },
    light: { bg: SS.surfaceAlt, fg: SS.ink, bd: 'transparent' },
    danger: { bg: '#FFFFFF', fg: SS.negative, bd: SS.hairline },
  };
  const v = variants[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      height: s.h, padding: `0 ${s.px}px`, borderRadius: s.r,
      background: v.bg, color: v.fg, border: `1px solid ${v.bd}`,
      fontFamily: 'Geist, system-ui', fontWeight: 600, fontSize: s.fs,
      letterSpacing: -0.1, cursor: 'pointer', display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center', gap: 8,
      width: fullWidth ? '100%' : undefined, whiteSpace: 'nowrap',
      opacity: disabled ? 0.4 : 1, transition: 'transform .08s ease',
      ...style,
    }}
      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

// Section header label
function SectionLabel({ children, action, onAction, style }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '14px 20px 8px', ...style,
    }}>
      <div style={{
        fontFamily: 'Geist, system-ui', fontSize: 11, fontWeight: 600,
        letterSpacing: 1.2, textTransform: 'uppercase', color: SS.muted,
        whiteSpace: 'nowrap',
      }}>{children}</div>
      {action && (
        <button onClick={onAction} style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontFamily: 'Geist, system-ui', fontSize: 13, fontWeight: 500,
          color: SS.accent,
        }}>{action}</button>
      )}
    </div>
  );
}

// Tap row
function Row({ left, title, sub, right, onClick, dense, style }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: dense ? '10px 20px' : '14px 20px',
      cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}>
      {left}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'Geist, system-ui', fontSize: 15, fontWeight: 500,
          color: SS.ink, letterSpacing: -0.1, lineHeight: 1.25,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{title}</div>
        {sub && (
          <div style={{
            fontFamily: 'Geist, system-ui', fontSize: 12.5, fontWeight: 400,
            color: SS.muted, marginTop: 2, lineHeight: 1.3,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{sub}</div>
        )}
      </div>
      {right}
    </div>
  );
}

// Screen scaffold
function Screen({ children, scroll = true, style }) {
  return (
    <div style={{
      height: '100%', background: SS.bg, color: SS.ink,
      overflow: scroll ? 'auto' : 'hidden',
      fontFamily: 'Geist, system-ui',
      ...style,
    }}>{children}</div>
  );
}

// Header bar (in-screen, not iOS chrome)
function Header({ leading, title, trailing, sub, large = false, style }) {
  return (
    <div style={{
      padding: large ? '8px 20px 4px' : '8px 16px',
      display: 'flex', flexDirection: 'column', gap: 4,
      ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36 }}>
        <div style={{ width: 36, display: 'flex', justifyContent: 'flex-start' }}>{leading}</div>
        <div style={{ flex: 1, textAlign: large ? 'left' : 'center', fontFamily: 'Geist, system-ui', fontSize: large ? 13 : 15, fontWeight: 600, color: large ? SS.muted : SS.ink, letterSpacing: large ? 0.4 : -0.1, textTransform: large ? 'uppercase' : 'none' }}>{large ? sub : title}</div>
        <div style={{ width: 36, display: 'flex', justifyContent: 'flex-end' }}>{trailing}</div>
      </div>
      {large && (
        <div style={{
          fontFamily: 'Geist, system-ui', fontSize: 30, fontWeight: 600,
          letterSpacing: -0.8, color: SS.ink, padding: '4px 0 8px',
        }}>{title}</div>
      )}
    </div>
  );
}

// Icon button in headers
function IconBtn({ name, onClick, size = 36, color = SS.ink, bg }) {
  return (
    <button onClick={onClick} style={{
      width: size, height: size, borderRadius: size,
      background: bg || 'transparent', border: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', padding: 0,
    }}>
      <Icon name={name} size={20} color={color} />
    </button>
  );
}

// Hairline divider
function HR({ inset = 20, style }) {
  return <div style={{ height: 1, background: SS.hairline, margin: `0 ${inset}px`, ...style }} />;
}

// Bottom tab bar
function TabBar({ active, onChange, onAdd }) {
  const tabs = [
    { id: 'home', label: 'Groups', icon: 'groups' },
    { id: 'friends', label: 'Friends', icon: 'friends' },
    { id: '_add', label: '', icon: 'plus' },
    { id: 'activity', label: 'Activity', icon: 'activity' },
    { id: 'profile', label: 'You', icon: 'profile' },
  ];
  return (
    <div style={{
      position: 'relative', background: SS.surface,
      borderTop: `1px solid ${SS.hairline}`,
      paddingBottom: 34, paddingTop: 8,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around',
    }}>
      {tabs.map(t => {
        if (t.id === '_add') {
          return (
            <button key={t.id} onClick={onAdd} style={{
              width: 56, height: 56, borderRadius: 999,
              background: SS.accent, border: '4px solid #FFF',
              boxShadow: `0 8px 20px ${SS.accent}66`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: -22, cursor: 'pointer', padding: 0,
            }}>
              <Icon name="plus" size={24} color="#fff" stroke={2.2} />
            </button>
          );
        }
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 3, padding: '2px 12px', minWidth: 56,
          }}>
            <Icon name={t.icon} size={22} color={isActive ? SS.ink : SS.muted} stroke={isActive ? 1.9 : 1.5} />
            <div style={{
              fontFamily: 'Geist, system-ui', fontSize: 10.5,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? SS.ink : SS.muted, letterSpacing: 0.1,
            }}>{t.label}</div>
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, {
  SS, Avatar, AvatarStack, Icon, Money, Chip, Button,
  SectionLabel, Row, Screen, Header, IconBtn, HR, TabBar,
});
