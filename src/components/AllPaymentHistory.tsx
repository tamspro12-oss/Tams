import { useAllClientPaymentHistoryLocal, useAllVendorPaymentHistoryLocal } from "@/hooks/useLocalPaymentHistory";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { History, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo } from "react";
import { useClients, useVendors } from "@/hooks/useStorage";

interface AllPaymentHistoryProps {
  entityType: "client" | "vendor";
  entities: any[];
}

export function AllPaymentHistory({ entityType, entities }: AllPaymentHistoryProps) {
  const entityIds = entities.map(e => e.id);
  const { clients = [] } = useClients();
  const { vendors = [] } = useVendors();
  
  const clientQuery = useAllClientPaymentHistoryLocal(entityType === "client" ? entityIds : []);
  const vendorQuery = useAllVendorPaymentHistoryLocal(entityType === "vendor" ? entityIds : []);
  
  const { data: paymentsData = [], isLoading } = entityType === "client" ? clientQuery : vendorQuery;

  // Add entity names to payments
  const allPayments = useMemo(() => {
    return paymentsData.map((payment: any) => {
      let entityName = "Unknown";
      if (entityType === "client") {
        const client = clients.find(c => c.id === payment.client_id);
        entityName = client?.name || "Unknown";
      } else {
        const vendor = vendors.find(v => v.id === payment.vendor_id);
        entityName = vendor?.name || "Unknown";
      }
      return {
        ...payment,
        entityName,
        entityId: entityType === "client" ? payment.client_id : payment.vendor_id,
      };
    });
  }, [paymentsData, entityType, clients, vendors]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5" />
            <CardTitle>All Payment History</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <div className="flex gap-4">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <div className="space-y-2 p-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (allPayments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5" />
            <CardTitle>All Payment History</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic text-center py-8">
            No payments recorded yet
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalAmount = allPayments.reduce((sum, p) => sum + Number(p.payment_amount), 0);
  const fullPayments = allPayments.filter(p => p.payment_type === "full").length;
  const partialPayments = allPayments.filter(p => p.payment_type === "partial").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5" />
            <CardTitle>All Payment History</CardTitle>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-bold text-success">₨ {totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-xs">{fullPayments} Full</Badge>
              <Badge variant="secondary" className="text-xs">{partialPayments} Partial</Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>{entityType === "client" ? "Client" : "Vendor"}</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.entityName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-success" />
                        <span className="font-semibold text-success">
                          ₨ {Number(payment.payment_amount).toLocaleString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={payment.payment_type === "full" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {payment.payment_type === "full" ? "Full" : "Partial"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(payment.payment_date), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {payment.notes || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
