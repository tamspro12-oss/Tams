// src/components/PwaOnboardModal.tsx
import { usePwaInstall } from '@/hooks/usePwaInstall';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Monitor, Pin, Zap, Wifi } from 'lucide-react';

export function PwaOnboardModal() {
  const { showOnboarding, dismissOnboarding } = usePwaInstall();

  return (
    <Dialog open={showOnboarding} onOpenChange={(open) => !open && dismissOnboarding()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <Monitor className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">Welcome to TAMS Desktop</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            You're now running TAMS as a desktop application. Enjoy the full desktop experience!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Pin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Pin to Taskbar/Dock</p>
              <p className="text-xs text-muted-foreground">Quick access from your desktop anytime</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Zap className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Desktop Layout</p>
              <p className="text-xs text-muted-foreground">Optimized layout for larger screens</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Wifi className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Online Only</p>
              <p className="text-xs text-muted-foreground">Internet connection required for full functionality</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={dismissOnboarding} className="w-full">
            Got it, let's go!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
