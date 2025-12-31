import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, BarChart, Bar, LineChart, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import apiClient from '@/services/apiClient';

interface PCRPositiveSample {
  farm: string;
  age: string | null;
  house: string | null;
  diseases: Record<string, string>;
}

interface MicrobiologySampleType {
  sample_type: string;
  total_count: number;
  above_limit_count: number;
  positive_locations: string[];
  percentage: number;
}

interface SerologyDiseaseCount {
  disease_name: string;
  kit_type: string;
  test_count: number;
}

interface CompanyStats {
  company_name: string;
  sample_count: number;
  sub_sample_count: number;
  test_count: number;
  departments: Record<string, number>;
  pcr_positive_samples: PCRPositiveSample[] | null;
  microbiology_sample_types: MicrobiologySampleType[] | null;
  serology_diseases: SerologyDiseaseCount[] | null;
  pcr_extraction_count: number | null;
  pcr_detection_count: number | null;
  serology_wells_count: number | null;
}

interface DiseaseKitStats {
  disease_name: string;
  kit_type: string;
  test_count: number;
  positive_count: number;
  negative_count: number;
}

interface ReportsData {
  total_samples: number;
  total_sub_samples: number;
  total_tests: number;
  total_positive: number;
  total_negative: number;
  total_wells_count: number;
  companies: CompanyStats[];
  diseases: DiseaseKitStats[];
  date_range: {
    from: string;
    to: string;
  };
  department_filter: string | null;
}

interface MonthDeptStats {
  department: string;
  samples: number;
  tests: number;
}

interface MonthComparisonData {
  current_month: string;
  previous_month: string;
  current_month_stats: MonthDeptStats[];
  previous_month_stats: MonthDeptStats[];
  current_month_total: { samples: number; tests: number };
  previous_month_total: { samples: number; tests: number };
}

