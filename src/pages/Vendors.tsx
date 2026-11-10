import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AddVendorDialog } from "@/components/AddVendorDialog";
import { VendorPaymentDialog } from "@/components/VendorPaymentDialog";
import { Search, Trash2, Pencil, Building2, Phone, Mail, Banknote, RefreshCw, Eye, TrendingUp, AlertCircle, ShieldAlert } from "lucide-react";
import { useVendors, useClients } from "@/hooks/useStorage";
import { format, parseISO, isWithinInterval } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DateFilterSelector } from "@/components/DateFilterSelector";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VendorCardSkeleton } from "@/components/SkeletonLoaders";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PermissionGate } from "@/components/PermissionGate";
import { cn } from "@/lib/utils";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { supabase } from "@/integrations/supabase/client";
import { CopyValue } from "@/components/ui/CopyValue";
import { cleanPastedSearch } from "@/lib/searchUtils";

export default function Vendors() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingVendor, setEditingVendor] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [paymentVendor, setPaymentVendor] = useState<any>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const { filter, setPreset } = useDateFilter();
  const [isForceDeleting, setIsForceDeleting] = useState(false);
  const [linkedB2BCount, setLinkedB2BCount] = useState(0);
  const { vendors, deleteVendor, isLoading } = useVendors();
  const { clients } = useClients();
  const queryClient = useQueryClient();
  const { isSubUser, isLoading: isPermissionsLoading } = useUserPermissions();
  const canForceDelete = !isPermissionsLoading && !isSubUser;

  // Set "All Time" as default filter for Vendors page
  useEffect(() => {
    setPreset("all_time");
  }, []);

  // Pull-to-refresh functionality
  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['vendors'] }),
      queryClient.invalidateQueries({ queryKey: ['clients'] }),
    ]);
    toast.success("Vendors refreshed");
  };

  const { containerRef, isPulling, isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteVendor.mutateAsync(deleteId);
    setDeleteId(null);
  };

  // Count linked B2B bookings so Force Delete can appear when needed
  useEffect(() => {
    let cancelled = false;

    const loadB2BLinkedCount = async () => {
      if (!deleteId) {
        setLinkedB2BCount(0);
        return;
      }

      const { count, error } = await supabase
        .from("b2b_bookings")
        .select("id", { count: "exact", head: true })
        .eq("vendor_id", deleteId);

      if (cancelled) return;

      if (error) {
        console.error("Failed to count linked B2B bookings:", error);
        setLinkedB2BCount(0);
        return;
      }

      setLinkedB2BCount(count || 0);
    };

    loadB2BLinkedCount();

    return () => {
      cancelled = true;
    };
  }, [deleteId]);

  // Force delete: unlink all bookings first, then delete vendor
  const handleForceDelete = async () => {
    if (!deleteId || !canForceDelete) return;
    
    setIsForceDeleting(true);
    try {
      // 1. Unlink from clients table (set vendor_id to null)
      const { error: clientsError } = await supabase
        .from('clients')
        .update({ vendor_id: null })
        .eq('vendor_id', deleteId);

      if (clientsError) {
        throw new Error(`Failed to unlink client records: ${clientsError.message}`);
      }

      // 2. Unlink from b2b_bookings table (set vendor_id to null)
      const { error: b2bError } = await supabase
        .from('b2b_bookings')
        .update({ vendor_id: null })
        .eq('vendor_id', deleteId);

      if (b2bError) {
        throw new Error(`Failed to unlink B2B bookings: ${b2bError.message}`);
      }

      // 3. Now delete the vendor
      await deleteVendor.mutateAsync(deleteId);
      
      // Refresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['vendors'] }),
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
        queryClient.invalidateQueries({ queryKey: ['b2b_bookings'] }),
      ]);
      
      toast.success("Vendor force deleted successfully", {
        description: "All linked bookings have been unlinked."
      });
      setDeleteId(null);
    } catch (error: any) {
      console.error('Force delete error:', error);
      toast.error("Failed to force delete vendor", {
        description: error.message
      });
    } finally {
      setIsForceDeleting(false);
    }
  };

  const filteredVendors = useMemo(() => {
    let filtered = vendors.filter(
      (vendor) =>
        vendor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.service_type?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Date range filter from global context
    if (filter.startDate) {
      filtered = filtered.filter((v: any) => {
        if (!v.booking_date && !v.created_at) return false;
        const dateToCheck = v.booking_date || v.created_at;
        const checkDate = parseISO(dateToCheck);
        
        if (filter.endDate) {
          return isWithinInterval(checkDate, { start: filter.startDate!, end: filter.endDate });
        }
        return checkDate >= filter.startDate!;
      });
    }

    // Enhance vendors with client booking data
    return filtered.map(vendor => {
      const vendorClients = clients.filter(c => c.vendor_id === vendor.id);
      
      // Calculate totals from client bookings (purchasing prices are what we owe vendors)
      const fromBookingsTotal = vendorClients.reduce((sum, c) => sum + (Number(c.purchasing_price) || 0), 0);
      
      // Add vendor's direct service amount
      const vendorDirectAmount = Number(vendor.payment_amount) || 0;
      
      // Total amount we owe this vendor
      const totalPayable = fromBookingsTotal + vendorDirectAmount;
      
      // Amount we've paid to vendor
      const amountPaid = Number(vendor.amount_paid) || 0;
      
      // Remaining amount
      const amountPending = totalPayable - amountPaid;
      
      return {
        ...vendor,
        clientBookingsCount: vendorClients.length,
        fromBookingsTotal,
        vendorDirectAmount,
        totalPayable,
        amountPaid,
        amountPending,
      };
    });
  }, [vendors, clients, searchTerm, filter]);

  const stats = useMemo(() => {
    const enhancedVendors = vendors.map(vendor => {
      const vendorClients = clients.filter(c => c.vendor_id === vendor.id);
      const fromBookingsTotal = vendorClients.reduce((sum, c) => sum + (Number(c.purchasing_price) || 0), 0);
      const vendorDirectAmount = Number(vendor.payment_amount) || 0;
      const totalPayable = fromBookingsTotal + vendorDirectAmount;
      const amountPaid = Number(vendor.amount_paid) || 0;
      return { totalPayable, amountPaid };
    });

    const total = filteredVendors.length;
    const totalAmount = enhancedVendors.reduce((sum, v) => sum + v.totalPayable, 0);
    const totalPaid = enhancedVendors.reduce((sum, v) => sum + v.amountPaid, 0);
    const totalPending = totalAmount - totalPaid;
    const fullyPaid = enhancedVendors.filter(v => v.amountPaid >= v.totalPayable).length;
    
    return { total, totalAmount, totalPaid, totalPending, fullyPaid };
  }, [vendors, clients, filteredVendors]);

  return (
    <div ref={containerRef} className="relative h-full overflow-auto">
      {/* Pull-to-refresh indicator */}
      <div 
        className="absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200 ease-out z-50"
        style={{
          transform: `translateY(${Math.max(0, pullDistance - 80)}px)`,
          opacity: Math.min(pullDistance / 80, 1),
        }}
      >
        <div className="bg-primary text-primary-foreground rounded-full p-2 shadow-lg">
          <RefreshCw 
            className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}
            style={{
              transform: `rotate(${pullDistance * 3.6}deg)`,
            }}
          />
        </div>
      </div>

      <div className="space-y-4">
        {/* Single Top Toolbar: one row, all controls same height & radius as Client Bookings */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-card border rounded-lg p-2.5 shadow-xs">
          {/* Left: Title & Subtitle */}
          <div className="flex items-center gap-2.5 shrink-0 pr-1">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold leading-tight">Vendor Management</h1>
              <p className="text-[11px] text-muted-foreground">{vendors.length} vendors registered</p>
            </div>
          </div>

          {/* Middle: Search Box & Date Filter */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search vendors by name, contact, service..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  if (pasted) {
                    e.preventDefault();
                    setSearchTerm(cleanPastedSearch(pasted));
                  }
                }}
                className="pl-9 h-9 text-xs rounded-lg bg-background"
              />
            </div>
            <DateFilterSelector size="sm" className="h-9 text-xs rounded-lg shrink-0" />
          </div>

          {/* Right: Add Vendor Primary Button */}
          <div className="shrink-0">
            <PermissionGate module="vendors" action="write">
              <AddVendorDialog />
            </PermissionGate>
          </div>
        </div>

        {/* Stats Cards: Exact same size, padding, font sizes and height as Client Bookings tab */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-card border rounded-lg p-3 shadow-2xs hover:shadow-xs transition-shadow">
            <span className="text-xs font-semibold text-muted-foreground block">
              Total Vendors
            </span>
            <span className="text-base sm:text-xl font-bold text-foreground block">
              {stats.total}
            </span>
            <span className="text-xs text-muted-foreground block mt-0.5">
              {stats.fullyPaid} fully paid
            </span>
          </div>

          <div className="bg-card border rounded-lg p-3 shadow-2xs hover:shadow-xs transition-shadow">
            <span className="text-xs font-semibold text-muted-foreground block">
              Total Payable
            </span>
            <span className="text-base sm:text-xl font-bold text-foreground block">
              ₨ {stats.totalAmount.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground block mt-0.5">
              Expected total
            </span>
          </div>

          <div className="bg-card border rounded-lg p-3 shadow-2xs hover:shadow-xs transition-shadow">
            <span className="text-xs font-semibold text-muted-foreground block">
              Amount Paid
            </span>
            <span className="text-base sm:text-xl font-bold text-emerald-600 block">
              ₨ {stats.totalPaid.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground block mt-0.5">
              Total disbursed
            </span>
          </div>

          <div className="bg-card border rounded-lg p-3 shadow-2xs hover:shadow-xs transition-shadow">
            <span className="text-xs font-semibold text-muted-foreground block">
              Outstanding
            </span>
            <span
              className={cn(
                "text-base sm:text-xl font-bold block",
                stats.totalPending > 0 ? "text-amber-600" : "text-muted-foreground"
              )}
            >
              ₨ {stats.totalPending.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground block mt-0.5">
              Yet to pay
            </span>
          </div>
        </div>

        {/* Vendors List */}
        {isLoading ? (
          <div className="grid gap-4">
            <VendorCardSkeleton />
            <VendorCardSkeleton />
            <VendorCardSkeleton />
          </div>
        ) : filteredVendors.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Vendors Found</h3>
              <p className="text-muted-foreground">
                {searchTerm || filter.startDate
                  ? "Try adjusting your filters"
                  : "Add your first vendor to get started"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredVendors.map(vendor => (
              <Card key={vendor.id} className="hover:shadow-md transition-shadow overflow-hidden">
                {/* Banner Header with Vendor Name */}
                <div className="bg-gradient-to-r from-primary to-primary/80 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl text-white truncate">
                          <CopyValue value={vendor.name} label="vendor name" className="text-white" />
                        </h3>
                        {vendor.service_type && (
                          <span className="text-sm text-white/80">{vendor.service_type}</span>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-sm font-medium",
                        vendor.amountPaid >= vendor.totalPayable 
                          ? "bg-white/20 text-white border-white/30" 
                          : vendor.amountPaid > 0 
                            ? "bg-yellow-500/30 text-yellow-100 border-yellow-300/30" 
                            : "bg-red-500/30 text-red-100 border-red-300/30"
                      )}
                    >
                      {vendor.amountPaid >= vendor.totalPayable ? "✓ Paid" :
                       vendor.amountPaid > 0 ? "◐ Partial" : "○ Pending"}
                    </Badge>
                  </div>
                </div>

                <CardContent className="py-4">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Vendor Contact Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {vendor.contact_number && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            <CopyValue value={vendor.contact_number} label="contact number" />
                          </span>
                        )}
                        {vendor.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            <CopyValue value={vendor.email} label="email" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex flex-wrap gap-4 lg:gap-6">
                      <div className="text-center min-w-[80px]">
                        <div className="flex items-center justify-center gap-1 text-blue-600">
                          <TrendingUp className="w-4 h-4" />
                          <span className="font-bold">
                            <CopyValue
                              value={vendor.totalPayable}
                              isAmount={true}
                              displayValue={`PKR ${vendor.totalPayable.toLocaleString()}`}
                              label="total payable"
                            />
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">Total Payable</p>
                      </div>
                      <div className="text-center min-w-[80px]">
                        <div className="flex items-center justify-center gap-1 text-green-600">
                          <Banknote className="w-4 h-4" />
                          <span className="font-bold">
                            <CopyValue
                              value={vendor.amountPaid}
                              isAmount={true}
                              displayValue={`PKR ${vendor.amountPaid.toLocaleString()}`}
                              label="amount paid"
                            />
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">Paid</p>
                      </div>
                      <div className="text-center min-w-[80px]">
                        <div className={cn(
                          "flex items-center justify-center gap-1",
                          vendor.amountPending > 0 ? "text-red-600" : "text-green-600"
                        )}>
                          <AlertCircle className="w-4 h-4" />
                          <span className="font-bold">
                            <CopyValue
                              value={Math.abs(vendor.amountPending)}
                              isAmount={true}
                              displayValue={`PKR ${Math.abs(vendor.amountPending).toLocaleString()}`}
                              label="outstanding balance"
                            />
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {vendor.amountPending > 0 ? 'Outstanding' : 'Settled'}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 lg:ml-4">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => navigate(`/app/vendors/${vendor.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View Vendor</p>
                          </TooltipContent>
                        </Tooltip>
                        <PermissionGate module="vendors" action="write">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setEditingVendor(vendor);
                                  setShowEditDialog(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit Vendor</p>
                            </TooltipContent>
                          </Tooltip>
                        </PermissionGate>
                        <PermissionGate module="vendors" action="delete">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteId(vendor.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete Vendor</p>
                            </TooltipContent>
                          </Tooltip>
                        </PermissionGate>
                        {vendor.amountPending > 0 && (
                          <PermissionGate module="vendors" action="write">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setPaymentVendor(vendor);
                                    setShowPaymentDialog(true);
                                  }}
                                >
                                  <Banknote className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Record Payment</p>
                              </TooltipContent>
                            </Tooltip>
                          </PermissionGate>
                        )}
                      </TooltipProvider>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Dialogs */}
        <AddVendorDialog 
          editVendor={editingVendor}
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open);
            if (!open) setEditingVendor(null);
          }}
        />

        {paymentVendor && (
          <VendorPaymentDialog
            vendor={paymentVendor}
            open={showPaymentDialog}
            onOpenChange={(open) => {
              setShowPaymentDialog(open);
              if (!open) setPaymentVendor(null);
            }}
          />
        )}

        <AlertDialog open={!!deleteId} onOpenChange={() => !isForceDeleting && setDeleteId(null)}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-destructive" />
                </div>
                <AlertDialogTitle className="text-xl">Delete Vendor?</AlertDialogTitle>
              </div>
              <AlertDialogDescription className="text-base space-y-2">
                <span>
                  Are you sure you want to delete <strong className="text-foreground">{filteredVendors.find(v => v.id === deleteId)?.name}</strong>?
                </span>

                {(filteredVendors.find(v => v.id === deleteId)?.clientBookingsCount || 0) > 0 && (
                  <span className="block text-warning font-medium">
                    ⚠️ This vendor is linked to {filteredVendors.find(v => v.id === deleteId)?.clientBookingsCount} client record(s).
                  </span>
                )}

                {linkedB2BCount > 0 && (
                  <span className="block text-warning font-medium">
                    ⚠️ This vendor is used in {linkedB2BCount} B2B booking(s).
                  </span>
                )}

                <span className="block">This action cannot be undone.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel className="mt-0" disabled={isForceDeleting}>Cancel</AlertDialogCancel>

              <AlertDialogAction 
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isForceDeleting}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Vendor
              </AlertDialogAction>

              {/* Force Delete - Main ID / Admin Only */}
              {canForceDelete && ((filteredVendors.find(v => v.id === deleteId)?.clientBookingsCount || 0) + linkedB2BCount) > 0 && (
                <Button
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={handleForceDelete}
                  disabled={isForceDeleting}
                >
                  {isForceDeleting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Force Deleting...
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-4 h-4 mr-2" />
                      Force Delete (Admin)
                    </>
                  )}
                </Button>
              )}
            </AlertDialogFooter>

            {/* Force Delete Explanation */}
            {canForceDelete && ((filteredVendors.find(v => v.id === deleteId)?.clientBookingsCount || 0) + linkedB2BCount) > 0 && (
              <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
                <strong>Force Delete:</strong> Unlinks this vendor from all client records and B2B bookings (vendor becomes "None"), then deletes the vendor.
              </p>
            )}
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
