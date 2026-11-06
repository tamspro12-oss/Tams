// src/components/InstallDesktopButton.tsx
import { Download, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { cn } from '@/lib/utils';

export function InstallDesktopButton() {
  const { canInstall, isInstalled, triggerInstall, isSafari } = usePwaInstall();

  // If already installed, only show guide link
  if (isInstalled) {
    return null;
  }

  const buttonBaseClasses = cn(
    "group relative flex items-center gap-2.5 md:gap-3 px-3 md:px-4 py-2.5 md:py-3.5 rounded-lg text-sm font-medium w-full touch-manipulation select-none overflow-hidden",
    "transition-all duration-300 ease-out",
    "active:scale-[0.96] active:shadow-inner",
    "min-h-[44px]"
  );

  return (
    <div className="space-y-1.5">
      {/* Show install button if browser supports it */}
      {canInstall && (
        <button
          onClick={triggerInstall}
          className={cn(
            buttonBaseClasses,
            "bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/20 hover:scale-[1.01] hover:shadow-sm border border-sidebar-primary/20"
          )}
        >
          <Download className="w-5 h-5 flex-shrink-0" />
          <span className="text-base">Install App</span>
        </button>
      )}

      {/* Always show Installation Guide link (helpful for Safari/iOS users or those who need help) */}
      <Link
        to="/install"
        className={cn(
          buttonBaseClasses,
          "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground hover:scale-[1.01] hover:shadow-sm"
        )}
      >
        <HelpCircle className="w-5 h-5 flex-shrink-0" />
        <span className="text-base">{canInstall ? 'Install Guide' : 'How to Install'}</span>
      </Link>
    </div>
  );
}
