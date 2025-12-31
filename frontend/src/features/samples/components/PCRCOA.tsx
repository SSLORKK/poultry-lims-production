import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { apiClient } from '../../../services/apiClient';
import { useCurrentUser } from '../../../hooks/useCurrentUser';

interface UnitData {
  id: number;
  unit_code: string;
  house: string[];
  age: string;  // Changed from number to string
  source: string;
  sample_type: string[];
  samples_number: number;
  notes: string;
  coa_status: string | null;
  sample: {
    id: number;
    sample_code: string;
    date_received: string;
    company: string;
    farm: string;
    flock: string;
    cycle: string;
    status: string;
  };
  pcr_data: {
    diseases_list: Array<{ disease: string; kit_type: string }>;
    technician_name: string;
    extraction_method: string;
  };
}

interface COAData {
  id?: number;
  unit_id: number;
  test_results: { [disease: string]: { [sampleType: string]: string } };
  date_tested: string | null;
  tested_by: string | null;
  reviewed_by: string | null;
  lab_supervisor: string | null;
  lab_manager: string | null;
  notes: string | null;
  status: string;
}

export function PCRCOA() {
  const { unitId } = useParams<{ unitId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useCurrentUser();
  
  // Get navigation state to determine where to go back
  const navigationState = location.state as { fromDatabase?: boolean; department?: string } | null;
  
  const [unitData, setUnitData] = useState<UnitData | null>(null);
  const [coaData, setCoaData] = useState<COAData | null>(null);
  const [testResults, setTestResults] = useState<{ [disease: string]: Array<{ houses: string; values: { [sampleType: string]: string }; pos_control: string; neg_control: string }> }>({});
  const [sampleTypes, setSampleTypes] = useState<string[]>([]);
  const [dateTested, setDateTested] = useState<string>('');
  const [testedBy, setTestedBy] = useState<string>('');
  const [testedByPIN, setTestedByPIN] = useState<string>('');
  const [reviewedBy, setReviewedBy] = useState<string>('');
  const [reviewedByPIN, setReviewedByPIN] = useState<string>('');
  const [labSupervisor, setLabSupervisor] = useState<string>('');
  const [labSupervisorPIN, setLabSupervisorPIN] = useState<string>('');
  const [labManager, setLabManager] = useState<string>('');
  const [labManagerPIN, setLabManagerPIN] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [status, setStatus] = useState<string>('draft');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postponedReason, setPostponedReason] = useState<string>('');
  const [showPostponedModal, setShowPostponedModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Ordered diseases list for drag and drop reordering
  const [orderedDiseases, setOrderedDiseases] = useState<Array<{ disease: string; kit_type: string }>>([]);
  const [draggedDiseaseIndex, setDraggedDiseaseIndex] = useState<number | null>(null);
  
  // House values per column index (for the House row) - each column has independent house value
  const [houseValues, setHouseValues] = useState<string[]>([]);
  
  // Sample type column drag state for reordering
  const [draggedSampleTypeIndex, setDraggedSampleTypeIndex] = useState<number | null>(null);

  // Auto-dismiss notification after 4 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Signature Images
  const [testedBySignatureImage, setTestedBySignatureImage] = useState<string | null>(null);
  const [reviewedBySignatureImage, setReviewedBySignatureImage] = useState<string | null>(null);
  const [labSupervisorSignatureImage, setLabSupervisorSignatureImage] = useState<string | null>(null);
  const [labManagerSignatureImage, setLabManagerSignatureImage] = useState<string | null>(null);

  const initializeTestResults = useCallback((unit: UnitData) => {
    const results: { [disease: string]: Array<{ houses: string; values: { [sampleType: string]: string }; pos_control: string; neg_control: string }> } = {};
    
    unit.pcr_data?.diseases_list?.forEach((diseaseItem) => {
      const emptyValues: { [sampleType: string]: string } = {};
      unit.sample_type?.forEach((_, idx) => {
        emptyValues[`col_${idx}`] = '';
      });
      results[diseaseItem.disease] = [
        { houses: '', values: emptyValues, pos_control: '', neg_control: 'confirmed' }
      ];
    });
    
    setTestResults(results);
    setSampleTypes(unit.sample_type || []);
    // Initialize house values array with empty strings for each sample type
    setHouseValues(new Array(unit.sample_type?.length || 0).fill(''));
    setTestedBy(unit.pcr_data?.technician_name || '');
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch unit data
      const unitResponse = await apiClient.get(`/units/${unitId}`);
      setUnitData(unitResponse.data);
      
      // Initialize ordered diseases from unit data
      if (unitResponse.data.pcr_data?.diseases_list) {
        setOrderedDiseases(unitResponse.data.pcr_data.diseases_list);
      }

      // Try to fetch existing COA data
      try {
        const coaResponse = await apiClient.get(`/pcr-coa/${unitId}/`);
        const coa = coaResponse.data;
        setCoaData(coa);

        // Normalize test results to new structure
        const normalize = (raw: any, sampleTypes: string[]) => {
          const normalized: { [disease: string]: Array<{ houses: string; values: { [sampleType: string]: string }; pos_control: string; neg_control: string }> } = {};
          Object.entries(raw || {}).forEach(([disease, value]: [string, any]) => {
            if (Array.isArray(value)) {
              // New format: array of pools
              normalized[disease] = value.map((pool) => ({
                houses: pool.houses || '',
                values: { ...sampleTypes.reduce((acc, st) => ({ ...acc, [st]: pool.values?.[st] || '' }), {}) },
                pos_control: pool.pos_control || '',
                neg_control: pool.neg_control || 'confirmed'
              }));
            } else if (value && typeof value === 'object') {
              // Old format: single object - convert to single pool
              const houses = value.indices || '';
              const pos_control = value.pos_control || '';
              const values: { [sampleType: string]: string } = {};
              sampleTypes.forEach(st => { values[st] = value[st] || ''; });
              normalized[disease] = [{ houses, values, pos_control, neg_control: 'confirmed' }];
            } else {
              normalized[disease] = [];
            }
          });
          return normalized;
        };

        const initialSampleTypes = unitResponse.data?.sample_type || [];
        setSampleTypes(initialSampleTypes);
        // Initialize house values array with empty strings for each sample type
        setHouseValues(new Array(initialSampleTypes.length).fill(''));
        setTestResults(normalize(coa.test_results, initialSampleTypes));
        setDateTested(coa.date_tested || '');
        setTestedBy(coa.tested_by || '');
        setReviewedBy(coa.reviewed_by || '');
        setLabSupervisor(coa.lab_supervisor || '');
        setLabManager(coa.lab_manager || '');
        setNotes(coa.notes || '');
        setStatus(coa.status || 'draft');
        
        // Fetch signature images for existing COA data
        const fetchSignature = async (name: string) => {
          if (!name) return null;
          try {
            const sigResponse = await apiClient.get(`/controls/signatures/by-name/${encodeURIComponent(name)}`);
            return sigResponse.data.signature_image || null;
          } catch {
            return null;
          }
        };
        
        // Fetch all signatures in parallel
        const [testedSig, reviewedSig, supervisorSig, managerSig] = await Promise.all([
          fetchSignature(coa.tested_by),
          fetchSignature(coa.reviewed_by),
          fetchSignature(coa.lab_supervisor),
          fetchSignature(coa.lab_manager)
        ]);
        
        setTestedBySignatureImage(testedSig);
        setReviewedBySignatureImage(reviewedSig);
        setLabSupervisorSignatureImage(supervisorSig);
        setLabManagerSignatureImage(managerSig);
      } catch (coaErr: any) {
        // COA doesn't exist yet, initialize empty test results
        if (coaErr.response?.status === 404) {
          initializeTestResults(unitResponse.data);
          // Set technician name from registration form as default "Tested By" with current date and signature for new COA
          const technicianName = unitResponse.data.pcr_data?.technician_name;
          if (technicianName) {
            setTestedBy(technicianName);
            // Set current date as default test date
            const today = new Date().toISOString().split('T')[0];
            setDateTested(today);
            // Try to fetch technician's signature
            try {
              const sigResponse = await apiClient.get(`/controls/signatures/by-name/${encodeURIComponent(technicianName)}`);
              if (sigResponse.data.signature_image) {
                setTestedBySignatureImage(sigResponse.data.signature_image);
              }
            } catch (sigErr) {
              console.log('No signature found for technician:', technicianName);
            }
          } else if (user?.full_name) {
            // Fallback to current user if no technician specified
            setTestedBy(user.full_name);
            const today = new Date().toISOString().split('T')[0];
            setDateTested(today);
            try {
              const sigResponse = await apiClient.get(`/controls/signatures/by-name/${encodeURIComponent(user.full_name)}`);
              if (sigResponse.data.signature_image) {
                setTestedBySignatureImage(sigResponse.data.signature_image);
              }
            } catch (sigErr) {
              console.log('No signature found for user:', user.full_name);
            }
          }
        } else {
          throw coaErr;
        }
      }
    } catch (err: any) {
      console.error('Failed to load data:', err);
      setError(err.response?.data?.detail || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [unitId, initializeTestResults, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResultChange = (disease: string, poolIndex: number, sampleType: string, value: string) => {
    setTestResults((prev) => {
      const pools = [...(prev[disease] || [])];
      const pool = { ...pools[poolIndex], values: { ...pools[poolIndex]?.values, [sampleType]: value } };
      pools[poolIndex] = pool;
      return { ...prev, [disease]: pools };
    });
  };

  // Remove a sample type column by index
  const removeSampleTypeColumn = (index: number) => {
    if (sampleTypes.length <= 1) return; // Keep at least one
    setSampleTypes(prev => prev.filter((_, i) => i !== index));
    setHouseValues(prev => prev.filter((_, i) => i !== index));
    setTestResults(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(disease => {
        updated[disease] = updated[disease].map(pool => {
          const valuesArray = Object.values(pool.values);
          const newValuesArray = valuesArray.filter((_, i) => i !== index);
          const newValues: { [key: string]: string } = {};
          newValuesArray.forEach((val, i) => { newValues[`col_${i}`] = val; });
          return { ...pool, values: newValues };
        });
      });
      return updated;
    });
  };

  // Duplicate a specific sample type column
  const duplicateSampleType = (sampleType: string, index: number) => {
    // Just copy the name as-is without adding numbers
    const newSampleTypes = [...sampleTypes];
    newSampleTypes.splice(index + 1, 0, sampleType);
    setSampleTypes(newSampleTypes);
    // Add new house value at the new index position
    setHouseValues(prev => {
      const newHouseValues = [...prev];
      newHouseValues.splice(index + 1, 0, prev[index] || '');
      return newHouseValues;
    });
    setTestResults(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(disease => {
        updated[disease] = updated[disease].map(pool => {
          // Convert values to array, insert duplicate, then back to object with new indices
          const valuesArray = newSampleTypes.map((_, i) => {
            if (i <= index) return Object.values(pool.values)[i] || '';
            if (i === index + 1) return Object.values(pool.values)[index] || '';
            return Object.values(pool.values)[i - 1] || '';
          });
          const newValues: { [key: string]: string } = {};
          newSampleTypes.forEach((_, i) => { newValues[`col_${i}`] = valuesArray[i] || ''; });
          return { ...pool, values: newValues };
        });
      });
      return updated;
    });
  };

  // Sample type column drag handlers
  const handleSampleTypeDragStart = (index: number) => {
    setDraggedSampleTypeIndex(index);
  };

  const handleSampleTypeDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedSampleTypeIndex === null || draggedSampleTypeIndex === index) return;
    
    const newSampleTypes = [...sampleTypes];
    const draggedItem = newSampleTypes[draggedSampleTypeIndex];
    newSampleTypes.splice(draggedSampleTypeIndex, 1);
    newSampleTypes.splice(index, 0, draggedItem);
    setSampleTypes(newSampleTypes);
    
    // Also reorder house values
    setHouseValues(prev => {
      const newHouseValues = [...prev];
      const draggedHouse = newHouseValues[draggedSampleTypeIndex];
      newHouseValues.splice(draggedSampleTypeIndex, 1);
      newHouseValues.splice(index, 0, draggedHouse);
      return newHouseValues;
    });
    
    setDraggedSampleTypeIndex(index);
  };

  const handleSampleTypeDragEnd = () => {
    setDraggedSampleTypeIndex(null);
  };

  // Drag and drop handlers for disease reordering
  const handleDragStart = (index: number) => {
    setDraggedDiseaseIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedDiseaseIndex === null || draggedDiseaseIndex === index) return;
    
    // Reorder diseases
    const newOrder = [...orderedDiseases];
    const draggedItem = newOrder[draggedDiseaseIndex];
    newOrder.splice(draggedDiseaseIndex, 1);
    newOrder.splice(index, 0, draggedItem);
    setOrderedDiseases(newOrder);
    setDraggedDiseaseIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedDiseaseIndex(null);
  };

  // Move disease up in the order
  const moveDiseaseUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...orderedDiseases];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setOrderedDiseases(newOrder);
  };

  // Move disease down in the order
  const moveDiseaseDown = (index: number) => {
    if (index === orderedDiseases.length - 1) return;
    const newOrder = [...orderedDiseases];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setOrderedDiseases(newOrder);
  };

  const verifyPIN = async (pin: string, field: 'testedBy' | 'reviewedBy' | 'labSupervisor' | 'labManager') => {
    if (!pin.trim()) return;
    
    try {
      const response = await apiClient.post('/controls/signatures/verify-pin', { pin });
      if (response.data.is_valid) {
        if (field === 'testedBy') {
          setTestedBy(response.data.name);
          setTestedByPIN('');
          setTestedBySignatureImage(response.data.signature_image || null);
        } else if (field === 'reviewedBy') {
          setReviewedBy(response.data.name);
          setReviewedByPIN('');
          setReviewedBySignatureImage(response.data.signature_image || null);
        } else if (field === 'labSupervisor') {
          setLabSupervisor(response.data.name);
          setLabSupervisorPIN('');
          setLabSupervisorSignatureImage(response.data.signature_image || null);
        } else {
          setLabManager(response.data.name);
          setLabManagerPIN('');
          setLabManagerSignatureImage(response.data.signature_image || null);
        }
      } else {
        setNotification({ type: 'error', message: 'Invalid PIN. Please verify the PIN and try again.' });
        if (field === 'testedBy') {
          setTestedByPIN('');
        } else if (field === 'reviewedBy') {
          setReviewedByPIN('');
        } else if (field === 'labSupervisor') {
          setLabSupervisorPIN('');
        } else {
          setLabManagerPIN('');
        }
      }
    } catch (err) {
      console.error('Failed to verify PIN:', err);
      setNotification({ type: 'error', message: 'PIN verification failed. Please check your connection and try again.' });
    }
  };

  // Check if user can approve (admin, manager, or supervisor)
  const canApprove = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'lab_supervisor';

  const handleSave = async () => {
    if (!unitData) return;

    try {
      setSaving(true);
      setError(null);

      // For technicians, status is "need_approval". For managers/admins, keep current status.
      const saveStatus = canApprove ? status : 'need_approval';

      if (coaData?.id) {
        // Update existing COA - payload without unit_id
        const updatePayload = {
          test_results: testResults,
          date_tested: dateTested || null,
          tested_by: testedBy || null,
          reviewed_by: reviewedBy || null,
          lab_supervisor: labSupervisor || null,
          lab_manager: labManager || null,
          notes: notes || null,
          status: saveStatus,
        };
        await apiClient.put(`/pcr-coa/${unitId}/`, updatePayload);
      } else {
        // Create new COA - payload with unit_id
        const createPayload = {
          unit_id: parseInt(unitId!),
          test_results: testResults,
          date_tested: dateTested || null,
          tested_by: testedBy || null,
          reviewed_by: reviewedBy || null,
          lab_supervisor: labSupervisor || null,
          lab_manager: labManager || null,
          notes: notes || null,
          status: saveStatus,
        };
        await apiClient.post('/pcr-coa/', createPayload);
      }

      // Update unit coa_status based on role
      const coaStatus = canApprove ? 'completed' : 'need_approval';
      await apiClient.patch(`/units/${unitId}`, { coa_status: coaStatus });

      // Update parent sample status based on role
      const sampleStatus = canApprove ? 'Completed' : 'Need Approval';
      await apiClient.patch(`/samples/${unitData.sample.id}`, { status: sampleStatus });

      setNotification({ type: 'success', message: 'Certificate of Analysis saved successfully!' });
      setTimeout(() => navigate('/pcr/samples'), 1500);
    } catch (err: any) {
      console.error('Failed to save COA:', err);
      setError(err.response?.data?.detail || 'Failed to save COA');
      setNotification({ type: 'error', message: 'Failed to save Certificate of Analysis. Please check your entries and try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!unitData || !canApprove) return;

    // Require at least 3 signatures: Reviewed By and Lab Supervisor are required, plus one more
    const signatureCount = [testedBy, reviewedBy, labSupervisor, labManager].filter(s => s && s.trim()).length;
    if (signatureCount < 3) {
      setNotification({ type: 'warning', message: 'At least 3 signatures are required to approve the COA (Reviewed By and Lab Supervisor are required).' });
      return;
    }
    if (!reviewedBy || !reviewedBy.trim()) {
      setNotification({ type: 'warning', message: 'Reviewed By signature is required to approve the COA.' });
      return;
    }
    if (!labSupervisor || !labSupervisor.trim()) {
      setNotification({ type: 'warning', message: 'Lab Supervisor signature is required to approve the COA.' });
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Check if sample was previously postponed and save to edit history
      const postponedMatch = notes?.match(/Postponed Reason:\s*(.+)/);
      if (postponedMatch && coaData?.status === 'postponed') {
        try {
          await apiClient.post('/edit-history/', {
            entity_type: 'unit',
            entity_id: parseInt(unitId!),
            field_name: 'postponed_reason_cleared',
            old_value: postponedMatch[1],
            new_value: 'Approved - Postponed reason cleared',
            sample_code: unitData.sample.sample_code,
            unit_code: unitData.unit_code
          });
        } catch (histErr) {
          console.error('Failed to save postponed history:', histErr);
        }
      }

      // Save with completed status
      const approvePayload = {
        test_results: testResults,
        date_tested: dateTested || null,
        tested_by: testedBy || null,
        reviewed_by: reviewedBy || null,
        lab_supervisor: labSupervisor || null,
        lab_manager: labManager || null,
        notes: notes || null,
        status: 'completed',
      };

      if (coaData?.id) {
        await apiClient.put(`/pcr-coa/${unitId}/`, approvePayload);
      } else {
        await apiClient.post('/pcr-coa/', { ...approvePayload, unit_id: parseInt(unitId!) });
      }

      // Update unit coa_status to 'completed'
      await apiClient.patch(`/units/${unitId}`, { coa_status: 'completed' });

      // Update parent sample status to 'Completed'
      await apiClient.patch(`/samples/${unitData.sample.id}`, { status: 'Completed' });

      setNotification({ type: 'success', message: 'Certificate of Analysis approved successfully!' });
      setTimeout(() => navigate('/pcr/samples'), 1500);
    } catch (err: any) {
      console.error('Failed to approve COA:', err);
      setError(err.response?.data?.detail || 'Failed to approve COA');
      setNotification({ type: 'error', message: 'Failed to approve Certificate of Analysis. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePostpone = async () => {
    if (!unitData || !postponedReason.trim()) {
      setNotification({ type: 'warning', message: 'Please provide a reason for postponing this COA.' });
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const postponePayload = {
        test_results: testResults,
        date_tested: dateTested || null,
        tested_by: testedBy || null,
        reviewed_by: reviewedBy || null,
        lab_supervisor: labSupervisor || null,
        lab_manager: labManager || null,
        notes: notes ? `${notes}\n\nPostponed Reason: ${postponedReason}` : `Postponed Reason: ${postponedReason}`,
        status: 'postponed',
      };

      if (coaData?.id) {
        await apiClient.put(`/pcr-coa/${unitId}/`, postponePayload);
      } else {
        await apiClient.post('/pcr-coa/', { ...postponePayload, unit_id: parseInt(unitId!) });
      }

      // Update unit coa_status to 'postponed'
      await apiClient.patch(`/units/${unitId}`, { coa_status: 'postponed' });

      // Update parent sample status to 'Postponed'
      await apiClient.patch(`/samples/${unitData.sample.id}`, { status: 'Postponed' });

      setShowPostponedModal(false);
      setPostponedReason('');
      setNotification({ type: 'success', message: 'Certificate of Analysis postponed successfully!' });
      setTimeout(() => navigate('/pcr/samples'), 1500);
    } catch (err: any) {
      console.error('Failed to postpone COA:', err);
      setError(err.response?.data?.detail || 'Failed to postpone COA');
      setNotification({ type: 'error', message: 'Failed to postpone Certificate of Analysis. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/pcr/samples');
  };

  // HTML escape function to prevent XSS attacks
  const escapeHtml = (text: string | number | null | undefined): string => {
    if (text === null || text === undefined) return '';
    const str = String(text);
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, (m) => map[m]);
  };

  // Format CT values: add "CT: " prefix to positive numeric values
  const formatCTValue = (value: string): string => {
    if (!value || value === 'NA' || value === '') return value;
    
    // Check if value is negative (NEG, NEG., etc.)
    const upperValue = value.toUpperCase().trim();
    if (upperValue === 'NEG' || upperValue === 'NEG.' || upperValue.startsWith('NEG')) {
      return value;
    }
    
    // Check if value is numeric (integer or decimal)
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue)) {
      return `CT: ${value}`;
    }
    
    // Return as-is for any other value
    return value;
  };

  const generatePDFTemplate = () => {
    if (!unitData || !unitData.sample) return '';
    
    const diseases = unitData.pcr_data?.diseases_list || [];
    // Use sampleTypes state (not unitData.sample_type) to reflect UI changes
    const pdfSampleTypes = sampleTypes.length > 0 ? sampleTypes : (unitData.sample_type || []);
    
    // Format detection methods as "Kit for (Disease1, Disease2)"
    const kitToDiseasesMap: { [kit: string]: string[] } = {};
    diseases.forEach(d => {
      const kit = d.kit_type || 'Unknown Kit';
      if (!kitToDiseasesMap[kit]) kitToDiseasesMap[kit] = [];
      kitToDiseasesMap[kit].push(d.disease);
    });
    const detectionMethods = Object.entries(kitToDiseasesMap)
      .map(([kit, diseaseList]) => `${kit} for (${diseaseList.join(', ')})`)
      .join(' | ');
    
    // Helper to get pools for a disease
    const getPools = (disease: string) => {
      const value = testResults[disease];
      if (Array.isArray(value)) return value;
      return [];
    };

    // Generate table headers for sample types with house values (index-based)
    const sampleTypeHeaders = pdfSampleTypes.map((st, idx) => {
      const houseValue = houseValues[idx] || '';
      return `<th style="vertical-align:top">
        <div style="font-weight:700">${escapeHtml(st)}</div>
        ${houseValue ? `<div style="font-size:10px; font-weight:600; color:#1e40af; margin-top:3px; background:#dbeafe; padding:2px 4px; border-radius:3px; white-space:nowrap">${escapeHtml(houseValue)}</div>` : ''}
      </th>`;
    }).join('');

    // Generate disease rows for test results
    const tableRows = diseases.map(diseaseItem => {
      const pools = getPools(diseaseItem.disease);
      const pool = pools[0] || { values: {}, pos_control: '', neg_control: 'Confirmed' };
      const sampleTypeCells = pdfSampleTypes.map(st => {
        const result = pool.values?.[st] || 'NA';
        const formattedResult = formatCTValue(result);
        return `<td>${escapeHtml(formattedResult)}</td>`;
      }).join('');
      const formattedPosControl = formatCTValue(pool.pos_control || '');
      const negControl = pool.neg_control || 'Confirmed';
      return `
        <tr>
          <td>${escapeHtml(diseaseItem.disease)}</td>
          ${sampleTypeCells}
          <td>${escapeHtml(formattedPosControl)}</td>
          <td>${escapeHtml(negControl)}</td>
        </tr>
      `;
    }).join('');
    
    return `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Test Report - ${escapeHtml(unitData.unit_code)}</title>
  <style>
    :root{
      --brand:#0f766e;
      --brand-ink:#0b4f4a;
      --ink:#111827;
      --muted:#6b7280;
      --bg:#ffffff;
      --line:#000000;
    }
    *{box-sizing:border-box}
    html,body{background:var(--bg);color:var(--ink);font:12px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Tahoma,Arial,sans-serif; margin:0; padding:0;}
    body{display:block;}
    .page{width:210mm; min-height:297mm; margin:2mm auto; padding:2mm 7mm 15mm 7mm; background:#fff; position:relative; box-shadow:0 0 5px rgba(0,0,0,0.15);}
    .header{display:flex; align-items:center; gap:10px; border-bottom:2px solid var(--line); padding-bottom:4px; margin-bottom:6px}
    .logo{width:70px; height:70px; object-fit:contain;}
    .lab-meta{flex:1; text-align:center}
    .lab-name{font-size:18px; font-weight:900; color:var(--brand-ink); line-height:1.2; text-align:center}
    .lab-sub{color:var(--muted); font-size:12px; margin-top:2px}
    .coa-badge{margin-inline-start:auto; text-align:right; font-size:12px; min-width:100px}
    .badge-label{color:var(--muted); font-weight:600}
    .badge-value{color:var(--brand-ink); font-weight:800; font-size:15px}
    .info-block{margin-top:6px; padding:8px; border:1px solid var(--line); border-radius:4px; background:#f9fafb}
    .info-block h2{margin:0 0 5px; font-size:14px; color:var(--brand-ink); border-bottom:1px solid var(--line); padding-bottom:3px}
    .info-grid{display:grid; grid-template-columns:140px 1fr; row-gap:3px; column-gap:8px; font-size:12px}
    .info-label{color:var(--muted); font-weight:500}
    .info-value{font-weight:600}
    .section{margin-top:6px}
    .section h2{font-size:14px; color:var(--brand-ink); margin:0 0 5px}
    table{width:100%; border-collapse:collapse; font-size:12px}
    th,td{padding:5px 6px; border:1px solid var(--line); text-align:center; vertical-align:middle}
    thead th{background:#f8fafc; color:#0f172a; font-size:12px; font-weight:700}
    tbody tr:nth-child(even) td{background:#fcfcfd}
    .signatures{display:grid; grid-template-columns:repeat(4,1fr); gap:4px; margin-top:3px}
    .sign-card{border:1px dashed var(--line); border-radius:3px; padding:3px; height:75px; display:flex; flex-direction:column; font-size:9px; overflow:visible}
    .sign-role{color:var(--muted); font-weight:600; font-size:8px; margin-bottom:1px}
    .sign-image-container{flex:1; display:flex; align-items:flex-start; justify-content:center; min-height:32px; max-height:38px}
    .sign-image{max-width:100%; max-height:38px; width:auto; height:auto; object-fit:contain}
    .sign-placeholder{width:100%; height:28px}
    .sign-info{margin-top:auto; text-align:center; padding-top:1px; border-top:1px solid #e5e7eb; min-height:18px}
    .footnote{margin-top:6px; font-size:11px; color:#374151}
    .muted{color:var(--muted)}
    .toolbar{position:sticky; top:0; background:#fff; padding:6px 0 10px; display:flex; gap:6px; z-index:10}
    .toolbar button{padding:6px 10px; border-radius:8px; border:1px solid var(--line); background:#f9fafb; cursor:pointer; font-size:12px}
    .page-number{position:fixed; bottom:2mm; left:0; right:0; text-align:center; font-size:9px; color:var(--muted)}
    @media print{
      html,body{background:#fff; margin:0; padding:0}
      .page{box-shadow:none; margin:0; width:210mm; min-height:auto; padding:2mm 5mm 8mm 5mm; page-break-inside:auto}
      .toolbar{display:none}
      a[href]:after{content:""}
      .section{page-break-inside:avoid}
      table{page-break-inside:auto}
      tr{page-break-inside:avoid; page-break-after:auto}
      thead{display:table-header-group}
      .page-number{position:fixed; bottom:2mm}
    }
    @page{
      size:A4;
      margin:5mm 5mm 8mm 5mm;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">🖨️ Print / Save as PDF</button>
    <button onclick="window.close()">✕ Close</button>
  </div>

  <div class="page">
    <header class="header">
      <img src="${window.location.origin}/assets/logo.png" alt="Logo" class="logo">
      <div class="lab-meta">
        <div class="lab-name">SAMA KARBALA CO. - Central Poultry Laboratories</div>
        <div style="text-align: center; font-size: 22px; font-weight: 900; color: #000000; margin-top: 6px;">Certificate of Analysis</div>
      </div>
      <div class="coa-badge">
        <div class="badge-value">PCR 002 R001</div>
      </div>
    </header>

    <section class="info-block">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; border-bottom:1px solid var(--line); padding-bottom:3px">
        <h2 style="margin:0; font-size:14px; color:var(--brand-ink)">Sample Information</h2>
        <div style="text-align:right">
          <span style="color:var(--muted); font-weight:600; font-size:11px">Test Report No.: </span>
          <span style="color:var(--brand-ink); font-weight:800; font-size:13px">${escapeHtml(unitData.unit_code.replace('PCR-', 'P-'))}</span>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px">
        <div class="info-grid">
          <div class="info-label">Sample Code:</div><div class="info-value">${escapeHtml(unitData.sample.sample_code)}</div>
          <div class="info-label">Company:</div><div class="info-value">${escapeHtml(unitData.sample.company)}</div>
          <div class="info-label">Flock:</div><div class="info-value">${escapeHtml(unitData.sample.flock || 'N/A')}</div>
          <div class="info-label">House:</div><div class="info-value">${escapeHtml(unitData.house?.join(', ') || 'N/A')}</div>
        </div>
        <div class="info-grid">
          <div class="info-label">Unit Code:</div><div class="info-value">${escapeHtml(unitData.unit_code)}</div>
          <div class="info-label">Farm:</div><div class="info-value">${escapeHtml(unitData.sample.farm)}</div>
          <div class="info-label">Cycle:</div><div class="info-value">${escapeHtml(unitData.sample.cycle || 'N/A')}</div>
          <div class="info-label">Age:</div><div class="info-value">${escapeHtml(unitData.age || 'N/A')}</div>
          <div class="info-label">Source:</div><div class="info-value">${escapeHtml(unitData.source || 'N/A')}</div>
        </div>
      </div>
      <div style="margin-top:6px; display:grid; grid-template-columns:120px 1fr; row-gap:4px; font-size:12px">
        <div class="info-label">Sample Types:</div><div class="info-value">${escapeHtml(pdfSampleTypes.join(', '))}</div>
        <div class="info-label">Extraction Method:</div><div class="info-value">${escapeHtml(unitData.pcr_data?.extraction_method || 'N/A')}</div>
        <div class="info-label">Detection Method:</div><div class="info-value">${escapeHtml(detectionMethods)}</div>
      </div>
    </section>

    <section class="section">
      <h2>Test Results</h2>
      <table>
        <thead>
          <tr>
            <th style="width:18%">Disease</th>
            ${sampleTypeHeaders}
            <th style="width:10%">Pos. Con.</th>
            <th style="width:10%">Neg. Con.</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <div class="footnote">
        <div class="muted">*Neg. = Negative, Ct :threshold cycle, NA = Not Applicable, Pos. Con. = Positive Control, Neg. Con. = Negative Control</div>
        ${notes ? `<div style="margin-top:3px"><strong>Notes:</strong> ${escapeHtml(notes)}</div>` : ''}
      </div>
    </section>

    <section class="section">
      <h2>Electronic Signatures</h2>
      <div class="signatures">
        <div class="sign-card">
          <div class="sign-role">Tested By</div>
          <div class="sign-image-container">
            ${testedBySignatureImage ? `<img src="${testedBySignatureImage}" alt="Signature" class="sign-image" />` : '<div class="sign-placeholder"></div>'}
          </div>
          <div class="sign-info">
            <div style="font-weight:600; font-size:7px; line-height:1.2; word-break:break-word;">${escapeHtml(testedBy || '')}</div>
            <div class="muted" style="font-size:7px; line-height:1.2;">Date: ${unitData.sample.date_received ? new Date(unitData.sample.date_received).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : ''}</div>
          </div>
        </div>
        <div class="sign-card">
          <div class="sign-role">Head Unit</div>
          <div class="sign-image-container">
            ${reviewedBySignatureImage ? `<img src="${reviewedBySignatureImage}" alt="Signature" class="sign-image" />` : '<div class="sign-placeholder"></div>'}
          </div>
          <div class="sign-info">
            <div style="font-weight:600; font-size:7px; line-height:1.2; word-break:break-word;">${escapeHtml(reviewedBy || '')}</div>
            <div class="muted" style="font-size:7px; line-height:1.2;">Date: ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</div>
          </div>
        </div>
        <div class="sign-card">
          <div class="sign-role">Lab Supervisor</div>
          <div class="sign-image-container">
            ${labSupervisorSignatureImage ? `<img src="${labSupervisorSignatureImage}" alt="Signature" class="sign-image" />` : '<div class="sign-placeholder"></div>'}
          </div>
          <div class="sign-info">
            <div style="font-weight:600; font-size:7px; line-height:1.2; word-break:break-word;">${escapeHtml(labSupervisor || '')}</div>
            <div class="muted" style="font-size:7px; line-height:1.2;">Date: ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</div>
          </div>
        </div>
        <div class="sign-card">
          <div class="sign-role">Lab Manager</div>
          <div class="sign-image-container">
            ${labManagerSignatureImage ? `<img src="${labManagerSignatureImage}" alt="Signature" class="sign-image" />` : '<div class="sign-placeholder"></div>'}
          </div>
          <div class="sign-info">
            <div style="font-weight:600; font-size:7px; line-height:1.2; word-break:break-word;">${escapeHtml(labManager || '')}</div>
            <div class="muted" style="font-size:7px; line-height:1.2;">Date: ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</div>
          </div>
        </div>
      </div>
    </section>

    <section class="section" style="margin-top:8px">
      <div style="font-size:11px; line-height:1.5">
        <div style="margin-bottom:4px; font-weight:700; font-size:12px">Warning:</div>
        <div class="muted" style="margin-bottom:3px">• This Certificate is not accredited unless it is stamped or signed.</div>
        <div class="muted" style="margin-bottom:3px">• The result represents tested samples only.</div>
        <div class="muted" style="margin-bottom:3px">• Any Abrasion or change revokes this certificate.</div>
        <div class="muted" style="margin-bottom:5px">• The laboratory results contained in this report are considered confidential between the company and clients, and should not be shared or disclosed unless required by law without the client's consent.</div>
        <div style="margin-top:4px; font-weight:700; font-size:12px">CONFIDENTIAL: <span class="muted" style="font-weight:400">Use or transcription of this document® is prohibited unless written authentication granted by Sama Karbala For Agriculture & Animal Production. © ${new Date().getFullYear()} All rights reserved.</span></div>
      </div>
    </section>
  </div>
  <div class="page-number"></div>
  <script>
    // Page counter for PDF
    (function() {
      var pageNum = document.querySelector('.page-number');
      if (pageNum) {
        pageNum.textContent = 'Page 1 of 1';
      }
      window.onbeforeprint = function() {
        if (pageNum) pageNum.textContent = 'Page 1 of 1';
      };
    })();
  </script>
</body>
</html>
    `;
  };

  // Export PDF - opens print dialog with PDF pre-selected for exact styling
  const handleDirectPDFDownload = () => {
    if (!unitData) return;
    
    // Generate filename for clipboard with all available info:
    // sample code - unit code - company - farm - flock - houses - source - age - cycle - diseases
    const sampleCode = unitData.sample?.sample_code || '';
    const unitCode = unitData.unit_code || '';
    const company = unitData.sample?.company || '';
    const farm = unitData.sample?.farm || '';
    const flock = unitData.sample?.flock || '';
    const houses = unitData.house && unitData.house.length > 0 ? unitData.house.join(', ') : '';
    const source = Array.isArray(unitData.source) ? unitData.source.join(', ') : (unitData.source || '');
    const age = unitData.age || '';
    const cycle = unitData.sample?.cycle || '';
    const diseases = unitData.pcr_data?.diseases_list?.map((d: any) => d.disease).join(', ') || '';
    
    // Build filename string with all available parts
    let filenameParts: string[] = [];
    if (sampleCode) filenameParts.push(sampleCode);
    if (unitCode) filenameParts.push(unitCode);
    if (company) filenameParts.push(company);
    if (farm) filenameParts.push(farm);
    if (flock) filenameParts.push(flock);
    if (houses) filenameParts.push(houses);
    if (source) filenameParts.push(source);
    if (age) filenameParts.push(age);
    if (cycle) filenameParts.push(cycle);
    if (diseases) filenameParts.push(diseases);
    
    const filename = filenameParts.join(' - ');
    
    // Copy filename to clipboard with robust fallback
    const copyToClipboard = async (text: string) => {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch (err) {
          console.warn('Clipboard API failed, trying fallback');
        }
      }
      
      // Fallback: Create a temporary textarea element
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      } catch (err) {
        console.error('Fallback copy failed:', err);
        return false;
      }
    };
    
    copyToClipboard(filename).then((success) => {
      if (success) {
        setNotification({ type: 'success', message: `Filename copied: ${filename}` });
      } else {
        setNotification({ type: 'warning', message: `Filename: ${filename}` });
      }
    });
    
    const htmlContent = generatePDFTemplate();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      // Write content
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // Single print trigger after images load - no duplicate calls
      let printTriggered = false;
      const triggerPrint = () => {
        if (printTriggered) return;
        printTriggered = true;
        requestAnimationFrame(() => {
          printWindow.focus();
          printWindow.print();
        });
      };
      
      // Wait for all images to load before printing
      const images = printWindow.document.querySelectorAll('img');
      if (images.length === 0) {
        setTimeout(triggerPrint, 300);
      } else {
        let loadedCount = 0;
        const checkAllLoaded = () => {
          loadedCount++;
          if (loadedCount >= images.length) {
            triggerPrint();
          }
        };
        images.forEach((img) => {
          if (img.complete) {
            checkAllLoaded();
          } else {
            img.onload = checkAllLoaded;
            img.onerror = checkAllLoaded;
          }
        });
        // Fallback timeout if images take too long
        setTimeout(triggerPrint, 3000);
      }
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-600 text-xl font-semibold">Loading COA data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
        <button
          onClick={() => navigate('/pcr-samples')}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Back to PCR Samples
        </button>
      </div>
    );
  }

  if (!unitData || !unitData.sample) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-600 text-xl font-semibold">Unit data not found</div>
        <button
          onClick={() => navigate('/pcr/samples')}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 mt-4"
        >
          Back to PCR Samples
        </button>
      </div>
    );
  }

  const diseases = unitData.pcr_data?.diseases_list || [];
  
  // Format detection methods as "Kit for (Disease1, Disease2)"
  const kitToDiseasesMapUI: { [kit: string]: string[] } = {};
  diseases.forEach(d => {
    const kit = d.kit_type || 'Unknown Kit';
    if (!kitToDiseasesMapUI[kit]) kitToDiseasesMapUI[kit] = [];
    kitToDiseasesMapUI[kit].push(d.disease);
  });
  const detectionMethods = Object.entries(kitToDiseasesMapUI)
    .map(([kit, diseaseList]) => `${kit} for (${diseaseList.join(', ')})`)
    .join(' | ');

  // Handle back navigation - go to database if came from there
  const handleBack = () => {
    if (navigationState?.fromDatabase) {
      navigate('/database');
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="p-8">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-pulse">
          <div className={`px-5 py-4 rounded-xl shadow-lg flex items-center gap-3 min-w-[320px] max-w-md ${
            notification.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' :
            notification.type === 'error' ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white' :
            'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
          }`}>
            {notification.type === 'success' && (
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {notification.type === 'error' && (
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {notification.type === 'warning' && (
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <span className="font-medium">{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-auto hover:opacity-80">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleBack}
        className="flex items-center gap-2 px-4 py-2 mb-4 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors font-medium"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back
      </button>
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        {/* Simple Header */}
        <div className="text-center border-b-4 border-blue-700 pb-4 mb-6">
          <h1 className="text-3xl font-bold text-blue-700 mb-2">PCR Certificate of Analysis</h1>
          <p className="text-sm text-gray-600">Unit Code: {unitData.unit_code}</p>
        </div>

        {/* Sample Information */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded">
          <div>
            <span className="font-semibold">Sample Code:</span> {unitData.sample.sample_code}
          </div>
          <div>
            <span className="font-semibold">Unit Code:</span> {unitData.unit_code}
          </div>
          <div>
            <span className="font-semibold">Date Received:</span> {new Date(unitData.sample.date_received).toLocaleDateString()}
          </div>
          <div>
            <span className="font-semibold">Company:</span> {unitData.sample.company}
          </div>
          <div>
            <span className="font-semibold">Farm:</span> {unitData.sample.farm}
          </div>
          <div>
            <span className="font-semibold">Flock:</span> {unitData.sample.flock || '-'}
          </div>
          <div>
            <span className="font-semibold">Cycle:</span> {unitData.sample.cycle || '-'}
          </div>
          <div>
            <span className="font-semibold">House:</span> {unitData.house?.join(', ') || '-'}
          </div>
          <div>
            <span className="font-semibold">Age:</span> {unitData.age || '-'}
          </div>
          <div>
            <span className="font-semibold">Source:</span> {unitData.source || '-'}
          </div>
          <div>
            <span className="font-semibold">Sample Types:</span> {sampleTypes.join(', ') || '-'}
          </div>
          <div>
            <span className="font-semibold">Extraction Method:</span> {unitData.pcr_data?.extraction_method || '-'}
          </div>
          <div>
            <span className="font-semibold">Detection Method:</span> {detectionMethods || '-'}
          </div>
        </div>

        {/* COA Metadata */}
        <div className="mb-6">
          <div className="w-full md:w-1/2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Tested</label>
            <input
              type="date"
              value={dateTested}
              onChange={(e) => setDateTested(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Signature Fields with PIN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">Tested By</label>
            {testedBy ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-green-700 font-semibold">{testedBy}</span>
                  <button
                    onClick={() => { setTestedBy(''); setTestedBySignatureImage(null); }}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Clear
                  </button>
                </div>
                {testedBySignatureImage && (
                  <img src={testedBySignatureImage} alt="Signature" className="max-h-12 object-contain border border-gray-200 rounded bg-white" />
                )}
              </div>
            ) : (
              <input
                type="password"
                value={testedByPIN}
                onChange={(e) => setTestedByPIN(e.target.value)}
                onBlur={() => verifyPIN(testedByPIN, 'testedBy')}
                onKeyPress={(e) => e.key === 'Enter' && verifyPIN(testedByPIN, 'testedBy')}
                placeholder="Enter PIN"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                maxLength={8}
              />
            )}
          </div>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">Reviewed By <span className="text-red-500">*</span></label>
            {reviewedBy ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-green-700 font-semibold">{reviewedBy}</span>
                  <button
                    onClick={() => { setReviewedBy(''); setReviewedBySignatureImage(null); }}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Clear
                  </button>
                </div>
                {reviewedBySignatureImage && (
                  <img src={reviewedBySignatureImage} alt="Signature" className="max-h-12 object-contain border border-gray-200 rounded bg-white" />
                )}
              </div>
            ) : (
              <input
                type="password"
                value={reviewedByPIN}
                onChange={(e) => setReviewedByPIN(e.target.value)}
                onBlur={() => verifyPIN(reviewedByPIN, 'reviewedBy')}
                onKeyPress={(e) => e.key === 'Enter' && verifyPIN(reviewedByPIN, 'reviewedBy')}
                placeholder="Enter PIN"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                maxLength={8}
              />
            )}
          </div>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">Lab Supervisor <span className="text-red-500">*</span></label>
            {labSupervisor ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-green-700 font-semibold">{labSupervisor}</span>
                  <button
                    onClick={() => { setLabSupervisor(''); setLabSupervisorSignatureImage(null); }}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Clear
                  </button>
                </div>
                {labSupervisorSignatureImage && (
                  <img src={labSupervisorSignatureImage} alt="Signature" className="max-h-12 object-contain border border-gray-200 rounded bg-white" />
                )}
              </div>
            ) : (
              <input
                type="password"
                value={labSupervisorPIN}
                onChange={(e) => setLabSupervisorPIN(e.target.value)}
                onBlur={() => verifyPIN(labSupervisorPIN, 'labSupervisor')}
                onKeyPress={(e) => e.key === 'Enter' && verifyPIN(labSupervisorPIN, 'labSupervisor')}
                placeholder="Enter PIN"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                maxLength={8}
              />
            )}
          </div>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">Lab Manager</label>
            {labManager ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-green-700 font-semibold">{labManager}</span>
                  <button
                    onClick={() => { setLabManager(''); setLabManagerSignatureImage(null); }}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Clear
                  </button>
                </div>
                {labManagerSignatureImage && (
                  <img src={labManagerSignatureImage} alt="Signature" className="max-h-12 object-contain border border-gray-200 rounded bg-white" />
                )}
              </div>
            ) : (
              <input
                type="password"
                value={labManagerPIN}
                onChange={(e) => setLabManagerPIN(e.target.value)}
                onBlur={() => verifyPIN(labManagerPIN, 'labManager')}
                onKeyPress={(e) => e.key === 'Enter' && verifyPIN(labManagerPIN, 'labManager')}
                placeholder="Enter PIN"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                maxLength={8}
              />
            )}
          </div>
        </div>

        {/* Test Results Table */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Test Results</h3>
          
          {/* Sample Houses Info */}
          {unitData?.house && unitData.house.length > 0 && (
            <div className="mb-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Sample Houses: </span>
              <span className="text-sm text-gray-900 font-semibold">{unitData.house.join(', ')}</span>
            </div>
          )}
          
          <div className="overflow-x-auto">
            <p className="text-xs text-gray-500 mb-2 italic">💡 Drag columns to reorder. Click (+) to duplicate sample type.</p>
            <table className="min-w-full border-collapse border border-gray-300">
              <thead>
                {/* Header Row - Sample Types with House inputs */}
                <tr className="bg-blue-100">
                  <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Disease</th>
                  {sampleTypes.map((sampleType, stIndex) => (
                    <th 
                      key={`${sampleType}-${stIndex}`} 
                      className={`border border-gray-300 px-2 py-2 text-center font-semibold cursor-grab ${draggedSampleTypeIndex === stIndex ? 'bg-blue-200' : ''}`}
                      draggable
                      onDragStart={() => handleSampleTypeDragStart(stIndex)}
                      onDragOver={(e) => handleSampleTypeDragOver(e, stIndex)}
                      onDragEnd={handleSampleTypeDragEnd}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-center gap-1">
                          <span>{sampleType}</span>
                          <button
                            type="button"
                            onClick={() => duplicateSampleType(sampleType, stIndex)}
                            className="text-blue-600 hover:text-blue-800 font-bold text-sm"
                            title="Duplicate this column"
                          >
                            +
                          </button>
                          {sampleTypes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSampleTypeColumn(stIndex)}
                              className="text-red-500 hover:text-red-700 text-xs"
                              title="Remove column"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={houseValues[stIndex] || ''}
                          onChange={(e) => setHouseValues(prev => {
                            const newValues = [...prev];
                            newValues[stIndex] = e.target.value;
                            return newValues;
                          })}
                          placeholder="House (e.g. H1-H4)"
                          className="w-full px-2 py-1.5 border-2 border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-sm font-semibold text-blue-800 bg-blue-50 placeholder:text-blue-400 placeholder:font-normal"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        />
                      </div>
                    </th>
                  ))}
                  <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Pos. Con.</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Neg. Con.</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Use orderedDiseases for rendering to maintain user-defined order
                  const diseasesToRender = orderedDiseases.length > 0 ? orderedDiseases : diseases;
                  
                  return diseasesToRender.map((diseaseItem, diseaseIndex) => {
                    const pools = testResults[diseaseItem.disease] || [];
                    const pool = pools[0] || { values: {}, pos_control: '', neg_control: 'Confirmed' };
                    
                    return (
                      <tr 
                        key={diseaseItem.disease}
                        className={`hover:bg-gray-50 ${draggedDiseaseIndex === diseaseIndex ? 'bg-blue-50' : ''}`}
                        draggable
                        onDragStart={() => handleDragStart(diseaseIndex)}
                        onDragOver={(e) => handleDragOver(e, diseaseIndex)}
                        onDragEnd={handleDragEnd}
                      >
                        <td className="border border-gray-300 px-4 py-2 font-medium">
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-0.5">
                              <button
                                type="button"
                                onClick={() => moveDiseaseUp(diseaseIndex)}
                                disabled={diseaseIndex === 0}
                                className={`p-0.5 rounded ${diseaseIndex === 0 ? 'text-gray-300' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`}
                                title="Move up"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => moveDiseaseDown(diseaseIndex)}
                                disabled={diseaseIndex === diseasesToRender.length - 1}
                                className={`p-0.5 rounded ${diseaseIndex === diseasesToRender.length - 1 ? 'text-gray-300' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`}
                                title="Move down"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                            <span className="cursor-grab">{diseaseItem.disease}</span>
                          </div>
                        </td>
                        {sampleTypes.map((sampleType) => (
                          <td key={`${diseaseItem.disease}-${sampleType}`} className="border border-gray-300 px-2 py-2">
                            <input
                              type="text"
                              value={pool.values?.[sampleType] || ''}
                              onChange={(e) => handleResultChange(diseaseItem.disease, 0, sampleType, e.target.value)}
                              placeholder=""
                              className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-center"
                            />
                          </td>
                        ))}
                        <td className="border border-gray-300 px-2 py-2">
                          <input
                            type="text"
                            value={pool.pos_control || ''}
                            onChange={(e) => {
                              setTestResults(prev => {
                                const pools = [...(prev[diseaseItem.disease] || [])];
                                pools[0] = { ...pools[0], pos_control: e.target.value };
                                return { ...prev, [diseaseItem.disease]: pools };
                              });
                            }}
                            placeholder=""
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-center"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <input
                            type="text"
                            value={pool.neg_control || 'Confirmed'}
                            onChange={(e) => {
                              setTestResults(prev => {
                                const pools = [...(prev[diseaseItem.disease] || [])];
                                pools[0] = { ...pools[0], neg_control: e.target.value };
                                return { ...prev, [diseaseItem.disease]: pools };
                              });
                            }}
                            placeholder=""
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-center"
                          />
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            *Neg. = Negative, Ct: threshold cycle, NA = Not Applicable, Pos. Con. = Positive Control, Neg. Con. = Negative Control<br />
            *Click (+) on header to add sample type columns. House row shows house range for each organ.
          </div>
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes or observations..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={handleCancel}
            disabled={saving}
            className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-400"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleDirectPDFDownload}
              disabled={saving}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
              title="Export PDF"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export PDF
            </button>
            <button
              onClick={() => setShowPostponedModal(true)}
              disabled={saving}
              className="px-6 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-400"
            >
              Postpone
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? 'Saving...' : 'Save COA'}
            </button>
            {canApprove && (
              <button
                onClick={handleApprove}
                disabled={saving}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                {saving ? 'Approving...' : 'Approve COA'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Postponed Modal */}
      {showPostponedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Postpone COA</h3>
            <p className="text-sm text-gray-600 mb-4">Please enter a reason for postponing this COA:</p>
            <textarea
              value={postponedReason}
              onChange={(e) => setPostponedReason(e.target.value)}
              placeholder="Enter reason for postponing..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPostponedModal(false);
                  setPostponedReason('');
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handlePostpone}
                disabled={saving || !postponedReason.trim()}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-400"
              >
                {saving ? 'Postponing...' : 'Confirm Postpone'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
