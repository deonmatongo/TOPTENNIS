import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Trophy, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import PersonalInfoStep from './wizard/PersonalInfoStep';
import PlayingPreferencesStep from './wizard/PlayingPreferencesStep';
import SkillLevelStep from './wizard/SkillLevelStep';
import ProfileSummaryStep from './wizard/ProfileSummaryStep';
import { toast } from "sonner";
import confetti from 'canvas-confetti';

interface ProfileWizardProps {
  onProfileCreated: () => void;
  onStepChange?: (step: number) => void;
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

const STEP_TITLES = [
  "Personal Information",
  "Playing Preferences",
  "Skill Level",
  "Review & Submit",
];

const ProfileWizard = ({ onProfileCreated, createPlayerProfile, onStepChange }: ProfileWizardProps) => {
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
    zipCode: '',
  });

  const totalSteps = 4;
  const progress = showConfirmation ? 100 : currentStep === totalSteps ? 90 : (currentStep / totalSteps) * 100;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentStep, showConfirmation]);

  useEffect(() => {
    onStepChange?.(currentStep);
  }, [currentStep, onStepChange]);

  useEffect(() => {
    if (!showConfirmation) return;
    const duration = 3000;
    const end = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };
    const rand = (min: number, max: number) => Math.random() * (max - min) + min;
    const interval = setInterval(() => {
      const left = end - Date.now();
      if (left <= 0) return clearInterval(interval);
      const count = 50 * (left / duration);
      confetti({ ...defaults, particleCount: count, origin: { x: rand(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount: count, origin: { x: rand(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
    return () => clearInterval(interval);
  }, [showConfirmation]);

  const updateFormData = (updates: Partial<FormData>) => setFormData(prev => ({ ...prev, ...updates }));

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.ageRange && formData.gender && formData.ageCompetitionPreference && formData.travelDistance && formData.location && formData.city && formData.zipCode);
      case 2:
        return !!(formData.genderPreference && formData.competitiveness);
      case 3:
        return !!formData.skillLevel;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const validateAllStepsUpTo = (step: number): boolean => {
    for (let i = 1; i <= step; i++) if (!validateStep(i)) return false;
    return true;
  };

  const goToStep = (step: number) => {
    if (visitedSteps.has(step) || validateAllStepsUpTo(step - 1)) {
      setCurrentStep(step);
      setVisitedSteps(prev => new Set([...prev, step]));
    } else {
      toast.error('Please complete all previous steps first');
    }
  };

  const nextStep = () => {
    if (!validateStep(currentStep)) { toast.error('Please complete all required fields before continuing'); return; }
    const next = Math.min(currentStep + 1, totalSteps);
    setCurrentStep(next);
    setVisitedSteps(prev => new Set([...prev, next]));
  };

  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
    if (!validateStep(4)) { toast.error('Please complete all required fields'); return; }
    setLoading(true);
    try {
      localStorage.setItem('suppressProfileSetupRedirect', 'true');
    } catch {}

    try {
      const skillMap: Record<string, number> = { beginner: 3, intermediate: 6, advanced: 9 };
      await createPlayerProfile({
        name: user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'Player',
        email: user?.email || '',
        skill_level: skillMap[formData.skillLevel] ?? 5,
        age_range: formData.ageRange,
        age_competition_preference: formData.ageCompetitionPreference,
        travel_distance: formData.travelDistance,
        gender_preference: formData.genderPreference,
        competitiveness: formData.competitiveness,
        usta_rating: formData.ustaRating || undefined,
        gender: formData.gender || undefined,
        location: formData.location,
        city: formData.city,
        zip_code: formData.zipCode,
      });
      try { localStorage.setItem('showProfileCreatedConfirmation', 'true'); } catch {}
      setShowConfirmation(true);
      setTimeout(() => {
        try { localStorage.removeItem('suppressProfileSetupRedirect'); } catch {}
        onProfileCreated();
      }, 5000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create player profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <PersonalInfoStep formData={formData} updateFormData={updateFormData} />;
      case 2: return <PlayingPreferencesStep formData={formData} updateFormData={updateFormData} />;
      case 3: return <SkillLevelStep formData={formData} updateFormData={updateFormData} />;
      case 4: return <ProfileSummaryStep formData={formData} />;
      default: return null;
    }
  };

  /* ── Confirmation screen ── */
  if (showConfirmation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center py-12">
        <div className="h-20 w-20 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: "rgba(249,115,22,0.1)" }}>
          <CheckCircle className="h-10 w-10 text-orange-500" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 mb-3">You're all set!</h2>
        <p className="text-base text-gray-500 max-w-md leading-relaxed mb-2">
          Your player profile has been created. We're finding matches and leagues for you now.
        </p>
        <p className="text-sm font-semibold text-orange-500 mb-8">
          Next up — update your calendar to show your availability.
        </p>
        <span className="inline-block h-6 w-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  /* ── Wizard ── */
  return (
    <div className="w-full">

      {/* Step tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
        {STEP_TITLES.map((title, i) => {
          const num = i + 1;
          const isActive = num === currentStep;
          const isDone = num < currentStep;
          const canAccess = visitedSteps.has(num) || validateAllStepsUpTo(num - 1);

          return (
            <button
              key={num}
              onClick={() => goToStep(num)}
              disabled={!canAccess && num !== currentStep}
              className="relative p-3 rounded-xl border text-left transition-all"
              style={{
                backgroundColor: isActive ? "rgba(249,115,22,0.07)" : isDone ? "rgba(249,115,22,0.04)" : "#fff",
                borderColor: isActive ? "#f97316" : isDone ? "rgba(249,115,22,0.3)" : "#e5e7eb",
                opacity: !canAccess && !isDone && !isActive ? 0.45 : 1,
                cursor: canAccess ? "pointer" : "not-allowed",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="h-6 w-6 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0"
                  style={{
                    backgroundColor: isActive ? "#f97316" : isDone ? "rgba(249,115,22,0.15)" : "#f3f4f6",
                    color: isActive ? "#fff" : isDone ? "#f97316" : "#9ca3af",
                  }}
                >
                  {isDone
                    ? <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    : num
                  }
                </div>
              </div>
              <p className={`text-xs font-bold leading-tight ${isActive ? "text-orange-500" : isDone ? "text-gray-500" : "text-gray-400"}`}>
                {title}
              </p>
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">Step {currentStep} of {totalSteps}</p>
            <h2 className="text-xl font-black text-gray-900">{STEP_TITLES[currentStep - 1]}</h2>
          </div>
          <span className="text-2xl font-black text-orange-500">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundColor: "#f97316" }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="min-h-[380px] mb-8">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-4 pt-6 border-t border-gray-100">
        <button
          onClick={prevStep}
          disabled={currentStep === 1}
          className="flex items-center gap-2 h-11 px-6 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>

        {currentStep < totalSteps ? (
          <button
            onClick={nextStep}
            disabled={!validateStep(currentStep)}
            className="flex items-center gap-2 h-11 px-8 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-black tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading || !validateStep(4)}
            className="flex items-center gap-2 h-11 px-8 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-black tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading
              ? <><span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Submitting…</>
              : <><Trophy className="h-4 w-4" /> Complete Profile</>
            }
          </button>
        )}
      </div>
    </div>
  );
};

export default ProfileWizard;
