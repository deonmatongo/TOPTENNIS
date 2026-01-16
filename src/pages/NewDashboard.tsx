import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";
import { useMatches } from "@/hooks/useMatches";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useLeagueRegistrations } from "@/hooks/useLeagueRegistrations";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNotifications } from "@/hooks/useNotifications";
import { useFriendRequests } from "@/hooks/useFriendRequests";
import { useMessages } from "@/hooks/useMessages";
import { useMatchInvitesCount } from "@/hooks/useMatchInvitesCount";
import { Home, Calendar, User, FileText, BarChart3, Trophy, Users, Bell, Search, Settings, LogOut, Menu, X, Zap, TrendingUp, Target, MessageCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserProfile } from "@/hooks/useUserProfile";
import PlayerSearch from "@/components/dashboard/PlayerSearch";
import PlayerProfileModal from "@/components/dashboard/PlayerProfileModal";
import { SearchResult } from "@/hooks/usePlayerSearch";
import Header from "@/components/Header";

// Import all tab components
import OverviewTab from "@/components/dashboard/OverviewTab";
import MatchesCalendarTab from "@/components/dashboard/MatchesCalendarTab";
import CompetitionTab from "@/components/dashboard/CompetitionTab";
import RegisterTab from "@/components/dashboard/RegisterTab";
import ProfileTab from "@/components/dashboard/ProfileTab";
import NotificationsTab from "@/components/dashboard/NotificationsTab";
import MatchingTab from "@/components/dashboard/MatchingTab";
import FriendsMessagesTab from "@/components/dashboard/FriendsMessagesTab";
import MessagesTab from "@/components/dashboard/MessagesTab";
import PerformanceTab from "@/components/dashboard/PerformanceTab";
import MyLeaguesTab from "@/components/dashboard/MyLeaguesTab";
import ScheduleTab from "@/components/dashboard/ScheduleTab";
const NewDashboard = () => {
  const {
    user,
    signOut
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    profile
  } = useUserProfile();
  const {
    player,
    loading: playerLoading
  } = usePlayerProfile();
  const {
    matches,
    loading: matchesLoading,
    refetch: refetchMatches
  } = useMatches();
  const {
    players: leaderboard,
    loading: leaderboardLoading
  } = useLeaderboard();
  const {
    registrations
  } = useLeagueRegistrations();
  const {
    unreadCount
  } = useNotifications();
  const {
    getPendingRequestsCount
  } = useFriendRequests();
  const {
    getUnreadCount
  } = useMessages();
  const pendingMatchInvites = useMatchInvitesCount();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('profile');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<SearchResult | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);

  // Handle URL parameters for tab navigation
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['profile', 'performance', 'my-leagues', 'schedule', 'matching', 'register', 'messages', 'social', 'notifications'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);
  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };
  const handlePlayerSelect = (player: SearchResult) => {
    setSelectedPlayer(player);
    setShowPlayerModal(true);
  };
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Update URL to maintain state on refresh
    navigate(`/dashboard?tab=${tab}`, {
      replace: true
    });
    if (tab === 'schedule' || tab === 'overview') {
      refetchMatches();
    }
    // Close sidebar on mobile after navigation
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Redirect to profile setup if user doesn't have a player profile
  useEffect(() => {
    if (!playerLoading && !player) {
      navigate('/profile-setup');
    }
  }, [playerLoading, player, navigate]);

  // Calculate unread messages count (must be before any early returns)
  const unreadMessagesCount = getUnreadCount();
  
  // Menu items with reactive badges (must be before any early returns)
  const menuItems = useMemo(() => [{
    id: "profile",
    label: "My Profile",
    icon: User,
    description: "Personal settings & stats"
  }, {
    id: "performance",
    label: "My Performance",
    icon: TrendingUp,
    description: "Stats & analytics"
  }, {
    id: "my-leagues",
    label: "My Leagues",
    icon: Trophy,
    description: "League history & progress"
  }, {
    id: "schedule",
    label: "My Schedule",
    icon: Calendar,
    description: "Availability & matches",
    badge: pendingMatchInvites > 0 ? pendingMatchInvites : null
  }, {
    id: "matching",
    label: "Casual Match",
    icon: Users,
    description: "Find an Opponent"
  }, {
    id: "register",
    label: "Join a League",
    icon: FileText,
    description: "League registration"
  }, {
    id: "messages",
    label: "Messages",
    icon: Mail,
    description: "Conversations & chat",
    badge: unreadMessagesCount > 0 ? unreadMessagesCount : null
  }, {
    id: "social",
    label: "Build your Network",
    icon: MessageCircle,
    description: "Friends & connections",
    badge: getPendingRequestsCount() > 0 ? getPendingRequestsCount() : null
  }, {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    description: "Updates & alerts",
    badge: unreadCount > 0 ? unreadCount : null
  }], [pendingMatchInvites, unreadMessagesCount, getPendingRequestsCount, unreadCount]);
  
  // Early return for loading state (must be after all hooks)
  if (playerLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-foreground">Loading Dashboard</h3>
            <p className="text-muted-foreground font-light">Setting up your tennis profile...</p>
          </div>
        </div>
      </div>;
  }

  // Calculate quick stats for header
  const userMatches = matches.filter(match => match.player1_id === player?.id || match.player2_id === player?.id);
  const completedMatches = userMatches.filter(match => match.status === 'completed');
  const wonMatches = completedMatches.filter(match => match.winner_id === player?.id);
  const winRate = completedMatches.length > 0 ? Math.round(wonMatches.length / completedMatches.length * 100) : 0;
  const renderActiveTab = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileTab player={player} />;
      case 'performance':
        return <PerformanceTab player={player} matches={matches} />;
      case 'my-leagues':
        return <MyLeaguesTab 
          player={player} 
          registrations={registrations}
          onNavigateToSchedule={(opponentId, opponentName) => {
            setActiveTab('schedule');
            // You can pass additional state here if needed
          }}
        />;
      case 'schedule':
        return <ScheduleTab player={player} matches={matches} matchesLoading={matchesLoading} />;
      case 'matching':
        return <MatchingTab />;
      case 'register':
        return <RegisterTab />;
      case 'messages':
        return <MessagesTab />;
      case 'social':
        return <FriendsMessagesTab />;
      case 'notifications':
        return <NotificationsTab />;
      default:
        return <ProfileTab player={player} />;
    }
  };
  const currentTab = menuItems.find(item => item.id === activeTab);
  return <div className="min-h-screen bg-gradient-to-br from-background via-background/50 to-primary/5 overflow-x-hidden">
      <Header />
      {/* Mobile Sidebar Overlay */}
      {isMobile && sidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-20 h-[calc(100vh-5rem)] bg-card border-r border-border z-40 transform transition-transform duration-300 ease-in-out ${isMobile ? `w-[280px] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}` : 'w-64 lg:w-72 translate-x-0'}`}>
        {/* Sidebar Header */}
        

        {/* Player Quick Info */}
        <div className="p-4 sm:p-6 border-b border-border/50">
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10 sm:w-12 sm:h-12 ring-2 ring-border shadow-md">
              <AvatarImage src={profile?.profile_picture_url || undefined} alt="Profile picture" />
              <AvatarFallback className="bg-gradient-to-r from-primary to-accent text-white font-bold text-base sm:text-lg">
                {player?.name?.charAt(0).toUpperCase() || 'P'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-foreground truncate">{player?.name}</h3>
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 mt-1 space-y-1 sm:space-y-0">
                <Badge className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full w-fit">
                  {player?.usta_rating || `${player?.skill_level || 5}.0`} Level
                </Badge>
                <span className="text-xs text-muted-foreground">{winRate}% Win Rate</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Navigation Menu */}
        <nav className="p-3 space-y-1 max-h-[calc(100vh-360px)] overflow-y-auto">
          {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return <Button key={item.id} variant={isActive ? "default" : "ghost"} className={`w-full justify-start text-left h-12 p-3 rounded-xl font-bold transition-all duration-200 group ${isActive ? "bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/25" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`} onClick={() => handleTabChange(item.id)}>
                <div className="flex items-center space-x-2 w-full">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-muted-foreground group-hover:text-foreground'}`} />
                  <div className="flex-1 text-left min-w-0">
                    <div className={`font-bold text-sm ${isActive ? 'text-white' : ''} truncate`}>
                      {item.label}
                    </div>
                    <div className={`text-xs font-light ${isActive ? 'text-white/80' : 'text-muted-foreground'} truncate`}>
                      {item.description}
                    </div>
                  </div>
                  {item.badge && <Badge className="bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 min-w-[1.25rem] h-5 flex-shrink-0">
                      {item.badge > 99 ? '99+' : item.badge}
                    </Badge>}
                </div>
              </Button>;
        })}
        </nav>
        
        {/* Bottom Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border/50 bg-gradient-to-t from-card to-transparent">
          <div className="space-y-2">
            
            
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-10 rounded-lg" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-3" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${isMobile ? 'ml-0' : 'ml-64 lg:ml-72'} pt-20`}>
        {/* Top Header */}
        <header className="sticky top-20 z-30 bg-card border-b-2 border-border">
          <div className="px-3 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              {/* Left Section */}
              <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
                {isMobile && <Button size="icon" variant="ghost" onClick={() => setSidebarOpen(true)} className="h-8 w-8 sm:h-10 sm:w-10 lg:hidden flex-shrink-0">
                    <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>}
                
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <h1 className="text-lg sm:text-xl lg:text-2xl font-black text-foreground truncate">
                      {currentTab?.label || 'Dashboard'}
                    </h1>
                    <Badge variant="outline" className="text-xs px-1 py-0.5 sm:px-2 sm:py-1 hidden sm:inline-flex">
                      {currentTab?.description}
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground font-light hidden sm:block">
                    {activeTab === 'profile' 
                      ? `Welcome back, ${player?.name?.split(' ')[0] || 'Player'}!`
                      : activeTab === 'performance'
                      ? `Welcome back, ${player?.name?.split(' ')[0] || 'Player'}! Let's take a look at your dashboard`
                      : `Welcome back, ${player?.name?.split(' ')[0] || 'Player'}! Ready to play?`
                    }
                  </p>
                </div>
              </div>

              {/* Right Section */}
              <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4 flex-shrink-0">
                {/* Quick Stats */}
                <div className="hidden xl:flex items-center space-x-2 lg:space-x-4">
                  <Card className="bg-emerald-50 border-emerald-200">
                    <CardContent className="p-2 lg:p-3">
                      <div className="flex items-center space-x-2">
                        <Trophy className="w-3 h-3 lg:w-4 lg:h-4 text-emerald-600" />
                        <span className="text-xs lg:text-sm font-bold text-emerald-700">{winRate}% Win Rate</span>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-2 lg:p-3">
                      <div className="flex items-center space-x-2">
                        <Target className="w-3 h-3 lg:w-4 lg:h-4 text-blue-600" />
                        <span className="text-xs lg:text-sm font-bold text-blue-700">
                          {player?.usta_rating || `${player?.skill_level || 5}.0`} Level
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Search */}
                <div className="hidden lg:block">
                  <PlayerSearch onPlayerSelect={handlePlayerSelect} placeholder="Search players..." className="w-48 xl:w-64" />
                </div>

                {/* Mobile Search */}
                <Button size="icon" variant="ghost" className="lg:hidden h-8 w-8 sm:h-10 sm:w-10 rounded-xl hover:bg-accent/50">
                  <Search className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>

                {/* Notifications */}
                

              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-3 sm:p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">
            {renderActiveTab()}
          </div>
        </main>

        {/* Player Profile Modal */}
        <PlayerProfileModal player={selectedPlayer} isOpen={showPlayerModal} onClose={() => setShowPlayerModal(false)} />
      </div>
    </div>;
};
export default NewDashboard;