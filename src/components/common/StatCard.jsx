// Shared dashboard furniture: the coloured-cap stat card, the small status
// pill, the initials avatar and the table primitives used across the Manager
// and Users pages. Kept in one place so the dashboards cannot drift apart.
import { MONO, metaText, TONE } from '../../utils/dashboardTheme';

export const Pill = ({ text, color = TONE.grey, title }) => (
  <span
    title={title}
    style={{
      fontFamily: MONO,
      fontSize: '0.63rem',
      fontWeight: 700,
      color,
      background: `${color}1a`,
      padding: '3px 8px',
      borderRadius: '5px',
      whiteSpace: 'nowrap',
      display: 'inline-block',
    }}
  >
    {text}
  </span>
);

export const StatCard = ({ label, value, sub, icon, color = TONE.blue, onClick }) => (
  <div
    onClick={onClick}
    className="panel"
    style={{
      padding: '1rem 1.15rem',
      // The coloured cap is what distinguishes one metric from the next.
      borderTop: `3px solid ${color}`,
      cursor: onClick ? 'pointer' : 'default',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '0.55rem' }}>
      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>
      {icon && (
        <span style={{ color, background: `${color}1a`, padding: '6px', borderRadius: '8px', display: 'flex', flexShrink: 0 }}>
          {icon}
        </span>
      )}
    </div>
    <div style={{ fontSize: '1.9rem', fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ ...metaText, marginTop: '6px' }}>{sub}</div>}
  </div>
);

export const StatGrid = ({ children }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
  }}>
    {children}
  </div>
);

// Circular initials avatar used in the user tables and headers.
export const Avatar = ({ name, size = 34, square = false, background }) => (
  <div style={{
    width: size,
    height: size,
    minWidth: size,
    borderRadius: square ? size * 0.28 : '50%',
    background: background || 'var(--accent-primary)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: size * 0.4,
    flexShrink: 0,
  }}>
    {(name || '?').slice(0, 1).toUpperCase()}
  </div>
);

// ─── Table primitives ───────────────────────────────────────────────
// The dashboards share one table look: a tinted header strip of small
// uppercase labels over hairline-separated rows.

export const Th = ({ children, align = 'left', width }) => (
  <th style={{
    textAlign: align,
    width,
    padding: '0.6rem 0.9rem',
    fontSize: '0.66rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    background: 'var(--bg-main)',
    whiteSpace: 'nowrap',
  }}>
    {children}
  </th>
);

export const Td = ({ children, align = 'left', style }) => (
  <td style={{
    textAlign: align,
    padding: '0.7rem 0.9rem',
    borderTop: '1px solid var(--border)',
    fontSize: '0.85rem',
    verticalAlign: 'middle',
    ...style,
  }}>
    {children}
  </td>
);

// Wraps a table so wide content scrolls inside the card instead of pushing
// the page sideways.
export const TableWrap = ({ children }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
      {children}
    </table>
  </div>
);

export const PanelHeader = ({ title, action }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
    <h3 style={{ fontSize: '1.02rem' }}>{title}</h3>
    {action}
  </div>
);

export const LinkButton = ({ children, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px', padding: 0,
      background: 'none', border: 'none', cursor: 'pointer',
      color: 'var(--accent-primary)', fontWeight: 700, fontSize: '0.78rem',
    }}
  >
    {children}
  </button>
);

export const EmptyState = ({ children }) => (
  <div style={{
    padding: '2rem 1rem',
    border: '1px dashed var(--border)',
    borderRadius: '10px',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    textAlign: 'center',
  }}>
    {children}
  </div>
);
