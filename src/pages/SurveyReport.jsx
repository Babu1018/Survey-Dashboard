import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSurveyStore from '../store/useSurveyStore';
import { ArrowLeft, ClipboardList, ShieldCheck, MessageSquare, Activity } from 'lucide-react';

const QUESTION_TYPE_LABELS = {
  text: 'Text',
  multiple_choice: 'Single Choice',
  radio: 'Single Choice',
  checkbox: 'Multiple Choice',
  boolean: 'Yes / No',
  rating: 'Rating Scale',
};

export const QuestionCard = ({ question, index }) => {
  const hasOptions = question.options && question.options.length > 0;

  return (
    <div className="panel" style={{ padding: '1.25rem 1.5rem', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '1rem' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
          background: 'var(--accent-primary)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.8rem', fontWeight: 800
        }}>
          {index + 1}
        </div>
        <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{question.question_text}</span>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: 'rgba(var(--accent-primary-rgb), 0.1)', color: 'var(--accent-primary)' }}>
            {QUESTION_TYPE_LABELS[question.question_type] || question.question_type}
          </span>
          {question.required && (
            <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
              Required
            </span>
          )}
        </div>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', whiteSpace: 'nowrap' }}>
          {question.answered_count.toLocaleString()} responses
        </span>
      </div>

      <div style={{ paddingLeft: '42px' }}>
        {question.most_common_answer != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
            <Activity size={15} style={{ color: 'var(--text-muted)' }} />
            <span style={{ color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem' }}>Most common answer</span>
            <span style={{ fontWeight: 700 }}>
              {question.most_common_answer} {question.most_common_pct != null && `(${question.most_common_pct}%)`}
            </span>
          </div>
        )}

        {hasOptions ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px 24px' }}>
            {question.options.map(opt => (
              <div key={opt.option_text}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600 }}>{opt.option_text}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{opt.pct}%</span>
                </div>
                <div style={{ height: '6px', borderRadius: '4px', background: 'var(--bg-hover)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${opt.pct}%`, borderRadius: '4px', background: 'var(--accent-primary)' }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
              <span>Response Rate</span>
              <span>{question.answered_count.toLocaleString()}</span>
            </div>
            <div style={{ height: '6px', borderRadius: '4px', background: 'var(--bg-hover)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${question.response_rate_pct}%`, borderRadius: '4px', background: 'var(--accent-primary)' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const QuestionRow = QuestionCard;

const SurveyReport = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { surveyReport, surveyReportLoading, fetchSurveyReport } = useSurveyStore();

  useEffect(() => {
    fetchSurveyReport(id);
  }, [id]);

  if (surveyReportLoading && !surveyReport) {
    return <div style={{ textAlign: 'center', padding: '6rem', color: 'var(--text-muted)' }}>Loading survey report…</div>;
  }

  if (!surveyReport) {
    return (
      <div style={{ textAlign: 'center', padding: '6rem', color: 'var(--text-muted)' }}>
        Couldn't load this survey's report.
      </div>
    );
  }

  const stats = [
    { label: 'Questions', value: surveyReport.total_questions, icon: <ClipboardList size={20} />, color: '#b45309', bg: 'rgba(245, 158, 11, 0.12)' },
    { label: 'Verified', value: `${surveyReport.verified_pct}%`, icon: <ShieldCheck size={20} />, color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' },
    { label: 'Responses', value: surveyReport.total_responses.toLocaleString(), icon: <MessageSquare size={20} />, color: '#059669', bg: 'rgba(16, 185, 129, 0.12)' },
  ];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <button
        onClick={() => navigate(-1)}
        style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, padding: 0, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>{surveyReport.title}</h2>
              <span style={{
                fontSize: '0.68rem', fontWeight: 800, padding: '3px 10px', borderRadius: '20px',
                background: surveyReport.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
                color: surveyReport.is_active ? '#10b981' : '#64748b'
              }}>
                {surveyReport.is_active ? 'ACTIVE' : 'CLOSED'}
              </span>
            </div>
            {surveyReport.description && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px', maxWidth: '640px' }}>{surveyReport.description}</p>
            )}
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-primary)', whiteSpace: 'nowrap' }}>{surveyReport.verified_pct}%</span>
        </div>
        <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-hover)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${surveyReport.verified_pct}%`, borderRadius: '4px', background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))' }} />
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>Share of responses a Manager has approved or rejected</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {stats.map((stat, i) => (
          <div key={i} style={{ background: stat.bg, borderRadius: 'var(--radius)', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <h4 style={{ fontSize: '0.72rem', color: stat.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</h4>
              <div style={{ color: stat.color, background: 'rgba(255,255,255,0.5)', padding: '7px', borderRadius: '8px', flexShrink: 0 }}>{stat.icon}</div>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1rem', margin: 0 }}>Survey Questions ({surveyReport.questions.length})</h3>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', border: '1px solid var(--border)' }}>
            {surveyReport.questions.filter(q => q.required).length} required
          </span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {surveyReport.questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={i}
            />
          ))}
          {surveyReport.questions.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '16px' }}>
              This survey has no questions yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SurveyReport;
