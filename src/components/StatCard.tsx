import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  variant?: "default" | "success" | "warning" | "accent";
  onClick?: () => void;
}

function AnimatedCounter({ value }: { value: string | number }) {
  const [displayed, setDisplayed] = useState<string | number>(value);
  const prevRef = useRef<string | number>(value);

  useEffect(() => {
    const strVal = String(value);
    const strPrev = String(prevRef.current);
    
    // Try to animate numeric values
    const numMatch = strVal.match(/^([₨$€£]?\s?)(\d+)(K?)$/);
    const prevMatch = strPrev.match(/^([₨$€£]?\s?)(\d+)(K?)$/);
    
    if (numMatch && prevMatch && numMatch[1] === prevMatch[1] && numMatch[3] === prevMatch[3]) {
      const from = parseInt(prevMatch[2]);
      const to = parseInt(numMatch[2]);
      const prefix = numMatch[1];
      const suffix = numMatch[3];
      const duration = 600;
      const steps = 30;
      const stepTime = duration / steps;
      let step = 0;
      
      const timer = setInterval(() => {
        step++;
        const progress = step / steps;
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = Math.round(from + (to - from) * eased);
        setDisplayed(`${prefix}${current}${suffix}`);
        if (step >= steps) {
          clearInterval(timer);
          setDisplayed(value);
        }
      }, stepTime);
      
      prevRef.current = value;
      return () => clearInterval(timer);
    } else {
      setDisplayed(value);
      prevRef.current = value;
    }
  }, [value]);

  return <>{displayed}</>;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  variant = "default",
  onClick,
}: StatCardProps) {
  const variantStyles = {
    default: "bg-card hover:shadow-card-hover border-border/60",
    success: "bg-card border-success/20 hover:border-success/40 hover:shadow-card-hover",
    warning: "bg-card border-warning/20 hover:border-warning/40 hover:shadow-card-hover",
    accent: "bg-card border-accent/20 hover:border-accent/40 hover:shadow-card-hover",
  };

  const iconStyles = {
    default: "bg-primary/8 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    accent: "bg-accent/10 text-accent",
  };

  return (
    <Card
      className={cn(
        "transition-all duration-300 border animate-fade-in group",
        variantStyles[variant],
        onClick && "cursor-pointer hover:scale-[1.02] active:scale-[0.99]"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 sm:p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2.5 flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-3xl sm:text-4xl font-bold text-foreground font-mono tabular-nums leading-none tracking-tight-display">
              <AnimatedCounter value={value} />
            </p>
            {trend && (
              <p
                className={cn(
                  "text-xs font-semibold flex items-center gap-1.5 mt-1",
                  trend.positive ? "text-success" : "text-destructive"
                )}
              >
                <span className={cn(
                  "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px]",
                  trend.positive ? "bg-success/10" : "bg-destructive/10"
                )}>
                  {trend.positive ? "↑" : "↓"}
                </span>
                {trend.value}
              </p>
            )}
          </div>
          <div className={cn(
            "p-3 rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-soft-md",
            iconStyles[variant]
          )}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