const COLORS = ['#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
const DEPT_COLORS = {
  PCR: '#3b82f6',
  SER: '#10b981',
  MIC: '#a855f7'
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

export default function Reports() {
  const defaultRange = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [department, setDepartment] = useState<string>('');

  const { data: reportsData, isLoading } = useQuery<ReportsData>({
    queryKey: ['reports', dateFrom, dateTo, department],
    queryFn: async () => {
      const deptParam = department ? `&department=${department}` : '';
      const response = await apiClient.get(`/reports?from_date=${dateFrom}&to_date=${dateTo}${deptParam}`);
      console.log('Reports data:', response.data);
      console.log('Total sub-samples:', response.data.total_sub_samples);
      return response.data;
    },
    enabled: !!dateFrom && !!dateTo,
  });

  // Fetch month comparison data
  const { data: monthComparisonData, isLoading: isLoadingComparison, error: comparisonError } = useQuery<MonthComparisonData>({
    queryKey: ['month-comparison'],
    queryFn: async () => {
      console.log('Fetching month comparison data...');
      const response = await apiClient.get('/reports/month-comparison');
      console.log('Month comparison response:', response.data);
      return response.data;
    },
    retry: 2,
  });

  // Debug logging for comparison data
  if (comparisonError) {
    console.error('Month comparison error:', comparisonError);
  }

  const handleExportExcel = async () => {
    try {
      const deptParam = department ? `&department=${department}` : '';
      const response = await apiClient.get(`/reports/export/excel?from_date=${dateFrom}&to_date=${dateTo}${deptParam}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const deptSuffix = department ? `_${department}` : '';
      link.setAttribute('download', `LIMS_Report_${dateFrom}_to_${dateTo}${deptSuffix}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export Excel:', error);
    }
  };

  const handleExportPDF = async () => {
    try {
      const deptParam = department ? `&department=${department}` : '';
      const response = await apiClient.get(`/reports/export/pdf?from_date=${dateFrom}&to_date=${dateTo}${deptParam}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const deptSuffix = department ? `_${department}` : '';
      link.setAttribute('download', `LIMS_Report_${dateFrom}_to_${dateTo}${deptSuffix}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export PDF:', error);
    }
  };

  // Memoized calculations for better performance
  const chartData = useMemo(() => {
    if (!reportsData) return null;

    // Company pie data
    const samplesPieData = reportsData.companies.slice(0, 10).map(company => ({
      name: company.company_name,
      value: company.sample_count
    }));

    const testsPieData = reportsData.companies.slice(0, 10).map(company => ({
      name: company.company_name,
      value: company.test_count
    }));

    // Department distribution
    const departmentDistribution = reportsData.companies.reduce((acc, company) => {
      Object.entries(company.departments).forEach(([dept, count]) => {
        if (!acc[dept]) acc[dept] = 0;
        acc[dept] += count;
      });
      return acc;
    }, {} as Record<string, number>);

    const departmentData = Object.entries(departmentDistribution).map(([name, value]) => ({ name, value }));

    // Top diseases by department
    const diseasesByDept: Record<string, Array<{
      disease: string;
      fullName: string;
      count: number;
      kit: string;
      positive: number;
      negative: number;
      positiveRate: number;
    }>> = {
      PCR: [],
      SER: [],
      MIC: []
    };

    // Group diseases by their kit/department type
    reportsData.diseases.forEach(d => {
      let dept = 'PCR'; // default

      // If a specific department is selected, assign all data to it
      if (department) {
        dept = department;
      } else {
        // Only try to guess department if viewing All Departments
        const kitLower = d.kit_type.toLowerCase();
        if (kitLower.includes('elisa') || kitLower.includes('serology') || kitLower.includes('ser')) {
          dept = 'SER';
        } else if (kitLower.includes('mic') || kitLower.includes('micro')) {
          dept = 'MIC';
        }
      }

      const positiveRate = d.test_count > 0 ? (d.positive_count / d.test_count) * 100 : 0;

      diseasesByDept[dept].push({
        disease: d.disease_name.length > 20 ? d.disease_name.substring(0, 20) + '...' : d.disease_name,
        fullName: d.disease_name,
        count: d.test_count,
        kit: d.kit_type,
        positive: d.positive_count,
        negative: d.negative_count,
        positiveRate: positiveRate
      });
    });

    // Sort and take top 10 for each department
    Object.keys(diseasesByDept).forEach(dept => {
      diseasesByDept[dept] = diseasesByDept[dept]
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    });

    // Grouped diseases for table
    const groupedDiseases = reportsData.diseases.reduce((acc, item) => {
      if (!acc[item.disease_name]) {
        acc[item.disease_name] = [];
      }
      acc[item.disease_name].push(item);
      return acc;
    }, {} as Record<string, DiseaseKitStats[]>);

    return {
      samplesPieData,
      testsPieData,
      departmentData,
      diseasesByDept,
      groupedDiseases
    };
  }, [reportsData]);

  const showPositiveNegative = department !== 'SER';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-6">
          Reports & Analytics
        </h1>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold text-gray-700 mb-2">FROM DATE</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold text-gray-700 mb-2">TO DATE</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold text-gray-700 mb-2">DEPARTMENT</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">All Departments</option>
                <option value="PCR">PCR</option>
                <option value="SER">Serology</option>
                <option value="MIC">Microbiology</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleExportExcel}
                disabled={isLoading || !reportsData}
                className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-semibold hover:from-green-700 hover:to-green-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                📊 Export Excel
              </button>
              <button
                onClick={handleExportPDF}
                disabled={isLoading || !reportsData}
                className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-semibold hover:from-red-700 hover:to-red-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                📄 Export PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading reports...</p>
          </div>
        </div>
      ) : reportsData && chartData ? (
        <div className="space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-semibold uppercase tracking-wide">Total Samples</p>
                  <p className="text-4xl font-bold mt-2">{reportsData.total_samples.toLocaleString()}</p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-4">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-cyan-100 text-sm font-semibold uppercase tracking-wide">Total Tests</p>
                  <p className="text-4xl font-bold mt-2">{reportsData.total_tests.toLocaleString()}</p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-4">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-samples card - show for microbiology and PCR */}
          {(!department || department === 'MIC' || department === 'PCR') && (
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-semibold uppercase tracking-wide">
                    Total Sub-Samples
                  </p>
                  <p className="text-4xl font-bold mt-2">
                    {(reportsData.total_sub_samples || 0).toLocaleString()}
                  </p>
                  <p className="text-green-200 text-sm mt-2">
                    Sub-Samples
                  </p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-4">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 12h10m-7 5h4" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Wells Count card - show for Serology */}
          {(department === 'SER' || (!department && (reportsData.total_wells_count || 0) >= 0)) && (
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-semibold uppercase tracking-wide">
                    Total Wells Count
                  </p>
                  <p className="text-4xl font-bold mt-2">
                    {(reportsData.total_wells_count || 0).toLocaleString()}
                  </p>
                  <p className="text-purple-200 text-sm mt-2">
                    Serology Wells
                  </p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-4">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Distribution Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sample Distribution Pie Chart */}
            <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 border border-blue-100">
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600 mb-6 flex items-center">
                <span className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-xl p-3 mr-3 shadow-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                  </svg>
                </span>
                Sample Distribution
              </h2>
              <ResponsiveContainer width="100%" height={380}>
                <PieChart>
                  <defs>
                    <linearGradient id="gradient0" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="gradient1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#0891b2" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="gradient2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#c026d3" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="gradient3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="gradient4" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#dc2626" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="gradient5" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="gradient6" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ec4899" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#db2777" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="gradient7" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#0d9488" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <Pie
                    data={chartData.samplesPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={130}
                    paddingAngle={3}
                    label={({ name, percent }: any) => `${name && name.length > 15 ? name.substring(0, 15) + '...' : (name || '')} (${(percent * 100).toFixed(1)}%)`}
                    labelLine={{ stroke: '#64748b', strokeWidth: 2, strokeDasharray: '3 3' }}
                  >
                    {chartData.samplesPieData.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={`url(#gradient${index % 8})`}
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '2px solid #3b82f6',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                      padding: '12px 16px'
                    }}
                    itemStyle={{
                      color: '#1e293b',
                      fontWeight: 600,
                      fontSize: '14px'
                    }}
                    labelStyle={{
                      color: '#3b82f6',
                      fontWeight: 700,
                      fontSize: '15px',
                      marginBottom: '4px'
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{
                      paddingTop: '20px',
                      fontSize: '13px',
                      fontWeight: 600
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Test Distribution Pie Chart */}
            <div className="bg-gradient-to-br from-white to-cyan-50 rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 border border-cyan-100">
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600 mb-6 flex items-center">
                <span className="bg-gradient-to-br from-cyan-500 to-blue-500 text-white rounded-xl p-3 mr-3 shadow-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </span>
                Test Distribution
              </h2>
              <ResponsiveContainer width="100%" height={380}>
                <PieChart>
                  <Pie
                    data={chartData.testsPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={130}
                    paddingAngle={3}
                    label={({ name, percent }: any) => `${name && name.length > 15 ? name.substring(0, 15) + '...' : (name || '')} (${(percent * 100).toFixed(1)}%)`}
                    labelLine={{ stroke: '#64748b', strokeWidth: 2, strokeDasharray: '3 3' }}
                  >
                    {chartData.testsPieData.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={`url(#gradient${index % 8})`}
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '2px solid #06b6d4',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                      padding: '12px 16px'
                    }}
                    itemStyle={{
                      color: '#1e293b',
                      fontWeight: 600,
                      fontSize: '14px'
                    }}
                    labelStyle={{
                      color: '#06b6d4',
                      fontWeight: 700,
                      fontSize: '15px',
                      marginBottom: '4px'
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{
                      paddingTop: '20px',
                      fontSize: '13px',
                      fontWeight: 600
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Department Distribution */}
          {!department && chartData.departmentData.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <span className="bg-purple-100 text-purple-600 rounded-lg p-2 mr-3">🏢</span>
                Tests by Department
              </h2>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData.departmentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '14px', fontWeight: 600 }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '14px' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '2px solid #e5e7eb', borderRadius: '8px' }}
                    cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="value" name="Total Tests" radius={[8, 8, 0, 0]}>
                    {chartData.departmentData.map((entry, index) => {
                      const color = DEPT_COLORS[entry.name as keyof typeof DEPT_COLORS] || COLORS[index % COLORS.length];
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Month-over-Month Comparison Chart */}
          {isLoadingComparison && (
            <div className="bg-gradient-to-br from-white to-indigo-50 rounded-2xl shadow-xl p-8 border border-indigo-100">
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <span className="ml-4 text-gray-600">Loading comparison data...</span>
              </div>
            </div>
          )}
          {comparisonError && (
            <div className="bg-red-50 rounded-2xl shadow-xl p-8 border border-red-200">
              <p className="text-red-600 font-semibold">Error loading comparison data. Please refresh the page.</p>
            </div>
          )}
          {monthComparisonData && monthComparisonData.current_month_stats && monthComparisonData.current_month_stats.length > 0 && (
            <div className="bg-gradient-to-br from-white to-indigo-50 rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 border border-indigo-100">
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-6 flex items-center">
                <span className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white rounded-xl p-3 mr-3 shadow-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </span>
                Monthly Comparison: {monthComparisonData.current_month} vs {monthComparisonData.previous_month}
              </h2>
              
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg p-4 shadow-sm border border-indigo-100">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Current Month Samples</p>
                  <p className="text-2xl font-bold text-indigo-600">{monthComparisonData.current_month_total.samples}</p>
                  <p className="text-xs text-gray-400">{monthComparisonData.current_month}</p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm border border-purple-100">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Previous Month Samples</p>
                  <p className="text-2xl font-bold text-purple-600">{monthComparisonData.previous_month_total.samples}</p>
                  <p className="text-xs text-gray-400">{monthComparisonData.previous_month}</p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm border border-cyan-100">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Current Month Tests</p>
                  <p className="text-2xl font-bold text-cyan-600">{monthComparisonData.current_month_total.tests}</p>
                  <p className="text-xs text-gray-400">{monthComparisonData.current_month}</p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm border border-teal-100">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Previous Month Tests</p>
                  <p className="text-2xl font-bold text-teal-600">{monthComparisonData.previous_month_total.tests}</p>
                  <p className="text-xs text-gray-400">{monthComparisonData.previous_month}</p>
                </div>
              </div>

              {/* Comparison Bar Chart */}
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={monthComparisonData.current_month_stats.map((curr, idx) => ({
                    department: curr.department,
                    [`${monthComparisonData.current_month} Samples`]: curr.samples,
                    [`${monthComparisonData.previous_month} Samples`]: monthComparisonData.previous_month_stats[idx]?.samples || 0,
                    [`${monthComparisonData.current_month} Tests`]: curr.tests,
                    [`${monthComparisonData.previous_month} Tests`]: monthComparisonData.previous_month_stats[idx]?.tests || 0,
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="department" stroke="#6b7280" style={{ fontSize: '14px', fontWeight: 600 }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '14px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '2px solid #6366f1',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                      padding: '12px 16px'
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey={`${monthComparisonData.current_month} Samples`} fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={`${monthComparisonData.previous_month} Samples`} fill="#a5b4fc" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={`${monthComparisonData.current_month} Tests`} fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={`${monthComparisonData.previous_month} Tests`} fill="#67e8f9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              {/* Comparison Line Chart - Trend View */}
              <h3 className="text-lg font-bold text-gray-800 mt-8 mb-4 flex items-center">
                <span className="bg-emerald-100 text-emerald-600 rounded-lg p-2 mr-2">📈</span>
                Trend Comparison (Line Chart)
              </h3>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart
                  data={monthComparisonData.current_month_stats.map((curr, idx) => ({
                    department: curr.department,
                    currentSamples: curr.samples,
                    previousSamples: monthComparisonData.previous_month_stats[idx]?.samples || 0,
                    currentTests: curr.tests,
                    previousTests: monthComparisonData.previous_month_stats[idx]?.tests || 0,
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="department" stroke="#6b7280" style={{ fontSize: '14px', fontWeight: 600 }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '14px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '2px solid #10b981',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                      padding: '12px 16px'
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Line 
                    type="monotone" 
                    dataKey="currentSamples" 
                    name={`${monthComparisonData.current_month} Samples`}
                    stroke="#6366f1" 
                    strokeWidth={3}
                    dot={{ fill: '#6366f1', strokeWidth: 2, r: 6 }}
                    activeDot={{ r: 8, fill: '#6366f1' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="previousSamples" 
                    name={`${monthComparisonData.previous_month} Samples`}
                    stroke="#a5b4fc" 
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    dot={{ fill: '#a5b4fc', strokeWidth: 2, r: 6 }}
                    activeDot={{ r: 8, fill: '#a5b4fc' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="currentTests" 
                    name={`${monthComparisonData.current_month} Tests`}
                    stroke="#06b6d4" 
                    strokeWidth={3}
                    dot={{ fill: '#06b6d4', strokeWidth: 2, r: 6 }}
                    activeDot={{ r: 8, fill: '#06b6d4' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="previousTests" 
                    name={`${monthComparisonData.previous_month} Tests`}
                    stroke="#67e8f9" 
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    dot={{ fill: '#67e8f9', strokeWidth: 2, r: 6 }}
                    activeDot={{ r: 8, fill: '#67e8f9' }}
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* Department Details Table */}
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-indigo-500 to-purple-500">
                      <th className="px-4 py-3 text-left text-sm font-bold text-white">Department</th>
                      <th className="px-4 py-3 text-center text-sm font-bold text-white" colSpan={2}>Samples</th>
                      <th className="px-4 py-3 text-center text-sm font-bold text-white" colSpan={2}>Tests</th>
                    </tr>
                    <tr className="bg-indigo-100">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700"></th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-indigo-700">{monthComparisonData.current_month}</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-purple-700">{monthComparisonData.previous_month}</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-cyan-700">{monthComparisonData.current_month}</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-teal-700">{monthComparisonData.previous_month}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {monthComparisonData.current_month_stats.map((curr, idx) => {
                      const prev = monthComparisonData.previous_month_stats[idx];
                      const sampleDiff = curr.samples - (prev?.samples || 0);
                      const testDiff = curr.tests - (prev?.tests || 0);
                      return (
                        <tr key={curr.department} className="hover:bg-indigo-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">{curr.department}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                              {curr.samples}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                              {prev?.samples || 0}
                            </span>
                            {sampleDiff !== 0 && (
                              <span className={`ml-1 text-xs font-semibold ${sampleDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ({sampleDiff > 0 ? '+' : ''}{sampleDiff})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800">
                              {curr.tests}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800">
                              {prev?.tests || 0}
                            </span>
                            {testDiff !== 0 && (
                              <span className={`ml-1 text-xs font-semibold ${testDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ({testDiff > 0 ? '+' : ''}{testDiff})
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold">
                      <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                      <td className="px-4 py-3 text-center text-sm text-indigo-800">{monthComparisonData.current_month_total.samples}</td>
                      <td className="px-4 py-3 text-center text-sm text-purple-800">{monthComparisonData.previous_month_total.samples}</td>
                      <td className="px-4 py-3 text-center text-sm text-cyan-800">{monthComparisonData.current_month_total.tests}</td>
                      <td className="px-4 py-3 text-center text-sm text-teal-800">{monthComparisonData.previous_month_total.tests}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Top Diseases Tested by Department/Unit */}
          {/* Unified Diseases Tested Chart - Only shows when a specific department is selected */}
          {department && chartData.diseasesByDept[department as keyof typeof chartData.diseasesByDept] && chartData.diseasesByDept[department as keyof typeof chartData.diseasesByDept].length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                Diseases Tested
              </h2>

              <ResponsiveContainer width="100%" height={500}>
                <BarChart data={chartData.diseasesByDept[department as keyof typeof chartData.diseasesByDept]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="disease"
                    stroke="#6b7280"
                    angle={-45}
                    textAnchor="end"
                    height={120}
                    interval={0}
                    style={{ fontSize: '11px', fontWeight: 500 }}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="square"
                  />
                  <Bar dataKey="count" name="Total Tests" radius={[4, 4, 0, 0]}>
                    {chartData.diseasesByDept[department as keyof typeof chartData.diseasesByDept].map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Detailed Data Table */}
              <div className="mt-8">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <span className="bg-blue-100 text-blue-600 rounded-lg p-2 mr-2 text-sm">📊</span>
                  Detailed Statistics
                </h3>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-gray-700 to-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Disease</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Kit Type</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">Total Tests</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">Positive</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">Negative</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">Positive Rate</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {chartData.diseasesByDept[department as keyof typeof chartData.diseasesByDept].map((item, idx) => (
                        <tr key={idx} className={`${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50 transition-colors`}>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">{item.fullName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.kit}</td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                              {item.count}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                              {item.positive}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800">
                              {item.negative}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-bold text-purple-700 min-w-[3rem] text-right">
                                {item.positiveRate.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}





          {/* Company Table */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
              <span className="bg-orange-100 text-orange-600 rounded-lg p-2 mr-3">🏭</span>
              Company Breakdown
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-cyan-500 to-cyan-600">
                    <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wide">Company</th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-white uppercase tracking-wide">Total Samples</th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-white uppercase tracking-wide">Sub Samples</th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-white uppercase tracking-wide">Total Tests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reportsData.companies.map((company, idx) => (
                    <tr key={company.company_name} className={`transition-colors ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-cyan-50`}>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{company.company_name}</td>
                      <td className="px-6 py-4 text-sm text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          {company.sample_count}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                          {company.sub_sample_count || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800">
                          {company.test_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Disease-Kit Type Breakdown */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
              <span className="bg-indigo-100 text-indigo-600 rounded-lg p-2 mr-3">📋</span>
              Disease-Kit Type Breakdown
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Disease</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Kit Type</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Total Tests</th>
                    {showPositiveNegative && (
                      <>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Positive</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Negative</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Positive %</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Object.entries(chartData.groupedDiseases).map(([diseaseName, kitTypes]) => (
                    (kitTypes as DiseaseKitStats[]).map((disease: DiseaseKitStats, idx: number) => {
                      const positiveRate = disease.test_count > 0 ? (disease.positive_count / disease.test_count * 100) : 0;
                      return (
                        <tr key={`${diseaseName}-${disease.kit_type}-${idx}`} className="hover:bg-gray-50 transition-colors">
                          {idx === 0 && (
                            <td rowSpan={(kitTypes as DiseaseKitStats[]).length} className="px-6 py-4 text-sm font-semibold text-gray-900 border-r-2 border-gray-200 bg-gray-50">
                              {diseaseName}
                            </td>
                          )}
                          <td className="px-6 py-4 text-sm text-gray-700">{disease.kit_type}</td>
                          <td className="px-6 py-4 text-sm text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {disease.test_count}
                            </span>
                          </td>
                          {showPositiveNegative && (
                            <>
                              <td className="px-6 py-4 text-sm text-center">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                                  {disease.positive_count}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-center">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  {disease.negative_count}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-center font-medium text-gray-700">
                                {positiveRate.toFixed(1)}%
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* PCR Extraction & Detection Summary by Company */}
          {(department === 'PCR' || !department) && reportsData.companies.some(c => c.pcr_extraction_count !== null || c.pcr_detection_count !== null) && (
            <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg p-2 mr-3">🔬</span>
                PCR Extraction & Detection Summary
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-500 to-indigo-600">
                      <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wide">Company</th>
                      <th className="px-6 py-4 text-center text-sm font-bold text-white uppercase tracking-wide">Total Extraction</th>
                      <th className="px-6 py-4 text-center text-sm font-bold text-white uppercase tracking-wide">Total Detection</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reportsData.companies
                      .filter(company => company.pcr_extraction_count !== null || company.pcr_detection_count !== null)
                      .map((company, idx) => (
                        <tr key={company.company_name} className={`transition-colors duration-150 ${idx % 2 === 0 ? 'bg-blue-50' : 'bg-white'} hover:bg-blue-100`}>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">{company.company_name}</td>
                          <td className="px-6 py-4 text-center">
                            {company.pcr_extraction_count !== null ? (
                              <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold bg-blue-100 text-blue-800 shadow-sm">
                                {company.pcr_extraction_count}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {company.pcr_detection_count !== null ? (
                              <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold bg-indigo-100 text-indigo-800 shadow-sm">
                                {company.pcr_detection_count}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gradient-to-r from-gray-100 to-gray-200 border-t-2 border-gray-300">
                      <td className="px-6 py-4 text-sm font-bold text-gray-900 uppercase">Total</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-5 py-2 rounded-full text-base font-bold bg-blue-200 text-blue-900 shadow-md">
                          {reportsData.companies.reduce((sum, c) => sum + (c.pcr_extraction_count || 0), 0)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-5 py-2 rounded-full text-base font-bold bg-indigo-200 text-indigo-900 shadow-md">
                          {reportsData.companies.reduce((sum, c) => sum + (c.pcr_detection_count || 0), 0)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
