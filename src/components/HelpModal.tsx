import { X, BookOpen, GraduationCap, Settings, CheckSquare } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-base-200 rounded-2xl shadow-2xl max-w-sm w-full border border-base-300 animate-in fade-in zoom-in-95 duration-200">
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
              Learn Mandarin with spaced repetition
            </p>
          </div>

          {/* Tabs explanation */}
          <div className="space-y-4">
            {/* Vocabulary */}
            <div className="flex gap-3 items-start p-3 bg-base-100 rounded-xl">
              <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Vocabulary</h3>
                <p className="text-sm text-base-content/60">
                  Browse HSK words. Check <CheckSquare className="w-3.5 h-3.5 inline text-success" /> the ones you want to learn.
                </p>
              </div>
            </div>

            {/* Revise */}
            <div className="flex gap-3 items-start p-3 bg-base-100 rounded-xl">
              <div className="bg-secondary/10 p-2 rounded-lg shrink-0">
                <GraduationCap className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h3 className="font-semibold">Revise</h3>
                <p className="text-sm text-base-content/60">
                  Flashcard practice with your checked words. Tap cards to reveal/hide.
                </p>
              </div>
            </div>

            {/* Settings */}
            <div className="flex gap-3 items-start p-3 bg-base-100 rounded-xl">
              <div className="bg-accent/10 p-2 rounded-lg shrink-0">
                <Settings className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold">Settings</h3>
                <p className="text-sm text-base-content/60">
                  Customize themes, session size, and learning focus.
                </p>
              </div>
            </div>
          </div>

          {/* Tip */}
          <div className="mt-5 p-3 bg-warning/10 border border-warning/30 rounded-xl">
            <p className="text-sm text-center">
              <strong>Tip:</strong> Start by checking a few words in <span className="font-medium">Vocabulary</span>, then practice in <span className="font-medium">Revise</span>!
            </p>
          </div>

          {/* CTA */}
          <button 
            className="btn btn-primary w-full mt-5"
            onClick={onClose}
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}
