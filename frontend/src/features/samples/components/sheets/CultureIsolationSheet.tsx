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

interface CultureIsolationSheetRow extends BaseSheetRow { }

export const CultureIsolationSheet = forwardRef<SheetRef, SheetProps>(({ startDate, endDate }, ref) => {
    const [sheetRows, setSheetRows] = useState<CultureIsolationSheetRow[]>([]);
    useEffect(() => {
        const fetchSamples = async () => {
            try {
                const currentYear = new Date().getFullYear();
                const response = await apiClient.get('/samples/', {
                    params: { year: currentYear, department_id: 3 }
                });

                const rows: CultureIsolationSheetRow[] = [];
                response.data.forEach((sample: any) => {
                    if (!filterByDateRange(sample.date_received, startDate, endDate)) return;

                    sample.units?.forEach((unit: any) => {
                        if (unit.department_id === 3) {
                            const diseases = unit.microbiology_data?.diseases_list || [];
                            // Fixed: Removed redundant 'culture' check
                            const hasCulture = diseases.some((d: string) => {
                                const lowerD = d.toLowerCase();
                                return lowerD.includes('culture') || lowerD.includes('isolation');
                            });

                            if (hasCulture) {
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
            }
        };

        fetchSamples();
    }, [startDate, endDate]);

    const sheetRef = useRef<HTMLDivElement>(null);

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        // Common styles
        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
            fill: { fgColor: { rgb: "475569" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } }
            }
        };

        const titleStyle = {
            font: { bold: true, sz: 16, color: { rgb: "475569" } },
            alignment: { horizontal: "center", vertical: "center" }
        };

        const subTitleStyle = {
            font: { bold: true, sz: 11 },
            alignment: { horizontal: "left", vertical: "center" }
        };

        const cellStyle = {
            border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } }
            },
            alignment: { horizontal: "center", vertical: "center" }
        };

        const sectionHeaderStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
            fill: { fgColor: { rgb: "64748B" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } }
            }
        };

        // ===== PAGE 1: Sample Description =====
        const page1Data = [
            ['Culture & Isolation Technical Data Sheet'],
            [''],
            ['Test Method:', 'Clinical Veterinary Microbiology 2nd edition, laboratory manual for the isolation and identification of avian pathogens Manual method 2008.'],
            ['Date Range:', `${startDate} to ${endDate}`],
            ['Lab Code:', `From: ${sheetRows.length > 0 ? sheetRows[0].labCode : ''} To: ${sheetRows.length > 0 ? sheetRows[sheetRows.length - 1].labCode : ''}`],
            ['MIC Code:', `From: ${sheetRows.length > 0 ? sheetRows[0].micCode : ''} To: ${sheetRows.length > 0 ? sheetRows[sheetRows.length - 1].micCode : ''}`],
            [''],
            ['Lab Code', 'MIC Code', 'No.', 'Sample Type', 'Sample Index', 'Test Portion (Weight ±5%)', 'BPW Volume (ml)', 'Result', 'Isolate Range'],
            ...sheetRows.map(row => [
                row.labCode,
                row.micCode,
                row.serialNo,
                row.sampleType,
                row.sampleIndex,
                '', // Test Portion
                '', // BPW Volume
                '', // Result
                ''  // Isolate Range
            ])
        ];

        const ws1 = XLSX.utils.aoa_to_sheet(page1Data);
        
        // Apply styles to Page 1
        ws1['A1'].s = titleStyle;
        ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];
        
        // Style info rows
        for (let i = 2; i <= 5; i++) {
            const cellA = `A${i + 1}`;
            if (ws1[cellA]) ws1[cellA].s = subTitleStyle;
        }
        
        // Style header row (row 8)
        const headerCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
        headerCols.forEach(col => {
            const cell = `${col}8`;
            if (ws1[cell]) ws1[cell].s = headerStyle;
        });
        
        // Style data cells
        for (let i = 9; i <= 8 + sheetRows.length; i++) {
            headerCols.forEach(col => {
                const cell = `${col}${i}`;
                if (ws1[cell]) ws1[cell].s = cellStyle;
            });
        }

        const wscols1 = [
            { wch: 12 }, { wch: 12 }, { wch: 5 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 }
        ];
        ws1['!cols'] = wscols1;

        XLSX.utils.book_append_sheet(wb, ws1, 'Sample Description');

        // ===== PAGE 2: Non-selective Enrichment & Inoculation =====
        const page2Data = [
            ['Culture & Isolation Technical Data Sheet - Enrichment & Inoculation'],
            [''],
            ['Non-selective Enrichment'],
            ['Media', 'Batch №', 'Incubator No.', 'Start Day', 'Start Time', 'Temp. (℃)', 'Range (℃)', 'Period (h)', 'Range (h)', 'Result', 'Operator Signature'],
            ['B.P.W.', '', '', '', '', '', '34-38 ℃', '', '18±2 h', '', ''],
            ['', '', '', '', '', '', '', '', '', '', ''],
            [''],
            ['Inoculation: Direct / Indirect'],
            ['Media', 'Batch №', 'Incubator No.', 'Start Day', 'Start Time', 'Temp. (℃)', 'Range (℃)', 'Period (h)', 'Range (h)', 'Media Type', 'Isolate', 'Operator Signature'],
            ['Blood agar', '', '', '', '', '', '37±1℃', '', '24±3 h', 'Enrichment', '', ''],
            ['MacConkey', '', '', '', '', '', '37±1℃', '', '24±3 h', 'Differential', '', ''],
            ['Ps. Cetrimide', '', '', '', '', '', '37±1℃', '', '24±3 h', 'Selective', '', ''],
            ['BP', '', '', '', '', '', '37±1℃', '', '24±3 h', 'Selective', '', ''],
            ['EMB', '', '', '', '', '', '37±1℃', '', '24±3 h', 'Selective', '', ''],
            ['XLD', '', '', '', '', '', '37±1℃', '', '24±3 h', 'Non-selective', '', ''],
            ['', '', '', '', '', '', '', '', '', '', '', ''],
            [''],
            ['Subculture'],
            ['Media', 'Batch №', 'Incubator No.', 'Start Day', 'Start Time', 'Temp. (℃)', 'Range (℃)', 'Period (h)', 'Range (h)', 'Media Type', 'Isolate', 'Operator Signature'],
            ['TSA', '', '', '', '', '', '37±1℃', '', '24±3 h', 'Non-selective', '', ''],
            ['PCA', '', '', '', '', '', '37±1℃', '', '24±3 h', 'Non-selective', '', ''],
            ['MHA', '', '', '', '', '', '37±1℃', '', '24±3 h', 'Non-selective Sensitivity', '', '']
        ];

        const ws2 = XLSX.utils.aoa_to_sheet(page2Data);
        
        // Apply styles to Page 2
        ws2['A1'].s = titleStyle;
        ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }];
        
        // Style section headers
        if (ws2['A3']) ws2['A3'].s = sectionHeaderStyle;
        if (ws2['A8']) ws2['A8'].s = sectionHeaderStyle;
        if (ws2['A18']) ws2['A18'].s = sectionHeaderStyle;
        
        // Style table headers
        const page2HeaderRows = [4, 9, 19];
        const page2Cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
        page2HeaderRows.forEach(row => {
            page2Cols.forEach(col => {
                const cell = `${col}${row}`;
                if (ws2[cell]) ws2[cell].s = headerStyle;
            });
        });

        const wscols2 = [
            { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 15 }
        ];
        ws2['!cols'] = wscols2;

        XLSX.utils.book_append_sheet(wb, ws2, 'Enrichment & Inoculation');

        // ===== PAGE 3: Biochemical =====
        const page3Data = [
            ['Culture & Isolation Technical Data Sheet - Biochemical'],
            [''],
            ['Biochemical'],
            ['Media', 'Batch №', 'Incubator №', 'Start Day', 'Start Time', 'Temp. (℃)', 'Range (℃)', 'Period (h)', 'Range (h)', 'Result', 'Operator Signature'],
            ['T.S.I.', '', '', '', '', '', '34-38 ℃', '', '24±3 h', '', ''],
            ['Lysine', '', '', '', '', '', '34-38 ℃', '', '24±3 h', '', ''],
            ['Semon citrate', '', '', '', '', '', '37±1℃', '', '24±3 h', '', ''],
            ["Kovack's Indole", '', '', '', '', '', '37±1℃', '', '24±3 h', '', ''],
            ['Coagulase', '', '', '', '', '', '37±1℃', '', '24±3 h', '', ''],
            ['Oxidase', '', '', '', '', '', '37±1℃', '', '24±3 h', '', ''],
            ['Catalase', '', '', '', '', '', '37±1℃', '', '24±3 h', '', ''],
            ['OF', '', '', '', '', '', '37±1℃', '', '24±3 h', '', ''],
            ['RAPID', '', '', '', '', '', '37±1℃', '', '24±3 h', '', ''],
            ['API 20E', '', '', '', '', '', '37±1℃', '', '24±3 h', '', ''],
            ['', '', '', '', '', '', '', '', '', '', ''],
            [''],
            ['Signatures'],
            ['Technician:', '', '', 'Head Unit:', '', '', 'Quality Manager:', '', ''],
            ['Sign:', '', '', 'Sign:', '', '', 'Sign:', '', ''],
            ['Date:', '', '', 'Date:', '', '', 'Date:', '', '']
        ];

        const ws3 = XLSX.utils.aoa_to_sheet(page3Data);
        
        // Apply styles to Page 3
        ws3['A1'].s = titleStyle;
        ws3['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }];
        
        // Style section header
        if (ws3['A3']) ws3['A3'].s = sectionHeaderStyle;
        if (ws3['A17']) ws3['A17'].s = sectionHeaderStyle;
        
        // Style table header
        const page3Cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
        page3Cols.forEach(col => {
            const cell = `${col}4`;
            if (ws3[cell]) ws3[cell].s = headerStyle;
        });

        const wscols3 = [
            { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 15 }
        ];
        ws3['!cols'] = wscols3;

        XLSX.utils.book_append_sheet(wb, ws3, 'Biochemical');

        XLSX.writeFile(wb, `Culture_Isolation_Sheet_${startDate}_${endDate}.xlsx`);
    };

    const generatePDFTemplate = () => {
        // Determine pagination
        const rowsPerPage = 30;
        const descriptionPagesCount = Math.ceil(sheetRows.length / rowsPerPage) || 1;
        // Fixed layout pages are currently: Page 2, Page 3 (2 pages)
        // So distinct PDF "pages" are descriptionPagesCount + 2.
        const totalPages = descriptionPagesCount + 2;

        let descriptionPagesHtml = '';

        for (let i = 0; i < descriptionPagesCount; i++) {
            const start = i * rowsPerPage;
            const end = start + rowsPerPage;
            const pageRows = sheetRows.slice(start, end);

            const tableRowsHtml = pageRows.map(row => {
                return `
                <tr style="background-color: #ffffff">
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
            `;
            }).join('');

            // Info Grid only on first page (i === 0)
            const infoGrid = i === 0 ? `
    <div class="info-grid">
      <div class="info-row" style="grid-column: 1 / -1;">
        <span class="info-label">Test Method:</span>
        <span>Clinical Veterinary Microbiology 2<sup>nd</sup> edition, laboratory manual for the isolation and identification of avian pathogens Manual method 2008.</span>
      </div>
      
      <div class="info-row">
        <span class="info-label">Lab Code:</span>
        <div class="info-value" style="display: flex; gap: 6px; align-items: center;">
          <span style="color: #6b7280;">From:</span>
          <span class="underline" style="flex: 1;">${escapeHtml(sheetRows.length > 0 ? sheetRows[0].labCode : '')}</span>
          <span style="color: #6b7280;">To:</span>
          <span class="underline" style="flex: 1;">${escapeHtml(sheetRows.length > 0 ? sheetRows[sheetRows.length - 1].labCode : '')}</span>
        </div>
      </div>
      <div class="info-row">
        <span class="info-label">Test Date:</span>
        <span class="underline" style="flex: 1;"></span>
      </div>

      <div class="info-row">
        <span class="info-label">MIC Code:</span>
        <div class="info-value" style="display: flex; gap: 6px; align-items: center;">
          <span style="color: #6b7280;">From:</span>
          <span class="underline" style="flex: 1;">${escapeHtml(sheetRows.length > 0 ? sheetRows[0].micCode : '')}</span>
          <span style="color: #6b7280;">To:</span>
          <span class="underline" style="flex: 1;">${escapeHtml(sheetRows.length > 0 ? sheetRows[sheetRows.length - 1].micCode : '')}</span>
        </div>
      </div>
      <div class="info-row">
        <span class="info-label">Received Date:</span>
        <div class="info-value" style="display: flex; gap: 6px; align-items: center;">
          <span style="color: #6b7280;">From:</span>
          <span class="underline" style="flex: 1;">${escapeHtml(startDate)}</span>
          <span style="color: #6b7280;">To:</span>
          <span class="underline" style="flex: 1;">${escapeHtml(endDate)}</span>
        </div>
      </div>
    </div>` : '<div style="margin-bottom: 20px;"></div>'; // Spacer if no info grid

            descriptionPagesHtml += `
  <div class="page">
    <div class="header">
      <div class="logo-box"><img src="/assets/logo.png" alt="Logo" /></div>
      <div class="header-center">
        <h1 class="header-title">Culture & Isolation Technical Data Sheet</h1>
      </div>
      <div class="header-right">
        <div class="company-name">Sama Karbala Co.</div>
        <div class="lab-unit">Laboratory Unit</div>
        <div class="doc-code">MIC 000 R001</div>
      </div>
    </div>

    ${infoGrid}

    <div class="section-header">Sample Description</div>
    <table>
      <thead>
        <tr>
          <th style="width: 90px;">Lab Code</th>
          <th style="width: 80px;">MIC Code</th>
          <th style="width: 40px;">No.</th>
          <th style="width: 90px;">Sample Type</th>
          <th style="width: 150px;">Sample Index</th>
          <th style="width: 100px;">Test Portion (Weight ±5%)</th>
          <th style="width: 80px;">BPW Volume (ml)</th>
          <th style="width: 80px;">Result</th>
          <th style="width: 80px;">Isolate Range</th>
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>
    
    <div style="text-align: center; font-size: 10px; margin-top: 10px;">Page ${i + 1} of ${totalPages}</div>
  </div>`;
        }

        // Now Fixed Pages (Results pages)
        // Page index for these starts at descriptionPagesCount + 1
        const p2Num = descriptionPagesCount + 1;
        const p3Num = descriptionPagesCount + 2;

        const fixedPagesHtml = `
  <div class="page">
    <div class="header">
        <div class="logo-box"><img src="/assets/logo.png" alt="Logo" /></div>
        <div class="header-center"><h1 class="header-title">Culture & Isolation Technical Data Sheet</h1></div>
        <div class="header-right"><div class="company-name">Sama Karbala Co.</div><div class="lab-unit">Laboratory Unit</div><div class="doc-code">MIC 000 R001</div></div>
    </div>
    
    <div class="section-header">Non-selective Enrichment</div>
      <table>
        <thead>
          <tr>
            <th rowspan="2">Media</th>
            <th rowspan="2">Batch №</th>
            <th rowspan="2">Incubator No.</th>
            <th colspan="2">Start</th>
            <th rowspan="2">Temp. (℃)</th>
            <th rowspan="2">Range (℃)</th>
            <th rowspan="2">Period (h)</th>
            <th rowspan="2">Range (h)</th>
            <th rowspan="2">Result</th>
            <th rowspan="2">Operator Signature</th>
          </tr>
          <tr>
            <th>Day</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background-color: #ffffff">
            <td style="font-weight: 600;">B.P.W.</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">34-38 ℃</td>
            <td></td>
            <td style="text-align: center;">18±2 h</td>
            <td></td><td></td>
          </tr>
          <tr style="height: 35px;">
            <td></td><td></td><td></td><td></td><td></td><td></td>
            <td></td><td></td><td></td><td></td><td></td>
          </tr>
        </tbody>
      </table>

      <!-- Inoculation Section -->
      <div class="section-header">Inoculation: Direct \\ Indirect</div>
      <table>
        <thead>
          <tr>
            <th rowspan="2">Media</th>
            <th rowspan="2">Batch №</th>
            <th rowspan="2">Incubator No.</th>
            <th colspan="2">Start</th>
            <th rowspan="2">Temp. (℃)</th>
            <th rowspan="2">Range (℃)</th>
            <th rowspan="2">Period (h)</th>
            <th rowspan="2">Range (h)</th>
            <th rowspan="2">Media Type</th>
            <th rowspan="2">Isolate</th>
            <th rowspan="2">Operator Signature</th>
          </tr>
          <tr>
            <th>Day</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background-color: #ffffff">
            <td style="font-weight: 600;">Blood agar</td>
            <td>31122025-10</td>
            <td></td><td></td><td></td><td></td>
            <td style="text-align: center;">37±1℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td>Enrichment</td>
            <td></td><td></td>
          </tr>
          <tr>
            <td style="font-weight: 600;">MacConkey</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">37±1℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td>Differential</td>
            <td></td><td></td>
          </tr>
          <tr style="background-color: #ffffff">
            <td style="font-weight: 600;">Ps. Cetrimide</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">37±1℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td>Selective</td>
            <td></td><td></td>
          </tr>
          <tr>
            <td style="font-weight: 600;">BP</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">37±1℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td>Selective</td>
            <td></td><td></td>
          </tr>
          <tr style="background-color: #ffffff">
            <td style="font-weight: 600;">EMB</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">37±1℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td>Selective</td>
            <td></td><td></td>
          </tr>
          <tr>
            <td style="font-weight: 600;">XLD</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">37±1℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td>Non-selective</td>
            <td></td><td></td>
          </tr>
          <tr style="height: 35px;">
            <td></td><td></td><td></td><td></td><td></td><td></td>
            <td></td><td></td><td></td><td></td><td></td><td></td>
          </tr>
          <tr style="height: 35px;">
            <td></td><td></td><td></td><td></td><td></td><td></td>
            <td></td><td></td><td></td><td></td><td></td><td></td>
          </tr>
        </tbody>
      </table>

      <!-- Subculture Section -->
      <div class="section-header">Subculture</div>
      <table>
        <thead>
          <tr>
            <th rowspan="2">Media</th>
            <th rowspan="2">Batch №</th>
            <th rowspan="2">Incubator No.</th>
            <th colspan="2">Start</th>
            <th rowspan="2">Temp. (℃)</th>
            <th rowspan="2">Range (℃)</th>
            <th rowspan="2">Period (h)</th>
            <th rowspan="2">Range (h)</th>
            <th rowspan="2">Media Type</th>
            <th rowspan="2">Isolate</th>
            <th rowspan="2">Operator Signature</th>
          </tr>
          <tr>
            <th>Day</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background-color: #ffffff">
            <td style="font-weight: 600;">TSA</td>
            <td>31122025-10</td>
            <td></td><td></td><td></td><td></td>
            <td style="text-align: center;">37±1℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td>Non-selective</td>
            <td></td><td></td>
          </tr>
          <tr>
            <td style="font-weight: 600;">PCA</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">37±1℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td>Non-selective</td>
            <td></td><td></td>
          </tr>
          <tr style="background-color: #ffffff">
            <td style="font-weight: 600;">MHA</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">37±1℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td>Non-selective Sensitivity</td>
            <td></td><td></td>
          </tr>
        </tbody>
      </table>
      <div style="text-align: center; font-size: 10px; margin-top: 10px;">Page ${p2Num} of ${totalPages}</div>
    </div>

    <!-- Last Page: Biochemical etc. -->
    <div class="page">
      <div class="header">
        <div class="logo-box"><img src="/assets/logo.png" alt="Logo" /></div>
        <div class="header-center"><h1 class="header-title">Culture & Isolation Technical Data Sheet</h1></div>
        <div class="header-right"><div class="company-name">Sama Karbala Co.</div><div class="lab-unit">Laboratory Unit</div><div class="doc-code">MIC 000 R001</div></div>
      </div>

    <div class="section-header">Biochemical</div>
      <table>
        <thead>
          <tr>
            <th rowspan="2">Media</th>
            <th rowspan="2">Batch №</th>
            <th rowspan="2">Incubator №</th>
            <th colspan="2">Start</th>
            <th rowspan="2">Temp. (℃)</th>
            <th rowspan="2">Range (℃)</th>
            <th rowspan="2">Period (h)</th>
            <th rowspan="2">Range (h)</th>
            <th rowspan="2">Result</th>
            <th rowspan="2">Operator Signature</th>
          </tr>
          <tr>
            <th>Day</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background-color: #ffffff">
            <td style="font-weight: 600;">T.S.I.</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">34-38 ℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr>
            <td style="font-weight: 600;">Lysine</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">34-38 ℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr style="background-color: #ffffff">
            <td style="font-weight: 600;">Semon citrate</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">37±1℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr>
            <td style="font-weight: 600;">Kovack's Indole</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">37±1℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr style="background-color: #ffffff">
            <td style="font-weight: 600;">Coagulase</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">37±1℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr>
            <td style="font-weight: 600;">Oxidase</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">37±1℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr style="background-color: #ffffff">
            <td style="font-weight: 600;">Catalase</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">37±1℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr>
            <td style="font-weight: 600;">OF</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">37±1℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr style="background-color: #ffffff">
            <td style="font-weight: 600;">RAPID</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">37±1℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr>
            <td style="font-weight: 600;">API 20E</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">37±1℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr style="height: 35px;">
            <td></td><td></td><td></td><td></td><td></td><td></td>
            <td></td><td></td><td></td><td></td><td></td>
          </tr>
          <tr style="height: 35px;">
            <td></td><td></td><td></td><td></td><td></td><td></td>
            <td></td><td></td><td></td><td></td><td></td>
          </tr>
        </tbody>
      </table>

      <!-- Signature Section -->
      <div class="signatures">
        <div class="sign-card">
          <div class="sign-role">Technician:</div>
          <div> </div>
          <div class="sign-line">Sign: ___________________________</div>
          <div> </div>
          <div class="sign-line">Date: ___________________________</div>
        </div>
        <div class="sign-card">
          <div class="sign-role">Head Unit:</div>
          
          <div class="sign-line">Sign: ___________________________</div>
          
          <div class="sign-line">Date: ___________________________</div>
        </div>
        <div class="sign-card">
          <div class="sign-role">Quality Manager:</div>
          
          <div class="sign-line">Sign: ___________________________</div>
       
          <div class="sign-line">Date: ___________________________</div>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        CONFIDENTIAL Use or transcription of this document is prohibited unless written authentication granted by Sama Karbala Co. for Agriculture & Animal Production ®. 2023 All rights reserved.
      </div>
      <div style="text-align: center; font-size: 10px; margin-top: 5px;">Page ${p3Num} of ${totalPages}</div>
    </div>
    `;

        return `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Culture & Isolation Technical Data Sheet</title>
  <style>
    :root {
      --brand: #0f766e;
      --brand-ink: #0b4f4a;
      --ink: #111827;
      --muted: #6b7280;
      --bg: #ffffff;
      --line: #e5e7eb;
    }
    * { box-sizing: border-box; }
    html, body {
      background: var(--bg);
      color: var(--ink);
      font: 11px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Tahoma, Arial, sans-serif;
      margin: 0;
      padding: 0;
    }
    body { display: flex; flex-direction: column; align-items: center; } 
    /* Changed flex-direction to column for multiple pages */
    
    .page {
      width: 210mm;
      margin: 2mm auto;
      padding: 5mm 7mm;
      background: #fff;
      position: relative;
      box-shadow: 0 0 5px rgba(0,0,0,0.15);
      page-break-after: always; /* Ensure new page */
    }
    .page:last-child {
      page-break-after: auto;
    }

    .header {
      display: grid;
      grid-template-columns: 120px 1fr auto;
      gap: 15px;
      align-items: center;
      border-bottom: 4px solid #1f2937;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .logo-box {
      width: 120px;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logo-box img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .header-center {
      text-align: center;
    }
    .header-title {
      font-size: 20px;
      font-weight: 900;
      color: #475569;
      margin: 0 0 5px;
    }
    .header-right {
      text-align: right;
    }
    .company-name {
      font-size: 16px;
      font-weight: 900;
      color: #1f2937;
    }
    .lab-unit {
      font-size: 12px;
      font-weight: 600;
      color: #4b5563;
    }
    .doc-code {
      font-size: 12px;
      font-weight: 700;
      margin-top: 3px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 20px;
      margin-bottom: 12px;
      font-size: 11px;
    }
    .info-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .info-label {
      font-weight: 700;
      min-width: 100px;
    }
    .info-value {
      flex: 1;
    }
    .underline {
      border-bottom: 1px solid #9ca3af;
      padding-bottom: 2px;
      text-align: center;
    }
    .section-header {
      background: #475569;
      color: white;
      padding: 6px 8px;
      font-weight: 700;
      font-size: 12px;
      margin: 10px 0 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 10px;
    }
    th, td {
      padding: 4px 6px;
      border: 1px solid #4b5563;
      text-align: left;
      vertical-align: middle;
    }
    thead th {
      background: #64748b;
      color: white;
      font-size: 10px;
      font-weight: 700;
      text-align: center;
    }
    tbody tr:nth-child(even) td {
      background: #ffffff;
    }
    .signatures {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-top: 15px;
      padding-top: 12px;
      border-top: 2px solid #1f2937;
    }
    .sign-card {
      text-align: left;
    }
    .sign-role {
      font-weight: 700;
      margin-bottom: 12px;
    }
    .sign-line {
      border-top: 1px solid #1f2937;
      padding-top: 4px;
      margin-top: 6px;
      font-size: 10px;
    }
    .footer {
      text-align: center;
      font-size: 9px;
      color: #dc2626;
      font-weight: 700;
      margin-top: 12px;
      padding-top: 10px;
      border-top: 2px solid #1f2937;
    }
    .page-break {
      page-break-before: always;
      break-before: page;
    }
    @media print {
      html, body { background: #fff; margin: 0; padding: 0; }
      .page {
        box-shadow: none;
        margin: 0;
        width: 210mm;
        padding: 3mm 5mm;
        page-break-after: always;
      }
      .page:last-child {
        page-break-after: avoid;
      }
      .page-break { page-break-before: always; }
      @page {
        size: A4 portrait;
        margin: 5mm;
      }
    }
  </style>
</head>
<body>
  ${descriptionPagesHtml}
  ${fixedPagesHtml}
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

    useImperativeHandle(ref, () => ({
        exportToExcel,
        exportToPDF
    }));

    return (
        <div className="max-w-[1200px] mx-auto">
            {/* On-screen preview (using Tailwind) */}
            <div ref={sheetRef} className="bg-white p-8 shadow-lg print:shadow-none print:p-0 max-w-[210mm] mx-auto">
                {/* Header */}
                <div className="grid grid-cols-[120px_1fr_auto] gap-8 items-center border-b-4 border-black pb-4 mb-6">
                    <div className="w-[120px] h-[120px] flex items-center justify-center">
                        <img src="/assets/logo.png" alt="Sama Karbala Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-black mb-2">Isolation Technical Data Sheet</h1>
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

                {/* Sample Description */}
                <div className="bg-gray-200 text-black p-2 font-bold mb-4 mt-6">Sample Description</div>
                <table className="w-full border-collapse mb-6 text-[11px]">
                    <thead>
                        <tr>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Lab Code</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Mic. Code</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">No.</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Sample Type</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Index</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Test Portion (Weight ±5%)</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">BPW Volume (ml)</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Result</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Isolate Range</th>
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

                {/* Non-selective Enrichment */}
                <div className="bg-gray-200 text-black p-2 font-bold mb-4 mt-6">Non-selective Enrichment</div>
                <table className="w-full border-collapse mb-6 text-[11px]">
                    <thead>
                        <tr>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Media</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Batch №</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Incubator No.</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black" colSpan={2}>Start</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Temp. (℃)</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Range (℃)</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Period (h)</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Range (h)</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Result</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Operator Signature / Date</th>
                        </tr>
                        <tr>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black">Day</th>
                            <th className="bg-gray-200 text-black p-2 border border-black">Time</th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="bg-white">
                            <td className="border border-black p-2 text-black">B.P.W.</td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black">34-38 ℃</td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black">18±2 h</td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                        </tr>
                        <tr className="bg-white h-12">
                            <td className="border border-black p-2 text-black"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 text-center text-black"></td>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2"></td>
                        </tr>
                    </tbody>
                </table>

                {/* Inoculation */}
                <div className="bg-gray-200 text-black p-2 font-bold mb-4 mt-6">Inoculation: Direct \ Indirect</div>
                <table className="w-full border-collapse mb-6 text-[11px]">
                    <thead>
                        <tr>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Media</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Batch №</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Incubator No.</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black" colSpan={2}>Start</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Temp. (℃)</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Range (℃)</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Period (h)</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Range (h)</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Media Type</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Isolate</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Operator Signature / Date</th>
                        </tr>
                        <tr>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black">Day</th>
                            <th className="bg-gray-200 text-black p-2 border border-black">Time</th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            { name: 'Blood agar', batch: '31122025-10', type: 'Enrichment' },
                            { name: 'MacConkey', batch: '', type: 'Differential' },
                            { name: 'Ps. Cetrimide', batch: '', type: 'Selective' },
                            { name: 'BP', batch: '', type: 'Selective' },
                            { name: 'EMB', batch: '', type: 'Selective' },
                            { name: 'XLD', batch: '', type: 'Non-selective' },
                            { name: '', batch: '', type: '' },
                            { name: '', batch: '', type: '' },
                        ].map((row, i) => (
                            <tr key={i} className={`bg-white ${!row.name ? 'h-12' : ''}`}>
                                <td className="border border-black p-2 text-black">{row.name}</td>
                                <td className="border border-black p-2 text-black">{row.batch}</td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2 text-center text-black">{row.name ? '37±1℃' : ''}</td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2 text-center text-black">{row.name ? '24±3 h' : ''}</td>
                                <td className="border border-black p-2 text-black">{row.type}</td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Subculture */}
                <div className="bg-gray-200 text-black p-2 font-bold mb-4 mt-6">Subculture</div>
                <table className="w-full border-collapse mb-6 text-[11px]">
                    <thead>
                        <tr>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Media</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Batch №</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Incubator No.</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black" colSpan={2}>Start</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Temp. (℃)</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Range (℃)</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Period (h)</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Range (h)</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Media Type</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Isolate</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Operator Signature / Date</th>
                        </tr>
                        <tr>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black">Day</th>
                            <th className="bg-gray-200 text-black p-2 border border-black">Time</th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            { name: 'TSA', batch: '31122025-10', type: 'Non-selective' },
                            { name: 'PCA', batch: '', type: 'Non-selective' },
                            { name: 'MHA', batch: '', type: 'Non-selective Sensitivity' },
                        ].map((row, i) => (
                            <tr key={i} className={`bg-white ${!row.name ? 'h-12' : ''}`}>
                                <td className="border border-black p-2 text-black">{row.name}</td>
                                <td className="border border-black p-2 text-black">{row.batch}</td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2 text-center text-black">{row.name ? '37±1℃' : ''}</td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2 text-center text-black">{row.name ? '24±3 h' : ''}</td>
                                <td className="border border-black p-2 text-black">{row.type}</td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Biochemical */}
                <div className="bg-gray-200 text-black p-2 font-bold mb-4 mt-6">Biochemical</div>
                <table className="w-full border-collapse mb-6 text-[11px]">
                    <thead>
                        <tr>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Media</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Batch №</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Incubator №</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black" colSpan={2}>Start</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Temp. (℃)</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Range (℃)</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Period (h)</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Range (h)</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Result</th>
                            <th className="bg-gray-200 text-black p-2 text-center border border-black">Operator Signature / Date</th>
                        </tr>
                        <tr>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black">Day</th>
                            <th className="bg-gray-200 text-black p-2 border border-black">Time</th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                            <th className="bg-gray-200 text-black p-2 border border-black"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            { name: 'T.S.I.', temp: '34-38℃' },
                            { name: 'Lysine', temp: '34-38℃' },
                            { name: 'Semon citrate', temp: '37±1℃' },
                            { name: 'Kovack\'s Indole', temp: '37±1℃' },
                            { name: 'Coagulase', temp: '37±1℃' },
                            { name: 'Oxidase', temp: '37±1℃' },
                            { name: 'Catalase', temp: '37±1℃' },
                            { name: 'OF', temp: '37±1℃' },
                            { name: 'RAPID', temp: '37±1℃' },
                            { name: 'API 20E', temp: '37±1℃' },
                            { name: '', temp: '' },
                            { name: '', temp: '' },
                        ].map((row, i) => (
                            <tr key={i} className={`bg-white ${!row.name ? 'h-12' : ''}`}>
                                <td className="border border-black p-2 text-black">{row.name}</td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2 text-center text-black">{row.temp}</td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2 text-center text-black">{row.name ? '24±3 h' : ''}</td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                            </tr>
                        ))}
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
                <div className="text-center text-xs mt-2 text-black">Page 1 of 3</div>
            </div>
        </div>
    );
});

CultureIsolationSheet.displayName = 'CultureIsolationSheet';
