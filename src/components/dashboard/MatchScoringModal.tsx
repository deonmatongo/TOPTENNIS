import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Minus, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface MatchScoringModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: any;
  playerId: string;
  onScoreSubmitted: () => void;
}

// ── Stepper ───────────────────────────────────────────────────────────────────

const ScoreStepper = ({
  value,
  onChange,
  max = 7,
  highlight,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
  highlight?: 'win' | 'loss';
}) => (
  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={() => onChange(Math.max(0, value - 1))}
      className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
    >
      <Minus className="w-3 h-3" />
    </button>
    <span
      className={`w-10 text-center text-2xl font-bold tabular-nums ${
        highlight === 'win'
          ? 'text-green-600'
          : highlight === 'loss'
          ? 'text-red-500'
          : 'text-foreground'
      }`}
    >
      {value}
    </span>
    <button
      type="button"
      onClick={() => onChange(Math.min(max, value + 1))}
      className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
    >
      <Plus className="w-3 h-3" />
    </button>
  </div>
);

// ── Set validity helpers ──────────────────────────────────────────────────────

/** Returns 'me' | 'opp' | null — who won this set, or null if incomplete */
function setWinner(me: number, opp: number): 'me' | 'opp' | null {
  if (me >= 6 && me - opp >= 2) return 'me';
  if (opp >= 6 && opp - me >= 2) return 'opp';
  if (me === 7 && opp === 6) return 'me';
  if (opp === 7 && me === 6) return 'opp';
  return null;
}

