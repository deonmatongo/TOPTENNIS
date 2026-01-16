import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Users, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PostRegistrationPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PostRegistrationPrompt: React.FC<PostRegistrationPromptProps> = ({
  open,
  onOpenChange
}) => {
  const navigate = useNavigate();

  const handleFindMatch = () => {
    onOpenChange(false);
    navigate('/dashboard?tab=matching');
  };

  const handleSendChallenge = () => {
    onOpenChange(false);
    navigate('/dashboard?tab=competition');
  };

  const handleSkip = () => {
    onOpenChange(false);
    navigate('/dashboard');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold">
            Welcome to the Tennis League!
          </DialogTitle>
          <DialogDescription className="text-center text-base mt-2">
            Would you like to receive recommendations for opponents within your skill level?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 mt-6">
          <Button
            onClick={handleFindMatch}
            className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-medium text-base"
            size="lg"
          >
            <Users className="w-5 h-5 mr-2" />
            Find an opponent
          </Button>
          
          <Button
            onClick={handleSendChallenge}
            variant="outline"
            className="w-full h-12 border-primary text-primary hover:bg-primary/10 font-medium text-base"
            size="lg"
          >
            <Trophy className="w-5 h-5 mr-2" />
            Send a challenge request
          </Button>
          
          <Button
            onClick={handleSkip}
            variant="ghost"
            className="w-full text-muted-foreground hover:text-foreground"
          >
            Skip for now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostRegistrationPrompt;