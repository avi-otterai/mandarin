// Quiz service for Supabase quiz attempt writes

import { supabase, isSupabaseConfigured } from './supabase';
import type { QuizAttempt, Modality } from '../types/vocabulary';

/**
 * Save a quiz attempt to Supabase (async, non-blocking)
 * Returns immediately - doesn't wait for server response
 */
export function saveQuizAttempt(
  userId: string,
  conceptId: string,
  questionModality: Modality,
  answerModality: Modality,
  optionConceptIds: [string, string, string, string],
  selectedIndex: 0 | 1 | 2 | 3,
  correct: boolean,
  predictedCorrect: number
): void {
  if (!isSupabaseConfigured()) {
    console.warn('[QuizService] Supabase not configured, skipping save');
    return;
  }

  // Fire and forget - don't await
  supabase
    .from('quiz_attempts')
    .insert({
      user_id: userId,
      concept_id: conceptId,
      question_modality: questionModality,
      answer_modality: answerModality,
      option_concept_ids: optionConceptIds,
      selected_index: selectedIndex,
      correct,
      predicted_correct: predictedCorrect,
    })
    .then(({ error }) => {
      if (error) {
        console.error('[QuizService] Failed to save quiz attempt:', error);
      }
    });
}

/**
 * Fetch quiz attempts for a user (for progress computation)
 */
export async function fetchQuizAttempts(
  userId: string,
  limit: number = 1000
): Promise<{ attempts: QuizAttempt[]; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { attempts: [], error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      return { attempts: [], error: error.message };
    }

    // Map database columns to TypeScript interface
    const attempts: QuizAttempt[] = (data || []).map((row: {
      id: string;
      user_id: string;
      timestamp: string;
      concept_id: string;
      question_modality: string;
      answer_modality: string;
      option_concept_ids: string[];
      selected_index: number;
      correct: boolean;
      predicted_correct: number;
    }) => ({
      id: row.id,
      userId: row.user_id,
      timestamp: row.timestamp,
      conceptId: row.concept_id,
      questionModality: row.question_modality as Modality,
      answerModality: row.answer_modality as Modality,
      optionConceptIds: row.option_concept_ids as [string, string, string, string],
      selectedIndex: row.selected_index as 0 | 1 | 2 | 3,
      correct: row.correct,
      predictedCorrect: row.predicted_correct,
    }));

    return { attempts, error: null };
  } catch (err) {
    return {
      attempts: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get quiz stats for a date range
 */
export async function getQuizStats(
  userId: string,
  startDate: Date,
  endDate: Date = new Date()
): Promise<{
  totalAttempts: number;
  totalCorrect: number;
  byDate: Record<string, { attempts: number; correct: number }>;
  error: string | null;
}> {
  if (!isSupabaseConfigured()) {
    return {
      totalAttempts: 0,
      totalCorrect: 0,
      byDate: {},
      error: 'Supabase not configured',
    };
  }

  try {
    const { data, error } = await supabase
      .from('quiz_attempts')
      .select('timestamp, correct')
      .eq('user_id', userId)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());

    if (error) {
      return {
        totalAttempts: 0,
        totalCorrect: 0,
        byDate: {},
        error: error.message,
      };
    }

    const attempts = data || [];
    const byDate: Record<string, { attempts: number; correct: number }> = {};
    let totalCorrect = 0;

    for (const attempt of attempts) {
      const date = attempt.timestamp.split('T')[0]; // YYYY-MM-DD
      if (!byDate[date]) {
        byDate[date] = { attempts: 0, correct: 0 };
      }
      byDate[date].attempts++;
      if (attempt.correct) {
        byDate[date].correct++;
        totalCorrect++;
      }
    }

    return {
      totalAttempts: attempts.length,
      totalCorrect,
      byDate,
      error: null,
    };
  } catch (err) {
    return {
      totalAttempts: 0,
      totalCorrect: 0,
      byDate: {},
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get today's quiz count
 */
export async function getTodayQuizCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const { count, error } = await supabase
      .from('quiz_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('timestamp', today.toISOString());

    if (error) {
      console.error('[QuizService] Error getting today count:', error);
      return 0;
    }

    return count || 0;
  } catch {
    return 0;
  }
}
