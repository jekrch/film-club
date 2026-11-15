import { YOUTUBE_KEY_PATTERN } from '../utils/youtube';

/**
 * The music a reader can choose for a retrospective, on its cover.
 *
 * Each is a YouTube video key — the eleven characters after `v=` in a watch
 * link. The first is the default for a reader who hasn't chosen. The chosen one plays on repeat; the rest are queued after it in this
 * order (wrapping round), so the player's own next and previous buttons move
 * between them. Nothing changes song unless the reader skips.
 *
 * To audition a video without editing this file, open a report with
 * `?track=<key>` on the end of its address; it is added to the front of the
 * choices and selected.
 */
export interface Track {
    /** Stable, for remembering the reader's choice. */
    id: string;
    /** What the choice is called on the cover and in the deck's bar. */
    label: string;
    youtube: string;
}

export const SOUNDTRACKS: Track[] = [
    { id: 'jurassic-park', label: 'Jurassic Park', youtube: 'msimASAXoys' },
    { id: 'back-to-the-future', label: 'Back to the Future', youtube: 'e8TZbze72Bc' },
    { id: 'robin-hood', label: 'Robin Hood: Prince of Thieves', youtube: 'maA5bCx3_Jk' },
    { id: 'indiana-jones', label: 'Indiana Jones', youtube: '-bTpp8PQSog' },
    { id: 'magnificent-seven', label: 'The Magnificent Seven', youtube: '8XDB7GMnbUQ' },
    { id: 'the-odyssey', label: 'The Odyssey', youtube: '8DVfI_Muv_A' },
    { id: 'akira', label: 'Akira', youtube: 'Nja0Obgg2gU' },
];

/** The choices for a report, a `?track=` audition first when there is one. */
export const soundtrackChoices = (audition: string | null): Track[] =>
    audition && YOUTUBE_KEY_PATTERN.test(audition)
        ? [{ id: `audition-${audition}`, label: 'Audition', youtube: audition }, ...SOUNDTRACKS]
        : SOUNDTRACKS;

/**
 * The choices in the order the player queues them: the chosen one first, then
 * those after it, then those before. Empty when `id` isn't one of them.
 */
export const playOrder = (choices: Track[], id: string): Track[] => {
    const at = choices.findIndex((c) => c.id === id);
    return at < 0 ? [] : [...choices.slice(at), ...choices.slice(0, at)];
};

/**
 * The reviews the club retrospective quotes on its words slide, by thread id,
 * in the order shown. Any that no longer exist for the year are skipped and
 * the slide is topped up with the fullest reviews instead.
 */
export const FEATURED_CLUB_REVIEWS: string[] = [
    'log-Jacob-tt0066858', // The Boy Friend
    'log-Gabe-tt0046478', // Ugetsu
    'log-Jacob-tt0021884', // Frankenstein
    'log-Gabe-tt0040155', // Berlin Express
];
