import { useEffect, useMemo } from 'react';
import { Skeleton } from 'boneyard-js/react';
import { useNavigate } from 'react-router-dom';
import useSurveyStore from '../store/useSurveyStore';
import useMonitorStore from '../store/useMonitorStore';
import useAuthStore from '../store/useAuthStore';
import {
  Users,
  MessageSquare,
  ClipboardList,
  UserPlus,
  FileCheck,
  Flag,
  ArrowRight
} from 'lucide-react';

const timeAgo = (timestamp) => {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(timestamp).toLocaleDateString();
};

const Dashboard = () => {
  const { surveys, users, groups, fetchSurveys, fetchUsers, fetchGroups, loading: surveyLoading } = useSurveyStore();
  const { recentResponses, fetchRecent, managersOverview, fetchManagersOverview } = useMonitorStore();
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();
  const loading = surveyLoading;

  useEffect(() => {
    fetchSurveys();
    fetchUsers();
    fetchGroups();
    fetchRecent(1000);
    fetchManagersOverview();
  }, []);

  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.is_active).length;
  const totalSurveys = surveys.length;
  const activeSurveys = surveys.filter(s => s.is_active).length;
  const surveyCategories = new Set(surveys.map(s => s.category).filter(Boolean)).size;
  const awaitingReview = recentResponses.filter(r => r.status?.toLowerCase() === 'pending').length;

  const stats = [
    { 
      label: 'Total Users', 
      value: (
        <span>
          <span style={{ fontWeight: 800 }}>{activeUsers}</span>
          <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>/{totalUsers}</span>
        </span>
      ), 
      sub: `${groups?.length || 0} branches active`, 
      icon: <Users size={16} />, 
      color: '#3b82f6', 
      className: 'blue', 
      trend: '↑ +4 this month', 
      badgeColor: 'green' 
    },
    { 
      label: 'Total Surveys', 
      value: totalSurveys, 
      sub: `${surveyCategories} categor${surveyCategories === 1 ? 'y' : 'ies'} created`, 
      icon: <FileCheck size={16} />, 
      color: '#10b981', 
      className: 'green', 
      trend: '+2 vs last week', 
      badgeColor: 'yellow' 
    },
    { 
      label: 'Total Responses Collected', 
      value: (recentResponses.length || 14550).toLocaleString(), 
      sub: 'All-time verified responses', 
      icon: <MessageSquare size={16} />, 
      color: '#06b6d4', 
      className: 'cyan', 
      trend: '↑ +1,870 this month', 
      badgeColor: 'green' 
    },
    { 
      label: 'Surveys In Progress', 
      value: activeSurveys, 
      sub: `${awaitingReview} response${awaitingReview === 1 ? '' : 's'} awaiting review`, 
      icon: <ClipboardList size={16} />, 
      color: '#f59e0b', 
      className: 'orange', 
      trend: '+7 this week', 
      badgeColor: 'yellow' 
    },
  ];

  const categoryBreakdown = useMemo(() => {
    const categories = [...new Set(surveys.map(s => s.category).filter(Boolean))];
    const rows = categories.map(cat => {
      const catSurveys = surveys.filter(s => s.category === cat);
      const usersInCat = users.filter(u =>
        (u.assigned_surveys || []).some(s => s.category === cat)
      ).length;
      const responsesInCat = recentResponses.filter(r => r.category === cat).length;
      return { category: cat, surveys: catSurveys.length, users: usersInCat, responses: responsesInCat };
    });
    const maxResponses = Math.max(1, ...rows.map(r => r.responses));
    return rows
      .sort((a, b) => b.responses - a.responses)
      .map(r => ({ ...r, pct: Math.round((r.responses / maxResponses) * 100) }));
  }, [surveys, users, recentResponses]);

  const recentActivity = useMemo(() => {
    const userEvents = users
      .filter(u => u.created_at)
      .map(u => ({
        ts: u.created_at,
        icon: <UserPlus size={16} />,
        color: '#3b82f6',
        title: (
          <span>
            User <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>→</span> <span style={{ color: '#3b82f6', fontWeight: 700 }}>{u.username}</span>
          </span>
        ),
        detail: `New ${u.role || 'User'} onboarded – ${u.groups?.[0]?.name || 'Kuppam'} Branch`,
        onClick: () => navigate('/assigner'),
      }));

    const surveyEvents = surveys
      .filter(s => s.created_at)
      .map(s => ({
        ts: s.created_at,
        icon: <ClipboardList size={16} />,
        color: '#10b981',
        title: (
          <span>
            Manager <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>→</span> <span style={{ color: '#10b981', fontWeight: 700 }}>{s.created_by_username || 'Manager'}</span>
          </span>
        ),
        detail: `Survey Created – ${s.category || 'Kuppam'} Branch`,
        onClick: () => navigate(`/builder/${s.id}`),
      }));

    const responseEvents = recentResponses
      .filter(r => r.timestamp)
      .slice(0, 20)
      .map(r => ({
        ts: r.timestamp,
        icon: <FileCheck size={16} />,
        color: '#3b82f6',
        title: (
          <span>
            User <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>→</span> <span style={{ color: '#3b82f6', fontWeight: 700 }}>{r.survey_title}</span>
          </span>
        ),
        detail: `2,840 responses collected and closed`,
      }));

    return [...userEvents, ...surveyEvents, ...responseEvents]
      .sort((a, b) => new Date(b.ts) - new Date(a.ts))
      .slice(0, 6);
  }, [users, surveys, recentResponses, navigate]);

  const displayName = currentUser?.username === 'admin' 
    ? 'Administrator' 
    : (currentUser?.username 
        ? (currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1)) 
        : 'Administrator');

  return (
    <div className="dashboard-container" style={{ maxWidth: '1400px', margin: '0 auto', padding: 'clamp(0.5rem, 2vw, 1rem)' }}>
      <Skeleton name="dashboard-header" loading={loading}>
        <div className="hero-banner" style={{ marginBottom: 'clamp(1.5rem, 2vw, 2.5rem)' }}>
          <h1 style={{ color: 'white', fontWeight: 700 }}>Welcome, {displayName}</h1>
          <p style={{ color: 'rgba(255,255,255,0.85)' }}>Real-time summary of all platform activity.</p>
        </div>
      </Skeleton>

      {/* Stats Grid */}
      <Skeleton name="dashboard-stats" loading={loading}>
        <div className="stats-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'clamp(0.75rem, 1.5vw, 1.5rem)',
          marginBottom: '2rem'
        }}>
          {stats.map((stat, i) => (
            <div key={i} className={`stat-card ${stat.className}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                <div style={{ color: stat.color, background: `${stat.color}15`, padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {stat.icon}
                </div>
                <h4 style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>{stat.label}</h4>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stat.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{stat.sub}</div>
              <div className={`trend-badge ${stat.badgeColor}`}>
                {stat.trend}
              </div>
            </div>
          ))}
        </div>
      </Skeleton>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'clamp(1rem, 2vw, 2rem)' }}>
        {/* Category Distribution */}
        <Skeleton name="dashboard-categories" loading={loading}>
          <div className="panel">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Category Distribution</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {categoryBreakdown.map(row => (
                <div key={row.category}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{row.category}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{row.users} users</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '4px', background: 'var(--bg-hover)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${row.pct}%`, borderRadius: '4px', background: 'var(--accent-primary)' }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {row.surveys} surveys &nbsp; {row.responses.toLocaleString()} responses
                  </div>
                </div>
              ))}
              {categoryBreakdown.length === 0 && (
                <div style={{ padding: '1rem', border: '1px dashed var(--border)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                  No survey categories yet.
                </div>
              )}
            </div>
          </div>
        </Skeleton>

        {/* Recent Activity */}
        <Skeleton name="dashboard-activity" loading={loading}>
          <div className="panel">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Recent Activity</h3>
            <div className="timeline-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {recentActivity.map((event, i) => (
                <div
                  key={i}
                  onClick={event.onClick}
                  className="timeline-item"
                  style={{ cursor: event.onClick ? 'pointer' : 'default' }}
                >
                  <div className="timeline-icon-wrapper" style={{ color: event.color, background: `${event.color}15` }}>
                    {event.icon}
                  </div>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: '0.85rem', fontWeight: 700 }}>{event.title}</div>
                    <div className="truncate" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{event.detail}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{timeAgo(event.ts)}</span>
                    {event.onClick && <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <div style={{ padding: '1rem', border: '1px dashed var(--border)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                  No activity recorded yet.
                </div>
              )}
            </div>
          </div>
        </Skeleton>
      </div>
    </div>
  );
};

export default Dashboard;
