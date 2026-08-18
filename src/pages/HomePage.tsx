import { useState, useEffect } from 'react';
import FilmList from '../components/films/FilmList';
import { Film, filmData } from '../types/film';
import { TeamMember, teamMembers as teamMembersData } from '../types/team';
import { calculateClubAverage } from '../utils/ratingUtils';
import SelectionCommitteeHero from '../components/home/SelectionCommitteeHero';
import { parseWatchDate } from '../utils/filmUtils';
import { identifyCurrentSelector } from '../utils/teamUtils';
import PageLayout from '../components/layout/PageLayout';
import CorinthianPillar from '../components/layout/CorinthianPillar';
import { useMediaQuery } from '../hooks/useMediaQuery';

// --- Helper function to format total minutes ---
const formatTotalMinutes = (totalMinutes: number): string => {
    if (isNaN(totalMinutes) || totalMinutes < 0) {
        return '0 days : 00 hrs : 00 m';
    }
    const minutesPerDay = 1440;
    const minutesPerHour = 60;
    const days = Math.floor(totalMinutes / minutesPerDay);
    const remainingMinutesAfterDays = totalMinutes % minutesPerDay;
    const hours = Math.floor(remainingMinutesAfterDays / minutesPerHour);
    const minutes = remainingMinutesAfterDays % minutesPerHour;
    const pad = (num: number) => String(num).padStart(2, '0');
    const dayLabel = days === 1 ? 'day' : 'days';
    return `${days} ${dayLabel} : ${pad(hours)} hrs : ${pad(minutes)} m`;
};

// Fades the colonnade as it runs down the page: full strength behind the banner,
// dimmer below it, and only fading out over the last stretch so the pillars carry
// past the bottom section.
const PILLAR_TRAIL_MASK =
    'linear-gradient(to bottom, rgba(0,0,0,1) 0px, rgba(0,0,0,1) 280px, rgba(0,0,0,0.6) 440px, rgba(0,0,0,0.5) 90%, rgba(0,0,0,0.35) 97%, rgba(0,0,0,0) 100%)';

// One value for both sides. They used to differ because the banner behind the left
// pillar was a lighter slate than the one behind the right; it carries no fill of its
// own now, so the two stand on the same ground and read identically.
const PILLAR_OPACITY = 0.14;

// The pillars scale up with the viewport. The SVG geometry is derived from a pixel
// width, so this has to be a JS value rather than responsive classes.
const usePillarWidth = (): number => {
    const isXl = useMediaQuery('(min-width: 1280px)');
    const isLg = useMediaQuery('(min-width: 1024px)');
    return isXl ? 130 : isLg ? 100 : 75;
};

