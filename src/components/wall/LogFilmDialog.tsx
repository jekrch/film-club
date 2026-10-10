import React, { useState } from 'react';

import Modal from '../common/Modal';
import FilmSearchPicker from '../films/FilmSearchPicker';
import { useClubAuth } from '../../auth/GoogleAuth';
import { putWatched, type FilmSearchResult } from '../../api/clubApi';
import { recordWrite, writeKeys } from '../../api/writeCache';
import type { WatchedEntry } from '../../types/watched';
import { todayLocal } from '../../utils/watchedEditUtils';

interface LogFilmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    /** The signed-in member, whose log this writes to. */
    member: string;
    /** Ids already in their log, which the search shows as taken. */
    logged: ReadonlySet<string>;
    /** After the save, with the stored entry and the title the search knew it by. */
    onLogged: (entry: WatchedEntry, title: string) => void;
}

/**
 * The watch log's search box, opened from the club's wall.
 *
 * The same one-click save the member's own log page makes — today's date, no
 * score, no review — so logging from here is no more work than logging there.
 * Rating it stays the log row's job; the wall points there once it's saved.
 *
 * Always the reader's own log. An admin logging for someone else does that from
 * that member's page, where whose log it is can't be mistaken.
 */
const LogFilmDialog: React.FC<LogFilmDialogProps> = ({
    isOpen,
    onClose,
    member,
    logged,
    onLogged,
}) => {
    const { withToken } = useClubAuth();
    const [saving, setSaving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const close = () => {
        setError(null);
        onClose();
    };

    const log = async (hit: FilmSearchResult) => {
        setSaving(hit.title);
        setError(null);
        try {
            const { entry } = await withToken((token) =>
                putWatched(token, hit.imdbID, { watchDate: todayLocal() })
            );
            // So a reload, or the log page, shows the save during the CDN's
            // five-minute window rather than the file from before it.
            recordWrite('watched', writeKeys.watched(member, entry.imdbID), entry);
            onLogged(entry, hit.title);
            close();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Save failed.');
        } finally {
            setSaving(null);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={close}
            accent="emerald"
            eyebrow="Your log"
            title="Log a film"
            subtitle="Logged as watched today. Add a score or review from your log."
            className="max-w-lg"
        >
            <div className="p-4 md:p-5">
                {/* Disabled rather than hidden while a save is in flight, so a
                    second tap can't log a second film over the first. */}
                <fieldset disabled={saving !== null}>
                    <FilmSearchPicker
                        onPick={(hit) => void log(hit)}
                        chosen={logged}
                        accent="blue"
                        label="Search for a film you watched"
                        chosenLabel="logged"
                    />
                </fieldset>
                {saving && <p className="mt-3 text-sm italic text-slate-400">Logging {saving}…</p>}
                {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
            </div>
        </Modal>
    );
};

export default LogFilmDialog;
