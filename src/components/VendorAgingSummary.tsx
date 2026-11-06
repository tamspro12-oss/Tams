import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { useClients } from "@/hooks/useStorage";

interface VendorAgingSummaryProps {
  vendorId: string;
  totalOutstanding: number;
}

interface AgingBucket {
  label: string;
  range: string;
  amount: number;
  count: number;
  color: string;
}

export function VendorAgingSummary({ vendorId, totalOutstanding }: VendorAgingSummaryProps) {
  const { clients } = useClients();

  // Calculate aging buckets from existing client bookings (read-only calculation)
  const agingBuckets = useMemo((): AgingBucket[] => {
    const today = new Date();
    const vendorClients = clients.filter(c => c.vendor_id === vendorId);
    
    // Initialize buckets
    const buckets = {
      "0-7": { amount: 0, count: 0 },
      "8-15": { amount: 0, count: 0 },
      "16-30": { amount: 0, count: 0 },
      "30+": { amount: 0, count: 0 },
    };

    // Calculate outstanding per client and categorize by age
    vendorClients.forEach(client => {
      const purchasingPrice = Number(client.purchasing_price) || 0;
      if (purchasingPrice <= 0) return;

      // Use flight_date or created_at to determine age
      const referenceDate = client.flight_date || client.created_at;
      if (!referenceDate) return;

      const daysSince = differenceInDays(today, parseISO(referenceDate));
      
      if (daysSince <= 7) {
        buckets["0-7"].amount += purchasingPrice;
        buckets["0-7"].count++;
      } else if (daysSince <= 15) {
        buckets["8-15"].amount += purchasingPrice;
        buckets["8-15"].count++;
      } else if (daysSince <= 30) {
        buckets["16-30"].amount += purchasingPrice;
        buckets["16-30"].count++;
      } else {
        buckets["30+"].amount += purchasingPrice;
        buckets["30+"].count++;
      }
    });

    return [
      { 
        label: "0-7 Days", 
        range: "0-7", 
        amount: buckets["0-7"].amount, 
        count: buckets["0-7"].count,
        color: "bg-success/10 text-success border-success/20" 
      },
      { 
        label: "8-15 Days", 
        range: "8-15", 
        amount: buckets["8-15"].amount, 
        count: buckets["8-15"].count,
        color: "bg-blue-500/10 text-blue-600 border-blue-500/20" 
      },
      { 
        label: "16-30 Days", 
        range: "16-30", 
        amount: buckets["16-30"].amount, 
        count: buckets["16-30"].count,
        color: "bg-warning/10 text-warning border-warning/20" 
      },
      { 
        label: "30+ Days", 
        range: "30+", 
        amount: buckets["30+"].amount, 
        count: buckets["30+"].count,
        color: "bg-destructive/10 text-destructive border-destructive/20" 
      },
    ];
  }, [clients, vendorId]);

  // Only show if there's outstanding amount
  if (totalOutstanding <= 0) {
    return null;
  }

  const hasAnyAging = agingBuckets.some(b => b.count > 0);
  
  if (!hasAnyAging) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span>Booking Age Distribution</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {agingBuckets.map((bucket) => (
          <div 
            key={bucket.range}
            className={`p-2.5 rounded-lg border ${bucket.color}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">{bucket.label}</span>
              {bucket.range === "30+" && bucket.count > 0 && (
                <AlertTriangle className="w-3 h-3" />
              )}
            </div>
            <p className="text-sm font-bold">
              ₨ {bucket.amount.toLocaleString()}
            </p>
            <p className="text-[10px] opacity-70">
              {bucket.count} booking{bucket.count !== 1 ? 's' : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
