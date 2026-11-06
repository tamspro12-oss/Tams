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
import { Users, Edit, Trash2, Key, RefreshCw, Loader2, Shield, Calendar, Search, Monitor } from 'lucide-react';
import { format } from 'date-fns';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  agency_name: string;
  subscription_plan: string;
  license_expiry: string | null;
  license_status: string | null;
  created_at: string;
  agency_id: string;
  active_sessions: number;
}

export const UserManagementList = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [editSubscriptionUser, setEditSubscriptionUser] = useState<User | null>(null);
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

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'list' }
      });

      if (error) throw error;
      setUsers(data.users || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
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

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

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
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'reset-password',
          userId: resetPasswordUser.id,
          data: { password: passwordForm.password }
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Password reset successfully');
      setResetPasswordUser(null);
      setPasswordForm({ password: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset password');
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

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('User deleted successfully');
      setDeleteUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateSubscription = async () => {
    if (!editSubscriptionUser) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'update-subscription',
          data: {
            agencyId: editSubscriptionUser.agency_id,
            plan: subscriptionForm.plan
          }
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Subscription updated successfully');
      setEditSubscriptionUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update subscription');
    } finally {
      setProcessing(false);
    }
  };

  const getLicenseStatusBadge = (status: string | null, expiry: string | null) => {
    if (!expiry) return <Badge variant="secondary">Unknown</Badge>;
    
    const expiryDate = new Date(expiry);
    const now = new Date();
    const isExpired = expiryDate < now;

    if (isExpired || status === 'expired') {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (status === 'active') {
      return <Badge variant="default" className="bg-green-500">Active</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  // Filter and search users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        user.full_name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        user.agency_name.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;

      // Subscription plan filter
      if (filterPlan !== 'all' && user.subscription_plan !== filterPlan) {
        return false;
      }

      // Status filter
      if (filterStatus !== 'all') {
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
              <CardTitle className="text-xl">User Management</CardTitle>
              <CardDescription>View and manage all user accounts</CardDescription>
            </div>
          </div>
          <Button onClick={fetchUsers} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
              <div className="text-center py-8 text-muted-foreground">
                No users found matching your criteria
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Devices</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.agency_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {user.subscription_plan}
                      </Badge>
                    </TableCell>
                    <TableCell>{getLicenseStatusBadge(user.license_status, user.license_expiry)}</TableCell>
                    <TableCell className="text-sm">
                      {user.license_expiry ? (
                        <div className="space-y-1">
                          <p className="font-medium">
                            {format(new Date(user.license_expiry), 'MMM dd, yyyy')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(user.license_expiry), 'HH:mm')}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-muted-foreground" />
                        <Badge variant={user.active_sessions > 0 ? "default" : "secondary"} className="font-mono">
                          {user.active_sessions}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(user.created_at), 'MMM dd, yyyy')}
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
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setResetPasswordUser(user)}
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditSubscriptionUser(user);
                            setSubscriptionForm({ plan: user.subscription_plan });
                          }}
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteUser(user)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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
                <p className="text-sm text-muted-foreground">
                  {(() => {
                    const now = new Date();
                    const days = subscriptionForm.plan === 'free' ? 14 : 
                                subscriptionForm.plan === 'monthly' ? 32 : 370;
                    const expiryDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
                    return format(expiryDate, 'MMMM dd, yyyy HH:mm');
                  })()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Duration: {subscriptionForm.plan === 'free' ? '14' : 
                            subscriptionForm.plan === 'monthly' ? '32' : '370'} days from now
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
      </CardContent>
    </Card>
  );
};
