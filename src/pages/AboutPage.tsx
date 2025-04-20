// src/pages/AboutPage.tsx
import React from 'react';
import { Link } from 'react-router-dom'; // Import Link
import CircularImage from '../components/common/CircularImage';
import teamMembersData from '../assets/club.json';

// Define TeamMember interface locally or import if defined elsewhere
interface TeamMember {
  name: string;
  title: string;
  bio: string;
  image: string;
}

const teamMembers: TeamMember[] = teamMembersData;

const AboutPage: React.FC = () => {

  return (
    // Overall container with dark background and default light text
    <div className="bg-slate-900 text-slate-300 min-h-screen py-12 pt-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Center the main content */}
        <div className="max-w-3xl mx-auto">
          {/* Main Page Title - Brighter text */}
          <h1 className="!text-3xl sm:text-4xl font-bold text-slate-100 mb-10 text-center border-b border-slate-700 pb-4">
            About Our Film Club
          </h1>

          {/* Mission Section - Dark Card */}
          <div className="bg-slate-800 rounded-lg overflow-hidden mb-12 border border-slate-700 shadow-lg shadow-slate-950/30">
            <div className="p-6 md:p-8">
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-300 mb-4">
                Our Mission
              </h2>
              <p className="text-slate-300 leading-relaxed">
              We watch movies on the criterion channel, we discuss them, we give them a score out of 9. Our opinions are entirely our own and do not represent the larger film industry, but perhaps they should be listening (?!)
              </p>
            </div>
          </div>

          {/* Team Section - Dark Card */}
          <div className="bg-slate-800 rounded-lg overflow-hidden mb-8 border border-slate-700 shadow-lg shadow-slate-950/30">
            <div className="p-6 md:p-8">
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-300 mb-6 text-center">
                Meet the Club
              </h2>
              {/* Team Member Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:gap-10">
                {teamMembers.map((member) => (
                  // Wrap member info in a Link, add 'group' class
                  <Link
                    key={member.name}
                    // Use encodeURIComponent for names with spaces/special chars
                    to={`/profile/${encodeURIComponent(member.name)}`}
                    // Added 'group', padding, hover background effect
                    className="group text-center flex flex-col items-center p-4 rounded-lg hover:bg-slate-700/50 transition-colors duration-200"
                  >
                    <CircularImage
                      alt={member.name}
                      size="w-32 h-32"                      
                    />
                    <h3 className="text-lg font-medium text-slate-100 mt-2 mb-1">{member.name}</h3>
                    <p className="text-sm text-blue-400/90">{member.title}</p>
                    <p className="mt-2 text-sm text-slate-400 px-2 line-clamp-3"> {/* Added line-clamp */}
                      {member.bio}
                    </p>
                  </Link>
                  // End Link
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;