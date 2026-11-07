import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAgency } from "@/hooks/useAgency";
import { HardDrive, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface StorageQuotaMeterProps {
  className?: string;
}

export function StorageQuotaMeter({ className }: StorageQuotaMeterProps) {
  const { data: agency } = useAgency();
  const [usage, setUsage] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agency?.id) return;

    const fetchUsage = async () => {
      try {
        const { data, error } = await supabase.rpc('get_agency_storage_usage', {
          p_agency_id: agency.id
        });

        if (error) throw error;
        setUsage(data || 0);
      } catch (error) {
        console.error("Error fetching storage usage:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchUsage, 30000);
    return () => clearInterval(interval);
  }, [agency?.id]);

  if (loading || !agency) {
    return null;
  }

  const maxBytes = agency.max_storage_bytes || 1073741824; // 1GB default
  const usedMB = (usage / (1024 * 1024)).toFixed(2);
  const maxMB = (maxBytes / (1024 * 1024)).toFixed(0);
  const percentage = Math.min((usage / maxBytes) * 100, 100);
  
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 95;

  return (
    <Card className={cn("h-full flex flex-col justify-between", className)}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <HardDrive className="h-4.5 w-4.5 text-primary" />
          Storage Usage
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-1 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-muted-foreground">Used</span>
            <span className="font-semibold">
              {usedMB} MB / {maxMB} MB
            </span>
          </div>
          <Progress 
            value={percentage} 
            className={isCritical ? "bg-destructive/20 h-2.5" : isWarning ? "bg-warning/20 h-2.5" : "h-2.5"}
          />
          <div className="text-[11px] text-muted-foreground text-right font-medium">
            {percentage.toFixed(1)}% used
          </div>
        </div>

        {isWarning && (
          <Alert variant={isCritical ? "destructive" : "default"} className="py-2 text-xs">
            <AlertCircle className="h-3.5 w-3.5" />
            <AlertDescription className="text-xs">
              {isCritical 
                ? "Storage almost full! Please delete unnecessary files or upgrade your plan."
                : "Storage usage is high. Consider cleaning up old files."}
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground pt-2 border-t flex items-center justify-between">
          <span>Subscription Plan:</span>
          <span className="font-semibold capitalize text-foreground">{agency.subscription_plan || 'Free'}</span>
        </div>
      </CardContent>
    </Card>
  );
}