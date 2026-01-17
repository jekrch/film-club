import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ChevronLeftIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

import CircularImage from '../components/common/CircularImage';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorDisplay from '../components/common/ErrorDisplay';
import FilmList from '../components/films/FilmList';
import InterviewItem from '../components/profile/InterviewItem';
import ProfileStatsSection from '../components/profile/ProfileStatsSection';
import ControversialFilmItem from '../components/profile/ControversialFilmItem';
import PageLayout from '../components/layout/PageLayout';
import ProfileBlurbItem from '../components/profile/ProfileBlurbItem';
import BaseCard from '../components/common/BaseCard';
import ProfileHeroBackground from '../components/profile/ProfileHeroBackground';

import { useProfileData } from '../hooks/useProfileData'; 

const ProfilePage: React.FC = () => {
    const { memberName } = useParams<{ memberName: string }>();
    const navigate = useNavigate();

    const {
        member,
        selectedFilms,
        topRatedFilms,
        mostControversialFilms,
        currentUserStats,
        rankings,
        reviewBlurbs,
        loading,
        error,
        isInterviewExpanded,
        toggleInterviewExpanded,
        isBlurbsSectionExpanded,
        toggleBlurbsSectionExpanded,
    } = useProfileData(memberName);

    if (loading) return <LoadingSpinner />;
    if (error || !member) {
        return <ErrorDisplay message={error || "Could not load profile details."} backPath="/about" backButtonLabel="Back to About Page" />;
    }

    // Constants for UI display, can remain in component
    const MAX_INTERVIEW_ITEMS_BEFORE_SCROLL = 2;
    const needsInterviewExpansion = member.interview && member.interview.length > MAX_INTERVIEW_ITEMS_BEFORE_SCROLL;
    const collapsedInterviewMaxHeight = 'max-h-80';
    const hasEnoughControversialFilms = mostControversialFilms.length >= 1;
    const hasStats = currentUserStats && Object.entries(currentUserStats).some(([key, val]) =>
        (val !== null && val !== 0 && (!Array.isArray(val) || val.length > 0))
        || (key === 'totalSelections' && val === 0)
    );
    const MAX_BLURBS_COLLAPSED = 3;
    const needsBlurbsSectionExpansion = reviewBlurbs.length > MAX_BLURBS_COLLAPSED;
    const displayedBlurbs = isBlurbsSectionExpanded ? reviewBlurbs : reviewBlurbs.slice(0, MAX_BLURBS_COLLAPSED);
    const MAX_RATING_DISPLAY = 9;

    return (
        <PageLayout>
            <button
                onClick={() => navigate(-1)}
                className="mb-8 inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
            >
                <ChevronLeftIcon className="h-5 w-5 mr-1 transition-transform group-hover:-translate-x-1" aria-hidden="true" />
                Back
            </button>

            <BaseCard className="bg-gradient-to-br from-slate-800 to-slate-800 rounded-lg overflow-hidden mb-8 border relative">
                {/* Film poster collage background */}
                <ProfileHeroBackground films={topRatedFilms} />
                
                <div className="relative z-30 py-12 sm:p-6 md:p-10 flex flex-col sm:flex-row items-center sm:items-start sm:space-x-10 md:space-x-16">
                    <CircularImage
                        src={member.image}
                        alt={member.name}
                        size="w-36 h-36 sm:w-40 sm:h-40 md:w-48 md:h-48"
                        className="flex-shrink-0 border-2 border-slate-600 mb-4 !sm:mb-6 sm:mb-0 shadow-lg"
                    />
                    <div className="text-center sm:text-left flex-grow min-w-0 sm:ml-8 mt-3 sm:mt-2">
                        <h1 className="text-3xl sm:text-4xl text-slate-100 mb-2 break-words font-thin">{member.name}</h1>
                        <p className="text-lg text-blue-400/90 mb-1">{member.title}</p>
                        <div className="text-slate-300 leading-relaxed mx-auto sm:mx-0 prose prose-sm prose-invert max-w-none">
                            <ReactMarkdown>{member.bio}</ReactMarkdown>
                         </div>
                          {member.url && (
                           <div className="mt-4">
                           <a className="!text-blue-400" href={member.url}>{member.url.replace('https://', '')}</a>
                           </div>
                         )}
                    </div>
                </div>
            </BaseCard>

            {member.interview && member.interview.length > 0 && (
                <div className="bg-slate-800 rounded-lg p-6 md:p-10 mb-8 border border-slate-700 shadow-xl shadow-slate-950/30">
                    <h3 className="text-2xl font-bold text-slate-100 mb-4 border-b border-slate-700 pb-3"> Interview </h3>
                    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${!isInterviewExpanded && needsInterviewExpansion ? collapsedInterviewMaxHeight : 'max-h-[1500px]'}`}>
                        <div className={`pr-2 -mr-2 ${!isInterviewExpanded && needsInterviewExpansion ? 'overflow-y-auto ' + collapsedInterviewMaxHeight : ''}`}>
                            <div className="divide-y divide-slate-700 -mt-4">
                                {member.interview.map((item, index) => <InterviewItem key={index} question={item.question} answer={item.answer} />)}
                            </div>
                        </div>
                    </div>
                    {needsInterviewExpansion && (
                        <div className="mt-4 text-center border-t border-slate-700 pt-4">
                            <button
                                onClick={toggleInterviewExpanded} // Use handler from hook
                                className="text-blue-400 hover:text-blue-300 text-sm font-medium inline-flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 rounded"
                                aria-expanded={isInterviewExpanded}
                            >
                                {isInterviewExpanded ? (<> Show Less <ChevronUpIcon className="h-4 w-4 ml-1" aria-hidden="true" /> </>) : (<> Show Full Interview <ChevronDownIcon className="h-4 w-4 ml-1" aria-hidden="true" /> </>)}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {(hasStats || hasEnoughControversialFilms) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                    <div className={`lg:col-span-2 ${!hasStats ? 'hidden lg:block' : ''}`}>
                        {hasStats ? (
                            <ProfileStatsSection stats={currentUserStats} rankings={rankings} />
                        ) : (
                            <div className="hidden lg:block lg:col-span-2"></div> /* Placeholder for grid */
                        )}
                    </div>
                    {hasEnoughControversialFilms && (
                        <div className="lg:col-span-1">
                            <BaseCard className="p-6 bg-slate-700 h-full">
                                <h4 className="text-lg font-semibold text-slate-200 mb-3 pb-2 border-b border-slate-600/50">
                                    Most Divergent Scores
                                </h4>
                                <div className="space-y-3">
                                    {mostControversialFilms.map((film) => (
                                        <ControversialFilmItem key={film.filmId} film={film} />
                                    ))}
                                </div>
                                <p className="text-xs text-slate-500 mt-4 text-center italic">
                                    Films where {member.name} had the largest score difference (magnitude) from the club average.
                                </p>
                            </BaseCard>
                        </div>
                    )}
                     {!hasEnoughControversialFilms && hasStats && ( /* Ensure grid consistency if only stats shown */
                        <div className="lg:col-span-1 hidden lg:block"></div>
                    )}
                </div>
            )}


            {reviewBlurbs.length > 0 && (
                <BaseCard className="bg-slate-800 rounded-lg p-6 md:p-10 mb-8 border border-slate-700 shadow-xl shadow-slate-950/30">
                    <h4 className="text-xl font-bold text-slate-100 mb-6 border-b border-slate-700 pb-3">In Their Own Words</h4>
                    <div className="space-y-5">
                        {displayedBlurbs.map((blurbItem) => (
                            <div key={blurbItem.filmId} className="pt-5 border-t border-slate-700/50 first:pt-0 first:border-t-0">
                                <ProfileBlurbItem blurbItem={blurbItem} maxRating={MAX_RATING_DISPLAY} />
                            </div>
                        ))}
                    </div>
                    {needsBlurbsSectionExpansion && (
                        <div className="mt-6 text-center border-t border-slate-700 pt-4">
                            <button
                                onClick={toggleBlurbsSectionExpanded} // Use handler from hook
                                className="text-blue-400 hover:text-blue-300 text-sm font-medium inline-flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 rounded"
                                aria-expanded={isBlurbsSectionExpanded}
                            >
                                {isBlurbsSectionExpanded ? (<> Show Fewer Reviews <ChevronUpIcon className="h-4 w-4 ml-1" /> </>) : (<> Show More Reviews <ChevronDownIcon className="h-4 w-4 ml-1" /> </>)}
                            </button>
                        </div>
                    )}
                </BaseCard>
            )}

            {topRatedFilms.length > 0 && (
                <div className="mb-12 mt-8">
                    <FilmList
                        films={topRatedFilms}
                        title={`Top ${topRatedFilms.length} Rated Film${topRatedFilms.length !== 1 ? 's' : ''} by ${member.name}`}
                    />
                </div>
            )}

            {selectedFilms.length > 0 ? (
                <div className="mb-12 mt-8">
                    <FilmList
                        films={selectedFilms}
                        title={`Films Selected by ${member.name}`}
                    />
                </div>
            ) : (
                (!currentUserStats || currentUserStats.totalSelections === null || currentUserStats.totalSelections < 0) && (
                    <div className="text-center py-8 text-slate-400 italic mt-8">
                        {member.name} hasn't selected any films yet.
                    </div>
                )
            )}
        </PageLayout>
    );
};

export default ProfilePage;