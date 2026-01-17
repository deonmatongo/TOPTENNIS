import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";
import { useSearchParams } from "react-router-dom";
import PlayerProfileSetup from "@/components/PlayerProfileSetup";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import OverviewTab from "@/components/dashboard/OverviewTab";
import MatchesTab from "@/components/dashboard/MatchesTab";
import ProfileTab from "@/components/dashboard/ProfileTab";
import RegisterTab from "@/components/dashboard/RegisterTab";
import { CalendarTab } from "@/components/dashboard/CalendarTab";
import MatchingTab from "@/components/dashboard/MatchingTab";
import CompetitionTab from "@/components/dashboard/CompetitionTab";
import MyLeaguesTab from "@/components/dashboard/MyLeaguesTab";
import MyDivisionsTab from "@/components/dashboard/MyDivisionsTab";
import NotificationsTab from "@/components/dashboard/NotificationsTab";
import { NotificationSettingsTab } from "@/components/dashboard/NotificationSettingsTab";
import { CancellationHistoryTab } from "@/components/dashboard/CancellationHistoryTab";
import { ReminderNotifications } from "@/components/dashboard/ReminderNotifications";
import { NotificationPermissionPrompt } from "@/components/dashboard/NotificationPermissionPrompt";
import { MatchInvitesList } from "@/components/dashboard/MatchInvitesList";
import { useMatches } from "@/hooks/useMatches";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useLeagueRegistrations } from "@/hooks/useLeagueRegistrations";
import Header from "@/components/Header";
import ScheduleTab from "@/components/dashboard/ScheduleTab";
import { Card, CardContent } from "@/components/ui/card";

const Dashboard = () => {
  const { user } = useAuth();
  const { player, loading, createPlayerProfile } = usePlayerProfile();
  const { matches } = useMatches();
  const { players: leaderboard, loading: leaderboardLoading } = useLeaderboard();
  const { registrations } = useLeagueRegistrations();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedLeague, setSelectedLeague] = useState("");
  const [selectedOpponent, setSelectedOpponent] = useState<{id?: string, name?: string} | null>(null);

  // Set initial tab from URL parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <PlayerProfileSetup 
        onProfileCreated={() => {
          // Reload and redirect to schedule tab
          window.location.href = '/dashboard?tab=schedule';
        }} 
        createPlayerProfile={createPlayerProfile}
      />
    );
  }


  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <OverviewTab 
            player={player} 
            matches={matches} 
            leaderboard={leaderboard}
            selectedLeague={selectedLeague}
            setSelectedLeague={setSelectedLeague}
          />
        );
      case "matches":
        return (
          <MatchesTab 
            player={player} 
            matches={matches}
            matchesLoading={false}
            selectedLeague={selectedLeague}
          />
        );
      case "matching":
        return <MatchingTab />;
      case "schedule":
      case "calendar":
        return (
          <div className="space-y-6">
            <MatchInvitesList />
            <ScheduleTab 
              player={player} 
              matches={matches} 
              matchesLoading={false}
              preSelectedOpponent={selectedOpponent}
              onClearOpponent={() => setSelectedOpponent(null)}
            />
          </div>
        );
      case "profile":
        return <ProfileTab player={player} />;
      case "register":
        return <RegisterTab />;
      case "my-leagues":
        return <MyLeaguesTab 
          player={player} 
          registrations={registrations}
          onNavigateToSchedule={(opponentId, opponentName) => {
            setSelectedOpponent({ id: opponentId, name: opponentName });
            setActiveTab('schedule');
          }}
        />;
      case "my-divisions":
        return <MyDivisionsTab />;
      case "notifications":
        return <NotificationsTab />;
      case "notification-settings":
        return <NotificationSettingsTab />;
      case "cancellation-history":
        return <CancellationHistoryTab />;
      case "competition":
        return (
          <CompetitionTab
            leaderboard={leaderboard} 
            player={player}
            leaderboardLoading={leaderboardLoading}
            selectedLeague={selectedLeague}
          />
        );
      default:
        return (
          <OverviewTab 
            player={player} 
            matches={matches} 
            leaderboard={leaderboard}
            selectedLeague={selectedLeague}
            setSelectedLeague={setSelectedLeague}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <ReminderNotifications />
      <div className="fixed top-24 right-8 z-50 max-w-md">
        <NotificationPermissionPrompt />
      </div>
      <div className="flex pt-20">
        <DashboardSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <div className="flex-1 ml-64">
          <div className="p-8">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
