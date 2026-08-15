import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfileListsSection from './ProfileListsSection';
import { FilmListDefinition } from '../../types/list';
import { ClubAuthProvider } from '../../auth/GoogleAuth';

const list: FilmListDefinition = {
    id: 'andy-top-horror',
    name: 'Top Horror',
    owner: 'Andy',
    description: 'The ones that actually got to me.',
    entries: [
        { rank: 1, imdbID: 'tt0078748', description: null },
        { rank: 2, imdbID: 'tt0081505', description: null },
    ],
};

// Signed out, since the test env configures no worker — so the editing links
// stay hidden and the section behaves as it does for any visitor.
const renderSection = (lists: FilmListDefinition[]) =>
    render(
        <ClubAuthProvider>
            <MemoryRouter>
                <ProfileListsSection lists={lists} owner="Andy" />
            </MemoryRouter>
        </ClubAuthProvider>
    );

describe('ProfileListsSection', () => {
    it('renders nothing for a member with no lists', () => {
        const { container } = renderSection([]);
        expect(container).toBeEmptyDOMElement();
    });

    it('links each list to its page and shows its entry count', () => {
        renderSection([list]);
        expect(screen.getByRole('link', { name: /Top Horror/i })).toHaveAttribute(
            'href',
            '/lists/andy-top-horror'
        );
        expect(screen.getByText('2 films')).toBeInTheDocument();
    });
});
