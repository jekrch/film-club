import { useState, useLayoutEffect, useMemo } from 'react';
import { Film, filmData as allFilmsData } from '../types/film'; // Ensure filmData is imported as allFilmsData or similar
import { teamMembers } from '../types/team';
import {
    getAllFilmCreditsForPerson,
    isUpcomingHolidayPod,
    parseWatchDate,
    PersonCredit,
} from '../utils/filmUtils'; // Assuming this util exists

// Active selectors in cycle order (queue > 0, ascending). Used to figure out who
// picks after the current "up next" selector once they've made their choice.
const sortedActiveMembers = teamMembers
    .filter((member) => typeof member.queue === 'number' && member.queue > 0)
    .sort((a, b) => (a.queue ?? Infinity) - (b.queue ?? Infinity));

const getNextSelectorName = (currentSelector?: string | null): string | null => {
    if (!currentSelector || sortedActiveMembers.length === 0) return null;
    const idx = sortedActiveMembers.findIndex((m) => m.name === currentSelector);
    if (idx === -1) return null;
    return sortedActiveMembers[(idx + 1) % sortedActiveMembers.length].name;
};

export interface CreditsModalInfo {
    isOpen: boolean;
    personName: string | null;
    filmography: PersonCredit[] | null;
}

export interface UseFilmDetailsReturn {
    film: Film | null;
    loading: boolean;
    error: string | null;
    filmsBySameSelector: Film[];
    previousFilm: Film | null; // The film the club watched immediately before this one
    nextFilm: Film | null; // The film the club watched immediately after this one
    nextSelectorPlaceholder: string | null; // Selector for the not-yet-chosen film after the "up next" pick
    watchUrl: string | null;
    linkCheckStatus: 'idle' | 'valid' | 'not_found'; // Simplified for this hook example
    creditsModalState: CreditsModalInfo;
    handleCreditPersonClick: (personName: string, filmographyForModal: PersonCredit[]) => void;
    closeCreditsModal: () => void;
    personAllFilmographies: Record<string, PersonCredit[]>;
}

const getCriterionChannelUrl = (title: string): string => {
    const baseUrl = 'https://www.criterionchannel.com/videos/';
    const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `${baseUrl}${slug}`;
};

