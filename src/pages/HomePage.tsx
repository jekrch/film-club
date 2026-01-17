import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import FilmList from '../components/films/FilmList';
import { Film, filmData } from '../types/film';
import { TeamMember, teamMembers as teamMembersData } from '../types/team';
import { calculateClubAverage } from '../utils/ratingUtils';
import CircularImage from '../components/common/CircularImage';
import SelectionCommitteeBackground from '../components/common/SelectionCommitteeBackground';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { parseWatchDate } from '../utils/filmUtils';
import { identifyCurrentSelector } from '../utils/teamUtils';
import PageLayout from '../components/layout/PageLayout';

// --- Helper function to format total minutes ---
const formatTotalMinutes = (totalMinutes: number): string => {
    if (isNaN(totalMinutes) || totalMinutes < 0) { return "0 days : 00 hrs : 00 m"; }
    const minutesPerDay = 1440; const minutesPerHour = 60;
    const days = Math.floor(totalMinutes / minutesPerDay);
    const remainingMinutesAfterDays = totalMinutes % minutesPerDay;
    const hours = Math.floor(remainingMinutesAfterDays / minutesPerHour);
    const minutes = remainingMinutesAfterDays % minutesPerHour;
    const pad = (num: number) => String(num).padStart(2, '0');
    const dayLabel = days === 1 ? 'day' : 'days';
    return `${days} ${dayLabel} : ${pad(hours)} hrs : ${pad(minutes)} m`;
};

// --- Array of Brown Gradients for Inactive Stripes ---
const inactiveStripeGradients = [
    'bg-gradient-to-t from-amber-900 via-orange-700 to-yellow-600',
    'bg-gradient-to-t from-yellow-900 via-amber-700 to-orange-800',
    'bg-gradient-to-t from-orange-900 via-yellow-700 to-amber-600',
];


