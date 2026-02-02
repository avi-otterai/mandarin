// Quiz generation utilities

import type { 
  Concept, 
  Modality, 
  QuizTaskType, 
  QuizQuestion, 
  QuizSession 
} from '../types/vocabulary';
import type { LearningFocus } from '../types/settings';
import { parseTaskType, QUIZ_TASK_TYPES } from '../types/vocabulary';

// ═══════════════════════════════════════════════════════════
// TASK TYPE SELECTION
// ═══════════════════════════════════════════════════════════

/**
 * Get weight for a task type based on learning focus settings
 * Both question and answer modalities contribute to the weight
 */
function getTaskWeight(taskType: QuizTaskType, learningFocus: LearningFocus): number {
  const { question, answer } = parseTaskType(taskType);
  
  const questionWeight = learningFocus[question];
  const answerWeight = learningFocus[answer];
  
  // If either modality is 0 (skip), don't select this task type
  if (questionWeight === 0 || answerWeight === 0) {
    return 0;
  }
  
  // Combined weight (multiply for stronger preference when both are high)
  return questionWeight * answerWeight;
}

/**
 * Select a random task type weighted by learning focus
 */
export function selectTaskType(learningFocus: LearningFocus): QuizTaskType {
  const weights = QUIZ_TASK_TYPES.map(taskType => ({
    taskType,
    weight: getTaskWeight(taskType, learningFocus),
  })).filter(item => item.weight > 0);
  
  if (weights.length === 0) {
    // Fallback: character_to_meaning if all weights are 0
    return 'character_to_meaning';
  }
  
  const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const { taskType, weight } of weights) {
    random -= weight;
    if (random <= 0) {
      return taskType;
    }
  }
  
  return weights[weights.length - 1].taskType;
}

// ═══════════════════════════════════════════════════════════
// DISTRACTOR SELECTION
// ═══════════════════════════════════════════════════════════

/**
 * Get the value of a concept for a given modality (used for collision detection)
 * For audio, use the word since that's what gets spoken
 */
function getModalityValue(concept: Concept, modality: Modality): string {
  switch (modality) {
    case 'character':
      return concept.word;
    case 'pinyin':
      return concept.pinyin.toLowerCase(); // Normalize for comparison
    case 'meaning':
      return concept.meaning.toLowerCase(); // Normalize for comparison
    case 'audio':
      return concept.word; // Audio uses the character for TTS
    default:
      return '';
  }
}

/**
 * Check if a candidate would create a collision with target or selected distractors
 * 
 * A collision occurs when:
 * 1. Candidate has same value as target for ANSWER modality (duplicate option)
 * 2. Candidate has same value as target for QUESTION modality (equally correct answer)
 * 3. Candidate has same value as an already-selected distractor for ANSWER modality
 */
