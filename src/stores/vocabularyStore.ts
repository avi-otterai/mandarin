// Vocabulary store with localStorage persistence + Supabase cloud sync
// Manages concepts and SRS records

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Concept, SRSRecord, VocabWord, QuestionType } from '../types/vocabulary';
import { 
  calculateUnderstanding, 
  createInitialSRSRecords, 
  recordAnswer as recordSRSAnswer,
  isDue,
  QUESTION_TYPES
} from '../utils/srs';
import { fetchFromCloud, saveToCloud, type SyncResult } from '../lib/syncService';
import hsk1Data from '../data/hsk1_vocabulary.json';

const STORAGE_KEY = 'langseed_progress';
const LAST_SYNC_KEY = 'langseed_last_sync';

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Load progress from localStorage
function loadProgress(): { concepts: Concept[]; srsRecords: SRSRecord[] } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      return {
        concepts: data.concepts || [],
        srsRecords: data.srsRecords || [],
      };
    }
  } catch (e) {
    console.error('Failed to load progress:', e);
  }
  return { concepts: [], srsRecords: [] };
}

// Save progress to localStorage
function saveProgress(concepts: Concept[], srsRecords: SRSRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      concepts,
      srsRecords,
      lastUpdated: new Date().toISOString(),
    }));
  } catch (e) {
    console.error('Failed to save progress:', e);
  }
}

export interface VocabularyStore {
  // Data
  concepts: Concept[];
  srsRecords: SRSRecord[];
  hsk1Vocab: VocabWord[];
  
  // Computed
  knownWords: Set<string>;
  dueCount: number;
  newCount: number;
  
  // Sync state
  isSyncing: boolean;
  syncError: string | null;
  lastSyncTime: string | null;
  hasUnsyncedChanges: boolean;
  
  // Actions
  importHSK1: () => void;
  toggleKnown: (conceptId: string) => void;
  markAsKnown: (word: string) => void;
  initializeSRS: (conceptId: string) => void;
  recordAnswer: (srsId: string, correct: boolean) => void;
  getConceptById: (id: string) => Concept | undefined;
  getSRSForConcept: (conceptId: string) => SRSRecord[];
  getNextPractice: () => { type: 'definition'; concept: Concept } | { type: 'srs'; record: SRSRecord; concept: Concept } | null;
  resetProgress: () => void;
  
  // Cloud sync actions
  syncToCloud: (userId: string) => Promise<SyncResult>;
  loadFromCloud: (userId: string) => Promise<void>;
  clearSyncError: () => void;
}

