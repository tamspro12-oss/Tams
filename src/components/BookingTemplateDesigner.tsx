import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Save, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function BookingTemplateDesigner() {
  const { toast } = useToast();
  const [agencyName, setAgencyName] = useState("");
  const [agencyPhone, setAgencyPhone] = useState("");
  const [agencyEmail, setAgencyEmail] = useState("");
  const [agencyAddress, setAgencyAddress] = useState("");
  const [bookingPrefix, setBookingPrefix] = useState("BKG");
  const [headerText, setHeaderText] = useState("BOOKING CONFIRMATION");
  const [footerText, setFooterText] = useState("Thank you for booking with us!");
  const [themeColor, setThemeColor] = useState("#1e40af");
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadBookingTemplate();
  }, []);

  const loadBookingTemplate = () => {
    try {
      const template = localStorage.getItem("booking_template");
      if (template) {
        const data = JSON.parse(template);
        setAgencyName(data.agencyName || "");
        setAgencyPhone(data.phone || "");
        setAgencyEmail(data.email || "");
        setAgencyAddress(data.address || "");
        setBookingPrefix(data.prefix || "BKG");
        setHeaderText(data.headerText || "BOOKING CONFIRMATION");
        setFooterText(data.footerText || "Thank you for booking with us!");
        setThemeColor(data.themeColor || "#1e40af");
      }
    } catch (error) {
      console.error("Failed to load booking template:", error);
    }
  };

  const handleSaveTemplate = () => {
    if (!agencyName.trim()) {
      toast({
        title: "Error",
        description: "Agency name is required",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const template = {
        agencyName,
        phone: agencyPhone,
        email: agencyEmail,
        address: agencyAddress,
        prefix: bookingPrefix,
        headerText,
        footerText,
        themeColor,
        updatedAt: new Date().toISOString(),
      };

      localStorage.setItem("booking_template", JSON.stringify(template));

      toast({
        title: "Success",
        description: "Booking template saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save booking template",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Booking Template Designer
        </CardTitle>
        <CardDescription>
          Customize your booking confirmation template for client communications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Agency Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="booking-agency-name">Agency Name *</Label>
            <Input
              id="booking-agency-name"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="Your Agency Name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="booking-phone">Phone Number</Label>
            <Input
              id="booking-phone"
              value={agencyPhone}
              onChange={(e) => setAgencyPhone(e.target.value)}
              placeholder="+92 300 1234567"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="booking-email">Email</Label>
            <Input
              id="booking-email"
              type="email"
              value={agencyEmail}
              onChange={(e) => setAgencyEmail(e.target.value)}
              placeholder="info@agency.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="booking-prefix">Booking Prefix</Label>
            <Input
              id="booking-prefix"
              value={bookingPrefix}
              onChange={(e) => setBookingPrefix(e.target.value.toUpperCase())}
              placeholder="BKG"
              maxLength={10}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="booking-address">Address</Label>
          <Textarea
            id="booking-address"
            value={agencyAddress}
            onChange={(e) => setAgencyAddress(e.target.value)}
            placeholder="Enter your complete business address"
            rows={3}
          />
        </div>

        {/* Template Customization */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="header-text">Header Text</Label>
            <Input
              id="header-text"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder="BOOKING CONFIRMATION"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="theme-color">Theme Color</Label>
            <div className="flex gap-2">
              <Input
                id="theme-color"
                type="color"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="w-20 h-10 cursor-pointer"
              />
              <Input
                type="text"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                placeholder="#1e40af"
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="footer-text">Footer Text</Label>
          <Textarea
            id="footer-text"
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            placeholder="Thank you for booking with us!"
            rows={2}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-4 border-t">
          <Button 
            onClick={handleSaveTemplate}
            disabled={isSaving || !agencyName.trim()}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Template"}
          </Button>
          <Button 
            onClick={() => setShowPreview(!showPreview)}
            variant="outline"
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? "Hide Preview" : "Show Preview"}
          </Button>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="mt-6 p-6 border rounded-lg bg-background">
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="text-center space-y-2" style={{ borderBottom: `2px solid ${themeColor}`, paddingBottom: '1rem' }}>
                <h2 className="text-2xl font-bold" style={{ color: themeColor }}>
                  {headerText || "BOOKING CONFIRMATION"}
                </h2>
                <p className="text-lg font-semibold">{agencyName || "Your Agency Name"}</p>
                {agencyPhone && <p className="text-sm text-muted-foreground">{agencyPhone}</p>}
                {agencyEmail && <p className="text-sm text-muted-foreground">{agencyEmail}</p>}
                {agencyAddress && <p className="text-sm text-muted-foreground">{agencyAddress}</p>}
              </div>
              
              <div className="py-4 space-y-2">
                <p className="text-sm"><strong>Booking ID:</strong> {bookingPrefix}-2025-001</p>
                <p className="text-sm"><strong>Client Name:</strong> Sample Client</p>
                <p className="text-sm"><strong>Flight Date:</strong> {new Date().toLocaleDateString()}</p>
                <p className="text-sm"><strong>PNR:</strong> ABC123</p>
              </div>

              <div className="text-center pt-4 border-t">
                <p className="text-sm text-muted-foreground">{footerText}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
