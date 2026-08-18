import React from 'react';
import { Link } from 'react-router-dom';
import { Film } from '../../types/film';
import { TeamMember } from '../../types/team';
import { FilmFrame } from '../../hooks/useFilmFrames';
import { getFilmBackdrops } from '../../utils/filmUtils';
import CircularImage from '../common/CircularImage';
import HeroBanner from '../common/HeroBanner';
import SelectionCommitteeBackground from '../common/SelectionCommitteeBackground';
import { FilmFrameCredit } from '../common/filmFrames';

interface SelectionCommitteeHeroProps {
    /** Active members in selection order. */
    members: TeamMember[];
    /** Whose turn it is, or null when it can't be worked out. */
    currentSelectorName: string | null;
    /** The film that's been picked but not yet watched — the banner's art. */
    upNextFilm?: Film;
    /** Art for when there is no film up next, so the banner is never bare. */
    fallbackFilms: Film[];
    /** Pre-formatted running clock. Empty string hides the block. */
    timeSinceLastMeeting: string;
    /** Pre-formatted total, shown only when SHOW_TOTAL_RUNTIME is on. */
    totalRuntime: string;
}

/**
 * The total-runtime readout, parked rather than deleted: the figure is still
 * worth showing and the code to render it is four lines, but the banner reads
 * better with one number in it than two. Flip to show it again.
 */
const SHOW_TOTAL_RUNTIME = false;

/**
 * The committee row is wider than the prose column the other banners use — four
 * members and their separators need the room — but keeps their vertical rhythm.
 */
/**
 * No horizontal padding of its own on phones: BaseCard's `p-4` is already inset
 * from the page container's, and a third helping is 16px the committee row can't
 * spare — four portraits abreast is a near-exact fit at 390px.
 */
const CONTENT = 'mx-auto w-full max-w-3xl px-0 py-10 sm:px-6 sm:py-12 md:py-14 text-center';

/** The site's eyebrow: see the Almanac and Profile banners. */
const EYEBROW = 'text-[11px] uppercase tracking-[0.25em] font-semibold';

/**
 * The spotlight standing over each member: a dome-topped column of light falling
 * from the portrait down past the foot of the banner, and the reason the card
 * carries no fill of its own — the light has to have somewhere dark to land.
 *
 * The idle three cycle by position, so the row is lit in varying warm tungsten
 * rather than one flat wash. The selector's is emerald, the club's colour for a
 * member's own voice.
 */
const SPOTLIGHT_IDLE = [
    'bg-gradient-to-t from-amber-900 via-orange-700 to-yellow-600',
    'bg-gradient-to-t from-yellow-900 via-amber-700 to-orange-800',
    'bg-gradient-to-t from-orange-900 via-yellow-700 to-amber-600',
];
const SPOTLIGHT_ACTIVE = 'bg-gradient-to-t from-emerald-900 via-emerald-600 to-emerald-700';

/**
 * The column tracks the portrait's width below it, flaring a little past it at
 * `sm` where there's room for the light to spread.
 *
 * `-z-10` keeps it behind the portrait and off the member's name. It can't
 * escape the banner's content column, which is a stacking context
 * (`relative z-30`), so it never rises over the backdrop or falls behind it.
 */
const Spotlight: React.FC<{ active: boolean; index: number }> = ({ active, index }) => (
    <div
        aria-hidden="true"
        className={`pointer-events-none absolute left-1/2 top-0 -z-10 w-14 -translate-x-1/2 rounded-t-full opacity-10 sm:w-25 ${
            active
                ? `h-[20em] ${SPOTLIGHT_ACTIVE}`
                : `h-[30em] ${SPOTLIGHT_IDLE[index % SPOTLIGHT_IDLE.length]}`
        }`}
    />
);

/**
 * Direction of play between two members, at the height of their portraits.
 *
 * Held back until `sm`. Four portraits and their separators don't fit across a
 * phone — the chevrons and the gaps either side of them cost 66px, and there are
 * about six to spare — and a committee that wraps onto two lines reads as two
 * groups rather than as one cycle. Below that the running order is the reading
 * order, which is how it has always been on a phone.
 */
const CycleChevron: React.FC = () => (
    <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="hidden h-3.5 w-3.5 flex-shrink-0 self-start mt-[1.6rem] text-slate-600 sm:mt-[1.9rem] sm:block"
    >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
);

/**
 * A hairline that fades out at both ends rather than stopping. The banner has no
 * edges of its own for a full-width rule to align to, so a hard one reads as a
 * bar laid across the art.
 */
const SoftRule: React.FC = () => (
    <div
        aria-hidden="true"
        className="mx-auto h-px w-full max-w-[17rem] bg-gradient-to-r from-transparent via-slate-600/70 to-transparent"
    />
);

/**
 * The credit line under the art wants a frame, but only reads the film's
 * identity off it — the framing numbers belong to the backdrop itself.
 */
const creditFrame = (film: Film, image: string): FilmFrame => ({
    imdbID: film.imdbID,
    title: film.title,
    image,
    kind: 'still',
    onSite: true,
    scale: 1,
    clipX: 50,
    clipY: 50,
});

/**
 * Where the second frame comes in. The backdrop covers two thirds of the card
 * and has faded out well before that, which is fine while the card is no wider
 * than its copy — but past `xl` the page container stops growing, every further
 * pixel of viewport becomes bare card, and by the time `banner-bleed` widens it
 * again at 2xl the right half is empty.
 *
 * So the film gets a second still out there, mirrored and fading back in toward
 * the text, which is the same shape the collage makes of its two edge panels.
 * A little weaker than the chosen backdrop: that one is the pick, this one is
 * only keeping the far edge company.
 */
const SECOND_FRAME_AT = 'hidden xl:block';
const SECOND_FRAME_OPACITY = 0.28;

