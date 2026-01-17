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
  preSelectedOpponent?: {id?: string, name?: string} | null;
  onClearOpponent?: () => void;
}

const ScheduleTab: React.FC<ScheduleTabProps> = ({ 
  matches = [], 
  preSelectedOpponent = null,
  onClearOpponent 
}) => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'slots' | 'matches' | 'invites'>('dashboard');

  const handleNavigate = (view: 'slots' | 'matches' | 'invites') => {
    setCurrentView(view);
  };

  const handleBack = () => {
    setCurrentView('dashboard');
    if (onClearOpponent) {
      onClearOpponent();
    }
  };

  // Auto-navigate to slots view when opponent is pre-selected
  React.useEffect(() => {
    if (preSelectedOpponent && preSelectedOpponent.name) {
      setCurrentView('slots');
    }
  }, [preSelectedOpponent]);

  if (currentView === 'slots') {
    return <AvailableSlotsPage 
      onBack={handleBack} 
      preSelectedOpponent={preSelectedOpponent}
    />;
  }

  if (currentView === 'matches') {
    return <ScheduledMatchesPage onBack={handleBack} />;
  }

  if (currentView === 'invites') {
    return <PendingInvitesPage onBack={handleBack} />;
  }

  return <ScheduleDashboard 
    matches={matches} 
    onNavigate={handleNavigate}
    preSelectedOpponent={preSelectedOpponent}
  />;
};

export default ScheduleTab;