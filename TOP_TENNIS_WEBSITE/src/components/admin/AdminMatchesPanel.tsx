import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Swords, Search, RefreshCw, X, AlertCircle, MapPin, Calendar } from 'lucide-react';

interface MatchRow {
  id: string;
  player1_id: string | null;
  player2_id: string | null;
  match_date: string | null;
  status: string | null;
  invitation_status: string | null;
  player1_score: number | null;
  player2_score: number | null;
  court_location: string | null;
  league_id: string | null;
  created_at: string | null;
  winner_id: string | null;
  // joined
  p1_name?: string;
  p2_name?: string;
}

const inviteBadge = (status: string | null) => {
  const map: Record<string, string> = {
    accepted: 'bg-green-100 text-green-700 border-green-200',
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    declined: 'bg-red-100 text-red-700 border-red-200',
    completed: 'bg-blue-100 text-blue-700 border-blue-200',
    cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  const k = status?.toLowerCase() ?? '';
  return map[k] ?? 'bg-gray-100 text-gray-600 border-gray-200';
};

export const AdminMatchesPanel: React.FC = () => {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const load = async () => {
    setLoading(true);
    const { data: matchData } = await supabase
      .from('matches')
      .select('id, player1_id, player2_id, match_date, status, invitation_status, player1_score, player2_score, court_location, league_id, created_at, winner_id')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!matchData) { setLoading(false); return; }

    // Collect unique user IDs and fetch names from profiles
    const ids = Array.from(new Set([
      ...matchData.map(m => m.player1_id),
      ...matchData.map(m => m.player2_id),
    ].filter(Boolean))) as string[];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', ids);

    const nameMap = new Map(
      (profiles || []).map(p => [p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.id.slice(0, 8)])
    );

    setMatches(matchData.map(m => ({
      ...m,
      p1_name: m.player1_id ? (nameMap.get(m.player1_id) ?? m.player1_id.slice(0, 8) + '…') : '—',
      p2_name: m.player2_id ? (nameMap.get(m.player2_id) ?? m.player2_id.slice(0, 8) + '…') : '—',
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = matches.filter(m => {
    const matchesSearch = !search.trim() ||
      m.p1_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.p2_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.court_location?.toLowerCase().includes(search.toLowerCase()) ||
      m.id.includes(search);

    const matchesStatus = statusFilter === 'all' ||
      m.invitation_status?.toLowerCase() === statusFilter ||
      m.status?.toLowerCase() === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const statusCounts = matches.reduce<Record<string, number>>((acc, m) => {
    const k = m.invitation_status ?? m.status ?? 'unknown';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(statusCounts).map(([k, v]) => (
          <button
            key={k}
            onClick={() => { setStatusFilter(s => s === k ? 'all' : k); setPage(0); }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${inviteBadge(k)} ${statusFilter === k ? 'ring-2 ring-offset-1 ring-current' : ''}`}
          >
            {k}: {v}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by player name, court or match ID…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <span className="text-sm text-muted-foreground">{filtered.length} match{filtered.length !== 1 ? 'es' : ''}</span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <AlertCircle className="w-8 h-8" />
              <p>No matches found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Match</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden sm:table-cell">Score</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Court</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(m => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Swords className="w-4 h-4 text-orange-500 flex-shrink-0" />
                          <div>
                            <p className="font-medium">
                              {m.p1_name} <span className="text-muted-foreground font-normal">vs</span> {m.p2_name}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">{m.id.slice(0, 12)}…</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {m.player1_score !== null && m.player2_score !== null
                          ? <span className="font-mono font-semibold">{m.player1_score} – {m.player2_score}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs ${inviteBadge(m.invitation_status ?? m.status)}`}>
                          {m.invitation_status ?? m.status ?? 'unknown'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {m.match_date ? format(new Date(m.match_date), 'MMM d, yyyy') : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {m.court_location ? (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate max-w-32">{m.court_location}</span>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {page + 1} of {totalPages} ({filtered.length} matches)
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};
