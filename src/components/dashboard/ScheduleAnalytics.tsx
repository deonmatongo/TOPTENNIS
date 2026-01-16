import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { useMatchInvites } from '@/hooks/useMatchInvites';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calendar, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, differenceInHours, differenceInMinutes } from 'date-fns';

export const ScheduleAnalytics = () => {
  const { availability } = useUserAvailability();
  const { invites } = useMatchInvites();

  const analytics = useMemo(() => {
    // Calculate total available hours
    const totalHours = availability.reduce((sum, slot) => {
      if (!slot.is_available || slot.is_blocked) return sum;
      const start = new Date(`2000-01-01T${slot.start_time}`);
      const end = new Date(`2000-01-01T${slot.end_time}`);
      return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    }, 0);

    // Calculate availability by day of week
    const byDayOfWeek = availability.reduce((acc, slot) => {
      if (!slot.is_available || slot.is_blocked) return acc;
      const dayName = format(new Date(slot.date), 'EEEE');
      const start = new Date(`2000-01-01T${slot.start_time}`);
      const end = new Date(`2000-01-01T${slot.end_time}`);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      acc[dayName] = (acc[dayName] || 0) + hours;
      return acc;
    }, {} as Record<string, number>);

    const dayData = Object.entries(byDayOfWeek).map(([day, hours]) => ({
      day: day.slice(0, 3),
      hours: Math.round(hours * 10) / 10,
    }));

    // Calculate invite acceptance rate
    const totalInvites = invites.length;
    const acceptedInvites = invites.filter(i => i.status === 'accepted').length;
    const declinedInvites = invites.filter(i => i.status === 'declined').length;
    const pendingInvites = invites.filter(i => i.status === 'pending').length;
    const acceptanceRate = totalInvites > 0 ? (acceptedInvites / totalInvites) * 100 : 0;

    // Calculate average response time
    const responseTimes = invites
      .filter(i => i.response_at && i.created_at)
      .map(i => differenceInHours(new Date(i.response_at!), new Date(i.created_at)));
    
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    // Most booked hours
    const hourBookings = invites.reduce((acc, invite) => {
      const hour = parseInt(invite.start_time.split(':')[0]);
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const peakHour = Object.entries(hourBookings).reduce((max, [hour, count]) => 
      count > max.count ? { hour: parseInt(hour), count } : max,
      { hour: 0, count: 0 }
    );

    return {
      totalHours: Math.round(totalHours * 10) / 10,
      availabilityByDay: dayData,
      totalInvites,
      acceptedInvites,
      declinedInvites,
      pendingInvites,
      acceptanceRate: Math.round(acceptanceRate),
      avgResponseTime: Math.round(avgResponseTime * 10) / 10,
      peakHour: peakHour.hour > 0 ? `${peakHour.hour.toString().padStart(2, '0')}:00` : 'N/A',
    };
  }, [availability, invites]);

  const statusData = [
    { name: 'Accepted', value: analytics.acceptedInvites, color: '#10b981' },
    { name: 'Pending', value: analytics.pendingInvites, color: '#f59e0b' },
    { name: 'Declined', value: analytics.declinedInvites, color: '#ef4444' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Available Hours</p>
                <p className="text-2xl font-bold">{analytics.totalHours}h</p>
              </div>
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Acceptance Rate</p>
                <p className="text-2xl font-bold">{analytics.acceptanceRate}%</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                <p className="text-2xl font-bold">{analytics.avgResponseTime}h</p>
              </div>
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Peak Match Time</p>
                <p className="text-2xl font-bold">{analytics.peakHour}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Availability by Day */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Availability by Day</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analytics.availabilityByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Invite Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No invite data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
