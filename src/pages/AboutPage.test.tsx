import { render, screen, within } from '@testing-library/react';
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
        expect(screen.getAllByText(/Committee/i).length).toBeGreaterThan(0);
    });

    it('separates the selection committee from friends of the club', () => {
        render(
            <MemoryRouter>
                <AboutPage />
            </MemoryRouter>
        );
        const section = (name: string) => within(screen.getByRole('region', { name }));

        expect(section('Committee').getByText('Jacob')).toBeInTheDocument();
        expect(section('Committee').queryByText('Dustin')).not.toBeInTheDocument();
        expect(section('Friends of the Club').getByText('Dustin')).toBeInTheDocument();
        expect(section('Friends of the Club').queryByText('Jacob')).not.toBeInTheDocument();
    });
});
