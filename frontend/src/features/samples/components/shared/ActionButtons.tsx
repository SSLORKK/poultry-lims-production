import { memo } from 'react';

interface ActionButtonsProps {
  isSelected: boolean;
  hasWriteAccess: boolean;
  coaStatus: string | null;
  onEdit: () => void;
  onCOA: () => void;
  showCOA?: boolean;
  showStatusUpdate?: boolean;
  onStatusUpdate?: () => void;
}

export const ActionButtons = memo(({
  isSelected,
  hasWriteAccess,
  coaStatus,
  onEdit,
  onCOA,
  showCOA = true,
  showStatusUpdate = false,
  onStatusUpdate,
}: ActionButtonsProps) => {
  if (!isSelected) return null;

  return (
    <div className="flex items-center gap-1.5">
      {/* Edit Button */}
      <button
        onClick={onEdit}
        disabled={!hasWriteAccess}
        className={`p-2 rounded-lg transition-all duration-200 transform hover:scale-110 active:scale-95 ${
          hasWriteAccess
            ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
        title={hasWriteAccess ? 'Edit sample' : 'No write permission'}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      </button>

      {/* COA/Certificate Button */}
      {showCOA && (
        <button
          onClick={onCOA}
          className={`p-2 rounded-lg transition-all duration-200 transform hover:scale-110 active:scale-95 hover:shadow-md ${
            coaStatus === 'completed'
              ? 'bg-yellow-500 text-white hover:bg-yellow-600'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
          title={coaStatus === 'completed' ? 'Edit Certificate' : 'Create Certificate'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </button>
      )}

      {/* Status Update Button (for Serology) */}
      {showStatusUpdate && onStatusUpdate && (
        <button
          onClick={onStatusUpdate}
          disabled={!hasWriteAccess}
          className={`p-2 rounded-lg transition-all duration-200 transform hover:scale-110 active:scale-95 hover:shadow-md ${
            coaStatus === 'completed'
              ? 'bg-yellow-500 text-white hover:bg-yellow-600'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
          title={coaStatus === 'completed' ? 'Edit Status' : 'Update Status'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
      )}
    </div>
  );
});

ActionButtons.displayName = 'ActionButtons';
