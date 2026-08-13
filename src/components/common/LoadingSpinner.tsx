import React from 'react';

/**
 * A simple centered loading spinner component.
 */
const LoadingSpinner: React.FC = () => {
    return (
        // No background: the page's own gradient reads through. A solid panel
        // here is a visibly different colour from every page it covers, so any
        // frame it does get shown for reads as a flash rather than as a pause.
        <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
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