import { useEffect } from 'react';
import { Skeleton } from 'boneyard-js/react';
import { useNavigate } from 'react-router-dom';
import useSurveyStore from '../store/useSurveyStore';
import useGroupStore from '../store/useGroupStore';
import { 
  Database, 
  Users, 
  MessageSquare, 
  Cpu, 
  Plus, 
  ArrowRight, 
  ShieldCheck, 
  Zap,
  Terminal,
  Activity
} from 'lucide-react';

const Dashboard = () => {
  const { surveys, fetchSurveys, loading: surveyLoading } = useSurveyStore();
  const { groups, fetchGroups, loading: groupLoading } = useGroupStore();
  const loading = surveyLoading || groupLoading;
  const navigate = useNavigate();

  useEffect(() => {
    fetchSurveys();
    fetchGroups();
  }, []);

  const stats = [
    { label: 'Total Surveys', value: surveys.length, icon: <Database size={22} />, color: 'var(--accent-primary)' },
    { label: 'Active Groups', value: groups.length, icon: <Users size={22} />, color: 'var(--accent-secondary)' },
    { label: 'Completion Rate', value: '84%', icon: <MessageSquare size={22} />, color: '#10b981' },
    { label: 'System Uptime', value: '99.9%', icon: <Activity size={22} />, color: '#6366f1' },
  ];

  const categories = ['AI', 'Developer', 'DevOps'];

  return (
    <div className="dashboard-container" style={{ maxWidth: '1400px', margin: '0 auto', padding: 'clamp(0.5rem, 2vw, 1rem)' }}>
      <Skeleton name="dashboard-header" loading={loading}>
        <div className="page-header-container">
          <div className="page-header">
            <h1>Overview</h1>
            <p>Welcome back. Here is what is happening with your surveys.</p>
          </div>
          <button className="primary" onClick={() => navigate('/builder')} style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '48px', padding: '0 1.5rem' }}>
            <Plus size={20} /> Create New Survey
          </button>
        </div>
      </Skeleton>
      
      {/* Stats Grid */}
      <Skeleton name="dashboard-stats" loading={loading}>
        <div className="stats-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: 'clamp(0.75rem, 1.5vw, 1.5rem)',
          marginBottom: '2rem' 
        }}>
          {stats.map((stat, i) => (
            <div key={i} className="panel stat-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</h4>
                <div style={{ color: stat.color, background: `${stat.color}15`, padding: '8px', borderRadius: '8px' }}>{stat.icon}</div>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stat.value}</div>
            </div>
          ))}
        </div>
      </Skeleton>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'clamp(1rem, 2vw, 2rem)' }}>
        {/* Survey Inventory */}
        <Skeleton name="dashboard-surveys" loading={loading}>
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                Surveys by Category
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {categories.map(cat => (
                <div key={cat} className="category-section">
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px', 
                    marginBottom: '1rem',
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: '0.5rem'
                  }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{cat}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {surveys.filter(s => s.category === cat).length} surveys
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                    {surveys.filter(s => s.category === cat).map(survey => (
                      <div key={survey.id} className="nav-item" style={{ 
                        margin: 0, 
                        justifyContent: 'space-between', 
                        padding: '0.75rem 1rem', 
                        background: 'var(--bg-main)',
                        borderRadius: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Terminal size={14} style={{ opacity: 0.5 }} />
                          <span className="truncate" style={{ fontSize: '0.9rem', maxWidth: '200px' }} title={`${survey.title} (${survey.category} Batch)`}>{survey.title}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>#{survey.id.toString().padStart(4, '0')}</span>
                          <ArrowRight size={14} />
                        </div>
                      </div>
                    ))}
                    {surveys.filter(s => s.category === cat).length === 0 && (
                      <div style={{ padding: '1rem', border: '1px dashed var(--border)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                        No surveys in this category.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Skeleton>

        {/* Right Content: Assignments & Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <Skeleton name="dashboard-assignment" loading={loading}>
            <div className="panel">
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                Quick Assignment
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Assign surveys to user groups for data collection.
              </p>
              <button 
                className="primary" 
                onClick={() => navigate('/assigner')}
                style={{ width: '100%' }}
              >
                Open Assigner
              </button>
            </div>
          </Skeleton>

          <Skeleton name="dashboard-activity" loading={loading} style={{ flexGrow: 1, display: 'flex' }}>
            <div className="panel" style={{ flexGrow: 1, width: '100%' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem' }}>Recent Activity</h3>
              <div style={{ fontSize: '0.85rem' }}>
                <div style={{ color: '#10b981', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                  System operational
                </div>
                <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>Synced {surveys.length} survey profiles</div>
                <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>Active {groups.length} member groups</div>
              </div>
            </div>
          </Skeleton>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

