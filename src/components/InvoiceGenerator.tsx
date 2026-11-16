import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, History, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getAuthenticatedAgencyId } from "@/lib/agencyContext";
import { DocumentNumberControl } from "@/components/ui/DocumentNumberControl";
import { withDuplicateRetry } from "@/lib/supabaseErrorHandler";
import { loadAgencyTemplate } from "@/lib/agencyTemplates";
import { createRequestId, rpcWithPreSqlFallback, runBackgroundTask } from "@/lib/atomicSave";
import { runUiAtomicSave } from "@/lib/atomicSaveUi";
import { useFormKeyboardNav } from "@/hooks/useFormKeyboardNav";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { refreshAffectedFinancialQueries } from "@/lib/accountingEngine";
import { useQueryClient } from "@tanstack/react-query";
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
  const isGeneratingRef = useRef(false);
  const requestIdRef = useRef<string>(createRequestId());
  const dialogFormRef = useRef<HTMLDivElement>(null);
  const cachedTemplateRef = useRef<Record<string, any> | null>(null);
  const [invoicePreviewNo, setInvoicePreviewNo] = useState("Auto-assigned");
  const [isManualInvoiceNo, setIsManualInvoiceNo] = useState(false);
  const [manualInvoiceNo, setManualInvoiceNo] = useState("");
  const { toast } = useToast();
  const { data: agencyIdHook } = useCurrentAgencyId();
  const queryClient = useQueryClient();

  useFormKeyboardNav({
    containerRef: dialogFormRef,
    enabled: open,
    isDirty: Boolean(additionalNotes.trim()),
    onSave: () => generateInvoice(),
    onCancel: () => setOpen(false),
  });

  // Load invoice history, template, and preview number when dialog opens
  useEffect(() => {
    if (open) {
      loadInvoiceHistory();
      setIsManualInvoiceNo(false);
      setManualInvoiceNo("");
      supabase.rpc("preview_next_number", { p_counter_type: "invoice" }).then(({ data, error }) => {
        setInvoicePreviewNo(!error && data ? String(data) : "Auto-assigned");
      });
      if (agencyIdHook) {
        loadAgencyTemplate<Record<string, any>>("invoice_template", agencyIdHook)
          .then((res) => {
            if (res?.data) cachedTemplateRef.current = res.data;
          })
          .catch(() => {});
      }
    }
  }, [open, agencyIdHook]);

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

  const generateInvoice = async () => {
    if (isGeneratingRef.current || isGenerating) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast({
        title: "Offline",
        description: "Network connection issue. You are offline, not saved.",
        variant: "destructive",
      });
      return;
    }

    if (isManualInvoiceNo && !manualInvoiceNo.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a custom invoice number or switch back to Auto.",
        variant: "destructive",
      });
      return;
    }

    let template = cachedTemplateRef.current;
    if (!template) {
      const agencyIdResolved = agencyIdHook || (await getAuthenticatedAgencyId());
      if (!agencyIdResolved) {
        toast({
          title: "Error",
          description: "Unable to identify agency account.",
          variant: "destructive",
        });
        return;
      }
      const templateResult = await loadAgencyTemplate<Record<string, any>>(
        "invoice_template",
        agencyIdResolved
      );
      if (!templateResult.data) {
        toast({
          title: "Error",
          description: "Please set up your invoice template in Settings first",
          variant: "destructive",
        });
        return;
      }
      template = templateResult.data;
      cachedTemplateRef.current = template;
    }

    const amount = Math.max(0, Number(client.selling_price) || 0);
    const paid = Math.max(0, Number(client.amount_paid) || 0);
    const balance = Math.max(0, amount - paid);

    await runUiAtomicSave<{ invoiceNumber: string }>({
      requestIdRef,
      isLockedRef: isGeneratingRef,
      setIsSubmitting: setIsGenerating,
      contextLabel: "InvoiceGenerator.generateInvoice",
      fallbackErrorMessage: "Failed to generate invoice",
      execute: async (requestId) => {
        const rpcRes = await rpcWithPreSqlFallback<any>(
          supabase as any,
          "generate_client_invoice_atomic",
          {
            p_client_id: client.id,
            p_invoice_number: isManualInvoiceNo ? manualInvoiceNo.trim() : null,
            p_item_description: itemDescription.trim() || "Travel Package",
            p_additional_notes: additionalNotes || null,
            p_is_manual: isManualInvoiceNo,
            p_request_id: requestId,
          },
          {
            isAutoMode: !isManualInvoiceNo,
            legacyFallback: async () => {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error("User not authenticated");
              const agencyId = agencyIdHook || (await getAuthenticatedAgencyId());
              if (!agencyId) throw new Error("Agency not found");

              const inserted = await withDuplicateRetry(
                async () => {
                  const { data, error: insertError } = await (supabase as any)
                    .from("invoices")
                    .insert({
                      invoice_number: isManualInvoiceNo ? manualInvoiceNo.trim() : "",
                      client_id: client.id,
                      agency_id: agencyId,
                      generated_by: user.id,
                      amount,
                      amount_paid: paid,
                      balance_due: balance,
                      invoice_date: new Date().toISOString().split("T")[0],
                      item_description: itemDescription.trim() || "Travel Package",
                      additional_notes: additionalNotes || null,
                      pdf_data: {
                        client_name: client.name,
                        destination: client.destination,
                        flight_date: client.flight_date,
                        pnr: client.pnr,
                        airline: client.airline,
                      },
                    })
                    .select("invoice_number")
                    .single();
                  if (insertError) throw insertError;
                  return data;
                },
                { isAutoMode: !isManualInvoiceNo }
              );
              return { invoice: inserted };
            },
          }
        );

        const invObj = rpcRes?.invoice ?? rpcRes;
        const invoiceNumber =
          invObj?.invoice_number || (isManualInvoiceNo ? manualInvoiceNo.trim() : invoicePreviewNo);
        return { invoiceNumber };
      },
      onSuccess: ({ invoiceNumber }) => {
        setOpen(false);
        toast({
          title: "Success",
          description: `Invoice ${invoiceNumber} generated successfully`,
        });

        runBackgroundTask("InvoiceGenerator.pdfAndRefresh", () => {
          try {
            const invoiceDate = new Date().toLocaleDateString();
            const doc = new jsPDF();
            let yPos = 20;

            if (template!.logo) {
              try {
                doc.addImage(template!.logo, "PNG", 15, yPos, 40, 16);
                yPos += 20;
              } catch (error) {
                console.log("Could not add logo", error);
              }
            }

            doc.setFontSize(20);
            doc.setTextColor(template!.themeColor || "#1e40af");
            doc.text(template!.agencyName || "Agency Name", 15, yPos);
            yPos += 8;

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            if (template!.phone) {
              doc.text(`Phone: ${template!.phone}`, 15, yPos);
              yPos += 5;
            }
            if (template!.email) {
              doc.text(`Email: ${template!.email}`, 15, yPos);
              yPos += 5;
            }
            if (template!.address) {
              const addressLines = doc.splitTextToSize(template!.address, 80);
              doc.text(addressLines, 15, yPos);
              yPos += addressLines.length * 5;
            }

            doc.setFontSize(24);
            doc.setTextColor(template!.themeColor || "#1e40af");
            doc.text("INVOICE", 200, 25, { align: "right" });

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Invoice #: ${invoiceNumber}`, 200, 35, { align: "right" });
            doc.text(`Date: ${invoiceDate}`, 200, 40, { align: "right" });

            yPos = Math.max(yPos, 50);

            doc.setDrawColor(200, 200, 200);
            doc.line(15, yPos, 195, yPos);
            yPos += 10;

            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text("BILL TO:", 15, yPos);
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
              if (client.group_booking_type === "group" && client.group_size) {
                doc.text(`Group Size: ${client.group_size} passengers`, 15, yPos);
                yPos += 5;
              }
            }

            yPos += 5;

            const tableData = [
              [itemDescription, `Rs ${amount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`],
            ];

            autoTable(doc, {
              startY: yPos,
              head: [["Description", "Amount"]],
              body: tableData,
              theme: "striped",
              headStyles: {
                fillColor: template!.themeColor || "#1e40af",
                textColor: "#ffffff",
                fontSize: 11,
              },
              columnStyles: {
                0: { cellWidth: 130 },
                1: { cellWidth: "auto", halign: "right" },
              },
              margin: { left: 15, right: 15 },
            });

            yPos = (doc as any).lastAutoTable.finalY + 10;

            doc.setFillColor(240, 240, 240);
            doc.rect(120, yPos, 75, 30, "F");

            doc.setFontSize(10);
            doc.setTextColor(50, 50, 50);
            doc.text("Subtotal:", 125, yPos + 7);
            doc.text(`Rs ${amount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`, 190, yPos + 7, { align: "right" });

            doc.text("Amount Paid:", 125, yPos + 14);
            doc.text(`Rs ${paid.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`, 190, yPos + 14, { align: "right" });

            doc.setFontSize(12);
            doc.setFont(undefined as any, "bold");
            doc.setTextColor(template!.themeColor || "#1e40af");
            doc.text("Balance Due:", 125, yPos + 24);
            doc.text(`Rs ${balance.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`, 190, yPos + 24, { align: "right" });

            yPos += 40;

            if (additionalNotes.trim()) {
              doc.setFont(undefined as any, "normal");
              doc.setFontSize(10);
              doc.setTextColor(100, 100, 100);
              doc.text("Notes:", 15, yPos);
              yPos += 6;
              const notes = doc.splitTextToSize(additionalNotes, 180);
              doc.text(notes, 15, yPos);
              yPos += notes.length * 5;
            }

            yPos = 270;
            doc.setDrawColor(200, 200, 200);
            doc.line(15, yPos, 195, yPos);
            yPos += 7;

            doc.setFontSize(9);
            doc.setTextColor(150, 150, 150);
            doc.text("Thank you for your business!", 105, yPos, { align: "center" });

            const fileName = `Invoice-${invoiceNumber}-${client.name.replace(/\s+/g, "-")}.pdf`;
            doc.save(fileName);
          } catch (pdfErr) {
            console.warn("Background invoice PDF error:", pdfErr);
          }

          loadInvoiceHistory();
          refreshAffectedFinancialQueries(queryClient, "invoice", agencyIdHook);
        });
      },
      onErrorToast: (friendlyMessage) => {
        toast({
          title: "Error",
          description: friendlyMessage,
          variant: "destructive",
        });
      },
    });
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
        <DialogContent ref={dialogFormRef} className="w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] overflow-y-auto">
          <DialogHeader className="pr-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <DialogTitle>Generate Invoice</DialogTitle>
                <DialogDescription>
                  Create a professional invoice for {client.name}
                </DialogDescription>
              </div>
              <DocumentNumberControl
                label="Invoice #:"
                docType="invoice"
                previewNumber={invoicePreviewNo}
                isManual={isManualInvoiceNo}
                manualValue={manualInvoiceNo}
                onManualModeChange={setIsManualInvoiceNo}
                onManualValueChange={setManualInvoiceNo}
              />
            </div>
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
            <Button data-save-button="true" onClick={generateInvoice} disabled={isGenerating}>
              <Download className="w-4 h-4 mr-2" />
              {isGenerating ? "Generating..." : "Generate PDF"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
