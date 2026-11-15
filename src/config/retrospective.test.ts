import { SOUNDTRACKS, playOrder, soundtrackChoices } from './retrospective';

describe('playOrder', () => {
    const ids = (tracks: { id: string }[]) => tracks.map((t) => t.id);

    it('starts on the chosen track and wraps round through the rest', () => {
        const order = playOrder(SOUNDTRACKS, SOUNDTRACKS[2].id);
        expect(order[0]).toBe(SOUNDTRACKS[2]);
        expect(ids(order)).toEqual(ids([...SOUNDTRACKS.slice(2), ...SOUNDTRACKS.slice(0, 2)]));
    });

    it('is empty for no music', () => {
        expect(playOrder(SOUNDTRACKS, 'none')).toEqual([]);
    });
});

describe('soundtrackChoices', () => {
    it('puts a valid audition first, and ignores anything else', () => {
        expect(soundtrackChoices('abcdefghijk')[0].youtube).toBe('abcdefghijk');
        expect(soundtrackChoices('not a key')).toBe(SOUNDTRACKS);
        expect(soundtrackChoices(null)).toBe(SOUNDTRACKS);
    });
});
