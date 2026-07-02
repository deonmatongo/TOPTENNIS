import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, firstName: string, lastName: string, phone?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: (redirectTo?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  logger.debug('AuthProvider: Component initializing');
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logger.debug('AuthProvider: Setting up auth state listener');
    
    let mounted = true;
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        logger.info('Auth state changed', { event });
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Log authentication activity - deferred to avoid deadlock
        if (event === 'SIGNED_IN' && session?.user) {
          setTimeout(() => {
            logUserActivity('user_logged_in', {
              provider: session.user.app_metadata?.provider || 'email',
              timestamp: new Date().toISOString()
            });
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          setTimeout(() => {
            logUserActivity('user_logged_out', {
              timestamp: new Date().toISOString()
            });
          }, 0);
        } else if (event === 'PASSWORD_RECOVERY') {
          logger.info('Password recovery mode active');
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      logger.debug('AuthProvider: Checking existing session', { hasSession: !!session });
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      logger.error('AuthProvider: Error getting session', { error });
      if (!mounted) return;
      setLoading(false);
    });

    return () => {
      logger.debug('AuthProvider: Cleaning up auth state listener');
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logUserActivity = async (activityType: string, metadata?: any) => {
    try {
      logger.debug('Logging user activity', { activityType });
      await supabase
        .from('user_activity_log')
        .insert({
          user_id: user?.id || null,
          activity_type: activityType,
          metadata: metadata || null
        });
    } catch (error) {
      logger.warn('Failed to log activity', { activityType, error });
    }
  };

  const signUp = useCallback(async (email: string, password: string, firstName: string, lastName: string, phone?: string) => {
    try {
      logger.info('AuthProvider: Starting signup process');
      
      // Client-side validation
      if (password.length < 8) {
        return { 
          error: { message: 'Password must be at least 8 characters long.' } 
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            first_name: firstName,
            last_name: lastName,
            phone: phone
          }
        }
      });
      
      if (error) {
        logger.warn('Signup error details', { message: error.message });
        
        // Handle specific error cases
        if (error.message.includes('User already registered') || 
            error.message.includes('already registered') ||
            error.message.includes('unique constraint') ||
            error.message.includes('duplicate key value')) {
          return { error: { message: 'An account with this email already exists. Please sign in instead.' } };
        }
        if (error.message.includes('Password should be at least')) {
          return { error: { message: 'Password must be at least 8 characters long.' } };
        }
        if (error.message.includes('Invalid email')) {
          return { error: { message: 'Please enter a valid email address.' } };
        }
        if (error.message.includes('Signup is disabled')) {
          return { error: { message: 'Account registration is currently disabled.' } };
        }
        return { error };
      }

      logger.info('AuthProvider: Signup successful');

      setTimeout(() => {
        logUserActivity('registration_attempt', {
          timestamp: new Date().toISOString()
        });
      }, 0);

      return { error: null };
    } catch (err: any) {
      logger.error('Signup error', { err });
      return { error: { message: 'An unexpected error occurred during registration' } };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      logger.info('AuthProvider: Starting signin process');
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        logger.warn('Signin error details', { message: error.message });
        
        if (error.message.includes('Invalid login credentials') || 
            error.message.includes('Invalid email or password')) {
          return { error: { message: 'Email or password is incorrect. Please try again.' } };
        }
        if (error.message.includes('Too many requests') || error.message.includes('rate limit')) {
          return { error: { message: 'Too many login attempts. Please wait a few minutes before trying again.' } };
        }
        if (error.message.includes('Email not confirmed')) {
          return { error: { message: 'Please verify your email address before signing in.' } };
        }
        return { error };
      }

      logger.info('AuthProvider: Signin successful');

      setTimeout(() => {
        logUserActivity('login_attempt', {
          success: true,
          timestamp: new Date().toISOString()
        });
      }, 0);
      
      return { error: null };
    } catch (err: any) {
      logger.error('Signin error', { err });
      return { error: { message: 'An unexpected error occurred during sign in' } };
    }
  }, []);

  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    try {
      logger.info('AuthProvider: Starting Google OAuth signin');
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo || `${window.location.origin}/dashboard`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          // Only request necessary scopes for GDPR/CCPA compliance
          scopes: 'openid email profile'
        }
      });

      if (error) {
        logger.error('Google signin error', { message: error.message });
        
        if (error.message.includes('access_denied') || error.message.includes('denied')) {
          return { error: { message: 'Google sign-in was cancelled or denied. Please try again.' } };
        }
        if (error.message.includes('popup_closed')) {
          return { error: { message: 'Sign-in popup was closed. Please try again.' } };
        }
        if (error.message.includes('network')) {
          return { error: { message: 'Network error. Please check your connection and try again.' } };
        }
        return { error };
      }

      logger.info('Google OAuth initiated successfully');
      return { error: null };
    } catch (err: any) {
      logger.error('Google signin error', { err });
      return { error: { message: 'An unexpected error occurred. Please try again.' } };
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      logger.info('AuthProvider: Starting password reset');
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) {
        logger.warn('Password reset error', { message: error.message });
        
        if (error.message.includes('rate limit') || error.message.includes('Too many')) {
          return { error: { message: 'Too many reset attempts. Please wait before trying again.' } };
        }
        return { error };
      }

      logger.info('Password reset email sent successfully');
      return { error: null };
    } catch (err: any) {
      logger.error('Password reset error', { err });
      return { error: { message: 'An unexpected error occurred. Please try again.' } };
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      logger.info('AuthProvider: Updating password');
      
      if (newPassword.length < 8) {
        return { error: { message: 'Password must be at least 8 characters long.' } };
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) {
        logger.warn('Password update error', { message: error.message });
        return { error };
      }

      logger.info('Password updated successfully');
      return { error: null };
    } catch (err: any) {
      logger.error('Password update error', { err });
      return { error: { message: 'An unexpected error occurred. Please try again.' } };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      logger.info('AuthProvider: Starting signout process');
      
      setUser(null);
      setSession(null);
      
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
      
      await supabase.auth.signOut({ scope: 'global' });
      
      logger.info('AuthProvider: Signout successful');
    } catch (error) {
      logger.error('Signout error', { error });
      setUser(null);
      setSession(null);
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
    }
  }, []);

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword
  };

  logger.debug('AuthProvider: Rendering', { hasUser: !!user, loading });
 
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
