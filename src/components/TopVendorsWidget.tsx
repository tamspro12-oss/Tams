import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, TrendingUp, Clock, AlertTriangle, ArrowRight } from "lucide-react";
import { useVendors, useClients } from "@/hooks/useStorage";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface TopVendor {
  id: string;
  name: string;
  serviceType?: string;
  totalPayable: number;
  amountPaid: number;
  outstanding: number;
  bookingsCount: number;
  paymentStatus: 'Paid' | 'Partial' | 'Pending';
}

export function TopVendorsWidget() {
  const { vendors, isLoading: loadingVendors } = useVendors();
  const { clients, isLoading: loadingClients } = useClients();
  const navigate = useNavigate();

  // Get top 5 vendors by outstanding balance (read-only from existing data)
  const topVendors = useMemo((): TopVendor[] => {
    const enhancedVendors = vendors.map(vendor => {
      const vendorClients = clients.filter(c => c.vendor_id === vendor.id);
      const fromBookingsTotal = vendorClients.reduce((sum, c) => sum + (Number(c.purchasing_price) || 0), 0);
      const vendorDirectAmount = Number(vendor.payment_amount) || 0;
      const totalPayable = fromBookingsTotal + vendorDirectAmount;
      const amountPaid = Number(vendor.amount_paid) || 0;
      const outstanding = totalPayable - amountPaid;

      let paymentStatus: 'Paid' | 'Partial' | 'Pending' = 'Pending';
      if (amountPaid >= totalPayable && totalPayable > 0) {
        paymentStatus = 'Paid';
      } else if (amountPaid > 0) {
        paymentStatus = 'Partial';
      }

      return {
        id: vendor.id,
        name: vendor.name,
        serviceType: vendor.service_type,
        totalPayable,
        amountPaid,
        outstanding,
        bookingsCount: vendorClients.length,
        paymentStatus,
      };
    });

    // Sort by outstanding (highest first) and take top 5
    return enhancedVendors
      .filter(v => v.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 5);
  }, [vendors, clients]);

  // Calculate total outstanding
  const totalOutstanding = useMemo(() => {
    return topVendors.reduce((sum, v) => sum + v.outstanding, 0);
  }, [topVendors]);

  const isLoading = loadingVendors || loadingClients;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            <CardTitle className="text-lg">Top Vendor Payables</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (topVendors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Top Vendor Payables</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No outstanding vendor payments</p>
            <p className="text-xs mt-1">All vendors are paid up!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Top Vendor Payables</CardTitle>
          </div>
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
            ₨ {(totalOutstanding / 1000).toFixed(0)}K Total
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {topVendors.map((vendor, index) => (
          <div
            key={vendor.id}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                {index + 1}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{vendor.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {vendor.bookingsCount} bookings
                  </span>
                  {vendor.outstanding > 50000 && (
                    <AlertTriangle className="w-3 h-3 text-warning" />
                  )}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-warning text-sm">
                ₨ {vendor.outstanding.toLocaleString()}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Outstanding</span>
              </div>
            </div>
          </div>
        ))}

        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 gap-2"
          onClick={() => navigate("/app/vendors")}
        >
          View All Vendors
          <ArrowRight className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
