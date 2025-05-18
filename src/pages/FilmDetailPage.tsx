import { useParams, useNavigate, Link } from 'react-router-dom';
import { calculateClubAverage } from '../utils/ratingUtils';
import FilmList from '../components/films/FilmList';
import CircularImage from '../components/common/CircularImage';
import PopcornRating from '../components/common/PopcornRating';
import CreditsModal from '../components/common/CreditsModal';
import { countValidRatings, formatRuntime, getImdbRatingDisplay, parseGenres } from '../utils/filmUtils';
import PageLayout from '../components/layout/PageLayout';
import BaseCard from '../components/common/BaseCard';
import CollapsibleContent from '../components/common/CollapsableContent';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorDisplay from '../components/common/ErrorDisplay';  
import { useFilmDetails } from '../hooks/useFilmDetails'; 

const FilmDetailPage = () => {
    const { imdbId } = useParams<{ imdbId: string }>();
    const navigate = useNavigate();

    const {
        film,
        loading,
        error,
        filmsBySameSelector,
        watchUrl,
        linkCheckStatus,
        creditsModalState,
        handleCreditPersonClick,
        closeCreditsModal,
        personAllFilmographies,
    } = useFilmDetails(imdbId);


    // UI Helper function (can remain in component or be moved to utils if more broadly used)
    const renderClickableCreditNames = (namesString: string | undefined) => {
        if (!film || !namesString || typeof namesString !== 'string' || namesString.toLowerCase() === 'n/a' || namesString.trim() === '') {
            return <>{namesString || 'N/A'}</>;
        }
        const individualNames = namesString.split(',').map(name => name.trim()).filter(name => name !== '');

        return (
            <>
                {individualNames.map((name, index) => {
                    const allCreditsForPerson = personAllFilmographies[name] || [];
                    const isClickable = allCreditsForPerson.length > 1;

                    return (
                        <span key={`${name}-${index}`}>
                            {isClickable ? (
                                <a
                                    onClick={() => handleCreditPersonClick(name, allCreditsForPerson)}
                                    // Updated className for better Tailwind JIT compatibility & explicit styling
                                    className="text-blue-400 hover:text-blue-300 underline cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400/50 rounded-sm py-px px-0.5 transition-colors"
                                >
                                    {name}
                                </a>
                            ) : (
                                name
                            )}
                            {index < individualNames.length - 1 && ', '}
                        </span>
                    );
                })}
            </>
        );
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
    const imdbRatingDisplay = getImdbRatingDisplay(film.imdbRating);
    const selectorName = film.movieClubInfo?.selector;
    const capitalizeFirstLetter = (str: string): string => str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
    const MAX_RATING = 9;
    const canWatch = linkCheckStatus === 'valid' && !!watchUrl;

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

                        <div className="p-6 md:p-8 flex-grow">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3">
                                <h1 className="text-3xl lg:text-4xl font-bold text-slate-100 mb-1 sm:mb-0 pr-4">{film.title}</h1>
                                <span className="text-xl font-semibold text-slate-400 flex-shrink-0">({film.year})</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400 mb-5">
                                {clubAverageDisplay && (
                                    <div className="flex items-center font-medium text-base" title={`Average Club Rating (${numberOfValidRatings} ratings)`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
                                        <span className="text-slate-200">{clubAverageDisplay}</span><span className="ml-1 text-slate-500">/ {MAX_RATING}</span> <span className="ml-1 text-xs">(Club Avg)</span>
                                    </div>
                                )}
                                {runtimeDisplay && <span className={clubAverageDisplay ? "border-l border-slate-600 pl-4" : ""}>{runtimeDisplay}</span>}
                                {film.rated !== 'N/A' && <span className={(clubAverageDisplay || runtimeDisplay) ? "border-l border-slate-600 pl-4" : ""}>{film.rated}</span>}
                                {imdbRatingDisplay && (
                                    <span className={(clubAverageDisplay || runtimeDisplay || film.rated !== 'N/A') ? "border-l border-slate-600 pl-4 flex items-center text-xs text-slate-500" : "flex items-center text-xs text-slate-500"} title="IMDb Rating">
                                        IMDb: {imdbRatingDisplay}/10
                                    </span>
                                )}
                            </div>
                            <div className="mb-5 text-slate-300 ">
                                <CollapsibleContent buttonSize="sm" lineClamp={3}>
                                    {film.plot || <span className="italic text-slate-500">Plot not available.</span>}
                                </CollapsibleContent>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm mb-6">
                                {film.director && film.director.toLowerCase() !== 'n/a' && (
                                    <div><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Director</h3><p className="text-slate-300 leading-relaxed">{renderClickableCreditNames(film.director)}</p></div>
                                )}
                                {film.writer && film.writer.toLowerCase() !== 'n/a' && (
                                    <div><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Writer</h3><p className="text-slate-300 leading-relaxed">{renderClickableCreditNames(film.writer)}</p></div>
                                )}
                                {film.cinematographer && film.cinematographer.toLowerCase() !== 'n/a' && (
                                     <div><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Cinematography</h3><p className="text-slate-300 leading-relaxed">{renderClickableCreditNames(film.cinematographer)}</p></div>
                                )}
                                {film.editor && film.editor.toLowerCase() !== 'n/a' && (
                                     <div><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Editor</h3><p className="text-slate-300 leading-relaxed">{renderClickableCreditNames(film.editor)}</p></div>
                                )}
                                {film.productionDesigner && film.productionDesigner.toLowerCase() !== 'n/a' && (
                                     <div><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Production Design</h3><p className="text-slate-300 leading-relaxed">{renderClickableCreditNames(film.productionDesigner)}</p></div>
                                )}
                                {film.musicComposer && film.musicComposer.toLowerCase() !== 'n/a' && (
                                     <div><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Music By</h3><p className="text-slate-300 leading-relaxed">{renderClickableCreditNames(film.musicComposer)}</p></div>
                                )}
                                {film.costumeDesigner && film.costumeDesigner.toLowerCase() !== 'n/a' && (
                                     <div><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Costume Design</h3><p className="text-slate-300 leading-relaxed">{renderClickableCreditNames(film.costumeDesigner)}</p></div>
                                )}
                                {film.actors && film.actors.toLowerCase() !== 'n/a' && (
                                    <div className="md:col-span-2"><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Stars</h3><p className="text-slate-300 leading-relaxed">{renderClickableCreditNames(film.actors)}</p></div>
                                )}
                                {film.language && film.language.toLowerCase() !== 'n/a' && (
                                    <div><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Language</h3><p className="text-slate-300">{film.language}</p></div>
                                )}
                                {film.country && film.country.toLowerCase() !== 'n/a' && (
                                    <div><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Country</h3><p className="text-slate-300">{film.country}</p></div>
                                )}
                            </div>

                            {filmGenres.length > 0 && (
                                <div className="mt-5">
                                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Genres</h2>
                                    <div className="flex flex-wrap gap-2">
                                        {filmGenres.map((genre) => (
                                            <span key={genre} className="px-3 py-1 bg-slate-700 text-blue-300 text-xs font-medium rounded-full">{genre}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {film.movieClubInfo && (
                        <div className="bg-slate-850/70 border-t-2 border-slate-700 p-6 md:p-8">
                            <h2 className="text-2xl font-semibold text-slate-100 mb-6">Film Club Facts</h2>
                            <div className="md:flex md:justify-between md:items-start">
                                <div className="flex-1 mb-6 md:mb-0 md:pr-6">
                                    {film.movieClubInfo.watchDate && (
                                        <div className="mb-6">
                                            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block mb-1">Watch Date</span>
                                            <span className="text-slate-200 text-lg">{film.movieClubInfo.watchDate}</span>
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
                                                                <div className="bg-[radial-gradient(circle_at_center,_#2b384e_0%,_#1e293b_40%)] px-3 pb-4 pt-4 rounded-lg ml-2 relative border-l-2 border-emerald-400/40 shadow-inner mt-4">
                                                                    <svg className="absolute text-emerald-400/40 h-5 w-5 -top-1 left-2" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-10zm-14 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" /></svg>
                                                                    <CollapsibleContent buttonSize="sm" lineClamp={3}>
                                                                        {rating.blurb}
                                                                    </CollapsibleContent>
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
                            {(film.movieClubInfo.trophyInfo || film.movieClubInfo.trophyNotes) && (
                                <div className="mt-8 pt-6 border-t border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                    {film.movieClubInfo.trophyNotes && (<div> <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Trophy gallery</h3> <p className="text-slate-300 whitespace-pre-line">{film.movieClubInfo.trophyNotes}</p> </div>)}
                                </div>
                            )}
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