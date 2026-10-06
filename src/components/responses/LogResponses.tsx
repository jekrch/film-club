import React, { useEffect, useId, useState } from 'react';
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

import Button from '../common/Button';
import CircularImage from '../common/CircularImage';
import Collapse from '../common/Collapse';
import Markdown from '../common/Markdown';
import QuoteMarkIcon from '../common/QuoteMarkIcon';
import { AddReactionGlyph, ReactionEmoji } from './reactionGlyphs';
import { QUICK_REACTIONS, REACTIONS } from './reactions';
import { useClubAuth } from '../../auth/GoogleAuth';
import { useResponses } from '../../contexts/ResponsesContext';
import { getTeamMemberByName } from '../../types/team';
import {
    REACTION_KEYS,
    type ReactionKey,
    type ResponseComment,
    type ResponseThread,
} from '../../types/responses';

/** Mirrors the worker's `LIMITS.comment`, which is the copy that is trusted. */
export const COMMENT_LIMIT = 1000;

/**
 * `min-h` stops the resize handle short of one line of text. Borders are
 * box-sized, so the floor is a line (`1lh`, this field's own line height) plus
 * the `py-2` padding and the two 1px borders. Any shorter and the text is
 * clipped mid-glyph.
 */
const FIELD_CLASS =
    'w-full rounded-md border border-slate-600/60 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 ' +
    'placeholder:text-slate-500 focus:border-emerald-400/50 focus:outline-none resize-y leading-relaxed ' +
    'min-h-[calc(1lh+1rem+2px)]';

/**
 * A pill, at rest and lit. There's one per member who reacted, and lit means
 * it's *yours*. That's the only state worth color, and it takes the warm amber
 * of the "Club film" badge: a spot on the stage rather than a notification dot.
 *
 * Small on purpose. The bar shares a line with the row's Details toggle and
 * should weigh about what that does: a caption under the entry, not a toolbar.
 */
const PILL_BASE =
    'inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] leading-none tabular-nums ring-1 ring-inset transition-colors duration-150';
const PILL_REST = 'bg-white/[0.03] text-slate-400 ring-slate-600/50';
const PILL_LIT = 'bg-amber-400/[0.08] text-amber-200 ring-amber-400/35';

/**
 * The labelled Details toggle's look (see `EntryDetailsToggle`): bare text that
 * warms with the row. Comment sits beside it in the same voice, so the two
 * read as one quiet cluster at the row's foot rather than two more buttons.
 */
const TEXT_TOGGLE =
    'inline-flex h-6 flex-shrink-0 items-center gap-1 rounded-md px-1.5 text-xs transition-colors';

interface LogResponsesProps {
    /** `logThreadId(owner, imdbID)`, `clubThreadId(imdbID)`, or `listThreadId(id)`. */
    threadId: string;
    /**
     * Whose log entry or list this is. They may remove any comment on it. Null
     * for a screening, which is the club's rather than any one member's.
     */
    owner: string | null;
    /** What the thread is about, for accessible names ("React to Ikiru"). */
    title: string;
    /**
     * Drawn at the right end of the bar. The row's Details toggle, which would
     * otherwise need a line to itself; sharing this one is most of what keeps
     * the foot of a row from growing.
     */
    trailing?: React.ReactNode;
    /** On the bar's own line. */
    className?: string;
}

/** `Oct 5`, or `Oct 5, 2025` once it isn't this year. */
const formatCommentDate = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const sameYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' }),
    });
};

const hasReacted = (thread: ResponseThread | undefined, key: ReactionKey, member: string | null) =>
    member !== null &&
    (thread?.reactions[key] ?? []).some((name) => name.toLowerCase() === member.toLowerCase());

/**
 * The foot of a log entry, a screening, or a list: what the club says back to
 * it, and the row's own Details toggle, on one line. The reactions tray and the comments open out
 * under that line with the same gesture the details panel uses.
 *
 * Anyone can read the responses. Only a signed-in member can add to them.
 * Signed out, an entry nobody has responded to draws only `trailing`, so a log
 * with no conversation on it looks exactly as it did before this existed.
 */
