// src/App.tsx
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import HomePage from './pages/HomePage';
import FilmsPage from './pages/FilmsPage';
import FilmDetailPage from './pages/FilmDetailPage';
import AboutPage from './pages/AboutPage';
import ProfilePage from './pages/ProfilePage';
import "./index.css";
import { ViewSettingsProvider } from './contexts/ViewSettingsContext';
import AlmanacPage from './pages/AlmanacPage';

function App() {
  if (import.meta.hot) {
    import.meta.hot.accept()
  }
  
  return (
    <ViewSettingsProvider>
      <Router>
        <div className="flex flex-col min-h-screen bg-slate-900x bg-gradient-to-t from-slate-900 via-slate-800 to-slate-900 font-se"> {/* Set default bg */}

          <Navbar />

          {/* Main content area - remove padding/max-width here, apply within pages */}
          <main className="flex-grow w-full">
            {/* Routes handle their own layout/padding */}
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/films" element={<FilmsPage />} />
              <Route path="/films/:imdbId" element={<FilmDetailPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/almanac" element={<AlmanacPage />} />
              {/* Add the profile page route */}
              <Route path="/profile/:memberName" element={<ProfilePage />} /> {/* <-- Add Route */}
            </Routes>
          </main>

          <Footer />
        </div>
      </Router>
    </ViewSettingsProvider>
  );
}

export default App;