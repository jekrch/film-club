import React from 'react';
import Button from './Button';
import { useNavigate } from 'react-router-dom';

/**
 * Props for the ErrorDisplay component.
 */
interface ErrorDisplayProps {
    /** The error message to display. */
    message: string;
    /** The path to navigate to when the back button is clicked. */
    backPath?: string;
    /** Optional label for the back button. Defaults to "Back". */
    backButtonLabel?: string;
}

/**
 * Displays a standardized error message block with an optional back button.
 */
const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
    message,
    backPath,
    backButtonLabel = 'Back', // Default label
}) => {
    const navigate = useNavigate();

    // Handler for the back button click
    const handleBackClick = () => {
        if (backPath) {
            navigate(backPath);
        } else {
            navigate(-1); // Go back to the previous page if no path specified
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center bg-slate-900 text-slate-300 min-h-[calc(100vh-200px)]">
            {/* Error message box */}
            <div
                className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded relative mb-6 inline-block shadow"
                role="alert"
            >
                <strong className="font-bold block sm:inline">Error: </strong>
                <span className="block sm:inline">{message}</span>
            </div>
            {/* Back button (conditionally rendered based on backPath or default behavior) */}
            <div>
                <Button onClick={handleBackClick} variant="solid" size="md">
                    {backButtonLabel}
                </Button>
            </div>
        </div>
    );
};

export default ErrorDisplay;
