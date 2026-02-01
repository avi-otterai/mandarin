// Authentication hook for Supabase
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

// Default dev user credentials (only used in development mode)
const DEV_USER_EMAIL = 'your-email@example.com';
const DEV_USER_PASSWORD = import.meta.env.VITE_DEV_USER_PASSWORD || '';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });
  
  const autoLoginAttempted = useRef(false);

  // Auto-login function for dev mode
  const autoLoginDev = useCallback(async () => {
    if (autoLoginAttempted.current) return;
    autoLoginAttempted.current = true;
    
    // Only auto-login in development mode with password configured
    if (import.meta.env.MODE !== 'development' || !DEV_USER_PASSWORD) {
      console.log('[Auth] Auto-login skipped: not in dev mode or no password configured');
      return;
    }
    
    console.log('[Auth] Attempting auto-login for dev user...');
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: DEV_USER_EMAIL,
      password: DEV_USER_PASSWORD,
    });
    
    if (error) {
      console.warn('[Auth] Auto-login failed:', error.message);
      // Don't set error state - just let user login manually
    } else {
      console.log('[Auth] Auto-login successful');
      setState(prev => ({
        ...prev,
        user: data.user,
        session: data.session,
        loading: false,
      }));
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        setState(prev => ({ ...prev, error: error.message, loading: false }));
      } else if (session) {
        // Already have a session
        setState({
          user: session.user,
          session,
          loading: false,
          error: null,
        });
      } else {
        // No session - try auto-login in dev mode
        setState(prev => ({ ...prev, loading: false }));
        await autoLoginDev();
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setState(prev => ({
          ...prev,
          user: session?.user ?? null,
          session,
        }));
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [autoLoginDev]);

  const signIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setState(prev => ({ ...prev, error: error.message, loading: false }));
      return { success: false, error: error.message };
    }

    setState(prev => ({
      ...prev,
      user: data.user,
      session: data.session,
      loading: false,
    }));
    
    return { success: true, error: null };
  }, []);

  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      setState(prev => ({ ...prev, error: error.message, loading: false }));
      return { success: false, error: error.message };
    }

    setState({
      user: null,
      session: null,
      loading: false,
      error: null,
    });
    
    return { success: true, error: null };
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    signIn,
    signOut,
    clearError,
    isAuthenticated: !!state.user,
    isConfigured: isSupabaseConfigured(),
  };
}