export function useVocabularyStore(): VocabularyStore {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [srsRecords, setSrsRecords] = useState<SRSRecord[]>([]);
  const [initialized, setInitialized] = useState(false);
  
  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_SYNC_KEY);
    } catch {
      return null;
    }
  });
  const [lastLocalChangeTime, setLastLocalChangeTime] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    const { concepts: loadedConcepts, srsRecords: loadedSRS } = loadProgress();
    setConcepts(loadedConcepts);
    setSrsRecords(loadedSRS);
    setInitialized(true);
  }, []);

  // Save data on change (debounced) and track change time
  useEffect(() => {
    if (initialized) {
      saveProgress(concepts, srsRecords);
      setLastLocalChangeTime(new Date().toISOString());
    }
  }, [concepts, srsRecords, initialized]);
  
  // Track if there are unsynced changes
  const hasUnsyncedChanges = useMemo(() => {
    if (!lastLocalChangeTime) return false;
    if (!lastSyncTime) return concepts.length > 0 || srsRecords.length > 0;
    return new Date(lastLocalChangeTime) > new Date(lastSyncTime);
  }, [lastLocalChangeTime, lastSyncTime, concepts.length, srsRecords.length]);

  // Computed values
  const knownWords = useMemo(() => 
    new Set(concepts.map(c => c.word)),
    [concepts]
  );

  const dueCount = useMemo(() => 
    srsRecords.filter(r => r.tier < 7 && isDue(r)).length,
    [srsRecords]
  );

  const newCount = useMemo(() => 
    concepts.filter(c => !srsRecords.some(r => r.conceptId === c.id)).length,
    [concepts, srsRecords]
  );

  // Actions
  const importHSK1 = useCallback(() => {
    const vocab = hsk1Data as VocabWord[];
    const newConcepts: Concept[] = [];
    
    vocab.forEach(word => {
      if (!knownWords.has(word.word)) {
        newConcepts.push({
          ...word,
          id: generateId(),
          understanding: 0,
          paused: false,
        });
      }
    });
    
    setConcepts(prev => [...prev, ...newConcepts]);
  }, [knownWords]);

  const toggleKnown = useCallback((conceptId: string) => {
    setConcepts(prev => prev.map(c => {
      if (c.id !== conceptId) return c;
      const newUnderstanding = c.understanding >= 80 ? 0 : 100;
      return { ...c, understanding: newUnderstanding };
    }));
    
    // Also update SRS records for this concept
    setSrsRecords(prev => {
      const conceptRecords = prev.filter(r => r.conceptId === conceptId);
      if (conceptRecords.length === 0) {
        // Create graduated SRS records for "known" status
        const concept = concepts.find(c => c.id === conceptId);
        if (concept && concept.understanding < 80) {
          // Marking as known - create tier 7 records
          return [...prev, ...QUESTION_TYPES.map(qt => ({
            id: generateId(),
            conceptId,
            questionType: qt as QuestionType,
            tier: 7,
            nextReview: null,
            streak: 0,
            lapses: 0,
          }))];
        }
      } else {
        // Toggle existing records
        const currentTier = conceptRecords[0].tier;
        const newTier = currentTier >= 7 ? 0 : 7;
        return prev.map(r => {
          if (r.conceptId !== conceptId) return r;
          return {
            ...r,
            tier: newTier,
            nextReview: newTier >= 7 ? null : new Date().toISOString(),
          };
        });
      }
      return prev;
    });
  }, [concepts]);

  const markAsKnown = useCallback((word: string) => {
    const vocab = hsk1Data as VocabWord[];
    const wordData = vocab.find(v => v.word === word);
    
    if (!wordData || knownWords.has(word)) return;
    
    const conceptId = generateId();
    const newConcept: Concept = {
      ...wordData,
      id: conceptId,
      understanding: 100,
      paused: false,
    };
    
    setConcepts(prev => [...prev, newConcept]);
    
    // Create graduated SRS records
    const newSRS: SRSRecord[] = QUESTION_TYPES.map(qt => ({
      id: generateId(),
      conceptId,
      questionType: qt as QuestionType,
      tier: 7,
      nextReview: null,
      streak: 0,
      lapses: 0,
    }));
    
    setSrsRecords(prev => [...prev, ...newSRS]);
  }, [knownWords]);

  const initializeSRS = useCallback((conceptId: string) => {
    // Check if SRS records already exist
    const existingRecords = srsRecords.filter(r => r.conceptId === conceptId);
    if (existingRecords.length > 0) return;
    
    // Create new SRS records at tier 0
    const newRecords = createInitialSRSRecords(conceptId).map(r => ({
      ...r,
      id: generateId(),
    }));
    
    setSrsRecords(prev => [...prev, ...newRecords]);
    
    // Update concept understanding
    setConcepts(prev => prev.map(c => {
      if (c.id !== conceptId) return c;
      return { ...c, understanding: calculateUnderstanding(newRecords as SRSRecord[]) };
    }));
  }, [srsRecords]);

  const recordAnswer = useCallback((srsId: string, correct: boolean) => {
    setSrsRecords(prev => {
      const updated = prev.map(r => {
        if (r.id !== srsId) return r;
        return recordSRSAnswer(r, correct);
      });
      
      // Update concept understanding
      const record = updated.find(r => r.id === srsId);
      if (record) {
        const conceptRecords = updated.filter(r => r.conceptId === record.conceptId);
        const newUnderstanding = calculateUnderstanding(conceptRecords);
        
        setConcepts(c => c.map(concept => {
          if (concept.id !== record.conceptId) return concept;
          return { ...concept, understanding: newUnderstanding };
        }));
      }
      
      return updated;
    });
  }, []);

  const getConceptById = useCallback((id: string) => 
    concepts.find(c => c.id === id),
    [concepts]
  );

  const getSRSForConcept = useCallback((conceptId: string) => 
    srsRecords.filter(r => r.conceptId === conceptId),
    [srsRecords]
  );

  const getNextPractice = useCallback(() => {
    // Priority 1: Due SRS reviews
    const dueRecords = srsRecords
      .filter(r => r.tier < 7 && isDue(r))
      .sort((a, b) => {
        if (!a.nextReview) return 1;
        if (!b.nextReview) return -1;
        return new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime();
      });
    
    if (dueRecords.length > 0) {
      const record = dueRecords[0];
      const concept = concepts.find(c => c.id === record.conceptId);
      if (concept && !concept.paused) {
        return { type: 'srs' as const, record, concept };
      }
    }
    
    // Priority 2: New definitions (concepts without SRS records)
    const conceptsWithoutSRS = concepts.filter(c => 
      !c.paused && !srsRecords.some(r => r.conceptId === c.id)
    );
    
    if (conceptsWithoutSRS.length > 0) {
      return { type: 'definition' as const, concept: conceptsWithoutSRS[0] };
    }
    
    return null;
  }, [concepts, srsRecords]);

  const resetProgress = useCallback(() => {
    setConcepts([]);
    setSrsRecords([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Cloud sync: Save to Supabase
  const syncToCloud = useCallback(async (userId: string): Promise<SyncResult> => {
    setIsSyncing(true);
    setSyncError(null);
    
    try {
      const result = await saveToCloud(userId, concepts, srsRecords);
      
      if (result.success) {
        const now = new Date().toISOString();
        setLastSyncTime(now);
        localStorage.setItem(LAST_SYNC_KEY, now);
      } else {
        setSyncError(result.error || 'Sync failed');
      }
      
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setSyncError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsSyncing(false);
    }
  }, [concepts, srsRecords]);

  // Cloud sync: Load from Supabase
  const loadFromCloud = useCallback(async (userId: string): Promise<void> => {
    setIsSyncing(true);
    setSyncError(null);
    
    try {
      const { concepts: cloudConcepts, srsRecords: cloudSRS, error } = await fetchFromCloud(userId);
      
      if (error) {
        setSyncError(error);
        return;
      }
      
      // If cloud has data, use it; otherwise keep local data
      if (cloudConcepts.length > 0 || cloudSRS.length > 0) {
        setConcepts(cloudConcepts);
        setSrsRecords(cloudSRS);
        
        const now = new Date().toISOString();
        setLastSyncTime(now);
        localStorage.setItem(LAST_SYNC_KEY, now);
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to load from cloud');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const clearSyncError = useCallback(() => {
    setSyncError(null);
  }, []);

  return {
    concepts,
    srsRecords,
    hsk1Vocab: hsk1Data as VocabWord[],
    knownWords,
    dueCount,
    newCount,
    // Sync state
    isSyncing,
    syncError,
    lastSyncTime,
    hasUnsyncedChanges,
    // Actions
    importHSK1,
    toggleKnown,
    markAsKnown,
    initializeSRS,
    recordAnswer,
    getConceptById,
    getSRSForConcept,
    getNextPractice,
    resetProgress,
    // Cloud sync
    syncToCloud,
    loadFromCloud,
    clearSyncError,
  };
}
