import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { apiClient } from '../../../../services/apiClient';
import XLSX from 'xlsx-js-style';

import {
    escapeHtml,
    addSerialNumbers,
    filterByDateRange,
    sortByMicCode
} from '../../utils/sheetUtils';
import { SheetRef, SheetProps, BaseSheetRow } from '../../types/sheetTypes';

interface FungiSheetRow extends BaseSheetRow { }

export const FungiSheet = forwardRef<SheetRef, SheetProps>(({ startDate, endDate }, ref) => {
    const [sheetRows, setSheetRows] = useState<FungiSheetRow[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchSamples = async () => {
            setLoading(true);
            try {
                const currentYear = new Date().getFullYear();
                const response = await apiClient.get('/samples/', {
                    params: { year: currentYear, department_id: 3 }
                });

                const rows: FungiSheetRow[] = [];
                response.data.forEach((sample: any) => {
                    if (!filterByDateRange(sample.date_received, startDate, endDate)) return;

                    sample.units?.forEach((unit: any) => {
                        if (unit.department_id === 3) {
                            const diseases = unit.microbiology_data?.diseases_list || [];
                            const hasFungi = diseases.some((d: string) => {
                                const lowerD = d.toLowerCase();
                                return lowerD.includes('fungi') || lowerD.includes('fungal') || lowerD.includes('mold') || lowerD.includes('mould');
                            });

                            if (hasFungi) {
                                const indices = unit.microbiology_data?.index_list || [];
                                const sampleType = Array.isArray(unit.sample_type) ? unit.sample_type.join(', ') : (unit.sample_type || '');

                                if (indices.length > 0) {
                                    indices.forEach((idx: string) => {
                                        rows.push({
                                            labCode: sample.sample_code,
                                            micCode: unit.unit_code,
                                            sampleType: sampleType,
                                            sampleIndex: idx,
                                            serialNo: 0
                                        });
                                    });
                                } else {
                                    rows.push({
                                        labCode: sample.sample_code,
                                        micCode: unit.unit_code,
                                        sampleType: sampleType,
                                        sampleIndex: '-',
                                        serialNo: 0
                                    });
                                }
                            }
                        }
                    });
                });

                const sortedRows = sortByMicCode(rows);
                const finalRows = addSerialNumbers(sortedRows);

                setSheetRows(finalRows);
            } catch (error) {
                console.error('Failed to fetch samples:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSamples();
    }, [startDate, endDate]);

    const sheetRef = useRef<HTMLDivElement>(null);

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();
        const data = [
            ['Fungal Isolation Technical Data Sheet'],
            ['Test Method:', 'Clinical Veterinary Microbiology 2nd edition, laboratory manual for the isolation and identification of avian pathogens Manual method 2008.'],
            [],
            ['Lab Code', 'MIC Code', 'No.', 'Sample Type', 'Index', 'Result', 'Isolate Fungi/Mold', 'Pathogenic Fungi/Mold', 'Range'],
            ...sheetRows.map(row => [
                row.labCode,
                row.micCode,
                row.serialNo,
                row.sampleType,
                row.sampleIndex,
                '',
                '',
                '',
                ''
            ])
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wscols = [
            { wch: 15 },
            { wch: 15 },
            { wch: 5 },
            { wch: 20 },
            { wch: 15 },
            { wch: 10 },
            { wch: 15 },
            { wch: 15 },
            { wch: 10 }
        ];
        ws['!cols'] = wscols;
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];

        XLSX.utils.book_append_sheet(wb, ws, 'Fungi Sheet');
        XLSX.writeFile(wb, `Fungi_Sheet_${startDate}_${endDate}.xlsx`);
    };



    const exportToPDF = () => {
        const htmlContent = generatePDFTemplate();
        const printWindow = window.open('', '_blank');

        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();

            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.print();
                }, 250);
            };
        }
    };

    useImperativeHandle(ref, () => ({
        exportToExcel,
        exportToPDF
    }));

    const generatePDFTemplate = () => {
        const rowsPerPage = 30;
        const pages: FungiSheetRow[][] = [];

        for (let i = 0; i < sheetRows.length; i += rowsPerPage) {
            pages.push(sheetRows.slice(i, i + rowsPerPage));
        }
        if (pages.length === 0) pages.push([]);

        const totalPages = pages.length + 1; // +1 for the final culture/confirmation page

        const generateHeader = () => `
        <div class="header">
          <div><img src="/assets/logo.png" alt="Logo" class="logo"></div>
          <div style="text-align: center;">
            <h1>Fungal Isolation Technical Data Sheet</h1>
            <p style="font-size: 11px;"><strong>Test Method:</strong> Clinical Veterinary Microbiology 2<sup>nd</sup> edition, laboratory manual for the isolation and identification of avian pathogens Manual method 2008.</p>
          </div>
          <div style="text-align: right;">
            <h2>Sama Karbala</h2>
            <h3>Laboratory Unit</h3>
            <p><strong>MIC 000 R001</strong></p>
          </div>
        </div>
        <div class="info-grid">
          <div class="info-field" style="grid-column: 1 / -1;">
            <label>Lab. Code:</label> From ${escapeHtml(sheetRows.length > 0 ? sheetRows[0].labCode : '_____')} To ${escapeHtml(sheetRows.length > 0 ? sheetRows[sheetRows.length - 1].labCode : '_____')}
          </div>
          <div class="info-field" style="grid-column: 1 / -1;">
            <label>MIC Code:</label> From ${escapeHtml(sheetRows.length > 0 ? sheetRows[0].micCode : '_____')} To ${escapeHtml(sheetRows.length > 0 ? sheetRows[sheetRows.length - 1].micCode : '_____')}
          </div>
          <div class="info-field"><label>Date of Receipt:</label> From ${escapeHtml(startDate)} To ${escapeHtml(endDate)}</div>
          <div class="info-field"><label>Test Date:</label> _____________</div>
        </div>
        `;

        const samplePagesHtml = pages.map((pageRows, index) => {
            const rowsHtml = pageRows.map((row) => `
            <tr>
              <td>${escapeHtml(row.labCode)}</td>
              <td>${escapeHtml(row.micCode)}</td>
              <td style="text-align: center">${escapeHtml(row.serialNo)}</td>
              <td>${escapeHtml(row.sampleType)}</td>
              <td>${escapeHtml(row.sampleIndex)}</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
            `).join('');

            return `
            <div class="page">
                ${generateHeader()}
                <div class="section-title">Sample Description</div>
                <table>
                  <thead><tr><th>Lab Code</th><th>MIC Code</th><th>No.</th><th>Sample Type</th><th>Index</th><th>Result</th><th>Isolate Fungi/Mold</th><th>Pathogenic Fungi/Mold</th><th>Range</th></tr></thead>
                  <tbody>${rowsHtml}</tbody>
                </table>
                <div class="footer">CONFIDENTIAL. Use or transcription of this document is prohibited unless written authentication granted by Sahara Karbala Co. for Agriculture & Animal Production ®. ©2025 All rights reserved.</div>
                <div class="page-number">Page ${index + 1} of ${totalPages}</div>
            </div>
            `;
        }).join('');

        const culturePageHtml = `
          <div class="page">
            <div class="header">
              <div><img src="/assets/logo.png" alt="Logo" class="logo"></div>
              <div style="text-align: center;"><h1>Fungal Isolation Technical Data Sheet</h1></div>
              <div style="text-align: right;"><h2>Sama Karbala</h2><h3>Laboratory Unit</h3><p><strong>MIC 000 R001</strong></p></div>
            </div>
            <div class="section-title">Culture</div>
            <table>
              <thead>
                <tr><th>Media</th><th>Batch №</th><th>Incubator No.</th><th colspan="2">Start</th><th colspan="2">Incubation Temperature</th><th colspan="2">Incubation Period</th><th>Result</th><th>Operator Signature</th></tr>
                <tr><th></th><th></th><th></th><th>Day</th><th>Time</th><th>Temp. (℃)</th><th>Range (℃)</th><th>Period (d)</th><th>Range (d)</th><th></th><th></th></tr>
              </thead>
              <tbody><tr><td>SDA</td><td></td><td></td><td></td><td></td><td></td><td>25±1℃</td><td></td><td>5-7 d</td><td></td><td></td></tr></tbody>
            </table>
            <div class="section-title">Confirmation</div>
            <table>
              <thead><tr><th>Microscopic Examination</th><th>Colony Morphology / Description</th><th>Conidia</th><th>Hyphae</th><th>Result</th><th>Operator Signature</th></tr></thead>
              <tbody><tr><td style="height: 80px;"></td><td></td><td></td><td></td><td></td><td></td></tr></tbody>
            </table>
            <div class="signature-section">
              <div class="signature-box"><label>Technician:</label><div class="signature-line">Sign: _______________</div><div class="signature-line">Date: _______________</div></div>
              <div class="signature-box"><label>Head Unit:</label><div class="signature-line">Sign: _______________</div><div class="signature-line">Date: _______________</div></div>
              <div class="signature-box"><label>Quality Manager:</label><div class="signature-line">Sign: _______________</div><div class="signature-line">Date: _______________</div></div>
            </div>
            <div class="footer">CONFIDENTIAL. Use or transcription of this document is prohibited unless written authentication granted by Sahara Karbala Co. for Agriculture & Animal Production ®. ©2025 All rights reserved.</div>
            <div class="page-number">Page ${totalPages} of ${totalPages}</div>
          </div>
        `;

        return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Fungal Isolation Technical Data Sheet</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .page { max-width: 210mm; margin: 0 auto 30px auto; background-color: white; padding: 4mm; box-shadow: 0 0 10px rgba(0,0,0,0.1); page-break-after: always; }
    .header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; display: grid; grid-template-columns: 70px 1fr auto; align-items: center; gap: 12px; }
    .logo { width: 70px; height: auto; }
    .header h1 { color: #000; margin: 4px 0; font-size: 18px; }
    .header h2, .header h3 { margin: 3px 0; font-size: 13px; color: #000; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 15px; }
    .info-field { border: 1px solid #000; padding: 5px; background-color: #f9f9f9; font-size: 10px; color: #000; }
    .info-field label { font-weight: bold; color: #000; }
    .section-title { background-color: #e5e7eb; color: #000; padding: 6px; margin-top: 15px; margin-bottom: 8px; font-weight: bold; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9px; }
    table th { background-color: #e5e7eb; color: #000; padding: 6px 3px; text-align: center; border: 1px solid #000; font-weight: bold; white-space: nowrap; }
    table td { border: 1px solid #000; padding: 8px 4px; text-align: center; min-height: 25px; color: #000; background-color: #fff; white-space: nowrap; }
    .signature-section { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 20px; padding-top: 12px; border-top: 2px solid #000; }
    .signature-box { text-align: center; font-size: 9px; color: #000; }
    .signature-box label { font-weight: bold; display: block; margin-bottom: 12px; }
    .signature-line { border-top: 1px solid #000; padding-top: 3px; margin-top: 8px; }
    .page-number { text-align: center; font-size: 10px; color: #000; margin-top: 10px; }
    .footer { text-align: center; font-size: 8px; color: #e74c3c; font-weight: bold; margin-top: 15px; padding-top: 8px; border-top: 2px solid #000; }
    @media print {
      body { background-color: white; margin: 0; padding: 0; }
      .page { box-shadow: none; margin: 0; padding: 4mm; width: 210mm; height: 297mm; page-break-after: always; }
      @page { size: A4 portrait; margin: 1mm; }
    }
  </style>
</head>
<body>
  ${samplePagesHtml}
  ${culturePageHtml}
</body>
</html>
        `;
    };

    if (loading) {
        return <div className="text-center py-10 font-bold text-gray-500">Loading samples...</div>;
    }

    return (
        <div className="max-w-[1200px] mx-auto">
            <div ref={sheetRef} className="bg-white p-8 shadow-lg print:shadow-none print:p-0 max-w-[210mm] mx-auto">
                {/* Header */}
                <div className="grid grid-cols-[120px_1fr_auto] gap-8 items-center border-b-4 border-black pb-4 mb-6">
                    <div className="w-[120px] h-[120px] flex items-center justify-center">
                        <img src="/assets/logo.png" alt="Sama Karbala Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-black mb-2">Fungal Isolation Technical Data Sheet</h1>
                    </div>
                    <div className="text-right">
                        <h2 className="text-lg font-bold text-black">Sama Karbala Co.</h2>
                        <h3 className="text-sm font-medium text-black">Laboratory Unit</h3>
                        <p className="text-sm font-bold mt-1 text-black">MIC 000 R001</p>
                    </div>
                </div>

                {/* Test Method */}
                <div className="grid grid-cols-2 gap-x-12 gap-y-4 mb-8 text-sm">
                    <div className="col-span-2 flex items-center gap-2">
                        <span className="font-bold min-w-[100px] text-black">Test Method:</span>
                        <span className="text-black">Clinical Veterinary Microbiology 2<sup>nd</sup> edition, laboratory manual for the isolation and identification of avian pathogens Manual method 2008.</span>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-x-12 gap-y-4 mb-6 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="font-bold min-w-[100px] text-black">Lab Code:</span>
                        <div className="flex-1 flex items-center gap-2">
                            <span className="text-black">From:</span>
                            <span className="border-b border-black flex-1 text-center pb-1 text-black">{sheetRows.length > 0 ? sheetRows[0].labCode : ''}</span>
                            <span className="text-black">To:</span>
                            <span className="border-b border-black flex-1 text-center pb-1 text-black">{sheetRows.length > 0 ? sheetRows[sheetRows.length - 1].labCode : ''}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold min-w-[100px] text-black">Test Date:</span>
                        <span className="border-b border-black flex-1 pb-1"></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold min-w-[100px] text-black">MIC Code:</span>
                        <div className="flex-1 flex items-center gap-2">
                            <span className="text-black">From:</span>
                            <span className="border-b border-black flex-1 text-center pb-1 text-black">{sheetRows.length > 0 ? sheetRows[0].micCode : ''}</span>
                            <span className="text-black">To:</span>
                            <span className="border-b border-black flex-1 text-center pb-1 text-black">{sheetRows.length > 0 ? sheetRows[sheetRows.length - 1].micCode : ''}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold min-w-[120px] text-black">Received Date:</span>
                        <div className="flex-1 flex items-center gap-2">
                            <span className="text-black">From:</span>
                            <span className="border-b border-black flex-1 text-center pb-1 text-black">{startDate}</span>
                            <span className="text-black">To:</span>
                            <span className="border-b border-black flex-1 text-center pb-1 text-black">{endDate}</span>
                        </div>
                    </div>
                </div>

                {/* Sample Description Section */}
                <div className="bg-gray-200 text-black p-2 font-bold mb-4 mt-6">Sample Description</div>
                <table className="w-full border-collapse mb-6 text-[11px]">
                    <thead>
                        <tr>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black">Lab Code</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black">MIC Code</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">No.</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black">Sample Type</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black">Index</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Result</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Isolate Fungi/Mold</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Pathogenic Fungi/Mold</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Range</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sheetRows.map((row, i) => (
                            <tr key={i} className="bg-white">
                                <td className="border border-black p-2 h-8 text-black">{row.labCode}</td>
                                <td className="border border-black p-2 text-black">{row.micCode}</td>
                                <td className="border border-black p-2 text-center text-black">{row.serialNo}</td>
                                <td className="border border-black p-2 text-black">{row.sampleType}</td>
                                <td className="border border-black p-2 text-black">{row.sampleIndex}</td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Footer */}
                <div className="text-center text-[10px] text-red-500 font-bold mt-8 pt-6 border-t-2 border-black">
                    CONFIDENTIAL. Use or transcription of this document is prohibited unless written authentication granted by Sahara Karbala Co. for Agriculture & Animal Production ®. ©2025 All rights reserved.
                </div>
                <div className="text-center text-xs mt-2 text-black">Page 1 of 2</div>
            </div>

            {/* Page 2 */}
            <div className="bg-white p-8 shadow-lg print:shadow-none print:p-0 max-w-[210mm] mx-auto mt-8">
                <div className="grid grid-cols-[120px_1fr_auto] gap-8 items-center border-b-4 border-black pb-4 mb-6">
                    <div className="w-[120px] h-[120px] flex items-center justify-center">
                        <img src="/assets/logo.png" alt="Sama Karbala Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-black mb-2">Fungal Isolation Technical Data Sheet</h1>
                    </div>
                    <div className="text-right">
                        <h2 className="text-lg font-bold text-black">Sama Karbala Co.</h2>
                        <h3 className="text-sm font-medium text-black">Laboratory Unit</h3>
                        <p className="text-sm font-bold mt-1 text-black">MIC 000 R001</p>
                    </div>
                </div>

                {/* Culture Section */}
                <div className="bg-gray-200 text-black p-2 font-bold mb-4 mt-6">Culture</div>
                <table className="w-full border-collapse mb-6 text-[11px]">
                    <thead>
                        <tr>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Media</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Batch №</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Incubator No.</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black" colSpan={2}>Start</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black" colSpan={2}>Incubation Temperature</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black" colSpan={2}>Incubation Period</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Result</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Operator Signature</th>
                        </tr>
                        <tr>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black">Day</th>
                            <th className="bg-gray-200 text-black p-2 border border-black">Time</th>
                            <th className="bg-gray-200 text-black p-2 border border-black">Temp. (℃)</th>
                            <th className="bg-gray-200 text-black p-2 border border-black">Range (℃)</th>
                            <th className="bg-gray-200 text-black p-2 border border-black">Period (d)</th>
                            <th className="bg-gray-200 text-black p-2 border border-black">Range (d)</th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="bg-white">
                            <td className="border border-black p-2 text-black">SDA</td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black">25±1℃</td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black">5-7 d</td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                        </tr>
                    </tbody>
                </table>

                {/* Confirmation Section */}
                <div className="bg-gray-200 text-black p-2 font-bold mb-4 mt-6">Confirmation</div>
                <table className="w-full border-collapse mb-6 text-[11px]">
                    <thead>
                        <tr>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Microscopic Examination</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Colony Morphology / Description</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Conidia</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Hyphae</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Result</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Operator Signature</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="bg-white">
                            <td className="border border-black p-2 h-20"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                        </tr>
                    </tbody>
                </table>

                {/* Signature Section */}
                <div className="grid grid-cols-3 gap-8 mt-12 pt-8 border-t-2 border-black">
                    <div className="text-left">
                        <label className="font-bold block mb-8 text-black">Technician:</label>
                        <div className="border-t border-black pt-2 mt-4 text-sm text-black">Sign: ___________________________</div>
                        <div className="border-t border-black pt-2 mt-4 text-sm text-black">Date: ___________________________</div>
                    </div>
                    <div className="text-left">
                        <label className="font-bold block mb-8 text-black">Head Unit:</label>
                        <div className="border-t border-black pt-2 mt-4 text-sm text-black">Sign: ___________________________</div>
                        <div className="border-t border-black pt-2 mt-4 text-sm text-black">Date: ___________________________</div>
                    </div>
                    <div className="text-left">
                        <label className="font-bold block mb-8 text-black">Quality Manager:</label>
                        <div className="border-t border-black pt-2 mt-4 text-sm text-black">Sign: ___________________________</div>
                        <div className="border-t border-black pt-2 mt-4 text-sm text-black">Date: ___________________________</div>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center text-[10px] text-red-500 font-bold mt-8 pt-6 border-t-2 border-black">
                    CONFIDENTIAL. Use or transcription of this document is prohibited unless written authentication granted by Sahara Karbala Co. for Agriculture & Animal Production ®. ©2025 All rights reserved.
                </div>
                <div className="text-center text-xs mt-2 text-black">Page 2 of 2</div>
            </div>
        </div>
    );
});

FungiSheet.displayName = 'FungiSheet';
