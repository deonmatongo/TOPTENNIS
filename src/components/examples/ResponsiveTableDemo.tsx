import React from 'react';
import { ResponsiveTable, ResponsiveTableColumn } from '@/components/ui/responsive-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Calendar, Target, Mail, Phone, MapPin } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  email: string;
  phone: string;
  level: string;
  wins: number;
  losses: number;
  points: number;
  location: string;
  status: 'active' | 'inactive';
}

const ResponsiveTableDemo = () => {
  const demoData: Player[] = [
    {
      id: '1',
      name: 'John Smith',
      email: 'john@example.com',
      phone: '+1 555-0100',
      level: '4.5',
      wins: 24,
      losses: 8,
      points: 2400,
      location: 'Atlanta, GA',
      status: 'active',
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      phone: '+1 555-0101',
      level: '5.0',
      wins: 30,
      losses: 5,
      points: 3000,
      location: 'Charlotte, NC',
      status: 'active',
    },
    {
      id: '3',
      name: 'Mike Davis',
      email: 'mike@example.com',
      phone: '+1 555-0102',
      level: '4.0',
      wins: 18,
      losses: 12,
      points: 1800,
      location: 'Denver, CO',
      status: 'inactive',
    },
    {
      id: '4',
      name: 'Emily Chen',
      email: 'emily@example.com',
      phone: '+1 555-0103',
      level: '4.5',
      wins: 22,
      losses: 10,
      points: 2200,
      location: 'Seattle, WA',
      status: 'active',
    },
  ];

  const columns: ResponsiveTableColumn<Player>[] = [
    {
      key: 'name',
      label: 'Player',
      render: (_, player) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
            {player.name.charAt(0)}
          </div>
          <div>
            <div className="font-medium">{player.name}</div>
            <div className="text-xs text-muted-foreground sm:hidden">{player.level} Level</div>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      hideOn: 'mobile',
      render: (_, player) => (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{player.email}</span>
        </div>
      ),
    },
    {
      key: 'level',
      label: 'Level',
      hideOn: 'mobile',
      align: 'center',
      render: (_, player) => (
        <Badge variant="outline" className="font-bold">
          {player.level}
        </Badge>
      ),
    },
    {
      key: 'record',
      label: 'Record',
      hideOn: 'mobile-tablet',
      render: (_, player) => (
        <div className="text-sm">
          <div className="font-medium">{player.wins}W - {player.losses}L</div>
          <div className="text-xs text-muted-foreground">
            {Math.round((player.wins / (player.wins + player.losses)) * 100)}% win rate
          </div>
        </div>
      ),
    },
    {
      key: 'points',
      label: 'Points',
      align: 'center',
      render: (_, player) => (
        <div className="flex items-center justify-center gap-1">
          <Trophy className="h-4 w-4 text-yellow-500" />
          <span className="font-bold">{player.points.toLocaleString()}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      hideOn: 'mobile',
      render: (_, player) => (
        <Badge variant={player.status === 'active' ? 'default' : 'secondary'}>
          {player.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: () => (
        <Button variant="ghost" size="sm">
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Responsive Table Demo</h2>
        <p className="text-muted-foreground">
          Featuring horizontal scrolling, collapsible rows on mobile, and responsive column visibility.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Player Leaderboard
          </CardTitle>
          <CardDescription>
            On mobile devices, tap the chevron icon to expand rows and see hidden details.
            The table scrolls horizontally to show all columns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveTable
            data={demoData}
            columns={columns}
            getRowKey={(player) => player.id}
            highlightRow={(player) => player.wins > 25}
            renderExpandedRow={(player) => (
              <div className="space-y-3 p-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Email:</span>
                  <span className="text-muted-foreground">{player.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Phone:</span>
                  <span className="text-muted-foreground">{player.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Location:</span>
                  <span className="text-muted-foreground">{player.location}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Record:</span>
                  <span className="text-muted-foreground">
                    {player.wins}W - {player.losses}L 
                    ({Math.round((player.wins / (player.wins + player.losses)) * 100)}% win rate)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Level:</span>
                  <Badge variant="outline" className="text-xs">{player.level}</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Status:</span>
                  <Badge variant={player.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                    {player.status}
                  </Badge>
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-2" />
            <div>
              <div className="font-medium">Horizontal Scrolling</div>
              <div className="text-sm text-muted-foreground">
                Table scrolls horizontally on small screens to show all columns without breaking layout
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-2" />
            <div>
              <div className="font-medium">Collapsible Rows (Mobile)</div>
              <div className="text-sm text-muted-foreground">
                On mobile, rows can be expanded to show additional details that don't fit in the table
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-2" />
            <div>
              <div className="font-medium">Responsive Columns</div>
              <div className="text-sm text-muted-foreground">
                Columns hide based on screen size (mobile, tablet, desktop) to optimize space
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-2" />
            <div>
              <div className="font-medium">Row Highlighting</div>
              <div className="text-sm text-muted-foreground">
                Rows can be highlighted based on custom conditions (e.g., top performers)
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResponsiveTableDemo;
