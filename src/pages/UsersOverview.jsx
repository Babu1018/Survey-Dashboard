import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useSurveyStore from '../store/useSurveyStore';
import useMonitorStore from '../store/useMonitorStore';
import useAuthStore from '../store/useAuthStore';
import {
  Users as UsersIcon,
  CheckCircle2,
  Inbox,
  UserX,
  ChevronRight,
} from 'lucide-react';
import {
  Pill, StatCard, StatGrid, Avatar,
  Th, Td, TableWrap, PanelHeader, LinkButton, EmptyState,
} from '../components/common/StatCard';
import { MONO, metaText, TONE } from '../utils/dashboardTheme';

// Splits an ISO timestamp into the two lines the LAST ACTIVE column shows.
const splitStamp = (iso) => {
  if (!iso) return { time: '—', date: '' };
  const d = new Date(iso);
  return {
    time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    date: d.toISOString().slice(0, 10),
  };
};

const UsersOverview = () => {
  const { users, fetchUsers, loginLogs, fetchLoginLogs } = useSurveyStore();
  const { recentResponses, fetchRecent, scopeAll, scopeUserIds, fetchScope } = useMonitorStore();
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
    fetchLoginLogs();
    fetchRecent(1000);
    fetchScope();
  }, []);

  // A Manager may only see the accounts assigned to them. The /api/users/
  // endpoint is not scoped server-side, so narrow it here using the same
  // group-membership scope /api/monitor/my-scope reports — not who has
  // already submitted, since a newly assigned user with no responses yet
  // still needs to show up here.
  const visibleUsers = useMemo(() => {
    const staff = users.filter(u => u.role === 'User');
    if (currentUser?.role !== 'Manager' || scopeAll) return staff;
    return staff.filter(u => scopeUserIds.has(u.id));
  }, [users, currentUser, scopeAll, scopeUserIds]);

  // Submission count and latest activity per user id.
  const activity = useMemo(() => {
    const map = new Map();
    for (const r of recentResponses) {
      if (r.user_id == null) continue;
      const row = map.get(r.user_id) || { count: 0, latest: null };
      row.count += 1;
      if (!row.latest || new Date(r.timestamp) > new Date(row.latest)) row.latest = r.timestamp;
      map.set(r.user_id, row);
    }
    // Fall back to the login log when a user has never submitted anything.
    for (const log of loginLogs) {
      if (log.user_id == null) continue;
      const row = map.get(log.user_id) || { count: 0, latest: null };
      if (!row.latest || new Date(log.logged_in_at) > new Date(row.latest)) row.latest = log.logged_in_at;
      map.set(log.user_id, row);
    }
    return map;
  }, [recentResponses, loginLogs]);

  const activeCount = visibleUsers.filter(u => u.is_active).length;
  const inactiveCount = visibleUsers.length - activeCount;
  const totalSubmissions = useMemo(
    () => visibleUsers.reduce((sum, u) => sum + (activity.get(u.id)?.count || 0), 0),
    [visibleUsers, activity]
  );

  const rows = useMemo(
    () => [...visibleUsers].sort((a, b) => {
      const at = activity.get(a.id)?.latest;
      const bt = activity.get(b.id)?.latest;
      if (!at && !bt) return a.username.localeCompare(b.username);
      if (!at) return 1;
      if (!bt) return -1;
      return new Date(bt) - new Date(at);
    }),
    [visibleUsers, activity]
  );

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: 'clamp(0.5rem, 2vw, 1rem)' }}>

      {/* ─── Page heading ───────────────────────────────────────── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontWeight: 800, color: 'var(--accent-secondary)', marginBottom: '0.3rem' }}>Users</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>View all the Survey users assigned</p>
      </div>

      {/* ─── Stats ──────────────────────────────────────────────── */}
      <StatGrid>
        <StatCard label="Total Users" value={visibleUsers.length} icon={<UsersIcon size={16} />} color={TONE.blue} />
        <StatCard label="Active Users" value={activeCount} icon={<CheckCircle2 size={16} />} color={TONE.green} />
        <StatCard label="Total Submissions" value={totalSubmissions} icon={<Inbox size={16} />} color={TONE.teal} />
        <StatCard label="Inactive Users" value={inactiveCount} icon={<UserX size={16} />} color={TONE.amber} />
      </StatGrid>

      {/* ─── Performance table ──────────────────────────────────── */}
      <div className="panel" style={{ padding: '1.15rem 1.25rem' }}>
        <PanelHeader
          title="Performance"
          action={<LinkButton onClick={() => navigate('/user-logs')}>View All <ChevronRight size={13} /></LinkButton>}
        />

        {rows.length === 0 ? (
          <EmptyState>No users to show yet.</EmptyState>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Status</Th>
                <Th align="center">Submissions</Th>
                <Th align="center">Last Active</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const act = activity.get(u.id) || { count: 0, latest: null };
                const stamp = splitStamp(act.latest);
                return (
                  <tr key={u.id}>
                    <Td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <Avatar name={u.username} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="truncate" style={{ fontWeight: 600 }}>{u.username}</span>
                            <Pill text={u.role} color={TONE.amber} />
                          </div>
                          <div className="truncate" style={metaText}>{u.email || 'No email'}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Pill
                        text={u.is_active ? 'Active' : 'Inactive'}
                        color={u.is_active ? TONE.green : TONE.amber}
                      />
                    </Td>
                    <Td align="center" style={{ fontWeight: 600 }}>{act.count}</Td>
                    <Td align="center">
                      <div style={{ fontFamily: MONO, fontSize: '0.78rem', fontWeight: 700 }}>{stamp.time}</div>
                      <div style={metaText}>{stamp.date}</div>
                    </Td>
                    <Td align="right">
                      <LinkButton onClick={() => navigate(`/users/${u.id}`)}>View</LinkButton>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </div>
    </div>
  );
};

export default UsersOverview;
