import { memo } from 'react';

interface LoadingSkeletonProps {
  columns?: number;
  rows?: number;
  accentColor?: string;
}

export const LoadingSkeleton = memo(({ 
  columns = 8, 
  rows = 8,
  accentColor = 'blue'
}: LoadingSkeletonProps) => {
  const headerBgClass = `bg-${accentColor}-100`;

  return (
    <div className="p-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4 h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="mb-4 h-10 bg-gray-100 animate-pulse rounded" />
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className={headerBgClass}>
              <tr>
                {Array.from({ length: columns }).map((_, i) => (
                  <th key={i} className="border border-gray-300 px-2 py-2">
                    <div className="h-4 bg-gray-200 animate-pulse rounded" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: columns }).map((_, j) => (
                    <td key={j} className="border border-gray-300 px-2 py-3">
                      <div className="h-4 bg-gray-100 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

LoadingSkeleton.displayName = 'LoadingSkeleton';
