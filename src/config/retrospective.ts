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
 * The years a member was with the club, by lowercase name, for anyone who
 * joined after it began or has since left. Both ends are inclusive.
 *
 * `joined` absent means they were there from the start. Scores they put in the
 * sheet for screenings before it were films caught up on afterwards, so they
 * don't count them in as a member that year.
 *
 * `left` absent means they're still with the club, for as long as they're on
 * the selection queue. A past member needs it to appear in the years they were
 * there; without one they're treated as never having been a member.
 */
export const CLUB_YEARS: Record<string, { joined?: number; left?: number }> = {
    gabe: { joined: 2023 },
    mark: { left: 2021 },
};

/**
 * The club deck's welcome cards, by lowercase name: one for each newcomer, in
 * the year they arrived, just after the title card. A member's year is the one
 * they joined in {@link CLUB_YEARS}; anyone off the roster, like the intern,
 * needs a `year` here. A member who joins without an entry gets
 * {@link DEFAULT_WELCOME}.
 */
export const WELCOMES: Record<string, { line: string; year?: number }> = {
    gabe: { line: 'The committee gained a new criterioner' },
    greg: { line: 'The committee welcomed our first intern', year: 2026 },
};

export const DEFAULT_WELCOME = 'The committee gained a new criterioner';

/**
 * Members, by lowercase name, whose review never opens the club words slide:
 * someone else's goes first whenever anyone else is quoted.
 */
export const WORDS_NEVER_FIRST: string[] = ['jacob'];

/**
 * The reviews the club retrospective quotes on its words slide, by thread id,
 * in the order shown. Any that no longer exist for the year are skipped and
 * the slide is topped up with the fullest reviews instead.
 */
export const FEATURED_CLUB_REVIEWS: string[] = [
    'log-Gabe-tt0046478', // Ugetsu
    'log-Jacob-tt0066858', // The Boy Friend
    'log-Gabe-tt0040155', // Berlin Express
    'log-Jacob-tt0021884', // Frankenstein
];
