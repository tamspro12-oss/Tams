import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "@/hooks/use-toast";
import { sessionManager } from "@/lib/sessionManager";
import { clearAllAgencyDataCache } from "@/lib/cacheManager";

function isAppProtectedPath(): boolean {
  if (typeof window === "undefined") return false;
  const p = window.location.pathname;
  return p.startsWith("/app") || p.startsWith("/admin");
}

async function forceInvalidateSession(reason: "session-invalidated" | "timeout") {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // ignore local signOut errors
  }
  sessionManager.endSession();
  clearAllAgencyDataCache();

  if (typeof window !== "undefined" && isAppProtectedPath()) {
    window.location.replace(`/login?reason=${reason}`);
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let lastServerCheckAt = 0;

    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 3500);

    const verifyServerSession = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastServerCheckAt < 15000) return;
      lastServerCheckAt = now;

      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!currentSession) {
          if (isMounted) {
            setSession(null);
            setUser(null);
          }
          return;
        }

        // Validate JWT against Auth server so globally revoked sessions or changed
        // passwords force immediate logout on old devices at next request/load.
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData?.user) {
          if (isMounted) {
            setSession(null);
            setUser(null);
          }
          await forceInvalidateSession("session-invalidated");
          return;
        }

        if (isMounted) {
          setSession(currentSession);
          setUser(userData.user);
        }
      } catch (err) {
        console.error("[useAuth] verifyServerSession error:", err);
      }
    };

    let unsubscribe = () => {};
    try {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (!isMounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (event === "SIGNED_IN" && newSession?.user) {
          clearAllAgencyDataCache();
          sessionManager.startSession(newSession.user.id);
        } else if (event === "SIGNED_OUT") {
          sessionManager.endSession();
          clearAllAgencyDataCache();
          if (isAppProtectedPath()) {
            window.location.replace("/login");
          }
        } else if (event === "TOKEN_REFRESHED") {
          if (newSession?.user) {
            sessionManager.startSession(newSession.user.id);
          } else {
            void forceInvalidateSession("session-invalidated");
          }
        }
      });
      unsubscribe = () => subscription.unsubscribe();
    } catch (err) {
      console.error("[useAuth] onAuthStateChange setup error:", err);
    }

    supabase.auth
      .getSession()
      .then(async ({ data: { session: existingSession } }) => {
        if (!isMounted) return;
        if (existingSession?.user) {
          await verifyServerSession(true);
          sessionManager.startSession(existingSession.user.id);
        } else {
          setSession(null);
          setUser(null);
        }
      })
      .catch((err) => {
        console.error("[useAuth] getSession error:", err);
      })
      .finally(() => {
        if (isMounted) {
          clearTimeout(safetyTimer);
          setLoading(false);
        }
      });

    const handleVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void verifyServerSession(false);
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    sessionManager.setOnTimeout(async () => {
      toast({
        title: "Session Expired",
        description: "You've been logged out due to inactivity.",
        variant: "destructive",
      });
      await forceInvalidateSession("timeout");
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      unsubscribe();
    };
  }, []);

  return { user, session, loading };
}
