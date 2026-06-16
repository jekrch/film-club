import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Catch-all route for unknown URLs. Without this, an unmatched path renders an
 * empty `<main>` and looks like a broken app.
 */
const NotFoundPage: React.FC = () => {
    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center text-slate-300 min-h-[calc(100vh-200px)]">
            <p className="text-6xl font-bold text-slate-100 mb-4">404</p>
            <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
            <p className="text-slate-400 mb-8">
                The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.
            </p>
            <Link
                to="/"
                className="inline-block px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors font-medium"
            >
                Return home
            </Link>
        </div>
    );
};

export default NotFoundPage;
