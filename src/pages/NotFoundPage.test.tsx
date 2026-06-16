import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFoundPage from './NotFoundPage';

describe('NotFoundPage', () => {
    it('renders the 404 message and a link home', () => {
        render(
            <MemoryRouter>
                <NotFoundPage />
            </MemoryRouter>
        );
        expect(screen.getByText('404')).toBeInTheDocument();
        expect(screen.getByText(/page not found/i)).toBeInTheDocument();
        const homeLink = screen.getByRole('link', { name: /return home/i });
        expect(homeLink).toHaveAttribute('href', '/');
    });
});
