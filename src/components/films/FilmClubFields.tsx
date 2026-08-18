import React from 'react';

import ImageUrlPreview from '../common/ImageUrlPreview';
import Select from '../common/Select';
import { teamMembers } from '../../types/team';
import { IMAGE_URL_LIMIT } from '../../utils/imageUrl';
import type { FilmFormValues } from '../../utils/filmEditUtils';

/**
 * The four fields that make up a film's club record, shared by the two places a
 * member fills them in: adding a film on the films page, and correcting one on
 * the film's own page.
 *
 * They are the same fields in both, and were the Google Sheet's `selected_by`
 * and `watch_date` columns until now. The two images never had a column at all —
 * a curated `backdropImage` meant editing `films.json` by hand, which is why 23
 * films have one and the rest make do with whatever TMDb had.
 */

interface FilmClubFieldsProps {
    values: FilmFormValues;
    onChange: (field: keyof FilmFormValues, value: string) => void;
    disabled?: boolean;
    /** Colours the focus ring to match the panel it sits in. */
    accent?: 'blue' | 'amber';
}

const FIELD_BASE =
    'w-full rounded-md border border-slate-600/60 bg-slate-800/60 px-3 py-2 text-slate-100 ' +
    'placeholder:text-slate-500 focus:outline-none';

const FOCUS = {
    blue: 'focus:border-blue-400/60',
    amber: 'focus:border-amber-400/60',
} as const;

const LABEL_CLASS = 'mb-1 block text-xs uppercase tracking-wider text-slate-500';

const FilmClubFields: React.FC<FilmClubFieldsProps> = ({
    values,
    onChange,
    disabled = false,
    accent = 'blue',
}) => {
    const fieldClass = `${FIELD_BASE} ${FOCUS[accent]}`;
    const memberOptions = teamMembers
        .filter((entry) => entry.name)
        .map((entry) => ({ value: entry.name, label: entry.name }));

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
                <Select
                    label="Whose pick"
                    value={values.selector}
                    onChange={(value) => onChange('selector', value)}
                    options={memberOptions}
                    placeholder="Not recorded"
                    className="w-44"
                />

                <label className="block w-44">
                    <span className={LABEL_CLASS}>Watch date</span>
                    <input
                        type="date"
                        value={values.watchDate}
                        onChange={(e) => onChange('watchDate', e.target.value)}
                        disabled={disabled}
                        className={fieldClass}
                    />
                </label>

                <p className="max-w-xs self-end pb-2 text-xs italic text-slate-500">
                    The date the club met about it. Leave it blank for a film that is picked but not
                    yet watched.
                </p>
            </div>

            <label className="block">
                <span className={LABEL_CLASS}>Alternate cover</span>
                <div className="flex items-start gap-3">
                    <input
                        type="url"
                        inputMode="url"
                        maxLength={IMAGE_URL_LIMIT}
                        value={values.poster}
                        onChange={(e) => onChange('poster', e.target.value)}
                        disabled={disabled}
                        placeholder="https://… — leave blank for the cover OMDb has"
                        className={fieldClass}
                    />
                    <ImageUrlPreview url={values.poster} className="h-16 w-11" />
                </div>
            </label>

            <label className="block">
                <span className={LABEL_CLASS}>Hero background</span>
                <div className="flex items-start gap-3">
                    <input
                        type="url"
                        inputMode="url"
                        maxLength={IMAGE_URL_LIMIT}
                        value={values.backdropImage}
                        onChange={(e) => onChange('backdropImage', e.target.value)}
                        disabled={disabled}
                        placeholder="https://… — a wide still for the selection committee card"
                        className={fieldClass}
                    />
                    <ImageUrlPreview url={values.backdropImage} className="h-16 w-28" />
                </div>
            </label>
        </div>
    );
};

export default FilmClubFields;
