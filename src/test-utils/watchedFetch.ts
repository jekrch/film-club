import { waitFor, screen } from '@testing-library/react';

import { resetFilmSummaries } from '../api/filmSummaries';
import { resetWatchedLogs } from '../hooks/useWatchedLog';
import { memberSlug, type WatchedEntry } from '../types/watched';

/**
 * Serves watch logs the way the site publishes them, one file per member
 * under `data/watched/`, from a fixture keyed by display name. Anything else
 * `fetch` is asked for is a 404, which every caller already treats as "not
 * there" or swallows.
 *
 * Also clears what the previous test fetched, since the log hook and the
 * summary cache remember across renders on purpose.
 */
export function serveWatchedLogs(logs: Record<string, WatchedEntry[]>): jest.Mock {
    resetWatchedLogs();
    resetFilmSummaries();

    const files = new Map(
        Object.entries(logs).map(([name, entries]) => [
            `/data/watched/${memberSlug(name)}.json`,
            entries,
        ])
    );
    const mock = jest.fn(async (url: string) => {
        const path = url.split('?')[0];
        const isLog = path.startsWith('/data/watched/');
        const body = files.get(path) ?? (isLog ? [] : undefined);
        return {
            ok: body !== undefined,
            status: body !== undefined ? 200 : 404,
            json: async () => body,
        } as unknown as Response;
    });
    global.fetch = mock as unknown as typeof fetch;
    return mock;
}

/** Waits for a page's watch logs to land, i.e. for its "Loading…" to go. */
export const logsLoaded = () =>
    waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument());
