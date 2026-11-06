import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Plane, ArrowLeft, UserPlus, Check, Crown, Zap, Star, Mail, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  agencyName: z.string().trim().min(2, "Agency name must be at least 2 characters").max(200),
  email: z.string().trim().email("Please enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
});

type PlanType = "free" | "monthly" | "yearly";

const plans: { id: PlanType; name: string; price: string; period: string; icon: typeof Star; features: string[]; popular?: boolean }[] = [
  {
    id: "free",
    name: "Free Trial",
    price: "Free",
    period: "14 days",
    icon: Zap,
    features: ["Full access for 14 days", "All features included", "No credit card needed"],
  },
  {
    id: "monthly",
    name: "Monthly",
    price: "14-Day Trial",
    period: "then paid",
    icon: Star,
    features: ["14-day free trial first", "All premium features", "Priority support"],
    popular: true,
  },
  {
    id: "yearly",
    name: "Yearly",
    price: "14-Day Trial",
    period: "then paid",
    icon: Crown,
    features: ["14-day free trial first", "Best value — save more", "Extended support"],
  },
];
export default function SignupPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("free");
  const [showPassword, setShowPassword] = useState(false);
  const [showVerifyMessage, setShowVerifyMessage] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = signupSchema.safeParse({
      fullName: formData.get("fullName"),
      agencyName: formData.get("agencyName"),
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!result.success) {
      toast({ title: "Please check your input", description: result.error.errors[0].message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const { fullName, agencyName, email, password } = result.data;

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, agency_name: agencyName, subscription_plan: selectedPlan },
          emailRedirectTo: window.location.origin + "/login",
        },
      });

      if (signUpError) {
        toast({ title: "Sign up failed", description: signUpError.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      // Check if session is already granted (Supabase email confirmations disabled or instant trial)
      if (signUpData?.session) {
        toast({
          title: "Account Created!",
          description: "Welcome to TAMS Pro! Redirecting to your dashboard...",
        });
        navigate("/app/dashboard", { replace: true });
        return;
      }

      // Try automatic immediate sign-in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!signInError && signInData?.session) {
        toast({
          title: "Welcome to TAMS Pro!",
          description: "Your account is ready. Redirecting to dashboard...",
        });
        navigate("/app/dashboard", { replace: true });
        return;
      }

      // If email confirmation is required by Supabase backend:
      setVerifyEmail(email);
      setShowVerifyMessage(true);
    } catch (err: any) {
      toast({
        title: "Registration error",
        description: err?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Email verification success screen
  if (showVerifyMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-accent p-4">
      <SeoHead title="Sign Up Free - TAMS Pro Travel Agency Software" description="Create your free TAMS Pro account and start managing bookings, vendors and invoices for your travel agency in minutes." path="/signup" />
        <div className="w-full max-w-md">
          <Card className="shadow-2xl border-0 backdrop-blur-sm bg-card/95">
            <CardContent className="pt-10 pb-8 space-y-6 text-center">
              <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <Mail className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold font-heading text-foreground">Check Your Email</h2>
                <p className="text-muted-foreground text-sm">
                  We sent a verification link to
                </p>
                <p className="text-primary font-semibold">{verifyEmail}</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-left">
                <p className="text-sm text-foreground font-medium">📩 Click the link in your email to verify</p>
                <p className="text-xs text-muted-foreground">
                  After verifying, you'll be redirected to the login page. Didn't receive it? Check your spam folder.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                🎉 Your <strong>14-day free trial</strong> starts as soon as you verify!
              </p>
              <Button onClick={() => navigate("/login")} className="w-full h-11 font-semibold">
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-accent p-4">
      <h1 className="sr-only">Create your free TAMS Pro account</h1>
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2 text-white/80 hover:text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        <Card className="shadow-2xl border-0 backdrop-blur-sm bg-card/95">
          <CardHeader className="space-y-3 text-center pb-3">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center shadow-lg">
                <Plane className="w-8 h-8 text-primary-foreground" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-2xl font-bold font-heading bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Create Account
                </CardTitle>
                <CardDescription className="text-sm">
                  Get started with TAMS Pro
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Plan Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Choose Your Plan</Label>
              <div className="grid grid-cols-3 gap-2">
                {plans.map((plan) => {
                  const Icon = plan.icon;
                  const isSelected = selectedPlan === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlan(plan.id)}
                      className={cn(
                        "relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 text-center",
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/40 hover:bg-muted/30"
                      )}
                    >
                      {plan.popular && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                          Popular
                        </span>
                      )}
                      <Icon className={cn("w-5 h-5", isSelected ? "text-primary" : "text-muted-foreground")} />
                      <span className={cn("text-xs font-semibold", isSelected ? "text-primary" : "text-foreground")}>
                        {plan.name}
                      </span>
                      <span className={cn("text-[11px]", isSelected ? "text-primary/70" : "text-muted-foreground")}>
                        {plan.price}
                      </span>
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Plan features hint */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {plans.find(p => p.id === selectedPlan)?.features.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                    <Check className="w-2.5 h-2.5 text-green-500" />
                    {f}
                  </span>
                ))}
              </div>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs font-semibold">Full Name</Label>
                  <Input id="fullName" name="fullName" placeholder="Your name" className="h-10" required autoComplete="name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agencyName" className="text-xs font-semibold">Agency Name</Label>
                  <Input id="agencyName" name="agencyName" placeholder="Agency name" className="h-10" required />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signup-email" className="text-xs font-semibold">Email</Label>
                <Input id="signup-email" name="email" type="email" placeholder="you@example.com" className="h-10" required autoComplete="email" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signup-password" className="text-xs font-semibold">Password</Label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    className="h-10 pr-10"
                    required
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

              <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  "Create Account"
                )}
              </Button>

              <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1">
                <Mail className="w-3 h-3" />
                A verification email will be sent to confirm your account
              </p>
            </form>

            <div className="pt-3 border-t border-border text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  Sign In
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-xs text-white/60">
            By signing up, you agree to our{" "}
            <Link to="/terms" className="underline hover:text-white/80">Terms</Link>
            {" "}and{" "}
            <Link to="/privacy" className="underline hover:text-white/80">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
