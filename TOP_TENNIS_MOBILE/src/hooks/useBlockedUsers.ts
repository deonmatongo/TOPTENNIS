import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { captureError } from '@/services/sentry';

export interface BlockedUser {
  id: string;
  blocker_id: string;
  blocked_user_id: string;
  reason?: string | null;
  created_at: string;
  blocked_user_name?: string;
  blocked_user_email?: string;
  blocked_user_profile_picture?: string;
}

export const useBlockedUsers = () => {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBlockedUsers = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await (supabase as any).rpc('get_blocked_users', { p_user_id: user.id });
      if (error) {
        // RPC may not exist yet — silently return empty
        if (error.code === 'PGRST202' || error.message?.includes('does not exist') || error.message?.includes('function')) {
          setBlockedUsers([]);
          return;
        }
        throw error;
      }
      setBlockedUsers(data || []);
    } catch (err) {
      captureError(err);
      if (__DEV__) console.error('useBlockedUsers fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const blockUser = async (userIdToBlock: string): Promise<boolean> => {
    if (!user || user.id === userIdToBlock) return false;
    try {
      const { error } = await (supabase as any).rpc('block_user', {
        p_blocked_user_id: userIdToBlock,
        p_reason: null,
      });
      if (error) throw error;
      await fetchBlockedUsers();
      return true;
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to block user');
      return false;
    }
  };

  const unblockUser = async (blockedUserId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const { error } = await (supabase as any).rpc('unblock_user', {
        p_blocked_user_id: blockedUserId,
      });
      if (error) throw error;
      await fetchBlockedUsers();
      return true;
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to unblock user');
      return false;
    }
  };

  const unfriendUser = async (friendUserId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${friendUserId}),` +
          `and(sender_id.eq.${friendUserId},receiver_id.eq.${user.id})`
        )
        .eq('status', 'accepted');
      if (error) throw error;
      return true;
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to remove friend');
      return false;
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchBlockedUsers();
    const channel = supabase
      .channel('mobile-blocked-users')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'blocked_users',
        filter: `blocker_id=eq.${user.id}`,
      }, fetchBlockedUsers)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return { blockedUsers, loading, blockUser, unblockUser, unfriendUser, refetch: fetchBlockedUsers };
};
