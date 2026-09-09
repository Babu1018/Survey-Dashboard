import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSurveyStore from '../store/useSurveyStore';
import useMonitorStore from '../store/useMonitorStore';
import useNotificationStore from '../store/useNotificationStore';
import { ArrowLeft, ChevronRight, MoreVertical, X, Target } from 'lucide-react';
import {
  Pill, Avatar,
  Th, Td, TableWrap, PanelHeader, LinkButton, EmptyState,
} from '../components/common/StatCard';
import { MONO, metaText, TONE } from '../utils/dashboardTheme';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const RANGE_TABS = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

// Monday 00:00 of the week containing `ref`.
const startOfWeek = (ref = new Date()) => {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  // getDay(): 0=Sun .. 6=Sat. Shift so Monday is index 0.
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

const fmtDate = (iso, opts = { month: 'short', day: 'numeric', year: 'numeric' }) =>
  iso ? new Date(iso).toLocaleDateString(undefined, opts) : '—';

const STATUS_TONE = {
  Approved: { label: 'Complete', color: TONE.green },
  Rejected: { label: 'Declined', color: TONE.red },
  Pending: { label: 'Partial', color: TONE.amber },
};

// ─── Chart buckets ────────────────────────────────────────────────────
// Splits a user's submissions into per-bucket completed/pending counts for
// the Day/Week/Month tabs. "Completed" tracks approved submissions,
// "pending" tracks ones still awaiting review — declined submissions are
// left out of the bars, same as the legend only naming those two states.
const buildBuckets = (range, submissions) => {
  const now = new Date();

  const countRange = (from, to) => {
    let completed = 0, pending = 0;
    for (const r of submissions) {
      if (!r.timestamp) continue;
      const t = new Date(r.timestamp);
      if (t >= from && t < to) {
        if (r.status === 'Approved') completed += 1;
        else if (r.status === 'Pending') pending += 1;
      }
    }
    return { completed, pending };
  };

  if (range === 'day') {
    // Rolling last 7 days, ending today.
    const labels = [], completed = [], pending = [];
    for (let i = 6; i >= 0; i -= 1) {
      const from = new Date(now);
      from.setHours(0, 0, 0, 0);
      from.setDate(from.getDate() - i);
      const to = new Date(from.getTime() + 86400000);
      const c = countRange(from, to);
      labels.push(from.toLocaleDateString(undefined, { weekday: 'short' }));
      completed.push(c.completed);
      pending.push(c.pending);
    }
    return { labels, completed, pending };
  }

  if (range === 'month') {
    // Weekly buckets spanning the current calendar month.
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const labels = [], completed = [], pending = [];
    let cursor = startOfWeek(monthStart);
    let week = 1;
    while (cursor < monthEnd) {
      const next = new Date(cursor.getTime() + 7 * 86400000);
      const from = cursor > monthStart ? cursor : monthStart;
      const to = next < monthEnd ? next : monthEnd;
      const c = countRange(from, to);
      labels.push(`Wk ${week}`);
      completed.push(c.completed);
      pending.push(c.pending);
      cursor = next;
      week += 1;
    }
    return { labels, completed, pending };
  }

  // Default: current calendar week, Monday through Sunday.
  const weekStart = startOfWeek();
  const labels = DAYS.slice();
  const completed = new Array(7).fill(0);
  const pending = new Array(7).fill(0);
  for (const r of submissions) {
    if (!r.timestamp) continue;
    const d = new Date(r.timestamp);
    const diffDays = Math.floor((d - weekStart) / 86400000);
    if (diffDays >= 0 && diffDays < 7) {
      if (r.status === 'Approved') completed[diffDays] += 1;
      else if (r.status === 'Pending') pending[diffDays] += 1;
    }
  }
  return { labels, completed, pending };
};

// ─── Submissions chart ────────────────────────────────────────────────
// Two-series bar chart: completed (bottom, green) and pending (top, amber),
// drawn as separate rounded segments with a hairline gap between them
// rather than one continuous stack, each bucket labelled beneath.
const SubmissionsChart = ({ labels, completed, pending }) => {
  const [hover, setHover] = useState(null);
  const totals = labels.map((_, i) => completed[i] + pending[i]);
  const max = Math.max(...totals, 1);
  const PLOT = 120;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: PLOT + 44 }}>
      {labels.map((label, i) => {
        const c = completed[i];
        const p = pending[i];
        const total = c + p;
        const cH = total === 0 ? 2 : Math.max((c / max) * PLOT, c > 0 ? 6 : 0);
        const pH = p > 0 ? Math.max((p / max) * PLOT, 6) : 0;
        return (
          <div
            key={`${label}-${i}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            title={`${label}: ${c} completed, ${p} pending`}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              height: '100%',
              cursor: 'default',
            }}
          >
            <div style={{
              width: '82%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: p > 0 && c > 0 ? '3px' : 0,
            }}>
              {p > 0 && (
                <div style={{
                  width: '100%',
                  height: `${pH}px`,
                  borderRadius: '4px',
                  background: TONE.amber,
                  opacity: hover === null || hover === i ? 1 : 0.55,
                  transition: 'opacity 0.15s',
                }} />
              )}
              <div style={{
                width: '100%',
                height: `${cH}px`,
                borderRadius: '4px',
                background: total === 0
                  ? 'var(--border)'
                  : 'linear-gradient(180deg, var(--accent-primary), var(--accent-secondary))',
                opacity: hover === null || hover === i ? 1 : 0.55,
                transition: 'opacity 0.15s',
              }} />
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px' }}>{label}</div>
            <div style={{ fontFamily: MONO, fontSize: '0.75rem', fontWeight: 700, marginTop: '2px' }}>{total}</div>
          </div>
        );
      })}
    </div>
  );
};

// Small coloured-dot legend entry, used both above the chart and beneath
// the completion bar.
const Dot = ({ color }) => (
  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, display: 'inline-block' }} />
);

const goalKeyFor = (userId) => `sd_user_goal_${userId}`;

const loadGoal = (userId) => {
  try {
    const raw = localStorage.getItem(goalKeyFor(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// ─── Goal modal ───────────────────────────────────────────────────────
// Lets a manager set the deadline (days) and target submission count they
// want this user to hit; persisted locally against the user's id.
const GoalModal = ({ initial, onClose, onSave, onClear }) => {
  const [days, setDays] = useState(initial?.days ?? 30);
  const [count, setCount] = useState(initial?.count ?? 10);

  const submit = (e) => {
    e.preventDefault();
    const d = Math.max(1, Number(days) || 1);
    const c = Math.max(1, Number(count) || 1);
    onSave({ days: d, count: c, setAt: new Date().toISOString() });
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '2rem' }}
    >
      <div
        className="panel"
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '380px', borderRadius: '20px', boxShadow: '0 30px 60px rgba(0,0,0,0.4)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={17} /> Set Submission Goal
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', padding: '4px', color: 'var(--text-muted)', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '5px', display: 'block' }}>
              DAYS TO COMPLETE
            </label>
            <input type="number" min={1} value={days} onChange={e => setDays(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '5px', display: 'block' }}>
              TARGET SUBMISSIONS
            </label>
            <input type="number" min={1} value={count} onChange={e => setCount(e.target.value)} required />
          </div>
          <div style={{ display: 'flex', justifyContent: initial ? 'space-between' : 'flex-end', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
            {initial && (
              <button type="button" onClick={onClear} style={{ background: 'none', border: 'none', color: TONE.red, fontWeight: 700, fontSize: '0.8rem', padding: 0 }}>
                Clear goal
              </button>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={onClose} style={{ background: 'rgba(var(--accent-primary-rgb), 0.1)', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, padding: '0 20px' }}>Cancel</button>
              <button className="primary" type="submit" style={{ padding: '0 24px' }}>Save Goal</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

const UserDetail = () => {
  const { id } = useParams();
  const userId = Number(id);
  const navigate = useNavigate();

  const { users, fetchUsers, notifyGoal: notifyGoalApi } = useSurveyStore();
  const { recentResponses, fetchRecent } = useMonitorStore();
  const { showSuccess, showError } = useNotificationStore();

  useEffect(() => {
    fetchUsers();
    fetchRecent(1000);
  }, []);

  const user = useMemo(() => users.find(u => u.id === userId), [users, userId]);

  const submissions = useMemo(
    () => recentResponses
      .filter(r => r.user_id === userId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    [recentResponses, userId]
  );

  const pendingCount = submissions.filter(r => r.status === 'Pending').length;
  const assignedSurveys = useMemo(() => user?.assigned_surveys || [], [user]);

  // Share of the surveys assigned to this user that they have submitted at
  // least once. Undefined when nothing is assigned.
  const completionRate = useMemo(() => {
    if (!assignedSurveys.length) return null;
    const submittedTitles = new Set(submissions.map(r => r.survey_title));
    const done = assignedSurveys.filter(s => submittedTitles.has(s.title)).length;
    return Math.round((done / assignedSurveys.length) * 100);
  }, [assignedSurveys, submissions]);

  // Per-survey breakdown for the "Overall Completion Rate" bar: done (has
  // an approved submission), pending (submitted but not yet approved), or
  // unstarted (no submission at all).
  const surveyProgress = useMemo(() => {
    if (!assignedSurveys.length) return { done: 0, pending: 0, unstarted: 0, total: 0, rate: 0 };
    let done = 0, pending = 0, unstarted = 0;
    for (const s of assignedSurveys) {
      const subs = submissions.filter(r => r.survey_title === s.title);
      if (subs.length === 0) unstarted += 1;
      else if (subs.some(r => r.status === 'Approved')) done += 1;
      else pending += 1;
    }
    const total = assignedSurveys.length;
    return { done, pending, unstarted, total, rate: total ? Math.round((done / total) * 100) : 0 };
  }, [assignedSurveys, submissions]);

  const [range, setRange] = useState('week');
  const buckets = useMemo(() => buildBuckets(range, submissions), [range, submissions]);

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goal, setGoal] = useState(null);
  useEffect(() => { setGoal(loadGoal(userId)); }, [userId]);

  const saveGoal = async (next) => {
    try { localStorage.setItem(goalKeyFor(userId), JSON.stringify(next)); } catch { /* storage unavailable */ }
    setGoal(next);
    setShowGoalModal(false);
    try {
      await notifyGoalApi(userId, next.days, next.count);
      showSuccess(`${user?.username || 'User'} was notified of the new goal.`);
    } catch (err) {
      showError(err.message || 'Goal saved, but the user could not be notified.');
    }
  };
  const clearGoal = () => {
    try { localStorage.removeItem(goalKeyFor(userId)); } catch { /* storage unavailable */ }
    setGoal(null);
    setShowGoalModal(false);
  };

  const daysLeft = useMemo(() => {
    if (!goal) return null;
    const elapsed = Math.floor((new Date() - new Date(goal.setAt)) / 86400000);
    return goal.days - elapsed;
  }, [goal]);

  const metrics = [
    { value: assignedSurveys.length, label: 'Total Assigned' },
    { value: submissions.length, label: 'Total Submissions' },
    { value: pendingCount, label: 'Total Pending' },
    { value: completionRate === null ? '—' : `${completionRate}%`, label: 'Completion Rate' },
  ];

  if (!user) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: 'clamp(0.5rem, 2vw, 1rem)' }}>
        <LinkButton onClick={() => navigate('/users')}><ArrowLeft size={14} /> Back</LinkButton>
        <div style={{ marginTop: '1rem' }}>
          <EmptyState>{users.length ? 'That user could not be found.' : 'Loading user…'}</EmptyState>
        </div>
      </div>
    );
  }

  const branch = user.groups?.[0]?.name || 'Unassigned';

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: 'clamp(0.5rem, 2vw, 1rem)' }}>

      <div style={{ marginBottom: '0.85rem' }}>
        <LinkButton onClick={() => navigate('/users')}><ArrowLeft size={14} /> Back</LinkButton>
      </div>

      {/* ─── Identity header ────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(100deg, #1e3a8a 0%, #4338ca 55%, #6d28d9 100%)',
        borderRadius: 'var(--radius)',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
          <Avatar name={user.username} size={48} square background="rgba(255,255,255,0.18)" />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="truncate" style={{ color: 'white', fontWeight: 700, fontSize: '1.15rem' }}>{user.username}</span>
              <Pill text={user.is_active ? 'Active' : 'Inactive'} color={user.is_active ? '#4ade80' : '#fbbf24'} />
            </div>
            <div className="truncate" style={{ fontFamily: MONO, fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)' }}>
              {user.email || 'No email'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'clamp(1.25rem, 4vw, 3rem)', flexWrap: 'wrap' }}>
          {metrics.map((m) => (
            <div key={m.label}>
              <div style={{ color: 'white', fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.1 }}>{m.value}</div>
              <div style={{
                fontFamily: MONO, fontSize: '0.6rem', letterSpacing: '0.06em',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginTop: '2px',
              }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Body ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', gridColumn: 'span 1' }}>

          <div className="panel" style={{ padding: '1.15rem 1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1.02rem' }}>Submissions</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', padding: '3px' }}>
                  {RANGE_TABS.map(t => (
                    <button
                      key={t.key}
                      onClick={() => setRange(t.key)}
                      style={{
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 12px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: range === t.key ? 'var(--bg-card)' : 'transparent',
                        color: range === t.key ? 'var(--accent-primary)' : 'var(--text-muted)',
                        boxShadow: range === t.key ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowGoalModal(true)}
                  title="Set submission goal"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '30px', height: '30px', padding: 0,
                    background: 'var(--bg-main)', border: '1px solid var(--border)',
                    borderRadius: '8px', color: 'var(--text-muted)', cursor: 'pointer',
                  }}
                >
                  <MoreVertical size={16} />
                </button>
              </div>
            </div>

            {goal && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                padding: '0.55rem 0.75rem', background: 'var(--bg-main)', border: '1px solid var(--border)',
                borderRadius: '8px', marginBottom: '0.85rem',
              }}>
                <span style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Target size={13} color={TONE.blue} /> Goal: <strong>{goal.count}</strong> submissions in <strong>{goal.days}</strong> days
                </span>
                <span style={{
                  fontFamily: MONO, fontSize: '0.68rem', fontWeight: 700,
                  color: daysLeft <= 0 ? TONE.red : 'var(--text-muted)',
                }}>
                  {daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : 'Deadline passed'}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14px', marginBottom: '6px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <Dot color={TONE.green} /> Completed
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <Dot color={TONE.amber} /> Pending
              </span>
            </div>

            <SubmissionsChart labels={buckets.labels} completed={buckets.completed} pending={buckets.pending} />

            {assignedSurveys.length > 0 && (
              <div style={{ marginTop: '1.1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Overall Completion Rate</span>
                  <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: '0.85rem', color: 'var(--accent-primary)' }}>{surveyProgress.rate}%</span>
                </div>
                <div style={{ display: 'flex', width: '100%', height: '8px', borderRadius: '999px', overflow: 'hidden', background: 'var(--border)' }}>
                  <div style={{ width: `${(surveyProgress.done / surveyProgress.total) * 100}%`, background: TONE.green }} />
                  <div style={{ width: `${(surveyProgress.pending / surveyProgress.total) * 100}%`, background: TONE.amber }} />
                </div>
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', color: TONE.green, fontWeight: 700 }}>{surveyProgress.done} done</span>
                  <span style={{ fontSize: '0.72rem', color: TONE.amber, fontWeight: 700 }}>{surveyProgress.pending} pending</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>{surveyProgress.unstarted} unstarted</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          <div className="panel" style={{ padding: '1.15rem 1.25rem' }}>
            <h3 style={{ fontSize: '1.02rem', marginBottom: '0.9rem' }}>Profile Info</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.9rem 1rem' }}>
              {[
                { k: 'Email', v: user.email || '—' },
                { k: 'Status', v: <Pill text={user.is_active ? 'Active' : 'Inactive'} color={user.is_active ? TONE.green : TONE.amber} /> },
                { k: 'Branch', v: branch },
                { k: 'Created', v: fmtDate(user.created_at) },
                { k: 'Password', v: 'Encrypted' },
              ].map(({ k, v }) => (
                <div key={k}>
                  <div style={{
                    fontFamily: MONO, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px',
                  }}>{k}</div>
                  <div className="truncate" style={{ fontSize: '0.85rem' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel" style={{ padding: '1.15rem 1.25rem' }}>
            <h3 style={{ fontSize: '1.02rem', marginBottom: '0.9rem' }}>Assigned Surveys</h3>
            {assignedSurveys.length === 0 ? (
              <EmptyState>No surveys assigned.</EmptyState>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {assignedSurveys.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/builder/${s.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                      width: '100%', padding: '0.6rem 0.75rem',
                      background: 'var(--bg-main)', border: '1px solid var(--border)',
                      borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                      color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.82rem',
                    }}
                  >
                    <span className="truncate" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0 }} />
                      <span className="truncate">{s.title}</span>
                    </span>
                    <ChevronRight size={14} style={{ flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Submission History — full width ───────────────────────── */}
      <div className="panel" style={{ padding: '1.15rem 1.25rem', marginTop: '1.25rem' }}>
        <PanelHeader
          title="Submission History"
          action={<LinkButton onClick={() => navigate('/monitor')}>View All <ChevronRight size={13} /></LinkButton>}
        />
        {submissions.length === 0 ? (
          <EmptyState>No submissions from this user yet.</EmptyState>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Survey</Th>
                <Th align="center">Date</Th>
                <Th align="center">Answers</Th>
                <Th align="center">Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {submissions.slice(0, 8).map((r) => {
                const tone = STATUS_TONE[r.status] || { label: r.status, color: TONE.grey };
                return (
                  <tr key={r.id}>
                    <Td><span className="truncate" style={{ fontWeight: 600 }}>{r.survey_title}</span></Td>
                    <Td align="center"><span style={metaText}>{fmtDate(r.timestamp)}</span></Td>
                    <Td align="center">{r.answer_count ?? '—'}</Td>
                    <Td align="center"><Pill text={tone.label} color={tone.color} title={`Stored status: ${r.status}`} /></Td>
                    <Td align="right">
                      <LinkButton onClick={() => navigate(`/review/${r.id}`)}>View</LinkButton>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </div>

      {showGoalModal && (
        <GoalModal
          initial={goal}
          onClose={() => setShowGoalModal(false)}
          onSave={saveGoal}
          onClear={clearGoal}
        />
      )}
    </div>
  );
};

export default UserDetail;