export const useFilmDetails = (imdbId?: string): UseFilmDetailsReturn => {
    const [film, setFilm] = useState<Film | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filmsBySameSelector, setFilmsBySameSelector] = useState<Film[]>([]);
    const [watchUrl, setWatchUrl] = useState<string | null>(null);
    // Simplified linkCheckStatus for this hook. The original page had more states for async checks.
    // If async check is needed, this logic would be more complex.
    const [linkCheckStatus, setLinkCheckStatus] = useState<'idle' | 'valid' | 'not_found'>('idle');
    const [creditsModalState, setCreditsModalState] = useState<CreditsModalInfo>({
        isOpen: false,
        personName: null,
        filmography: null,
    });

    // `useLayoutEffect`, not `useEffect`: every lookup below is synchronous work
    // over an imported JSON array, so there is nothing to wait for. A passive
    // effect would let the browser paint the `loading` state — a full-height
    // solid panel with a spinner — for one frame before the real content
    // replaced it, which is the flash you see on every navigation. Running
    // before paint means the page's first frame is already the film.
    //
    // Scroll is not reset here: ScrollToTop owns that for every route.
    useLayoutEffect(() => {
        // Reset states on imdbId change
        setFilm(null);
        setFilmsBySameSelector([]);
        setWatchUrl(null);
        setLinkCheckStatus('idle');
        setLoading(true);
        setError(null);
        setCreditsModalState({ isOpen: false, personName: null, filmography: null });

        if (!imdbId) {
            setError('Film ID is missing.');
            setLoading(false);
            return;
        }

        const foundFilm = allFilmsData.find((f) => f.imdbID === imdbId);

        if (!foundFilm) {
            setError(`Film with ID ${imdbId} not found.`);
            setLoading(false);
            return;
        }

        setFilm(foundFilm);

        // Watch URL logic (simplified, no async check in this basic hook version)
        // A popcorn- or holiday-pod film was never a Criterion selection, so
        // guessing a criterionchannel.com slug for it would only produce a dead link.
        const isPod = foundFilm.popcornPod || foundFilm.holidayPod;
        if (foundFilm.noStreaming || (isPod && !foundFilm.streamUrl?.length)) {
            setWatchUrl(null);
            setLinkCheckStatus('not_found');
        } else if (foundFilm.streamUrl?.length) {
            setWatchUrl(foundFilm.streamUrl);
            setLinkCheckStatus('valid');
        } else if (foundFilm.title) {
            setWatchUrl(getCriterionChannelUrl(foundFilm.title));
            setLinkCheckStatus('valid');
        } else {
            setLinkCheckStatus('idle');
        }

        // Films by same selector
        const currentSelector = foundFilm.movieClubInfo?.selector;
        if (currentSelector) {
            const otherFilms = allFilmsData
                .filter(
                    (otherFilm) =>
                        otherFilm.imdbID !== imdbId &&
                        otherFilm.movieClubInfo?.selector === currentSelector
                )
                .sort((a, b) => {
                    const dateA = a.movieClubInfo?.watchDate
                        ? new Date(a.movieClubInfo.watchDate).getTime()
                        : 0;
                    const dateB = b.movieClubInfo?.watchDate
                        ? new Date(b.movieClubInfo.watchDate).getTime()
                        : 0;
                    return dateB - dateA || (a.title ?? '').localeCompare(b.title ?? '');
                });
            setFilmsBySameSelector(otherFilms);
        } else {
            setFilmsBySameSelector([]);
        }

        setLoading(false);
    }, [imdbId]);

    const personAllFilmographies = useMemo(() => {
        const data: Record<string, PersonCredit[]> = {};
        if (!film) return data;

        const creditFieldsToScan = [
            'director',
            'writer',
            'actors',
            'cinematographer',
            'editor',
            'productionDesigner',
            'musicComposer',
            'costumeDesigner',
        ] as const; // Important for type safety

        const personsInCurrentFilm = new Set<string>();
        creditFieldsToScan.forEach((fieldKey) => {
            const creditString = film[fieldKey] as string | undefined; // Type assertion
            if (
                creditString &&
                typeof creditString === 'string' &&
                creditString.toLowerCase() !== 'n/a'
            ) {
                creditString
                    .split(',')
                    .map((p) => p.trim())
                    .filter((p) => p)
                    .forEach((p) => personsInCurrentFilm.add(p));
            }
        });

        // Include the TMDb cast list so cast-strip names can be grouped too.
        film.cast?.forEach((member) => {
            const name = member?.name?.trim();
            if (name) personsInCurrentFilm.add(name);
        });

        personsInCurrentFilm.forEach((personName) => {
            data[personName] = getAllFilmCreditsForPerson(personName, allFilmsData);
        });
        return data;
    }, [film]); // Only depends on the current film

    // Locate this film within the club's chronological watch history so the page
    // can offer "previous"/"next" navigation. Films without a watch date sit at
    // the end of the timeline: first any holiday pod the club hasn't met for yet
    // (they're held before the next pick), then the unwatched "up next" pick.
    const { previousFilm, nextFilm, nextSelectorPlaceholder } = useMemo(() => {
        const empty = { previousFilm: null, nextFilm: null, nextSelectorPlaceholder: null };
        if (!film) return empty;

        const watchedTimeline = allFilmsData
            .filter((f) => parseWatchDate(f.movieClubInfo?.watchDate))
            .sort((a, b) => {
                const dateA = parseWatchDate(a.movieClubInfo!.watchDate)!.getTime();
                const dateB = parseWatchDate(b.movieClubInfo!.watchDate)!.getTime();
                // Stable secondary sort by title keeps same-date pairs in a fixed order.
                return dateA - dateB || (a.title ?? '').localeCompare(b.title ?? '');
            });

        const upcomingHolidayPods = allFilmsData.filter(isUpcomingHolidayPod);

        // The "up next" pick is a film with a selector but no watch date.
        const upNextFilm =
            allFilmsData.find(
                (f) =>
                    f.movieClubInfo?.selector &&
                    !f.holidayPod &&
                    !parseWatchDate(f.movieClubInfo?.watchDate)
            ) ?? null;

        const timeline = [
            ...watchedTimeline,
            ...upcomingHolidayPods,
            ...(upNextFilm ? [upNextFilm] : []),
        ];

        const currentIndex = timeline.findIndex((f) => f.imdbID === film.imdbID);
        if (currentIndex === -1) return empty;

        // The pick after "up next" hasn't been selected yet, so we surface the
        // selector who picks after it as a placeholder.
        const isUpNext = upNextFilm !== null && upNextFilm.imdbID === film.imdbID;

        return {
            previousFilm: timeline[currentIndex - 1] ?? null,
            nextFilm: timeline[currentIndex + 1] ?? null,
            nextSelectorPlaceholder: isUpNext
                ? getNextSelectorName(upNextFilm.movieClubInfo?.selector)
                : null,
        };
    }, [film]);

    const handleCreditPersonClick = (personName: string, filmographyForModal: PersonCredit[]) => {
        setCreditsModalState({
            isOpen: true,
            personName: personName,
            filmography: filmographyForModal,
        });
    };

    const closeCreditsModal = () => {
        setCreditsModalState({ isOpen: false, personName: null, filmography: null });
    };

    return {
        film,
        loading,
        error,
        filmsBySameSelector,
        previousFilm,
        nextFilm,
        nextSelectorPlaceholder,
        watchUrl,
        linkCheckStatus,
        creditsModalState,
        handleCreditPersonClick,
        closeCreditsModal,
        personAllFilmographies,
    };
};
