import {
    getPersonInfo,
    getPersonInfoByName,
    getPersonProfileByName,
    isPersonClickable,
    normalizePersonName,
    personLinkClasses,
    tmdbPersonUrl,
} from './personUtils';

/**
 * The name index here is built once at module load from the real `films.json`
 * and `persons.json`, so these tests deliberately avoid asserting on any
 * particular person: that would couple the suite to whatever the club has
 * watched this month. What is worth pinning is the behaviour around the
 * lookup — normalization, the null/undefined paths, and the link rules.
 */

describe('normalizePersonName', () => {
    // This must match the sync script's keying exactly; if the two drift, every
    // lookup silently misses and names quietly stop being clickable.
    it('lowercases and trims', () => {
        expect(normalizePersonName('  Yasujiro OZU  ')).toBe('yasujiro ozu');
    });

    it('treats null and undefined as an empty name', () => {
        expect(normalizePersonName(null)).toBe('');
        expect(normalizePersonName(undefined)).toBe('');
    });
});

describe('getPersonProfileByName', () => {
    it('is undefined for someone not credited on any club film', () => {
        expect(getPersonProfileByName('Nobody At All XYZ')).toBeUndefined();
    });

    it('is undefined for a blank or missing name rather than throwing', () => {
        expect(getPersonProfileByName('')).toBeUndefined();
        expect(getPersonProfileByName(null)).toBeUndefined();
        expect(getPersonProfileByName(undefined)).toBeUndefined();
    });

    // Casing and padding must not change the answer, since names reach this
    // from both curated credit strings and TMDb payloads.
    it('resolves the same regardless of casing or padding', () => {
        const name = 'Yasujiro Ozu';
        expect(getPersonProfileByName(`  ${name.toUpperCase()}  `)).toEqual(
            getPersonProfileByName(name)
        );
    });
});

describe('getPersonInfo', () => {
    it('is undefined for a missing id, without indexing on "null"', () => {
        expect(getPersonInfo(null)).toBeUndefined();
        expect(getPersonInfo(undefined)).toBeUndefined();
    });

    it('is undefined for an id nobody has', () => {
        expect(getPersonInfo(-1)).toBeUndefined();
    });
});

describe('getPersonInfoByName', () => {
    it('is undefined when the name resolves to no profile', () => {
        expect(getPersonInfoByName('Nobody At All XYZ')).toBeUndefined();
    });

    it('is undefined for a missing name', () => {
        expect(getPersonInfoByName(null)).toBeUndefined();
    });
});

describe('tmdbPersonUrl', () => {
    it('builds the public profile URL for an id', () => {
        expect(tmdbPersonUrl(5251)).toBe('https://www.themoviedb.org/person/5251');
    });
});

describe('isPersonClickable', () => {
    // Two rules, either sufficient: appearing on more than one club film, or
    // being resolvable to a TMDb id so the modal has something to show.
    it('is true for anyone credited on more than one film', () => {
        expect(isPersonClickable('Nobody At All XYZ', 2)).toBe(true);
    });

    it('is false for a one-off name that resolves to nothing', () => {
        expect(isPersonClickable('Nobody At All XYZ', 1)).toBe(false);
        expect(isPersonClickable('Nobody At All XYZ', 0)).toBe(false);
    });

    it('is true for a one-off name that does resolve to a profile', () => {
        const known = getPersonProfileByName('Yasujiro Ozu');
        // Guarded so the suite still passes if the club's data changes.
        if (known) expect(isPersonClickable('Yasujiro Ozu', 1)).toBe(true);
    });
});

describe('personLinkClasses', () => {
    // Repeat contributors get amber so they read differently from a name that
    // is merely TMDb-resolvable; the two must not collapse into one style.
    it('distinguishes a repeat contributor from a one-off', () => {
        const repeat = personLinkClasses(true);
        const oneOff = personLinkClasses(false);

        expect(repeat).toContain('amber');
        expect(oneOff).toContain('blue');
        expect(repeat).not.toBe(oneOff);
    });
});
