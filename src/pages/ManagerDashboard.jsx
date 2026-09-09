import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useMonitorStore from '../store/useMonitorStore';
import useAuthStore from '../store/useAuthStore';
import { MONO, metaText, timeAgo } from '../utils/dashboardTheme';
import {
  ClipboardList,
  CheckCircle2,
  ClipboardCheck,
  Users,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import {
  StatCard, StatGrid, PanelHeader, LinkButton, EmptyState,
} from '../components/common/StatCard';

// Status palette for this dashboard. Note this intentionally reads Approved as
// green, where utils/statusBadge.js reads it as blue for the monitor views.
const STATUS = {
  Approved: { label: 'Approved', color: '#10b981' },
  Rejected: { label: 'Declined', color: '#ef4444' },
  Pending: { label: 'Pending', color: '#f59e0b' },
};
const statusOf = (s) => STATUS[s] || { label: s || 'Unknown', color: '#64748b' };

const ManagerDashboard = () => {
  const { recentResponses, connected, connectWebSocket, fetchRecent } = useMonitorStore();
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecent(1000);
    if (!connected) connectWebSocket();
  }, []);

  const pending = useMemo(() => recentResponses.filter(r => r.status === 'Pending'), [recentResponses]);
  const approved = useMemo(() => recentResponses.filter(r => r.status === 'Approved'), [recentResponses]);
  const declined = useMemo(() => recentResponses.filter(r => r.status === 'Rejected'), [recentResponses]);

  // Newest first, regardless of status — this is an activity feed.
  const recentAccess = useMemo(
    () => [...recentResponses]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8),
    [recentResponses]
  );

  // One progress row per survey, tallied from the responses in this
  // manager's scope.
  const surveyProgress = useMemo(() => {
    const bySurvey = new Map();
    for (const r of recentResponses) {
      const key = r.survey_title || 'Untitled survey';
      if (!bySurvey.has(key)) {
        bySurvey.set(key, { title: key, category: r.category, total: 0, approved: 0, declined: 0, pending: 0, latest: null });
      }
      const row = bySurvey.get(key);
      row.total += 1;
      if (r.status === 'Approved') row.approved += 1;
      else if (r.status === 'Rejected') row.declined += 1;
      else row.pending += 1;
      if (!row.latest || new Date(r.timestamp) > new Date(row.latest)) row.latest = r.timestamp;
    }
    return [...bySurvey.values()].sort((a, b) => new Date(b.latest) - new Date(a.latest));
  }, [recentResponses]);

  const fieldUsers = useMemo(
    () => new Set(recentResponses.map(r => r.respondent).filter(Boolean)).size,
    [recentResponses]
  );
  const activeSurveys = surveyProgress.filter(s => s.pending > 0).length;

  const stats = [
    {
      label: 'Surveys Assigned',
      value: surveyProgress.length,
      sub: `${activeSurveys} Active`,
      icon: <ClipboardList size={17} />,
      color: '#3b82f6',
    },
    {
      label: 'Questions Reviewed',
      value: approved.length + declined.length,
      sub: `${approved.length} approved · ${declined.length} declined`,
      icon: <CheckCircle2 size={17} />,
      color: '#10b981',
    },
    {
      label: 'Pending Questions',
      value: pending.length,
      sub: 'Needs your action',
      icon: <ClipboardCheck size={17} />,
      color: '#f59e0b',
      onClick: () => navigate('/review'),
    },
    {
      label: 'Field Users',
      value: fieldUsers,
      sub: `${fieldUsers} active in branch`,
      icon: <Users size={17} />,
      color: '#14b8a6',
    },
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: 'clamp(0.5rem, 2vw, 1rem)' }}>

      {/* ─── Welcome banner ─────────────────────────────────────── */}
      <div className="hero-banner" style={{ marginBottom: 'clamp(1.25rem, 2vw, 1.75rem)' }}>
        <h1 style={{ color: 'white', fontWeight: 700 }}>
          Welcome, {currentUser?.username || 'Manager'}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.85)' }}>
          {pending.length > 0
            ? `You have ${pending.length} survey ${pending.length === 1 ? 'question' : 'questions'} awaiting your review today.`
            : 'You have nothing awaiting review today.'}
        </p>
      </div>

      {/* ─── Stat cards ─────────────────────────────────────────── */}
      <StatGrid>
        {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </StatGrid>

      {/* ─── Feed + progress ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>

        {/* Your Recent Access */}
        <div className="panel" style={{ padding: '1.15rem 1.25rem' }}>
          <PanelHeader
            title="Your Recent Access"
            action={<LinkButton onClick={() => navigate('/review')}>View all <ArrowRight size={13} /></LinkButton>}
          />

          <div>
            {recentAccess.map((r, idx) => {
              const st = statusOf(r.status);
              return (
                <div
                  key={r.id}
                  onClick={() => navigate(r.user_id ? `/users/${r.user_id}` : `/monitor?open=${r.id}`)}
                  style={{
                    padding: '0.7rem 0',
                    borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: st.color, flexShrink: 0 }} />
                    <span style={{ fontFamily: MONO, fontSize: '0.68rem', fontWeight: 700, color: st.color }}>{st.label}</span>
                    <span style={metaText}>{timeAgo(r.timestamp)}</span>
                    {r.has_red_flag && <AlertCircle size={12} color="#ef4444" />}
                  </div>
                  <div className="truncate" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '2px' }}>
                    {r.respondent || 'Anonymous'}
                  </div>
                  <div className="truncate" style={metaText}>{r.survey_title}</div>
                </div>
              );
            })}
            {recentAccess.length === 0 && (
              <EmptyState>
                No activity yet.
              </EmptyState>
            )}
          </div>
        </div>

        {/* Survey Review Progress */}
        <div className="panel" style={{ padding: '1.15rem 1.25rem' }}>
          <h3 style={{ fontSize: '1.02rem', marginBottom: '0.9rem' }}>Survey Review Progress</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {surveyProgress.map((s) => {
              const inReview = s.pending > 0;
              const pill = inReview
                ? { text: 'In Review', color: '#3b82f6' }
                : { text: 'Complete', color: '#10b981' };
              const pct = (n) => (s.total ? (n / s.total) * 100 : 0);
              return (
                <div key={s.title} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '0.8rem 0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
                    <div className="truncate" style={{ fontSize: '0.88rem', fontWeight: 600 }}>{s.title}</div>
                    <div style={{ ...metaText, flexShrink: 0 }}>{s.approved}/{s.total}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '7px 0 9px' }}>
                    <span style={{
                      fontFamily: MONO, fontSize: '0.62rem', fontWeight: 700, color: pill.color,
                      background: `${pill.color}1a`, padding: '2px 7px', borderRadius: '5px',
                    }}>{pill.text}</span>
                    <span style={metaText}>{s.category || 'Uncategorised'} · {timeAgo(s.latest)}</span>
                  </div>

                  {/* Segmented bar: approved | declined, with the pending remainder left grey */}
                  <div style={{ display: 'flex', height: '5px', borderRadius: '3px', overflow: 'hidden', background: 'var(--bg-hover)' }}>
                    <div style={{ width: `${pct(s.approved)}%`, background: '#10b981' }} />
                    <div style={{ width: `${pct(s.declined)}%`, background: '#ef4444' }} />
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '7px', fontFamily: MONO, fontSize: '0.65rem' }}>
                    <span style={{ color: '#10b981' }}>{s.approved} Approved</span>
                    <span style={{ color: '#f59e0b' }}>{s.pending} Pending</span>
                    <span style={{ color: '#ef4444' }}>{s.declined} Declined</span>
                  </div>
                </div>
              );
            })}
            {surveyProgress.length === 0 && (
              <EmptyState>
                No surveys in your scope yet.
              </EmptyState>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
