// Sync service for Supabase cloud storage
import { supabase, isSupabaseConfigured } from './supabase';
import type { Concept, SRSRecord } from '../types/vocabulary';

export interface SyncResult {
  success: boolean;
  error?: string;
  conceptsUploaded?: number;
  srsRecordsUploaded?: number;
}

// Convert local Concept to Supabase insert format
function conceptToInsert(concept: Concept, userId: string) {
  return {
    id: concept.id,
    user_id: userId,
    word: concept.word,
    pinyin: concept.pinyin,
    part_of_speech: concept.part_of_speech,
    meaning: concept.meaning,
    chapter: concept.chapter,
    source: concept.source,
    understanding: concept.understanding,
    paused: concept.paused,
  };
}

// Convert local SRSRecord to Supabase insert format
function srsRecordToInsert(record: SRSRecord, userId: string) {
  return {
    id: record.id,
    user_id: userId,
    concept_id: record.conceptId,
    question_type: record.questionType,
    tier: record.tier,
    next_review: record.nextReview,
    streak: record.streak,
    lapses: record.lapses,
  };
}

// Convert Supabase row to local Concept format
function rowToConcept(row: {
  id: string;
  word: string;
  pinyin: string;
  part_of_speech: string;
  meaning: string;
  chapter: number;
  source: string;
  understanding: number;
  paused: boolean;
}): Concept {
  return {
    id: row.id,
    word: row.word,
    pinyin: row.pinyin,
    part_of_speech: row.part_of_speech as Concept['part_of_speech'],
    meaning: row.meaning,
    chapter: row.chapter,
    source: row.source,
    understanding: row.understanding,
    paused: row.paused,
  };
}

// Convert Supabase row to local SRSRecord format
function rowToSRSRecord(row: {
  id: string;
  concept_id: string;
  question_type: string;
  tier: number;
  next_review: string | null;
  streak: number;
  lapses: number;
}): SRSRecord {
  return {
    id: row.id,
    conceptId: row.concept_id,
    questionType: row.question_type as SRSRecord['questionType'],
    tier: row.tier,
    nextReview: row.next_review,
    streak: row.streak,
    lapses: row.lapses,
  };
}

// Fetch all data from Supabase for the current user
export async function fetchFromCloud(userId: string): Promise<{
  concepts: Concept[];
  srsRecords: SRSRecord[];
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { concepts: [], srsRecords: [], error: 'Supabase not configured' };
  }

  try {
    // Fetch concepts
    const { data: conceptRows, error: conceptsError } = await supabase
      .from('concepts')
      .select('*')
      .eq('user_id', userId);

    if (conceptsError) {
      return { concepts: [], srsRecords: [], error: conceptsError.message };
    }

    // Fetch SRS records
    const { data: srsRows, error: srsError } = await supabase
      .from('srs_records')
      .select('*')
      .eq('user_id', userId);

    if (srsError) {
      return { concepts: [], srsRecords: [], error: srsError.message };
    }

    return {
      concepts: (conceptRows || []).map(rowToConcept),
      srsRecords: (srsRows || []).map(rowToSRSRecord),
    };
  } catch (err) {
    return { 
      concepts: [], 
      srsRecords: [], 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}

// Save all data to Supabase (upsert)
export async function saveToCloud(
  userId: string,
  concepts: Concept[],
  srsRecords: SRSRecord[]
): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // First, delete existing data for this user (clean sync)
    const { error: deleteConceptsError } = await supabase
      .from('srs_records')
      .delete()
      .eq('user_id', userId);

    if (deleteConceptsError) {
      return { success: false, error: deleteConceptsError.message };
    }

    const { error: deleteSrsError } = await supabase
      .from('concepts')
      .delete()
      .eq('user_id', userId);

    if (deleteSrsError) {
      return { success: false, error: deleteSrsError.message };
    }

    // Insert concepts
    if (concepts.length > 0) {
      const conceptInserts = concepts.map(c => conceptToInsert(c, userId));
      const { error: insertConceptsError } = await supabase
        .from('concepts')
        .insert(conceptInserts);

      if (insertConceptsError) {
        return { success: false, error: insertConceptsError.message };
      }
    }

    // Insert SRS records
    if (srsRecords.length > 0) {
      const srsInserts = srsRecords.map(r => srsRecordToInsert(r, userId));
      const { error: insertSrsError } = await supabase
        .from('srs_records')
        .insert(srsInserts);

      if (insertSrsError) {
        return { success: false, error: insertSrsError.message };
      }
    }

    return {
      success: true,
      conceptsUploaded: concepts.length,
      srsRecordsUploaded: srsRecords.length,
    };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}
