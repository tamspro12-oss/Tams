import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAgency } from "@/hooks/useAgency";
import { HardDrive, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function StorageQuotaMeter() {
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Storage Usage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Used</span>
            <span className="font-medium">
              {usedMB} MB / {maxMB} MB
            </span>
          </div>
          <Progress 
            value={percentage} 
            className={isCritical ? "bg-destructive/20" : isWarning ? "bg-warning/20" : ""}
          />
          <div className="text-xs text-muted-foreground text-right">
            {percentage.toFixed(1)}% used
          </div>
        </div>

        {isWarning && (
          <Alert variant={isCritical ? "destructive" : "default"}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {isCritical 
                ? "Storage almost full! Please delete unnecessary files or upgrade your plan."
                : "Storage usage is high. Consider cleaning up old files."}
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground">
          Plan: <span className="font-medium capitalize">{agency.subscription_plan || 'Free'}</span>
        </div>
      </CardContent>
    </Card>
  );
}