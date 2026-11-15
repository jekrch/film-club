import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { liveDataFiles, slimSummary } from './liveData';

const full = {
    imdbID: 'tt0000001',
    title: 'A Film',
    year: '1970',
    poster: 'https://example.com/p.jpg',
    director: 'Someone',
    trailerKey: null,
    plot: 'A long synopsis.',
    cast: [{ name: 'An Actor' }],
    crew: [{ name: 'Someone', job: 'Director' }],
    ratings: [{ source: 'Internet Movie Database', value: '7.0/10' }],
    backdropImages: ['a', 'b', 'c', 'd', 'e'],
    tmdbVersion: 4,
};

describe('slimSummary', () => {
    it('keeps what a closed row draws and drops what only the panel shows', () => {
        expect(slimSummary(full)).toEqual({
            imdbID: 'tt0000001',
            title: 'A Film',
            year: '1970',
            poster: 'https://example.com/p.jpg',
            director: 'Someone',
            trailerKey: null,
            backdropImages: ['a', 'b', 'c'],
        });
    });

    // `trailerKey: null` means "looked, there is none", which a row reads
    // differently from absent; the slim copy must not erase the difference.
    it('keeps a null field as null rather than dropping it', () => {
        expect(slimSummary({ title: 'X', trailerKey: null })).toHaveProperty('trailerKey', null);
        expect(slimSummary({ title: 'X' })).not.toHaveProperty('trailerKey');
    });
});

describe('liveDataFiles', () => {
    const assets = () => {
        const dir = mkdtempSync(join(tmpdir(), 'live-data-'));
        writeFileSync(join(dir, 'listFilms.json'), JSON.stringify({ tt0000001: full }));
        writeFileSync(
            join(dir, 'club.json'),
            JSON.stringify([{ name: 'Jacob' }, { name: 'Mary Ann' }])
        );
        mkdirSync(join(dir, 'watched'));
        writeFileSync(
            join(dir, 'watched', 'jacob.json'),
            JSON.stringify([{ imdbID: 'tt0000001', watchDate: '2026-01-01' }])
        );
        return dir;
    };

    it('publishes the slim index, each full summary, and every log', () => {
        const files = liveDataFiles(assets());

        expect(JSON.parse(files.get('films/index.json')!)).toEqual({
            tt0000001: slimSummary(full),
        });
        expect(JSON.parse(files.get('films/tt0000001.json')!)).toEqual(full);
        expect(JSON.parse(files.get('watched/jacob.json')!)).toHaveLength(1);
    });

    // So the site can fetch any member's log without a 404.
    it('writes an empty log for a member who has never logged anything', () => {
        expect(liveDataFiles(assets()).get('watched/mary-ann.json')).toBe('[]');
    });

    it('fails rather than publish a log it could not read', () => {
        const dir = assets();
        writeFileSync(join(dir, 'watched', 'jacob.json'), '{"Jacob": []}');
        expect(() => liveDataFiles(dir)).toThrow('watched/jacob.json');
    });
});
