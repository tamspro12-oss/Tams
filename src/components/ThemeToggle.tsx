import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "h-9 w-9 rounded-xl border border-border/40 inline-flex items-center justify-center opacity-70",
          className
        )}
      >
        <span className="sr-only">Toggle theme</span>
      </div>
    );
  }

  const currentTheme = resolvedTheme || theme || "light";
  const isDark = currentTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "h-9 w-9 hover:bg-accent/10 active:bg-accent/10 rounded-xl inline-flex items-center justify-center transition-all duration-200 active:scale-95 touch-manipulation flex-shrink-0 border border-border/40 text-foreground",
        className
      )}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? (
        <Sun className="h-4.5 w-4.5 text-amber-400 transition-transform duration-200 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="h-4.5 w-4.5 text-slate-700 transition-transform duration-200 hover:-rotate-12" />
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}

