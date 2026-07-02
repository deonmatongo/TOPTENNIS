import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit2, CheckCircle, Users, Target, Activity } from 'lucide-react';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { toast } from 'sonner';

interface ProfilePreferenceValidationStepProps {
  validatedPreferences: { [key: string]: boolean };
  onValidatePreference: (key: string, isValid: boolean) => void;
  onUpdatePreference: (key: string, value: any) => void;
}

const ProfilePreferenceValidationStep = ({
  validatedPreferences,
  onValidatePreference,
  onUpdatePreference
}: ProfilePreferenceValidationStepProps) => {
  const { player } = usePlayerProfile();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValues, setTempValues] = useState<any>({});

  const preferences = [
    {
      key: 'skillLevel',
      label: 'Skill Level',
      value: player?.usta_rating || `Level ${player?.skill_level || 'Not set'}`,
      editable: false,
      description: 'Your tennis skill level cannot be changed after registration'
    },
    {
      key: 'competitiveness',
      label: 'Competitiveness',
      value: player?.competitiveness || 'Not set',
      editable: true,
      description: 'How competitive you prefer your matches to be'
    },
    {
      key: 'genderPreference',
      label: 'Gender Preference',
      value: player?.gender_preference || 'Not set',
      editable: true,
      description: 'Your preferred opponent gender for matches'
    },
    {
      key: 'ageRange',
      label: 'Age Range',
      value: player?.age_range || 'Not set',
      editable: false,
      description: 'Your age range cannot be changed after registration'
    }
  ];

  const handleStartEdit = (key: string, currentValue: any) => {
    setEditingField(key);
    setTempValues({ [key]: currentValue });
  };

  const handleSaveEdit = async (key: string) => {
    try {
      // For now, just show a toast - in a real app this would update the player profile
      toast.success(`${key} preference updated`);
      onUpdatePreference(key, tempValues[key]);
      setEditingField(null);
      setTempValues({});
    } catch (error) {
      console.error('Failed to update preference:', error);
      toast.error('Failed to update preference');
    }
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setTempValues({});
  };

  const renderEditField = (preference: any) => {
    const { key } = preference;
    
    if (key === 'competitiveness') {
      return (
        <RadioGroup 
          value={tempValues[key]} 
          onValueChange={(value) => setTempValues({ ...tempValues, [key]: value })}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="fun" id="fun" />
            <Label htmlFor="fun">Just for fun</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="casual" id="casual" />
            <Label htmlFor="casual">Casual but like to win</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="competitive" id="competitive" />
            <Label htmlFor="competitive">Very competitive</Label>
          </div>
        </RadioGroup>
      );
    }

    if (key === 'genderPreference') {
      return (
        <RadioGroup 
          value={tempValues[key]} 
          onValueChange={(value) => setTempValues({ ...tempValues, [key]: value })}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="no-preference" id="no-preference" />
            <Label htmlFor="no-preference">No preference</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="same-gender" id="same-gender" />
            <Label htmlFor="same-gender">Same gender</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="mixed" id="mixed" />
            <Label htmlFor="mixed">Mixed matches</Label>
          </div>
        </RadioGroup>
      );
    }

    if (key === 'ageRange') {
      return (
        <Select value={tempValues[key]} onValueChange={(value) => setTempValues({ ...tempValues, [key]: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select age range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="18-25">18-25</SelectItem>
            <SelectItem value="26-40">26-40</SelectItem>
            <SelectItem value="41-54">41-54</SelectItem>
            <SelectItem value="55-plus">55+</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Validate Your Profile Preferences</h3>
        <p className="text-muted-foreground">
          Please review and confirm each preference below. You can edit preferences except your skill level.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Profile Preferences
          </CardTitle>
          <CardDescription>
            These preferences will be used for league placement and opponent matching.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {preferences.map((pref) => (
              <div key={pref.key} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox 
                      checked={validatedPreferences[pref.key] || false}
                      onCheckedChange={(checked) => onValidatePreference(pref.key, checked as boolean)}
                    />
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {pref.label}
                        {!pref.editable && (
                          <Badge variant="secondary" className="text-xs">
                            Fixed
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{pref.description}</div>
                    </div>
                  </div>
                  
                  {pref.editable && editingField !== pref.key && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleStartEdit(pref.key, pref.value)}
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>

                {editingField === pref.key ? (
                  <div className="space-y-3 ml-6">
                    {renderEditField(pref)}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSaveEdit(pref.key)}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="ml-6">
                    <div className="text-sm font-medium p-2 bg-muted/30 rounded">
                      {pref.value}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Target className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-amber-800 mb-1">Important Note</div>
                <p className="text-amber-700">
                  Your skill level rating cannot be changed once set. All other preferences can be updated to ensure the best possible matches for you.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePreferenceValidationStep;