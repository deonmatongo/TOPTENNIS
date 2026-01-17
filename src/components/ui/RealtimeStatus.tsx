import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useRealtime } from '@/contexts/RealtimeContext';
import { Wifi, WifiOff } from 'lucide-react';

export const RealtimeStatus: React.FC = () => {
  const { isConnected, lastUpdate } = useRealtime();

  if (!isConnected) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <WifiOff className="h-3 w-3" />
        Offline
      </Badge>
    );
  }

  return (
    <Badge variant="default" className="flex items-center gap-1 bg-green-100 text-green-800 border-green-200">
      <Wifi className="h-3 w-3" />
      Live
      {lastUpdate && (
        <span className="text-xs opacity-75">
          • {new Date(lastUpdate).toLocaleTimeString()}
        </span>
      )}
    </Badge>
  );
};
