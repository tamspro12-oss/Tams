import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Download, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Client {
  id: string;
  name: string;
  contact_number?: string;
  selling_price?: number;
  amount_paid?: number;
  flight_date?: string;
  destination?: string;
  airline?: string;
  pnr?: string;
  travel_type?: string;
  group_booking_type?: string;
  group_size?: number;
}

interface InvoiceGeneratorProps {
  client: Client;
}

export function InvoiceGenerator({ client }: InvoiceGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [itemDescription, setItemDescription] = useState(
    `${client.travel_type || "Travel"} Package - ${client.destination || "Destination"}`
  );
  const [invoiceHistory, setInvoiceHistory] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Load invoice history when dialog opens
  useEffect(() => {
    if (open) {
      loadInvoiceHistory();
    }
  }, [open]);

  const loadInvoiceHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvoiceHistory(data || []);
    } catch (error) {
      console.error("Failed to load invoice history:", error);
    }
  };

  const generateUniqueInvoiceNumber = async (prefix: string): Promise<string> => {
    const year = new Date().getFullYear();
    const { data: profile } = await supabase
      .from("profiles")
      .select("agency_id")
      .eq("id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (!profile?.agency_id) {
      throw new Error("Agency not found");
    }

    // Get the count of invoices for this agency this year
    const { count, error } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("agency_id", profile.agency_id)
      .gte("created_at", `${year}-01-01`)
      .lte("created_at", `${year}-12-31`);

    if (error) throw error;

    const nextNumber = (count || 0) + 1;
    return `${prefix}-${year}-${String(nextNumber).padStart(4, "0")}`;
  };

  const generateInvoice = async () => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    try {
      // Load template from localStorage
      const templateData = localStorage.getItem("invoice_template");
      if (!templateData) {
        toast({
          title: "Error",
          description: "Please set up your invoice template in Settings first",
          variant: "destructive",
        });
        setIsGenerating(false);
        return;
      }

      const template = JSON.parse(templateData);
      
      // Get user and agency info
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("id", user.id)
        .single();

      if (!profile?.agency_id) throw new Error("Agency not found");

      // Generate unique invoice number
      const invoiceNumber = await generateUniqueInvoiceNumber(template.prefix || "INV");
      const invoiceDate = new Date().toLocaleDateString();

      // Calculate amounts
      const amount = client.selling_price || 0;
      const paid = client.amount_paid || 0;
      const balance = amount - paid;

      // Generate PDF
      const doc = new jsPDF();

      let yPos = 20;

      // Add logo if exists
      if (template.logo) {
        try {
          doc.addImage(template.logo, 'PNG', 15, yPos, 40, 16);
          yPos += 20;
        } catch (error) {
          console.log("Could not add logo", error);
        }
      }

      // Agency Details
      doc.setFontSize(20);
      doc.setTextColor(template.themeColor || '#1e40af');
      doc.text(template.agencyName || 'Agency Name', 15, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      if (template.phone) {
        doc.text(`Phone: ${template.phone}`, 15, yPos);
        yPos += 5;
      }
      if (template.email) {
        doc.text(`Email: ${template.email}`, 15, yPos);
        yPos += 5;
      }
      if (template.address) {
        const addressLines = doc.splitTextToSize(template.address, 80);
        doc.text(addressLines, 15, yPos);
        yPos += addressLines.length * 5;
      }

      // Invoice Header (Right side)
      doc.setFontSize(24);
      doc.setTextColor(template.themeColor || '#1e40af');
      doc.text('INVOICE', 200, 25, { align: 'right' });
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Invoice #: ${invoiceNumber}`, 200, 35, { align: 'right' });
      doc.text(`Date: ${invoiceDate}`, 200, 40, { align: 'right' });

      yPos = Math.max(yPos, 50);

      // Divider line
      doc.setDrawColor(200, 200, 200);
      doc.line(15, yPos, 195, yPos);
      yPos += 10;

      // Bill To Section
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('BILL TO:', 15, yPos);
      yPos += 7;

      doc.setFontSize(11);
      doc.setTextColor(50, 50, 50);
      doc.text(client.name, 15, yPos);
      yPos += 6;

      if (client.contact_number) {
        doc.setFontSize(10);
        doc.text(`Phone: ${client.contact_number}`, 15, yPos);
        yPos += 6;
      }

      // Booking Details
      if (client.flight_date || client.pnr || client.airline) {
        yPos += 2;
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        if (client.flight_date) {
          doc.text(`Travel Date: ${new Date(client.flight_date).toLocaleDateString()}`, 15, yPos);
          yPos += 5;
        }
        if (client.pnr) {
          doc.text(`PNR: ${client.pnr}`, 15, yPos);
          yPos += 5;
        }
        if (client.airline) {
          doc.text(`Airline: ${client.airline}`, 15, yPos);
          yPos += 5;
        }
        if (client.group_booking_type === 'group' && client.group_size) {
          doc.text(`Group Size: ${client.group_size} passengers`, 15, yPos);
          yPos += 5;
        }
      }

      yPos += 5;

      // Invoice Table
      const tableData = [
        [itemDescription, `Rs ${amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`]
      ];

      autoTable(doc, {
        startY: yPos,
        head: [['Description', 'Amount']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: template.themeColor || '#1e40af',
          textColor: '#ffffff',
          fontSize: 11,
        },
        columnStyles: {
          0: { cellWidth: 130 },
          1: { cellWidth: 'auto', halign: 'right' },
        },
        margin: { left: 15, right: 15 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;

      // Payment Summary
      doc.setFillColor(240, 240, 240);
      doc.rect(120, yPos, 75, 30, 'F');

      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text('Subtotal:', 125, yPos + 7);
      doc.text(`Rs ${amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`, 190, yPos + 7, { align: 'right' });

      doc.text('Amount Paid:', 125, yPos + 14);
      doc.text(`Rs ${paid.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`, 190, yPos + 14, { align: 'right' });

      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(template.themeColor || '#1e40af');
      doc.text('Balance Due:', 125, yPos + 24);
      doc.text(`Rs ${balance.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`, 190, yPos + 24, { align: 'right' });

      yPos += 40;

      // Additional Notes
      if (additionalNotes.trim()) {
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('Notes:', 15, yPos);
        yPos += 6;
        const notes = doc.splitTextToSize(additionalNotes, 180);
        doc.text(notes, 15, yPos);
        yPos += notes.length * 5;
      }

      // Footer
      yPos = 270;
      doc.setDrawColor(200, 200, 200);
      doc.line(15, yPos, 195, yPos);
      yPos += 7;

      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text('Thank you for your business!', 105, yPos, { align: 'center' });

      // Save PDF
      const fileName = `Invoice-${client.name.replace(/\s+/g, '-')}-${new Date().getTime()}.pdf`;
      doc.save(fileName);

      // Save invoice record to database
      const { error: insertError } = await supabase
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          client_id: client.id,
          agency_id: profile.agency_id,
          generated_by: user.id,
          amount,
          amount_paid: paid,
          balance_due: balance,
          invoice_date: new Date().toISOString().split('T')[0],
          item_description: itemDescription,
          additional_notes: additionalNotes || null,
          pdf_data: {
            client_name: client.name,
            destination: client.destination,
            flight_date: client.flight_date,
            pnr: client.pnr,
            airline: client.airline,
          },
        });

      if (insertError) {
        console.error("Failed to save invoice record:", insertError);
      }
      
      toast({
        title: "Success",
        description: `Invoice ${invoiceNumber} generated successfully`,
      });
      
      if (!insertError) {
        loadInvoiceHistory(); // Refresh history
      }

      setOpen(false);
    } catch (error: any) {
      console.error("Error generating invoice:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate invoice",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <FileText className="w-4 h-4 mr-2" />
        Generate Invoice
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate Invoice</DialogTitle>
            <DialogDescription>
              Create a professional invoice for {client.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Invoice History */}
            {invoiceHistory.length > 0 && (
              <div className="mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full"
                >
                  <History className="w-4 h-4 mr-2" />
                  {showHistory ? "Hide" : "View"} Invoice History ({invoiceHistory.length})
                </Button>

                {showHistory && (
                  <div className="mt-3 border rounded-lg p-4 bg-muted/50 space-y-2 max-h-48 overflow-y-auto">
                    <h4 className="font-semibold text-sm mb-2">Previous Invoices</h4>
                    {invoiceHistory.map((invoice) => (
                      <div key={invoice.id} className="flex justify-between items-center text-sm py-2 border-b last:border-0">
                        <div>
                          <p className="font-medium">{invoice.invoice_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(invoice.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">Rs {Number(invoice.amount).toLocaleString('en-PK')}</p>
                          <p className="text-xs text-muted-foreground">
                            Balance: Rs {Number(invoice.balance_due).toLocaleString('en-PK')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Client Info Preview */}
            <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
              <h4 className="font-semibold">Client Information</h4>
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Name:</span> {client.name}</p>
                {client.contact_number && (
                  <p><span className="text-muted-foreground">Phone:</span> {client.contact_number}</p>
                )}
                {client.destination && (
                  <p><span className="text-muted-foreground">Destination:</span> {client.destination}</p>
                )}
                {client.flight_date && (
                  <p><span className="text-muted-foreground">Travel Date:</span> {new Date(client.flight_date).toLocaleDateString()}</p>
                )}
              </div>
            </div>

            {/* Amount Details */}
            <div className="p-4 border rounded-lg space-y-2">
              <h4 className="font-semibold">Payment Summary</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="font-semibold">Rs {(client.selling_price || 0).toLocaleString('en-PK')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Paid:</span>
                  <span className="font-semibold text-green-600">Rs {(client.amount_paid || 0).toLocaleString('en-PK')}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-semibold">Balance Due:</span>
                  <span className="font-bold text-lg text-primary">
                    Rs {((client.selling_price || 0) - (client.amount_paid || 0)).toLocaleString('en-PK')}
                  </span>
                </div>
              </div>
            </div>

            {/* Item Description */}
            <div className="space-y-2">
              <Label htmlFor="item-description">Item Description</Label>
              <Input
                id="item-description"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="e.g., Umrah Package - Standard"
              />
            </div>

            {/* Additional Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Add any special terms, conditions, or notes..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={generateInvoice} disabled={isGenerating}>
              <Download className="w-4 h-4 mr-2" />
              {isGenerating ? "Generating..." : "Generate PDF"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
