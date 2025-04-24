import { useState, useEffect } from 'react';
import FilmList from '../components/films/FilmList';
import { Film } from '../types/film';
import filmsData from '../assets/films.json';
import { calculateClubAverage } from '../utils/ratingUtils';

// --- Helper function for robust date parsing ---
const parseWatchDate = (dateString: string | null | undefined): Date | null => {
    // ... (keep existing parseWatchDate function as is) ...
    if (!dateString) return null;

    const parts = dateString.trim().split('/');
    if (parts.length !== 3) {
        console.warn(`Invalid date format encountered: ${dateString}`);
        return null; // Expect MM/DD/YY or MM/DD/YYYY
    }

    const monthStr = parts[0];
    const dayStr = parts[1];
    const yearStr = parts[2];

    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    let year = parseInt(yearStr, 10);

    // Basic validation of parsed numbers
    if (isNaN(month) || isNaN(day) || isNaN(year)) {
         console.warn(`Invalid date parts in: ${dateString}`);
         return null;
    }
     if (month < 1 || month > 12 || day < 1 || day > 31) {
         console.warn(`Invalid month or day in: ${dateString}`);
         return null; // Basic range check
     }

    // --- Explicit Year Adjustment ---
    // If the year string has 1 or 2 digits, assume it's 20xx
    if (yearStr.length <= 2 && year >= 0 && year < 100) {
        year += 2000; // Convert YY to 20YY
    }
    // --- End Year Adjustment ---

    // Ensure year is within a reasonable range (e.g., 2000+)
    if (year < 2000) {
        console.warn(`Parsed year ${year} is before 2000 for: ${dateString}`);
        return null; // Ignore dates before 2000 as requested
    }

    try {
        // Create Date object using UTC to avoid timezone offset issues during creation
        // Note: Month is 0-indexed in Date constructor
        const dateObj = new Date(Date.UTC(year, month - 1, day));

        // Final check: Does the created date match the input parts in UTC?
        if (dateObj.getUTCFullYear() === year &&
            dateObj.getUTCMonth() === month - 1 &&
            dateObj.getUTCDate() === day) {
            return dateObj; // Return the valid Date object
        } else {
            console.warn(`Date parts [${month}/${day}/${year}] resulted in invalid Date object (e.g., Feb 30th) for string: ${dateString}`);
            return null; // Invalid date construction
        }
    } catch (e) {
        console.error(`Error creating Date object for string: ${dateString}`, e);
        return null;
    }
};
// --- End Helper Function ---

// --- Helper function to format total minutes ---
const formatTotalMinutes = (totalMinutes: number): string => {
    if (isNaN(totalMinutes) || totalMinutes < 0) {
        return "0 days : 00 hrs : 00 m";
    }

    const minutesPerDay = 24 * 60;
    const minutesPerHour = 60;

    const days = Math.floor(totalMinutes / minutesPerDay);
    const remainingMinutesAfterDays = totalMinutes % minutesPerDay;
    const hours = Math.floor(remainingMinutesAfterDays / minutesPerHour);
    const minutes = remainingMinutesAfterDays % minutesPerHour;

    const pad = (num: number) => String(num).padStart(2, '0');

    // Use plural 'day'/'days' based on the value
    const dayLabel = days === 1 ? 'day' : 'days';

    return `${days} ${dayLabel} : ${pad(hours)} hrs : ${pad(minutes)} m`;
};
// --- End Helper Function ---


