import { useState, useEffect, useRef } from "react";
import { useFormKeyboardNav } from "@/hooks/useFormKeyboardNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MessageSquare, Save, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAgency } from "@/hooks/useAgency";
import { useAuth } from "@/hooks/useAuth";
import { loadAgencyTemplate, saveAgencyTemplate } from "@/lib/agencyTemplates";

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
    void loadTemplates();
  }, [agency?.id]);

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

  const loadTemplates = async () => {
    try {
      const result = await loadAgencyTemplate<Record<string, any>>(
        "reminder_templates",
        agency?.id
      );
      if (result.data) {
        const data = result.data;
        setAgencyName(data.agencyName || "");
        setAgencyPhone(data.phone || "");
        setAgencyEmail(data.email || "");
        setFlightReminderTemplate(data.flightReminder || getDefaultFlightTemplate(data.agencyName));
        setPaymentReminderTemplate(data.paymentReminder || getDefaultPaymentTemplate(data.agencyName));
      } else {
        if (result.errorMessage) {
          toast({
            title: "Error",
            description: result.errorMessage,
            variant: "destructive",
          });
        }
        setFlightReminderTemplate(getDefaultFlightTemplate());
        setPaymentReminderTemplate(getDefaultPaymentTemplate());
      }
    } catch (error) {
      console.error("Failed to load reminder templates:", error);
      setFlightReminderTemplate(getDefaultFlightTemplate());
      setPaymentReminderTemplate(getDefaultPaymentTemplate());
    }
  };

  const handleSaveTemplates = async () => {
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

      const saveResult = await saveAgencyTemplate("reminder_templates", templates, agency?.id);
      if (!saveResult.ok) {
        toast({
          title: "Could not save templates",
          description: saveResult.errorMessage || "Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: saveResult.savedToDb
          ? "Reminder templates saved successfully"
          : "Reminder templates saved locally (pending server sync)",
      });
    } catch (error) {
      console.error("Failed to save reminder templates:", error);
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

  const cardRef = useRef<HTMLDivElement>(null);

  useFormKeyboardNav({
    containerRef: cardRef,
    enabled: true,
    autoFocusFirst: false,
    onSave: handleSaveTemplates,
  });

  return (
    <Card ref={cardRef} className="border shadow-xs">
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
              data-save-button="true"
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

      <CardContent className="p-4 sm:p-5 space-y-3">
        {/* Available Placeholders Compact Banner */}
        <div className="p-2.5 bg-muted/40 border rounded-lg">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground text-xs mr-1">Placeholders:</span>
            <code className="bg-background px-1.5 py-0.5 rounded border text-[10px] font-mono">[CLIENT_NAME]</code>
            <code className="bg-background px-1.5 py-0.5 rounded border text-[10px] font-mono">[FLIGHT_DATE]</code>
            <code className="bg-background px-1.5 py-0.5 rounded border text-[10px] font-mono">[TOTAL_AMOUNT]</code>
            <code className="bg-background px-1.5 py-0.5 rounded border text-[10px] font-mono">[AMOUNT_PAID]</code>
            <code className="bg-background px-1.5 py-0.5 rounded border text-[10px] font-mono">[BALANCE_DUE]</code>
            <code className="bg-background px-1.5 py-0.5 rounded border text-[10px] font-mono">[DUE_DATE]</code>
            <code className="bg-background px-1.5 py-0.5 rounded border text-[10px] font-mono">[AGENCY_NAME]</code>
          </div>
        </div>

        {/* Side-by-side templates - large enough with NO inner scrollbar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Flight Reminder Template */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="flight-reminder" className="text-xs font-semibold">
                Flight Reminder Message
              </Label>
              <span className="text-[11px] text-muted-foreground">Sent before flight date</span>
            </div>
            <Textarea
              id="flight-reminder"
              value={flightReminderTemplate}
              onChange={(e) => setFlightReminderTemplate(e.target.value)}
              placeholder="Enter flight reminder template"
              rows={11}
              className="font-mono text-xs leading-relaxed resize-none overflow-hidden"
            />
          </div>

          {/* Payment Reminder Template */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="payment-reminder" className="text-xs font-semibold">
                Payment Reminder Message
              </Label>
              <span className="text-[11px] text-muted-foreground">Sent for pending balances</span>
            </div>
            <Textarea
              id="payment-reminder"
              value={paymentReminderTemplate}
              onChange={(e) => setPaymentReminderTemplate(e.target.value)}
              placeholder="Enter payment reminder template"
              rows={11}
              className="font-mono text-xs leading-relaxed resize-none overflow-hidden"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
