import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  MapPin, 
  Trophy,
  Users,
  Search,
  Filter,
  Edit3,
  Trash2,
  Play,
  CheckCircle2,
  AlertCircle,
  Zap
} from 'lucide-react';
import { format, isToday, isTomorrow, isThisWeek, parseISO } from 'date-fns';
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { useLeagueRegistrations } from '@/hooks/useLeagueRegistrations';
import { AvailabilityModal } from './AvailabilityModal';
import ScheduleMatchModal from '@/components/ScheduleMatchModal';
import MatchResultModal from '@/components/MatchResultModal';
import { cn } from '@/lib/utils';

interface MatchesCalendarTabProps {
  player: any;
  matches: any[];
  matchesLoading: boolean;
  selectedLeague: string;
}

const MatchesCalendarTab = ({ player, matches, matchesLoading, selectedLeague }: MatchesCalendarTabProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState<'calendar' | 'list'>('calendar');
  
  // Modal states
  const [availabilityModalOpen, setAvailabilityModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);

  const { registrations } = useLeagueRegistrations();
  const { availability, loading: availabilityLoading, deleteAvailability } = useUserAvailability();

  // Process matches for the user
  const userMatches = useMemo(() => {
    return matches.filter(match => 
      match.player1_id === player?.id || match.player2_id === player?.id
    ).filter(match => {
      if (!searchTerm) return true;
      const opponent = match.player1_id === player?.id ? match.player2 : match.player1;
      return opponent?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
             match.court_location?.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [matches, player?.id, searchTerm]);

  const upcomingMatches = userMatches.filter(match => match.status === 'scheduled');
  const completedMatches = userMatches.filter(match => match.status === 'completed');

  // Get events for selected date
  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const selectedDateEvents = useMemo(() => {
    const dayAvailability = availability.filter(item => item.date === selectedDateStr);
    const dayMatches = userMatches.filter(match => {
      const matchDate = format(parseISO(match.match_date), 'yyyy-MM-dd');
      return matchDate === selectedDateStr;
    });
    
    return {
      availability: dayAvailability,
      matches: dayMatches
    };
  }, [availability, userMatches, selectedDateStr]);

  // Calendar modifiers
  const calendarModifiers = useMemo(() => {
    const matchDates = userMatches.map(match => parseISO(match.match_date));
    const availabilityDates = availability.map(item => parseISO(item.date));
    
    return {
      hasMatches: matchDates,
      hasAvailability: availabilityDates,
      hasUpcomingMatch: upcomingMatches.map(match => parseISO(match.match_date))
    };
  }, [userMatches, availability, upcomingMatches]);

  const getMatchResult = (match: any) => {
    const isPlayer1 = match.player1_id === player?.id;
    const opponent = isPlayer1 ? match.player2 : match.player1;
    const isWinner = match.winner_id === player?.id;
    
    return { opponent, isWinner, isPlayer1 };
  };

  const getTimeUntilMatch = (matchDate: string) => {
    const date = parseISO(matchDate);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isThisWeek(date)) return format(date, 'EEEE');
    return format(date, 'MMM d');
  };

  const handleEditAvailability = (item: any) => {
    setEditingAvailability(item);
    setAvailabilityModalOpen(true);
  };

  const handleDeleteAvailability = async (id: string) => {
    await deleteAvailability(id);
  };

  const handleRecordResult = (match: any) => {
    setSelectedMatch(match);
    setResultModalOpen(true);
  };

  const handleModalClose = () => {
    setAvailabilityModalOpen(false);
    setEditingAvailability(null);
  };

  // Loading state
  if (matchesLoading || availabilityLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading schedule...</p>
        </div>
      </div>
    );
  }

  // No league registration
  if (registrations.length === 0) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-8 text-center">
          <CalendarIcon className="w-16 h-16 text-amber-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-amber-800 mb-2">Join a League to Get Started</h3>
          <p className="text-amber-700 mb-6">
            You need to register for a league to manage matches and set your availability.
          </p>
          <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">
            <Trophy className="w-4 h-4 mr-2" />
            Browse Leagues
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Matches & Schedule</h1>
          <p className="text-muted-foreground">Manage your matches and availability</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Tabs value={activeView} onValueChange={(value: any) => setActiveView(value)}>
            <TabsList>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Button onClick={() => setAvailabilityModalOpen(true)} variant="outline">
            <Clock className="w-4 h-4 mr-2" />
            Set Availability
          </Button>
          
          <Button onClick={() => setScheduleModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Schedule Match
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search matches, opponents, locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {activeView === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CalendarIcon className="w-5 h-5 text-primary" />
                <span>Schedule Calendar</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className={cn("rounded-md border pointer-events-auto")}
                modifiers={calendarModifiers}
                modifiersClassNames={{
                  hasMatches: "bg-blue-100 text-blue-800 font-medium",
                  hasAvailability: "bg-green-100 text-green-800",
                  hasUpcomingMatch: "bg-primary text-primary-foreground font-bold"
                }}
              />
              
              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-4 text-xs">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
                  <span>Matches</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                  <span>Available</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-primary rounded"></div>
                  <span>Upcoming Match</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selected Date Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {selectedDate ? format(selectedDate, 'EEEE, MMM d') : 'Select a date'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {/* Matches for selected date */}
                  {selectedDateEvents.matches.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-3 flex items-center">
                        <Trophy className="w-4 h-4 mr-1" />
                        Matches ({selectedDateEvents.matches.length})
                      </h4>
                      <div className="space-y-3">
                        {selectedDateEvents.matches.map((match) => {
                          const { opponent, isWinner } = getMatchResult(match);
                          return (
                            <div
                              key={match.id}
                              className="p-3 rounded-lg border bg-card space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-xs">
                                      {opponent?.name?.charAt(0) || '?'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-medium">
                                    vs {opponent?.name || 'TBD'}
                                  </span>
                                </div>
                                <Badge variant={match.status === 'completed' ? (isWinner ? 'default' : 'destructive') : 'secondary'}>
                                  {match.status === 'completed' ? (isWinner ? 'Won' : 'Lost') : match.status}
                                </Badge>
                              </div>
                              
                              <div className="text-xs text-muted-foreground space-y-1">
                                <div className="flex items-center space-x-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{format(parseISO(match.match_date), 'h:mm a')}</span>
                                </div>
                                {match.court_location && (
                                  <div className="flex items-center space-x-1">
                                    <MapPin className="w-3 h-3" />
                                    <span>{match.court_location}</span>
                                  </div>
                                )}
                              </div>

                              {match.status === 'scheduled' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full text-xs"
                                  onClick={() => handleRecordResult(match)}
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Record Result
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Availability for selected date */}
                  {selectedDateEvents.availability.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-3 flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        Availability ({selectedDateEvents.availability.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedDateEvents.availability.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-lg border bg-card"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <Badge variant={item.is_available ? 'default' : 'destructive'} className="text-xs">
                                  {item.is_available ? 'Available' : 'Blocked'}
                                </Badge>
                                <span className="text-sm font-medium">
                                  {item.start_time} - {item.end_time}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditAvailability(item)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteAvailability(item.id)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            {item.notes && (
                              <p className="text-xs text-muted-foreground">{item.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedDateEvents.matches.length === 0 && selectedDateEvents.availability.length === 0 && (
                    <div className="text-center py-8">
                      <CalendarIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground mb-3">
                        No events for this date
                      </p>
                      <div className="space-y-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAvailabilityModalOpen(true)}
                          className="w-full"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Availability
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setScheduleModalOpen(true)}
                          className="w-full"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Schedule Match
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* List View */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Matches */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Play className="w-5 h-5 text-green-600" />
                  <span>Upcoming Matches</span>
                </div>
                <Badge variant="secondary">{upcomingMatches.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {upcomingMatches.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground mb-3">No upcoming matches</p>
                    <Button size="sm" onClick={() => setScheduleModalOpen(true)}>
                      <Plus className="w-3 h-3 mr-1" />
                      Schedule Match
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingMatches.map((match) => {
                      const { opponent } = getMatchResult(match);
                      return (
                        <div
                          key={match.id}
                          className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {opponent?.name?.charAt(0) || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">vs {opponent?.name || 'TBD'}</p>
                                <p className="text-sm text-muted-foreground">
                                  {getTimeUntilMatch(match.match_date)}
                                </p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="flex items-center space-x-1">
                              <Zap className="w-3 h-3" />
                              <span>Upcoming</span>
                            </Badge>
                          </div>

                          <div className="space-y-1 text-xs text-muted-foreground mb-3">
                            <div className="flex items-center space-x-1">
                              <CalendarIcon className="w-3 h-3" />
                              <span>{format(parseISO(match.match_date), 'EEE, MMM d, h:mm a')}</span>
                            </div>
                            {match.court_location && (
                              <div className="flex items-center space-x-1">
                                <MapPin className="w-3 h-3" />
                                <span>{match.court_location}</span>
                              </div>
                            )}
                          </div>

                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => handleRecordResult(match)}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Record Result
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Recent Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  <span>Recent Results</span>
                </div>
                <Badge variant="secondary">{completedMatches.slice(0, 5).length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {completedMatches.length === 0 ? (
                  <div className="text-center py-8">
                    <Trophy className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No completed matches yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {completedMatches.slice(0, 5).map((match) => {
                      const { opponent, isWinner } = getMatchResult(match);
                      return (
                        <div
                          key={match.id}
                          className="p-4 rounded-lg border bg-card"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {opponent?.name?.charAt(0) || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">vs {opponent?.name || 'Unknown'}</p>
                                <p className="text-sm text-muted-foreground">
                                  {format(parseISO(match.match_date), 'MMM d')}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant={isWinner ? 'default' : 'destructive'}>
                                {isWinner ? 'Won' : 'Lost'}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                {match.player1_score}-{match.player2_score}
                              </p>
                            </div>
                          </div>
                          
                          {match.court_location && (
                            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              <span>{match.court_location}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modals */}
      <AvailabilityModal
        open={availabilityModalOpen}
        onClose={handleModalClose}
        editingItem={editingAvailability}
        selectedDate={selectedDate}
      />

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

export default MatchesCalendarTab;