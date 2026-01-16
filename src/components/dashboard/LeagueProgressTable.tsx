import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ResponsiveTable, ResponsiveTableColumn } from '@/components/ui/responsive-table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useResponsiveTable } from '@/hooks/useResponsiveTable';
import { 
  Trophy, 
  Medal, 
  Calendar, 
  Users, 
  ArrowRight,
  Eye,
  Target,
  TrendingUp
} from 'lucide-react';

interface LeagueProgressTableProps {
  registrations: any[];
  onLeagueClick: (league: any) => void;
}

const LeagueProgressTable: React.FC<LeagueProgressTableProps> = ({ 
  registrations, 
  onLeagueClick 
}) => {
  const [sortBy, setSortBy] = useState<'season' | 'progress' | 'result'>('season');

  // Mock enhanced league data with progress stages
  const enhancedLeagues = registrations.map((reg, index) => {
    // Mock different progress stages and results
    const progressStages = [
      'Group Stage', 
      'Round of 16', 
      'Quarterfinals', 
      'Semifinals', 
      'Finals', 
      'Champion'
    ];
    
    const mockData = [
      { progress: 6, finalPosition: 1, wins: 12, losses: 2, points: 2400 },
      { progress: 5, finalPosition: 2, wins: 10, losses: 3, points: 2100 },
      { progress: 4, finalPosition: 4, wins: 8, losses: 4, points: 1800 },
      { progress: 3, finalPosition: 8, wins: 6, losses: 5, points: 1500 },
      { progress: 2, finalPosition: 12, wins: 4, losses: 6, points: 1200 },
      { progress: 1, finalPosition: 24, wins: 2, losses: 4, points: 800 }
    ];

    const data = mockData[index % mockData.length];
    
    return {
      ...reg,
      progressStage: progressStages[data.progress - 1],
      progressValue: (data.progress / 6) * 100,
      finalPosition: data.finalPosition,
      totalParticipants: 32,
      wins: data.wins,
      losses: data.losses,
      points: data.points,
      season: `2024-${String(index + 1).padStart(2, '0')}`,
      startDate: new Date(2024, index, 15),
      endDate: reg.status === 'completed' ? new Date(2024, index + 1, 15) : null
    };
  });

  const getProgressColor = (progress: number) => {
    if (progress >= 83) return 'bg-green-500'; // Champion/Finals
    if (progress >= 66) return 'bg-yellow-500'; // Semifinals
    if (progress >= 50) return 'bg-orange-500'; // Quarterfinals
    if (progress >= 33) return 'bg-blue-500'; // Round of 16
    return 'bg-gray-400'; // Group Stage/Early Exit
  };

  const getResultBadge = (position: number, total: number) => {
    if (position === 1) {
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
        <Trophy className="h-3 w-3 mr-1" />
        Champion
      </Badge>;
    }
    if (position <= 3) {
      return <Badge className="bg-orange-100 text-orange-800 border-orange-300">
        <Medal className="h-3 w-3 mr-1" />
        Top 3
      </Badge>;
    }
    if (position <= total / 4) {
      return <Badge className="bg-blue-100 text-blue-800 border-blue-300">
        Top 25%
      </Badge>;
    }
    if (position <= total / 2) {
      return <Badge className="bg-green-100 text-green-800 border-green-300">
        Top 50%
      </Badge>;
    }
    return <Badge variant="secondary">#{position}</Badge>;
  };

  const sortedLeagues = [...enhancedLeagues].sort((a, b) => {
    switch (sortBy) {
      case 'season':
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      case 'progress':
        return b.progressValue - a.progressValue;
      case 'result':
        return a.finalPosition - b.finalPosition;
      default:
        return 0;
    }
  });

  const { data: tableData, sortConfig, handleSort } = useResponsiveTable({
    data: sortedLeagues,
    defaultSort: { key: 'season', direction: 'desc' }
  });

  const columns: ResponsiveTableColumn<any>[] = [
    {
      key: 'league',
      label: 'League & Season',
      sortable: true,
      render: (_, league) => (
        <div className="space-y-1">
          <div className="font-medium text-foreground">
            {league.league_name}
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="h-3 w-3" />
            {league.season}
          </div>
        </div>
      ),
    },
    {
      key: 'progress',
      label: 'Progress',
      sortable: true,
      hideOn: 'mobile',
      render: (_, league) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="space-y-2 cursor-help">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {league.progressStage}
                  </span>
                  <span className="font-medium">
                    {Math.round(league.progressValue)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-1000 ${getProgressColor(league.progressValue)}`}
                    style={{ width: `${league.progressValue}%` }}
                  />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Reached {league.progressStage}</p>
              <p>{league.wins}W - {league.losses}L record</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
    },
    {
      key: 'record',
      label: 'Record',
      hideOn: 'mobile',
      render: (_, league) => (
        <div className="text-sm">
          <div className="font-medium">
            {league.wins}W - {league.losses}L
          </div>
          <div className="text-muted-foreground">
            {Math.round((league.wins / (league.wins + league.losses)) * 100)}% win
          </div>
        </div>
      ),
    },
    {
      key: 'result',
      label: 'Final Result',
      sortable: true,
      render: (_, league) => (
        <div className="space-y-1">
          {getResultBadge(league.finalPosition, league.totalParticipants)}
          <div className="text-xs text-muted-foreground hidden sm:block">
            #{league.finalPosition} of {league.totalParticipants}
          </div>
        </div>
      ),
    },
    {
      key: 'points',
      label: 'Points',
      sortable: true,
      hideOn: 'mobile-tablet',
      render: (_, league) => (
        <div>
          <div className="font-medium">
            {league.points?.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">
            League pts
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      hideOn: 'mobile',
      render: (_, league) => (
        <Badge variant={league.status === 'active' ? 'default' : 'secondary'}>
          {league.status === 'active' ? 'In Progress' : 'Completed'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, league) => (
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => onLeagueClick(league)}
          className="hover:bg-primary/10"
        >
          <Eye className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">View</span>
          <ArrowRight className="h-4 w-4 ml-1 hidden sm:inline" />
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            League History & Progress
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant={sortBy === 'season' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setSortBy('season')}
            >
              <Calendar className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Season</span>
            </Button>
            <Button 
              variant={sortBy === 'progress' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setSortBy('progress')}
            >
              <TrendingUp className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Progress</span>
            </Button>
            <Button 
              variant={sortBy === 'result' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setSortBy('result')}
            >
              <Trophy className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Result</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveTable
          data={tableData}
          columns={columns}
          getRowKey={(league) => league.id}
          sortConfig={sortConfig}
          onSort={handleSort}
          emptyMessage={
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No league history yet</p>
              <p className="text-sm">Join your first league to start tracking your progress</p>
            </div>
          }
          renderExpandedRow={(league) => (
            <div className="space-y-3 p-2">
              <div className="space-y-2">
                <div className="text-sm font-medium">Progress</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{league.progressStage}</span>
                  <span className="font-medium">{Math.round(league.progressValue)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${getProgressColor(league.progressValue)}`}
                    style={{ width: `${league.progressValue}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Record:</span>
                <span>{league.wins}W - {league.losses}L ({Math.round((league.wins / (league.wins + league.losses)) * 100)}%)</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Points:</span>
                <span>{league.points?.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Status:</span>
                <Badge variant={league.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                  {league.status === 'active' ? 'In Progress' : 'Completed'}
                </Badge>
              </div>
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
};

export default LeagueProgressTable;