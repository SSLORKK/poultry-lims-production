import React from 'react';

const PlaceholderSheet: React.FC<{ title: string }> = ({ title }) => (
    <div className="bg-white p-8 max-w-[1200px] mx-auto shadow-lg min-h-[600px] flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h2 className="text-xl font-semibold mb-2">{title} Technical Data Sheet</h2>
        <p>This sheet is currently under development.</p>
    </div>
);

export const FungiSheet = () => <PlaceholderSheet title="Fungi" />;
