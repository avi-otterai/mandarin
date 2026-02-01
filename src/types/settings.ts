// User settings types

export type ThemeType = 'light' | 'dark' | 'wooden' | 'ocean' | 'forest' | 'sunset' | 'sakura' | 'ink';

export type FocusLevel = 0 | 1 | 2 | 3; // 0 = ignore, 1 = low, 2 = medium, 3 = high

export interface LearningFocus {
  character: FocusLevel;  // Hanzi recognition
  pinyin: FocusLevel;     // Pinyin recall
  meaning: FocusLevel;    // English meaning
  audio: FocusLevel;      // Audio/pronunciation
}

export type PinyinDisplay = 'tones' | 'numbers'; // māma vs ma1ma1

export type CharacterSize = 'small' | 'medium' | 'large';

export type AudioProvider = 'browser' | 'elevenlabs';

export interface AudioSettings {
  provider: AudioProvider;
  browserVoiceId: string;      // Voice URI for browser TTS (empty = auto-select)
  speechRate: number;          // 0.5 - 2.0 (1.0 = normal)
  // Future: elevenlabsVoiceId, elevenlabsApiKey
}

export interface UserSettings {
  // Review settings
  cardsPerSession: number;         // 5-50, default 10
  learningFocus: LearningFocus;
  
  // Display preferences
  theme: ThemeType;
  pinyinDisplay: PinyinDisplay;
  characterSize: CharacterSize;
  autoPlayAudio: boolean;          // Auto-play when audio section revealed
  
  // Audio/TTS settings
  audio: AudioSettings;
  
  // Study preferences
  showExampleSentences: boolean;   // When available
  shuffleMode: boolean;            // Randomize card order vs sequential
  
  // Accessibility
  reducedMotion: boolean;          // Disable animations
}

export const DEFAULT_SETTINGS: UserSettings = {
  cardsPerSession: 10,
  learningFocus: {
    character: 2,
    pinyin: 3,
    meaning: 2,
    audio: 1,
  },
  theme: 'dark',
  pinyinDisplay: 'tones',
  characterSize: 'medium',
  autoPlayAudio: false,
  audio: {
    provider: 'browser',
    browserVoiceId: '',  // Auto-select best available
    speechRate: 0.9,     // Slightly slower for learning
  },
  showExampleSentences: true,
  shuffleMode: true,
  reducedMotion: false,
};

// Focus level labels for UI
export const FOCUS_LABELS: Record<FocusLevel, string> = {
  0: 'Skip',
  1: 'Low',
  2: 'Med',
  3: 'High',
};

export const FOCUS_DESCRIPTIONS: Record<keyof LearningFocus, string> = {
  character: 'Test character recognition',
  pinyin: 'Test pinyin recall',
  meaning: 'Test English meaning',
  audio: 'Test pronunciation',
};

export const THEME_META: Record<ThemeType, { name: string; emoji: string; description: string }> = {
  light: { name: 'Light', emoji: '☀️', description: 'Clean & bright' },
  dark: { name: 'Dark', emoji: '🌙', description: 'Easy on the eyes' },
  wooden: { name: 'Wooden', emoji: '📜', description: 'Warm parchment' },
  ocean: { name: 'Ocean', emoji: '🌊', description: 'Deep blue waters' },
  forest: { name: 'Terminal', emoji: '💻', description: 'Hacker green' },
  sunset: { name: 'Sunset', emoji: '🌅', description: 'Golden warmth' },
  sakura: { name: 'Sakura', emoji: '🌸', description: 'Soft pink' },
  ink: { name: 'Ink', emoji: '🖋️', description: 'High contrast B&W' },
};

// Speech rate presets
export const SPEECH_RATE_PRESETS = [
  { value: 0.5, label: '0.5x', description: 'Very Slow' },
  { value: 0.7, label: '0.7x', description: 'Slow' },
  { value: 0.9, label: '0.9x', description: 'Learning' },
  { value: 1.0, label: '1.0x', description: 'Normal' },
  { value: 1.2, label: '1.2x', description: 'Fast' },
  { value: 1.5, label: '1.5x', description: 'Very Fast' },
];
