import { useClientPaymentHistoryLocal, useVendorPaymentHistoryLocal } from "@/hooks/useLocalPaymentHistory";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { History, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface InlinePaymentHistoryProps {
  entityId: string;
  entityType: "client" | "vendor";
}

export function InlinePaymentHistory({ entityId, entityType }: InlinePaymentHistoryProps) {
  const clientHistory = useClientPaymentHistoryLocal(entityType === "client" ? entityId : undefined);
  const vendorHistory = useVendorPaymentHistoryLocal(entityType === "vendor" ? entityId : undefined);
  
  const history = entityType === "client" ? clientHistory.history : vendorHistory.history;
  const isLoading = entityType === "client" ? clientHistory.isLoading : vendorHistory.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <History className="w-4 h-4" />
          <span>Payment History</span>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <History className="w-4 h-4" />
          <span>Payment History</span>
        </div>
        <p className="text-sm text-muted-foreground italic">No payments recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <History className="w-4 h-4" />
        <span>Payment History ({history.length})</span>
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {history.map((payment) => (
          <div
            key={payment.id}
            className="flex items-start justify-between p-3 rounded-md border bg-card/50 hover:bg-accent/30 transition-colors"
          >
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-success" />
                <p className="font-semibold text-success text-sm">
                  ₨ {Number(payment.payment_amount).toLocaleString()}
                </p>
                <Badge 
                  variant={payment.payment_type === "full" ? "default" : "secondary"}
                  className="text-xs h-5"
                >
                  {payment.payment_type === "full" ? "Full" : "Partial"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(payment.payment_date), "PPP")}
              </p>
              {payment.notes && (
                <p className="text-xs text-muted-foreground italic">
                  {payment.notes}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
