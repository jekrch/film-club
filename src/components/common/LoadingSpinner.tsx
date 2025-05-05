import React from 'react';

/**
 * A simple centered loading spinner component.
 */
const LoadingSpinner: React.FC = () => {
    return (
        <div className="flex justify-center items-center min-h-[calc(100vh-200px)] bg-slate-900">
            <div
                className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"
                role="status" // Accessibility: indicates loading status
                aria-live="polite" // Accessibility: announce changes politely
            >
                <span className="sr-only">Loading...</span> {/* Accessibility: screen reader text */}
            </div>
        </div>
    );
};

export default LoadingSpinner;