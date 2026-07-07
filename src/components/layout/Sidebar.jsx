import { Link, useLocation } from 'react-router-dom';
import { 
  Users, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  SquarePen,
  FileCheck,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';

const Sidebar = ({ isCollapsed, setIsCollapsed }) => {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const navItems = [
    { name: 'Create Survey', path: '/builder', icon: <SquarePen size={20} /> },
    { name: 'Survey List', path: '/surveys', icon: <ClipboardList size={20} /> },
    { name: 'Create/Edit User', path: '/assigner', icon: <Users size={20} /> },
    { name: 'Survey Report', path: '/monitor', icon: <FileCheck size={20} /> },
  ];

  return (
    <aside className={isCollapsed ? 'collapsed' : ''} style={{ position: 'relative' }}>
      <div className="overlay-line" />
      
      <div style={{ 
        marginBottom: '2.5rem', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: isCollapsed ? 'center' : 'space-between'
      }}>
        {!isCollapsed && <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.5px' }}>LOGO</span>}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border)', 
            padding: '8px', 
            borderRadius: '10px',
            color: 'var(--text-main)',
            width: '38px',
            height: '38px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      <nav>
        {navItems.map((item, i) => (
          <Link 
            key={i} 
            to={item.path} 
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            style={{ 
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              padding: isCollapsed ? '0.85rem' : '0.85rem 1.25rem',
              borderRadius: '12px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            title={item.name}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '24px'
            }}>
              {item.icon}
            </div>
            {!isCollapsed && <span style={{ marginLeft: '4px' }}>{item.name}</span>}
          </Link>
        ))}
      </nav>

      <div style={{ 
        marginTop: 'auto', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px',
        paddingTop: '1.5rem',
        borderTop: '1px solid var(--border)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          padding: isCollapsed ? '0.5rem' : '1rem',
          background: 'rgba(var(--accent-primary-rgb), 0.05)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          justifyContent: isCollapsed ? 'center' : 'space-between'
        }}>
          {!isCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
              <div style={{ 
                minWidth: '40px', 
                height: '40px', 
                borderRadius: '12px', 
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'white',
                fontWeight: 800,
                fontSize: '0.9rem',
                boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
              }}>{user?.username?.[0] || 'U'}</div>
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {user?.username || 'User'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {user?.role || 'Member'}
                </span>
              </div>
            </div>
          )}
          <button 
            onClick={logout}
            style={{ 
              background: 'var(--bg-main)', 
              border: '1px solid var(--border)', 
              padding: '8px', 
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.background = '#ef4444';
              e.currentTarget.style.borderColor = '#ef4444';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.background = 'var(--bg-main)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
            title="Sign Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