const LogResponses: React.FC<LogResponsesProps> = ({
    threadId,
    owner,
    title,
    trailing,
    className = '',
}) => {
    const { threads, toggleReaction, saveComment, removeComment } = useResponses();
    const { status, configured, member, admin } = useClubAuth();
    const thread = threads[threadId];
    const canRespond = configured && status === 'signed-in' && member !== null;

    const [trayOpen, setTrayOpen] = useState(false);
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const trayId = useId();
    const commentsId = useId();

    const reactors = reactorsOf(thread);
    const comments = thread?.comments ?? [];
    const responds = canRespond || reactors.length > 0 || comments.length > 0;

    // A tray left open by someone who then signed out would offer taps that
    // can only fail.
    useEffect(() => {
        if (!canRespond) setTrayOpen(false);
    }, [canRespond]);

    if (!responds && !trailing) return null;

    const react = (key: ReactionKey) => {
        setError(null);
        toggleReaction(threadId, key).catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "That reaction didn't save.");
        });
    };

    const pick = (key: ReactionKey) => {
        setTrayOpen(false);
        react(key);
    };

    return (
        <div className={`relative ${className}`}>
            <div className="flex flex-wrap items-center gap-1">
                {reactors.map(({ name, keys }) => {
                    const mine = canRespond && name.toLowerCase() === member?.toLowerCase();
                    return (
                        <span
                            key={name}
                            role="group"
                            aria-label={`${name}: ${labelsOf(keys)}`}
                            title={name}
                            className={`${PILL_BASE} ${mine ? PILL_LIT : PILL_REST}`}
                        >
                            <ReactorFace name={name} />
                            <span className="flex items-center gap-0.5">
                                {keys.map((key) =>
                                    mine ? (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => react(key)}
                                            aria-label={`Take back your ${REACTIONS[key].label}`}
                                            className="rounded-sm transition-opacity hover:opacity-60"
                                        >
                                            <ReactionEmoji reaction={key} className="h-3.5 w-3.5" />
                                        </button>
                                    ) : (
                                        <ReactionEmoji
                                            key={key}
                                            reaction={key}
                                            className="h-3.5 w-3.5"
                                        />
                                    )
                                )}
                            </span>
                        </span>
                    );
                })}

                {/* Icon-only once there are reactions to sit beside: by then
                    the pills have already said what this row of things is. */}
                {canRespond && (
                    <button
                        type="button"
                        onClick={() => setTrayOpen((open) => !open)}
                        aria-expanded={trayOpen}
                        aria-controls={trayId}
                        aria-label={`React to ${title}`}
                        title="React"
                        className={`${TEXT_TOGGLE} ${
                            trayOpen
                                ? 'text-slate-200'
                                : 'text-slate-500 group-hover:text-slate-400 hover:text-slate-200!'
                        }`}
                    >
                        <AddReactionGlyph className="h-4 w-4" />
                        {reactors.length === 0 && <span aria-hidden="true">React</span>}
                    </button>
                )}

                <span className="ml-auto flex items-center gap-0.5">
                    {(canRespond || comments.length > 0) && (
                        <button
                            type="button"
                            onClick={() => setCommentsOpen((open) => !open)}
                            aria-expanded={commentsOpen}
                            aria-controls={commentsId}
                            className={`${TEXT_TOGGLE} ${
                                commentsOpen
                                    ? 'text-emerald-300'
                                    : 'text-slate-500 group-hover:text-slate-400 hover:text-slate-200!'
                            }`}
                        >
                            <QuoteMarkIcon className="h-2.5 w-2.5 opacity-70" />
                            {comments.length === 0
                                ? 'Comment'
                                : `${comments.length} comment${comments.length === 1 ? '' : 's'}`}
                        </button>
                    )}
                    {trailing}
                </span>
            </div>

            {error && <p className="mt-1.5 text-xs text-rose-300">{error}</p>}

            <Collapse open={trayOpen} id={trayId} innerClassName="pt-1.5">
                <ReactionTray
                    thread={thread}
                    member={member}
                    onPick={pick}
                    onClose={() => setTrayOpen(false)}
                />
            </Collapse>

            <Collapse open={commentsOpen} id={commentsId} innerClassName="space-y-3 pt-2.5">
                {reactors.length > 0 && <ReactionRoll reactors={reactors} />}
                {comments.length > 0 && (
                    <ol className="space-y-3">
                        {comments.map((comment) => (
                            <CommentRow
                                key={comment.id}
                                comment={comment}
                                canEdit={
                                    canRespond &&
                                    comment.author.toLowerCase() === member?.toLowerCase()
                                }
                                canRemove={
                                    canRespond &&
                                    (admin ||
                                        comment.author.toLowerCase() === member?.toLowerCase() ||
                                        (owner !== null &&
                                            owner.toLowerCase() === member?.toLowerCase()))
                                }
                                onSave={(body) =>
                                    saveComment(threadId, body, comment.id).then(() => {})
                                }
                                onRemove={() => removeComment(threadId, comment.id)}
                            />
                        ))}
                    </ol>
                )}

                {canRespond ? (
                    <CommentComposer
                        member={member}
                        onPost={(body) => saveComment(threadId, body).then(() => {})}
                    />
                ) : (
                    comments.length === 0 && (
                        <p className="text-xs italic text-slate-500">No comments yet.</p>
                    )
                )}
            </Collapse>
        </div>
    );
};

