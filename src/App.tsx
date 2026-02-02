import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { HelpModal } from './components/HelpModal';
import { VocabularyPage } from './pages/VocabularyPage';
import { StudyPage } from './pages/StudyPage';
import { QuizPage, hasCompletedQuizToday } from './pages/QuizPage';
import { ProfilePage } from './pages/ProfilePage';
import { LoginPage } from './pages/LoginPage';
import { useVocabularyStore } from './stores/vocabularyStore';
import { useSettingsStore } from './stores/settingsStore';
import { useAuth } from './hooks/useAuth';
import { Loader2 } from 'lucide-react';

const ONBOARDING_KEY = 'langseed_onboarding_seen';

function App() {
  const store = useVocabularyStore();
  const settingsStore = useSettingsStore();
  const auth = useAuth();
  
  // Load data from cloud on login (skip for guest mode)
  useEffect(() => {
    if (auth.isAuthenticated && auth.user && !auth.isGuest) {
      store.loadFromCloud(auth.user.id);
      settingsStore.loadFromCloud(auth.user.id);
    }
    // For guest mode, initialize with chapter 1 if no data exists
    // Pass true to startStudying so chapter 1 words are marked as studying (not paused)
    if (auth.isGuest && store.concepts.length === 0) {
      store.importChapters(1, 1, true);
    }
  }, [auth.isAuthenticated, auth.user?.id, auth.isGuest]);

  // Show loading state while checking auth
  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-base-content/60">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (auth.isConfigured && !auth.isAuthenticated) {
    return (
      <LoginPage
        onLogin={auth.signIn}
        onGuestLogin={auth.signInAsGuest}
        loading={auth.loading}
        error={auth.error}
        onClearError={auth.clearError}
      />
    );
  }

  const handleSync = () => {
    // Don't sync for guest users
    if (auth.user && !auth.isGuest) {
      store.syncToCloud(auth.user.id);
    }
  };

  const handleSettingsSave = async () => {
    // Don't sync for guest users
    if (auth.user && !auth.isGuest) {
      await settingsStore.syncToCloud(auth.user.id);
    }
  };
  
  return (
    <BrowserRouter>
      <AppContent 
        store={store}
        settingsStore={settingsStore}
        auth={auth} 
        onSync={handleSync}
        onSettingsSave={handleSettingsSave}
        isGuest={auth.isGuest}
      />
    </BrowserRouter>
  );
}

// Inner component to access useLocation inside BrowserRouter
function AppContent({ 
  store,
  settingsStore,
  auth, 
  onSync,
  onSettingsSave,
  isGuest,
}: { 
  store: ReturnType<typeof useVocabularyStore>;
  settingsStore: ReturnType<typeof useSettingsStore>;
  auth: ReturnType<typeof useAuth>;
  onSync: () => void;
  onSettingsSave: () => Promise<void>;
  isGuest: boolean;
}) {
  const location = useLocation();
  
  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // Quiz completion state - re-check when route changes
  const [quizCompletedToday, setQuizCompletedToday] = useState(hasCompletedQuizToday());
  
  useEffect(() => {
    // Re-check quiz completion when navigating away from quiz
    setQuizCompletedToday(hasCompletedQuizToday());
  }, [location.pathname]);
  
  // Auto-show help modal for new users
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem(ONBOARDING_KEY);
    if (!hasSeenOnboarding) {
      const timer = setTimeout(() => setShowHelpModal(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);
  
  const handleCloseHelp = () => {
    setShowHelpModal(false);
    localStorage.setItem(ONBOARDING_KEY, 'true');
  };

  return (
    <div className="h-dvh flex flex-col bg-base-100 text-base-content overflow-hidden">
      {/* Help modal */}
      <HelpModal isOpen={showHelpModal} onClose={handleCloseHelp} />
      
      {/* Main content area */}
      <main className="flex-1 overflow-hidden pb-16">
        <Routes>
          {/* Default to Quiz tab */}
          <Route path="/" element={<Navigate to="/quiz" replace />} />
          
          <Route 
            path="/vocab" 
            element={
              <VocabularyPage 
                store={store} 
                settingsStore={settingsStore}
                onSync={onSync}
                onShowHelp={() => setShowHelpModal(true)}
                onRefresh={auth.user && !isGuest ? () => store.loadFromCloud(auth.user!.id) : undefined}
                isGuest={isGuest}
              />
            } 
          />
          
          <Route 
            path="/study" 
            element={
              <StudyPage 
                store={store} 
                settingsStore={settingsStore} 
                onShowHelp={() => setShowHelpModal(true)}
              />
            } 
          />
          
          <Route 
            path="/quiz" 
            element={
              <QuizPage 
                store={store} 
                settingsStore={settingsStore} 
                onShowHelp={() => setShowHelpModal(true)}
              />
            } 
          />
          
          <Route 
            path="/profile" 
            element={
              <ProfilePage 
                settingsStore={settingsStore}
                vocabStore={store}
                onSave={onSettingsSave}
                onLogout={() => auth.signOut()}
                userEmail={isGuest ? undefined : auth.user?.email}
                onShowHelp={() => setShowHelpModal(true)}
                onRefreshProgress={auth.user && !isGuest ? () => store.loadFromCloud(auth.user!.id) : undefined}
                isGuest={isGuest}
              />
            } 
          />
          
          {/* Legacy routes - redirect to new names */}
          <Route path="/revise" element={<Navigate to="/study" replace />} />
          <Route path="/settings" element={<Navigate to="/profile" replace />} />
        </Routes>
      </main>
      
      {/* Fixed bottom navigation */}
      <Navbar 
        hasUnsyncedSettings={settingsStore.hasUnsyncedChanges}
        quizCompletedToday={quizCompletedToday}
      />
    </div>
  );
}

export default App;
