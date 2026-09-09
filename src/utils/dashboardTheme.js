// Non-component shared values for the dashboard pages. Kept out of the
// component file so React Fast Refresh keeps working there.

export const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

export const metaText = { fontFamily: MONO, fontSize: '0.68rem', color: 'var(--text-muted)' };

// Semantic colours. Status hues are reserved for state and are never reused
// as decorative series colours.
export const TONE = {
  blue: '#3b82f6',
  green: '#10b981',
  amber: '#f59e0b',
  teal: '#14b8a6',
  red: '#ef4444',
  grey: '#64748b',
};

export const timeAgo = (timestamp) => {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
};

// Decorative identity colours for survey branches, assigned in fixed order by
// position so a branch keeps its colour as the list grows. Anything past the
// list falls back to slate rather than generating a new hue.
const BRANCH_HUES = ['#7c3aed', '#2563eb', '#d97706', '#0d9488', '#db2777', '#4f46e5'];

export const branchTone = (index) => BRANCH_HUES[index] ?? '#64748b';
