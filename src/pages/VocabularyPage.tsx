import { useState, useMemo, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Download, CheckSquare, Square, Filter, Layers, Plus, Minus, ChevronRight } from 'lucide-react';
import type { VocabularyStore } from '../stores/vocabularyStore';
import type { Concept } from '../types/vocabulary';
import { VocabCard } from '../components/VocabCard';

interface VocabularyPageProps {
  store: VocabularyStore;
}

type SortField = 'pinyin' | 'word' | 'meaning' | 'part_of_speech' | 'chapter' | 'understanding';
type SortDir = 'asc' | 'desc';

export function VocabularyPage({ store }: VocabularyPageProps) {
  const [sortField, setSortField] = useState<SortField>('chapter');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterChapter, setFilterChapter] = useState<string>('all');
  const [filterMastery, setFilterMastery] = useState<'all' | 'mastered' | 'studying'>('all');
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  
  // Bulk chapter management
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [fromChapter, setFromChapter] = useState(1);
  const [toChapter, setToChapter] = useState(6);
  
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
    
    // Mastery filter
    if (filterMastery === 'mastered') {
      result = result.filter(c => c.understanding >= 80);
    } else if (filterMastery === 'studying') {
      result = result.filter(c => c.understanding < 80);
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
        case 'understanding':
          comparison = a.understanding - b.understanding;
          break;
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [store.concepts, filterChapter, filterMastery, sortField, sortDir]);
  
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
  const masteredCount = store.concepts.filter(c => c.understanding >= 80).length;
  const totalAdded = store.concepts.length;
  const filteredMastered = filteredConcepts.filter(c => c.understanding >= 80).length;
  
  // Bulk chapter stats
  const bulkStats = useMemo(() => {
    const inRange = store.hsk1Vocab.filter(w => w.chapter >= fromChapter && w.chapter <= toChapter);
    const alreadyAdded = inRange.filter(w => store.addedWords.has(w.word));
    const canAdd = inRange.length - alreadyAdded.length;
    const conceptsInRange = store.concepts.filter(c => c.chapter >= fromChapter && c.chapter <= toChapter);
    return {
      totalInRange: inRange.length,
      alreadyAdded: alreadyAdded.length,
      canAdd,
      canRemove: conceptsInRange.length,
    };
  }, [fromChapter, toChapter, store.hsk1Vocab, store.addedWords, store.concepts]);
  
  // Get chapter stats for quick buttons
  const chapterStats = useMemo(() => {
    return store.availableChapters.map(ch => {
      const total = store.hsk1Vocab.filter(w => w.chapter === ch).length;
      const added = store.concepts.filter(c => c.chapter === ch).length;
      return { chapter: ch, total, added };
    });
  }, [store.availableChapters, store.hsk1Vocab, store.concepts]);
  
  // Mass mastery toggle for filtered results
  const handleMarkAllMastered = () => {
    filteredConcepts.forEach(c => {
      if (c.understanding < 80) {
        store.toggleKnown(c.id);
      }
    });
  };
  
  const handleResetAllMastery = () => {
    filteredConcepts.forEach(c => {
      if (c.understanding >= 80) {
        store.toggleKnown(c.id);
      }
    });
  };
  
  // Bulk chapter handlers
  const handleAddChapters = () => {
    store.importChapters(fromChapter, toChapter);
  };
  
  const handleRemoveChapters = () => {
    if (confirm(`Remove all ${bulkStats.canRemove} words from chapters ${fromChapter}-${toChapter}? This will reset your progress for these words.`)) {
      store.removeChapters(fromChapter, toChapter);
    }
  };
  
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-base-100 border-b border-base-300 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold">Vocabulary</h1>
            <p className="text-sm text-base-content/60">
              {totalAdded} added · {masteredCount} mastered
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              className={`btn btn-sm ${showBulkPanel ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setShowBulkPanel(!showBulkPanel)}
            >
              <Layers className="w-4 h-4" />
              Chapters
              <ChevronRight className={`w-3 h-3 transition-transform ${showBulkPanel ? 'rotate-90' : ''}`} />
            </button>
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
        
        {/* Bulk Chapter Management Panel */}
        {showBulkPanel && (
          <div className="bg-base-200 rounded-lg p-3 mb-3 space-y-3">
            <div className="text-sm font-medium text-base-content/80">Add or remove chapters in bulk</div>
            
            {/* Chapter Range Selector */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm">Chapters</span>
              <select 
                className="select select-sm select-bordered w-20"
                value={fromChapter}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setFromChapter(val);
                  if (val > toChapter) setToChapter(val);
                }}
              >
                {store.availableChapters.map(ch => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
              <span className="text-sm">to</span>
              <select 
                className="select select-sm select-bordered w-20"
                value={toChapter}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setToChapter(val);
                  if (val < fromChapter) setFromChapter(val);
                }}
              >
                {store.availableChapters.map(ch => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
              
              {/* Stats badge */}
              <span className="badge badge-sm badge-neutral ml-auto">
                {bulkStats.alreadyAdded}/{bulkStats.totalInRange} added
              </span>
            </div>
            
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-sm btn-success"
                onClick={handleAddChapters}
                disabled={bulkStats.canAdd === 0}
              >
                <Plus className="w-3 h-3" />
                Add {bulkStats.canAdd} words
              </button>
              <button
                className="btn btn-sm btn-error btn-outline"
                onClick={handleRemoveChapters}
                disabled={bulkStats.canRemove === 0}
              >
                <Minus className="w-3 h-3" />
                Remove {bulkStats.canRemove} words
              </button>
            </div>
            
            {/* Quick chapter toggles */}
            <div className="pt-2 border-t border-base-300">
              <div className="text-xs text-base-content/60 mb-2">Quick add by chapter:</div>
              <div className="flex flex-wrap gap-1">
                {chapterStats.map(({ chapter, total, added }) => (
                  <button
                    key={chapter}
                    className={`btn btn-xs ${added === total ? 'btn-success' : added > 0 ? 'btn-warning' : 'btn-ghost'}`}
                    onClick={() => {
                      if (added < total) {
                        store.importChapters(chapter, chapter);
                      }
                    }}
                    disabled={added === total}
                    title={`Chapter ${chapter}: ${added}/${total} words`}
                  >
                    Ch.{chapter}
                    <span className="text-xs opacity-70">
                      {added}/{total}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Filters Row */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1 text-sm text-base-content/60">
            <Filter className="w-4 h-4" />
          </div>
          
          {/* Chapter filter */}
          <select
            className="select select-sm select-bordered bg-base-200"
            value={filterChapter}
            onChange={e => setFilterChapter(e.target.value)}
          >
            <option value="all">All Chapters</option>
            {chapters.map(ch => {
              const chapterTotal = store.concepts.filter(c => c.chapter === ch).length;
              const chapterKnown = store.concepts.filter(c => c.chapter === ch && c.understanding >= 80).length;
              return (
                <option key={ch} value={ch}>
                  Ch. {ch} ({chapterKnown}/{chapterTotal})
                </option>
              );
            })}
          </select>
          
          {/* Mastery filter */}
          <select
            className="select select-sm select-bordered bg-base-200"
            value={filterMastery}
            onChange={e => setFilterMastery(e.target.value as 'all' | 'mastered' | 'studying')}
          >
            <option value="all">All</option>
            <option value="mastered">Mastered</option>
            <option value="studying">Studying</option>
          </select>
          
          {/* Showing count */}
          <span className="badge badge-sm ml-auto">
            {filteredConcepts.length} words
          </span>
        </div>
        
        {/* Mass actions */}
        {filteredConcepts.length > 0 && (
          <div className="flex gap-2 mt-2 pt-2 border-t border-base-300">
            <button 
              className="btn btn-xs btn-outline btn-success"
              onClick={handleMarkAllMastered}
              disabled={filteredMastered === filteredConcepts.length}
            >
              <CheckSquare className="w-3 h-3" />
              Mark all mastered ({filteredConcepts.length - filteredMastered})
            </button>
            <button 
              className="btn btn-xs btn-outline btn-warning"
              onClick={handleResetAllMastery}
              disabled={filteredMastered === 0}
            >
              <Square className="w-3 h-3" />
              Reset mastery ({filteredMastered})
            </button>
          </div>
        )}
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
            <table className="table table-sm table-zebra table-sticky w-full">
              <thead className="text-xs">
                <tr className="bg-base-200">
                  <th 
                    className="cursor-pointer hover:bg-base-300 whitespace-nowrap"
                    onClick={() => handleSort('word')}
                  >
                    <div className="flex items-center gap-1">
                      Char <SortIcon field="word" />
                    </div>
                  </th>
                  <th 
                    className="cursor-pointer hover:bg-base-300 whitespace-nowrap"
                    onClick={() => handleSort('pinyin')}
                  >
                    <div className="flex items-center gap-1">
                      Pinyin <SortIcon field="pinyin" />
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
                    className="cursor-pointer hover:bg-base-300 whitespace-nowrap"
                    onClick={() => handleSort('part_of_speech')}
                  >
                    <div className="flex items-center gap-1">
                      Type <SortIcon field="part_of_speech" />
                    </div>
                  </th>
                  <th 
                    className="cursor-pointer hover:bg-base-300 text-center whitespace-nowrap"
                    onClick={() => handleSort('chapter')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Ch <SortIcon field="chapter" />
                    </div>
                  </th>
                  <th 
                    className="cursor-pointer hover:bg-base-300 text-center whitespace-nowrap"
                    onClick={() => handleSort('understanding')}
                    title="Mastered - tick when you've fully learned this word"
                  >
                    <div className="flex items-center justify-center gap-1">
                      ⭐ <SortIcon field="understanding" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredConcepts.map(concept => (
                  <tr key={concept.id} className="hover">
                    <td>
                      <button 
                        className="hanzi text-xl font-bold hover:text-primary cursor-pointer"
                        onClick={() => setSelectedConcept(concept)}
                      >
                        {concept.word}
                      </button>
                    </td>
                    <td className="pinyin text-sm">{concept.pinyin}</td>
                    <td className="text-sm max-w-[200px] truncate" title={concept.meaning}>
                      {concept.meaning}
                    </td>
                    <td className="text-xs opacity-70">{formatPOS(concept.part_of_speech)}</td>
                    <td className="text-center text-sm">{concept.chapter}</td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-success checkbox-sm"
                        checked={concept.understanding >= 80}
                        onChange={() => store.toggleKnown(concept.id)}
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
          srsRecords={store.getSRSForConcept(selectedConcept.id)}
          onToggleKnown={() => {
            store.toggleKnown(selectedConcept.id);
            const updated = store.concepts.find(c => c.id === selectedConcept.id);
            if (updated) setSelectedConcept(updated);
          }}
          onClose={() => setSelectedConcept(null)}
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
