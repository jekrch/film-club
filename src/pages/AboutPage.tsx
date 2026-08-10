import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import CircularImage from '../components/common/CircularImage';
import { teamMembers } from '../types/team';
import { Film, filmData } from '../types/film';
import { parseWatchDate } from '../utils/filmUtils';
import PageLayout from '../components/layout/PageLayout';
//import SectionHeader from '../components/common/SectionHeader';
import AccentCard from '../components/common/AccentCard';
//import StatCard from '../components/almanac/StatCard';
import HeroBanner from '../components/common/HeroBanner';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const AboutPage: React.FC = () => {

  const { heroFilms, } = useMemo(() => {
    const watched = filmData
      .map(film => ({ film, date: parseWatchDate(film.movieClubInfo?.watchDate) }))
      .filter((entry): entry is { film: Film; date: Date } => entry.date !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const first = watched[0]?.date ?? null;

    return {
      // The collage shuffles and picks its own panels; give it the watched
      // films so the banner is made of things the club has actually seen.
      heroFilms: watched.map(({ film }) => film),
      watchedCount: watched.length,
      foundingDate: first,
      daysActive: first ? Math.floor((Date.now() - first.getTime()) / MS_PER_DAY) : null,
    };
  }, []);

  return (
    <PageLayout>
      {/* <SectionHeader title="About Our Film Club" className="text-center" /> */}

      {/* Mission — the profile page's hero treatment: a still collage washed
          behind the club's own words. */}
      <HeroBanner films={heroFilms} className="mb-4 sm:mb-6">
        {/* <p className="text-[11px] uppercase tracking-[0.25em] text-blue-300/70 font-semibold mb-4">
          Our Mission
        </p> */}
        <p className="text-base sm:text-lg font-medium text-slate-300 leading-relaxed mb-4 text-center">
          The leading unrecorded podcast on cinema.
        </p>
        <p className="text-base sm:text-lg font-light text-slate-300 leading-relaxed text-left">
          We watch movies from the criterion channel, we discuss them, we give them a score out of 9.
          Our opinions are entirely our own and do not represent the broader film industry, but perhaps
          they should be listening.
        </p>
      </HeroBanner>

      {/* <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-10">
        <StatCard
          label="Members"
          value={teamMembers.length}
          description="Critics of record."
        />
        <StatCard
          label="Films Watched"
          value={watchedCount}
          description="Discussed and scored."
        />
        <StatCard
          label="Founded"
          value={foundingDate
            ? foundingDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
            : '—'}
          description={daysActive !== null ? `Active ${daysActive.toLocaleString()} days.` : undefined}
        />
      </div> */}

      <div className="mb-8 sm:mb-10">
        <h2 className="text-xl sm:text-2xl font-semibold text-center mb-6 text-slate-100">
          Committee
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {teamMembers.map((member) => (
            <Link
              key={member.name}
              // Use encodeURIComponent for names with spaces/special chars
              to={`/profile/${encodeURIComponent(member.name)}`}
              className="group block h-full"
            >
              {/* No rail: one card per member, repeating in a grid */}
              <AccentCard
                rail={false}
                className="h-full"
                contentClassName="flex h-full flex-col items-center p-5 text-center"
              >
                <CircularImage
                  alt={member.name}
                  size="w-24 h-24 sm:w-28 sm:h-28"
                  className="border-2 border-slate-600"
                />
                <h3 className="mt-4 text-lg font-semibold text-slate-200 transition-colors group-hover:text-blue-400">
                  {member.name}
                </h3>
                <p className="mt-1.5 text-[11px] uppercase tracking-[0.15em] text-blue-300/70 font-medium">
                  {member.title}
                </p>
                <p className="mt-3 text-sm text-slate-400 leading-relaxed line-clamp-3">
                  {member.bio}
                </p>
              </AccentCard>
            </Link>
          ))}
        </div>
      </div>

      {/* Attribution is a qualifier on the data, so it takes the amber accent. */}
      <AccentCard accent="amber" className="p-6 md:p-8">
        <h2 className="text-xl font-bold text-slate-100 mb-5 border-b border-slate-700/60 pb-3">
          Data &amp; Attribution
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <a
            href="https://www.themoviedb.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0"
            aria-label="The Movie Database (TMDB)"
          >
            <img
              src="/tmdb-logo.svg"
              alt="The Movie Database (TMDB) logo"
              className="h-14 w-auto opacity-90 transition-opacity hover:opacity-100"
            />
          </a>
          <div className="text-slate-400 text-sm leading-relaxed space-y-2 max-w-3xl">
            <p>
              Cast, crew, and biographical details on this site are sourced from{' '}
              <a
                href="https://www.themoviedb.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition"
              >
                The Movie Database (TMDB)
              </a>
              , with additional film data from{' '}
              <a
                href="https://www.omdbapi.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition"
              >
                OMDb
              </a>
              . We're grateful to these communities for making their data available.
            </p>
            <p className="text-slate-500">
              This product uses the TMDB API but is not endorsed or certified by TMDB.
            </p>
          </div>
        </div>
      </AccentCard>
    </PageLayout>
  );
};

export default AboutPage;