/** One member and every reaction they left on an entry. */
interface Reactor {
    name: string;
    keys: ReactionKey[];
}

/**
 * The thread's reactions turned around: by who left them rather than by emoji.
 * `responses.json` doesn't record when, so people come in the order they first
 * turn up walking `REACTION_KEYS`, and each one's emoji in that order too.
 */
const reactorsOf = (thread: ResponseThread | undefined): Reactor[] => {
    const byName = new Map<string, Reactor>();
    for (const key of REACTION_KEYS) {
        for (const name of thread?.reactions[key] ?? []) {
            const id = name.toLowerCase();
            const reactor = byName.get(id) ?? { name, keys: [] };
            reactor.keys.push(key);
            byName.set(id, reactor);
        }
    }
    return [...byName.values()];
};

/** `Like, Fire`: what a screen reader hears for a run of emoji. */
const labelsOf = (keys: ReactionKey[]): string =>
    keys.map((key) => REACTIONS[key].label).join(', ');

/**
 * A member's face, small enough to sit in a pill beside the emoji. Not
 * `CircularImage`: at this size its border would be most of the picture, and
 * it zooms on the row's hover. Falls back to an initial when there's no photo.
 * Decorative: whatever it sits in names the member.
 */
const ReactorFace: React.FC<{ name: string; className?: string }> = ({
    name,
    className = 'h-4 w-4 text-[9px]',
}) => {
    const [failed, setFailed] = useState(false);
    const src = getTeamMemberByName(name)?.image ?? `/images/${name.toLowerCase()}.jpg`;

    return (
        <span
            aria-hidden="true"
            className={`inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700 font-semibold uppercase text-slate-200 ${className}`}
        >
            {failed ? (
                name.charAt(0)
            ) : (
                <img
                    src={src}
                    alt=""
                    loading="lazy"
                    onError={() => setFailed(true)}
                    className="h-full w-full object-cover"
                />
            )}
        </span>
    );
};

/**
 * Who reacted with what, spelled out with names, at the head of the comments.
 * The bar above says the same with faces alone; this is where it's read.
 */
const ReactionRoll: React.FC<{ reactors: Reactor[] }> = ({ reactors }) => (
    <ul
        aria-label="Reactions"
        className="flex flex-wrap gap-x-4 gap-y-1.5 border-b border-slate-700/50 pb-2.5"
    >
        {reactors.map(({ name, keys }) => (
            <li key={name} className="flex items-center gap-1.5 text-xs">
                <ReactorFace name={name} className="h-5 w-5 text-[10px]" />
                <Link
                    to={`/profile/${encodeURIComponent(name)}`}
                    className="font-medium text-slate-300 hover:text-slate-100"
                >
                    {name}
                </Link>
                <span className="flex items-center gap-0.5">
                    {keys.map((key) => (
                        <ReactionEmoji key={key} reaction={key} className="h-4 w-4" />
                    ))}
                    <span className="sr-only">{labelsOf(keys)}</span>
                </span>
            </li>
        ))}
    </ul>
);

