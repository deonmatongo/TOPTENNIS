import React from 'react';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sprout, Target, Trophy } from 'lucide-react';

interface SkillLevelStepProps {
  formData: {
    skillLevel: string;
    ustaRating: string;
  };
  updateFormData: (updates: any) => void;
}

const SkillLevelStep = ({ formData, updateFormData }: SkillLevelStepProps) => {
  const handleRatingChange = (value: string) => {
    updateFormData({ ustaRating: value });
  };

  return (
    <div className="space-y-10">
      {/* Skill Level */}
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xl font-bold text-foreground flex items-center gap-2">
            Tennis Skill Level <span className="text-destructive">*</span>
          </Label>
          <p className="text-sm text-muted-foreground">Be honest - this ensures fair and fun matches!</p>
        </div>
        <RadioGroup 
          value={formData.skillLevel} 
          onValueChange={value => updateFormData({ skillLevel: value })} 
          className="space-y-4"
        >
          {[
            { value: 'beginner', label: 'Beginner', icon: Sprout, desc: 'New to tennis or still learning basics', color: 'from-green-500/20 to-green-500/5' },
            { value: 'intermediate', label: 'Intermediate', icon: Target, desc: 'Reliable rally and serve, comfortable playing', color: 'from-blue-500/20 to-blue-500/5' },
            { value: 'advanced', label: 'Advanced', icon: Trophy, desc: 'League or tournament player, strong technique', color: 'from-amber-500/20 to-amber-500/5' }
          ].map(option => (
            <div key={option.value} className="relative group">
              <RadioGroupItem 
                value={option.value} 
                id={`skill-${option.value}`} 
                className="absolute top-4 left-4 opacity-0 pointer-events-none" 
              />
              <Label 
                htmlFor={`skill-${option.value}`}
                className={`flex items-center p-6 rounded-xl border-2 cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md ${
                  formData.skillLevel === option.value 
                    ? 'border-primary bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg shadow-primary/20' 
                    : 'border-border bg-card hover:bg-accent/50 hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mr-5 flex-shrink-0">
                  <option.icon className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-lg mb-1">{option.label}</div>
                  <div className="text-sm text-muted-foreground">{option.desc}</div>
                </div>
              </Label>
            </div>
          ))}
        </RadioGroup>
        
        <div className="mt-8 p-6 bg-gradient-to-r from-accent/50 to-accent/30 rounded-xl border border-border/50 shadow-sm">
          <Label htmlFor="level-rating" className="text-base font-semibold text-foreground mb-3 block">
            USTA Rating (Optional)
          </Label>
          <Select value={formData.ustaRating} onValueChange={handleRatingChange}>
            <SelectTrigger className="w-full sm:max-w-xs bg-background/80 backdrop-blur-sm border-border/50 h-12 text-base shadow-sm">
              <SelectValue placeholder="USTA Rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2.5">2.5</SelectItem>
              <SelectItem value="-3.0">-3.0</SelectItem>
              <SelectItem value="3.0">3.0</SelectItem>
              <SelectItem value="-3.5">-3.5</SelectItem>
              <SelectItem value="3.5">3.5</SelectItem>
              <SelectItem value="-4.0">-4.0</SelectItem>
              <SelectItem value="4.0">4.0</SelectItem>
              <SelectItem value="-4.5">-4.5</SelectItem>
              <SelectItem value="4.5">4.5</SelectItem>
              <SelectItem value="-5.0">-5.0</SelectItem>
            </SelectContent>
          </Select>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mt-3 ml-2">
            <li>If you have an official USTA Level rating, add it here for more precise matching</li>
            <li>Rating must be between 2.5 and 5.0</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SkillLevelStep;