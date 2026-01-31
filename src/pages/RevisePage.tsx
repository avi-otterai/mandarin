import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Volume2, ChevronLeft, ChevronRight, Shuffle } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { VocabularyStore } from '../stores/vocabularyStore';
import type { SettingsStore } from '../stores/settingsStore';
import type { Concept } from '../types/vocabulary';
import type { FocusLevel } from '../types/settings';

const LAST_REVIEW_KEY = 'langseed_last_review';

interface RevisePageProps {
  store: VocabularyStore;
  settingsStore?: SettingsStore;
}

// Field types that can be revealed/hidden
type RevealField = 'character' | 'pinyin' | 'meaning' | 'audio';

// Convert focus level (0-3) to weight for probability calculation
// 0 = skip (never reveal), 3 = high priority (most likely to reveal)
function focusToWeight(level: FocusLevel): number {
  const weightMap: Record<FocusLevel, number> = {
    0: 0,    // Skip - never auto-reveal this field
    1: 15,   // Low priority
    2: 35,   // Medium priority
    3: 50,   // High priority
  };
  return weightMap[level];
}

interface FlashcardState {
  revealed: Record<Exclude<RevealField, 'audio'>, boolean> & { audio: boolean };
  initiallyRevealed: RevealField;
}

// Pick which field to reveal based on weights
function pickRevealedField(weights: Record<RevealField, number>): RevealField {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let random = Math.random() * total;
  
  for (const [field, weight] of Object.entries(weights)) {
    random -= weight;
    if (random <= 0) {
      return field as RevealField;
    }
  }
  return 'pinyin'; // fallback
}

// Shuffle array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Fire confetti celebration - big burst then sustained side cannons
function fireConfetti() {
  // Initial big burst from center
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181', '#a29bfe', '#fd79a8'],
    zIndex: 9999,
  });

  // Side cannons for 2 seconds
  const duration = 2000;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ['#ff6b6b', '#4ecdc4', '#ffe66d'],
      zIndex: 9999,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ['#95e1d3', '#f38181', '#a29bfe'],
      zIndex: 9999,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };
  frame();
}

// Check if reviewed today
export function hasReviewedToday(): boolean {
  try {
    const lastReview = localStorage.getItem(LAST_REVIEW_KEY);
    if (!lastReview) return false;
    
    const lastDate = new Date(lastReview);
    const today = new Date();
    
    return lastDate.toDateString() === today.toDateString();
  } catch {
    return false;
  }
}

// Mark today as reviewed
function markReviewedToday() {
  localStorage.setItem(LAST_REVIEW_KEY, new Date().toISOString());
}

