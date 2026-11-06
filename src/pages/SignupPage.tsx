import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plane, ArrowLeft, Shield, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { preloadEssentialData } from "@/lib/dataPreloader";

const signupSchema = z.object({
  agencyName: z
    .string()
    .trim()
    .min(2, "Agency name must be at least 2 characters")
    .max(200, "Agency name must be less than 200 characters"),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email must be less than 255 characters"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password must be less than 128 characters"),
  phone: z
    .string()
    .trim()
    .min(7, "Please enter a valid phone number (at least 7 digits)")
    .max(25, "Phone number is too long")
    .regex(/^[+0-9\s\-()]+$/, "Please enter a valid phone format (e.g. 03001234567 or +923001234567)"),
});

export default function SignupPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const validation = signupSchema.safeParse({
      agencyName: formData.get("agencyName"),
      email: formData.get("email"),
      password: formData.get("password"),
      phone: formData.get("phone"),
    });

    if (!validation.success) {
      toast({
        title: "Please check your input",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { agencyName, email, password, phone } = validation.data;

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
          // If auto sign-in threw because user already exists
          const signInMsg = signInError.message?.toLowerCase() || "";
          if (signInMsg.includes("invalid login credentials")) {
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-accent p-4">
      <SeoHead
        title="Sign Up - TAMS Pro Travel Agency Management"
        description="Create your free TAMS Pro account and start managing travel bookings, vendors, invoices and financial reports."
        path="/signup"
      />
      <h1 className="sr-only">Sign up for TAMS Pro</h1>

      <div className="w-full max-w-md">
        {/* Back to Home */}
        <div className="mb-4">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2 text-white/80 hover:text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        {/* Signup Card — exactly identical to LoginPage style */}
        <Card className="shadow-2xl border-0 backdrop-blur-sm bg-card/95">
          <CardHeader className="space-y-4 text-center pb-4 pt-6">
            {/* Logo & Branding */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center shadow-lg">
                <Plane className="w-8 h-8 text-primary-foreground" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-2xl sm:text-3xl font-bold font-heading bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  TAMS PRO
                </CardTitle>
                <CardDescription className="text-sm font-medium">
                  Create your Travel Agency account
                </CardDescription>
              </div>
            </div>

            {/* Secure Signup Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-600 rounded-full text-xs font-semibold mx-auto">
              <Shield className="w-3.5 h-3.5" />
              14-Day Free Access • Instant Setup
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pb-6">
            <form onSubmit={handleSignup} className="space-y-3.5">
              {/* Field 1: Agency Name */}
              <div className="space-y-1.5">
                <Label htmlFor="agencyName" className="text-xs font-semibold text-foreground">
                  Agency Name *
                </Label>
                <Input
                  id="agencyName"
                  name="agencyName"
                  type="text"
                  placeholder="e.g. Al-Haramain Travels"
                  className="h-10 sm:h-11 text-sm"
                  required
                  autoFocus
                />
              </div>

              {/* Field 2: Email */}
              <div className="space-y-1.5">
                <Label htmlFor="signup-email" className="text-xs font-semibold text-foreground">
                  Email Address *
                </Label>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  placeholder="agency@example.com"
                  className="h-10 sm:h-11 text-sm"
                  required
                  autoComplete="email"
                />
              </div>

              {/* Field 3: Password */}
              <div className="space-y-1.5">
                <Label htmlFor="signup-password" className="text-xs font-semibold text-foreground">
                  Password * (min 6 characters)
                </Label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="h-10 sm:h-11 text-sm pr-10"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Field 4: Phone Number */}
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-semibold text-foreground">
                  Phone Number *
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="e.g. 03001234567 or +923001234567"
                  className="h-10 sm:h-11 text-sm"
                  required
                  autoComplete="tel"
                />
              </div>

              {/* Create Account Button */}
              <div className="pt-1">
                <Button
                  type="submit"
                  className="w-full h-11 text-sm sm:text-base font-semibold shadow-lg hover:shadow-xl"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Creating Account...
                    </span>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </div>
            </form>

            {/* Already have an account? Sign In & Terms */}
            <div className="pt-3 border-t border-border text-center space-y-2">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-primary hover:underline font-semibold">
                  Sign In
                </Link>
              </p>
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
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
          </CardContent>
        </Card>

        {/* Footer Branding */}
        <div className="mt-4 text-center">
          <p className="text-xs text-white/80 font-medium">
            Developed by TAMS Pro
          </p>
        </div>
      </div>
    </div>
  );
}
