// import { useState, useEffect, useCallback } from 'react';
// import { useParams, useNavigate } from 'react-router-dom';
// import { apiClient } from '../../../services/apiClient';

// interface UnitData {
//   id: number;
//   unit_code: string;
//   house: string[];
//   age: string;
//   source: string;
//   sample_type: string[];
//   samples_number: number;
//   notes: string;
//   coa_status: string | null;
//   sample: {
//     id: number;
//     sample_code: string;
//     date_received: string;
//     company: string;
//     farm: string;
//     flock: string;
//     cycle: string;
//     status: string;
//   };
//   microbiology_data: {
//     diseases_list: string[];
//     batch_no: string;
//     fumigation: string;
//     index_list: string[];
//   };
// }

// interface COAData {
//   id?: number;
//   unit_id: number;
//   test_results: { [disease: string]: { [index: string]: string } };
//   date_tested: string | null;
//   tested_by: string | null;
//   reviewed_by: string | null;
//   lab_supervisor: string | null;
//   lab_manager: string | null;
//   notes: string | null;
//   status: string;
// }

// export function MicrobiologyCOANew() {
//   const { unitId } = useParams<{ unitId: string }>();
//   const navigate = useNavigate();

//   const [unitData, setUnitData] = useState<UnitData | null>(null);
//   const [coaData, setCoaData] = useState<COAData | null>(null);
//   const [testResults, setTestResults] = useState<{ [disease: string]: { [index: string]: string } }>({});
//   const [activeTab, setActiveTab] = useState<string>('');
//   const [dateTested, setDateTested] = useState<string>('');
//   const [testedBy, setTestedBy] = useState<string>('');
//   const [testedByPIN, setTestedByPIN] = useState<string>('');
//   const [reviewedBy, setReviewedBy] = useState<string>('');
//   const [reviewedByPIN, setReviewedByPIN] = useState<string>('');
//   const [labSupervisor, setLabSupervisor] = useState<string>('');
//   const [labSupervisorPIN, setLabSupervisorPIN] = useState<string>('');
//   const [labManager, setLabManager] = useState<string>('');
//   const [labManagerPIN, setLabManagerPIN] = useState<string>('');
//   const [notes, setNotes] = useState<string>('');
//   const [status, setStatus] = useState<string>('draft');
//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   const initializeTestResults = useCallback((unit: UnitData) => {
//     const results: { [disease: string]: { [index: string]: string } } = {};

//     unit.microbiology_data?.diseases_list?.forEach((disease) => {
//       results[disease] = {};
//       unit.microbiology_data?.index_list?.forEach((index) => {
//         results[disease][index] = '';
//       });
//     });

//     setTestResults(results);
//     // Set first disease as active tab
//     if (unit.microbiology_data?.diseases_list?.length > 0) {
//       setActiveTab(unit.microbiology_data.diseases_list[0]);
//     }
//   }, []);

//   const fetchData = useCallback(async () => {
//     try {
//       setLoading(true);
//       setError(null);

//       // Fetch unit data
//       const unitResponse = await apiClient.get(`/units/${unitId}/`);
//       setUnitData(unitResponse.data);

//       // Try to fetch existing COA data
//       try {
//         const coaResponse = await apiClient.get(`/microbiology-coa/${unitId}/`);
//         const coa = coaResponse.data;
//         setCoaData(coa);

//         // Load test results
//         setTestResults(coa.test_results || {});
//         setDateTested(coa.date_tested || '');
//         setTestedBy(coa.tested_by || '');
//         setReviewedBy(coa.reviewed_by || '');
//         setLabSupervisor(coa.lab_supervisor || '');
//         setLabManager(coa.lab_manager || '');
//         setNotes(coa.notes || '');
//         setStatus(coa.status || 'draft');

