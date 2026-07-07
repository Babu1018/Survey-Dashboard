import { Moon, Sun } from 'lucide-react';

const TopBar = ({ isDark, setIsDark }) => {
  return (
    <header style={{
      background: 'rgba(var(--bg-sidebar-rgb), 0.8)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `clamp(0.75rem, 1.2vw, 1.5rem) clamp(1rem, 2vw, 2.5rem)`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Survey Dashboard</h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Management System</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setIsDark(!isDark)}
              style={{
                background: 'var(--bg-hover)',
                border: '1px solid var(--border)',
                padding: '4px 8px',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: isDark ? 'var(--accent-primary)' : 'var(--bg-sidebar)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.3s'
              }}>
                {isDark ? <Moon size={14} color="white" /> : <Sun size={14} color="#000000" strokeWidth={2.5} />}
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, paddingRight: '4px' }}>{isDark ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
