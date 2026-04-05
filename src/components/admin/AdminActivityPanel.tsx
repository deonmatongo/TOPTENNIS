import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Activity, Search, RefreshCw, X, User } from 'lucide-react';

interface LogEntry {
  id: string;
  activity_type: string;
  created_at: string;
  user_id: string | null;
  metadata: any;
  user_agent: string | null;
  // joined
  user_name?: string;
  user_email?: string;
}

const typeColor = (type: string) => {
  if (type.includes('SIGNED_IN') || type.includes('login')) return 'bg-green-100 text-green-700';
  if (type.includes('SIGNED_OUT') || type.includes('logout')) return 'bg-gray-100 text-gray-600';
  if (type.includes('PASSWORD') || type.includes('password')) return 'bg-orange-100 text-orange-700';
  if (type.includes('match')) return 'bg-blue-100 text-blue-700';
  if (type.includes('league') || type.includes('division')) return 'bg-purple-100 text-purple-700';
  if (type.includes('profile')) return 'bg-teal-100 text-teal-700';
  return 'bg-gray-100 text-gray-600';
};

const PAGE_SIZE = 50;

export const AdminActivityPanel: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [types, setTypes] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    const { data: logData } = await supabase
      .from('user_activity_log')
      .select('id, activity_type, created_at, user_id, metadata, user_agent')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (!logData) { setLoading(false); return; }

    // Unique types
    setTypes(Array.from(new Set(logData.map(l => l.activity_type))).sort());

    // Collect unique user IDs
    const ids = Array.from(new Set(logData.map(l => l.user_id).filter(Boolean))) as string[];
    let nameMap = new Map<string, { name: string; email: string }>();

    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', ids);
      nameMap = new Map(
        (profiles || []).map(p => [
          p.id,
          {
            name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—',
            email: (p as any).email || '',
          },
        ])
      );
    }

    setLogs(logData.map(l => ({
      ...l,
      user_name: l.user_id ? (nameMap.get(l.user_id)?.name ?? l.user_id.slice(0, 8) + '…') : 'System',
      user_email: l.user_id ? (nameMap.get(l.user_id)?.email ?? '') : '',
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      l.user_name?.toLowerCase().includes(q) ||
      l.user_email?.toLowerCase().includes(q) ||
      l.activity_type.toLowerCase().includes(q);
    const matchType = typeFilter === 'all' || l.activity_type === typeFilter;
    return matchSearch && matchType;
  });

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by user or activity type…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Activity type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <span className="text-sm text-muted-foreground">{filtered.length} events</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Event</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden sm:table-cell">User</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Metadata</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-muted-foreground">No activity found</td>
                    </tr>
                  ) : paginated.map(l => (
                    <tr key={l.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <Badge className={`text-xs font-mono ${typeColor(l.activity_type)}`} variant="secondary">
                          {l.activity_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                            <User className="w-3 h-3 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-medium text-xs">{l.user_name}</p>
                            {l.user_email && <p className="text-xs text-muted-foreground">{l.user_email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {l.metadata ? (
                          <span className="text-xs text-muted-foreground font-mono">
                            {JSON.stringify(l.metadata).slice(0, 60)}
                            {JSON.stringify(l.metadata).length > 60 ? '…' : ''}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(l.created_at), 'MMM d, HH:mm:ss')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {page + 1} of {totalPages} ({filtered.length} events)
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
};
