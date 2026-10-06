import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import {
    deleteComment,
    deleteReaction,
    NEW_COMMENT_ID,
    putComment,
    putReaction,
    type ThreadWriteResult,
} from '../api/clubApi';
import { fetchResponses, overlayResponses } from '../api/repoData';
import { forgetWrite, recordWrite, writeKeys } from '../api/writeCache';
import { useClubAuth } from '../auth/GoogleAuth';
import {
    bundledResponses,
    type ReactionKey,
    type ResponseComment,
    type ResponseThread,
} from '../types/responses';

/**
 * Reactions and comments on members' log entries, as fresh as this tab can see.
 *
 * Fetched live for every visitor, signed in or not, because these commits skip
 * the Pages build and the bundle is only a first paint. The fetch is lazy: it
 * happens the first time a component that shows a thread mounts, so a visit
 * that never opens a log or the wall never makes it.
 *
 * Reactions are optimistic. A tap shows immediately and is undone if the save
 * fails. Comments wait for the worker, since a comment that appeared and then
 * vanished would lose someone's words.
 *
 * Writes go out one at a time. Each is a read-modify-commit of the same file,
 * and a burst of taps fired in parallel would race each other's sha past
 * `commitJson`'s single retry.
 */
interface ResponsesValue {
    /** Thread id → thread. A thread nobody has responded to is absent. */
    threads: Record<string, ResponseThread>;
    /** Starts the live read if nothing has yet. Called by every consumer on mount. */
    ensureLive: () => void;
    /** Adds the signed-in member's reaction, or takes it back if it's already there. */
    toggleReaction: (threadId: string, key: ReactionKey) => Promise<void>;
    /** Posts a comment (`id` omitted) or edits one. Resolves with what was stored. */
    saveComment: (threadId: string, body: string, id?: string) => Promise<ResponseComment>;
    removeComment: (threadId: string, id: string) => Promise<void>;
}

const ResponsesContext = createContext<ResponsesValue | undefined>(undefined);

export const ResponsesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { member, withToken } = useClubAuth();

    /**
     * The last threads the repo or the worker vouched for. What renders is this
     * with the write cache laid over it, so an optimistic reaction lives in
     * exactly one place: the cache.
     */
    const [base, setBase] = useState<Record<string, ResponseThread>>(bundledResponses.threads);
    /** Bumped whenever the write cache changes, since React can't see sessionStorage. */
    const [cacheVersion, setCacheVersion] = useState(0);
    const bumpCache = useCallback(() => setCacheVersion((v) => v + 1), []);

    const fetchStarted = useRef(false);
    const queue = useRef<Promise<unknown>>(Promise.resolve());

    const ensureLive = useCallback(() => {
        if (fetchStarted.current) return;
        fetchStarted.current = true;
        fetchResponses()
            .then((live) => {
                setBase(live);
                bumpCache();
            })
            .catch(() => {
                // The bundled threads are already on screen. A failed refresh
                // means they may be a few reactions behind, not that anything
                // is broken, and the next page that shows a thread tries again.
                fetchStarted.current = false;
            });
    }, [bumpCache]);

    /** Runs writes one after another, whatever the caller does with the result. */
    const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
        const run = queue.current.then(task, task);
        queue.current = run.catch(() => undefined);
        return run;
    }, []);

    /** Takes the server's copy of a thread, which is newer than anything fetched. */
    const acceptThread = useCallback(
        ({ threadId, thread }: ThreadWriteResult) => {
            setBase((current) => {
                const next = { ...current };
                if (thread) next[threadId] = thread;
                else delete next[threadId];
                return next;
            });
            bumpCache();
        },
        [bumpCache]
    );

    const threads = useMemo(
        () => overlayResponses(base),
        // `cacheVersion` is the dependency the overlay actually reads through.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [base, cacheVersion]
    );

    // A ref so `toggleReaction` reads the thread as rendered without having to
    // be rebuilt on every reaction anywhere on the page.
    const threadsRef = useRef(threads);
    threadsRef.current = threads;

    const toggleReaction = useCallback(
        async (threadId: string, key: ReactionKey) => {
            if (!member) throw new Error('Sign in to react.');

            const who = threadsRef.current[threadId]?.reactions[key] ?? [];
            const adding = !who.some((name) => name.toLowerCase() === member.toLowerCase());
            const cacheKey = writeKeys.reaction(threadId, key, member);

            recordWrite('reaction', cacheKey, adding ? true : null);
            bumpCache();

            try {
                const result = await enqueue(() =>
                    withToken((token) =>
                        adding
                            ? putReaction(token, threadId, key)
                            : deleteReaction(token, threadId, key)
                    )
                );
                acceptThread(result);
            } catch (error) {
                forgetWrite('reaction', cacheKey);
                bumpCache();
                throw error;
            }
        },
        [member, enqueue, withToken, acceptThread, bumpCache]
    );

    const saveComment = useCallback(
        async (threadId: string, body: string, id?: string) => {
            const result = await enqueue(() =>
                withToken((token) => putComment(token, threadId, id ?? NEW_COMMENT_ID, { body }))
            );
            recordWrite('comment', writeKeys.comment(threadId, result.comment.id), result.comment);
            acceptThread(result);
            return result.comment;
        },
        [enqueue, withToken, acceptThread]
    );

    const removeComment = useCallback(
        async (threadId: string, id: string) => {
            const result = await enqueue(() =>
                withToken((token) => deleteComment(token, threadId, id))
            );
            recordWrite('comment', writeKeys.comment(threadId, id), null);
            acceptThread(result);
        },
        [enqueue, withToken, acceptThread]
    );

    const value = useMemo<ResponsesValue>(
        () => ({ threads, ensureLive, toggleReaction, saveComment, removeComment }),
        [threads, ensureLive, toggleReaction, saveComment, removeComment]
    );

    return <ResponsesContext.Provider value={value}>{children}</ResponsesContext.Provider>;
};

/**
 * The threads, plus the actions on them. Starts the live read on first use.
 */
export const useResponses = (): ResponsesValue => {
    const context = useContext(ResponsesContext);
    if (context === undefined) {
        throw new Error('useResponses must be used within a ResponsesProvider');
    }
    const { ensureLive } = context;
    useEffect(() => ensureLive(), [ensureLive]);
    return context;
};
