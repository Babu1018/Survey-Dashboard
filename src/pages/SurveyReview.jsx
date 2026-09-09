import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useSurveyStore from '../store/useSurveyStore';
import useMonitorStore from '../store/useMonitorStore';
import useAuthStore from '../store/useAuthStore';
import {
  Users as UsersIcon,
  Folder,
  ClipboardList,
  CheckCircle2,
  ChevronRight,
  Eye,
  AlertCircle,
} from 'lucide-react';
import {
  Pill, StatCard, StatGrid,
  Th, Td, TableWrap, PanelHeader, LinkButton, EmptyState,
} from '../components/common/StatCard';
import { metaText, TONE } from '../utils/dashboardTheme';
import { BranchBadge } from '../components/common/BranchBadge';

const STATUS_TONE = {
  Approved: { label: 'Approved', color: TONE.green },
  Rejected: { label: 'Declined', color: TONE.red },
  Pending: { label: 'Pending', color: TONE.amber },
};

const fmtReceived = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const SurveyReview = () => {
  const { surveys, fetchSurveys, users, fetchUsers } = useSurveyStore();
  const { recentResponses, fetchRecent, scopeAll, scopeUserIds, fetchScope } = useMonitorStore();
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSurveys();
    fetchUsers();
    fetchRecent(1000);
    fetchScope();
  }, []);

  const pendingTotal = recentResponses.filter(r => r.status === 'Pending').length;
  const approvedTotal = recentResponses.filter(r => r.status === 'Approved').length;
  // Same group-membership scope as the Users page — a Manager's assigned
  // users, not just the ones who happen to have submitted something yet.
  const fieldUsers = useMemo(() => {
    const staff = users.filter(u => u.role === 'User');
    if (currentUser?.role !== 'Manager' || scopeAll) return staff.length;
    return staff.filter(u => scopeUserIds.has(u.id)).length;
  }, [users, currentUser, scopeAll, scopeUserIds]);

  // Every submission in scope, newest first — one table row each.
  const rows = useMemo(
    () => [...recentResponses].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    [recentResponses]
  );

  // Stable colour per branch, by first appearance in the sorted list.
  const branchIndex = useMemo(() => {
    const order = new Map();
    for (const r of rows) {
      const key = r.category || 'Uncategorised';
      if (!order.has(key)) order.set(key, order.size);
    }
    return order;
  }, [rows]);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: 'clamp(0.5rem, 2vw, 1rem)' }}>

      {/* ─── Heading ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem',
      }}>
        <div>
          <h1 style={{ fontWeight: 800, color: 'var(--accent-secondary)', marginBottom: '0.3rem' }}>Survey Review</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Approve, decline, or request changes on survey questions
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <Pill text={`${pendingTotal} Pending`} color={TONE.amber} />
          <Pill text={`${approvedTotal} Approved`} color={TONE.green} />
        </div>
      </div>

      {/* ─── Stats ──────────────────────────────────────────────── */}
      <StatGrid>
        <StatCard label="Total Users" value={fieldUsers} icon={<UsersIcon size={16} />} color={TONE.blue} />
        <StatCard label="Total Surveys" value={surveys.length} icon={<Folder size={16} />} color={TONE.teal} />
        <StatCard label="Surveys In Review" value={pendingTotal} icon={<ClipboardList size={16} />} color={TONE.amber} />
        <StatCard label="Total Approved" value={approvedTotal} icon={<CheckCircle2 size={16} />} color={TONE.green} />
      </StatGrid>

      {/* ─── Branch table ───────────────────────────────────────── */}
      <div className="panel" style={{ padding: '1.15rem 1.25rem' }}>
        <PanelHeader
          title="Performance"
          action={<LinkButton onClick={() => navigate('/users')}>View All <ChevronRight size={13} /></LinkButton>}
        />

        {rows.length === 0 ? (
          <EmptyState>No submissions to review yet.</EmptyState>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Branch</Th>
                <Th>Survey Title</Th>
                <Th>User</Th>
                <Th align="center">Total Responses</Th>
                <Th align="center">Date Received</Th>
                <Th align="center">Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const branch = r.category || 'Uncategorised';
                const tone = STATUS_TONE[r.status] || STATUS_TONE.Pending;
                return (
                  <tr key={r.id}>
                    <Td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <BranchBadge name={branch} index={branchIndex.get(branch) ?? 0} size={30} />
                        <div style={{ minWidth: 0 }}>
                          <div className="truncate" style={{ fontWeight: 600 }}>{branch}</div>
                          <div style={metaText}>Survey Category</div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <span className="truncate" style={{ fontWeight: 600 }}>{r.survey_title}</span>
                      {r.has_red_flag && <AlertCircle size={13} color={TONE.red} style={{ marginLeft: '6px', verticalAlign: 'middle' }} />}
                    </Td>
                    <Td><span className="truncate" style={metaText}>{r.respondent || 'Anonymous'}</span></Td>
                    <Td align="center" style={{ fontWeight: 600 }}>{r.answer_count ?? 0}</Td>
                    <Td align="center"><span style={metaText}>{fmtReceived(r.timestamp)}</span></Td>
                    <Td align="center"><Pill text={tone.label} color={tone.color} /></Td>
                    <Td align="right">
                      <button
                        onClick={() => navigate(`/review/${r.id}`)}
                        title="Open submission"
                        style={{
                          width: '30px', height: '30px', padding: 0,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(59, 130, 246, 0.08)', border: '1px solid var(--border)',
                          borderRadius: '8px', color: 'var(--accent-primary)', cursor: 'pointer',
                        }}
                      >
                        <Eye size={15} />
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </div>
    </div>
  );
};

export default SurveyReview;
