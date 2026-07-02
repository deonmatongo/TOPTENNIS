import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

export interface BlockedUser {
  id: string;
  blocker_id: string;
  blocked_user_id: string;
  reason?: string | null;
  created_at: string;
  updated_at: string;
  blocked_user_name?: string;
  blocked_user_email?: string;
  blocked_user_profile_picture?: string;
}

export const useBlockedUsers = () => {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchBlockedUsers = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Use RPC function to get blocked users with profile data
      const { data, error } = await (supabase as any).rpc('get_blocked_users', {
        p_user_id: user.id
      });

      if (error) {
        // If the RPC doesn't exist yet, silently return empty — don't toast
        if ((error as any).code === 'PGRST202' || error.message?.includes('function') || error.message?.includes('does not exist')) {
          setBlockedUsers([]);
          return;
        }
        throw error;
      }

      setBlockedUsers(data || []);
    } catch (err) {
      logger.error('Error fetching blocked users', { err });
      setError('Failed to fetch blocked users');
    } finally {
      setLoading(false);
    }
  };

  const blockUser = async (userIdToBlock: string, reason?: string) => {
    if (!user) {
      toast.error('You must be logged in to block users');
      return false;
    }

    if (user.id === userIdToBlock) {
      toast.error('You cannot block yourself');
      return false;
    }

    try {
      const { error } = await (supabase as any).rpc('block_user', {
        p_blocked_user_id: userIdToBlock,
        p_reason: reason || null
      });

      if (error) {
        if (error.message?.includes('already blocked')) {
          toast.error('This user is already blocked');
          return false;
        }
        throw error;
      }

      await fetchBlockedUsers();
      toast.success('User blocked successfully');
      return true;
    } catch (err) {
      logger.error('Error blocking user', { err });
      toast.error('Failed to block user');
      return false;
    }
  };

  const unblockUser = async (blockedUserId: string) => {
    if (!user) {
      toast.error('You must be logged in to unblock users');
      return false;
    }

    try {
      const { error } = await (supabase as any).rpc('unblock_user', {
        p_blocked_user_id: blockedUserId
      });

      if (error) throw error;

      await fetchBlockedUsers();
      toast.success('User unblocked successfully');
      return true;
    } catch (err) {
      logger.error('Error unblocking user', { err });
      toast.error('Failed to unblock user');
      return false;
    }
  };

  const isUserBlocked = async (userIdToCheck: string) => {
    if (!user) return false;

    try {
      const { data, error } = await (supabase as any).rpc('is_user_blocked', {
        p_blocker_id: user.id,
        p_blocked_user_id: userIdToCheck
      });

      return !error && !!data;
    } catch (err) {
      logger.error('Error checking if user is blocked', { err });
      return false;
    }
  };

  const unfriendUser = async (friendUserId: string) => {
    if (!user) {
      toast.error('You must be logged in to unfriend users');
      return false;
    }

    try {
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendUserId}),and(sender_id.eq.${friendUserId},receiver_id.eq.${user.id})`)
        .eq('status', 'accepted');

      if (error) throw error;

      toast.success('Friend removed successfully');
      return true;
    } catch (err) {
      logger.error('Error unfriending user', { err });
      toast.error('Failed to remove friend');
      return false;
    }
  };

  useEffect(() => {
    if (user) {
      fetchBlockedUsers();

      // Set up real-time subscription
      const channel = supabase
        .channel('blocked-users-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'blocked_users',
            filter: `blocker_id=eq.${user.id}`
          },
          () => {
            fetchBlockedUsers();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  return {
    blockedUsers,
    loading,
    error,
    blockUser,
    unblockUser,
    isUserBlocked,
    unfriendUser,
    refetch: fetchBlockedUsers
  };
};
