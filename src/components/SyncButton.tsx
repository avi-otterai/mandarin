// Sync button component for cloud save
import { Cloud, CloudOff, Check, Loader2, AlertTriangle } from 'lucide-react';

interface SyncButtonProps {
  isSyncing: boolean;
  hasUnsyncedChanges: boolean;
  lastSyncTime: string | null;
  syncError: string | null;
  onSync: () => void;
  onClearError: () => void;
  disabled?: boolean;
}

export function SyncButton({
  isSyncing,
  hasUnsyncedChanges,
  lastSyncTime,
  syncError,
  onSync,
  onClearError,
  disabled,
}: SyncButtonProps) {
  // Format last sync time
  const formatTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  };

  // Determine button state
  const getButtonContent = () => {
    if (isSyncing) {
      return (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="hidden sm:inline">Saving...</span>
        </>
      );
    }
    
    if (syncError) {
      return (
        <>
          <AlertTriangle className="w-4 h-4" />
          <span className="hidden sm:inline">Error</span>
        </>
      );
    }
    
    if (hasUnsyncedChanges) {
      return (
        <>
          <Cloud className="w-4 h-4" />
          <span className="hidden sm:inline">Save</span>
        </>
      );
    }
    
    return (
      <>
        <Check className="w-4 h-4" />
        <span className="hidden sm:inline">Saved</span>
      </>
    );
  };

  const getButtonClass = () => {
    if (syncError) return 'btn-error';
    if (hasUnsyncedChanges) return 'btn-warning';
    return 'btn-success';
  };

  return (
    <div className="flex items-center gap-2">
      {/* Sync button */}
      <button
        className={`btn btn-sm gap-1 ${getButtonClass()}`}
        onClick={syncError ? onClearError : onSync}
        disabled={disabled || isSyncing || (!hasUnsyncedChanges && !syncError)}
        title={syncError || `Last saved: ${formatTime(lastSyncTime)}`}
      >
        {getButtonContent()}
      </button>
      
      {/* Last sync time (desktop only) */}
      <span className="hidden md:inline text-xs text-base-content/50">
        {formatTime(lastSyncTime)}
      </span>
      
      {/* Error tooltip */}
      {syncError && (
        <div className="tooltip tooltip-bottom" data-tip={syncError}>
          <CloudOff className="w-4 h-4 text-error" />
        </div>
      )}
    </div>
  );
}
