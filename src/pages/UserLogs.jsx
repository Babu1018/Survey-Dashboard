import { useEffect, useMemo, useState } from 'react';
import { History, RefreshCw, Search, ChevronDown } from 'lucide-react';
import useSurveyStore from '../store/useSurveyStore';
import useMonitorStore from '../store/useMonitorStore';
import { timeAgo } from '../utils/dashboardTheme';

// There's no real session/presence tracking in this app (JWTs are stateless,
// logins aren't paired with a logout event), so "online" is approximated from
// how recently each user last logged in — labeled "Active"/"Away" rather than
// "Online"/"Offline" so it doesn't claim to know more than it does.
const RECENT_ACTIVE_MINUTES = 15;

const STATUS_COLORS = {
  Success: { fg: '#10b981', bg: '#ecfdf5' },
  Approved: { fg: '#10b981', bg: '#ecfdf5' },
  Pending: { fg: '#f59e0b', bg: '#fffbeb' },
  Rejected: { fg: '#ef4444', bg: '#fef2f2' },
  Resolved: { fg: '#3b82f6', bg: '#eff6ff' },
};
const statusColorsFor = (status) => STATUS_COLORS[status] || { fg: 'var(--text-muted)', bg: 'var(--bg-hover)' };

const formatLoggedAt = (value) => {
  if (!value) return '—';
  const d = new Date(value.endsWith('Z') || value.includes('+') ? value : `${value}Z`);
  if (isNaN(d.getTime())) return value;
  
  // Format like "26 Aug 2026, 10:02:10 am"
  const day = d.getDate();
  const month = d.toLocaleDateString([], { month: 'short' });
  const year = d.getFullYear();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase();
  
  return `${day} ${month} ${year}, ${time}`;
};

const roleBadgeColors = (role) => {
  if (role === 'Admin') return { fg: '#ef4444', bg: '#fef2f2' };
  if (role === 'Manager' || role === 'Lead') return { fg: '#3b82f6', bg: '#eff6ff' };
  return { fg: '#10b981', bg: '#ecfdf5' }; // Surveyor / User
};

