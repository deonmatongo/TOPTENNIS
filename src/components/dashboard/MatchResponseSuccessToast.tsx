import React from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';

interface MatchResponseSuccessToastProps {
  action: 'accept' | 'decline' | 'propose';
  playerName?: string;
}

export const MatchResponseSuccessToast = ({ action, playerName }: MatchResponseSuccessToastProps) => {
  const icons = {
    accept: <CheckCircle2 className="h-5 w-5 text-green-600" />,
    decline: <XCircle className="h-5 w-5 text-red-600" />,
    propose: <Clock className="h-5 w-5 text-blue-600" />
  };

  const messages = {
    accept: 'Match invitation accepted!',
    decline: 'Match invitation declined',
    propose: 'New time proposed successfully'
  };

  const descriptions = {
    accept: 'Waiting for opponent confirmation',
    decline: playerName ? `${playerName} has been notified` : 'Opponent has been notified',
    propose: playerName ? `${playerName} will review your proposal` : 'Opponent will review your proposal'
  };

  return (
    <div className="flex items-start gap-3">
      {icons[action]}
      <div>
        <div className="font-semibold">{messages[action]}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {descriptions[action]}
        </div>
      </div>
    </div>
  );
};
