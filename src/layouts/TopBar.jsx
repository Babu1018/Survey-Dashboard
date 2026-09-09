import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, X, CheckCheck, Trash2 } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import useInboxStore from '../store/useInboxStore';
import { MONO, TONE, timeAgo } from '../utils/dashboardTheme';

// Tone per notification type, so the feed reads at a glance.
const TYPE_TONE = {
  submission_received: TONE.blue,
  submission_rejected: TONE.red,
  submission_approved: TONE.green,
  review_feedback: TONE.amber,
  review_decision: TONE.blue,
  survey_assigned: TONE.teal,
  survey_overdue: TONE.amber,
};

const TopBar = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const menuRef = useRef(null);
  const bellRef = useRef(null);

  const { items, unread, fetch: fetchInbox, markRead, markAllRead, remove, clearAll } = useInboxStore();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Poll, so a decision made elsewhere reaches this session without a reload.
  useEffect(() => {
    if (!user) return;
    fetchInbox();
    const t = setInterval(fetchInbox, 60000);
    return () => clearInterval(t);
  }, [user, fetchInbox]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/login');
  };

  const openNotification = (item) => {
    if (!item.is_read) markRead(item.id);
    setBellOpen(false);
    if (item.link) navigate(item.link);
  };

  return (
    <header style={{
      background: '#ffffff',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      margin: '1.25rem clamp(1rem, 2vw, 2.5rem) 0 clamp(1rem, 2vw, 2.5rem)',
      position: 'relative',
      zIndex: 100,
      boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '10px 24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>

          {/* ─── Notification bell ─────────────────────────────── */}
          <div ref={bellRef} style={{ position: 'relative' }}>
            <button
              title="Notifications"
              onClick={() => setBellOpen((open) => !open)}
              style={{
                position: 'relative',
                background: bellOpen ? 'var(--bg-hover)' : 'transparent',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <Bell size={18} style={{ flexShrink: 0 }} />
              {unread > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-1px',
                  right: '-2px',
                  minWidth: '15px',
                  height: '15px',
                  padding: '0 4px',
                  borderRadius: '8px',
                  background: '#ef4444',
                  color: 'white',
                  fontSize: '0.6rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #ffffff',
                }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {bellOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: 'min(380px, calc(100vw - 2rem))',
                maxHeight: '440px',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
                overflow: 'hidden',
                zIndex: 200,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.7rem 0.9rem',
                  borderBottom: '1px solid var(--border)',
                  gap: '8px',
                }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    Notifications{unread > 0 ? ' (' + unread + ')' : ''}
                  </span>
                  <span style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={markAllRead}
                      title="Mark all as read"
                      disabled={unread === 0}
                      style={{
                        width: '28px', height: '28px', padding: 0, borderRadius: '7px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'transparent', border: '1px solid var(--border)',
                        color: 'var(--text-muted)',
                        cursor: unread === 0 ? 'not-allowed' : 'pointer',
                        opacity: unread === 0 ? 0.45 : 1,
                      }}
                    >
                      <CheckCheck size={14} />
                    </button>
                    <button
                      onClick={clearAll}
                      title="Delete all notifications"
                      disabled={items.length === 0}
                      style={{
                        width: '28px', height: '28px', padding: 0, borderRadius: '7px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'transparent', border: '1px solid var(--border)',
                        color: '#ef4444',
                        cursor: items.length === 0 ? 'not-allowed' : 'pointer',
                        opacity: items.length === 0 ? 0.45 : 1,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>

                <div style={{ overflowY: 'auto' }}>
                  {items.length === 0 ? (
                    <div style={{
                      padding: '2.25rem 1rem', textAlign: 'center',
                      color: 'var(--text-muted)', fontSize: '0.85rem',
                    }}>
                      You have no notifications.
                    </div>
                  ) : items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => openNotification(item)}
                      style={{
                        display: 'flex', gap: '10px', alignItems: 'flex-start',
                        padding: '0.75rem 0.9rem',
                        borderBottom: '1px solid var(--border)',
                        background: item.is_read ? 'transparent' : 'rgba(var(--accent-primary-rgb), 0.05)',
                        cursor: item.link ? 'pointer' : 'default',
                      }}
                    >
                      <span style={{
                        width: '7px', height: '7px', borderRadius: '50%',
                        marginTop: '6px', flexShrink: 0,
                        background: TYPE_TONE[item.type] || TONE.grey,
                        opacity: item.is_read ? 0.35 : 1,
                      }} />

                      <div style={{ flexGrow: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.82rem',
                          fontWeight: item.is_read ? 500 : 700,
                          marginBottom: '2px',
                        }}>
                          {item.title}
                        </div>
                        {item.message && (
                          <div style={{
                            fontSize: '0.78rem', color: 'var(--text-muted)',
                            lineHeight: 1.45, wordBreak: 'break-word',
                          }}>
                            {item.message}
                          </div>
                        )}
                        <div style={{
                          fontFamily: MONO, fontSize: '0.65rem',
                          color: 'var(--text-muted)', marginTop: '4px',
                        }}>
                          {timeAgo(item.created_at)}
                        </div>
                      </div>

                      <button
                        onClick={(e) => { e.stopPropagation(); remove(item.id); }}
                        title="Delete notification"
                        style={{
                          width: '22px', height: '22px', padding: 0, flexShrink: 0,
                          borderRadius: '6px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'transparent', border: 'none',
                          color: 'var(--text-muted)', cursor: 'pointer',
                        }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--border)', margin: '0 0.25rem' }} />

          <div ref={menuRef} style={{ position: 'relative' }}>
            <div
              onClick={() => setMenuOpen((open) => !open)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
            >
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: '#0a46d1',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.85rem',
                boxShadow: 'var(--shadow-sm)',
                flexShrink: 0
              }}>
                {user?.role === 'Admin' ? 'AD' : (user?.username?.[0] || 'U').toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                  {user?.username === 'admin' ? 'Admin User' : (user?.username || 'User')}
                </span>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#0a46d1' }}>
                  {user?.role || 'Member'}
                </span>
              </div>
              <ChevronDown
                size={16}
                color="var(--text-muted)"
                style={{ transition: 'transform 0.2s', transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </div>

            {menuOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                minWidth: '180px',
                background: 'var(--bg-sidebar)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-md, 0 10px 30px rgba(0,0,0,0.15))',
                padding: '6px',
                zIndex: 200
              }}>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ef4444',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
