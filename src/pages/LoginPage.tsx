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
import { Plane, ArrowLeft, Shield } from "lucide-react";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { preloadEssentialData } from "@/lib/dataPreloader";

const loginSchema = z.object({
  email: z.string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email must be less than 255 characters"),
  password: z.string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password must be less than 128 characters"),
});

export default function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    
    const result = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!result.success) {
      toast({
        title: "Please check your input",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { email, password } = result.data;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Unable to sign in",
        description: "Please check your email and password and try again",
        variant: "destructive",
      });
    } else if (data.user) {
      // Fire-and-forget — never block the redirect
      import("@/lib/sessionManager").then(({ sessionManager }) => {
        sessionManager.startSession(data.user.id);
      });
      preloadEssentialData(queryClient);

      toast({
        title: "Welcome back!",
        description: "You've successfully signed in",
      });
      navigate("/app/dashboard");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-accent p-4">
      <SeoHead title="Login - TAMS Pro Travel Agency Management" description="Sign in to TAMS Pro to manage your travel agency bookings, vendors, invoices and financial reports." path="/login" />
      <h1 className="sr-only">Sign in to TAMS Pro</h1>
      <div className="w-full max-w-md">
        {/* Back to Home */}
        <div className="mb-6">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2 text-white/80 hover:text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        {/* Login Card */}
        <Card className="shadow-2xl border-0 backdrop-blur-sm bg-card/95">
          <CardHeader className="space-y-6 text-center pb-6">
            {/* Logo & Branding */}
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center shadow-lg">
                <Plane className="w-9 h-9 text-primary-foreground" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-3xl font-bold font-heading bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  TAMS PRO
                </CardTitle>
                <CardDescription className="text-base font-medium">
                  TAMS Pro - Travel Agency Management System
                </CardDescription>
              </div>
            </div>
            
            {/* Secure Login Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-600 rounded-full text-sm font-medium">
              <Shield className="w-4 h-4" />
              Secure Login
            </div>
          </CardHeader>
          
          <CardContent className="space-y-5">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-sm font-semibold">Email Address</Label>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  placeholder="your.email@example.com"
                  className="h-12"
                  required
                  autoComplete="email"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password" className="text-sm font-semibold">Password</Label>
                  <ForgotPasswordDialog />
                </div>
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  className="h-12"
                  required
                  autoComplete="current-password"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl" 
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
            
            {/* Footer Message */}
            <div className="pt-4 border-t border-border text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Don't have an account? <Link to="/signup" className="text-primary hover:underline font-medium">Sign Up</Link>
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Footer Branding */}
        <div className="mt-8 text-center">
          <p className="text-sm text-white/80 font-medium">
            <span className="font-semibold">Developed by TAMS Pro</span>
          </p>
        </div>
      </div>
    </div>
  );
}
