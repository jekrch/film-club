import { Link } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon, FilmIcon } from '@heroicons/react/24/outline';
import { Film } from '../../types/film';

interface WatchTimelineNavProps {
    previousFilm: Film | null;
    nextFilm: Film | null;
    sincePreviousGap?: string | null; // Time elapsed since the previous film was watched
    untilNextGap?: string | null;     // Time until the next film was watched
}

const formatWatchDate = (date?: string | null): string | null =>
    date
        ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

interface NavCardProps {
    film: Film;
    direction: 'prev' | 'next';
}

const NavCard = ({ film, direction }: NavCardProps) => {
    const isPrev = direction === 'prev';
    const Chevron = isPrev ? ChevronLeftIcon : ChevronRightIcon;
    const label = isPrev ? 'Previous Film' : 'Next Film';
    const watchDate = formatWatchDate(film.movieClubInfo?.watchDate);
    const selector = film.movieClubInfo?.selector;
    // Selector portraits live at /images/{name}.jpg (see CircularImage).
    const selectorImage = selector ? `/images/${selector.toLowerCase()}.jpg` : null;
    // The poster + text sit on the "near" side of the card; the selector portrait
    // washes in on the opposite, less-occupied side and fades out toward the content.
    const fadeDirection = isPrev ? 'left' : 'right';

    return (
        <Link
            to={`/films/${film.imdbID}`}
            className={`group relative overflow-hidden flex items-center gap-4 rounded-xl border border-slate-700/40 bg-slate-800/30 p-3 transition-all duration-200 hover:border-blue-500/30 hover:bg-slate-800/60 ${isPrev ? '' : 'flex-row-reverse text-right'}`}
            title={`Go to ${film.title}`}
        >
            {selectorImage && (
                <img
                    src={selectorImage}
                    alt=""
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-y-0 ${isPrev ? 'right-0' : 'left-0'} w-1/3 h-full object-cover object-center opacity-[0.32] grayscale group-hover:opacity-40 transition-opacity duration-300`}
                    style={{
                        WebkitMaskImage: `linear-gradient(to ${fadeDirection}, black, transparent)`,
                        maskImage: `linear-gradient(to ${fadeDirection}, black, transparent)`,
                    }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
            )}
            <div className="relative z-10 flex-shrink-0 w-12 h-[72px] rounded-md overflow-hidden bg-slate-800 shadow-lg shadow-black/40 ring-1 ring-slate-700/50">
                <img
                    src={film.poster}
                    alt=""
                    className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => { const target = e.target as HTMLImageElement; target.src = '/placeholder-poster.png'; target.onerror = null; }}
                />
            </div>
            <div className="relative z-10 min-w-0 flex-grow">
                <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-1 ${isPrev ? '' : 'flex-row-reverse'}`}>
                    <Chevron className={`h-3.5 w-3.5 text-blue-400/70 transition-transform duration-200 ${isPrev ? 'group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'}`} />
                    {label}
                </div>
                <h4 className="text-slate-200 font-medium truncate group-hover:text-blue-400 transition-colors">
                    {film.title}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {film.year}{watchDate ? ` · ${watchDate}` : ''}
                </p>
            </div>
        </Link>
    );
};

const WatchTimelineNav = ({ previousFilm, nextFilm, sincePreviousGap, untilNextGap }: WatchTimelineNavProps) => {
    if (!previousFilm && !nextFilm) return null;

    return (
        <div className="mt-8 pt-6 border-t border-slate-700">
            <div className="flex items-center gap-3 mb-4">
                <FilmIcon className="h-4 w-4 text-blue-400/80" />
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-[0.2em]">
                    Club Timeline
                </h3>
                <span className="h-px flex-grow bg-gradient-to-r from-blue-400/25 via-slate-700/60 to-transparent" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {previousFilm ? (
                    <div className="flex flex-col">
                        <NavCard film={previousFilm} direction="prev" />
                        {sincePreviousGap && (
                            <p className="text-[11px] text-slate-500 mt-2 px-1">
                                <span className="text-slate-400 font-medium">{sincePreviousGap}</span> since previous film
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="hidden sm:block" aria-hidden="true" />
                )}
                {nextFilm && (
                    <div className="flex flex-col">
                        <NavCard film={nextFilm} direction="next" />
                        {untilNextGap && (
                            <p className="text-[11px] text-slate-500 mt-2 px-1 text-right">
                                <span className="text-slate-400 font-medium">{untilNextGap}</span> until next film
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WatchTimelineNav;
