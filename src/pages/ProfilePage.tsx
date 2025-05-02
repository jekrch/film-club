import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import CircularImage from '../components/common/CircularImage';
import FilmList from '../components/films/FilmList';
import { teamMembers } from '../types/team';
import filmsData from '../assets/films.json';
import { Film, getClubRating } from '../types/film';

// Define TeamMember interface including the optional interview
interface TeamMember {
  name: string;
  title: string;
  bio: string;
  image: string;
  queue?: number;
  color?: string;
  interview?: { question: string; answer: string }[];
}

const allFilms = filmsData as unknown as Film[];

// --- Helper Component for Interview Item with Expander ---
interface InterviewItemProps {
  question: string;
  answer: string;
}

const InterviewItem: React.FC<InterviewItemProps> = ({ question, answer }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const needsExpander = answer.length > 300; // Adjust threshold as needed

  return (
    <div className="py-5">
      <h4 className="text-lg font-semibold text-blue-400 mb-2">{question}</h4>
      <div className={`prose prose-sm prose-invert max-w-none text-slate-300 ${!isExpanded && needsExpander ? 'line-clamp-5' : ''}`}>
        <ReactMarkdown>{answer}</ReactMarkdown>
      </div>
      {needsExpander && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-400 hover:text-blue-300 text-sm font-medium mt-2"
        >
          {isExpanded ? 'Read Less' : 'Read More'}
        </button>
      )}
    </div>
  );
};
// --- End Helper Component ---


const ProfilePage: React.FC = () => {
  const { memberName } = useParams<{ memberName: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<TeamMember | null>(null);
  const [selectedFilms, setSelectedFilms] = useState<Film[]>([]);
  const [topRatedFilms, setTopRatedFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    setError(null);
    setMember(null);
    setSelectedFilms([]);
    setTopRatedFilms([]);

    if (!memberName) {
      setError("Member name is missing in the URL.");
      setLoading(false);
      return;
    }

    const decodedMemberName = decodeURIComponent(memberName);
    const foundMember = teamMembers.find(m => m.name === decodedMemberName);

    if (!foundMember) {
      setError(`Member "${decodedMemberName}" not found.`);
      setLoading(false);
      return;
    }

    setMember(foundMember);

    // --- Find films selected by this member ---
    const filmsSelected = allFilms
      .filter(film => film.movieClubInfo?.selector === foundMember.name)
      .sort((a, b) => {
        const dateA = a.movieClubInfo?.watchDate ? new Date(a.movieClubInfo.watchDate).getTime() : 0;
        const dateB = b.movieClubInfo?.watchDate ? new Date(b.movieClubInfo.watchDate).getTime() : 0;
        if (dateB !== dateA) return dateB - dateA;
        return a.title.localeCompare(b.title);
      });

    setSelectedFilms(filmsSelected);

    // --- Calculate Top 3 Rated Films by this member ---
    // With the new schema, we need to find films rated by this member
    const filmsRatedByMember = allFilms
      .filter(film => {
        // Find if there's a rating from this member
        const memberRating = film.movieClubInfo?.clubRatings.find(
          rating => rating.user.toLowerCase() === decodedMemberName.toLowerCase()
        );
        // Only include films where this member gave a numeric score
        return memberRating && typeof memberRating.score === 'number';
      })
      .sort((a, b) => {
        // Get the ratings for this member from both films
        const ratingA = getClubRating(a, decodedMemberName.toLowerCase())?.score || 0;
        const ratingB = getClubRating(b, decodedMemberName.toLowerCase())?.score || 0;
        
        // Sort descending by rating
        if (ratingB !== ratingA) {
            return ratingB - ratingA;
        }
        return a.title.localeCompare(b.title); // Sort alphabetically for ties
      })
      .slice(0, 3); // Get the top 3

    setTopRatedFilms(filmsRatedByMember);
    // --- End Calculation ---

    setLoading(false);

  }, [memberName]);

  // --- Loading State ---
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)] bg-slate-900">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
      </div>
    );
  }

  // --- Error State ---
  if (error || !member) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center bg-slate-900 text-slate-300 min-h-[calc(100vh-200px)]">
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded relative mb-6 inline-block" role="alert">
          <strong className="font-bold block sm:inline">Error: </strong>
          <span className="block sm:inline">{error || "Could not load profile details."}</span>
        </div>
        <div>
          <button onClick={() => navigate('/about')} className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium">
            Back to About Page
          </button>
        </div>
      </div>
    );
  }

  // --- Success State ---
  return (
    <div className="bg-slate-900 text-slate-300 min-h-screen py-12 pt-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Back button */}
        <button onClick={() => navigate(-1)} className="mb-8 inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors group">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 transition-transform group-hover:-translate-x-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
           Back
         </button>

        {/* Profile Header Section */}
        <div className="bg-slate-800x bg-gradient-to-br from-slate-700 to-slate-800  rounded-lg overflow-hidden mb-2 border border-slate-700 shadow-xl shadow-slate-950/30">
          <div className="p-6 md:p-10 flex flex-col sm:flex-row items-center sm:items-start sm:space-x-16">
            <CircularImage
              src={member.image}
              alt={member.name}
              size="w-52 h-52 sm:w-42 sm:h-42" // Consistent sizing class
              className="flex-shrink-0 border-2 border-slate-600 mb-6 sm:mb-0"
            />
            <div className="text-center sm:text-left sm:ml-10 flex-grow min-w-0">
              <h1 className="text-3xl sm:text-4xl font- text-slate-100 mb-2">{member.name}</h1>
              <p className="text-lg text-blue-400/90 mb-4">{member.title}</p>
              <p className="text-slate-300 leading-relaxed max-w-xl mx-auto sm:mx-0">
                {member.bio}
              </p>
            </div>
          </div>
        </div>

        {/* Interview Section */}
        {member.interview && member.interview.length > 0 && (
          <div className="bg-slate-800 rounded-lg p-6 md:p-10 mb-2 mt-8 border border-slate-700 shadow-xl shadow-slate-950/30">
            <h3 className="text-2xl font-bold text-slate-100 mb-4 border-b border-slate-700 pb-3">
              Interview
            </h3>
            <div className="divide-y divide-slate-700">
              {member.interview.map((item, index) => (
                <InterviewItem key={index} question={item.question} answer={item.answer} />
              ))}
            </div>
          </div>
        )}
        {/* End Interview Section */}


        {/* --- Top Rated Films Section --- */}
        {topRatedFilms.length > 0 && (
            <div className="mb-12 mt-8">
                <FilmList
                    films={topRatedFilms}
                    title={`Top ${topRatedFilms.length} Rated Film${topRatedFilms.length !== 1 ? 's' : ''} by ${member.name}`}
                />
            </div>
        )}
        {/* --- END NEW SECTION --- */}


        {/* Selected Films Section - Using FilmList Component */}
        <div className="mb-12 mt-8">
            <FilmList
                films={selectedFilms}
                title={`Films Selected by ${member.name}`}
            />
        </div>

      </div>
    </div>
  );
};

export default ProfilePage;