const HomePage = () => {
  const [topClubRatedFilms, setTopClubRatedFilms] = useState<Film[]>([]);
  const [recentClubPicks, setRecentClubPicks] = useState<Film[]>([]);
  const [lastMeetingDateTime, setLastMeetingDateTime] = useState<Date | null>(null);
  const [timeSinceLastMeeting, setTimeSinceLastMeeting] = useState<string>('');
  // --- New state for total runtime ---
  const [totalRuntimeString, setTotalRuntimeString] = useState<string>('');
  // --- End new state ---

  useEffect(() => {
    const allFilms = filmsData as unknown as Film[];

    // --- Calculate Total Runtime ---
    const totalMinutes = allFilms.reduce((sum, film) => {
        if (film?.movieClubInfo?.watchDate &&  film?.runtime && typeof film.runtime === 'string') {
            // Extract digits from the string (e.g., "77 mins" -> 77)
            const minutes = parseInt(film.runtime, 10);
            // Add to sum only if parsing was successful (result is a number)
            if (!isNaN(minutes)) {
                return sum + minutes;
            } else {
                 console.warn(`Could not parse runtime for film "${film.title || 'Unknown'}": ${film.runtime}`);
            }
        }
        return sum; // Keep the current sum if runtime is missing or invalid
    }, 0); // Start sum at 0

    // Format the total minutes and update state
    setTotalRuntimeString(formatTotalMinutes(totalMinutes));
    // --- End Calculate Total Runtime ---


    // Sort for Top Club Rated Films (remains the same)
    const topRated = [...allFilms]
      .filter(film => film.movieClubInfo?.clubRatings)
      .sort((a, b) => {
        const avgStrA = calculateClubAverage(a.movieClubInfo?.clubRatings);
        const avgStrB = calculateClubAverage(b.movieClubInfo?.clubRatings);
        const avgA = parseFloat(avgStrA ?? '0');
        const avgB = parseFloat(avgStrB ?? '0');
        return avgB - avgA;
      })
      .slice(0, 5);

    // Filter and Sort for Recent Club Picks using robust parsing
    let picks = [...allFilms]
       .filter(film => film.movieClubInfo?.watchDate)
       .sort((a, b) => {
          // Use the robust parser for sorting comparison
          const dateA = parseWatchDate(a.movieClubInfo?.watchDate);
          const dateB = parseWatchDate(b.movieClubInfo?.watchDate);

          // Handle null dates (treat them as very old)
          const timeA = dateA ? dateA.getTime() : 0;
          const timeB = dateB ? dateB.getTime() : 0;

          return timeB - timeA; // Descending order (most recent first)
       })
       .slice(0, 5);

    // if there's an upcoming film add to it to the start
    const upNextFilm = allFilms.find(film => !film?.movieClubInfo?.watchDate);

    let recentPicks = [...picks];
    if (upNextFilm) {
      recentPicks = [
        allFilms.find(film => !film?.movieClubInfo?.watchDate)!,
        ...picks
      ];
    }

    setTopClubRatedFilms(topRated);
    setRecentClubPicks(recentPicks);

    // Determine the most recent watchDate from the correctly sorted list
    if (picks.length > 0 && picks[0].movieClubInfo?.watchDate) {
        // Parse the date of the *actual* most recent pick
        const mostRecentParsedDate = parseWatchDate(picks[0].movieClubInfo.watchDate);

        if (mostRecentParsedDate) {
             // Create a new Date object based on the parsed date to set the time
             const meetingDate = new Date(mostRecentParsedDate);

            // Set the time to 10 PM (22:00).
            // WARNING: This still sets it to 10 PM in the *local timezone* of the
            // server/browser running this code. For true CT, use a timezone library.
             meetingDate.setHours(22, 0, 0, 0);

            // Check if the created date is valid before setting state
            if (!isNaN(meetingDate.getTime())) {
                setLastMeetingDateTime(meetingDate);
            } else {
                 console.error("Failed to create valid Date object for last meeting time.");
                 setLastMeetingDateTime(null);
            }
        } else {
             console.error("Could not parse the most recent watchDate:", picks[0].movieClubInfo.watchDate);
             setLastMeetingDateTime(null);
        }
    } else {
        setLastMeetingDateTime(null); // No recent picks with valid dates
    }

  }, []); // Runs once on component mount

  // Effect for the timer interval (remains the same logic as before)
  useEffect(() => {
    if (!lastMeetingDateTime) {
      setTimeSinceLastMeeting('');
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      // Ensure we compare against the correct meeting time object
      const meetingTimeEpoch = lastMeetingDateTime.getTime();
      const diffMs = now.getTime() - meetingTimeEpoch;

      if (diffMs < 0) {
        setTimeSinceLastMeeting("00 days : 00 hrs : 00 mins : 00 secs... awaiting commencement.");
        return;
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      const days = Math.floor(totalSeconds / (3600 * 24));
      const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const pad = (num: number) => String(num).padStart(2, '0');
        // Use plural 'day'/'days' for consistency with runtime format
        const dayLabel = days === 1 ? 'day' : 'days';
      setTimeSinceLastMeeting(
          `${String(days).padStart(2, '0')} ${dayLabel} : ${pad(hours)} hrs : ${pad(minutes)} m : ${pad(seconds)} s`
      );
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);
    return () => clearInterval(intervalId);

  }, [lastMeetingDateTime]); // Rerun effect if lastMeetingDateTime changes

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 -mt-6">
      {/* Hero section */}
      <div className="py-10 md:py-16 bg-gradient-to-r from-slate-700 to-gray-900 rounded-lg my-8 text-center px-10">
        {/* <span className="text-xl font-bold text-slate-200 sm:text-2xl tracking-tight">
          our film club
        </span>
        <p className="mt-4 max-w-2xl mx-auto text-md text-slate-300">
         <i>podcast</i>: noun. a digital audio file that can be taken from the internet and played on a computer or a device that you can carry with you
        </p> */}
        {/* --- Display Total Runtime --- */}
        {totalRuntimeString && (
           <div className="mt-6 border-t border-slate-600 pt-4 max-w-md mx-auto">
             <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">
               Total Film Runtime Watched
             </p>
             <p className="font-mono text-slate-300 tracking-tight text-sm">
               {totalRuntimeString}
             </p>
           </div>
        )}
        {/* --- End Display Total Runtime --- */}


        {/* Display the timer */}
        {timeSinceLastMeeting && (
           // Add top margin ONLY if total runtime is also displayed to avoid double margin
           <div className={`pt-4 max-w-md mx-auto ${totalRuntimeString ? 'mt-4 border-t border-slate-600' : 'mt-6 border-t border-slate-600'}`}>
             <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">
               Time Since Last Meeting
             </p>
             <p className="font-mono text-slate-300 tracking-tight text-sm">
               {timeSinceLastMeeting}
             </p>
           </div>
        )}
      </div>

      {/* Recent Club Picks */}
      {recentClubPicks.length > 0 && (
          <FilmList films={recentClubPicks} title="Recent Club Picks" />
      )}

      {/* Top Club Rated Films */}
      {topClubRatedFilms.length > 0 && (
          <FilmList films={topClubRatedFilms} title="Top Club Rated Films" />
      )}

    </div>
  );
};

export default HomePage;