import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import PersonalInfoStep from './wizard/PersonalInfoStep';
import PlayingPreferencesStep from './wizard/PlayingPreferencesStep';
import SkillLevelStep from './wizard/SkillLevelStep';
import ProfileSummaryStep from './wizard/ProfileSummaryStep';
import { toast } from "sonner";
import confetti from 'canvas-confetti';

interface ProfileWizardProps {
  onProfileCreated: () => void;
  createPlayerProfile: (data: {
    name: string;
    email: string;
    phone?: string;
    skill_level?: number;
    age_range?: string;
    age_competition_preference?: string;
    travel_distance?: string;
    gender_preference?: string;
    competitiveness?: string;
    usta_rating?: string;
    gender?: string;
    location?: string;
    city?: string;
    zip_code?: string;
  }) => Promise<any>;
}

interface FormData {
  gender: string;
  ageRange: string;
  ageCompetitionPreference: string;
  travelDistance: string;
  genderPreference: string;
  competitiveness: string;
  skillLevel: string;
  ustaRating: string;
  location: string;
  city: string;
  zipCode: string;
}

const ProfileWizard = ({ onProfileCreated, createPlayerProfile }: ProfileWizardProps) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([1]));
  const [formData, setFormData] = useState<FormData>({
    gender: '',
    ageRange: '',
    ageCompetitionPreference: '',
    travelDistance: '',
    genderPreference: '',
    competitiveness: '',
    skillLevel: '',
    ustaRating: '',
    location: '',
    city: '',
    zipCode: ''
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentStep, showConfirmation]);

  useEffect(() => {
    if (showConfirmation) {
      // Trigger confetti animation
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [showConfirmation]);

  const totalSteps = 4;
  // Show 90% on last step, 100% only after completion
  const progress = showConfirmation ? 100 : currentStep === totalSteps ? 90 : (currentStep / totalSteps) * 100;

  const stepTitles = [
    "Personal Information",
    "Playing Preferences", 
    "Skill Level",
    "Review & Submit"
  ];

  const updateFormData = (updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return formData.ageRange !== '' && 
               formData.gender !== '' && 
               formData.ageCompetitionPreference !== '' && 
               formData.travelDistance !== '' &&
               formData.location !== '' &&
               formData.city !== '' &&
               formData.zipCode !== '';
      case 2:
        return formData.genderPreference !== '' && formData.competitiveness !== '';
      case 3:
        return formData.skillLevel !== '';
      case 4:
        return true; // Summary step is always valid if we got here
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      const nextStepNum = Math.min(currentStep + 1, totalSteps);
      setCurrentStep(nextStepNum);
      setVisitedSteps(prev => new Set([...prev, nextStepNum]));
    } else {
      toast.error('Please complete all required fields before continuing');
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const goToStep = (step: number) => {
    // Allow navigation to visited steps or if all previous steps are valid
    const canNavigate = visitedSteps.has(step) || validateAllStepsUpTo(step - 1);
    
    if (canNavigate) {
      setCurrentStep(step);
      setVisitedSteps(prev => new Set([...prev, step]));
    } else {
      toast.error('Please complete all previous steps first');
    }
  };

  const validateAllStepsUpTo = (step: number): boolean => {
    for (let i = 1; i <= step; i++) {
      if (!validateStep(i)) {
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) {
      toast.error('Please complete all required fields');
      return;
    }

    setLoading(true);
    
    // Set suppression flag BEFORE creating profile to prevent premature redirect
    try {
      localStorage.setItem('suppressProfileSetupRedirect', 'true');
    } catch (e) {
      console.warn('Could not access localStorage to set suppression flag', e);
    }
    
    try {
      // Map skill level to numeric value
      let skillLevelNumeric = 5;
      switch (formData.skillLevel) {
        case 'beginner':
          skillLevelNumeric = 3;
          break;
        case 'intermediate':
          skillLevelNumeric = 6;
          break;
        case 'advanced':
          skillLevelNumeric = 9;
          break;
      }

      const profileData = {
        name: user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'Player',
        email: user?.email || '',
        skill_level: skillLevelNumeric,
        age_range: formData.ageRange,
        age_competition_preference: formData.ageCompetitionPreference,
        travel_distance: formData.travelDistance,
        gender_preference: formData.genderPreference,
        competitiveness: formData.competitiveness,
        usta_rating: formData.ustaRating || undefined,
        gender: formData.gender || undefined,
        location: formData.location,
        city: formData.city,
        zip_code: formData.zipCode
      };

      await createPlayerProfile(profileData);

      // Signal dashboard (as fallback) to show confirmation overlay after redirect
      try {
        localStorage.setItem('showProfileCreatedConfirmation', 'true');
      } catch (e) {
        console.warn('Could not access localStorage to set confirmation flag', e);
      }
      
      // Show confirmation message with 5-second display
      setShowConfirmation(true);
      
      setTimeout(() => {
        try {
          localStorage.removeItem('suppressProfileSetupRedirect');
        } catch (e) {
          console.warn('Could not access localStorage to remove suppression flag', e);
        }
        onProfileCreated();
      }, 5000);
    } catch (error: any) {
      console.error('Error creating profile:', error);
      const errorMessage = error.message || 'Failed to create player profile. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <PersonalInfoStep 
            formData={formData}
            updateFormData={updateFormData}
          />
        );
      case 2:
        return (
          <PlayingPreferencesStep 
            formData={formData}
            updateFormData={updateFormData}
          />
        );
      case 3:
        return (
          <SkillLevelStep 
            formData={formData}
            updateFormData={updateFormData}
          />
        );
      case 4:
        return (
          <ProfileSummaryStep 
            formData={formData}
          />
        );
      default:
        return null;
    }
  };

  if (showConfirmation) {
    return (
      <Card className="w-full max-w-3xl mx-auto bg-card/80 backdrop-blur-xl border border-border/50 shadow-2xl animate-scale-in">
        <CardContent className="p-10 sm:p-16 text-center">
          <div className="flex flex-col items-center space-y-8">
            <div className="relative">
              <div className="text-6xl">🎉</div>
            </div>
            <div className="space-y-5">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
                Congratulations!
              </h2>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-lg leading-relaxed">
                You have successfully created your profile.
              </p>
              <p className="text-lg sm:text-xl font-semibold text-foreground max-w-lg leading-relaxed">
                Now, let's update your calendar to show your availability.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-3xl mx-auto bg-card/80 backdrop-blur-xl border border-border/50 shadow-2xl overflow-hidden animate-fade-in">
      <CardContent className="p-6 sm:p-8 lg:p-10">
        {/* Progress Header */}
        <div className="mb-8 sm:mb-10">
          {/* Step Selector */}
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stepTitles.map((title, index) => {
              const stepNum = index + 1;
              const isActive = stepNum === currentStep;
              const isCompleted = stepNum < currentStep || visitedSteps.has(stepNum);
              const canAccess = visitedSteps.has(stepNum) || validateAllStepsUpTo(stepNum - 1);
              
              return (
                <button
                  key={stepNum}
                  onClick={() => goToStep(stepNum)}
                  disabled={!canAccess && stepNum !== currentStep}
                  className={`relative p-3 rounded-lg border-2 transition-all duration-300 text-left ${
                    isActive
                      ? 'border-primary bg-primary/10 shadow-md'
                      : isCompleted
                      ? 'border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 cursor-pointer'
                      : canAccess
                      ? 'border-border bg-card hover:bg-accent/50 hover:border-primary/30 cursor-pointer'
                      : 'border-border bg-muted/30 cursor-not-allowed opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : isCompleted
                          ? 'bg-primary/60 text-primary-foreground'
                          : 'bg-border text-muted-foreground'
                      }`}
                    >
                      {stepNum}
                    </div>
                    {isCompleted && stepNum !== currentStep && (
                      <div className="text-primary text-xs">✓</div>
                    )}
                  </div>
                  <div className={`text-xs font-medium line-clamp-2 ${
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {title}
                  </div>
                </button>
              );
            })}
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Step {currentStep} of {totalSteps}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                {stepTitles[currentStep - 1]}
              </h2>
            </div>
            <div className="flex items-center gap-2 bg-accent/30 px-4 py-2 rounded-full">
              <div className="text-2xl font-bold text-primary">{Math.round(progress)}%</div>
              <span className="text-sm text-muted-foreground">Complete</span>
            </div>
          </div>
          <Progress value={progress} className="h-3 shadow-inner" />
        </div>

        {/* Step Content */}
        <div className="min-h-[350px] sm:min-h-[450px] mb-8 animate-fade-in">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pt-8 border-t border-border/50 gap-4">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center justify-center gap-2 w-full sm:w-auto h-12 text-base font-medium hover-scale transition-all disabled:opacity-50"
          >
            <ChevronLeft className="h-5 w-5" />
            <span>Previous</span>
          </Button>

          {currentStep < totalSteps ? (
            <Button
              onClick={nextStep}
              disabled={!validateStep(currentStep)}
              className="flex items-center justify-center gap-2 w-full sm:w-auto h-12 text-base font-medium bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg hover-scale transition-all disabled:opacity-50"
            >
              <span>Continue</span>
              <ChevronRight className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading || !validateStep(4)}
              className="flex items-center justify-center gap-2 w-full sm:w-auto h-12 text-base font-medium bg-gradient-to-r from-primary to-accent shadow-lg hover-scale transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Trophy className="h-5 w-5" />
                  <span>Submit</span>
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileWizard;