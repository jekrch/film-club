import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import CorinthianPillar from './components/layout/CorinthianPillar';
import HomePage from './pages/HomePage';
import FilmsPage from './pages/FilmsPage';
import FilmDetailPage from './pages/FilmDetailPage';
import AboutPage from './pages/AboutPage';
import ProfilePage from './pages/ProfilePage';
import AlmanacPage from './pages/AlmanacPage';
import { ViewSettingsProvider } from './contexts/ViewSettingsContext';
import "./index.css";
import ScrollToTop from './components/layout/ScrollToTop';

function AppContent() {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  
  return (
    <div className="relative flex flex-col min-h-screen bg-gradient-to-t from-slate-900 via-slate-800 to-slate-900 font-se overflow-x-hidden">
      
      {/* Background pillar wrapper - stretches to full document height */}
      {!isHomePage && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <CorinthianPillar 
            side="right" 
            flipped
            width={250}
            className="!opacity-[0.05]"
          />
        </div>
      )}

      <Navbar />

      <main className="flex-grow w-full relative z-10">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/films" element={<FilmsPage />} />
          <Route path="/films/:imdbId" element={<FilmDetailPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/almanac" element={<AlmanacPage />} />
          <Route path="/profile/:memberName" element={<ProfilePage />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

function App() {
  if (import.meta.hot) {
    import.meta.hot.accept()
  }
  
  return (
    <ViewSettingsProvider>
      <Router>
        <ScrollToTop />
        <AppContent />
      </Router>
    </ViewSettingsProvider>
  );
}

export default App;