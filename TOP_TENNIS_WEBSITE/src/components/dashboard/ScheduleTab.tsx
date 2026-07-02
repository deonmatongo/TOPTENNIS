import React from "react";
import { CalendarScheduleView } from "@/components/schedule/CalendarScheduleView";
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
  preSelectedOpponent = null,
  onClearOpponent 
}) => {
  // New calendar-style view with all functionality integrated
  return (
    <CalendarScheduleView 
      preSelectedOpponent={preSelectedOpponent}
      onClearOpponent={onClearOpponent}
    />
  );
};

export default ScheduleTab;