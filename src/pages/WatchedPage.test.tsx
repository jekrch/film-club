import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import WatchedPage from './WatchedPage';
import { filmData } from '../types/film';
import { ClubAuthProvider } from '../auth/GoogleAuth';

// The bundled watched.json is the author's own local data, so the page is
// exercised against a fixture instead. One entry is a real club film, which is
// the case worth pinning down: it must link to the film page and be marked as a
// club film without ever borrowing the club's rating.
jest.mock('../types/watched', () => {
    const { filmData: films } = jest.requireActual('../types/film');
    return {
        watchedLog: {
            Andy: [
                {
                    imdbID: 'tt9999999',
                    watchDate: '2026-07-14',
                    score: null,
                    scoreQualifier: null,
                    blurb: null,
                    updatedAt: '2026-07-14T19:02:10Z',
                },
                {
                    imdbID: films[0].imdbID,
                    watchDate: '2026-08-09',
                    score: 8,
                    scoreQualifier: null,
                    blurb: 'Watched it again on my own.',
                    updatedAt: '2026-08-09T21:14:02Z',
                },
            ],
            // One film, and one the club never watched — the shape a log has on
            // the day a member starts one, and the case the banner used to
            // render nothing at all for.
            Mark: [
                {
                    imdbID: 'tt9999999',
                    watchDate: '2026-06-01',
                    score: null,
                    scoreQualifier: null,
                    blurb: null,
                    updatedAt: '2026-06-01T12:00:00Z',
                },
            ],
        },
    };
});

jest.mock('../types/list', () => ({
    filmLists: [],
    listFilmSummaries: {
        tt9999999: {
            imdbID: 'tt9999999',
            title: 'A Cached Film',
            year: '1985',
            poster: 'https://example.com/cached.jpg',
        },
    },
}));

// The page reads the editing session to decide whether to offer the search box
// and row editors. The provider mounts signed out and, with no worker
// configured in the test env, stays that way — so these assertions see the
// read-only page every visitor gets.
const renderFor = (memberName: string) =>
    render(
        <ClubAuthProvider>
            <MemoryRouter initialEntries={[`/watched/${memberName}`]}>
                <Routes>
                    <Route path="/watched/:memberName" element={<WatchedPage />} />
                </Routes>
            </MemoryRouter>
        </ClubAuthProvider>
    );

describe('WatchedPage', () => {
    it('renders the log under its owner, with a count', () => {
        renderFor('Andy');
        expect(screen.getByRole('heading', { name: /Andy's watch log/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: '2 Films' })).toBeInTheDocument();
    });

    it('orders by most recent viewing regardless of stored order', () => {
        renderFor('Andy');
        const items = screen.getAllByRole('listitem');
        expect(items[0]).toHaveTextContent(filmData[0].title);
        expect(items[1]).toHaveTextContent('A Cached Film');
    });

    it('shows the member’s own score and review, not the club’s', () => {
        renderFor('Andy');
        expect(screen.getByText('8')).toBeInTheDocument();
        expect(screen.getByText(/Watched it again on my own/i)).toBeInTheDocument();
    });

    // The poster and the title are separate anchors sharing one target, so both
    // are asserted — a row whose picture and name went to different places
    // would be worse than either being wrong. Scoped to the log itself: the
    // banner credits the same films by name, and those links are the subject of
    // their own test below.
    it('links a club film to its film page and marks it as one', () => {
        renderFor('Andy');
        const log = within(screen.getByRole('list'));
        const links = log.getAllByRole('link', { name: new RegExp(filmData[0].title, 'i') });
        expect(links).toHaveLength(2);
        links.forEach((link) => expect(link).toHaveAttribute('href', `/films/${filmData[0].imdbID}`));
        expect(screen.getByText('Club film')).toBeInTheDocument();
    });

    it('links a film the club never watched out to IMDb', () => {
        renderFor('Andy');
        const log = within(screen.getByRole('list'));
        const links = log.getAllByRole('link', { name: /A Cached Film/i });
        expect(links).toHaveLength(2);
        links.forEach((link) => {
            expect(link).toHaveAttribute('href', 'https://www.imdb.com/title/tt9999999/');
            expect(link).toHaveAttribute('target', '_blank');
        });
    });

    // The banner used to be able to draw only on club films, which left a log
    // of films the club never watched with a plain card. It now takes the
    // poster from the summary cache, and credits it out to IMDb rather than to
    // a film page that doesn't exist.
    it('builds its banner from films the club never watched', () => {
        renderFor('Andy');
        const credits = screen
            .getAllByRole('link', { name: /A Cached Film/i })
            .filter((link) => link.className.includes('hero-credit'));
        expect(credits).toHaveLength(1);
        expect(credits[0]).toHaveAttribute('href', 'https://www.imdb.com/title/tt9999999/');
    });

    // A lone frame can't be a collage, so a one-film log gets the whole banner
    // width instead of nothing.
    it('still gives a one-film log its banner art', () => {
        renderFor('Mark');
        const credits = screen
            .getAllByRole('link', { name: /A Cached Film/i })
            .filter((link) => link.className.includes('hero-credit'));
        expect(credits).toHaveLength(1);
    });

    it('offers no editing surface to a signed-out visitor', () => {
        renderFor('Andy');
        expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
    });

    it('says so plainly when a member has logged nothing', () => {
        renderFor('Jacob');
        expect(screen.getByRole('heading', { name: '0 Films' })).toBeInTheDocument();
        expect(screen.getByText(/hasn't logged anything watched outside the club/i)).toBeInTheDocument();
    });

    it('reports an unknown member rather than rendering an empty log', () => {
        renderFor('Nobody');
        expect(screen.getByText(/No club member named "Nobody"/i)).toBeInTheDocument();
    });
});
