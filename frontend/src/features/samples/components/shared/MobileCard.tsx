import React from 'react';

interface MobileCardProps {
  row: any;
  isSelected: boolean;
  onSelect: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onStatusChange?: () => void;
  onCOA?: () => void;
  onViewNote?: () => void;
  hasWriteAccess: boolean;
  isAdmin?: boolean;
  themeColor: {
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
    border: string;
    text: string;
  };
  formatDate: (date: string) => string;
}

export const MobileCard = React.memo(({
  row,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onStatusChange,
  onCOA,
  onViewNote,
  hasWriteAccess,
  isAdmin,
  themeColor,
  formatDate
}: MobileCardProps) => {
  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase();
    if (s === 'completed' || s === 'complete') return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white';
    if (s === 'in_progress' || s === 'in progress') return 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white';
    if (s === 'postponed' || s === 'hold') return 'bg-gradient-to-r from-orange-500 to-red-500 text-white';
    if (s === 'need_approval' || s === 'pending approval') return 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white';
    return 'bg-gradient-to-r from-gray-400 to-gray-500 text-white';
  };

  return (
    <div
      onClick={onSelect}
      className={`relative overflow-hidden rounded-2xl shadow-lg transition-all duration-300 ${
        isSelected 
          ? `ring-4 ${themeColor.border} scale-[1.02] shadow-2xl` 
          : 'shadow-md active:scale-[0.98]'
      }`}
    >
      {/* Background Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${themeColor.bg} opacity-10`} />
      
      {/* Content Container */}
      <div className="relative bg-white/95 backdrop-blur-sm p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`font-bold text-lg ${themeColor.text}`}>
                {row.unitCode}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${getStatusColor(row.status)}`}>
                {row.status}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(row.dateReceived)}
            </div>
          </div>
          {isSelected && (
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
              className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>

        {/* Info Grid */}
        <div className="space-y-2 mb-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-xs text-gray-500 mb-0.5">Company</div>
              <div className="font-medium text-sm text-gray-800 truncate">{row.company}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-xs text-gray-500 mb-0.5">Farm</div>
              <div className="font-medium text-sm text-gray-800 truncate">{row.farm}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-xs text-gray-500 mb-0.5">Flock</div>
              <div className="font-medium text-sm text-gray-800">{row.flock}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-xs text-gray-500 mb-0.5">Age</div>
              <div className="font-medium text-sm text-gray-800">{row.age ?? '-'}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-xs text-gray-500 mb-0.5">House</div>
              <div className="font-medium text-sm text-gray-800">{row.house}</div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className={`flex items-center justify-between p-2 rounded-lg bg-gradient-to-r ${themeColor.bg} bg-opacity-10 mb-3`}>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className={`font-bold text-sm ${themeColor.text}`}>
                {row.samplesNumber ?? row.visibleSubSamples ?? '-'}
              </div>
              <div className="text-xs text-gray-500">Samples</div>
            </div>
            <div className="text-center">
              <div className={`font-bold text-sm ${themeColor.text}`}>
                {row.testsCount ?? row.visibleTestsCount ?? '-'}
              </div>
              <div className="text-xs text-gray-500">Tests</div>
            </div>
            {row.numberOfWells && (
              <div className="text-center">
                <div className={`font-bold text-sm ${themeColor.text}`}>
                  {row.numberOfWells}
                </div>
                <div className="text-xs text-gray-500">Wells</div>
              </div>
            )}
          </div>
          {row.notes && (
            <button
              onClick={(e) => { e.stopPropagation(); onViewNote?.(); }}
              className={`px-3 py-1 rounded-full text-xs font-medium ${themeColor.primary} ${themeColor.text} hover:opacity-80 transition-opacity`}
            >
              📝 Note
            </button>
          )}
        </div>

        {/* Action Buttons - Native App Style */}
        {isSelected && (
          <div className="flex gap-2 animate-in slide-in-from-bottom duration-200">
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                disabled={!hasWriteAccess}
                className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                  hasWriteAccess
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg active:shadow-sm active:scale-95'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            )}
            
            {onStatusChange && (
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange(); }}
                disabled={!hasWriteAccess}
                className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                  hasWriteAccess
                    ? `bg-gradient-to-r ${themeColor.primary} text-white shadow-lg active:shadow-sm active:scale-95`
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Status
              </button>
            )}
            
            {onCOA && (
              <button
                onClick={(e) => { e.stopPropagation(); onCOA(); }}
                disabled={!hasWriteAccess}
                className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                  hasWriteAccess
                    ? `bg-gradient-to-r ${
                        row.coaStatus === 'generated' || row.coaStatus === 'completed'
                          ? 'from-yellow-500 to-amber-500'
                          : themeColor.primary
                      } text-white shadow-lg active:shadow-sm active:scale-95`
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {row.coaStatus === 'generated' || row.coaStatus === 'completed' ? 'Edit' : 'COA'}
              </button>
            )}
            
            {isAdmin && onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg active:shadow-sm active:scale-95 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

MobileCard.displayName = 'MobileCard';
