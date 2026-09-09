import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import useSurveyStore from '../store/useSurveyStore';
import { getBranches, getBranchSwatch } from '../utils/branchPalette';
import { ClipboardList, CheckCircle2, Clock, ChevronRight, FileClock } from 'lucide-react';
import { Pill, StatCard, StatGrid, Th, Td, TableWrap, EmptyState } from '../components/common/StatCard';
import { metaText, TONE } from '../utils/dashboardTheme';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
};

const MySurveyDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { surveys, fetchSurveys, mySubmissions, fetchMySubmissions } = useSurveyStore();

  useEffect(() => {
    fetchSurveys();
    fetchMySubmissions();
  }, []);

  // user.assigned_surveys only carries {id, title, category} — look up the
  // full record (description, is_active, created_at) from the survey list
  // this page already fetches, falling back to the minimal data if a survey
  // hasn't loaded into that list yet.
  const assignedSurveys = (user?.assigned_surveys || []).map(ref => {
    const full = surveys.find(s => s.id === ref.id);
    return full ? { ...ref, ...full } : ref;
  });
  const branches = getBranches(surveys);

  const branchCount = new Set(assignedSurveys.map(s => s.category).filter(Boolean)).size;

  const approvedCount = mySubmissions.filter(s => s.status === 'Approved').length;
  const approvedPct = mySubmissions.length ? Math.round((approvedCount / mySubmissions.length) * 100) : 0;

  const pendingSubmissions = mySubmissions.filter(s => s.status === 'Pending');
  const surveysInProgress = new Set(pendingSubmissions.map(s => s.survey_id)).size;

  const stats = [
    {
      label: 'Assigned Survey', value: assignedSurveys.length,
      sub: `${branchCount} ${branchCount === 1 ? 'branch' : 'branches'} active`,
      icon: <ClipboardList size={16} />, color: TONE.blue
    },
    {
      label: 'Approved Survey', value: approvedCount,
      sub: `${approvedPct}% of total`,
      icon: <CheckCircle2 size={16} />, color: TONE.green
    },
    {
      label: 'Surveys In Progress', value: surveysInProgress,
      sub: `${pendingSubmissions.length} awaiting review`,
      icon: <FileClock size={16} />, color: TONE.amber
    },
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(0.5rem, 2vw, 2rem)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Hero banner */}
      <div style={{
        borderRadius: 'var(--radius)',
        padding: '1.75rem 2rem',
        background: 'linear-gradient(100deg, #1e3a8a 0%, #4338ca 55%, #6d28d9 100%)',
        color: 'white'
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Welcome, {user?.username || 'User'}</h1>
        <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: '0.9rem' }}>Your assigned survey and submission history.</p>
      </div>

      {/* Stat cards */}
      <StatGrid>
        {stats.map(stat => <StatCard key={stat.label} {...stat} />)}
      </StatGrid>

      {/* Assigned surveys */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {assignedSurveys.map(survey => {
          const swatch = getBranchSwatch(survey.category, branches);
          return (
            <div
              key={survey.id}
              className="panel"
              onClick={() => navigate(`/take?survey=${survey.id}`)}
              style={{
                position: 'relative', overflow: 'hidden', cursor: 'pointer',
                padding: '1.25rem 1.5rem 1.25rem 1.75rem',
                transition: 'transform 0.2s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: '5px',
                background: 'linear-gradient(180deg, var(--accent-primary), var(--accent-secondary))'
              }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                  background: `${swatch.color}15`, color: swatch.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <ClipboardList size={17} />
                </div>

                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>{survey.title}</h3>
                    <Pill
                      text={survey.is_active ? 'ACTIVE' : 'CLOSED'}
                      color={survey.is_active ? TONE.green : TONE.grey}
                    />
                  </div>

                  {survey.description && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '6px 0 0', maxWidth: '640px', lineHeight: 1.5 }}>
                      {survey.description}
                    </p>
                  )}

                  <div style={{ ...metaText, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                    <Clock size={12} /> Created {formatDate(survey.created_at)}
                  </div>
                </div>

                <ChevronRight size={20} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              </div>
            </div>
          );
        })}

        {assignedSurveys.length === 0 && (
          <EmptyState>No surveys are currently assigned to you.</EmptyState>
        )}
      </div>

      {/* Submission History */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Submission History</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{mySubmissions.length} submissions</span>
        </div>

        <div className="panel" style={{ padding: '1.15rem 1.25rem' }}>
          {mySubmissions.length === 0 ? (
            <EmptyState>You haven&apos;t submitted any surveys yet.</EmptyState>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Survey Title</Th>
                  <Th align="center">Submitted At</Th>
                  <Th align="center">Status</Th>
                  <Th>Reviewer Feedback</Th>
                </tr>
              </thead>
              <tbody>
                {mySubmissions.map((sub) => {
                  const tone = sub.status === 'Approved' ? TONE.green
                    : sub.status === 'Rejected' ? TONE.red
                    : TONE.amber;
                  return (
                    <tr key={sub.id}>
                      <Td><span className="truncate" style={{ fontWeight: 600 }}>{sub.survey_title}</span></Td>
                      <Td align="center"><span style={metaText}>{formatDate(sub.completed_at)}</span></Td>
                      <Td align="center">
                        <Pill text={sub.status === 'Rejected' ? 'Declined' : sub.status} color={tone} />
                      </Td>
                      <Td style={{ maxWidth: '280px' }}>
                        {sub.manager_comment ? (
                          <div>
                            <div style={{ ...metaText, marginBottom: '2px' }}>
                              {sub.reviewed_by_username || 'Manager'} said
                            </div>
                            <div style={{ fontSize: '0.82rem', wordBreak: 'break-word' }}>{sub.manager_comment}</div>
                          </div>
                        ) : (
                          <span style={metaText}>No feedback yet</span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
        </div>
      </div>
    </div>
  );
};

export default MySurveyDashboard;
