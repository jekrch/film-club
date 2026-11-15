import { HttpError } from './errors';
import { WATCHED_DIR, watchedPath } from './github';

describe('watchedPath', () => {
    it("puts each member's log in its own file", () => {
        expect(watchedPath('Jacob')).toBe(`${WATCHED_DIR}/jacob.json`);
        expect(watchedPath('Mary Ann')).toBe(`${WATCHED_DIR}/mary-ann.json`);
    });

    // Callers pass a resolved member name, never raw input. This is what makes
    // one that didn't fail closed instead of writing somewhere else.
    it.each(['', '../', '!!!'])('refuses a name with nothing to slug: %p', (name) => {
        expect(() => watchedPath(name)).toThrow(HttpError);
    });

    it('never leaves the watch-log directory', () => {
        expect(watchedPath('../../src/assets/films')).toBe(`${WATCHED_DIR}/src-assets-films.json`);
    });
});
