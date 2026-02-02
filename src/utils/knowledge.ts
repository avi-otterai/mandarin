// Knowledge scoring utilities for modality-based learning

import type { ModalityScore, Modality, ConceptModality, Concept } from '../types/vocabulary';
import type { LearningFocus } from '../types/settings';
import { createDefaultModalityScore } from '../types/vocabulary';

// ═══════════════════════════════════════════════════════════
// INITIAL KNOWLEDGE (Chapter-based Prior)
// ═══════════════════════════════════════════════════════════

/**
 * Calculate initial knowledge based on chapter (word frequency proxy)
 * Earlier chapters = more common words = easier = higher prior
 * 
 * Chapter 1: 70 (你, 好, 您 - very common)
 * Chapter 8: 50 (medium frequency)
 * Chapter 15: 30 (less common)
 */
export function getInitialKnowledge(chapter: number): number {
  // Linear interpolation: chapter 1 → 70, chapter 15 → 30
  const minKnowledge = 30;
  const maxKnowledge = 70;
  const minChapter = 1;
  const maxChapter = 15;
  
  // Clamp chapter to valid range
  const clampedChapter = Math.max(minChapter, Math.min(maxChapter, chapter));
  
  // Interpolate (higher chapter = lower knowledge)
  const ratio = (clampedChapter - minChapter) / (maxChapter - minChapter);
  return Math.round(maxKnowledge - ratio * (maxKnowledge - minKnowledge));
}

/**
 * Create initial modality scores for a new concept
 */
export function createInitialModality(chapter: number): ConceptModality {
  const initialKnowledge = getInitialKnowledge(chapter);
  return {
    character: createDefaultModalityScore(initialKnowledge),
    pinyin: createDefaultModalityScore(initialKnowledge),
    meaning: createDefaultModalityScore(initialKnowledge),
    audio: createDefaultModalityScore(initialKnowledge),
  };
}

// ═══════════════════════════════════════════════════════════
// KNOWLEDGE UPDATE FORMULA
// ═══════════════════════════════════════════════════════════

/**
 * Update modality knowledge after a quiz answer
 * 
 * Asymmetric update:
 * - Correct: Move 25% toward 100 (successes boost confidence)
 * - Incorrect: Move 17.5% toward 0 (mistakes hurt less)
 * 
 * This targets ~70-80% success rate for engaged learning.
 */
export function updateKnowledge(current: number, correct: boolean): number {
  const GAIN_RATE = 0.25;   // How fast we learn from success
  const LOSS_RATE = 0.175;  // How fast we forget from mistakes (70% of gain rate)
  
  let newKnowledge: number;
  
  if (correct) {
    // Move toward 100
    newKnowledge = current + (100 - current) * GAIN_RATE;
  } else {
    // Move toward 0 (but gentler)
    newKnowledge = current - current * LOSS_RATE;
  }
  
  // Clamp to 0-100 and round
  return Math.round(Math.max(0, Math.min(100, newKnowledge)));
}

/**
 * Update a modality score after a quiz answer
 */
export function updateModalityScore(
  current: ModalityScore,
  correct: boolean
): ModalityScore {
  return {
    knowledge: updateKnowledge(current.knowledge, correct),
    attempts: current.attempts + 1,
    successes: current.successes + (correct ? 1 : 0),
    lastAttempt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════
// OVERALL KNOWLEDGE COMPUTATION
// ═══════════════════════════════════════════════════════════

/**
 * Compute overall concept knowledge as weighted average of modalities
 * Weighted by user's Learning Focus settings
 */
export function computeConceptKnowledge(
  modality: ConceptModality,
  learningFocus: LearningFocus
): number {
  const weights = {
    character: learningFocus.character,
    pinyin: learningFocus.pinyin,
    meaning: learningFocus.meaning,
    audio: learningFocus.audio,
  };
  
  // Sum of (knowledge * weight) / sum of weights
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const mod of ['character', 'pinyin', 'meaning', 'audio'] as const) {
    const weight = weights[mod];
    if (weight > 0) {
      weightedSum += modality[mod].knowledge * weight;
      totalWeight += weight;
    }
  }
  
  if (totalWeight === 0) {
    // Fallback: equal weights if all focus levels are 0
    return Math.round(
      (modality.character.knowledge + modality.pinyin.knowledge + 
       modality.meaning.knowledge + modality.audio.knowledge) / 4
    );
  }
  
  return Math.round(weightedSum / totalWeight);
}

// ═══════════════════════════════════════════════════════════
// STATISTICS HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Calculate success rate for a modality (0-100)
 */
export function getSuccessRate(modality: ModalityScore): number {
  if (modality.attempts === 0) return 0;
  return Math.round((modality.successes / modality.attempts) * 100);
}

/**
 * Get average knowledge across all modalities for a concept
 */
export function getAverageKnowledge(modality: ConceptModality): number {
  return Math.round(
    (modality.character.knowledge + modality.pinyin.knowledge + 
     modality.meaning.knowledge + modality.audio.knowledge) / 4
  );
}

/**
 * Compute modality averages across all concepts
 */
export function computeModalityAverages(concepts: Concept[]): Record<Modality, number> {
  if (concepts.length === 0) {
    return { character: 0, pinyin: 0, meaning: 0, audio: 0 };
  }
  
  const sums = { character: 0, pinyin: 0, meaning: 0, audio: 0 };
  
  for (const concept of concepts) {
    sums.character += concept.modality.character.knowledge;
    sums.pinyin += concept.modality.pinyin.knowledge;
    sums.meaning += concept.modality.meaning.knowledge;
    sums.audio += concept.modality.audio.knowledge;
  }
  
  return {
    character: Math.round(sums.character / concepts.length),
    pinyin: Math.round(sums.pinyin / concepts.length),
    meaning: Math.round(sums.meaning / concepts.length),
    audio: Math.round(sums.audio / concepts.length),
  };
}

/**
 * Count concepts by knowledge threshold
 */
export function countByKnowledge(concepts: Concept[]): {
  above80: number;
  above50: number;
  below50: number;
} {
  let above80 = 0;
  let above50 = 0;
  let below50 = 0;
  
  for (const c of concepts) {
    if (c.knowledge >= 80) above80++;
    else if (c.knowledge >= 50) above50++;
    else below50++;
  }
  
  return { above80, above50, below50 };
}

// ═══════════════════════════════════════════════════════════
// PREDICTION (for future calibration)
// ═══════════════════════════════════════════════════════════

/**
 * Predict probability of correct answer for a quiz task
 * Uses the answer modality's knowledge score
 */
export function predictCorrect(concept: Concept, answerModality: Modality): number {
  return concept.modality[answerModality].knowledge;
}
