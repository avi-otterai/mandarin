// SRS (Spaced Repetition System) logic
// Tier-based system: 0-7 tiers with increasing intervals

import type { SRSRecord, QuestionType } from '../types/vocabulary';

// Tier intervals in minutes
const TIER_INTERVALS_MINUTES: (number | null)[] = [
  10,      // Tier 0: 10 minutes
  60,      // Tier 1: 1 hour
  480,     // Tier 2: 8 hours
  1440,    // Tier 3: 1 day
  4320,    // Tier 4: 3 days
  10080,   // Tier 5: 7 days
  43200,   // Tier 6: 30 days
  null,    // Tier 7: Graduated (no more reviews)
];

export const QUESTION_TYPES: QuestionType[] = ['pinyin', 'yes_no', 'multiple_choice'];

/**
 * Get interval in minutes for a tier
 */
export function tierToInterval(tier: number): number | null {
  return TIER_INTERVALS_MINUTES[Math.min(tier, 7)];
}

/**
 * Convert tier to percentage (0-100)
 */
export function tierToPercent(tier: number): number {
  return Math.round((tier / 7) * 100);
}

/**
 * Get display color class for a tier
 */
export function tierToColorClass(tier: number): string {
  return `understanding-${Math.min(tier, 7)}`;
}

/**
 * Calculate new tier after answer
 * Correct: +1 tier (max 7)
 * Wrong: -1 for tiers 0-2, -2 for tiers 3-6
 */
export function updateTier(currentTier: number, correct: boolean): number {
  if (correct) {
    return Math.min(currentTier + 1, 7);
  } else {
    const penalty = currentTier >= 3 ? 2 : 1;
    return Math.max(currentTier - penalty, 0);
  }
}

/**
 * Calculate next review date based on tier
 */
export function calculateNextReview(tier: number): string | null {
  const intervalMinutes = tierToInterval(tier);
  if (intervalMinutes === null) {
    return null; // Graduated
  }
  const nextReview = new Date();
  nextReview.setMinutes(nextReview.getMinutes() + intervalMinutes);
  return nextReview.toISOString();
}

/**
 * Check if an SRS record is due for review
 */
export function isDue(record: SRSRecord): boolean {
  if (record.tier >= 7 || record.nextReview === null) {
    return false; // Graduated
  }
  return new Date(record.nextReview) <= new Date();
}

/**
 * Calculate average understanding from SRS records for a concept
 */
export function calculateUnderstanding(records: SRSRecord[]): number {
  if (records.length === 0) return 0;
  const avgTier = records.reduce((sum, r) => sum + r.tier, 0) / records.length;
  return Math.round((avgTier / 7) * 100);
}

/**
 * Create initial SRS records for a concept (all question types at tier 0)
 */
export function createInitialSRSRecords(conceptId: string): Omit<SRSRecord, 'id'>[] {
  const now = new Date().toISOString();
  return QUESTION_TYPES.map(questionType => ({
    conceptId,
    questionType,
    tier: 0,
    nextReview: now,
    streak: 0,
    lapses: 0,
  }));
}

/**
 * Record an SRS answer and return updated record
 */
export function recordAnswer(record: SRSRecord, correct: boolean): SRSRecord {
  const newTier = updateTier(record.tier, correct);
  return {
    ...record,
    tier: newTier,
    nextReview: calculateNextReview(newTier),
    streak: correct ? record.streak + 1 : 0,
    lapses: correct ? record.lapses : record.lapses + 1,
  };
}

/**
 * Format time until next review
 */
export function formatTimeUntilReview(nextReview: string | null): string {
  if (!nextReview) return 'Done';
  
  const now = new Date();
  const reviewDate = new Date(nextReview);
  const diffMs = reviewDate.getTime() - now.getTime();
  
  if (diffMs <= 0) return 'Now';
  
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  return `${diffMins}m`;
}
