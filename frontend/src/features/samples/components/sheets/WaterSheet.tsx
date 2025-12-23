import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { apiClient } from '../../../../services/apiClient';
import XLSX from 'xlsx-js-style';

import {
    escapeHtml,
    addSerialNumbers,
    filterByDateRange,
    sortByMicCode,
    calculateRowColors
} from '../../utils/sheetUtils';
import { SheetRef, SheetProps, BaseSheetRow } from '../../types/sheetTypes';

interface WaterSheetRow extends BaseSheetRow {
    dilutionFactor: string;
    waterVolume: string;
}

export const WaterSheet = forwardRef<SheetRef, SheetProps>(({ startDate, endDate }, ref) => {
    const [sheetRows, setSheetRows] = useState<WaterSheetRow[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchSamples = async () => {
            setLoading(true);
            try {
                const currentYear = new Date().getFullYear();
                const response = await apiClient.get('/samples/', {
                    params: { year: currentYear, department_id: 3 }
                });

                const rows: WaterSheetRow[] = [];
                response.data.forEach((sample: any) => {
                    if (!filterByDateRange(sample.date_received, startDate, endDate)) return;

                    sample.units?.forEach((unit: any) => {
                        if (unit.department_id === 3) {
                            const diseases = unit.microbiology_data?.diseases_list || [];
                            const hasWaterTest = diseases.some((d: string) => d.toLowerCase().includes('water'));

                            if (hasWaterTest) {
                                const indices = unit.microbiology_data?.index_list || [];
                                const sampleType = Array.isArray(unit.sample_type) ? unit.sample_type.join(', ') : (unit.sample_type || '');

                                if (indices.length > 0) {
                                    indices.forEach((idx: string) => {
                                        rows.push({
                                            labCode: sample.sample_code,
                                            micCode: unit.unit_code,
                                            sampleType: sampleType,
                                            sampleIndex: idx,
                                            serialNo: 0,
                                            dilutionFactor: '',
                                            waterVolume: ''
                                        });
                                    });
                                } else {
                                    rows.push({
                                        labCode: sample.sample_code,
                                        micCode: unit.unit_code,
                                        sampleType: sampleType,
                                        sampleIndex: '-',
                                        serialNo: 0,
                                        dilutionFactor: '',
                                        waterVolume: ''
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

    // Use exact number of rows, no padding
    const displayRows = sheetRows;

    const rowColors = calculateRowColors(displayRows);

    const sheetRef = useRef<HTMLDivElement>(null);

    const exportToExcel = () => {
        const rowsPerSheet = 30;
        const totalSheetsNeeded = Math.ceil(sheetRows.length / rowsPerSheet);
        
        for (let sheetIndex = 0; sheetIndex < totalSheetsNeeded; sheetIndex++) {
            const wb = XLSX.utils.book_new();
            const startRow = sheetIndex * rowsPerSheet;
            const endRow = Math.min(startRow + rowsPerSheet, sheetRows.length);
            const currentSheetRows = sheetRows.slice(startRow, endRow);
            const sheetNumber = sheetIndex + 1;

            // Page 1: Sample Description (limited to 30 rows)
            const page1Data = [
                ['Water Microbiology Testing Technical Data Sheet'],
                ['Test Method:', 'Standard method (2018),9215 A, B and C - Part 9000 – ISO 16266: (2006)'],
                [],
                ['Lab Code', 'MIC Code', 'No.', 'Sample Type', 'Sample Index', 'Dilution Factor', 'Water Volume (ml)'],
                ...currentSheetRows.map(row => [
                    row.labCode,
                    row.micCode,
                    row.serialNo,
                    row.sampleType,
                    row.sampleIndex,
                    row.dilutionFactor,
                    row.waterVolume
                ])
            ];

            const ws1 = XLSX.utils.aoa_to_sheet(page1Data);
            const wscols1 = [
                { wch: 15 }, // Lab Code
                { wch: 15 }, // MIC Code
                { wch: 5 },  // No.
                { wch: 20 }, // Sample Type
                { wch: 15 }, // Sample Index
                { wch: 15 }, // Dilution Factor
                { wch: 15 }  // Water Volume
            ];
            ws1['!cols'] = wscols1;
            ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];

            // Page 2: Count Water
            const page2Data = [
                ['Count: Water'],
                [],
                ['Media', 'Batch №', 'Incubator No./name', 'Start Day', 'Start Time', 'Temp. (℃)', 'Range (℃)', 'Period (h)', 'Range (h)', 'Result', 'Operator Signature/Date'],
                ['Pseudo. Cetr.', '', '', '', '', '', '', '', '', '', ''],
                ['Endo', '', '', '', '', '', '', '', '', '', ''],
                ['R2A', '', '', '', '', '', '', '', '', '', '']
            ];

            const ws2 = XLSX.utils.aoa_to_sheet(page2Data);
            const wscols2 = [
                { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 10 },
                { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 20 }
            ];
            ws2['!cols'] = wscols2;

            // Page 3: Media Count Results (limited to same 30 rows)
            const page3Data = [
                ['Media – Count result per 25 ml'],
                [],
                ['Lab Code', 'MIC Code', 'NO.', 'Total Bacterial Count<br />CFU per 25 ml', 'TOTAL Coliform Count<br />CFU per 25 ml', 'TOTAL E. Coli Count<br />CFU per 25 ml', 'TOTAL Pseudomonas Count<br />CFU per 25 ml'],
                ...currentSheetRows.map(row => [
                    row.labCode,
                    row.micCode,
                    row.serialNo,
                    '', // TBC Count
                    '', // Coliform Count
                    '', // E. Coli Count
                    ''  // Pseudomonas Count
                ])
            ];

            const ws3 = XLSX.utils.aoa_to_sheet(page3Data);
            const wscols3 = [
                { wch: 15 }, { wch: 15 }, { wch: 5 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
            ];
            ws3['!cols'] = wscols3;

            XLSX.utils.book_append_sheet(wb, ws1, 'Sample Description');
            XLSX.utils.book_append_sheet(wb, ws2, 'Count Water');
            XLSX.utils.book_append_sheet(wb, ws3, 'Media Count Results');

            // Add sheet number to filename if multiple sheets
            const filename = totalSheetsNeeded > 1 
                ? `Water_Microbiology_Sheet_${startDate}_${endDate}_Part${sheetNumber}.xlsx`
                : `Water_Microbiology_Sheet_${startDate}_${endDate}.xlsx`;
            
            XLSX.writeFile(wb, filename);
        }
    };

    // HTML escape function to prevent XSS attacks


    const generatePDFTemplate = () => {
        // Pagination for Sample Description table
        const rowsPerPage = 30;
        const sampleDescriptionPagesCount = Math.ceil(displayRows.length / rowsPerPage) || 1;
        const totalPages = sampleDescriptionPagesCount + 1 + sampleDescriptionPagesCount; // Sample Description + Count Water + Media Count Results pages

        let sampleDescriptionPagesHtml = '';

        for (let i = 0; i < sampleDescriptionPagesCount; i++) {
            const start = i * rowsPerPage;
            const end = start + rowsPerPage;
            const pageRows = displayRows.slice(start, end);

            const tableRowsHtml = pageRows.map((row, j) => {
                const bgColor = rowColors[start + j] === 'bg-gray-200' ? '#e5e7eb' : '#ffffff';
                return `
                    <tr style="background-color: ${bgColor}">
                        <td>${escapeHtml(row.labCode)}</td>
                        <td>${escapeHtml(row.micCode)}</td>
                        <td style="text-align: center">${escapeHtml(row.serialNo)}</td>
                        <td>${escapeHtml(row.sampleType)}</td>
                        <td>${escapeHtml(row.sampleIndex)}</td>
                        <td></td>
                        <td></td>
                    </tr>
                `;
            }).join('');

            // Info Grid only on first page (i === 0)
            const infoGrid = i === 0 ? `
        <div class="info-grid">
            <div class="info-field"><label>Lab. Code:</label> ${escapeHtml(sheetRows.length > 0 ? `${sheetRows[0].labCode} - ${sheetRows[sheetRows.length - 1].labCode}` : '_____________')}</div>
            <div class="info-field"><label>MIC code:</label> ${escapeHtml(sheetRows.length > 0 ? `${sheetRows[0].micCode} - ${sheetRows[sheetRows.length - 1].micCode}` : '_____________')}</div>
            <div class="info-field"><label>Date of Receipt:</label> ${escapeHtml(startDate && endDate ? `${startDate} to ${endDate}` : '_____________')}</div>
            <div class="info-field"><label>Test Date:</label> _____________</div>
        </div>

        <div class="test-method">
            <strong>Test Method:</strong> Standard method (2018),9215 A, B and C - Part 9000 – ISO 16266: (2006).
        </div>` : '';

            sampleDescriptionPagesHtml += `
    <div class="page">
        <div class="header">
            <div class="header-left">
                <img src="/assets/logo.png" alt="Sama Karbala Logo" class="logo">
            </div>
            <div class="header-center">
                <h1>Water Microbiology Testing Technical Data Sheet</h1>
            </div>
            <div class="header-right">
                <h2>Sama Karbala</h2>
                <h3>Laboratory Unit</h3>
                <p><strong>COA MIC 000 R001</strong></p>
            </div>
        </div>

        <div class="page-info">Page ${i + 1} of ${totalPages}</div>

        ${infoGrid}

        <div class="section-title">Sample Description</div>
        <table>
            <thead>
                <tr>
                    <th>Lab code</th>
                    <th>MIC code</th>
                    <th>No.</th>
                    <th>Sample type</th>
                    <th>Sample index</th>
                    <th>Dilution Factor</th>
                    <th>Water Volume (ml)</th>
                </tr>
            </thead>
            <tbody>
                ${tableRowsHtml}
            </tbody>
        </table>

        <div class="footer">
            CONFIDENTIAL. Use or transcription of this document is prohibited unless written authentication granted by Sahara Karbala Co. for Agriculture & Animal Production ®. ©${new Date().getFullYear()} All rights reserved.
            <div class="page-number">Page ${i + 1} of ${totalPages}</div>
        </div>
    </div>`;
        }

        // Generate media count result rows with pagination
        let mediaCountPagesHtml = '';
        
        for (let i = 0; i < sampleDescriptionPagesCount; i++) {
            const start = i * rowsPerPage;
            const end = start + rowsPerPage;
            const pageRows = displayRows.slice(start, end);

            const mediaCountTableRowsHtml = pageRows.map((row, j) => {
                const bgColor = rowColors[start + j] === 'bg-gray-200' ? '#e5e7eb' : '#ffffff';
                return `
                    <tr style="background-color: ${bgColor}">
                        <td>${escapeHtml(row.labCode)}</td>
                        <td>${escapeHtml(row.micCode)}</td>
                        <td style="text-align: center">${escapeHtml(row.serialNo)}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                `;
            }).join('');

            const currentPageNumber = sampleDescriptionPagesCount + 2 + i; // Sample Description pages + Count Water page (1) + current media count page index
            const isLastPage = i === sampleDescriptionPagesCount - 1;

            mediaCountPagesHtml += `
    <!-- PAGE ${currentPageNumber}: Media Count Results -->
    <div class="page">
        <div class="header">
            <div class="header-left">
                <img src="/assets/logo.png" alt="Sama Karbala Logo" class="logo">
            </div>
            <div class="header-center">
                <h1>Water Microbiology Testing Technical Data Sheet</h1>
            </div>
            <div class="header-right">
                <h2>Sama Karbala</h2>
                <h3>Laboratory Unit</h3>
                <p><strong>COA MIC 000 R001</strong></p>
            </div>
        </div>

        <div class="page-info">Page ${currentPageNumber} of ${totalPages}</div>

        <div class="section-title">Media – Count result per 25 ml</div>
        <table>
            <thead>
                <tr>
                    <th>Lab code</th>
                    <th>MIC code</th>
                    <th>NO.</th>
                    <th>Total Bacterial Count<br />CFU per 25 ml</th>
                    <th>TOTAL Coliform Count<br />CFU per 25 ml</th>
                    <th>TOTAL E.Coli Count<br />CFU per 25 ml</th>
                    <th>TOTAL Pseudomonas Count<br />CFU per 25 ml</th>
                </tr>
            </thead>
            <tbody>
                ${mediaCountTableRowsHtml}
            </tbody>
        </table>

        ${isLastPage ? `
        <div class="signature-section">
            <div class="signature-box">
                <label>Tech Sign.</label>
                <div class="signature-line">Sign: _________________</div>
                <div class="signature-line">Date: _________________</div>
            </div>
            <div class="signature-box">
                <label>Head Unit Sign.</label>
                <div class="signature-line">Sign: _________________</div>
                <div class="signature-line">Date: _________________</div>
            </div>
            <div class="signature-box">
                <label>Supervisor. Sign.</label>
                <div class="signature-line">Sign: _________________</div>
                <div class="signature-line">Date: _________________</div>
            </div>
        </div>` : ''}

        <div class="footer">
            CONFIDENTIAL. Use or transcription of this document is prohibited unless written authentication granted by Sahara Karbala Co. for Agriculture & Animal Production ®. ©${new Date().getFullYear()} All rights reserved.
            <div class="page-number">Page ${currentPageNumber} of ${totalPages}</div>
        </div>
    </div>`;
        }

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Water Microbiology Testing Technical Data Sheet - COA MIC 000 R001</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        .page {
            max-width: 210mm;
            margin: 0 auto 30px auto;
            background-color: white;
            padding: 4mm;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            page-break-after: always;
        }
        .page:last-child {
            page-break-after: auto;
        }
        .header {
            border-bottom: 2px solid #333;
            padding-bottom: 8px;
            margin-bottom: 12px;
            display: grid;
            grid-template-columns: 70px 1fr auto;
            align-items: center;
            gap: 12px;
        }
        .header-left {
            text-align: left;
        }
        .header-center {
            text-align: center;
        }
        .header-right {
            text-align: right;
        }
        .logo {
            width: 70px;
            height: auto;
        }
        .header h1 {
            color: #2c3e50;
            margin: 4px 0;
            font-size: 18px;
        }
        .header h2 {
            margin: 3px 0;
            font-size: 13px;
        }
        .header h3 {
            margin: 3px 0;
            font-size: 11px;
        }
        .header-right p {
            margin: 3px 0;
            font-size: 11px;
        }
        .page-info {
            text-align: right;
            font-size: 9px;
            margin-bottom: 10px;
            color: #555;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin-bottom: 15px;
        }
        .info-field {
            border: 1px solid #ddd;
            padding: 5px;
            background-color: #f9f9f9;
            font-size: 10px;
            color: black;
        }
        .info-field label {
            font-weight: bold;
            font-size: 10px;
            color: #555;
        }
        .test-method {
            font-size: 9px;
            margin-bottom: 12px;
            padding: 6px;
            background-color: #ecf0f1;
            border-left: 3px solid #34495e;
        }
        .section-title {
            background-color: #34495e;
            color: white;
            padding: 6px;
            margin-top: 15px;
            margin-bottom: 8px;
            font-weight: bold;
            font-size: 12px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
            font-size: 9px;
        }
        table th {
            background-color: #d3d3d3;
            color: black;
            padding: 8px 4px;
            text-align: center;
            border: 1px solid #000;
            font-weight: bold;
            overflow: hidden;
            line-height: 1.2;
        }
        table td {
            border: 1px solid #000;
            padding: 10px 5px;
            text-align: center;
            overflow: hidden;
            min-height: 30px;
            background-color: white;
            color: black;
        }
        table tr:nth-child(even) td {
            background-color: white;
            color: black;
        }
        table tr:nth-child(odd) td {
            background-color: white;
            color: black;
        }
        tbody tr:first-child td {
            background-color: white;
            color: black;
        }
        .signature-section {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-top: 20px;
            padding-top: 12px;
            border-top: 2px solid #333;
        }
        .signature-box {
            text-align: center;
            font-size: 9px;
        }
        .signature-box label {
            font-weight: bold;
            display: block;
            margin-bottom: 12px;
            font-size: 10px;
        }
        .signature-line {
            border-top: 1px solid #333;
            padding-top: 8px;
            margin-top: 12px;
            min-height: 20px;
        }
        .footer {
            text-align: center;
            font-size: 8px;
            color: #e74c3c;
            font-weight: bold;
            margin-top: 15px;
            padding-top: 8px;
            border-top: 2px solid #333;
        }
        .page-number {
            text-align: center;
            font-size: 8px;
            color: #555;
            margin-top: 5px;
            font-weight: normal;
        }
        
        /* Print styles */
        @media print {
            body { 
                background-color: white; 
                margin: 0; 
                padding: 0;
            }
            .page { 
                box-shadow: none; 
                margin: 0;
                padding: 4mm;
                width: 210mm;
                height: 297mm;
                page-break-after: always;
                transform: none;
            }
            .page:last-child {
                page-break-after: avoid;
            }
            
            @page {
                size: A4 portrait;
                margin: 1mm;
            }
            
            .header {
                margin-bottom: 8px;
                padding-bottom: 4px;
            }
            
            table {
                font-size: 9px;
            }
            
            table th, table td {
                padding: 8px 4px;
            }
            
            .signature-section {
                margin-top: 12px;
                padding-top: 8px;
                gap: 8px;
            }
            
            .signature-box label {
                margin-bottom: 8px;
                font-size: 9px;
            }
        }
    </style>
</head>
<body>
    ${sampleDescriptionPagesHtml}

    <!-- PAGE ${sampleDescriptionPagesCount + 1}: Count Water -->
    <div class="page">
        <div class="header">
            <div class="header-left">
                <img src="/assets/logo.png" alt="Sama Karbala Logo" class="logo">
            </div>
            <div class="header-center">
                <h1>Water Microbiology Testing Technical Data Sheet</h1>
            </div>
            <div class="header-right">
                <h2>Sama Karbala</h2>
                <h3>Laboratory Unit</h3>
                <p><strong>COA MIC 000 R001</strong></p>
            </div>
        </div>

        <div class="page-info">Page ${sampleDescriptionPagesCount + 1} of ${totalPages}</div>

        <div class="section-title">Count: Water</div>
        <table>
            <thead>
                <tr>
                    <th rowspan="2">Media</th>
                    <th rowspan="2">Batch №</th>
                    <th rowspan="2">Incubator<br>No. / name</th>
                    <th colspan="2">Start</th>
                    <th colspan="2">Incubation<br>Temperature</th>
                    <th colspan="2">Incubation Period</th>
                    <th rowspan="2">Result</th>
                    <th rowspan="2">Operator Signature<br>/ Date</th>
                </tr>
                <tr>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Temp. (℃)</th>
                    <th>Range<br>(℃)</th>
                    <th>Period (h)</th>
                    <th>Range<br>(h)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Pseudo. Cetr.</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                </tr>
                <tr>
                    <td>Endo</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                </tr>
                <tr>
                    <td>R2A</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                </tr>
            </tbody>
        </table>

        <div class="footer">
            CONFIDENTIAL. Use or transcription of this document is prohibited unless written authentication granted by Sahara Karbala Co. for Agriculture & Animal Production ®. ©${new Date().getFullYear()} All rights reserved.
            <div class="page-number">Page ${sampleDescriptionPagesCount + 1} of ${totalPages}</div>
        </div>
    </div>

    ${mediaCountPagesHtml}
</body>
</html>
        `;
    };

    const exportToPDF = () => {
        const htmlContent = generatePDFTemplate();
        // Open a completely isolated window
        const printWindow = window.open('about:blank', '_blank', 'width=1200,height=800');
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(htmlContent);
            printWindow.document.close();

            // Wait for content to load, then trigger print dialog
            printWindow.onload = function () {
                printWindow.focus();
                // Small delay to ensure content is fully rendered
                setTimeout(() => {
                    printWindow.print();
                    // Optionally close window after print dialog is dismissed
                    // printWindow.onafterprint = () => printWindow.close();
                }, 250);
            };
        } else {
            alert('Please allow pop-ups for this site to export PDF');
        }
    };

    // Expose export functions to parent component
    useImperativeHandle(ref, () => ({
        exportToExcel,
        exportToPDF
    }));

    if (loading) {
        return <div className="text-center py-10 font-bold text-gray-500">Loading samples...</div>;
    }

    return (
        <div ref={sheetRef} className="bg-white p-8 max-w-[1200px] mx-auto shadow-lg">
            {/* Page 1: Sample Description */}
            <div className="mb-8 border-b-2 border-gray-300 pb-8">
                <div className="border-b-4 border-gray-800 pb-4 mb-4 grid grid-cols-[100px_1fr_auto] gap-4 items-center">
                    <div className="text-left">
                        <img src="/assets/logo.png" alt="Sama Karbala Logo" className="w-[70px] h-auto" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-700">Water Microbiology Testing Technical Data Sheet</h1>
                    </div>
                    <div className="text-right">
                        <h2 className="text-lg font-bold">Sama Karbala</h2>
                        <h3 className="text-sm font-semibold text-gray-600">Laboratory Unit</h3>
                        <p className="text-sm font-bold">COA MIC 000 R001</p>
                    </div>
                </div>

                <div className="text-right text-xs text-gray-600 mb-3">Page 1 of 3</div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="border border-gray-300 p-2 bg-gray-50 text-sm">
                        <label className="font-bold text-gray-600">Lab. Code:</label> {sheetRows.length > 0 ? `${sheetRows[0].labCode} - ${sheetRows[sheetRows.length - 1].labCode}` : '_____________'}
                    </div>
                    <div className="border border-gray-300 p-2 bg-gray-50 text-sm">
                        <label className="font-bold text-gray-600">MIC code:</label> {sheetRows.length > 0 ? `${sheetRows[0].micCode} - ${sheetRows[sheetRows.length - 1].micCode}` : '_____________'}
                    </div>
                    <div className="border border-gray-300 p-2 bg-gray-50 text-sm">
                        <label className="font-bold text-gray-600">Date of Receipt:</label> {startDate && endDate ? `${startDate} to ${endDate}` : '_____________'}
                    </div>
                    <div className="border border-gray-300 p-2 bg-gray-50 text-sm">
                        <label className="font-bold text-gray-600">Test Date:</label> _____________
                    </div>
                </div>

                <div className="text-xs mb-4 p-2 bg-gray-100 border-l-4 border-gray-700">
                    <strong>Test Method:</strong> Standard method (2018),9215 A, B and C - Part 9000 – ISO 16266: (2006).
                </div>

                <div className="bg-gray-700 text-white p-2 font-bold text-sm mb-2">Sample Description</div>
                <table className="w-full border-collapse text-xs mb-4">
                    <thead>
                        <tr className="bg-gray-300">
                            <th className="border border-black p-2 text-center">Lab code</th>
                            <th className="border border-black p-2 text-center">MIC code</th>
                            <th className="border border-black p-2 text-center">No.</th>
                            <th className="border border-black p-2 text-center">Sample type</th>
                            <th className="border border-black p-2 text-center">Sample index</th>
                            <th className="border border-black p-2 text-center">Dilution Factor</th>
                            <th className="border border-black p-2 text-center">Water Volume (ml)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayRows.map((row, i) => (
                            <tr key={i} className={rowColors[i]}>
                                <td className="border border-black p-2 text-center">{row.labCode}</td>
                                <td className="border border-black p-2 text-center">{row.micCode}</td>
                                <td className="border border-black p-2 text-center">{row.serialNo}</td>
                                <td className="border border-black p-2 text-center">{row.sampleType}</td>
                                <td className="border border-black p-2 text-center">{row.sampleIndex}</td>
                                <td className="border border-black p-2 text-center"></td>
                                <td className="border border-black p-2 text-center"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="text-center text-xs text-red-600 font-bold mt-4 pt-3 border-t-2 border-gray-800">
                    CONFIDENTIAL. Use or transcription of this document is prohibited unless written authentication granted by Sahara Karbala Co. for Agriculture & Animal Production ®. ©{new Date().getFullYear()} All rights reserved.
                </div>
            </div>

            {/* Page 2: Count Water */}
            <div className="mb-8 border-b-2 border-gray-300 pb-8">
                <div className="border-b-4 border-gray-800 pb-4 mb-4 grid grid-cols-[100px_1fr_auto] gap-4 items-center">
                    <div className="text-left">
                        <img src="/assets/logo.png" alt="Sama Karbala Logo" className="w-[70px] h-auto" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-700">Water Microbiology Testing Technical Data Sheet</h1>
                    </div>
                    <div className="text-right">
                        <h2 className="text-lg font-bold">Sama Karbala</h2>
                        <h3 className="text-sm font-semibold text-gray-600">Laboratory Unit</h3>
                        <p className="text-sm font-bold">COA MIC 000 R001</p>
                    </div>
                </div>

                <div className="text-right text-xs text-gray-600 mb-3">Page 2 of 3</div>

                <div className="bg-gray-700 text-white p-2 font-bold text-sm mb-2">Count: Water</div>
                <table className="w-full border-collapse text-xs mb-4">
                    <thead>
                        <tr className="bg-gray-300">
                            <th rowSpan={2} className="border border-black p-2 text-center">Media</th>
                            <th rowSpan={2} className="border border-black p-2 text-center">Batch №</th>
                            <th rowSpan={2} className="border border-black p-2 text-center">Incubator<br />No. / name</th>
                            <th colSpan={2} className="border border-black p-2 text-center">Start</th>
                            <th colSpan={2} className="border border-black p-2 text-center">Incubation<br />Temperature</th>
                            <th colSpan={2} className="border border-black p-2 text-center">Incubation Period</th>
                            <th rowSpan={2} className="border border-black p-2 text-center">Result</th>
                            <th rowSpan={2} className="border border-black p-2 text-center">Operator Signature<br />/ Date</th>
                        </tr>
                        <tr className="bg-gray-300">
                            <th className="border border-black p-2 text-center">Day</th>
                            <th className="border border-black p-2 text-center">Time</th>
                            <th className="border border-black p-2 text-center">Temp. (℃)</th>
                            <th className="border border-black p-2 text-center">Range<br />(℃)</th>
                            <th className="border border-black p-2 text-center">Period (h)</th>
                            <th className="border border-black p-2 text-center">Range<br />(h)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="border border-black p-2 text-center">Pseudo. Cetr.</td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2 text-center">Endo</td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2 text-center">R2A</td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                            <td className="border border-black p-2 text-center"></td>
                        </tr>
                    </tbody>
                </table>

                <div className="text-center text-xs text-red-600 font-bold mt-4 pt-3 border-t-2 border-gray-800">
                    CONFIDENTIAL. Use or transcription of this document is prohibited unless written authentication granted by Sahara Karbala Co. for Agriculture & Animal Production ®. ©{new Date().getFullYear()} All rights reserved.
                </div>
            </div>

            {/* Page 3: Media Count Results */}
            <div>
                <div className="border-b-4 border-gray-800 pb-4 mb-4 grid grid-cols-[100px_1fr_auto] gap-4 items-center">
                    <div className="text-left">
                        <img src="/assets/logo.png" alt="Sama Karbala Logo" className="w-[70px] h-auto" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-700">Water Microbiology Testing Technical Data Sheet</h1>
                    </div>
                    <div className="text-right">
                        <h2 className="text-lg font-bold">Sama Karbala</h2>
                        <h3 className="text-sm font-semibold text-gray-600">Laboratory Unit</h3>
                        <p className="text-sm font-bold">COA MIC 000 R001</p>
                    </div>
                </div>

                <div className="text-right text-xs text-gray-600 mb-3">Page 3 of 3</div>

                <div className="bg-gray-700 text-white p-2 font-bold text-sm mb-2">Media Count</div>
                <table className="w-full border-collapse text-xs mb-4">
                    <thead>
                        <tr className="bg-gray-300">
                            <th className="border border-black p-2 text-center">Lab code</th>
                            <th className="border border-black p-2 text-center">MIC code</th>
                            <th className="border border-black p-2 text-center">NO.</th>
                            <th className="border border-black p-2 text-center">Total Bacterial Count<br />CFU per 25 ml</th>
                            <th className="border border-black p-2 text-center">TOTAL Coliform Count<br />CFU per 25 ml</th>
                            <th className="border border-black p-2 text-center">TOTAL E.Coli Count<br />CFU per 25 ml</th>
                            <th className="border border-black p-2 text-center">TOTAL Pseudomonas Count<br />CFU per 25 ml</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayRows.map((row, i) => (
                            <tr key={i} className={rowColors[i]}>
                                <td className="border border-black p-2 text-center">{row.labCode}</td>
                                <td className="border border-black p-2 text-center">{row.micCode}</td>
                                <td className="border border-black p-2 text-center">{row.serialNo}</td>
                                <td className="border border-black p-2 text-center"></td>
                                <td className="border border-black p-2 text-center"></td>
                                <td className="border border-black p-2 text-center"></td>
                                <td className="border border-black p-2 text-center"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t-2 border-gray-800">
                    <div className="text-center text-xs">
                        <label className="font-bold block mb-3">Tech Sign.</label>
                        <div className="border-t border-gray-800 pt-1 mt-2">Sign: _________________</div>
                        <div className="border-t border-gray-800 pt-1 mt-2">Date: _________________</div>
                    </div>
                    <div className="text-center text-xs">
                        <label className="font-bold block mb-3">Head Unit Sign.</label>
                        <div className="border-t border-gray-800 pt-1 mt-2">Sign: _________________</div>
                        <div className="border-t border-gray-800 pt-1 mt-2">Date: _________________</div>
                    </div>
                    <div className="text-center text-xs">
                        <label className="font-bold block mb-3">Supervisor. Sign.</label>
                        <div className="border-t border-gray-800 pt-1 mt-2">Sign: _________________</div>
                        <div className="border-t border-gray-800 pt-1 mt-2">Date: _________________</div>
                    </div>
                </div>

                <div className="text-center text-xs text-red-600 font-bold mt-4 pt-3 border-t-2 border-gray-800">
                    CONFIDENTIAL. Use or transcription of this document is prohibited unless written authentication granted by Sahara Karbala Co. for Agriculture & Animal Production ®. ©{new Date().getFullYear()} All rights reserved.
                </div>
            </div>
        </div>
    );
});

WaterSheet.displayName = 'WaterSheet';
