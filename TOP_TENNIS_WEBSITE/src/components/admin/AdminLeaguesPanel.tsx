import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Trophy, Users, Search, RefreshCw, ChevronRight, X, AlertCircle } from 'lucide-react';

interface Division {
  id: string;
  league_id: string;
  division_name: string;
  skill_level_range: string;
  gender_preference: string;
  age_range: string;
  competitiveness: string;
  max_players: number;
  current_players: number;
  status: string;
  tournament_status: string | null;
  season: string;
  created_at: string;
}

interface LeagueGroup {
  league_id: string;
  league_name: string;
  divisions: Division[];
  totalPlayers: number;
  registrations: number;
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-700 border-green-200',
    inactive: 'bg-gray-100 text-gray-600 border-gray-200',
    completed: 'bg-blue-100 text-blue-700 border-blue-200',
    upcoming: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  };
  return map[status?.toLowerCase()] ?? 'bg-gray-100 text-gray-600 border-gray-200';
};

export const AdminLeaguesPanel: React.FC = () => {
  const [leagues, setLeagues] = useState<LeagueGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [divisionsRes, regRes] = await Promise.all([
      supabase.from('divisions').select('*').order('created_at', { ascending: false }),
      supabase.from('league_registrations').select('league_id, league_name, status'),
    ]);

    const divisions = (divisionsRes.data || []) as Division[];
    const regs = (regRes.data || []) as any[];

    // Group by league_id
    const map = new Map<string, LeagueGroup>();
    for (const d of divisions) {
      if (!map.has(d.league_id)) {
        const leagueName = regs.find(r => r.league_id === d.league_id)?.league_name || d.league_id.slice(0, 8) + '…';
        map.set(d.league_id, {
          league_id: d.league_id,
          league_name: leagueName,
          divisions: [],
          totalPlayers: 0,
          registrations: regs.filter(r => r.league_id === d.league_id).length,
        });
      }
      const group = map.get(d.league_id)!;
      group.divisions.push(d);
      group.totalPlayers += d.current_players || 0;
    }

    setLeagues(Array.from(map.values()));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = leagues.filter(l =>
    l.league_name.toLowerCase().includes(search.toLowerCase()) ||
    l.divisions.some(d => d.division_name.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleExpand = (id: string) => setExpanded(e => e === id ? null : id);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search leagues or divisions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>
        <Button variant="outline" size="icon" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <span className="text-sm text-muted-foreground">{filtered.length} league{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <AlertCircle className="w-8 h-8" />
            <p>No leagues found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(league => (
            <Card key={league.league_id} className="overflow-hidden">
              {/* League header */}
              <button
                className="w-full text-left"
                onClick={() => toggleExpand(league.league_id)}
              >
                <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center flex-shrink-0">
                      <Trophy className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{league.league_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {league.divisions.length} division{league.divisions.length !== 1 ? 's' : ''} · {league.totalPlayers} players · {league.registrations} registrations
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 text-muted-foreground transition-transform ${expanded === league.league_id ? 'rotate-90' : ''}`}
                  />
                </div>
              </button>

              {/* Expanded divisions */}
              {expanded === league.league_id && (
                <div className="border-t">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Division</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Skill</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground hidden md:table-cell">Gender</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground hidden md:table-cell">Age</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Players</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {league.divisions.map(d => {
                        const pct = d.max_players > 0 ? Math.round((d.current_players / d.max_players) * 100) : 0;
                        return (
                          <tr key={d.id} className="border-b last:border-0 hover:bg-muted/10">
                            <td className="px-4 py-3">
                              <p className="font-medium">{d.division_name}</p>
                              <p className="text-xs text-muted-foreground">{d.season}</p>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground">{d.skill_level_range}</td>
                            <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground capitalize">{d.gender_preference}</td>
                            <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">{d.age_range}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-orange-500' : 'bg-green-500'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">{d.current_players}/{d.max_players}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={`text-xs ${statusBadge(d.status)}`}>
                                {d.status}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