const UserLogs = () => {
  const { loginLogs, loginLogsLoading, fetchLoginLogs, users, fetchUsers } = useSurveyStore();
  const { recentResponses, fetchRecent, connected, connectWebSocket } = useMonitorStore();
  
  const [search, setSearch] = useState('');
  const [activityType, setActivityType] = useState('All Activities');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Read once per tick (rather than calling Date.now() during render) so the
  // Active/Away presence label stays a pure render read, and refreshes every
  // 30s while the page is open.
  const [now, setNow] = useState(0);

  useEffect(() => {
    fetchLoginLogs();
    fetchRecent();
    fetchUsers();
    if (!connected) connectWebSocket();
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, activityType, roleFilter]);

  // Combine and map into single unified log list
  const combinedLogs = useMemo(() => {
    const list = [];

    // 1. Add Login logs
    loginLogs.forEach(log => {
      list.push({
        id: `login-${log.id}`,
        type: 'login',
        user: log.username,
        role: log.role || 'User',
        action: 'Logged in',
        survey: '—',
        status: 'Success',
        timestamp: log.logged_in_at
      });
    });

    // 2. Add Survey responses/reviews
    recentResponses.forEach(res => {
      // Submission action
      list.push({
        id: `submit-${res.id}`,
        type: 'submit',
        user: res.respondent || 'Anonymous',
        role: users.find(u => u.username === res.respondent || u.email === res.respondent)?.role || 'User',
        action: 'submitted response',
        survey: res.survey_title || 'general',
        status: res.status || 'Pending',
        timestamp: res.timestamp
      });

      // Review action if response has been reviewed
      if (res.status && res.status !== 'Pending') {
        const actionName = res.status === 'Approved' ? 'approved response'
                         : res.status === 'Rejected' ? 'reassigned response'
                         : res.status === 'Resolved' ? 'resolved response'
                         : `${res.status.toLowerCase()} response`;
        list.push({
          id: `review-${res.id}`,
          type: 'review',
          user: res.reviewed_by_username || 'Manager',
          role: users.find(u => u.username === res.reviewed_by_username)?.role || 'Manager',
          action: actionName,
          survey: res.survey_title || 'general',
          status: res.status,
          timestamp: res.reviewed_at || res.timestamp
        });
      }
    });

    // Sort descending by timestamp
    return list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [loginLogs, recentResponses, users]);

  // Dynamic lists of users with logged activity
  const activeRoles = ['All Roles', 'Admin', 'Manager', 'User'];

  // Most recent login timestamp per username, to approximate presence.
  const lastLoginByUser = useMemo(() => {
    const map = new Map();
    loginLogs.forEach(log => {
      const prev = map.get(log.username);
      if (!prev || new Date(log.logged_in_at) > new Date(prev)) map.set(log.username, log.logged_in_at);
    });
    return map;
  }, [loginLogs]);

  // Filtering
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return combinedLogs.filter(log => {
      const matchesSearch = !term ||
        (log.user || '').toLowerCase().includes(term) ||
        (log.action || '').toLowerCase().includes(term) ||
        (log.survey || '').toLowerCase().includes(term);

      const matchesType = activityType === 'All Activities' ||
        (activityType === 'Logins' && log.type === 'login') ||
        (activityType === 'Submissions' && log.type === 'submit') ||
        (activityType === 'Reviews' && log.type === 'review');

      const matchesRole = roleFilter === 'All Roles' || log.role === roleFilter;

      return matchesSearch && matchesType && matchesRole;
    });
  }, [combinedLogs, search, activityType, roleFilter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const gridTemplate = '110px minmax(130px, 1.2fr) minmax(100px, 1fr) minmax(180px, 2fr) minmax(150px, 1.5fr) minmax(200px, 1.8fr)';

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflow: 'hidden' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', margin: 0, color: 'var(--text-main)' }}>
            <History size={22} style={{ color: 'var(--accent-primary)' }} />
            Activity Log
          </h1>
          <span
            title={connected ? 'Live — new activity streams in automatically' : 'Offline — reconnecting…'}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '4px 12px', borderRadius: '20px',
              background: connected ? '#ecfdf5' : '#fef2f2',
              color: connected ? '#10b981' : '#ef4444',
              fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em'
            }}
          >
            <span style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: connected ? '#10b981' : '#ef4444',
              animation: connected ? 'pulse 1.5s ease-in-out infinite' : 'none'
            }} />
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
        <button
          onClick={() => { fetchLoginLogs(); fetchRecent(); }}
          disabled={loginLogsLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 16px', borderRadius: '10px',
            border: '1px solid var(--border)', background: 'var(--bg-sidebar)',
            color: 'var(--text-main)', fontWeight: 700, fontSize: '0.82rem',
            cursor: 'pointer', height: '38px'
          }}
        >
          <RefreshCw size={14} className={loginLogsLoading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        gap: '12px', 
        flexWrap: 'wrap',
        background: 'var(--bg-sidebar)',
        padding: '0.75rem 1.25rem',
        borderRadius: '16px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'var(--bg-hover)', padding: '0.4rem 1rem',
          borderRadius: '10px', border: '1px solid var(--border)',
          height: '38px', flex: '1 1 300px', maxWidth: '400px', boxSizing: 'border-box'
        }}>
          <Search size={16} color="var(--text-muted)" style={{ opacity: 0.7 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs by name, survey, action..."
            style={{ border: 'none', background: 'transparent', padding: '4px 0', fontSize: '0.85rem', flexGrow: 1, outline: 'none', color: 'var(--text-main)' }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Role Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Filter by Role:</span>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setRoleDropdownOpen(o => !o); setTypeDropdownOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '0 12px', borderRadius: '10px',
                  background: 'var(--bg-hover)', border: '1px solid var(--border)',
                  color: 'var(--text-main)', fontWeight: 600, fontSize: '0.8rem',
                  cursor: 'pointer', whiteSpace: 'nowrap', height: '36px', boxSizing: 'border-box'
                }}
              >
                {roleFilter}
                <ChevronDown size={14} color="var(--text-muted)" style={{ transform: roleDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
              {roleDropdownOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  background: 'var(--bg-sidebar)', border: '1px solid var(--border)',
                  borderRadius: '10px', overflow: 'hidden', zIndex: 200,
                  boxShadow: '0 8px 24px rgba(0,0,0,.15)', minWidth: '150px'
                }}>
                  {activeRoles.map((r) => (
                    <button
                      key={r}
                      onClick={() => { setRoleFilter(r); setRoleDropdownOpen(false); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '8px 14px', border: 'none', cursor: 'pointer',
                        background: roleFilter === r ? 'rgba(var(--accent-primary-rgb),.06)' : 'transparent',
                        color: roleFilter === r ? 'var(--accent-primary)' : 'var(--text-main)',
                        fontWeight: roleFilter === r ? 700 : 500, fontSize: '0.82rem'
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Activity Type Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Activity Type:</span>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setTypeDropdownOpen(o => !o); setRoleDropdownOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '0 12px', borderRadius: '10px',
                  background: 'var(--bg-hover)', border: '1px solid var(--border)',
                  color: 'var(--text-main)', fontWeight: 600, fontSize: '0.8rem',
                  cursor: 'pointer', whiteSpace: 'nowrap', height: '36px', boxSizing: 'border-box'
                }}
              >
                {activityType}
                <ChevronDown size={14} color="var(--text-muted)" style={{ transform: typeDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
              {typeDropdownOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  background: 'var(--bg-sidebar)', border: '1px solid var(--border)',
                  borderRadius: '10px', overflow: 'hidden', zIndex: 200,
                  boxShadow: '0 8px 24px rgba(0,0,0,.15)', minWidth: '150px'
                }}>
                  {['All Activities', 'Logins', 'Submissions', 'Reviews'].map((t) => (
                    <button
                      key={t}
                      onClick={() => { setActivityType(t); setTypeDropdownOpen(false); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '8px 14px', border: 'none', cursor: 'pointer',
                        background: activityType === t ? 'rgba(var(--accent-primary-rgb),.06)' : 'transparent',
                        color: activityType === t ? 'var(--accent-primary)' : 'var(--text-main)',
                        fontWeight: activityType === t ? 700 : 500, fontSize: '0.82rem'
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Grid */}
      <div className="panel" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <div style={{ minWidth: '900px' }}>
            {/* Headers */}
            <div style={{
              display: 'grid', 
              gridTemplateColumns: gridTemplate,
              padding: '1rem 1.5rem', 
              background: 'var(--bg-hover)',
              borderBottom: '1px solid var(--border)', 
              color: 'var(--text-muted)',
              fontSize: '0.72rem', 
              fontWeight: 800, 
              textTransform: 'uppercase',
              letterSpacing: '0.06em', 
              alignItems: 'center'
            }}>
              <span>Status</span>
              <span>User</span>
              <span>Role</span>
              <span>Action</span>
              <span>Survey</span>
              <span>Timestamp</span>
            </div>

            {/* List Rows */}
            <div style={{ overflowY: 'auto' }}>
              {paginated.map((log, i) => {
                const roleColors = roleBadgeColors(log.role);
                const statusColors = statusColorsFor(log.status);
                const lastSeen = lastLoginByUser.get(log.user);
                const isActive = now > 0 && !!lastSeen && (now - new Date(lastSeen).getTime()) <= RECENT_ACTIVE_MINUTES * 60000;

                return (
                  <div
                    key={log.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: gridTemplate,
                      padding: '12px 24px',
                      borderBottom: '1px solid var(--border)',
                      fontSize: '0.88rem',
                      alignItems: 'center',
                      backgroundColor: i % 2 === 1 ? 'rgba(148, 163, 184, 0.09)' : 'transparent'
                    }}
                  >
                    {/* Status */}
                    <div>
                      <span style={{
                        fontSize: '0.65rem',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontWeight: 800,
                        background: statusColors.bg,
                        color: statusColors.fg,
                        whiteSpace: 'nowrap',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em'
                      }}>
                        {log.status}
                      </span>
                    </div>

                    {/* User */}
                    <div>
                      <div
                        style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}
                        title={isActive ? 'Active in the last 15 minutes' : (lastSeen ? `Away — last login ${timeAgo(lastSeen)}` : 'Away — no recorded login')}
                      >
                        <span style={{
                          width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                          background: isActive ? '#10b981' : 'var(--text-muted)',
                          animation: isActive ? 'pulse 1.5s ease-in-out infinite' : 'none'
                        }} />
                        {log.user}
                      </div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 600, marginTop: '2px', color: isActive ? '#10b981' : 'var(--text-muted)' }}>
                        {isActive ? 'Active' : (lastSeen ? `Away · ${timeAgo(lastSeen)}` : 'Away')}
                      </div>
                    </div>

                    {/* Role Tag */}
                    <div>
                      <span style={{
                        fontSize: '0.65rem', 
                        padding: '3px 10px', 
                        borderRadius: '20px',
                        fontWeight: 800, 
                        background: roleColors.bg, 
                        color: roleColors.fg, 
                        whiteSpace: 'nowrap',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em'
                      }}>
                        {log.role}
                      </span>
                    </div>

                    {/* Action */}
                    <div style={{ color: 'var(--text-main)', fontWeight: 500 }}>
                      {log.action}
                    </div>

                    {/* Survey */}
                    <div>
                      {log.survey !== '—' ? (
                        <span style={{ color: '#10b981', fontWeight: 700 }}>
                          {log.survey}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      {formatLoggedAt(log.timestamp)}
                    </div>
                  </div>
                );
              })}

              {/* Empty State */}
              {paginated.length === 0 && (
                <div style={{ padding: '6rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <History size={40} style={{ opacity: 0.15, marginBottom: '0.75rem' }} />
                  <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: 0 }}>No matching activities found.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.75rem 1.5rem', borderTop: '1px solid var(--border)', background: 'var(--bg-hover)'
          }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} entries
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                  background: currentPage === 1 ? 'transparent' : 'var(--bg-sidebar)',
                  color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-main)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.5 : 1, fontWeight: 700, fontSize: '0.78rem'
                }}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                if (totalPages > 5) {
                  if (page !== 1 && page !== totalPages && Math.abs(page - currentPage) > 1) {
                    if (page === 2 || page === totalPages - 1) {
                      return <span key={page} style={{ padding: '5px 4px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>..</span>;
                    }
                    return null;
                  }
                }
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    style={{
                      padding: '5px 12px', borderRadius: '8px',
                      border: page === currentPage ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                      background: page === currentPage ? 'var(--accent-primary)' : 'var(--bg-sidebar)',
                      color: page === currentPage ? 'white' : 'var(--text-main)',
                      cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem'
                    }}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                  background: currentPage === totalPages ? 'transparent' : 'var(--bg-sidebar)',
                  color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-main)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.5 : 1, fontWeight: 700, fontSize: '0.78rem'
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserLogs;
