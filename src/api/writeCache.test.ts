/**
 * Covers the overlay that hides GitHub's five-minute CDN cache from a member
 * who just saved.
 *
 * The failure this module exists to prevent is silent and looks exactly like a
 * bug in the worker: you save, the page reloads inside the cache window, and
 * the value you replaced is back. So the cases that matter are the ones where
 * an entry must *survive* (the file is still stale) and the ones where it must
 * *go* (the file has caught up) — an overlay that never clears would eventually
 * be a second bug, quietly beating another member's later edit.
 */

import {
    clearWrites,
    pendingWrites,
    recordWrite,
    reconcile,
    splitKey,
    writeKeys,
} from './writeCache';

interface Row {
    score: number;
}

beforeEach(() => {
    sessionStorage.clear();
});

describe('recordWrite / pendingWrites', () => {
    it('returns what was recorded, per namespace', () => {
        recordWrite<Row>('rating', 'tt1 andy', { score: 8 });
        recordWrite<Row>('list', 'andy-top-10', { score: 1 });

        expect(pendingWrites<Row>('rating').get('tt1 andy')).toEqual({ score: 8 });
        // Namespaces are separate files; a key in one must not leak into another.
        expect(pendingWrites<Row>('list').has('tt1 andy')).toBe(false);
    });

    it('keeps the newest value for a key', () => {
        recordWrite<Row>('rating', 'tt1 andy', { score: 8 });
        recordWrite<Row>('rating', 'tt1 andy', { score: 9 });

        expect(pendingWrites<Row>('rating').get('tt1 andy')).toEqual({ score: 9 });
    });

    /** A delete is a value, not an absence: the row must be hidden, not ignored. */
    it('records a null as a tombstone rather than dropping the key', () => {
        recordWrite<Row>('watched', 'tt1 andy', null);

        const pending = pendingWrites<Row>('watched');
        expect(pending.has('tt1 andy')).toBe(true);
        expect(pending.get('tt1 andy')).toBeNull();
    });

    it('is empty for a namespace nothing was written to', () => {
        expect(pendingWrites<Row>('profile').size).toBe(0);
    });

    it('survives a corrupt store rather than throwing', () => {
        sessionStorage.setItem('cc.editor.writes', 'not json');
        expect(pendingWrites<Row>('rating').size).toBe(0);
    });
});

describe('reconcile', () => {
    it('drops an entry the file has caught up with', () => {
        recordWrite<Row>('rating', 'tt1 andy', { score: 8 });

        reconcile('rating', new Map([['tt1 andy', { score: 8 }]]));

        expect(pendingWrites<Row>('rating').size).toBe(0);
    });

    /** The whole point: a stale file must not clear the overlay. */
    it('keeps an entry the file still disagrees with', () => {
        recordWrite<Row>('rating', 'tt1 andy', { score: 8 });

        reconcile('rating', new Map([['tt1 andy', { score: 7 }]]));

        expect(pendingWrites<Row>('rating').get('tt1 andy')).toEqual({ score: 8 });
    });

    it('settles a tombstone once the row is absent from the file', () => {
        recordWrite<Row>('list', 'andy-top-10', null);

        reconcile('list', new Map([['andy-top-10', null]]));

        expect(pendingWrites<Row>('list').size).toBe(0);
    });

    it('keeps a tombstone while the row is still in the file', () => {
        recordWrite<Row>('list', 'andy-top-10', null);

        reconcile('list', new Map([['andy-top-10', { score: 1 }]]));

        expect(pendingWrites<Row>('list').has('andy-top-10')).toBe(true);
    });

    /**
     * The worker's response and the committed file are both JSON, but nothing
     * guarantees they serialize their keys in the same order — so equality has
     * to be structural or every entry would linger to its TTL.
     */
    it('settles regardless of key order', () => {
        recordWrite('profile', 'andy', { name: 'Andy', bio: 'x' });

        reconcile('profile', new Map([['andy', { bio: 'x', name: 'Andy' }]]));

        expect(pendingWrites('profile').size).toBe(0);
    });

    it('leaves keys the file said nothing about alone', () => {
        recordWrite<Row>('rating', 'tt1 andy', { score: 8 });

        reconcile('rating', new Map());

        expect(pendingWrites<Row>('rating').has('tt1 andy')).toBe(true);
    });

    /**
     * The backstop for an entry that will never settle — one another member has
     * since overwritten. Nothing else ever visits the bucket, so this pass is
     * also the only thing stopping it growing for the life of the tab.
     */
    it('drops an entry past the TTL even when the file still disagrees', () => {
        const realNow = Date.now;
        Date.now = () => realNow() - 25 * 60 * 60 * 1000;
        recordWrite<Row>('rating', 'tt1 andy', { score: 8 });
        Date.now = realNow;

        // Already invisible to readers, which is what protects the page…
        expect(pendingWrites<Row>('rating').size).toBe(0);

        // …but still on disk until a reconcile pass evicts it.
        reconcile('rating', new Map([['tt1 andy', { score: 7 }]]));
        expect(sessionStorage.getItem('cc.editor.writes')).not.toContain('tt1 andy');
    });
});

describe('clearWrites', () => {
    it('forgets every namespace', () => {
        recordWrite<Row>('rating', 'tt1 andy', { score: 8 });
        recordWrite<Row>('list', 'andy-top-10', { score: 1 });

        clearWrites();

        expect(pendingWrites<Row>('rating').size).toBe(0);
        expect(pendingWrites<Row>('list').size).toBe(0);
    });
});

describe('writeKeys / splitKey', () => {
    it('round-trips an id and a lowercased owner', () => {
        expect(splitKey(writeKeys.watched('Andy', 'tt1'))).toEqual({
            imdbId: 'tt1',
            owner: 'andy',
        });
    });

    /**
     * The IMDb id leads precisely so a display name with a space in it stays
     * intact — splitting on the first space would otherwise truncate it.
     */
    it('keeps a two-word member name whole', () => {
        expect(splitKey(writeKeys.rating('tt1', 'Mary Ann'))).toEqual({
            imdbId: 'tt1',
            owner: 'mary ann',
        });
    });

    it('normalizes case so a reader and a writer agree', () => {
        expect(writeKeys.rating('tt1', 'ANDY')).toBe(writeKeys.rating('tt1', 'andy'));
        expect(writeKeys.profile('Andy')).toBe('andy');
    });
});
