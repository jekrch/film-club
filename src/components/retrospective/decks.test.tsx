import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { clubDeck, memberDeck } from './decks';
import {
    buildClubRetrospective,
    buildMemberRetrospective,
    type RetrospectiveSources,
} from '../../utils/retrospectiveUtils';
import {
    makeClubInfo,
    makeFilm,
    makeMember,
    makeRating,
    makeTrophy,
} from '../../test-utils/factories';
import type { ClubRating } from '../../types/film';

const NOW = new Date('2026-11-14T12:00:00Z');

const four = (a: number, g: number, ja: number, jo: number, blurb?: string): ClubRating[] => [
    makeRating({ user: 'andy', score: a }),
    makeRating({ user: 'gabe', score: g }),
    makeRating({ user: 'jacob', score: ja, blurb: blurb ?? null }),
    makeRating({ user: 'joey', score: jo }),
];

const films = [
    makeFilm({
        imdbID: 'tt0000101',
        title: 'First',
        year: '1960',
        country: 'France',
        actors: 'Someone Famous, An Old Friend',
        backdropImages: ['https://example.com/a1.jpg', 'https://example.com/a2.jpg'],
        movieClubInfo: makeClubInfo({
            selector: 'Jacob',
            watchDate: '1/2/26',
            clubRatings: four(7, 4, 8, 6, 'A long review of the first film.'),
            trophyNotes: 'Joey gets togetherness trophy',
        }),
    }),
    makeFilm({
        imdbID: 'tt0000102',
        title: 'Second',
        year: '1990',
        actors: 'Someone Famous',
        movieClubInfo: makeClubInfo({
            selector: 'Andy',
            watchDate: '5/2/26',
            clubRatings: [...four(5, 5, 5, 5), makeRating({ user: 'greg', score: 9 })],
        }),
    }),
    makeFilm({
        imdbID: 'tt0000103',
        title: 'Earlier',
        actors: 'An Old Friend',
        movieClubInfo: makeClubInfo({ watchDate: '5/2/25', clubRatings: four(5, 5, 5, 5) }),
    }),
];

const sources: RetrospectiveSources = {
    films,
    watched: {
        Jacob: [
            {
                imdbID: 'tt0000900',
                watchDate: '2026-03-01',
                score: 7,
                scoreQualifier: null,
                blurb: 'Logged and loved.',
                updatedAt: '2026-03-01T00:00:00Z',
            },
            {
                imdbID: 'tt0000101',
                watchDate: '2026-03-09',
                score: 8,
                scoreQualifier: null,
                blurb: null,
                updatedAt: '2026-03-09T00:00:00Z',
            },
        ],
        Gabe: [
            {
                imdbID: 'tt0000900',
                watchDate: '2026-04-01',
                score: 6,
                scoreQualifier: null,
                blurb: null,
                updatedAt: '2026-04-01T00:00:00Z',
            },
        ],
    },
    summaries: {
        tt0000900: { imdbID: 'tt0000900', title: 'Logged', year: '2001', poster: null },
    },
    trophies: {
        tt0000102: [makeTrophy({ recipient: 'Jacob', awardedAt: '2026-05-03T12:00:00Z' })],
    },
    responses: {
        threads: { 'log-Jacob-tt0000900': { reactions: { love: ['Gabe'] }, comments: [] } },
    },
    lists: [
        {
            id: 'a-list',
            name: 'A List',
            owner: 'Jacob',
            description: null,
            createdAt: '2026-06-01T12:00:00Z',
            entries: [],
        },
    ],
    members: [
        makeMember({ name: 'Andy', queue: 3 }),
        makeMember({ name: 'Gabe', queue: 4 }),
        makeMember({ name: 'Jacob', queue: 2, title: 'Technologist' }),
        makeMember({ name: 'Joey', queue: 1 }),
        makeMember({ name: 'Greg', title: 'Intern' }),
    ],
};

const renderSlide = (node: React.ReactNode) =>
    render(<MemoryRouter>{node}</MemoryRouter>).container.textContent;

describe('retrospective decks', () => {
    it('renders every slide of the club deck', () => {
        const deck = clubDeck(buildClubRetrospective(2026, sources, NOW), 4);
        expect(deck.map((s) => s.id)).toEqual([
            'title',
            'count',
            'calendar',
            'places',
            'together',
            'favourites',
            'picks',
            'faces',
            'returning',
            'trophies',
            'off-docket',
            'words',
            'closing',
        ]);
        deck.forEach((slide) => expect(renderSlide(slide.node)).toBeTruthy());
        expect(renderSlide(deck[deck.length - 1].node)).toContain('Greg, our intern,');
    });

    it('renders every slide of a member deck', () => {
        const report = buildMemberRetrospective(2026, 'Jacob', sources, NOW)!;
        const deck = memberDeck(report, [], '#7dd3fc');
        expect(deck.map((s) => s.id)).toEqual([
            'title',
            'count',
            'favourites',
            'scores',
            'picks',
            'breakaway',
            'log',
            'taste',
            'words',
            'shelf',
            'closing',
        ]);
        deck.forEach((slide) => expect(renderSlide(slide.node)).toBeTruthy());
    });

    it('gives a featured film’s slide that film’s stills', () => {
        const deck = clubDeck(buildClubRetrospective(2026, sources, NOW), 4);
        expect(deck.find((s) => s.id === 'calendar')!.stills).toContain(
            'https://example.com/a1.jpg'
        );
    });
});
