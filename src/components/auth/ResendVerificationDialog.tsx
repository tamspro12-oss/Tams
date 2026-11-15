import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, CheckCircle2, Loader2 } from "lucide-react";
import { getAuthCallbackUrl } from "@/lib/authRedirect";
import { getResendCooldownRemaining, RESEND_COOLDOWN_SECONDS } from "@/lib/authFlowState";
import { logAndFriendlyMessage } from "@/lib/friendlyError";
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
}

export function ResendVerificationDialog({
  initialEmail = "",
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: ResendVerificationDialogProps) {
  const { toast } = useToast();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled ? setControlledOpen! : setUncontrolledOpen;

  const [email, setEmail] = useState(initialEmail);
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  useEffect(() => {
    if (!lastSentAt) {
      setCooldownLeft(0);
      return;
    }
    const tick = () => setCooldownLeft(getResendCooldownRemaining(lastSentAt));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [lastSentAt]);

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
    if (resending || cooldownLeft > 0) return;

    setResending(true);
    try {
      const redirectUrl = getAuthCallbackUrl();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      setSent(true);
      setLastSentAt(Date.now());
      setCooldownLeft(RESEND_COOLDOWN_SECONDS);
      toast({
        title: "Verification Email Sent",
        description: `We've sent a new confirmation link to ${email.trim()}. Please check your inbox and spam folder.`,
      });
    } catch (err: unknown) {
      const friendly = logAndFriendlyMessage(
        "ResendVerificationDialog.handleResend",
        err,
        "Could not resend the confirmation email right now. Please try again shortly."
      );
      toast({
        title: "Could not send verification email",
        description: friendly,
        variant: "destructive",
      });
    } finally {
      setResending(false);
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
            Enter your registered email address and we will send you a fresh confirmation link.
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
                  Please click the link in your email to confirm your account.
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
                  onClick={() => handleResend()}
                  disabled={resending || cooldownLeft > 0}
                  className="w-full text-xs font-semibold gap-1.5"
                >
                  {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  <span>
                    {cooldownLeft > 0 ? `Resend again in ${cooldownLeft}s` : "Resend Email"}
                  </span>
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

              <Button
                type="submit"
                disabled={resending || cooldownLeft > 0 || !email.trim()}
                className="w-full h-9 text-xs font-semibold gap-1.5 cursor-pointer"
              >
                {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                <span>
                  {cooldownLeft > 0 ? `Resend in ${cooldownLeft}s` : "Send Confirmation Link"}
                </span>
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

