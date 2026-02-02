// Login page for Supabase authentication
import { useState } from 'react';
import { LogIn, AlertCircle, Loader2, User } from 'lucide-react';

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<{ success: boolean; error: string | null }>;
  onGuestLogin: () => { success: boolean; error: string | null };
  loading: boolean;
  error: string | null;
  onClearError: () => void;
}

export function LoginPage({ onLogin, onGuestLogin, loading, error, onClearError }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    await onLogin(email, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-base-300 via-base-100 to-base-300 p-4">
      <div className="card bg-base-100 shadow-2xl w-full max-w-md">
        <div className="card-body">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold text-primary mb-2">🪕 Saras</h1>
            <p className="text-base-content/60">Mandarin Chinese Learning</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="alert alert-error mb-4">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
              <button 
                className="btn btn-ghost btn-xs"
                onClick={onClearError}
              >
                ✕
              </button>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input
                type="email"
                placeholder="your@email.com"
                className="input input-bordered w-full"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Password</span>
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="input input-bordered w-full"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary w-full mt-6"
              disabled={loading || !email || !password}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="divider text-base-content/40 my-4">or</div>

          {/* Guest Mode Button */}
          <button 
            onClick={onGuestLogin}
            className="btn btn-outline btn-secondary w-full"
            disabled={loading}
          >
            <User className="w-5 h-5" />
            Try Guest Mode
          </button>

          {/* Invite-only notice */}
          <div className="text-center mt-6 space-y-2">
            <div className="alert alert-info py-3">
              <div className="text-left">
                <p className="font-medium text-sm">🔒 Access is invite-only</p>
                <p className="text-xs opacity-80 mt-1">
                  Want to join? Email{' '}
                  <a 
                    href="mailto:your-email@example.com?subject=Saras Access Request" 
                    className="link link-hover font-medium"
                  >
                    your-email@example.com
                  </a>
                </p>
              </div>
            </div>
            <p className="text-xs text-base-content/50">
              Guest mode stores progress locally on your device
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
