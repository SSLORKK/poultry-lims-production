import { memo } from 'react';

interface PaginationControlsProps {
  currentPage: number;
  recordCount: number;
  itemsPerPage?: number;
  accentColor?: string;
  onPageChange: (page: number) => void;
}

export const PaginationControls = memo(({
  currentPage,
  recordCount,
  itemsPerPage = 100,
  accentColor = 'blue',
  onPageChange,
}: PaginationControlsProps) => {
  const hasMorePages = recordCount >= itemsPerPage;
  const totalPages = Math.max(1, Math.ceil(recordCount / itemsPerPage) + (recordCount === itemsPerPage ? currentPage : currentPage - 1));
  
  const pagesToShow = [];
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);
  for (let i = startPage; i <= endPage; i++) {
    pagesToShow.push(i);
  }

  const buttonBaseClass = "px-3 py-1 border rounded text-sm";
  const activeClass = `bg-${accentColor}-600 text-white`;

  return (
    <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
      <div className="text-sm text-gray-600">
        Showing <span className="font-semibold text-gray-800">{recordCount}</span> records
        {recordCount === itemsPerPage && (
          <span className="text-gray-500 ml-2">(Page {currentPage})</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          {/* First Page */}
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className={`${buttonBaseClass} hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-label="First page"
          >
            &laquo;
          </button>

          {/* Previous Page */}
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className={`${buttonBaseClass} hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-label="Previous page"
          >
            &lsaquo;
          </button>

          {/* Page Numbers */}
          {pagesToShow.map((pageNum) => (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`${buttonBaseClass} ${
                currentPage === pageNum ? activeClass : 'hover:bg-gray-50'
              }`}
            >
              {pageNum}
            </button>
          ))}

          {/* Next Page */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!hasMorePages}
            className={`${buttonBaseClass} hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-label="Next page"
          >
            &rsaquo;
          </button>

          {/* Jump Forward */}
          <button
            onClick={() => onPageChange(currentPage + 10)}
            disabled={!hasMorePages}
            className={`${buttonBaseClass} hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-label="Jump forward 10 pages"
          >
            &raquo;
          </button>
        </div>
      </div>
    </div>
  );
});

PaginationControls.displayName = 'PaginationControls';
