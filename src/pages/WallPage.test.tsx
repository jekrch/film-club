import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WallPage from './WallPage';

// The bundled data is the club's real history — seventy-odd screenings — so the
// page is exercised against a fixture holding one of each kind of event instead.
// The dates are chosen to interleave: the wall's whole claim is that four
// different files come out in one order, and a fixture where each kind clumps
// would not test that at all.
jest.mock('../types/film', () => ({
    filmData: [
        {
            imdbID: 'tt1000001',
            title: 'The Screening',
            year: '1999',
            poster: 'https://example.com/screening.jpg',
            ratings: [],
            type: 'movie',
            movieClubInfo: {
                selector: 'Mark',
                watchDate: '09/01/2026',
                clubRatings: [
                    { user: 'andy', score: 8, blurb: null },
                    { user: 'gabe', score: 5, blurb: null },
                ],
                trophyNotes: 'Joey gets togetherness trophy',
            },
        },
    ],
}));

jest.mock('../types/watched', () => ({
    watchedLog: {
        Gabe: [
            {
                imdbID: 'tt1000009',
                watchDate: '2026-09-04',
                score: 7,
                scoreQualifier: null,
                blurb: 'Watched it on my own.\nTwice, actually.',
                updatedAt: '2026-09-04T21:14:02Z',
            },
        ],
    },
}));

jest.mock('../types/list', () => ({
    filmLists: [
        {
            id: 'jacob-therapists',
            name: 'Even Your Therapist',
            owner: 'Jacob',
            description: null,
            ranked: false,
            createdAt: '2026-08-15T23:43:02Z',
            entries: [{ rank: 1, imdbID: 'tt1000009', description: null }],
        },
    ],
    listFilmSummaries: {
        tt1000009: {
            imdbID: 'tt1000009',
            title: 'A Cached Film',
            year: '1985',
            poster: 'https://example.com/cached.jpg',
        },
    },
}));

jest.mock('../types/trophy', () => ({
    trophyIndex: { films: {} },
    getBundledTrophies: () => [],
}));

const renderWall = () =>
    render(
        <MemoryRouter>
            <WallPage />
        </MemoryRouter>
    );

/**
 * The boxes, in the order the wall drew them. Scoped to the `article` each box
 * is rather than to list items, since a box that has folded a night's trophies
 * in carries list items of its own.
 */
const rows = () => screen.getAllByRole('article');

/**
 * jsdom lays nothing out, so every element reports a height of zero and prose
 * clamped to two lines can never say it was cut off. These make it say so, which
 * is the only thing the collapsible keys its toggle off.
 */
const stubOverflow = () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
        configurable: true,
        value: 200,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        value: 40,
    });
};

afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
    Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
});

