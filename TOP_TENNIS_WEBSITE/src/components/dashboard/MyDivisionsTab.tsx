import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Users, Trophy, Calendar, Target } from 'lucide-react';
import { useDivisionAssignments } from '@/hooks/useDivisionAssignments';
import { useToast } from '@/hooks/use-toast';

const MyDivisionsTab = () => {
  const { assignments, loading, error, getDivisionMembers } = useDivisionAssignments();
  const { toast } = useToast();

  const handleViewDivisionMembers = async (divisionId: string, divisionName: string) => {
    try {
      const members = await getDivisionMembers(divisionId);
      toast({
        title: `${divisionName} Members`,
        description: `${members.length} players in this division`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load division members",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">My Divisions</h2>
        </div>
        <div className="text-center py-8">
          <div className="animate-pulse">Loading your divisions...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">My Divisions</h2>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              Error loading divisions: {error}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">My Divisions</h2>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>You're not assigned to any divisions yet.</p>
              <p className="text-sm mt-2">Register for a league to be placed in a division!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">My Divisions</h2>
      </div>

      <div className="grid gap-6">
        {assignments.map((assignment) => {
          const division = assignment.division;
          if (!division) return null;

          const matchProgress = (assignment.matches_completed / assignment.matches_required) * 100;
          const isPlayoffEligible = assignment.playoff_eligible;

          return (
            <Card key={assignment.id} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {division.division_name}
                      {isPlayoffEligible && (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                          <Trophy className="w-3 h-3 mr-1" />
                          Playoff Eligible
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {division.league_id} • Season {division.season}
                    </CardDescription>
                  </div>
                  <Badge variant={division.status === 'active' ? 'default' : 'secondary'}>
                    {division.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Division Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Skill Level</span>
                    <p className="font-medium">{division.skill_level_range}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Style</span>
                    <p className="font-medium capitalize">{division.competitiveness}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Age Range</span>
                    <p className="font-medium">{division.age_range}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Players</span>
                    <p className="font-medium">{division.current_players}/{division.max_players}</p>
                  </div>
                </div>

                {/* Match Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      Match Progress
                    </span>
                    <span className="font-medium">
                      {assignment.matches_completed}/{assignment.matches_required} matches
                    </span>
                  </div>
                  <Progress value={matchProgress} className="h-2" />
                  {assignment.matches_completed < assignment.matches_required && (
                    <p className="text-xs text-muted-foreground">
                      {assignment.matches_required - assignment.matches_completed} matches needed for playoff eligibility
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => handleViewDivisionMembers(division.id, division.division_name)}
                    className="flex items-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    View Members ({division.current_players})
                  </Button>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    Schedule Match
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default MyDivisionsTab;