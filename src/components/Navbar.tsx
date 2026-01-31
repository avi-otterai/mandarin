import { Link, useLocation } from 'react-router-dom';
import { BookOpen, GraduationCap, Settings, Check, AlertCircle } from 'lucide-react';

interface NavbarProps {
  reviewedToday: boolean;
  hasUnsyncedSettings?: boolean;
}

export function Navbar({ reviewedToday, hasUnsyncedSettings }: NavbarProps) {
  const location = useLocation();
  
  return (
    <nav className="flex-shrink-0 bg-base-200 border-t border-base-300 z-20">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        <Link
          to="/vocab"
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            location.pathname === '/vocab' 
              ? 'text-primary bg-base-300/50' 
              : 'text-base-content/60 hover:text-base-content'
          }`}
        >
          <BookOpen className="w-6 h-6" />
          <span className="text-xs mt-1">Vocabulary</span>
        </Link>
        
        <Link
          to="/revise"
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors relative ${
            location.pathname === '/revise' 
              ? 'text-primary bg-base-300/50' 
              : 'text-base-content/60 hover:text-base-content'
          }`}
        >
          <div className="relative">
            <GraduationCap className="w-6 h-6" />
            {reviewedToday ? (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center bg-success text-success-content rounded-full">
                <Check className="w-3 h-3" strokeWidth={3} />
              </span>
            ) : (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center bg-warning text-warning-content rounded-full">
                <AlertCircle className="w-3 h-3" strokeWidth={3} />
              </span>
            )}
          </div>
          <span className="text-xs mt-1">Revise</span>
        </Link>
        
        <Link
          to="/settings"
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors relative ${
            location.pathname === '/settings' 
              ? 'text-primary bg-base-300/50' 
              : 'text-base-content/60 hover:text-base-content'
          }`}
        >
          <div className="relative">
            <Settings className="w-6 h-6" />
            {hasUnsyncedSettings && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-warning rounded-full" />
            )}
          </div>
          <span className="text-xs mt-1">Settings</span>
        </Link>
      </div>
    </nav>
  );
}
