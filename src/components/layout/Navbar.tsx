import { useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink, Link } from 'react-router-dom';
import classNames from 'classnames';
import { Cross as Hamburger } from 'hamburger-react';
import NavAuthControl from '../../auth/NavAuthControl';

const links = [
    { to: '/', label: 'Home' },
    { to: '/films', label: 'Films' },
    { to: '/about', label: 'About' },
    { to: '/almanac', label: 'Almanac' },
];

/**
 * Desktop nav item: letterspaced small caps, with the current page marked by a
 * hairline beneath it rather than a filled pill.
 *
 * The type echoes the `chip` button variant and the detail page's field labels
 * (`uppercase tracking-[0.15em]`), and the underline echoes the h-px section
 * rules there — so the nav belongs to the same system as the cards below it
 * instead of introducing a third idiom. `space-x-7` on the row, because
 * letterspaced caps need more air between them than sentence case does.
 */
const desktopLink = ({ isActive }: { isActive: boolean }) =>
    classNames(
        'relative px-1 py-2 text-[11px] font-medium uppercase tracking-[0.15em] transition-colors duration-200',
        'after:absolute after:inset-x-0 after:-bottom-px after:h-px after:transition-colors after:duration-200',
        isActive
            ? 'text-slate-100 after:bg-blue-400/60'
            : 'text-slate-400 hover:text-slate-100 after:bg-transparent'
    );

/**
 * Mobile nav item. An underline reads as an afterthought on a full-width row,
 * so the current page is marked with a left rail instead — the same device
 * AccentCard uses to flag a card's accent.
 */
const mobileLink = ({ isActive }: { isActive: boolean }) =>
    classNames(
        'block border-l py-2 pl-3 text-base font-medium transition-colors duration-200',
        isActive
            ? 'border-blue-400/60 text-slate-100'
            : 'border-transparent text-slate-400 hover:border-slate-600 hover:text-slate-100'
    );

const Navbar = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        // Transparent, separated from the page by a hairline rather than by a bar
        // of colour — the same way cards are defined by their edge.
        <nav className="relative border-b border-slate-800/70">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <div className="flex items-center">
                        <Link
                            to="/"
                            className="group flex items-center text-slate-300 hover:text-slate-100 transition-colors duration-200"
                        >
                            <span className="text-xl font-bold tracking-tight">Criterion Club</span>
                            <img
                                src="/images/cc-icon.PNG"
                                alt=""
                                className="ml-3 h-[1.4em] w-auto opacity-60 transition-opacity duration-200 group-hover:opacity-100"
                            />
                        </Link>
                    </div>
                    {/* Desktop menu. The sign-in control sits past the links with more
              air than the links give each other, so it reads as a separate
              thing rather than a fifth destination. */}
                    <div className="hidden md:flex ml-10 items-center gap-8">
                        <div className="flex items-baseline space-x-7">
                            {links.map((link) => (
                                <NavLink
                                    key={link.to}
                                    to={link.to}
                                    end={link.to === '/'}
                                    className={desktopLink}
                                >
                                    {link.label}
                                </NavLink>
                            ))}
                        </div>
                        <NavAuthControl />
                    </div>

                    {/* Mobile menu button. hamburger-react supplies aria-expanded itself;
              `label` gives it its accessible name. */}
                    <div className="md:hidden text-slate-300">
                        <Hamburger
                            size={20}
                            toggled={isMenuOpen}
                            toggle={setIsMenuOpen}
                            label="Menu"
                        />
                    </div>
                </div>
            </div>

            {/* Mobile menu. A collapsed height doesn't take its links out of the tab
          order, so `inert` does that explicitly while closed. */}
            <motion.div
                className="md:hidden overflow-hidden"
                inert={!isMenuOpen}
                initial={false}
                animate={{
                    height: isMenuOpen ? 'auto' : 0,
                    opacity: isMenuOpen ? 1 : 0,
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
                <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                    {links.map((link, index) => (
                        <motion.div
                            key={link.to}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{
                                opacity: isMenuOpen ? 1 : 0,
                                x: isMenuOpen ? 0 : -20,
                            }}
                            // 0.04 rather than 0.1: at 0.1 the fourth link lands 300ms after
                            // the tap, which reads as lag rather than as a stagger.
                            transition={{ duration: 0.2, delay: index * 0.04 }}
                        >
                            <NavLink
                                to={link.to}
                                end={link.to === '/'}
                                className={mobileLink}
                                onClick={() => setIsMenuOpen(false)}
                            >
                                {link.label}
                            </NavLink>
                        </motion.div>
                    ))}
                    {/* Below the links and behind a rule: signing in isn't navigation,
              and for most visitors it's not for them at all. */}
                    <div className="mt-2 border-t border-slate-800/70 pt-2">
                        <NavAuthControl variant="inline" />
                    </div>
                </div>
            </motion.div>
        </nav>
    );
};

export default Navbar;
