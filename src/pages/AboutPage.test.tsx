import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AboutPage from './AboutPage';

describe('AboutPage', () => {
    it('renders without crashing and shows the page heading', () => {
        render(
            <MemoryRouter>
                <AboutPage />
            </MemoryRouter>
        );
        // Heading text appears (SectionHeader + visible copy both use this string).
        expect(screen.getAllByText(/about our film club/i).length).toBeGreaterThan(0);
    });
});
