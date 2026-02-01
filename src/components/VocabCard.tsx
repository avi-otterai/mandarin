import { useState, useCallback } from 'react';
import { Check, RotateCcw, Volume2, Loader2 } from 'lucide-react';
import type { Concept, SRSRecord } from '../types/vocabulary';
import { tierToColorClass, formatTimeUntilReview } from '../utils/srs';
import { speak, stopSpeaking, isTTSSupported } from '../services/ttsService';

interface VocabCardProps {
  concept: Concept;
  srsRecords: SRSRecord[];
  onToggleKnown: () => void;
  onClose: () => void;
  audioSettings?: {
    browserVoiceId?: string;
    speechRate?: number;
  };
}

export function VocabCard({ concept, srsRecords, onToggleKnown, onClose, audioSettings }: VocabCardProps) {
  const isKnown = concept.understanding >= 80;
  const [isPlaying, setIsPlaying] = useState(false);
  const ttsSupported = isTTSSupported();
  
  const handlePlayAudio = useCallback(async () => {
    if (!ttsSupported) return;
    
    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
      return;
    }
    
    setIsPlaying(true);
    try {
      await speak(concept.word, {
        voiceId: audioSettings?.browserVoiceId || undefined,
        rate: audioSettings?.speechRate ?? 0.9,
      });
    } catch (err) {
      console.error('TTS error:', err);
    } finally {
      setIsPlaying(false);
    }
  }, [concept.word, ttsSupported, isPlaying, audioSettings]);
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Card */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-lg mx-auto">
        <div className="card bg-base-200 shadow-2xl">
          <div className="card-body">
            {/* Header with word and pinyin */}
            <div className="text-center mb-4">
              <div className="flex items-start justify-center gap-2">
                <h2 className="hanzi text-5xl font-bold text-primary mb-2">
                  {concept.word}
                </h2>
                {ttsSupported && (
                  <button
                    className={`btn btn-sm btn-circle ${isPlaying ? 'btn-error' : 'btn-ghost text-info'}`}
                    onClick={handlePlayAudio}
                    title={isPlaying ? 'Stop' : 'Play pronunciation'}
                  >
                    {isPlaying ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
              <p className="pinyin text-2xl text-secondary">
                {concept.pinyin}
              </p>
            </div>
            
            {/* Meaning */}
            <div className="bg-base-300 rounded-lg p-4 mb-4">
              <p className="text-lg">{concept.meaning}</p>
              <p className="text-sm text-base-content/60 mt-1">
                {concept.part_of_speech} · Chapter {concept.chapter} · {concept.source.toUpperCase()}
              </p>
            </div>
            
            {/* SRS Progress */}
            {srsRecords.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-2 text-base-content/70">Learning Progress</h3>
                <div className="grid grid-cols-3 gap-2">
                  {srsRecords.map(record => (
                    <div 
                      key={record.id}
                      className={`bg-base-300 rounded-lg p-2 text-center ${tierToColorClass(record.tier)}`}
                    >
                      <div className="text-xs opacity-70">
                        {record.questionType === 'pinyin' ? 'Pinyin' : 
                         record.questionType === 'yes_no' ? 'Yes/No' : 'Choice'}
                      </div>
                      <div className="font-bold">
                        {Math.round((record.tier / 7) * 100)}%
                      </div>
                      <div className="text-xs opacity-60">
                        {formatTimeUntilReview(record.nextReview)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Understanding bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Mastery</span>
                <span className={tierToColorClass(Math.round(concept.understanding / 14.3))}>
                  {concept.understanding}%
                </span>
              </div>
              <progress 
                className="progress progress-primary w-full" 
                value={concept.understanding} 
                max="100"
              />
            </div>
            
            {/* Actions */}
            <div className="card-actions justify-between">
              <button 
                className={`btn ${isKnown ? 'btn-warning' : 'btn-success'}`}
                onClick={onToggleKnown}
              >
                {isKnown ? (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Reset to Learning
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Mark as Known
                  </>
                )}
              </button>
              <button className="btn btn-ghost" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
