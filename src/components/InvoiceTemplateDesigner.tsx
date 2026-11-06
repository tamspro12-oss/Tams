import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileText, Save, Eye, Upload, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAgency } from "@/hooks/useAgency";
import { useAuth } from "@/hooks/useAuth";

export function InvoiceTemplateDesigner() {
  const { toast } = useToast();
  const { data: agency } = useAgency();
  const { user } = useAuth();

  const [invoiceLogo, setInvoiceLogo] = useState<string>("");
  const [invoiceAgencyName, setInvoiceAgencyName] = useState("");
  const [invoicePhone, setInvoicePhone] = useState("");
  const [invoiceEmail, setInvoiceEmail] = useState("");
  const [invoiceAddress, setInvoiceAddress] = useState("");
  const [invoicePrefix, setInvoicePrefix] = useState("INV");
  const [invoiceLayout, setInvoiceLayout] = useState("standard");
  const [invoiceThemeColor, setInvoiceThemeColor] = useState("#1e40af");
  const [showPreview, setShowPreview] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  useEffect(() => {
    loadInvoiceTemplate();
  }, []);

  // Auto-fill from signup/account profile
  useEffect(() => {
    if (agency) {
      setInvoiceAgencyName((prev) => prev || agency.name || "");
      setInvoicePhone((prev) => prev || agency.phone_number || "");
      setInvoiceEmail((prev) => prev || agency.email || user?.email || "");
    }
  }, [agency, user]);

  const loadInvoiceTemplate = () => {
    try {
      const template = localStorage.getItem("invoice_template");
      if (template) {
        const data = JSON.parse(template);
        setInvoiceLogo(data.logo || "");
        setInvoiceAgencyName(data.agencyName || "");
        setInvoicePhone(data.phone || "");
        setInvoiceEmail(data.email || "");
        setInvoiceAddress(data.address || "");
        setInvoicePrefix(data.prefix || "INV");
        setInvoiceLayout(data.layout || "standard");
        setInvoiceThemeColor(data.themeColor || "#1e40af");
      }
    } catch (error) {
      console.error("Failed to load invoice template:", error);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Logo size must be less than 2MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setInvoiceLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveInvoiceTemplate = () => {
    if (!invoiceAgencyName.trim()) {
      toast({
        title: "Error",
        description: "Agency name is required",
        variant: "destructive",
      });
      return;
    }

    setIsSavingTemplate(true);
    try {
      const template = {
        logo: invoiceLogo,
        agencyName: invoiceAgencyName,
        phone: invoicePhone,
        email: invoiceEmail,
        address: invoiceAddress,
        prefix: invoicePrefix,
        layout: invoiceLayout,
        themeColor: invoiceThemeColor,
        updatedAt: new Date().toISOString(),
      };

      localStorage.setItem("invoice_template", JSON.stringify(template));

      toast({
        title: "Success",
        description: "Invoice template saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save invoice template",
        variant: "destructive",
      });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  return (
    <Card className="border shadow-xs">
      <CardHeader className="py-3 px-4 sm:px-5 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Invoice Template Designer
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Customize client tax invoices, agency branding header, and color palette
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="h-8 text-xs gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showPreview ? "Hide Preview" : "Live Preview"}</span>
            </Button>
            <Button
              size="sm"
              onClick={handleSaveInvoiceTemplate}
              disabled={isSavingTemplate || !invoiceAgencyName.trim()}
              className="h-8 text-xs font-semibold gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingTemplate ? "Saving..." : "Save Template"}</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Compact Grid: Auto-filled Agency details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label htmlFor="invoice-agency-name" className="text-xs font-semibold">
              Agency Name *
            </Label>
            <Input
              id="invoice-agency-name"
              value={invoiceAgencyName}
              onChange={(e) => setInvoiceAgencyName(e.target.value)}
              placeholder="Your Agency Name"
              className="h-8.5 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="invoice-phone" className="text-xs font-semibold">
              Phone Number
            </Label>
            <Input
              id="invoice-phone"
              value={invoicePhone}
              onChange={(e) => setInvoicePhone(e.target.value)}
              placeholder="+92 300 1234567"
              className="h-8.5 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="invoice-email" className="text-xs font-semibold">
              Email Address
            </Label>
            <Input
              id="invoice-email"
              type="email"
              value={invoiceEmail}
              onChange={(e) => setInvoiceEmail(e.target.value)}
              placeholder="info@agency.com"
              className="h-8.5 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="invoice-prefix" className="text-xs font-semibold">
              Invoice Prefix
            </Label>
            <Input
              id="invoice-prefix"
              value={invoicePrefix}
              onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
              placeholder="INV"
              maxLength={10}
              className="h-8.5 text-xs font-mono uppercase"
            />
          </div>
        </div>

        {/* Row 2: Address, Layout, Theme Color & Logo Upload */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="invoice-address" className="text-xs font-semibold">
              Business Address
            </Label>
            <Input
              id="invoice-address"
              value={invoiceAddress}
              onChange={(e) => setInvoiceAddress(e.target.value)}
              placeholder="Full business address"
              className="h-8.5 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="invoice-layout" className="text-xs font-semibold">
              Layout Style
            </Label>
            <Select value={invoiceLayout} onValueChange={setInvoiceLayout}>
              <SelectTrigger id="invoice-layout" className="h-8.5 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard Header</SelectItem>
                <SelectItem value="modern">Modern Minimal</SelectItem>
                <SelectItem value="left-logo">Left Logo Brand</SelectItem>
                <SelectItem value="center-title">Center Title</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="invoice-theme-color" className="text-xs font-semibold">
              Invoice Theme Color
            </Label>
            <div className="flex gap-2">
              <Input
                id="invoice-theme-color"
                type="color"
                value={invoiceThemeColor}
                onChange={(e) => setInvoiceThemeColor(e.target.value)}
                className="w-12 h-8.5 p-1 cursor-pointer"
              />
              <Input
                type="text"
                value={invoiceThemeColor}
                onChange={(e) => setInvoiceThemeColor(e.target.value)}
                placeholder="#1e40af"
                className="flex-1 h-8.5 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Row 3: Logo Upload Compact Bar */}
        <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/40 rounded-lg border">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="invoice-logo" className="text-xs font-semibold flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-muted-foreground" />
              Agency Logo (Max 2MB, PNG/JPEG recommended)
            </Label>
            <Input
              id="invoice-logo"
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="h-8.5 text-xs mt-1 cursor-pointer"
            />
          </div>

          {invoiceLogo ? (
            <div className="w-16 h-12 border rounded-md p-1 bg-background flex items-center justify-center shrink-0">
              <img src={invoiceLogo} alt="Logo preview" className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div className="w-16 h-12 border border-dashed rounded-md flex items-center justify-center text-muted-foreground shrink-0 bg-background/50">
              <ImageIcon className="w-5 h-5 opacity-40" />
            </div>
          )}
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <div className="p-4 border rounded-lg bg-card/60 space-y-3">
            <div
              className="border-2 rounded-lg p-4 bg-background"
              style={{ borderColor: invoiceThemeColor }}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  {invoiceLogo && (
                    <img src={invoiceLogo} alt="Logo" className="h-10 object-contain mb-1" />
                  )}
                  <h3 className="text-base font-bold" style={{ color: invoiceThemeColor }}>
                    {invoiceAgencyName || "Your Agency Name"}
                  </h3>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {invoicePhone && <p>{invoicePhone}</p>}
                    {invoiceEmail && <p>{invoiceEmail}</p>}
                    {invoiceAddress && <p>{invoiceAddress}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <h4 className="text-lg font-bold" style={{ color: invoiceThemeColor }}>
                    INVOICE
                  </h4>
                  <p className="text-xs text-muted-foreground font-mono">{invoicePrefix}-2026-001</p>
                  <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString()}</p>
                </div>
              </div>

              <div className="border-t pt-2 text-xs">
                <div className="flex justify-between py-1 border-b">
                  <span className="font-medium">Umrah Ticket / Service Package</span>
                  <span className="font-semibold">Rs 150,000</span>
                </div>
                <div className="flex justify-between py-1.5 font-bold text-sm" style={{ color: invoiceThemeColor }}>
                  <span>Total Amount</span>
                  <span>Rs 150,000</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
export default InvoiceTemplateDesigner;
