import { useState, useCallback } from 'react';
import { Pause, Play, Volume2, Loader2 } from 'lucide-react';
import type { Concept, Modality } from '../types/vocabulary';
import { MODALITY_INFO } from '../types/vocabulary';
import { speak, stopSpeaking, isTTSSupported, getVoiceForCurrentBrowser } from '../services/ttsService';
import type { AudioSettings } from '../types/settings';

interface VocabCardProps {
  concept: Concept;
  onTogglePaused: () => void;
  onClose: () => void;
  audioSettings?: Partial<AudioSettings>;
}

export function VocabCard({ concept, onTogglePaused, onClose, audioSettings }: VocabCardProps) {
  const isPaused = concept.paused;
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
        voiceId: audioSettings ? getVoiceForCurrentBrowser(audioSettings) : undefined,
        rate: audioSettings?.speechRate ?? 0.9,
      });
    } catch (err) {
      console.error('TTS error:', err);
    } finally {
      setIsPlaying(false);
    }
  }, [concept.word, ttsSupported, isPlaying, audioSettings]);
  
  const modalities: Modality[] = ['character', 'pinyin', 'meaning', 'audio'];
  
  // Color class based on knowledge level
  const getKnowledgeColor = (knowledge: number): string => {
    if (knowledge >= 80) return 'text-success';
    if (knowledge >= 50) return 'text-warning';
    return 'text-error/70';
  };
  
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
            
            {/* Modality Knowledge */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2 text-base-content/70">Knowledge by Modality</h3>
              <div className="grid grid-cols-2 gap-2">
                {modalities.map(mod => {
                  const info = MODALITY_INFO[mod];
                  const score = concept.modality[mod];
                  
                  return (
                    <div 
                      key={mod}
                      className="bg-base-300 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm flex items-center gap-1">
                          <span>{info.emoji}</span>
                          <span>{info.label}</span>
                        </span>
                        <span className={`font-bold ${getKnowledgeColor(score.knowledge)}`}>
                          {score.knowledge}%
                        </span>
                      </div>
                      <progress 
                        className="progress progress-primary w-full h-1.5" 
                        value={score.knowledge} 
                        max="100"
                      />
                      <div className="text-xs text-base-content/50 mt-1">
                        {score.attempts > 0 
                          ? `${score.successes}/${score.attempts} correct`
                          : 'Not tested yet'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Overall Knowledge */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Overall Knowledge</span>
                <span className={getKnowledgeColor(concept.knowledge)}>
                  {concept.knowledge}%
                </span>
              </div>
              <progress 
                className="progress progress-primary w-full" 
                value={concept.knowledge} 
                max="100"
              />
            </div>
            
            {/* Actions */}
            <div className="card-actions justify-between">
              <button 
                className={`btn ${isPaused ? 'btn-success' : 'btn-warning'}`}
                onClick={onTogglePaused}
              >
                {isPaused ? (
                  <>
                    <Play className="w-4 h-4" />
                    Start Studying
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4" />
                    Pause Word
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
