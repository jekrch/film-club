import { existsSync } from 'fs';
import { join } from 'path';

import { QUICK_REACTIONS, REACTIONS, twemojiFile } from './reactions';
import { REACTION_KEYS } from '../../types/responses';
import { REACTION_KEYS as WORKER_REACTION_KEYS } from '../../../worker/src/validate';

/**
 * The reaction set is written down twice, once per deploy, and drawn from a
 * folder of SVGs. These keep the three in step: a key only one side knows is
 * either refused by the worker or stored with nothing to draw it.
 */
describe('reactions', () => {
    it('match the worker’s allowlist, in the same order', () => {
        expect([...REACTION_KEYS]).toEqual([...WORKER_REACTION_KEYS]);
    });

    it('lists the quick picks first', () => {
        expect(REACTION_KEYS.slice(0, QUICK_REACTIONS.length)).toEqual([...QUICK_REACTIONS]);
    });

    it('has an SVG in public/reactions for every emoji', () => {
        const missing = REACTION_KEYS.map((key) => twemojiFile(REACTIONS[key].emoji)).filter(
            (file) => !existsSync(join(__dirname, '../../../public/reactions', file))
        );
        expect(missing).toEqual([]);
    });

    it('uses one emoji only once', () => {
        const emoji = REACTION_KEYS.map((key) => REACTIONS[key].emoji);
        expect(new Set(emoji).size).toBe(emoji.length);
    });
});

describe('twemojiFile', () => {
    it('names a single code point', () => {
        expect(twemojiFile('👍')).toBe('1f44d.svg');
    });

    it('drops a lone variation selector', () => {
        expect(twemojiFile('❤️')).toBe('2764.svg');
        expect(twemojiFile('🗑️')).toBe('1f5d1.svg');
    });

    it('keeps every code point of a joined sequence', () => {
        expect(twemojiFile('😵‍💫')).toBe('1f635-200d-1f4ab.svg');
    });
});
