import { Link } from 'react-router-dom';
import { teamMembers } from '../../types/team';

const QUICK_LINKS = [
    { to: '/', label: 'Home' },
    { to: '/films', label: 'Films' },
    { to: '/about', label: 'About' },
    { to: '/almanac', label: 'Almanac' },
];

// Column heading: the same micro-label the detail page and StatCard use for
// field headings, so the footer reads as part of that system. Deliberately
// quieter than the links beneath it — the content should be the brightest
// thing in the column, not the label over it.
const HEADING_CLASS = 'text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4';
const LINK_CLASS = 'text-sm text-slate-400 hover:text-slate-100 transition-colors duration-200';

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        // Transparent with a hairline, matching the navbar at the other end of the page.
        <footer className="border-t border-slate-800/70 text-slate-300">
            {/* Inner container centers the content */}
            <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Left section - About */}
                    <div>
                        <h3 className={HEADING_CLASS}>About Criterion Club</h3>
                        <p className="text-sm leading-relaxed text-slate-400">
                            4-5 friends who watch Criterion Channel films and rate them on a 9-point
                            scale. Is this a podcast?
                        </p>
                    </div>

                    {/* Middle section - Quick Links */}
                    <div>
                        <h3 className={HEADING_CLASS}>Quick Links</h3>
                        <ul className="grid grid-cols-2 gap-2">
                            {QUICK_LINKS.map((link) => (
                                <li key={link.to}>
                                    <Link to={link.to} className={LINK_CLASS}>
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Right section - Team Members. The emerald dot is the same one the
              film cards put before a selector's name — emerald is the club's
              member-voice accent, so it ties the two together. */}
                    <div>
                        <h3 className={HEADING_CLASS}>Team Members</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {teamMembers.map((member) => (
                                <Link
                                    key={member.name}
                                    to={`/profile/${member.name}`}
                                    className={`group inline-flex items-center gap-1.5 ${LINK_CLASS}`}
                                >
                                    <span className="h-1 w-1 flex-shrink-0 rounded-full bg-emerald-400/50 transition-colors duration-200 group-hover:bg-emerald-400" />
                                    {member.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
                {/* Copyright */}
                <div className="mt-8 pt-8 border-t border-slate-800/70 text-center">
                    <p className="text-xs uppercase tracking-widest text-slate-600">
                        © {currentYear} Criterion Club
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
