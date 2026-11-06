import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BarChart3, 
  X, 
  Building2, 
  TrendingUp, 
  Clock, 
  Briefcase,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useVendors, useClients } from "@/hooks/useStorage";

interface EnhancedVendor {
  id: string;
  name: string;
  service_type?: string;
  totalPayable: number;
  amountPaid: number;
  amountPending: number;
  clientBookingsCount: number;
  paymentStatus: 'Paid' | 'Partial' | 'Pending';
}

export function VendorComparisonView() {
  const { vendors } = useVendors();
  const { clients } = useClients();
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Enhance vendors with calculated data (read-only from existing)
  const enhancedVendors = useMemo((): EnhancedVendor[] => {
    return vendors.map(vendor => {
      const vendorClients = clients.filter(c => c.vendor_id === vendor.id);
      const fromBookingsTotal = vendorClients.reduce((sum, c) => sum + (Number(c.purchasing_price) || 0), 0);
      const vendorDirectAmount = Number(vendor.payment_amount) || 0;
      const totalPayable = fromBookingsTotal + vendorDirectAmount;
      const amountPaid = Number(vendor.amount_paid) || 0;
      const amountPending = totalPayable - amountPaid;

      let paymentStatus: 'Paid' | 'Partial' | 'Pending' = 'Pending';
      if (amountPaid >= totalPayable && totalPayable > 0) {
        paymentStatus = 'Paid';
      } else if (amountPaid > 0) {
        paymentStatus = 'Partial';
      }

      return {
        id: vendor.id,
        name: vendor.name,
        service_type: vendor.service_type,
        totalPayable,
        amountPaid,
        amountPending,
        clientBookingsCount: vendorClients.length,
        paymentStatus,
      };
    });
  }, [vendors, clients]);

  // Get selected vendors for comparison
  const selectedVendors = useMemo(() => {
    return enhancedVendors.filter(v => selectedVendorIds.includes(v.id));
  }, [enhancedVendors, selectedVendorIds]);

  const toggleVendor = (vendorId: string) => {
    setSelectedVendorIds(prev => {
      if (prev.includes(vendorId)) {
        return prev.filter(id => id !== vendorId);
      }
      // Limit to 4 vendors for comparison
      if (prev.length >= 4) {
        return prev;
      }
      return [...prev, vendorId];
    });
  };

  const clearSelection = () => {
    setSelectedVendorIds([]);
  };

  const getStatusBadge = (status: 'Paid' | 'Partial' | 'Pending') => {
    switch (status) {
      case 'Paid':
        return <Badge className="bg-success text-success-foreground">Paid</Badge>;
      case 'Partial':
        return <Badge className="bg-warning/20 text-warning">Partial</Badge>;
      case 'Pending':
        return <Badge className="bg-destructive/10 text-destructive">Pending</Badge>;
    }
  };

  // Calculate totals for comparison
  const comparisonTotals = useMemo(() => {
    return {
      totalPayable: selectedVendors.reduce((sum, v) => sum + v.totalPayable, 0),
      totalPaid: selectedVendors.reduce((sum, v) => sum + v.amountPaid, 0),
      totalPending: selectedVendors.reduce((sum, v) => sum + v.amountPending, 0),
      totalBookings: selectedVendors.reduce((sum, v) => sum + v.clientBookingsCount, 0),
    };
  }, [selectedVendors]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <BarChart3 className="w-4 h-4" />
          Compare Vendors
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Vendor Comparison
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Vendor Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Select up to 4 vendors to compare ({selectedVendorIds.length}/4 selected)
              </p>
              {selectedVendorIds.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Clear All
                </Button>
              )}
            </div>
            <ScrollArea className="h-[150px] border rounded-lg p-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {enhancedVendors.map(vendor => (
                  <div
                    key={vendor.id}
                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                      selectedVendorIds.includes(vendor.id)
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-muted/50 border border-transparent'
                    }`}
                    onClick={() => toggleVendor(vendor.id)}
                  >
                    <Checkbox
                      checked={selectedVendorIds.includes(vendor.id)}
                      disabled={!selectedVendorIds.includes(vendor.id) && selectedVendorIds.length >= 4}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{vendor.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {vendor.clientBookingsCount} bookings
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Comparison View */}
          {selectedVendors.length > 0 ? (
            <ScrollArea className="flex-1">
              <div className="space-y-4">
                {/* Comparison Grid */}
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${selectedVendors.length}, 1fr)` }}>
                  {selectedVendors.map(vendor => (
                    <Card key={vendor.id} className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => toggleVendor(vendor.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary" />
                          <CardTitle className="text-sm truncate pr-6">{vendor.name}</CardTitle>
                        </div>
                        {vendor.service_type && (
                          <p className="text-xs text-muted-foreground">{vendor.service_type}</p>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Status */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Status</span>
                          {getStatusBadge(vendor.paymentStatus)}
                        </div>

                        {/* Bookings */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Bookings</span>
                          </div>
                          <span className="text-sm font-bold">{vendor.clientBookingsCount}</span>
                        </div>

                        {/* Total Payable */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Total Payable</span>
                          <span className="text-sm font-bold">₨ {vendor.totalPayable.toLocaleString()}</span>
                        </div>

                        {/* Amount Paid */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-success" />
                            <span className="text-xs text-muted-foreground">Paid</span>
                          </div>
                          <span className="text-sm font-bold text-success">₨ {vendor.amountPaid.toLocaleString()}</span>
                        </div>

                        {/* Outstanding */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-warning" />
                            <span className="text-xs text-muted-foreground">Outstanding</span>
                          </div>
                          <span className="text-sm font-bold text-warning">₨ {vendor.amountPending.toLocaleString()}</span>
                        </div>

                        {/* Payment Progress */}
                        <div className="pt-2">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-success rounded-full transition-all"
                              style={{
                                width: `${vendor.totalPayable > 0 ? (vendor.amountPaid / vendor.totalPayable) * 100 : 0}%`
                              }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1 text-center">
                            {vendor.totalPayable > 0 
                              ? `${((vendor.amountPaid / vendor.totalPayable) * 100).toFixed(0)}% paid`
                              : 'No payables'
                            }
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Comparison Totals */}
                <Card className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Combined Totals</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Total Bookings</p>
                        <p className="text-lg font-bold">{comparisonTotals.totalBookings}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Total Payable</p>
                        <p className="text-lg font-bold">₨ {comparisonTotals.totalPayable.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Total Paid</p>
                        <p className="text-lg font-bold text-success">₨ {comparisonTotals.totalPaid.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Total Outstanding</p>
                        <p className="text-lg font-bold text-warning">₨ {comparisonTotals.totalPending.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Select vendors above to compare</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
