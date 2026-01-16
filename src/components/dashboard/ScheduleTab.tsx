import React, { useState } from "react";
import { ScheduleDashboard } from "@/components/schedule/ScheduleDashboard";
import { AvailableSlotsPage } from "@/components/schedule/AvailableSlotsPage";
import { ScheduledMatchesPage } from "@/components/schedule/ScheduledMatchesPage";
import { PendingInvitesPage } from "@/components/schedule/PendingInvitesPage";
import { Tables } from "@/integrations/supabase/types";
import type { Match } from "@/hooks/useMatches";

interface ScheduleTabProps {
  player?: Tables<'players'> | null;
  matches?: Match[];
  matchesLoading?: boolean;
}

const ScheduleTab: React.FC<ScheduleTabProps> = ({ matches = [] }) => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'slots' | 'matches' | 'invites'>('dashboard');

  const handleNavigate = (view: 'slots' | 'matches' | 'invites') => {
    setCurrentView(view);
  };

  const handleBack = () => {
    setCurrentView('dashboard');
  };

  if (currentView === 'slots') {
    return <AvailableSlotsPage onBack={handleBack} />;
  }

  if (currentView === 'matches') {
    return <ScheduledMatchesPage onBack={handleBack} />;
  }

  if (currentView === 'invites') {
    return <PendingInvitesPage onBack={handleBack} />;
  }

  return <ScheduleDashboard matches={matches} onNavigate={handleNavigate} />;
};

export default ScheduleTab;