/** Everything the tray keeps behind "More", in `REACTION_KEYS` order. */
const MORE_REACTIONS = REACTION_KEYS.filter((key) => !QUICK_REACTIONS.includes(key));

/**
 * The quick picks, opened inline under the row rather than floated over it, so
 * there is nothing to position on a phone and nothing to dismiss off-screen.
 * The last cell, "More", folds the rest open beneath them with the same
 * gesture. No caption and no tooltips: an emoji says what it means. The labels
 * survive only as accessible names.
 */
const ReactionTray: React.FC<{
    thread: ResponseThread | undefined;
    member: string | null;
    onPick: (key: ReactionKey) => void;
    onClose: () => void;
}> = ({ thread, member, onPick, onClose }) => {
    const [showMore, setShowMore] = useState(false);
    const moreId = useId();

    const choice = (key: ReactionKey) => {
        const { label } = REACTIONS[key];
        const mine = hasReacted(thread, key, member);
        return (
            <button
                key={key}
                type="button"
                onClick={() => onPick(key)}
                aria-pressed={mine}
                aria-label={label}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150 ${
                    mine
                        ? 'bg-amber-400/[0.12] ring-1 ring-inset ring-amber-400/35'
                        : 'hover:bg-white/[0.08]'
                }`}
            >
                <ReactionEmoji reaction={key} className="h-[18px] w-[18px]" />
            </button>
        );
    };

    return (
        <div
            role="group"
            aria-label="Reactions"
            onKeyDown={(e) => {
                if (e.key === 'Escape') onClose();
            }}
            className="inline-flex max-w-full flex-wrap items-center rounded-xl bg-slate-900/70 p-1 ring-1 ring-slate-600/50 backdrop-blur-sm"
        >
            <div className="flex flex-wrap">
                {QUICK_REACTIONS.map(choice)}
                <button
                    type="button"
                    onClick={() => setShowMore((open) => !open)}
                    aria-expanded={showMore}
                    aria-controls={moreId}
                    aria-label={showMore ? 'Fewer reactions' : 'More reactions'}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150 ${
                        showMore
                            ? 'bg-white/[0.08] text-slate-100'
                            : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
                    }`}
                >
                    <EllipsisHorizontalIcon className="h-5 w-5" />
                </button>
            </div>
            {/* `basis-full` puts the rest on a line of their own, under the
                quick picks. */}
            <Collapse
                open={showMore}
                id={moreId}
                className="basis-full"
                innerClassName="mt-1 flex flex-wrap border-t border-slate-700/60 pt-1"
            >
                {MORE_REACTIONS.map(choice)}
            </Collapse>
        </div>
    );
};

