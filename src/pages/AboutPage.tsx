import React from 'react';

const AboutPage = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-300 mb-6">About Our Film Club</h1>
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Our Mission</h2>
            <p className="text-gray-600 mb-4">
              Four friends who watch Criterion Channel films and rate them on a 9-point scale. Is this a podcast? 
            </p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Our Team</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="text-center">
                <div className="w-32 h-32 mx-auto bg-gray-300 rounded-full overflow-hidden mb-4">
                  {/* Team member image would go here */}
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-gray-600">Photo</span>
                  </div>
                </div>
                <h3 className="text-lg font-medium text-gray-900">Andy</h3>
                <p className="text-sm text-gray-500">Film-maker & Director</p>
                <p className="mt-2 text-gray-600">
                  Bio coming soon (?)
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-32 h-32 mx-auto bg-gray-300 rounded-full overflow-hidden mb-4">
                  {/* Team member image would go here */}
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-gray-600">Photo</span>
                  </div>
                </div>
                <h3 className="text-lg font-medium text-gray-900">Gabe</h3>
                <p className="text-sm text-gray-500">Scientist & Professor</p>
                <p className="mt-2 text-gray-600">
                  WHO IS HE?
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-32 h-32 mx-auto bg-gray-300 rounded-full overflow-hidden mb-4">
                  {/* Team member image would go here */}
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-gray-600">Photo</span>
                  </div>
                </div>
                <h3 className="text-lg font-medium text-gray-900">Jacob</h3>
                <p className="text-sm text-gray-500">Technologist & Ex-Philosopher</p>
                <p className="mt-2 text-gray-600">
                  This www is under construction 
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-32 h-32 mx-auto bg-gray-300 rounded-full overflow-hidden mb-4">
                  {/* Team member image would go here */}
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-gray-600">Photo</span>
                  </div>
                </div>
                <h3 className="text-lg font-medium text-gray-900">Joey</h3>
                <p className="text-sm text-gray-500">Education Leader & Artist</p>
                <p className="mt-2 text-gray-600">
                  Our team is on it!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;