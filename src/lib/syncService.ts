// Sync service for Supabase cloud storage
import { supabase, isSupabaseConfigured } from './supabase';
import type { Concept, SRSRecord } from '../types/vocabulary';

export interface SyncResult {
  success: boolean;
  error?: string;
  conceptsUploaded?: number;
  srsRecordsUploaded?: number;
}

// Check if a string is a valid UUID
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Convert old-format IDs to UUIDs for sync
// Returns a map of oldId -> newUUID for concept ID remapping
function migrateIds(concepts: Concept[], srsRecords: SRSRecord[]): {
  migratedConcepts: Concept[];
  migratedSrsRecords: SRSRecord[];
} {
  // Create mapping from old concept IDs to new UUIDs
  const conceptIdMap = new Map<string, string>();
  
  const migratedConcepts = concepts.map(c => {
    if (isValidUUID(c.id)) {
      conceptIdMap.set(c.id, c.id);
      return c;
    }
    const newId = crypto.randomUUID();
    conceptIdMap.set(c.id, newId);
    return { ...c, id: newId };
  });
  
  // Migrate SRS records with new IDs and remapped concept IDs
  const migratedSrsRecords = srsRecords.map(r => {
    const newId = isValidUUID(r.id) ? r.id : crypto.randomUUID();
    const newConceptId = conceptIdMap.get(r.conceptId) || r.conceptId;
    return { ...r, id: newId, conceptId: newConceptId };
  });
  
  return { migratedConcepts, migratedSrsRecords };
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
    // Migrate any old-format IDs to valid UUIDs
    const { migratedConcepts, migratedSrsRecords } = migrateIds(concepts, srsRecords);
    
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
    if (migratedConcepts.length > 0) {
      const conceptInserts = migratedConcepts.map(c => conceptToInsert(c, userId));
      const { error: insertConceptsError } = await supabase
        .from('concepts')
        .insert(conceptInserts);

      if (insertConceptsError) {
        return { success: false, error: insertConceptsError.message };
      }
    }

    // Insert SRS records
    if (migratedSrsRecords.length > 0) {
      const srsInserts = migratedSrsRecords.map(r => srsRecordToInsert(r, userId));
      const { error: insertSrsError } = await supabase
        .from('srs_records')
        .insert(srsInserts);

      if (insertSrsError) {
        return { success: false, error: insertSrsError.message };
      }
    }

    return {
      success: true,
      conceptsUploaded: migratedConcepts.length,
      srsRecordsUploaded: migratedSrsRecords.length,
    };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}
