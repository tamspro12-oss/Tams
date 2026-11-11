import { SeoHead } from "@/components/SeoHead";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Mail } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { isMasterAdminEmail } from "@/lib/adminAuth";

export default function SubscriptionExpired() {
  const navigate = useNavigate();
  const { data: subscription, isLoading } = useSubscription();

  useEffect(() => {
    const checkMasterAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (isMasterAdminEmail(user?.email)) {
        navigate("/app/dashboard", { replace: true });
        return;
      }
      await supabase.auth.signOut({ scope: 'local' });
    };
    checkMasterAdmin();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    navigate("/auth");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-destructive/20 via-background to-destructive/10">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-destructive/20 via-background to-destructive/10 p-4 animate-fade-in">
      <SeoHead title="Subscription Expired - TAMS Pro" description="Your TAMS Pro subscription has expired. Renew to restore access to your travel agency bookings and reports." path="/subscription-expired" />
      <h1 className="sr-only">TAMS Pro subscription expired</h1>
      <div className="w-full max-w-md">
        <Card className="shadow-soft-xl border-destructive/20 backdrop-blur-sm bg-card/95">
          <CardHeader className="space-y-6 text-center pb-6">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center shadow-soft-lg">
                <AlertCircle className="w-9 h-9 text-destructive" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-3xl font-bold font-heading text-destructive">
                  Subscription Expired
                </CardTitle>
                <CardDescription className="text-base">
                  Your access to TAMS has ended
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="space-y-4 text-center">
              {subscription?.agencyName && (
                <p className="text-sm text-muted-foreground">
                  Agency: <span className="font-semibold text-foreground">{subscription.agencyName}</span>
                </p>
              )}
              
              {subscription?.plan && (
                <p className="text-sm text-muted-foreground">
                  Plan: <span className="font-semibold text-foreground capitalize">{subscription.plan}</span>
                </p>
              )}

              <div className="pt-4 pb-2">
                <p className="text-sm text-foreground font-medium mb-2">
                  Please contact your administrator to renew your subscription.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
                <Mail className="w-4 h-4" />
                <span>Support: tamspro12@gmail.com</span>
              </div>
            </div>

            <Button 
              onClick={handleLogout}
              variant="outline"
              className="w-full h-12 text-base font-semibold" 
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground font-medium">
            <span className="font-semibold">Developed by TAMS Developers</span>
          </p>
        </div>
      </div>
    </div>
  );
}
