import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";
import { BasicCalculator } from "@/components/BasicCalculator";
import { TicketPayableCalculator } from "@/components/TicketPayableCalculator";
import { cn } from "@/lib/utils";

export default function SmartCalculator() {
  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <div className={cn("p-8", isFullScreen && "fixed inset-0 z-50 bg-background overflow-auto")}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Smart Calculator</h1>
          <p className="text-muted-foreground mt-1">Professional calculation tools for your agency</p>
        </div>
        <Button
          onClick={() => setIsFullScreen(!isFullScreen)}
          variant="outline"
          size="lg"
          className="gap-2"
        >
          {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          {isFullScreen ? "Exit Full Screen" : "Full Screen"}
        </Button>
      </div>

      <Tabs defaultValue="ticket" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="ticket">Ticket Payable</TabsTrigger>
          <TabsTrigger value="basic">Basic Calculator</TabsTrigger>
        </TabsList>

        <TabsContent value="ticket" className="mt-6">
          <TicketPayableCalculator />
        </TabsContent>

        <TabsContent value="basic" className="mt-6">
          <BasicCalculator />
        </TabsContent>
      </Tabs>
    </div>
  );
}
