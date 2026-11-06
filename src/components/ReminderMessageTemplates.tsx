import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MessageSquare, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function ReminderMessageTemplates() {
  const { toast } = useToast();
  const [flightReminderTemplate, setFlightReminderTemplate] = useState("");
  const [paymentReminderTemplate, setPaymentReminderTemplate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = () => {
    try {
      const templates = localStorage.getItem("reminder_templates");
      if (templates) {
        const data = JSON.parse(templates);
        setFlightReminderTemplate(data.flightReminder || getDefaultFlightTemplate());
        setPaymentReminderTemplate(data.paymentReminder || getDefaultPaymentTemplate());
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

  const getDefaultFlightTemplate = () => {
    return `Dear [CLIENT_NAME],

This is a friendly reminder that your flight is scheduled for [FLIGHT_DATE].

Please ensure you have all necessary documents ready.

Best regards,
[AGENCY_NAME]`;
  };

  const getDefaultPaymentTemplate = () => {
    return `Dear [CLIENT_NAME],

This is a reminder about your pending payment:

Total Amount: Rs [TOTAL_AMOUNT]
Amount Paid: Rs [AMOUNT_PAID]
Balance Due: Rs [BALANCE_DUE]
Due Date: [DUE_DATE]

Please complete your payment at your earliest convenience.

Best regards,
[AGENCY_NAME]`;
  };

  const handleSaveTemplates = () => {
    setIsSaving(true);
    try {
      const templates = {
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
    setFlightReminderTemplate(getDefaultFlightTemplate());
    setPaymentReminderTemplate(getDefaultPaymentTemplate());
    toast({
      title: "Templates Reset",
      description: "Reminder templates have been reset to default values",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Reminder Message Templates
        </CardTitle>
        <CardDescription>
          Customize reminder messages sent to clients via email or WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Available Placeholders */}
        <div className="p-4 bg-muted/50 border rounded-lg">
          <p className="text-sm font-semibold mb-2">Available Placeholders:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
            <code className="bg-background px-2 py-1 rounded">[CLIENT_NAME]</code>
            <code className="bg-background px-2 py-1 rounded">[FLIGHT_DATE]</code>
            <code className="bg-background px-2 py-1 rounded">[TOTAL_AMOUNT]</code>
            <code className="bg-background px-2 py-1 rounded">[AMOUNT_PAID]</code>
            <code className="bg-background px-2 py-1 rounded">[BALANCE_DUE]</code>
            <code className="bg-background px-2 py-1 rounded">[DUE_DATE]</code>
            <code className="bg-background px-2 py-1 rounded">[AGENCY_NAME]</code>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            These placeholders will be automatically replaced with actual client data when sending reminders.
          </p>
        </div>

        {/* Flight Reminder Template */}
        <div className="space-y-2">
          <Label htmlFor="flight-reminder">Flight Reminder Template</Label>
          <Textarea
            id="flight-reminder"
            value={flightReminderTemplate}
            onChange={(e) => setFlightReminderTemplate(e.target.value)}
            placeholder="Enter flight reminder message template"
            rows={8}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Used when sending flight date reminders to clients
          </p>
        </div>

        {/* Payment Reminder Template */}
        <div className="space-y-2">
          <Label htmlFor="payment-reminder">Payment Reminder Template</Label>
          <Textarea
            id="payment-reminder"
            value={paymentReminderTemplate}
            onChange={(e) => setPaymentReminderTemplate(e.target.value)}
            placeholder="Enter payment reminder message template"
            rows={10}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Used when sending payment due reminders to clients
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-4 border-t">
          <Button 
            onClick={handleSaveTemplates}
            disabled={isSaving}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Templates"}
          </Button>
          <Button 
            onClick={handleResetToDefault}
            variant="outline"
          >
            Reset to Default
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
