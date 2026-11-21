import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  Share,
  PlusSquare,
  MoreVertical,
  Smartphone,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { cn } from "@/lib/utils";

export interface MobileInstallButtonProps {
  variant?: "public-header" | "app-header" | "drawer-card" | "hero-cta";
  onActionStart?: () => void;
  className?: string;
}

export const MobileInstallButton: React.FC<MobileInstallButtonProps> = ({
  variant = "drawer-card",
  onActionStart,
  className,
}) => {
  const { canInstall, isStandaloneApp, isIOS, triggerInstall } = usePwaInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Never show on desktop (>= 768px handles via md:hidden) or when already running inside installed PWA/Capacitor app
  if (isStandaloneApp) {
    return null;
  }

  const handleInstallClick = async () => {
    onActionStart?.();

    if (canInstall) {
      setInstalling(true);
      try {
        const result = await triggerInstall();
        if (result.outcome === "accepted") {
          toast.success("Installing TAMS Pro", {
            description: "App added to your home screen. Your data syncs automatically.",
          });
        } else if (result.outcome !== "dismissed") {
          setGuideOpen(true);
        }
      } catch {
        setGuideOpen(true);
      } finally {
        setInstalling(false);
      }
      return;
    }

    setGuideOpen(true);
  };

  return (
    <>
      {variant === "public-header" && (
        <div className={cn("md:hidden shrink-0", className)}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleInstallClick}
            disabled={installing}
            aria-label="Install TAMS App"
            className="h-11 w-11 min-[375px]:w-auto min-[375px]:px-3 rounded-xl text-xs font-semibold gap-1.5 border-[#0F5E63]/30 bg-teal-50/90 text-[#0F5E63] hover:bg-teal-100/90 hover:text-[#0B4A4E] shadow-xs"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span className="hidden min-[375px]:inline">
              {installing ? "Wait..." : "Install"}
            </span>
          </Button>
        </div>
      )}

      {variant === "app-header" && (
        <div className={cn("md:hidden shrink-0", className)}>
          <button
            type="button"
            onClick={handleInstallClick}
            disabled={installing}
            aria-label="Install TAMS App"
            title="Install App"
            className="h-11 w-11 rounded-xl inline-flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/15 active:scale-95 transition-all touch-manipulation"
          >
            <Download className="h-4.5 w-4.5" />
          </button>
        </div>
      )}

      {variant === "hero-cta" && (
        <div className={cn("md:hidden w-full", className)}>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleInstallClick}
            disabled={installing}
            className="w-full h-11 px-6 rounded-xl text-sm font-semibold gap-2 bg-teal-50/90 border border-[#0F5E63]/30 text-[#0F5E63] hover:bg-teal-100/80 hover:text-[#0B4A4E] shadow-xs transition-all"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>{installing ? "Installing..." : "Install Mobile App"}</span>
          </Button>
        </div>
      )}

      {variant === "drawer-card" && (
        <div className={cn("md:hidden w-full", className)}>
          <button
            type="button"
            onClick={handleInstallClick}
            disabled={installing}
            className="w-full min-h-[52px] flex items-center justify-between gap-3 p-3 rounded-xl border border-teal-500/30 bg-teal-50/80 dark:bg-teal-950/30 hover:bg-teal-100/70 dark:hover:bg-teal-950/50 transition-colors text-left touch-manipulation"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#0F5E63] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Download className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                  {installing ? "Installing TAMS Pro..." : "Install TAMS App"}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                  One-tap home screen app — instant access
                </p>
              </div>
            </div>
            <Smartphone className="w-4 h-4 text-[#0F5E63] dark:text-teal-400 shrink-0" />
          </button>
        </div>
      )}

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="md:hidden w-[calc(100vw-1rem)] max-w-md p-4 rounded-xl">
          <DialogHeader className="text-left pr-8">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Smartphone className="w-5 h-5 text-primary shrink-0" />
              <span>Install TAMS Pro App</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add TAMS Pro to your phone&apos;s home screen for fast app-style launch.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 text-xs">
            {isIOS ? (
              <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                <p className="font-semibold text-foreground">iPhone / iPad (Safari)</p>
                <div className="flex items-center gap-2.5">
                  <Share className="w-4 h-4 text-primary shrink-0" />
                  <span>
                    1. Tap the <strong>Share</strong> icon in Safari&apos;s bottom/top bar.
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <PlusSquare className="w-4 h-4 text-primary shrink-0" />
                  <span>
                    2. Tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                <p className="font-semibold text-foreground">Android (Chrome / Edge)</p>
                <div className="flex items-center gap-2.5">
                  <MoreVertical className="w-4 h-4 text-primary shrink-0" />
                  <span>
                    1. Tap the browser <strong>Menu (⋮)</strong> in the top-right corner.
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-primary shrink-0" />
                  <span>
                    2. Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/25 bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5 text-[11px] text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                All your bookings, ledgers, and agency settings sync automatically — zero data loss.
              </span>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setGuideOpen(false)}
              className="w-full min-h-[44px] rounded-xl"
            >
              Close
            </Button>
            <Button asChild className="w-full min-h-[44px] rounded-xl gap-1.5">
              <Link to="/install" onClick={() => setGuideOpen(false)}>
                <span>Full Install Guide</span>
                <ExternalLink className="w-4 h-4" />
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

