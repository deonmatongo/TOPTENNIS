import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScheduleStatsProps {
  totalAvailableSlots: number;
  upcomingBookings: number;
  pendingInvites: number;
}

export const ScheduleStats: React.FC<ScheduleStatsProps> = ({
  totalAvailableSlots,
  upcomingBookings,
  pendingInvites,
}) => {
  const stats = [
    {
      label: 'Available Slots',
      value: totalAvailableSlots,
      icon: Calendar,
      bgColor: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      label: 'Scheduled Matches',
      value: upcomingBookings,
      icon: Clock,
      bgColor: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      label: 'Pending Invites',
      value: pendingInvites,
      icon: User,
      bgColor: 'bg-amber-500/10',
      iconColor: 'text-amber-500',
      highlight: pendingInvites > 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card 
            key={index} 
            className={cn(
              "border shadow-sm transition-all duration-300 hover:shadow-md animate-scale-in",
              stat.highlight && "ring-2 ring-amber-500/20"
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-3 rounded-xl transition-transform duration-200 hover:scale-110",
                  stat.bgColor
                )}>
                  <Icon className={cn("h-5 w-5", stat.iconColor)} />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
