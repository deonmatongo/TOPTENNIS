import React from 'react';
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { CheckCircle2 } from 'lucide-react';

interface ProfileSummaryStepProps {
  formData: {
    gender: string;
    ageRange: string;
    ageCompetitionPreference: string;
    travelDistance: string;
    location: string;
    city: string;
    zipCode: string;
    genderPreference: string;
    competitiveness: string;
    skillLevel: string;
    ustaRating: string;
  };
}

const ProfileSummaryStep = ({ formData }: ProfileSummaryStepProps) => {
  const formatValue = (value: string): string => {
    // Format the display values
    const formatMap: { [key: string]: string } = {
      'male': 'Male',
      'female': 'Female',
      '18-25': '18-25',
      '26-40': '26-40',
      '41-54': '41-54',
      '55-plus': '55+',
      'within-bracket': 'I want to compete within my age bracket',
      'below-bracket': 'I want to compete below my age bracket',
      'no-preference': 'I have no preference',
      '0-5': 'Within 5 miles',
      '0-10': '0-10 miles',
      '0-15': '0-15 miles',
      '0-20': '0-20 miles',
      '0-30': '0-30 miles',
      'no-limit': "It doesn't matter",
      'same-gender': 'Prefer same gender',
      'fun': 'Just for fun',
      'casual': 'Casual but like to win',
      'competitive': 'Very competitive',
      'beginner': 'Beginner',
      'intermediate': 'Intermediate',
      'advanced': 'Advanced'
    };
    
    return formatMap[value] || value;
  };

  const sections = [
    {
      title: 'Personal Information',
      items: [
        { label: 'Gender', value: formData.gender },
        { label: 'Age Range', value: formData.ageRange },
        { label: 'Competition Bracket', value: formData.ageCompetitionPreference },
        { label: 'Travel Distance', value: formData.travelDistance },
        { label: 'Home Court Address', value: formData.location },
        { label: 'City', value: formData.city },
        { label: 'ZIP Code', value: formData.zipCode }
      ]
    },
    {
      title: 'Playing Preferences',
      items: [
        { label: 'Playing Preference', value: formData.genderPreference },
        { label: 'Competitiveness Level', value: formData.competitiveness }
      ]
    },
    {
      title: 'Skill Level',
      items: [
        { label: 'Tennis Skill Level', value: formData.skillLevel },
        { label: 'USTA Rating', value: formData.ustaRating || 'Not provided' }
      ]
    }
  ];

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <h3 className="text-2xl font-bold text-foreground">Review Your Profile</h3>
        <p className="text-muted-foreground">Please review your selections before submitting</p>
      </div>

      {sections.map((section, sectionIndex) => (
        <Card key={sectionIndex} className="p-6 bg-gradient-to-br from-card to-accent/10 border-border/50">
          <h4 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {section.title}
          </h4>
          <div className="space-y-3">
            {section.items.map((item, itemIndex) => (
              <div 
                key={itemIndex} 
                className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-border/30 last:border-0"
              >
                <span className="font-medium text-muted-foreground mb-1 sm:mb-0">{item.label}:</span>
                <span className="font-semibold text-foreground">{formatValue(item.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      ))}

      <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-6 rounded-xl border border-primary/20">
        <p className="text-sm text-center text-muted-foreground">
          By submitting, you confirm that all information provided is accurate and complete.
        </p>
      </div>
    </div>
  );
};

export default ProfileSummaryStep;
