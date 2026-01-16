import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import confetti from 'canvas-confetti';
interface PlayerProfileSetupProps {
  onProfileCreated: () => void;
  createPlayerProfile: (data: {
    name: string;
    email: string;
    phone?: string;
    skill_level?: number;
    age_range?: string;
    gender_preference?: string;
    competitiveness?: string;
    usta_rating?: string;
    gender?: string;
  }) => Promise<any>;
}
const PlayerProfileSetup = ({
  onProfileCreated,
  createPlayerProfile
}: PlayerProfileSetupProps) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    gender: '',
    ageRange: '',
    genderPreference: '',
    competitiveness: '',
    skillLevel: '',
    ustaRating: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    console.log('Form submission started with data:', formData);
    if (!formData.ageRange || !formData.genderPreference || !formData.competitiveness || !formData.skillLevel) {
      const errorMsg = 'Please answer all required questions';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }
    setLoading(true);
    try {
      console.log('Submitting form with data:', formData);

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
        name: 'Player', // Default name, will be updated from user context
        email: 'player@example.com', // Default email, will be updated from user context
        phone: formData.phone || undefined,
        skill_level: skillLevelNumeric,
        age_range: formData.ageRange,
        gender_preference: formData.genderPreference,
        competitiveness: formData.competitiveness,
        usta_rating: formData.ustaRating || undefined,
        gender: formData.gender || undefined
      };
      console.log('Calling createPlayerProfile with:', profileData);
      const result = await createPlayerProfile(profileData);
      console.log('Profile creation result:', result);
      
      // Signal dashboard to show confirmation screen and handle redirect
      try {
        localStorage.setItem('showProfileCreatedConfirmation', 'true');
      } catch (e) {
        console.warn('Could not access localStorage to set confirmation flag', e);
      }
      
      // Do not navigate here; Dashboard will show a 5s confirmation then switch to My Schedule
      return;
    } catch (error: any) {
      console.error('Error creating profile:', error);
      const errorMessage = error.message || 'Failed to create player profile. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
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
    <Card className="w-full bg-card/50 backdrop-blur-sm border border-border/50 shadow-xl">
      <CardContent className="p-8">
        {error && (
          <Alert className="mb-6 border-destructive/20 bg-destructive/5">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">
              {error}
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-8">
            {/* Gender */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-lg font-semibold text-foreground">What is your gender?</Label>
                <p className="text-sm text-muted-foreground">Optional - helps us match you with preferred players</p>
              </div>
              <RadioGroup 
                value={formData.gender} 
                onValueChange={value => setFormData({...formData, gender: value})} 
                className="grid grid-cols-2 gap-3"
              >
                {[
                  { value: 'male', label: 'Male', emoji: '🚹' },
                  { value: 'female', label: 'Female', emoji: '🚺' }
                ].map(option => (
                  <div key={option.value} className="relative">
                    <RadioGroupItem value={option.value} id={`gender-${option.value}`} className="peer absolute opacity-0" />
                    <Label 
                      htmlFor={`gender-${option.value}`}
                      className="flex items-center justify-center p-4 rounded-lg border-2 border-border bg-background hover:bg-accent hover:border-accent-foreground/20 peer-checked:border-primary peer-checked:bg-primary/5 cursor-pointer transition-all duration-200"
                    >
                      <span className="text-lg mr-2">{option.emoji}</span>
                      <span className="font-medium">{option.label}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Age Range */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-lg font-semibold text-foreground flex items-center">
                  What is your age range? <span className="text-destructive ml-1">*</span>
                </Label>
                <p className="text-sm text-muted-foreground">This helps us match you with players in your age group</p>
              </div>
              <RadioGroup 
                value={formData.ageRange} 
                onValueChange={value => setFormData({...formData, ageRange: value})} 
                className="grid grid-cols-3 gap-3"
              >
                {[
                  { value: 'under-18', label: 'Under 18', emoji: '👶' },
                  { value: '18-29', label: '18–29', emoji: '🧑' },
                  { value: '30-39', label: '30–39', emoji: '👩‍💼' },
                  { value: '40-49', label: '40–49', emoji: '👨‍💼' },
                  { value: '50-59', label: '50–59', emoji: '👩‍🦳' },
                  { value: '60-plus', label: '60+', emoji: '👴' }
                ].map(option => (
                  <div key={option.value} className="relative">
                    <RadioGroupItem value={option.value} id={`age-${option.value}`} className="peer absolute opacity-0" />
                    <Label 
                      htmlFor={`age-${option.value}`} 
                      className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-border bg-background hover:bg-accent hover:border-accent-foreground/20 peer-checked:border-primary peer-checked:bg-primary/5 cursor-pointer transition-all duration-200 h-20"
                    >
                      <span className="text-xl mb-1">{option.emoji}</span>
                      <span className="font-medium text-sm">{option.label}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Gender Preference */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-lg font-semibold text-foreground flex items-center">
                  Playing partner preference? <span className="text-destructive ml-1">*</span>
                </Label>
                <p className="text-sm text-muted-foreground">Choose who you'd prefer to play tennis with</p>
              </div>
              <RadioGroup 
                value={formData.genderPreference} 
                onValueChange={value => setFormData({...formData, genderPreference: value})} 
                className="space-y-3"
              >
                {[
                  { value: 'no-preference', label: 'No preference', emoji: '🤝', desc: 'Open to playing with anyone' },
                  { value: 'same-gender', label: 'Prefer same gender', emoji: '👥', desc: 'More comfortable with same gender' },
                  { value: 'mixed', label: 'Prefer mixed', emoji: '🌈', desc: 'Enjoy playing with different genders' }
                ].map(option => (
                  <div key={option.value} className="relative">
                    <RadioGroupItem value={option.value} id={`preference-${option.value}`} className="peer absolute opacity-0" />
                    <Label 
                      htmlFor={`preference-${option.value}`}
                      className="flex items-center p-4 rounded-lg border-2 border-border bg-background hover:bg-accent hover:border-accent-foreground/20 peer-checked:border-primary peer-checked:bg-primary/5 cursor-pointer transition-all duration-200"
                    >
                      <span className="text-2xl mr-4">{option.emoji}</span>
                      <div className="flex-1">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-sm text-muted-foreground">{option.desc}</div>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Competitiveness */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-lg font-semibold text-foreground flex items-center">
                  How competitive are you? <span className="text-destructive ml-1">*</span>
                </Label>
                <p className="text-sm text-muted-foreground">This helps us match you with like-minded players</p>
              </div>
              <RadioGroup 
                value={formData.competitiveness} 
                onValueChange={value => setFormData({...formData, competitiveness: value})} 
                className="space-y-3"
              >
                {[
                  { value: 'fun', label: 'Just for fun', emoji: '🎾', desc: 'Casual games, enjoying the sport' },
                  { value: 'casual', label: 'Casual but like to win', emoji: '😎', desc: 'Competitive spirit but relaxed atmosphere' },
                  { value: 'competitive', label: 'Very competitive', emoji: '🏆', desc: 'Serious matches, tournament-style play' }
                ].map(option => (
                  <div key={option.value} className="relative">
                    <RadioGroupItem value={option.value} id={`competitive-${option.value}`} className="peer absolute opacity-0" />
                    <Label 
                      htmlFor={`competitive-${option.value}`}
                      className="flex items-center p-4 rounded-lg border-2 border-border bg-background hover:bg-accent hover:border-accent-foreground/20 peer-checked:border-primary peer-checked:bg-primary/5 cursor-pointer transition-all duration-200"
                    >
                      <span className="text-2xl mr-4">{option.emoji}</span>
                      <div className="flex-1">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-sm text-muted-foreground">{option.desc}</div>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Skill Level */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-lg font-semibold text-foreground flex items-center">
                  What's your tennis skill level? <span className="text-destructive ml-1">*</span>
                </Label>
                <p className="text-sm text-muted-foreground">Be honest - this ensures fair and fun matches!</p>
              </div>
              <RadioGroup 
                value={formData.skillLevel} 
                onValueChange={value => setFormData({...formData, skillLevel: value})} 
                className="space-y-3"
              >
                {[
                  { value: 'beginner', label: 'Beginner', emoji: '🌱', desc: 'New to tennis or still learning basics' },
                  { value: 'intermediate', label: 'Intermediate', emoji: '🎯', desc: 'Reliable rally and serve, comfortable playing' },
                  { value: 'advanced', label: 'Advanced', emoji: '🏆', desc: 'League or tournament player, strong technique' }
                ].map(option => (
                  <div key={option.value} className="relative">
                    <RadioGroupItem value={option.value} id={`skill-${option.value}`} className="peer absolute opacity-0" />
                    <Label 
                      htmlFor={`skill-${option.value}`}
                      className="flex items-center p-4 rounded-lg border-2 border-border bg-background hover:bg-accent hover:border-accent-foreground/20 peer-checked:border-primary peer-checked:bg-primary/5 cursor-pointer transition-all duration-200"
                    >
                      <span className="text-2xl mr-4">{option.emoji}</span>
                      <div className="flex-1">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-sm text-muted-foreground">{option.desc}</div>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              
              <div className="mt-6 p-4 bg-accent/30 rounded-lg">
                <Label htmlFor="usta-rating" className="text-sm font-medium text-foreground mb-2 block">
                  USTA Rating (Optional)
                </Label>
                <Input 
                  id="usta-rating" 
                  type="text" 
                  placeholder="e.g., 3.5, 4.0, 4.5" 
                  value={formData.ustaRating} 
                  onChange={e => setFormData({...formData, ustaRating: e.target.value})} 
                  className="max-w-xs bg-background"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  If you have an official USTA rating, add it here for better matching
                </p>
              </div>
            </div>
            
            <div className="pt-6">
              <Button 
                type="submit" 
                className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200" 
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating Your Profile...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span>Complete Profile & Get Started</span>
                    <span className="text-xl">🚀</span>
                  </div>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
  );
};
export default PlayerProfileSetup;