import { useState, useEffect, useMemo } from 'react';
import { Film, filmData as allFilmsData } from '../types/film'; // Ensure filmData is imported as allFilmsData or similar
import { getAllFilmCreditsForPerson, parseWatchDate, PersonCredit } from '../utils/filmUtils'; // Assuming this util exists

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
    nextFilm: Film | null;     // The film the club watched immediately after this one
    watchUrl: string | null;
    linkCheckStatus: 'idle' | 'valid' | 'not_found'; // Simplified for this hook example
    creditsModalState: CreditsModalInfo;
    handleCreditPersonClick: (personName: string, filmographyForModal: PersonCredit[]) => void;
    closeCreditsModal: () => void;
    personAllFilmographies: Record<string, PersonCredit[]>;
}

const getCriterionChannelUrl = (title: string): string => {
    const baseUrl = 'https://www.criterionchannel.com/videos/';
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
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

    useEffect(() => {
        // Reset states on imdbId change
        setFilm(null);
        setFilmsBySameSelector([]);
        setWatchUrl(null);
        setLinkCheckStatus('idle');
        setLoading(true);
        setError(null);
        setCreditsModalState({ isOpen: false, personName: null, filmography: null });
        window.scrollTo(0, 0);

        if (!imdbId) {
            setError("Film ID is missing.");
            setLoading(false);
            return;
        }

        const foundFilm = allFilmsData.find(f => f.imdbID === imdbId);

        if (!foundFilm) {
            setError(`Film with ID ${imdbId} not found.`);
            setLoading(false);
            return;
        }

        setFilm(foundFilm);

        // Watch URL logic (simplified, no async check in this basic hook version)
        if (foundFilm.noStreaming) {
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
                .filter(otherFilm => otherFilm.imdbID !== imdbId && otherFilm.movieClubInfo?.selector === currentSelector)
                .sort((a, b) => {
                    const dateA = a.movieClubInfo?.watchDate ? new Date(a.movieClubInfo.watchDate).getTime() : 0;
                    const dateB = b.movieClubInfo?.watchDate ? new Date(b.movieClubInfo.watchDate).getTime() : 0;
                    return (dateB - dateA) || (a.title ?? '').localeCompare(b.title ?? '');
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
            'director', 'writer', 'actors', 'cinematographer', 'editor',
            'productionDesigner', 'musicComposer', 'costumeDesigner'
        ] as const; // Important for type safety

        const personsInCurrentFilm = new Set<string>();
        creditFieldsToScan.forEach(fieldKey => {
            const creditString = film[fieldKey] as string | undefined; // Type assertion
            if (creditString && typeof creditString === 'string' && creditString.toLowerCase() !== 'n/a') {
                creditString.split(',').map(p => p.trim()).filter(p => p).forEach(p => personsInCurrentFilm.add(p));
            }
        });

        // Include the TMDb cast list so cast-strip names can be grouped too.
        film.cast?.forEach(member => {
            const name = member?.name?.trim();
            if (name) personsInCurrentFilm.add(name);
        });

        personsInCurrentFilm.forEach(personName => {
            data[personName] = getAllFilmCreditsForPerson(personName, allFilmsData);
        });
        return data;
    }, [film]); // Only depends on the current film


    // Locate this film within the club's chronological watch history so the page
    // can offer "previous"/"next" navigation. Films without a valid watch date
    // (e.g. unwatched "up next" picks) are excluded from the timeline.
    const { previousFilm, nextFilm } = useMemo(() => {
        if (!film?.movieClubInfo?.watchDate || !parseWatchDate(film.movieClubInfo.watchDate)) {
            return { previousFilm: null, nextFilm: null };
        }

        const watchedTimeline = allFilmsData
            .filter(f => parseWatchDate(f.movieClubInfo?.watchDate))
            .sort((a, b) => {
                const dateA = parseWatchDate(a.movieClubInfo!.watchDate)!.getTime();
                const dateB = parseWatchDate(b.movieClubInfo!.watchDate)!.getTime();
                // Stable secondary sort by title keeps same-date pairs in a fixed order.
                return (dateA - dateB) || (a.title ?? '').localeCompare(b.title ?? '');
            });

        const currentIndex = watchedTimeline.findIndex(f => f.imdbID === film.imdbID);
        if (currentIndex === -1) return { previousFilm: null, nextFilm: null };

        return {
            previousFilm: currentIndex > 0 ? watchedTimeline[currentIndex - 1] : null,
            nextFilm: currentIndex < watchedTimeline.length - 1 ? watchedTimeline[currentIndex + 1] : null,
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
        watchUrl,
        linkCheckStatus,
        creditsModalState,
        handleCreditPersonClick,
        closeCreditsModal,
        personAllFilmographies,
    };
};