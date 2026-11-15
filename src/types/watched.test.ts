import { memberSlug } from './watched';
import { teamMembers } from './team';
import { slugify } from '../../worker/src/validate';
import { memberSlug as generatorSlug } from '../../scripts/liveData';

/**
 * Three places name a member's log file: the worker when it commits one, the
 * build and the data deploy when they publish it, and the site when it fetches
 * it. They can't share code (the worker deploys on its own), so this is what
 * keeps them agreeing. A mismatch would show as a member's log silently empty.
 */
describe('memberSlug', () => {
    const names = [
        ...teamMembers.map((member) => member.name),
        'Mary Ann',
        'Amélie',
        "O'Brien",
        '  Spaced  Out  ',
    ];

    it.each(names)('names %p the same as the worker and the generator', (name) => {
        expect(memberSlug(name)).toBe(slugify(name));
        expect(memberSlug(name)).toBe(generatorSlug(name));
    });

    it('gives every member on the roster a distinct, non-empty file', () => {
        const slugs = teamMembers.map((member) => memberSlug(member.name));
        expect(slugs.every((slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))).toBe(true);
        expect(new Set(slugs).size).toBe(slugs.length);
    });
});
