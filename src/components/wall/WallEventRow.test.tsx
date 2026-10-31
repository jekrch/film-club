import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WallEventRow from './WallEventRow';
import { ClubAuthProvider } from '../../auth/GoogleAuth';
import { ResponsesProvider } from '../../contexts/ResponsesContext';
import { makeClubInfo, makeFilm, makeRating } from '../../test-utils/factories';
import type { ClubRating } from '../../types/film';
import { buildWall, mergeTrophyRows } from '../../utils/wallUtils';

const renderLateReview = (rating: Partial<ClubRating>) => {
    const film = makeFilm({
        imdbID: 'tt0000001',
        title: 'Naked',
        year: '1993',
        movieClubInfo: makeClubInfo({
            selector: 'Mark',
            watchDate: '08/12/2020',
            clubRatings: [makeRating({ user: 'gabe', score: null, blurb: null, ...rating })],
        }),
    });
    const events = buildWall({
        films: [film],
        watched: {},
        lists: [],
        trophies: {},
        summaries: {},
    });
    const row = mergeTrophyRows(events.filter((event) => event.kind === 'late-review'))[0];

    render(
        <ClubAuthProvider>
            <ResponsesProvider>
                <MemoryRouter>
                    <WallEventRow row={row} connected={false} />
                </MemoryRouter>
            </ResponsesProvider>
        </ClubAuthProvider>
    );
};

describe('WallEventRow, for a late review', () => {
    it('says who reviewed what, and when the club actually watched it', () => {
        renderLateReview({
            score: 8,
            blurb: 'So many haunting scenes.',
            scoreAddedAt: '2026-10-27T12:22:35Z',
            blurbAddedAt: '2026-10-27T12:22:35Z',
        });

        const row = screen.getByRole('article');
        expect(row).toHaveTextContent(/Gabe\s*reviewed\s*Naked/);
        expect(row).toHaveTextContent('Club film');
        expect(row).toHaveTextContent('So many haunting scenes.');
        expect(row).toHaveTextContent(/The club watched this .*2020/);
        expect(row.querySelector('time')).toHaveAttribute('datetime', '2026-10-27');
        expect(screen.getByTitle(/counted in the club's average: 8\/9/)).toBeInTheDocument();
    });

    it('says scored when there are no words to read', () => {
        renderLateReview({ score: 8, scoreAddedAt: '2026-10-27T12:22:35Z' });

        expect(screen.getByRole('article')).toHaveTextContent(/Gabe\s*scored\s*Naked/);
    });

    it('draws no score badge for a review with no score', () => {
        renderLateReview({ blurb: 'Thanks Agnes!', blurbAddedAt: '2026-09-06T18:27:05Z' });

        expect(screen.getByRole('article')).toHaveTextContent(/Gabe\s*reviewed\s*Naked/);
        expect(screen.queryByTitle(/counted in the club's average/)).not.toBeInTheDocument();
    });
});
