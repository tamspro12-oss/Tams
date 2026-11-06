import React, { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar, Users, Store, Ticket } from "lucide-react";

// Existing sub-modules (100% preserved)
import Clients from "@/pages/Clients";
import B2BAgents from "@/pages/B2BAgents";
import Vendors from "@/pages/Vendors";
import Vouchers from "@/pages/Vouchers";

type BookingTab = "clients" | "b2b-agents" | "vendors" | "vouchers";

export default function BookingsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get("tab") as BookingTab) || "clients";

  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val }, { replace: true });
  };

  return (
    <div className="space-y-4">
      <SeoHead
        title="Bookings & Operations Hub - TAMS Pro"
        description="Comprehensive bookings management for direct clients, B2B agents, suppliers, and service vouchers."
        path="/app/bookings"
      />

      {/* Hub Top Navigation Tabs */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md pb-2 pt-1 border-b border-border/50">
        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto h-11 p-1 bg-muted/60 border">
            <TabsTrigger value="clients" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <Calendar className="w-4 h-4 text-blue-500" />
              Direct Clients
            </TabsTrigger>
            <TabsTrigger value="b2b-agents" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <Users className="w-4 h-4 text-purple-500" />
              B2B Agents
            </TabsTrigger>
            <TabsTrigger value="vendors" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <Store className="w-4 h-4 text-emerald-500" />
              Vendors & Payables
            </TabsTrigger>
            <TabsTrigger value="vouchers" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <Ticket className="w-4 h-4 text-amber-500" />
              Vouchers & Itineraries
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Active Tab View */}
      <div className="pt-1">
        {currentTab === "clients" && <Clients />}
        {currentTab === "b2b-agents" && <B2BAgents />}
        {currentTab === "vendors" && <Vendors />}
        {currentTab === "vouchers" && <Vouchers />}
      </div>
    </div>
  );
}

