import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, CheckCircle2, Loader2, ShieldCheck, HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ResendVerificationDialogProps {
  initialEmail?: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onAccountActivated?: (email: string) => void;
}

export function ResendVerificationDialog({
  initialEmail = "",
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onAccountActivated,
}: ResendVerificationDialogProps) {
  const { toast } = useToast();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled ? setControlledOpen! : setUncontrolledOpen;

  const [email, setEmail] = useState(initialEmail);
  const [resending, setResending] = useState(false);
  const [activating, setActivating] = useState(false);
  const [sent, setSent] = useState(false);

  // Sync initialEmail when opened
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && initialEmail && !email) {
      setEmail(initialEmail);
    }
    if (!nextOpen) {
      setSent(false);
    }
  };

  const handleResend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter your agency account email.",
        variant: "destructive",
      });
      return;
    }

    setResending(true);
    try {
      const redirectUrl = `${window.location.origin}/auth/callback?type=signup`;
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      setSent(true);
      toast({
        title: "Verification Email Sent",
        description: `We've sent a new confirmation link to ${email.trim()}. Please check your inbox and spam folder.`,
      });
    } catch (err: any) {
      toast({
        title: "Could not send verification email",
        description: err.message || "Failed to resend confirmation link. Please try again or use direct activation.",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  const handleInstantActivate = async () => {
    if (!email.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter your registered email address.",
        variant: "destructive",
      });
      return;
    }

    setActivating(true);
    try {
      const { data, error } = await supabase.rpc("verify_agency_account_fallback" as any, {
        p_email: email.trim(),
      });

      if (error) throw error;

      if (data && data.success) {
        toast({
          title: "Account Activated!",
          description: "Your agency account has been verified. You can now sign in immediately.",
        });
        setOpen(false);
        if (onAccountActivated) {
          onAccountActivated(email.trim());
        }
      } else {
        throw new Error(data?.message || "Could not activate account.");
      }
    } catch (err: any) {
      toast({
        title: "Activation Error",
        description: err.message || "Account activation could not be completed. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setActivating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="w-[96vw] max-w-md p-0 gap-0 overflow-hidden bg-card border border-border shadow-2xl rounded-2xl">
        <DialogHeader className="px-5 py-4 border-b shrink-0 bg-muted/30">
          <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <Mail className="w-4 h-4 text-primary" />
            <span>Resend Verification Email</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            If your email confirmation link expired or failed to open, you can request a new link or activate your account directly.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-4 text-xs">
          {sent ? (
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">Verification Email Dispatched!</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  We've sent a fresh confirmation link to <strong className="text-foreground">{email}</strong>.
                  Please click the link in your email to activate your account.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Can't find it? Check your spam or promotions folder.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleInstantActivate}
                  disabled={activating}
                  className="w-full text-xs font-semibold gap-1.5"
                >
                  {activating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />}
                  <span>Or Activate Account Instantly Without Waiting</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="w-full text-xs"
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleResend} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="resend-email" className="text-xs font-semibold text-foreground">
                  Agency Email Address
                </Label>
                <Input
                  id="resend-email"
                  type="email"
                  required
                  placeholder="agency@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 text-xs"
                />
              </div>

              <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200 space-y-1 text-[11px]">
                <div className="font-semibold flex items-center gap-1">
                  <HelpCircle className="w-3 h-3 text-blue-600" />
                  <span>Activation Options:</span>
                </div>
                <p className="leading-relaxed">
                  You can send a fresh confirmation link to your inbox, or use <strong>Instant Activation</strong> to verify your account right away.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <Button
                  type="submit"
                  disabled={resending || !email.trim()}
                  className="h-9 text-xs font-semibold gap-1.5 cursor-pointer"
                >
                  {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  <span>Send Email Link</span>
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={activating || !email.trim()}
                  onClick={handleInstantActivate}
                  className="h-9 text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs"
                >
                  {activating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>Instant Activate</span>
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

