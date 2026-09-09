// Shared color mapping for Response.status badges, so the admin Survey
// Report list/detail view and the respondent-facing My Submissions page can
// never visually disagree about what a given status means.
export function getStatusBadgeColors(status) {
  const map = {
    Resolved: { fg: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.2)' },
    'Intervention Triggered': { fg: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.2)' },
    Approved: { fg: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.2)' },
    Rejected: { fg: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)' },
  };
  return map[status] || { fg: '#64748b', bg: 'rgba(100, 116, 139, 0.1)', border: 'rgba(100, 116, 139, 0.2)' };
}
