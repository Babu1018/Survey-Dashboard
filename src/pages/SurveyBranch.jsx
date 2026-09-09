import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSurveyStore from '../store/useSurveyStore';
import useMonitorStore from '../store/useMonitorStore';
import useAuthStore from '../store/useAuthStore';
import useNotificationStore from '../store/useNotificationStore';
import { getBranches, getBranchSwatch } from '../utils/branchPalette';
import * as surveyService from '../services/surveyService';
import {
  ArrowLeft, ChevronDown, Pencil, X, Clock, Copy, UserPlus, BarChart3,
  HelpCircle, ClipboardList, ShieldCheck, MessageSquare, ToggleLeft, ToggleRight
} from 'lucide-react';


const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
};

const SurveyBranch = () => {
  const { category } = useParams();
  const navigate = useNavigate();
  const {
    surveys, users, groups,
    fetchSurveys, fetchUsers, fetchGroups,
    updateSurvey, cloneSurvey, assignSurveyToUser, createGroup, setGroupManager, assignUserToGroup
  } = useSurveyStore();
  const { recentResponses, fetchRecent } = useMonitorStore();

  const [assigningSurveyId, setAssigningSurveyId] = useState(null);
  const [assignTakerId, setAssignTakerId] = useState('');
  const [assignLeadId, setAssignLeadId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [reports, setReports] = useState({});

  useEffect(() => {
    fetchSurveys();
    fetchUsers();
    fetchGroups();
    fetchRecent(1000);
  }, []);

  const categorySurveys = useMemo(
    () => surveys.filter(s => s.category === category),
    [surveys, category]
  );

  // Pull each survey's aggregate report (verified %, question breakdown) up
  // front so the collapsed cards can show a verified-progress bar and an
  // expand needs no extra round trip.
  useEffect(() => {
    const { token } = useAuthStore.getState();
    categorySurveys.forEach(s => {
      if (reports[s.id]) return;
      surveyService.fetchSurveyReport(token, s.id)
        .then(data => { if (data) setReports(prev => ({ ...prev, [s.id]: data })); })
        .catch(() => { });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySurveys]);

  const branches = getBranches(surveys);
  const swatch = getBranchSwatch(category, branches);

  const usersInBranch = users.filter(u => (u.assigned_surveys || []).some(s => s.category === category)).length;
  const responsesInBranch = recentResponses.filter(r => r.category === category).length;

  const assigningSurvey = assigningSurveyId ? surveys.find(s => s.id === assigningSurveyId) : null;
  const takerOptions = users.filter(u => u.role === 'User');
  const leadOptions = users.filter(u => u.role === 'Manager');

  const handleToggleActive = async (survey) => {
    const { showSuccess, showError } = useNotificationStore.getState();
    try {
      await updateSurvey(survey.id, {
        title: survey.title,
        category: survey.category,
        description: survey.description,
        is_active: !survey.is_active
      });
      showSuccess(survey.is_active ? 'Survey deactivated' : 'Survey activated');
    } catch {
      showError('Failed to update survey status');
    }
  };

  const handleAssignSurvey = async () => {
    if (!assigningSurvey || !assignTakerId) return;
    const { showSuccess, showError } = useNotificationStore.getState();
    setAssigning(true);
    try {
      await assignSurveyToUser(Number(assignTakerId), assigningSurvey.id);
      if (assignLeadId) {
        const leadId = Number(assignLeadId);
        let group = groups.find(g => g.manager_id === leadId);
        if (!group) {
          const lead = users.find(u => u.id === leadId);
          group = await createGroup(`${lead?.username || 'Lead'}'s Reviews`);
          if (!group) throw new Error('Failed to create a review group for this lead.');
          await setGroupManager(group.id, leadId);
        }
        await assignUserToGroup(group.id, Number(assignTakerId));
      }
      await fetchUsers();
      await fetchGroups();
      showSuccess('Survey assigned.');
      setAssigningSurveyId(null);
      setAssignTakerId('');
      setAssignLeadId('');
    } catch (err) {
      showError(err.message || 'Failed to assign survey');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(0.5rem, 2vw, 2rem)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <button
        onClick={() => navigate('/surveys')}
        style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, padding: 0, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Hero banner */}
      <div style={{
        borderRadius: '20px',
        padding: '1.75rem 2rem',
        background: `linear-gradient(120deg, ${swatch.color}, var(--accent-secondary))`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.5rem',
        color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            {swatch.icon}
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{category}</h1>
            <p style={{ margin: '2px 0 0', opacity: 0.85, fontSize: '0.85rem' }}>Survey Category</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'clamp(1.5rem, 3vw, 3rem)' }}>
          {[
            { label: 'Total Users', value: usersInBranch },
            { label: 'Total Surveys', value: categorySurveys.length },
            { label: 'Total Responses', value: responsesInBranch.toLocaleString() },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stat.value}</div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.85 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Accordion survey cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {categorySurveys.map(survey => {
          const report = reports[survey.id];
          const totalResponses = report?.total_responses ?? recentResponses.filter(r => r.survey_id === survey.id || r.survey_title === survey.title).length;

          return (
            <div
              key={survey.id}
              className="panel"
              onClick={() => navigate(`/builder/${survey.id}`)}
              style={{
                position: 'relative',
                overflow: 'hidden',
                padding: '1.1rem 1.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1.5rem',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                cursor: 'pointer'
              }}
            >
              {/* Accent bar */}
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: '5px',
                background: 'linear-gradient(180deg, var(--accent-primary), var(--accent-secondary))'
              }} />

              {/* Left Side: Details and Progress Bar */}
              <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                {/* Details single line */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>{survey.title}</h3>
                  
                  <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-muted)' }} />
                    {totalResponses} Total Responses
                  </span>

                  <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-muted)' }} />
                    {survey.questions?.length ?? 0} Questions
                  </span>

                  <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-muted)' }} />
                    Created on {formatDate(survey.created_at)}
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '480px' }}>
                  <div style={{ flexGrow: 1, height: '6px', borderRadius: '4px', background: 'var(--bg-hover)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${report?.verified_pct ?? 0}%`, borderRadius: '4px', background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))' }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 700, flexShrink: 0 }}>{report?.verified_pct ?? 0}%</div>
                </div>
              </div>

              {/* Right Side: Action Icons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                {/* Assign */}
                <div
                  onClick={e => { e.stopPropagation(); setAssigningSurveyId(survey.id); setAssignTakerId(''); setAssignLeadId(''); }}
                  title="Assign"
                  style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#ffffff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37, 99, 235, 0.08)'; e.currentTarget.style.color = '#2563eb'; }}
                >
                  <UserPlus size={19} />
                </div>

                {/* Report */}
                <div
                  onClick={e => { e.stopPropagation(); navigate(`/surveys/${survey.id}/report`); }}
                  title="Report"
                  style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#ffffff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37, 99, 235, 0.08)'; e.currentTarget.style.color = '#2563eb'; }}
                >
                  <BarChart3 size={19} />
                </div>

                {/* Edit */}
                <div
                  onClick={e => { e.stopPropagation(); navigate(`/builder/${survey.id}`); }}
                  title="Edit"
                  style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#ffffff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37, 99, 235, 0.08)'; e.currentTarget.style.color = '#2563eb'; }}
                >
                  <Pencil size={19} />
                </div>

                {/* Clone */}
                <div
                  onClick={async e => {
                    e.stopPropagation();
                    const { showSuccess, showError } = useNotificationStore.getState();
                    if (window.confirm('Clone this survey?')) {
                      try {
                        await cloneSurvey(survey.id);
                        showSuccess('Survey Cloned Successfully');
                      } catch {
                        showError('Failed to clone survey');
                      }
                    }
                  }}
                  title="Clone"
                  style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#ffffff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37, 99, 235, 0.08)'; e.currentTarget.style.color = '#2563eb'; }}
                >
                  <Copy size={19} />
                </div>

                {/* Activate / Deactivate — styled as a green/red switch button, not an icon-circle */}
                <button
                  onClick={e => { e.stopPropagation(); handleToggleActive(survey); }}
                  title={survey.is_active ? 'Deactivate' : 'Activate'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                    fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.02em',
                    background: survey.is_active ? '#10b981' : '#ef4444',
                    color: '#ffffff',
                    transition: 'all 0.2s'
                  }}
                >
                  {survey.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                  {survey.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>
            </div>
          );
        })}

        {categorySurveys.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '16px' }}>
            No surveys in this category.
          </div>
        )}
      </div>

      {assigningSurveyId && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1150,
          padding: '2rem'
        }}>
          <div className="panel" style={{
            background: 'var(--bg-main)',
            width: '100%',
            maxWidth: '460px',
            borderRadius: '24px',
            padding: '1.75rem',
            boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Assign Survey to Taker and Lead</h3>
              <button
                onClick={() => setAssigningSurveyId(null)}
                style={{ background: 'var(--bg-hover)', border: 'none', padding: '6px', borderRadius: '50%', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '5px', display: 'block' }}>SELECT SURVEY</label>
                <select value={assigningSurveyId} onChange={e => setAssigningSurveyId(Number(e.target.value))} style={{ padding: '0.7rem', borderRadius: '10px' }}>
                  {surveys.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '5px', display: 'block' }}>ASSIGN TO TAKER</label>
                <select value={assignTakerId} onChange={e => setAssignTakerId(e.target.value)} style={{ padding: '0.7rem', borderRadius: '10px' }}>
                  <option value="">Choose a taker...</option>
                  {takerOptions.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '5px', display: 'block' }}>ASSIGN TO LEAD (OPTIONAL)</label>
                <select value={assignLeadId} onChange={e => setAssignLeadId(e.target.value)} style={{ padding: '0.7rem', borderRadius: '10px' }}>
                  <option value="">Choose a lead...</option>
                  {leadOptions.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.75rem' }}>
              <button
                onClick={() => setAssigningSurveyId(null)}
                style={{ background: '#f1f5f9', border: 'none', color: '#475569', fontWeight: 700, padding: '0.65rem 1.4rem', borderRadius: '20px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSurvey}
                disabled={!assignTakerId || assigning}
                style={{ background: '#3b82f6', border: 'none', color: 'white', fontWeight: 700, padding: '0.65rem 1.6rem', borderRadius: '20px', cursor: 'pointer', opacity: (!assignTakerId || assigning) ? 0.6 : 1 }}
              >
                {assigning ? 'Assigning…' : 'Assign Survey'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyBranch;
