import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, Send, Loader2 } from 'lucide-react';
import { useMessages } from '@/hooks/useMessages';
import { toast } from 'sonner';
import { SearchResult } from '@/hooks/usePlayerSearch';
import { supabase } from '@/integrations/supabase/client';

interface SendMessageModalProps {
  player: SearchResult | null;
  isOpen: boolean;
  onClose: () => void;
}

const SendMessageModal = ({ player, isOpen, onClose }: SendMessageModalProps) => {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const { sendMessage } = useMessages();

  const handleSend = async () => {
    if (!player || !content.trim()) {
      toast.error('Please enter a message');
      return;
    }

    try {
      setSending(true);
      
      // First, get the user_id for this player
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('user_id')
        .eq('id', player.id)
        .single();

      if (playerError || !playerData?.user_id) {
        throw new Error('Could not find player user ID');
      }

      await sendMessage(playerData.user_id, subject, content);
      toast.success(`Message sent to ${player.name}!`);
      
      // Reset form and close modal
      setSubject('');
      setContent('');
      onClose();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSubject('');
    setContent('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Mail className="w-5 h-5 text-primary" />
            <span>Send Message</span>
          </DialogTitle>
          <DialogDescription>
            Send a message to {player?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient */}
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm">
                {player?.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-foreground">{player?.name}</p>
                <p className="text-sm text-muted-foreground">{player?.email}</p>
              </div>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject (optional)</Label>
            <Input
              id="subject"
              placeholder="Match invitation, question about tennis..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              placeholder="Hi! I'd love to play a match with you. Are you available this weekend?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {content.length}/500 characters
            </p>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              className="flex-1"
              disabled={sending || !content.trim()}
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendMessageModal;