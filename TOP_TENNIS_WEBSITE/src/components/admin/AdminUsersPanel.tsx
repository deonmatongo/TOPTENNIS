import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Shield, ShieldCheck, User, Mail, Calendar, Search,
  Filter, RefreshCw, ChevronDown, ChevronUp, Eye, X,
} from 'lucide-react';

type AppRole = 'admin' | 'moderator' | 'user';

const roleColor = (roles: string[]) => {
  if (roles.includes('admin')) return 'bg-red-100 text-red-700 border-red-200';
  if (roles.includes('moderator')) return 'bg-blue-100 text-blue-700 border-blue-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
};

const RoleIcon = ({ roles }: { roles: string[] }) => {
  if (roles.includes('admin')) return <ShieldCheck className="w-4 h-4 text-red-600" />;
  if (roles.includes('moderator')) return <Shield className="w-4 h-4 text-blue-600" />;
  return <User className="w-4 h-4 text-gray-500" />;
};

const getHighestRole = (roles: string[]): AppRole => {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('moderator')) return 'moderator';
  return 'user';
};

export const AdminUsersPanel: React.FC = () => {
  const { users, loading, updateUserRole, toggleUserStatus, refetch } = useAdminUsers();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AppRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortKey, setSortKey] = useState<'name' | 'email' | 'created'>('created');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  const filtered = useMemo(() => {
    let list = [...users];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.membership_id?.toLowerCase().includes(q)
      );
    }

    if (roleFilter !== 'all') {
      list = list.filter(u => getHighestRole(u.roles || []) === roleFilter);
    }

    if (statusFilter === 'active') list = list.filter(u => u.is_active);
    if (statusFilter === 'inactive') list = list.filter(u => !u.is_active);

    list.sort((a, b) => {
      let av = '', bv = '';
      if (sortKey === 'name') { av = `${a.first_name} ${a.last_name}`; bv = `${b.first_name} ${b.last_name}`; }
      else if (sortKey === 'email') { av = a.email || ''; bv = b.email || ''; }
      else { av = a.profile_created_at || ''; bv = b.profile_created_at || ''; }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    return list;
  }, [users, search, roleFilter, statusFilter, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ k }: { k: typeof sortKey }) =>
    sortKey === k
      ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      : <ChevronDown className="w-3 h-3 opacity-30" />;

  const handleRoleChange = async (userId: string, newRole: string, currentRoles: string[]) => {
    setUpdatingUser(userId);
    try {
      const toRemove = currentRoles.filter(r => r !== 'user' && r !== newRole);
      for (const r of toRemove) await updateUserRole(userId, r as AppRole, 'remove');
      if (newRole !== 'user' && !currentRoles.includes(newRole))
        await updateUserRole(userId, newRole as AppRole, 'add');
      toast.success('Role updated');
    } catch { toast.error('Failed to update role'); }
    finally { setUpdatingUser(null); }
  };

  const handleStatusToggle = async (userId: string, current: boolean) => {
    setUpdatingUser(userId);
    try {
      await toggleUserStatus(userId, !current);
      toast.success(`User ${!current ? 'activated' : 'deactivated'}`);
    } catch { toast.error('Failed to update status'); }
    finally { setUpdatingUser(null); }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email or membership ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>
        <Select value={roleFilter} onValueChange={v => setRoleFilter(v as any)}>
          <SelectTrigger className="w-36">
            <Filter className="w-3 h-3 mr-1" />
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="moderator">Moderator</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={refetch} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <span className="text-sm text-muted-foreground ml-1">
          {filtered.length} user{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User</th>
                    <th
                      className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell cursor-pointer hover:text-foreground select-none"
                      onClick={() => toggleSort('email')}
                    >
                      <span className="flex items-center gap-1">Email <SortIcon k="email" /></span>
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Role</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                    <th
                      className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell cursor-pointer hover:text-foreground select-none"
                      onClick={() => toggleSort('created')}
                    >
                      <span className="flex items-center gap-1">Joined <SortIcon k="created" /></span>
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">
                        No users match your filters
                      </td>
                    </tr>
                  ) : (
                    filtered.map(u => (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                              {u.first_name?.[0] || u.email?.[0] || '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : 'No name'}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono truncate">
                                {u.membership_id || u.id?.slice(0, 10) + '…'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-muted-foreground truncate block max-w-48">{u.email}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={getHighestRole(u.roles || [])}
                            onValueChange={v => handleRoleChange(u.id, v, u.roles || [])}
                            disabled={updatingUser === u.id}
                          >
                            <SelectTrigger className="w-28 h-7 text-xs">
                              <div className="flex items-center gap-1">
                                <RoleIcon roles={u.roles || []} />
                                <SelectValue />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="moderator">Moderator</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={u.is_active ?? true}
                              onCheckedChange={() => handleStatusToggle(u.id, u.is_active ?? true)}
                              disabled={updatingUser === u.id}
                              className="scale-75"
                            />
                            <Badge
                              variant="outline"
                              className={`text-xs ${u.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}
                            >
                              {u.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                          {u.profile_created_at
                            ? format(new Date(u.profile_created_at), 'MMM d, yyyy')
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => setSelectedUser(u)}
                          >
                            <Eye className="w-3 h-3" /> View
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RoleIcon roles={selectedUser?.roles || []} />
              {selectedUser?.first_name && selectedUser?.last_name
                ? `${selectedUser.first_name} ${selectedUser.last_name}`
                : selectedUser?.email}
            </DialogTitle>
            <DialogDescription>
              Full user details and account management
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Email</p>
                  <p className="font-medium truncate">{selectedUser.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Membership ID</p>
                  <p className="font-mono text-xs">{selectedUser.membership_id || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">User ID</p>
                  <p className="font-mono text-xs truncate">{selectedUser.id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Profile Complete</p>
                  <Badge variant="outline" className={selectedUser.profile_completed ? 'text-green-700' : 'text-yellow-700'}>
                    {selectedUser.profile_completed ? 'Complete' : 'Incomplete'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Joined</p>
                  <p>{selectedUser.profile_created_at
                    ? format(new Date(selectedUser.profile_created_at), 'PPP')
                    : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</p>
                  <Badge variant="outline" className={selectedUser.is_active ? 'text-green-700' : 'text-red-600'}>
                    {selectedUser.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>

              <div className="pt-2 border-t flex gap-2 justify-end">
                <Button
                  variant={selectedUser.is_active ? 'destructive' : 'default'}
                  size="sm"
                  disabled={updatingUser === selectedUser.id}
                  onClick={async () => {
                    await handleStatusToggle(selectedUser.id, selectedUser.is_active ?? true);
                    setSelectedUser(null);
                  }}
                >
                  {selectedUser.is_active ? 'Deactivate Account' : 'Activate Account'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedUser(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
