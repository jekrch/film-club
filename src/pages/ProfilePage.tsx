import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Link might be used elsewhere, keep it for now
import ReactMarkdown from 'react-markdown';
import CircularImage from '../components/common/CircularImage';
import FilmList from '../components/films/FilmList'; // Using FilmList component
import teamMembersData from '../assets/club.json';
import filmsData from '../assets/films.json';
import { Film } from '../types/film';

// Define TeamMember interface including the optional interview
interface TeamMember {
  name: string;
  title: string;
  bio: string;
  image: string;
  interview?: { question: string; answer: string }[];
}

const teamMembers: TeamMember[] = teamMembersData;
const allFilms = filmsData as unknown as Film[];

// --- Helper Component for Interview Item with Expander ---
interface InterviewItemProps {
  question: string;
  answer: string;
}

const InterviewItem: React.FC<InterviewItemProps> = ({ question, answer }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  // Determine if the answer needs an expander (e.g., based on length)
  const needsExpander = answer.length > 300; // Adjust threshold as needed

  return (
    <div className="py-5"> {/* Add padding between Q&A pairs */}
      <h4 className="text-lg font-semibold text-blue-400 mb-2">{question}</h4>
      <div className={`prose prose-sm prose-invert max-w-none text-slate-300 ${!isExpanded && needsExpander ? 'line-clamp-5' : ''}`}>
         {/* Apply line-clamp only if needed and not expanded */}
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
  // Use the updated TeamMember type
  const [member, setMember] = useState<TeamMember | null>(null);
  const [selectedFilms, setSelectedFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0); // Scroll to top on component mount/update
    setLoading(true);
    setError(null);
    setMember(null);
    setSelectedFilms([]);

    if (!memberName) {
      setError("Member name is missing in the URL.");
      setLoading(false);
      return;
    }

    // Decode the member name from the URL parameter
    const decodedMemberName = decodeURIComponent(memberName);
    // Ensure type compatibility when finding
    const foundMember = teamMembers.find(m => m.name === decodedMemberName);

    if (!foundMember) {
      setError(`Member "${decodedMemberName}" not found.`);
      setLoading(false);
      return;
    }

    setMember(foundMember);

    // Find films selected by this member
    const films = allFilms.filter(film =>
      film.movieClubInfo?.selector === foundMember.name
    )
    // Optional: Sort films (e.g., by watch date descending, then title)
    .sort((a, b) => {
        const dateA = a.movieClubInfo?.watchDate ? new Date(a.movieClubInfo.watchDate).getTime() : 0;
        const dateB = b.movieClubInfo?.watchDate ? new Date(b.movieClubInfo.watchDate).getTime() : 0;
        if (dateB !== dateA) return dateB - dateA; // Sort by date descending
        return a.title.localeCompare(b.title); // Then by title ascending
    });

    setSelectedFilms(films);
    setLoading(false);

  }, [memberName]); // Re-run effect if memberName changes

  // --- Loading State ---
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)] bg-slate-900"> {/* Adjust min-height if needed */}
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
    // Overall container matching other pages
    <div className="bg-slate-900 text-slate-300 min-h-screen py-12 pt-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Back button */}
        <button onClick={() => navigate(-1)} className="mb-8 inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors group">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 transition-transform group-hover:-translate-x-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
          Back
        </button>

        {/* Profile Header Section - Adjusted Layout for Better Spacing */}
        <div className="bg-slate-800 rounded-lg overflow-hidden mb-2 border border-slate-700 shadow-xl shadow-slate-950/30">
          {/* Increased space-x significantly for sm screens and up */}
          <div className="p-6 md:p-10 flex flex-col sm:flex-row items-center sm:items-start sm:space-x-16"> {/* <-- Increased space-x to 16 */}
            <CircularImage
              src={member.image}
              alt={member.name}
              size="w-32 h-32 sm:w-40 sm:h-40"
              className="flex-shrink-0 border-4 border-slate-600 mb-6 sm:mb-0" // margin-bottom only on mobile (flex-col)
            />
             {/* Text Content: Added min-width: 0 to prevent squeezing */}
            <div className="text-center sm:text-left sm:ml-10 flex-grow min-w-0"> {/* <-- Added min-w-0 */}
              <h1 className="text-3xl sm:text-4xl font-thin text-slate-100 mb-2">{member.name}</h1>
              <p className="text-lg text-blue-400/90 mb-4">{member.title}</p>
              {/* max-w-xl helps readability, should not cause the squeezing */}
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
            <div className="divide-y divide-slate-700"> {/* Add dividers */}
              {member.interview.map((item, index) => (
                <InterviewItem key={index} question={item.question} answer={item.answer} />
              ))}
            </div>
          </div>
        )}
        {/* End Interview Section */}


        {/* Selected Films Section - Using FilmList Component */}
        <div className="mb-12"> {/* Add margin below the list if needed */}
            {/* Render FilmList only if member data is loaded */}
            {member && (
                 <FilmList
                    films={selectedFilms}
                    // Pass the dynamic title including the member's name
                    title={`Films Selected by ${member.name}`}
                 />
            )}
            {/* The "No films found" message is handled inside FilmList */}
        </div>

      </div>
    </div>
  );
};

export default ProfilePage;