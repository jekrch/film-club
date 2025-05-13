import { Link } from 'react-router-dom';
import { teamMembers } from '../../types/team';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900x text-white">
      {/* Inner container centers the content */}
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left section - About */}
          <div>
            <h3 className="text-lg font-semibold mb-4">About Criterion Club</h3>
            <p className="text-gray-400">
                Four friends who watch Criterion Channel films and rate them on a 9-point scale. Is this a podcast?
            </p>
          </div>

          {/* Middle section - Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="grid grid-cols-2 gap-2">
              <li>
                <Link to="/" className="text-gray-400 hover:text-white transition">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/films" className="text-gray-400 hover:text-white transition">
                  Films
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-gray-400 hover:text-white transition">
                  About
                </Link>
              </li>
              <li>
                <Link to="/almanac" className="text-gray-400 hover:text-white transition">
                  Almanac
                </Link>
              </li>
            </ul>
          </div>

          {/* Right section - Team Members */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Team Members</h3>
            <div className="grid grid-cols-2 gap-2">
              {teamMembers.map((member) => (
                <Link 
                  key={member.name}
                  to={`/profile/${member.name}`} 
                  className="text-gray-400 hover:text-white transition text-md"
                >
                  {member.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
        {/* Copyright */}
        <div className="mt-8 pt-8 border-t border-gray-700 text-center">
          <p className="text-gray-400 text-sm">
            © {currentYear} Criterion Club. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;