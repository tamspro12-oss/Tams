import React, { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Store, Ticket } from "lucide-react";

// Redesigned Unified Client Bookings + Preserved Vendors and Vouchers
import ClientBookings from "@/pages/ClientBookings";
import Vendors from "@/pages/Vendors";
import Vouchers from "@/pages/Vouchers";

type BookingTab = "clients" | "b2b-agents" | "vendors" | "vouchers";

export default function BookingsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab") as BookingTab | null;

  // Seamlessly map both legacy "clients" and "b2b-agents" to "clients" (Client Bookings)
  const currentTab = useMemo(() => {
    if (rawTab === "vendors") return "vendors";
    if (rawTab === "vouchers") return "vouchers";
    return "clients";
  }, [rawTab]);

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

      {/* 3 Canonical Sub-Tabs: [Client Bookings] [Vendor Management] [Vouchers] */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md pb-2 pt-1 border-b border-border/50">
        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto h-11 p-1 bg-muted/60 border">
            <TabsTrigger
              value="clients"
              className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-blue-500" />
              Client Bookings
            </TabsTrigger>
            <TabsTrigger
              value="vendors"
              className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer"
            >
              <Store className="w-4 h-4 text-emerald-500" />
              Vendor Management
            </TabsTrigger>
            <TabsTrigger
              value="vouchers"
              className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer"
            >
              <Ticket className="w-4 h-4 text-amber-500" />
              Vouchers
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Active Tab View */}
      <div className="pt-1">
        {currentTab === "clients" && <ClientBookings />}
        {currentTab === "vendors" && <Vendors />}
        {currentTab === "vouchers" && <Vouchers />}
      </div>
    </div>
  );
}
