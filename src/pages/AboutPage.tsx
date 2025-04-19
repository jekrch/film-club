
const AboutPage = () => {
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
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-300 mb-4"> {/* Accent color for heading */}
                Our Mission
              </h2>
              <p className="text-slate-300 leading-relaxed">
              Four friends who watch Criterion Channel films and rate them on a 9-point scale. Is this a podcast?
              </p>
            </div>
          </div>

          {/* Team Section - Dark Card */}
          <div className="bg-slate-800 rounded-lg overflow-hidden mb-8 border border-slate-700 shadow-lg shadow-slate-950/30">
            <div className="p-6 md:p-8">
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-300 mb-6 text-center"> {/* Accent color & centered */}
                Meet the Club
              </h2>
              {/* Team Member Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:gap-10">

                {/* Team Member Card Structure (Repeated) */}
                <div className="text-center flex flex-col items-center">
                  {/* Placeholder Image - Darker bg, lighter text */}
                  <div className="w-32 h-32 mx-auto bg-slate-700 rounded-full overflow-hidden mb-4 border-2 border-slate-600 flex items-center justify-center">
                    {/* You could replace this with an actual <img> tag or an icon */}
                    {/* Example with user icon (requires heroicons):
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg> */}
                     <span className="text-sm font-medium text-slate-500">Photo</span>
                  </div>
                  {/* Name - Brighter */}
                  <h3 className="text-lg font-medium text-slate-100">Andy</h3>
                  {/* Title/Role - Accent Color */}
                  <p className="text-sm text-blue-400/90">Filmmaker & Director</p>
                  {/* Bio - Slightly dimmer */}
                  <p className="mt-2 text-sm text-slate-400 px-2">
                    Bio coming soon (?)
                  </p>
                </div>

                <div className="text-center flex flex-col items-center">
                   <div className="w-32 h-32 mx-auto bg-slate-700 rounded-full overflow-hidden mb-4 border-2 border-slate-600 flex items-center justify-center">
                     <span className="text-sm font-medium text-slate-500">Photo</span>
                  </div>
                  <h3 className="text-lg font-medium text-slate-100">Gabe</h3>
                  <p className="text-sm text-blue-400/90">Scientist & Professor</p>
                  <p className="mt-2 text-sm text-slate-400 px-2">
                    We're learning more every day
                  </p>
                </div>

                <div className="text-center flex flex-col items-center">
                   <div className="w-32 h-32 mx-auto bg-slate-700 rounded-full overflow-hidden mb-4 border-2 border-slate-600 flex items-center justify-center">
                     <span className="text-sm font-medium text-slate-500">Photo</span>
                  </div>
                  <h3 className="text-lg font-medium text-slate-100">Jacob</h3>
                  <p className="text-sm text-blue-400/90">Technologist & Ex-Philosopher</p>
                  <p className="mt-2 text-sm text-slate-400 px-2">
                    This www is under construction
                  </p>
                </div>

                <div className="text-center flex flex-col items-center">
                   <div className="w-32 h-32 mx-auto bg-slate-700 rounded-full overflow-hidden mb-4 border-2 border-slate-600 flex items-center justify-center">
                     <span className="text-sm font-medium text-slate-500">Photo</span>
                  </div>
                  <h3 className="text-lg font-medium text-slate-100">Joey</h3>
                  <p className="text-sm text-blue-400/90">Education Leader & Artist</p>
                  <p className="mt-2 text-sm text-slate-400 px-2">
                    Our researchers are on it
                  </p>
                </div>
                {/* End Repeated Member Card */}

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;