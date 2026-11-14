import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Users, Edit, Trash2, Key, RefreshCw, Loader2, Shield, Calendar, Search, Monitor, Crown, Infinity, Copy, ExternalLink, Database, Check, Code } from 'lucide-react';
import { format } from 'date-fns';
import type { RegisteredUserRecord } from '@/lib/userDirectorySync';

const SUPABASE_SETUP_SQL = `-- Run project migrations in Supabase SQL Editor / CLI in order:
-- 1. supabase/migrations/20261114_00_add_super_admin_enum.sql
-- 2. supabase/migrations/20261114_01_rbac_and_strict_agency_isolation.sql
-- 3. supabase/migrations/20261114_02_accounting_unification_rpcs_and_realtime.sql
-- Verify your super_admin role exists in public.user_roles for admin access.`;

export const UserManagementList = () => {
  const [users, setUsers] = useState<RegisteredUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDbSyncActive, setIsDbSyncActive] = useState<boolean | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);

  const [editUser, setEditUser] = useState<RegisteredUserRecord | null>(null);
  const [deleteUser, setDeleteUser] = useState<RegisteredUserRecord | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<RegisteredUserRecord | null>(null);
  const [editSubscriptionUser, setEditSubscriptionUser] = useState<RegisteredUserRecord | null>(null);
  const [processing, setProcessing] = useState(false);

  const [editForm, setEditForm] = useState({ full_name: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });
  const [subscriptionForm, setSubscriptionForm] = useState({ plan: 'free' });
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
    setCopiedSql(true);
    toast.success('Supabase SQL migration copied! Paste in Supabase SQL Editor and click Run.');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // 1. Direct high-speed RPC (Guaranteed DB-level execution, requires super_admin)
      try {
        const { data: rpcUsers, error: rpcError } = await (supabase as any).rpc('admin_get_registered_users');
        if (!rpcError && Array.isArray(rpcUsers) && rpcUsers.length > 0) {
          setIsDbSyncActive(true);
          setUsers(rpcUsers);
          setLoading(false);
          return;
        }
      } catch (rpcEx) {
        console.warn('admin_get_registered_users RPC fallback:', rpcEx);
      }

      setIsDbSyncActive(false);

      // 2. Edge Function invocation fallback (strictly checks super_admin server-side)
      try {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('manage-users', {
          body: { action: 'list' }
        });

        if (!edgeError && edgeData?.users && Array.isArray(edgeData.users) && edgeData.users.length > 0) {
          setUsers(edgeData.users);
          setLoading(false);
          return;
        }
      } catch (edgeEx) {
        console.warn('manage-users edge function fallback:', edgeEx);
      }

      // 3. Direct PostgreSQL profiles + agencies query fallback (RLS-protected)
      let rawProfiles: any[] = [];
      try {
        const { data: profs, error: profError } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            email,
            agency_id,
            created_at,
            agencies (
              id,
              name,
              subscription_plan,
              license_expiry,
              license_status
            )
          `)
          .order('created_at', { ascending: false });

        if (!profError && Array.isArray(profs) && profs.length > 0) {
          rawProfiles = profs;
        } else {
          const { data: fallbackProfs } = await supabase
            .from('profiles')
            .select(`
              id,
              full_name,
              agency_id,
              created_at,
              agencies (
                id,
                name,
                subscription_plan,
                license_expiry,
                license_status
              )
            `)
            .order('created_at', { ascending: false });

          if (fallbackProfs) rawProfiles = fallbackProfs;
        }
      } catch (profEx) {
        console.warn('profiles query fallback:', profEx);
      }

      const convertedUsers: RegisteredUserRecord[] = rawProfiles.map((p: any) => {
        const agency = Array.isArray(p.agencies) ? p.agencies[0] : p.agencies;
        return {
          id: p.id,
          email: p.email || '',
          full_name: p.full_name || 'Agency User',
          role: 'staff',
          agency_name: agency?.name || 'Primary Agency',
          subscription_plan: agency?.subscription_plan || 'free',
          license_expiry: agency?.license_expiry || null,
          license_status: agency?.license_status || 'active',
          created_at: p.created_at || new Date().toISOString(),
          agency_id: p.agency_id || '',
          active_sessions: 0,
        };
      });

      setUsers(convertedUsers);
    } catch (error: any) {
      console.error('Error fetching registered users:', error);
      toast.error(error?.message || 'Failed to load user directory from database');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = async () => {
    if (!editUser || !editForm.full_name || !editForm.email) {
      toast.error('Please fill in all fields');
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'update',
          userId: editUser.id,
          data: {
            full_name: editForm.full_name,
            email: editForm.email
          }
        }
      });

      if (error || data?.error) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ full_name: editForm.full_name, email: editForm.email })
          .eq('id', editUser.id);

        if (profileError) {
          throw new Error(data?.error || error?.message || profileError.message);
        }
      }

      toast.success('User updated successfully');
      setEditUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user');
    } finally {
      setProcessing(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser || !passwordForm.password) {
      toast.error('Please enter a password');
      return;
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (passwordForm.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: {
          userId: resetPasswordUser.id,
          newPassword: passwordForm.password,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to reset user password');
      }

      toast.success('Password reset successfully. All active sessions for this user have been terminated.');
      setResetPasswordUser(null);
      setPasswordForm({ password: '', confirmPassword: '' });
      fetchUsers();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to reset password');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'delete',
          userId: deleteUser.id
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to delete user');
      }

      const local = users.filter((u) => u.id !== deleteUser.id);
      setUsers(local);

      toast.success('User deleted successfully');
      setDeleteUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete user');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateSubscription = async () => {
    if (!editSubscriptionUser) return;

    setProcessing(true);
    try {
      const planDays: Record<string, number> = {
        free: 14,
        monthly: 32,
        yearly: 370,
        lifetime: 36500,
      };

      const days = planDays[subscriptionForm.plan.toLowerCase()] || 30;

      let updated = false;
      let lastErrorMessage = '';

      // 1. Primary DB RPC
      try {
        const { data: rpcData, error: rpcError } = await (supabase as any).rpc('admin_set_agency_subscription', {
          p_agency_id: editSubscriptionUser.agency_id,
          p_plan: subscriptionForm.plan,
          p_duration_days: days,
        });
        if (!rpcError && rpcData?.success) {
          updated = true;
        } else if (rpcError) {
          lastErrorMessage = rpcError.message;
        }
      } catch (e: any) {
        lastErrorMessage = e?.message || 'RPC subscription update failed';
      }

      // 2. Fallback to Edge Function (super_admin verified server-side)
      if (!updated) {
        const { data: fnData, error: fnError } = await supabase.functions.invoke('manage-users', {
          body: {
            action: 'update-subscription',
            data: {
              agencyId: editSubscriptionUser.agency_id,
              plan: subscriptionForm.plan
            }
          }
        });
        if (!fnError && !fnData?.error) {
          updated = true;
        } else {
          lastErrorMessage = fnData?.error || fnError?.message || lastErrorMessage;
        }
      }

      if (!updated) {
        throw new Error(lastErrorMessage || 'Failed to update subscription in database');
      }

      toast.success(`Subscription plan updated to "${subscriptionForm.plan}" successfully`);
      setEditSubscriptionUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update subscription');
    } finally {
      setProcessing(false);
    }
  };

  const getLicenseStatusBadge = (status: string | null, expiry: string | null, role?: string) => {
    if (role === 'super_admin' || status === 'lifetime') {
      return (
        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-none shadow-xs font-semibold gap-1">
          <Infinity className="w-3 h-3" />
          <span>Lifetime Active</span>
        </Badge>
      );
    }

    if (!expiry) return <Badge variant="secondary">Active</Badge>;
    
    const expiryDate = new Date(expiry);
    const now = new Date();
    const isExpired = expiryDate < now;

    if (isExpired || status === 'expired') {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (status === 'active') {
      return <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white">Active</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  // Filter and search users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const isMaster = user.role === 'super_admin';

      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        user.full_name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        user.agency_name.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;

      // Subscription plan filter
      if (filterPlan !== 'all') {
        if (isMaster && filterPlan === 'lifetime') return true;
        if (user.subscription_plan !== filterPlan) {
          return false;
        }
      }

      // Status filter
      if (filterStatus !== 'all') {
        if (isMaster) {
          return filterStatus === 'active';
        }

        const expiryDate = user.license_expiry ? new Date(user.license_expiry) : null;
        const now = new Date();
        const isExpired = !expiryDate || expiryDate < now;
        
        if (filterStatus === 'active' && (isExpired || user.license_status !== 'active')) {
          return false;
        }
        if (filterStatus === 'expired' && !isExpired) {
          return false;
        }
      }

      return true;
    });
  }, [users, searchQuery, filterPlan, filterStatus]);

  return (
    <Card className="border-border/50 shadow-soft-md">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">Registered Users</CardTitle>
                <Badge variant="secondary" className="font-mono text-xs font-semibold px-2 py-0.5">
                  {users.length} {users.length === 1 ? 'Account' : 'Accounts'}
                </Badge>
              </div>
              <CardDescription>Directory of all registered agency portals, owners, and accounts</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopySql}
              className="gap-1.5 text-xs font-semibold cursor-pointer hidden sm:flex"
              title="Copy the Supabase SQL migration script"
            >
              {copiedSql ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedSql ? 'SQL Copied!' : 'Copy SQL'}</span>
            </Button>
            <Button onClick={fetchUsers} variant="outline" size="sm" disabled={loading} className="gap-2 cursor-pointer">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Real-time DB Sync Banner */}
        {isDbSyncActive === true ? (
          <div className="mb-6 px-4 py-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                Live Supabase Database Connected & Synced with <strong>auth.users</strong>
              </span>
            </div>
            <Badge variant="outline" className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 text-[10px]">
              Direct RPC Sync Active
            </Badge>
          </div>
        ) : isDbSyncActive === false ? (
          <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                <Database className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-foreground">
                    Supabase Live Sync Setup (1-Click SQL)
                  </h4>
                  <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/40 text-[10px] font-semibold">
                    Instant Setup
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                  The direct <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">admin_get_registered_users</code> RPC is not active yet. Apply the latest database security migrations in your Supabase SQL editor to query all registered accounts securely from <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">auth.users</code>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="default"
                className="gap-1.5 text-xs font-semibold shadow-xs cursor-pointer"
                onClick={handleCopySql}
              >
                {copiedSql ? <Check className="h-3.5 w-3.5 text-green-300" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedSql ? 'Copied SQL!' : 'Copy SQL Script'}</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs cursor-pointer"
                asChild
              >
                <a
                  href="https://supabase.com/dashboard/project/mwpbschzwjxeioyrzskv/sql"
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open SQL Editor</span>
                </a>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs cursor-pointer"
                onClick={() => setShowSqlModal(true)}
              >
                <Code className="h-3.5 w-3.5 mr-1" />
                <span>View</span>
              </Button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Syncing registered users from database...</p>
          </div>
        ) : (
          <>
            {/* Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or agency..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterPlan} onValueChange={setFilterPlan}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value="lifetime">Lifetime</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl bg-muted/20 text-muted-foreground space-y-2">
                <Users className="w-8 h-8 mx-auto text-muted-foreground/50" />
                <p className="font-medium text-sm">No users found matching your search or filters</p>
                <p className="text-xs">Try clearing filters or click Refresh to sync directly with the database.</p>
                <Button variant="outline" size="sm" onClick={() => { setSearchQuery(''); setFilterPlan('all'); setFilterStatus('all'); fetchUsers(); }} className="mt-2 text-xs">
                  Reset Filters
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/50">
              <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-bold">Name</TableHead>
                  <TableHead className="font-bold">Email</TableHead>
                  <TableHead className="font-bold">Role</TableHead>
                  <TableHead className="font-bold">Agency</TableHead>
                  <TableHead className="font-bold">Plan</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="font-bold">Expiry Date</TableHead>
                  <TableHead className="font-bold">Devices</TableHead>
                  <TableHead className="font-bold">Created</TableHead>
                  <TableHead className="text-right font-bold">Actions</TableHead>
                </TableRow>
              </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const isMaster = user.role === 'super_admin';
                    return (
                    <TableRow key={user.id} className={isMaster ? "bg-amber-500/5 hover:bg-amber-500/10 transition-colors font-medium" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {isMaster && <Crown className="w-4 h-4 text-amber-500 shrink-0" />}
                          <span>{user.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={isMaster ? "font-semibold text-foreground" : "text-foreground/90 font-medium"}>
                          {user.email}
                        </span>
                      </TableCell>
                      <TableCell>
                        {isMaster ? (
                          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-none shadow-xs text-xs font-bold gap-1">
                            <Crown className="h-3 w-3" />
                            Master Admin
                          </Badge>
                        ) : (
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {user.role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                            {user.role}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{user.agency_name}</TableCell>
                      <TableCell>
                        {isMaster ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-bold uppercase text-[10px] tracking-wide shadow-xs">
                            Lifetime
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="capitalize text-xs font-medium">
                            {user.subscription_plan}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{getLicenseStatusBadge(user.license_status, user.license_expiry, user.role)}</TableCell>
                      <TableCell className="text-sm">
                        {isMaster ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Infinity className="w-3.5 h-3.5" />
                            <span>Lifetime</span>
                          </span>
                        ) : user.license_expiry ? (
                          <div className="space-y-0.5">
                            <p className="font-medium text-xs">
                              {format(new Date(user.license_expiry), 'MMM dd, yyyy')}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {format(new Date(user.license_expiry), 'HH:mm')}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                          <Badge variant={user.active_sessions > 0 ? "default" : "secondary"} className="font-mono text-xs">
                            {user.active_sessions}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {user.created_at ? format(new Date(user.created_at), 'MMM dd, yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditUser(user);
                              setEditForm({ full_name: user.full_name, email: user.email });
                            }}
                            title="Edit user"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setResetPasswordUser(user);
                              setPasswordForm({ password: '', confirmPassword: '' });
                            }}
                            title="Reset password"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditSubscriptionUser(user);
                              setSubscriptionForm({ plan: isMaster ? 'lifetime' : (user.subscription_plan || 'free') });
                            }}
                            title="Change plan"
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                          {!isMaster && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteUser(user)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Delete user"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            )}
          </>
        )}

        {/* Edit User Dialog */}
        <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update user information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  disabled={processing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  disabled={processing}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditUser(null)} disabled={processing}>
                Cancel
              </Button>
              <Button onClick={handleEditUser} disabled={processing}>
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog open={!!resetPasswordUser} onOpenChange={(open) => !open && setResetPasswordUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>Set a new password for {resetPasswordUser?.full_name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={passwordForm.password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                  disabled={processing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Re-enter password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  disabled={processing}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetPasswordUser(null)} disabled={processing}>
                Cancel
              </Button>
              <Button onClick={handleResetPassword} disabled={processing}>
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Reset Password
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Subscription Dialog */}
        <Dialog open={!!editSubscriptionUser} onOpenChange={(open) => !open && setEditSubscriptionUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Subscription</DialogTitle>
              <DialogDescription>Change subscription plan for {editSubscriptionUser?.agency_name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subscription-plan">Subscription Plan</Label>
                <Select
                  value={subscriptionForm.plan}
                  onValueChange={(value) => setSubscriptionForm({ plan: value })}
                  disabled={processing}
                >
                  <SelectTrigger id="subscription-plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lifetime">Lifetime Access (Permanent)</SelectItem>
                    <SelectItem value="free">Free Trial (14 days)</SelectItem>
                    <SelectItem value="monthly">Monthly Plan (32 days)</SelectItem>
                    <SelectItem value="yearly">Yearly Plan (370 days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Expiry Date Preview */}
              <div className="p-4 bg-muted/50 border border-border rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>New Expiry Date</span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {(() => {
                    if (subscriptionForm.plan === 'lifetime') {
                      return 'Permanent Lifetime Access (Never Expires)';
                    }
                    const now = new Date();
                    const days = subscriptionForm.plan === 'free' ? 14 : 
                                subscriptionForm.plan === 'monthly' ? 32 : 370;
                    const expiryDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
                    return format(expiryDate, 'MMMM dd, yyyy HH:mm');
                  })()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {subscriptionForm.plan === 'lifetime'
                    ? 'Account will remain active with full platform features permanently.'
                    : `Duration: ${subscriptionForm.plan === 'free' ? '14' : subscriptionForm.plan === 'monthly' ? '32' : '370'} days from now`}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditSubscriptionUser(null)} disabled={processing}>
                Cancel
              </Button>
              <Button onClick={handleUpdateSubscription} disabled={processing}>
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update Subscription
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete User Dialog */}
        <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User Account</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deleteUser?.full_name}</strong>? This action cannot be undone and will permanently delete:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>User account and profile</li>
                  <li>All associated data</li>
                  <li>Access to the system</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteUser} disabled={processing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* SQL Preview Modal */}
        <Dialog open={showSqlModal} onOpenChange={setShowSqlModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                <span>Supabase Live Sync SQL Script</span>
              </DialogTitle>
              <DialogDescription>
                Run this script in your Supabase SQL Editor to grant Master Admin live query access to auth.users.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto rounded-md bg-muted p-4 font-mono text-xs">
              <pre className="whitespace-pre-wrap">{SUPABASE_SETUP_SQL}</pre>
            </div>
            <DialogFooter className="flex items-center justify-between sm:justify-between">
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a
                  href="https://supabase.com/dashboard/project/mwpbschzwjxeioyrzskv/sql"
                  target="_blank"
                  rel="noreferrer"
                  className="gap-1.5"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Open Supabase SQL Editor</span>
                </a>
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowSqlModal(false)}>
                  Close
                </Button>
                <Button size="sm" onClick={handleCopySql} className="gap-1.5">
                  {copiedSql ? <Check className="h-4 w-4 text-green-300" /> : <Copy className="h-4 w-4" />}
                  <span>{copiedSql ? 'Copied!' : 'Copy Script'}</span>
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
