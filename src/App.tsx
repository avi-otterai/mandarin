import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { VocabularyPage } from './pages/VocabularyPage';
import { RevisePage } from './pages/RevisePage';
import { useVocabularyStore } from './stores/vocabularyStore';

function App() {
  const store = useVocabularyStore();
  
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-base-100 text-base-content">
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/vocab" replace />} />
            <Route path="/vocab" element={<VocabularyPage store={store} />} />
            <Route path="/revise" element={<RevisePage store={store} />} />
          </Routes>
        </main>
        
        <Navbar dueCount={store.dueCount} newCount={store.newCount} />
      </div>
    </BrowserRouter>
  );
}

export default App;
