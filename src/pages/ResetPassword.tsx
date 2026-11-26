import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Plane,
  Lock,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  ArrowRight,
} from "lucide-react";
import { sessionManager } from "@/lib/sessionManager";
import { clearAllAgencyDataCache } from "@/lib/cacheManager";
import { getAuthRedirectUrl } from "@/lib/authRedirect";
import { getResendCooldownRemaining, RESEND_COOLDOWN_SECONDS } from "@/lib/authFlowState";
import { logAndFriendlyMessage } from "@/lib/friendlyError";

type RecoveryViewState = "verifying" | "ready" | "invalid" | "success";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [viewState, setViewState] = useState<RecoveryViewState>("verifying");
  const [invalidMessage, setInvalidMessage] = useState(
    "This password reset link has expired or was already used. Request a fresh reset link below."
  );

  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // "Send new link" state when a link is expired or already used
  const [resendEmail, setResendEmail] = useState(searchParams.get("email") || "");
  const [sendingNewLink, setSendingNewLink] = useState(false);
  const [newLinkSent, setNewLinkSent] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  useEffect(() => {
    if (!lastSentAt) {
      setCooldownLeft(0);
      return;
    }
    const tick = () => setCooldownLeft(getResendCooldownRemaining(lastSentAt));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [lastSentAt]);

  useEffect(() => {
    let mounted = true;
    let resolved = false;

    const markReady = () => {
      if (!mounted) return;
      resolved = true;
      setViewState("ready");
    };

    const markInvalid = (msg?: string) => {
      if (!mounted || resolved) return;
      if (msg) setInvalidMessage(msg);
      setViewState("invalid");
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && newSession?.user)) {
        markReady();
      }
    });

    const verifyRecoveryLink = async () => {
      const hashRaw = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
      const hashParams = new URLSearchParams(hashRaw);

      const urlError = searchParams.get("error") || hashParams.get("error");
      const urlErrorCode = searchParams.get("error_code") || hashParams.get("error_code");
      const urlErrorDesc =
        searchParams.get("error_description") || hashParams.get("error_description");

      if (urlError || urlErrorCode || urlErrorDesc) {
        markInvalid(
          "This password reset link has expired or was already used. Enter your email below to send a new reset link."
        );
        return;
      }

      try {
        // 1. Token hash flow (?token_hash=...&type=recovery)
        const tokenHash = searchParams.get("token_hash");
        const otpType = searchParams.get("type") || hashParams.get("type");
        if (tokenHash) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: (otpType as "recovery" | "email") || "recovery",
          });
          if (!error && data?.session) {
            markReady();
            return;
          }
          const { data: fallbackSession } = await supabase.auth.getSession();
          if (fallbackSession?.session?.user) {
            markReady();
            return;
          }
          markInvalid(
            "This password reset link has expired or was already used. Enter your email below to send a new link."
          );
          return;
        }

        // 2. PKCE code flow (?code=...)
        const code = searchParams.get("code");
        if (code) {
          const { data: preSession } = await supabase.auth.getSession();
          if (preSession?.session?.user) {
            markReady();
            return;
          }

          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data?.session) {
            markReady();
            return;
          }

          await new Promise((r) => setTimeout(r, 350));
          const { data: postSession } = await supabase.auth.getSession();
          if (postSession?.session?.user) {
            markReady();
            return;
          }

          markInvalid(
            "This password reset link has expired, was already used, or was opened in a different browser. Request a fresh link below."
          );
          return;
        }

        // 3. Implicit hash fragment (#access_token=...&type=recovery) or active recovery session
        if (hashRaw.includes("type=recovery") || hashRaw.includes("access_token=")) {
          await new Promise((r) => setTimeout(r, 350));
          const { data: hashSession } = await supabase.auth.getSession();
          if (hashSession?.session?.user) {
            markReady();
            return;
          }
          if (hashRaw.includes("type=recovery")) {
            markReady();
            return;
          }
        }

        const { data: currentSession } = await supabase.auth.getSession();
        if (currentSession?.session?.user) {
          markReady();
          return;
        }

        markInvalid(
          "This password reset link is invalid, expired, or has already been used. Request a new reset link below."
        );
      } catch (err) {
        console.warn("[ResetPassword] Recovery check failed:", err);
        markInvalid(
          "We could not verify this reset link because it expired or was already used. Request a new link below."
        );
      }
    };

    void verifyRecoveryLink();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [searchParams]);

  const handleSendNewResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = resendEmail.trim();
    if (!cleanEmail) {
      toast({
        title: "Email required",
        description: "Please enter your registered account email address.",
        variant: "destructive",
      });
      return;
    }
    if (sendingNewLink || cooldownLeft > 0) return;

    setSendingNewLink(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: getAuthRedirectUrl("/reset-password"),
      });
      if (error) throw error;

      setNewLinkSent(true);
      setLastSentAt(Date.now());
      setCooldownLeft(RESEND_COOLDOWN_SECONDS);
      toast({
        title: "Reset link sent",
        description: `We sent a new password reset link to ${cleanEmail}. Check your inbox and spam folder.`,
      });
    } catch (err: unknown) {
      const friendly = logAndFriendlyMessage(
        "ResetPassword.handleSendNewResetLink",
        err,
        "Could not send a new reset link right now. Please try again in a moment."
      );
      toast({
        title: "Could not send link",
        description: friendly,
        variant: "destructive",
      });
    } finally {
      setSendingNewLink(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Please choose a password with at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both password fields match.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        const lowerMsg = (error.message || "").toLowerCase();
        if (lowerMsg.includes("session") || lowerMsg.includes("expired") || lowerMsg.includes("jwt")) {
          setViewState("invalid");
          setInvalidMessage(
            "Your password reset session expired before saving. Please send a new reset link below."
          );
          toast({
            title: "Reset session expired",
            description: "Please request a fresh password reset link.",
            variant: "destructive",
          });
        } else if (lowerMsg.includes("same") || lowerMsg.includes("different")) {
          toast({
            title: "Choose a different password",
            description: "Your new password must be different from your previous password.",
            variant: "destructive",
          });
        } else {
          const friendly = logAndFriendlyMessage(
            "ResetPassword.handleResetPassword",
            error,
            "Could not update your password. Please try again or request a fresh reset link."
          );
          toast({
            title: "Unable to update password",
            description: friendly,
            variant: "destructive",
          });
        }
        setLoading(false);
        return;
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.id) {
          await (supabase as any).rpc("admin_revoke_user_sessions", { p_user_id: user.id });
        }
      } catch {
        // Non-blocking session cleanup
      }

      try {
        await supabase.auth.signOut({ scope: "global" });
      } catch {
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      }

      sessionManager.endSession();
      clearAllAgencyDataCache();
      setViewState("success");
      toast({
        title: "Password updated!",
        description: "Your password has been reset. Please sign in with your new password.",
      });
      setTimeout(() => {
        navigate("/login?reason=password-changed", {
          replace: true,
          state: { message: "Password updated successfully. Please sign in with your new password." },
        });
      }, 900);
    } catch (err: unknown) {
      const friendly = logAndFriendlyMessage(
        "ResetPassword.handleResetPassword.catch",
        err,
        "Something went wrong updating your password. Please try again."
      );
      toast({
        title: "Unable to update password",
        description: friendly,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (viewState === "verifying") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-accent p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:py-4">
        <SeoHead
          title="Reset Password — TAMS Pro"
          description="Verify your password reset link for TAMS Pro."
          path="/reset-password"
        />
        <Card className="w-full max-w-md shadow-2xl border-0 bg-card/95">
          <CardContent className="pt-10 pb-8 space-y-5 text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl font-bold">Verifying Reset Link...</h1>
              <p className="text-muted-foreground text-sm">
                Preparing your secure TAMS Pro password reset form.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (viewState === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-accent p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:py-4">
        <SeoHead
          title="Password Updated — TAMS Pro"
          description="Your TAMS Pro password has been updated."
          path="/reset-password"
        />
        <Card className="w-full max-w-md shadow-2xl border-0 bg-card/95">
          <CardContent className="pt-10 pb-8 space-y-6 text-center">
            <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Password Updated!</h1>
              <p className="text-muted-foreground text-sm">
                Your password has been updated. Redirecting you to login...
              </p>
            </div>
            <Button
              onClick={() =>
                navigate("/login?reason=password-changed", {
                  replace: true,
                  state: {
                    message: "Password updated successfully. Please sign in with your new password.",
                  },
                })
              }
              className="w-full h-11 font-semibold"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (viewState === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-accent p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:py-4">
        <SeoHead
          title="Reset Link Expired — TAMS Pro"
          description="Request a fresh password reset link for your TAMS Pro account."
          path="/reset-password"
        />
        <Card className="w-full max-w-md shadow-2xl border-0 bg-card/95">
          <CardContent className="pt-9 pb-8 px-6 space-y-5">
            <div className="text-center space-y-3">
              <div className="mx-auto w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center">
                <Lock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="space-y-1.5">
                <h1 className="text-xl sm:text-2xl font-bold">Reset Link Expired or Used</h1>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                  {invalidMessage}
                </p>
              </div>
            </div>

            {newLinkSent ? (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 space-y-2 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <p className="text-xs sm:text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                  Fresh reset link sent!
                </p>
                <p className="text-xs text-emerald-800/90 dark:text-emerald-300/90">
                  Check <strong>{resendEmail}</strong> (including Spam/Promotions) and open the newest email from TAMS Pro.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sendingNewLink || cooldownLeft > 0}
                  onClick={handleSendNewResetLink}
                  className="w-full mt-2 text-xs font-semibold"
                >
                  {cooldownLeft > 0 ? `Send new link in ${cooldownLeft}s` : "Send new link"}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSendNewResetLink} className="p-4 rounded-xl bg-muted/40 border space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-resend-email" className="text-xs font-semibold flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-primary" />
                    <span>Your Registered Email</span>
                  </Label>
                  <Input
                    id="reset-resend-email"
                    type="email"
                    placeholder="agency@example.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="h-11 text-sm"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={sendingNewLink || cooldownLeft > 0 || !resendEmail.trim()}
                  className="w-full h-11 font-semibold gap-2"
                >
                  {sendingNewLink ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>
                        {cooldownLeft > 0 ? `Send new link (${cooldownLeft}s)` : "Send new link"}
                      </span>
                    </>
                  )}
                </Button>
              </form>
            )}

            <div className="text-center pt-1">
              <Link
                to="/login"
                className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
              >
                <span>Back to Login</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-accent p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:py-4">
      <SeoHead
        title="Reset Password — TAMS Pro"
        description="Set a new password for your TAMS Pro travel agency management account."
        path="/reset-password"
      />
      <h1 className="sr-only">Reset your TAMS Pro password</h1>
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border-0 backdrop-blur-sm bg-card/95">
          <CardHeader className="space-y-4 text-center pb-4">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center shadow-lg">
                <Plane className="w-8 h-8 text-primary-foreground" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
                <CardDescription>Enter a new password for your TAMS Pro account</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm font-semibold">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pr-11"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    data-compact-btn=""
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-2 md:p-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-semibold">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-12 pr-11"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    data-compact-btn=""
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-2 md:p-1"
                    aria-label={
                      showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Updating...
                  </span>
                ) : (
                  "Update Password"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
