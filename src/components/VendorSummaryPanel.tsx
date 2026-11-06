import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Wallet, 
  TrendingUp, 
  Clock, 
  CalendarDays, 
  Briefcase,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { useVendorPaymentHistoryLocal } from "@/hooks/useLocalPaymentHistory";

interface VendorSummaryPanelProps {
  vendor: {
    id: string;
    totalPayable: number;
    amountPaid: number;
    amountPending: number;
    clientBookingsCount: number;
    fromBookingsTotal: number;
    vendorDirectAmount: number;
  };
}

export function VendorSummaryPanel({ vendor }: VendorSummaryPanelProps) {
  const { history } = useVendorPaymentHistoryLocal(vendor.id);

  // Get last transaction date from payment history (read-only)
  const lastTransactionDate = useMemo(() => {
    if (history.length === 0) return null;
    const sortedHistory = [...history].sort(
      (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
    );
    return sortedHistory[0]?.payment_date;
  }, [history]);

  // Derive payment status (read-only, from existing values)
  const paymentStatus = useMemo(() => {
    if (vendor.amountPaid >= vendor.totalPayable && vendor.totalPayable > 0) {
      return { label: "Paid", variant: "default" as const, className: "bg-success text-success-foreground" };
    } else if (vendor.amountPaid > 0) {
      return { label: "Partial", variant: "secondary" as const, className: "bg-warning/20 text-warning" };
    }
    return { label: "Pending", variant: "outline" as const, className: "bg-destructive/10 text-destructive" };
  }, [vendor.amountPaid, vendor.totalPayable]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 p-3 rounded-lg bg-muted/30 border">
      {/* Total Bookings */}
      <div className="flex items-center gap-2 p-2">
        <Briefcase className="w-4 h-4 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground truncate">Bookings</p>
          <p className="text-sm font-bold">{vendor.clientBookingsCount}</p>
        </div>
      </div>

      {/* Total Payable */}
      <div className="flex items-center gap-2 p-2">
        <Wallet className="w-4 h-4 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground truncate">Total Payable</p>
          <p className="text-sm font-bold">₨ {vendor.totalPayable.toLocaleString()}</p>
        </div>
      </div>

      {/* Amount Paid */}
      <div className="flex items-center gap-2 p-2">
        <TrendingUp className="w-4 h-4 text-success shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground truncate">Total Paid</p>
          <p className="text-sm font-bold text-success">₨ {vendor.amountPaid.toLocaleString()}</p>
        </div>
      </div>

      {/* Pending Amount */}
      <div className="flex items-center gap-2 p-2">
        <Clock className="w-4 h-4 text-warning shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground truncate">Pending</p>
          <p className="text-sm font-bold text-warning">₨ {vendor.amountPending.toLocaleString()}</p>
        </div>
      </div>

      {/* Last Transaction */}
      <div className="flex items-center gap-2 p-2">
        <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground truncate">Last Payment</p>
          <p className="text-sm font-medium truncate">
            {lastTransactionDate 
              ? format(new Date(lastTransactionDate), "MMM d, yy") 
              : "—"
            }
          </p>
        </div>
      </div>

      {/* Payment Status Badge */}
      <div className="flex items-center gap-2 p-2">
        {paymentStatus.label === "Paid" ? (
          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 text-warning shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground truncate">Status</p>
          <Badge 
            variant={paymentStatus.variant}
            className={`${paymentStatus.className} text-xs h-5`}
          >
            {paymentStatus.label}
          </Badge>
        </div>
      </div>
    </div>
  );
}
