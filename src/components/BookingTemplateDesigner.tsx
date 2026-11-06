import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText, Save, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAgency } from "@/hooks/useAgency";
import { useAuth } from "@/hooks/useAuth";

export function BookingTemplateDesigner() {
  const { toast } = useToast();
  const { data: agency } = useAgency();
  const { user } = useAuth();

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

  // Auto-populate from signup/account profile if empty
  useEffect(() => {
    if (agency) {
      setAgencyName((prev) => prev || agency.name || "");
      setAgencyPhone((prev) => prev || agency.phone_number || "");
      setAgencyEmail((prev) => prev || agency.email || user?.email || "");
    }
  }, [agency, user]);

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
    <Card className="border shadow-xs">
      <CardHeader className="py-3 px-4 sm:px-5 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Booking Confirmation Template Designer
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Customize booking confirmation vouchers and itinerary headers
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
              onClick={handleSaveTemplate}
              disabled={isSaving || !agencyName.trim()}
              className="h-8 text-xs font-semibold gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Saving..." : "Save Template"}</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Compact Grid: Auto-filled Agency details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label htmlFor="booking-agency-name" className="text-xs font-semibold">
              Agency Name *
            </Label>
            <Input
              id="booking-agency-name"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="Your Agency Name"
              className="h-8.5 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="booking-phone" className="text-xs font-semibold">
              Phone Number
            </Label>
            <Input
              id="booking-phone"
              value={agencyPhone}
              onChange={(e) => setAgencyPhone(e.target.value)}
              placeholder="+92 300 1234567"
              className="h-8.5 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="booking-email" className="text-xs font-semibold">
              Email Address
            </Label>
            <Input
              id="booking-email"
              type="email"
              value={agencyEmail}
              onChange={(e) => setAgencyEmail(e.target.value)}
              placeholder="info@agency.com"
              className="h-8.5 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="booking-prefix" className="text-xs font-semibold">
              Booking Prefix
            </Label>
            <Input
              id="booking-prefix"
              value={bookingPrefix}
              onChange={(e) => setBookingPrefix(e.target.value.toUpperCase())}
              placeholder="BKG"
              maxLength={10}
              className="h-8.5 text-xs font-mono uppercase"
            />
          </div>
        </div>

        {/* Row 2: Address, Header, Color, Footer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="header-text" className="text-xs font-semibold">
              Header Title Text
            </Label>
            <Input
              id="header-text"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder="BOOKING CONFIRMATION"
              className="h-8.5 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="theme-color" className="text-xs font-semibold">
              Brand Accent Color
            </Label>
            <div className="flex gap-2">
              <Input
                id="theme-color"
                type="color"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="w-12 h-8.5 p-1 cursor-pointer"
              />
              <Input
                type="text"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                placeholder="#1e40af"
                className="flex-1 h-8.5 text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="footer-text" className="text-xs font-semibold">
              Footer Note / Salutation
            </Label>
            <Input
              id="footer-text"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="Thank you for booking with us!"
              className="h-8.5 text-xs"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="booking-address" className="text-xs font-semibold">
            Office Business Address
          </Label>
          <Input
            id="booking-address"
            value={agencyAddress}
            onChange={(e) => setAgencyAddress(e.target.value)}
            placeholder="Complete office address, city, country"
            className="h-8.5 text-xs"
          />
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <div className="p-4 border rounded-lg bg-card/60 backdrop-blur-xs space-y-3">
            <div className="text-center pb-3 space-y-1 border-b-2" style={{ borderColor: themeColor }}>
              <h3 className="text-base font-bold tracking-wide" style={{ color: themeColor }}>
                {headerText || "BOOKING CONFIRMATION"}
              </h3>
              <p className="text-sm font-semibold text-foreground">{agencyName || "Your Agency Name"}</p>
              <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
                {agencyPhone && <span>Tel: {agencyPhone}</span>}
                {agencyEmail && <span>Email: {agencyEmail}</span>}
                {agencyAddress && <span>{agencyAddress}</span>}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs p-2.5 bg-muted/40 rounded-md">
              <div>
                <span className="text-muted-foreground block text-[10px]">Booking Ref</span>
                <span className="font-semibold">{bookingPrefix}-2026-001</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Client</span>
                <span className="font-semibold">Sample Passenger</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Flight Date</span>
                <span className="font-semibold">{new Date().toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Status</span>
                <span className="text-emerald-600 font-semibold">Confirmed</span>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground italic pt-1">
              {footerText}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
