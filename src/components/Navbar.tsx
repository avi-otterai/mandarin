import { Link, useLocation } from 'react-router-dom';
import { BookOpen, GraduationCap, Settings } from 'lucide-react';

interface NavbarProps {
  dueCount: number;
  newCount: number;
  hasUnsyncedSettings?: boolean;
}

export function Navbar({ dueCount, newCount, hasUnsyncedSettings }: NavbarProps) {
  const location = useLocation();
  const totalPractice = dueCount + newCount;
  
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
            {totalPractice > 0 && (
              <span className="absolute -top-2 -right-3 min-w-5 h-5 flex items-center justify-center text-xs bg-primary text-primary-content rounded-full px-1">
                {totalPractice > 99 ? '99+' : totalPractice}
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
