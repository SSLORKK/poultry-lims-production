import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { apiClient } from '../../../../services/apiClient';
import XLSX from 'xlsx-js-style';

import {
  escapeHtml,
  addSerialNumbers,
  filterByDateRange,
  sortByMicCode,
  ensureMinimumRows
} from '../../utils/sheetUtils';
import { SheetRef, SheetProps, BaseSheetRow } from '../../types/sheetTypes';

// Local interface if needed, or just use BaseSheetRow
interface SalmonellaSheetRow extends BaseSheetRow { }

export const SalmonellaSheet = forwardRef<SheetRef, SheetProps>(({ startDate, endDate }, ref) => {
  const [sheetRows, setSheetRows] = useState<SalmonellaSheetRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSamples = async () => {
      setLoading(true);
      try {
        const currentYear = new Date().getFullYear();
        const response = await apiClient.get('/samples/', {
          params: { year: currentYear, department_id: 3 }
        });

        const rows: SalmonellaSheetRow[] = [];
        response.data.forEach((sample: any) => {
          // Date Filter Logic using utility
          if (!filterByDateRange(sample.date_received, startDate, endDate)) return;

          sample.units?.forEach((unit: any) => {
            if (unit.department_id === 3) {
              const diseases = unit.microbiology_data?.diseases_list || [];
              // Check for Salmonella (case insensitive)
              const hasSalmonella = diseases.some((d: string) => d.toLowerCase().includes('salmonella'));

              if (hasSalmonella) {
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
                  // If no index list, add one row with empty index
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

        // Sort and add serial numbers using utilities
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

  // Ensure we have at least 15 rows for the layout
  const displayRows = ensureMinimumRows(sheetRows, 15, {
    labCode: '',
    micCode: '',
    sampleType: '',
    sampleIndex: '',
    serialNo: ''
  });

  // Calculate row colors based on MIC Code grouping
  // const rowColors = calculateRowColors(displayRows);

  const sheetRef = useRef<HTMLDivElement>(null);

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Prepare data for Excel
    const data = [
      ['Salmonella Technical Data Sheet'],
      ['Test Method:', 'ISO 6579-1:2017 / Amd.1:2020 (E)'],
      [],
      ['Lab Code', 'MIC Code', 'Sample Type', 'No.', 'Sample Index', 'Test Portion (Weight(g) ± 5%)', 'BPW Volume (ml)', 'Salmonella Detection'],
      ...sheetRows.map(row => [
        row.labCode,
        row.micCode,
        row.sampleType,
        row.serialNo,
        row.sampleIndex,
        '', // Test Portion
        '', // BPW Volume
        ''  // Salmonella Detection
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Basic styling
    const wscols = [
      { wch: 15 }, // Lab Code
      { wch: 15 }, // MIC Code
      { wch: 20 }, // Sample Type
      { wch: 5 },  // No.
      { wch: 15 }, // Sample Index
      { wch: 25 }, // Test Portion
      { wch: 15 }, // BPW Volume
      { wch: 20 }  // Salmonella Detection
    ];
    ws['!cols'] = wscols;

    // Merge title
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

    XLSX.utils.book_append_sheet(wb, ws, 'Salmonella Sheet');
    XLSX.writeFile(wb, `Salmonella_Sheet_${startDate}_${endDate}.xlsx`);
  };



  const generatePDFTemplate = () => {
    // Determine pagination
    const rowsPerPage = 30;
    const descriptionPagesCount = Math.ceil(displayRows.length / rowsPerPage) || 1;
    // Fixed layout pages are currently: Results Page 1, Results Page 2 (~3 pages likely if Description fits in 1)
    // Actually the current layout has Description (Page 1), Non-selective/Selective/Enrichment (Page 2), Bio/Agglutination/Sign (Page 3).
    // So distinct PDF "pages" are descriptionPagesCount + 2.
    const totalPages = descriptionPagesCount + 2;

    let descriptionPagesHtml = '';

    for (let i = 0; i < descriptionPagesCount; i++) {
      const start = i * rowsPerPage;
      const end = start + rowsPerPage;
      const pageRows = displayRows.slice(start, end);

      const tableRowsHtml = pageRows.map(row => {
        return `
                <tr style="background-color: #ffffff">
                    <td>${escapeHtml(row.labCode)}</td>
                    <td>${escapeHtml(row.micCode)}</td>
                    <td>${escapeHtml(row.sampleType)}</td>
                    <td style="text-align: center">${escapeHtml(row.serialNo)}</td>
                    <td>${escapeHtml(row.sampleIndex)}</td>
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
        <span>ISO 6579-1:2017 / Amd.1:2020 (E)</span>
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

      // Actually each "page" div in PDF logic usually handles page break via CSS .page { page-break-after: always; } or similar.
      // But here we are generating HTML string.
      // We will wrap each page in <div class="page">...</div>.

      descriptionPagesHtml += `
  <div class="page">
    <div class="header">
      <div class="logo-box"><img src="/assets/logo.png" alt="Logo" /></div>
      <div class="header-center">
        <h1 class="header-title">Salmonella Technical Data Sheet</h1>
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
          <th style="width: 90px;">Sample Type</th>
          <th style="width: 40px;">No.</th>
          <th style="width: 150px;">Sample Index</th>
          <th style="width: 100px;">TestPortion-Weight(g)±5%</th>
          <th style="width: 80px;">BPW Volume (ml)</th>
          <th style="width: 100px;">Salmonella Detection</th>
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
        <div class="header-center"><h1 class="header-title">Salmonella Technical Data Sheet</h1></div>
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
        </tbody>
      </table>

      <!-- Selective Enrichment Section -->
      <div class="section-header">Selective Enrichment</div>
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
            <td style="font-weight: 600;">M.S.R.V.</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">41.5±1 ℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr>
            <td style="font-weight: 600;">R.V.S.</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">41.5±1 ℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr style="background-color: #ffffff">
            <td style="font-weight: 600;">M.K.T.T.</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">34-38 ℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
        </tbody>
      </table>

      <!-- Isolation Section -->
      <div class="section-header">Isolation</div>
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
            <td style="font-weight: 600;">XLD</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">34-38 ℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr>
            <td style="font-weight: 600;">HK</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">34-38 ℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr style="background-color: #ffffff; height: 35px;">
            <td></td><td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;"></td>
            <td></td>
            <td style="text-align: center;"></td>
            <td></td><td></td>
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
            <td style="font-weight: 600;">TSA</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">34-38 ℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr>
            <td style="font-weight: 600;">PCA</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">34-38 ℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
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
        <div class="header-center"><h1 class="header-title">Salmonella Technical Data Sheet</h1></div>
        <div class="header-right"><div class="company-name">Sama Karbala Co.</div><div class="lab-unit">Laboratory Unit</div><div class="doc-code">MIC 000 R001</div></div>
      </div>

    <div class="section-header">Biochemical</div>
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
            <td style="font-weight: 600;">Urea</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">34-38 ℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr>
            <td style="font-weight: 600;">Kovack's Indol</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">34-38 ℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr style="background-color: #ffffff">
            <td style="font-weight: 600;">ONPG</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">34-38 ℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr>
            <td style="font-weight: 600;">MR</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">34-38 ℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr style="background-color: #ffffff">
            <td style="font-weight: 600;">VP</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">34-38 ℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr>
            <td style="font-weight: 600;">CaRAPIDtalase</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">34-38 ℃</td>
            <td></td>
            <td style="text-align: center;">24±3 h</td>
            <td></td><td></td>
          </tr>
          <tr style="background-color: #ffffff">
            <td style="font-weight: 600;">API 20E</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">34-38 ℃</td>
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

      <!-- Agglutination Section -->
      <div class="section-header">Agglutination</div>
      <table>
        <thead>
          <tr>
            <th rowspan="2">Test</th>
            <th rowspan="2">Batch №</th>
            <th colspan="2">Start</th>
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
            <td style="font-weight: 600;">Auto Agglutination (Saline)</td>
            <td></td><td></td><td></td><td></td><td></td>
          </tr>
          <tr>
            <td style="font-weight: 600;">Poly O</td>
            <td></td><td></td><td></td><td></td><td></td>
          </tr>
          <tr style="background-color: #ffffff">
            <td style="font-weight: 600;">Poly H</td>
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
        CONFIDENTIAL Use or transcription of this document is prohibited unless written authentication granted by Sama Karbala Co. for Agriculture & Animal Production ®. ©${new Date().getFullYear()} All rights reserved.
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
  <title>Salmonella Technical Data Sheet</title>
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

  // Expose export functions to parent component
  useImperativeHandle(ref, () => ({
    exportToExcel,
    exportToPDF
  }));


  if (loading) {
    return <div className="text-center py-10 font-bold text-gray-500">Loading samples...</div>;
  }

  return (
    <div className="max-w-[1200px] mx-auto">
      <div ref={sheetRef} className="bg-white p-8 shadow-lg print:shadow-none print:p-0 max-w-[210mm] mx-auto">
        {/* Header */}
        <div className="grid grid-cols-[120px_1fr_auto] gap-8 items-center border-b-4 border-gray-800 pb-4 mb-6">
          <div className="text-left">
            {/* Logo */}
            <div className="w-[120px] h-[120px] flex items-center justify-center">
              <img src="/assets/logo.png" alt="Sama Karbala Logo" className="w-full h-full object-contain" />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-700 mb-2">Salmonella Technical Data Sheet</h1>
            {/* <p className="text-sm"><strong>Test Method:</strong> ISO 6579-1:2017 / Amd.1:2020 (E)</p> */}
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold text-gray-800">Sama Karbala Co.</h2>
            <h3 className="text-sm font-medium text-gray-600">Laboratory Unit</h3>
            <p className="text-sm font-bold mt-1">MIC 000 R001</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-x-12 gap-y-4 mb-8 text-sm">
          <div className="col-span-2 flex items-center gap-2">
            <span className="font-bold min-w-[100px]">Test Method:</span>
            <span>ISO 6579-1:2017 / Amd.1:2020 (E)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold min-w-[100px]">Lab Code:</span>
            <div className="flex-1 flex items-center gap-2">
              <span className="text-gray-600">From:</span>
              <span className="border-b border-gray-400 flex-1 text-center pb-1">{sheetRows.length > 0 ? sheetRows[0].labCode : ''}</span>
              <span className="text-gray-600">To:</span>
              <span className="border-b border-gray-400 flex-1 text-center pb-1">{sheetRows.length > 0 ? sheetRows[sheetRows.length - 1].labCode : ''}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold min-w-[100px]">Test Date:</span>
            <span className="border-b border-gray-400 flex-1 pb-1"></span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold min-w-[100px]">MIC Code:</span>
            <div className="flex-1 flex items-center gap-2">
              <span className="text-gray-600">From:</span>
              <span className="border-b border-gray-400 flex-1 text-center pb-1">{sheetRows.length > 0 ? sheetRows[0].micCode : ''}</span>
              <span className="text-gray-600">To:</span>
              <span className="border-b border-gray-400 flex-1 text-center pb-1">{sheetRows.length > 0 ? sheetRows[sheetRows.length - 1].micCode : ''}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold min-w-[100px]">Received Date:</span>
            <div className="flex-1 flex items-center gap-2">
              <span className="text-gray-600">From:</span>
              <span className="border-b border-gray-400 flex-1 text-center pb-1">{startDate}</span>
              <span className="text-gray-600">To:</span>
              <span className="border-b border-gray-400 flex-1 text-center pb-1">{endDate}</span>
            </div>
          </div>
        </div>

        {/* Sample Description Section */}
        <div className="bg-slate-700 text-white p-2 font-bold mb-4 mt-6">Sample Description</div>
        <table className="w-full border-collapse mb-6 text-[11px]">
          <thead>
            <tr>
              <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Lab Code</th>
              <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">MIC Code</th>
              <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Sample Type</th>
              <th className="bg-slate-500 text-white p-2 text-left border border-gray-600 w-12">No.</th>
              <th className="bg-slate-500 text-white p-2 text-left border border-gray-600 w-20">Sample Index</th>
              <th className="bg-slate-500 text-white p-2 text-left border border-gray-600 w-24">TestPortion-Weight(g)±5%</th>
              <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">BPW Volume (ml)</th>
              <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Salmonella Detection</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i} className="bg-white">
                <td className="border border-gray-300 p-2 h-8">{row.labCode}</td>
                <td className="border border-gray-300 p-2">{row.micCode}</td>
                <td className="border border-gray-300 p-2">{row.sampleType}</td>
                <td className="border border-gray-300 p-2 text-center">{row.serialNo}</td>
                <td className="border border-gray-300 p-2">{row.sampleIndex}</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Non-selective Enrichment Section */}
        <div className="page-break-before">
          <div className="bg-slate-700 text-white p-2 font-bold mb-4 mt-6">Non-selective Enrichment</div>
          <table className="w-full border-collapse mb-6 text-[11px]">
            <thead>
              <tr>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Media</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Batch №</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Incubator No.</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600" colSpan={2}>Start</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Temp. (℃)</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Range (℃)</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Period (h)</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Range (h)</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Result</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Operator Signature</th>
              </tr>
              <tr>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600">Day</th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600">Time</th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 p-2 font-medium">B.P.W.</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2 text-center">34-38 ℃</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2 text-center">18±2 h</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
              </tr>
            </tbody>
          </table>

          {/* Selective Enrichment Section */}
          <div className="bg-slate-700 text-white p-2 font-bold mb-4 mt-6">Selective Enrichment</div>
          <table className="w-full border-collapse mb-6 text-[11px]">
            <thead>
              <tr>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Media</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Batch №</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Incubator No.</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600" colSpan={2}>Start</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Temp. (℃)</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Range (℃)</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Period (h)</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Range (h)</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Result</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Operator Signature</th>
              </tr>
              <tr>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600">Day</th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600">Time</th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 p-2 font-medium">M.S.R.V.</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2 text-center">41.5±1 ℃</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2 text-center">24±3 h</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
              </tr>
              <tr className="bg-white">
                <td className="border border-gray-300 p-2 font-medium">R.V.S.</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2 text-center">41.5±1 ℃</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2 text-center">24±3 h</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 p-2 font-medium">M.K.T.T.</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2 text-center">34-38 ℃</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2 text-center">24±3 h</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
              </tr>
            </tbody>
          </table>

          {/* Isolation Section */}
          <div className="bg-slate-700 text-white p-2 font-bold mb-4 mt-6">Isolation</div>
          <table className="w-full border-collapse mb-6 text-[11px]">
            <thead>
              <tr>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Media</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Batch №</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Incubator No.</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600" colSpan={2}>Start</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Temp. (℃)</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Range (℃)</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Period (h)</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Range (h)</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Result</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Operator Signature</th>
              </tr>
              <tr>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600">Day</th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600">Time</th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 p-2 font-medium">XLD</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2 text-center">34-38 ℃</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2 text-center">24±3 h</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
              </tr>
              <tr className="bg-white">
                <td className="border border-gray-300 p-2 font-medium">HK</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2 text-center">34-38 ℃</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2 text-center">24±3 h</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
              </tr>
              <tr className="bg-gray-50" style={{height: '35px'}}>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2 text-center"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2 text-center"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
              </tr>
            </tbody>
          </table>

          {/* Subculture Section */}
          <div className="bg-slate-700 text-white p-2 font-bold mb-4 mt-6">Subculture</div>
          <table className="w-full border-collapse mb-6 text-[11px]">
            <thead>
              <tr>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Media</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Batch №</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Incubator No.</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600" colSpan={2}>Start</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Temp. (℃)</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Range (℃)</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Period (h)</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Range (h)</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Result</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Operator Signature</th>
              </tr>
              <tr>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600">Day</th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600">Time</th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 p-2 font-medium">TSA</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2 text-center">34-38 ℃</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2 text-center">24±3 h</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
              </tr>
              <tr className="bg-white">
                <td className="border border-gray-300 p-2 font-medium">PCA</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2 text-center">34-38 ℃</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2 text-center">24±3 h</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
              </tr>
            </tbody>
          </table>

        </div>

        {/* Biochemical Section */}
        <div className="page-break-before">
          <div className="bg-slate-700 text-white p-2 font-bold mb-4 mt-6">Biochemical</div>
          <table className="w-full border-collapse mb-6 text-[11px]">
            <thead>
              <tr>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Media</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Batch №</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Incubator No.</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600" colSpan={2}>Start</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Temp. (℃)</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Range (℃)</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Period (h)</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Range (h)</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Result</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Operator Signature</th>
              </tr>
              <tr>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600">Day</th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600">Time</th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'T.S.I.', temp: '34-38 ℃' },
                { name: 'Lysine', temp: '34-38 ℃' },
                { name: 'Urea', temp: '34-38 ℃' },
                { name: "Kovack's Indol", temp: '34-38 ℃' },
                { name: 'ONPG', temp: '34-38 ℃' },
                { name: 'MR', temp: '34-38 ℃' },
                { name: 'VP', temp: '34-38 ℃' },
                { name: 'CaRAPIDtalase', temp: '34-38 ℃' },
                { name: 'API 20E', temp: '34-38 ℃' },
                { name: '', temp: '' },
                { name: '', temp: '' },
              ].map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'} style={!item.name ? {height: '35px'} : {}}>
                  <td className="border border-gray-300 p-2 font-medium h-8">{item.name}</td>
                  <td className="border border-gray-300 p-2"></td>
                  <td className="border border-gray-300 p-2"></td>
                  <td className="border border-gray-300 p-2"></td>
                  <td className="border border-gray-300 p-2"></td>
                  <td className="border border-gray-300 p-2"></td>
                  <td className="border border-gray-300 p-2 text-center">{item.temp}</td>
                  <td className="border border-gray-300 p-2"></td>
                  <td className="border border-gray-300 p-2 text-center">24±3 h</td>
                  <td className="border border-gray-300 p-2"></td>
                  <td className="border border-gray-300 p-2"></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Agglutination Section */}
          <div className="bg-slate-700 text-white p-2 font-bold mb-4 mt-6">Agglutination</div>
          <table className="w-full border-collapse mb-6 text-[11px]">
            <thead>
              <tr>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Test</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Batch №</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600" colSpan={2}>Start</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Result</th>
                <th className="bg-slate-500 text-white p-2 text-left border border-gray-600">Operator Signature</th>
              </tr>
              <tr>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600">Day</th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600">Time</th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
                <th className="bg-slate-500 text-white p-2 border border-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              {['Auto Agglutination (Saline)', 'Poly O', 'Poly H'].map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="border border-gray-300 p-2 font-medium">{item}</td>
                  <td className="border border-gray-300 p-2"></td>
                  <td className="border border-gray-300 p-2"></td>
                  <td className="border border-gray-300 p-2"></td>
                  <td className="border border-gray-300 p-2"></td>
                  <td className="border border-gray-300 p-2"></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Signature Section */}
          <div className="grid grid-cols-3 gap-8 mt-12 pt-8 border-t-2 border-gray-800">
            <div className="text-left">
              <label className="font-bold block mb-8">Technician:</label>
              <div className="border-t border-gray-800 pt-2 mt-4 text-sm">Sign: ___________________________</div>
              <div className="border-t border-gray-800 pt-2 mt-4 text-sm">Date: ___________________________</div>
            </div>
            <div className="text-left">
              <label className="font-bold block mb-8">Head Unit:</label>
              <div className="border-t border-gray-800 pt-2 mt-4 text-sm">Sign: ___________________________</div>
              <div className="border-t border-gray-800 pt-2 mt-4 text-sm">Date: ___________________________</div>
            </div>
            <div className="text-left">
              <label className="font-bold block mb-8">Quality Manager:</label>
              <div className="border-t border-gray-800 pt-2 mt-4 text-sm">Sign: ___________________________</div>
              <div className="border-t border-gray-800 pt-2 mt-4 text-sm">Date: ___________________________</div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-[10px] text-red-500 font-bold mt-8 pt-6 border-t-2 border-gray-800">
            CONFIDENTIAL Use or transcription of this document is prohibited unless written authentication granted by Sama Karbala Co. for Agriculture & Animal Production ®. ©2025 All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
});