const CommentRow: React.FC<{
    comment: ResponseComment;
    canEdit: boolean;
    canRemove: boolean;
    onSave: (body: string) => Promise<void>;
    onRemove: () => Promise<void>;
}> = ({ comment, canEdit, canRemove, onSave, onRemove }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(comment.body);
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const run = async (action: () => Promise<void>, failure: string) => {
        setBusy(true);
        setError(null);
        try {
            await action();
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : failure);
            return false;
        } finally {
            setBusy(false);
        }
    };

    const save = async () => {
        const body = draft.trim();
        if (!body) return;
        if (body === comment.body) {
            setEditing(false);
            return;
        }
        if (await run(() => onSave(body), "That edit didn't save.")) setEditing(false);
    };

    return (
        <li className="flex gap-2.5">
            <Link
                to={`/profile/${encodeURIComponent(comment.author)}`}
                title={`View ${comment.author}'s profile`}
                className="mt-0.5 flex-shrink-0 rounded-full ring-1 ring-slate-500/40"
            >
                <CircularImage alt={comment.author} size="w-6 h-6" />
            </Link>

            <div className="min-w-0 flex-1 border-l-2 border-emerald-400/20 pl-3">
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <Link
                        to={`/profile/${encodeURIComponent(comment.author)}`}
                        className="font-medium text-slate-200 hover:text-slate-100"
                    >
                        {comment.author}
                    </Link>
                    <time dateTime={comment.createdAt} className="tabular-nums text-slate-500">
                        {formatCommentDate(comment.createdAt)}
                        {comment.editedAt && <span className="italic"> · edited</span>}
                    </time>

                    {!editing && (canEdit || canRemove) && (
                        <span className="ml-auto flex items-center gap-2">
                            {canEdit && (
                                <Button
                                    type="button"
                                    variant="link"
                                    size="xs"
                                    onClick={() => {
                                        setDraft(comment.body);
                                        setConfirming(false);
                                        setEditing(true);
                                    }}
                                    disabled={busy}
                                    className="text-slate-500 hover:text-slate-200"
                                >
                                    Edit
                                </Button>
                            )}
                            {canRemove &&
                                (confirming ? (
                                    <>
                                        <Button
                                            type="button"
                                            variant="link"
                                            size="xs"
                                            accent="rose"
                                            onClick={() =>
                                                void run(onRemove, "That comment didn't delete.")
                                            }
                                            disabled={busy}
                                        >
                                            {busy ? 'Removing…' : 'Remove it'}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="link"
                                            size="xs"
                                            onClick={() => setConfirming(false)}
                                            disabled={busy}
                                            className="text-slate-500 hover:text-slate-200"
                                        >
                                            Keep
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="link"
                                        size="xs"
                                        onClick={() => setConfirming(true)}
                                        disabled={busy}
                                        className="text-slate-500 hover:text-rose-300"
                                    >
                                        Remove
                                    </Button>
                                ))}
                        </span>
                    )}
                </div>

                {editing ? (
                    <div className="mt-1.5 space-y-2">
                        <textarea
                            rows={3}
                            maxLength={COMMENT_LIMIT}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            disabled={busy}
                            aria-label="Edit your comment"
                            className={FIELD_CLASS}
                        />
                        <div className="flex items-center gap-3">
                            <Button
                                type="button"
                                variant="solid"
                                size="xs"
                                accent="emerald"
                                onClick={() => void save()}
                                disabled={busy || !draft.trim()}
                            >
                                {busy ? 'Saving…' : 'Save'}
                            </Button>
                            <Button
                                type="button"
                                variant="link"
                                size="xs"
                                onClick={() => setEditing(false)}
                                disabled={busy}
                                className="text-slate-400 hover:text-slate-200"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="prose prose-sm prose-invert mt-0.5 max-w-none text-sm leading-relaxed text-slate-300">
                        <Markdown>{comment.body}</Markdown>
                    </div>
                )}

                {error && <p className="mt-1 text-xs text-rose-300">{error}</p>}
            </div>
        </li>
    );
};

const CommentComposer: React.FC<{
    member: string | null;
    onPost: (body: string) => Promise<void>;
}> = ({ member, onPost }) => {
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const post = async () => {
        const body = draft.trim();
        if (!body) return;
        setBusy(true);
        setError(null);
        try {
            await onPost(body);
            setDraft('');
        } catch (err) {
            setError(err instanceof Error ? err.message : "That comment didn't post.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex gap-2.5">
            {member && (
                <span className="mt-1 flex-shrink-0 rounded-full ring-1 ring-slate-500/40">
                    <CircularImage alt={member} size="w-6 h-6" />
                </span>
            )}
            <div className="min-w-0 flex-1 space-y-2">
                <textarea
                    rows={2}
                    maxLength={COMMENT_LIMIT}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void post();
                    }}
                    disabled={busy}
                    placeholder="Say something about it…"
                    aria-label="Write a comment"
                    className={FIELD_CLASS}
                />
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="solid"
                        size="xs"
                        accent="emerald"
                        onClick={() => void post()}
                        disabled={busy || !draft.trim()}
                    >
                        {busy ? 'Posting…' : 'Post'}
                    </Button>
                    {error && <p className="text-xs text-rose-300">{error}</p>}
                </div>
            </div>
        </div>
    );
};

export default LogResponses;
