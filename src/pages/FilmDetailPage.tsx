import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { calculateClubAverage } from '../utils/ratingUtils';
import FilmList from '../components/films/FilmList';
import CircularImage from '../components/common/CircularImage';
import PopcornRating from '../components/common/PopcornRating';
import CreditsModal from '../components/common/CreditsModal';
import TrailerModal from '../components/common/TrailerModal';
import { countValidRatings, formatCurrency, formatDayGap, formatRuntime, parseGenres, parseWatchDate } from '../utils/filmUtils';
import { getPersonProfileByName } from '../utils/personUtils';
import { Film } from '../types/film';
import FilmCastStrip from '../components/films/FilmCastStrip';
import PersonStrip, { PersonStripEntry } from '../components/films/PersonStrip';
import PageLayout from '../components/layout/PageLayout';
import BaseCard from '../components/common/BaseCard';
import CollapsibleContent from '../components/common/CollapsableContent';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorDisplay from '../components/common/ErrorDisplay';  
import { useFilmDetails } from '../hooks/useFilmDetails';
import TrophyGallery from '../components/common/TrophyGallery';
import WatchTimelineNav from '../components/common/WatchTimelineNav';
import SelectionCommitteeBackground from '../components/common/SelectionCommitteeBackground';
import { CalendarDaysIcon, UserGroupIcon } from '@heroicons/react/24/outline';


// Crew fields shown as headshot cards in the "Crew" strip, with their display
// role. Actors are intentionally excluded — they're covered by the cast strip.
const CREW_STRIP_FIELDS: { field: keyof Film; label: string }[] = [
    { field: 'director', label: 'Director' },
    { field: 'writer', label: 'Writer' },
    { field: 'cinematographer', label: 'Cinematography' },
    { field: 'editor', label: 'Editor' },
    { field: 'productionDesigner', label: 'Production Design' },
    { field: 'musicComposer', label: 'Music' },
    { field: 'costumeDesigner', label: 'Costume Design' },
];

// Shortens OMDb's verbose rating source names for the rating chips.
const RATING_SOURCE_LABELS: Record<string, string> = {
    'Internet Movie Database': 'IMDb',
    'Rotten Tomatoes': 'Rotten Tomatoes',
    'Metacritic': 'Metacritic',
};

