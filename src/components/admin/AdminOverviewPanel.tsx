import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Users, Trophy, Swords, Activity, TrendingUp, UserCheck,
  UserX, Shield, Clock, CheckCircle2, XCircle, AlertCircle, Trash2,
} from 'lucide-react';
import { format, subDays } from 'date-fns';

interface Stats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  adminCount: number;
  totalMatches: number;
  completedMatches: number;
  pendingMatches: number;
  totalLeagues: number;
  totalDivisions: number;
  recentSignups: number;
  recentActivity: { activity_type: string; created_at: string; user_id: string | null }[];
}

const StatCard = ({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: number | string; sub?: string; color: string;
}) => (
  <Card>
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`p-3 rounded-full ${color.replace('text-', 'bg-').replace('-600', '-100').replace('-700', '-100')}`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

const activityLabel: Record<string, string> = {
  SIGNED_IN: 'Signed in',
  SIGNED_OUT: 'Signed out',
  PASSWORD_RECOVERY: 'Password reset',
  match_created: 'Created a match',
  match_completed: 'Completed a match',
  profile_updated: 'Updated profile',
  league_joined: 'Joined a league',
};

export const AdminOverviewPanel: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmDialogOpen, setResetConfirmDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleResetAllData = async () => {
    setResetting(true);
    try {
      await Promise.all([
        supabase.from('players').update({ wins: 0, losses: 0, points: 0 }).neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      ]);
      toast.success('All user data has been reset successfully.');
      setResetConfirmDialogOpen(false);
    } catch (e: any) {
      toast.error(`Reset failed: ${e.message}`);
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      const since7Days = subDays(new Date(), 7).toISOString();

      const [usersRes, matchesRes, leaguesRes, divisionsRes, activityRes, signupsRes] =
        await Promise.all([
          supabase.from('admin_profiles_view').select('is_active, roles'),
          supabase.from('matches').select('status, invitation_status'),
          supabase.from('league_registrations').select('league_id'),
          supabase.from('divisions').select('id'),
          supabase.from('user_activity_log')
            .select('activity_type, created_at, user_id')
            .order('created_at', { ascending: false })
            .limit(12),
          supabase.from('profiles')
            .select('id')
            .gte('created_at', since7Days),
        ]);

      const users = (usersRes.data || []) as any[];
      const matches = (matchesRes.data || []) as any[];
      const leagueIds = new Set((leaguesRes.data || []).map((r: any) => r.league_id));

      setStats({
        totalUsers: users.length,
        activeUsers: users.filter(u => u.is_active).length,
        inactiveUsers: users.filter(u => !u.is_active).length,
        adminCount: users.filter(u => Array.isArray(u.roles) && u.roles.includes('admin')).length,
        totalMatches: matches.length,
        completedMatches: matches.filter(m => m.status === 'completed').length,
        pendingMatches: matches.filter(m =>
          m.invitation_status === 'pending' || m.status === 'scheduled'
        ).length,
        totalLeagues: leagueIds.size,
        totalDivisions: (divisionsRes.data || []).length,
        recentSignups: (signupsRes.data || []).length,
        recentActivity: (activityRes.data || []) as any[],
      });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}><CardContent className="p-6 h-28 animate-pulse bg-muted/30 rounded-lg" /></Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const winRate = stats.totalMatches > 0
    ? Math.round((stats.completedMatches / stats.totalMatches) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={stats.totalUsers}
          sub={`${stats.recentSignups} new this week`} color="text-blue-600" />
        <StatCard icon={UserCheck} label="Active Users" value={stats.activeUsers}
          sub={`${Math.round((stats.activeUsers / (stats.totalUsers || 1)) * 100)}% of total`} color="text-green-600" />
        <StatCard icon={UserX} label="Inactive" value={stats.inactiveUsers}
          sub="Deactivated accounts" color="text-red-500" />
        <StatCard icon={Shield} label="Admins" value={stats.adminCount}
          sub="Admin accounts" color="text-purple-600" />
        <StatCard icon={Swords} label="Total Matches" value={stats.totalMatches}
          sub={`${winRate}% completion rate`} color="text-orange-600" />
        <StatCard icon={CheckCircle2} label="Completed" value={stats.completedMatches}
          sub="Finished matches" color="text-green-600" />
        <StatCard icon={AlertCircle} label="Pending" value={stats.pendingMatches}
          sub="Awaiting response" color="text-yellow-600" />
        <StatCard icon={Trophy} label="Leagues" value={stats.totalLeagues}
          sub={`${stats.totalDivisions} divisions`} color="text-indigo-600" />
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4" />
            Recent Platform Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
          ) : (
            <div className="space-y-1">
              {stats.recentActivity.map((a, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                    <span className="text-sm">
                      {activityLabel[a.activity_type] ?? a.activity_type}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {a.user_id ? `${a.user_id.slice(0, 8)}…` : 'system'}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {format(new Date(a.created_at), 'MMM d, HH:mm')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <Trash2 className="w-4 h-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium">Reset All User Account Data</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Clears all match history, player stats, and notifications. This action cannot be undone.
            </p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setResetDialogOpen(true)}>
            Reset All Data
          </Button>
        </CardContent>
      </Card>

      {/* First confirmation */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All User Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all match history, reset all player stats to zero, and clear all notifications. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setResetDialogOpen(false); setResetConfirmDialogOpen(true); }}
            >
              Yes, Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Second confirmation */}
      <AlertDialog open={resetConfirmDialogOpen} onOpenChange={setResetConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Final Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              This is irreversible. All player wins, losses, match records, and notifications will be permanently erased. Proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={resetting}
              onClick={handleResetAllData}
            >
              {resetting ? 'Resetting…' : 'Reset Everything'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
