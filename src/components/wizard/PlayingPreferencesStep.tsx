import React from 'react';
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Users, UserCheck, UserPlus, Heart, ThumbsUp, Trophy } from 'lucide-react';
interface PlayingPreferencesStepProps {
  formData: {
    genderPreference: string;
    competitiveness: string;
  };
  updateFormData: (updates: any) => void;
}
const PlayingPreferencesStep = ({
  formData,
  updateFormData
}: PlayingPreferencesStepProps) => {
  return <div className="space-y-10">
      {/* Gender Preference */}
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xl font-bold text-foreground flex items-center gap-2">
            Playing Preference <span className="text-destructive">*</span>
          </Label>
          <p className="text-sm text-muted-foreground">Choose who you'd prefer to play tennis against. (This preference only applies to casual matches)</p>
        </div>
        <RadioGroup value={formData.genderPreference} onValueChange={value => updateFormData({
        genderPreference: value
      })} className="space-y-4">
          {[{
          value: 'same-gender',
          label: 'Prefer same gender',
          icon: UserCheck,
          desc: 'More comfortable with same gender'
        }, {
          value: 'no-preference',
          label: 'No preference',
          icon: Users,
          desc: 'Open to playing with anyone'
        }].map(option => <div key={option.value} className="relative group">
              <RadioGroupItem value={option.value} id={`preference-${option.value}`} className="absolute top-4 left-4 opacity-0 pointer-events-none" />
              <Label htmlFor={`preference-${option.value}`} className={`flex items-center p-6 rounded-xl border-2 cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md ${formData.genderPreference === option.value ? 'border-primary bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg shadow-primary/20' : 'border-border bg-card hover:bg-accent/50 hover:border-primary/50'}`}>
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mr-5 flex-shrink-0">
                  <option.icon className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-lg mb-1">{option.label}</div>
                  <div className="text-sm text-muted-foreground">{option.desc}</div>
                </div>
              </Label>
            </div>)}
        </RadioGroup>
      </div>

      {/* Competitiveness */}
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xl font-bold text-foreground flex items-center gap-2">
            Competitiveness Level <span className="text-destructive">*</span>
          </Label>
          <p className="text-sm text-muted-foreground">This helps us match you with like-minded players</p>
        </div>
        <RadioGroup value={formData.competitiveness} onValueChange={value => updateFormData({
        competitiveness: value
      })} className="space-y-4">
          {[{
          value: 'fun',
          label: 'Just for fun',
          icon: Heart,
          desc: 'Casual games, enjoying the sport'
        }, {
          value: 'casual',
          label: 'Casual but like to win',
          icon: ThumbsUp,
          desc: 'Competitive spirit but relaxed atmosphere'
        }, {
          value: 'competitive',
          label: 'Very competitive',
          icon: Trophy,
          desc: 'Serious matches, tournament-style play'
        }].map(option => <div key={option.value} className="relative group">
              <RadioGroupItem value={option.value} id={`competitive-${option.value}`} className="absolute top-4 left-4 opacity-0 pointer-events-none" />
              <Label htmlFor={`competitive-${option.value}`} className={`flex items-center p-6 rounded-xl border-2 cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md ${formData.competitiveness === option.value ? 'border-primary bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg shadow-primary/20' : 'border-border bg-card hover:bg-accent/50 hover:border-primary/50'}`}>
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mr-5 flex-shrink-0">
                  <option.icon className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-lg mb-1">{option.label}</div>
                  <div className="text-sm text-muted-foreground">{option.desc}</div>
                </div>
              </Label>
            </div>)}
        </RadioGroup>
      </div>
    </div>;
};
export default PlayingPreferencesStep;