//         // Set first disease as active tab
//         if (unitResponse.data.microbiology_data?.diseases_list?.length > 0) {
//           setActiveTab(unitResponse.data.microbiology_data.diseases_list[0]);
//         }
//       } catch (coaErr: any) {
//         // COA doesn't exist yet, initialize empty test results
//         if (coaErr.response?.status === 404) {
//           initializeTestResults(unitResponse.data);
//         } else {
//           throw coaErr;
//         }
//       }
//     } catch (err: any) {
//       console.error('Failed to load data:', err);
//       setError(err.response?.data?.detail || 'Failed to load data');
//     } finally {
//       setLoading(false);
//     }
//   }, [unitId, initializeTestResults]);

//   useEffect(() => {
//     fetchData();
//   }, [fetchData]);

//   const handleResultChange = (disease: string, index: string, value: string) => {
//     setTestResults((prev) => ({
//       ...prev,
//       [disease]: {
//         ...prev[disease],
//         [index]: value,
//       },
//     }));
//   };

//   const verifyPIN = async (pin: string, field: 'testedBy' | 'reviewedBy' | 'labSupervisor' | 'labManager') => {
//     if (!pin.trim()) return;

//     try {
//       const response = await apiClient.post('/controls/signatures/verify-pin', { pin });
//       if (response.data.is_valid) {
//         if (field === 'testedBy') {
//           setTestedBy(response.data.name);
//           setTestedByPIN('');
//         } else if (field === 'reviewedBy') {
//           setReviewedBy(response.data.name);
//           setReviewedByPIN('');
//         } else if (field === 'labSupervisor') {
//           setLabSupervisor(response.data.name);
//           setLabSupervisorPIN('');
//         } else {
//           setLabManager(response.data.name);
//           setLabManagerPIN('');
//         }
//       } else {
//         alert('Invalid PIN. Please try again.');
//         if (field === 'testedBy') {
//           setTestedByPIN('');
//         } else if (field === 'reviewedBy') {
//           setReviewedByPIN('');
//         } else if (field === 'labSupervisor') {
//           setLabSupervisorPIN('');
//         } else {
//           setLabManagerPIN('');
//         }
//       }
//     } catch (err) {
//       console.error('Failed to verify PIN:', err);
//       alert('Failed to verify PIN. Please try again.');
//     }
//   };

//   const handleSave = async () => {
//     if (!unitData) return;

//     try {
//       setSaving(true);
//       setError(null);

//       if (coaData?.id) {
//         // Update existing COA
//         const updatePayload = {
//           test_results: testResults,
//           date_tested: dateTested || null,
//           tested_by: testedBy || null,
//           reviewed_by: reviewedBy || null,
//           lab_supervisor: labSupervisor || null,
//           lab_manager: labManager || null,
//           notes: notes || null,
//           status,
//         };
//         await apiClient.put(`/microbiology-coa/${unitId}/`, updatePayload);
//       } else {
//         // Create new COA
//         const createPayload = {
//           unit_id: parseInt(unitId!),
//           test_results: testResults,
//           date_tested: dateTested || null,
//           tested_by: testedBy || null,
//           reviewed_by: reviewedBy || null,
//           lab_supervisor: labSupervisor || null,
//           lab_manager: labManager || null,
//           notes: notes || null,
//           status,
//         };
//         await apiClient.post('/microbiology-coa/', createPayload);
//       }

//       // Update unit coa_status to 'completed'
//       await apiClient.patch(`/units/${unitId}/`, { coa_status: 'completed' });

//       // Update parent sample status to 'completed'
//       await apiClient.patch(`/samples/${unitData.sample.id}`, { status: 'completed' });

//       alert('COA saved successfully!');
//       navigate('/microbiology/samples');
//     } catch (err: any) {
//       console.error('Failed to save COA:', err);
//       setError(err.response?.data?.detail || 'Failed to save COA');
//       alert('Failed to save COA. Please try again.');
//     } finally {
//       setSaving(false);
//     }
//   };

//   const handleCancel = () => {
//     navigate('/microbiology/samples');
//   };

