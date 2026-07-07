import { useEffect, useState, useRef } from 'react';
import useMonitorStore from '../store/useMonitorStore';
import useNotificationStore from '../store/useNotificationStore';
import { 
  Activity, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  X, 
  Download, 
  Search, 
  ChevronDown, 
  Eye, 
  Trash2, 
  Square, 
  CheckSquare,
  Check
} from 'lucide-react';

/* ─── PDF Download helper ─────────────────────────────────── */
const downloadPDF = (detail) => {
  const win = window.open('', '_blank');
  const dateStr = new Date(detail.timestamp).toLocaleString();
  const rows = detail.answers.map((ans) => `
    <tr style="page-break-inside:avoid">
      <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;vertical-align:top;width:50%;background:#f8fafc;font-weight:700;color:#1e293b">${ans.question_text}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;vertical-align:top;width:50%;color:#475569">${ans.answer_text || '<em style="opacity:.5">No answer</em>'}</td>
    </tr>`).join('');

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Report – ${detail.survey_title}</title>
    <style>
      body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;margin:0;padding:40px}
      h1{font-size:22px;margin:0 0 4px}
      .meta{font-size:13px;color:#64748b;margin-bottom:28px}
      table{width:100%;border-collapse:collapse;margin-top:20px}
      th{background:#1e40af;color:white;padding:12px 16px;text-align:left;font-size:13px}
      @media print{.no-print{display:none}}
    </style></head><body>
    <h1>${detail.survey_title}</h1>
    <div class="meta">Respondent: <strong>${detail.respondent || 'Anonymous'}</strong> &nbsp;|&nbsp; Submitted: ${dateStr}</div>
    <table>
      <thead><tr><th>Question</th><th>Answer</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <script>window.onload=()=>{window.print();window.close();}</script>
    </body></html>`);
  win.document.close();
};

/* ─── Tooltip component ───────────────────────────────────── */
const Tooltip = ({ children, label }) => {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span style={{
          position: 'absolute',
          bottom: '130%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1e293b',
          color: 'white',
          fontSize: '0.72rem',
          fontWeight: 600,
          padding: '5px 10px',
          borderRadius: '8px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 999,
          boxShadow: '0 4px 12px rgba(0,0,0,.3)'
        }}>{label}</span>
      )}
    </span>
  );
};

/* ─── Response Detail Modal ───────────────────────────────── */
const ResponseDetailModal = ({ responseId, onClose, onDelete }) => {
  const { fetchResponseDetail } = useMonitorStore();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDetail = async () => {
      const data = await fetchResponseDetail(responseId);
      setDetail(data);
      setLoading(false);
    };
    loadDetail();
  }, [responseId]);

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '600px', textAlign: 'center', padding: '4rem' }}>
          <div className="spin" style={{ marginBottom: '1rem' }}>
            <Activity size={32} color="var(--accent-primary)" />
          </div>
          <p>Loading report data...</p>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '600px', padding: '4rem', textAlign: 'center' }}>
          <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
          <h3>Error loading report</h3>
          <p>We couldn't retrieve the details for this submission.</p>
          <button className="primary" onClick={onClose} style={{ marginTop: '2rem' }}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content modal-scroll"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '1100px', width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: 0, borderRadius: '24px' }}
      >
        {/* ── Modal Header ── */}
        <div style={{
          padding: '1.5rem 2rem',
          background: 'var(--bg-sidebar)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, zIndex: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              {detail.respondent || 'Anonymous'}
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} /> Submitted on {new Date(detail.timestamp).toLocaleString()}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {/* Status Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>STATUS:</span>
              <select 
                value={detail.status}
                onChange={async (e) => {
                  const { showSuccess, showError } = useNotificationStore.getState();
                  try {
                    const updated = await useMonitorStore.getState().updateResponseStatus(detail.id, e.target.value);
                    setDetail(prev => ({ ...prev, status: updated.status }));
                    showSuccess('Status updated.');
                  } catch {
                    showError('Failed to update status.');
                  }
                }}
                style={{ 
                  padding: '6px 12px', 
                  borderRadius: '10px', 
                  fontSize: '0.8rem', 
                  fontWeight: 700,
                  background: detail.status === 'Resolved' ? '#10b981' : (detail.status === 'Intervention Triggered' ? '#f97316' : 'var(--bg-card)'),
                  color: (detail.status === 'Resolved' || detail.status === 'Intervention Triggered') ? 'white' : 'var(--text-main)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer'
                }}
              >
                <option value="Pending">Pending Review</option>
                <option value="Reviewed">Reviewed</option>
                <option value="Intervention Triggered">Intervention Triggered</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => downloadPDF(detail)}
              className="icon-button"
              title="Download as PDF"
              style={{
                background: 'var(--accent-primary)',
                color: 'white',
                border: 'none'
              }}
            >
              <Download size={18} />
            </button>
            
            <button
              onClick={() => onDelete(detail.id)}
              className="icon-button"
              title="Delete Submission"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}
            >
              <Trash2 size={18} />
            </button>

            <button onClick={onClose} style={{
              background: 'var(--bg-main)', border: '1px solid var(--border)',
              padding: '8px', borderRadius: '12px', cursor: 'pointer'
            }}><X size={20} /></button>
          </div>
        </div>
      </div>

      {/* ── Score Summary Card ── */}
      <div style={{ padding: '2rem 2rem 0' }}>
           <div style={{ 
             background: 'var(--bg-main)', 
             borderRadius: '20px', 
             border: '1px solid var(--border)', 
             padding: '1.5rem',
             display: 'grid',
             gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
             gap: '2rem'
           }}>
             <div style={{ borderRight: '1px solid var(--border)', paddingRight: '1rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Total Assessment Score</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--accent-primary)' }}>{detail.total_score}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>points</div>
                </div>
             </div>
             
             <div style={{ borderRight: '1px solid var(--border)', paddingRight: '1rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Risk Severity</div>
                <div style={{ 
                  fontSize: '1.2rem', 
                  fontWeight: 800, 
                  color: detail.has_red_flag ? '#ef4444' : (detail.total_score > 15 ? '#f97316' : '#10b981'),
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '10px'
                }}>
                  {detail.has_red_flag && <AlertCircle size={20} />}
                  {detail.severity}
                </div>
             </div>

             <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Scores by Scale</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                  {Object.entries(detail.scores_by_scale || {}).map(([scale, score]) => (
                    <div key={scale} style={{ 
                      fontSize: '0.75rem', 
                      padding: '4px 10px', 
                      background: 'var(--bg-sidebar)', 
                      border: '1px solid var(--border)', 
                      borderRadius: '8px',
                      fontWeight: 600
                    }}>
                      {scale}: <span style={{ color: 'var(--accent-primary)', fontWeight: 800 }}>{score}</span>
                    </div>
                  ))}
                  {Object.keys(detail.scores_by_scale || {}).length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No scales defined</span>}
                </div>
             </div>
           </div>
        </div>

        {/* ── Answer Cards ── */}
        <div style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {detail.answers.map((ans, idx) => (
              <div key={idx} style={{
                display: 'grid',
                gridTemplateColumns: '70% 30%',
                borderRadius: '14px',
                border: '1px solid var(--border)',
                overflow: 'hidden'
              }}>
                {/* LEFT – Question */}
                <div style={{
                  padding: '1.25rem 1.5rem',
                  background: 'rgba(var(--accent-primary-rgb), 0.03)', 
                  borderRight: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', gap: '4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: ans.is_red_flag ? '#ef4444' : 'var(--accent-primary)', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Question {idx + 1} {ans.scale ? `• ${ans.scale}` : ''}</span>
                    {ans.is_red_flag && <span style={{ fontSize: '0.6rem', padding: '2px 6px', background: '#ef4444', color: 'white', borderRadius: '4px', fontWeight: 900 }}>RED FLAG</span>}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '1rem', lineHeight: '1.5', color: 'var(--text-main)' }}>
                    {ans.question_text}
                  </div>
                </div>

                {/* RIGHT – Answer */}
                <div style={{
                  padding: '1.25rem 1.5rem',
                  background: 'var(--bg-main)',
                  fontSize: '0.92rem', fontWeight: 500,
                  color: 'var(--text-muted)', lineHeight: '1.6',
                  display: 'flex', flexDirection: 'column', gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Answer</span>
                    {ans.score > 0 && <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>Score: {ans.score}</span>}
                  </div>
                  <div style={{ color: ans.is_red_flag ? '#ef4444' : 'var(--text-main)', fontWeight: 700, fontSize: '1rem', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                    {ans.answer_text || <span style={{ fontStyle: 'italic', opacity: .5 }}>No answer provided</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Time filter options ─────────────────────────────────── */
const TIME_FILTERS = [
  { label: 'All Time', value: 'all' },
  { label: 'Last Hour', value: '1h' },
  { label: 'Last 6 Hours', value: '6h' },
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
];

const passesTimeFilter = (timestamp, filter) => {
  if (filter === 'all' || !timestamp) return true;
  const now = Date.now();
  const t = new Date(timestamp).getTime();
  if (filter === '1h') return now - t < 3600_000;
  if (filter === '6h') return now - t < 6 * 3600_000;
  if (filter === 'today') {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return t >= d.getTime();
  }
  if (filter === 'week') {
    const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0);
    return t >= d.getTime();
  }
  return true;
};

/* ─── Main LiveMonitor page ───────────────────────────────── */
const LiveMonitor = () => {
  const { recentResponses, connected, connectWebSocket, fetchRecent, deleteResponse, bulkDeleteResponses } = useMonitorStore();
  const { showSuccess, showError } = useNotificationStore();
  
  const [selectedResponseId, setSelectedResponseId] = useState(null);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const dropRef = useRef(null);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, timeFilter]);

  useEffect(() => {
    fetchRecent();
    if (!connected) connectWebSocket();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Ensure unique responses by ID
  const uniqueResponses = Array.from(new Map(recentResponses.map(r => [r.id, r])).values());

  const filtered = uniqueResponses.filter(r => {
    const term = search.toLowerCase();
    const matchSearch = !term ||
      (r.survey_title || '').toLowerCase().includes(term) ||
      (r.respondent || '').toLowerCase().includes(term) ||
      (r.category || '').toLowerCase().includes(term);
    return matchSearch && passesTimeFilter(r.timestamp, timeFilter);
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedResponses = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(r => r.id));
    }
  };

  const handleDeleteIndividual = async (id) => {
    if (window.confirm('Are you sure you want to delete this submission?')) {
      try {
        await deleteResponse(id);
        setSelectedResponseId(null);
        setSelectedIds(prev => prev.filter(x => x !== id));
        showSuccess('Submission deleted.');
      } catch (err) {
        showError(err.message || 'Delete failed.');
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} selected submission(s)?`)) {
      try {
        await bulkDeleteResponses(selectedIds);
        setSelectedIds([]);
        setIsSelectMode(false);
        showSuccess('Submissions deleted.');
      } catch (err) {
        showError(err.message || 'Bulk delete failed.');
      }
    }
  };

  const selectedLabel = TIME_FILTERS.find(f => f.value === timeFilter)?.label || 'All Time';

  // Grid columns based on mode
  const gridTemplate = isSelectMode 
    ? '48px 48px minmax(180px,2fr) minmax(140px,1.8fr) 100px minmax(100px,140px) 120px'
    : '48px minmax(180px,2fr) minmax(140px,1.8fr) 100px 120px minmax(100px,140px) 120px';

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* ── Page header ── */}
      <div className="page-header-container">
        <div className="page-header">
          <h1>Real-time Response Monitor</h1>
          <p>Live updates of survey submissions across all batches.</p>
        </div>
      </div>

      {/* ── Search + Filter bar ── */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        marginBottom: '1.5rem',
        justifyContent: 'space-between'
      }}>
        {/* Left Group: Search + Dropdown together */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            background: 'var(--bg-sidebar)', padding: '0.5rem 1.25rem',
            borderRadius: '12px', border: '1px solid var(--border)',
            height: '42px', width: '350px', boxSizing: 'border-box'
          }}>
            <Search size={18} color="var(--text-muted)" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search surveys or respondents…"
              style={{ border: 'none', background: 'transparent', padding: '5px 0', fontSize: '0.9rem', flexGrow: 1, outline: 'none', color: 'var(--text-main)' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            )}
          </div>

          {/* Time filter dropdown */}
          <div ref={dropRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '0 16px', borderRadius: '12px',
                background: 'var(--bg-sidebar)', border: '1px solid var(--border)',
                color: 'var(--text-main)', fontWeight: 600, fontSize: '0.85rem',
                cursor: 'pointer', transition: 'all .2s', whiteSpace: 'nowrap',
                height: '42px', boxSizing: 'border-box'
              }}
            >
              <Clock size={16} color="var(--text-muted)" />
              {selectedLabel}
              <ChevronDown size={15} color="var(--text-muted)" style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>

            {dropdownOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: 'var(--bg-sidebar)', border: '1px solid var(--border)',
                borderRadius: '12px', overflow: 'hidden', zIndex: 200,
                boxShadow: '0 12px 32px rgba(0,0,0,.18)', minWidth: '160px'
              }}>
                {TIME_FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => { setTimeFilter(f.value); setDropdownOpen(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '10px 16px', border: 'none', cursor: 'pointer',
                      background: timeFilter === f.value ? 'rgba(59,130,246,.08)' : 'transparent',
                      color: timeFilter === f.value ? 'var(--accent-primary)' : 'var(--text-main)',
                      fontWeight: timeFilter === f.value ? 700 : 500,
                      fontSize: '0.88rem', transition: 'background .15s'
                    }}
                    onMouseEnter={e => { if (timeFilter !== f.value) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (timeFilter !== f.value) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center Spacer */}
        <div style={{ flex: 1 }} />

        {/* Right Group: Select Mode / Bulk Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!isSelectMode ? (
            <button
              onClick={() => setIsSelectMode(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '0 20px', borderRadius: '10px',
                background: 'var(--bg-sidebar)', color: 'var(--text-main)',
                border: '1px solid var(--border)', fontWeight: 700, fontSize: '0.85rem',
                cursor: 'pointer', height: '42px', transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <CheckSquare size={16} />
              Select
            </button>
          ) : (
            <>
              <button
                onClick={() => { setIsSelectMode(false); setSelectedIds([]); }}
                style={{
                  padding: '0 20px', borderRadius: '10px',
                  background: 'transparent', color: 'var(--text-muted)',
                  border: '1px solid var(--border)', fontWeight: 600, fontSize: '0.85rem',
                  cursor: 'pointer', height: '42px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selectedIds.length === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '0 24px', borderRadius: '10px',
                  background: selectedIds.length > 0 ? '#ef4444' : 'var(--bg-sidebar)', 
                  color: selectedIds.length > 0 ? 'white' : 'var(--text-muted)',
                  border: 'none', fontWeight: 800, fontSize: '0.85rem',
                  cursor: selectedIds.length > 0 ? 'pointer' : 'not-allowed', 
                  height: '42px', boxShadow: selectedIds.length > 0 ? '0 6px 16px rgba(239, 68, 68, 0.25)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                <Trash2 size={16} />
                Delete {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="panel" style={{ minHeight: '500px', padding: 0 }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          padding: '1rem 2rem',
          background: 'var(--bg-main)',
          borderBottom: '1px solid var(--border)',
          color: 'var(--text-muted)',
          fontSize: '0.72rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          alignItems: 'center'
        }}>
          {isSelectMode && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button 
                onClick={handleSelectAll} 
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: selectedIds.length === filtered.length && filtered.length > 0 ? 'var(--accent-primary)' : 'var(--text-muted)' }}
              >
                {selectedIds.length === filtered.length && filtered.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
              </button>
            </div>
          )}
          <span>S.No</span>
          <span>Survey Details</span>
          <span>Respondent</span>
          <span>Risk</span>
          <span>Status</span>
          <span>Time</span>
          <span style={{ textAlign: 'center' }}>VIEW</span>
        </div>

        {/* Rows */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {paginatedResponses.map((res, i) => {
            const actualIndex = (currentPage - 1) * ITEMS_PER_PAGE + i;
            return (
            <div
              key={res.id || i}
              style={{
                display: 'grid',
                gridTemplateColumns: gridTemplate,
                padding: '1rem 2rem',
                borderBottom: '1px solid var(--border)',
                fontSize: '0.9rem',
                backgroundColor: selectedIds.includes(res.id) ? 'rgba(var(--accent-primary-rgb), 0.05)' : (i % 2 === 1 ? 'rgba(var(--accent-primary-rgb), 0.02)' : 'transparent'),
                transition: 'background .3s',
                alignItems: 'center'
              }}
            >
              {/* Checkbox (Select Mode Only) */}
              {isSelectMode && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button 
                    onClick={() => handleToggleSelect(res.id)} 
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: selectedIds.includes(res.id) ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                  >
                    {selectedIds.includes(res.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                </div>
              )}

              {/* S.No */}
              <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>{actualIndex + 1}</span>

              {/* Survey Details */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  fontSize: '0.68rem', padding: '3px 9px',
                  background: 'var(--accent-primary)', color: 'white',
                  borderRadius: '6px', fontWeight: 800, whiteSpace: 'nowrap'
                }}>{res.category}</span>
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.survey_title}</span>
              </div>

              {/* Respondent with tooltip */}
              <Tooltip label={res.respondent || 'Anonymous'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'default' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: 'var(--accent-primary)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '0.75rem', flexShrink: 0
                  }}>
                    {(res.respondent || 'A')[0].toUpperCase()}
                  </div>
                  <span style={{
                    fontWeight: 500, whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px'
                  }}>
                    {res.respondent || 'Anonymous'}
                  </span>
                </div>
              </Tooltip>

              {/* Risk Badge */}
              <div style={{ display: 'flex' }}>
                <span style={{
                  fontSize: '0.65rem', padding: '4px 10px', borderRadius: '20px',
                  fontWeight: 800, textTransform: 'uppercase',
                  background: res.has_red_flag ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  color: res.has_red_flag ? '#ef4444' : '#10b981',
                  border: `1px solid ${res.has_red_flag ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                  {res.has_red_flag && <AlertCircle size={10} />}
                  {res.has_red_flag ? 'High Risk' : 'Normal'}
                </span>
              </div>

              {/* Status Badge */}
              <div style={{ display: 'flex' }}>
                <span style={{
                  fontSize: '0.65rem', padding: '4px 10px', borderRadius: '6px',
                  fontWeight: 700, 
                  background: res.status === 'Resolved' ? 'rgba(16, 185, 129, 0.1)' : (res.status === 'Intervention Triggered' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(100, 116, 139, 0.1)'),
                  color: res.status === 'Resolved' ? '#10b981' : (res.status === 'Intervention Triggered' ? '#f97316' : '#64748b'),
                  border: `1px solid ${res.status === 'Resolved' ? 'rgba(16, 185, 129, 0.2)' : (res.status === 'Intervention Triggered' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(100, 116, 139, 0.2)')}`,
                }}>
                  {res.status}
                </span>
              </div>

              {/* Time */}
              <Tooltip label={res.timestamp ? new Date(res.timestamp).toLocaleString() : 'Unknown'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', cursor: 'default' }}>
                  <Clock size={14} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                    {res.timestamp ? new Date(res.timestamp).toLocaleTimeString() : 'Just now'}
                  </span>
                </div>
              </Tooltip>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                <button
                  onClick={() => setSelectedResponseId(res.id)}
                  title="View Detail"
                  className="icon-button"
                  style={{
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border)',
                    color: 'var(--accent-primary)'
                  }}
                >
                  <Eye size={20} />
                </button>
              </div>
            </div>
          )})}

          {filtered.length === 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '8rem 0',
              color: 'var(--text-muted)', opacity: 0.6
            }}>
              <CheckCircle2 size={56} strokeWidth={1} style={{ opacity: .2, marginBottom: '1.5rem' }} />
              <p style={{ fontWeight: 600, margin: 0 }}>No responses found.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>
                {search || timeFilter !== 'all' ? 'Try adjusting your search or time filter.' : 'Waiting for incoming survey submissions…'}
              </p>
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            padding: '1rem 2rem', borderTop: '1px solid var(--border)', background: 'var(--bg-main)'
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} entries
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                style={{
                  padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)',
                  background: currentPage === 1 ? 'transparent' : 'var(--bg-sidebar)',
                  color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-main)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.5 : 1,
                  fontWeight: 600
                }}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  style={{
                    padding: '6px 12px', borderRadius: '6px', 
                    border: page === currentPage ? `1px solid var(--accent-primary)` : '1px solid var(--border)',
                    background: page === currentPage ? 'var(--accent-primary)' : 'var(--bg-sidebar)',
                    color: page === currentPage ? 'white' : 'var(--text-main)',
                    cursor: 'pointer',
                    fontWeight: page === currentPage ? 700 : 500
                  }}
                >
                  {page}
                </button>
              ))}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                style={{
                  padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)',
                  background: currentPage === totalPages ? 'transparent' : 'var(--bg-sidebar)',
                  color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-main)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.5 : 1,
                  fontWeight: 600
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedResponseId && (
        <ResponseDetailModal
          responseId={selectedResponseId}
          onClose={() => setSelectedResponseId(null)}
          onDelete={handleDeleteIndividual}
        />
      )}

      <style>{`
        .modal-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .modal-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .modal-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 10px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        .modal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.2);
          background-clip: content-box;
        }
        body.dark .modal-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          background-clip: content-box;
        }
        body.dark .modal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
          background-clip: content-box;
        }
      `}</style>
    </div>
  );
};

export default LiveMonitor;
