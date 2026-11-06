import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVendors, useClients } from "@/hooks/useStorage";
import { useVendorPaymentHistoryLocal } from "@/hooks/useLocalPaymentHistory";
import { AddVendorDialog } from "@/components/AddVendorDialog";
import { VendorPaymentDialog } from "@/components/VendorPaymentDialog";
import { VendorLedgerView } from "@/components/VendorLedgerView";

import { InlinePaymentHistory } from "@/components/InlinePaymentHistory";
import { PermissionGate } from "@/components/PermissionGate";
import { 
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  Pencil,
  DollarSign,
  Plane,
  Receipt,
  BarChart3,
  Calendar,
  TrendingUp,
  AlertCircle,
  FileText,
  Download
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from "sonner";
import { useAgency } from "@/hooks/useAgency";

export default function VendorDashboard() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  
  const { vendors, isLoading: vendorsLoading } = useVendors();
  const { clients, isLoading: clientsLoading } = useClients();
  const { history: paymentHistory } = useVendorPaymentHistoryLocal(vendorId || '');
  const { data: agency } = useAgency();

  const vendor = vendors.find(v => v.id === vendorId);

  // Calculate vendor stats
  const vendorData = useMemo(() => {
    if (!vendor) return null;
    
    const vendorClients = clients.filter(c => c.vendor_id === vendor.id);
    const fromBookingsTotal = vendorClients.reduce((sum, c) => sum + (Number(c.purchasing_price) || 0), 0);
    const vendorDirectAmount = Number(vendor.payment_amount) || 0;
    const totalPayable = fromBookingsTotal + vendorDirectAmount;
    const amountPaid = Number(vendor.amount_paid) || 0;
    const amountPending = totalPayable - amountPaid;
    
    return {
      ...vendor,
      associatedClients: vendorClients,
      clientBookingsCount: vendorClients.length,
      fromBookingsTotal,
      vendorDirectAmount,
      totalPayable,
      amountPaid,
      amountPending,
    };
  }, [vendor, clients]);

  // Download statement PDF
  const downloadStatement = () => {
    if (!vendorData) return;
    
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('Vendor Statement', 14, 20);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    if (agency?.name) doc.text(`Agency: ${agency.name}`, 14, 28);
    doc.text(`Date: ${format(new Date(), 'dd MMM yyyy')}`, 14, 35);
    
    // Vendor Info
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`Vendor: ${vendorData.name}`, 14, 48);
    if (vendorData.service_type) doc.text(`Service: ${vendorData.service_type}`, 14, 55);
    
    // Summary Table
    autoTable(doc, {
      startY: 65,
      head: [['Description', 'Amount (PKR)']],
      body: [
        ['Total from Bookings', vendorData.fromBookingsTotal.toLocaleString()],
        ['Direct Services', vendorData.vendorDirectAmount.toLocaleString()],
        ['Total Payable', vendorData.totalPayable.toLocaleString()],
        ['Amount Paid', vendorData.amountPaid.toLocaleString()],
        ['Outstanding', vendorData.amountPending.toLocaleString()],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [15, 23, 42] },
    });
    
    // Bookings Table
    if (vendorData.associatedClients.length > 0) {
      const finalY = (doc as any).lastAutoTable?.finalY || 100;
      doc.setFontSize(12);
      doc.text('Associated Bookings', 14, finalY + 15);
      
      autoTable(doc, {
        startY: finalY + 20,
        head: [['Client', 'Destination', 'PNR', 'Flight Date', 'Amount']],
        body: vendorData.associatedClients.map(c => [
          c.name,
          c.destination || '-',
          c.pnr || '-',
          c.flight_date ? format(new Date(c.flight_date), 'dd MMM yyyy') : '-',
          `PKR ${(c.purchasing_price || 0).toLocaleString()}`
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [15, 23, 42] },
      });
    }
    
    // Payment History
    if (paymentHistory.length > 0) {
      const finalY = (doc as any).lastAutoTable?.finalY || 150;
      doc.setFontSize(12);
      doc.text('Payment History', 14, finalY + 15);
      
      autoTable(doc, {
        startY: finalY + 20,
        head: [['Date', 'Type', 'Amount', 'Notes']],
        body: paymentHistory.map(p => [
          format(new Date(p.payment_date), 'dd MMM yyyy'),
          p.payment_type,
          `PKR ${p.payment_amount.toLocaleString()}`,
          p.notes || '-'
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [15, 23, 42] },
      });
    }
    
    doc.save(`Vendor_Statement_${vendorData.name}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    toast.success('Statement downloaded');
  };

  if (vendorsLoading || clientsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!vendor || !vendorData) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Vendor Not Found</h2>
        <p className="text-muted-foreground mb-4">The vendor you're looking for doesn't exist.</p>
        <Button onClick={() => navigate('/app/vendors')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Vendors
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/vendors')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">{vendorData.name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {vendorData.service_type && <span>{vendorData.service_type}</span>}
                <Badge
                  variant={
                    vendorData.amountPaid >= vendorData.totalPayable ? "default" :
                    vendorData.amountPaid > 0 ? "secondary" : "outline"
                  }
                  className={
                    vendorData.amountPaid >= vendorData.totalPayable ? "bg-success text-success-foreground" :
                    vendorData.amountPaid > 0 ? "bg-warning/20 text-warning" :
                    "bg-destructive/10 text-destructive"
                  }
                >
                  {vendorData.amountPaid >= vendorData.totalPayable ? "Paid" :
                   vendorData.amountPaid > 0 ? "Partial" : "Pending"}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadStatement}>
            <Download className="w-4 h-4 mr-2" />
            Statement
          </Button>
          <PermissionGate module="vendors" action="write">
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </PermissionGate>
          {vendorData.amountPending > 0 && (
            <PermissionGate module="vendors" action="write">
              <Button size="sm" onClick={() => setShowPaymentDialog(true)}>
                <DollarSign className="w-4 h-4 mr-2" />
                Record Payment
              </Button>
            </PermissionGate>
          )}
        </div>
      </div>

      {/* Contact Info */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-6">
            {vendorData.contact_person && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span>{vendorData.contact_person}</span>
              </div>
            )}
            {vendorData.contact_number && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{vendorData.contact_number}</span>
              </div>
            )}
            {vendorData.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{vendorData.email}</span>
              </div>
            )}
            {vendorData.booking_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>Since {format(new Date(vendorData.booking_date), 'MMM d, yyyy')}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Plane className="w-4 h-4" />
              <span className="text-xs">From Bookings</span>
            </div>
            <p className="text-xl font-bold">PKR {vendorData.fromBookingsTotal.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{vendorData.clientBookingsCount} bookings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Receipt className="w-4 h-4" />
              <span className="text-xs">Direct Services</span>
            </div>
            <p className="text-xl font-bold">PKR {vendorData.vendorDirectAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-primary mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">Total Payable</span>
            </div>
            <p className="text-xl font-bold text-primary">PKR {vendorData.totalPayable.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs">Amount Paid</span>
            </div>
            <p className="text-xl font-bold text-green-600">PKR {vendorData.amountPaid.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className={cn(
              "flex items-center gap-2 mb-1",
              vendorData.amountPending > 0 ? "text-red-600" : "text-green-600"
            )}>
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs">Outstanding</span>
            </div>
            <p className={cn(
              "text-xl font-bold",
              vendorData.amountPending > 0 ? "text-red-600" : "text-green-600"
            )}>
              PKR {Math.abs(vendorData.amountPending).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="bookings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bookings" className="gap-2">
            <Plane className="w-4 h-4" />
            Bookings
          </TabsTrigger>
          <TabsTrigger value="ledger" className="gap-2">
            <FileText className="w-4 h-4" />
            Ledger
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <DollarSign className="w-4 h-4" />
            Payments
          </TabsTrigger>
        </TabsList>

        {/* Bookings Tab */}
        <TabsContent value="bookings">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Associated Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              {vendorData.associatedClients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Plane className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No bookings associated with this vendor</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {vendorData.associatedClients.map((client: any) => (
                    <div key={client.id} className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{client.name}</p>
                          <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                            {client.destination && <span>→ {client.destination}</span>}
                            {client.pnr && <span>• PNR: {client.pnr}</span>}
                            {client.flight_date && (
                              <span>• {format(new Date(client.flight_date), "MMM d, yyyy")}</span>
                            )}
                            {client.airline && <span>• {client.airline}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Purchasing Price</p>
                          <p className="font-bold text-lg">PKR {Number(client.purchasing_price || 0).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Total */}
                  <div className="flex justify-end pt-4 border-t">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Total from Bookings</p>
                      <p className="font-bold text-xl text-primary">
                        PKR {vendorData.fromBookingsTotal.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ledger Tab */}
        <TabsContent value="ledger">
          <Card>
            <CardContent className="pt-6">
              <VendorLedgerView 
                vendorId={vendorData.id} 
                vendorName={vendorData.name} 
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card>
            <CardContent className="pt-6">
              <InlinePaymentHistory 
                entityId={vendorData.id} 
                entityType="vendor" 
              />
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Notes */}
      {vendorData.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{vendorData.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <AddVendorDialog 
        editVendor={vendor}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />

      {vendorData && (
        <VendorPaymentDialog
          vendor={vendorData}
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
        />
      )}
    </div>
  );
}
