import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Settings, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ScheduleSettings {
  start_hour: number;
  end_hour: number;
  buffer_minutes: number;
}

interface AvailabilitySettingsProps {
  onSettingsChange?: (settings: ScheduleSettings) => void;
}

export const AvailabilitySettings = ({ onSettingsChange }: AvailabilitySettingsProps) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ScheduleSettings>({
    start_hour: 6,
    end_hour: 22,
    buffer_minutes: 0,
  });

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('user_schedule_settings' as any)
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        const settings = {
          start_hour: (data as any).start_hour as number,
          end_hour: (data as any).end_hour as number,
          buffer_minutes: (data as any).buffer_minutes as number,
        };
        setSettings(settings);
        onSettingsChange?.(settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleSaveSettings = async () => {
    if (settings.start_hour >= settings.end_hour) {
      toast.error('End hour must be after start hour');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_schedule_settings' as any)
        .upsert({
          user_id: user?.id,
          start_hour: settings.start_hour,
          end_hour: settings.end_hour,
          buffer_minutes: settings.buffer_minutes,
        });

      if (error) throw error;

      toast.success('Settings saved successfully');
      onSettingsChange?.(settings);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="w-5 h-5" />
          Schedule Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start-hour">Start Hour</Label>
            <select
              id="start-hour"
              value={settings.start_hour}
              onChange={(e) => setSettings({ ...settings, start_hour: parseInt(e.target.value) })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {i.toString().padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="end-hour">End Hour</Label>
            <select
              id="end-hour"
              value={settings.end_hour}
              onChange={(e) => setSettings({ ...settings, end_hour: parseInt(e.target.value) })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {(i + 1).toString().padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="buffer-time">Buffer Time Between Matches (minutes)</Label>
          <Input
            id="buffer-time"
            type="number"
            min="0"
            max="120"
            step="15"
            value={settings.buffer_minutes}
            onChange={(e) => setSettings({ ...settings, buffer_minutes: parseInt(e.target.value) || 0 })}
          />
          <p className="text-xs text-muted-foreground">
            Automatically adds a break between consecutive matches for rest and travel
          </p>
        </div>

        <Button onClick={handleSaveSettings} className="w-full">
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
};
