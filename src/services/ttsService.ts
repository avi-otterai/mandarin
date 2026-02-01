// Text-to-Speech Service - Browser Speech API implementation
// Provides Chinese pronunciation for vocabulary words

export interface TTSVoice {
  id: string;           // Unique voice URI
  name: string;         // Display name
  lang: string;         // Language code (zh-CN, zh-TW, etc.)
  gender?: 'male' | 'female' | 'unknown';
  localService: boolean; // True if offline-capable
}

export interface TTSOptions {
  rate?: number;        // 0.1 - 10 (default 1.0)
  pitch?: number;       // 0 - 2 (default 1.0)
  volume?: number;      // 0 - 1 (default 1.0)
  voiceId?: string;     // Voice URI to use
}

// Singleton state
let cachedVoices: TTSVoice[] = [];
let voicesLoaded = false;
let voiceLoadPromise: Promise<TTSVoice[]> | null = null;

// Check if browser supports Speech Synthesis
export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 
         'speechSynthesis' in window &&
         'SpeechSynthesisUtterance' in window;
}

// Get available Chinese voices
export async function getChineseVoices(): Promise<TTSVoice[]> {
  if (!isTTSSupported()) {
    return [];
  }

  // Return cached if already loaded
  if (voicesLoaded && cachedVoices.length > 0) {
    return cachedVoices;
  }

  // If already loading, wait for it
  if (voiceLoadPromise) {
    return voiceLoadPromise;
  }

  // Load voices (they may load async on some browsers)
  voiceLoadPromise = new Promise((resolve) => {
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      
      // Filter for Chinese voices
      const chineseVoices = allVoices
        .filter(v => v.lang.startsWith('zh') || v.lang.includes('Chinese'))
        .map(v => ({
          id: v.voiceURI,
          name: formatVoiceName(v.name, v.lang),
          lang: v.lang,
          gender: guessGender(v.name),
          localService: v.localService,
        }));

      cachedVoices = chineseVoices;
      voicesLoaded = true;
      resolve(chineseVoices);
    };

    // Some browsers load voices async
    if (window.speechSynthesis.getVoices().length > 0) {
      loadVoices();
    } else {
      window.speechSynthesis.onvoiceschanged = loadVoices;
      // Timeout fallback
      setTimeout(() => {
        if (!voicesLoaded) {
          loadVoices();
        }
      }, 1000);
    }
  });

  return voiceLoadPromise;
}

// Format voice name for display
function formatVoiceName(name: string, lang: string): string {
  // Clean up common prefixes
  let displayName = name
    .replace('Microsoft ', '')
    .replace('Google ', '')
    .replace('Apple ', '')
    .replace(' Online (Natural)', '')
    .replace(' (Natural)', '');
  
  // Add language hint
  const langHint = lang === 'zh-TW' ? '(Taiwan)' : 
                   lang === 'zh-HK' ? '(HK)' : 
                   lang === 'zh-CN' ? '(Mainland)' : '';
  
  if (langHint && !displayName.includes(langHint)) {
    displayName = `${displayName} ${langHint}`;
  }
  
  return displayName;
}

// Guess gender from voice name (heuristic)
function guessGender(name: string): 'male' | 'female' | 'unknown' {
  const lowerName = name.toLowerCase();
  
  // Common female names in TTS
  const femaleIndicators = ['female', 'woman', 'xiaoxiao', 'xiaoyi', 'xiaomo', 'yunxi', 
    'huihui', 'yaoyao', 'tingting', 'ting-ting', 'meijia', 'siqi'];
  
  // Common male names in TTS
  const maleIndicators = ['male', 'man', 'yunyang', 'yunze', 'yunjian', 'kangkang'];
  
  if (femaleIndicators.some(f => lowerName.includes(f))) return 'female';
  if (maleIndicators.some(m => lowerName.includes(m))) return 'male';
  
  return 'unknown';
}

// Get the native SpeechSynthesisVoice by URI
function getNativeVoice(voiceId: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find(v => v.voiceURI === voiceId) || null;
}

// Speak text with Chinese TTS
export async function speak(
  text: string, 
  options: TTSOptions = {}
): Promise<void> {
  if (!isTTSSupported()) {
    console.warn('TTS not supported in this browser');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  
  // Ensure voices are loaded first
  const chineseVoices = await getChineseVoices();
  
  // Set voice - try specified voice first, fall back to best Chinese voice
  let selectedVoice: SpeechSynthesisVoice | null = null;
  
  if (options.voiceId) {
    selectedVoice = getNativeVoice(options.voiceId);
  }
  
  // Fall back to first Chinese voice if specified voice not found
  if (!selectedVoice && chineseVoices.length > 0) {
    selectedVoice = getNativeVoice(chineseVoices[0].id);
  }
  
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  // Apply options
  utterance.rate = options.rate ?? 0.9;  // Slightly slower for learning
  utterance.pitch = options.pitch ?? 1.0;
  utterance.volume = options.volume ?? 1.0;
  utterance.lang = 'zh-CN';  // Ensure Chinese interpretation

  return new Promise((resolve, reject) => {
    utterance.onend = () => resolve();
    utterance.onerror = (event) => {
      // Ignore 'canceled' errors (happens when we call cancel())
      if (event.error === 'canceled') {
        resolve();
      } else {
        reject(new Error(`TTS error: ${event.error}`));
      }
    };
    
    window.speechSynthesis.speak(utterance);
  });
}

// Stop any ongoing speech
export function stopSpeaking(): void {
  if (isTTSSupported()) {
    window.speechSynthesis.cancel();
  }
}

// Check if currently speaking
export function isSpeaking(): boolean {
  if (!isTTSSupported()) return false;
  return window.speechSynthesis.speaking;
}

// Get the best default voice (prefer zh-CN, female, local)
export async function getDefaultVoice(): Promise<TTSVoice | null> {
  const voices = await getChineseVoices();
  if (voices.length === 0) return null;

  // Priority: zh-CN > zh-TW > other
  // Then: local > online
  // Then: female > unknown > male (arbitrary preference for language learning)
  
  const sorted = [...voices].sort((a, b) => {
    // Language priority
    const langOrder = (lang: string) => {
      if (lang === 'zh-CN') return 0;
      if (lang === 'zh-TW') return 1;
      return 2;
    };
    const langDiff = langOrder(a.lang) - langOrder(b.lang);
    if (langDiff !== 0) return langDiff;

    // Local service priority
    if (a.localService && !b.localService) return -1;
    if (!a.localService && b.localService) return 1;

    return 0;
  });

  return sorted[0];
}

// Export a hook-friendly version for React components
export function createTTSPlayer() {
  let currentOptions: TTSOptions = {};

  return {
    setOptions(options: TTSOptions) {
      currentOptions = { ...currentOptions, ...options };
    },
    
    async play(text: string, overrides?: TTSOptions) {
      await speak(text, { ...currentOptions, ...overrides });
    },
    
    stop() {
      stopSpeaking();
    },
    
    get isSpeaking() {
      return isSpeaking();
    }
  };
}
