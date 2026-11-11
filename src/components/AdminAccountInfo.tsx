import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useAgency } from '@/hooks/useAgency';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserCircle2, Monitor, AlertTriangle, Loader2, Trash2, Shield, Calendar, Smartphone, Crown, Infinity, ChevronDown, LogOut, Building2, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface SessionInfo {
  id: string;
  created_at: string;
  user_agent: string;
  ip: string;
  not_after: string;
}

export const AdminAccountInfo = () => {
  const { user } = useAuth();
  const { data: agency } = useAgency();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const [activeSessions, setActiveSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [logoutAllDialogOpen, setLogoutAllDialogOpen] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [sessionsExpanded, setSessionsExpanded] = useState(false);

  useEffect(() => {
    if (user) {
      fetchActiveSessions();
    }
  }, [user]);

  const fetchActiveSessions = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-sessions', {
        body: { action: 'list' }
      });

      if (error) {
        // Don't show error if user is logged out (401)
        if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
          console.log('Session expired, user needs to re-login');
          return;
        }
        throw error;
      }
      setActiveSessions(data.sessions || []);
    } catch (error: any) {
      console.error('Error fetching sessions:', error);
      // Only show toast for non-auth errors
      if (!error.message?.includes('401') && !error.message?.includes('Unauthorized')) {
        toast.error('Failed to load session information');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutAll = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase.functions.invoke('manage-sessions', {
        body: { action: 'delete-all' }
      });

      if (error) throw error;

      toast.success('All devices logged out successfully');
      
      // Sign out current session (use local scope to only logout this device)
      await supabase.auth.signOut({ scope: 'local' });
      navigate('/auth');
    } catch (error: any) {
      toast.error(error.message || 'Failed to logout all devices');
    } finally {
      setActionLoading(false);
      setLogoutAllDialogOpen(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.functions.invoke('manage-sessions', {
        body: { action: 'delete-one', sessionId }
      });

      if (error) throw error;

      toast.success('Session terminated successfully');
      fetchActiveSessions();
    } catch (error: any) {
      toast.error(error.message || 'Failed to terminate session');
    } finally {
      setActionLoading(false);
      setDeleteSessionId(null);
    }
  };

  const getDeviceIcon = (userAgent: string) => {
    if (userAgent.toLowerCase().includes('mobile') || userAgent.toLowerCase().includes('android') || userAgent.toLowerCase().includes('iphone')) {
      return <Smartphone className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  const getDeviceInfo = (userAgent: string) => {
    // Extract browser and OS info from user agent
    const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/);
    const osMatch = userAgent.match(/(Windows|Mac OS|Linux|Android|iOS)/);
    
    const browser = browserMatch ? browserMatch[1] : 'Unknown Browser';
    const os = osMatch ? osMatch[1] : 'Unknown OS';
    
    return { browser, os };
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 shadow-soft-lg">
      <CardHeader className="border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">Administrator Account</CardTitle>
              {isAdmin && (
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-none shadow-soft-lg">
                  <Crown className="h-3 w-3 mr-1" />
                  Super Admin
                </Badge>
              )}
            </div>
            <CardDescription>Logged in as {user?.email}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Agency Profile (Read-Only) */}
        <div className="p-4 rounded-xl border border-border/60 bg-background/50 backdrop-blur-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Agency Profile</h3>
            </div>
            {agency?.agency_code && (
              <Badge variant="outline" className="font-mono text-xs font-bold bg-primary/10 text-primary border-primary/20">
                {agency.agency_code}
              </Badge>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Agency Name</p>
              <p className="text-sm font-medium text-foreground">{agency?.name || '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Public Agency Code (Read-Only)</p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-primary">
                  {agency?.agency_code || 'A00001'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => {
                    navigator.clipboard.writeText(agency?.agency_code || 'A00001');
                    toast.success("Agency code copied to clipboard");
                  }}
                  title="Copy Agency Code"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCircle2 className="h-4 w-4" />
              <span>Subscription Plan</span>
            </div>
            <Badge variant="default" className="text-base px-3 py-1 capitalize bg-emerald-600 text-white font-semibold">
              {isAdmin ? 'Lifetime Master Admin' : (agency?.subscription_plan || 'Free')}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Access Period</span>
            </div>
            {isAdmin ? (
              <Badge 
                variant="default"
                className="text-base px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-none shadow-soft-lg"
              >
                <Infinity className="h-4 w-4 mr-1" />
                Lifetime Access
              </Badge>
            ) : (
              <div className="space-y-1">
                <Badge 
                  variant={agency?.license_status === 'active' ? 'default' : 'destructive'}
                  className="text-base px-3 py-1 capitalize"
                >
                  {agency?.license_status || 'Unknown'}
                </Badge>
                {agency?.license_expiry && (
                  <p className="text-xs text-muted-foreground">
                    Expires: {format(new Date(agency.license_expiry), 'MMM dd, yyyy')}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Monitor className="h-4 w-4" />
              <span>Active Devices</span>
            </div>
            <Badge variant={activeSessions.length > 0 ? 'default' : 'secondary'} className="text-base px-3 py-1 font-mono">
              {loading ? '...' : activeSessions.length}
            </Badge>
          </div>
        </div>

        {/* License Info Message */}
        <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
          <p className="text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 inline mr-2 text-amber-500" />
            For subscription changes or license inquiries, please contact support or administration.
          </p>
        </div>

        {/* Active Sessions - Collapsible */}
        <Collapsible 
          open={sessionsExpanded} 
          onOpenChange={setSessionsExpanded}
          className="space-y-3"
        >
          <div className="flex items-center justify-between gap-4">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center justify-start gap-3 hover:bg-muted/50 w-full p-3 h-auto rounded-lg border border-border/50"
              >
                <Monitor className="h-5 w-5 text-primary shrink-0" />
                <span className="text-base font-semibold flex-1 text-left">Active Login Sessions</span>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {loading ? '...' : `${activeSessions.length} ${activeSessions.length === 1 ? 'device' : 'devices'}`}
                </Badge>
                <ChevronDown 
                  className={`h-5 w-5 text-muted-foreground transition-transform duration-200 shrink-0 ${
                    sessionsExpanded ? 'rotate-180' : ''
                  }`}
                />
              </Button>
            </CollapsibleTrigger>

            {activeSessions.length > 1 && sessionsExpanded && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setLogoutAllDialogOpen(true)}
                disabled={loading || actionLoading}
                className="gap-2 shrink-0"
              >
                <LogOut className="h-4 w-4" />
                Logout All
              </Button>
            )}
          </div>

          <CollapsibleContent className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : activeSessions.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No active sessions found
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {activeSessions.map((session) => {
                  const Icon = getDeviceIcon(session.user_agent);
                  const deviceInfo = getDeviceInfo(session.user_agent);
                  
                  return (
                    <div
                      key={session.id}
                      className="p-3 rounded-lg border border-border/50 bg-card hover:bg-accent/5 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="mt-0.5 text-muted-foreground">
                            {Icon}
                          </div>
                          <div className="space-y-1 flex-1 min-w-0">
                            <p className="text-sm font-medium">{deviceInfo.browser}</p>
                            <p className="text-xs text-muted-foreground">{deviceInfo.os}</p>
                            <div className="space-y-0.5 text-xs text-muted-foreground">
                              <p>IP: {session.ip}</p>
                              <p>Login: {format(new Date(session.created_at), 'MMM dd, yyyy HH:mm')}</p>
                              <p>Expires: {format(new Date(session.not_after), 'MMM dd, yyyy HH:mm')}</p>
                            </div>
                          </div>
                        </div>
                        <Button
                          onClick={() => setDeleteSessionId(session.id)}
                          variant="ghost"
                          size="sm"
                          disabled={actionLoading}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      {/* Logout All Dialog */}
      <AlertDialog open={logoutAllDialogOpen} onOpenChange={setLogoutAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Logout All Devices?</AlertDialogTitle>
            <AlertDialogDescription>
              This will terminate all active sessions for your account across all devices. You will be logged out from everywhere including this device.
              <br /><br />
              <strong>Total sessions to be terminated: {activeSessions.length}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogoutAll}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Logout All Devices
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Single Session Dialog */}
      <AlertDialog open={!!deleteSessionId} onOpenChange={(open) => !open && setDeleteSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately end this login session. The device will need to log in again to access the account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSessionId && handleDeleteSession(deleteSessionId)}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Terminate Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
