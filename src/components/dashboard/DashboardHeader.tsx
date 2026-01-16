
import React from "react";
import { Search, Bell, Settings, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationDropdown from "./NotificationDropdown";
import PlayerSearch from "./PlayerSearch";
import PlayerProfileModal from "./PlayerProfileModal";
import { SearchResult } from "@/hooks/usePlayerSearch";
import { toast } from "sonner";

interface DashboardHeaderProps {
  player: any;
  user: any;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  isMobile?: boolean;
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
}

const DashboardHeader = ({ player, user, sidebarCollapsed, setSidebarCollapsed, isMobile = false, sidebarOpen = false, setSidebarOpen }: DashboardHeaderProps) => {
  const { unreadCount } = useNotifications();
  const [selectedPlayer, setSelectedPlayer] = React.useState<SearchResult | null>(null);
  const [showPlayerModal, setShowPlayerModal] = React.useState(false);

  const handlePlayerSelect = (selectedPlayer: SearchResult) => {
    setSelectedPlayer(selectedPlayer);
    setShowPlayerModal(true);
  };
  const userInitials = user?.user_metadata?.first_name && user?.user_metadata?.last_name 
    ? `${user.user_metadata.first_name[0]}${user.user_metadata.last_name[0]}`
    : user?.email?.[0]?.toUpperCase() || 'U';

  // Calculate match readiness score (AI metric)
  const calculateMatchReadiness = () => {
    const recentWins = 3; // Mock data
    const daysRested = 2;
    const score = Math.min(100, (recentWins * 20) + (daysRested * 10) + 40);
    return score;
  };

  const readinessScore = calculateMatchReadiness();
  const getReadinessColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <header className="bg-card/80 backdrop-blur-xl border-b border-border px-4 sm:px-6 py-3 sm:py-4 shadow-tennis">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 sm:space-x-6 min-w-0 flex-1">
          {/* Mobile menu button */}
          {isMobile && (
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 lg:hidden"
              onClick={() => setSidebarOpen && setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          )}
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate">
                Welcome back, {player?.name}!
              </h1>
              <span className="text-lg sm:text-xl lg:text-2xl hidden sm:inline">🎾</span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 flex items-center space-x-2">
              <span className="hidden sm:inline">Your match readiness is {readinessScore}%</span>
              <span className="sm:hidden">Readiness: {readinessScore}%</span>
              <div className={`w-2 h-2 rounded-full ${getReadinessColor(readinessScore)} ml-1 sm:ml-2`}></div>
            </p>
          </div>
          
          <div className="hidden xl:flex items-center space-x-4">
            <div className="px-4 py-2 bg-muted/50 rounded-lg border border-border">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${getReadinessColor(readinessScore)}`}></div>
                <span className="text-sm font-medium text-foreground">Match Ready</span>
              </div>
            </div>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 px-3 py-1">
              Level {player?.usta_rating || player?.skill_level}
            </Badge>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4">
          <div className="hidden md:block">
            <PlayerSearch 
              onPlayerSelect={handlePlayerSelect}
              placeholder="Search players..."
              className="w-60 lg:w-80"
            />
          </div>
          
          <NotificationDropdown>
            <Button size="icon" variant="ghost" className="relative h-9 w-9 sm:h-10 sm:w-10 hover:bg-accent/50">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 p-0 flex items-center justify-center bg-destructive text-destructive-foreground text-xs">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </Button>
          </NotificationDropdown>
          
          <Button size="icon" variant="ghost" className="h-9 w-9 sm:h-10 sm:w-10 hidden sm:flex hover:bg-accent/50">
            <Settings className="w-4 h-4" />
          </Button>
          
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-primary rounded-full flex items-center justify-center shadow-md border-2 border-background">
            <span className="text-primary-foreground font-bold text-xs sm:text-sm">{userInitials}</span>
          </div>
        </div>
      </div>

      {/* Player Profile Modal */}
      <PlayerProfileModal 
        player={selectedPlayer}
        isOpen={showPlayerModal}
        onClose={() => {
          setShowPlayerModal(false);
          setSelectedPlayer(null);
        }}
      />
    </header>
  );
};

export default DashboardHeader;
