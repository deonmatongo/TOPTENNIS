
import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveTable, ResponsiveTableColumn } from '@/components/ui/responsive-table';
import { useResponsiveTable } from '@/hooks/useResponsiveTable';
import { toast } from 'sonner';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { format } from 'date-fns';
import { Shield, ShieldCheck, User, Clock, Mail, Calendar } from 'lucide-react';

type AppRole = 'admin' | 'moderator' | 'user';

const UserManagementTable = () => {
  const { users, loading, updateUserRole, toggleUserStatus } = useAdminUsers();
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, newRole: string, currentRoles: string[]) => {
    setUpdatingUser(userId);
    try {
      const typedNewRole = newRole as AppRole;
      // Remove existing roles (except 'user' which is default)
      const rolesToRemove = currentRoles.filter(role => role !== 'user' && role !== newRole);
      
      for (const role of rolesToRemove) {
        await updateUserRole(userId, role as AppRole, 'remove');
      }

      // Add new role if it's not 'user'
      if (typedNewRole !== 'user' && !currentRoles.includes(typedNewRole)) {
        await updateUserRole(userId, typedNewRole, 'add');
      }

      toast.success('User role updated successfully');
    } catch (error) {
      toast.error('Failed to update user role');
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: boolean) => {
    setUpdatingUser(userId);
    try {
      await toggleUserStatus(userId, !currentStatus);
      toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      toast.error('Failed to update user status');
    } finally {
      setUpdatingUser(null);
    }
  };

  const getRoleIcon = (roles: string[]) => {
    if (roles.includes('admin')) return <ShieldCheck className="w-4 h-4 text-red-600" />;
    if (roles.includes('moderator')) return <Shield className="w-4 h-4 text-blue-600" />;
    return <User className="w-4 h-4 text-gray-600" />;
  };

  const getHighestRole = (roles: string[]) => {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('moderator')) return 'moderator';
    return 'user';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-8">
          <div className="text-center">
            <div className="w-6 h-6 sm:w-8 sm:h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm sm:text-base text-gray-600">Loading users...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { data: sortedUsers, sortConfig, handleSort } = useResponsiveTable({
    data: users,
    defaultSort: { key: 'created', direction: 'desc' }
  });

  const columns: ResponsiveTableColumn<any>[] = [
    {
      key: 'user',
      label: 'User',
      render: (_, user) => (
        <div className="flex items-center gap-2">
          {getRoleIcon(user.roles || [])}
          <div className="min-w-0">
            <p className="font-medium text-xs sm:text-sm truncate">
              {user.first_name && user.last_name 
                ? `${user.first_name} ${user.last_name}`
                : 'No name set'
              }
            </p>
            <p className="text-xs text-gray-500 truncate">ID: {user.id?.slice(0, 8)}...</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      hideOn: 'mobile',
      render: (_, user) => (
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-xs sm:text-sm truncate">{user.email}</span>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (_, user) => (
        <Select
          value={getHighestRole(user.roles || [])}
          onValueChange={(newRole) => handleRoleChange(user.id!, newRole, user.roles || [])}
          disabled={updatingUser === user.id}
        >
          <SelectTrigger className="w-20 sm:w-32 h-8 text-xs sm:text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="moderator">Moderator</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, user) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={user.is_active ?? true}
            onCheckedChange={() => handleStatusToggle(user.id!, user.is_active ?? true)}
            disabled={updatingUser === user.id}
            className="scale-75 sm:scale-100"
          />
          <Badge variant={user.is_active ? 'default' : 'secondary'} className="text-xs hidden sm:inline-flex">
            {user.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'created',
      label: 'Created',
      sortable: true,
      hideOn: 'tablet',
      render: (_, user) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-xs sm:text-sm">
            {user.profile_created_at 
              ? format(new Date(user.profile_created_at), 'MMM dd, yyyy')
              : 'Unknown'
            }
          </span>
        </div>
      ),
    },
    {
      key: 'lastLogin',
      label: 'Last Login',
      hideOn: 'mobile-tablet',
      render: (_, user) => (
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-xs sm:text-sm">
            {user.profile_created_at 
              ? format(new Date(user.profile_created_at), 'MMM dd, yyyy')
              : 'Never'
            }
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, user) => (
        <Button
          variant="outline"
          size="sm"
          disabled={updatingUser === user.id}
          className="text-xs sm:text-sm h-7 sm:h-8"
        >
          {updatingUser === user.id ? 'Updating...' : 'Edit'}
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
          User Management
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 sm:px-6">
        <ResponsiveTable
          data={sortedUsers}
          columns={columns}
          getRowKey={(user) => user.id!}
          loading={loading}
          sortConfig={sortConfig}
          onSort={handleSort}
          emptyMessage="No users found"
          renderExpandedRow={(user) => (
            <div className="space-y-3 p-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="font-medium">Email:</span>
                <span className="text-muted-foreground">{user.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="font-medium">Created:</span>
                <span className="text-muted-foreground">
                  {user.profile_created_at 
                    ? format(new Date(user.profile_created_at), 'MMM dd, yyyy')
                    : 'Unknown'
                  }
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="font-medium">Last Login:</span>
                <span className="text-muted-foreground">
                  {user.profile_created_at 
                    ? format(new Date(user.profile_created_at), 'MMM dd, yyyy')
                    : 'Never'
                  }
                </span>
              </div>
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
};

export default UserManagementTable;