// --- HomePage Component ---
const HomePage = () => {
    const [topClubRatedFilms, setTopClubRatedFilms] = useState<Film[]>([]);
    const [recentClubPicks, setRecentClubPicks] = useState<Film[]>([]);
    const [lastMeetingDateTime, setLastMeetingDateTime] = useState<Date | null>(null);
    const [timeSinceLastMeeting, setTimeSinceLastMeeting] = useState<string>('');
    const [totalRuntimeString, setTotalRuntimeString] = useState<string>('');
    const [currentSelectorName, setCurrentSelectorName] = useState<string | null>(null);
    const [activeCycleMembersList, setActiveCycleMembersList] = useState<TeamMember[]>([]);
    const [upNextFilm, setUpNextFilm] = useState<Film | undefined>(undefined);
    const pillarWidth = usePillarWidth();

    // --- Data Fetching and Processing Effect ---
    useEffect(() => {
        const allFilms = filmData;
        const teamMembers = teamMembersData as TeamMember[];

        // Calculate Cycle Info (Active Members)
        const sortedActiveMembers = teamMembers
            .filter((member) => typeof member.queue === 'number' && member.queue > 0)
            .sort((a, b) => (a.queue ?? Infinity) - (b.queue ?? Infinity));
        setActiveCycleMembersList(sortedActiveMembers);

        let determinedSelectorName: string | null = null;

        // Try to find the film without a watch date (the 'up next' film)
        const foundUpNextFilm = allFilms.find((film) => !film?.movieClubInfo?.watchDate);
        setUpNextFilm(foundUpNextFilm);

        determinedSelectorName = identifyCurrentSelector(
            foundUpNextFilm,
            sortedActiveMembers,
            determinedSelectorName,
            allFilms
        );

        setCurrentSelectorName(determinedSelectorName);

        // Calculate Total Runtime (only for watched films)
        const totalMinutes = allFilms.reduce((sum, film) => {
            if (
                film?.movieClubInfo?.watchDate &&
                film?.runtime &&
                typeof film.runtime === 'string'
            ) {
                const minutes = parseInt(film.runtime, 10);
                if (!isNaN(minutes)) return sum + minutes;
            }
            return sum;
        }, 0);
        setTotalRuntimeString(formatTotalMinutes(totalMinutes));

        // Process Film Lists (Top Rated)
        const topRated = [...allFilms]
            .filter((film) => {
                const ratings = film.movieClubInfo?.clubRatings;
                return (
                    ratings &&
                    Object.values(ratings).filter((rating) => rating && rating?.score !== null)
                        .length >= 2
                );
            })
            .sort((a, b) => {
                const avgA = parseFloat(
                    calculateClubAverage(a.movieClubInfo?.clubRatings)?.toString() ?? '0'
                );
                const avgB = parseFloat(
                    calculateClubAverage(b.movieClubInfo?.clubRatings)?.toString() ?? '0'
                );
                return avgB - avgA;
            })
            .slice(0, 6);
        setTopClubRatedFilms(topRated);

        // Process Film Lists (Recent Picks - based *only* on watched films)
        const watchedFilmsSorted = [...allFilms]
            .filter((film) => film.movieClubInfo?.watchDate)
            .sort(
                (a, b) =>
                    (parseWatchDate(b.movieClubInfo?.watchDate)?.getTime() ?? 0) -
                    (parseWatchDate(a.movieClubInfo?.watchDate)?.getTime() ?? 0)
            );

        let recentPicks = watchedFilmsSorted.slice(0, 8);
        if (foundUpNextFilm) {
            recentPicks = [foundUpNextFilm, ...recentPicks];
        }
        setRecentClubPicks(recentPicks);

        // Determine Last Meeting Time
        if (watchedFilmsSorted.length > 0 && watchedFilmsSorted[0].movieClubInfo?.watchDate) {
            const mostRecentParsedDate = parseWatchDate(
                watchedFilmsSorted[0].movieClubInfo.watchDate
            );
            if (mostRecentParsedDate) {
                const meetingDate = new Date(mostRecentParsedDate);
                meetingDate.setUTCHours(22, 0, 0, 0);
                if (!isNaN(meetingDate.getTime())) {
                    setLastMeetingDateTime(meetingDate);
                } else {
                    console.warn('Failed to create valid date for last meeting time.');
                    setLastMeetingDateTime(null);
                }
            } else {
                setLastMeetingDateTime(null);
            }
        } else {
            setLastMeetingDateTime(null);
        }
    }, []);

    // --- Timer Update Effect ---
    useEffect(() => {
        if (!lastMeetingDateTime) {
            setTimeSinceLastMeeting('');
            return;
        }
        const updateTimer = () => {
            const now = new Date();
            const diffMs = now.getTime() - lastMeetingDateTime.getTime();
            if (diffMs < 0) {
                setTimeSinceLastMeeting('Awaiting meeting time...');
                return;
            }
            const totalSeconds = Math.floor(diffMs / 1000);
            const days = Math.floor(totalSeconds / 86400);
            const hours = Math.floor((totalSeconds % 86400) / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            const pad = (num: number) => String(num).padStart(2, '0');
            const dayLabel = days === 1 ? 'day' : 'days';
            setTimeSinceLastMeeting(
                `${pad(days)} ${dayLabel} : ${pad(hours)} hrs : ${pad(minutes)} m : ${pad(seconds)} s`
            );
        };
        updateTimer();
        const intervalId = setInterval(updateTimer, 1000);
        return () => clearInterval(intervalId);
    }, [lastMeetingDateTime]);

    // --- Render Logic ---
    return (
        <PageLayout>
            <div className="relative">
                {/* The colonnade: one continuous run of pillars down the whole page, behind
          the content. The banner carries no fill, so these show through it rather
          than stopping at its top edge and starting again below - which is what a
          second, banner-local set of pillars used to do, seam and all. */}
                <div
                    className="absolute inset-x-0 top-0 -bottom-8 -z-10 pointer-events-none"
                    style={{
                        maskImage: PILLAR_TRAIL_MASK,
                        WebkitMaskImage: PILLAR_TRAIL_MASK,
                    }}
                    aria-hidden="true"
                >
                    <CorinthianPillar
                        side="left"
                        flipped
                        width={pillarWidth}
                        opacity={PILLAR_OPACITY}
                    />
                    <CorinthianPillar
                        side="right"
                        flipped
                        width={pillarWidth}
                        opacity={PILLAR_OPACITY}
                    />
                </div>
                <SelectionCommitteeHero
                    members={activeCycleMembersList}
                    currentSelectorName={currentSelectorName}
                    upNextFilm={upNextFilm}
                    fallbackFilms={recentClubPicks}
                    timeSinceLastMeeting={timeSinceLastMeeting}
                    totalRuntime={totalRuntimeString}
                />
                {/* Film Lists Section */}
                {recentClubPicks.length > 0 && (
                    <FilmList
                        films={recentClubPicks}
                        title="Recent Club Picks"
                        appendAllFilmsCard={true}
                    />
                )}
                {topClubRatedFilms.length > 0 && (
                    <FilmList films={topClubRatedFilms} title="Top Club Rated Films" />
                )}
                {/* End Film Lists Section */}
            </div>
        </PageLayout>
    );
};

export default HomePage;