// --- HomePage Component ---
const HomePage = () => {
  const [topClubRatedFilms, setTopClubRatedFilms] = useState<Film[]>([]);
  const [recentClubPicks, setRecentClubPicks] = useState<Film[]>([]);
  const [lastMeetingDateTime, setLastMeetingDateTime] = useState<Date | null>(null);
  const [timeSinceLastMeeting, setTimeSinceLastMeeting] = useState<string>('');
  const [totalRuntimeString, setTotalRuntimeString] = useState<string>('');
  const [currentSelectorName, setCurrentSelectorName] = useState<string | null>(null);
  const [activeCycleMembersList, setActiveCycleMembersList] = useState<TeamMember[]>([]);
  const [, setUpNextFilm] = useState<Film | undefined>(undefined);

  // --- Data Fetching and Processing Effect ---
  useEffect(() => {
    const allFilms = filmData;
    const teamMembers = teamMembersData as TeamMember[];

    // Calculate Cycle Info (Active Members)
    const sortedActiveMembers = teamMembers
        .filter(member => typeof member.queue === 'number' && member.queue > 0)
        .sort((a, b) => (a.queue ?? Infinity) - (b.queue ?? Infinity));
    setActiveCycleMembersList(sortedActiveMembers);

    let determinedSelectorName: string | null = null;

    // Try to find the film without a watch date (the 'up next' film)
    const foundUpNextFilm = allFilms.find(film => !film?.movieClubInfo?.watchDate);
    setUpNextFilm(foundUpNextFilm);

    determinedSelectorName = identifyCurrentSelector(
        foundUpNextFilm, sortedActiveMembers, determinedSelectorName, allFilms
    );

    setCurrentSelectorName(determinedSelectorName);

    // Calculate Total Runtime (only for watched films)
    const totalMinutes = allFilms.reduce((sum, film) => {
        if (film?.movieClubInfo?.watchDate && film?.runtime && typeof film.runtime === 'string') {
            const minutes = parseInt(film.runtime, 10);
            if (!isNaN(minutes)) return sum + minutes;
        }
        return sum;
    }, 0);
    setTotalRuntimeString(formatTotalMinutes(totalMinutes));

    // Process Film Lists (Top Rated)
    const topRated = [...allFilms]
        .filter(film => {
        const ratings = film.movieClubInfo?.clubRatings;
        return ratings && Object.values(ratings).filter(rating => rating && rating?.score !== null).length >= 2;
        })
        .sort((a, b) => {
        const avgA = parseFloat(calculateClubAverage(a.movieClubInfo?.clubRatings)?.toString() ?? '0');
        const avgB = parseFloat(calculateClubAverage(b.movieClubInfo?.clubRatings)?.toString() ?? '0');
        return avgB - avgA;
        }).slice(0, 6);
    setTopClubRatedFilms(topRated);

    // Process Film Lists (Recent Picks - based *only* on watched films)
    let watchedFilmsSorted = [...allFilms]
       .filter(film => film.movieClubInfo?.watchDate)
       .sort((a, b) => (parseWatchDate(b.movieClubInfo?.watchDate)?.getTime() ?? 0) - (parseWatchDate(a.movieClubInfo?.watchDate)?.getTime() ?? 0));

    let recentPicks = watchedFilmsSorted.slice(0, 8);
    if (foundUpNextFilm) {
        recentPicks = [foundUpNextFilm, ...recentPicks];
    }
    setRecentClubPicks(recentPicks);

    // Determine Last Meeting Time
    if (watchedFilmsSorted.length > 0 && watchedFilmsSorted[0].movieClubInfo?.watchDate) {
        const mostRecentParsedDate = parseWatchDate(watchedFilmsSorted[0].movieClubInfo.watchDate);
        if (mostRecentParsedDate) {
             const meetingDate = new Date(mostRecentParsedDate);
             meetingDate.setUTCHours(22, 0, 0, 0);
             if (!isNaN(meetingDate.getTime())) {
                  setLastMeetingDateTime(meetingDate);
             } else {
                  console.warn("Failed to create valid date for last meeting time.");
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
    if (!lastMeetingDateTime) { setTimeSinceLastMeeting(''); return; }
    const updateTimer = () => {
      const now = new Date();
      const diffMs = now.getTime() - lastMeetingDateTime.getTime();
      if (diffMs < 0) {
        setTimeSinceLastMeeting("Awaiting meeting time...");
        return;
       }
      const totalSeconds = Math.floor(diffMs / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const pad = (num: number) => String(num).padStart(2, '0');
      const dayLabel = days === 1 ? 'day' : 'days';
      setTimeSinceLastMeeting(`${pad(days)} ${dayLabel} : ${pad(hours)} hrs : ${pad(minutes)} m : ${pad(seconds)} s`);
    };
    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);
    return () => clearInterval(intervalId);
  }, [lastMeetingDateTime]);


  // --- Render Logic ---
  return (
    <PageLayout className="">
      {/* Hero section */}
      <div className="relative overflow-hidden py-10 md:py-16 bg-gradient-to-r from-slate-700 to-gray-900 rounded-lg mb-8 mt-2 text-center px-4 sm:px-6 lg:px-10">

        {/* Background poster image */}
        <SelectionCommitteeBackground 
            imageUrl={"https://s3.amazonaws.com/criterion-production/janus_stills/5221-/32000id_016_0001_32000id_138_w1600.jpg"} //?? upNextFilm?.poster} 
            scale={1}
            opacity={0.35}
        />

        {/* --- Display Cycle Order with Profile Pics and Responsive Arrows --- */}
        {activeCycleMembersList.length > 0 && (
            <div className="mb-6 relative z-10">
              <p className="text-xs uppercase tracking-widest text-slate-300 font-semibold mb-4">
                Selection Committee
              </p>
              {/* Flex container for members and inline arrows */}
              <div className="flex flex-wrap justify-center items-center gap-x-2 sm:gap-x-3 gap-y-6">
                {activeCycleMembersList.map((member, index) => {
                    const isActive = member.name === currentSelectorName;
                    const isNotLast = index < activeCycleMembersList.length - 1;
                    const inactiveGradientClass = inactiveStripeGradients[index % inactiveStripeGradients.length];

                    return (
                        <React.Fragment key={member.name}>
                            {/* Link container for profile pic and name */}
                            <Link
                                to={`/profile/${encodeURIComponent(member.name)}`}
                                className={`
                                group text-center flex flex-col items-center transition-all duration-200 ease-in-out relative
                                ${isActive ? 'transform scale-105 z-10' : 'opacity-70 hover:opacity-100'}
                                `}
                                title={isActive ? `${member.name} (Up Next!)` : member.name}
                            >
                                {/* Small screen arrow */}
                                <ArrowRightIcon className="sm:hidden inline-block w-3 h-3 mx-1 text-slate-500 flex-shrink-0 self-center mb-1" />

                                {/* Image container */}
                                <div className={`relative rounded-full p-0.5 ${isActive ? 'bg-gradient-to-tr from-emerald-700 via-emerald-600 to-emerald-600 shadow-lg' : ''}`}>

                                    {/* ACTIVE STRIPE */}
                                    {isActive && (
                                        <div className="w-full rounded-t-full sm:w-25 h-[200vh] h-[20em] -top-[100vh]x left-1/2 -translate-x-1/2 absolute opacity-10 bg-gradient-to-t from-emerald-900 via-emerald-600 to-emerald-700 pointer-events-none"></div> 
                                    )}

                                    {/* INACTIVE STRIPE */}
                                    {!isActive && (
                                        <div className={`w-full rounded-t-full sm:w-25 h-[30em] h-min-full -top-[100vh]x left-1/2 -translate-x-1/2 absolute opacity-10 ${inactiveGradientClass} pointer-events-none`}></div>
                                    )}

                                    <CircularImage
                                        alt={member.name}
                                        size="w-14 h-14 sm:w-16 sm:h-16"
                                        className={`transition-all duration-200 ease-in-out border-2 ${isActive ? 'border-slate-700' : 'border-slate-600 group-hover:border-slate-400'}`}
                                    />
                                    {/* Static Active Indicator */}
                                    {isActive && (
                                        <span className="absolute -top-0.5 -right-0.5 block h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-slate-800 ring-1 ring-slate-900"></span>
                                    )}
                                </div>
                                {/* Member Name */}
                                <span className={`block text-xs mt-1.5 font-medium transition-colors duration-200 ${isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                    {member.name}
                                </span>
                            </Link>

                            {/* Inline Arrow Separator */}
                            {isNotLast && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-1 text-slate-500 flex-shrink-0 hidden sm:inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            )}
                        </React.Fragment>
                    );
                })}
              </div>
            </div>
        )}
        {/* --- End Display Cycle Order --- */}

        {/* --- Display Total Runtime --- */}
        {false && totalRuntimeString && (
           <div className={`max-w-md mx-auto relative z-10 ${activeCycleMembersList.length > 0 ? 'border-t border-slate-600 pt-4 mt-6' : 'pt-0 mt-0'}`}>
             <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">Total Film Runtime Watched</p>
             <p className="font-mono text-slate-300 tracking-tight text-sm">{totalRuntimeString}</p>
           </div>
        )}
        {/* --- End Display Total Runtime --- */}

        {/* --- Display the timer --- */}
        {timeSinceLastMeeting && (
           <div className={`pt-4 max-w-md mx-auto relative z-10 ${(totalRuntimeString || activeCycleMembersList.length > 0) ? 'mt-4 border-t border-slate-600' : 'mt-6 pt-6 border-t border-slate-600'}`}>
             <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">Time Since Last Meeting</p>
             <p className="font-mono text-slate-300 tracking-tight text-sm">{timeSinceLastMeeting}</p>
           </div>
        )}
        {/* --- End Display Timer --- */}

      </div> {/* End Hero Section Div */}

      {/* Film Lists Section */}
      {recentClubPicks.length > 0 && <FilmList films={recentClubPicks} title="Recent Club Picks" appendAllFilmsCard={true}/>}
      {topClubRatedFilms.length > 0 && <FilmList films={topClubRatedFilms} title="Top Club Rated Films" />}
      {/* End Film Lists Section */}

    </PageLayout> 
  );
};

export default HomePage;