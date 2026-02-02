import { X, BookOpen, GraduationCap, Zap, User } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pb-20">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-base-200 rounded-2xl shadow-2xl max-w-sm w-full max-h-[calc(100vh-6rem)] overflow-y-auto border border-base-300 animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button 
          className="absolute top-3 right-3 btn btn-sm btn-circle btn-ghost"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="p-6 pt-8">
          {/* Header */}
          <div className="text-center mb-6">
            <span className="text-4xl">🪕</span>
            <h2 className="text-2xl font-bold mt-2">Welcome to Saras!</h2>
            <p className="text-base-content/60 text-sm mt-1">
              Learn Mandarin with adaptive quizzes
            </p>
          </div>

          {/* Tabs explanation */}
          <div className="space-y-3">
            {/* Vocabulary */}
            <div className="flex gap-3 items-start p-3 bg-base-100 rounded-xl">
              <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Vocab</h3>
                <p className="text-sm text-base-content/60">
                  Browse HSK words. Import chapters and manage your word list.
                </p>
              </div>
            </div>

            {/* Study */}
            <div className="flex gap-3 items-start p-3 bg-base-100 rounded-xl">
              <div className="bg-secondary/10 p-2 rounded-lg shrink-0">
                <GraduationCap className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h3 className="font-semibold">Study</h3>
                <p className="text-sm text-base-content/60">
                  Self-paced flashcards. Tap to reveal character, pinyin, or meaning.
                </p>
              </div>
            </div>

            {/* Quiz */}
            <div className="flex gap-3 items-start p-3 bg-base-100 rounded-xl">
              <div className="bg-warning/10 p-2 rounded-lg shrink-0">
                <Zap className="w-5 h-5 text-warning" />
              </div>
              <div>
                <h3 className="font-semibold">Quiz</h3>
                <p className="text-sm text-base-content/60">
                  Active learning! Multiple choice questions that track your progress.
                </p>
              </div>
            </div>

            {/* Profile */}
            <div className="flex gap-3 items-start p-3 bg-base-100 rounded-xl">
              <div className="bg-accent/10 p-2 rounded-lg shrink-0">
                <User className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold">Profile</h3>
                <p className="text-sm text-base-content/60">
                  See your progress and customize settings.
                </p>
              </div>
            </div>
          </div>

          {/* Tip */}
          <div className="mt-5 p-3 bg-info/10 border border-info/30 rounded-xl">
            <p className="text-sm text-center">
              <strong>💡 Tip:</strong> Start with <span className="font-medium">Quiz</span> to begin learning! Your progress is tracked per modality.
            </p>
          </div>

          {/* CTA */}
          <button 
            className="btn btn-primary w-full mt-5"
            onClick={onClose}
          >
            Let's Go!
          </button>
        </div>
      </div>
    </div>
  );
}
