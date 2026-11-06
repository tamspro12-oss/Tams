import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Receipt, MessageSquare } from "lucide-react";
import { InvoiceTemplateDesigner } from "@/components/InvoiceTemplateDesigner";
import { BookingTemplateDesigner } from "@/components/BookingTemplateDesigner";
import { ReminderMessageTemplates } from "@/components/ReminderMessageTemplates";

export type BrandingView = "invoice" | "booking" | "reminder";

export function BrandingSettings() {
  const [activeTemplateView, setActiveTemplateView] = useState<BrandingView>("invoice");

  return (
    <div className="space-y-3">
      {/* Prominent, clean 3-button selector */}
      <div className="flex items-center justify-start border-b pb-2">
        <Tabs
          value={activeTemplateView}
          onValueChange={(val) => setActiveTemplateView(val as BrandingView)}
          className="w-full"
        >
          <TabsList className="h-9 p-1 bg-muted/60 border rounded-lg flex items-center justify-start gap-1 w-fit">
            <TabsTrigger
              value="invoice"
              className="gap-1.5 text-xs font-semibold px-3 py-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-md transition-all"
            >
              <Receipt className="w-3.5 h-3.5 text-blue-500" />
              Invoice Template
            </TabsTrigger>
            <TabsTrigger
              value="booking"
              className="gap-1.5 text-xs font-semibold px-3 py-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-md transition-all"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-500" />
              Booking Template
            </TabsTrigger>
            <TabsTrigger
              value="reminder"
              className="gap-1.5 text-xs font-semibold px-3 py-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-md transition-all"
            >
              <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
              Reminder Messages
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Active Template View */}
      <div className="pt-1">
        {activeTemplateView === "invoice" && <InvoiceTemplateDesigner />}
        {activeTemplateView === "booking" && <BookingTemplateDesigner />}
        {activeTemplateView === "reminder" && <ReminderMessageTemplates />}
      </div>
    </div>
  );
}
export default BrandingSettings;