function setComplete(me: number, opp: number): boolean {
  return setWinner(me, opp) !== null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const MatchScoringModal = ({
  open,
  onOpenChange,
  match,
  playerId,
  onScoreSubmitted,
}: MatchScoringModalProps) => {
  const userIsPlayer1 = match?.player1_id === playerId;
  const myName = userIsPlayer1 ? match?.player1_name : match?.player2_name;
  const oppName = userIsPlayer1 ? match?.player2_name : match?.player1_name;

  const [s1me, setS1me] = useState(6);
  const [s1op, setS1op] = useState(0);
  const [s2me, setS2me] = useState(6);
  const [s2op, setS2op] = useState(0);
  const [s3me, setS3me] = useState(6);
  const [s3op, setS3op] = useState(0);
  const [loading, setLoading] = useState(false);

  // Determine set outcomes
  const set1won = setWinner(s1me, s1op);
  const set2won = setWinner(s2me, s2op);
  const set3won = setWinner(s3me, s3op);

  // Need 3rd set only when the first two sets are split
  const needsThirdSet =
    set1won !== null && set2won !== null && set1won !== set2won;

  // Count sets won by each side
  const mySets = [set1won, set2won, needsThirdSet ? set3won : null].filter(
    (w) => w === 'me',
  ).length;
  const oppSets = [set1won, set2won, needsThirdSet ? set3won : null].filter(
    (w) => w === 'opp',
  ).length;

  // Score is valid when:
  // - Sets 1 & 2 are complete
  // - If 3rd needed, set 3 is also complete
  // - Winner has 2 sets (best of 3)
  const isValid = useMemo(() => {
    if (!setComplete(s1me, s1op) || !setComplete(s2me, s2op)) return false;
    if (needsThirdSet && !setComplete(s3me, s3op)) return false;
    return mySets === 2; // caller must be the winner
  }, [s1me, s1op, s2me, s2op, s3me, s3op, mySets, needsThirdSet]);

  // Live formatted preview from the winner's perspective
  const scorePreview = useMemo(() => {
    const parts: string[] = [];
    if (setComplete(s1me, s1op)) parts.push(`${s1me}–${s1op}`);
    if (setComplete(s2me, s2op)) parts.push(`${s2me}–${s2op}`);
    if (needsThirdSet && setComplete(s3me, s3op)) parts.push(`${s3me}–${s3op}`);
    return parts.join(', ') || '—';
  }, [s1me, s1op, s2me, s2op, s3me, s3op, needsThirdSet]);

  const handleSubmit = async () => {
    if (!isValid) {
      if (mySets < 2) {
        toast.error('Only the winner can report the score. Your score must show 2 sets won.');
      } else {
        toast.error('Please complete all required set scores.');
      }
      return;
    }

    setLoading(true);
    try {
      // Map "me / opp" back to player1 / player2 positions
      const p = (me: number, op: number) =>
        userIsPlayer1 ? { p1: me, p2: op } : { p1: op, p2: me };

      const s1 = p(s1me, s1op);
      const s2 = p(s2me, s2op);
      const s3 = needsThirdSet ? p(s3me, s3op) : null;

      const { error } = await supabase.rpc('submit_league_match_score', {
        p_match_id:    match.id,
        p_winner_id:   playerId,
        p_set1_p1:     s1.p1,
        p_set1_p2:     s1.p2,
        p_set2_p1:     s2.p1,
        p_set2_p2:     s2.p2,
        p_set3_p1:     s3?.p1 ?? null,
        p_set3_p2:     s3?.p2 ?? null,
        p_tiebreak_p1: null,
        p_tiebreak_p2: null,
        p_reported_by: playerId,
      } as any);

      if (error) throw error;

      toast.success(`Score submitted: ${scorePreview}`, {
        description: `${oppName} has been notified.`,
        duration: 4000,
      });
      onScoreSubmitted();
      onOpenChange(false);
    } catch (err: any) {
      console.error('submit_league_match_score error:', err);
      toast.error(err?.message || 'Failed to submit score. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const SetRow = ({
    label,
    meVal,
    opVal,
    onMeChange,
    onOpChange,
  }: {
    label: string;
    meVal: number;
    opVal: number;
    onMeChange: (v: number) => void;
    onOpChange: (v: number) => void;
  }) => {
    const winner = setWinner(meVal, opVal);
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
          {winner && (
            <Badge
              className={
                winner === 'me'
                  ? 'bg-green-600 text-white text-xs'
                  : 'bg-red-500 text-white text-xs'
              }
            >
              {winner === 'me' ? 'You won' : `${oppName} won`}
            </Badge>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium w-24 truncate">You</span>
            <ScoreStepper
              value={meVal}
              onChange={onMeChange}
              highlight={winner === 'me' ? 'win' : winner === 'opp' ? 'loss' : undefined}
            />
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground w-24 truncate">{oppName}</span>
            <ScoreStepper
              value={opVal}
              onChange={onOpChange}
              highlight={winner === 'opp' ? 'win' : winner === 'me' ? 'loss' : undefined}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            Enter Match Score
          </DialogTitle>
          <DialogDescription>
            Only the winner can submit. This updates standings and your Performance stats.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Match context */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
            <div className="text-center flex-1">
              <p className="text-xs text-muted-foreground mb-0.5">You</p>
              <p className="font-semibold text-sm truncate">{myName}</p>
            </div>
            <span className="text-xs font-bold text-muted-foreground px-2">VS</span>
            <div className="text-center flex-1">
              <p className="text-xs text-muted-foreground mb-0.5">Opponent</p>
              <p className="font-semibold text-sm truncate">{oppName}</p>
            </div>
          </div>

          {/* Live score preview */}
          <div className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-border bg-background">
            <span className="text-xs text-muted-foreground">Score preview</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm">{scorePreview}</span>
              {isValid && <CheckCircle2 className="w-4 h-4 text-green-500" />}
            </div>
          </div>

          {/* Set entries */}
          <SetRow
            label="Set 1"
            meVal={s1me} opVal={s1op}
            onMeChange={setS1me} onOpChange={setS1op}
          />
          <SetRow
            label="Set 2"
            meVal={s2me} opVal={s2op}
            onMeChange={setS2me} onOpChange={setS2op}
          />
          {needsThirdSet && (
            <SetRow
              label="Set 3 (Decider)"
              meVal={s3me} opVal={s3op}
              onMeChange={setS3me} onOpChange={setS3op}
            />
          )}

          {/* Guidance */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800 dark:text-blue-300">
              Win a set by reaching 6 games with a 2-game lead, or 7–6 in a tiebreak.
              A 3rd set appears automatically when sets are split 1–1.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90"
              onClick={handleSubmit}
              disabled={loading || !isValid}
            >
              {loading ? 'Submitting…' : 'Submit Score'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MatchScoringModal;
