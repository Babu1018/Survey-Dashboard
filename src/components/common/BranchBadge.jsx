import { Code2 } from 'lucide-react';
import { branchTone } from '../../utils/dashboardTheme';

export const BranchBadge = ({ name, index = 0, size = 34 }) => {
  const color = branchTone(index);
  return (
    <div
      title={name}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: size * 0.28,
        background: color,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Code2 size={size * 0.5} />
    </div>
  );
};
