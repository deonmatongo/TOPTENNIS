import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Bell, Clock, Volume2, Mail, Monitor } from 'lucide-react';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const NotificationSettingsTab: React.FC = () => {
  const { settings, loading, updateSettings } = useNotificationSettings();
  const { permission, requestPermission } = useBrowserNotifications();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-destructive">Error loading settings</div>
      </div>
    );
  }

  const handleToggle = (key: string, value: boolean) => {
    updateSettings({ [key]: value } as any);
  };

  return (
    <div className="space-y-6">
      {/* Browser Permission Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Browser Notifications
              </CardTitle>
              <CardDescription>
                System-level notification permission
              </CardDescription>
            </div>
            <Badge variant={permission === 'granted' ? 'default' : 'destructive'}>
              {permission}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {permission === 'default' && (
            <Button onClick={requestPermission}>
              <Bell className="h-4 w-4 mr-2" />
              Enable Browser Notifications
            </Button>
          )}
          {permission === 'denied' && (
            <p className="text-sm text-muted-foreground">
              Browser notifications are blocked. Please enable them in your browser settings.
            </p>
          )}
          {permission === 'granted' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="respect-focus">Only notify when tab is not focused</Label>
                <Switch
                  id="respect-focus"
                  checked={settings.respect_tab_focus}
                  onCheckedChange={(checked) => handleToggle('respect_tab_focus', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="group-notifications">Group similar notifications</Label>
                <Switch
                  id="group-notifications"
                  checked={settings.group_similar_notifications}
                  onCheckedChange={(checked) => handleToggle('group_similar_notifications', checked)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Types
          </CardTitle>
          <CardDescription>
            Choose which types of notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="match-invites">Match Invites</Label>
            <Switch
              id="match-invites"
              checked={settings.enable_match_invites}
              onCheckedChange={(checked) => handleToggle('enable_match_invites', checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <Label htmlFor="match-accepted">Match Accepted</Label>
            <Switch
              id="match-accepted"
              checked={settings.enable_match_accepted}
              onCheckedChange={(checked) => handleToggle('enable_match_accepted', checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <Label htmlFor="match-declined">Match Declined</Label>
            <Switch
              id="match-declined"
              checked={settings.enable_match_declined}
              onCheckedChange={(checked) => handleToggle('enable_match_declined', checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <Label htmlFor="match-rescheduled">Match Rescheduled</Label>
            <Switch
              id="match-rescheduled"
              checked={settings.enable_match_rescheduled}
              onCheckedChange={(checked) => handleToggle('enable_match_rescheduled', checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <Label htmlFor="friend-requests">Friend Requests</Label>
            <Switch
              id="friend-requests"
              checked={settings.enable_friend_requests}
              onCheckedChange={(checked) => handleToggle('enable_friend_requests', checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <Label htmlFor="league-updates">League Updates</Label>
            <Switch
              id="league-updates"
              checked={settings.enable_league_updates}
              onCheckedChange={(checked) => handleToggle('enable_league_updates', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>
            Set times when you don't want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="quiet-hours">Enable Quiet Hours</Label>
            <Switch
              id="quiet-hours"
              checked={settings.quiet_hours_enabled}
              onCheckedChange={(checked) => handleToggle('quiet_hours_enabled', checked)}
            />
          </div>
          {settings.quiet_hours_enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quiet-start">Start Time</Label>
                <Input
                  id="quiet-start"
                  type="time"
                  value={settings.quiet_hours_start}
                  onChange={(e) => updateSettings({ quiet_hours_start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quiet-end">End Time</Label>
                <Input
                  id="quiet-end"
                  type="time"
                  value={settings.quiet_hours_end}
                  onChange={(e) => updateSettings({ quiet_hours_end: e.target.value })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Sound */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Notification Sound
          </CardTitle>
          <CardDescription>
            Choose the sound for notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={settings.notification_sound}
            onValueChange={(value) => updateSettings({ notification_sound: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="ding">Ding</SelectItem>
              <SelectItem value="chime">Chime</SelectItem>
              <SelectItem value="none">None (Silent)</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Email Notifications (Future) */}
      <Card className="opacity-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notifications
            <Badge variant="outline">Coming Soon</Badge>
          </CardTitle>
          <CardDescription>
            Receive notification digests via email
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Email notifications will be available in a future update
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
