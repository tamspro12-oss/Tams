import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface LoadingSkeletonProps {
  type?: "table" | "cards" | "detail";
  rows?: number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  type = "table",
  rows = 5,
}) => {
  if (type === "cards") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
          >
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (type === "detail") {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full border rounded-xl overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
      <div className="h-10 bg-slate-100 dark:bg-slate-800/60 flex items-center px-4 gap-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-24 ml-auto" />
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-12 flex items-center px-4 gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
};

