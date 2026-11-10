import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "@/hooks/use-toast";
import { sessionManager } from "@/lib/sessionManager";
import { clearAllAgencyDataCache } from "@/lib/cacheManager";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Safety fallback: ensure loading never hangs indefinitely in production
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 3500);

    // Setup auth state change listener FIRST
    let unsubscribe = () => {};
    try {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (!isMounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        // Handle session events with strict multi-tenant cache isolation
        if (event === 'SIGNED_IN' && newSession?.user) {
          clearAllAgencyDataCache();
          sessionManager.startSession(newSession.user.id);
          toast({
            title: "Welcome back!",
            description: "Your session has been restored.",
          });
        } else if (event === 'SIGNED_OUT') {
          sessionManager.endSession();
          clearAllAgencyDataCache();
        } else if (event === 'TOKEN_REFRESHED') {
          // Update last activity on token refresh
          if (newSession?.user) {
            sessionManager.startSession(newSession.user.id);
          }
        }
      });
      unsubscribe = () => subscription.unsubscribe();
    } catch (err) {
      console.error('[useAuth] onAuthStateChange setup error:', err);
    }

    // THEN check for existing session with comprehensive error catching
    supabase.auth
      .getSession()
      .then(({ data: { session: existingSession } }) => {
        if (!isMounted) return;
        setSession(existingSession);
        setUser(existingSession?.user ?? null);

        if (existingSession?.user) {
          sessionManager.startSession(existingSession.user.id);
        }
      })
      .catch((err) => {
        console.error('[useAuth] getSession error:', err);
      })
      .finally(() => {
        if (isMounted) {
          clearTimeout(safetyTimer);
          setLoading(false);
        }
      });

    // Setup session timeout handler
    sessionManager.setOnTimeout(async () => {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (err) {
        console.error('[useAuth] signOut error:', err);
      }
      sessionManager.endSession();
      toast({
        title: "Session Expired",
        description: "You've been logged out due to inactivity.",
        variant: "destructive",
      });
      window.location.href = '/login';
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  return { user, session, loading };
}
