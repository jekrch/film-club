import type { ReactionKey } from '../../types/responses';

/**
 * The reactions, as ordinary emoji.
 *
 * Drawn from Twemoji rather than the reader's emoji font so every member sees
 * the same faces, and so Windows doesn't get its own flatter set. The SVGs live
 * in `public/reactions`, one per emoji, named the way Twemoji names them (see
 * `twemojiFile`). Twemoji is CC-BY 4.0, credited on the About page.
 */

/** How each reaction draws and what it's called. The label is also its tooltip and accessible name. */
export const REACTIONS: Record<ReactionKey, { emoji: string; label: string }> = {
    like: { emoji: '👍', label: 'Like' },
    dislike: { emoji: '👎', label: 'Dislike' },
    love: { emoji: '❤️', label: 'Love' },
    heartbreak: { emoji: '💔', label: 'Heartbreak' },
    laugh: { emoji: '😂', label: 'Ha!' },
    wow: { emoji: '😮', label: 'Wow' },
    sad: { emoji: '😢', label: 'Sad' },
    clap: { emoji: '👏', label: 'Bravo' },
    fire: { emoji: '🔥', label: 'Fire' },
    'mind-blown': { emoji: '🤯', label: 'Mind-blown' },
    hmm: { emoji: '🤔', label: 'Hmm' },
    yikes: { emoji: '😬', label: 'Yikes' },
    trophy: { emoji: '🏆', label: 'Winner' },
    check: { emoji: '✅', label: 'Seen it' },
    'on-my-list': { emoji: '👀', label: 'Adding it to my list' },
    snooze: { emoji: '😴', label: 'Dozed off' },

    'heart-eyes': { emoji: '😍', label: 'Heart eyes' },
    'star-struck': { emoji: '🤩', label: 'Star-struck' },
    rofl: { emoji: '🤣', label: 'Dying laughing' },
    smirk: { emoji: '😏', label: 'Smirk' },
    cool: { emoji: '😎', label: 'Cool' },
    relieved: { emoji: '😌', label: 'Relieved' },
    moved: { emoji: '🥹', label: 'Moved' },
    sob: { emoji: '😭', label: 'Sobbing' },
    scream: { emoji: '😱', label: 'Screamed' },
    flushed: { emoji: '😳', label: 'Flushed' },
    peeking: { emoji: '🫣', label: "Couldn't look" },
    gasp: { emoji: '🫢', label: 'Gasp' },
    skeptical: { emoji: '🤨', label: 'Skeptical' },
    monocle: { emoji: '🧐', label: 'Curious' },
    nerd: { emoji: '🤓', label: 'Nerd' },
    'eye-roll': { emoji: '🙄', label: 'Eye roll' },
    meh: { emoji: '😐', label: 'Meh' },
    melting: { emoji: '🫠', label: 'Melting' },
    dizzy: { emoji: '😵‍💫', label: 'Dizzy' },
    woozy: { emoji: '🥴', label: 'Woozy' },
    nauseated: { emoji: '🤢', label: 'Nauseated' },
    angry: { emoji: '😡', label: 'Angry' },
    yawn: { emoji: '🥱', label: 'Yawn' },
    dead: { emoji: '💀', label: 'Dead' },
    clown: { emoji: '🤡', label: 'Clown' },
    ghost: { emoji: '👻', label: 'Spooky' },
    'raised-hands': { emoji: '🙌', label: 'Praise' },
    pray: { emoji: '🙏', label: 'Thank you' },
    'heart-hands': { emoji: '🫶', label: 'Heart hands' },
    'chefs-kiss': { emoji: '🤌', label: "Chef's kiss" },
    ok: { emoji: '👌', label: 'OK' },
    salute: { emoji: '🫡', label: 'Salute' },
    shrug: { emoji: '🤷', label: 'Shrug' },
    hundred: { emoji: '💯', label: '100' },
    sparkles: { emoji: '✨', label: 'Sparkles' },
    star: { emoji: '⭐', label: 'Star' },
    gem: { emoji: '💎', label: 'Gem' },
    bullseye: { emoji: '🎯', label: 'Nailed it' },
    brain: { emoji: '🧠', label: 'Big brain' },
    popcorn: { emoji: '🍿', label: 'Popcorn' },
    clapper: { emoji: '🎬', label: 'Action' },
    film: { emoji: '🎞️', label: 'Film' },
    masks: { emoji: '🎭', label: 'Theater' },
    music: { emoji: '🎵', label: 'Great score' },
    rose: { emoji: '🌹', label: 'Rose' },
    wilted: { emoji: '🥀', label: 'Wilted' },
    tomato: { emoji: '🍅', label: 'Rotten' },
    trash: { emoji: '🗑️', label: 'Trash' },
};

/** The ones the tray shows up front. The rest wait behind "More". */
export const QUICK_REACTIONS: readonly ReactionKey[] = [
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
];

/**
 * Twemoji's file name for an emoji: its code points in hex, joined by dashes.
 * A lone variation selector (U+FE0F) is dropped, as Twemoji does, unless the
 * emoji is a zero-width-joined sequence, where it's part of the name.
 */
export const twemojiFile = (emoji: string): string => {
    const points = Array.from(emoji, (char) => char.codePointAt(0)!.toString(16));
    const named = emoji.includes('‍') ? points : points.filter((cp) => cp !== 'fe0f');
    return `${named.join('-')}.svg`;
};