//   if (loading) {
//     return (
//       <div className="p-8">
//         <div className="text-center text-gray-600 text-xl font-semibold">Loading COA data...</div>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="p-8">
//         <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
//           Error: {error}
//         </div>
//         <button
//           onClick={() => navigate('/microbiology/samples')}
//           className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
//         >
//           Back to Microbiology Samples
//         </button>
//       </div>
//     );
//   }

//   if (!unitData || !unitData.sample) {
//     return (
//       <div className="p-8">
//         <div className="text-center text-gray-600 text-xl font-semibold">Unit data not found</div>
//         <button
//           onClick={() => navigate('/microbiology/samples')}
//           className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 mt-4"
//         >
//           Back to Microbiology Samples
//         </button>
//       </div>
//     );
//   }

//   const diseases = unitData.microbiology_data?.diseases_list || [];
//   const indexList = unitData.microbiology_data?.index_list || [];

//   return (
//     <div className="p-8">
//       <button
//         type="button"
//         onClick={() => navigate(-1)}
//         className="flex items-center gap-2 px-4 py-2 mb-4 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors font-medium"
//       >
//         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
//         </svg>
//         Back
//       </button>

//       <div className="bg-white rounded-lg shadow-md p-6 mb-6">
//         {/* Header */}
//         <div className="text-center border-b-4 border-purple-700 pb-4 mb-6">
//           <h1 className="text-3xl font-bold text-purple-700 mb-2">Microbiology Certificate of Analysis</h1>
//           <p className="text-sm text-gray-600">Unit Code: {unitData.unit_code}</p>
//         </div>

//         {/* Sample Information */}
//         <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded">
//           <div>
//             <span className="font-semibold">Sample Code:</span> {unitData.sample.sample_code}
//           </div>
//           <div>
//             <span className="font-semibold">Unit Code:</span> {unitData.unit_code}
//           </div>
//           <div>
//             <span className="font-semibold">Date Received:</span> {new Date(unitData.sample.date_received).toLocaleDateString()}
//           </div>
//           <div>
//             <span className="font-semibold">Company:</span> {unitData.sample.company}
//           </div>
//           <div>
//             <span className="font-semibold">Farm:</span> {unitData.sample.farm}
//           </div>
//           <div>
//             <span className="font-semibold">Flock:</span> {unitData.sample.flock || '-'}
//           </div>
//           <div>
//             <span className="font-semibold">House:</span> {unitData.house?.join(', ') || '-'}
//           </div>
//           <div>
//             <span className="font-semibold">Age:</span> {unitData.age || '-'}
//           </div>
//           <div>
//             <span className="font-semibold">Batch No:</span> {unitData.microbiology_data?.batch_no || '-'}
//           </div>
//           <div>
//             <span className="font-semibold">Fumigation:</span> {unitData.microbiology_data?.fumigation || '-'}
//           </div>
//         </div>

//         {/* COA Metadata */}
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
//           <div>
//             <label className="block text-sm font-medium text-gray-700 mb-1">Date Tested</label>
//             <input
//               type="date"
//               value={dateTested}
//               onChange={(e) => setDateTested(e.target.value)}
//               className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
//             />
//           </div>
//           <div>
//             <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
//             <select
//               value={status}
//               onChange={(e) => setStatus(e.target.value)}
//               className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
//             >
//               <option value="draft">Draft</option>
//               <option value="finalized">Finalized</option>
//             </select>
//           </div>
//         </div>

