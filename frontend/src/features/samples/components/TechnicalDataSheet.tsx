import React, { useState, useRef } from 'react';
import { SalmonellaSheet } from './sheets/SalmonellaSheet';
import { TotalCountSheet } from './sheets/TotalCountSheet';
import { FungiSheet } from './sheets/FungiSheet';
import { WaterSheet } from './sheets/WaterSheet';
import { CultureIsolationSheet } from './sheets/CultureIsolationSheet';

type SheetType = 'salmonella' | 'total_count' | 'fungi' | 'culture' | 'water';

import { validateDateRange } from '../utils/sheetUtils';
import { SheetRef } from '../types/sheetTypes';

export const TechnicalDataSheet: React.FC = () => {
    const [activeTab, setActiveTab] = useState<SheetType>('salmonella');
    const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const sheetRef = useRef<SheetRef>(null);

    const tabs: { id: SheetType; label: string }[] = [
        { id: 'salmonella', label: 'Salmonella' },
        { id: 'total_count', label: 'Total Count' },
        { id: 'fungi', label: 'Fungi' },
        { id: 'culture', label: 'Culture' },
        { id: 'water', label: 'Water' },
    ];

    const handleExportExcel = () => {
        if (!validateDateRange(startDate, endDate)) {
            alert('Invalid Date Range: Start date cannot be after end date.');
            return;
        }
        sheetRef.current?.exportToExcel();
    };

    const handleExportPDF = () => {
        if (!validateDateRange(startDate, endDate)) {
            alert('Invalid Date Range: Start date cannot be after end date.');
            return;
        }
        sheetRef.current?.exportToPDF();
    };

    const renderSheet = () => {
        switch (activeTab) {
            case 'salmonella':
                return <SalmonellaSheet ref={sheetRef} startDate={startDate} endDate={endDate} />;
            case 'total_count':
                return <TotalCountSheet ref={sheetRef} startDate={startDate} endDate={endDate} />;
            case 'fungi':
                return <FungiSheet ref={sheetRef} startDate={startDate} endDate={endDate} />;
            case 'culture':
                return <CultureIsolationSheet ref={sheetRef} startDate={startDate} endDate={endDate} />;
            case 'water':
                return <WaterSheet ref={sheetRef} startDate={startDate} endDate={endDate} />;
            default:
                return <SalmonellaSheet ref={sheetRef} startDate={startDate} endDate={endDate} />;
        }
    };

    return (
        <div className="p-6 min-h-screen bg-gray-100">
            {/* Control Bar - Tabs and Date Range on same line */}
            <div className="mb-6 bg-white p-4 rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-4 print:hidden">
                {/* Tabs Section */}
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === tab.id
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Date Range and Export Buttons */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">From:</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">To:</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export Excel
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Export PDF
                    </button>
                </div>

            </div>

            {/* Sheet Container */}
            <div className="print:p-0">
                {renderSheet()}
            </div>
        </div>
    );
};

export default TechnicalDataSheet;
