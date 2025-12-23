import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../services/apiClient';

interface Unit {
  id: number;
  unit_code: string;
  sample: {
    id: number;
    sample_code: string;
    company: string;
    farm: string;
    flock: string | null;
    cycle: string | null;
    date_received: string;
  };
  house: string[];
  age: string | null;  // Changed from number to string
  source: string | null;
  sample_type: string[];
  pcr_data?: {
    extraction_method: string;
    diseases_list: Array<{ disease: string; kit_type: string }>;
  };
}

interface COA {
  id: number;
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

export default function PCRCOAPreview() {
  const { unitId } = useParams<{ unitId: string }>();
  const navigate = useNavigate();

  const { data: unit, isLoading: unitLoading } = useQuery<Unit>({
    queryKey: ['unit', unitId],
    queryFn: async () => {
      const response = await apiClient.get(`/units/${unitId}/`);
      return response.data;
    },
  });

  const { data: coa, isLoading: coaLoading } = useQuery<COA>({
    queryKey: ['pcr-coa', unitId],
    queryFn: async () => {
      const response = await apiClient.get(`/pcr-coa/${unitId}/`);
      return response.data;
    },
  });

  if (unitLoading || coaLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading COA...</p>
        </div>
      </div>
    );
  }

  if (!unit || !coa) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-gray-600">
          <p className="text-xl font-semibold">COA not found</p>
          <button
            onClick={() => navigate('/database')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Database
          </button>
        </div>
      </div>
    );
  }

  const diseases = unit.pcr_data?.diseases_list || [];
  const sampleTypes = unit.sample_type || [];
  
  // Format detection methods as "Disease (Kit Type)"
  const detectionMethods = diseases.map(d => `${d.disease} (${d.kit_type})`).join(', ');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Floating Action Buttons - Non-printable, positioned over COA */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          style={{ width: '80px', height: '40px' }}
          className="bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 transition shadow-lg flex items-center justify-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print
        </button>
        <button
          onClick={() => navigate('/database')}
          style={{ width: '80px', height: '40px' }}
          className="bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 transition shadow-lg flex items-center justify-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </button>
      </div>

      {/* Professional Certificate - Printable */}
      <div className="max-w-4xl mx-auto p-8">
        <div 
          className="bg-white shadow-lg print:shadow-none" 
          style={{ 
            fontFamily: 'Arial, sans-serif',
            fontSize: '13px',
            lineHeight: '1.4',
            color: '#222',
            padding: '24px'
          }}
        >
          {/* Header */}
          <header style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            borderBottom: '2px solid #e5e7eb',
            paddingBottom: '4px',
            marginBottom: '6px'
          }}>
            <img 
              src={`${window.location.origin}/assets/logo.png`} 
              alt="Logo" 
              style={{
                width: '70px',
                height: '70px',
                objectFit: 'contain'
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontSize: '18px', 
                fontWeight: '900', 
                color: '#0b4f4a',
                lineHeight: '1.2'
              }}>
                SAMA KARBALA CO. - Central Poultry Laboratories
              </div>
              <div style={{ 
                color: '#6b7280',
                fontSize: '12px',
                marginTop: '2px'
              }}>
                PCR DIAGNOSTICS - Certificate of Analysis
              </div>
            </div>
            <div style={{ 
              marginLeft: 'auto',
              textAlign: 'right',
              fontSize: '12px'
            }}>
              <div style={{ color: '#6b7280', fontWeight: '600' }}>Test Report No.:</div>
              <div style={{ 
                color: '#0b4f4a',
                fontWeight: '800',
                fontSize: '15px'
              }}>
                {unit.unit_code}
              </div>
            </div>
          </header>

          {/* Sample Information */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: '700', 
              marginBottom: '8px',
              color: '#1e40af',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '4px'
            }}>
              Sample Information
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              fontSize: '12px'
            }}>
              {/* Left Column */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '140px 1fr', 
                rowGap: '3px',
                columnGap: '8px'
              }}>
                <div style={{ fontWeight: '600', color: '#4b5563' }}>Sample Code:</div>
                <div>{unit.sample.sample_code}</div>
                
                <div style={{ fontWeight: '600', color: '#4b5563' }}>Company:</div>
                <div>{unit.sample.company}</div>

                <div style={{ fontWeight: '600', color: '#4b5563' }}>Flock:</div>
                <div>{unit.sample.flock || 'N/A'}</div>

                <div style={{ fontWeight: '600', color: '#4b5563' }}>House:</div>
                <div>{unit.house?.join(', ') || 'N/A'}</div>

                <div style={{ fontWeight: '600', color: '#4b5563' }}>Sample Types:</div>
                <div>{sampleTypes.join(', ')}</div>

                <div style={{ fontWeight: '600', color: '#4b5563' }}>Extraction Method:</div>
                <div>{unit.pcr_data?.extraction_method || 'N/A'}</div>
              </div>

              {/* Right Column */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '140px 1fr', 
                rowGap: '3px',
                columnGap: '8px'
              }}>
                <div style={{ fontWeight: '600', color: '#4b5563' }}>Unit Code:</div>
                <div>{unit.unit_code}</div>
                
                <div style={{ fontWeight: '600', color: '#4b5563' }}>Farm:</div>
                <div>{unit.sample.farm}</div>
                
                <div style={{ fontWeight: '600', color: '#4b5563' }}>Cycle:</div>
                <div>{unit.sample.cycle || 'N/A'}</div>
                
                <div style={{ fontWeight: '600', color: '#4b5563' }}>Age:</div>
                <div>{unit.age ? `${unit.age} days` : 'N/A'}</div>
                
                <div style={{ fontWeight: '600', color: '#4b5563' }}>Source:</div>
                <div>{unit.source || 'N/A'}</div>
                
                <div style={{ fontWeight: '600', color: '#4b5563' }}>Test Method:</div>
                <div>{detectionMethods || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Test Results */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: '700', 
              marginBottom: '8px',
              color: '#1e40af',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '4px'
            }}>
              Test Results
            </div>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: '11px'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={{ 
                    border: '1px solid #d1d5db', 
                    padding: '6px', 
                    textAlign: 'left',
                    fontWeight: '600',
                    width: '20%'
                  }}>
                    Disease
                  </th>
                  <th style={{ 
                    border: '1px solid #d1d5db', 
                    padding: '6px', 
                    textAlign: 'center',
                    fontWeight: '600',
                    width: '15%'
                  }}>
                    House
                  </th>
                  {sampleTypes.map(st => (
                    <th 
                      key={st}
                      style={{ 
                        border: '1px solid #d1d5db', 
                        padding: '6px', 
                        textAlign: 'center',
                        fontWeight: '600'
                      }}
                    >
                      {st}
                    </th>
                  ))}
                  <th style={{ 
                    border: '1px solid #d1d5db', 
                    padding: '6px', 
                    textAlign: 'center',
                    fontWeight: '600',
                    width: '10%'
                  }}>
                    Pos. Control
                  </th>
                </tr>
              </thead>
              <tbody>
                {diseases.map(diseaseItem => {
                  const value = (coa.test_results as any)[diseaseItem.disease];
                  const pools = Array.isArray(value)
                    ? value
                    : (value && typeof value === 'object')
                    ? [{
                        houses: value.indices || '',
                        values: sampleTypes.reduce((acc, st) => ({ ...acc, [st]: (value[st] || 'NA') }), {}),
                        pos_control: value.pos_control || ''
                      }]
                    : [{ houses: '', values: {}, pos_control: '' }];
                  
                  return pools.map((pool: any, idx: number) => (
                    <tr key={`${diseaseItem.disease}-pool-${idx}`}>
                      <td style={{ 
                        border: '1px solid #d1d5db', 
                        padding: '6px'
                      }}>
                        {diseaseItem.disease}
                      </td>
                      <td style={{ 
                        border: '1px solid #d1d5db', 
                        padding: '6px',
                        textAlign: 'center'
                      }}>
                        {pool.houses || ''}
                      </td>
                      {sampleTypes.map(st => (
                        <td 
                          key={st}
                          style={{ 
                            border: '1px solid #d1d5db', 
                            padding: '6px',
                            textAlign: 'center'
                          }}
                        >
                          {pool.values?.[st] ?? 'NA'}
                        </td>
                      ))}
                      <td style={{ 
                        border: '1px solid #d1d5db', 
                        padding: '6px',
                        textAlign: 'center'
                      }}>
                        {pool.pos_control || ''}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
            <div style={{ 
              fontSize: '10px', 
              color: '#6b7280', 
              marginTop: '6px'
            }}>
              <div>*Neg. = Negative, Ct:threshold cycle, NA = Not Applicable</div>
              {coa.notes && (
                <div style={{ marginTop: '3px' }}>
                  <strong>Notes:</strong> {coa.notes}
                </div>
              )}
            </div>
          </div>

          {/* Signatures */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: '700', 
              marginBottom: '8px',
              color: '#1e40af',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '4px'
            }}>
              Signatures
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(4, 1fr)', 
              gap: '12px'
            }}>
              <div style={{ 
                border: '1px solid #d1d5db', 
                borderRadius: '4px', 
                padding: '8px',
                textAlign: 'center',
                fontSize: '11px'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>Tested By</div>
                <div style={{ marginBottom: '8px' }}>{coa.tested_by || '_________________'}</div>
                <div style={{ fontSize: '10px', color: '#6b7280' }}>Signature:</div>
              </div>
              <div style={{ 
                border: '1px solid #d1d5db', 
                borderRadius: '4px', 
                padding: '8px',
                textAlign: 'center',
                fontSize: '11px'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>Reviewed By</div>
                <div style={{ marginBottom: '8px' }}>{coa.reviewed_by || '_________________'}</div>
                <div style={{ fontSize: '10px', color: '#6b7280' }}>Signature:</div>
              </div>
              <div style={{ 
                border: '1px solid #d1d5db', 
                borderRadius: '4px', 
                padding: '8px',
                textAlign: 'center',
                fontSize: '11px'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>Lab Supervisor</div>
                <div style={{ marginBottom: '8px' }}>{coa.lab_supervisor || '_________________'}</div>
                <div style={{ fontSize: '10px', color: '#6b7280' }}>Signature:</div>
              </div>
              <div style={{ 
                border: '1px solid #d1d5db', 
                borderRadius: '4px', 
                padding: '8px',
                textAlign: 'center',
                fontSize: '11px'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>Lab Manager</div>
                <div style={{ marginBottom: '8px' }}>{coa.lab_manager || '_________________'}</div>
                <div style={{ fontSize: '10px', color: '#6b7280' }}>Signature:</div>
              </div>
            </div>
          </div>

          {/* Warning and Footer */}
          <div style={{ 
            fontSize: '11px', 
            lineHeight: '1.5',
            marginTop: '8px'
          }}>
            <div style={{ marginBottom: '4px', fontWeight: '700', fontSize: '12px' }}>
              Warning:
            </div>
            <div style={{ color: '#6b7280', marginBottom: '3px' }}>
              • This Certificate is not accredited unless it is stamped or signed.
            </div>
            <div style={{ color: '#6b7280', marginBottom: '3px' }}>
              • The result represents tested samples only.
            </div>
            <div style={{ color: '#6b7280', marginBottom: '3px' }}>
              • Any Abrasion or change revokes this certificate.
            </div>
            <div style={{ color: '#6b7280', marginBottom: '5px' }}>
              • The laboratory results contained in this report are considered confidential between the company and clients, and should not be shared or disclosed unless required by law without the client's consent.
            </div>
            <div style={{ marginTop: '4px', fontWeight: '700', fontSize: '12px' }}>
              CONFIDENTIAL:{' '}
              <span style={{ fontWeight: '400', color: '#6b7280' }}>
                Use or transcription of this document® is prohibited unless written authentication granted by Sama Karbala For Agriculture & Animal Production. © {new Date().getFullYear()} All rights reserved.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
