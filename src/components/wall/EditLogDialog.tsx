import React from 'react';

import Modal from '../common/Modal';
import WatchedEntryEditor from '../films/WatchedEntryEditor';
import { useClubAuth } from '../../auth/GoogleAuth';
import { deleteWatched, putWatched, type WatchedPatch } from '../../api/clubApi';
import { recordWrite, writeKeys } from '../../api/writeCache';
import type { LogEvent } from '../../utils/wallUtils';

interface EditLogDialogProps {
    /** The log row being edited; kept through the close animation by the caller. */
    event: LogEvent;
    isOpen: boolean;
    onClose: () => void;
    /** After a save or a removal has landed, so the wall can redraw from it. */
    onChanged: () => void;
}

/**
 * A log entry's editor, opened from its row on the club's wall.
 *
 * The same form the member's own log opens inline, in a dialog here because a
 * wall row is a view onto the entry rather than the entry itself — the form
 * opening inside it would push the rest of the timeline out from under the
 * reader. Saves go through the same write cache the log page uses, so the wall,
 * the log and a reload all agree on the new value while the CDN catches up.
 *
 * Open to whoever `canEditAs` the entry's owner: the owner, or an admin, for
 * whom the write names the owner since the worker defaults to the caller.
 */
const EditLogDialog: React.FC<EditLogDialogProps> = ({ event, isOpen, onClose, onChanged }) => {
    const { member, withToken } = useClubAuth();
    const { entry, member: owner } = event;
    const title = entry.title ?? 'Unknown film';
    const actingFor = member && owner.toLowerCase() !== member.toLowerCase() ? owner : undefined;

    const save = async (patch: WatchedPatch) => {
        const { entry: saved } = await withToken((token) =>
            putWatched(token, entry.imdbID, actingFor ? { ...patch, owner: actingFor } : patch)
        );
        recordWrite('watched', writeKeys.watched(owner, saved.imdbID), saved);
        onChanged();
    };

    const remove = async () => {
        // The worker echoes the owner it resolved, which is the name the
        // tombstone has to be keyed by — the same reason the log page uses it.
        const { owner: removedFrom } = await withToken((token) =>
            deleteWatched(token, entry.imdbID, actingFor)
        );
        recordWrite('watched', writeKeys.watched(removedFrom, entry.imdbID), null);
        onChanged();
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            accent="emerald"
            eyebrow={actingFor ? `${owner}'s log` : 'Your log'}
            title={title}
            subtitle={entry.year ?? undefined}
            className="max-h-[88vh] max-w-xl md:max-w-2xl"
        >
            <div className="themed-scrollbar min-h-0 overflow-y-auto p-4 md:p-5">
                {/* Keyed by the entry so reopening on another row seeds afresh
                    rather than keeping the last row's draft. */}
                <WatchedEntryEditor
                    key={`${owner} ${entry.imdbID}`}
                    entry={entry}
                    title={title}
                    onSave={save}
                    onRemove={remove}
                    onClose={onClose}
                />
            </div>
        </Modal>
    );
};

export default EditLogDialog;
