import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MessageSquare, Save, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAgency } from "@/hooks/useAgency";
import { useAuth } from "@/hooks/useAuth";

export function ReminderMessageTemplates() {
  const { toast } = useToast();
  const { data: agency } = useAgency();
  const { user } = useAuth();

  const [agencyName, setAgencyName] = useState("");
  const [agencyPhone, setAgencyPhone] = useState("");
  const [agencyEmail, setAgencyEmail] = useState("");

  const [flightReminderTemplate, setFlightReminderTemplate] = useState("");
  const [paymentReminderTemplate, setPaymentReminderTemplate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  // Auto-populate from signup/account profile if empty
  useEffect(() => {
    if (agency) {
      setAgencyName((prev) => prev || agency.name || "");
      setAgencyPhone((prev) => prev || agency.phone_number || "");
      setAgencyEmail((prev) => prev || agency.email || user?.email || "");
    }
  }, [agency, user]);

  const getDefaultFlightTemplate = (currentAgencyName?: string) => {
    const name = currentAgencyName || agency?.name || "[AGENCY_NAME]";
    return `Dear [CLIENT_NAME],

This is a friendly reminder that your flight is scheduled for [FLIGHT_DATE].

Please ensure you have all necessary travel documents ready.

Best regards,
${name}`;
  };

  const getDefaultPaymentTemplate = (currentAgencyName?: string) => {
    const name = currentAgencyName || agency?.name || "[AGENCY_NAME]";
    return `Dear [CLIENT_NAME],

This is a reminder regarding your pending balance:

Total Amount: Rs [TOTAL_AMOUNT]
Amount Paid: Rs [AMOUNT_PAID]
Balance Due: Rs [BALANCE_DUE]
Due Date: [DUE_DATE]

Please settle your pending balance at your earliest convenience.

Best regards,
${name}`;
  };

  const loadTemplates = () => {
    try {
      const templates = localStorage.getItem("reminder_templates");
      if (templates) {
        const data = JSON.parse(templates);
        setAgencyName(data.agencyName || "");
        setAgencyPhone(data.phone || "");
        setAgencyEmail(data.email || "");
        setFlightReminderTemplate(data.flightReminder || getDefaultFlightTemplate(data.agencyName));
        setPaymentReminderTemplate(data.paymentReminder || getDefaultPaymentTemplate(data.agencyName));
      } else {
        setFlightReminderTemplate(getDefaultFlightTemplate());
        setPaymentReminderTemplate(getDefaultPaymentTemplate());
      }
    } catch (error) {
      console.error("Failed to load reminder templates:", error);
      setFlightReminderTemplate(getDefaultFlightTemplate());
      setPaymentReminderTemplate(getDefaultPaymentTemplate());
    }
  };

  const handleSaveTemplates = () => {
    setIsSaving(true);
    try {
      const templates = {
        agencyName,
        phone: agencyPhone,
        email: agencyEmail,
        flightReminder: flightReminderTemplate,
        paymentReminder: paymentReminderTemplate,
        updatedAt: new Date().toISOString(),
      };

      localStorage.setItem("reminder_templates", JSON.stringify(templates));

      toast({
        title: "Success",
        description: "Reminder templates saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save reminder templates",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    setFlightReminderTemplate(getDefaultFlightTemplate(agencyName));
    setPaymentReminderTemplate(getDefaultPaymentTemplate(agencyName));
    toast({
      title: "Templates Reset",
      description: "Reminder templates have been reset to default values",
    });
  };

  return (
    <Card className="border shadow-xs">
      <CardHeader className="py-3 px-4 sm:px-5 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Reminder Message Templates
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Customize reminder message templates sent to clients
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToDefault}
              className="h-8 text-xs gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
            <Button
              size="sm"
              onClick={handleSaveTemplates}
              disabled={isSaving}
              className="h-8 text-xs font-semibold gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Saving..." : "Save Templates"}</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Auto-populated Agency Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg border">
          <div className="space-y-1">
            <Label htmlFor="reminder-agency-name" className="text-xs font-semibold">
              Agency Name
            </Label>
            <Input
              id="reminder-agency-name"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="Agency Name"
              className="h-8.5 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="reminder-agency-phone" className="text-xs font-semibold">
              Phone Number
            </Label>
            <Input
              id="reminder-agency-phone"
              value={agencyPhone}
              onChange={(e) => setAgencyPhone(e.target.value)}
              placeholder="+92 300 1234567"
              className="h-8.5 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="reminder-agency-email" className="text-xs font-semibold">
              Email Address
            </Label>
            <Input
              id="reminder-agency-email"
              type="email"
              value={agencyEmail}
              onChange={(e) => setAgencyEmail(e.target.value)}
              placeholder="agency@example.com"
              className="h-8.5 text-xs"
            />
          </div>
        </div>

        {/* Available Placeholders Compact Banner */}
        <div className="p-2.5 bg-muted/30 border rounded-lg">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground text-xs mr-1">Placeholders:</span>
            <code className="bg-background px-1.5 py-0.5 rounded border text-[10px]">[CLIENT_NAME]</code>
            <code className="bg-background px-1.5 py-0.5 rounded border text-[10px]">[FLIGHT_DATE]</code>
            <code className="bg-background px-1.5 py-0.5 rounded border text-[10px]">[TOTAL_AMOUNT]</code>
            <code className="bg-background px-1.5 py-0.5 rounded border text-[10px]">[AMOUNT_PAID]</code>
            <code className="bg-background px-1.5 py-0.5 rounded border text-[10px]">[BALANCE_DUE]</code>
            <code className="bg-background px-1.5 py-0.5 rounded border text-[10px]">[DUE_DATE]</code>
            <code className="bg-background px-1.5 py-0.5 rounded border text-[10px]">[AGENCY_NAME]</code>
          </div>
        </div>

        {/* Side-by-side or stacked templates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Flight Reminder Template */}
          <div className="space-y-1.5">
            <Label htmlFor="flight-reminder" className="text-xs font-semibold">
              Flight Reminder Message
            </Label>
            <Textarea
              id="flight-reminder"
              value={flightReminderTemplate}
              onChange={(e) => setFlightReminderTemplate(e.target.value)}
              placeholder="Enter flight reminder template"
              rows={7}
              className="font-mono text-xs resize-none"
            />
            <p className="text-[11px] text-muted-foreground">
              Sent before upcoming passenger departure dates
            </p>
          </div>

          {/* Payment Reminder Template */}
          <div className="space-y-1.5">
            <Label htmlFor="payment-reminder" className="text-xs font-semibold">
              Payment Reminder Message
            </Label>
            <Textarea
              id="payment-reminder"
              value={paymentReminderTemplate}
              onChange={(e) => setPaymentReminderTemplate(e.target.value)}
              placeholder="Enter payment reminder template"
              rows={7}
              className="font-mono text-xs resize-none"
            />
            <p className="text-[11px] text-muted-foreground">
              Sent for accounts with pending balances due
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
