import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { apiClient } from '../../../services/apiClient';
import axios from 'axios';

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
  microbiology_data: {
    diseases_list: string[];
    batch_no: string;
    fumigation: string;
    index_list: string[];
    technician_name?: string;
  };
}

interface ASTResult {
  disk: string;
  mic: string;
  interpretation: string;
  r: string;
  i: string;
  s: string;
}

interface ASTData {
  bacterial_isolate: string;
  bacteria_family: string;
  include_in_pdf: boolean;
  ast_results: ASTResult[];
}

interface COAData {
  id?: number;
  unit_id: number;
  test_results: { [disease: string]: { [sampleType: string]: string } };
  test_portions: { [disease: string]: { [sampleType: string]: string } };
  test_methods: { [disease: string]: string };
  test_report_numbers: { [disease: string]: string };
  hidden_indexes: { [disease: string]: string[] };
  ast_data: ASTData | null;
  date_tested: string | null;
  tested_by: string | null;
  reviewed_by: string | null;
  lab_supervisor: string | null;
  lab_manager: string | null;
  notes: string | null;
  status: string;
}

export function MicrobiologyCOA() {
  const { unitId } = useParams<{ unitId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useCurrentUser();

  // Get navigation state to determine where to go back
  const navigationState = location.state as { fromDatabase?: boolean; department?: string } | null;

  const [unitData, setUnitData] = useState<UnitData | null>(null);
  const [coaData, setCoaData] = useState<COAData | null>(null);
  const [testResults, setTestResults] = useState<{ [disease: string]: { [sampleType: string]: string } }>({});
  const [testPortions, setTestPortions] = useState<{ [disease: string]: { [sampleType: string]: string } }>({});
  const [testMethods, setTestMethods] = useState<{ [disease: string]: string }>({});
  const [testReportNumbers, setTestReportNumbers] = useState<{ [disease: string]: string }>({});
  // Note: testReportNumbers state is kept for backward compatibility with saved COA data
  // PDF generation uses getDiseaseReportNumber() function directly for accurate codes
  void testReportNumbers; // Suppress unused variable warning
  const [isolateTypes, setIsolateTypes] = useState<{ [disease: string]: { [sampleType: string]: string } }>({});
  const [testRanges, setTestRanges] = useState<{ [disease: string]: { [sampleType: string]: string } }>({});
  const [dateTested, setDateTested] = useState<string>('');
  const [testedBy, setTestedBy] = useState<string>('');
  const [reviewedBy, setReviewedBy] = useState<string>('');
  const [labSupervisor, setLabSupervisor] = useState<string>('');
  const [labManager, setLabManager] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [status, setStatus] = useState<string>('draft');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDiseaseIndex, setCurrentDiseaseIndex] = useState<number>(0);
  const [postponedReason, setPostponedReason] = useState<string>('');
  const [showPostponedModal, setShowPostponedModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Auto-dismiss notification after 4 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    type: 'result' | 'portion' | 'isolateType' | 'range' | 'water_tbc' | 'water_coliform' | 'water_ecoli' | 'water_pseudomonas' | 'totalcount_tbc' | 'totalcount_mould' | 'totalcount_fungi';
    value: string;
  } | null>(null);

  // PIN Verification States
  const [testedByPIN, setTestedByPIN] = useState<string>('');
  const [reviewedByPIN, setReviewedByPIN] = useState<string>('');
  const [labSupervisorPIN, setLabSupervisorPIN] = useState<string>('');
  const [labManagerPIN, setLabManagerPIN] = useState<string>('');

  // Water COA Volume and Dilution States
  const [waterVolume, setWaterVolume] = useState<number>(4);
  const [waterDilution, setWaterDilution] = useState<number>(1);

  // Total Count COA Dilution State
  const [totalCountDilution, setTotalCountDilution] = useState<number>(0.11);

  // AST (Antimicrobial Susceptibility Testing) State
  const [showASTTab, setShowASTTab] = useState<boolean>(false);
  const [includeASTInPDF, setIncludeASTInPDF] = useState<boolean>(false);
  const [astBacterialIsolate, setAstBacterialIsolate] = useState<string>('');
  const [astOrgan, setAstOrgan] = useState<string>('');
  const [astBacteriaFamily, setAstBacteriaFamily] = useState<string>('Enterobacteriaceae');
  const [astResults, setAstResults] = useState<ASTResult[]>([]);
  
  // Context menu state for AST Fill All
  const [astContextMenu, setAstContextMenu] = useState<{ x: number; y: number; type: 'result' | 'interpretation' } | null>(null);

  // Fill All handlers for AST
  const handleFillAllResult = (value: string) => {
    setAstResults(prev => prev.map(r => ({ ...r, mic: value })));
    setAstContextMenu(null);
  };

  const handleFillAllInterpretation = (value: string) => {
    setAstResults(prev => prev.map(r => ({ ...r, interpretation: value })));
    setAstContextMenu(null);
  };

  // Hidden indexes per disease (for +/- row toggle)
  const [hiddenIndexes, setHiddenIndexes] = useState<{ [disease: string]: Set<string> }>({});

  // Toggle index visibility for a disease
  const toggleIndexVisibility = (disease: string, index: string) => {
    setHiddenIndexes(prev => {
      const diseaseSet = new Set(prev[disease] || []);
      if (diseaseSet.has(index)) {
        diseaseSet.delete(index);
      } else {
        diseaseSet.add(index);
      }
      return { ...prev, [disease]: diseaseSet };
    });
  };

  // Check if an index is hidden for a disease
  const isIndexHidden = (disease: string, index: string): boolean => {
    return hiddenIndexes[disease]?.has(index) || false;
  };

  // Handwritten Signature Images
  const [testedBySignatureImage, setTestedBySignatureImage] = useState<string | null>(null);
  const [reviewedBySignatureImage, setReviewedBySignatureImage] = useState<string | null>(null);
  const [labSupervisorSignatureImage, setLabSupervisorSignatureImage] = useState<string | null>(null);
  const [labManagerSignatureImage, setLabManagerSignatureImage] = useState<string | null>(null);

  // Query for culture isolation types
  const { data: cultureIsolationTypes = [] } = useQuery<any[]>({
    queryKey: ['culture-isolation-types'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const queryApiClient = axios.create({
        baseURL: '/api/v1',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const response = await queryApiClient.get('/controls/culture-isolation-types');
      return response.data;
    },
    retry: (failureCount, error: any) => {
      // Don't retry on authentication errors
      if (error?.response?.status === 401) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Query for AST Disks
  const { data: astDisks = [] } = useQuery<any[]>({
    queryKey: ['ast-disks'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const queryApiClient = axios.create({
        baseURL: '/api/v1',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const response = await queryApiClient.get('/controls/ast-disks');
      return response.data;
    },
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Initialize AST results from database when astDisks loads
  useEffect(() => {
    if (astDisks.length > 0 && astResults.length === 0) {
      const initialResults = astDisks.map((disk: any) => ({
        disk: disk.name,
        mic: '',
        interpretation: '',
        r: disk.r_value || '',
        i: disk.i_value || '',
        s: disk.s_value || '',
      }));
      setAstResults(initialResults);
    }
  }, [astDisks]);

  // Query for pathogenic fungi & mold
  const { data: pathogenicFungiMoldTypes = [] } = useQuery<any[]>({
    queryKey: ['pathogenic-fungi-mold'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const queryApiClient = axios.create({
        baseURL: '/api/v1',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const response = await queryApiClient.get('/controls/pathogenic-fungi-mold');
      return response.data;
    },
    retry: (failureCount, error: any) => {
      // Don't retry on authentication errors
      if (error?.response?.status === 401) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Query for culture screened pathogens
  const { data: cultureScreenedPathogens = [] } = useQuery<any[]>({
    queryKey: ['culture-screened-pathogens'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const queryApiClient = axios.create({
        baseURL: '/api/v1',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const response = await queryApiClient.get('/controls/culture-screened-pathogens');
      return response.data;
    },
    retry: (failureCount, error: any) => {
      // Don't retry on authentication errors
      if (error?.response?.status === 401) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const initializeTestResults = useCallback((unit: UnitData) => {
    const results: { [disease: string]: { [sampleType: string]: string } } = {};
    const portions: { [disease: string]: { [sampleType: string]: string } } = {};
    const methods: { [disease: string]: string } = {};
    const isolateTypesData: { [disease: string]: { [sampleType: string]: string } } = {};
    const rangesData: { [disease: string]: { [sampleType: string]: string } } = {};
    const reportNumbers: { [disease: string]: string } = {};

    // Generate disease-specific report numbers based on unit code
    // MIC-1 or MIC25-1 -> CU25-1, FUNGI25-1, SALM25-1, WATER25-1, COUNT25-1
    const unitCode = unit.unit_code || '';
    // Extract sequence number from unit code (e.g., MIC-1 -> 1, or MIC25-1 -> 1)
    const seqMatch = unitCode.match(/MIC\d*-(\d+)/i);
    const seqNum = seqMatch ? seqMatch[1] : '';
    // Get year from sample's date_received (e.g., 2025 -> 25)
    const dateReceived = unit.sample?.date_received;
    const yearNum = dateReceived ? String(new Date(dateReceived).getFullYear()).slice(-2) : String(new Date().getFullYear()).slice(-2);

    // Initialize with index_list as rows and diseases as columns
    unit.microbiology_data?.diseases_list?.forEach((disease) => {
      results[disease] = {};
      portions[disease] = {};
      isolateTypesData[disease] = {};
      rangesData[disease] = {};
      
      // Generate disease-specific report number (e.g., CU25-1, FUNGI25-1, SALM25-1, WATER25-1, COUNT25-1)
      const lowerDisease = disease.toLowerCase();
      if (seqNum) {
        if (lowerDisease.includes('culture') || lowerDisease.includes('isolation')) {
          reportNumbers[disease] = `CU${yearNum}-${seqNum}`;
        } else if (lowerDisease.includes('fungi') || lowerDisease.includes('mold') || lowerDisease.includes('mould')) {
          reportNumbers[disease] = `FUNGI${yearNum}-${seqNum}`;
        } else if (lowerDisease.includes('salmonella')) {
          reportNumbers[disease] = `SALM${yearNum}-${seqNum}`;
        } else if (lowerDisease.includes('water')) {
          reportNumbers[disease] = `WATER${yearNum}-${seqNum}`;
        } else if (lowerDisease.includes('total count')) {
          reportNumbers[disease] = `COUNT${yearNum}-${seqNum}`;
        } else {
          reportNumbers[disease] = unitCode;
        }
      } else {
        reportNumbers[disease] = unitCode;
      }
      
      // Set default test method for culture-related diseases, fungi, water, total count, and Salmonella
      if (lowerDisease.includes('culture') || lowerDisease.includes('isolation') || lowerDisease.includes('fungi')) {
        methods[disease] = 'Clinical Veterinary Microbiology 2nd edition, laboratory manual for the isolation and identification of avian pathogens Manual method 2008.';
      } else if (lowerDisease.includes('water')) {
        methods[disease] = 'Standard method (2018),9215 A, B and C - Part 9000 – ISO 16266: (2006).';
      } else if (lowerDisease.includes('total count')) {
        methods[disease] = 'ISO 4883-1:2013 / Amd.1:2022 (E)';
      } else if (lowerDisease.includes('salmonella')) {
        methods[disease] = 'ISO 6579-1:2017 Amd.1:2020(E)';
      } else {
        methods[disease] = '';
      }

      unit.microbiology_data?.index_list?.forEach((index) => {
        // Set default values based on disease type
        const diseaseLower = disease.toLowerCase();
        if (diseaseLower.includes('total count')) {
          results[disease][index] = 'Less than 10 CFU';
          results[disease][`${index}_mould`] = 'Less than 10 CFU';
          results[disease][`${index}_fungi`] = '-------';
        } else if (diseaseLower.includes('water')) {
          results[disease][index] = 'Less than 1 CFU';
          results[disease][`${index}_coliform`] = 'Less than 1 CFU';
          results[disease][`${index}_ecoli`] = 'Less than 1 CFU';
          results[disease][`${index}_pseudomonas`] = 'Less than 1 CFU';
        } else if (diseaseLower.includes('salmonella')) {
          results[disease][index] = 'Not Detected';
        } else if (diseaseLower.includes('culture')) {
          results[disease][index] = 'Not Detected';
        } else {
          results[disease][index] = 'Not Detected';
        }
        portions[disease][index] = disease.toLowerCase().includes('salmonella') ? 'per25g' : '';
        isolateTypesData[disease][index] = '----';
        rangesData[disease][index] = '';
      });
    });

    setTestResults(results);
    setTestPortions(portions);
    setTestMethods(methods);
    setTestReportNumbers(reportNumbers);
    setIsolateTypes(isolateTypesData);
    setTestRanges(rangesData);
  }, []);

  const verifyPIN = async (pin: string, field: 'testedBy' | 'reviewedBy' | 'labSupervisor' | 'labManager') => {
    if (!pin.trim()) return;

    try {
      // Get current token for PIN verification
      const token = localStorage.getItem('token');
      if (!token) {
        setNotification({ type: 'error', message: 'Authentication required. Please log in again.' });
        return;
      }

      // Create custom axios instance for PIN verification
      const pinApiClient = axios.create({
        baseURL: '/api/v1',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const response = await pinApiClient.post('/controls/signatures/verify-pin', { pin });
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
    } catch (err: any) {
      console.error('Failed to verify PIN:', err);
      // Handle authentication errors gracefully
      if (err.response?.status === 401) {
        setNotification({ type: 'error', message: 'Session expired. Please refresh the page and try again.' });
      } else {
        setNotification({ type: 'error', message: 'PIN verification failed. Please check your connection and try again.' });
      }
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current token for data fetching
      const token = localStorage.getItem('token');
      if (!token) {
        setError('You are not authenticated. Please log in again.');
        setLoading(false);
        return;
      }

      // Create custom axios instance for data fetching
      const fetchApiClient = axios.create({
        baseURL: '/api/v1',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      // Fetch unit data
      const unitResponse = await fetchApiClient.get(`/units/${unitId}`);
      setUnitData(unitResponse.data);

      // Try to fetch existing COA data
      try {
        const coaResponse = await fetchApiClient.get(`/microbiology-coa/${unitId}`);
        const coa = coaResponse.data;

        // Check if COA exists (not null)
        if (coa && coa.id) {
          setCoaData(coa);
          setTestResults(coa.test_results || {});
          setTestPortions(coa.test_portions || {});
          
          // Load test methods with defaults for empty values
          const savedMethods = coa.test_methods || {};
          const methodsWithDefaults: { [disease: string]: string } = {};
          unitResponse.data.microbiology_data?.diseases_list?.forEach((disease: string) => {
            const lowerDisease = disease.toLowerCase();
            // Use saved method if it exists and is not empty, otherwise use default
            if (savedMethods[disease] && savedMethods[disease].trim()) {
              methodsWithDefaults[disease] = savedMethods[disease];
            } else if (lowerDisease.includes('culture') || lowerDisease.includes('isolation') || lowerDisease.includes('fungi')) {
              methodsWithDefaults[disease] = 'Clinical Veterinary Microbiology 2nd edition, laboratory manual for the isolation and identification of avian pathogens Manual method 2008.';
            } else if (lowerDisease.includes('water')) {
              methodsWithDefaults[disease] = 'Standard method (2018),9215 A, B and C - Part 9000 – ISO 16266: (2006).';
            } else if (lowerDisease.includes('total count')) {
              methodsWithDefaults[disease] = 'ISO 4883-1:2013 / Amd.1:2022 (E)';
            } else if (lowerDisease.includes('salmonella')) {
              methodsWithDefaults[disease] = 'ISO 6579-1:2017 Amd.1:2020(E)';
            } else {
              methodsWithDefaults[disease] = savedMethods[disease] || '';
            }
          });
          setTestMethods(methodsWithDefaults);
          
          // Load hidden indexes from database (per disease)
          if (coa.hidden_indexes) {
            const loadedHiddenIndexes: { [disease: string]: Set<string> } = {};
            for (const [disease, indexes] of Object.entries(coa.hidden_indexes)) {
              loadedHiddenIndexes[disease] = new Set(indexes as string[]);
            }
            setHiddenIndexes(loadedHiddenIndexes);
          }
          
          // Extract actual indices from saved test_results and update unitData's index_list
          // This ensures the form displays the saved data correctly even if index_list was changed
          const savedTestResults = coa.test_results || {};
          const firstDisease = Object.keys(savedTestResults)[0];
          if (firstDisease && savedTestResults[firstDisease]) {
            const savedKeys = Object.keys(savedTestResults[firstDisease]);
            // Extract base indices (remove suffixes like _mould, _fungi, _coliform, etc.)
            const baseIndices = new Set<string>();
            savedKeys.forEach(key => {
              const baseKey = key.split('_')[0];
              // Skip if it looks like a suffix key (number followed by underscore)
              if (baseKey && !key.endsWith('_raw')) {
                baseIndices.add(baseKey);
              }
            });
            // Update unitData with saved indices if they differ
            const savedIndexList = Array.from(baseIndices).filter(idx => 
              !idx.includes('raw') && !idx.includes('mould') && !idx.includes('fungi') && 
              !idx.includes('coliform') && !idx.includes('ecoli') && !idx.includes('pseudomonas')
            );
            if (savedIndexList.length > 0) {
              setUnitData(prev => prev ? {
                ...prev,
                microbiology_data: {
                  ...prev.microbiology_data!,
                  index_list: savedIndexList
                }
              } : prev);
            }
          }
          
          // Always generate disease-specific report numbers based on unit code
          // This ensures correct codes like CU25-1, FUNGI25-1, SALM25-1, WATER25-1, COUNT25-1
          const unitCode = unitResponse.data.unit_code || '';
          // Extract sequence number from unit code (e.g., MIC-1 -> 1, or MIC25-1 -> 1)
          const seqMatch = unitCode.match(/MIC\d*-(\d+)/i);
          const seqNum = seqMatch ? seqMatch[1] : '';
          // Get year from sample's date_received (e.g., 2025 -> 25)
          const dateReceived = unitResponse.data.sample?.date_received;
          const yearNum = dateReceived ? String(new Date(dateReceived).getFullYear()).slice(-2) : String(new Date().getFullYear()).slice(-2);
          
          const generatedReportNumbers: { [disease: string]: string } = {};
          unitResponse.data.microbiology_data?.diseases_list?.forEach((disease: string) => {
            const lowerDisease = disease.toLowerCase();
            if (seqNum) {
              if (lowerDisease.includes('culture') || lowerDisease.includes('isolation')) {
                generatedReportNumbers[disease] = `CU${yearNum}-${seqNum}`;
              } else if (lowerDisease.includes('fungi') || lowerDisease.includes('mold') || lowerDisease.includes('mould')) {
                generatedReportNumbers[disease] = `FUNGI${yearNum}-${seqNum}`;
              } else if (lowerDisease.includes('salmonella')) {
                generatedReportNumbers[disease] = `SALM${yearNum}-${seqNum}`;
              } else if (lowerDisease.includes('water')) {
                generatedReportNumbers[disease] = `WATER${yearNum}-${seqNum}`;
              } else if (lowerDisease.includes('total count')) {
                generatedReportNumbers[disease] = `COUNT${yearNum}-${seqNum}`;
              } else {
                generatedReportNumbers[disease] = unitCode;
              }
            } else {
              generatedReportNumbers[disease] = unitCode;
            }
          });
          setTestReportNumbers(generatedReportNumbers);
          
          setIsolateTypes(coa.isolate_types || {});
          setTestRanges(coa.test_ranges || {});
          setDateTested(coa.date_tested || '');
          setTestedBy(coa.tested_by || '');
          setReviewedBy(coa.reviewed_by || '');
          setLabSupervisor(coa.lab_supervisor || '');
          setLabManager(coa.lab_manager || '');
          setNotes(coa.notes || '');
          setStatus(coa.status || 'draft');
          
          // Fetch signature images for existing COA signatories
          if (coa.tested_by) {
            try {
              const sigResponse = await apiClient.get(`/controls/signatures/by-name/${encodeURIComponent(coa.tested_by)}`);
              if (sigResponse.data.signature_image) {
                setTestedBySignatureImage(sigResponse.data.signature_image);
              }
            } catch (sigErr) {
              console.log('No signature found for tested by:', coa.tested_by);
            }
          }
          if (coa.reviewed_by) {
            try {
              const sigResponse = await apiClient.get(`/controls/signatures/by-name/${encodeURIComponent(coa.reviewed_by)}`);
              if (sigResponse.data.signature_image) {
                setReviewedBySignatureImage(sigResponse.data.signature_image);
              }
            } catch (sigErr) {
              console.log('No signature found for reviewed by:', coa.reviewed_by);
            }
          }
          if (coa.lab_supervisor) {
            try {
              const sigResponse = await apiClient.get(`/controls/signatures/by-name/${encodeURIComponent(coa.lab_supervisor)}`);
              if (sigResponse.data.signature_image) {
                setLabSupervisorSignatureImage(sigResponse.data.signature_image);
              }
            } catch (sigErr) {
              console.log('No signature found for lab supervisor:', coa.lab_supervisor);
            }
          }
          if (coa.lab_manager) {
            try {
              const sigResponse = await apiClient.get(`/controls/signatures/by-name/${encodeURIComponent(coa.lab_manager)}`);
              if (sigResponse.data.signature_image) {
                setLabManagerSignatureImage(sigResponse.data.signature_image);
              }
            } catch (sigErr) {
              console.log('No signature found for lab manager:', coa.lab_manager);
            }
          }
          
          // Load AST data if exists
          if (coa.ast_data) {
            setAstBacterialIsolate(coa.ast_data.bacterial_isolate || '');
            setAstOrgan(coa.ast_data.organ || '');
            setAstBacteriaFamily(coa.ast_data.bacteria_family || 'Enterobacteriaceae');
            if (coa.ast_data.include_in_pdf !== undefined) {
              setIncludeASTInPDF(coa.ast_data.include_in_pdf);
            }
            if (coa.ast_data.ast_results && coa.ast_data.ast_results.length > 0) {
              setAstResults(coa.ast_data.ast_results);
            }
            setShowASTTab(true);
          }
        } else {
          // COA doesn't exist yet, initialize with empty data
          initializeTestResults(unitResponse.data);
          // Set technician name from registration form as default "Tested By" and signature for new COA
          const technicianName = unitResponse.data.microbiology_data?.technician_name;
          if (technicianName) {
            setTestedBy(technicianName);
            // Test date is empty by default - user must select it
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
            // Test date is empty by default - user must select it
            try {
              const sigResponse = await apiClient.get(`/controls/signatures/by-name/${encodeURIComponent(user.full_name)}`);
              if (sigResponse.data.signature_image) {
                setTestedBySignatureImage(sigResponse.data.signature_image);
              }
            } catch (sigErr) {
              console.log('No signature found for user:', user.full_name);
            }
          }
        }
      } catch (err: any) {
        // COA doesn't exist yet or error occurred, initialize with empty data
        if (err.response?.status === 404) {
          initializeTestResults(unitResponse.data);
          // Set technician name from registration form as default "Tested By" and signature for new COA
          const technicianName = unitResponse.data.microbiology_data?.technician_name;
          if (technicianName) {
            setTestedBy(technicianName);
            // Test date is empty by default - user must select it
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
            // Test date is empty by default - user must select it
            try {
              const sigResponse = await apiClient.get(`/controls/signatures/by-name/${encodeURIComponent(user.full_name)}`);
              if (sigResponse.data.signature_image) {
                setTestedBySignatureImage(sigResponse.data.signature_image);
              }
            } catch (sigErr) {
              console.log('No signature found for user:', user.full_name);
            }
          }
        } else if (err.response?.status === 401) {
          setError('Your session may have expired. Please refresh the page and try again.');
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      console.error('Failed to load data:', err);
      if (err.response?.status === 401) {
        setError('Your session may have expired. Please refresh the page and try again.');
      } else {
        setError(err.response?.data?.detail || 'Failed to load data');
      }
    } finally {
      setLoading(false);
    }
  }, [unitId, initializeTestResults, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Close context menu when clicking anywhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleFillAll = (type: 'result' | 'portion' | 'isolateType' | 'range' | 'water_tbc' | 'water_coliform' | 'water_ecoli' | 'water_pseudomonas' | 'totalcount_tbc' | 'totalcount_mould' | 'totalcount_fungi', value: string) => {
    if (!unitData || !currentDisease) return;

    if (type === 'result') {
      const newResults = { ...testResults };
      if (!newResults[currentDisease]) {
        newResults[currentDisease] = {};
      }
      unitData.microbiology_data.index_list.forEach(idx => {
        newResults[currentDisease][idx] = value;
      });
      setTestResults(newResults);
    } else if (type === 'portion') {
      const newPortions = { ...testPortions };
      if (!newPortions[currentDisease]) {
        newPortions[currentDisease] = {};
      }
      unitData.microbiology_data.index_list.forEach(idx => {
        newPortions[currentDisease][idx] = value;
      });
      setTestPortions(newPortions);
    } else if (type === 'isolateType') {
      const newIsolateTypes = { ...isolateTypes };
      if (!newIsolateTypes[currentDisease]) {
        newIsolateTypes[currentDisease] = {};
      }
      unitData.microbiology_data.index_list.forEach(idx => {
        newIsolateTypes[currentDisease][idx] = value;
      });
      setIsolateTypes(newIsolateTypes);
    } else if (type === 'range') {
      const newRanges = { ...testRanges };
      if (!newRanges[currentDisease]) {
        newRanges[currentDisease] = {};
      }
      unitData.microbiology_data.index_list.forEach(idx => {
        newRanges[currentDisease][idx] = value;
      });
      setTestRanges(newRanges);
    } else if (type === 'water_tbc') {
      const newResults = { ...testResults };
      if (!newResults[currentDisease]) {
        newResults[currentDisease] = {};
      }
      unitData.microbiology_data.index_list.forEach(idx => {
        newResults[currentDisease][idx] = value;
      });
      setTestResults(newResults);
    } else if (type === 'water_coliform') {
      const newResults = { ...testResults };
      if (!newResults[currentDisease]) {
        newResults[currentDisease] = {};
      }
      unitData.microbiology_data.index_list.forEach(idx => {
        newResults[currentDisease][`${idx}_coliform`] = value;
      });
      setTestResults(newResults);
    } else if (type === 'water_ecoli') {
      const newResults = { ...testResults };
      if (!newResults[currentDisease]) {
        newResults[currentDisease] = {};
      }
      unitData.microbiology_data.index_list.forEach(idx => {
        newResults[currentDisease][`${idx}_ecoli`] = value;
      });
      setTestResults(newResults);
    } else if (type === 'water_pseudomonas') {
      const newResults = { ...testResults };
      if (!newResults[currentDisease]) {
        newResults[currentDisease] = {};
      }
      unitData.microbiology_data.index_list.forEach(idx => {
        newResults[currentDisease][`${idx}_pseudomonas`] = value;
      });
      setTestResults(newResults);
    } else if (type === 'totalcount_tbc') {
      const newResults = { ...testResults };
      if (!newResults[currentDisease]) {
        newResults[currentDisease] = {};
      }
      unitData.microbiology_data.index_list.forEach(idx => {
        newResults[currentDisease][idx] = value;
      });
      setTestResults(newResults);
    } else if (type === 'totalcount_mould') {
      const newResults = { ...testResults };
      if (!newResults[currentDisease]) {
        newResults[currentDisease] = {};
      }
      unitData.microbiology_data.index_list.forEach(idx => {
        newResults[currentDisease][`${idx}_mould`] = value;
      });
      setTestResults(newResults);
    } else if (type === 'totalcount_fungi') {
      const newResults = { ...testResults };
      if (!newResults[currentDisease]) {
        newResults[currentDisease] = {};
      }
      unitData.microbiology_data.index_list.forEach(idx => {
        newResults[currentDisease][`${idx}_fungi`] = value;
      });
      setTestResults(newResults);
    }
    setContextMenu(null);
  };

  const validateMicrobiologyData = () => {
    const errors: string[] = [];
    
    // Validate test_results structure
    if (!testResults || typeof testResults !== 'object') {
      errors.push('Test results are required');
      return errors;
    }
    
    // Check if we have any diseases
    const diseases = Object.keys(testResults);
    if (diseases.length === 0) {
      errors.push('At least one disease test result is required');
      return errors;
    }
    
    // Validate each disease's data structure
    diseases.forEach(disease => {
      const diseaseData = testResults[disease];
      if (!diseaseData || typeof diseaseData !== 'object') {
        errors.push(`Invalid data structure for disease: ${disease}`);
        return;
      }
      
      const indices = Object.keys(diseaseData);
      if (indices.length === 0) {
        errors.push(`No test results found for disease: ${disease}`);
        return;
      }
      
      // Validate each result
      indices.forEach(index => {
        const result = diseaseData[index];
        if (result === null || result === undefined || result === '') {
          errors.push(`Test result is required for ${disease} - ${index}`);
        }
      });
    });
    
    // Validate test_portions if present
    if (testPortions && Object.keys(testPortions).length > 0) {
      Object.keys(testPortions).forEach(disease => {
        const diseasePortions = testPortions[disease];
        if (diseasePortions && typeof diseasePortions === 'object') {
          Object.keys(diseasePortions).forEach(index => {
            const portion = diseasePortions[index];
            if (portion && typeof portion !== 'string') {
              errors.push(`Invalid test portion format for ${disease} - ${index}`);
            }
          });
        }
      });
    }
    
    // Validate test_methods if present
    if (testMethods && Object.keys(testMethods).length > 0) {
      Object.keys(testMethods).forEach(disease => {
        const method = testMethods[disease];
        if (method !== null && method !== undefined && typeof method !== 'string') {
          errors.push(`Invalid test method format for disease: ${disease}`);
        }
      });
    }
    
    // Validate isolate_types if present
    if (isolateTypes && Object.keys(isolateTypes).length > 0) {
      Object.keys(isolateTypes).forEach(disease => {
        const diseaseIsolates = isolateTypes[disease];
        if (diseaseIsolates && typeof diseaseIsolates === 'object') {
          Object.keys(diseaseIsolates).forEach(index => {
            const isolate = diseaseIsolates[index];
            if (isolate && typeof isolate !== 'string') {
              errors.push(`Invalid isolate type format for ${disease} - ${index}`);
            }
          });
        }
      });
    }
    
    // Validate test_ranges if present
    if (testRanges && Object.keys(testRanges).length > 0) {
      Object.keys(testRanges).forEach(disease => {
        const diseaseRanges = testRanges[disease];
        if (diseaseRanges && typeof diseaseRanges === 'object') {
          Object.keys(diseaseRanges).forEach(index => {
            const range = diseaseRanges[index];
            if (range && typeof range !== 'string') {
              errors.push(`Invalid test range format for ${disease} - ${index}`);
            }
          });
        }
      });
    }
    
    return errors;
  };

  const handleSave = async () => {
    if (!unitData) return;

    try {
      setSaving(true);
      setError(null);

      // Validate required fields
      if (!dateTested) {
        setError('Result Date is required. Please select a test date before saving.');
        setSaving(false);
        return;
      }

      // Validate required signature fields
      if (!testedBy) {
        setError('Tested By is required. Please enter the technician PIN.');
        setSaving(false);
        return;
      }

      if (!reviewedBy) {
        setError('Reviewed By (Head Unit) is required. Please enter the reviewer PIN.');
        setSaving(false);
        return;
      }

      if (!labSupervisor) {
        setError('Lab Supervisor is required. Please enter the lab supervisor PIN.');
        setSaving(false);
        return;
      }

      // Validate microbiology data structure
      const validationErrors = validateMicrobiologyData();
      if (validationErrors.length > 0) {
        setError('Data validation failed:\n' + validationErrors.join('\n'));
        setSaving(false);
        return;
      }

      // Check if user is authenticated before proceeding
      const token = localStorage.getItem('token');
      if (!token) {
        setError('You are not authenticated. Please log in again.');
        setSaving(false);
        return;
      }

      // Determine the new status based on user role and current status
      let newStatus = status;
      let newCoaStatus = unitData.coa_status;

      if (user?.role === 'admin' || user?.role === 'manager') {
        // Admin or Manager approves the COA
        newStatus = 'completed';
        newCoaStatus = 'completed';
        
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
      } else {
        // Technician submits for approval
        newStatus = 'need_approval';
        newCoaStatus = 'need_approval';
      }

      // Create a custom apiClient instance for this operation to avoid automatic logout
      const saveApiClient = axios.create({
        baseURL: '/api/v1',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      // Convert hidden indexes Sets to arrays for JSON serialization
      const hiddenIndexesForSave: { [disease: string]: string[] } = {};
      for (const [disease, indexSet] of Object.entries(hiddenIndexes)) {
        hiddenIndexesForSave[disease] = Array.from(indexSet);
      }

      // Prepare AST data if enabled
      const astDataForSave = showASTTab ? {
        bacterial_isolate: astBacterialIsolate,
        organ: astOrgan,
        bacteria_family: astBacteriaFamily,
        include_in_pdf: includeASTInPDF,
        ast_results: astResults,
      } : null;

      // Prepare payload with proper data sanitization
      const sanitizedPayload = {
        test_results: testResults,
        test_portions: testPortions || {},
        test_methods: testMethods || {},
        isolate_types: isolateTypes || {},
        test_ranges: testRanges || {},
        hidden_indexes: hiddenIndexesForSave,
        ast_data: astDataForSave,
        date_tested: dateTested || null,
        tested_by: testedBy || null,
        reviewed_by: reviewedBy || null,
        lab_supervisor: labSupervisor || null,
        lab_manager: labManager || null,
        notes: notes || null,
        status: newStatus,
      };

      if (coaData?.id) {
        // Update existing COA - payload without unit_id
        await saveApiClient.put(`/microbiology-coa/${coaData.id}`, sanitizedPayload);
      } else {
        // Create new COA - payload with unit_id
        const createPayload = {
          unit_id: parseInt(unitId!),
          ...sanitizedPayload,
        };
        await saveApiClient.post('/microbiology-coa/', createPayload);
      }

      // Update unit coa_status
      await saveApiClient.patch(`/units/${unitId}`, { coa_status: newCoaStatus });

      // Update parent sample status only if admin or manager approved
      if ((user?.role === 'admin' || user?.role === 'manager') && newStatus === 'completed') {
        await saveApiClient.patch(`/samples/${unitData.sample.id}`, { status: 'completed' });
      }

      const message = (user?.role === 'admin' || user?.role === 'manager')
        ? 'Certificate of Analysis approved successfully!'
        : 'Certificate of Analysis submitted for approval!';
      setNotification({ type: 'success', message });
      setTimeout(() => navigate('/microbiology/samples'), 1500);
    } catch (err: any) {
      console.error('Failed to save COA:', err);
      
      // Handle different types of errors
      if (err.response?.status === 401) {
        setError('Your session may have expired. Please refresh the page and try again.');
      } else if (err.response?.status === 400) {
        // Handle validation errors from backend
        const backendError = err.response?.data?.detail;
        if (typeof backendError === 'string') {
          setError(`Data validation error: ${backendError}`);
        } else if (Array.isArray(backendError)) {
          setError('Validation errors:\n' + backendError.join('\n'));
        } else {
          setError('Data format is invalid. Please check all fields and try again.');
        }
      } else if (err.response?.status === 422) {
        // Handle Pydantic validation errors
        const validationErrors = err.response?.data?.detail;
        if (Array.isArray(validationErrors)) {
          const errorMessages = validationErrors.map((error: any) => 
            `${error.loc?.join('.')} - ${error.msg}`
          );
          setError('Validation errors:\n' + errorMessages.join('\n'));
        } else {
          setError('Invalid data format. Please check all fields and try again.');
        }
      } else {
        setError(err.response?.data?.detail || 'Failed to save COA');
        setNotification({ type: 'error', message: 'Failed to save Certificate of Analysis. Please check your entries and try again.' });
      }
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

      const token = localStorage.getItem('token');
      if (!token) {
        setError('You are not authenticated. Please log in again.');
        setSaving(false);
        return;
      }

      const saveApiClient = axios.create({
        baseURL: '/api/v1',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const postponePayload = {
        test_results: testResults,
        test_portions: testPortions || {},
        test_methods: testMethods || {},
        isolate_types: isolateTypes || {},
        test_ranges: testRanges || {},
        date_tested: dateTested || null,
        tested_by: testedBy || null,
        reviewed_by: reviewedBy || null,
        lab_supervisor: labSupervisor || null,
        lab_manager: labManager || null,
        notes: notes ? `${notes}\n\nPostponed Reason: ${postponedReason}` : `Postponed Reason: ${postponedReason}`,
        status: 'postponed',
      };

      if (coaData?.id) {
        await saveApiClient.put(`/microbiology-coa/${coaData.id}`, postponePayload);
      } else {
        await saveApiClient.post('/microbiology-coa/', { ...postponePayload, unit_id: parseInt(unitId!) });
      }

      // Update unit coa_status to 'postponed'
      await saveApiClient.patch(`/units/${unitId}`, { coa_status: 'postponed' });

      // Update parent sample status to 'Postponed'
      await saveApiClient.patch(`/samples/${unitData.sample.id}`, { status: 'Postponed' });

      setShowPostponedModal(false);
      setPostponedReason('');
      setNotification({ type: 'success', message: 'Certificate of Analysis postponed successfully!' });
      setTimeout(() => navigate('/microbiology/samples'), 1500);
    } catch (err: any) {
      console.error('Failed to postpone COA:', err);
      setError(err.response?.data?.detail || 'Failed to postpone COA');
      setNotification({ type: 'error', message: 'Failed to postpone Certificate of Analysis. Please try again.' });
    } finally {
      setSaving(false);
    }
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

  const generatePDFTemplate = () => {
    if (!unitData || !unitData.sample) return '';

    const diseases = unitData.microbiology_data?.diseases_list || [];
    const indexList = unitData.microbiology_data?.index_list || [];
    const sampleTypes = unitData.sample_type || [];

    // Generate disease-specific report numbers directly in PDF template
    // This ensures correct codes like CU25-1, FUNGI25-1, SALM25-1, WATER25-1, COUNT25-1
    const unitCode = unitData.unit_code || '';
    // Extract sequence number from unit code (e.g., MIC-1 -> 1, or MIC25-1 -> 1)
    const seqMatch = unitCode.match(/MIC\d*-(\d+)/i);
    const seqNum = seqMatch ? seqMatch[1] : '';
    // Get year from sample's date_received (e.g., 2025 -> 25)
    const dateReceived = unitData.sample?.date_received;
    const yearNum = dateReceived ? String(new Date(dateReceived).getFullYear()).slice(-2) : String(new Date().getFullYear()).slice(-2);
    
    const getDiseaseReportNumber = (disease: string): string => {
      const lowerDisease = disease.toLowerCase();
      if (seqNum) {
        if (lowerDisease.includes('culture') || lowerDisease.includes('isolation')) {
          return `CU${yearNum}-${seqNum}`;
        } else if (lowerDisease.includes('fungi') || lowerDisease.includes('mold') || lowerDisease.includes('mould')) {
          return `FUNGI${yearNum}-${seqNum}`;
        } else if (lowerDisease.includes('salmonella')) {
          return `SALM${yearNum}-${seqNum}`;
        } else if (lowerDisease.includes('water')) {
          return `WATER${yearNum}-${seqNum}`;
        } else if (lowerDisease.includes('total count')) {
          return `COUNT${yearNum}-${seqNum}`;
        } else if (lowerDisease === 'ast') {
          return `AST${yearNum}-${seqNum}`;
        }
      }
      return unitCode;
    };
    
    // Get AST report number
    const getASTReportNumber = (): string => {
      if (seqNum) {
        return `AST${yearNum}-${seqNum}`;
      }
      return `${unitCode}-AST`;
    };

    // Smart sizing based on content amount - optimized for A4 page fitting
    const rowCount = indexList.length;

    // Calculate scale factor based on table size
    let scaleFactor = 1.0;
    if (rowCount <= 10) {
      scaleFactor = 1.0;
    } else if (rowCount <= 15) {
      scaleFactor = 0.95;
    } else if (rowCount <= 20) {
      scaleFactor = 0.9;
    } else if (rowCount <= 23) {
      scaleFactor = 0.85;
    } else {
      scaleFactor = 0.85;
    }

    const isCompactMode = rowCount > 15;

    // Generate pages for each disease with pagination (max 30 rows per page)
    // Helper function to parse numeric value from result string
    const parseNumericValue = (value: string): number | null => {
      if (!value || value === '-' || value === '' || value === '-------') return null;
      const upper = value.toUpperCase().trim();
      if (upper.includes('LESS THAN')) {
        const match = upper.match(/LESS\s*THAN\s*(\d+)/i);
        if (match) return parseFloat(match[1]) - 1;
        return 0;
      }
      const sciMatch = value.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*10\s*[\^]?\s*(\d+)/i);
      if (sciMatch) {
        return parseFloat(sciMatch[1]) * Math.pow(10, parseInt(sciMatch[2]));
      }
      const numMatch = value.match(/(\d+(?:\.\d+)?)/);
      if (numMatch) return parseFloat(numMatch[1]);
      return null;
    };

    // Helper function to format number as scientific notation with superscript (e.g., 6453 → 6.5×10³)
    const formatScientificNotation = (value: string): string => {
      const num = parseNumericValue(value);
      if (num === null || num < 10) return value;
      const superscripts: Record<string, string> = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
        '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
      };
      const exponent = Math.floor(Math.log10(num));
      const mantissa = num / Math.pow(10, exponent);
      const roundedMantissa = Math.round(mantissa * 10) / 10;
      const superscriptExp = exponent.toString().split('').map(d => superscripts[d] || d).join('');
      return `${roundedMantissa}×10${superscriptExp}`;
    };

    // Helper function to determine background color based on result value
    const getResultStyle = (value: string, diseaseType?: string, isFeedSample?: boolean) => {
      const upperValue = value.toUpperCase().trim();
      const isNotDetected = upperValue === 'NOT DETECTED' || upperValue.includes('LESS THAN') || upperValue.includes('NO BACTERIAL') || upperValue.includes('NO COLIFORM') || upperValue.includes('NO FUNGAL');
      const isDetected = upperValue === 'DETECTED' || upperValue === 'POSITIVE' || upperValue === 'POS';
      
      // For Total Count - check numeric limits
      if (diseaseType === 'totalcount') {
        const num = parseNumericValue(value);
        if (num !== null) {
          const limit = isFeedSample ? 100000 : 1000; // 10^5 for FEED, 10^3 for others
          if (num >= limit) {
            return 'background-color: #f8d7da !important; color: #721c24; -webkit-print-color-adjust: exact; print-color-adjust: exact;';
          } else {
            return 'background-color: #d4edda !important; color: #155724; -webkit-print-color-adjust: exact; print-color-adjust: exact;';
          }
        }
      }
      
      // For Water - check numeric limits
      if (diseaseType === 'water_tbc') {
        const num = parseNumericValue(value);
        if (num !== null) {
          if (num > 56) {
            return 'background-color: #f8d7da !important; color: #721c24; -webkit-print-color-adjust: exact; print-color-adjust: exact;';
          } else {
            return 'background-color: #d4edda !important; color: #155724; -webkit-print-color-adjust: exact; print-color-adjust: exact;';
          }
        }
      }
      
      if (diseaseType === 'water_other') {
        const num = parseNumericValue(value);
        if (num !== null) {
          if (num > 1) {
            return 'background-color: #f8d7da !important; color: #721c24; -webkit-print-color-adjust: exact; print-color-adjust: exact;';
          } else {
            return 'background-color: #d4edda !important; color: #155724; -webkit-print-color-adjust: exact; print-color-adjust: exact;';
          }
        }
      }
      
      if (isNotDetected) {
        return 'background-color: #d4edda !important; color: #155724; -webkit-print-color-adjust: exact; print-color-adjust: exact;';
      } else if (isDetected) {
        return 'background-color: #f8d7da !important; color: #721c24; -webkit-print-color-adjust: exact; print-color-adjust: exact;';
      }
      return '';
    };

    const generatePagesForDisease = (disease: string, diseaseTotalPages: number) => {
      const isSalmonella = disease.toLowerCase().includes('salmonella');
      const isTotalCount = disease.toLowerCase().includes('total count');
      const isWater = disease.toLowerCase().includes('water');
      const isFeedSample = sampleTypes.some((t: string) => t.toLowerCase().includes('feed'));
      // Filter out hidden indexes for this disease - they should not appear in PDF
      const visibleIndexList = indexList.filter((index: string) => !hiddenIndexes[disease]?.has(index));
      
      // Smart pagination: Calculate available rows based on page content
      // Each A4 page can fit approximately 45 rows at normal scale
      // Footer elements take approximately: QC table ~8 rows, signatures ~6 rows, warnings ~3 rows, total label ~1 row
      const maxRowsPerPage = 45; // Maximum rows per page at normal scale
      const hasQCTable = isTotalCount || isWater;
      
      // Calculate footer space needed (in row equivalents)
      const footerRowsNeeded = 1 + // Total samples label
        (hasQCTable ? 8 : 0) + // QC table if needed
        6 + // Signatures section
        3 + // Warnings section
        1;  // Page number margin
      
      // Last page can have fewer rows to accommodate footer
      const maxRowsOnLastPage = maxRowsPerPage - footerRowsNeeded;
      
      // Calculate total pages needed with smart distribution
      const calculatePages = () => {
        const totalSamples = visibleIndexList.length;
        
        // If all samples + footer fit on one page
        if (totalSamples <= maxRowsOnLastPage) {
          return 1;
        }
        
        // Calculate how many full pages we need
        // First pages get maxRowsPerPage, last page gets remaining + footer
        let remainingSamples = totalSamples;
        let pagesNeeded = 0;
        
        while (remainingSamples > 0) {
          pagesNeeded++;
          // Check if remaining samples can fit on this page with footer
          if (remainingSamples <= maxRowsOnLastPage) {
            break; // This is the last page
          }
          // This is not the last page, so it can have max rows
          remainingSamples -= maxRowsPerPage;
        }
        
        return pagesNeeded;
      };
      
      const totalPagesForDisease = calculatePages();
      const pages = [];

      // Smart row distribution across pages
      let processedRows = 0;
      for (let page = 0; page < totalPagesForDisease; page++) {
        const isLastPage = page === totalPagesForDisease - 1;
        
        // Determine max rows for this page
        let maxRowsThisPage: number;
        if (isLastPage) {
          // Last page needs space for footer elements (signatures, warnings, QC table)
          maxRowsThisPage = maxRowsOnLastPage;
        } else {
          // Non-last pages can have full rows
          maxRowsThisPage = maxRowsPerPage;
        }
        
        const startIdx = processedRows;
        const endIdx = Math.min(startIdx + maxRowsThisPage, visibleIndexList.length);
        const pageIndices = visibleIndexList.slice(startIdx, endIdx);
        processedRows = endIdx;
        const currentPageNumber = page + 1; // Page number within this disease (1-indexed)

        // Generate table rows for this specific page
        const tableRows = pageIndices.map((index, idx) => {
          const actualIdx = startIdx + idx;
          const isSalmonella = disease.toLowerCase().includes('salmonella');
          const isTotalCount = disease.toLowerCase().includes('total count');
          const isWaterRow = disease.toLowerCase().includes('water');

          let result = '';
          let mouldResult = '';
          let fungiResult = '';
          let coliformResult = '';
          let ecoliResult = '';
          let pseudomonasResult = '';

          if (isTotalCount) {
            result = testResults[disease]?.[index] || 'Less than 10 CFU';
            mouldResult = testResults[disease]?.[`${index}_mould`] || 'Less than 10 CFU';
            fungiResult = testResults[disease]?.[`${index}_fungi`] || '-------';
          } else if (isWaterRow) {
            result = testResults[disease]?.[index] || 'Less than 1 CFU';
            coliformResult = testResults[disease]?.[`${index}_coliform`] || 'Less than 1 CFU';
            ecoliResult = testResults[disease]?.[`${index}_ecoli`] || 'Less than 1 CFU';
            pseudomonasResult = testResults[disease]?.[`${index}_pseudomonas`] || 'Less than 1 CFU';
          } else {
            result = testResults[disease]?.[index] || (
              isSalmonella ? 'Not Detected' :
                disease.toLowerCase().includes('culture') ? 'No bacterial growth' :
                  ''
            );
          }

          const portion = testPortions[disease]?.[index] || 'per25g';
          const isolateType = isolateTypes[disease]?.[index] || 'Not Detected';
          const range = testRanges[disease]?.[index] || '-------';

          if (isTotalCount) {
            // Format as scientific notation and apply limit-based color coding
            const formattedResult = formatScientificNotation(result);
            const formattedMould = formatScientificNotation(mouldResult);
            return `
              <tr>
                <td>${actualIdx + 1}</td>
                <td>${escapeHtml(index)}</td>
                <td style="font-weight: 600; ${getResultStyle(result, 'totalcount', isFeedSample)}">${escapeHtml(formattedResult)}</td>
                <td style="font-weight: 600; ${getResultStyle(mouldResult, 'totalcount', isFeedSample)}">${escapeHtml(formattedMould)}</td>
                <td style="font-weight: 600;">${escapeHtml(fungiResult)}</td>
              </tr>
            `;
          }

          if (isWaterRow) {
            return `
              <tr>
                <td>${actualIdx + 1}</td>
                <td>${escapeHtml(index)}</td>
                <td style="font-weight: 600; ${getResultStyle(result, 'water_tbc')}">${escapeHtml(result)}</td>
                <td style="font-weight: 600; ${getResultStyle(coliformResult, 'water_other')}">${escapeHtml(coliformResult)}</td>
                <td style="font-weight: 600; ${getResultStyle(ecoliResult, 'water_other')}">${escapeHtml(ecoliResult)}</td>
                <td style="font-weight: 600; ${getResultStyle(pseudomonasResult, 'water_other')}">${escapeHtml(pseudomonasResult)}</td>
              </tr>
            `;
          }

          return `
            <tr>
              <td>${actualIdx + 1}</td>
              <td>${escapeHtml(index)}</td>
              <td style="font-weight: 600; ${getResultStyle(result)}">${escapeHtml(result)}</td>
              ${!isSalmonella ? `<td>${escapeHtml(isolateType)}</td>` : ''}
              ${!isSalmonella ? `<td>${escapeHtml(range)}</td>` : ''}
              ${isSalmonella ? `<td>${escapeHtml(portion)}</td>` : ''}
            </tr>
          `;
        }).join('');

        // Add page continuation info if not the first page
        const pageHeader = page > 0 ?
          `<div style="text-align: center; font-size: 12px; font-weight: bold; color: #6b7280; margin-bottom: 8px;">${disease} (Continued)</div>` : '';

        pages.push(`
  <div class="page" style="page-break-after: ${!isLastPage ? 'always' : 'auto'};">
    <header class="header">
      <img src="${window.location.origin}/assets/logo.png" alt="Logo" class="logo">
      <div class="lab-meta">
        <div class="lab-name">SAMA KARBALA CO. - Central Poultry Laboratories</div>
        <div style="text-align: center; font-size: 22px; font-weight: 900; color: #000000; margin-top: 6px;">Certificate of Analysis</div>
      </div>
      <div class="coa-badge">
        <div class="badge-label">Test Report No.:</div>
        <div style="font-size: 10px;" class="badge-value">${escapeHtml(getDiseaseReportNumber(disease))}</div>
      </div>
    </header>

    ${page > 0 ? pageHeader : `
    <section class="info-block">
      <h2>Sample Information</h2>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px">
        <div class="info-grid">
          <div class="info-label">Sample Code:</div><div class="info-value">${escapeHtml(unitData.sample.sample_code)}</div>
          <div class="info-label">Date Received:</div><div class="info-value">${unitData.sample.date_received ? new Date(unitData.sample.date_received).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'N/A'}</div>
          <div class="info-label">Company:</div><div class="info-value">${escapeHtml(unitData.sample.company)}</div>
          <div class="info-label">Flock:</div><div class="info-value">${escapeHtml(unitData.sample.flock || 'N/A')}</div>
          <div class="info-label">House:</div><div class="info-value">${escapeHtml(unitData.house?.join(', ') || 'N/A')}</div>
          <div class="info-label">Sample Types:</div><div class="info-value">${escapeHtml(sampleTypes.join(', '))}</div>
          ${unitData.microbiology_data?.batch_no ? `<div class="info-label">Batch No:</div><div class="info-value">${escapeHtml(unitData.microbiology_data.batch_no)}</div>` : ''}
        </div>
        <div class="info-grid">
          <div class="info-label">Unit Code:</div><div class="info-value">${escapeHtml(unitData.unit_code)}</div>
          <div class="info-label">Test Date:</div><div class="info-value">${dateTested ? new Date(dateTested).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'N/A'}</div>
          <div class="info-label">Farm:</div><div class="info-value">${escapeHtml(unitData.sample.farm)}</div>
          <div class="info-label">Cycle:</div><div class="info-value">${escapeHtml(unitData.sample.cycle || 'N/A')}</div>
          <div class="info-label">Age:</div><div class="info-value">${escapeHtml(unitData.age || 'N/A')}</div>
          <div class="info-label">Source:</div><div class="info-value">${escapeHtml(unitData.source || 'N/A')}</div>
          ${unitData.microbiology_data?.fumigation ? `<div class="info-label">Fumigation:</div><div class="info-value">${escapeHtml(unitData.microbiology_data.fumigation)}</div>` : ''}
        </div>
      </div>
    </section>`}

    <section class="section">
          <h1>${page > 0 ? disease : `${disease}`}</h1>
          <div style="margin-top:${2 * scaleFactor}px; margin-bottom:${2 * scaleFactor}px; font-size:${9 * scaleFactor}px">
            <strong>Test Method:</strong> ${escapeHtml(testMethods[disease] || 'N/A')}
          </div>
      
      <table>
        <thead>
          <tr>
            <th style="width:10%">Sample No.</th>
            <th style="width:${isSalmonella ? '40%' : (isTotalCount ? '30%' : isWater ? '20%' : '40%')}">Sample Index</th>
            ${isTotalCount ? `
              <th style="width:20%">Total Bacterial Count <br /> CFU / PLATE / 100 CM</th>
              <th style="width:20%">Total Mold and Yeast Count <br /> CFU/PLATE/100 CM</th>
              <th style="width:20%">Pathogenic Mold & Yeast</th>
            ` : isWater ? `
              <th style="width:15%">Total Bacterial Count<br />CFU / 100 ml</th>
              <th style="width:15%">Total Coliform Count<br />CFU / 100 ml</th>
              <th style="width:15%">Total E-Coli Count<br />CFU / 100 ml</th>
              <th style="width:15%">Total Pseudomonas Aeruginosa Count<br />CFU / 100 ml</th>
            ` : `
              <th style="width:${isSalmonella ? '30%' : '20%'}">Result</th>
              ${!isSalmonella ? '<th style="width:20%">Type of isolate</th>' : ''}
              ${!isSalmonella ? '<th style="width:20%">Range</th>' : ''}
              ${isSalmonella ? '<th style="width:20%">Test Portion</th>' : ''}
            `}
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <div class="footnote">
        ${page === totalPagesForDisease - 1 ? `
          <div style="margin-top:3px"><strong>Total Samples:</strong> ${visibleIndexList.length}</div>
        ` : ''}
        ${page === totalPagesForDisease - 1 && (disease.toLowerCase().includes('culture') || disease.toLowerCase().includes('isolation')) && cultureScreenedPathogens.length > 0 ? `
          <div style="margin-top:3px"><strong>Screened Pathogens:</strong> ${cultureScreenedPathogens.map((p: any) => p.name).join(', ')}</div>
        ` : ''}
        ${notes ? `<div style="margin-top:3px"><strong>Notes:</strong> ${escapeHtml(notes)}</div>` : ''}
      </div>
      
      ${page === totalPagesForDisease - 1 && isTotalCount ? `
      <div class="qc-table" style="margin-top: 4px;">
        ${sampleTypes.some((t: string) => t.toLowerCase().includes('feed')) ? `
        <div style="font-weight: 700; font-size: 8px; margin-bottom: 2px;">Feed safety limits for the animal feed, EU</div>
        <table style="width: 50%; border-collapse: collapse; font-size: 7px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="border: 1px solid #d1d5db; padding: 1px 2px;">Contaminant</th>
              <th style="border: 1px solid #d1d5db; padding: 1px 2px;">action limit</th>
              <th style="border: 1px solid #d1d5db; padding: 1px 2px;">rejection limit</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="border: 1px solid #d1d5db; padding: 1px;">Total bacterial count</td><td style="border: 1px solid #d1d5db; padding: 1px; text-align: center;">10⁴ cfu/g</td><td style="border: 1px solid #d1d5db; padding: 1px; text-align: center;">&gt;10⁵ cfu/g</td></tr>
            <tr><td style="border: 1px solid #d1d5db; padding: 1px;">Yeast & mould</td><td style="border: 1px solid #d1d5db; padding: 1px; text-align: center;">10³ cfu/g</td><td style="border: 1px solid #d1d5db; padding: 1px; text-align: center;">&gt;10⁴ cfu/g</td></tr>
            <tr><td style="border: 1px solid #d1d5db; padding: 1px;">Aspergeilus or Fusarium</td><td style="border: 1px solid #d1d5db; padding: 1px; text-align: center;"></td><td style="border: 1px solid #d1d5db; padding: 1px; text-align: center;">&gt; 100 cfu/g</td></tr>
          </tbody>
        </table>
        ` : `
        <div style="font-weight: 700; font-size: 8px; margin-bottom: 2px;">Reading of plates quality control</div>
        <table style="width: 50%; border-collapse: collapse; font-size: 7px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="border: 1px solid #d1d5db; padding: 1px 2px;">bacteria</th>
              <th style="border: 1px solid #d1d5db; padding: 1px 2px;">score</th>
              <th style="border: 1px solid #d1d5db; padding: 1px 2px;">fungi/asprigillus</th>
              <th style="border: 1px solid #d1d5db; padding: 1px 2px;">Rating</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="border: 1px solid #d1d5db; padding: 1px;">Less than -10 CFU</td><td style="border: 1px solid #d1d5db; padding: 1px; text-align: center;">0</td><td style="border: 1px solid #d1d5db; padding: 1px;">no fungal growth</td><td style="border: 1px solid #d1d5db; padding: 1px;">excellent</td></tr>
            <tr><td style="border: 1px solid #d1d5db; padding: 1px;">11-40 CFU</td><td style="border: 1px solid #d1d5db; padding: 1px; text-align: center;">1</td><td style="border: 1px solid #d1d5db; padding: 1px;">10-20 CFU</td><td style="border: 1px solid #d1d5db; padding: 1px;">very good</td></tr>
            <tr><td style="border: 1px solid #d1d5db; padding: 1px;">more than 40</td><td style="border: 1px solid #d1d5db; padding: 1px; text-align: center;">2</td><td style="border: 1px solid #d1d5db; padding: 1px;">30-50 CFU</td><td style="border: 1px solid #d1d5db; padding: 1px;">good</td></tr>
            <tr><td style="border: 1px solid #d1d5db; padding: 1px;">more than 10³</td><td style="border: 1px solid #d1d5db; padding: 1px; text-align: center;">3</td><td style="border: 1px solid #d1d5db; padding: 1px;">more than 50</td><td style="border: 1px solid #d1d5db; padding: 1px;">Poor</td></tr>
          </tbody>
        </table>
        <div style="font-size: 7px; color: #6b7280; margin-top: 1px;">*TNTC = too numerous to count</div>
        `}
      </div>
      ` : ''}
      
      ${page === totalPagesForDisease - 1 && isWater ? `
      <div class="qc-table" style="margin-top: 4px;">
        <div style="font-weight: 700; font-size: 8px; margin-bottom: 2px;">Reading of plates quality control</div>
        <table style="width: 50%; border-collapse: collapse; font-size: 7px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="border: 1px solid #d1d5db; padding: 1px 2px;">TBC / 100 ml</th>
              <th style="border: 1px solid #d1d5db; padding: 1px 2px;">score</th>
              <th style="border: 1px solid #d1d5db; padding: 1px 2px;">T. COLIFORM / 100 ml</th>
              <th style="border: 1px solid #d1d5db; padding: 1px 2px;">Rating</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="border: 1px solid #d1d5db; padding: 1px;">no bacterial growth</td><td style="border: 1px solid #d1d5db; padding: 1px; text-align: center;">0</td><td style="border: 1px solid #d1d5db; padding: 1px;">no coliform growth</td><td style="border: 1px solid #d1d5db; padding: 1px;">excellent</td></tr>
            <tr><td style="border: 1px solid #d1d5db; padding: 1px;">56</td><td style="border: 1px solid #d1d5db; padding: 1px; text-align: center;">1</td><td style="border: 1px solid #d1d5db; padding: 1px;">1</td><td style="border: 1px solid #d1d5db; padding: 1px;">good</td></tr>
            <tr><td style="border: 1px solid #d1d5db; padding: 1px;">>56</td><td style="border: 1px solid #d1d5db; padding: 1px; text-align: center;">2</td><td style="border: 1px solid #d1d5db; padding: 1px;">>1</td><td style="border: 1px solid #d1d5db; padding: 1px;">Poor</td></tr>
          </tbody>
        </table>
        <div style="font-size: 7px; color: #6b7280; margin-top: 1px;">*TNTC = too numerous to count</div>
      </div>
      ` : ''}
    </section>

    ${page === totalPagesForDisease - 1 ? `
    <section class="section">
      <h3>Electronic Signatures</h3>
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

    <section class="section warning-section">
      <div>
        <div style="margin-bottom:${isCompactMode ? '2px' : '4px'}; font-weight:700">Warning:</div>
        <div class="muted">• This Certificate is not accredited unless it is stamped or signed.</div>
        <div class="muted">• The result represents tested samples only.</div>
        <div class="muted">• Any Abrasion or change revokes this certificate.</div>
        <div class="muted" style="margin-bottom:${isCompactMode ? '2px' : '5px'}">• The laboratory results contained in this report are considered confidential between the company and clients, and should not be shared or disclosed unless required by law without the client's consent.</div>
        <div style="margin-top:${isCompactMode ? '2px' : '4px'}; font-weight:700">CONFIDENTIAL: <span class="muted" style="font-weight:400">Use or transcription of this document® is prohibited unless written authentication granted by Sama Karbala For Agriculture & Animal Production. © ${new Date().getFullYear()} All rights reserved.</span></div>
      </div>
    </section>` : ''}

    <!-- Page Footer with Disease-specific Pagination -->
    <div style="position: absolute; bottom: 15px; left: 0; right: 0; text-align: center; font-size: ${9 * scaleFactor}px; color: #6b7280; font-weight: 600;">
      ${disease} - Page ${currentPageNumber} of ${diseaseTotalPages}
    </div>
  </div>
        `);
      }

      return pages;
    };

    // Calculate total pages needed with smart pagination (45 rows max per page, fewer on last page for footer)
    let totalPagesNeeded = 0;
    const maxRowsPerPageCalc = 45;
    
    diseases.forEach((disease) => {
      const isTotalCountCalc = disease.toLowerCase().includes('total count');
      const isWaterCalc = disease.toLowerCase().includes('water');
      const hasQCTableCalc = isTotalCountCalc || isWaterCalc;
      // Footer space: total label (1) + QC table (8 if present) + signatures (6) + warnings (3) + margin (1)
      const footerRowsCalc = 1 + (hasQCTableCalc ? 8 : 0) + 6 + 3 + 1;
      const maxRowsOnLastPageCalc = maxRowsPerPageCalc - footerRowsCalc;
      
      const visibleCount = indexList.filter((idx: string) => !hiddenIndexes[disease]?.has(idx)).length;
      
      if (visibleCount <= maxRowsOnLastPageCalc) {
        totalPagesNeeded += 1;
      } else {
        // Calculate pages needed
        let remaining = visibleCount;
        let pages = 0;
        while (remaining > 0) {
          pages++;
          if (remaining <= maxRowsOnLastPageCalc) break;
          remaining -= maxRowsPerPageCalc;
        }
        totalPagesNeeded += pages;
      }
    });

    // Calculate pages per disease for disease-specific pagination
    const calculatePagesForDisease = (disease: string): number => {
      const isTotalCountCalc = disease.toLowerCase().includes('total count');
      const isWaterCalc = disease.toLowerCase().includes('water');
      const hasQCTableCalc = isTotalCountCalc || isWaterCalc;
      const footerRowsCalc = 1 + (hasQCTableCalc ? 8 : 0) + 6 + 3 + 1;
      const maxRowsOnLastPageCalc = maxRowsPerPageCalc - footerRowsCalc;
      
      const visibleCount = indexList.filter((idx: string) => !hiddenIndexes[disease]?.has(idx)).length;
      
      if (visibleCount <= maxRowsOnLastPageCalc) {
        return 1;
      } else {
        let remaining = visibleCount;
        let pages = 0;
        while (remaining > 0) {
          pages++;
          if (remaining <= maxRowsOnLastPageCalc) break;
          remaining -= maxRowsPerPageCalc;
        }
        return pages;
      }
    };

    // Generate all pages with disease-specific pagination
    let allPages: string[] = [];

    diseases.forEach((disease) => {
      const diseaseTotalPages = calculatePagesForDisease(disease);
      const diseasePages = generatePagesForDisease(disease, diseaseTotalPages);
      allPages = allPages.concat(diseasePages);
    });

    // Generate AST pages with pagination if checkbox is checked and AST data has entries with interpretation OR MIC values
    if (includeASTInPDF && astResults.some(r => r.interpretation || r.mic)) {
      const filteredAstResults = astResults.filter(r => r.interpretation || r.mic);
      const astRowsPerPage = 25; // Maximum rows per page for AST
      const astRowsPerLastPage = 18; // Fewer rows on last page to fit footer elements
      
      // Calculate total AST pages needed
      const totalAstResults = filteredAstResults.length;
      let astTotalPages = 1;
      if (totalAstResults > astRowsPerLastPage) {
        let remaining = totalAstResults;
        astTotalPages = 0;
        while (remaining > 0) {
          astTotalPages++;
          if (remaining <= astRowsPerLastPage) break;
          remaining -= astRowsPerPage;
        }
      }

      // Generate each AST page
      for (let astPageNum = 0; astPageNum < astTotalPages; astPageNum++) {
        const isFirstAstPage = astPageNum === 0;
        const isLastAstPage = astPageNum === astTotalPages - 1;
        
        // Calculate which rows to show on this page
        let startIdx = 0;
        for (let p = 0; p < astPageNum; p++) {
          startIdx += astRowsPerPage;
        }
        const maxRowsThisPage = isLastAstPage ? astRowsPerLastPage : astRowsPerPage;
        const endIdx = Math.min(startIdx + maxRowsThisPage, totalAstResults);
        const pageResults = filteredAstResults.slice(startIdx, endIdx);

        const astPage = `
        <div class="page">
          <header class="header">
            <img src="${window.location.origin}/assets/logo.png" alt="Lab Logo" class="logo" onerror="this.style.display='none'" />
            <div style="text-align: center; flex: 1;">
              <div class="lab-name">SAMA KARBALA CO. - Central Poultry Laboratories</div>
              <div class="coa-title">Certificate of Analysis</div>
            </div>
            <div class="coa-badge">
              <div class="badge-label">Test Report No.:</div>
              <div style="font-size: 12px; font-weight: bold;" class="badge-value">${escapeHtml(getASTReportNumber())}</div>
            </div>
          </header>

          ${isFirstAstPage ? `
          <div class="info-block">
            <h2>Sample Information</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; font-size: 10px;">
              <div style="display: grid; grid-template-columns: auto 1fr; gap: 2px 8px;">
                <span class="info-label">Sample Code:</span><span class="info-value">${escapeHtml(unitData.sample.sample_code)}</span>
                <span class="info-label">Date Received:</span><span class="info-value">${new Date(unitData.sample.date_received).toLocaleDateString()}</span>
                <span class="info-label">Company:</span><span class="info-value">${escapeHtml(unitData.sample.company)}</span>
                <span class="info-label">Flock:</span><span class="info-value">${escapeHtml(unitData.sample.flock || 'N/A')}</span>
                <span class="info-label">House:</span><span class="info-value">${escapeHtml((unitData.house || []).join(', ') || 'N/A')}</span>
                <span class="info-label">Sample Types:</span><span class="info-value">${escapeHtml((unitData.sample_type || []).join(', ') || '-')}</span>
              </div>
              <div style="display: grid; grid-template-columns: auto 1fr; gap: 2px 8px;">
                <span class="info-label">Unit Code:</span><span class="info-value">${escapeHtml(unitData.unit_code)}</span>
                <span class="info-label">Test Date:</span><span class="info-value">${dateTested ? new Date(dateTested).toLocaleDateString() : '-'}</span>
                <span class="info-label">Farm:</span><span class="info-value">${escapeHtml(unitData.sample.farm)}</span>
                <span class="info-label">Cycle:</span><span class="info-value">${escapeHtml(unitData.sample.cycle || 'N/A')}</span>
                <span class="info-label">Age:</span><span class="info-value">${escapeHtml(unitData.age || '-')}</span>
                <span class="info-label">Source:</span><span class="info-value">${escapeHtml(unitData.source || 'N/A')}</span>
              </div>
            </div>
          </div>
          ` : ''}

          <div class="section">
            ${isFirstAstPage ? `
            <div style="font-size: 9px; font-weight: 700; margin-bottom: 8px;">
              Test Method: CLSI M100 Performance Standards for Antimicrobial Susceptibility Testing, 36th Edition 2026.
            </div>
            
            <div style="margin-bottom: 10px; font-size: 10px;">
              <strong>Bacterial Isolate:</strong> ${escapeHtml(astBacterialIsolate || '-')}
              &nbsp;&nbsp;&nbsp;&nbsp;
              <strong>Organ:</strong> ${escapeHtml(astOrgan || '-')}
            </div>

            <h1 style="text-align: center; font-size: 14px; margin-bottom: 8px;">Antimicrobial Susceptibility Testing Results</h1>
            ` : `
            <div style="font-size: 9px; font-weight: 600; margin-bottom: 8px; color: #6b7280;">
              AST Results (continued) - Page ${astPageNum + 1} of ${astTotalPages}
            </div>
            `}
            
            <table>
              <thead>
                <tr>
                  <th rowspan="2" style="text-align: left; width: 35%;">AST Disk</th>
                  <th rowspan="2" style="width: 10%;">Result</th>
                  <th rowspan="2" style="width: 15%;">Interpretation</th>
                  <th colspan="3" style="width: 30%;">${escapeHtml(astBacteriaFamily)}</th>
                </tr>
                <tr>
                  <th style="color: #dc2626;">R</th>
                  <th style="color: #ca8a04;">I</th>
                  <th style="color: #16a34a;">S</th>
                </tr>
              </thead>
              <tbody>
                ${pageResults.map((result, idx) => {
                  let interpColor = '';
                  let interpText = result.interpretation || '-';
                  if (result.interpretation === 'Resistant') { interpColor = 'color: #dc2626; font-weight: bold;'; }
                  else if (result.interpretation === 'Sensitive') { interpColor = 'color: #16a34a; font-weight: bold;'; }
                  else if (result.interpretation === 'Intermediate') { interpColor = 'color: #ca8a04; font-weight: bold;'; }
                  return `
                    <tr style="background: ${(startIdx + idx) % 2 === 0 ? '#fff' : '#f9fafb'};">
                      <td style="text-align: left;">${escapeHtml(result.disk)}</td>
                      <td>${escapeHtml(result.mic || '-')}</td>
                      <td style="${interpColor}">${interpText}</td>
                      <td style="color: #dc2626;">${escapeHtml(result.r || '-')}</td>
                      <td style="color: #ca8a04;">${escapeHtml(result.i || '-')}</td>
                      <td style="color: #16a34a;">${escapeHtml(result.s || '-')}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          ${isLastAstPage ? `
          <div class="signatures">
            <div class="sign-card">
              <span class="sign-role">Tested By</span>
              <div class="sign-image-container">
                ${testedBySignatureImage ? `<img src="${testedBySignatureImage}" alt="Signature" class="sign-image"/>` : '<div class="sign-placeholder"></div>'}
              </div>
              <div class="sign-info">${escapeHtml(testedBy || '')}</div>
            </div>
            <div class="sign-card">
              <span class="sign-role">Reviewed By</span>
              <div class="sign-image-container">
                ${reviewedBySignatureImage ? `<img src="${reviewedBySignatureImage}" alt="Signature" class="sign-image"/>` : '<div class="sign-placeholder"></div>'}
              </div>
              <div class="sign-info">${escapeHtml(reviewedBy || '')}</div>
            </div>
            <div class="sign-card">
              <span class="sign-role">Lab Supervisor</span>
              <div class="sign-image-container">
                ${labSupervisorSignatureImage ? `<img src="${labSupervisorSignatureImage}" alt="Signature" class="sign-image"/>` : '<div class="sign-placeholder"></div>'}
              </div>
              <div class="sign-info">${escapeHtml(labSupervisor || '')}</div>
            </div>
            <div class="sign-card">
              <span class="sign-role">Lab Manager</span>
              <div class="sign-image-container">
                ${labManagerSignatureImage ? `<img src="${labManagerSignatureImage}" alt="Signature" class="sign-image"/>` : '<div class="sign-placeholder"></div>'}
              </div>
              <div class="sign-info">${escapeHtml(labManager || '')}</div>
            </div>
          </div>

          <div class="warning-section">
            <div class="muted" style="margin-top: 6px;">
            
              <div>R = Resistant | I = Intermediate | S = Sensitive</div>
            </div>
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #e5e7eb;">
              <div style="font-size: 7px; color: #374151; margin-bottom: 4px;"><strong>Warning:</strong></div>
              <div style="font-size: 7px; color: #374151; margin-bottom: 2px;">• This Certificate is not accredited unless it is stamped or signed.</div>
              <div style="font-size: 7px; color: #374151; margin-bottom: 2px;">• The result represents tested samples only.</div>
              <div style="font-size: 7px; color: #374151; margin-bottom: 2px;">• Any Abrasion or change revokes this certificate.</div>
              <div style="font-size: 7px; color: #374151; margin-bottom: 4px;">• The laboratory results contained in this report are considered confidential between the company and clients, and should not be shared or disclosed unless required by law without the client's consent.</div>
              <div style="font-size: 7px; color: #374151; font-weight: bold;"><strong>CONFIDENTIAL:</strong> Use or transcription of this document® is prohibited unless written authentication granted by Sama Karbala For Agriculture & Animal Production. © 2025 All rights reserved.</div>
            </div>
          </div>
          ` : `
          <div style="text-align: center; font-size: 9px; color: #6b7280; margin-top: 10px;">
            Page ${astPageNum + 1} of ${astTotalPages} - Continued on next page...
          </div>
          `}
        </div>
        `;
        allPages.push(astPage);
      }
    }

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
    html,body{background:var(--bg);color:var(--ink);font:${11 * scaleFactor}px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Tahoma,Arial,sans-serif; margin:0; padding:0; -webkit-print-color-adjust: exact; print-color-adjust: exact;}
    body{display:block;}
    .page{width:210mm; min-height:297mm; margin:2mm auto; padding:${isCompactMode ? '3mm 5mm' : '4mm 6mm'}; background:#fff; position:relative; box-shadow:0 0 5px rgba(0,0,0,0.15);}
    .header{display:flex; align-items:center; gap:${8 * scaleFactor}px; border-bottom:2px solid var(--line); padding-bottom:${2 * scaleFactor}px; margin-bottom:${4 * scaleFactor}px}
    .logo{width:${55 * scaleFactor}px; height:${55 * scaleFactor}px; object-fit:contain;}
    .lab-meta{flex:1; text-align: center; display: flex; flex-direction: column; justify-content: center;}
    .lab-name{font-size:${15 * scaleFactor}px; font-weight:900; color:var(--brand-ink); line-height:1.1}
    .lab-sub{color:var(--muted); font-size:${10 * scaleFactor}px; margin-top:1px}
    .coa-title{font-size:${18 * scaleFactor}px; font-weight:700; color:var(--brand-ink); margin-top:2px}
    .coa-badge{margin-inline-start:auto; text-align:right; font-size:${10 * scaleFactor}px}
    .badge-label{color:var(--muted); font-weight:600}
    .badge-value{color:var(--brand-ink); font-weight:800; font-size:${13 * scaleFactor}px}
    .info-block{margin-top:${5 * scaleFactor}px; margin-bottom:${5 * scaleFactor}px; padding:${8 * scaleFactor}px ${10 * scaleFactor}px; border:1px solid var(--line); border-radius:3px; background:#f9fafb}
    .info-block h2{margin:0 0 ${5 * scaleFactor}px; font-size:${13 * scaleFactor}px; color:var(--brand-ink); border-bottom:1px solid var(--line); padding-bottom:3px}
    .info-grid{display:grid; grid-template-columns:${120 * scaleFactor}px 1fr; row-gap:${3 * scaleFactor}px; column-gap:${8 * scaleFactor}px; font-size:${10 * scaleFactor}px}
    .info-label{color:var(--muted); font-weight:600}
    .info-value{font-weight:700}
    .section{margin-top:${4 * scaleFactor}px}
    .section h1{font-size:${16 * scaleFactor}px; color:var(--brand-ink); margin:0 0 ${2 * scaleFactor}px}
    .section h3{font-size:${11 * scaleFactor}px; color:var(--brand-ink); margin:0 0 ${2 * scaleFactor}px}
    table{width:100%; border-collapse:collapse; font-size:${10 * scaleFactor}px}
    th,td{padding:${3 * scaleFactor}px ${5 * scaleFactor}px; border:1px solid var(--line); text-align:center; vertical-align:middle; line-height:1.2}
    thead th{background:#fff; color:#0f172a; font-size:${10 * scaleFactor}px; font-weight:700; padding:${4 * scaleFactor}px ${5 * scaleFactor}px}
    tbody tr:nth-child(even) td{background:#fff}
    tbody tr:nth-child(odd) td{background:#fff}
    .signatures{display:grid; grid-template-columns:repeat(4,1fr); gap:${4 * scaleFactor}px; margin-top:${3 * scaleFactor}px}
    .sign-card{border:1px dashed var(--line); border-radius:3px; padding:${3 * scaleFactor}px; height:${75 * scaleFactor}px; display:flex; flex-direction:column; font-size:${9 * scaleFactor}px; overflow:visible}
    .sign-role{color:var(--muted); font-weight:600; font-size:${8 * scaleFactor}px; margin-bottom:${1 * scaleFactor}px}
    .sign-image-container{flex:1; display:flex; align-items:flex-start; justify-content:center; min-height:${32 * scaleFactor}px; max-height:${38 * scaleFactor}px}
    .sign-image{max-width:100%; max-height:${38 * scaleFactor}px; width:auto; height:auto; object-fit:contain}
    .sign-placeholder{width:100%; height:${28 * scaleFactor}px}
    .sign-info{margin-top:auto; text-align:center; padding-top:${1 * scaleFactor}px; border-top:1px solid #e5e7eb; min-height:${18 * scaleFactor}px}
    .footnote{margin-top:${2 * scaleFactor}px; font-size:${8 * scaleFactor}px; color:#374151}
    .muted{color:var(--muted)}
    .toolbar{position:sticky; top:0; background:#fff; padding:6px 0 10px; display:flex; gap:6px; z-index:10}
    .toolbar button{padding:6px 10px; border-radius:8px; border:1px solid var(--line); background:#f9fafb; cursor:pointer; font-size:12px}
    .warning-section{font-size:${8 * scaleFactor}px; line-height:1.25; margin-top:${3 * scaleFactor}px}
    .warning-section .muted{margin-bottom:${0.5 * scaleFactor}px}
    .warning-section > div > div:first-child{font-size:${9 * scaleFactor}px; margin-bottom:${1 * scaleFactor}px}
    .qc-table{margin-top:${3 * scaleFactor}px}
    @media print{
      html,body{background:#fff !important; margin:0 !important; padding:0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important;}
      .page{box-shadow:none !important; margin:0 !important; width:210mm !important; height:297mm !important; padding:${isCompactMode ? '3mm 5mm' : '4mm 6mm'} !important; page-break-after:always !important; overflow:hidden !important;}
      .page:last-child{page-break-after:auto !important;}
      .toolbar{display:none !important;}
      a[href]:after{content:"" !important;}
      .section{page-break-inside:avoid !important;}
      .signatures{page-break-inside:avoid !important;}
      .warning-section{page-break-inside:avoid !important;}
      @page{size:A4 portrait !important; margin:0 !important;}
      td[style*="background-color"], .info-block {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">🖨️ Print / Save as PDF</button>
    <button onclick="window.close()">✕ Close</button>
  </div>

  ${allPages.join('\n')}
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
    const diseases = unitData.microbiology_data?.diseases_list?.join(', ') || '';
    
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
      // Write content in chunks to prevent blocking
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // Single print trigger after images load - no duplicate calls
      let printTriggered = false;
      const triggerPrint = () => {
        if (printTriggered) return;
        printTriggered = true;
        // Small delay to ensure rendering is complete
        requestAnimationFrame(() => {
          printWindow.focus();
          printWindow.print();
        });
      };
      
      // Wait for all images to load before printing
      const images = printWindow.document.querySelectorAll('img');
      if (images.length === 0) {
        // No images, trigger print after brief delay for CSS
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
            img.onerror = checkAllLoaded; // Count errors as loaded to not block
          }
        });
        // Fallback timeout if images take too long
        setTimeout(triggerPrint, 3000);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-xl text-gray-600">Loading COA data...</div>
        </div>
      </div>
    );
  }

  if (error && !unitData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-xl text-red-600 mb-4">{error}</div>
          <button
            onClick={() => navigate('/database')}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Back to Microbiology Samples
          </button>
        </div>
      </div>
    );
  }

  if (!unitData) return null;

  const diseases = unitData.microbiology_data?.diseases_list || [];
  const currentDisease = diseases[currentDiseaseIndex];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
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

      <div className="max-w-7xl mx-auto">
        {/* Action Buttons */}
        <div className="flex justify-between items-center mb-6 print:hidden">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigationState?.fromDatabase ? navigate('/database', { state: { tab: 'Microbiology', scrollToUnit: unitId } }) : navigate('/microbiology/samples')}
              className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              ← Back to List
            </button>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDirectPDFDownload}
              disabled={saving}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
              title="Download PDF"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export PDF
            </button>
            <button
              type="button"
              onClick={() => setShowPostponedModal(true)}
              disabled={saving}
              className="px-6 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-400"
            >
              Postpone
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving
                ? 'Saving...'
                : (user?.role === 'admin' || user?.role === 'manager')
                  ? 'Approve'
                  : 'Save COA'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* COA Form */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8 border-b-2 border-purple-600 pb-4">
            <h1 className="text-3xl font-bold text-purple-700">Certificate of Analysis</h1>
            <p className="text-lg text-gray-600 mt-2">Microbiology Department</p>
          </div>

          {/* Sample Information */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-purple-700 mb-4">Sample Information</h2>
            <div className="grid grid-cols-3 gap-x-8 gap-y-2">
              <div className="flex">
                <span className="font-semibold w-40">Sample Code:</span>
                <span>{unitData.sample.sample_code}</span>
              </div>
              <div className="flex">
                <span className="font-semibold w-40">Unit Code:</span>
                <span>{unitData.unit_code}</span>
              </div>
              <div className="flex">
                <span className="font-semibold w-40">Date Received:</span>
                <span>{new Date(unitData.sample.date_received).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center">
                <span className="font-semibold w-40">Test Date:</span>
                <input
                  type="date"
                  value={dateTested}
                  onChange={(e) => setDateTested(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  disabled={status === 'finalized'}
                />
              </div>
              <div className="flex">
                <span className="font-semibold w-40">Company:</span>
                <span>{unitData.sample.company}</span>
              </div>
              <div className="flex">
                <span className="font-semibold w-40">Farm:</span>
                <span>{unitData.sample.farm}</span>
              </div>
              <div className="flex">
                <span className="font-semibold w-40">Flock:</span>
                <span>{unitData.sample.flock || '-'}</span>
              </div>
              <div className="flex">
                <span className="font-semibold w-40">Cycle:</span>
                <span>{unitData.sample.cycle || '-'}</span>
              </div>
              <div className="flex">
                <span className="font-semibold w-40">House:</span>
                <span>{unitData.house?.join(', ') || '-'}</span>
              </div>
              <div className="flex">
                <span className="font-semibold w-40">Age:</span>
                <span>{unitData.age || '-'}</span>
              </div>
              <div className="flex">
                <span className="font-semibold w-40">Sample Type:</span>
                <span>{unitData.sample_type?.join(', ') || '-'}</span>
              </div>
              {unitData.microbiology_data?.batch_no && (
                <div className="flex">
                  <span className="font-semibold w-40">Batch No:</span>
                  <span>{unitData.microbiology_data.batch_no}</span>
                </div>
              )}
              {unitData.microbiology_data?.fumigation && (
                <div className="flex">
                  <span className="font-semibold w-40">Fumigation:</span>
                  <span>{unitData.microbiology_data.fumigation}</span>
                </div>
              )}
              <div className="flex col-span-3">
                <span className="font-semibold w-40">Test Method:</span>
                {showASTTab ? (
                  <input
                    type="text"
                    value="CLSI M100 Performance Standards for Antimicrobial Susceptibility Testing, 36th Edition 2026."
                    className="flex-1 px-3 py-1 border border-gray-300 rounded bg-green-50 text-green-800 font-medium"
                    disabled
                  />
                ) : currentDisease ? (
                  <input
                    type="text"
                    value={testMethods[currentDisease] || (() => {
                      const lowerDisease = currentDisease.toLowerCase();
                      if (lowerDisease.includes('culture') || lowerDisease.includes('isolation') || lowerDisease.includes('fungi')) {
                        return 'Clinical Veterinary Microbiology 2nd edition, laboratory manual for the isolation and identification of avian pathogens Manual method 2008.';
                      } else if (lowerDisease.includes('water')) {
                        return 'Standard method (2018),9215 A, B and C - Part 9000 – ISO 16266: (2006).';
                      } else if (lowerDisease.includes('total count')) {
                        return 'ISO 4883-1:2013 / Amd.1:2022 (E)';
                      } else if (lowerDisease.includes('salmonella')) {
                        return 'ISO 6579-1:2017 Amd.1:2020(E)';
                      } else {
                        return '';
                      }
                    })()}
                    onChange={(e) => {
                      const newMethods = { ...testMethods };
                      newMethods[currentDisease] = e.target.value;
                      setTestMethods(newMethods);
                    }}
                    className="flex-1 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Enter test method"
                    disabled={status === 'finalized'}
                  />
                ) : (
                  <input
                    type="text"
                    value=""
                    placeholder="Select a disease first"
                    className="flex-1 px-3 py-1 border border-gray-300 rounded bg-gray-100"
                    disabled
                  />
                )}
              </div>
            </div>
          </div>

          {/* Disease Navigation */}
          {diseases.length > 0 && (
            <div className="mb-6">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                  {diseases.map((disease, idx) => {
                    // Calculate visible (non-hidden) test count for this disease
                    const visibleTestCount = unitData.microbiology_data?.index_list?.filter(
                      (index: string) => !hiddenIndexes[disease]?.has(index)
                    ).length || 0;
                    return (
                      <button
                        key={idx}
                        onClick={() => { setCurrentDiseaseIndex(idx); setShowASTTab(false); }}
                        className={`${idx === currentDiseaseIndex && !showASTTab
                            ? 'border-purple-500 text-purple-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }
                        whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center gap-2`}
                      >
                        {disease}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${idx === currentDiseaseIndex && !showASTTab ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                          {visibleTestCount}
                        </span>
                      </button>
                    );
                  })}
                  {/* AST Tab - Always Last */}
                  <button
                    onClick={() => setShowASTTab(true)}
                    className={`${showASTTab
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center gap-2`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    AST
                    <span className={`text-xs px-2 py-0.5 rounded-full ${showASTTab ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {astResults.filter(r => r.mic).length}
                    </span>
                  </button>
                </nav>
              </div>
            </div>
          )}

          {/* AST Tab Content */}
          {showASTTab && (
            <div className="mb-8">
              {/* Include AST in PDF Checkbox - Before Title */}
              <div className="mb-4 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeASTInPDF}
                    onChange={(e) => setIncludeASTInPDF(e.target.checked)}
                    className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    disabled={status === 'finalized'}
                  />
                  <span className="text-sm font-medium text-gray-700">Include AST in exported PDF</span>
                </label>
              </div>
              
              <h2 className="text-xl font-bold text-green-700 mb-4">Antimicrobial Susceptibility Testing (AST)</h2>
              
              {/* AST Header Info */}
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="font-semibold text-sm">Bacterial Isolate:</label>
                    <input
                      type="text"
                      value={astBacterialIsolate}
                      onChange={(e) => setAstBacterialIsolate(e.target.value)}
                      className="w-64 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                      placeholder="Enter isolate"
                      disabled={status === 'finalized'}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="font-semibold text-sm">Organ:</label>
                    <input
                      type="text"
                      value={astOrgan}
                      onChange={(e) => setAstOrgan(e.target.value)}
                      className="w-48 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                      placeholder="Enter organ"
                      disabled={status === 'finalized'}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="font-semibold text-sm">Bacteria Family:</label>
                    <select
                      value={astBacteriaFamily}
                      onChange={(e) => setAstBacteriaFamily(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                      disabled={status === 'finalized'}
                    >
                      <option value="Enterobacteriaceae">Enterobacteriaceae</option>
                      <option value="Fastidious M.o.">Fastidious M.o.</option>
                      <option value="Staphylococcus">Staphylococcus</option>
                      <option value="Enterococcus">Enterococcus</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* AST Results Table */}
              <div className="border-2 border-green-200 rounded-lg overflow-hidden shadow-lg">
                <div className="text-center py-3 bg-green-100 border-b border-green-200">
                  <h3 className="text-lg font-bold text-green-800">Antimicrobial Susceptibility Testing Results</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold" rowSpan={2}>AST Disk</th>
                      <th 
                        className="border border-gray-300 px-3 py-2 text-center font-semibold cursor-pointer hover:bg-gray-200" 
                        rowSpan={2}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (status !== 'finalized') {
                            setAstContextMenu({ x: e.clientX, y: e.clientY, type: 'result' });
                          }
                        }}
                        title="Right-click to fill all"
                      >
                        Result
                      </th>
                      <th 
                        className="border border-gray-300 px-3 py-2 text-center font-semibold cursor-pointer hover:bg-gray-200" 
                        rowSpan={2}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (status !== 'finalized') {
                            setAstContextMenu({ x: e.clientX, y: e.clientY, type: 'interpretation' });
                          }
                        }}
                        title="Right-click to fill all"
                      >
                        Interpretation
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-semibold" colSpan={3}>{astBacteriaFamily}</th>
                    </tr>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-2 py-1 text-center font-semibold text-red-600">R</th>
                      <th className="border border-gray-300 px-2 py-1 text-center font-semibold text-yellow-600">I</th>
                      <th className="border border-gray-300 px-2 py-1 text-center font-semibold text-green-600">S</th>
                    </tr>
                  </thead>
                  <tbody>
                    {astResults.map((result, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="border border-gray-300 px-3 py-2 text-sm">
                          {result.disk}
                        </td>
                        <td className="border border-gray-300 px-2 py-1">
                          <input
                            type="text"
                            value={result.mic}
                            onChange={(e) => {
                              const newResults = [...astResults];
                              newResults[idx] = { ...newResults[idx], mic: e.target.value };
                              setAstResults(newResults);
                            }}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-green-500"
                            placeholder="-"
                            disabled={status === 'finalized'}
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-1">
                          <select
                            value={result.interpretation || ''}
                            onChange={(e) => {
                              const newResults = [...astResults];
                              newResults[idx] = { ...newResults[idx], interpretation: e.target.value };
                              setAstResults(newResults);
                            }}
                            className={`w-full px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-green-500 font-semibold ${
                              result.interpretation === 'Resistant' ? 'bg-red-100 text-red-700' :
                              result.interpretation === 'Intermediate' ? 'bg-yellow-100 text-yellow-700' :
                              result.interpretation === 'Sensitive' ? 'bg-green-100 text-green-700' : ''
                            }`}
                            disabled={status === 'finalized'}
                          >
                            <option value="">-</option>
                            <option value="Sensitive" className="bg-green-100 text-green-700">Sensitive</option>
                            <option value="Intermediate" className="bg-yellow-100 text-yellow-700">Intermediate</option>
                            <option value="Resistant" className="bg-red-100 text-red-700">Resistant</option>
                          </select>
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-center text-sm text-red-600 font-medium">{result.r || '-'}</td>
                        <td className="border border-gray-300 px-2 py-1 text-center text-sm text-yellow-600 font-medium">{result.i || '-'}</td>
                        <td className="border border-gray-300 px-2 py-1 text-center text-sm text-green-600 font-medium">{result.s || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* AST Context Menu for Fill All */}
              {astContextMenu && (
                <div 
                  className="fixed bg-white border border-gray-300 rounded-lg shadow-xl z-50 py-2 min-w-[180px]"
                  style={{ left: astContextMenu.x, top: astContextMenu.y }}
                  onClick={() => setAstContextMenu(null)}
                >
                  {astContextMenu.type === 'result' ? (
                    <>
                      <div className="px-4 py-1 text-xs font-semibold text-gray-500 border-b">Fill All Results</div>
                      <button
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                        onClick={() => handleFillAllResult('')}
                      >
                        Clear All
                      </button>
                      <button
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                        onClick={() => {
                          const value = prompt('Enter value for all Result fields:');
                          if (value !== null) handleFillAllResult(value);
                        }}
                      >
                        Fill with custom value...
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="px-4 py-1 text-xs font-semibold text-gray-500 border-b">Fill All Interpretations</div>
                      <button
                        className="w-full px-4 py-2 text-left hover:bg-green-100 text-sm text-green-700 font-medium"
                        onClick={() => handleFillAllInterpretation('Sensitive')}
                      >
                        ✓ Sensitive (All)
                      </button>
                      <button
                        className="w-full px-4 py-2 text-left hover:bg-yellow-100 text-sm text-yellow-700 font-medium"
                        onClick={() => handleFillAllInterpretation('Intermediate')}
                      >
                        ~ Intermediate (All)
                      </button>
                      <button
                        className="w-full px-4 py-2 text-left hover:bg-red-100 text-sm text-red-700 font-medium"
                        onClick={() => handleFillAllInterpretation('Resistant')}
                      >
                        ✗ Resistant (All)
                      </button>
                      <button
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm border-t"
                        onClick={() => handleFillAllInterpretation('')}
                      >
                        Clear All
                      </button>
                    </>
                  )}
                </div>
              )}
              
            </div>
          )}

          {/* Test Results - Current Disease Only */}
          {!showASTTab && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-purple-700 mb-4">Test Results</h2>

            {/* Debug info */}
            {(!unitData.microbiology_data?.index_list || unitData.microbiology_data.index_list.length === 0) && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-yellow-800 font-semibold">⚠️ No sample indexes found!</p>
                <p className="text-sm text-yellow-700 mt-2">
                  Please make sure you added sample indexes when registering this unit.
                  Index list: {JSON.stringify(unitData.microbiology_data?.index_list || [])}
                </p>
              </div>
            )}

            {(!unitData.microbiology_data?.diseases_list || unitData.microbiology_data.diseases_list.length === 0) && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-yellow-800 font-semibold">⚠️ No diseases selected!</p>
                <p className="text-sm text-yellow-700 mt-2">
                  Please make sure you selected diseases when registering this unit.
                </p>
              </div>
            )}

            {unitData.microbiology_data?.index_list && unitData.microbiology_data.index_list.length > 0 && currentDisease ? (
              <div className="border-2 border-purple-200 rounded-lg p-6 bg-white shadow-lg">
                {/* Water COA Volume and Dilution Controls */}
                {currentDisease.toLowerCase().includes('water') && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-6">
                    <span className="font-semibold text-blue-800">Water Test Parameters:</span>
                    <div className="flex items-center gap-2">
                      <label className="font-medium text-sm">Volume:</label>
                      <input
                        type="number"
                        value={waterVolume}
                        onChange={(e) => setWaterVolume(Number(e.target.value) || 1)}
                        className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-center"
                        style={{ width: '50px', height: '30px' }}
                        min="1"
                        disabled={status === 'finalized'}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="font-medium text-sm">Dilution:</label>
                      <input
                        type="number"
                        value={waterDilution}
                        onChange={(e) => setWaterDilution(Number(e.target.value) || 1)}
                        className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-center"
                        style={{ width: '50px', height: '30px' }}
                        min="1"
                        disabled={status === 'finalized'}
                      />
                    </div>
                    <span className="text-xs text-blue-600 italic">Formula: (Entered Number × Dilution) × Volume</span>
                  </div>
                )}
                {/* Total Count COA Dilution Controls */}
                {currentDisease.toLowerCase().includes('total count') && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-6">
                    <span className="font-semibold text-green-800">Total Count Parameters:</span>
                    <div className="flex items-center gap-2">
                      <label className="font-medium text-sm">Dilution:</label>
                      <select
                        value={totalCountDilution}
                        onChange={(e) => setTotalCountDilution(Number(e.target.value))}
                        className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 text-center"
                        style={{ minWidth: '100px', height: '30px' }}
                        disabled={status === 'finalized'}
                      >
                        <option value={0.11}>0.11</option>
                        <option value={0.011}>0.011</option>
                        <option value={0.0011}>0.0011</option>
                        <option value={0.00011}>0.00011</option>
                        <option value={0.000011}>0.000011</option>
                      </select>
                    </div>
                    <span className="text-xs text-green-600 italic">Formula: (First No. + Second No.) / Dilution</span>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-purple-100">
                      <tr>
                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold" style={{ width: '5%' }}>No.</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-semibold" style={{ width: '30%' }}>
                          Sample Index
                        </th>
                        {currentDisease.toLowerCase().includes('total count') ? (
                          <>
                            <th className="border border-gray-300 px-4 py-3 text-left font-semibold" style={{ width: '20%' }}>
                              Total Bacterial Count <br /> CFU / PLATE/ 100 CM
                            </th>
                            <th className="border border-gray-300 px-4 py-3 text-left font-semibold" style={{ width: '20%' }}>
                              Total Mold and Yeast Count <br /> CFU/PLATE/100 CM
                            </th>
                            <th className="border border-gray-300 px-4 py-3 text-left font-semibold" style={{ width: '25%' }}>
                              Pathogenic Mold & Yeast
                            </th>
                          </>
                        ) : currentDisease.toLowerCase().includes('water') ? (
                          <>
                            <th className="border border-gray-300 px-4 py-3 text-left font-semibold" style={{ width: '15%' }}>
                              Total Bacterial Count<br />CFU / 100 ml
                            </th>
                            <th className="border border-gray-300 px-4 py-3 text-left font-semibold" style={{ width: '15%' }}>
                              Total Coliform Count<br />CFU / 100 ml
                            </th>
                            <th className="border border-gray-300 px-4 py-3 text-left font-semibold" style={{ width: '15%' }}>
                              Total E-Coli Count<br />CFU / 100 ml
                            </th>
                            <th className="border border-gray-300 px-4 py-3 text-left font-semibold" style={{ width: '15%' }}>
                              Total Pseudomonas Aeruginosa Count<br />CFU / 100 ml
                            </th>
                          </>
                        ) : (
                          <th className="border border-gray-300 px-4 py-3 text-left font-semibold" style={{ width: '20%' }}>
                            Result
                          </th>
                        )}
                        {!currentDisease.toLowerCase().includes('salmonella') && !currentDisease.toLowerCase().includes('total count') && !currentDisease.toLowerCase().includes('water') && (
                          <th className="border border-gray-300 px-4 py-3 text-left font-semibold" style={{ width: '20%' }}>
                            Type of isolate
                          </th>
                        )}
                        {!currentDisease.toLowerCase().includes('salmonella') && !currentDisease.toLowerCase().includes('total count') && !currentDisease.toLowerCase().includes('fungi') && !currentDisease.toLowerCase().includes('water') && (
                          <th className="border border-gray-300 px-4 py-3 text-left font-semibold" style={{ width: '20%' }}>
                            Range
                          </th>
                        )}
                        {currentDisease.toLowerCase().includes('fungi') && (
                          <th className="border border-gray-300 px-4 py-3 text-left font-semibold" style={{ width: '20%' }}>
                            Pathogenic Fungi & Mold
                          </th>
                        )}
                        {currentDisease.toLowerCase().includes('salmonella') && (
                          <th className="border border-gray-300 px-4 py-3 text-left font-semibold" style={{ width: '20%' }}>
                            Test Portion
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {unitData.microbiology_data.index_list.map((index, rowIdx) => {
                        const isSalmonella = currentDisease.toLowerCase().includes('salmonella');
                        const isTotalCount = currentDisease.toLowerCase().includes('total count');
                        const isWater = currentDisease.toLowerCase().includes('water');
                        const result = testResults[currentDisease]?.[index] || 'Not Detected';
                        const portion = testPortions[currentDisease]?.[index] || 'per25g';
                        const isHidden = isIndexHidden(currentDisease, index);

                        return (
                          <tr key={rowIdx} className={`hover:bg-gray-50 ${isHidden ? 'opacity-30 bg-gray-100' : ''}`}>
                            <td className="border border-gray-300 px-2 py-2 font-semibold bg-gray-50 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => toggleIndexVisibility(currentDisease, index)}
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                    isHidden 
                                      ? 'bg-green-500 hover:bg-green-600' 
                                      : 'bg-red-500 hover:bg-red-600'
                                  }`}
                                  title={isHidden ? 'Include this index' : 'Exclude this index'}
                                  disabled={status === 'finalized'}
                                >
                                  {isHidden ? '+' : '−'}
                                </button>
                                <span>{rowIdx + 1}</span>
                              </div>
                            </td>
                            <td className="border border-gray-300 px-4 py-3 font-semibold bg-gray-50">
                              {index}
                            </td>
                            {isWater ? (
                              <>
                                <td className="border border-gray-300 px-2 py-2">
                                  <div className="flex flex-col gap-1">
                                    <input
                                      type="number"
                                      id={`cell-${currentDiseaseIndex}-${rowIdx}-tbc`}
                                      value={testResults[currentDisease]?.[`${index}_raw`] || ''}
                                      onChange={(e) => {
                                        const newResults = { ...testResults };
                                        if (!newResults[currentDisease]) {
                                          newResults[currentDisease] = {};
                                        }
                                        const rawValue = e.target.value;
                                        newResults[currentDisease][`${index}_raw`] = rawValue;
                                        // Calculate and store the result: (entered * dilution) * volume
                                        const numValue = parseFloat(rawValue) || 0;
                                        const calculated = (numValue * waterDilution) * waterVolume;
                                        newResults[currentDisease][index] = rawValue ? calculated.toString() : '';
                                        setTestResults(newResults);
                                      }}
                                      className="w-full px-2 py-1 border-2 border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded text-sm"
                                      placeholder="Less than 1 CFU"
                                      disabled={status === 'finalized'}
                                      onContextMenu={(e) => {
                                        if (rowIdx === 0 && testResults[currentDisease]?.[index]) {
                                          e.preventDefault();
                                          setContextMenu({
                                            visible: true,
                                            x: e.clientX,
                                            y: e.clientY,
                                            type: 'water_tbc',
                                            value: testResults[currentDisease][index]
                                          });
                                        }
                                      }}
                                    />
                                    <span className="text-xs text-green-600 font-semibold">= {testResults[currentDisease]?.[index] || 'Less than 1 CFU'}</span>
                                  </div>
                                </td>
                                <td className="border border-gray-300 px-2 py-2">
                                  <div className="flex flex-col gap-1">
                                    <input
                                      type="number"
                                      id={`cell-${currentDiseaseIndex}-${rowIdx}-coliform`}
                                      value={testResults[currentDisease]?.[`${index}_coliform_raw`] || ''}
                                      onChange={(e) => {
                                        const newResults = { ...testResults };
                                        if (!newResults[currentDisease]) {
                                          newResults[currentDisease] = {};
                                        }
                                        const rawValue = e.target.value;
                                        newResults[currentDisease][`${index}_coliform_raw`] = rawValue;
                                        const numValue = parseFloat(rawValue) || 0;
                                        const calculated = (numValue * waterDilution) * waterVolume;
                                        newResults[currentDisease][`${index}_coliform`] = rawValue ? calculated.toString() : '';
                                        setTestResults(newResults);
                                      }}
                                      className="w-full px-2 py-1 border-2 border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded text-sm"
                                      placeholder="Less than 1 CFU"
                                      disabled={status === 'finalized'}
                                      onContextMenu={(e) => {
                                        if (rowIdx === 0 && testResults[currentDisease]?.[`${index}_coliform`]) {
                                          e.preventDefault();
                                          setContextMenu({
                                            visible: true,
                                            x: e.clientX,
                                            y: e.clientY,
                                            type: 'water_coliform',
                                            value: testResults[currentDisease][`${index}_coliform`]
                                          });
                                        }
                                      }}
                                    />
                                    <span className="text-xs text-green-600 font-semibold">= {testResults[currentDisease]?.[`${index}_coliform`] || 'Less than 1 CFU'}</span>
                                  </div>
                                </td>
                                <td className="border border-gray-300 px-2 py-2">
                                  <div className="flex flex-col gap-1">
                                    <input
                                      type="number"
                                      id={`cell-${currentDiseaseIndex}-${rowIdx}-ecoli`}
                                      value={testResults[currentDisease]?.[`${index}_ecoli_raw`] || ''}
                                      onChange={(e) => {
                                        const newResults = { ...testResults };
                                        if (!newResults[currentDisease]) {
                                          newResults[currentDisease] = {};
                                        }
                                        const rawValue = e.target.value;
                                        newResults[currentDisease][`${index}_ecoli_raw`] = rawValue;
                                        const numValue = parseFloat(rawValue) || 0;
                                        const calculated = (numValue * waterDilution) * waterVolume;
                                        newResults[currentDisease][`${index}_ecoli`] = rawValue ? calculated.toString() : '';
                                        setTestResults(newResults);
                                      }}
                                      className="w-full px-2 py-1 border-2 border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded text-sm"
                                      placeholder="Less than 1 CFU"
                                      disabled={status === 'finalized'}
                                      onContextMenu={(e) => {
                                        if (rowIdx === 0 && testResults[currentDisease]?.[`${index}_ecoli`]) {
                                          e.preventDefault();
                                          setContextMenu({
                                            visible: true,
                                            x: e.clientX,
                                            y: e.clientY,
                                            type: 'water_ecoli',
                                            value: testResults[currentDisease][`${index}_ecoli`]
                                          });
                                        }
                                      }}
                                    />
                                    <span className="text-xs text-green-600 font-semibold">= {testResults[currentDisease]?.[`${index}_ecoli`] || 'Less than 1 CFU'}</span>
                                  </div>
                                </td>
                                <td className="border border-gray-300 px-2 py-2">
                                  <div className="flex flex-col gap-1">
                                    <input
                                      type="number"
                                      id={`cell-${currentDiseaseIndex}-${rowIdx}-pseudomonas`}
                                      value={testResults[currentDisease]?.[`${index}_pseudomonas_raw`] || ''}
                                      onChange={(e) => {
                                        const newResults = { ...testResults };
                                        if (!newResults[currentDisease]) {
                                          newResults[currentDisease] = {};
                                        }
                                        const rawValue = e.target.value;
                                        newResults[currentDisease][`${index}_pseudomonas_raw`] = rawValue;
                                        const numValue = parseFloat(rawValue) || 0;
                                        const calculated = (numValue * waterDilution) * waterVolume;
                                        newResults[currentDisease][`${index}_pseudomonas`] = rawValue ? calculated.toString() : '';
                                        setTestResults(newResults);
                                      }}
                                      className="w-full px-2 py-1 border-2 border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded text-sm"
                                      placeholder="Less than 1 CFU"
                                      disabled={status === 'finalized'}
                                      onContextMenu={(e) => {
                                        if (rowIdx === 0 && testResults[currentDisease]?.[`${index}_pseudomonas`]) {
                                          e.preventDefault();
                                          setContextMenu({
                                            visible: true,
                                            x: e.clientX,
                                            y: e.clientY,
                                            type: 'water_pseudomonas',
                                            value: testResults[currentDisease][`${index}_pseudomonas`]
                                          });
                                        }
                                      }}
                                    />
                                    <span className="text-xs text-green-600 font-semibold">= {testResults[currentDisease]?.[`${index}_pseudomonas`] || 'Less than 1 CFU'}</span>
                                  </div>
                                </td>
                              </>
                            ) : isTotalCount ? (
                              <>
                                <td className="border border-gray-300 px-2 py-2">
                                  <div className="flex flex-col gap-1">
                                    <div className="flex gap-1">
                                      <input
                                        type="number"
                                        id={`cell-${currentDiseaseIndex}-${rowIdx}-tbc1`}
                                        value={testResults[currentDisease]?.[`${index}_tbc1`] || ''}
                                        onChange={(e) => {
                                          const newResults = { ...testResults };
                                          if (!newResults[currentDisease]) {
                                            newResults[currentDisease] = {};
                                          }
                                          const val1 = e.target.value;
                                          newResults[currentDisease][`${index}_tbc1`] = val1;
                                          const num1 = parseFloat(val1) || 0;
                                          const num2 = parseFloat(newResults[currentDisease][`${index}_tbc2`]) || 0;
                                          const calculated = (num1 + num2) / totalCountDilution;
                                          newResults[currentDisease][index] = (num1 || num2) ? calculated.toFixed(0) : '';
                                          setTestResults(newResults);
                                        }}
                                        className="w-1/2 px-2 py-1 border-2 border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded text-sm"
                                        placeholder="1st"
                                        disabled={status === 'finalized'}
                                      />
                                      <input
                                        type="number"
                                        id={`cell-${currentDiseaseIndex}-${rowIdx}-tbc2`}
                                        value={testResults[currentDisease]?.[`${index}_tbc2`] || ''}
                                        onChange={(e) => {
                                          const newResults = { ...testResults };
                                          if (!newResults[currentDisease]) {
                                            newResults[currentDisease] = {};
                                          }
                                          const val2 = e.target.value;
                                          newResults[currentDisease][`${index}_tbc2`] = val2;
                                          const num1 = parseFloat(newResults[currentDisease][`${index}_tbc1`]) || 0;
                                          const num2 = parseFloat(val2) || 0;
                                          const calculated = (num1 + num2) / totalCountDilution;
                                          newResults[currentDisease][index] = (num1 || num2) ? calculated.toFixed(0) : '';
                                          setTestResults(newResults);
                                        }}
                                        className="w-1/2 px-2 py-1 border-2 border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded text-sm"
                                        placeholder="2nd"
                                        disabled={status === 'finalized'}
                                      />
                                    </div>
                                    <span 
                                      className="text-xs text-green-600 font-semibold cursor-pointer"
                                      onContextMenu={(e) => {
                                        if (rowIdx === 0 && testResults[currentDisease]?.[index]) {
                                          e.preventDefault();
                                          setContextMenu({
                                            visible: true,
                                            x: e.clientX,
                                            y: e.clientY,
                                            type: 'totalcount_tbc',
                                            value: testResults[currentDisease][index]
                                          });
                                        }
                                      }}
                                      title="Right-click to fill all"
                                    >= {testResults[currentDisease]?.[index] || 'Less than 10 CFU'}</span>
                                  </div>
                                </td>
                                <td className="border border-gray-300 px-2 py-2">
                                  <div className="flex flex-col gap-1">
                                    <div className="flex gap-1">
                                      <input
                                        type="number"
                                        id={`cell-${currentDiseaseIndex}-${rowIdx}-mould1`}
                                        value={testResults[currentDisease]?.[`${index}_mould1`] || ''}
                                        onChange={(e) => {
                                          const newResults = { ...testResults };
                                          if (!newResults[currentDisease]) {
                                            newResults[currentDisease] = {};
                                          }
                                          const val1 = e.target.value;
                                          newResults[currentDisease][`${index}_mould1`] = val1;
                                          const num1 = parseFloat(val1) || 0;
                                          const num2 = parseFloat(newResults[currentDisease][`${index}_mould2`]) || 0;
                                          const calculated = (num1 + num2) / totalCountDilution;
                                          newResults[currentDisease][`${index}_mould`] = (num1 || num2) ? calculated.toFixed(0) : '';
                                          setTestResults(newResults);
                                        }}
                                        className="w-1/2 px-2 py-1 border-2 border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded text-sm"
                                        placeholder="1st"
                                        disabled={status === 'finalized'}
                                      />
                                      <input
                                        type="number"
                                        id={`cell-${currentDiseaseIndex}-${rowIdx}-mould2`}
                                        value={testResults[currentDisease]?.[`${index}_mould2`] || ''}
                                        onChange={(e) => {
                                          const newResults = { ...testResults };
                                          if (!newResults[currentDisease]) {
                                            newResults[currentDisease] = {};
                                          }
                                          const val2 = e.target.value;
                                          newResults[currentDisease][`${index}_mould2`] = val2;
                                          const num1 = parseFloat(newResults[currentDisease][`${index}_mould1`]) || 0;
                                          const num2 = parseFloat(val2) || 0;
                                          const calculated = (num1 + num2) / totalCountDilution;
                                          newResults[currentDisease][`${index}_mould`] = (num1 || num2) ? calculated.toFixed(0) : '';
                                          setTestResults(newResults);
                                        }}
                                        className="w-1/2 px-2 py-1 border-2 border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded text-sm"
                                        placeholder="2nd"
                                        disabled={status === 'finalized'}
                                      />
                                    </div>
                                    <span 
                                      className="text-xs text-green-600 font-semibold cursor-pointer"
                                      onContextMenu={(e) => {
                                        if (rowIdx === 0 && testResults[currentDisease]?.[`${index}_mould`]) {
                                          e.preventDefault();
                                          setContextMenu({
                                            visible: true,
                                            x: e.clientX,
                                            y: e.clientY,
                                            type: 'totalcount_mould',
                                            value: testResults[currentDisease][`${index}_mould`]
                                          });
                                        }
                                      }}
                                      title="Right-click to fill all"
                                    >= {testResults[currentDisease]?.[`${index}_mould`] || 'Less than 10 CFU'}</span>
                                  </div>
                                </td>
                                <td className="border border-gray-300 px-2 py-2">
                                  <input
                                    type="text"
                                    id={`cell-${currentDiseaseIndex}-${rowIdx}-fungi`}
                                    value={testResults[currentDisease]?.[`${index}_fungi`] || ''}
                                    onChange={(e) => {
                                      const newResults = { ...testResults };
                                      if (!newResults[currentDisease]) {
                                        newResults[currentDisease] = {};
                                      }
                                      newResults[currentDisease][`${index}_fungi`] = e.target.value;
                                      setTestResults(newResults);
                                    }}
                                    onContextMenu={(e) => {
                                      if (rowIdx === 0 && testResults[currentDisease]?.[`${index}_fungi`]) {
                                        e.preventDefault();
                                        setContextMenu({
                                          visible: true,
                                          x: e.clientX,
                                          y: e.clientY,
                                          type: 'totalcount_fungi',
                                          value: testResults[currentDisease][`${index}_fungi`]
                                        });
                                      }
                                    }}
                                    className="w-full px-3 py-2 border-2 border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded text-base"
                                    placeholder="-------"
                                    disabled={status === 'finalized'}
                                  />
                                </td>
                              </>
                            ) : (
                              <td className="border border-gray-300 px-2 py-2">
                                {isSalmonella || currentDisease.toLowerCase().includes('culture') || currentDisease.toLowerCase().includes('fungi') ? (
                                  <select
                                    id={`cell-${currentDiseaseIndex}-${rowIdx}`}
                                    value={result}
                                    onChange={(e) => {
                                      const newResults = { ...testResults };
                                      if (!newResults[currentDisease]) {
                                        newResults[currentDisease] = {};
                                      }
                                      newResults[currentDisease][index] = e.target.value;
                                      setTestResults(newResults);
                                    }}
                                    onContextMenu={(e) => {
                                      if (rowIdx === 0 && result) {
                                        e.preventDefault();
                                        setContextMenu({
                                          visible: true,
                                          x: e.clientX,
                                          y: e.clientY,
                                          type: 'result',
                                          value: result
                                        });
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const nextRow = rowIdx + 1;
                                        const totalRows = unitData.microbiology_data.index_list.length;
                                        if (nextRow < totalRows) {
                                          const nextInput = document.getElementById(`cell-${currentDiseaseIndex}-${nextRow}`);
                                          nextInput?.focus();
                                        }
                                      }
                                    }}
                                    className={`w-full px-3 py-2 border-2 border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded text-base font-semibold ${result === 'Not Detected' ? 'bg-green-100 text-green-800' : result === 'Detected' ? 'bg-red-100 text-red-800' : 'bg-white'
                                      }`}
                                    disabled={status === 'finalized'}
                                    title={rowIdx === 0 ? "Right-click to fill all" : ""}
                                  >
                                    <option value="Not Detected" className="bg-green-100 text-green-800">Not Detected</option>
                                    <option value="Detected" className="bg-red-100 text-red-800">Detected</option>
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    id={`cell-${currentDiseaseIndex}-${rowIdx}`}
                                    value={result}
                                    onChange={(e) => {
                                      const newResults = { ...testResults };
                                      if (!newResults[currentDisease]) {
                                        newResults[currentDisease] = {};
                                      }
                                      newResults[currentDisease][index] = e.target.value;
                                      setTestResults(newResults);
                                    }}
                                    onContextMenu={(e) => {
                                      if (rowIdx === 0 && result) {
                                        e.preventDefault();
                                        setContextMenu({
                                          visible: true,
                                          x: e.clientX,
                                          y: e.clientY,
                                          type: 'result',
                                          value: result
                                        });
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const nextRow = rowIdx + 1;
                                        const totalRows = unitData.microbiology_data.index_list.length;
                                        if (nextRow < totalRows) {
                                          const nextInput = document.getElementById(`cell-${currentDiseaseIndex}-${nextRow}`);
                                          nextInput?.focus();
                                        }
                                      }
                                    }}
                                    className="w-full px-3 py-2 border-2 border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded text-base"
                                    placeholder="Enter result"
                                    disabled={status === 'finalized'}
                                    title={rowIdx === 0 ? "Right-click to fill all" : ""}
                                  />
                                )}
                              </td>
                            )}
                            {!isSalmonella && !isTotalCount && !isWater && (
                              <td className="border border-gray-300 px-4 py-3 bg-gray-50">
                                <select
                                  value={isolateTypes[currentDisease]?.[index] || ''}
                                  onChange={(e) => {
                                    const newIsolateTypes = { ...isolateTypes };
                                    if (!newIsolateTypes[currentDisease]) {
                                      newIsolateTypes[currentDisease] = {};
                                    }
                                    newIsolateTypes[currentDisease][index] = e.target.value;
                                    setIsolateTypes(newIsolateTypes);
                                  }}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                  disabled={status === 'finalized'}
                                >
                                  <option value="">Select isolate type</option>
                                  {cultureIsolationTypes.map((type: any) => (
                                    <option key={type.id} value={type.name}>
                                      {type.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            )}
                            {!isSalmonella && !isTotalCount && !currentDisease.toLowerCase().includes('fungi') && !isWater && (
                              <td className="border border-gray-300 px-4 py-3 bg-gray-50">
                                <select
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                  value={testRanges[currentDisease]?.[index] || ''}
                                  onChange={(e) => {
                                    const newTestRanges = { ...testRanges };
                                    if (!newTestRanges[currentDisease]) {
                                      newTestRanges[currentDisease] = {};
                                    }
                                    newTestRanges[currentDisease][index] = e.target.value;
                                    setTestRanges(newTestRanges);
                                  }}
                                  disabled={status === 'finalized'}
                                >
                                  <option value="">-------</option>
                                  <option value="Low Range">Low Range</option>
                                  <option value="Mid Range">Mid Range</option>
                                  <option value="High Range">High Range</option>
                                </select>
                              </td>
                            )}
                            {currentDisease.toLowerCase().includes('fungi') && (
                              <td className="border border-gray-300 px-4 py-3 bg-gray-50">
                                <select
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                  value={testRanges[currentDisease]?.[index] || ''}
                                  onChange={(e) => {
                                    const newTestRanges = { ...testRanges };
                                    if (!newTestRanges[currentDisease]) {
                                      newTestRanges[currentDisease] = {};
                                    }
                                    newTestRanges[currentDisease][index] = e.target.value;
                                    setTestRanges(newTestRanges);
                                  }}
                                  disabled={status === 'finalized'}
                                >
                                  <option value="">Select Pathogenic Fungi & Mold</option>
                                  {pathogenicFungiMoldTypes.map((type: any) => (
                                    <option key={type.id} value={type.name}>
                                      {type.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            )}
                            {isSalmonella && (
                              <td className="border border-gray-300 px-2 py-2">
                                <input
                                  type="text"
                                  value={portion}
                                  onChange={(e) => {
                                    const newPortions = { ...testPortions };
                                    if (!newPortions[currentDisease]) {
                                      newPortions[currentDisease] = {};
                                    }
                                    newPortions[currentDisease][index] = e.target.value;
                                    setTestPortions(newPortions);
                                  }}
                                  onContextMenu={(e) => {
                                    if (rowIdx === 0 && portion) {
                                      e.preventDefault();
                                      setContextMenu({
                                        visible: true,
                                        x: e.clientX,
                                        y: e.clientY,
                                        type: 'portion',
                                        value: portion
                                      });
                                    }
                                  }}
                                  className="w-full px-3 py-2 border-2 border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded text-base"
                                  placeholder="per25g - per swab"
                                  disabled={status === 'finalized'}
                                  title={rowIdx === 0 ? "Right-click to fill all" : ""}
                                />
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                No sample indexes available. Please add indexes when registering the sample.
              </div>
            )}
          </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Result Date  <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={dateTested}
                onChange={(e) => setDateTested(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 print:border-0"
                disabled={status === 'finalized'}
              />
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">Tested By</label>
              {testedBy ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-green-700 font-semibold">{testedBy}</span>
                    <button
                      onClick={() => { setTestedBy(''); setTestedBySignatureImage(null); }}
                      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                      disabled={status === 'finalized'}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                  maxLength={8}
                  disabled={status === 'finalized'}
                />
              )}
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">Reviewed By</label>
              {reviewedBy ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-green-700 font-semibold">{reviewedBy}</span>
                    <button
                      onClick={() => { setReviewedBy(''); setReviewedBySignatureImage(null); }}
                      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                      disabled={status === 'finalized'}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                  maxLength={8}
                  disabled={status === 'finalized'}
                />
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">Lab Supervisor</label>
              {labSupervisor ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-green-700 font-semibold">{labSupervisor}</span>
                    <button
                      onClick={() => { setLabSupervisor(''); setLabSupervisorSignatureImage(null); }}
                      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                      disabled={status === 'finalized'}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                  maxLength={8}
                  disabled={status === 'finalized'}
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
                      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                      disabled={status === 'finalized'}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                  maxLength={8}
                  disabled={status === 'finalized'}
                />
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-8">
            <label className="block font-semibold mb-2">Notes:</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-purple-500 print:border-0"
              rows={4}
              placeholder="Additional notes or comments..."
              disabled={status === 'finalized'}
            />
          </div>


          {/* <div className="mb-8 p-4 bg-gray-50 rounded border border-gray-200">
            <h3 className="font-bold text-purple-700 mb-2">Important Notes:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
              <li>All tests were performed according to standard microbiological procedures</li>
              <li>Results are valid only for the samples tested</li>
              <li>This certificate shall not be reproduced except in full without written approval</li>
              <li>Samples will be retained for 7 days after report issue date</li>
            </ul>
          </div> */}

          {/* Status Badge */}
          <div className="text-center mb-6">
            <span
              className={`inline-block px-6 py-2 rounded-full font-bold text-lg ${status === 'finalized' || status === 'completed'
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
                }`}
            >
              Status: {status.toUpperCase()}
            </span>
          </div>

          {/* Confidentiality Notice - Removed as it's now in the PDF template */}
        </div>
      </div>


      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:border-0 {
            border: none !important;
          }
        }
      `}</style>

      {/* Context Menu */}
      {contextMenu && contextMenu.visible && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white border border-gray-300 rounded shadow-lg py-1 min-w-[150px]">
            <button
              onClick={() => handleFillAll(contextMenu.type, contextMenu.value)}
              className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Fill All with "{contextMenu.value}"
            </button>
          </div>
        </div>
      )}

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
