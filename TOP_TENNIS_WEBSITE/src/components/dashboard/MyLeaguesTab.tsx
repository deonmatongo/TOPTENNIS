import React from "react";
import EnhancedMyLeaguesTab from "./EnhancedMyLeaguesTab";

interface MyLeaguesTabProps {
  player: any;
  registrations: any[];
  onNavigateToSchedule?: (opponentId?: string, opponentName?: string) => void;
}

const MyLeaguesTab = ({ player, registrations, onNavigateToSchedule }: MyLeaguesTabProps) => {
  return (
    <EnhancedMyLeaguesTab 
      player={player} 
      registrations={registrations}
      onNavigateToSchedule={onNavigateToSchedule}
    />
  );
};

export default MyLeaguesTab;