import { SeoHead } from "@/components/SeoHead";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plane, Monitor, Smartphone } from "lucide-react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { preloadEssentialData } from "@/lib/dataPreloader";
import { useViewMode } from "@/contexts/ViewModeContext";

const loginSchema = z.object({
  email: z.string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email must be less than 255 characters"),
  password: z.string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password must be less than 128 characters"),
});

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { viewMode, toggleViewMode } = useViewMode();
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
      import("@/lib/sessionManager").then(({ sessionManager }) => {
        sessionManager.startSession(data.user.id);
      });
      if (data.user.email) {
        import("@/lib/userDirectorySync").then(({ recordRegisteredAccount }) => {
          recordRegisteredAccount({
            id: data.user.id,
            email: data.user.email!,
            full_name: data.user.user_metadata?.full_name || data.user.email!.split("@")[0],
            agency_name: data.user.user_metadata?.agency_name || "Primary Agency",
          });
        });
      }
      preloadEssentialData(queryClient);

      toast({
        title: "Welcome back!",
        description: "You've successfully signed in",
      });
      navigate("/");
    }

    setLoading(false);
  };



  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-accent p-4 animate-fade-in">
      <SeoHead title="Sign In - TAMS Pro Account Access" description="Access your TAMS Pro travel agency account to manage bookings, vendors, invoices and reports securely." path="/auth" />
      <h1 className="sr-only">Sign in to your TAMS Pro account</h1>
      <div className="w-full max-w-md">
        {/* Premium Login Card */}
        <Card className="shadow-soft-xl border-0 backdrop-blur-sm bg-card/95 relative">
          {/* View Mode Toggle - Top Right */}
          <div className="absolute top-4 right-4 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                toggleViewMode();
                toast({
                  title: `Switched to ${viewMode === 'desktop' ? 'Mobile' : 'Desktop'} View`,
                  description: "Layout preference saved for all sessions",
                });
              }}
              className="gap-2 bg-white hover:bg-gray-50 border border-border shadow-sm font-medium text-foreground"
            >
              {viewMode === 'desktop' ? (
                <>
                  <Monitor className="h-4 w-4 text-primary" />
                  <span>Desktop</span>
                </>
              ) : (
                <>
                  <Smartphone className="h-4 w-4 text-primary" />
                  <span>Mobile</span>
                </>
              )}
            </Button>
          </div>
          <CardHeader className="space-y-6 text-center pb-6">
            {/* Logo & Branding */}
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center shadow-soft-lg">
                <Plane className="w-9 h-9 text-primary-foreground" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-3xl font-bold font-heading bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  TAMS
                </CardTitle>
                <CardDescription className="text-base font-medium">
                  TAMS Pro - Travel Agency Management System
                </CardDescription>
              </div>
            </div>
            
            {/* Secure Login Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-success/10 text-success rounded-full text-sm font-medium">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Secure Login
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
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
                <Label htmlFor="login-password" className="text-sm font-semibold">Password</Label>
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
                className="w-full h-12 text-base font-semibold shadow-soft-md hover:shadow-soft-lg" 
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
                Need access? Contact your administrator
              </p>
              <a href="/install" className="text-sm text-primary hover:underline font-medium">
                How to Install TAMS App
              </a>
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
