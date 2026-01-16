import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MessageCircle, Search, Send, Plus, Filter, Clock, Check, CheckCheck, Reply, X, Users, Mail, Eye, EyeOff } from 'lucide-react';
import { useMessages, Message } from '@/hooks/useMessages';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { toast } from 'sonner';
import PlayerSearch from './PlayerSearch';
import { SearchResult } from '@/hooks/usePlayerSearch';
import SendMessageModal from './SendMessageModal';
interface Conversation {
  otherUserId: string;
  otherUser: {
    name: string;
    email: string;
    profile_picture_url?: string;
  };
  messages: Message[];
  lastMessage: Message;
  unreadCount: number;
}
const MessagesTab = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [sending, setSending] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<SearchResult | null>(null);
  const [showPlayerSearch, setShowPlayerSearch] = useState(false);
  const {
    messages,
    loading,
    markAsRead,
    getUnreadCount,
    sendMessage
  } = useMessages();
  const {
    user
  } = useAuth();

  // Group messages into conversations
  const conversations: Conversation[] = useMemo(() => {
    if (!user || !messages.length) return [];
    const conversationMap = new Map<string, Conversation>();
    messages.forEach(message => {
      const isReceived = message.receiver_id === user.id;
      const otherUserId = isReceived ? message.sender_id : message.receiver_id;
      const otherUser = isReceived ? message.sender : message.receiver;
      if (!otherUser) return;
      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          otherUserId,
          otherUser,
          messages: [],
          lastMessage: message,
          unreadCount: 0
        });
      }
      const conversation = conversationMap.get(otherUserId)!;
      conversation.messages.push(message);

      // Update last message if this one is more recent
      if (new Date(message.created_at) > new Date(conversation.lastMessage.created_at)) {
        conversation.lastMessage = message;
      }

      // Count unread messages
      if (isReceived && !message.read) {
        conversation.unreadCount++;
      }
    });

    // Sort conversations by last message date
    return Array.from(conversationMap.values()).sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime());
  }, [messages, user]);

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conversation => {
    const searchLower = searchTerm.toLowerCase();
    return conversation.otherUser.name.toLowerCase().includes(searchLower) || conversation.otherUser.email.toLowerCase().includes(searchLower) || conversation.messages.some(msg => msg.content.toLowerCase().includes(searchLower) || msg.subject && msg.subject.toLowerCase().includes(searchLower));
  });
  const selectedConversationData = conversations.find(c => c.otherUserId === selectedConversation);
  const handleConversationClick = (conversation: Conversation) => {
    setSelectedConversation(conversation.otherUserId);
    setShowReplyForm(false);
    setReplyContent('');

    // Mark unread messages as read
    conversation.messages.filter(msg => msg.receiver_id === user?.id && !msg.read).forEach(msg => markAsRead(msg.id));
  };
  const handleSendReply = async () => {
    if (!selectedConversationData || !replyContent.trim()) return;
    try {
      setSending(true);
      await sendMessage(selectedConversationData.otherUserId, '', replyContent);
      setReplyContent('');
      setShowReplyForm(false);
      toast.success('Message sent!');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };
  const handlePlayerSelect = (player: SearchResult) => {
    setSelectedPlayer(player);
    setShowComposeModal(true);
    setShowPlayerSearch(false);
  };
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM d');
    }
  };
  if (loading) {
    return <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading conversations...</p>
        </div>
      </div>;
  }
  return <div className="h-[calc(100vh-200px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center space-x-3">
          <MessageCircle className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold text-foreground">Messages</h2>
            <p className="text-sm text-muted-foreground">
              {getUnreadCount()} unread messages
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" onClick={() => setShowPlayerSearch(!showPlayerSearch)} className="flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Message</span>
          </Button>
        </div>
      </div>

      {/* Player Search */}
      {showPlayerSearch && <Card className="m-4 mb-0">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Find a player to message</span>
            </div>
            <PlayerSearch onPlayerSelect={handlePlayerSelect} placeholder="Search for players..." />
          </CardContent>
        </Card>}

      <div className="flex-1 flex overflow-hidden">
        {/* Conversations List */}
        <div className="w-full lg:w-80 border-r bg-muted/30">
          {/* Search */}
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input placeholder="Search conversations..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 bg-background" />
            </div>
          </div>

          {/* Conversations */}
          <ScrollArea className="flex-1">
            <div className="space-y-1 px-2 pb-4">
              {filteredConversations.length === 0 ? <div className="text-center py-8 px-4">
                  <MessageCircle className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {conversations.length === 0 ? 'No conversations yet' : 'No matches found'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Start a new conversation to connect with players
                  </p>
                </div> : filteredConversations.map(conversation => <div key={conversation.otherUserId} className={`p-3 rounded-lg cursor-pointer transition-all hover:bg-accent/50 ${selectedConversation === conversation.otherUserId ? 'bg-primary/10 border border-primary/20' : 'hover:bg-accent/30'}`} onClick={() => handleConversationClick(conversation)}>
                    <div className="flex items-center space-x-3">
                       <div className="relative">
                         <Avatar className="h-10 w-10">
                           {conversation.otherUser.profile_picture_url ? <AvatarImage src={conversation.otherUser.profile_picture_url} alt={conversation.otherUser.name} /> : null}
                           <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold">
                             {conversation.otherUser.name.charAt(0).toUpperCase()}
                           </AvatarFallback>
                         </Avatar>
                        {conversation.unreadCount > 0 && <div className="absolute -top-1 -right-1 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-primary-foreground">
                              {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                            </span>
                          </div>}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className={`text-sm truncate ${conversation.unreadCount > 0 ? 'font-semibold' : 'font-medium'}`}>
                            {conversation.otherUser.name}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(conversation.lastMessage.created_at)}
                          </span>
                        </div>
                        
                        <p className="text-xs text-muted-foreground truncate">
                          {conversation.lastMessage.receiver_id === user?.id ? '' : 'You: '}
                          {conversation.lastMessage.content}
                        </p>
                      </div>
                    </div>
                  </div>)}
            </div>
          </ScrollArea>
        </div>

        {/* Conversation View */}
        <div className="flex-1 flex flex-col">
          {selectedConversationData ? <>
              {/* Conversation Header */}
              <div className="p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                 <div className="flex items-center space-x-3">
                   <Avatar className="h-10 w-10">
                     {selectedConversationData.otherUser.profile_picture_url ? <AvatarImage src={selectedConversationData.otherUser.profile_picture_url} alt={selectedConversationData.otherUser.name} /> : null}
                     <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold">
                       {selectedConversationData.otherUser.name.charAt(0).toUpperCase()}
                     </AvatarFallback>
                   </Avatar>
                  <div>
                    <p className="font-semibold">{selectedConversationData.otherUser.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedConversationData.otherUser.email}</p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {selectedConversationData.messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(message => {
                const isOwnMessage = message.sender_id === user?.id;
                return <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${isOwnMessage ? 'bg-primary text-primary-foreground ml-12' : 'bg-muted mr-12'}`}>
                            {message.subject && <p className={`text-xs font-medium mb-1 ${isOwnMessage ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                {message.subject}
                              </p>}
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            <div className={`flex items-center justify-between mt-1 text-xs ${isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              <span>{format(new Date(message.created_at), 'HH:mm')}</span>
                              {isOwnMessage && <div className="flex items-center space-x-1">
                                  {message.read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                                </div>}
                            </div>
                          </div>
                        </div>;
              })}
                </div>
              </ScrollArea>

              {/* Reply Form */}
              <div className="p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-end space-x-2">
                  <div className="flex-1">
                    <Textarea value={replyContent} onChange={e => setReplyContent(e.target.value)} placeholder={`Message ${selectedConversationData.otherUser.name}...`} rows={1} className="min-h-[40px] max-h-32 resize-none" onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (replyContent.trim()) {
                      handleSendReply();
                    }
                  }
                }} />
                  </div>
                  <Button onClick={handleSendReply} disabled={!replyContent.trim() || sending} size="sm" className="px-3 py-2 h-10">
                    {sending ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </> : <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <MessageCircle className="w-16 h-16 text-muted-foreground/30 mx-auto" />
                <div>
                  <p className="text-lg font-medium text-muted-foreground">Select a conversation</p>
                  <p className="text-sm text-muted-foreground">
                    Choose a conversation from the sidebar or start a new one
                  </p>
                </div>
                
              </div>
            </div>}
        </div>
      </div>

      {/* Send Message Modal */}
      <SendMessageModal player={selectedPlayer} isOpen={showComposeModal} onClose={() => {
      setShowComposeModal(false);
      setSelectedPlayer(null);
    }} />
    </div>;
};
export default MessagesTab;