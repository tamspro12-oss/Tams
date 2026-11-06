import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useClients, useVendors } from "@/hooks/useStorage";
import { useNavigate } from "react-router-dom";
import {
  Wallet,
  Building2,
  Search,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  Banknote,
  ExternalLink,
} from "lucide-react";

interface QuickPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'client' | 'vendor';
  onSelectClient: (client: any) => void;
  onSelectVendor: (vendor: any) => void;
}

export function QuickPaymentDialog({
  open,
  onOpenChange,
  defaultTab = 'client',
  onSelectClient,
  onSelectVendor,
}: QuickPaymentDialogProps) {
  const navigate = useNavigate();
  const { clients = [] } = useClients();
  const { vendors = [] } = useVendors();
  const [activeTab, setActiveTab] = useState<'client' | 'vendor'>(defaultTab);
  const [clientSearch, setClientSearch] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");

  // Sync tab if defaultTab changes when opening
  useState(() => {
    setActiveTab(defaultTab);
  });

  // Filter clients with pending payments
  const pendingClients = useMemo(() => {
    const list = clients.map((c: any) => {
      const selling = Number(c.selling_price) || 0;
      const paid = Number(c.amount_paid) || 0;
      const remaining = selling - paid;
      return {
        ...c,
        remaining,
        hasPending: remaining > 0,
      };
    });

    return list
      .filter((c: any) => {
        if (!clientSearch.trim()) return c.hasPending;
        const query = clientSearch.toLowerCase();
        return (
          c.name?.toLowerCase().includes(query) ||
          c.pnr?.toLowerCase().includes(query) ||
          c.contact_number?.toLowerCase().includes(query) ||
          c.destination?.toLowerCase().includes(query)
        );
      })
      .sort((a: any, b: any) => {
        // Pending first, then by highest remaining
        if (a.hasPending && !b.hasPending) return -1;
        if (!a.hasPending && b.hasPending) return 1;
        return (b.remaining || 0) - (a.remaining || 0);
      });
  }, [clients, clientSearch]);

  // Enhanced vendors with outstanding calculations
  const enhancedVendors = useMemo(() => {
    return vendors
      .map((vendor: any) => {
        const vendorClients = clients.filter((c: any) => c.vendor_id === vendor.id);
        const fromBookingsTotal = vendorClients.reduce((sum: number, c: any) => sum + (Number(c.purchasing_price) || 0), 0);
        const vendorDirectAmount = Number(vendor.payment_amount) || 0;
        const totalPayable = fromBookingsTotal + vendorDirectAmount;
        const amountPaid = Number(vendor.amount_paid) || 0;
        const outstanding = totalPayable - amountPaid;

        return {
          ...vendor,
          totalPayable,
          amountPaid,
          outstanding,
          bookingsCount: vendorClients.length,
          hasOutstanding: outstanding > 0,
        };
      })
      .filter((v: any) => {
        if (!vendorSearch.trim()) return v.hasOutstanding;
        const query = vendorSearch.toLowerCase();
        return (
          v.name?.toLowerCase().includes(query) ||
          v.service_type?.toLowerCase().includes(query)
        );
      })
      .sort((a: any, b: any) => (b.outstanding || 0) - (a.outstanding || 0));
  }, [vendors, clients, vendorSearch]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] p-0 overflow-hidden flex flex-col rounded-xl">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Record Payment / Settlement</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Quickly collect from clients, settle vendor payables, or access banking
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Selection */}
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'client' | 'vendor')} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 pt-3 pb-2 border-b bg-background shrink-0">
            <TabsList className="grid grid-cols-2 w-full h-10">
              <TabsTrigger value="client" className="gap-2 text-xs sm:text-sm font-semibold">
                <Banknote className="w-4 h-4 text-emerald-600" />
                Receive Client Payment
              </TabsTrigger>
              <TabsTrigger value="vendor" className="gap-2 text-xs sm:text-sm font-semibold">
                <Building2 className="w-4 h-4 text-amber-600" />
                Pay Vendor Bill
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: Client Payment */}
          <TabsContent value="client" className="p-4 m-0 flex-1 flex flex-col overflow-hidden space-y-3">
            <div className="relative shrink-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search client by name, PNR, phone..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px] max-h-[340px]">
              {pendingClients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500/60" />
                  <p className="text-sm font-medium">No clients with pending balances found</p>
                  <p className="text-xs mt-1">All clients are fully paid up or search had no matches.</p>
                </div>
              ) : (
                pendingClients.map((client: any) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{client.name}</p>
                        {client.pnr && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            PNR: {client.pnr}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>Total: ₨ {Number(client.selling_price || 0).toLocaleString()}</span>
                        <span>•</span>
                        <span>Paid: ₨ {Number(client.amount_paid || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-destructive">
                        Due: ₨ {(client.remaining || 0).toLocaleString()}
                      </p>
                      <Button
                        size="sm"
                        className="mt-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        onClick={() => {
                          onOpenChange(false);
                          onSelectClient(client);
                        }}
                      >
                        + Receive
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t flex items-center justify-between shrink-0 text-xs">
              <span className="text-muted-foreground">Looking for other clients?</span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs gap-1"
                onClick={() => {
                  onOpenChange(false);
                  navigate("/app/bookings?tab=clients");
                }}
              >
                Go to Direct Clients Ledger <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </TabsContent>

          {/* TAB 2: Vendor Payment */}
          <TabsContent value="vendor" className="p-4 m-0 flex-1 flex flex-col overflow-hidden space-y-3">
            <div className="relative shrink-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search vendor by name or service..."
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px] max-h-[340px]">
              {enhancedVendors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500/60" />
                  <p className="text-sm font-medium">No vendors with outstanding payables found</p>
                  <p className="text-xs mt-1">All vendor bills are fully settled or search had no matches.</p>
                </div>
              ) : (
                enhancedVendors.map((vendor: any) => (
                  <div
                    key={vendor.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{vendor.name}</p>
                        {vendor.service_type && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            {vendor.service_type}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{vendor.bookingsCount || 0} Bookings</span>
                        <span>•</span>
                        <span>Total Payable: ₨ {(vendor.totalPayable || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-amber-600">
                        Owed: ₨ {(vendor.outstanding || 0).toLocaleString()}
                      </p>
                      <Button
                        size="sm"
                        className="mt-1 h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1"
                        onClick={() => {
                          onOpenChange(false);
                          onSelectVendor(vendor);
                        }}
                      >
                        + Pay Vendor
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t flex items-center justify-between shrink-0 text-xs">
              <span className="text-muted-foreground">Looking for complete vendor ledger?</span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs gap-1"
                onClick={() => {
                  onOpenChange(false);
                  navigate("/app/bookings?tab=vendors");
                }}
              >
                Go to Vendors & Payables <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
