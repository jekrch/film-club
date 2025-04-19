import React, { useState, useEffect } from 'react';
import FilmList from '../components/films/FilmList'; 
import { Film } from '../types/film'; 
import filmsData from '../assets/films.json'; 
import { calculateClubAverage } from '../utils/ratingUtils'; 

const HomePage = () => {
  const [topClubRatedFilms, setTopClubRatedFilms] = useState<Film[]>([]); 
  const [recentClubPicks, setRecentClubPicks] = useState<Film[]>([]); 

  useEffect(() => {
    
    const allFilms = filmsData as unknown as Film[];

    // Sort for Top Club Rated Films
    const topRated = [...allFilms]
      .filter(film => film.movieClubInfo?.clubRatings) // Only consider films with club ratings object
      .sort((a, b) => {
        // Calculate averages, defaulting null to 0 for sorting
        const avgStrA = calculateClubAverage(a.movieClubInfo?.clubRatings);
        const avgStrB = calculateClubAverage(b.movieClubInfo?.clubRatings);

        const avgA = parseFloat(avgStrA ?? '0');
        const avgB = parseFloat(avgStrB ?? '0');

        // Sort descending (highest average first)
        return avgB - avgA;
      })
      .slice(0, 5); // Show top 5 highest club rated films

    // Filter and Sort for Recent Club Picks (most recent watchDate) - Remains the same
    const picks = [...allFilms]
       .filter(film => film.movieClubInfo?.watchDate)
       .sort((a, b) => {
          const dateA = a.movieClubInfo?.watchDate ? new Date(a.movieClubInfo.watchDate) : new Date(0);
          const dateB = b.movieClubInfo?.watchDate ? new Date(b.movieClubInfo.watchDate) : new Date(0);
          const timeA = !isNaN(dateA.getTime()) ? dateA.getTime() : 0;
          const timeB = !isNaN(dateB.getTime()) ? dateB.getTime() : 0;
          return timeB - timeA; // Descending order
       })
       .slice(0, 5);

    setTopClubRatedFilms(topRated);   
    setRecentClubPicks(picks);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      {/* Hero section */}
      <div className="py-12 md:py-16 bg-gradient-to-r from-slate-700 to-gray-900 rounded-lg my-8 text-center">
        <h1 className="text-4xl font-bold text-slate-200 sm:text-5xl tracking-tight">
          Criterion Club
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-xl text-slate-300">
         <i>podcast</i>: noun. a digital audio file that can be taken from the internet and played on a computer or a device that you can carry with you
        </p>
      </div>

      {/* Recent Club Picks */}
      {recentClubPicks.length > 0 && (
          <FilmList films={recentClubPicks} title="Recent Club Watches" />
      )}

      {/* Top Club Rated Films */}
      {topClubRatedFilms.length > 0 && (
          // Updated title for clarity
          <FilmList films={topClubRatedFilms} title="Top Club Rated Films" />
      )}

    </div>
  );
};

export default HomePage;