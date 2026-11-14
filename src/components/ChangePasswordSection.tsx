import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { sessionManager } from "@/lib/sessionManager";
import { clearAllAgencyDataCache } from "@/lib/cacheManager";

export function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Password strength validation
  const passwordRequirements = {
    minLength: newPassword.length >= 8,
    hasUppercase: /[A-Z]/.test(newPassword),
    hasLowercase: /[a-z]/.test(newPassword),
    hasNumber: /\d/.test(newPassword),
  };

  const isPasswordStrong = Object.values(passwordRequirements).every(Boolean);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentPassword) {
      toast({
        title: "Current password required",
        description: "Please enter your current password",
        variant: "destructive",
      });
      return;
    }

    if (!isPasswordStrong) {
      toast({
        title: "Weak password",
        description: "Please ensure your password meets all requirements",
        variant: "destructive",
      });
      return;
    }

    if (!passwordsMatch) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirmation must match",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // First verify the current password by re-authenticating
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.email) {
        throw new Error("User not found");
      }

      // Re-authenticate with current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        toast({
          title: "Incorrect password",
          description: "The current password you entered is incorrect",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      // Sign out ALL sessions globally across ALL devices and purge cached state
      try {
        await (supabase as any).rpc("admin_revoke_user_sessions", { p_user_id: user.id });
      } catch {
        // Fallback if RPC not yet deployed; signOut({ scope: 'global' }) still runs
      }
      await supabase.auth.signOut({ scope: 'global' });
      sessionManager.endSession();
      clearAllAgencyDataCache();

      toast({
        title: "Password changed. Please login again.",
        description: "All active sessions across all devices have been signed out.",
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      navigate("/login?reason=password-changed", {
        replace: true,
        state: { message: "Password changed. Please login again." },
      });
    } catch (error: any) {
      console.error("Password change error:", error);
      toast({
        title: "Failed to change password",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full border shadow-xs">
      <CardHeader className="py-3 px-4 sm:px-5 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              Change Password
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Update your account password for enhanced security
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        <form onSubmit={handleChangePassword} className="space-y-3">
          {/* 3 Columns Desktop Row: Current Password, New Password, Confirm New Password */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
            {/* 1. Current Password */}
            <div className="space-y-1">
              <Label htmlFor="currentPassword" className="text-xs font-semibold">
                Current Password *
              </Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  className="pr-9 h-9 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </div>

            {/* 2. New Password */}
            <div className="space-y-1">
              <Label htmlFor="newPassword" className="text-xs font-semibold">
                New Password *
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 8 chars)"
                  required
                  className="pr-9 h-9 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
              {newPassword && (
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] pt-0.5">
                  <span className={passwordRequirements.minLength ? "text-green-600 font-medium" : "text-muted-foreground"}>
                    ✓ 8+ chars
                  </span>
                  <span className={passwordRequirements.hasUppercase ? "text-green-600 font-medium" : "text-muted-foreground"}>
                    ✓ Uppercase
                  </span>
                  <span className={passwordRequirements.hasLowercase ? "text-green-600 font-medium" : "text-muted-foreground"}>
                    ✓ Lowercase
                  </span>
                  <span className={passwordRequirements.hasNumber ? "text-green-600 font-medium" : "text-muted-foreground"}>
                    ✓ Number
                  </span>
                </div>
              )}
            </div>

            {/* 3. Confirm New Password */}
            <div className="space-y-1">
              <Label htmlFor="confirmPassword" className="text-xs font-semibold">
                Confirm New Password *
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  className="pr-9 h-9 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
              {confirmPassword && (
                <p className={`text-[10px] pt-0.5 ${passwordsMatch ? "text-green-600 font-medium" : "text-destructive"}`}>
                  {passwordsMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
                </p>
              )}
            </div>
          </div>

          {/* Bottom Bar: Compact 1-line Security Notice + Change Password Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t">
            <p className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-amber-600 dark:text-amber-400">Notice:</span> You will be logged out of all active devices & sessions after changing password.
            </p>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !currentPassword || !isPasswordStrong || !passwordsMatch}
              className="h-9 px-4 text-xs font-semibold w-full sm:w-auto shrink-0"
            >
              {isSubmitting ? "Changing..." : "Change Password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
