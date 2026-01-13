import { memo } from 'react';

interface StatusBadgeProps {
  status: string | null | undefined;
  size?: 'sm' | 'md';
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-100 text-green-800 border-green-200',
  complete: 'bg-green-100 text-green-800 border-green-200',
  postponed: 'bg-orange-100 text-orange-800 border-orange-200',
  hold: 'bg-orange-100 text-orange-800 border-orange-200',
  need_approval: 'bg-blue-100 text-blue-800 border-blue-200',
  'need approval': 'bg-blue-100 text-blue-800 border-blue-200',
  'pending approval': 'bg-blue-100 text-blue-800 border-blue-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'in progress': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  default: 'bg-gray-100 text-gray-800 border-gray-200',
};

const formatStatusLabel = (status: string): string => {
  if (status.toLowerCase() === 'need_approval') return 'Need Approval';
  if (status.toLowerCase() === 'in_progress') return 'In Progress';
  return status;
};

export const StatusBadge = memo(({ status, size = 'md' }: StatusBadgeProps) => {
  const normalizedStatus = status?.toLowerCase() || '';
  const styleClass = STATUS_STYLES[normalizedStatus] || STATUS_STYLES.default;
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`${sizeClass} rounded-full font-semibold inline-block w-fit border ${styleClass}`}
    >
      {status ? formatStatusLabel(status) : '-'}
    </span>
  );
});

StatusBadge.displayName = 'StatusBadge';
