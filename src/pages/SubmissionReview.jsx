import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useMonitorStore from '../store/useMonitorStore';
import useNotificationStore from '../store/useNotificationStore';
import { ArrowLeft, Check, X, AlertCircle, Loader2 } from 'lucide-react';
import { Pill, LinkButton, EmptyState } from '../components/common/StatCard';
import { MONO, metaText, TONE, timeAgo } from '../utils/dashboardTheme';
import AnswerDisplay from '../components/common/AnswerDisplay';

const STATUS_TONE = {
  Approved: { label: 'Approved', color: TONE.green },
  Rejected: { label: 'Declined', color: TONE.red },
  Pending: { label: 'Pending', color: TONE.amber },
};

const TYPE_LABEL = {
  radio: 'Single Choice',
  checkbox: 'Multiple Choice',
  select: 'Score Method',
  rating: 'Rating Scale',
  text: 'Short Text',
  long_text: 'Paragraph',
  number: 'Number',
  phone: 'Phone',
};

const fieldLabel = {
  fontFamily: MONO,
  fontSize: '0.6rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  marginBottom: '5px',
};

const SubmissionReview = () => {
  const { id } = useParams();
  const responseId = Number(id);
  const navigate = useNavigate();

  const { fetchResponseDetail, updateResponseStatus } = useMonitorStore();
  const { showSuccess, showError } = useNotificationStore();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // The decline reason only appears once Decline is pressed; submitting it is
  // what actually sends the rejection.
  const [askReason, setAskReason] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const d = await fetchResponseDetail(responseId);
    setDetail(d);
    setReason(d?.manager_comment || '');
    setLoading(false);
  }, [fetchResponseDetail, responseId]);

  useEffect(() => { load(); }, [load]);

  const submit = async (status) => {
    if (status === 'Rejected' && !reason.trim()) {
      showError('Please give a reason for rejecting this submission.');
      return;
    }
    setSaving(true);
    try {
      await updateResponseStatus(responseId, status, status === 'Rejected' ? reason.trim() : null);
      showSuccess(status === 'Approved' ? 'Submission approved.' : 'Submission rejected.');
      setAskReason(false);
      await load();
    } catch (err) {
      showError(err.message || 'Could not save that decision.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: 'clamp(0.5rem, 2vw, 1rem)' }}>
        <LinkButton onClick={() => navigate('/review')}><ArrowLeft size={14} /> Back</LinkButton>
        <div style={{ marginTop: '1rem' }}><EmptyState>Loading submission…</EmptyState></div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: 'clamp(0.5rem, 2vw, 1rem)' }}>
        <LinkButton onClick={() => navigate('/review')}><ArrowLeft size={14} /> Back</LinkButton>
        <div style={{ marginTop: '1rem' }}><EmptyState>That submission could not be loaded.</EmptyState></div>
      </div>
    );
  }

  const tone = STATUS_TONE[detail.status] || STATUS_TONE.Pending;
  const answers = detail.answers || [];
  const decided = detail.status === 'Approved' || detail.status === 'Rejected';

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: 'clamp(0.5rem, 2vw, 1rem)' }}>

      <div style={{ marginBottom: '0.85rem' }}>
        <LinkButton onClick={() => navigate('/review')}><ArrowLeft size={14} /> Back</LinkButton>
      </div>

      {/* ─── Submission header ──────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(100deg, #1e3a8a 0%, #4338ca 55%, #6d28d9 100%)',
        borderRadius: 'var(--radius)',
        padding: '1.1rem 1.4rem',
        marginBottom: '1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
          <span className="truncate" style={{ color: 'white', fontWeight: 700, fontSize: '1.15rem' }}>
            {detail.survey_title}
          </span>
          <Pill text={tone.label} color={tone.color === TONE.green ? '#4ade80' : tone.color === TONE.red ? '#fca5a5' : '#fbbf24'} />
          {detail.has_red_flag && <AlertCircle size={15} color="#fca5a5" />}
        </div>
        <div style={{ fontFamily: MONO, fontSize: '0.7rem', color: 'rgba(255,255,255,0.78)' }}>
          {detail.respondent || 'Anonymous'} · {answers.length} answers · received {timeAgo(detail.timestamp)}
        </div>
      </div>

      {/* ─── All questions and answers, on one page ─────────────── */}
      <div className="panel" style={{ padding: '1.15rem 1.25rem', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.02rem', marginBottom: '1rem' }}>
          Questions &amp; Answers ({answers.length})
        </h3>

        {answers.length === 0 ? (
          <EmptyState>This submission has no answers.</EmptyState>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {answers.map((a, i) => (
              <div
                key={a.id ?? i}
                style={{
                  padding: '0.9rem 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                  <span style={{
                    width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0, marginTop: '1px',
                    background: 'var(--accent-primary)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '0.68rem',
                  }}>{i + 1}</span>

                  <span style={{ flexGrow: 1, minWidth: 0, fontWeight: 600, fontSize: '0.88rem' }}>
                    {a.question_text}
                  </span>

                  <span style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <Pill text={TYPE_LABEL[a.question_type] || a.question_type} color={TONE.grey} />
                    {a.required && <Pill text="Required" color={TONE.amber} />}
                    {a.is_red_flag && <Pill text="Red flag" color={TONE.red} />}
                  </span>
                </div>

                <div style={{ paddingLeft: '32px' }}>
                  <div style={fieldLabel}>Answer</div>
                  <div style={{
                    background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px',
                    padding: '0.6rem 0.75rem', fontSize: '0.85rem',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    <AnswerDisplay answer={a} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Decision ───────────────────────────────────────────── */}
      <div className="panel" style={{ padding: '1.15rem 1.25rem' }}>
        {decided && (
          <div style={{ ...metaText, marginBottom: '0.85rem' }}>
            {tone.label} by {detail.reviewed_by_username || 'a reviewer'}
            {detail.manager_comment ? ` · reason: ${detail.manager_comment}` : ''}
          </div>
        )}

        {askReason && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={fieldLabel}>Reason for rejection (required)</div>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Tell the user what needs to change..."
              rows={3}
              autoFocus
              style={{ width: '100%', borderRadius: '8px', padding: '0.6rem 0.75rem', fontSize: '0.85rem', resize: 'vertical' }}
            />
            <div style={{ ...metaText, marginTop: '5px' }}>
              This is sent back to the user with the rejection.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {!askReason ? (
            <>
              <button
                onClick={() => submit('Approved')}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '0.6rem 1.4rem', background: TONE.green, color: 'white',
                  border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem',
                  cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? <Loader2 className="spin" size={15} /> : <Check size={15} />} Approve
              </button>
              <button
                onClick={() => setAskReason(true)}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '0.6rem 1.4rem', background: TONE.red, color: 'white',
                  border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem',
                  cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1,
                }}
              >
                <X size={15} /> Reject
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => submit('Rejected')}
                disabled={saving || !reason.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '0.6rem 1.4rem', background: TONE.red, color: 'white',
                  border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem',
                  cursor: saving || !reason.trim() ? 'not-allowed' : 'pointer',
                  opacity: saving || !reason.trim() ? 0.55 : 1,
                }}
              >
                {saving ? <Loader2 className="spin" size={15} /> : <X size={15} />} Send rejection
              </button>
              <button
                onClick={() => { setAskReason(false); setReason(detail.manager_comment || ''); }}
                disabled={saving}
                style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem' }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubmissionReview;
