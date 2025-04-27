import React, { useState, useEffect } from 'react'; // Import React
import { Link } from 'react-router-dom';
import FilmList from '../components/films/FilmList';
import { Film } from '../types/film';
import { TeamMember, teamMembers as teamMembersData } from '../types/team';
import filmsData from '../assets/films.json';
import { calculateClubAverage } from '../utils/ratingUtils';
import CircularImage from '../components/common/CircularImage';
import { ArrowRightIcon } from '@heroicons/react/24/outline'; // Import needed for the arrow

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

    // --- START OF CORRECTED SELECTOR LOGIC ---

    // Calculate Cycle Info (Active Members)
    const sortedActiveMembers = teamMembers
        .filter(member => typeof member.queue === 'number' && member.queue > 0)
        .sort((a, b) => (a.queue ?? Infinity) - (b.queue ?? Infinity));
    setActiveCycleMembersList(sortedActiveMembers); // Set this early, needed for fallback

    let determinedSelectorName: string | null = null; // Use a temporary variable

    // Try to find the film without a watch date (the 'up next' film)
    const upNextFilm = allFilms.find(film => !film?.movieClubInfo?.watchDate);

    console.log("Up Next Film:", upNextFilm); // Debugging line
    // Primary Logic: Use the selector from the 'up next' film if valid
    if (upNextFilm?.movieClubInfo?.selector) {
        const potentialSelector = upNextFilm.movieClubInfo.selector;
        // Validate if this selector is actually in the active cycle
        if (sortedActiveMembers.some(m => m.name === potentialSelector)) {
            determinedSelectorName = potentialSelector;
        } else {
             console.warn(`Selector "${potentialSelector}" for upcoming film found in data but not in active team member cycle. Checking fallback.`);
             // determinedSelectorName remains null, fallback will be checked
        }
    }

    // Fallback Logic: If no 'up next' film found OR its selector isn't valid/active
    if (!determinedSelectorName && sortedActiveMembers.length > 0) {
        console.log("Executing fallback logic: No upcoming film found or selector invalid/inactive.");
        // Find all films that *have* been watched
        const watchedFilms = allFilms
            .filter(film => film.movieClubInfo?.watchDate)
            .sort((a, b) => (parseWatchDate(b.movieClubInfo?.watchDate)?.getTime() ?? 0) - (parseWatchDate(a.movieClubInfo?.watchDate)?.getTime() ?? 0)); // Sort descending by date

        if (watchedFilms.length > 0) {
            // Get the most recently watched film
            const mostRecentFilm = watchedFilms[0];
            const lastSelectorName = mostRecentFilm.movieClubInfo?.selector;

            if (lastSelectorName) {
                // Find the index of the last selector in the *active* cycle
                const lastSelectorIndex = sortedActiveMembers.findIndex(m => m.name === lastSelectorName);

                if (lastSelectorIndex !== -1) {
                    // Found the last selector in the active cycle, determine the next one
                    const nextSelectorIndex = (lastSelectorIndex + 1) % sortedActiveMembers.length; // Wrap around using modulo
                    determinedSelectorName = sortedActiveMembers[nextSelectorIndex].name;
                    console.log(`Fallback: Setting next selector based on cycle after ${lastSelectorName}: ${determinedSelectorName}`);
                } else {
                    // Edge Case: Last selector from film data isn't in the current active cycle. Default to the first person.
                    console.warn(`Fallback Warning: Selector "${lastSelectorName}" from most recent film not found in active cycle. Defaulting to the start of the cycle (${sortedActiveMembers[0]?.name}).`);
                    determinedSelectorName = sortedActiveMembers[0].name; // Default to first active member
                }
            } else {
                 // Edge Case: Most recent film exists but has no selector defined. Data issue. Default to first active member.
                 console.warn(`Fallback Warning: Most recent watched film has no selector defined. Defaulting to the start of the cycle (${sortedActiveMembers[0]?.name}).`);
                 determinedSelectorName = sortedActiveMembers[0].name; // Default to first active member
            }
        } else {
            // Edge Case: No films have been watched yet *at all*. Default to the first person in the cycle.
            console.warn(`Fallback Warning: No films with watch dates found. Defaulting selector to the start of the cycle (${sortedActiveMembers[0]?.name}).`);
            determinedSelectorName = sortedActiveMembers[0]?.name; // Default to first active member (add optional chaining just in case)
        }
    } else if (!determinedSelectorName && sortedActiveMembers.length === 0) {
         // Edge case: No active members defined in the cycle
         console.warn("No active members found in the cycle. Cannot determine selector.");
         determinedSelectorName = null;
    }

    // Set the final determined selector name to state
    setCurrentSelectorName(determinedSelectorName);

    // --- END OF CORRECTED SELECTOR LOGIC ---


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
      return ratings && Object.values(ratings).filter(rating => rating && rating !== null).length >= 2;
    })
    .sort((a, b) => {
      const avgA = parseFloat(calculateClubAverage(a.movieClubInfo?.clubRatings)?.toString() ?? '0');
      const avgB = parseFloat(calculateClubAverage(b.movieClubInfo?.clubRatings)?.toString() ?? '0');
      return avgB - avgA;
    }).slice(0, 6);
  setTopClubRatedFilms(topRated);

    // Process Film Lists (Recent Picks - based *only* on watched films)
    // Sort watched films descending by date
    let watchedFilmsSorted = [...allFilms]
       .filter(film => film.movieClubInfo?.watchDate)
       .sort((a, b) => (parseWatchDate(b.movieClubInfo?.watchDate)?.getTime() ?? 0) - (parseWatchDate(a.movieClubInfo?.watchDate)?.getTime() ?? 0));

    let recentClubPicks = watchedFilmsSorted.slice(0, 5); // Get the most recent 5 films
    if (upNextFilm) {
        // If there's an 'up next' film, add it to the top of the list
        recentClubPicks = [upNextFilm, ...recentClubPicks];
    }
    // The recent picks list now only shows the most recently watched films
    setRecentClubPicks(recentClubPicks);


    // Determine Last Meeting Time (using the sorted watched films)
    if (watchedFilmsSorted.length > 0 && watchedFilmsSorted[0].movieClubInfo?.watchDate) {
        const mostRecentParsedDate = parseWatchDate(watchedFilmsSorted[0].movieClubInfo.watchDate);
        if (mostRecentParsedDate) {
             // Set meeting time to 10 PM on the day of the watch date
             const meetingDate = new Date(mostRecentParsedDate);
             // Set time in UTC if watch dates are UTC, otherwise use setHours for local time
             meetingDate.setUTCHours(22, 0, 0, 0); // Example using UTC
             // meetingDate.setHours(22, 0, 0, 0); // Alternative for local time
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
        setLastMeetingDateTime(null); // No watched films, no last meeting
    }
  }, []); // Keep dependency array empty to run only on mount

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
    updateTimer(); // Run immediately
    const intervalId = setInterval(updateTimer, 1000); // Update every second
    return () => clearInterval(intervalId); // Cleanup interval on unmount
  }, [lastMeetingDateTime]); // Rerun effect if lastMeetingDateTime changes


  // --- Render Logic ---
  // ***** JSX restored to include the small-screen arrow *****
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 -mt-6 bg-[#202125]x">
      {/* Hero section */}
      <div className="py-10 md:py-16 bg-gradient-to-r from-slate-700 to-gray-900 rounded-lg my-8 text-center px-4 sm:px-6 lg:px-10">

        {/* --- Display Cycle Order with Profile Pics and Responsive Arrows --- */}
        {activeCycleMembersList.length > 0 && (
           <div className="mb-6">
             <p className="text-xs uppercase tracking-widest text-slate-300 font-semibold mb-4">
               Selection Committee
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
                                {/* --- SMALL SCREEN ARROW RESTORED --- */}
                                {/* Show this arrow only on small screens (hidden on sm breakpoint and up) AND if it's NOT the last item */}
                                
                                    <ArrowRightIcon className="sm:hidden inline-block w-3 h-3 mx-1 text-slate-500 flex-shrink-0 self-center mb-1" /> 
                                {/* Note: The original code paste had this commented out. This version assumes it should be VISIBLE as per your correction. */}


                                {/* Image container (handles active border/glow) */}
                                <div className={`relative rounded-full p-0.5 ${isActive ? 'bg-gradient-to-tr from-emerald-700 via-emerald-600 to-emerald-600 shadow-lg' : ''}`}>
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
        {false && totalRuntimeString && (
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