import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";
import ProfileWizard from "@/components/ProfileWizard";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const ProfileSetup = () => {
  const { user } = useAuth();
  const { player, createPlayerProfile } = usePlayerProfile();
  const navigate = useNavigate();

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Redirect if profile already exists, unless suppressed (during post-creation 5s screen)
  useEffect(() => {
    try {
      const suppress = localStorage.getItem('suppressProfileSetupRedirect') === 'true';
      if (player && !suppress) {
        navigate('/dashboard');
      }
    } catch {
      if (player) navigate('/dashboard');
    }
  }, [player, navigate]);

  const handleProfileCreated = () => {
    // Navigate to dashboard with schedule tab (My Schedule)
    navigate('/dashboard?tab=schedule');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 overflow-x-hidden">
      <Header />
      
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4 py-12 pt-24">
        <div className="w-full max-w-5xl">
          <div className="text-center mb-10 animate-fade-in">
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
                <div className="relative p-5 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full border border-primary/20 shadow-lg">
                  <img 
                    src="/logo.png" 
                    alt="Top Tennis League Logo" 
                    className="h-24 w-36 object-contain"
                  />
                </div>
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Complete Your Player Profile
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Complete your profile: Help us find the most competitive matches for you.
            </p>
          </div>
          
          <ProfileWizard 
            onProfileCreated={handleProfileCreated}
            createPlayerProfile={createPlayerProfile}
          />
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default ProfileSetup;