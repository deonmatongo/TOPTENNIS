import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Trophy, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface MatchScoringModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: any;
  playerId: string;
  onScoreSubmitted: () => void;
}

const MatchScoringModal = ({
  open,
  onOpenChange,
  match,
  playerId,
  onScoreSubmitted
}: MatchScoringModalProps) => {
  const [loading, setLoading] = useState(false);
  const [winnerId, setWinnerId] = useState('');
  const [set1Player1, setSet1Player1] = useState('');
  const [set1Player2, setSet1Player2] = useState('');
  const [set2Player1, setSet2Player1] = useState('');
  const [set2Player2, setSet2Player2] = useState('');
  const [set3Player1, setSet3Player1] = useState('');
  const [set3Player2, setSet3Player2] = useState('');
  const [tiebreakPlayer1, setTiebreakPlayer1] = useState('');
  const [tiebreakPlayer2, setTiebreakPlayer2] = useState('');

  const validateScore = () => {
    // Must have at least 2 sets
    if (!set1Player1 || !set1Player2 || !set2Player1 || !set2Player2) {
      toast.error('Please enter scores for at least the first two sets');
      return false;
    }

    // Winner must be selected
    if (!winnerId) {
      toast.error('Please select the winner');
      return false;
    }

    // Validate set scores (must be 0-7 for regular games)
    const scores = [
      parseInt(set1Player1), parseInt(set1Player2),
      parseInt(set2Player1), parseInt(set2Player2),
    ];
    
    if (set3Player1 && set3Player2) {
      scores.push(parseInt(set3Player1), parseInt(set3Player2));
    }

    for (const score of scores) {
      if (isNaN(score) || score < 0 || score > 7) {
        toast.error('Set scores must be between 0 and 7');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateScore()) return;

    setLoading(true);
    try {
      // Use the new league scoring function with validation
      const { data, error } = await supabase.rpc('submit_league_match_score', {
        p_match_id: match.id,
        p_winner_id: winnerId,
        p_set1_p1: parseInt(set1Player1),
        p_set1_p2: parseInt(set1Player2),
        p_set2_p1: parseInt(set2Player1),
        p_set2_p2: parseInt(set2Player2),
        p_set3_p1: set3Player1 ? parseInt(set3Player1) : null,
        p_set3_p2: set3Player2 ? parseInt(set3Player2) : null,
        p_tiebreak_p1: tiebreakPlayer1 ? parseInt(tiebreakPlayer1) : null,
        p_tiebreak_p2: tiebreakPlayer2 ? parseInt(tiebreakPlayer2) : null,
        p_reported_by: playerId
      });

      if (error) throw error;

      toast.success('Match score submitted! Your opponent will be notified to confirm the score.', {
        description: 'The leaderboard will update once your opponent confirms.',
        duration: 5000
      });
      onScoreSubmitted();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error submitting score:', error);
      toast.error(error.message || 'Failed to submit score');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Report Match Score
          </DialogTitle>
          <DialogDescription>
            Enter the professional tennis score for this match. Only the winning player should report the score.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Winner Selection */}
          <div className="space-y-3">
            <Label>Who won the match? <span className="text-destructive">*</span></Label>
            <RadioGroup value={winnerId} onValueChange={setWinnerId}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={match.player1_id} id="player1-win" />
                <Label htmlFor="player1-win" className="cursor-pointer">
                  {match.player1_name}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={match.player2_id} id="player2-win" />
                <Label htmlFor="player2-win" className="cursor-pointer">
                  {match.player2_name}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Set 1 */}
          <div className="space-y-3">
            <Label>Set 1 <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">{match.player1_name}</Label>
                <Input
                  type="number"
                  min="0"
                  max="7"
                  value={set1Player1}
                  onChange={(e) => setSet1Player1(e.target.value)}
                  placeholder="Games"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">{match.player2_name}</Label>
                <Input
                  type="number"
                  min="0"
                  max="7"
                  value={set1Player2}
                  onChange={(e) => setSet1Player2(e.target.value)}
                  placeholder="Games"
                />
              </div>
            </div>
          </div>

          {/* Set 2 */}
          <div className="space-y-3">
            <Label>Set 2 <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">{match.player1_name}</Label>
                <Input
                  type="number"
                  min="0"
                  max="7"
                  value={set2Player1}
                  onChange={(e) => setSet2Player1(e.target.value)}
                  placeholder="Games"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">{match.player2_name}</Label>
                <Input
                  type="number"
                  min="0"
                  max="7"
                  value={set2Player2}
                  onChange={(e) => setSet2Player2(e.target.value)}
                  placeholder="Games"
                />
              </div>
            </div>
          </div>

          {/* Set 3 (Optional) */}
          <div className="space-y-3">
            <Label>Set 3 (Optional)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">{match.player1_name}</Label>
                <Input
                  type="number"
                  min="0"
                  max="7"
                  value={set3Player1}
                  onChange={(e) => setSet3Player1(e.target.value)}
                  placeholder="Games"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">{match.player2_name}</Label>
                <Input
                  type="number"
                  min="0"
                  max="7"
                  value={set3Player2}
                  onChange={(e) => setSet3Player2(e.target.value)}
                  placeholder="Games"
                />
              </div>
            </div>
          </div>

          {/* Tiebreak (Optional) */}
          <div className="space-y-3">
            <Label>Tiebreak (Optional)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">{match.player1_name}</Label>
                <Input
                  type="number"
                  min="0"
                  value={tiebreakPlayer1}
                  onChange={(e) => setTiebreakPlayer1(e.target.value)}
                  placeholder="Points"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">{match.player2_name}</Label>
                <Input
                  type="number"
                  min="0"
                  value={tiebreakPlayer2}
                  onChange={(e) => setTiebreakPlayer2(e.target.value)}
                  placeholder="Points"
                />
              </div>
            </div>
          </div>

          {/* Info Alert */}
          <div className="flex items-start gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Professional Tennis Scoring</p>
              <p>Enter the number of games won in each set. A set is won by the first player to reach 6 games with at least a 2-game lead, or 7-6 in a tiebreak.</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {loading ? 'Submitting...' : 'Submit Score'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MatchScoringModal;