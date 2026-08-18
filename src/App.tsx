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
import ListPage from './pages/ListPage';
import ListEditorPage from './pages/ListEditorPage';
import WatchedPage from './pages/WatchedPage';
import NotFoundPage from './pages/NotFoundPage';
import { ViewSettingsProvider } from './contexts/ViewSettingsContext';
import { OverridesProvider } from './contexts/OverridesContext';
import { TrophiesProvider } from './contexts/TrophiesContext';
import { ClubAuthProvider } from './auth/GoogleAuth';
import './index.css';
import ScrollToTop from './components/layout/ScrollToTop';
import PageTransition from './components/layout/PageTransition';
import ErrorBoundary from './components/common/ErrorBoundary';

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
                <PageTransition>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/films" element={<FilmsPage />} />
                        <Route path="/films/:imdbId" element={<FilmDetailPage />} />
                        <Route path="/about" element={<AboutPage />} />
                        <Route path="/almanac" element={<AlmanacPage />} />
                        <Route path="/profile/:memberName" element={<ProfilePage />} />
                        {/* The static segments outrank `/lists/:listId`, so "new" is the
                editor rather than a list whose id happens to be "new". */}
                        <Route path="/lists/new" element={<ListEditorPage />} />
                        <Route path="/lists/:listId/edit" element={<ListEditorPage />} />
                        <Route path="/lists/:listId" element={<ListPage />} />
                        {/* A member's personal watch log. Not under /films: nothing here is
                a club film, and the two must never share a surface. */}
                        <Route path="/watched/:memberName" element={<WatchedPage />} />
                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                </PageTransition>
            </main>

            <Footer />
        </div>
    );
}

function App() {
    if (import.meta.hot) {
        import.meta.hot.accept();
    }

    return (
        <ViewSettingsProvider>
            {/* Holds an editing session in memory. Mounting it costs nothing on an
          ordinary page view: no script loads and no request is made until a
          member opens an editing surface and signs in. */}
            <ClubAuthProvider>
                {/* One fetch of `overrides.json` for the whole session, rather than
              one per film page. Inert until someone signs in. */}
                <OverridesProvider>
                    {/* The club's trophies, serving the bundled file until a member
                  signs in and the live one is worth fetching. */}
                    <TrophiesProvider>
                        <Router>
                            <ScrollToTop />
                            <ErrorBoundary>
                                <AppContent />
                            </ErrorBoundary>
                        </Router>
                    </TrophiesProvider>
                </OverridesProvider>
            </ClubAuthProvider>
        </ViewSettingsProvider>
    );
}

export default App;