//         {/* Signature Fields with PIN */}
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
//           <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
//             <label className="block text-sm font-medium text-gray-700 mb-2">Tested By</label>
//             {testedBy ? (
//               <div className="flex items-center justify-between">
//                 <span className="text-green-700 font-semibold">{testedBy}</span>
//                 <button
//                   onClick={() => setTestedBy('')}
//                   className="text-sm text-red-600 hover:text-red-800"
//                 >
//                   Clear
//                 </button>
//               </div>
//             ) : (
//               <input
//                 type="password"
//                 value={testedByPIN}
//                 onChange={(e) => setTestedByPIN(e.target.value)}
//                 onBlur={() => verifyPIN(testedByPIN, 'testedBy')}
//                 onKeyPress={(e) => e.key === 'Enter' && verifyPIN(testedByPIN, 'testedBy')}
//                 placeholder="Enter PIN"
//                 className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
//                 maxLength={8}
//               />
//             )}
//           </div>
//           <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
//             <label className="block text-sm font-medium text-gray-700 mb-2">Reviewed By</label>
//             {reviewedBy ? (
//               <div className="flex items-center justify-between">
//                 <span className="text-green-700 font-semibold">{reviewedBy}</span>
//                 <button
//                   onClick={() => setReviewedBy('')}
//                   className="text-sm text-red-600 hover:text-red-800"
//                 >
//                   Clear
//                 </button>
//               </div>
//             ) : (
//               <input
//                 type="password"
//                 value={reviewedByPIN}
//                 onChange={(e) => setReviewedByPIN(e.target.value)}
//                 onBlur={() => verifyPIN(reviewedByPIN, 'reviewedBy')}
//                 onKeyPress={(e) => e.key === 'Enter' && verifyPIN(reviewedByPIN, 'reviewedBy')}
//                 placeholder="Enter PIN"
//                 className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
//                 maxLength={8}
//               />
//             )}
//           </div>
//           <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
//             <label className="block text-sm font-medium text-gray-700 mb-2">Lab Supervisor</label>
//             {labSupervisor ? (
//               <div className="flex items-center justify-between">
//                 <span className="text-green-700 font-semibold">{labSupervisor}</span>
//                 <button
//                   onClick={() => setLabSupervisor('')}
//                   className="text-sm text-red-600 hover:text-red-800"
//                 >
//                   Clear
//                 </button>
//               </div>
//             ) : (
//               <input
//                 type="password"
//                 value={labSupervisorPIN}
//                 onChange={(e) => setLabSupervisorPIN(e.target.value)}
//                 onBlur={() => verifyPIN(labSupervisorPIN, 'labSupervisor')}
//                 onKeyPress={(e) => e.key === 'Enter' && verifyPIN(labSupervisorPIN, 'labSupervisor')}
//                 placeholder="Enter PIN"
//                 className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
//                 maxLength={8}
//               />
//             )}
//           </div>
//           <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
//             <label className="block text-sm font-medium text-gray-700 mb-2">Lab Manager</label>
//             {labManager ? (
//               <div className="flex items-center justify-between">
//                 <span className="text-green-700 font-semibold">{labManager}</span>
//                 <button
//                   onClick={() => setLabManager('')}
//                   className="text-sm text-red-600 hover:text-red-800"
//                 >
//                   Clear
//                 </button>
//               </div>
//             ) : (
//               <input
//                 type="password"
//                 value={labManagerPIN}
//                 onChange={(e) => setLabManagerPIN(e.target.value)}
//                 onBlur={() => verifyPIN(labManagerPIN, 'labManager')}
//                 onKeyPress={(e) => e.key === 'Enter' && verifyPIN(labManagerPIN, 'labManager')}
//                 placeholder="Enter PIN"
//                 className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
//                 maxLength={8}
//               />
//             )}
//           </div>
//         </div>

//         {/* Disease Tabs */}
//         <div className="mb-6">
//           <h3 className="text-xl font-semibold text-gray-800 mb-4">Test Results by Disease</h3>

//           {/* Tab Navigation */}
//           {diseases.length > 0 ? (
//             <div className="border-b border-gray-300 mb-4">
//               <nav className="flex space-x-2">
//                 {diseases.map((disease) => (
//                   <button
//                     key={disease}
//                     onClick={() => setActiveTab(disease)}
//                     className={`px-6 py-3 font-semibold border-b-2 transition-colors ${activeTab === disease
//                       ? 'border-purple-600 text-purple-600 bg-purple-50'
//                       : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
//                       }`}
//                   >
//                     {disease}
//                   </button>
//                 ))}
//               </nav>
//             </div>
//           ) : (
//             <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
//               <p className="text-yellow-800">⚠️ No diseases selected for this sample.</p>
//             </div>
//           )}

