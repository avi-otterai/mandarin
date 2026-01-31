// Pinyin utilities for comparison and normalization

// Tone number to diacritical mark mapping
const TONE_MARKS: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à', 'a'],
  e: ['ē', 'é', 'ě', 'è', 'e'],
  i: ['ī', 'í', 'ǐ', 'ì', 'i'],
  o: ['ō', 'ó', 'ǒ', 'ò', 'o'],
  u: ['ū', 'ú', 'ǔ', 'ù', 'u'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
};

// Reverse mapping: diacritical to base + tone number
const DIACRITICAL_TO_BASE: Record<string, { base: string; tone: number }> = {};

// Build reverse mapping
Object.entries(TONE_MARKS).forEach(([base, marks]) => {
  marks.forEach((mark, index) => {
    if (mark !== base) {
      DIACRITICAL_TO_BASE[mark] = { base, tone: index + 1 };
    }
  });
});

/**
 * Normalize pinyin: convert toned pinyin to numbered format
 * e.g., "nǐ hǎo" -> "ni3 hao3"
 */
export function toNumbered(pinyin: string): string {
  let result = '';
  let currentTone = 0;
  
  for (const char of pinyin.toLowerCase()) {
    const mapping = DIACRITICAL_TO_BASE[char];
    if (mapping) {
      result += mapping.base;
      currentTone = mapping.tone;
    } else if (char === ' ') {
      // Add tone number before space if we have one
      if (currentTone > 0) {
        result += currentTone.toString();
        currentTone = 0;
      }
      result += ' ';
    } else if (/[a-züv]/.test(char)) {
      result += char === 'v' ? 'ü' : char;
    } else {
      // Non-letter character, add tone number if pending
      if (currentTone > 0) {
        result += currentTone.toString();
        currentTone = 0;
      }
      result += char;
    }
  }
  
  // Add final tone number if pending
  if (currentTone > 0) {
    result += currentTone.toString();
  }
  
  return result.trim();
}

/**
 * Strip all tone information from pinyin
 * e.g., "nǐ hǎo" -> "ni hao", "ni3 hao3" -> "ni hao"
 */
export function stripTones(pinyin: string): string {
  let result = '';
  
  for (const char of pinyin.toLowerCase()) {
    const mapping = DIACRITICAL_TO_BASE[char];
    if (mapping) {
      result += mapping.base;
    } else if (/[a-züv]/.test(char)) {
      result += char === 'v' ? 'ü' : char;
    } else if (!/[1-5]/.test(char)) {
      result += char;
    }
  }
  
  return result.replace(/\s+/g, ' ').trim();
}

/**
 * Check if two pinyin strings match (ignoring tone marks vs numbers)
 * Supports: toned pinyin, numbered pinyin, and toneless comparison
 */
export function pinyinMatch(input: string, expected: string): boolean {
  const normalizedInput = toNumbered(input.trim().toLowerCase());
  const normalizedExpected = toNumbered(expected.trim().toLowerCase());
  
  // Exact match with tones
  if (normalizedInput === normalizedExpected) {
    return true;
  }
  
  // Match without tones (for lenient checking)
  const strippedInput = stripTones(input);
  const strippedExpected = stripTones(expected);
  
  return strippedInput === strippedExpected;
}

/**
 * Check strict pinyin match (must have correct tones)
 */
export function pinyinMatchStrict(input: string, expected: string): boolean {
  const normalizedInput = toNumbered(input.trim().toLowerCase());
  const normalizedExpected = toNumbered(expected.trim().toLowerCase());
  return normalizedInput === normalizedExpected;
}

/**
 * Get tone number from a syllable
 */
export function getTone(syllable: string): number {
  // Check for numbered tone
  const numberMatch = syllable.match(/[1-5]$/);
  if (numberMatch) {
    return parseInt(numberMatch[0]);
  }
  
  // Check for diacritical marks
  for (const char of syllable) {
    const mapping = DIACRITICAL_TO_BASE[char];
    if (mapping) {
      return mapping.tone;
    }
  }
  
  return 5; // Neutral tone
}

/**
 * Split pinyin into syllables
 */
export function splitPinyin(pinyin: string): string[] {
  return pinyin.trim().split(/\s+/);
}
