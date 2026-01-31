import { useState, useMemo, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Download, CheckSquare, Square, Filter } from 'lucide-react';
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
  const [filterKnown, setFilterKnown] = useState<'all' | 'known' | 'learning'>('all');
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
    
    // Known/Learning filter
    if (filterKnown === 'known') {
      result = result.filter(c => c.understanding >= 80);
    } else if (filterKnown === 'learning') {
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
  }, [store.concepts, filterChapter, filterKnown, sortField, sortDir]);
  
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
  const knownCount = store.concepts.filter(c => c.understanding >= 80).length;
  const totalCount = store.concepts.length;
  const filteredKnown = filteredConcepts.filter(c => c.understanding >= 80).length;
  
  // Mass select/unselect for filtered results
  const handleSelectAll = () => {
    filteredConcepts.forEach(c => {
      if (c.understanding < 80) {
        store.toggleKnown(c.id);
      }
    });
  };
  
  const handleUnselectAll = () => {
    filteredConcepts.forEach(c => {
      if (c.understanding >= 80) {
        store.toggleKnown(c.id);
      }
    });
  };
  
  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-base-100/95 backdrop-blur border-b border-base-300 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold">Vocabulary</h1>
            <p className="text-sm text-base-content/60">
              {knownCount} / {totalCount} known
            </p>
          </div>
          {store.concepts.length === 0 && (
            <button 
              className="btn btn-sm btn-primary"
              onClick={store.importHSK1}
            >
              <Download className="w-4 h-4" />
              Import HSK1
            </button>
          )}
        </div>
        
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
          
          {/* Known/Learning filter */}
          <select
            className="select select-sm select-bordered bg-base-200"
            value={filterKnown}
            onChange={e => setFilterKnown(e.target.value as 'all' | 'known' | 'learning')}
          >
            <option value="all">All</option>
            <option value="known">Known only</option>
            <option value="learning">Learning only</option>
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
              onClick={handleSelectAll}
              disabled={filteredKnown === filteredConcepts.length}
            >
              <CheckSquare className="w-3 h-3" />
              Mark all as known ({filteredConcepts.length - filteredKnown})
            </button>
            <button 
              className="btn btn-xs btn-outline btn-warning"
              onClick={handleUnselectAll}
              disabled={filteredKnown === 0}
            >
              <Square className="w-3 h-3" />
              Reset all ({filteredKnown})
            </button>
          </div>
        )}
      </header>
      
      {/* Table */}
      <div className="px-2">
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
          <div className="overflow-x-auto max-h-[calc(100vh-220px)]">
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
                  >
                    <div className="flex items-center justify-center gap-1">
                      ✓ <SortIcon field="understanding" />
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
