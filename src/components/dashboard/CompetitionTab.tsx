
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, TrendingUp, Users, Target, Star, Award } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useLeagueRegistrations } from "@/hooks/useLeagueRegistrations";
import PlayerProfileModal from "./PlayerProfileModal";
import { SearchResult } from "@/hooks/usePlayerSearch";

interface CompetitionTabProps {
  player: any;
  leaderboard: any[];
  leaderboardLoading: boolean;
  selectedLeague: string;
}

const CompetitionTab = ({ player, leaderboard, leaderboardLoading, selectedLeague }: CompetitionTabProps) => {
  const { registrations } = useLeagueRegistrations();
  const playerRank = leaderboard.findIndex(p => p.id === player?.id) + 1;
  const topPlayers = leaderboard.slice(0, 10);
  const selectedLeagueInfo = registrations.find(reg => reg.league_id === selectedLeague);
  
  const [selectedPlayer, setSelectedPlayer] = React.useState<SearchResult | null>(null);
  const [showPlayerModal, setShowPlayerModal] = React.useState(false);
  
  const handlePlayerClick = (clickedPlayer: any) => {
    // Convert leaderboard player to SearchResult format
    const playerProfile: SearchResult = {
      id: clickedPlayer.id,
      user_id: clickedPlayer.user_id,
      name: clickedPlayer.name,
      email: clickedPlayer.email || '',
      skill_level: clickedPlayer.skill_level,
      wins: clickedPlayer.wins,
      losses: clickedPlayer.losses,
      usta_rating: clickedPlayer.usta_rating,
      age_range: clickedPlayer.age_range,
      competitiveness: clickedPlayer.competitiveness
    };
    setSelectedPlayer(playerProfile);
    setShowPlayerModal(true);
  };
  
  // Mock league data (in a real app, this would be filtered by selected league)
  const leagueStandings = {
    currentPosition: playerRank,
    totalPlayers: leaderboard.length,
    pointsToPlayoffs: 25,
    currentPoints: 87,
    playoffCutoff: 112
  };

  const peerComparison = {
    sameRatingGroup: leaderboard.filter(p => Math.abs(p.skill_level - player?.skill_level) <= 0.5),
    ageGroup: leaderboard.filter(p => true), // Mock: same age group
    regional: leaderboard.slice(0, 20) // Mock: regional players
  };

  if (registrations.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6 text-center">
            <Trophy className="w-12 h-12 text-amber-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-amber-800 mb-2">No League Registration Found</h3>
            <p className="text-amber-700 mb-4">
              You need to register for a league to view competition and rankings.
            </p>
            <p className="text-sm text-amber-600">
              Go to the League Menu tab to join a league and start competing!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (leaderboardLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading competition data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">Competition & Rankings</h2>
          {selectedLeagueInfo && (
            <Badge variant="outline" className="mt-2">
              {selectedLeagueInfo.league_name}
            </Badge>
          )}
        </div>
        <Badge variant="secondary" className="bg-gradient-primary text-primary-foreground self-start sm:self-center">
          Rank #{playerRank || 'Unranked'}
        </Badge>
      </div>

      {/* League Standings Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="bg-gradient-secondary text-white">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-xs sm:text-sm">League Rank</p>
                <p className="text-2xl sm:text-3xl font-bold">#{leagueStandings.currentPosition || 'N/A'}</p>
                <p className="text-white/70 text-xs">of {leagueStandings.totalPlayers} players</p>
              </div>
              <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-white/60" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">League Points</p>
                <p className="text-3xl font-bold">{leagueStandings.currentPoints}</p>
                <p className="text-green-100 text-xs">Need {leagueStandings.pointsToPlayoffs} more for playoffs</p>
              </div>
              <Target className="w-12 h-12 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Playoff Progress</p>
                <p className="text-3xl font-bold">78%</p>
                <p className="text-purple-100 text-xs">On track for playoffs!</p>
              </div>
              <Award className="w-12 h-12 text-purple-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Playoff Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span>Playoff Qualification Progress</span>
            {selectedLeagueInfo && (
              <Badge variant="outline" className="ml-2 text-xs">
                {selectedLeagueInfo.league_name}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>Progress to Playoffs</span>
              <span>{leagueStandings.currentPoints}/{leagueStandings.playoffCutoff} points</span>
            </div>
            <Progress 
              value={(leagueStandings.currentPoints / leagueStandings.playoffCutoff) * 100} 
              className="h-3"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">5</div>
                <div className="text-sm text-blue-800">Matches Remaining</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">25</div>
                <div className="text-sm text-green-800">Points Needed</div>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">3</div>
                <div className="text-sm text-orange-800">Wins Required</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Full Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <span>League Leaderboard</span>
              {selectedLeagueInfo && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {selectedLeagueInfo.league_name}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPlayers.length === 0 ? (
              <p className="text-gray-600 text-center py-8">
                No leaderboard data available for {selectedLeagueInfo?.league_name || 'this league'} yet.
              </p>
            ) : (
              <div className="space-y-3">
                {topPlayers.map((player_item, index) => {
                  const isCurrentPlayer = player_item.id === player?.id;
                  return (
                    <div 
                      key={player_item.id}
                      onClick={() => !isCurrentPlayer && handlePlayerClick(player_item)}
                      className={`flex items-center space-x-3 p-3 rounded-lg transition-all ${
                        isCurrentPlayer 
                          ? 'bg-gradient-to-r from-orange-100 to-blue-100 border-2 border-orange-300' 
                          : index < 3 
                          ? 'bg-yellow-50 border border-yellow-200 cursor-pointer hover:bg-yellow-100 active:bg-yellow-200' 
                          : 'bg-gray-50 hover:bg-gray-100 cursor-pointer active:bg-gray-200'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-yellow-500 text-white' :
                        index === 1 ? 'bg-gray-400 text-white' :
                        index === 2 ? 'bg-yellow-600 text-white' :
                        isCurrentPlayer ? 'bg-gradient-to-r from-orange-500 to-blue-500 text-white' :
                        'bg-gray-300 text-gray-600'
                      }`}>
                        {index + 1}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className={`font-medium truncate ${isCurrentPlayer ? 'text-orange-800' : 'text-gray-900'}`}>
                            {player_item.name}
                            {isCurrentPlayer && <span className="ml-2 text-orange-600">(You)</span>}
                          </p>
                          {index < 3 && (
                            <span className="text-lg">
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span>{player_item.wins} wins</span>
                          <span>Level {player_item.usta_rating || player_item.skill_level}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {Math.round((player_item.wins / (player_item.wins + player_item.losses)) * 100) || 0}%
                        </div>
                        <div className="text-xs text-gray-600">Win Rate</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {playerRank > 10 && (
              <>
                <div className="my-4 text-center text-gray-400">...</div>
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-gradient-to-r from-orange-100 to-blue-100 border-2 border-orange-300">
                  <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {playerRank}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-orange-800">{player?.name} (You)</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>{player?.wins} wins</span>
                      <span>Level {player?.usta_rating || player?.skill_level}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Peer Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-green-500" />
              <span>Peer Comparison</span>
              {selectedLeagueInfo && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {selectedLeagueInfo.league_name}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-800 mb-3">🎯 Your Rating Group (7.0-8.0)</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Your Rank in Group:</span>
                    <span className="font-medium text-green-600">#3 of 12</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Win Rate vs Group:</span>
                    <span className="font-medium text-green-600">73% (Above Avg: 65%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Matches This Month:</span>
                    <span className="font-medium text-green-600">8 (Top 20%)</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-800 mb-3">🏆 League Comparison</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>League Ranking:</span>
                    <span className="font-medium text-blue-600">#{playerRank || 'N/A'} of {leaderboard.length}+</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Aces per Match:</span>
                    <span className="font-medium text-blue-600">7.2 (Top 10%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Break Point Conversion:</span>
                    <span className="font-medium text-blue-600">82% (Top 5%)</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="font-medium text-purple-800 mb-2">🎖️ League Standout Stats</h4>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• You're in the top 10% for aces per match in {selectedLeagueInfo?.league_name}</li>
                  <li>• Your serve win % is 15% above league average</li>
                  <li>• You have the 2nd best comeback record in your rating group</li>
                </ul>
              </div>

              <Button className="w-full bg-gradient-to-r from-green-500 to-blue-500">
                <Star className="w-4 h-4 mr-2" />
                View Detailed League Comparison
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <PlayerProfileModal 
        player={selectedPlayer}
        isOpen={showPlayerModal}
        onClose={() => setShowPlayerModal(false)}
      />
    </div>
  );
};

export default CompetitionTab;
