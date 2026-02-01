import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { HelpModal } from './components/HelpModal';
import { VocabularyPage } from './pages/VocabularyPage';
import { RevisePage, hasReviewedToday } from './pages/RevisePage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { useVocabularyStore } from './stores/vocabularyStore';
import { useSettingsStore } from './stores/settingsStore';
import { useAuth } from './hooks/useAuth';
import { SyncButton } from './components/SyncButton';
import { Loader2, HelpCircle } from 'lucide-react';

const ONBOARDING_KEY = 'langseed_onboarding_seen';

function App() {
  const store = useVocabularyStore();
  const settingsStore = useSettingsStore();
  const auth = useAuth();
  
  // Load data from cloud on login
  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      store.loadFromCloud(auth.user.id);
      settingsStore.loadFromCloud(auth.user.id);
    }
  }, [auth.isAuthenticated, auth.user?.id]);

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

  // Show login page if not authenticated (and Supabase is configured)
  if (auth.isConfigured && !auth.isAuthenticated) {
    return (
      <LoginPage
        onLogin={auth.signIn}
        loading={auth.loading}
        error={auth.error}
        onClearError={auth.clearError}
      />
    );
  }

  const handleSync = () => {
    if (auth.user) {
      store.syncToCloud(auth.user.id);
    }
  };

  const handleSettingsSave = async () => {
    if (auth.user) {
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
}: { 
  store: ReturnType<typeof useVocabularyStore>;
  settingsStore: ReturnType<typeof useSettingsStore>;
  auth: ReturnType<typeof useAuth>;
  onSync: () => void;
  onSettingsSave: () => Promise<void>;
}) {
  const location = useLocation();
  const showSyncButton = location.pathname === '/vocab';
  
  // Track if user reviewed today - re-check on route change
  const [reviewedToday, setReviewedToday] = useState(hasReviewedToday);
  
  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // Auto-show help modal for new users (first time)
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem(ONBOARDING_KEY);
    if (!hasSeenOnboarding) {
      // Small delay so the app renders first
      const timer = setTimeout(() => setShowHelpModal(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);
  
  // Mark onboarding as seen when modal is closed
  const handleCloseHelp = () => {
    setShowHelpModal(false);
    localStorage.setItem(ONBOARDING_KEY, 'true');
  };
  
  useEffect(() => {
    // Re-check reviewed status when navigating (e.g., after completing a session)
    setReviewedToday(hasReviewedToday());
  }, [location.pathname]);

  return (
    <div className="h-dvh flex flex-col bg-base-100 text-base-content overflow-hidden">
      {/* Top header with sync (logout moved to settings) */}
      {auth.isAuthenticated && (
        <header className="flex-shrink-0 bg-base-100 border-b border-base-300 px-4 py-2 z-20">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-primary">🪕 Saras</span>
              <button
                className="btn btn-xs btn-ghost btn-circle text-base-content/50 hover:text-primary"
                onClick={() => setShowHelpModal(true)}
                title="Help & Guide"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              {showSyncButton && (
                <SyncButton
                  isSyncing={store.isSyncing}
                  hasUnsyncedChanges={store.hasUnsyncedChanges}
                  lastSyncTime={store.lastSyncTime}
                  syncError={store.syncError}
                  onSync={onSync}
                  onClearError={store.clearSyncError}
                />
              )}
            </div>
          </div>
        </header>
      )}
      
      {/* Help modal */}
      <HelpModal isOpen={showHelpModal} onClose={handleCloseHelp} />
      
      {/* Main content area - accounts for fixed navbar */}
      <main className="flex-1 overflow-hidden pb-16">
        <Routes>
          <Route path="/" element={<Navigate to="/revise" replace />} />
          <Route path="/vocab" element={<VocabularyPage store={store} settingsStore={settingsStore} />} />
          <Route path="/revise" element={<RevisePage store={store} settingsStore={settingsStore} />} />
          <Route 
            path="/settings" 
            element={
              <SettingsPage 
                settingsStore={settingsStore}
                onSave={onSettingsSave}
                onLogout={() => auth.signOut()}
                userEmail={auth.user?.email}
              />
            } 
          />
        </Routes>
      </main>
      
      {/* Fixed bottom navigation */}
      <Navbar 
        reviewedToday={reviewedToday}
        hasUnsyncedSettings={settingsStore.hasUnsyncedChanges}
      />
    </div>
  );
}

export default App;
