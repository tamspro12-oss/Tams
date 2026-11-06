import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { preloadEssentialData } from "@/lib/dataPreloader";

const signupSchema = z.object({
  agencyName: z
    .string()
    .trim()
    .min(2, "Agency name must be at least 2 characters")
    .max(200, "Agency name must be less than 200 characters"),
  phone: z
    .string()
    .trim()
    .min(7, "Please enter a valid phone number")
    .max(25, "Phone number is too long")
    .regex(/^[+0-9\s\-()]+$/, "Please enter a valid phone format (e.g. 03001234567 or +923001234567)"),
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

export default function SignupPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    agencyName?: string;
    phone?: string;
    email?: string;
    password?: string;
  }>({});

  const firstInputRef = useRef<HTMLInputElement>(null);

  // Autofocus first field on desktop only (avoids popping keyboard on mobile)
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      firstInputRef.current?.focus();
    }
  }, []);

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setFieldErrors({});
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const validation = signupSchema.safeParse({
      agencyName: formData.get("agencyName"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!validation.success) {
      const errors: { [key: string]: string } = {};
      validation.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        if (field && !errors[field]) {
          errors[field] = err.message;
        }
      });
      setFieldErrors(errors);

      toast({
        title: "Please check your input",
        description: validation.error.errors[0]?.message || "Invalid input",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { agencyName, phone, email, password } = validation.data;

    try {
      // 1. Create account with Supabase Auth (default plan = trial / free, 14-day access)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            agency_name: agencyName,
            full_name: agencyName,
            phone_number: phone,
            phone: phone,
            subscription_plan: "free",
          },
        },
      });

      // Handle existing email / user registration errors
      if (signUpError) {
        const msg = signUpError.message?.toLowerCase() || "";
        if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("unique constraint")) {
          setFieldErrors({ email: "This email is already registered. Please sign in." });
          toast({
            title: "Email already registered",
            description: "This email is already registered. Please sign in.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Unable to create account",
            description: signUpError.message || "Please check your information and try again.",
            variant: "destructive",
          });
        }
        setLoading(false);
        return;
      }

      // Check for user enumeration case where Supabase returns empty identities
      if (signUpData?.user && signUpData.user.identities && signUpData.user.identities.length === 0) {
        setFieldErrors({ email: "This email is already registered. Please sign in." });
        toast({
          title: "Email already registered",
          description: "This email is already registered. Please sign in.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // 2. Ensure active session (auto-login immediately)
      let activeSession = signUpData?.session;

      if (!activeSession) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          const signInMsg = signInError.message?.toLowerCase() || "";
          if (signInMsg.includes("invalid login credentials")) {
            setFieldErrors({ email: "This email is already registered. Please sign in." });
            toast({
              title: "Email already registered",
              description: "This email is already registered. Please sign in.",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
        }
        activeSession = signInData?.session || null;
      }

      // 3. Save / Sync agency_name and phone in the profiles / agencies table
      const activeUser = activeSession?.user || signUpData?.user;
      if (activeUser) {
        try {
          import("@/lib/sessionManager").then(({ sessionManager }) => {
            sessionManager.startSession(activeUser.id);
          });
          preloadEssentialData(queryClient);

          const { data: profile } = await supabase
            .from("profiles")
            .select("agency_id")
            .eq("id", activeUser.id)
            .maybeSingle();

          if (profile?.agency_id) {
            await supabase
              .from("agencies")
              .update({
                name: agencyName,
                phone_number: phone,
                contact_info: phone,
              })
              .eq("id", profile.agency_id);
          }
        } catch (syncErr) {
          console.warn("Post-signup profile sync:", syncErr);
        }
      }

      // 4. Success toast and instant redirect to dashboard
      toast({
        title: "Your account is confirmed. Welcome to TAMS Pro!",
        description: "Your 14-day free trial has started. Opening dashboard...",
      });

      navigate("/app/dashboard", { replace: true });
    } catch (err: any) {
      toast({
        title: "Registration error",
        description: err?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your agency account"
      subtitle="Start managing bookings, ledgers and quotes in minutes"
      type="signup"
      seoTitle="Sign Up - TAMS Pro Travel Agency Management"
      seoDescription="Create your free TAMS Pro account and start managing travel bookings, vendors, invoices and financial reports."
      seoPath="/signup"
    >
      <form onSubmit={handleSignup} className="space-y-3 sm:space-y-3.5">
        {/* 2-Column Grid on Desktop (>= 1024px), Single Column on Mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-3 lg:gap-3.5">
          {/* Row 1, Col 1: Agency Name */}
          <div className="space-y-1">
            <Label htmlFor="signup-agency" className="text-[13px] font-medium text-foreground">
              Agency Name
            </Label>
            <Input
              ref={firstInputRef}
              id="signup-agency"
              name="agencyName"
              type="text"
              autoComplete="organization"
              enterKeyHint="next"
              placeholder="e.g. Al-Haramain Travels"
              className={`h-11 sm:h-11 lg:h-11 text-[16px] sm:text-sm rounded-lg transition-colors focus-visible:ring-emerald-500 ${
                fieldErrors.agencyName ? "border-destructive focus-visible:ring-destructive" : ""
              }`}
              required
              onChange={() => {
                if (fieldErrors.agencyName) {
                  setFieldErrors((prev) => ({ ...prev, agencyName: undefined }));
                }
              }}
            />
            {fieldErrors.agencyName && (
              <p className="text-[11px] text-destructive font-medium leading-tight mt-0.5">
                {fieldErrors.agencyName}
              </p>
            )}
          </div>

          {/* Row 1, Col 2: Phone Number */}
          <div className="space-y-1">
            <Label htmlFor="signup-phone" className="text-[13px] font-medium text-foreground">
              Phone Number
            </Label>
            <Input
              id="signup-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="next"
              placeholder="e.g. 03001234567"
              className={`h-11 sm:h-11 lg:h-11 text-[16px] sm:text-sm rounded-lg transition-colors focus-visible:ring-emerald-500 ${
                fieldErrors.phone ? "border-destructive focus-visible:ring-destructive" : ""
              }`}
              required
              onChange={() => {
                if (fieldErrors.phone) {
                  setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                }
              }}
            />
            {fieldErrors.phone && (
              <p className="text-[11px] text-destructive font-medium leading-tight mt-0.5">
                {fieldErrors.phone}
              </p>
            )}
          </div>

          {/* Row 2, Col 1: Email Address */}
          <div className="space-y-1">
            <Label htmlFor="signup-email" className="text-[13px] font-medium text-foreground">
              Email Address
            </Label>
            <Input
              id="signup-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              enterKeyHint="next"
              placeholder="agency@example.com"
              className={`h-11 sm:h-11 lg:h-11 text-[16px] sm:text-sm rounded-lg transition-colors focus-visible:ring-emerald-500 ${
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
              <p className="text-[11px] text-destructive font-medium leading-tight mt-0.5">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Row 2, Col 2: Password */}
          <div className="space-y-1">
            <Label htmlFor="signup-password" className="text-[13px] font-medium text-foreground">
              Password
            </Label>
            <div className="relative">
              <Input
                id="signup-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                enterKeyHint="done"
                placeholder="•••••••• (min 6 chars)"
                className={`h-11 sm:h-11 lg:h-11 text-[16px] sm:text-sm rounded-lg pr-11 transition-colors focus-visible:ring-emerald-500 ${
                  fieldErrors.password ? "border-destructive focus-visible:ring-destructive" : ""
                }`}
                required
                minLength={6}
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
            {fieldErrors.password ? (
              <p className="text-[11px] text-destructive font-medium leading-tight mt-0.5">
                {fieldErrors.password}
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground/75 leading-none mt-0.5">
                Must be at least 6 characters
              </p>
            )}
          </div>
        </div>

        {/* Create Account Button */}
        <div className="pt-1.5">
          <Button
            type="submit"
            className="w-full h-11 sm:h-12 min-h-[44px] sm:min-h-[48px] rounded-lg text-sm sm:text-base font-semibold shadow-md hover:shadow-lg transition-all focus-visible:ring-emerald-500"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Creating Account...
              </span>
            ) : (
              "Create Account"
            )}
          </Button>
        </div>

        {/* Already have an account? Sign In & Terms */}
        <div className="pt-2 text-center space-y-1.5 border-t border-border/60">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-primary hover:underline font-semibold focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xs"
            >
              Sign In
            </Link>
          </p>
          <p className="text-[10.5px] text-muted-foreground/75 leading-tight">
            By creating an account, you agree to our{" "}
            <Link to="/terms" className="underline hover:text-foreground">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>.
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}
