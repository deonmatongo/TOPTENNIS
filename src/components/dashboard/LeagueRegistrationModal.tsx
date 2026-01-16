import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Edit2, CheckCircle, AlertTriangle, Users } from 'lucide-react';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { toast } from 'sonner';
import ProfilePreferenceValidationStep from '@/components/wizard/ProfilePreferenceValidationStep';

interface LeagueRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  league: {
    id: string;
    league: string;
    description: string;
    price: string;
  };
  onRegister: (leagueId: string, leagueName: string) => Promise<void>;
}

type RegistrationStep = 'start' | 'validation' | 'disclaimer';

const LeagueRegistrationModal = ({ 
  open, 
  onOpenChange, 
  league, 
  onRegister 
}: LeagueRegistrationModalProps) => {
  const { player } = usePlayerProfile();
  const [step, setStep] = useState<RegistrationStep>('start');
  const [validatedPreferences, setValidatedPreferences] = useState<{[key: string]: boolean}>({});
  const [updatedPreferences, setUpdatedPreferences] = useState<{[key: string]: any}>({});
  const [isRegistering, setIsRegistering] = useState(false);

  const resetModal = () => {
    setStep('start');
    setValidatedPreferences({});
    setUpdatedPreferences({});
    setIsRegistering(false);
  };

  const handleClose = () => {
    resetModal();
    onOpenChange(false);
  };

  const handleUseProfileCriteria = (useProfile: boolean) => {
    if (useProfile) {
      setStep('validation');
    } else {
      toast.info('Please review and update your profile preferences before continuing.');
      handleClose();
    }
  };

  const handleValidatePreference = (key: string, isValid: boolean) => {
    setValidatedPreferences(prev => ({
      ...prev,
      [key]: isValid
    }));
  };

  const handleUpdatePreference = (key: string, value: any) => {
    setUpdatedPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleContinueToDisclaimer = () => {
    const requiredPreferences = ['skillLevel', 'competitiveness', 'genderPreference', 'ageRange'];
    const allValidated = requiredPreferences.every(key => validatedPreferences[key]);
    
    if (allValidated) {
      setStep('disclaimer');
    } else {
      toast.error('Please validate all preferences before continuing.');
    }
  };

  const handleFinalRegistration = async () => {
    setIsRegistering(true);
    try {
      await onRegister(league.id, league.league);
      toast.success(`Successfully registered for ${league.league}! You've been assigned to a compatible division.`);
      handleClose();
    } catch (error) {
      console.error('Registration failed:', error);
      toast.error('Failed to register for league. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

  const renderStartStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Users className="w-12 h-12 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Register for {league.league}</h3>
        <p className="text-muted-foreground mb-4">
          Registration fee: <span className="font-semibold text-green-600">{league.price}</span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Registration Start</CardTitle>
          <CardDescription>
            Do you want to register for this league using the criteria saved in your profile?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={() => handleUseProfileCriteria(true)}
              className="flex-1"
              disabled={!player}
            >
              Yes, use my profile
            </Button>
            <Button 
              onClick={() => handleUseProfileCriteria(false)}
              variant="outline"
              className="flex-1"
            >
              No, update profile first
            </Button>
          </div>
          {!player && (
            <p className="text-sm text-amber-600 mt-2">
              Please complete your player profile first.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderValidationStep = () => {
    if (!player) return null;

    return (
      <div className="space-y-6">
        <ProfilePreferenceValidationStep
          validatedPreferences={validatedPreferences}
          onValidatePreference={handleValidatePreference}
          onUpdatePreference={handleUpdatePreference}
        />
        
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => setStep('start')}>
            Back
          </Button>
          <Button onClick={handleContinueToDisclaimer}>
            Continue to Registration
          </Button>
        </div>
      </div>
    );
  };

  const renderDisclaimerStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Matchmaking Disclaimer</h3>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI-Powered Division Placement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-800">
                You will be automatically placed in a division with 5-7 players who match your 
                skill level and preferences. Our AI system creates balanced divisions, but exact 
                matches aren't always possible depending on available players.
              </p>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold">Division Placement System:</h4>
              <ul className="text-sm text-muted-foreground space-y-2 ml-4">
                <li>• You will be placed in a division of 5-7 players with similar preferences</li>
                <li>• Each player must complete at least 5 matches per season</li>
                <li>• You can view and schedule with other division members' calendars</li>
                <li>• Only top-performing players advance to playoffs</li>
                <li>• Division placement is based on your validated profile preferences</li>
              </ul>
            </div>

            <p className="text-sm font-medium">
              Do you wish to proceed with the registration?
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button 
                onClick={handleFinalRegistration}
                disabled={isRegistering}
                className="flex-1"
              >
                {isRegistering ? 'Registering...' : 'Yes, Register Me'}
              </Button>
              <Button 
                variant="outline"
                onClick={() => setStep('validation')}
                disabled={isRegistering}
                className="flex-1"
              >
                Back to Profile
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 'start':
        return renderStartStep();
      case 'validation':
        return renderValidationStep();
      case 'disclaimer':
        return renderDisclaimerStep();
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>League Registration</DialogTitle>
        </DialogHeader>
        {renderCurrentStep()}
      </DialogContent>
    </Dialog>
  );
};

export default LeagueRegistrationModal;