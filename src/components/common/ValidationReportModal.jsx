import { CheckCircle2, AlertTriangle, XCircle, X, Play, Wrench, ArrowRight } from 'lucide-react';
import { SEVERITY } from '../../utils/surveyValidation';

// Result popup for the builder's Validate & Test (Play) button.
//
// Reports the three counts the admin asked for — errors, warnings, checks
// passed — then lists every issue with the section and question it belongs to,
// so a fix can be made without hunting. Errors block Test Mode; warnings do
// not, since a warning describes something worth a second look rather than
// something that stops the survey working.

const Stat = ({ icon, count, label, color, bg }) => (
  <div style={{
    flex: 1, minWidth: 0, background: bg, borderRadius: '12px', padding: '0.875rem 1rem',
    display: 'flex', alignItems: 'center', gap: '10px',
  }}>
    <div style={{ color, display: 'flex', flexShrink: 0 }}>{icon}</div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '1.35rem', fontWeight: 800, color, lineHeight: 1.1 }}>{count}</div>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
    </div>
  </div>
);

const IssueRow = ({ issue }) => {
  const isError = issue.severity === SEVERITY.ERROR;
  const color = isError ? '#ef4444' : '#f59e0b';
  return (
    <div style={{
      display: 'flex', gap: '10px', padding: '0.75rem 0.875rem',
      borderRadius: '10px', background: 'var(--bg-main)',
      border: `1px solid ${isError ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ color, display: 'flex', flexShrink: 0, marginTop: '2px' }}>
        {isError ? <XCircle size={16} /> : <AlertTriangle size={16} />}
      </div>
      <div style={{ minWidth: 0, flexGrow: 1 }}>
        {(issue.label || issue.sectionLabel) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
            {issue.label && (
              <span style={{
                fontSize: '0.65rem', fontWeight: 800, color: 'var(--accent-primary)',
                background: 'rgba(76, 140, 228, 0.12)', padding: '1px 7px', borderRadius: '5px',
              }}>
                {issue.label}
              </span>
            )}
            {issue.sectionLabel && (
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                in “{issue.sectionLabel}”
              </span>
            )}
            {issue.title && (
              <span className="truncate" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', maxWidth: '260px' }}>
                — {issue.title}
              </span>
            )}
            {issue.to && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <ArrowRight size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{
                  fontSize: '0.65rem', fontWeight: 800,
                  color: issue.to.valid ? 'var(--text-muted)' : '#ef4444',
                  background: issue.to.valid ? 'var(--bg-main)' : 'rgba(239,68,68,0.12)',
                  border: `1px solid ${issue.to.valid ? 'var(--border)' : 'rgba(239,68,68,0.25)'}`,
                  padding: '1px 7px', borderRadius: '5px',
                }}>
                  {issue.to.label}
                </span>
              </span>
            )}
          </div>
        )}
        <div style={{ fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.45 }}>{issue.message}</div>
        {issue.hint && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px', lineHeight: 1.45 }}>
            {issue.hint}
          </div>
        )}
      </div>
    </div>
  );
};

const ValidationReportModal = ({ result, onClose, onStartTest }) => {
  if (!result) return null;

  const { errors, warnings, passed, checksRun, canTest } = result;
  const ordered = [...errors, ...warnings];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        className="panel"
        style={{
          background: 'var(--bg-card)', borderRadius: '18px', width: '100%', maxWidth: '720px',
          maxHeight: '86vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem',
        }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Validation Report</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0' }}>
              {canTest
                ? 'Everything checks out — the survey is ready to test end to end.'
                : `${errors.length} problem${errors.length === 1 ? '' : 's'} must be fixed before you can run a test.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
              padding: '4px', display: 'flex', flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Counts */}
        <div style={{ display: 'flex', gap: '10px', padding: '1.25rem 1.5rem 0.5rem', flexWrap: 'wrap' }}>
          <Stat icon={<XCircle size={20} />} count={errors.length} label="Errors" color="#ef4444" bg="rgba(239,68,68,0.08)" />
          <Stat icon={<AlertTriangle size={20} />} count={warnings.length} label="Warnings" color="#f59e0b" bg="rgba(245,158,11,0.08)" />
          <Stat icon={<CheckCircle2 size={20} />} count={`${passed}/${checksRun}`} label="Checks passed" color="#10b981" bg="rgba(16,185,129,0.08)" />
        </div>

        {/* Issue list */}
        <div style={{ padding: '0.75rem 1.5rem 1.25rem', overflowY: 'auto', flexGrow: 1 }}>
          {ordered.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
              padding: '2.5rem 1rem', textAlign: 'center',
            }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981',
              }}>
                <CheckCircle2 size={26} />
              </div>
              <div style={{ fontWeight: 700 }}>All {checksRun} checks passed</div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, maxWidth: '380px' }}>
                Sections, questions, answer options, ids, jumps, sub-sections and score routing are all
                configured and connected correctly.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ordered.map((issue, i) => <IssueRow key={i} issue={issue} />)}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{
          padding: '1rem 1.5rem', borderTop: '1px solid var(--border)',
          display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap',
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: '44px', padding: '0 1.25rem', borderRadius: '10px', fontWeight: 700,
              background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-main)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            <Wrench size={16} /> {canTest ? 'Close' : 'Back to Fix'}
          </button>
          <button
            type="button"
            onClick={onStartTest}
            disabled={!canTest}
            title={canTest ? 'Take the survey from start to finish' : 'Fix the errors above to enable Test Mode'}
            style={{
              height: '44px', padding: '0 1.5rem', borderRadius: '10px', fontWeight: 700, border: 'none',
              background: canTest ? 'var(--accent-primary)' : 'var(--border)',
              color: canTest ? 'white' : 'var(--text-muted)',
              cursor: canTest ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            <Play size={16} /> Start Test Mode
          </button>
        </div>
      </div>
    </div>
  );
};

export default ValidationReportModal;