const FilmDetailPage = () => {
    const { imdbId } = useParams<{ imdbId: string }>();
    const navigate = useNavigate();
    const [isTrailerOpen, setIsTrailerOpen] = useState(false);

    const {
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
    } = useFilmDetails(imdbId);

    const capitalizeFirstLetter = (str: string): string => str ? str.charAt(0).toUpperCase() + str.slice(1) : str;

    // Build the "Crew" strip: one card per person, grouping a person's roles
    // (e.g. someone who both directed and wrote) into a single subtitle, and
    // resolving their TMDb headshot via personProfiles.
    const crewPeople = useMemo<PersonStripEntry[]>(() => {
        if (!film) return [];
        const order: string[] = [];
        const byKey = new Map<string, { name: string; roles: string[] }>();
        CREW_STRIP_FIELDS.forEach(({ field, label }) => {
            const value = film[field];
            if (!value || typeof value !== 'string' || value.toLowerCase() === 'n/a') return;
            value.split(',').map(n => n.trim()).filter(Boolean).forEach(name => {
                const key = name.toLowerCase();
                let entry = byKey.get(key);
                if (!entry) {
                    entry = { name, roles: [] };
                    byKey.set(key, entry);
                    order.push(key);
                }
                if (!entry.roles.includes(label)) entry.roles.push(label);
            });
        });
        return order.map(key => {
            const { name, roles } = byKey.get(key)!;
            return {
                name,
                subtitle: roles.join(' · '),
                profileUrl: getPersonProfileByName(name)?.profileUrl ?? null,
                credits: personAllFilmographies[name] ?? [],
            };
        });
    }, [film, personAllFilmographies]);

    // UI Helper function (can remain in component or be moved to utils if more broadly used)
    const renderPlotParagraphs = (plot: string | undefined) => {
        if (!plot) {
            return <span className="italic text-slate-500">Plot not available.</span>;
        }
        const paragraphs = plot.split(/\n+/).map(p => p.trim()).filter(p => p !== '');
        if (paragraphs.length === 0) {
            return <span className="italic text-slate-500">Plot not available.</span>;
        }
        return paragraphs.map((paragraph, index) => (
            <p key={index} className={index < paragraphs.length - 1 ? 'mb-3' : ''}>
                {paragraph}
            </p>
        ));
    };

    if (loading) {
        return <LoadingSpinner />;
    }
    if (error || !film) {
        return <ErrorDisplay message={error || "Could not load film details."} backPath="/films" backButtonLabel="Back to Films List" />;
    }

    const filmGenres = parseGenres(film.genre);
    const runtimeDisplay = formatRuntime(film.runtime);
    const numberOfValidRatings = countValidRatings(film.movieClubInfo?.clubRatings);
    const clubAverageDisplay = numberOfValidRatings >= 2 ? calculateClubAverage(film.movieClubInfo?.clubRatings) : null;
    const selectorName = film.movieClubInfo?.selector;
    const externalRatings = (film.ratings ?? []).filter(r => r.value && r.value.toLowerCase() !== 'n/a');
    const boxOfficeDisplay = (film.boxOffice && film.boxOffice.toLowerCase() !== 'n/a')
        ? film.boxOffice
        : formatCurrency(film.revenue);
    const budgetDisplay = formatCurrency(film.budget);
    const awardsDisplay = film.awards && film.awards.toLowerCase() !== 'n/a' ? film.awards : null;
    const MAX_RATING = 9;
    const canWatch = linkCheckStatus === 'valid' && !!watchUrl;

    // Time elapsed between this screening and the club's adjacent screenings.
    const watchDateObj = parseWatchDate(film.movieClubInfo?.watchDate);
    const prevWatchDateObj = parseWatchDate(previousFilm?.movieClubInfo?.watchDate);
    const nextWatchDateObj = parseWatchDate(nextFilm?.movieClubInfo?.watchDate);
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const sincePreviousGap = watchDateObj && prevWatchDateObj
        ? formatDayGap(Math.round((watchDateObj.getTime() - prevWatchDateObj.getTime()) / MS_PER_DAY))
        : null;
    const untilNextGap = watchDateObj && nextWatchDateObj
        ? formatDayGap(Math.round((nextWatchDateObj.getTime() - watchDateObj.getTime()) / MS_PER_DAY))
        : null;

    return (
        <PageLayout>
            {creditsModalState.isOpen && film && (
                <CreditsModal
                    isOpen={creditsModalState.isOpen}
                    onClose={closeCreditsModal}
                    personName={creditsModalState.personName}
                    filmography={creditsModalState.filmography}
                    currentFilmId={film.imdbID}
                />
            )}

            {film.trailerKey && (
                <TrailerModal
                    isOpen={isTrailerOpen}
                    onClose={() => setIsTrailerOpen(false)}
                    trailerKey={film.trailerKey}
                    title={film.title}
                />
            )}

            <div className="">
                <button onClick={() => navigate(-1)} className="mb-6 inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors group">
                    {/* ... back button svg ... */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 transition-transform group-hover:-translate-x-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                    Back
                </button>

                <BaseCard key={`film-card-${film.imdbID}`} className="!p-0 overflow-hidden mb-12 ">
                    <div className="md:flex">
                        <div className="md:flex-shrink-0 md:w-1/3 lg:w-[400px] relative group overflow-hidden">
                            <img
                                src={film.poster}
                                alt={`${film.title} poster`}
                                className="h-full w-full object-cover"
                                onError={(e) => { const target = e.target as HTMLImageElement; target.src = '/placeholder-poster.png'; target.onerror = null; }}
                            />
                            {canWatch && (
                                <a
                                    href={watchUrl!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="absolute inset-0 pointer-events-none md:group-hover:pointer-events-auto"
                                    aria-label={`Watch ${film.title}`}
                                >
                                    <div
                                        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-end p-4 transition-opacity duration-300 ease-in-out h-auto md:h-1/3 opacity-100 md:opacity-0 md:group-hover:opacity-100`}
                                    >
                                        <span className={`bg-gray-900 bg-opacity-70 opacity-70 text-gray-100 text-lg font-semibold pr-5 pl-3 py-2 rounded-lg inline-flex items-center shadow-xl border border-white/20 pointer-events-auto `} >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2.5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                            </svg>
                                            Watch
                                        </span>
                                    </div>
                                </a>
                            )}
                        </div>

                        <div className="relative p-6 md:p-8 flex-grow overflow-hidden">
                            {film.backdropImage && (
                                <SelectionCommitteeBackground
                                    imageUrl={film.backdropImage}
                                    className="!rounded-none"
                                    scale={1}
                                    opacity={0.14}
                                    align="right"
                                />
                            )}
                            <div className="relative z-10">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3">
                                <h1 className="text-3xl lg:text-4xl font-bold text-slate-100 mb-1 sm:mb-0 pr-4">{film.title}</h1>
                                <span className="text-xl font-semibold text-slate-400 flex-shrink-0">({film.year})</span>
                            </div>
                            {film.tagline && (
                                <p className="text-slate-400 italic mb-4 -mt-1">{film.tagline}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400 mb-5">
                                {clubAverageDisplay && (
                                    <div className="flex items-center font-medium text-base" title={`Average Club Rating (${numberOfValidRatings} ratings)`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
                                        <span className="text-slate-200">{clubAverageDisplay}</span><span className="ml-1 text-slate-500">/ {MAX_RATING}</span> <span className="ml-1 text-xs">(Club Avg)</span>
                                    </div>
                                )}
                                {runtimeDisplay && <span className={clubAverageDisplay ? "border-l border-slate-600 pl-4" : ""}>{runtimeDisplay}</span>}
                                {film.rated !== 'N/A' && <span className={(clubAverageDisplay || runtimeDisplay) ? "border-l border-slate-600 pl-4" : ""}>{film.rated}</span>}
                                {film.trailerKey && (
                                    <button
                                        type="button"
                                        onClick={() => setIsTrailerOpen(true)}
                                        className={`inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400/50 rounded-sm ${(clubAverageDisplay || runtimeDisplay || film.rated !== 'N/A') ? "border-l border-slate-600 pl-4" : ""}`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                        </svg>
                                        Trailer
                                    </button>
                                )}
                            </div>

                            {externalRatings.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-5">
                                    {externalRatings.map((rating) => {
                                        const isImdb = rating.source === 'Internet Movie Database';
                                        const imdbUrl = isImdb && film.imdbID ? `https://www.imdb.com/title/${film.imdbID}/` : null;
                                        const chipContent = (
                                            <>
                                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                                    {RATING_SOURCE_LABELS[rating.source] ?? rating.source}
                                                </span>
                                                <span className="font-semibold text-slate-100">{rating.value}</span>
                                            </>
                                        );
                                        return imdbUrl ? (
                                            <a
                                                key={rating.source}
                                                href={imdbUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group inline-flex items-baseline gap-1.5 px-3 py-1 bg-slate-700/60 hover:bg-slate-600/60 ring-1 ring-yellow-500/30 hover:ring-yellow-500/60 rounded-md text-sm transition"
                                                title={`View on IMDb`}
                                            >
                                                {chipContent}
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 self-center text-slate-400 group-hover:text-yellow-400 transition" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                                </svg>
                                            </a>
                                        ) : (
                                            <span
                                                key={rating.source}
                                                className="inline-flex items-baseline gap-1.5 px-3 py-1 bg-slate-700/60 rounded-md text-sm"
                                                title={rating.source}
                                            >
                                                {chipContent}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="mb-5 text-slate-300 ">
                                <CollapsibleContent buttonSize="sm" lineClamp={3}>
                                    {renderPlotParagraphs(film.plot)}
                                </CollapsibleContent>
                            </div>

                            {/* Crew & cast (director, writer, stars, ...) are shown as
                                headshot cards in the Crew/Cast strips below. */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm mb-6">
                                {film.language && film.language.toLowerCase() !== 'n/a' && (
                                    <div><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Language</h3><p className="text-slate-300">{film.language}</p></div>
                                )}
                                {film.country && film.country.toLowerCase() !== 'n/a' && (
                                    <div><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Country</h3><p className="text-slate-300">{film.country}</p></div>
                                )}
                            </div>

                            </div>
                        </div>
                    </div>

                    {(filmGenres.length > 0 || budgetDisplay || boxOfficeDisplay || awardsDisplay) && (
                        <div className="px-6 md:px-8 py-5 border-t border-slate-700/60 flex flex-col sm:flex-row sm:flex-wrap gap-6 sm:gap-x-10 sm:gap-y-6">
                            {filmGenres.length > 0 && (
                                <div className="flex-shrink-0">
                                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Genres</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {filmGenres.map((genre) => (
                                            <span key={genre} className="px-3 py-1 bg-slate-700 text-blue-300 text-xs font-medium rounded-full">{genre}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {budgetDisplay && (
                                <div className="flex-shrink-0">
                                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Budget</h3>
                                    <p className="text-slate-300">{budgetDisplay}</p>
                                </div>
                            )}
                            {boxOfficeDisplay && (
                                <div className="flex-shrink-0">
                                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Box Office</h3>
                                    <p className="text-slate-300">{boxOfficeDisplay}</p>
                                </div>
                            )}
                            {awardsDisplay && (
                                <div className="sm:flex-1 sm:basis-80">
                                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Awards</h3>
                                    <p className="text-slate-300 leading-relaxed">{awardsDisplay}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {(crewPeople.length > 0 || (film.cast && film.cast.length > 0)) && (
                        <div className="px-6 md:px-8 pb-6 md:pb-8">
                            {crewPeople.length > 0 && (
                                <PersonStrip
                                    title="Crew"
                                    people={crewPeople}
                                    onPersonClick={handleCreditPersonClick}
                                />
                            )}
                            {film.cast && film.cast.length > 0 && (
                                <FilmCastStrip
                                    cast={film.cast}
                                    personAllFilmographies={personAllFilmographies}
                                    onPersonClick={handleCreditPersonClick}
                                />
                            )}
                        </div>
                    )}

                    {film.movieClubInfo && (
                        <div className="relative bg-gradient-to-b from-slate-850/80 to-slate-900/40 border-t-2 border-slate-700 p-6 md:p-8 overflow-hidden">
                            {/* Subtle ambient glow anchoring the club section */}
                            <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-blue-500/[0.07] blur-3xl" />
                            <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 ring-1 ring-blue-400/20">
                                    <UserGroupIcon className="h-5 w-5 text-blue-400" />
                                </div>
                                <h2 className="text-2xl font-semibold text-slate-100">Film Club Facts</h2>
                                <span className="h-px flex-grow bg-gradient-to-r from-blue-400/25 via-slate-700/60 to-transparent" />
                            </div>
                            <div className="md:flex md:justify-between md:items-start">
                                <div className="flex-1 mb-6 md:mb-0 md:pr-6">
                                    {film.movieClubInfo.watchDate && (
                                        <div className="mb-6 inline-flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/40 px-4 py-2.5">
                                            <CalendarDaysIcon className="h-5 w-5 flex-shrink-0 text-blue-400/80" />
                                            <div className="leading-tight">
                                                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.15em]">Watch Date</span>
                                                <span className="text-slate-100 text-base font-medium">{film.movieClubInfo.watchDate}</span>
                                            </div>
                                        </div>
                                    )}
                                    {numberOfValidRatings > 0 ? (
                                        <div>
                                            <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Club Rating</h3>
                                            {clubAverageDisplay && !isNaN(clubAverageDisplay) && (
                                                <div className="mb-5 flex items-center gap-x-4 gap-y-2 flex-wrap">
                                                    <div className="flex items-baseline whitespace-nowrap">
                                                        <span className="text-4xl font-bold text-blue-300">{clubAverageDisplay}</span>
                                                        <span className="text-slate-400 text-lg"> / {MAX_RATING}</span>
                                                    </div>
                                                    <PopcornRating rating={clubAverageDisplay} maxRating={MAX_RATING} size="regular" title={`Average rating: ${clubAverageDisplay} out of ${MAX_RATING}`} />
                                                </div>
                                            )}
                                            {!clubAverageDisplay && numberOfValidRatings === 1 && (<p className="mb-4 text-slate-400 text-sm italic">Needs at least 2 ratings to show an average.</p>)}
                                            <h4 className="text-sm font-semibold text-slate-300 mb-3 mt-4">Individual Ratings:</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                                                {film.movieClubInfo.clubRatings
                                                    .filter(rating => rating.score !== null && typeof rating.score === 'number')
                                                    .sort((a, b) => a.user.localeCompare(b.user))
                                                    .map(rating => (
                                                        <div key={rating.user} className="space-y-2">
                                                            <div className="flex items-center space-x-2">
                                                                <Link to={`/profile/${encodeURIComponent(capitalizeFirstLetter(rating.user))}`} className="text-slate-300 hover:text-white transition font-medium capitalize w-16 truncate" title={`View ${capitalizeFirstLetter(rating.user)}'s profile`}>
                                                                    {capitalizeFirstLetter(rating.user)}:
                                                                </Link>
                                                                <span className="font-semibold text-slate-200 w-8 text-right">{rating.score}</span>
                                                                <PopcornRating rating={rating.score as number} maxRating={MAX_RATING} size="small" title={`${capitalizeFirstLetter(rating.user)}'s rating: ${rating.score} out of ${MAX_RATING}`} />
                                                            </div>
                                                            {rating.blurb && (
                                                                <div className="group/blurb relative ml-2 mt-4 overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/80 via-slate-850/80 to-slate-900/90 shadow-lg shadow-black/20 transition-colors duration-300 hover:border-emerald-400/30">
                                                                    {/* Faded reviewer portrait washing in from the right, fading toward the text */}
                                                                    <img
                                                                        src={`/images/${rating.user.toLowerCase()}.jpg`}
                                                                        alt=""
                                                                        aria-hidden="true"
                                                                        className="pointer-events-none absolute inset-y-0 right-0 h-full w-2/5 object-cover object-top opacity-[0.16] grayscale transition-opacity duration-300 group-hover/blurb:opacity-25"
                                                                        style={{
                                                                            WebkitMaskImage: 'linear-gradient(to right, transparent, black)',
                                                                            maskImage: 'linear-gradient(to right, transparent, black)',
                                                                        }}
                                                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                                    />
                                                                    {/* Emerald accent rail */}
                                                                    <span className="absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-emerald-400/70 via-emerald-400/30 to-transparent" />
                                                                    <div className="relative z-10 px-4 pb-3 pt-3.5">
                                                                        <svg className="mb-1.5 h-5 w-5 text-emerald-400/50" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-10zm-14 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" /></svg>
                                                                        <CollapsibleContent buttonSize="sm" lineClamp={3} className="text-sm italic leading-relaxed text-slate-300">
                                                                            {rating.blurb}
                                                                            <span className="capitalize">&nbsp;&mdash;&nbsp;{capitalizeFirstLetter(rating.user)}</span>
                                                                        </CollapsibleContent>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    ) : (<div> <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Club Rating</h3> <p className="text-slate-400 italic">No ratings submitted yet.</p> </div>)}
                                </div>
                                {selectorName && (
                                    <Link to={`/profile/${encodeURIComponent(capitalizeFirstLetter(selectorName))}`} className="flex flex-col items-center md:ml-8 md:flex-shrink-0 mt-6 md:mt-0 group" title={`View ${capitalizeFirstLetter(selectorName)}'s profile`} >
                                        <div className="relative mb-2">
                                            <CircularImage alt={capitalizeFirstLetter(selectorName)} size="w-32 h-32 md:w-36 md:h-36" />
                                            <div className="absolute bottom-0 transform -translate-x-1/2 translate-y-1/4 bg-emerald-600 text-slate-100 px-4 py-1 rounded text-base font-semibold whitespace-nowrap shadow-lg group-hover:scale-105 group-hover:rotate-[5deg] transition-transform duration-200 ease-in-out" style={{ transform: 'translateX(55%) translateY(5%) rotate(-7deg)', transformOrigin: 'center bottom' }}>
                                                {capitalizeFirstLetter(selectorName)}'s Pick
                                            </div>
                                        </div>
                                    </Link>
                                )}
                            </div>
                            
                            {/* Trophy Gallery Section */}
                            {film.movieClubInfo.trophyNotes && (
                                <TrophyGallery trophyNotes={film.movieClubInfo.trophyNotes} />
                            )}
                            
                            {/* Trophy Info (if separate from notes) */}
                            {film.movieClubInfo.trophyInfo && !film.movieClubInfo.trophyNotes && (
                                <div className="mt-8 pt-6 border-t border-slate-700">
                                    <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Trophy Info</h3>
                                    <p className="text-slate-300 whitespace-pre-line">{film.movieClubInfo.trophyInfo}</p>
                                </div>
                            )}

                            {/* Previous / Next film in the club's watch timeline */}
                            <WatchTimelineNav
                                previousFilm={previousFilm}
                                nextFilm={nextFilm}
                                nextSelectorPlaceholder={nextSelectorPlaceholder}
                                sincePreviousGap={sincePreviousGap}
                                untilNextGap={untilNextGap}
                            />
                            </div>
                        </div>
                    )}
                </BaseCard>

                {selectorName && filmsBySameSelector.length > 0 && (
                    <div className="mb-12">
                        <FilmList films={filmsBySameSelector} title={`More Films Selected by ${capitalizeFirstLetter(selectorName)}`} />
                    </div>
                )}
            </div>
        </PageLayout>
    );
};

export default FilmDetailPage;