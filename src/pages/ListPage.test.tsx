import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ListPage from './ListPage';
import { filmData } from '../types/film';
import { ClubAuthProvider } from '../auth/GoogleAuth';

// The bundled lists.json is empty (lists are authored on the site), so the page
// is exercised against a fixture. The first entry is a real club film so the
// club-film branch — a link to /films/:imdbId — is the one under test.
jest.mock('../types/list', () => {
    const { filmData: films } = jest.requireActual('../types/film');
    return {
        filmLists: [
            {
                id: 'andy-top-horror',
                name: 'Top Horror',
                owner: 'Andy',
                description: 'The ones that actually got to me.',
                entries: [
                    { rank: 2, imdbID: 'tt9999999', description: null },
                    { rank: 1, imdbID: films[0].imdbID, description: 'Still the high-water mark.' },
                ],
            },
        ],
        listFilmSummaries: {
            tt9999999: {
                imdbID: 'tt9999999',
                title: 'A Cached Film',
                year: '1985',
                poster: 'https://example.com/cached.jpg',
            },
        },
    };
});

// The page reads the editing session to decide whether to offer an "Edit this
// list" link. The provider mounts signed out and, with no worker configured in
// the test env, stays that way — so these assertions see the read-only page.
const renderAt = (listId: string) =>
    render(
        <ClubAuthProvider>
            <MemoryRouter initialEntries={[`/lists/${listId}`]}>
                <Routes>
                    <Route path="/lists/:listId" element={<ListPage />} />
                </Routes>
            </MemoryRouter>
        </ClubAuthProvider>
    );

describe('ListPage', () => {
    it('renders the list name, its owner, and its description', () => {
        renderAt('andy-top-horror');
        expect(screen.getByText('Top Horror')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Andy' })).toHaveAttribute('href', '/profile/Andy');
        expect(screen.getByText(/actually got to me/i)).toBeInTheDocument();
    });

    it('renders entries in rank order regardless of stored order', () => {
        renderAt('andy-top-horror');
        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(2);
        expect(items[0]).toHaveTextContent(filmData[0].title);
        expect(items[1]).toHaveTextContent('A Cached Film');
    });

    it('links a club film to its detail page and a list-only film out to IMDb', () => {
        renderAt('andy-top-horror');
        const clubLinks = screen.getAllByRole('link', { name: new RegExp(filmData[0].title, 'i') });
        expect(clubLinks[0]).toHaveAttribute('href', `/films/${filmData[0].imdbID}`);

        const cachedLinks = screen.getAllByRole('link', { name: /A Cached Film/i });
        expect(cachedLinks[0]).toHaveAttribute('href', 'https://www.imdb.com/title/tt9999999/');
    });

    it('shows an error for an unknown list id', () => {
        renderAt('does-not-exist');
        expect(screen.getByRole('alert')).toHaveTextContent(/not found/i);
    });
});
