// Supabase database types (auto-generated structure)

export interface Database {
  public: {
    Tables: {
      concepts: {
        Row: {
          id: string;
          user_id: string;
          word: string;
          pinyin: string;
          part_of_speech: string;
          meaning: string;
          chapter: number;
          source: string;
          understanding: number;
          paused: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          word: string;
          pinyin: string;
          part_of_speech: string;
          meaning: string;
          chapter: number;
          source: string;
          understanding?: number;
          paused?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          word?: string;
          pinyin?: string;
          part_of_speech?: string;
          meaning?: string;
          chapter?: number;
          source?: string;
          understanding?: number;
          paused?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      srs_records: {
        Row: {
          id: string;
          user_id: string;
          concept_id: string;
          question_type: 'pinyin' | 'yes_no' | 'multiple_choice';
          tier: number;
          next_review: string | null;
          streak: number;
          lapses: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          concept_id: string;
          question_type: 'pinyin' | 'yes_no' | 'multiple_choice';
          tier?: number;
          next_review?: string | null;
          streak?: number;
          lapses?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          concept_id?: string;
          question_type?: 'pinyin' | 'yes_no' | 'multiple_choice';
          tier?: number;
          next_review?: string | null;
          streak?: number;
          lapses?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

// Helper types for easier access
export type ConceptRow = Database['public']['Tables']['concepts']['Row'];
export type ConceptInsert = Database['public']['Tables']['concepts']['Insert'];
export type SRSRecordRow = Database['public']['Tables']['srs_records']['Row'];
export type SRSRecordInsert = Database['public']['Tables']['srs_records']['Insert'];
