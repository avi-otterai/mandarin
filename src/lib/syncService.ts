// Sync service for Supabase cloud storage
import { supabase, isSupabaseConfigured } from './supabase';
import type { Concept, ConceptModality } from '../types/vocabulary';
import { createInitialModality } from '../utils/knowledge';

export interface SyncResult {
  success: boolean;
  error?: string;
  conceptsUploaded?: number;
}

// Check if a string is a valid UUID
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Convert old-format IDs to UUIDs for sync
function migrateIds(concepts: Concept[]): Concept[] {
  return concepts.map(c => {
    if (isValidUUID(c.id)) {
      return c;
    }
    return { ...c, id: crypto.randomUUID() };
  });
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
    modality: concept.modality,
    knowledge: concept.knowledge,
    paused: concept.paused,
  };
}

// Check if modality object is valid (has all required fields with proper structure)
function isValidModality(modality: unknown): modality is ConceptModality {
  if (!modality || typeof modality !== 'object') return false;
  const m = modality as Record<string, unknown>;
  const requiredKeys = ['character', 'pinyin', 'meaning', 'audio'];
  for (const key of requiredKeys) {
    const score = m[key];
    if (!score || typeof score !== 'object') return false;
    const s = score as Record<string, unknown>;
    if (typeof s.knowledge !== 'number') return false;
  }
  return true;
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
  modality?: ConceptModality | Record<string, never>;  // Can be empty object {}
  knowledge?: number;
  understanding?: number;  // Legacy field
  paused: boolean;
}): Concept {
  // Handle migration from old schema (understanding) to new schema (modality + knowledge)
  // Check if modality is valid (not empty object or missing fields)
  const modality = isValidModality(row.modality) ? row.modality : createInitialModality(row.chapter);
  const knowledge = row.knowledge ?? row.understanding ?? 50;
  
  return {
    id: row.id,
    word: row.word,
    pinyin: row.pinyin,
    part_of_speech: row.part_of_speech as Concept['part_of_speech'],
    meaning: row.meaning,
    chapter: row.chapter,
    source: row.source,
    modality,
    knowledge,
    paused: row.paused,
  };
}

// Fetch all data from Supabase for the current user
export async function fetchFromCloud(userId: string): Promise<{
  concepts: Concept[];
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { concepts: [], error: 'Supabase not configured' };
  }

  try {
    // Fetch concepts
    const { data: conceptRows, error: conceptsError } = await supabase
      .from('concepts')
      .select('*')
      .eq('user_id', userId);

    if (conceptsError) {
      return { concepts: [], error: conceptsError.message };
    }

    return {
      concepts: (conceptRows || []).map(rowToConcept),
    };
  } catch (err) {
    return { 
      concepts: [], 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}

// Save all data to Supabase (upsert)
export async function saveToCloud(
  userId: string,
  concepts: Concept[],
  _srsRecords: unknown[] = []  // Legacy parameter, ignored
): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // Migrate any old-format IDs to valid UUIDs
    const migratedConcepts = migrateIds(concepts);
    
    // Delete existing concepts for this user (clean sync)
    const { error: deleteError } = await supabase
      .from('concepts')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    // Insert concepts
    if (migratedConcepts.length > 0) {
      const conceptInserts = migratedConcepts.map(c => conceptToInsert(c, userId));
      const { error: insertError } = await supabase
        .from('concepts')
        .insert(conceptInserts);

      if (insertError) {
        return { success: false, error: insertError.message };
      }
    }

    return {
      success: true,
      conceptsUploaded: migratedConcepts.length,
    };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}
