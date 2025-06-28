import { useState } from 'react';
import { motion } from 'framer-motion';
import { Cross as Hamburger } from 'hamburger-react'

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const links = [
    { href: '/#/', label: 'Home' },
    { href: '/#/films', label: 'Films' },
    { href: '/#/about', label: 'About' },
    { href: '/#/almanac', label: 'Almanac' },
  ];

  return (
    <nav className="bg-slate-900 text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <a href="/#/" className="flex items-center">
              <span className="text-xl font-bold text-slate-300">Criterion Club</span>
              <img src="/images/cc-icon.PNG" alt="Criterion Club" className="ml-3 h-[1.4em] w-auto text-slate-300 opacity-70 hover:opacity-100x" />
            </a>
          </div>
          {/* Desktop menu */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors duration-200"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Mobile menu button - Fixed visibility issues */}
          <div className="md:hidden text-slate-300">
            <Hamburger size={20} toggled={isMenuOpen} toggle={setIsMenuOpen} />
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <motion.div 
        className="md:hidden overflow-hidden"
        initial={false}
        animate={{
          height: isMenuOpen ? "auto" : 0,
          opacity: isMenuOpen ? 1 : 0
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-900/95">
          {links.map((link, index) => (
            <motion.a
              key={link.href}
              href={link.href}
              className="block px-3 py-2 rounded-md text-base font-medium hover:bg-gray-700 transition-colors duration-200"
              onClick={() => setIsMenuOpen(false)}
              initial={{ opacity: 0, x: -20 }}
              animate={{ 
                opacity: isMenuOpen ? 1 : 0, 
                x: isMenuOpen ? 0 : -20 
              }}
              transition={{ duration: 0.2, delay: index * 0.1 }}
            >
              {link.label}
            </motion.a>
          ))}
        </div>
      </motion.div>
    </nav>
  );
};

export default Navbar;