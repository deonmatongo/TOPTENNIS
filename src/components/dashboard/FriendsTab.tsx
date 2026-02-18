import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Check, X, Users, UserPlus, Clock, Ban, UserMinus, Shield, ShieldOff } from 'lucide-react';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export const FriendsTab = () => {
  const { requests, loading, updateRequestStatus, getPendingRequestsCount } = useFriendRequests();
  const { blockedUsers, blockUser, unblockUser, unfriendUser } = useBlockedUsers();
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('requests');
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [unfriendDialogOpen, setUnfriendDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [blockReason, setBlockReason] = useState('');

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

  const handleBlockUser = async () => {
    if (!selectedUser) return;
    
    try {
      await blockUser(selectedUser.id, blockReason);
      setBlockDialogOpen(false);
      setBlockReason('');
      setSelectedUser(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to block user',
        variant: 'destructive',
      });
    }
  };

  const handleUnblockUser = async (userId: string) => {
    try {
      await unblockUser(userId);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to unblock user',
        variant: 'destructive',
      });
    }
  };

  const handleUnfriendUser = async () => {
    if (!selectedUser) return;
    
    try {
      await unfriendUser(selectedUser.id);
      setUnfriendDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove friend',
        variant: 'destructive',
      });
    }
  };

  const openBlockDialog = (user: any) => {
    setSelectedUser(user);
    setBlockDialogOpen(true);
  };

  const openUnfriendDialog = (user: any) => {
    setSelectedUser(user);
    setUnfriendDialogOpen(true);
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
        <TabsList className="grid w-full grid-cols-4">
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
          <TabsTrigger value="blocked" className="flex items-center gap-2">
            <Ban className="h-4 w-4" />
            Blocked
            {blockedUsers.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {blockedUsers.length}
              </Badge>
            )}
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
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openBlockDialog(friendData)}
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            <Ban className="h-4 w-4 mr-1" />
                            Block
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openUnfriendDialog(friendData)}
                            className="text-orange-600 border-orange-300 hover:bg-orange-50"
                          >
                            <UserMinus className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocked" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Blocked Users</CardTitle>
            </CardHeader>
            <CardContent>
              {blockedUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShieldOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No blocked users</p>
                  <p className="text-sm">Users you block won't be able to contact you or see your profile.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {blockedUsers.map((blockedUser) => (
                    <div key={blockedUser.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Avatar>
                          {blockedUser.blocked_user_profile_picture ? (
                            <AvatarImage 
                              src={blockedUser.blocked_user_profile_picture} 
                              alt={blockedUser.blocked_user_name || 'User'}
                            />
                          ) : null}
                          <AvatarFallback>
                            <ShieldOff className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{blockedUser.blocked_user_name || 'Unknown User'}</p>
                          <p className="text-sm text-muted-foreground">{blockedUser.blocked_user_email}</p>
                          {blockedUser.reason && (
                            <p className="text-xs text-muted-foreground italic">Reason: {blockedUser.reason}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Blocked {new Date(blockedUser.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUnblockUser(blockedUser.blocked_user_id)}
                        className="text-green-600 border-green-300 hover:bg-green-50"
                      >
                        <Shield className="h-4 w-4 mr-1" />
                        Unblock
                      </Button>
                    </div>
                  ))}
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

      {/* Block User Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Block User</DialogTitle>
            <DialogDescription>
              This will prevent {selectedUser?.name || 'this user'} from contacting you or seeing your profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="block-reason">Reason (optional)</Label>
              <Textarea
                id="block-reason"
                placeholder="Why are you blocking this user?"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBlockDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBlockUser}
              className="bg-red-600 hover:bg-red-700"
            >
              <Ban className="h-4 w-4 mr-2" />
              Block User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unfriend Dialog */}
      <Dialog open={unfriendDialogOpen} onOpenChange={setUnfriendDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Friend</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedUser?.name || 'this user'} from your friends?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUnfriendDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnfriendUser}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <UserMinus className="h-4 w-4 mr-2" />
              Remove Friend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};