export function RevisePage({ store, settingsStore }: RevisePageProps) {
  // Session words - randomly selected from known words
  const [sessionWords, setSessionWords] = useState<Concept[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardStates, setCardStates] = useState<Map<string, FlashcardState>>(new Map());
  const [sessionComplete, setSessionComplete] = useState(false);
  const confettiFiredRef = useRef(false);
  
  // Get settings with defaults
  const settings = settingsStore?.settings;
  const cardsPerSession = settings?.cardsPerSession ?? 10;
  const shuffleMode = settings?.shuffleMode ?? true;
  
  // Build reveal weights from settings
  const revealWeights = useMemo((): Record<RevealField, number> => {
    if (!settings) {
      // Default weights if no settings available
      return {
        pinyin: 50,
        meaning: 35,
        character: 15,
        audio: 0,
      };
    }
    return {
      character: focusToWeight(settings.learningFocus.character),
      pinyin: focusToWeight(settings.learningFocus.pinyin),
      meaning: focusToWeight(settings.learningFocus.meaning),
      audio: focusToWeight(settings.learningFocus.audio),
    };
  }, [settings]);
  
  // Get known words (words user has added to study, not fully mastered)
  // "Known" = in the user's study list, regardless of mastery level
  const knownWords = useMemo(() => {
    return store.concepts.filter(c => !c.paused);
  }, [store.concepts]);

  // Initialize a new revision session
  const startNewSession = useCallback(() => {
    const wordList = shuffleMode ? shuffleArray(knownWords) : knownWords;
    const selected = wordList.slice(0, cardsPerSession);
    setSessionWords(selected);
    setCurrentIndex(0);
    
    // Initialize card states with random reveal for each word based on settings
    const newStates = new Map<string, FlashcardState>();
    selected.forEach(word => {
      const revealField = pickRevealedField(revealWeights);
      newStates.set(word.id, {
        revealed: {
          character: revealField === 'character',
          pinyin: revealField === 'pinyin',
          meaning: revealField === 'meaning',
          audio: false, // Audio never auto-revealed (requires user interaction)
        },
        initiallyRevealed: revealField,
      });
    });
    setCardStates(newStates);
  }, [knownWords, cardsPerSession, shuffleMode, revealWeights]);

  // Start session on mount or when words change
  useEffect(() => {
    if (knownWords.length > 0 && sessionWords.length === 0) {
      startNewSession();
    }
  }, [knownWords, sessionWords.length, startNewSession]);

  // Current word
  const currentWord = sessionWords[currentIndex];
  const currentState = currentWord ? cardStates.get(currentWord.id) : null;

  // Toggle reveal state for a field
  const toggleReveal = useCallback((field: RevealField) => {
    if (!currentWord) return;
    
    setCardStates(prev => {
      const newStates = new Map(prev);
      const current = newStates.get(currentWord.id);
      if (current) {
        newStates.set(currentWord.id, {
          ...current,
          revealed: {
            ...current.revealed,
            [field]: !current.revealed[field],
          },
        });
      }
      return newStates;
    });
  }, [currentWord]);

  // Reveal all fields
  const revealAll = useCallback(() => {
    if (!currentWord) return;
    
    setCardStates(prev => {
      const newStates = new Map(prev);
      const current = newStates.get(currentWord.id);
      if (current) {
        newStates.set(currentWord.id, {
          ...current,
          revealed: {
            character: true,
            pinyin: true,
            meaning: true,
            audio: true,
          },
        });
      }
      return newStates;
    });
  }, [currentWord]);

  // Check if all fields are revealed
  const allRevealed = currentState && 
    currentState.revealed.character && 
    currentState.revealed.pinyin && 
    currentState.revealed.meaning && 
    currentState.revealed.audio;

  // Navigation
  const goNext = useCallback(() => {
    if (currentIndex < sessionWords.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, sessionWords.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  // Handle audio play (placeholder - will show toast that audio is unavailable)
  const handlePlayAudio = useCallback(() => {
    // TODO: Implement TTS or audio file playback
    // For now, this is just a placeholder
  }, []);

  // Check if audio is available (always false for now)
  const isAudioAvailable = false;

  // Session complete - fire confetti and mark as reviewed today
  useEffect(() => {
    if (sessionComplete && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      markReviewedToday();
      // Small delay to ensure DOM is ready
      setTimeout(() => fireConfetti(), 100);
    }
  }, [sessionComplete]);
  
  // Detect session completion
  useEffect(() => {
    if (sessionWords.length > 0 && currentIndex >= sessionWords.length && !sessionComplete) {
      setSessionComplete(true);
    }
  }, [currentIndex, sessionWords.length, sessionComplete]);

  // No words to study
  if (knownWords.length === 0) {
    return (
      <div className="min-h-screen pb-20">
        <header className="sticky top-0 z-20 bg-base-100/95 backdrop-blur border-b border-base-300 px-4 py-3">
          <h1 className="text-xl font-bold text-center">Revise</h1>
        </header>
        
        <div className="p-4 max-w-lg mx-auto">
          <div className="card bg-base-200">
            <div className="card-body items-center text-center py-12">
              <div className="text-6xl mb-4">📚</div>
              <h2 className="text-2xl font-bold">No Words Yet</h2>
              <p className="text-base-content/60 mt-2">
                Add some words from the Vocabulary tab to start revising.
              </p>
              <p className="text-sm text-base-content/40 mt-4">
                Go to Vocabulary → Add chapters or mark individual words to study.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Session complete screen
  if (sessionComplete) {
    return (
      <div className="min-h-screen pb-20">
        <header className="sticky top-0 z-20 bg-base-100/95 backdrop-blur border-b border-base-300 px-4 py-3">
          <h1 className="text-xl font-bold text-center">Revise</h1>
        </header>
        
        <div className="p-4 max-w-lg mx-auto">
          <div className="card bg-base-200">
            <div className="card-body items-center text-center py-12">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold">Session Complete!</h2>
              <p className="text-base-content/60 mt-2">
                You reviewed {sessionWords.length} words.
              </p>
              <button 
                className="btn btn-primary mt-6"
                onClick={() => {
                  confettiFiredRef.current = false;
                  setSessionComplete(false);
                  startNewSession();
                }}
              >
                <Shuffle className="w-5 h-5" />
                Start New Session
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main flashcard view
  return (
    <div className="h-screen pb-20 bg-gradient-to-b from-base-100 to-base-200 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-base-100/95 backdrop-blur border-b border-base-300 px-4 py-2">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className="text-lg font-bold">Revise</h1>
          <button 
            className="btn btn-sm btn-ghost"
            onClick={startNewSession}
            title="Shuffle new words"
          >
            <Shuffle className="w-4 h-4" />
          </button>
        </div>
        
        {/* Progress indicator */}
        <div className="max-w-lg mx-auto mt-1">
          <div className="flex items-center gap-2 text-sm text-base-content/60">
            <span>{currentIndex + 1} / {sessionWords.length}</span>
            <progress 
              className="progress progress-primary flex-1 h-1.5" 
              value={currentIndex + 1} 
              max={sessionWords.length}
            />
          </div>
        </div>
      </header>

      {/* Flashcard */}
      <div className="flex-1 p-4 max-w-lg mx-auto w-full flex flex-col justify-center min-h-0">
        {currentWord && currentState && (
          <div className="card bg-base-200 shadow-xl border border-base-300">
            <div className="card-body gap-4 py-5 px-5">
              
              {/* Character Section */}
              <div 
                className="cursor-pointer select-none"
                onClick={() => toggleReveal('character')}
              >
                <span className="text-xs font-medium text-base-content/50 uppercase tracking-wider mb-1 block">
                  Character
                </span>
                <div className={`
                  text-center h-24 flex items-center justify-center rounded-xl transition-all duration-300
                  ${currentState.revealed.character 
                    ? 'bg-primary/10 border-2 border-primary/30' 
                    : 'bg-base-300 border-2 border-dashed border-base-content/20 hover:border-primary/40'}
                `}>
                  {currentState.revealed.character ? (
                    <span className="hanzi hanzi-scalable font-bold text-primary">
                      {currentWord.word}
                    </span>
                  ) : (
                    <span className="text-4xl text-base-content/20">?</span>
                  )}
                </div>
              </div>

              {/* Pinyin Section */}
              <div 
                className="cursor-pointer select-none"
                onClick={() => toggleReveal('pinyin')}
              >
                <span className="text-xs font-medium text-base-content/50 uppercase tracking-wider mb-1 block">
                  Pinyin
                </span>
                <div className={`
                  text-center h-16 flex items-center justify-center rounded-xl transition-all duration-300
                  ${currentState.revealed.pinyin 
                    ? 'bg-secondary/10 border-2 border-secondary/30' 
                    : 'bg-base-300 border-2 border-dashed border-base-content/20 hover:border-secondary/40'}
                `}>
                  {currentState.revealed.pinyin ? (
                    <span className="pinyin text-2xl text-secondary">
                      {currentWord.pinyin}
                    </span>
                  ) : (
                    <span className="text-3xl text-base-content/20">?</span>
                  )}
                </div>
              </div>

              {/* Meaning Section */}
              <div 
                className="cursor-pointer select-none"
                onClick={() => toggleReveal('meaning')}
              >
                <span className="text-xs font-medium text-base-content/50 uppercase tracking-wider mb-1 block">
                  Meaning
                </span>
                <div className={`
                  text-center h-16 flex items-center justify-center rounded-xl transition-all duration-300
                  ${currentState.revealed.meaning 
                    ? 'bg-accent/10 border-2 border-accent/30' 
                    : 'bg-base-300 border-2 border-dashed border-base-content/20 hover:border-accent/40'}
                `}>
                  {currentState.revealed.meaning ? (
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-lg font-medium leading-tight">{currentWord.meaning}</p>
                      <p className="text-xs text-base-content/60">
                        {currentWord.part_of_speech} · Ch. {currentWord.chapter}
                      </p>
                    </div>
                  ) : (
                    <span className="text-3xl text-base-content/20">?</span>
                  )}
                </div>
              </div>

              {/* Audio Section */}
              <div 
                className="cursor-pointer select-none"
                onClick={() => toggleReveal('audio')}
              >
                <span className="text-xs font-medium text-base-content/50 uppercase tracking-wider mb-1 block">
                  Audio
                </span>
                <div className={`
                  text-center h-16 flex items-center justify-center rounded-xl transition-all duration-300
                  ${currentState.revealed.audio 
                    ? 'bg-info/10 border-2 border-info/30' 
                    : 'bg-base-300 border-2 border-dashed border-base-content/20 hover:border-info/40'}
                `}>
                  {currentState.revealed.audio ? (
                    <button
                      className={`btn btn-circle btn-lg ${isAudioAvailable ? 'btn-info' : 'btn-ghost opacity-40 cursor-not-allowed'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isAudioAvailable) handlePlayAudio();
                      }}
                      disabled={!isAudioAvailable}
                      title={isAudioAvailable ? 'Play audio' : 'Audio coming soon'}
                    >
                      <Volume2 className="w-6 h-6" />
                    </button>
                  ) : (
                    <span className="text-3xl text-base-content/20">?</span>
                  )}
                </div>
              </div>

              {/* Reveal all button */}
              <button 
                className={`btn btn-xs btn-ghost ${allRevealed ? 'opacity-30 cursor-not-allowed' : 'text-base-content/50'}`}
                onClick={revealAll}
                disabled={!!allRevealed}
              >
                Show all
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4 shrink-0">
          <button 
            className={`btn btn-circle ${currentIndex === 0 ? 'btn-disabled' : 'btn-primary btn-outline'}`}
            onClick={goPrev}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex gap-1.5">
            {sessionWords.map((_, idx) => (
              <button
                key={idx}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentIndex 
                    ? 'bg-primary w-5' 
                    : idx < currentIndex
                    ? 'bg-primary/50'
                    : 'bg-base-content/20'
                }`}
                onClick={() => setCurrentIndex(idx)}
              />
            ))}
          </div>
          
          <button 
            className="btn btn-circle btn-primary"
            onClick={goNext}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Hint text */}
        <p className="text-center text-xs text-base-content/40 mt-3 shrink-0">
          Tap any section to reveal/hide
        </p>
      </div>
    </div>
  );
}
