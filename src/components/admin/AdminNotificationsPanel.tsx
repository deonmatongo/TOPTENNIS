import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Bell, Send, Users, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

interface SentNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
  user_id: string;
}

const NOTIFICATION_TYPES = [
  { value: 'system', label: 'System Announcement' },
  { value: 'match_invite', label: 'Match Update' },
  { value: 'league_update', label: 'League Update' },
  { value: 'achievement', label: 'Achievement' },
  { value: 'info', label: 'Info' },
];

export const AdminNotificationsPanel: React.FC = () => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('system');
  const [target, setTarget] = useState<'all' | 'active'>('all');
  const [sending, setSending] = useState(false);
  const [recentSent, setRecentSent] = useState<SentNotification[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);

  useEffect(() => {
    loadHistory();
    loadUserCounts();
  }, []);

  const loadUserCounts = async () => {
    const { data } = await supabase.from('admin_profiles_view').select('is_active');
    if (data) {
      setTotalUsers(data.length);
      setActiveUsers(data.filter(u => u.is_active).length);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('notifications')
      .select('id, title, message, type, created_at, user_id')
      .eq('type', 'system')
      .order('created_at', { ascending: false })
      .limit(20);
    setRecentSent((data || []) as any);
    setLoadingHistory(false);
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    setSending(true);
    try {
      // Fetch target user IDs
      let query = supabase.from('profiles').select('id');
      if (target === 'active') query = query.eq('is_active', true);
      const { data: profiles } = await query;

      if (!profiles || profiles.length === 0) {
        toast.error('No users found');
        setSending(false);
        return;
      }

      // Insert notifications in batches of 50
      const batch = 50;
      const rows = profiles.map(p => ({
        user_id: p.id,
        title: title.trim(),
        message: message.trim(),
        type: type,
        is_read: false,
      }));

      for (let i = 0; i < rows.length; i += batch) {
        const { error } = await supabase.from('notifications').insert(rows.slice(i, i + batch));
        if (error) throw error;
      }

      toast.success(`Notification sent to ${profiles.length} user${profiles.length !== 1 ? 's' : ''}`);
      setTitle('');
      setMessage('');
      await loadHistory();
    } catch (e: any) {
      toast.error(`Failed to send: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  const recipientCount = target === 'all' ? totalUsers : activeUsers;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Compose */}
      <div className="lg:col-span-3 space-y-4">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="w-4 h-4" />
              Broadcast Notification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTIFICATION_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Send To</Label>
                <Select value={target} onValueChange={v => setTarget(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users ({totalUsers})</SelectItem>
                    <SelectItem value="active">Active Only ({activeUsers})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                placeholder="Notification title…"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground text-right">{title.length}/100</p>
            </div>

            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                placeholder="Write your message to users…"
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">{message.length}/500</p>
            </div>

            {/* Preview */}
            {(title || message) && (
              <div className="border rounded-lg p-4 bg-orange-50 border-orange-200 space-y-1">
                <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Preview</p>
                <p className="font-semibold text-sm">{title || 'Untitled'}</p>
                <p className="text-sm text-muted-foreground">{message || '—'}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                Will reach <strong className="text-foreground">{recipientCount}</strong> user{recipientCount !== 1 ? 's' : ''}
              </div>
              <Button
                onClick={handleSend}
                disabled={sending || !title.trim() || !message.trim()}
                className="gap-2"
              >
                {sending ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Sending…</>
                ) : (
                  <><Send className="w-4 h-4" /> Send Notification</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Recent Broadcasts
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={loadHistory} disabled={loadingHistory}>
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingHistory ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : recentSent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2 px-4">
                <AlertCircle className="w-7 h-7" />
                <p className="text-sm text-center">No system notifications sent yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {recentSent.map(n => (
                  <div key={n.id} className="p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-semibold text-sm truncate">{n.title}</p>
                      <Badge className="text-xs flex-shrink-0 bg-orange-100 text-orange-700 border-orange-200" variant="outline">
                        {n.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(n.created_at), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
