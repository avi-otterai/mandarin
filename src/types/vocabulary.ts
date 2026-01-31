// Vocabulary types for Chinese learning

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

export interface VocabWord {
  word: string;
  pinyin: string;
  part_of_speech: PartOfSpeech;
  meaning: string;
  chapter: number;
  source: string;
}

export interface Concept extends VocabWord {
  id: string;
  understanding: number;  // 0-100, derived from SRS tiers
  paused: boolean;
}

// SRS types
export type QuestionType = 'pinyin' | 'yes_no' | 'multiple_choice';

export interface SRSRecord {
  id: string;
  conceptId: string;
  questionType: QuestionType;
  tier: number;           // 0-7
  nextReview: string | null;  // ISO date string, null if graduated
  streak: number;
  lapses: number;
}

// Question types for practice
export interface YesNoQuestion {
  type: 'yes_no';
  question: string;
  correctAnswer: boolean;
  explanation: string;
}

export interface MultipleChoiceQuestion {
  type: 'multiple_choice';
  sentence: string;        // Sentence with blank (marked as ___)
  options: string[];       // Array of choices
  correctIndex: number;
}

export interface PinyinQuestion {
  type: 'pinyin';
  word: string;
  correctPinyin: string;
}

export type Question = YesNoQuestion | MultipleChoiceQuestion | PinyinQuestion;

// Store types
export interface UserProgress {
  concepts: Concept[];
  srsRecords: SRSRecord[];
  lastUpdated: string;
}
