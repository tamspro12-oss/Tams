import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, AlertCircle, Mail, ShieldCheck, Loader2 } from "lucide-react";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";
import { ResendVerificationDialog } from "@/components/auth/ResendVerificationDialog";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { preloadEssentialData } from "@/lib/dataPreloader";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email must be less than 255 characters"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password must be less than 128 characters"),
});

export default function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  // Email verification recovery states
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [lastTypedPassword, setLastTypedPassword] = useState<string>("");
  const [resendingVerification, setResendingVerification] = useState(false);
  const [activatingFromLogin, setActivatingFromLogin] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);

  // Autofocus first field on desktop only (avoids popping keyboard on mobile)
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      emailInputRef.current?.focus();
    }
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setFieldErrors({});
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!result.success) {
      const errors: { email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as "email" | "password";
        if (field && !errors[field]) {
          errors[field] = err.message;
        }
      });
      setFieldErrors(errors);

      toast({
        title: "Please check your input",
        description: result.error.errors[0]?.message || "Invalid input",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { email, password } = result.data;
    setLastTypedPassword(password);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const isUnconfirmed =
        error.message?.toLowerCase().includes("email not confirmed") ||
        error.message?.toLowerCase().includes("unconfirmed") ||
        (error as any).code === "email_not_confirmed";

      if (isUnconfirmed) {
        setUnverifiedEmail(email);
        setFieldErrors({
          email: "Email verification is required before signing in",
        });
        toast({
          title: "Email verification required",
          description: "Your account is not verified yet. Please check your inbox or use the buttons below to activate.",
          variant: "destructive",
        });
      } else {
        setUnverifiedEmail(null);
        setFieldErrors({
          password: "Email or password does not match our records",
        });
        toast({
          title: "Unable to sign in",
          description: "Please check your email and password and try again",
          variant: "destructive",
        });
      }
      setLoading(false);
    } else if (data.user) {
      // Fire-and-forget — never block redirect
      import("@/lib/sessionManager").then(({ sessionManager }) => {
        sessionManager.startSession(data.user.id);
      });
      preloadEssentialData(queryClient);

      toast({
        title: "Welcome back!",
        description: "You've successfully signed in",
      });
      navigate("/app/dashboard");
      // keep loading=true to prevent flash before redirect
    }
  };

  const handleResendVerificationFromLogin = async (targetEmail: string) => {
    if (!targetEmail || resendingVerification) return;
    setResendingVerification(true);
    try {
      const redirectUrl = `${window.location.origin}/auth/callback?type=signup`;
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: targetEmail,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });
      if (error) throw error;
      toast({
        title: "Verification email sent",
        description: `A fresh confirmation link has been sent to ${targetEmail}. Please check your inbox and spam folder.`,
      });
    } catch (err: any) {
      toast({
        title: "Could not resend email",
        description: err.message || "Failed to resend email. Please try instant activation.",
        variant: "destructive",
      });
    } finally {
      setResendingVerification(false);
    }
  };

  const handleActivateAndLogin = async (targetEmail: string) => {
    if (!targetEmail || activatingFromLogin) return;
    setActivatingFromLogin(true);
    try {
      const { data, error } = await (supabase as any).rpc("verify_agency_account_fallback", {
        p_email: targetEmail,
      });
      if (error) throw error;

      toast({
        title: "Account verified & activated!",
        description: "Signing in to your dashboard...",
      });

      // If user typed password, auto sign-in
      if (lastTypedPassword) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password: lastTypedPassword,
        });

        if (!signInError && signInData?.user) {
          import("@/lib/sessionManager").then(({ sessionManager }) => {
            sessionManager.startSession(signInData.user.id);
          });
          preloadEssentialData(queryClient);
          navigate("/app/dashboard");
          return;
        }
      }

      setUnverifiedEmail(null);
      toast({
        title: "Account activated",
        description: "Please click Sign In with your password.",
      });
    } catch (err: any) {
      toast({
        title: "Activation Error",
        description: err.message || "Could not activate account. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setActivatingFromLogin(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your agency management dashboard"
      type="login"
      seoTitle="Login - TAMS Pro Travel Agency Management"
      seoDescription="Sign in to TAMS Pro to manage your travel agency bookings, vendors, invoices and financial reports."
      seoPath="/login"
    >
      <form onSubmit={handleLogin} className="space-y-4">
        {/* Email Address */}
        <div className="space-y-1.5">
          <Label htmlFor="login-email" className="text-[13px] font-medium text-foreground">
            Email Address
          </Label>
          <Input
            ref={emailInputRef}
            id="login-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            enterKeyHint="next"
            placeholder="agency@example.com"
            className={`h-11 sm:h-12 text-[16px] sm:text-sm rounded-lg transition-colors focus-visible:ring-emerald-500 ${
              fieldErrors.email ? "border-destructive focus-visible:ring-destructive" : ""
            }`}
            required
            onChange={() => {
              if (fieldErrors.email) {
                setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }
            }}
          />
          {fieldErrors.email && (
            <p className="text-xs text-destructive font-medium mt-1">
              {fieldErrors.email}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password" className="text-[13px] font-medium text-foreground">
              Password
            </Label>
            <div className="flex items-center gap-2.5">
              <ResendVerificationDialog
                initialEmail={unverifiedEmail || ""}
                trigger={
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    Resend link?
                  </button>
                }
              />
              <span className="text-muted-foreground/40 text-xs">•</span>
              <ForgotPasswordDialog />
            </div>
          </div>
          <div className="relative">
            <Input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              enterKeyHint="done"
              placeholder="••••••••"
              className={`h-11 sm:h-12 text-[16px] sm:text-sm rounded-lg pr-11 transition-colors focus-visible:ring-emerald-500 ${
                fieldErrors.password ? "border-destructive focus-visible:ring-destructive" : ""
              }`}
              required
              onChange={() => {
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
            />
            <button
              type="button"
              tabIndex={0}
              onClick={() => setShowPassword(!showPassword)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setShowPassword(!showPassword);
                }
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-hidden focus:text-foreground p-1.5 rounded-md transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="text-xs text-destructive font-medium mt-1">
              {fieldErrors.password}
            </p>
          )}
        </div>

        {/* Unverified Email Warning Card & Resend/Activation Actions */}
        {unverifiedEmail && (
          <div className="p-3.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 space-y-2.5 animate-fade-in text-xs shadow-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-900 dark:text-amber-200">
                  Email Verification Required
                </h4>
                <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                  Your account is registered, but your email (<strong className="font-semibold">{unverifiedEmail}</strong>) has not completed verification.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={resendingVerification}
                onClick={() => handleResendVerificationFromLogin(unverifiedEmail)}
                className="h-8 text-xs font-semibold gap-1.5 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer"
              >
                {resendingVerification ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3 text-amber-600" />}
                <span>Resend Email</span>
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={activatingFromLogin}
                onClick={() => handleActivateAndLogin(unverifiedEmail)}
                className="h-8 text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs"
              >
                {activatingFromLogin ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                <span>Activate Now</span>
              </Button>
            </div>
          </div>
        )}

        {/* Sign In Button */}
        <div className="pt-1">
          <Button
            type="submit"
            className="w-full h-11 sm:h-12 min-h-[44px] sm:min-h-[48px] rounded-lg text-sm sm:text-base font-semibold shadow-md hover:shadow-lg transition-all focus-visible:ring-emerald-500"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </Button>
        </div>

        {/* Switch to Sign Up */}
        <div className="pt-2 text-center">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="text-primary hover:underline font-semibold focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xs"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}