//           {/* Test Results Table for Active Disease */}
//           {activeTab && (
//             <div className="overflow-x-auto">
//               <table className="min-w-full border-collapse border border-gray-300">
//                 <thead>
//                   <tr className="bg-purple-100">
//                     <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Index</th>
//                     {activeTab.toLowerCase().includes('total count') ? (
//                       <>
//                         <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
//                           T.B.C CFU / PLATE <br /> / 100 CM
//                         </th>
//                         <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
//                           MOULD CFU / PLATE <br /> / 100 CM
//                         </th>
//                         <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
//                           Pathogenic Fungi & Yeast
//                         </th>
//                       </>
//                     ) : (
//                       <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Test Name</th>
//                     )}
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {indexList.length > 0 ? (
//                     indexList.map((index, rowIdx) => (
//                       <tr key={rowIdx} className="hover:bg-gray-50">
//                         <td className="border border-gray-300 px-4 py-2 font-medium bg-gray-50">
//                           {index}
//                         </td>
//                         {activeTab.toLowerCase().includes('total count') ? (
//                           <>
//                             <td className="border border-gray-300 px-2 py-2">
//                               <input
//                                 type="text"
//                                 value={testResults[activeTab]?.[index] || ''}
//                                 onChange={(e) => handleResultChange(activeTab, index, e.target.value)}
//                                 placeholder="Enter T.B.C"
//                                 className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
//                               />
//                             </td>
//                             <td className="border border-gray-300 px-2 py-2">
//                               <input
//                                 type="text"
//                                 value={testResults[activeTab]?.[`${index}_mould`] || ''}
//                                 onChange={(e) => handleResultChange(activeTab, `${index}_mould`, e.target.value)}
//                                 placeholder="Enter Mould"
//                                 className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
//                               />
//                             </td>
//                             <td className="border border-gray-300 px-2 py-2">
//                               <input
//                                 type="text"
//                                 value={testResults[activeTab]?.[`${index}_fungi`] || ''}
//                                 onChange={(e) => handleResultChange(activeTab, `${index}_fungi`, e.target.value)}
//                                 placeholder="Enter Fungi"
//                                 className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
//                               />
//                             </td>
//                           </>
//                         ) : (
//                           <td className="border border-gray-300 px-2 py-2">
//                             <input
//                               type="text"
//                               value={testResults[activeTab]?.[index] || ''}
//                               onChange={(e) => handleResultChange(activeTab, index, e.target.value)}
//                               placeholder="Enter test result"
//                               className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
//                             />
//                           </td>
//                         )}
//                       </tr>
//                     ))
//                   ) : (
//                     <tr>
//                       <td colSpan={activeTab.toLowerCase().includes('total count') ? 4 : 2} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
//                         No sample indexes defined. Please add indexes when registering the sample.
//                       </td>
//                     </tr>
//                   )}
//                 </tbody>
//               </table>
//             </div>
//           )}

//           <div className="text-xs text-gray-500 mt-2">
//             *Neg. = Negative, Pos. = Positive, NA = Not Applicable
//           </div>
//         </div>

//         {/* Notes */}
//         <div className="mb-6">
//           <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
//           <textarea
//             value={notes}
//             onChange={(e) => setNotes(e.target.value)}
//             placeholder="Additional notes or observations..."
//             rows={4}
//             className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
//           />
//         </div>

//         {/* Action Buttons */}
//         <div className="flex justify-between items-center">
//           <button
//             onClick={handleCancel}
//             disabled={saving}
//             className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-400"
//           >
//             Cancel
//           </button>
//           <div className="flex gap-3">
//             <button
//               onClick={handleSave}
//               disabled={saving}
//               className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400"
//             >
//               {saving ? 'Saving...' : 'Save COA'}
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
