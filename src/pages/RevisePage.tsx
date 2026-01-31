import { useState, useEffect, useCallback } from 'react';
import { Check, X, ArrowRight, SkipForward } from 'lucide-react';
import type { VocabularyStore } from '../stores/vocabularyStore';
import type { Concept, SRSRecord, QuestionType } from '../types/vocabulary';
import { pinyinMatchStrict } from '../utils/pinyin';

interface RevisePageProps {
  store: VocabularyStore;
}

type PracticeMode = 
  | 'loading'
  | 'no_words'
  | 'definition'
  | 'pinyin_quiz'
  | 'multiple_choice'
  | 'yes_no'
  | 'feedback';

interface PracticeState {
  mode: PracticeMode;
  concept: Concept | null;
  srsRecord: SRSRecord | null;
  feedback: {
    correct: boolean;
    expectedAnswer?: string;
    userAnswer?: string;
  } | null;
}

export function RevisePage({ store }: RevisePageProps) {
  const [state, setState] = useState<PracticeState>({
    mode: 'loading',
    concept: null,
    srsRecord: null,
    feedback: null,
  });
  const [pinyinInput, setPinyinInput] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  
  const [questionContent, setQuestionContent] = useState<{
    sentence?: string;
    options?: string[];
    correctIndex?: number;
    yesNoQuestion?: string;
    correctAnswer?: boolean;
  }>({});

  const loadNext = useCallback(() => {
    const next = store.getNextPractice();
    
    if (!next) {
      setState({
        mode: 'no_words',
        concept: null,
        srsRecord: null,
        feedback: null,
      });
      return;
    }
    
    if (next.type === 'definition') {
      setState({
        mode: 'definition',
        concept: next.concept,
        srsRecord: null,
        feedback: null,
      });
    } else {
      const { record, concept } = next;
      const mode = questionTypeToMode(record.questionType);
      
      setState({
        mode,
        concept,
        srsRecord: record,
        feedback: null,
      });
      
      if (record.questionType === 'multiple_choice') {
        generateMultipleChoice(concept, store.concepts);
      } else if (record.questionType === 'yes_no') {
        generateYesNo(concept, store.concepts);
      }
    }
    
    setPinyinInput('');
    setSelectedOption(null);
  }, [store]);

  useEffect(() => {
    loadNext();
  }, []);
  
  const questionTypeToMode = (type: QuestionType): PracticeMode => {
    switch (type) {
      case 'pinyin': return 'pinyin_quiz';
      case 'multiple_choice': return 'multiple_choice';
      case 'yes_no': return 'yes_no';
      default: return 'pinyin_quiz';
    }
  };
  
  const generateMultipleChoice = (concept: Concept, allConcepts: Concept[]) => {
    const distractors = allConcepts
      .filter(c => c.id !== concept.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    const correctIndex = Math.floor(Math.random() * 4);
    const options = [...distractors.slice(0, correctIndex).map(c => c.word), 
                     concept.word, 
                     ...distractors.slice(correctIndex).map(c => c.word)].slice(0, 4);
    
    const templates = [
      `Which word means "${concept.meaning}"?`,
      `Select the character for: ${concept.meaning}`,
    ];
    const sentence = templates[Math.floor(Math.random() * templates.length)];
    
    setQuestionContent({
      sentence,
      options,
      correctIndex: options.indexOf(concept.word),
    });
  };
  
  const generateYesNo = (concept: Concept, allConcepts: Concept[]) => {
    const correct = Math.random() > 0.5;
    let question: string;
    
    if (correct) {
      const templates = [
        `Does "${concept.word}" mean "${concept.meaning}"?`,
        `Is the pinyin for "${concept.word}" = "${concept.pinyin}"?`,
      ];
      question = templates[Math.floor(Math.random() * templates.length)];
    } else {
      const others = allConcepts.filter(c => c.id !== concept.id);
      if (others.length > 0) {
        const other = others[Math.floor(Math.random() * others.length)];
        question = `Does "${concept.word}" mean "${other.meaning}"?`;
      } else {
        question = `Does "${concept.word}" mean "something else"?`;
      }
    }
    
    setQuestionContent({
      yesNoQuestion: question,
      correctAnswer: correct,
    });
  };
  
  const handleUnderstand = () => {
    if (state.concept) {
      store.initializeSRS(state.concept.id);
    }
    loadNext();
  };
  
  const handlePinyinSubmit = () => {
    if (!state.concept || !state.srsRecord) return;
    
    const correct = pinyinMatchStrict(pinyinInput, state.concept.pinyin);
    store.recordAnswer(state.srsRecord.id, correct);
    
    setState(prev => ({
      ...prev,
      mode: 'feedback',
      feedback: {
        correct,
        expectedAnswer: state.concept!.pinyin,
        userAnswer: pinyinInput,
      },
    }));
  };
  
  const handleMultipleChoice = (index: number) => {
    if (!state.concept || !state.srsRecord) return;
    
    setSelectedOption(index);
    const correct = index === questionContent.correctIndex;
    store.recordAnswer(state.srsRecord.id, correct);
    
    setState(prev => ({
      ...prev,
      mode: 'feedback',
      feedback: {
        correct,
        expectedAnswer: state.concept!.word,
        userAnswer: questionContent.options?.[index],
      },
    }));
  };
  
  const handleYesNo = (answer: boolean) => {
    if (!state.concept || !state.srsRecord) return;
    
    const correct = answer === questionContent.correctAnswer;
    store.recordAnswer(state.srsRecord.id, correct);
    
    setState(prev => ({
      ...prev,
      mode: 'feedback',
      feedback: {
        correct,
        expectedAnswer: questionContent.correctAnswer ? 'Yes' : 'No',
        userAnswer: answer ? 'Yes' : 'No',
      },
    }));
  };
  
  const handleSkip = () => {
    loadNext();
  };
  
  const renderContent = () => {
    switch (state.mode) {
      case 'loading':
        return (
          <div className="card bg-base-200">
            <div className="card-body items-center py-12">
              <span className="loading loading-spinner loading-lg text-primary"></span>
              <p className="text-base-content/60">Loading...</p>
            </div>
          </div>
        );
        
      case 'no_words':
        return (
          <div className="card bg-base-200">
            <div className="card-body items-center text-center py-12">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold">All done!</h2>
              <p className="text-base-content/60 mt-2">
                No words to revise right now.
              </p>
              <p className="text-sm text-base-content/40 mt-4">
                Come back later for more reviews, or add more words from the Vocabulary tab.
              </p>
            </div>
          </div>
        );
        
      case 'definition':
        return (
          <div className="card bg-base-200">
            <div className="card-body">
              <div className="badge badge-primary mb-4">New Word</div>
              
              <div className="text-center py-6">
                <h2 className="hanzi text-6xl font-bold text-primary mb-4">
                  {state.concept?.word}
                </h2>
                <p className="pinyin text-2xl text-secondary">
                  {state.concept?.pinyin}
                </p>
              </div>
              
              <div className="bg-base-300 rounded-lg p-4 my-4">
                <p className="text-lg">{state.concept?.meaning}</p>
                <p className="text-sm text-base-content/60 mt-2">
                  {state.concept?.part_of_speech} · Chapter {state.concept?.chapter}
                </p>
              </div>
              
              <div className="flex justify-between mt-4">
                <button className="btn btn-ghost btn-sm" onClick={handleSkip}>
                  <SkipForward className="w-4 h-4" />
                  Skip
                </button>
                <button className="btn btn-primary" onClick={handleUnderstand}>
                  <Check className="w-5 h-5" />
                  I understand
                </button>
              </div>
            </div>
          </div>
        );
        
      case 'pinyin_quiz':
        return (
          <div className="card bg-base-200">
            <div className="card-body">
              <div className="badge badge-secondary mb-4">Pinyin Quiz</div>
              
              <div className="text-center py-8">
                <h2 className="hanzi text-7xl font-bold text-primary">
                  {state.concept?.word}
                </h2>
                <p className="text-base-content/60 mt-4">Type the pinyin for this character</p>
              </div>
              
              <div className="form-control my-4">
                <input
                  type="text"
                  className="input input-bordered input-lg text-center pinyin text-xl"
                  placeholder="Enter pinyin..."
                  value={pinyinInput}
                  onChange={e => setPinyinInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePinyinSubmit()}
                  autoFocus
                />
                <label className="label">
                  <span className="label-text-alt text-base-content/50">
                    Use tone marks (nǐ) or numbers (ni3)
                  </span>
                </label>
              </div>
              
              <div className="flex justify-between mt-4">
                <button className="btn btn-ghost btn-sm" onClick={handleSkip}>
                  <SkipForward className="w-4 h-4" />
                  Skip
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={handlePinyinSubmit}
                  disabled={!pinyinInput.trim()}
                >
                  Submit
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        );
        
      case 'multiple_choice':
        return (
          <div className="card bg-base-200">
            <div className="card-body">
              <div className="badge badge-accent mb-4">Multiple Choice</div>
              
              <div className="text-center py-4">
                <p className="text-lg">{questionContent.sentence}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 my-4">
                {questionContent.options?.map((option, index) => (
                  <button
                    key={index}
                    className={`btn btn-lg hanzi text-2xl h-auto py-4 ${
                      selectedOption === index ? 'btn-primary' : 'btn-outline'
                    }`}
                    onClick={() => handleMultipleChoice(index)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              
              <div className="flex justify-start mt-4">
                <button className="btn btn-ghost btn-sm" onClick={handleSkip}>
                  <SkipForward className="w-4 h-4" />
                  Skip
                </button>
              </div>
            </div>
          </div>
        );
        
      case 'yes_no':
        return (
          <div className="card bg-base-200">
            <div className="card-body">
              <div className="badge badge-info mb-4">Yes / No</div>
              
              <div className="text-center py-8">
                <p className="text-xl">{questionContent.yesNoQuestion}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 my-4">
                <button className="btn btn-lg btn-success" onClick={() => handleYesNo(true)}>
                  <Check className="w-6 h-6" />
                  Yes
                </button>
                <button className="btn btn-lg btn-error" onClick={() => handleYesNo(false)}>
                  <X className="w-6 h-6" />
                  No
                </button>
              </div>
              
              <div className="flex justify-start mt-4">
                <button className="btn btn-ghost btn-sm" onClick={handleSkip}>
                  <SkipForward className="w-4 h-4" />
                  Skip
                </button>
              </div>
            </div>
          </div>
        );
        
      case 'feedback':
        return (
          <div className={`card ${state.feedback?.correct ? 'bg-success/20' : 'bg-error/20'}`}>
            <div className="card-body">
              <div className="text-center">
                {state.feedback?.correct ? (
                  <div className="text-success">
                    <Check className="w-16 h-16 mx-auto mb-2" />
                    <h2 className="text-3xl font-bold">Correct!</h2>
                  </div>
                ) : (
                  <div className="text-error">
                    <X className="w-16 h-16 mx-auto mb-2" />
                    <h2 className="text-3xl font-bold">Incorrect</h2>
                  </div>
                )}
              </div>
              
              <div className="text-center py-6">
                <h3 className="hanzi text-5xl font-bold text-primary mb-2">
                  {state.concept?.word}
                </h3>
                <p className="pinyin text-2xl text-secondary">
                  {state.concept?.pinyin}
                </p>
                <p className="text-lg mt-2 text-base-content/80">
                  {state.concept?.meaning}
                </p>
              </div>
              
              {!state.feedback?.correct && (
                <div className="bg-base-300 rounded-lg p-4 my-4">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-sm text-base-content/60">Your answer</p>
                      <p className="text-lg text-error font-medium">{state.feedback?.userAnswer || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-base-content/60">Correct answer</p>
                      <p className="text-lg text-success font-medium">{state.feedback?.expectedAnswer}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-center mt-4">
                <button className="btn btn-primary btn-lg" onClick={loadNext}>
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-base-100/95 backdrop-blur border-b border-base-300 px-4 py-3">
        <h1 className="text-xl font-bold text-center">Revise</h1>
        <div className="flex justify-center gap-4 mt-2">
          <div className="badge badge-primary">
            Due: {store.dueCount}
          </div>
          <div className="badge badge-secondary">
            New: {store.newCount}
          </div>
        </div>
      </header>
      
      {/* Content */}
      <div className="p-4 max-w-lg mx-auto">
        {renderContent()}
      </div>
    </div>
  );
}
