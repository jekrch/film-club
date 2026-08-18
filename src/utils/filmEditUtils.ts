import type { FilmOverride, FilmPatch } from '../api/clubApi';
import type { Film } from '../types/film';
import { parseImageUrl } from './imageUrl';

/**
 * The pure half of the film editor: what the form holds, what the club record
 * behind it currently says, and the patch that turns one into the other.
 *
 * Separated for the reason the rating and trophy editors' halves are — these are
 * the rules the worker applies anyway (`validateFilmPatch` in
 * `worker/src/validate.ts`), and a member should learn about a bad date from the
 * field they typed it in rather than from a 400. The worker's copy is the one
 * that is trusted.
 *
 * The date is the fiddly part. `films.json` has stored club watch dates as
 * `MM/DD/YYYY` since the first row, and `parseWatchDate` reads nothing else; an
 * `<input type="date">` speaks `YYYY-MM-DD` and nothing else. So the form holds
 * the ISO form, the stored value is converted into it for editing, and the
 * worker converts back on the way in — one conversion each way, both in code
 * that says which side it is on.
 */

/** The film fields as form state. Every input is a string; empty means unset. */
export interface FilmFormValues {
    /** A club member's display name, or `''` for "not recorded". */
    selector: string;
    /** `YYYY-MM-DD`, the only form `<input type="date">` accepts. */
    watchDate: string;
    /** An `https` URL for the cover, or `''` to use OMDb's. */
    poster: string;
    /** An `https` URL for the hero background, or `''` to use TMDb's stills. */
    backdropImage: string;
}

export const EMPTY_FILM_FORM: FilmFormValues = {
    selector: '',
    watchDate: '',
    poster: '',
    backdropImage: '',
};

/**
 * A club watch date as `films.json` stores it.
 *
 * The year is two digits or four, because the column holds both: 42 films are
 * `08/12/2020` and 30 are `3/14/23`, entered by hand into a spreadsheet cell
 * over five years. `parseWatchDate` in `filmUtils.ts` has always accepted the
 * short form, so anything that reads this column has to as well — a converter
 * that took four digits only would blank the date field on nearly half the
 * catalogue, and the first save on one of those films would clear a date nobody
 * touched.
 */
const US_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The `23` → `2023` pivot, matching `parseWatchDate`'s. */
const fullYear = (year: string): string => (year.length <= 2 ? String(2000 + Number(year)) : year);

/**
 * Converts a stored club watch date to the ISO form a date input needs.
 *
 * Anything unrecognized comes back as `''` rather than being passed through: a
 * date input silently ignores a value it can't parse, so passing one on would
 * show an empty field that is nonetheless "unchanged", and the member's first
 * save would blank a date they never touched.
 */
export const toDateInput = (stored: string | null | undefined): string => {
    const text = (stored ?? '').trim();
    if (text === '') return '';
    if (ISO_DATE.test(text)) return text;

    const match = US_DATE.exec(text);
    if (!match) return '';
    const [, month, day, year] = match;
    return `${fullYear(year)}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

/** The reverse, for showing a form value the way the rest of the site shows it. */
export const fromDateInput = (iso: string): string => {
    if (!ISO_DATE.test(iso)) return iso;
    const [year, month, day] = iso.split('-');
    return `${month}/${day}/${year}`;
};

/**
 * What the form should show for a film: the member-authored override where
 * there is one, and the film's own values everywhere else.
 *
 * The same precedence CI applies (`apply_overrides.py`), so what a member sees
 * in the form is what the next deploy will produce. Presence is what decides,
 * not truthiness — an override that deliberately blanks the selector has to win
 * over the sheet's value rather than falling through to it.
 */
export function baselineFilmForm(
    film: Pick<Film, 'poster' | 'backdropImage' | 'movieClubInfo'> | undefined,
    override: FilmOverride | undefined
): FilmFormValues {
    const pick = <T>(key: keyof FilmOverride, fallback: T | null | undefined): T | null =>
        override && key in override ? ((override[key] as T | null) ?? null) : (fallback ?? null);

    return {
        selector: pick<string>('selector', film?.movieClubInfo?.selector) ?? '',
        watchDate: toDateInput(pick<string>('watchDate', film?.movieClubInfo?.watchDate)),
        poster: pick<string>('poster', film?.poster) ?? '',
        backdropImage: pick<string>('backdropImage', film?.backdropImage) ?? '',
    };
}

/** Field-by-field equality; the builders here return a fresh object every call. */
export const sameFilmForm = (a: FilmFormValues, b: FilmFormValues): boolean =>
    a.selector === b.selector &&
    a.watchDate === b.watchDate &&
    a.poster === b.poster &&
    a.backdropImage === b.backdropImage;

/** The normalized values a form holds, before they are diffed into a patch. */
export interface ParsedFilmForm {
    selector: string | null;
    watchDate: string | null;
    poster: string | null;
    backdropImage: string | null;
}

export type FilmParseResult = { values: ParsedFilmForm } | { error: string };

/**
 * Validates and normalizes what the member typed.
 *
 * Blank collapses to `null` throughout, matching the worker: a cleared field and
 * one never filled in have to store the same value, or the diff churns between
 * `""` and `null` on every save.
 */
export function parseFilmForm(form: FilmFormValues): FilmParseResult {
    const watchDate = form.watchDate.trim();
    if (watchDate !== '' && !ISO_DATE.test(watchDate)) {
        return { error: "That watch date isn't a date the club could have watched on." };
    }
    if (watchDate !== '' && watchDate < '2000-01-01') {
        return { error: 'The club has not been going that long — check the year.' };
    }

    const poster = parseImageUrl(form.poster);
    if ('error' in poster) return { error: `Cover image: ${poster.error}` };

    const backdrop = parseImageUrl(form.backdropImage);
    if ('error' in backdrop) return { error: `Background image: ${backdrop.error}` };

    return {
        values: {
            selector: form.selector.trim() === '' ? null : form.selector.trim(),
            watchDate: watchDate === '' ? null : watchDate,
            poster: poster.value,
            backdropImage: backdrop.value,
        },
    };
}

/**
 * The patch that carries only what actually moved.
 *
 * A field-level merge needs a field-level diff: sending every key would write
 * `selector: null` for a film whose selector the sheet supplied and this member
 * never looked at, and an override of `null` is a deliberate blank that the
 * sheet can no longer fix (§8.7). So a key is sent when the member changed it,
 * and left out otherwise.
 *
 * `baseline` is the form the values were seeded from — the same one
 * {@link baselineFilmForm} built — so "changed" means changed by this member in
 * this sitting, rather than differing from whatever the file happens to hold.
 */
export function buildFilmPatch(values: ParsedFilmForm, baseline: FilmFormValues): FilmPatch {
    const patch: FilmPatch = {};
    const seeded = parseFilmForm(baseline);
    // The baseline came out of stored data rather than a keyboard, so it parses;
    // an unparseable one means every field is treated as changed, which is the
    // safe direction — it writes what the member is looking at.
    const before: ParsedFilmForm =
        'values' in seeded
            ? seeded.values
            : { selector: null, watchDate: null, poster: null, backdropImage: null };

    if (values.selector !== before.selector) patch.selector = values.selector;
    if (values.watchDate !== before.watchDate) {
        patch.watchDate = values.watchDate === null ? null : fromDateInput(values.watchDate);
    }
    if (values.poster !== before.poster) patch.poster = values.poster;
    if (values.backdropImage !== before.backdropImage) patch.backdropImage = values.backdropImage;

    return patch;
}
