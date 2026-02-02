import { useState, useMemo, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Download, CheckSquare, Square, Filter, HelpCircle, Check, Loader2, AlertTriangle, Cloud } from 'lucide-react';
import type { VocabularyStore } from '../stores/vocabularyStore';
import type { SettingsStore } from '../stores/settingsStore';
import type { Concept } from '../types/vocabulary';
import { VocabCard } from '../components/VocabCard';

interface VocabularyPageProps {
  store: VocabularyStore;
  settingsStore?: SettingsStore;
  onSync?: () => void;
  onShowHelp?: () => void;
}

type SortField = 'pinyin' | 'word' | 'meaning' | 'part_of_speech' | 'chapter' | 'knowledge';
type SortDir = 'asc' | 'desc';

export function VocabularyPage({ store, settingsStore, onSync, onShowHelp }: VocabularyPageProps) {
  const [sortField, setSortField] = useState<SortField>('chapter');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterChapter, setFilterChapter] = useState<string>('all');
  const [filterStudying, setFilterStudying] = useState<'all' | 'studying' | 'paused'>('all');
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  
  // Auto-import HSK1 if no vocab exists
  useEffect(() => {
    if (store.concepts.length === 0 && store.hsk1Vocab.length > 0) {
      store.importHSK1();
    }
  }, [store.concepts.length, store.hsk1Vocab.length, store.importHSK1]);
  
  // Get unique chapters
  const chapters = useMemo(() => {
    return [...new Set(store.concepts.map(c => c.chapter))].sort((a, b) => a - b);
  }, [store.concepts]);
  
  // Filter and sort concepts
  const filteredConcepts = useMemo(() => {
    let result = store.concepts;
    
    // Chapter filter
    if (filterChapter !== 'all') {
      result = result.filter(c => c.chapter === parseInt(filterChapter));
    }
    
    // Studying/Paused filter
    if (filterStudying === 'studying') {
      result = result.filter(c => !c.paused);
    } else if (filterStudying === 'paused') {
      result = result.filter(c => c.paused);
    }
    
    return result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'pinyin':
          comparison = a.pinyin.localeCompare(b.pinyin);
          break;
        case 'word':
          comparison = a.word.localeCompare(b.word);
          break;
        case 'meaning':
          comparison = a.meaning.localeCompare(b.meaning);
          break;
        case 'part_of_speech':
          comparison = a.part_of_speech.localeCompare(b.part_of_speech);
          break;
        case 'chapter':
          comparison = a.chapter - b.chapter;
          break;
        case 'knowledge':
          comparison = a.knowledge - b.knowledge;
          break;
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [store.concepts, filterChapter, filterStudying, sortField, sortDir]);
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };
  
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
    }
    return sortDir === 'asc' 
      ? <ChevronUp className="w-3 h-3" />
      : <ChevronDown className="w-3 h-3" />;
  };

  // Stats
  const studyingCount = store.concepts.filter(c => !c.paused).length;
  const totalAdded = store.concepts.length;
  const filteredStudying = filteredConcepts.filter(c => !c.paused).length;
  
  // Mass toggle for filtered results
  const handleMarkAllStudying = () => {
    filteredConcepts.forEach(c => {
      if (c.paused) {
        store.togglePaused(c.id);
      }
    });
  };
  
  const handleMarkAllPaused = () => {
    filteredConcepts.forEach(c => {
      if (!c.paused) {
        store.togglePaused(c.id);
      }
    });
  };
  
  // Format last sync time
  const formatTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };
  
  // Sync button state
  const getSyncButtonClass = () => {
    if (store.syncError) return 'btn-error';
    if (store.hasUnsyncedChanges) return 'btn-warning';
    return 'btn-success';
  };
  
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-base-100 border-b border-base-300 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold">Vocabulary</h1>
            <p className="text-sm text-base-content/60">
              {totalAdded} words · {studyingCount} studying
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onShowHelp && (
              <button
                className="btn btn-sm btn-ghost btn-circle text-base-content/50 hover:text-primary"
                onClick={onShowHelp}
                title="Help & Guide"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            )}
            {onSync && (
              <button
                className={`btn btn-sm gap-1 ${getSyncButtonClass()}`}
                onClick={store.syncError ? store.clearSyncError : onSync}
                disabled={store.isSyncing || (!store.hasUnsyncedChanges && !store.syncError)}
                title={store.syncError || `Last saved: ${formatTime(store.lastSyncTime)}`}
              >
                {store.isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : store.syncError ? (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    Retry
                  </>
                ) : store.hasUnsyncedChanges ? (
                  <>
                    <Cloud className="w-4 h-4" />
                    Save
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Saved
                  </>
                )}
              </button>
            )}
            {store.concepts.length === 0 && (
              <button 
                className="btn btn-sm btn-primary"
                onClick={store.importHSK1}
              >
                <Download className="w-4 h-4" />
                Import All
              </button>
            )}
          </div>
        </div>
        
        {/* Filters & Actions Row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-base-content/40 shrink-0" />
          
          {/* Chapter filter */}
          <select
            className="select select-xs select-bordered bg-base-200 w-auto"
            value={filterChapter}
            onChange={e => setFilterChapter(e.target.value)}
          >
            <option value="all">Ch 1-{Math.max(...chapters, 1)}</option>
            {chapters.map(ch => (
              <option key={ch} value={ch}>Ch {ch}</option>
            ))}
          </select>
          
          {/* Studying/Paused filter */}
          <select
            className="select select-xs select-bordered bg-base-200 w-auto"
            value={filterStudying}
            onChange={e => setFilterStudying(e.target.value as 'all' | 'studying' | 'paused')}
          >
            <option value="all">All</option>
            <option value="studying">✓ Studying</option>
            <option value="paused">○ Paused</option>
          </select>
          
          {/* Mass actions */}
          {filteredConcepts.length > 0 && (
            <>
              <button 
                className="btn btn-xs btn-outline btn-success gap-0.5"
                onClick={handleMarkAllStudying}
                disabled={filteredStudying === filteredConcepts.length}
                title="Mark all filtered as studying"
              >
                <CheckSquare className="w-3 h-3" />
                Study ({filteredConcepts.length - filteredStudying})
              </button>
              <button 
                className="btn btn-xs btn-outline btn-warning gap-0.5"
                onClick={handleMarkAllPaused}
                disabled={filteredStudying === 0}
                title="Pause all filtered words"
              >
                <Square className="w-3 h-3" />
                Pause ({filteredStudying})
              </button>
            </>
          )}
          
          {/* Showing count */}
          <span className="text-xs text-base-content/50 ml-auto">
            {filteredConcepts.length} words
          </span>
        </div>
      </header>
      
      {/* Table */}
      <div className="flex-1 overflow-hidden px-2">
        {filteredConcepts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg opacity-70">No vocabulary found</p>
            {store.concepts.length === 0 && (
              <p className="text-sm opacity-50 mt-2">
                Click "Import HSK1" to get started
              </p>
            )}
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <table className="table table-sm table-zebra w-full">
              <thead className="text-xs sticky top-0 z-10">
                <tr className="bg-base-200">
                  <th 
                    className="cursor-pointer hover:bg-base-300 whitespace-nowrap"
                    onClick={() => handleSort('pinyin')}
                  >
                    <div className="flex items-center gap-1">
                      Pinyin <SortIcon field="pinyin" />
                    </div>
                  </th>
                  <th 
                    className="cursor-pointer hover:bg-base-300 whitespace-nowrap"
                    onClick={() => handleSort('word')}
                  >
                    <div className="flex items-center gap-1">
                      字 <SortIcon field="word" />
                    </div>
                  </th>
                  <th 
                    className="cursor-pointer hover:bg-base-300"
                    onClick={() => handleSort('meaning')}
                  >
                    <div className="flex items-center gap-1">
                      Meaning <SortIcon field="meaning" />
                    </div>
                  </th>
                  <th 
                    className="cursor-pointer hover:bg-base-300 whitespace-nowrap hidden sm:table-cell"
                    onClick={() => handleSort('part_of_speech')}
                  >
                    <div className="flex items-center gap-1">
                      Type <SortIcon field="part_of_speech" />
                    </div>
                  </th>
                  <th 
                    className="cursor-pointer hover:bg-base-300 text-center whitespace-nowrap hidden sm:table-cell"
                    onClick={() => handleSort('chapter')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Ch <SortIcon field="chapter" />
                    </div>
                  </th>
                  <th 
                    className="cursor-pointer hover:bg-base-300 text-center whitespace-nowrap"
                    onClick={() => handleSort('knowledge')}
                    title="Knowledge level from quiz performance"
                  >
                    <div className="flex items-center justify-center gap-1">
                      % <SortIcon field="knowledge" />
                    </div>
                  </th>
                  <th 
                    className="text-center whitespace-nowrap"
                    title="Check to include in Quiz/Study"
                  >
                    ✓
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredConcepts.map(concept => (
                  <tr key={concept.id} className="hover">
                    <td className="pinyin text-sm whitespace-nowrap">{concept.pinyin}</td>
                    <td className="whitespace-nowrap">
                      <button 
                        className="hanzi hanzi-table font-bold hover:text-primary cursor-pointer"
                        onClick={() => setSelectedConcept(concept)}
                      >
                        {concept.word}
                      </button>
                    </td>
                    <td className="text-sm max-w-[200px] truncate" title={concept.meaning}>
                      {concept.meaning}
                    </td>
                    <td className="text-xs opacity-70 hidden sm:table-cell">{formatPOS(concept.part_of_speech)}</td>
                    <td className="text-center text-sm hidden sm:table-cell">{concept.chapter}</td>
                    <td className="text-center text-sm">
                      <span className={`font-mono ${
                        concept.knowledge >= 80 ? 'text-success' :
                        concept.knowledge >= 50 ? 'text-warning' :
                        'text-error/70'
                      }`}>
                        {concept.knowledge}
                      </span>
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-success checkbox-sm"
                        checked={!concept.paused}
                        onChange={() => store.togglePaused(concept.id)}
                        title={concept.paused ? 'Click to start studying' : 'Click to pause'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Detail Card Modal */}
      {selectedConcept && (
        <VocabCard
          concept={selectedConcept}
          onTogglePaused={() => {
            store.togglePaused(selectedConcept.id);
            const updated = store.concepts.find(c => c.id === selectedConcept.id);
            if (updated) setSelectedConcept(updated);
          }}
          onClose={() => setSelectedConcept(null)}
          audioSettings={settingsStore?.settings.audio}
        />
      )}
    </div>
  );
}

// Format part of speech for display
function formatPOS(pos: string): string {
  const map: Record<string, string> = {
    noun: 'n.',
    verb: 'v.',
    adjective: 'adj.',
    adverb: 'adv.',
    pronoun: 'pron.',
    preposition: 'prep.',
    conjunction: 'conj.',
    particle: 'part.',
    numeral: 'num.',
    measure_word: 'mw.',
    interjection: 'int.',
    other: '-',
  };
  return map[pos] || pos;
}
