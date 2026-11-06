import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { History, TrendingUp } from "lucide-react";

interface PaymentRecord {
  id: string;
  payment_amount: number;
  payment_date: string;
  payment_type: string;
  notes?: string | null;
  created_at: string;
}

interface PaymentHistorySectionProps {
  history: PaymentRecord[];
  isLoading: boolean;
  title?: string;
}

export function PaymentHistorySection({ 
  history, 
  isLoading,
  title = "Payment History" 
}: PaymentHistorySectionProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="w-5 h-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="w-5 h-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No payment history yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="w-5 h-5" />
          {title}
          <Badge variant="secondary" className="ml-auto">
            {history.length} {history.length === 1 ? "payment" : "payments"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {history.map((payment) => (
            <div
              key={payment.id}
              className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <p className="font-semibold text-success">
                    ₨ {Number(payment.payment_amount).toLocaleString()}
                  </p>
                  <Badge 
                    variant={payment.payment_type === "full" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {payment.payment_type === "full" ? "Full Payment" : "Partial Payment"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(payment.payment_date), "PPP")}
                </p>
                {payment.notes && (
                  <p className="text-xs text-muted-foreground italic mt-1">
                    {payment.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
