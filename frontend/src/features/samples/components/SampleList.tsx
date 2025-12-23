import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';

export const SampleList = () => {
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSamples = async () => {
      try {
        const response = await apiClient.get('/samples/');
        setSamples(response.data);
      } catch (error) {
        console.error('Failed to fetch samples:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSamples();
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Samples</h2>
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Sample ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Unit IDs</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Patient</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Created At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {samples.map((sample) => (
              <tr key={sample.id}>
                <td className="px-6 py-4 whitespace-nowrap">{sample.sample_id}</td>
                <td className="px-6 py-4">{sample.unit_ids}</td>
                <td className="px-6 py-4">{sample.patient_name || 'N/A'}</td>
                <td className="px-6 py-4">{new Date(sample.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
