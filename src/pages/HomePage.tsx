import React, { useState, useEffect } from 'react'; // Import React
import { Link } from 'react-router-dom';
import FilmList from '../components/films/FilmList';
import { Film } from '../types/film';
import { TeamMember, teamMembers as teamMembersData } from '../types/team';
import filmsData from '../assets/films.json';
import { calculateClubAverage } from '../utils/ratingUtils';
import CircularImage from '../components/common/CircularImage';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

// --- Helper function for robust date parsing ---
const parseWatchDate = (dateString: string | null | undefined): Date | null => {
    if (!dateString) return null;
    const parts = dateString.trim().split('/');
    if (parts.length !== 3) { console.warn(`Invalid date format: ${dateString}`); return null; }
    const [monthStr, dayStr, yearStr] = parts;
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    let year = parseInt(yearStr, 10);
    if (isNaN(month) || isNaN(day) || isNaN(year)) { console.warn(`Invalid date parts: ${dateString}`); return null; }
    if (month < 1 || month > 12 || day < 1 || day > 31) { console.warn(`Invalid month/day: ${dateString}`); return null; }
    if (yearStr.length <= 2 && year >= 0 && year < 100) { year += 2000; }
    if (year < 2000) { console.warn(`Year before 2000: ${dateString}`); return null; }
    try {
        const dateObj = new Date(Date.UTC(year, month - 1, day));
        if (dateObj.getUTCFullYear() === year && dateObj.getUTCMonth() === month - 1 && dateObj.getUTCDate() === day) {
            return dateObj;
        } else {
            console.warn(`Invalid date construction from parts: ${dateString}`); return null;
        }
    } catch (e) { console.error(`Error creating Date: ${dateString}`, e); return null; }
};

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

