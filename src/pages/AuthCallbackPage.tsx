import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Loader2, Mail, ArrowRight } from "lucide-react";
import { sessionManager } from "@/lib/sessionManager";
import { getAuthCallbackUrl } from "@/lib/authRedirect";
import {
  AuthCallbackOutcome,
  classifyAuthCallbackFailure,
  getResendCooldownRemaining,
  RESEND_COOLDOWN_SECONDS,
} from "@/lib/authFlowState";
import { logAndFriendlyMessage } from "@/lib/friendlyError";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [outcome, setOutcome] = useState<AuthCallbackOutcome>({
    kind: "error",
    title: "Could not finish verification",
    message: "Please request a fresh confirmation email or try signing in.",
  });
  const [emailInput, setEmailInput] = useState<string>(searchParams.get("email") || "");
  const [resending, setResending] = useState<boolean>(false);
  const [lastResendAt, setLastResendAt] = useState<number | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  useEffect(() => {
    if (!lastResendAt) {
      setCooldownLeft(0);
      return;
    }
    const tick = () => setCooldownLeft(getResendCooldownRemaining(lastResendAt));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [lastResendAt]);

  useEffect(() => {
    const handleAuthCallback = async () => {
      const hashParams = new URLSearchParams(
        typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : ""
      );

      const urlError = searchParams.get("error") || hashParams.get("error");
      const urlErrorCode = searchParams.get("error_code") || hashParams.get("error_code");
      const urlErrorDesc =
        searchParams.get("error_description") || hashParams.get("error_description");
      const isRecovery =
        searchParams.get("type") === "recovery" ||
        hashParams.get("type") === "recovery" ||
        searchParams.get("next") === "/reset-password";
      const successRoute = isRecovery ? "/reset-password" : "/app/dashboard";

      try {
        if (urlError || urlErrorCode || urlErrorDesc) {
          setOutcome(
            classifyAuthCallbackFailure({
              errorCode: urlErrorCode || urlError,
              errorDescription: urlErrorDesc,
            })
          );
          setStatus("error");
          return;
        }

        // 1. PKCE Code Exchange (e.g. ?code=...)
        const code = searchParams.get("code");
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.warn("Auth callback PKCE exchange note:", exchangeError);
            setOutcome(
              classifyAuthCallbackFailure({
                errorCode: (exchangeError as { code?: string }).code,
                errorMessage: exchangeError.message,
              })
            );
            setStatus("error");
            return;
          }
          if (data?.user) {
            sessionManager.startSession(data.user.id);
            setStatus("success");
            setTimeout(() => navigate(successRoute, { replace: true }), 1200);
            return;
          }
        }

        // 2. Token Hash verification (e.g. ?token_hash=...&type=signup|email|recovery)
        const tokenHash = searchParams.get("token_hash");
        const type = searchParams.get("type");
        if (tokenHash) {
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: (type as "signup" | "email" | "recovery") || "signup",
          });
          if (verifyError) {
            console.warn("Auth callback verifyOtp error:", verifyError);
            setOutcome(
              classifyAuthCallbackFailure({
                errorCode: (verifyError as { code?: string }).code,
                errorMessage: verifyError.message,
              })
            );
            setStatus("error");
            return;
          }
          if (data?.user) {
            sessionManager.startSession(data.user.id);
            setStatus("success");
            setTimeout(() => navigate(successRoute, { replace: true }), 1200);
            return;
          }
        }

        // 3. Hash Fragment tokens (e.g. #access_token=...&refresh_token=...)
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.warn("Auth callback getSession error:", sessionError);
          setOutcome(
            classifyAuthCallbackFailure({
              errorCode: (sessionError as { code?: string }).code,
              errorMessage: sessionError.message,
            })
          );
          setStatus("error");
          return;
        }

        if (sessionData?.session?.user) {
          sessionManager.startSession(sessionData.session.user.id);
          setStatus("success");
          setTimeout(() => navigate(successRoute, { replace: true }), 1200);
          return;
        }

        setOutcome(
          classifyAuthCallbackFailure({
            errorMessage: "No verification code or token found in URL.",
          })
        );
        setStatus("error");
      } catch (err: unknown) {
        console.warn("Auth verification callback error:", err);
        const msg = err instanceof Error ? err.message : "";
        setOutcome(classifyAuthCallbackFailure({ errorMessage: msg }));
        setStatus("error");
      }
    };

    handleAuthCallback();
  }, [searchParams, navigate]);

  // Resend Verification Email
  const handleResendVerification = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!emailInput.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter your registered agency email address.",
        variant: "destructive",
      });
      return;
    }
    if (resending || cooldownLeft > 0) return;

    setResending(true);
    try {
      const redirectUrl = getAuthCallbackUrl();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: emailInput.trim(),
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      setLastResendAt(Date.now());
      setCooldownLeft(RESEND_COOLDOWN_SECONDS);
      toast({
        title: "Verification Email Sent",
        description: `We've sent a fresh confirmation link to ${emailInput.trim()}. Please check your inbox and spam folder.`,
      });
    } catch (err: unknown) {
      const friendly = logAndFriendlyMessage(
        "AuthCallbackPage.handleResendVerification",
        err,
        "Could not resend the confirmation email right now. Please try again shortly."
      );
      toast({
        title: "Could not resend email",
        description: friendly,
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-4">
      <Card className="w-full max-w-md shadow-2xl border-slate-700 bg-card/95 backdrop-blur-md rounded-2xl overflow-hidden">
        <CardContent className="pt-10 pb-8 px-6 text-center">
          {/* 1. LOADING STATE */}
          {status === "loading" && (
            <div className="space-y-5">
              <div className="mx-auto w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground">Verifying your email...</h2>
                <p className="text-sm text-muted-foreground">
                  Confirming your agency account and preparing your dashboard.
                </p>
              </div>
            </div>
          )}

          {/* 2. SUCCESS STATE */}
          {status === "success" && (
            <div className="space-y-5 animate-fade-in">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 className="w-9 h-9 text-emerald-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground">Email Verified Successfully!</h2>
                <p className="text-sm text-muted-foreground">
                  Your TAMS Pro agency account is confirmed. Opening your workspace...
                </p>
              </div>
              <Button
                onClick={() => navigate("/app/dashboard", { replace: true })}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 cursor-pointer shadow-lg"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* 3. CROSS-DEVICE / EXPIRED / ERROR STATE */}
          {status === "error" && (
            <div className="space-y-5 animate-fade-in text-left">
              <div className="text-center space-y-3">
                <div
                  className={
                    outcome.kind === "cross_device_confirmed"
                      ? "mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20"
                      : "mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20"
                  }
                >
                  {outcome.kind === "cross_device_confirmed" ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-amber-500" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-foreground">
                    {outcome.title}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {outcome.message}
                  </p>
                </div>
              </div>

              {outcome.kind === "cross_device_confirmed" && (
                <Button
                  type="button"
                  onClick={() => navigate("/login?verified=true", { replace: true })}
                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 cursor-pointer shadow-sm"
                >
                  <span>Go to Login</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}

              {/* Recovery Resend Form */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                <Label htmlFor="callback-email" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  Need a fresh link? Enter your registered email
                </Label>
                <Input
                  id="callback-email"
                  type="email"
                  placeholder="agency@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="h-10 text-xs"
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={resending || cooldownLeft > 0 || !emailInput.trim()}
                  onClick={() => handleResendVerification()}
                  className="w-full h-9 text-xs gap-1.5 cursor-pointer border-slate-300 dark:border-slate-700 font-medium"
                >
                  {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  <span>
                    {cooldownLeft > 0 ? `Resend in ${cooldownLeft}s` : "Resend Confirmation Link"}
                  </span>
                </Button>
              </div>

              <div className="pt-2 text-center">
                <Link
                  to="/login"
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  <span>Return to Login Screen</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

