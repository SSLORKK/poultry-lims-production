interface NotesDialogProps {
  open: boolean;
  note: string;
  onClose: () => void;
}

export const NotesDialog = ({ open, note, onClose }: NotesDialogProps) => {
  if (!open) return null;

  // Parse notes to separate main note from status change entries
  const parseNotes = (noteText: string) => {
    if (!noteText) return { mainNote: '', statusChanges: [] };
    
    // Split by the separator
    const parts = noteText.split(/\n---\n/);
    const mainNote = parts[0] || '';
    const statusChanges: string[] = [];
    
    // Check if main note itself is a status change (no separator case)
    if (mainNote.includes('[Status Change')) {
      return { mainNote: '', statusChanges: [mainNote, ...parts.slice(1)] };
    }
    
    // Collect status change entries
    for (let i = 1; i < parts.length; i++) {
      if (parts[i].includes('[Status Change')) {
        statusChanges.push(parts[i]);
      }
    }
    
    return { mainNote, statusChanges };
  };

  const { mainNote, statusChanges } = parseNotes(note);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">Notes</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>
        <div className="max-h-[400px] overflow-y-auto space-y-4">
          {/* Main Note Section */}
          {mainNote && (
            <div className="bg-gray-50 p-4 rounded border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-semibold text-gray-700">Note</span>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{mainNote}</p>
            </div>
          )}
          
          {/* Status Change History Section */}
          {statusChanges.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold text-amber-700">Status Change History</span>
              </div>
              {statusChanges.map((change, idx) => {
                // Parse the status change entry
                const lines = change.split('\n');
                const headerMatch = lines[0]?.match(/\[Status Change - (.+)\]/);
                const timestamp = headerMatch ? headerMatch[1] : '';
                const statusLine = lines.find(l => l.startsWith('Status:'));
                const reasonLine = lines.find(l => l.startsWith('Reason:'));
                
                return (
                  <div key={idx} className="bg-amber-50 p-3 rounded border border-amber-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                        Change #{statusChanges.length - idx}
                      </span>
                      {timestamp && (
                        <span className="text-xs text-gray-500">{timestamp}</span>
                      )}
                    </div>
                    {statusLine && (
                      <p className="text-sm text-gray-700 font-medium">{statusLine}</p>
                    )}
                    {reasonLine && (
                      <p className="text-sm text-gray-600 mt-1">{reasonLine}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Fallback if no parsed content */}
          {!mainNote && statusChanges.length === 0 && (
            <div className="bg-gray-50 p-4 rounded border border-gray-200">
              <p className="text-gray-500">No notes available</p>
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
