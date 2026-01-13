import { memo } from 'react';

interface FilterChipProps {
  label: string;
  value: string;
  colorClass?: string;
  onRemove: () => void;
}

export const FilterChip = memo(({ label, value, colorClass = 'bg-blue-100 text-blue-800', onRemove }: FilterChipProps) => (
  <span className={`inline-flex items-center gap-1 px-3 py-1 text-sm ${colorClass} rounded-full`}>
    <span className="font-medium">{label}:</span> {value}
    <button
      onClick={onRemove}
      className="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
      aria-label={`Remove ${label} filter`}
    >
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  </span>
));

FilterChip.displayName = 'FilterChip';

interface FilterChipsContainerProps {
  children: React.ReactNode;
  onClearAll: () => void;
  hasFilters: boolean;
}

export const FilterChipsContainer = memo(({ children, onClearAll, hasFilters }: FilterChipsContainerProps) => {
  if (!hasFilters) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-2 items-center">
      <span className="text-sm text-gray-600">Active filters:</span>
      {children}
      <button
        onClick={onClearAll}
        className="text-sm text-red-600 hover:text-red-800 font-medium ml-2"
      >
        Clear all
      </button>
    </div>
  );
});

FilterChipsContainer.displayName = 'FilterChipsContainer';
