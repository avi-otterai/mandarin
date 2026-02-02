// Vocabulary types for Chinese learning

// ═══════════════════════════════════════════════════════════
// BASE TYPES
// ═══════════════════════════════════════════════════════════

export type PartOfSpeech = 
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'pronoun'
  | 'preposition'
  | 'conjunction'
  | 'particle'
  | 'numeral'
  | 'measure_word'
  | 'interjection'
  | 'other';

// The 4 learning modalities
export type Modality = 'character' | 'pinyin' | 'meaning' | 'audio';

export const MODALITIES: Modality[] = ['character', 'pinyin', 'meaning', 'audio'];

// All 12 quiz task types (modality → modality, excluding same-to-same)
export type QuizTaskType = 
  | 'character_to_pinyin' | 'character_to_meaning' | 'character_to_audio'
  | 'pinyin_to_character' | 'pinyin_to_meaning' | 'pinyin_to_audio'
  | 'meaning_to_character' | 'meaning_to_pinyin' | 'meaning_to_audio'
  | 'audio_to_character' | 'audio_to_pinyin' | 'audio_to_meaning';

// Generate all valid task types
export const QUIZ_TASK_TYPES: QuizTaskType[] = MODALITIES.flatMap(from =>
  MODALITIES.filter(to => to !== from).map(to => `${from}_to_${to}` as QuizTaskType)
);

// ═══════════════════════════════════════════════════════════
// VOCAB WORD (from HSK1 JSON)
// ═══════════════════════════════════════════════════════════

export interface VocabWord {
  word: string;
  pinyin: string;
  part_of_speech: PartOfSpeech;
  meaning: string;
  chapter: number;
  source: string;
}

// ═══════════════════════════════════════════════════════════
// MODALITY SCORE (per modality per concept)
// ═══════════════════════════════════════════════════════════

export interface ModalityScore {
  knowledge: number;      // 0-100, probability of recall
  attempts: number;       // Total quiz attempts for this modality
  successes: number;      // Correct answers count
  lastAttempt: string | null;  // ISO timestamp
}

// Default modality score for new words
export function createDefaultModalityScore(initialKnowledge: number): ModalityScore {
  return {
    knowledge: initialKnowledge,
    attempts: 0,
    successes: 0,
    lastAttempt: null,
  };
}

// ═══════════════════════════════════════════════════════════
// CONCEPT (User's vocabulary item with knowledge tracking)
// ═══════════════════════════════════════════════════════════

export interface ConceptModality {
  character: ModalityScore;
  pinyin: ModalityScore;
  meaning: ModalityScore;
  audio: ModalityScore;
}

export interface Concept extends VocabWord {
  id: string;
  
  // Per-modality knowledge scores
  modality: ConceptModality;
  
  // Computed: weighted average of modality.*.knowledge
  knowledge: number;
  
  // User can pause a word from appearing in quiz/study
  paused: boolean;
}

// ═══════════════════════════════════════════════════════════
// QUIZ ATTEMPT (stored to Supabase on each answer)
// ═══════════════════════════════════════════════════════════

export interface QuizAttempt {
  id: string;
  userId: string;
  timestamp: string;  // ISO
  
  // The question
  conceptId: string;
  questionModality: Modality;
  answerModality: Modality;
  
  // The 4 options shown (first one is always correct answer before shuffle)
  optionConceptIds: [string, string, string, string];
  
  // User's response (0-3 index of selected option)
  selectedIndex: 0 | 1 | 2 | 3;
  correct: boolean;
  
  // For future calibration tracking
  predictedCorrect: number;  // 0-100, what we expected
}

// ═══════════════════════════════════════════════════════════
// QUIZ SESSION (current session state)
// ═══════════════════════════════════════════════════════════

export interface QuizQuestion {
  concept: Concept;
  taskType: QuizTaskType;
  questionModality: Modality;
  answerModality: Modality;
  options: Concept[];  // 4 options, shuffled
  correctIndex: number;  // Index of correct answer after shuffle
}

export interface QuizSession {
  questions: QuizQuestion[];
  currentIndex: number;
  answers: Array<{
    questionIndex: number;
    selectedIndex: number;
    correct: boolean;
    timestamp: string;
  }>;
  startedAt: string;
  completedAt: string | null;
}

// ═══════════════════════════════════════════════════════════
// PROGRESS SNAPSHOT (for timeline charts)
// ═══════════════════════════════════════════════════════════

export interface ProgressSnapshot {
  timestamp: string;  // ISO
  
  // Counts at this moment
  totalWords: number;
  wordsAbove50: number;   // knowledge > 50
  wordsAbove80: number;   // knowledge > 80 ("confident")
  
  // Average knowledge per modality
  avgKnowledge: {
    character: number;
    pinyin: number;
    meaning: number;
    audio: number;
  };
  
  // Quiz stats (session)
  sessionAttempts: number;
  sessionCorrect: number;
}

export interface ProgressCache {
  snapshots: ProgressSnapshot[];
  lastUpdated: string;
}

// ═══════════════════════════════════════════════════════════
// STORE TYPES
// ═══════════════════════════════════════════════════════════

export interface UserProgress {
  concepts: Concept[];
  lastUpdated: string;
}

// ═══════════════════════════════════════════════════════════
// UTILITY TYPE HELPERS
// ═══════════════════════════════════════════════════════════

// Parse task type into question and answer modalities
export function parseTaskType(taskType: QuizTaskType): { question: Modality; answer: Modality } {
  const [question, , answer] = taskType.split('_') as [Modality, string, Modality];
  return { question, answer };
}

// Create task type from modalities
export function createTaskType(question: Modality, answer: Modality): QuizTaskType {
  return `${question}_to_${answer}` as QuizTaskType;
}

// Modality display info
export const MODALITY_INFO: Record<Modality, { label: string; emoji: string; description: string }> = {
  character: { label: 'Character', emoji: '📝', description: 'Chinese characters (汉字)' },
  pinyin: { label: 'Pinyin', emoji: '🔤', description: 'Romanized pronunciation' },
  meaning: { label: 'Meaning', emoji: '💬', description: 'English translation' },
  audio: { label: 'Audio', emoji: '🔊', description: 'Spoken pronunciation' },
};
