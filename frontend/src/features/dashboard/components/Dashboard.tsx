import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import apiClient from '@/services/apiClient';
import { usePermissions } from '../../../hooks/usePermissions';
import { ApiErrorDisplay } from '../../../components/common/ApiErrorDisplay';

interface StatisticPoint {
  date: string;
  count: number;
  label: string;
}

interface SamplesStatistics {
  period: string;
  data: StatisticPoint[];
  total: number;
}

interface DepartmentStatistic {
  department_id: number;
  department_name: string;
  department_code: string;
  data: StatisticPoint[];
  sample_count: number;
  test_count: number;
  sub_sample_count: number;
}

interface UnitsStatistics {
  period: string;
  departments: DepartmentStatistic[];
  total: number;
}

const DEPARTMENT_COLORS: Record<string, string> = {
  PCR: '#3b82f6',
  SER: '#10b981',
  MIC: '#a855f7',
};

const getDefaultDateRange = () => {
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  return {
    from: thirtyDaysAgo.toISOString().split('T')[0],
    to: today.toISOString().split('T')[0],
  };
};

export default function Dashboard() {
  const { hasAnyPermission, isLoading: permissionsLoading } = usePermissions();
  const defaultRange = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);

  // Check permission - find first allowed route if user doesn't have Dashboard access
  if (!permissionsLoading && !hasAnyPermission('Dashboard')) {
    // Find the first allowed route to redirect to
    if (hasAnyPermission('All Samples')) return <Navigate to="/all-samples" replace />;
    if (hasAnyPermission('Register Sample')) return <Navigate to="/register-sample" replace />;
    if (hasAnyPermission('PCR Samples')) return <Navigate to="/pcr/samples" replace />;
    if (hasAnyPermission('Serology Samples')) return <Navigate to="/serology/samples" replace />;
    if (hasAnyPermission('Microbiology Samples')) return <Navigate to="/microbiology/samples" replace />;
    if (hasAnyPermission('Database - PCR') || hasAnyPermission('Database - Serology') || hasAnyPermission('Database - Microbiology')) {
      return <Navigate to="/database" replace />;
    }
    if (hasAnyPermission('Controls')) return <Navigate to="/controls" replace />;
    // No permissions at all - go to SmartRedirect which will show the error screen with logout
    return <Navigate to="/" replace />;
  }

  const { data: samplesData, isLoading: samplesLoading, error: samplesError, refetch: refetchSamples } = useQuery<SamplesStatistics>({
    queryKey: ['statistics', 'samples', dateFrom, dateTo],
    queryFn: async () => {
      const response = await apiClient.get(`/statistics/samples?from_date=${dateFrom}&to_date=${dateTo}`);
      return response.data;
    },
    enabled: !!dateFrom && !!dateTo,
  });

  const { data: unitsData, isLoading: unitsLoading, error: unitsError, refetch: refetchUnits } = useQuery<UnitsStatistics>({
    queryKey: ['statistics', 'units', dateFrom, dateTo],
    queryFn: async () => {
      const response = await apiClient.get(`/statistics/units?from_date=${dateFrom}&to_date=${dateTo}`);
      return response.data;
    },
    enabled: !!dateFrom && !!dateTo,
  });

  const isLoading = samplesLoading || unitsLoading;
  const hasError = samplesError || unitsError;

  const prepareChartData = () => {
    if (!samplesData || !unitsData) return [];

    return samplesData.data.map((sample, index) => {
      const dataPoint: any = {
        label: sample.label,
        samples: sample.count,
      };

      unitsData.departments.forEach((dept) => {
        dataPoint[dept.department_code] = dept.data[index]?.count || 0;
      });

      return dataPoint;
    });
  };

  const chartData = prepareChartData();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>

        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">FROM</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">TO</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {hasError ? (
        <ApiErrorDisplay 
          error={samplesError || unitsError} 
          onRetry={() => {
            refetchSamples();
            refetchUnits();
          }}
          compact={false}
        />
      ) : isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading statistics...</div>
      ) : (
        <div className="space-y-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Sample Statistics</h2>
              <div className="text-2xl font-bold text-blue-600">
                {samplesData?.total || 0} <span className="text-sm font-normal text-gray-500">total samples</span>
              </div>
            </div>
            <p className="text-gray-600 mb-4">
              {samplesData?.period || 'Loading...'}
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="samples"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Samples"
                  dot={{ fill: '#3b82f6', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Tests by Department</h2>
              <div className="text-2xl font-bold text-green-600">
                {unitsData?.total || 0} <span className="text-sm font-normal text-gray-500">total units</span>
              </div>
            </div>
            <p className="text-gray-600 mb-4">
              {unitsData?.period || 'Loading...'}
            </p>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                {unitsData?.departments.map((dept) => (
                  <Bar
                    key={dept.department_id}
                    dataKey={dept.department_code}
                    fill={DEPARTMENT_COLORS[dept.department_code] || '#6b7280'}
                    name={dept.department_name}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {unitsData?.departments.map((dept) => {
              const color = DEPARTMENT_COLORS[dept.department_code] || '#6b7280';

              return (
                <div key={dept.department_id} className="bg-white rounded-lg shadow-md p-6">
                  <div
                    className="w-full h-2 rounded-full mb-4"
                    style={{ backgroundColor: color }}
                  />
                  <h3 className="text-lg font-semibold mb-2">{dept.department_name}</h3>

                  <div className="flex gap-4 mb-2">
                    <div>
                      <div className="text-3xl font-bold text-gray-700">
                        {dept.sample_count}
                      </div>
                      <p className="text-gray-500 text-sm mt-1">samples</p>
                    </div>
                    {(dept.department_code === 'MIC' || dept.department_code === 'PCR') && (
                      <div>
                        <div className="text-3xl font-bold text-gray-700">
                          {dept.sub_sample_count !== null && dept.sub_sample_count !== undefined ? dept.sub_sample_count : 'N/A'}
                        </div>
                        <p className="text-gray-500 text-sm mt-1">Sub-Samples</p>
                        {(dept.sub_sample_count === null || dept.sub_sample_count === undefined) && (
                          <p className="text-xs text-orange-600 mt-1">Backend data missing</p>
                        )}
                      </div>
                    )}
                    <div>
                      <div className="text-3xl font-bold text-gray-700">
                        {dept.test_count}
                      </div>
                      <p className="text-gray-500 text-sm mt-1">tests</p>
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={120} className="mt-4">
                    <LineChart data={dept.data}>
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke={color}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
