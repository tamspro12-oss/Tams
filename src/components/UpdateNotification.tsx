import { useState, useEffect, useCallback } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, X, Smartphone, ShieldCheck } from "lucide-react";
import { versionManager, type VersionCheckResult } from "@/lib/versionManager";
import { forceRefresh, isIOSPWA } from "@/lib/forceRefresh";
import { useToast } from "@/hooks/use-toast";

const DISMISSED_BUILD_KEY = "tams_dismissed_update_build";

function getDismissedBuild(): string | null {
  try {
    return sessionStorage.getItem(DISMISSED_BUILD_KEY);
  } catch {
    return null;
  }
}

function setDismissedBuild(buildId: string) {
  try {
    sessionStorage.setItem(DISMISSED_BUILD_KEY, buildId);
  } catch {
    // Ignore storage errors
  }
}

export function UpdateNotification() {
  const [showNotification, setShowNotification] = useState(false);
  const [newVersion, setNewVersion] = useState<string>("");
  const [latestBuildId, setLatestBuildId] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const surfaceUpdate = useCallback((result: VersionCheckResult, forceShow = false) => {
    if (!result.hasUpdate) return;
    const candidateId = result.latestBuildId || result.latestVersion;
    if (!forceShow && candidateId && getDismissedBuild() === candidateId) {
      return;
    }
    setNewVersion(result.latestVersion);
    setLatestBuildId(candidateId);
    setShowNotification(true);
  }, []);

  const checkVersion = useCallback(
    async (forceShow = false) => {
      try {
        const result = await versionManager.checkVersionAPI();
        if (result.hasUpdate) {
          surfaceUpdate(result, forceShow);
        }
      } catch (error) {
        console.error("Version check failed:", error);
      }
    },
    [surfaceUpdate]
  );

  useEffect(() => {
    const initialTimer = setTimeout(() => {
      void checkVersion(false);
    }, 1500);

    // Periodic check every 3 minutes for new Vercel deployments / features / bugfixes
    const versionCheckInterval = setInterval(() => {
      void checkVersion(false);
    }, 3 * 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkVersion(false);
      }
    };

    const handleOnline = () => {
      void checkVersion(false);
    };

    const handleUpdateAvailable = (event: Event) => {
      const detail = (event as CustomEvent<VersionCheckResult>).detail;
      if (detail?.hasUpdate) {
        surfaceUpdate(detail, true);
      }
    };

    const handleCheckEvent = () => {
      void checkVersion(true);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("tams:update-available", handleUpdateAvailable);
    window.addEventListener("tams:check-update", handleCheckEvent);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(versionCheckInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("tams:update-available", handleUpdateAvailable);
      window.removeEventListener("tams:check-update", handleCheckEvent);
    };
  }, [checkVersion, surfaceUpdate]);

  const handleForceUpdate = async () => {
    setIsUpdating(true);
    try {
      if (isIOSPWA()) {
        toast({
          title: "Updating App",
          description:
            "Refreshing to the latest version. Your saved data and login remain intact.",
          duration: 3000,
        });
      }

      await forceRefresh();
    } catch (error) {
      console.error("Update failed:", error);
      toast({
        title: "Update Failed",
        description: "Please refresh the page or reopen the app to update.",
        variant: "destructive",
      });
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    if (latestBuildId) {
      setDismissedBuild(latestBuildId);
    }
    setShowNotification(false);
  };

  if (!showNotification) return null;

  const iosMode = isIOSPWA();

  return (
    <Alert
      role="status"
      className="fixed left-4 right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:left-auto md:bottom-4 md:right-4 md:w-[390px] z-[60] bg-primary text-primary-foreground border border-primary-foreground/20 shadow-2xl rounded-xl p-4"
    >
      <div className="flex items-start gap-3">
        {iosMode ? (
          <Smartphone className="h-5 w-5 mt-0.5 shrink-0" />
        ) : (
          <RefreshCw className="h-5 w-5 mt-0.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <AlertTitle className="m-0 font-semibold text-sm flex items-center gap-2">
              <span>New Version Available</span>
              <Badge
                variant="secondary"
                className="text-[10px] font-mono px-1.5 py-0 h-5"
              >
                v{newVersion}
              </Badge>
            </AlertTitle>
          </div>
          <AlertDescription className="text-primary-foreground/95 mb-3 text-xs leading-relaxed space-y-1.5">
            <p>
              New features &amp; fixes are ready. Tap <strong>Update Now</strong> to load the latest version.
            </p>
            <p className="flex items-center gap-1.5 text-[11px] text-primary-foreground/85">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span>Your saved data and login stay 100% safe.</span>
            </p>
            {iosMode && (
              <p className="text-[11px] text-primary-foreground/85">
                Tip: If changes don&apos;t appear on iPhone, close and reopen the app once after updating.
              </p>
            )}
          </AlertDescription>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleForceUpdate}
              disabled={isUpdating}
              className="gap-2 min-h-[44px] md:min-h-[36px] flex-1 font-semibold rounded-lg"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isUpdating ? "animate-spin" : ""}`} />
              {isUpdating ? "Updating..." : "Update Now"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              disabled={isUpdating}
              className="gap-1.5 min-h-[44px] md:min-h-[36px] text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground rounded-lg"
            >
              <X className="h-3.5 w-3.5" />
              Later
            </Button>
          </div>
        </div>
      </div>
    </Alert>
  );
}
