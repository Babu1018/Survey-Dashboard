import { Code2, MonitorSmartphone, Layers, ClipboardList, Hash, FolderKanban } from 'lucide-react';

// Shared category color/icon scheme + branch ordering, so Survey Fields and
// a category's detail page always agree on which swatch belongs to which
// category (order determines the color, so both pages must derive it the
// same way from the same survey list).
export const BRANCH_PALETTE = [
  { color: '#7c3aed', icon: <Code2 size={18} /> },
  { color: '#2563eb', icon: <MonitorSmartphone size={18} /> },
  { color: '#ca8a04', icon: <Layers size={18} /> },
  { color: '#059669', icon: <ClipboardList size={18} /> },
  { color: '#db2777', icon: <Hash size={18} /> },
  { color: '#0891b2', icon: <FolderKanban size={18} /> },
];

export const getBranches = (surveys) => {
  const baseBatches = ['AI', 'Developer', 'DevOps'];
  const dynamicBatches = surveys ? [...new Set(surveys.map(s => s.category).filter(Boolean))] : [];
  return [...new Set([...baseBatches, ...dynamicBatches])].filter(batch =>
    (surveys || []).some(s => s.category === batch)
  );
};

export const getBranchSwatch = (category, branches) => {
  const i = Math.max(0, branches.indexOf(category));
  return BRANCH_PALETTE[i % BRANCH_PALETTE.length];
};
