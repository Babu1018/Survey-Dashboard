import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from 'boneyard-js/react';
import useSurveyStore from '../store/useSurveyStore';
import useMonitorStore from '../store/useMonitorStore';
import {
  Plus,
  Trash2,
  Eye,
  Users,
  FolderKanban,
  ClipboardList,
  CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useNotificationStore from '../store/useNotificationStore';
import { getBranches, getBranchSwatch } from '../utils/branchPalette';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toISOString().slice(0, 10);
};

const ROW_ODD_BG = 'var(--bg-card)';
const ROW_EVEN_BG = 'var(--bg-main)';

const iconButtonStyle = (color) => ({
  background: `${color}1a`,
  border: 'none',
  color,
  width: '30px',
  height: '30px',
  padding: 0,
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background 0.15s'
});

const SurveyList = () => {
  const { surveys, users, fetchSurveys, fetchUsers, loading, deleteSurveysByCategory } = useSurveyStore();
  const { recentResponses, fetchRecent } = useMonitorStore();
  const navigate = useNavigate();
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState(null);

  useEffect(() => {
    fetchSurveys();
    fetchUsers();
    fetchRecent(1000);
  }, []);

  const batches = getBranches(surveys);

  const activeSurveys = surveys.filter(s => s.is_active).length;

  const roleCounts = useMemo(() => {
    const count = role => users.filter(u => u.role === role).length;
    return { admins: count('Admin'), managers: count('Manager'), members: count('User') };
  }, [users]);

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const stats = [
    {
      label: 'Total Credential Users',
      value: users.length,
      sub: [
        roleCounts.admins ? plural(roleCounts.admins, 'Admin') : null,
        plural(roleCounts.managers, 'Manager'),
        plural(roleCounts.members, 'User'),
      ].filter(Boolean).join(' · '),
      icon: <Users size={20} />,
      color: 'var(--accent-primary)'
    },
    { label: 'Total Survey Branches', value: batches.length, icon: <FolderKanban size={20} />, color: '#0891b2' },
    { label: 'Surveys In Progress', value: activeSurveys, icon: <ClipboardList size={20} />, color: '#f59e0b' },
    { label: 'Total Responses', value: recentResponses.length.toLocaleString(), icon: <CheckCircle2 size={20} />, color: '#10b981' },
  ];

  const branchRows = useMemo(() => {
    return batches.map(batch => {
      const batchSurveys = surveys.filter(s => s.category === batch);
      const usersInBatch = users.filter(u => (u.assigned_surveys || []).some(s => s.category === batch)).length;
      const responsesInBatch = recentResponses.filter(r => r.category === batch).length;
      const createdDates = batchSurveys.map(s => s.created_at).filter(Boolean).sort();
      return {
        name: batch,
        users: usersInBatch,
        surveys: batchSurveys.length,
        responses: responsesInBatch,
        created: createdDates[0],
      };
    });
  }, [batches, surveys, users, recentResponses]);

  return (
    <div style={{ animation: 'fade-in 0.4s ease-out', maxWidth: '1400px', margin: '0 auto', padding: 'clamp(0.5rem, 2vw, 2rem)', paddingBottom: '5rem' }}>
      <Skeleton name="page-header" loading={loading}>
        <div className="page-header-container">
          <div className="page-header">
            <h1>Branches</h1>
            <p>Click any branch row to drill into credential user performance.</p>
          </div>
          <div style={{ display: 'flex', gap: '15px' }}>
            <button className="primary" onClick={() => navigate('/builder')} style={{ height: '48px', padding: '0 1.5rem', whiteSpace: 'nowrap' }}>
              <Plus size={18} /> New Survey
            </button>
          </div>
        </div>
      </Skeleton>

      {/* Stat Cards */}
      <Skeleton name="survey-fields-stats" loading={loading}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'clamp(0.75rem, 1.5vw, 1.5rem)',
          marginBottom: 'clamp(1.5rem, 2vw, 2rem)'
        }}>
          {stats.map((stat, i) => (
            <div key={i} className="panel" style={{ padding: '1.5rem', borderTop: `3px solid ${stat.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>{stat.label}</h4>
                <div style={{ color: stat.color, background: `${stat.color}15`, padding: '8px', borderRadius: '8px', flexShrink: 0 }}>{stat.icon}</div>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stat.value}</div>
              {stat.sub && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{stat.sub}</div>
              )}
            </div>
          ))}
        </div>
      </Skeleton>

      {/* Performance Table */}
      <Skeleton name="survey-fields-performance" loading={loading}>
        <div className="panel" style={{ padding: 0 }}>
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Performance</h3>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '820px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2.2fr 1fr 1fr 1fr 1fr 1fr',
                padding: '0.85rem 1.5rem',
                background: 'var(--bg-main)',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}>
                <span>Branch Name</span>
                <span>Users</span>
                <span>Surveys</span>
                <span>Responses</span>
                <span>Created on</span>
                <span>Actions</span>
              </div>

              {branchRows.map((row, i) => {
                const swatch = getBranchSwatch(row.name, batches);
                const rowBg = i % 2 === 0 ? ROW_ODD_BG : ROW_EVEN_BG;
                return (
                  <div
                    key={row.name}
                    onClick={() => navigate(`/surveys/branch/${encodeURIComponent(row.name)}`)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2.2fr 1fr 1fr 1fr 1fr 1fr',
                      padding: '0.9rem 1.5rem',
                      borderBottom: '1px solid var(--border)',
                      fontSize: '0.9rem',
                      alignItems: 'center',
                      cursor: 'pointer',
                      background: rowBg,
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = rowBg}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: swatch.color,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {swatch.icon}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Survey Category</div>
                      </div>
                    </div>
                    <span>{row.users}</span>
                    <span>{row.surveys}</span>
                    <span>{row.responses}</span>
                    <span>{formatDate(row.created)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        title={`View ${row.name}`}
                        aria-label={`View ${row.name}`}
                        onClick={(e) => { e.stopPropagation(); navigate(`/surveys/branch/${encodeURIComponent(row.name)}`); }}
                        style={iconButtonStyle('#3b82f6')}
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        title={`Delete ${row.name}`}
                        aria-label={`Delete ${row.name}`}
                        onClick={(e) => { e.stopPropagation(); setDeleteCategoryConfirm(row.name); }}
                        style={iconButtonStyle('#ef4444')}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {branchRows.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No survey branches yet. Create a survey to get started.
                </div>
              )}
            </div>
          </div>
        </div>
      </Skeleton>

      {deleteCategoryConfirm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div className="panel" style={{
            background: 'var(--bg-main)',
            padding: '2.5rem',
            borderRadius: '24px',
            maxWidth: '450px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 40px 80px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              margin: '0 auto 1.5rem'
            }}>
              <Trash2 size={30} />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 1rem' }}>Delete Category?</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', margin: '0 0 2rem' }}>
              Are you sure you want to delete the <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>"{deleteCategoryConfirm}"</span> category? This will permanently delete all associated surveys and data.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setDeleteCategoryConfirm(null)}
                style={{ flex: 1, background: 'var(--bg-hover)', border: '1px solid var(--border)', fontWeight: 700 }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const { showSuccess, showError } = useNotificationStore.getState();
                  try {
                    await deleteSurveysByCategory(deleteCategoryConfirm);
                    showSuccess(`Category "${deleteCategoryConfirm}" and all its surveys deleted.`);
                    setDeleteCategoryConfirm(null);
                  } catch {
                    showError('Failed to delete category');
                  }
                }}
                style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', fontWeight: 700 }}
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyList;
