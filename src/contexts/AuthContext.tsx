import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { sessionManager } from "@/lib/sessionManager";
import { clearAllAgencyDataCache } from "@/lib/cacheManager";
import { clearLastAppRoute } from "@/lib/lastRouteStorage";

const SERVER_VALIDATION_INTERVAL_MS = 5 * 60 * 1000;
const AUTH_SAFETY_TIMEOUT_MS = 3500;

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isAppProtectedPath(): boolean {
  if (typeof window === "undefined") return false;
  const p = window.location.pathname;
  return p.startsWith("/app") || p.startsWith("/admin");
}

function isServerAuthError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return false;
  }

  const err = error as {
    status?: number;
    code?: string;
    name?: string;
    message?: string;
  } | null;

  if (!err) return false;
  if (err.name === "AuthRetryableFetchError") return false;
  if (err.status === 401 || err.status === 403) return true;
  if (typeof err.status === "number" && err.status >= 500) return false;

  const code = (err.code || "").toLowerCase();
  const revokedCodes = new Set([
    "session_not_found",
    "session_expired",
    "bad_jwt",
    "invalid_jwt",
    "user_not_found",
    "user_banned",
    "refresh_token_not_found",
  ]);
  if (code && revokedCodes.has(code)) {
    return true;
  }

  const msg = (err.message || "").toLowerCase();
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("timeout")) {
    return false;
  }

  const authFailureHints = [
    "jwt",
    "invalid claim",
    "session_not_found",
    "session not found",
    "user from sub claim",
    "auth session missing",
    "token is expired",
    "unauthorized",
  ];
  return authFailureHints.some((hint) => msg.includes(hint));
}

async function forceInvalidateSession(reason: "session-invalidated" | "timeout"): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // ignore local signOut errors
  }
  sessionManager.endSession();
  clearLastAppRoute();
  clearAllAgencyDataCache();

  if (typeof window !== "undefined" && isAppProtectedPath()) {
    window.location.replace(`/login?reason=${reason}`);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const activeUserIdRef = useRef<string | null>(null);
  const lastServerCheckRef = useRef<number>(0);
  const isValidatingRef = useRef<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, AUTH_SAFETY_TIMEOUT_MS);

    const applySession = (nextSession: Session | null) => {
      if (!isMounted) return;
      setSession((prev) => {
        if (
          prev &&
          nextSession &&
          prev.access_token === nextSession.access_token &&
          prev.refresh_token === nextSession.refresh_token &&
          prev.user?.id === nextSession.user?.id
        ) {
          return prev;
        }
        return nextSession;
      });
      const nextUser = nextSession?.user ?? null;
      setUser((prev) => {
        if (
          prev &&
          nextUser &&
          prev.id === nextUser.id &&
          prev.email === nextUser.email
        ) {
          return prev;
        }
        return nextUser;
      });
    };

    const validateServerSessionInBackground = async () => {
      if (!isMounted) return;
      if (!activeUserIdRef.current) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (isValidatingRef.current) return;

      const now = Date.now();
      if (now - lastServerCheckRef.current < SERVER_VALIDATION_INTERVAL_MS) {
        return;
      }

      isValidatingRef.current = true;
      lastServerCheckRef.current = now;

      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (!isMounted) return;

        if (userErr) {
          if (isServerAuthError(userErr)) {
            activeUserIdRef.current = null;
            applySession(null);
            await forceInvalidateSession("session-invalidated");
          } else {
            console.warn("[AuthContext] Non-fatal background user check error:", userErr);
          }
          return;
        }

        if (!userData?.user) {
          activeUserIdRef.current = null;
          applySession(null);
          await forceInvalidateSession("session-invalidated");
          return;
        }

        const verifiedUser = userData.user;
        setUser((prev) => {
          if (
            prev &&
            prev.id === verifiedUser.id &&
            prev.email === verifiedUser.email
          ) {
            return prev;
          }
          return verifiedUser;
        });
      } catch (err) {
        console.warn("[AuthContext] Background getUser() check failed:", err);
      } finally {
        isValidatingRef.current = false;
      }
    };

    let unsubscribe = () => {};
    try {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (!isMounted) return;

        const prevUserId = activeUserIdRef.current;
        const nextUserId = newSession?.user?.id ?? null;

        applySession(newSession);

        if (event === "SIGNED_OUT") {
          activeUserIdRef.current = null;
          lastServerCheckRef.current = 0;
          sessionManager.endSession();
          clearLastAppRoute(prevUserId);
          clearAllAgencyDataCache();
        } else if (event === "TOKEN_REFRESHED" && !newSession?.user) {
          activeUserIdRef.current = null;
          void forceInvalidateSession("session-invalidated");
        } else if (nextUserId) {
          if (prevUserId && prevUserId !== nextUserId) {
            clearLastAppRoute(prevUserId);
            clearAllAgencyDataCache();
          }
          activeUserIdRef.current = nextUserId;
          if (prevUserId !== nextUserId || !sessionManager.getSession()) {
            sessionManager.startSession(nextUserId);
          }
        }
      });
      unsubscribe = () => subscription.unsubscribe();
    } catch (err) {
      console.error("[AuthContext] onAuthStateChange setup error:", err);
    }

    supabase.auth
      .getSession()
      .then(({ data: { session: existingSession } }) => {
        if (!isMounted) return;
        const nextUserId = existingSession?.user?.id ?? null;
        activeUserIdRef.current = nextUserId;
        applySession(existingSession ?? null);

        if (existingSession?.user) {
          sessionManager.startSession(existingSession.user.id);
        }
      })
      .catch((err) => {
        console.error("[AuthContext] getSession error:", err);
      })
      .finally(() => {
        if (isMounted) {
          clearTimeout(safetyTimer);
          setLoading(false);
          if (activeUserIdRef.current) {
            void validateServerSessionInBackground();
          }
        }
      });

    const handleVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (activeUserIdRef.current) {
        void validateServerSessionInBackground();
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    sessionManager.setOnTimeout(async () => {
      toast({
        title: "Session Expired",
        description: "You've been logged out due to inactivity.",
        variant: "destructive",
      });
      activeUserIdRef.current = null;
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

  const contextValue = useMemo(
    () => ({ user, session, loading }),
    [user, session, loading]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return ctx;
}

