import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshCw, X, Smartphone } from "lucide-react";
import { versionManager } from "@/lib/versionManager";
import { forceRefresh, isIOSPWA } from "@/lib/forceRefresh";
import { useToast } from "@/hooks/use-toast";

export function UpdateNotification() {
  const [showNotification, setShowNotification] = useState(false);
  const [newVersion, setNewVersion] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check version on load using API
    const checkVersion = async () => {
      try {
        const result = await versionManager.checkVersionAPI();
        if (result.hasUpdate) {
          setNewVersion(result.latestVersion);
          setShowNotification(true);
        }
      } catch (error) {
        console.error('Version check failed:', error);
      }
    };

    checkVersion();

    // Periodic version check every 5 minutes for backend updates
    const versionCheckInterval = setInterval(checkVersion, 5 * 60 * 1000);

    // Check if service worker has an update
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        // Check for updates immediately
        registration.update();

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                checkVersion();
              }
            });
          }
        });
      });
    }

    return () => clearInterval(versionCheckInterval);
  }, []);

  const handleForceUpdate = async () => {
    setIsUpdating(true);
    try {
      if (isIOSPWA()) {
        // Show iOS-specific instructions
        toast({
          title: "Updating iOS App",
          description: "Clearing caches... Please close and reopen the app after this completes.",
          duration: 3000,
        });
      }
      
      await forceRefresh();
    } catch (error) {
      console.error('Force update failed:', error);
      toast({
        title: "Update Failed",
        description: "Please try closing and reopening the app manually.",
        variant: "destructive",
      });
      setIsUpdating(false);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleDismiss = () => {
    setShowNotification(false);
  };

  if (!showNotification) return null;

  const iosMode = isIOSPWA();

  return (
    <Alert className="fixed bottom-4 right-4 w-auto max-w-md z-50 bg-primary text-primary-foreground border-primary shadow-2xl">
      <div className="flex items-start gap-3">
        {iosMode ? <Smartphone className="h-5 w-5 mt-0.5" /> : <RefreshCw className="h-5 w-5 mt-0.5" />}
        <div className="flex-1">
          <AlertTitle className="mb-1 font-semibold">
            {iosMode ? "iOS App Update Available" : "New Version Available"}
          </AlertTitle>
          <AlertDescription className="text-primary-foreground/90 mb-3 text-sm">
            {iosMode ? (
              <>
                <p className="font-medium mb-2">Version {newVersion} is ready!</p>
                <p className="text-xs leading-relaxed">To update your iOS app:</p>
                <ol className="text-xs leading-relaxed mt-1 ml-4 list-decimal space-y-1">
                  <li>Tap "Force Update" below</li>
                  <li>Close this app completely</li>
                  <li>Reopen from home screen</li>
                </ol>
              </>
            ) : (
              <>Version {newVersion} is ready. Refresh to update with the latest features and improvements.</>
            )}
          </AlertDescription>
          <div className="flex gap-2 flex-wrap">
            {iosMode ? (
              <Button 
                size="sm" 
                variant="secondary"
                onClick={handleForceUpdate}
                disabled={isUpdating}
                className="gap-2"
              >
                <RefreshCw className={`h-3 w-3 ${isUpdating ? 'animate-spin' : ''}`} />
                {isUpdating ? 'Updating...' : 'Force Update'}
              </Button>
            ) : (
              <>
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={handleRefresh}
                  className="gap-2"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh Now
                </Button>
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={handleForceUpdate}
                  disabled={isUpdating}
                  className="gap-2"
                >
                  <RefreshCw className={`h-3 w-3 ${isUpdating ? 'animate-spin' : ''}`} />
                  Force Update
                </Button>
              </>
            )}
            <Button 
              size="sm" 
              variant="ghost"
              onClick={handleDismiss}
              disabled={isUpdating}
              className="gap-2"
            >
              <X className="h-3 w-3" />
              Later
            </Button>
          </div>
        </div>
      </div>
    </Alert>
  );
}
