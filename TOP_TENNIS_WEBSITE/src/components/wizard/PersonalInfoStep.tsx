import React from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { User, Users, UserX, UserCheck, UserCog, UserCircle, MapPin, Car, Globe, Home, Building2, Mail as MailIcon } from 'lucide-react';
interface PersonalInfoStepProps {
  formData: {
    gender: string;
    ageRange: string;
    ageCompetitionPreference: string;
    travelDistance: string;
    location: string;
    city: string;
    zipCode: string;
  };
  updateFormData: (updates: any) => void;
}
const PersonalInfoStep = ({
  formData,
  updateFormData
}: PersonalInfoStepProps) => {
  return (
    <div className="space-y-10">
      {/* Gender */}
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xl font-bold text-foreground flex items-center gap-2">
            Select Your Gender <span className="text-destructive">*</span>
          </Label>
          <p className="text-sm text-muted-foreground">This helps us match you with the right players</p>
        </div>
        <RadioGroup value={formData.gender} onValueChange={value => updateFormData({
        gender: value
      })} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[{
          value: 'male',
          label: 'Male',
          icon: User
        }, {
          value: 'female',
          label: 'Female',
          icon: User
        }].map(option => <div key={option.value} className="relative group">
              <RadioGroupItem value={option.value} id={`gender-${option.value}`} className="absolute top-3 left-3 opacity-0 pointer-events-none" />
              <Label htmlFor={`gender-${option.value}`} className={`flex items-center justify-center p-5 rounded-xl border-2 cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md ${formData.gender === option.value ? 'border-primary bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg shadow-primary/20' : 'border-border bg-card hover:bg-accent/50 hover:border-primary/50'}`}>
                <option.icon className="h-5 w-5 mr-3" />
                <span className="font-semibold text-base">{option.label}</span>
              </Label>
            </div>)}
        </RadioGroup>
      </div>

      {/* Age Range */}
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xl font-bold text-foreground flex items-center gap-2">
            Select Your Age Range <span className="text-destructive">*</span>
          </Label>
          <p className="text-sm text-muted-foreground">Choose the age bracket that applies to you</p>
        </div>
        <RadioGroup value={formData.ageRange} onValueChange={value => {
          const newAgeRange = value;
          // Reset ageCompetitionPreference if it becomes invalid for the new age range
          const shouldResetPreference = newAgeRange === '18-25' && formData.ageCompetitionPreference === 'below-bracket';
          
          updateFormData({
            ageRange: newAgeRange,
            ageCompetitionPreference: shouldResetPreference ? '' : formData.ageCompetitionPreference
          });
        }} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[{
          value: '18-25',
          label: '18–25',
          icon: User
        }, {
          value: '26-40',
          label: '26–40',
          icon: UserCheck
        }, {
          value: '41-54',
          label: '41–54',
          icon: UserCog
        }, {
          value: '55-plus',
          label: '55+',
          icon: UserCircle
        }].map(option => <div key={option.value} className="relative group">
              <RadioGroupItem value={option.value} id={`age-${option.value}`} className="absolute top-2 left-2 opacity-0 pointer-events-none" />
              <Label htmlFor={`age-${option.value}`} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 h-24 shadow-sm hover:shadow-md ${formData.ageRange === option.value ? 'border-primary bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg shadow-primary/20' : 'border-border bg-card hover:bg-accent/50 hover:border-primary/50'}`}>
                <option.icon className="h-6 w-6 mb-2" />
                <span className="font-semibold text-sm text-center">{option.label}</span>
              </Label>
            </div>)}
        </RadioGroup>
      </div>

      {/* Age Competition Preference */}
      {formData.ageRange && (
        <div className="space-y-5 animate-fade-in">
          <div className="space-y-2">
            <Label className="text-xl font-bold text-foreground flex items-center gap-2">
              Select your competition bracket <span className="text-destructive">*</span>
            </Label>
            <div className="bg-gradient-to-r from-accent/50 to-accent/30 p-4 rounded-xl border border-border/50">
              <div className="text-sm space-y-2">
                <p className="font-medium text-foreground mb-2">⚠️ This preference only applies to Singles matches.</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                  <li>Players can compete within or below their age bracket</li>
                  <li>Players can go down up to 2 age brackets</li>
                </ul>
              </div>
            </div>
          </div>
          <RadioGroup 
            value={formData.ageCompetitionPreference} 
            onValueChange={value => updateFormData({ ageCompetitionPreference: value })} 
            className="grid grid-cols-1 gap-4"
          >
            {[
              {
                value: 'within-bracket',
                label: 'I want to compete within my age bracket',
                description: 'Compete with players in your same age group',
                showForAll: true
              },
              {
                value: 'below-bracket', 
                label: 'I want to compete below my age bracket',
                description: 'Compete with players in younger age groups (up to 2 brackets below)',
                showForAll: false,
                hideForBrackets: ['18-25'] // Can't go below the lowest bracket
              },
              {
                value: 'no-preference',
                label: 'I have no preference',
                description: 'Open to competing in any eligible bracket',
                showForAll: true
              }
            ]
            .filter(option => 
              option.showForAll || !option.hideForBrackets?.includes(formData.ageRange)
            )
            .map(option => (
              <div key={option.value} className="relative group">
                <RadioGroupItem 
                  value={option.value} 
                  id={`age-comp-${option.value}`} 
                  className="absolute top-4 left-4 opacity-0 pointer-events-none" 
                />
                <Label 
                  htmlFor={`age-comp-${option.value}`} 
                  className={`flex flex-col items-start justify-center p-5 rounded-xl border-2 cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md ${
                    formData.ageCompetitionPreference === option.value 
                      ? 'border-primary bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg shadow-primary/20' 
                      : 'border-border bg-card hover:bg-accent/50 hover:border-primary/50'
                  }`}
                >
                  <span className="font-semibold text-base mb-2">{option.label}</span>
                  <span className="text-sm text-muted-foreground">{option.description}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      )}

      {/* Travel Distance */}
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xl font-bold text-foreground flex items-center gap-2">
            Travel Distance <span className="text-destructive">*</span>
          </Label>
          <p className="text-sm text-muted-foreground">How far are you willing to travel to compete?</p>
        </div>
        <RadioGroup 
          value={formData.travelDistance} 
          onValueChange={value => updateFormData({ travelDistance: value })} 
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {[{
            value: '0-5',
            label: 'Within 5 miles',
            icon: MapPin
          }, {
            value: '0-10',
            label: '0–10 miles',
            icon: MapPin
          }, {
            value: '0-15',
            label: '0–15 miles',
            icon: Car
          }, {
            value: '0-20',
            label: '0–20 miles',
            icon: Car
          }, {
            value: '0-30',
            label: '0–30 miles',
            icon: Car
          }, {
            value: 'no-limit',
            label: "It doesn't matter",
            icon: Globe
          }].map(option => (
            <div key={option.value} className="relative group">
              <RadioGroupItem 
                value={option.value} 
                id={`travel-${option.value}`} 
                className="absolute top-3 left-3 opacity-0 pointer-events-none" 
              />
              <Label 
                htmlFor={`travel-${option.value}`} 
                className={`flex items-center justify-center p-5 rounded-xl border-2 cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md ${
                  formData.travelDistance === option.value 
                    ? 'border-primary bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg shadow-primary/20' 
                    : 'border-border bg-card hover:bg-accent/50 hover:border-primary/50'
                }`}
              >
                <option.icon className="h-5 w-5 mr-3" />
                <span className="font-semibold text-base">{option.label}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Home Court Address */}
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xl font-bold text-foreground flex items-center gap-2">
            Home Court Address <span className="text-destructive">*</span>
          </Label>
          <p className="text-sm text-muted-foreground">Enter your primary tennis court or club address</p>
        </div>
        <div className="relative">
          <Home className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            value={formData.location}
            onChange={e => updateFormData({ location: e.target.value })}
            placeholder="e.g., 123 Tennis Court Lane"
            className="pl-12 h-14 text-base"
          />
        </div>
      </div>

      {/* City and ZIP Code */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* City */}
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xl font-bold text-foreground flex items-center gap-2">
              City <span className="text-destructive">*</span>
            </Label>
            <p className="text-sm text-muted-foreground">Your city or town</p>
          </div>
          <div className="relative">
            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              value={formData.city}
              onChange={e => updateFormData({ city: e.target.value })}
              placeholder="e.g., Los Angeles"
              className="pl-12 h-14 text-base"
            />
          </div>
        </div>

        {/* ZIP Code */}
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xl font-bold text-foreground flex items-center gap-2">
              ZIP Code <span className="text-destructive">*</span>
            </Label>
            <p className="text-sm text-muted-foreground">Your postal code</p>
          </div>
          <div className="relative">
            <MailIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              value={formData.zipCode}
              onChange={e => updateFormData({ zipCode: e.target.value })}
              placeholder="e.g., 90210"
              className="pl-12 h-14 text-base"
              maxLength={10}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
export default PersonalInfoStep;