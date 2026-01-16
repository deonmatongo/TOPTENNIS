import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, Users, UserPlus, Clock } from 'lucide-react';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export const FriendsTab = () => {
  const { requests, loading, updateRequestStatus, getPendingRequestsCount } = useFriendRequests();
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('requests');

  const handleRequestResponse = async (requestId: string, status: 'accepted' | 'declined') => {
    try {
      await updateRequestStatus(requestId, status);
      toast({
        title: status === 'accepted' ? 'Friend request accepted' : 'Friend request declined',
        description: `You have ${status} the friend request.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update friend request',
        variant: 'destructive',
      });
    }
  };

  // Filter requests that were received by the current user and are pending
  const pendingRequests = requests.filter(req => 
    req.status === 'pending' && req.receiver_id === user?.id
  );
  
  // Filter requests that were sent by the current user and are pending
  const sentRequests = requests.filter(req => 
    req.status === 'pending' && req.sender_id === user?.id
  );
  
  // Filter accepted friend requests
  const friends = requests.filter(req => req.status === 'accepted');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading friends...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Friends & Requests</h2>
        <Badge variant="secondary" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          {friends.length} Friends
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Requests
            {getPendingRequestsCount() > 0 && (
              <Badge variant="destructive" className="ml-1">
                {getPendingRequestsCount()}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="friends" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Friends
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Sent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Friend Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending friend requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Avatar>
                          {request.sender?.profile_picture_url ? (
                            <AvatarImage 
                              src={request.sender.profile_picture_url} 
                              alt={request.sender.name || 'User'}
                            />
                          ) : null}
                          <AvatarFallback>
                            {request.sender?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{request.sender?.name || 'Unknown User'}</p>
                          <p className="text-sm text-muted-foreground">{request.sender?.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(request.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleRequestResponse(request.id, 'accepted')}
                          className="bg-success hover:bg-success/90"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRequestResponse(request.id, 'declined')}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="friends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Friends</CardTitle>
            </CardHeader>
            <CardContent>
              {friends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No friends yet</p>
                  <p className="text-sm">Start by sending friend requests to other players!</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {friends.map((friend) => {
                    // Determine which user is the friend (not the current user)
                    const friendData = friend.sender_id === user?.id ? friend.receiver : friend.sender;
                    return (
                      <div key={friend.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                        <Avatar>
                          {friendData?.profile_picture_url ? (
                            <AvatarImage 
                              src={friendData.profile_picture_url} 
                              alt={friendData.name || 'User'}
                            />
                          ) : null}
                          <AvatarFallback>
                            {friendData?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium">{friendData?.name || 'Unknown User'}</p>
                          <p className="text-sm text-muted-foreground">{friendData?.email}</p>
                        </div>
                        <Badge variant="secondary">Friend</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sent Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {sentRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No sent requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sentRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Avatar>
                          {request.receiver?.profile_picture_url ? (
                            <AvatarImage 
                              src={request.receiver.profile_picture_url} 
                              alt={request.receiver.name || 'User'}
                            />
                          ) : null}
                          <AvatarFallback>
                            {request.receiver?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{request.receiver?.name || 'Unknown User'}</p>
                          <p className="text-sm text-muted-foreground">{request.receiver?.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Sent {new Date(request.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">Pending</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};