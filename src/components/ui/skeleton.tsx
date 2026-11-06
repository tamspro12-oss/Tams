import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn("animate-shimmer rounded-md bg-muted skeleton-loader", className)} 
      {...props} 
    />
  );
}

export { Skeleton };
