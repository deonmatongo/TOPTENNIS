
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useMatches } from "@/hooks/useMatches";

interface MatchResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: any;
}

const MatchResultModal = ({ open, onOpenChange, match }: MatchResultModalProps) => {
  const { updateMatchResult } = useMatches();
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState({
    player1_score: 0,
    player2_score: 0
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (scores.player1_score === scores.player2_score) {
      toast.error('Match cannot end in a tie. Please enter different scores.');
      return;
    }

    setLoading(true);
    try {
      const winnerId = scores.player1_score > scores.player2_score 
        ? match.player1_id 
        : match.player2_id;

      await updateMatchResult(
        match.id,
        scores.player1_score,
        scores.player2_score,
        winnerId
      );
      
      toast.success('Match result recorded successfully!');
      onOpenChange(false);
      setScores({ player1_score: 0, player2_score: 0 });
    } catch (error) {
      console.error('Error recording match result:', error);
      toast.error('Failed to record match result');
    } finally {
      setLoading(false);
    }
  };

  if (!match) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Match Result</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center py-4">
            <h3 className="font-medium text-lg">
              {match.player1?.name} vs {match.player2?.name}
            </h3>
            <p className="text-sm text-gray-600">
              {new Date(match.match_date).toLocaleDateString()} at {match.court_location}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="player1_score">{match.player1?.name} Score</Label>
              <Input
                id="player1_score"
                type="number"
                min="0"
                max="10"
                value={scores.player1_score}
                onChange={(e) => setScores(prev => ({ ...prev, player1_score: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label htmlFor="player2_score">{match.player2?.name} Score</Label>
              <Input
                id="player2_score"
                type="number"
                min="0"
                max="10"
                value={scores.player2_score}
                onChange={(e) => setScores(prev => ({ ...prev, player2_score: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Recording...' : 'Record Result'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MatchResultModal;
