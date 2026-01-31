import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { VocabularyPage } from './pages/VocabularyPage';
import { RevisePage } from './pages/RevisePage';
import { LoginPage } from './pages/LoginPage';
import { useVocabularyStore } from './stores/vocabularyStore';
import { useAuth } from './hooks/useAuth';
import { SyncButton } from './components/SyncButton';
import { LogOut, Loader2 } from 'lucide-react';

function App() {
  const store = useVocabularyStore();
  const auth = useAuth();
  
  // Load data from cloud on login
  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      store.loadFromCloud(auth.user.id);
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
  
  return (
    <BrowserRouter>
      <AppContent 
        store={store} 
        auth={auth} 
        onSync={handleSync} 
      />
    </BrowserRouter>
  );
}

// Inner component to access useLocation inside BrowserRouter
function AppContent({ 
  store, 
  auth, 
  onSync 
}: { 
  store: ReturnType<typeof useVocabularyStore>; 
  auth: ReturnType<typeof useAuth>;
  onSync: () => void;
}) {
  const location = useLocation();
  const showSyncButton = location.pathname === '/vocab';

  return (
    <div className="h-screen flex flex-col bg-base-100 text-base-content overflow-hidden">
      {/* Top header with sync and logout */}
      {auth.isAuthenticated && (
        <header className="flex-shrink-0 bg-base-100 border-b border-base-300 px-4 py-2 z-20">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <span className="text-sm font-medium text-primary">🀄 LangSeed</span>
            
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
              
              <button
                className="btn btn-ghost btn-sm btn-square"
                onClick={() => auth.signOut()}
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>
      )}
      
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Navigate to="/vocab" replace />} />
          <Route path="/vocab" element={<VocabularyPage store={store} />} />
          <Route path="/revise" element={<RevisePage store={store} />} />
        </Routes>
      </main>
      
      <Navbar dueCount={store.dueCount} newCount={store.newCount} />
    </div>
  );
}

export default App;