function hasCollision(
  candidate: Concept,
  target: Concept,
  selectedDistractors: Concept[],
  questionModality: Modality,
  answerModality: Modality
): boolean {
  const targetQuestionValue = getModalityValue(target, questionModality);
  const targetAnswerValue = getModalityValue(target, answerModality);
  const candidateQuestionValue = getModalityValue(candidate, questionModality);
  const candidateAnswerValue = getModalityValue(candidate, answerModality);
  
  // Check collision with target's question value (would make distractor also correct)
  if (candidateQuestionValue === targetQuestionValue) {
    return true;
  }
  
  // Check collision with target's answer value (duplicate display)
  if (candidateAnswerValue === targetAnswerValue) {
    return true;
  }
  
  // Check collision with already-selected distractors' answer values
  for (const selected of selectedDistractors) {
    if (candidateAnswerValue === getModalityValue(selected, answerModality)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Select distractors for a quiz question
 * 
 * Strategy:
 * 1. Exclude candidates that would create collisions (same answer or question value)
 * 2. Prefer words from nearby chapters (±3) for relevance
 * 3. Prefer same part of speech for plausible distractors
 * 4. Random selection from weighted pool
 */
export function selectDistractors(
  target: Concept,
  allConcepts: Concept[],
  questionModality: Modality,
  answerModality: Modality,
  count: number = 3
): Concept[] {
  // Exclude the target itself
  const candidates = allConcepts.filter(c => c.id !== target.id && !c.paused);
  
  // Score candidates by similarity (higher = better distractor)
  const scored = candidates.map(candidate => {
    let score = 1; // Base score
    
    // Prefer same part of speech (more confusable)
    if (candidate.part_of_speech === target.part_of_speech) {
      score += 3;
    }
    
    // Prefer nearby chapters (more relevant difficulty)
    const chapterDiff = Math.abs(candidate.chapter - target.chapter);
    if (chapterDiff <= 2) score += 2;
    else if (chapterDiff <= 5) score += 1;
    
    // Small random factor to avoid always picking same distractors
    score += Math.random() * 0.5;
    
    return { concept: candidate, score };
  });
  
  // Sort by score (descending)
  scored.sort((a, b) => b.score - a.score);
  
  // Select distractors one by one, checking for collisions
  const selectedDistractors: Concept[] = [];
  
  for (const { concept } of scored) {
    if (selectedDistractors.length >= count) break;
    
    // Skip if this candidate would create a collision
    if (hasCollision(concept, target, selectedDistractors, questionModality, answerModality)) {
      continue;
    }
    
    selectedDistractors.push(concept);
  }
  
  // Shuffle the final selection to add variety
  return shuffleArray(selectedDistractors);
}

// ═══════════════════════════════════════════════════════════
// QUIZ GENERATION
// ═══════════════════════════════════════════════════════════

/**
 * Generate a single quiz question
 */
export function generateQuestion(
  concept: Concept,
  allConcepts: Concept[],
  learningFocus: LearningFocus
): QuizQuestion {
  const taskType = selectTaskType(learningFocus);
  const { question: questionModality, answer: answerModality } = parseTaskType(taskType);
  
  // Select 3 distractors with collision detection for both modalities
  const distractors = selectDistractors(
    concept,
    allConcepts,
    questionModality,
    answerModality,
    3
  );
  
  // Create options array: correct answer + distractors
  const options = [concept, ...distractors];
  
  // Shuffle options
  const shuffledOptions = shuffleArray(options);
  const correctIndex = shuffledOptions.findIndex(o => o.id === concept.id);
  
  return {
    concept,
    taskType,
    questionModality,
    answerModality,
    options: shuffledOptions,
    correctIndex,
  };
}

/**
 * Generate a full quiz session
 */
export function generateQuizSession(
  concepts: Concept[],
  questionCount: number,
  learningFocus: LearningFocus
): QuizSession {
  // Filter to non-paused concepts
  const availableConcepts = concepts.filter(c => !c.paused);
  
  if (availableConcepts.length === 0) {
    return {
      questions: [],
      currentIndex: 0,
      answers: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
    };
  }
  
  // For now: random selection (future: smart selection based on knowledge)
  const selectedConcepts = selectRandomConcepts(availableConcepts, questionCount);
  
  // Generate questions
  const questions = selectedConcepts.map(concept =>
    generateQuestion(concept, availableConcepts, learningFocus)
  );
  
  return {
    questions,
    currentIndex: 0,
    answers: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
}

/**
 * Select random concepts for a quiz session
 * Allows repeats if we need more questions than available concepts
 */
function selectRandomConcepts(concepts: Concept[], count: number): Concept[] {
  if (concepts.length === 0) return [];
  
  // Shuffle and repeat if needed
  const selected: Concept[] = [];
  let pool = shuffleArray([...concepts]);
  let poolIndex = 0;
  
  for (let i = 0; i < count; i++) {
    if (poolIndex >= pool.length) {
      // Reshuffle and restart
      pool = shuffleArray([...concepts]);
      poolIndex = 0;
    }
    selected.push(pool[poolIndex]);
    poolIndex++;
  }
  
  return selected;
}

// ═══════════════════════════════════════════════════════════
// CONTENT GETTERS FOR QUIZ DISPLAY
// ═══════════════════════════════════════════════════════════

/**
 * Get the display content for a modality
 */
export function getModalityContent(concept: Concept, modality: Modality): string {
  switch (modality) {
    case 'character':
      return concept.word;
    case 'pinyin':
      return concept.pinyin;
    case 'meaning':
      return concept.meaning;
    case 'audio':
      return concept.word; // For audio, we use the word for TTS
    default:
      return '';
  }
}

/**
 * Check if a modality needs audio playback
 */
export function modalityNeedsAudio(modality: Modality): boolean {
  return modality === 'audio';
}

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Fisher-Yates shuffle
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get task type display text
 */
export function getTaskTypeDisplay(taskType: QuizTaskType): string {
  const { question, answer } = parseTaskType(taskType);
  const labels: Record<Modality, string> = {
    character: 'Character',
    pinyin: 'Pinyin',
    meaning: 'Meaning',
    audio: 'Audio',
  };
  return `${labels[question]} → ${labels[answer]}`;
}

/**
 * Get question prompt based on task type
 */
export function getQuestionPrompt(taskType: QuizTaskType): string {
  const prompts: Record<string, string> = {
    'character_to_pinyin': 'What is the pinyin?',
    'character_to_meaning': 'What does this mean?',
    'character_to_audio': 'How is this pronounced?',
    'pinyin_to_character': 'Which character is this?',
    'pinyin_to_meaning': 'What does this mean?',
    'pinyin_to_audio': 'How is this pronounced?',
    'meaning_to_character': 'Which character means this?',
    'meaning_to_pinyin': 'What is the pinyin?',
    'meaning_to_audio': 'How do you say this?',
    'audio_to_character': 'Which character did you hear?',
    'audio_to_pinyin': 'What is the pinyin?',
    'audio_to_meaning': 'What does this mean?',
  };
  
  return prompts[taskType] || 'Select the correct answer';
}
