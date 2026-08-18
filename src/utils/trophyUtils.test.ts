import {
    compareTrophies,
    getMemberTrophies,
    groupTrophies,
    parseTrophyNotes,
    resolveFilmTrophies,
} from './trophyUtils';
import { makeClubInfo, makeFilm, makeTrophy } from '../test-utils/factories';

/**
 * The parsing cases below are real `trophyNotes` cells from `films.json`, not
 * invented ones. The sheet's prose is the only input this module doesn't control
 * and can never be made to control, so the tests are pinned to what the club
 * actually typed.
 */

describe('parseTrophyNotes', () => {
    it('pulls the recipient out of the sentence and leaves the award', () => {
        expect(parseTrophyNotes('Andy gets togetherness trophy')).toEqual([
            {
                key: 'sheet-0',
                recipient: 'Andy',
                award: 'Togetherness trophy',
                note: null,
                source: 'sheet',
            },
        ]);
    });

    it('splits a cell on commas, one award per part', () => {
        const parsed = parseTrophyNotes(
            'Gabe gets togetherness trophy, Joey gets in sickness and in health trophy'
        );

        expect(parsed.map((t) => [t.recipient, t.award])).toEqual([
            ['Gabe', 'Togetherness trophy'],
            ['Joey', 'In sickness and in health trophy'],
        ]);
    });

    it('takes the first member named as the recipient', () => {
        // Andy is the subject; the second name belongs to the award's reason.
        const [award] = parseTrophyNotes(
            'Andy gets a Special Connection Award for his Parajanov-Vartanov award'
        );

        expect(award.recipient).toBe('Andy');
        expect(award.award).toBe('Special Connection Award for his Parajanov-Vartanov award');
    });

    it('strips the connector however it was phrased', () => {
        expect(parseTrophyNotes('Joey gets togetherness award')[0].award).toBe(
            'Togetherness award'
        );
        expect(parseTrophyNotes('Gabe wins the helmet')[0].award).toBe('Helmet');
        expect(parseTrophyNotes('Togetherness Trophy: Jacob')[0].award).toBe('Togetherness Trophy');
    });

    it('keeps an award nobody in the club is named on', () => {
        const parsed = parseTrophyNotes('Best boy trophy stays vacant');

        expect(parsed).toHaveLength(1);
        expect(parsed[0].recipient).toBeNull();
        expect(parsed[0].award).toBe('Best boy trophy stays vacant');
    });

    it('falls back to the raw text when removing the name leaves nothing', () => {
        expect(parseTrophyNotes('Jacob')[0].award).toBe('Jacob');
    });

    it('ignores empty parts from trailing or doubled commas', () => {
        expect(parseTrophyNotes('Gabe gets helmet, ,')).toHaveLength(1);
    });
});

describe('resolveFilmTrophies', () => {
    const film = makeFilm({
        movieClubInfo: makeClubInfo({ trophyNotes: 'Andy gets togetherness trophy' }),
    });

    it('reads the sheet and the site into one shelf, sheet first', () => {
        const resolved = resolveFilmTrophies(film, [
            makeTrophy({ recipient: 'Joey', award: 'Bad Boy', note: 'for the group chat' }),
        ]);

        expect(resolved.map((t) => [t.source, t.recipient, t.award])).toEqual([
            ['sheet', 'Andy', 'Togetherness trophy'],
            ['club', 'Joey', 'Bad Boy'],
        ]);
        expect(resolved[1].note).toBe('for the group chat');
    });

    it('marks only site awards as editable, by carrying their id', () => {
        const [fromSheet, fromSite] = resolveFilmTrophies(film, [makeTrophy()]);

        expect(fromSheet.id).toBeUndefined();
        expect(fromSite.id).toBe('andy-togetherness-trophy');
        expect(fromSite.awardedBy).toBe('Jacob');
    });

    it('is empty for a film with neither', () => {
        expect(resolveFilmTrophies(makeFilm(), [])).toEqual([]);
    });
});

describe('getMemberTrophies', () => {
    const suspiria = makeFilm({
        title: 'Suspiria',
        movieClubInfo: makeClubInfo({
            trophyNotes: 'Andy gets togetherness trophy, Joey gets bad boy',
        }),
    });
    const stalker = makeFilm({
        title: 'Stalker',
        movieClubInfo: makeClubInfo({ trophyNotes: 'Andy gets togetherness trophy' }),
    });

    it('collects a member’s awards across films, with the film attached', () => {
        const trophies = getMemberTrophies([suspiria, stalker], 'Andy', {});

        expect(trophies).toHaveLength(2);
        expect(trophies.map((t) => t.film.title)).toEqual(['Suspiria', 'Stalker']);
    });

    it('matches the recipient case-insensitively', () => {
        expect(getMemberTrophies([suspiria], 'andy', {})).toHaveLength(1);
    });

    it('leaves other members alone', () => {
        expect(getMemberTrophies([suspiria, stalker], 'Gabe', {})).toEqual([]);
    });

    it('keys awards by film, so the same sheet row on two films stays distinct', () => {
        const keys = getMemberTrophies([suspiria, stalker], 'Andy', {}).map((t) => t.key);

        expect(new Set(keys).size).toBe(2);
    });

    it('reads site awards from the live file when one is given', () => {
        const live = {
            [stalker.imdbID]: [makeTrophy({ recipient: 'Gabe', award: 'Helmet' })],
        };

        expect(getMemberTrophies([suspiria, stalker], 'Gabe', live)).toMatchObject([
            { award: 'Helmet', film: { title: 'Stalker' } },
        ]);
    });
});

describe('groupTrophies', () => {
    const film = makeFilm();

    const shelf = [
        {
            key: 'a',
            recipient: 'Andy',
            award: 'Togetherness Trophy',
            note: null,
            source: 'club' as const,
            film,
        },
        {
            key: 'b',
            recipient: 'Andy',
            award: 'togetherness trophy',
            note: null,
            source: 'sheet' as const,
            film,
        },
        {
            key: 'c',
            recipient: 'Andy',
            award: 'Helmet',
            note: null,
            source: 'sheet' as const,
            film,
        },
    ];

    it('groups awards of the same name however they were capitalized', () => {
        const groups = groupTrophies(shelf);

        expect(groups).toHaveLength(2);
        expect(groups[0]).toMatchObject({ award: 'Togetherness Trophy' });
        expect(groups[0].trophies).toHaveLength(2);
    });

    it('puts the most-won award first', () => {
        expect(groupTrophies(shelf).map((g) => g.award)).toEqual(['Togetherness Trophy', 'Helmet']);
    });
});

describe('compareTrophies', () => {
    it('orders oldest first, breaking ties on id', () => {
        const early = makeTrophy({ id: 'b', awardedAt: '2026-01-01T00:00:00Z' });
        const late = makeTrophy({ id: 'a', awardedAt: '2026-06-01T00:00:00Z' });
        const tie = makeTrophy({ id: 'c', awardedAt: '2026-01-01T00:00:00Z' });

        expect([late, tie, early].sort(compareTrophies).map((t) => t.id)).toEqual(['b', 'c', 'a']);
    });
});
