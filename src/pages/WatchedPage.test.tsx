import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import WatchedPage from './WatchedPage';
import { filmData } from '../types/film';
import { ClubAuthProvider } from '../auth/GoogleAuth';
import { ResponsesProvider } from '../contexts/ResponsesContext';

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
            // One film, and one the club never watched — the shape of a
            // brand-new log.
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
            // Long enough to page. One date throughout, so the log's tiebreak on
            // the id keeps these in the order they're written: `tt1000050` is
            // the row at index 50.
            Greg: Array.from({ length: 95 }, (_, index) => ({
                imdbID: `tt${1000000 + index}`,
                watchDate: '2026-05-01',
                score: null,
                scoreQualifier: null,
                blurb: null,
                updatedAt: '2026-05-01T12:00:00Z',
            })),
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
const renderFor = (memberName: string, hash = '') =>
    render(
        <ClubAuthProvider>
            <ResponsesProvider>
                <MemoryRouter initialEntries={[`/watched/${memberName}${hash}`]}>
                    <Routes>
                        <Route path="/watched/:memberName" element={<WatchedPage />} />
                    </Routes>
                </MemoryRouter>
            </ResponsesProvider>
        </ClubAuthProvider>
    );

describe('WatchedPage', () => {
    it('renders the log under its owner, with a count', () => {
        renderFor('Andy');
        expect(screen.getByRole('heading', { name: "Andy's film log" })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: '2 Films' })).toBeInTheDocument();
    });

    it('puts its owner’s photo in the banner, linking to their profile', () => {
        renderFor('Andy');
        expect(screen.getByAltText('Andy')).toHaveAttribute('src', '/images/andy.jpg');
        expect(screen.getByAltText('Andy').closest('a')).toHaveAttribute('href', '/profile/Andy');
        expect(screen.getByRole('link', { name: 'View profile' })).toHaveAttribute(
            'href',
            '/profile/Andy'
        );
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

    // Scoped to the log itself: the banner credits the same films by name, and
    // those links are the subject of their own test below.
    it('links a club film to its film page and marks it as one', () => {
        renderFor('Andy');
        const log = within(screen.getByRole('list'));
        const links = log.getAllByRole('link', { name: new RegExp(filmData[0].title, 'i') });
        expect(links).toHaveLength(1);
        expect(links[0]).toHaveAttribute('href', `/films/${filmData[0].imdbID}`);
        expect(screen.getByText('Club film')).toBeInTheDocument();
    });

    // The poster opens the row's details in place rather than leaving the page,
    // and does the same thing as the chevron beside the title.
    it('opens a row’s details from its poster', () => {
        renderFor('Andy');
        const log = within(screen.getByRole('list'));
        const posterButton = log.getByAltText(`${filmData[0].title} poster`).closest('button');
        expect(posterButton).not.toBeNull();
        expect(posterButton).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(posterButton!);
        expect(posterButton).toHaveAttribute('aria-expanded', 'true');
        expect(
            document.getElementById(posterButton!.getAttribute('aria-controls')!)
        ).not.toBeNull();
    });

    // With no details to open, the poster keeps linking where the title does,
    // so the picture and the name never go to different places.
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

    // A log of non-club films still gets a banner, using the poster from the
    // summary cache and crediting it to IMDb rather than to a film page.
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
        expect(
            screen.getByText(/hasn't logged anything watched outside the club/i)
        ).toBeInTheDocument();
    });

    describe('paging', () => {
        const rows = () => document.querySelectorAll('li[id^="log-"]');
        const showMore = () => screen.queryByRole('button', { name: 'Show more' });

        it('shows a page at a time, while the heading counts the whole log', () => {
            renderFor('Greg');
            expect(screen.getByRole('heading', { name: '95 Films' })).toBeInTheDocument();
            expect(rows()).toHaveLength(40);
            expect(screen.getByText('40 of 95')).toBeInTheDocument();

            fireEvent.click(showMore()!);
            expect(rows()).toHaveLength(80);
            expect(screen.getByText('80 of 95')).toBeInTheDocument();
        });

        it('stops offering more once the log has run out', () => {
            renderFor('Greg');
            fireEvent.click(showMore()!);
            fireEvent.click(showMore()!);
            expect(rows()).toHaveLength(95);
            expect(showMore()).not.toBeInTheDocument();
        });

        it('offers nothing on a log that fits on one page', () => {
            renderFor('Andy');
            expect(showMore()).not.toBeInTheDocument();
        });

        // Every log row on the wall links here by name, so this is the common
        // way into the older half of a long log.
        describe('with a link to a row past the first page', () => {
            let scrollIntoView: jest.SpyInstance;

            beforeEach(() => {
                scrollIntoView = jest
                    .spyOn(Element.prototype, 'scrollIntoView')
                    .mockImplementation(() => {});
            });

            afterEach(() => scrollIntoView.mockRestore());

            it('reaches that row in whole pages and scrolls to it', () => {
                renderFor('Greg', '#log-tt1000050');
                expect(rows()).toHaveLength(80);
                expect(scrollIntoView.mock.instances[0]).toBe(
                    document.getElementById('log-tt1000050')
                );
            });

            it('still adds a full page on the next click', () => {
                renderFor('Greg', '#log-tt1000050');
                fireEvent.click(showMore()!);
                expect(rows()).toHaveLength(95);
            });
        });
    });

    // The profile's watch preview links to a row by name so the click lands on
    // the film it was made on, rather than at the top of the log.
    describe('arriving at a named row', () => {
        let scrollIntoView: jest.SpyInstance;

        beforeEach(() => {
            scrollIntoView = jest
                .spyOn(Element.prototype, 'scrollIntoView')
                .mockImplementation(() => {});
        });

        afterEach(() => scrollIntoView.mockRestore());

        it('scrolls that row into view and marks it', () => {
            renderFor('Andy', '#log-tt9999999');

            const row = document.getElementById('log-tt9999999');
            expect(row).toHaveTextContent('A Cached Film');
            expect(scrollIntoView).toHaveBeenCalledTimes(1);
            expect(scrollIntoView.mock.instances[0]).toBe(row);
            expect(row?.querySelector('.row-arrival')).toBeInTheDocument();
        });

        it('leaves a plain visit at the top of the log', () => {
            renderFor('Andy');
            expect(scrollIntoView).not.toHaveBeenCalled();
            expect(document.querySelector('.row-arrival')).not.toBeInTheDocument();
        });

        it('ignores a hash naming a film the member never logged', () => {
            renderFor('Andy', '#log-tt0000000');
            expect(scrollIntoView).not.toHaveBeenCalled();
        });
    });

    it('reports an unknown member rather than rendering an empty log', () => {
        renderFor('Nobody');
        expect(screen.getByText(/No club member named "Nobody"/i)).toBeInTheDocument();
    });
});
