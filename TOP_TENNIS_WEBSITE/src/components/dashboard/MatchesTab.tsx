
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, Clock, Filter, Plus, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ScheduleMatchModal from "@/components/ScheduleMatchModal";
import MatchResultModal from "@/components/MatchResultModal";
import { useLeagueRegistrations } from "@/hooks/useLeagueRegistrations";

interface MatchesTabProps {
  player: any;
  matches: any[];
  matchesLoading: boolean;
  selectedLeague: string;
}

const MatchesTab = ({ player, matches, matchesLoading, selectedLeague }: MatchesTabProps) => {
  const { registrations } = useLeagueRegistrations();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);

  const filteredMatches = matches.filter(match => {
    const matchesSearch = searchTerm === "" || 
      (match.player1?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       match.player2?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       match.court_location?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesFilter = filterStatus === "all" || match.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  const userMatches = filteredMatches.filter(match => 
    match.player1_id === player?.id || match.player2_id === player?.id
  );

  const upcomingMatches = userMatches.filter(match => match.status === 'scheduled');
  const completedMatches = userMatches.filter(match => match.status === 'completed');
  const selectedLeagueInfo = registrations.find(reg => reg.league_id === selectedLeague);

  const getMatchResult = (match: any) => {
    const isPlayer1 = match.player1_id === player?.id;
    const opponent = isPlayer1 ? match.player2 : match.player1;
    const isWinner = match.winner_id === player?.id;
    
    return { opponent, isWinner, isPlayer1 };
  };

  const handleRecordResult = (match: any) => {
    setSelectedMatch(match);
    setResultModalOpen(true);
  };

  if (registrations.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6 text-center">
            <Calendar className="w-12 h-12 text-amber-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-amber-800 mb-2">No League Registration Found</h3>
            <p className="text-amber-700 mb-4">
              You need to register for a league to manage your matches.
            </p>
            <p className="text-sm text-amber-600">
              Go to the League Menu tab to join a league and start playing!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (matchesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading matches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Match Management</h2>
          {selectedLeagueInfo && (
            <Badge variant="outline" className="mt-2">
              {selectedLeagueInfo.league_name}
            </Badge>
          )}
        </div>
        <Button 
          className="w-full sm:w-auto bg-gradient-primary hover:bg-gradient-primary/90 text-primary-foreground touch-target"
          onClick={() => setScheduleModalOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Schedule New Match
        </Button>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search matches, opponents, locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">All Matches</option>
                <option value="scheduled">Upcoming</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="upcoming" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upcoming">Upcoming ({upcomingMatches.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedMatches.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          {upcomingMatches.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Upcoming Matches</h3>
                <p className="text-gray-600 mb-4">
                  Schedule your next match in {selectedLeagueInfo?.league_name || 'your league'} to keep your momentum going!
                </p>
                <Button 
                  className="bg-gradient-to-r from-orange-500 to-blue-500"
                  onClick={() => setScheduleModalOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule Match
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {upcomingMatches.map((match) => {
                const { opponent } = getMatchResult(match);
                return (
                  <Card key={match.id} className="border-l-4 border-l-orange-500">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-blue-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold">
                              {opponent?.name?.charAt(0) || 'T'}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">
                              vs {opponent?.name || 'TBD'}
                            </h3>
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-4 h-4" />
                                <span>{new Date(match.match_date).toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Clock className="w-4 h-4" />
                                <span>{new Date(match.match_date).toLocaleTimeString()}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <MapPin className="w-4 h-4" />
                                <span>{match.court_location}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className="mb-2">
                            {match.status}
                          </Badge>
                          <div className="space-x-2">
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleRecordResult(match)}
                            >
                              Record Result
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>Match History</span>
                {selectedLeagueInfo && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {selectedLeagueInfo.league_name}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completedMatches.length === 0 ? (
                <p className="text-gray-600 text-center py-8">
                  No completed matches yet in {selectedLeagueInfo?.league_name || 'this league'}. Start playing to build your match history!
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Opponent</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedMatches.map((match) => {
                      const { opponent, isWinner } = getMatchResult(match);
                      return (
                        <TableRow key={match.id}>
                          <TableCell>
                            {new Date(match.match_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-medium">
                            {opponent?.name || 'Unknown'}
                          </TableCell>
                          <TableCell>{match.court_location}</TableCell>
                          <TableCell>
                            {match.player1_score}-{match.player2_score}
                          </TableCell>
                          <TableCell>
                            <Badge variant={isWinner ? "default" : "destructive"}>
                              {isWinner ? 'Won' : 'Lost'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ScheduleMatchModal 
        open={scheduleModalOpen} 
        onOpenChange={setScheduleModalOpen} 
      />
      
      <MatchResultModal 
        open={resultModalOpen} 
        onOpenChange={setResultModalOpen} 
        match={selectedMatch}
      />
    </div>
  );
};

export default MatchesTab;
