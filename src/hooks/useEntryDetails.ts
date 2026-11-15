import { useCallback, useRef, useState } from 'react';

import { fetchFilmSummary, loadedFilmSummary } from '../api/filmSummaries';
import { summaryDetails, type EntryDetails } from '../utils/entryDetails';
import type { ListFilmSummary } from '../types/list';

/**
 * How long a click on Details waits for the film's full summary before opening
 * the panel anyway with what the row already has.
 *
 * Long enough for a warm fetch, or one started on hover, to land first, so the
 * panel opens once at its final height. Short enough that a slow network still
 * gets a panel that responds to the click; it fills in when the fetch lands.
 */
const OPEN_WAIT_MS = 350;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface EntryDetailsState {
    /** What the panel shows: the full summary's details once fetched, the row's own until then. */
    details: EntryDetails | null;
    open: boolean;
    /** Opens or closes the panel, fetching the full summary first when it needs one. */
    toggle: () => void;
    /** Starts the fetch early, from a hover or a focus on whatever opens the panel. */
    prefetch: () => void;
}

/**
 * A row's details panel, for a film whose record is only partly in the bundle.
 *
 * A film the club never watched is bundled as a slim index entry (see
 * `slimListFilms` in `vite.config.ts`): enough to draw the row, not enough for
 * its panel's plot, cast and crew. Those come from `data/films/<id>.json` the
 * first time someone reaches for the panel. A club film's record is whole
 * already, so `fromCache` false makes this a plain open/closed toggle.
 */
export function useEntryDetails(
    imdbID: string | undefined,
    rowDetails: EntryDetails | null,
    fromCache: boolean
): EntryDetailsState {
    const lazy = fromCache && imdbID !== undefined;

    const [summary, setSummary] = useState<ListFilmSummary | null>(() =>
        lazy ? (loadedFilmSummary(imdbID) ?? null) : null
    );
    const [open, setOpen] = useState(false);
    const opening = useRef(false);

    const load = useCallback((): Promise<void> => {
        if (!lazy || summary) return Promise.resolve();
        return fetchFilmSummary(imdbID).then((found) => {
            if (found) setSummary(found);
        });
    }, [lazy, imdbID, summary]);

    const prefetch = useCallback(() => void load(), [load]);

    const toggle = useCallback(() => {
        if (open || !lazy || summary) {
            setOpen(!open);
            return;
        }
        if (opening.current) return;
        opening.current = true;
        void Promise.race([load(), wait(OPEN_WAIT_MS)]).finally(() => {
            opening.current = false;
            setOpen(true);
        });
    }, [open, lazy, summary, load]);

    const details = (summary && summaryDetails(summary)) ?? rowDetails;
    return { details, open, toggle, prefetch };
}
