import responsesData from '../assets/responses.json';

/**
 * What the club says back to a member's log entry: reactions and comments.
 *
 * Written by the editor worker into `responses.json`, one commit per reaction,
 * and those commits skip the Pages build. So unlike `trophies.json` this
 * file is fetched live for every visitor, not only signed-in ones; the bundled
 * copy below is just what renders before that fetch lands. See
 * `ResponsesContext`.
 */

/**
 * The reactions a member may leave, in the order the picker shows them: the
 * tray's quick picks first, then the rest. Mirrors the worker's, which a test
 * in `responses.test.ts` holds it to.
 */
export const REACTION_KEYS = [
    'like',
    'dislike',
    'love',
    'heartbreak',
    'laugh',
    'wow',
    'sad',
    'clap',
    'fire',
    'mind-blown',
    'hmm',
    'yikes',
    'trophy',
    'check',
    'on-my-list',
    'snooze',
    'heart-eyes',
    'star-struck',
    'rofl',
    'smirk',
    'cool',
    'relieved',
    'moved',
    'sob',
    'scream',
    'flushed',
    'peeking',
    'gasp',
    'skeptical',
    'monocle',
    'nerd',
    'eye-roll',
    'meh',
    'melting',
    'dizzy',
    'woozy',
    'nauseated',
    'angry',
    'yawn',
    'dead',
    'clown',
    'ghost',
    'raised-hands',
    'pray',
    'heart-hands',
    'chefs-kiss',
    'ok',
    'salute',
    'shrug',
    'hundred',
    'sparkles',
    'star',
    'gem',
    'bullseye',
    'brain',
    'popcorn',
    'clapper',
    'film',
    'masks',
    'music',
    'rose',
    'wilted',
    'tomato',
    'trash',
] as const;

export type ReactionKey = (typeof REACTION_KEYS)[number];

/** One comment on a log entry, exactly as the worker stores it. */
export interface ResponseComment {
    /** Assigned by the worker on create and immutable after. */
    id: string;
    /** A `club.json` display name, taken from the token. */
    author: string;
    /** Markdown. */
    body: string;
    createdAt: string;
    /** Null until the author edits it. */
    editedAt: string | null;
}

/** Everything said about one log entry. */
export interface ResponseThread {
    /** Reaction key → the members who left it, in the order they did. */
    reactions: Partial<Record<ReactionKey, string[]>>;
    /** Oldest first. */
    comments: ResponseComment[];
}

/** `responses.json`: thread id → thread. */
export interface ResponsesFile {
    threads: Record<string, ResponseThread>;
}

/**
 * The thread id for a member's log entry. It is the wall's own event id for
 * that entry, so a thread follows the entry wherever the site draws it.
 */
export const logThreadId = (member: string, imdbID: string): string => `log-${member}-${imdbID}`;

/**
 * Validates the bundled file at module-load time. Shallow, like the other
 * `assert…Data` checks, and lenient in one direction: a thread missing either
 * half is read as empty rather than refused, so one odd row can't take down
 * every page that shows a log.
 */
function assertResponsesData(data: unknown): ResponsesFile {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new Error('responses.json: expected an object');
    }

    const threads = (data as Partial<ResponsesFile>).threads;
    if (threads === undefined) return { threads: {} };
    if (typeof threads !== 'object' || threads === null || Array.isArray(threads)) {
        throw new Error('responses.json: "threads" must be an object keyed by thread id');
    }

    const normalized: Record<string, ResponseThread> = {};
    Object.entries(threads as Record<string, Partial<ResponseThread>>).forEach(([id, thread]) => {
        normalized[id] = {
            reactions: thread?.reactions ?? {},
            comments: Array.isArray(thread?.comments) ? thread.comments : [],
        };
    });

    return { threads: normalized };
}

/** Every thread as of the last build. */
export const bundledResponses = assertResponsesData(responsesData);

/** True when nobody has reacted or commented, which is how an empty thread is stored: absent. */
export const threadIsEmpty = (thread: ResponseThread | undefined): boolean =>
    !thread || (Object.keys(thread.reactions).length === 0 && thread.comments.length === 0);
