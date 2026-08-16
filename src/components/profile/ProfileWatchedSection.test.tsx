import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfileWatchedSection from './ProfileWatchedSection';
import { ClubAuthProvider } from '../../auth/GoogleAuth';

// The bundled watched.json is the author's own local data, so the section is
// exercised against a fixture. Two entries is the case that matters here: fewer
// than the preview holds, which used to leave the card with no visible way
// through to the log page at all.
jest.mock('../../types/watched', () => ({
    watchedLog: {
        Andy: [
            {
                imdbID: 'tt9999999',
                watchDate: '2026-08-09',
                score: 8,
                scoreQualifier: null,
                blurb: null,
                updatedAt: '2026-08-09T21:14:02Z',
            },
            {
                imdbID: 'tt8888888',
                watchDate: '2026-07-14',
                score: null,
                scoreQualifier: null,
                blurb: null,
                updatedAt: '2026-07-14T19:02:10Z',
            },
        ],
    },
}));

jest.mock('../../types/list', () => ({
    filmLists: [],
    listFilmSummaries: {
        tt9999999: {
            imdbID: 'tt9999999',
            title: 'A Cached Film',
            year: '1985',
            poster: 'https://example.com/cached.jpg',
        },
        tt8888888: {
            imdbID: 'tt8888888',
            title: 'Another Cached Film',
            year: '1991',
            poster: 'https://example.com/other.jpg',
        },
    },
}));

// Signed out, since the test env configures no worker — the section as any
// visitor sees it.
const renderFor = (owner: string) =>
    render(
        <ClubAuthProvider>
            <MemoryRouter>
                <ProfileWatchedSection owner={owner} />
            </MemoryRouter>
        </ClubAuthProvider>
    );

describe('ProfileWatchedSection', () => {
    it('renders nothing for a member with an empty log', () => {
        const { container } = renderFor('Nobody');
        expect(container).toBeEmptyDOMElement();
    });

    // The whole point of the footer link: a log shorter than the preview is
    // fully shown, and the card still has to say the log page exists.
    it('offers a link to the full log even when nothing is left over', () => {
        renderFor('Andy');
        expect(screen.getByRole('link', { name: /Open the full log/i })).toHaveAttribute(
            'href',
            '/watched/Andy'
        );
    });

    it('points each preview row at its own row of the log', () => {
        renderFor('Andy');
        const row = within(screen.getByRole('list')).getByRole('link', {
            name: /A Cached Film/i,
        });
        expect(row).toHaveAttribute('href', '/watched/Andy#log-tt9999999');
    });
});
