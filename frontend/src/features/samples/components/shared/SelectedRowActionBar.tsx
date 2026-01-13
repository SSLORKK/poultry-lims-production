interface SelectedRowActionBarProps {
  unitCode: string;
  company: string;
  farm: string;
  themeColor: 'purple' | 'green' | 'blue' | 'orange';
  hasWriteAccess: boolean;
  isAdmin: boolean;
  coaStatus?: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onCOA?: () => void;
  onStatusChange?: () => void;
  onDeselect: () => void;
  showCOA?: boolean;
  showStatusChange?: boolean;
}

const themeStyles = {
  purple: {
    bg: 'bg-gradient-to-r from-purple-50 to-fuchsia-50',
    border: 'border-purple-200',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    textPrimary: 'text-purple-900',
    textSecondary: 'text-purple-600',
    coaDefault: 'bg-purple-600 text-white hover:bg-purple-700',
  },
  green: {
    bg: 'bg-gradient-to-r from-green-50 to-emerald-50',
    border: 'border-green-200',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    textPrimary: 'text-green-900',
    textSecondary: 'text-green-600',
    coaDefault: 'bg-green-600 text-white hover:bg-green-700',
  },
  blue: {
    bg: 'bg-gradient-to-r from-blue-50 to-sky-50',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    textPrimary: 'text-blue-900',
    textSecondary: 'text-blue-600',
    coaDefault: 'bg-blue-600 text-white hover:bg-blue-700',
  },
  orange: {
    bg: 'bg-gradient-to-r from-orange-50 to-amber-50',
    border: 'border-orange-200',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    textPrimary: 'text-orange-900',
    textSecondary: 'text-orange-600',
    coaDefault: 'bg-orange-600 text-white hover:bg-orange-700',
  },
};

export const SelectedRowActionBar = ({
  unitCode,
  company,
  farm,
  themeColor,
  hasWriteAccess,
  isAdmin,
  coaStatus,
  onEdit,
  onDelete,
  onCOA,
  onStatusChange,
  onDeselect,
  showCOA = true,
  showStatusChange = false,
}: SelectedRowActionBarProps) => {
  const styles = themeStyles[themeColor];

  const getCoaButtonStyle = () => {
    if (!hasWriteAccess) return 'bg-gray-300 text-gray-500 cursor-not-allowed';
    // Yellow/amber for Edit (has any status), green for Create (no status)
    if (coaStatus) return 'bg-amber-500 text-white hover:bg-amber-600';
    return 'bg-green-600 text-white hover:bg-green-700';
  };

  const getCoaButtonText = () => {
    return coaStatus ? 'Edit COA' : 'Create COA';
  };

  const getCoaButtonTitle = () => {
    if (!hasWriteAccess) return 'No write permission';
    return coaStatus ? 'Edit certificate of analysis' : 'Create new certificate';
  };

  return (
    <div className={`mb-4 p-4 ${styles.bg} border ${styles.border} rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full ${styles.iconBg} flex items-center justify-center`}>
          <svg className={`w-5 h-5 ${styles.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <span className={`text-sm font-bold ${styles.textPrimary}`}>{unitCode}</span>
          <span className={`text-xs ${styles.textSecondary} ml-2`}>• {company} - {farm}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onEdit}
          disabled={!hasWriteAccess}
          className={`group px-4 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-all duration-200 transform hover:scale-105 hover:shadow-md active:scale-95 ${
            hasWriteAccess ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          title={!hasWriteAccess ? 'No write permission' : 'Edit sample'}
        >
          <svg className="w-4 h-4 transition-transform group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>

        {isAdmin && (
          <button
            onClick={onDelete}
            className="group px-4 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 bg-red-600 text-white hover:bg-red-700 transition-all duration-200 transform hover:scale-105 hover:shadow-md active:scale-95"
            title="Delete unit permanently"
          >
            <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        )}

        {showStatusChange && onStatusChange && (
          <button
            onClick={onStatusChange}
            disabled={!hasWriteAccess}
            className={`group px-4 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-all duration-200 transform hover:scale-105 hover:shadow-md active:scale-95 ${
              hasWriteAccess ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            title={!hasWriteAccess ? 'No write permission' : 'Change status'}
          >
            <svg className="w-4 h-4 transition-transform group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Status
          </button>
        )}

        {showCOA && onCOA && (
          <button
            onClick={onCOA}
            disabled={!hasWriteAccess}
            className={`group px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all duration-200 transform hover:scale-105 hover:shadow-md active:scale-95 ${getCoaButtonStyle()}`}
            title={getCoaButtonTitle()}
          >
            <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="hidden xs:inline">{getCoaButtonText()}</span>
            <span className="xs:hidden">COA</span>
          </button>
        )}

        <button
          onClick={onDeselect}
          className="ml-1 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200"
          title="Deselect row"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