/**
 * Half the card each, so the two meet at the midpoint instead of crossing. Left
 * alone they are `w-2/3` apiece — four thirds of a card between them, and the
 * middle third carrying both images at once behind the copy.
 *
 * The first panel's `xl:` step has to name the same breakpoint as
 * {@link SECOND_FRAME_AT}: it only wants to give up that ground on the screens
 * where there is a second panel to take it.
 */
const FIRST_FRAME_WIDTH = 'w-2/3 xl:w-1/2';
const SECOND_FRAME_WIDTH = 'w-1/2';

/**
 * The front page's banner: who picks next, lit from above, over the backdrop of
 * whatever they picked.
 *
 * Built on {@link HeroBanner} like every other banner on the site, so the
 * surface and the credit line under the art are the same ones the About, Almanac
 * and Profile pages use. It opts out of their collage: the up-next film's own
 * backdrop is a chosen picture, and reshuffling it on every load would be the
 * point of the thing. Only when nothing is up next does the collage stand in, so
 * the banner is never bare.
 *
 * The colonnade behind it isn't drawn here — the pillars run the length of the
 * home page and simply show through, the card having no fill to hide them.
 */
const SelectionCommitteeHero: React.FC<SelectionCommitteeHeroProps> = ({
    members,
    currentSelectorName,
    upNextFilm,
    fallbackFilms,
    timeSinceLastMeeting,
    totalRuntime,
}) => {
    // Best first: the curated `backdropImage`, then the film's TMDb stills.
    const backdrops = upNextFilm ? getFilmBackdrops(upNextFilm) : [];
    const backdrop = backdrops[0] ?? upNextFilm?.poster;
    const secondFrame = backdrops[1];

    return (
        <HeroBanner
            films={fallbackFilms}
            className="mb-8"
            contentClassName={CONTENT}
            background={
                upNextFilm && backdrop ? (
                    <>
                        <SelectionCommitteeBackground
                            imageUrl={backdrop}
                            panelWidth={FIRST_FRAME_WIDTH}
                            scale={1}
                            opacity={0.35}
                        />
                        {secondFrame && (
                            <SelectionCommitteeBackground
                                className={SECOND_FRAME_AT}
                                imageUrl={secondFrame}
                                panelWidth={SECOND_FRAME_WIDTH}
                                align="right"
                                scale={1}
                                opacity={SECOND_FRAME_OPACITY}
                            />
                        )}
                        {/* Placed as the collage places its own: hard against the
                            outer edge, under the brightest part of the image. */}
                        <div className="absolute bottom-2 left-0 z-40 flex w-1/2 justify-start pl-3 sm:bottom-3 sm:pl-5">
                            <FilmFrameCredit frame={creditFrame(upNextFilm, backdrop)} />
                        </div>
                    </>
                ) : undefined
            }
        >
            {members.length > 0 && (
                <div className="mb-2">
                    <p className={`${EYEBROW} text-slate-300/90 mb-6`}>Selection Committee</p>

                    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-7 sm:gap-x-4">
                        {members.map((member, index) => {
                            const isActive = member.name === currentSelectorName;

                            return (
                                <React.Fragment key={member.name}>
                                    <Link
                                        to={`/profile/${encodeURIComponent(member.name)}`}
                                        title={isActive ? `${member.name} (Up Next!)` : member.name}
                                        className={`group relative flex flex-col items-center text-center transition-all duration-300 ease-out ${
                                            isActive
                                                ? 'z-10 scale-105'
                                                : 'opacity-60 hover:opacity-100 focus-visible:opacity-100'
                                        }`}
                                    >
                                        <Spotlight active={isActive} index={index} />

                                        <CircularImage
                                            src={member.image}
                                            alt={member.name}
                                            size="w-14 h-14 sm:w-16 sm:h-16"
                                            className={`transition-colors duration-300 ease-out border ${
                                                isActive
                                                    ? 'border-emerald-400/70 shadow-[0_0_0_4px_rgba(16,185,129,0.10)]'
                                                    : 'border-slate-600/80 group-hover:border-slate-400'
                                            }`}
                                        />

                                        <span
                                            className={`mt-2 block text-xs font-medium transition-colors duration-300 ${
                                                isActive
                                                    ? 'text-emerald-300'
                                                    : 'text-slate-300 group-hover:text-slate-100'
                                            }`}
                                        >
                                            {member.name}
                                        </span>

                                        {/* Kept in the layout for everyone so the row of
                                        portraits stays level and doesn't jump when the
                                        turn passes to the next member. */}
                                        <span
                                            className={`mt-1 block text-[9px] uppercase tracking-[0.22em] text-emerald-400/80 ${
                                                isActive ? '' : 'invisible'
                                            }`}
                                            aria-hidden={!isActive}
                                        >
                                            Up Next
                                        </span>
                                    </Link>

                                    {index < members.length - 1 && <CycleChevron />}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            )}

            {SHOW_TOTAL_RUNTIME && totalRuntime && (
                <div className="mt-7">
                    <SoftRule />
                    <p className={`${EYEBROW} text-slate-500 mt-5 mb-1.5`}>
                        Total Film Runtime Watched
                    </p>
                    <p className="font-mono text-sm tracking-tight text-slate-300">
                        {totalRuntime}
                    </p>
                </div>
            )}

            {timeSinceLastMeeting && (
                <div className="mt-7">
                    <SoftRule />
                    <p className={`${EYEBROW} text-slate-500 mt-5 mb-1.5`}>
                        Time Since Last Meeting
                    </p>
                    <p className="font-mono text-sm tracking-tight text-slate-300">
                        {timeSinceLastMeeting}
                    </p>
                </div>
            )}
        </HeroBanner>
    );
};

export default SelectionCommitteeHero;
