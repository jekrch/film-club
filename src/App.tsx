import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import HomePage from './pages/HomePage';
import FilmsPage from './pages/FilmsPage';
import FilmDetailPage from './pages/FilmDetailPage';
import AboutPage from './pages/AboutPage';
import "./index.css"; // Ensure index.css is imported

function App() {
  return (
    <Router>
      {/* Added bg-gray-800 here temporarily for debugging visibility */}
      {/* This should span full width/height if index.css is correct */}
      <div className="flex flex-col min-h-screen bg-gray-800">

        {/* Navbar: Background should span full width */}
        <Navbar />

        {/* Main content area: takes up remaining vertical space */}
        <main className="flex-grow w-full">
          {/* Inner div centers the actual page content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/films" element={<FilmsPage />} />
              <Route path="/films/:imdbId" element={<FilmDetailPage />} />
              <Route path="/about" element={<AboutPage />} />
            </Routes>
          </div>
        </main>

        {/* Footer: Background should span full width */}
        <Footer />
      </div>
    </Router>
  );
}

export default App;