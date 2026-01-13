import { memo } from 'react';

interface EditHistoryButtonProps {
  hasEditHistory: boolean;
  onClick: () => void;
}

export const EditHistoryButton = memo(({ hasEditHistory, onClick }: EditHistoryButtonProps) => {
  if (!hasEditHistory) return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex items-center justify-center w-6 h-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded shadow-sm transition-all"
      title="View edit history"
    >
      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
      </svg>
    </button>
  );
});

EditHistoryButton.displayName = 'EditHistoryButton';