describe('WallPage', () => {
    it('interleaves every kind of event into one column, newest first', () => {
        renderWall();

        // Gabe's log on the 4th outranks the screening on the 1st, which is the
        // interleaving the wall exists for. The trophy given at that screening
        // is folded into it rather than drawn as a fourth box under the same
        // poster.
        expect(rows()).toHaveLength(3);
        expect(rows()[0]).toHaveTextContent(/Gabe\s*logged\s*A Cached Film/);
        expect(rows()[1]).toHaveTextContent(/The club watched\s*The Screening/);
        expect(rows()[1]).toHaveTextContent(/Joey\s*won the\s*Togetherness trophy/);
        expect(rows()[2]).toHaveTextContent(/Jacob\s*started a list\s*Even Your Therapist/);
    });

    it('heads each run with the month it fell in', () => {
        renderWall();
        expect(screen.getByRole('heading', { name: 'September 2026' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'August 2026' })).toBeInTheDocument();
    });

    it('counts the events it is showing, not the boxes it drew them in', () => {
        renderWall();
        // Four records, three boxes: the heading counts what happened.
        expect(screen.getByRole('heading', { name: '4 Events' })).toBeInTheDocument();
    });

    it('draws one poster for a screening and the trophies handed out at it', () => {
        renderWall();

        // The screening's box holds the award, and the film's poster appears in
        // it once — which is the whole point of the fold.
        const screening = within(rows()[1]);
        expect(screening.getAllByAltText('The Screening poster')).toHaveLength(1);
        expect(screening.getByText('Togetherness trophy')).toBeInTheDocument();
        // Folded in, the award drops the film the headline already names.
        expect(rows()[1].textContent).not.toMatch(/Togetherness trophy\s*on/);
    });

    it("shows the club's average on a screening and the member's own score on a log", () => {
        renderWall();

        const screening = within(rows()[1]);
        expect(screening.getByText('6.5')).toBeInTheDocument();
        expect(screening.getByText('Club avg')).toBeInTheDocument();
        // Whose pick it was, linking to them — the one attribution a screening has.
        expect(screening.getByRole('link', { name: 'Mark' })).toHaveAttribute(
            'href',
            '/profile/Mark'
        );

        // The log's 7 is Gabe's alone and is never labelled an average.
        const log = within(rows()[0]);
        expect(log.getByText('7')).toBeInTheDocument();
        expect(log.queryByText('Club avg')).not.toBeInTheDocument();
        expect(log.getByText(/Watched it on my own/)).toBeInTheDocument();
    });

    it('keeps the line breaks a member typed into their review', () => {
        renderWall();

        // The review renders as Markdown on Gabe's own log, where a single
        // newline is a break (`remark-breaks`). Read as plain text here, it has
        // to be laid out the same way or the wall reflows his two lines into one
        // run-on sentence.
        const review = within(rows()[0]).getByText(/Watched it on my own/);
        expect(review.textContent).toContain('\n');
        expect(review.closest('.whitespace-pre-line')).not.toBeNull();
    });

    it('links each headline back to where its record lives', () => {
        renderWall();

        expect(within(rows()[1]).getByRole('link', { name: 'The Screening 1999' })).toHaveAttribute(
            'href',
            '/films/tt1000001'
        );
        // A film the club never watched has no page here, so it leaves the site.
        expect(within(rows()[0]).getByRole('link', { name: 'A Cached Film 1985' })).toHaveAttribute(
            'href',
            'https://www.imdb.com/title/tt1000009/'
        );
        expect(
            within(rows()[2]).getByRole('link', { name: 'Even Your Therapist' })
        ).toHaveAttribute('href', '/lists/jacob-therapists');
    });

    it('sends the poster to the record itself, which for a log is the log', () => {
        renderWall();

        // Not to the film: the record this box is a view onto is Gabe's own
        // entry, and it names the row so the log opens with that film in view.
        expect(
            within(rows()[0]).getByRole('link', { name: /A Cached Film poster/ })
        ).toHaveAttribute('href', '/watched/Gabe#log-tt1000009');
        expect(
            within(rows()[1]).getByRole('link', { name: /The Screening poster/ })
        ).toHaveAttribute('href', '/films/tt1000001');
    });

    it("hangs a log off its member's own portrait, linking to them", () => {
        renderWall();

        // The node lives outside the row's article, in the timeline gutter, and
        // holds the only portrait of Gabe on the wall.
        const portrait = screen.getByAltText('Gabe');
        expect(portrait.closest('a')).toHaveAttribute('href', '/profile/Gabe');

        // The sentence beside it links to Gabe too, but does not repeat the face.
        expect(within(rows()[0]).queryByAltText('Gabe')).not.toBeInTheDocument();
        expect(within(rows()[0]).getByRole('link', { name: 'Gabe' })).toHaveAttribute(
            'href',
            '/profile/Gabe'
        );
    });

    it("marks a logged score as the member's own, never as a club figure", () => {
        renderWall();

        expect(within(rows()[0]).getByText("Gabe's")).toBeInTheDocument();
        expect(within(rows()[0]).queryByText('Club avg')).not.toBeInTheDocument();
    });

    it('leaves a club screening its own icon rather than a member portrait', () => {
        renderWall();

        // The evening belongs to the club, not to whoever picked the film —
        // Mark is named as the selector and nowhere given the node.
        expect(screen.queryByAltText('Mark')).not.toBeInTheDocument();
        expect(within(rows()[1]).getByRole('link', { name: 'Mark' })).toBeInTheDocument();
    });

    it('expands prose the row had to cut off, and folds it back', () => {
        stubOverflow();
        renderWall();

        const review = within(rows()[0]).getByRole('button', { name: /Read more/ });
        expect(review).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(review);
        expect(within(rows()[0]).getByRole('button', { name: /Read less/ })).toHaveAttribute(
            'aria-expanded',
            'true'
        );
        expect(within(rows()[0]).getByText(/Watched it on my own/)).toBeInTheDocument();
    });

    it('offers no expander on prose that already fits', () => {
        renderWall();
        expect(screen.queryByRole('button', { name: /Read more/ })).not.toBeInTheDocument();
    });

    it('narrows to one kind of event, and back', () => {
        renderWall();

        fireEvent.click(screen.getByRole('button', { name: /Logs/ }));
        expect(rows()).toHaveLength(1);
        expect(rows()[0]).toHaveTextContent(/Gabe\s*logged/);
        expect(screen.getByRole('heading', { name: '1 Event' })).toBeInTheDocument();

        // Toggling the only chip off means everything again, not nothing.
        fireEvent.click(screen.getByRole('button', { name: /Logs/ }));
        expect(rows()).toHaveLength(3);
    });

    it('combines chips rather than replacing the selection', () => {
        renderWall();

        fireEvent.click(screen.getByRole('button', { name: /Logs/ }));
        fireEvent.click(screen.getByRole('button', { name: /Lists/ }));
        expect(rows()).toHaveLength(2);
    });
});