// --- HomePage Component ---
const HomePage = () => {
  const [topClubRatedFilms, setTopClubRatedFilms] = useState<Film[]>([]);
  const [recentClubPicks, setRecentClubPicks] = useState<Film[]>([]);
  const [lastMeetingDateTime, setLastMeetingDateTime] = useState<Date | null>(null);
  const [timeSinceLastMeeting, setTimeSinceLastMeeting] = useState<string>('');
  const [totalRuntimeString, setTotalRuntimeString] = useState<string>('');
  const [currentSelectorName, setCurrentSelectorName] = useState<string | null>(null);
  const [activeCycleMembersList, setActiveCycleMembersList] = useState<TeamMember[]>([]);

  // --- Data Fetching and Processing Effect ---
  useEffect(() => {
    const allFilms = filmsData as unknown as Film[];
    const teamMembers = teamMembersData as TeamMember[];

    // Calculate Cycle Info
    const upNextFilm = allFilms.find(film => !film?.movieClubInfo?.watchDate);
    const selectorName = upNextFilm?.movieClubInfo?.selector;
    const sortedActiveMembers = teamMembers
        .filter(member => typeof member.queue === 'number' && member.queue > 0)
        .sort((a, b) => (a.queue ?? Infinity) - (b.queue ?? Infinity));
    setActiveCycleMembersList(sortedActiveMembers);
    if (selectorName && sortedActiveMembers.some(m => m.name === selectorName)) {
        setCurrentSelectorName(selectorName);
    } else {
        setCurrentSelectorName(null);
        // Optional warning if selector in data doesn't match active members
        if (selectorName && !sortedActiveMembers.some(m => m.name === selectorName)) {
             console.warn(`Selector "${selectorName}" found in film data but not in active team member cycle.`);
        }
    }

    // Calculate Total Runtime
    const totalMinutes = allFilms.reduce((sum, film) => {
        if (film?.movieClubInfo?.watchDate && film?.runtime && typeof film.runtime === 'string') {
            const minutes = parseInt(film.runtime, 10);
            if (!isNaN(minutes)) return sum + minutes;
        }
        return sum;
    }, 0);
    setTotalRuntimeString(formatTotalMinutes(totalMinutes));

    // Process Film Lists
    const topRated = [...allFilms]
      .filter(film => film.movieClubInfo?.clubRatings)
      .sort((a, b) => {
        const avgA = parseFloat(calculateClubAverage(a.movieClubInfo?.clubRatings) ?? '0');
        const avgB = parseFloat(calculateClubAverage(b.movieClubInfo?.clubRatings) ?? '0');
        return avgB - avgA;
      }).slice(0, 6);

    let picks = [...allFilms]
       .filter(film => film.movieClubInfo?.watchDate)
       .sort((a, b) => (parseWatchDate(b.movieClubInfo?.watchDate)?.getTime() ?? 0) - (parseWatchDate(a.movieClubInfo?.watchDate)?.getTime() ?? 0));

    let recentPicks = [...picks];
    if (upNextFilm && !recentPicks.some(p => p.imdbID === upNextFilm.imdbID)) {
      recentPicks.unshift(upNextFilm);
    }
    recentPicks = recentPicks.slice(0, 5);
    setTopClubRatedFilms(topRated);
    setRecentClubPicks(recentPicks);

    // Determine Last Meeting Time
    if (picks.length > 0 && picks[0].movieClubInfo?.watchDate) {
        const mostRecentParsedDate = parseWatchDate(picks[0].movieClubInfo.watchDate);
        if (mostRecentParsedDate) {
             const meetingDate = new Date(mostRecentParsedDate);
             meetingDate.setHours(22, 0, 0, 0); // 10 PM local
             if (!isNaN(meetingDate.getTime())) setLastMeetingDateTime(meetingDate);
             else setLastMeetingDateTime(null);
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
      if (diffMs < 0) { setTimeSinceLastMeeting("Awaiting commencement..."); return; }
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 -mt-6">
      {/* Hero section */}
      <div className="py-10 md:py-16 bg-gradient-to-r from-slate-700 to-gray-900 rounded-lg my-8 text-center px-4 sm:px-6 lg:px-10">

        {/* --- Display Cycle Order with Profile Pics and Responsive Arrows --- */}
        {activeCycleMembersList.length > 0 && (
           <div className="mb-6">
             <p className="text-xs uppercase tracking-widest text-slate-300 font-semibold mb-4">
               Our Esteemed Selection Committee
             </p>
             {/* Flex container for members and inline arrows */}
             <div className="flex flex-wrap justify-center items-center gap-x-2 sm:gap-x-3 gap-y-6"> {/* Increased gap-y for curved arrows */}
                {activeCycleMembersList.map((member, index) => {
                    const isActive = member.name === currentSelectorName;
                    const isNotLast = index < activeCycleMembersList.length - 1; // Check if not the last member overall

                    return (
                        <React.Fragment key={member.name}>
                            {/* Link container for profile pic and name */}
                            <Link
                                to={`/profile/${encodeURIComponent(member.name)}`}
                                className={`
                                group text-center flex flex-col items-center transition-all duration-200 ease-in-out relative
                                 /* Apply hover scale to ALL */
                                ${isActive ? 'transform scale-105 z-10' : 'opacity-70 hover:opacity-100'} /* Keep base scale for active, opacity for inactive */
                                `}
                                title={isActive ? `${member.name} (Up Next!)` : member.name}
                            >
                                {/* Curved Arrow (Small Screens Only, Not for Last Member) */}

                                    
                                    <ArrowRightIcon className="sm:hidden inline-block w-3 " />
 

                                {/* Image container (handles active border/glow) */}
                                <div className={`relative rounded-full p-0.5 ${isActive ? 'bg-gradient-to-tr from-emerald-500 via-emerald-400 to-teal-400 shadow-lg' : ''}`}>
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
                                <span className={`block text-xs mt-1.5 font-medium transition-colors duration-200 ${isActive ? 'text-emerald-300' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                    {member.name}
                                </span>
                            </Link>

                            {/* Inline Arrow Separator (SM Screens and Up, Not for Last Member) */}
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
        {totalRuntimeString && (
           <div className={`max-w-md mx-auto ${activeCycleMembersList.length > 0 ? 'border-t border-slate-600 pt-4 mt-6' : 'pt-0 mt-0'}`}>
             <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">Total Film Runtime Watched</p>
             <p className="font-mono text-slate-300 tracking-tight text-sm">{totalRuntimeString}</p>
           </div>
        )}
        {/* --- End Display Total Runtime --- */}

        {/* --- Display the timer --- */}
        {timeSinceLastMeeting && (
           <div className={`pt-4 max-w-md mx-auto ${(totalRuntimeString || activeCycleMembersList.length > 0) ? 'mt-4 border-t border-slate-600' : 'mt-6 pt-6 border-t border-slate-600'}`}>
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

    </div> // End Main Container Div
  );
};

export default HomePage;