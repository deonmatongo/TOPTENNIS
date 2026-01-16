import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, X } from 'lucide-react';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';

export const NotificationPermissionPrompt: React.FC = () => {
  const [show, setShow] = useState(false);
  const { permission, requestPermission } = useBrowserNotifications();

  useEffect(() => {
    // Show prompt if notifications are supported and permission is default (not asked yet)
    if ('Notification' in window && permission === 'default') {
      // Wait 2 seconds before showing the prompt
      const timer = setTimeout(() => {
        setShow(true);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [permission]);

  const handleEnable = async () => {
    await requestPermission();
    setShow(false);
  };

  const handleDismiss = () => {
    setShow(false);
    // Store dismissal in localStorage
    localStorage.setItem('notification-prompt-dismissed', 'true');
  };

  if (!show || localStorage.getItem('notification-prompt-dismissed')) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5 shadow-lg">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-primary/10 rounded-full">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Enable Notifications</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Get instant alerts for match requests, bookings, and updates even when you're not on the page.
            </p>
            <div className="flex gap-2">
              <Button onClick={handleEnable} size="sm">
                Enable Notifications
              </Button>
              <Button onClick={handleDismiss} variant="ghost" size="sm">
                <X className="w-4 h-4 mr-1" />
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
