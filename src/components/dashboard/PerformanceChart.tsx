import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts';
import { 
  TrendingUp, 
  Activity,
  AlertCircle
} from 'lucide-react';
import { usePerformanceAnalytics } from '@/hooks/usePerformanceAnalytics';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PerformanceChartProps {
  registrations: any[];
  player: any;
  matches: any[];
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ registrations, player, matches }) => {
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '1y' | 'all'>('1y');
  
  const { monthlyData, overall } = usePerformanceAnalytics(matches, player?.id);

  const getFilteredData = () => {
    const monthsBack = {
      '3m': 3,
      '6m': 6,
      '1y': 12,
      'all': monthlyData.length
    }[timeRange];
    
    return monthlyData.slice(-monthsBack);
  };

  const calculateTrend = () => {
    const data = getFilteredData();
    if (data.length < 2) return 0;
    
    const first = data[0].winRate;
    const last = data[data.length - 1].winRate;
    return first > 0 ? ((last - first) / first) * 100 : 0;
  };

  const filteredData = getFilteredData();
  const trend = calculateTrend();

  if (monthlyData.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No performance data available yet. Start playing matches to see your analytics!
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Performance Analytics
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={trend > 0 ? 'default' : 'destructive'} className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
              </Badge>
              <div className="flex gap-1">
                {(['3m', '6m', '1y', 'all'] as const).map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeRange(range)}
                  >
                    {range.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="winrate" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="winrate">Win Rate</TabsTrigger>
              <TabsTrigger value="position">Matches</TabsTrigger>
              <TabsTrigger value="skills">W/L Split</TabsTrigger>
              <TabsTrigger value="leagues">Points</TabsTrigger>
            </TabsList>

            <TabsContent value="winrate" className="mt-6">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={filteredData}>
                  <defs>
                    <linearGradient id="colorWinRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`${value}%`, 'Win Rate']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="winRate" 
                    stroke="hsl(var(--primary))" 
                    fillOpacity={1}
                    fill="url(#colorWinRate)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="position" className="mt-6">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [value, 'Matches']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="matches" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-2))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="skills" className="mt-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="wins" fill="hsl(var(--chart-1))" name="Wins" />
                  <Bar dataKey="losses" fill="hsl(var(--chart-5))" name="Losses" />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="leagues" className="mt-6">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={filteredData}>
                  <defs>
                    <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [value, 'Points']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="points" 
                    stroke="hsl(var(--chart-3))" 
                    fillOpacity={1}
                    fill="url(#colorPoints)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceChart;
