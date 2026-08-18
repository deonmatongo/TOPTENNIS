import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';

interface AuthRedirectProps {
  children: React.ReactNode;
}

const AuthRedirect = ({ children }: AuthRedirectProps) => {
  const { user, loading: authLoading, pendingClaim } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for both auth and user profile to load
    if (authLoading || profileLoading) return;

    // signUp() creates a session (flipping `user` truthy) before claimProfile()
    // has run. Redirecting here would unmount Register.tsx mid-claim and leave
    // an account with no username and no security question. pendingClaim keeps
    // this gate closed until claimProfile() finishes.
    if (pendingClaim) return;

    // If user is authenticated
    if (user) {
      // Check if profile is completed
      if (!profile?.profile_completed) {
        // Profile not completed, redirect to profile setup
        navigate('/profile-setup', { replace: true });
      } else {
        // Profile completed, redirect to dashboard
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, profile, authLoading, profileLoading, pendingClaim, navigate]);

  // Show loading while checking auth and profile status
  if (authLoading || (user && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-blue-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated (and the claim isn't still pending) but we're
  // still here, don't show children — the redirect above is happening.
  if (user && !pendingClaim) {
    return null;
  }

  // User is not authenticated (or is mid-claim), show the children (login/register forms)
  return <>{children}</>;
};

export default AuthRedirect;