import { Link, useLocation } from 'react-router-dom';
import {
  Users,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Folder,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  Settings,
  BookOpen,
  UserCog
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

// Admin already administers accounts through Manage Users, so the read-only
// Users overview is not a separate Admin destination; it stays a Manager one.
const ADMIN_NAV_ITEMS = [
  { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
  { name: 'Branches', path: '/surveys', icon: <Folder size={20} /> },
  { name: 'Manage Users', path: '/assigner', icon: <UserCog size={20} /> },
  { name: 'Activity Log', path: '/user-logs', icon: <BookOpen size={20} /> },
];

// Managers review what users submit rather than author surveys or manage
// accounts. They reach reports through Users -> a user -> that user's
// submission history, so the flat report list is not a nav destination; the
// /monitor route remains for the deep links those pages produce.
const MANAGER_NAV_ITEMS = [
  { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
  { name: 'Users', path: '/users', icon: <Users size={20} /> },
  { name: 'Surveys', path: '/review', icon: <Folder size={20} /> },
];

// A credential User only ever needs their own assigned survey and history,
// so their sidebar is trimmed to a single destination.
const USER_NAV_ITEMS = [
  { name: 'My Survey', path: '/', icon: <Folder size={20} /> },
];

const Sidebar = ({ isCollapsed, setIsCollapsed }) => {
  const location = useLocation();
  const { user } = useAuthStore();

  const navItems = user?.role === 'Manager' ? MANAGER_NAV_ITEMS
    : user?.role === 'User' ? USER_NAV_ITEMS
    : ADMIN_NAV_ITEMS;

  return (
    <aside className={isCollapsed ? 'collapsed' : ''} style={{ position: 'relative' }}>
      <div className="overlay-line" />
      
      <div style={{ 
        marginBottom: '2.5rem', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: isCollapsed ? 'center' : 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          <div style={{
            minWidth: '30px',
            width: '30px',
            height: '30px',
            borderRadius: '9px',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 800,
            fontSize: '0.75rem',
            boxShadow: 'var(--shadow-sm)',
            flexShrink: 0
          }}>SF</div>
          {!isCollapsed && <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>SurveyFlow</span>}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            padding: '8px',
            borderRadius: '10px',
            color: 'white',
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

    </aside>
  );
};

export default Sidebar;

