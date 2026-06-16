import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';

const Boom = () => {
    throw new Error('kaboom');
};

describe('ErrorBoundary', () => {
    let consoleError: jest.SpyInstance;

    beforeEach(() => {
        // React logs caught errors; silence them to keep test output clean.
        consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
    });

    it('renders children when nothing throws', () => {
        render(
            <MemoryRouter>
                <ErrorBoundary>
                    <p>all good</p>
                </ErrorBoundary>
            </MemoryRouter>
        );
        expect(screen.getByText('all good')).toBeInTheDocument();
    });

    it('renders the fallback when a child throws during render', () => {
        render(
            <MemoryRouter>
                <ErrorBoundary>
                    <Boom />
                </ErrorBoundary>
            </MemoryRouter>
        );
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /return home/i })).toBeInTheDocument();
    });
});
