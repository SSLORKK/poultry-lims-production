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

interface TotalCountSheetRow extends BaseSheetRow { }

export const TotalCountSheet = forwardRef<SheetRef, SheetProps>(({ startDate, endDate }, ref) => {
    const [sheetRows, setSheetRows] = useState<TotalCountSheetRow[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchSamples = async () => {
            setLoading(true);
            try {
                const currentYear = new Date().getFullYear();
                const response = await apiClient.get('/samples/', {
                    params: { year: currentYear, department_id: 3 }
                });

                const rows: TotalCountSheetRow[] = [];
                response.data.forEach((sample: any) => {
                    if (!filterByDateRange(sample.date_received, startDate, endDate)) return;

                    sample.units?.forEach((unit: any) => {
                        if (unit.department_id === 3) {
                            const diseases = unit.microbiology_data?.diseases_list || [];
                            const hasTotalCount = diseases.some((d: string) => d.toLowerCase().includes('total count'));

                            if (hasTotalCount) {
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
            ['Total Count Technical Data Sheet'],
            ['Test Method:', 'ISO 4883-1:2013 / Amd.1:2022 (E)'],
            [],
            ['Lab Code', 'MIC Code', 'Sample Type', 'No.', 'Sample Index', 'Test Portion-Weight(g)±5%', 'BPW Volume (ml)'],
            ...sheetRows.map(row => [
                row.labCode,
                row.micCode,
                row.sampleType,
                row.serialNo,
                row.sampleIndex,
                '',
                ''
            ])
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wscols = [
            { wch: 15 },
            { wch: 15 },
            { wch: 20 },
            { wch: 5 },
            { wch: 15 },
            { wch: 25 },
            { wch: 15 }
        ];
        ws['!cols'] = wscols;
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];

        XLSX.utils.book_append_sheet(wb, ws, 'Total Count Sheet');
        XLSX.writeFile(wb, `Total_Count_Sheet_${startDate}_${endDate}.xlsx`);
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
        const rowsPerDescriptionPage = 30;
        const rowsPerResultsPage = 20;

        const descriptionPageCount = Math.max(1, Math.ceil(sheetRows.length / rowsPerDescriptionPage));
        const resultsPageCount = Math.max(1, Math.ceil(sheetRows.length / rowsPerResultsPage));

        const pdfTotalPages = descriptionPageCount + resultsPageCount + 1; // Description + Results + Procedures

        // Generate Description Pages
        let descriptionPagesHtml = '';
        for (let i = 0; i < descriptionPageCount; i++) {
            const batchRows = sheetRows.slice(i * rowsPerDescriptionPage, (i + 1) * rowsPerDescriptionPage);
            const batchRowsHtml = batchRows.map((row) => {
                return `
        <tr>
          <td>${escapeHtml(row.labCode)}</td>
          <td>${escapeHtml(row.micCode)}</td>
          <td>${escapeHtml(row.sampleType)}</td>
          <td style="text-align: center">${escapeHtml(row.serialNo)}</td>
          <td>${escapeHtml(row.sampleIndex)}</td>
          <td></td>
          <td></td>
        </tr>
      `;
            }).join('');

            // Determine range for this page
            const firstRow = batchRows.length > 0 ? batchRows[0] : (sheetRows.length > 0 ? sheetRows[0] : { labCode: '_____', micCode: '_____' });
            const lastRow = batchRows.length > 0 ? batchRows[batchRows.length - 1] : (sheetRows.length > 0 ? sheetRows[sheetRows.length - 1] : { labCode: '_____', micCode: '_____' });

            const infoGrid = i === 0 ? `
    <div class="info-grid">
      <div class="info-field" style="grid-column: 1 / -1;">
        <label>Lab. Code:</label> From ${escapeHtml(firstRow.labCode || '_____')} To ${escapeHtml(lastRow.labCode || '_____')}
      </div>
      <div class="info-field" style="grid-column: 1 / -1;">
        <label>MIC Code:</label> From ${escapeHtml(firstRow.micCode || '_____')} To ${escapeHtml(lastRow.micCode || '_____')}
      </div>
      <div class="info-field"><label>Date of Receipt:</label> From ${escapeHtml(startDate)} To ${escapeHtml(endDate)}</div>
      <div class="info-field"><label>Test Date:</label> _____________</div>
    </div>` : '';

            descriptionPagesHtml += `
  <div class="page">
    <div class="header">
      <div><img src="/assets/logo.png" alt="Logo" class="logo"></div>
      <div style="text-align: center;">
        <h1>Total Count Technical Data Sheet</h1>
        <p style="font-size: 11px;"><strong>Test Method:</strong> ISO 4883-1:2013 / Amd.1:2022 (E)</p>
      </div>
      <div style="text-align: right;">
        <h2>Sama Karbala</h2>
        <h3>Laboratory Unit</h3>
        <p><strong>MIC 000 R001</strong></p>
      </div>
    </div>
    ${infoGrid}
    <div class="section-title">Sample Description</div>
    <table>
      <thead><tr><th>Lab Code</th><th>MIC Code</th><th>Sample Type</th><th>No.</th><th>Sample Index</th><th>Test Portion (Weight ±5%)</th><th>BPW Volume (ml)</th></tr></thead>
      <tbody>${batchRowsHtml}</tbody>
    </table>
    <div class="footer">CONFIDENTIAL. Use or transcription of this document is prohibited unless written authentication granted by Sama Karbala Co. for Agriculture & Animal Production ®. ©2025 All rights reserved.</div>
    <div class="page-number">Page ${1 + i} of ${pdfTotalPages}</div>
  </div>`;
        }

        // Generate Results Pages
        let resultsPagesHtml = '';
        for (let i = 0; i < resultsPageCount; i++) {
            const batchRows = sheetRows.slice(i * rowsPerResultsPage, (i + 1) * rowsPerResultsPage);
            const batchRowsHtml = batchRows.map((row) => {
                return `
        <tr>
          <td style="font-size: 11px;">${escapeHtml(row.labCode)}</td>
          <td style="font-size: 11px;">${escapeHtml(row.micCode)}</td>
          <td>${escapeHtml(row.serialNo)}</td>
          <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
        </tr>
      `;
            }).join('');

            resultsPagesHtml += `
  <div class="page" style="min-height: 297mm; display: flex; align-items: center; justify-content: center; padding: 0;">
    <div style="transform: rotate(90deg); transform-origin: center; width: 297mm; height: 210mm; padding: 0mm;">
      <div class="header" style="margin-bottom: 4px; padding-bottom: 2px;">
        <div><img src="/assets/logo.png" alt="Logo" style="width: 50px;"></div>
        <div style="text-align: center;"><h1 style="font-size: 16px;">Total Count Technical Data Sheet - Results(CFU)</h1></div>
        <div style="text-align: right;"><h2 style="font-size: 12px;">Sama Karbala</h2><h3 style="font-size: 10px;">Laboratory Unit</h3></div>
      </div>
      <table style="font-size: 10px; width: 100%;">
        <thead>
          <tr style="height: 45px;"><th rowspan="2">Lab Code</th><th rowspan="2">MIC Code</th><th rowspan="2">No.</th><th rowspan="2">Dilution</th><th colspan="6">Total Bacterial Count</th><th colspan="4">Total Fungal Count</th><th rowspan="2">Pathogenic Fungi & Mould</th></tr>
          <tr style="height: 45px;"><th style="min-width: 60px;">Log1</th><th style="min-width: 60px;">Log2</th><th style="min-width: 60px;">Log3</th><th style="min-width: 60px;">Log4</th><th style="min-width: 60px;">Log5</th><th>Results(CFU)</th><th style="min-width: 60px;">Log1</th><th style="min-width: 60px;">Log2</th><th style="min-width: 60px;">Log3</th><th>Result (CFU/g)</th></tr>
        </thead>
        <tbody>${batchRowsHtml}</tbody>
      </table>
      <div class="footer" style="margin-top: 8px; padding-top: 4px;">CONFIDENTIAL. Use or transcription of this document is prohibited unless written authentication granted by Sama Karbala Co. for Agriculture & Animal Production ®. ©2025 All rights reserved.</div>
      <div class="page-number">Page ${descriptionPageCount + 1 + i} of ${pdfTotalPages}</div>
    </div>
  </div>`;
        }

        return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Total Count Technical Data Sheet</title>
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
      .page { box-shadow: none; margin: 0; padding: 4mm; width: 210mm; min-height: 297mm; page-break-after: always; }
      @page { size: A4 portrait; margin: 1mm; }
    }
  </style>
</head>
<body>
  ${descriptionPagesHtml}
  ${resultsPagesHtml}

  <div class="page">
    <div class="header">
      <div><img src="/assets/logo.png" alt="Logo" class="logo"></div>
      <div style="text-align: center;">
        <h1>Total Count Technical Data Sheet</h1>
      </div>
      <div style="text-align: right;">
        <h2>Sama Karbala</h2>
        <h3>Laboratory Unit</h3>
        <p><strong>MIC 000 R001</strong></p>
      </div>
    </div>
    <div class="section-title">Suspension Procedure</div>
    <table>
      <thead><tr><th>Item</th><th>Time (min)</th><th>Range (min)</th><th>Operator Signature</th></tr></thead>
      <tbody>
        <tr><td><strong>BPW Suspension</strong><br>Time elapsed until initial BPW suspension (per min)</td><td></td><td>Max 15 min</td><td></td></tr>
        <tr><td><strong>Serial dilution</strong><br>Time elapsed until pouring test media start (per min)</td><td></td><td>Max 45 min</td><td></td></tr>
      </tbody>
    </table>
    <div class="section-title">Media</div>
    <table>
      <thead><tr><th>Item</th><th>Batch №</th><th>Volume (ml)</th><th>Range (ml)</th><th>Temp. (℃)</th><th>Range (℃)</th><th>Time (min)</th><th>Range (min)</th><th>Operator Date/Signature</th></tr></thead>
      <tbody>
        <tr><td>SDA</td><td></td><td></td><td>12-15ml</td><td></td><td>44-47℃</td><td></td><td>Max 45 min</td><td></td></tr>
        <tr><td>PCA</td><td></td><td></td><td>18-20ml</td><td></td><td>44-47℃</td><td></td><td>Max 45 min</td><td></td></tr>
        <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>
    <div class="section-title">Incubation Conditions</div>
    <table>
      <thead>
        <tr><th rowspan="2">Item</th><th rowspan="2">Incubator Name/№</th><th colspan="2">Start</th><th rowspan="2">Temp. (℃)</th><th rowspan="2">Range (℃)</th><th rowspan="2">Period (h)</th><th rowspan="2">Range (h)</th><th rowspan="2">Operator Date/Signature</th></tr>
        <tr><th>Day</th><th>Time</th></tr>
      </thead>
      <tbody>
        <tr><td>SDA</td><td></td><td></td><td></td><td></td><td>25 ± 1℃</td><td></td><td>72h ± 3h</td><td></td></tr>
        <tr><td>PCA</td><td></td><td></td><td></td><td></td><td>30 ± 1℃</td><td></td><td>72h ± 3h</td><td></td></tr>
        <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>
    <div class="signature-section">
      <div class="signature-box"><label>Technician:</label><div class="signature-line">Sign: _______________</div><div class="signature-line">Date: _______________</div></div>
      <div class="signature-box"><label>Head Unit:</label><div class="signature-line">Sign: _______________</div><div class="signature-line">Date: _______________</div></div>
      <div class="signature-box"><label>Quality Manager:</label><div class="signature-line">Sign: _______________</div><div class="signature-line">Date: _______________</div></div>
    </div>
    <div class="footer">CONFIDENTIAL. Use or transcription of this document is prohibited unless written authentication granted by Sama Karbala Co. for Agriculture & Animal Production ®. ©2025 All rights reserved.</div>
    <div class="page-number">Page ${pdfTotalPages} of ${pdfTotalPages}</div>
  </div>
</body>
</html>
    `;
    };

    if (loading) {
        return <div className="text-center py-10 font-bold text-gray-500">Loading samples...</div>;
    }

    return (
        <div className="w-fit mx-auto">
            <div ref={sheetRef} className="bg-white p-8 shadow-lg print:shadow-none print:p-0 max-w-[210mm] mx-auto mb-12 relative">
                {/* Header */}
                <div className="grid grid-cols-[120px_1fr_auto] gap-8 items-center border-b-4 border-black pb-4 mb-6">
                    <div className="w-[120px] h-[120px] flex items-center justify-center">
                        <img src="/assets/logo.png" alt="Sama Karbala Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-black mb-2">Total Count Technical Data Sheet</h1>
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
                        <span className="text-black">ISO 4883-1:2013 / Amd.1:2022 (E)</span>
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
                            <th className="bg-gray-200 text-black p-2 text-left border border-black">Sample Type</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black w-12">No.</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black w-20">Sample Index</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black w-24">TestPortion-Weight(g)±5%</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black">BPW Volume (ml)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sheetRows.map((row, i) => (
                            <tr key={i} className="bg-white">
                                <td className="border border-black p-2 h-8 text-black">{row.labCode}</td>
                                <td className="border border-black p-2 text-black">{row.micCode}</td>
                                <td className="border border-black p-2 text-black">{row.sampleType}</td>
                                <td className="border border-black p-2 text-center text-black">{row.serialNo}</td>
                                <td className="border border-black p-2 text-black">{row.sampleIndex}</td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Footer Page 1 */}
                <div className="text-center text-[10px] text-red-500 font-bold mt-8 pt-6 border-t-2 border-black">
                    CONFIDENTIAL. Use or transcription of this document is prohibited unless written authentication granted by Sama Karbala Co. for Agriculture & Animal Production ®. ©2025 All rights reserved.
                </div>

            </div>

            {/* PAGE 2 - LANDSCAPE RESULTS */}
            <div className="relative bg-white shadow-lg mt-12 mb-8 mx-auto flex flex-col items-center" style={{ width: '330mm', minHeight: '210mm', height: 'auto', padding: '10mm' }}>
                <div className="w-full">
                    <div className="w-full p-0">
                        {/* Header for Results Page */}
                        <div className="grid grid-cols-[50px_1fr_auto] gap-8 items-center border-b-2 border-black pb-2 mb-4">
                            <div className="text-left">
                                <div className="w-[50px] h-[50px] flex items-center justify-center">
                                    <img src="/assets/logo.png" alt="Sama Karbala Logo" className="w-full h-full object-contain" />
                                </div>
                            </div>
                            <div className="text-center">
                                <h1 className="text-lg font-bold text-black">Total Count Technical Data Sheet</h1>
                            </div>
                            <div className="text-right">
                                <h2 className="text-sm font-bold text-black">Sama Karbala</h2>
                                <h3 className="text-xs font-medium text-black">Laboratory Unit</h3>
                            </div>
                        </div>

                        {/* Results Table */}
                        <table className="w-full border-collapse text-[10px]">
                            <thead>
                                <tr>
                                    <th className="bg-gray-200 text-black p-1 text-center border border-black whitespace-nowrap" rowSpan={2}>Lab Code</th>
                                    <th className="bg-gray-200 text-black p-1 text-center border border-black whitespace-nowrap" rowSpan={2}>MIC Code</th>
                                    <th className="bg-gray-200 text-black p-1 text-center border border-black whitespace-nowrap" rowSpan={2}>No.</th>
                                    <th className="bg-gray-200 text-black p-1 text-center border border-black whitespace-nowrap" rowSpan={2}>Dilution</th>
                                    <th className="bg-gray-200 text-black p-1 text-center border border-black whitespace-nowrap" colSpan={6}>Total Bacterial Count</th>
                                    <th className="bg-gray-200 text-black p-1 text-center border border-black whitespace-nowrap" colSpan={4}>Total Fungal Count</th>
                                    <th className="bg-gray-200 text-black p-1 text-center border border-black whitespace-nowrap" rowSpan={2}>Pathogenic Fungi & Mould</th>
                                </tr>
                                <tr>
                                    <th className="bg-gray-200 text-black p-1 text-center border border-black whitespace-nowrap">Log1</th>
                                    <th className="bg-gray-200 text-black p-1 text-center border border-black whitespace-nowrap">Log2</th>
                                    <th className="bg-gray-200 text-black p-1 text-center border border-black whitespace-nowrap">Log3</th>
                                    <th className="bg-gray-200 text-black p-1 text-center border border-black whitespace-nowrap">Log4</th>
                                    <th className="bg-gray-200 text-black p-1 text-center border border-black whitespace-nowrap">Log5</th>
                                    <th className="bg-gray-200 text-black p-1 text-center border border-black whitespace-nowrap">Result</th>
                                    <th className="bg-gray-200 text-black p-1 text-center border border-black whitespace-nowrap">Log1</th>
                                    <th className="bg-gray-200 text-black p-1 text-center border border-black whitespace-nowrap">Log2</th>
                                    <th className="bg-gray-200 text-black p-1 text-center border border-black whitespace-nowrap">Log3</th>
                                    <th className="bg-gray-200 text-black p-1 text-center border border-black whitespace-nowrap">Result</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sheetRows.map((row, i) => (
                                    <tr key={i} className="bg-white h-8">
                                        <td className="border border-black p-1 text-center text-xs text-black whitespace-nowrap">{row.labCode}</td>
                                        <td className="border border-black p-1 text-center text-xs text-black whitespace-nowrap">{row.micCode}</td>
                                        <td className="border border-black p-1 text-center text-black whitespace-nowrap">{row.serialNo}</td>
                                        <td className="border border-black p-1 text-center whitespace-nowrap"></td>
                                        <td className="border border-black p-1 text-center whitespace-nowrap"></td>
                                        <td className="border border-black p-1 text-center whitespace-nowrap"></td>
                                        <td className="border border-black p-1 text-center whitespace-nowrap"></td>
                                        <td className="border border-black p-1 text-center whitespace-nowrap"></td>
                                        <td className="border border-black p-1 text-center whitespace-nowrap"></td>
                                        <td className="border border-black p-1 text-center whitespace-nowrap"></td>
                                        <td className="border border-black p-1 text-center whitespace-nowrap"></td>
                                        <td className="border border-black p-1 text-center whitespace-nowrap"></td>
                                        <td className="border border-black p-1 text-center whitespace-nowrap"></td>
                                        <td className="border border-black p-1 text-center whitespace-nowrap"></td>
                                        <td className="border border-black p-1 text-center whitespace-nowrap"></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>



                        {/* Footer */}
                        <div className="text-center text-[8px] text-red-600 font-bold mt-2 pt-4 border-t-2 border-black">
                            CONFIDENTIAL. Use or transcription of this document is prohibited unless written authentication granted by Sama Karbala Co. for Agriculture & Animal Production ®. ©2025 All rights reserved.
                        </div>


                    </div>
                </div>
            </div>

            {/* PAGE 3 - PROCEDURES */}
            <div className="bg-white p-8 shadow-lg print:shadow-none print:p-0 max-w-[210mm] mx-auto mb-12 relative">
                {/* Header Page 3 */}
                <div className="grid grid-cols-[120px_1fr_auto] gap-8 items-center border-b-4 border-black pb-4 mb-6">
                    <div className="w-[120px] h-[120px] flex items-center justify-center">
                        <img src="/assets/logo.png" alt="Sama Karbala Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-black mb-2">Total Count Technical Data Sheet</h1>
                    </div>
                    <div className="text-right">
                        <h2 className="text-lg font-bold text-black">Sama Karbala Co.</h2>
                        <h3 className="text-sm font-medium text-black">Laboratory Unit</h3>
                        <p className="text-sm font-bold mt-1 text-black">MIC 000 R001</p>
                    </div>
                </div>

                {/* Suspension Procedure */}
                <div className="bg-gray-200 text-black p-2 font-bold mb-4 mt-6">Suspension Procedure</div>
                <table className="w-full border-collapse mb-6 text-[11px]">
                    <thead>
                        <tr>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black">Item</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black">Time (min)</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black">Range (min)</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black">Operator Signature</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="bg-white">
                            <td className="border border-black p-2 text-black"><strong>BPW Suspension</strong><br />Time elapsed until initial BPW suspension (per min)</td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black">Max 15 min</td>
                            <td className="border border-black p-2"></td>
                        </tr>
                        <tr className="bg-white">
                            <td className="border border-black p-2 text-black"><strong>Serial dilution</strong><br />Time elapsed until pouring test media start (per min)</td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black">Max 45 min</td>
                            <td className="border border-black p-2"></td>
                        </tr>
                    </tbody>
                </table>

                {/* Media */}
                <div className="bg-gray-200 text-black p-2 font-bold mb-4 mt-6">Media</div>
                <table className="w-full border-collapse mb-6 text-[11px]">
                    <thead>
                        <tr>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black">Item</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black">Batch №</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black">Volume (ml)</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black">Range (ml)</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black">Temp. (℃)</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black">Range (℃)</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black">Time (min)</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black">Range (min)</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black">Operator Date/Signature</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="bg-white">
                            <td className="border border-black p-2 font-medium text-black">SDA</td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black">12-15ml</td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black">44-47℃</td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black">Max 45 min</td>
                            <td className="border border-black p-2"></td>
                        </tr>
                        <tr className="bg-white">
                            <td className="border border-black p-2 font-medium text-black">PCA</td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black">18-20ml</td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black">44-47℃</td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black">Max 45 min</td>
                            <td className="border border-black p-2"></td>
                        </tr>
                        <tr className="bg-white">
                            <td className="border border-black p-2 font-medium text-black"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black"></td>
                            <td className="border border-black p-2"></td>
                        </tr>
                    </tbody>
                </table>

                {/* Incubation Conditions */}
                <div className="bg-gray-200 text-black p-2 font-bold mb-4 mt-6">Incubation Conditions</div>
                <table className="w-full border-collapse mb-6 text-[11px]">
                    <thead>
                        <tr>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black" rowSpan={2}>Item</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black" rowSpan={2}>Incubator Name/№</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black" colSpan={2}>Start</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black" rowSpan={2}>Temp. (℃)</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black" rowSpan={2}>Range (℃)</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black" rowSpan={2}>Period (h)</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black" rowSpan={2}>Range (h)</th>
                            <th className="bg-gray-200 text-black p-2 text-left border border-black" rowSpan={2}>Operator Date/Signature</th>
                        </tr>
                        <tr>
                            <th className="bg-gray-200 text-black p-2 border border-black">Day</th>
                            <th className="bg-gray-200 text-black p-2 border border-black">Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="bg-white">
                            <td className="border border-black p-2 font-medium text-black">SDA</td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black">25 ± 1℃</td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black">72h ± 3h</td>
                            <td className="border border-black p-2"></td>
                        </tr>
                        <tr className="bg-white">
                            <td className="border border-black p-2 font-medium text-black">PCA</td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black">30 ± 1℃</td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black">72h ± 3h</td>
                            <td className="border border-black p-2"></td>
                        </tr>
                        <tr className="bg-white">
                            <td className="border border-black p-2 font-medium text-black"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black"></td>
                            <td className="border border-black p-2"></td>
                        </tr>
                    </tbody>
                </table>

                {/* Signature Section */}
                <div className="grid grid-cols-3 gap-8 mt-12 pt-8 border-t-2 border-black">
                    <div className="text-left">
                        <label className="font-bold block mb-8 text-black">Technician:</label>
                        <div className="border-t border-black pt-2 mt-4 text-sm text-black">Name: ___________________________</div>
                        <div className="border-t border-black pt-2 mt-4 text-sm text-black">Sign: ___________________________</div>
                        <div className="border-t border-black pt-2 mt-4 text-sm text-black">Date: ___________________________</div>
                    </div>
                    <div className="text-left">
                        <label className="font-bold block mb-8 text-black">Head Unit:</label>
                        <div className="border-t border-black pt-2 mt-4 text-sm text-black">Name: ___________________________</div>
                        <div className="border-t border-black pt-2 mt-4 text-sm text-black">Sign: ___________________________</div>
                        <div className="border-t border-black pt-2 mt-4 text-sm text-black">Date: ___________________________</div>
                    </div>
                    <div className="text-left">
                        <label className="font-bold block mb-8 text-black">Quality Manager:</label>
                        <div className="border-t border-black pt-2 mt-4 text-sm text-black">Name: ___________________________</div>
                        <div className="border-t border-black pt-2 mt-4 text-sm text-black">Sign: ___________________________</div>
                        <div className="border-t border-black pt-2 mt-4 text-sm text-black">Date: ___________________________</div>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center text-[10px] text-red-500 font-bold mt-8 pt-6 border-t-2 border-black">
                    CONFIDENTIAL. Use or transcription of this document is prohibited unless written authentication granted by Sama Karbala Co. for Agriculture & Animal Production ®. ©2025 All rights reserved.
                </div>

            </div>
        </div >
    );
});

TotalCountSheet.displayName = 'TotalCountSheet';
