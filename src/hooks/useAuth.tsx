import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "@/hooks/use-toast";
import { sessionManager } from "@/lib/sessionManager";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Setup auth state change listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      // Handle session events
      if (event === 'SIGNED_IN' && newSession?.user) {
        sessionManager.startSession(newSession.user.id);
        toast({
          title: "Welcome back!",
          description: "Your session has been restored.",
        });
      } else if (event === 'SIGNED_OUT') {
        sessionManager.endSession();
      } else if (event === 'TOKEN_REFRESHED') {
        // Update last activity on token refresh
        if (newSession?.user) {
          sessionManager.startSession(newSession.user.id);
        }
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      
      if (existingSession?.user) {
        sessionManager.startSession(existingSession.user.id);
      }
      
      setLoading(false);
    });

    // Setup session timeout handler
    sessionManager.setOnTimeout(async () => {
      await supabase.auth.signOut({ scope: 'local' });
      sessionManager.endSession();
      toast({
        title: "Session Expired",
        description: "You've been logged out due to inactivity.",
        variant: "destructive",
      });
      window.location.href = '/login';
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, session, loading };
}
