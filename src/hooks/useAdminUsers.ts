
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type AdminUser = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  profile_created_at: string;
  profile_completed: boolean;
  membership_id: string;
  roles: string[];
};
type AppRole = 'admin' | 'moderator' | 'user';

export const useAdminUsers = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_profiles_view')
        .select('*')
        .order('profile_created_at', { ascending: false });

      if (error) {
        setError(error.message);
        return;
      }

      setUsers(data as AdminUser[] || []);
    } catch (err) {
      setError('Failed to fetch users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, role: AppRole, action: 'add' | 'remove') => {
    try {
      if (action === 'add') {
        const { error } = await supabase
          .from('user_roles')
          .insert({ 
            user_id: userId, 
            role: role as AppRole 
          });
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', role as AppRole);
        
        if (error) throw error;
      }

      await fetchUsers(); // Refresh the users list
    } catch (err) {
      console.error('Error updating user role:', err);
      throw err;
    }
  };

  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .eq('id', userId);

      if (error) throw error;
      
      await fetchUsers(); // Refresh the users list
    } catch (err) {
      console.error('Error updating user status:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
    updateUserRole,
    toggleUserStatus
  };
};
