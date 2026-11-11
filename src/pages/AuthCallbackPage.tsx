import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Loader2, Mail, ArrowRight, ShieldCheck } from "lucide-react";
import { sessionManager } from "@/lib/sessionManager";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [emailInput, setEmailInput] = useState<string>(searchParams.get("email") || "");
  const [resending, setResending] = useState<boolean>(false);
  const [activating, setActivating] = useState<boolean>(false);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");
        if (error) {
          throw new Error(errorDescription || error || "Email verification failed or expired.");
        }

        // 1. PKCE Code Exchange (e.g. ?code=...)
        const code = searchParams.get("code");
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          if (data?.user) {
            sessionManager.startSession(data.user.id);
            setStatus("success");
            setTimeout(() => navigate("/app/dashboard", { replace: true }), 1500);
            return;
          }
        }

        // 2. Token Hash verification (e.g. ?token_hash=...&type=signup|email_verification)
        const tokenHash = searchParams.get("token_hash");
        const type = searchParams.get("type");
        if (tokenHash) {
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: (type as any) || "signup",
          });
          if (verifyError) throw verifyError;
          if (data?.user) {
            sessionManager.startSession(data.user.id);
            setStatus("success");
            setTimeout(() => navigate("/app/dashboard", { replace: true }), 1500);
            return;
          }
        }

        // 3. Hash Fragment tokens (e.g. #access_token=...&refresh_token=...)
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (sessionData?.session?.user) {
          sessionManager.startSession(sessionData.session.user.id);
          setStatus("success");
          setTimeout(() => navigate("/app/dashboard", { replace: true }), 1500);
          return;
        }

        // If no code, token or session is detected, check if we arrived here by mistake
        throw new Error("No valid verification code or token found in the confirmation URL.");
      } catch (err: any) {
        console.warn("Auth verification callback error:", err);
        setStatus("error");
        setErrorMessage(
          err?.message || "This email verification link is invalid, expired, or was already used."
        );
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

    setResending(true);
    try {
      const redirectUrl = `${window.location.origin}/auth/callback?type=signup`;
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: emailInput.trim(),
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Verification Email Sent",
        description: `We've sent a fresh verification link to ${emailInput.trim()}. Please check your inbox and spam folder.`,
      });
    } catch (err: any) {
      toast({
        title: "Could not resend email",
        description: err.message || "Failed to resend verification link. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  // Direct Account Activation Override Fallback
  const handleInstantActivate = async () => {
    if (!emailInput.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter your registered email address to activate your account.",
        variant: "destructive",
      });
      return;
    }

    setActivating(true);
    try {
      const { data, error } = await supabase.rpc("verify_agency_account_fallback" as any, {
        p_email: emailInput.trim(),
      });

      if (error) throw error;

      if (data && data.success) {
        toast({
          title: "Account Activated!",
          description: "Your agency account has been verified. You can now sign in immediately.",
        });
        setStatus("success");
        setTimeout(() => navigate("/login?verified=true", { replace: true }), 1500);
      } else {
        throw new Error(data?.message || "Could not activate account.");
      }
    } catch (err: any) {
      toast({
        title: "Activation Error",
        description: err.message || "Could not activate account automatically. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setActivating(false);
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
                  Your TAMS Pro agency account is now fully active. Opening your dashboard...
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

          {/* 3. ERROR / FALLBACK STATE */}
          {status === "error" && (
            <div className="space-y-5 animate-fade-in text-left">
              <div className="text-center space-y-3">
                <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                  <AlertCircle className="w-8 h-8 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-foreground">
                    Verification Link Expired or Broken
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">{errorMessage}</p>
                </div>
              </div>

              {/* Recovery Form */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                <Label htmlFor="callback-email" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  Your Registered Email Address
                </Label>
                <Input
                  id="callback-email"
                  type="email"
                  placeholder="agency@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="h-10 text-xs"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={resending || !emailInput.trim()}
                    onClick={() => handleResendVerification()}
                    className="h-9 text-xs gap-1.5 cursor-pointer border-slate-300 dark:border-slate-700 font-medium"
                  >
                    {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                    <span>Resend Link</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    disabled={activating || !emailInput.trim()}
                    onClick={handleInstantActivate}
                    className="h-9 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer shadow-xs"
                  >
                    {activating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    <span>Activate Now</span>
                  </Button>
                </div>
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

