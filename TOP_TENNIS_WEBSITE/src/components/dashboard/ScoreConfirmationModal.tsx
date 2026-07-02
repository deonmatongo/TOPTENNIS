import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ScoreConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: any;
  userId: string;
  onConfirmed: () => void;
}

const ScoreConfirmationModal = ({
  open,
  onOpenChange,
  match,
  userId,
  onConfirmed
}: ScoreConfirmationModalProps) => {
  const [loading, setLoading] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  const isPlayer1 = match.player1_id === userId;
  const playerScore = isPlayer1 
    ? `${match.set1_player1}-${match.set1_player2}, ${match.set2_player1}-${match.set2_player2}${match.set3_player1 ? `, ${match.set3_player1}-${match.set3_player2}` : ''}`
    : `${match.set1_player2}-${match.set1_player1}, ${match.set2_player2}-${match.set2_player1}${match.set3_player2 ? `, ${match.set3_player2}-${match.set3_player1}` : ''}`;

  const opponentName = isPlayer1 ? match.player2_name : match.player1_name;
  const didIWin = match.winner_id === userId;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('confirm_league_match_score', {
        p_match_id: match.id,
        p_confirming_user_id: userId
      });

      if (error) throw error;

      toast.success('Score confirmed! Leaderboard has been updated.', {
        duration: 5000
      });
      onConfirmed();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error confirming score:', error);
      toast.error(error.message || 'Failed to confirm score');
    } finally {
      setLoading(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) {
      toast.error('Please provide a reason for the dispute');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('dispute_league_match_score', {
        p_match_id: match.id,
        p_disputing_user_id: userId,
        p_dispute_reason: disputeReason
      });

      if (error) throw error;

      toast.warning('Score disputed. Your opponent and league admin have been notified.', {
        description: 'The match will be reviewed and resolved.',
        duration: 5000
      });
      onConfirmed();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error disputing score:', error);
      toast.error(error.message || 'Failed to dispute score');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Confirm Match Score
          </DialogTitle>
          <DialogDescription>
            Your opponent has reported the match score. Please review and confirm or dispute if incorrect.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Match Result Summary */}
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">Result:</span>
              <span className={`text-lg font-bold ${didIWin ? 'text-green-600' : 'text-red-600'}`}>
                {didIWin ? 'You Won! 🎉' : 'You Lost'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="font-medium">Opponent:</span>
              <span>{opponentName}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-medium">Score:</span>
              <span className="font-mono">{playerScore}</span>
            </div>

            {match.tiebreak_player1 && match.tiebreak_player2 && (
              <div className="flex items-center justify-between">
                <span className="font-medium">Tiebreak:</span>
                <span className="font-mono">
                  {isPlayer1 
                    ? `${match.tiebreak_player1}-${match.tiebreak_player2}`
                    : `${match.tiebreak_player2}-${match.tiebreak_player1}`
                  }
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Reported by:</span>
              <span>{opponentName}</span>
            </div>
          </div>

          {/* Dispute Section */}
          {showDispute && (
            <div className="space-y-3 p-4 border-2 border-orange-200 rounded-lg bg-orange-50 dark:bg-orange-950/20">
              <Label htmlFor="dispute-reason" className="text-orange-900 dark:text-orange-100 font-medium">
                Reason for Dispute <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="dispute-reason"
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Please explain why you believe this score is incorrect..."
                rows={4}
                className="bg-white dark:bg-gray-900"
              />
              <p className="text-xs text-orange-700 dark:text-orange-300">
                A league administrator will review the dispute and contact both players.
              </p>
            </div>
          )}

          {/* Info Alert */}
          <div className="flex items-start gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Fair Play Reminder</p>
              <p>Only confirm if the score is accurate. Disputing false scores or confirming incorrect scores violates fair play rules.</p>
            </div>
          </div>

          {/* Actions */}
          <DialogFooter className="flex gap-3">
            {!showDispute ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowDispute(true)}
                  disabled={loading}
                  className="border-orange-600 text-orange-600 hover:bg-orange-50"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Dispute Score
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {loading ? 'Confirming...' : 'Confirm Score'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDispute(false);
                    setDisputeReason('');
                  }}
                  disabled={loading}
                >
                  Cancel Dispute
                </Button>
                <Button
                  onClick={handleDispute}
                  disabled={loading || !disputeReason.trim()}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {loading ? 'Submitting...' : 'Submit Dispute'}
                </Button>
              </>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScoreConfirmationModal;
