import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AdminOverviewPanel } from '@/components/admin/AdminOverviewPanel';
import { AdminUsersPanel } from '@/components/admin/AdminUsersPanel';
import { AdminLeaguesPanel } from '@/components/admin/AdminLeaguesPanel';
import { AdminMatchesPanel } from '@/components/admin/AdminMatchesPanel';
import { AdminActivityPanel } from '@/components/admin/AdminActivityPanel';
import { AdminNotificationsPanel } from '@/components/admin/AdminNotificationsPanel';
import {
  LayoutDashboard, Users, Trophy, Swords, Activity, Bell,
  Shield, LogOut, ArrowLeft, Menu, X, ChevronRight,
} from 'lucide-react';

type Panel = 'overview' | 'users' | 'leagues' | 'matches' | 'activity' | 'notifications';

interface NavItem {
  id: Panel;
  label: string;
  icon: React.ElementType;
  badge?: string;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, description: 'Platform stats & recent activity' },
  { id: 'users', label: 'Users', icon: Users, description: 'Manage accounts & roles' },
  { id: 'leagues', label: 'Leagues', icon: Trophy, description: 'Leagues & divisions' },
  { id: 'matches', label: 'Matches', icon: Swords, description: 'All matches & scores' },
  { id: 'activity', label: 'Activity Log', icon: Activity, description: 'Audit trail & events' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Broadcast messages' },
];

const PANEL_TITLES: Record<Panel, { title: string; subtitle: string }> = {
  overview: { title: 'Overview', subtitle: 'Platform-wide stats and recent activity' },
  users: { title: 'User Management', subtitle: 'View, search, and manage all user accounts' },
  leagues: { title: 'Leagues & Divisions', subtitle: 'Monitor and manage league structure' },
  matches: { title: 'Match Management', subtitle: 'All matches across the platform' },
  activity: { title: 'Activity Log', subtitle: 'Full audit trail of user and system events' },
  notifications: { title: 'Notifications', subtitle: 'Broadcast announcements to users' },
};

const AdminDashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState<Panel>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out');
      navigate('/');
    } catch {
      toast.error('Sign out failed');
    }
  };

  const handleNav = (id: Panel) => {
    setActive(id);
    setSidebarOpen(false);
  };

  const { title, subtitle } = PANEL_TITLES[active];

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Sidebar overlay (mobile) ─────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30 w-64 bg-card border-r border-border
          flex flex-col transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Sidebar header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm leading-none">Admin Panel</p>
              <p className="text-xs text-muted-foreground mt-0.5">Top Tennis</p>
            </div>
          </div>
          <button
            className="lg:hidden p-1 rounded hover:bg-muted"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-sm
                  ${isActive
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }
                `}
              >
                <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : ''}`} />
                <span className="flex-1 font-medium">{item.label}</span>
                {item.badge && (
                  <Badge className={`text-xs px-1.5 py-0 ${isActive ? 'bg-white/20 text-white border-white/30' : 'bg-muted'}`} variant="outline">
                    {item.badge}
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-border space-y-1">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Back to App</span>
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-medium">Sign Out</span>
          </button>
          {user && (
            <div className="px-3 py-2 mt-1">
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-card border-b border-border px-4 lg:px-8 py-4 flex items-center gap-4">
          <button
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4 text-red-600" />
            <span>Admin</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-semibold">{title}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Page header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{subtitle}</p>
            </div>

            {/* Active panel */}
            {active === 'overview' && <AdminOverviewPanel />}
            {active === 'users' && <AdminUsersPanel />}
            {active === 'leagues' && <AdminLeaguesPanel />}
            {active === 'matches' && <AdminMatchesPanel />}
            {active === 'activity' && <AdminActivityPanel />}
            {active === 'notifications' && <AdminNotificationsPanel />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
