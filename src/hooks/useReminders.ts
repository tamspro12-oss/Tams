import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { useClients } from "@/hooks/useStorage";
import { toast } from "sonner";
import { useMemo } from "react";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import type { Reminder, ReminderSettings, DynamicTravelAlert } from "@/types/reminder";

export function useReminders() {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();
  const { clients = [] } = useClients();

  // 1. Fetch DB Reminders
  const { data: reminders = [], isLoading: loadingReminders, refetch } = useQuery({
    queryKey: ["reminders", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from("reminders" as any)
        .select("*")
        .eq("agency_id", agencyId)
        .order("remind_date", { ascending: true });

      if (error) {
        console.warn("Reminders query fallback:", error);
        return [];
      }
      return (data || []) as Reminder[];
    },
    enabled: !!agencyId,
    staleTime: 30 * 1000,
  });

  // 2. Fetch Reminder Settings
  const { data: settings } = useQuery({
    queryKey: ["reminder_settings", agencyId],
    queryFn: async () => {
      if (!agencyId) return null;
      const { data, error } = await supabase
        .from("reminder_settings" as any)
        .select("*")
        .eq("agency_id", agencyId)
        .maybeSingle();

      if (error || !data) {
        return {
          agency_id: agencyId,
          opening_time: "09:00:00",
          closing_time: "20:00:00",
          flight_alerts_enabled: true,
          umrah_alerts_enabled: true,
          daily_expense_reminder_enabled: true,
        } as ReminderSettings;
      }
      return data as ReminderSettings;
    },
    enabled: !!agencyId,
  });

  // 3. Compute Dynamic Travel Alerts for Today & Tomorrow from Bookings
  const dynamicTravelAlerts = useMemo<DynamicTravelAlert[]>(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const tomorrowStr = format(new Date(Date.now() + 86400000), "yyyy-MM-dd");

    const alerts: DynamicTravelAlert[] = [];

    clients.forEach((c: any) => {
      const travelDateRaw = c.flight_date || c.travelDate || c.travel_date;
      if (!travelDateRaw) return;

      const dateStr = String(travelDateRaw).slice(0, 10);
      const isDateToday = dateStr === todayStr;
      const isDateTomorrow = dateStr === tomorrowStr;

      if (!isDateToday && !isDateTomorrow) return;

      const travelType = (c.travel_type || c.service_type || "").toLowerCase();
      const isUmrah = travelType.includes("umrah");

      // Check settings toggles
      if (isUmrah && settings && !settings.umrah_alerts_enabled) return;
      if (!isUmrah && settings && !settings.flight_alerts_enabled) return;

      alerts.push({
        id: `booking-${c.id}`,
        title: isUmrah
          ? `🕋 Umrah Departure ${isDateToday ? "TODAY" : "TOMORROW"}: ${c.name || "Client"}`
          : `✈️ Flight Departure ${isDateToday ? "TODAY" : "TOMORROW"}: ${c.name || "Client"} (${c.pnr || c.airline || "Flight"})`,
        type: isUmrah ? "umrah" : "flight",
        clientName: c.name || "Passenger",
        passportNumber: c.passport_number,
        travelDate: dateStr,
        isToday: isDateToday,
        isTomorrow: isDateTomorrow,
        bookingRef: c.pnr,
        sectorOrDetails: c.destination || c.airline,
        clientId: c.id,
      });
    });

    return alerts;
  }, [clients, settings]);

  // 4. Compute Daily Opening / Closing reminders
  const dailyPrompts = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();

    const openingAlert =
      currentHour >= 8 && currentHour < 12
        ? {
            id: "daily-opening-prompt",
            title: "☀️ Good Morning! Check today's departures and scheduled tasks.",
            subtitle: "Review flights, Umrah departures, and open client queries.",
            type: "daily_expense" as const,
          }
        : null;

    const closingAlert =
      (settings?.daily_expense_reminder_enabled ?? true) && currentHour >= 18
        ? {
            id: "daily-closing-prompt",
            title: "🌙 End of Day: Remember to record daily expenses and close ledger.",
            subtitle: "Keep your cash flow, petty cash, and daily accounts reconciled.",
            type: "daily_expense" as const,
          }
        : null;

    return { openingAlert, closingAlert };
  }, [settings]);

  // Total active alerts count
  const pendingRemindersCount = useMemo(() => {
    const manualDue = reminders.filter((r) => !r.is_completed).length;
    const travelCount = dynamicTravelAlerts.length;
    const dailyPromptCount = (dailyPrompts.openingAlert ? 1 : 0) + (dailyPrompts.closingAlert ? 1 : 0);
    return manualDue + travelCount + dailyPromptCount;
  }, [reminders, dynamicTravelAlerts, dailyPrompts]);

  // Mutations
  const addReminder = useMutation({
    mutationFn: async (data: Omit<Reminder, "id" | "agency_id" | "created_at" | "updated_at">) => {
      if (!agencyId) throw new Error("No agency ID");
      const { data: { user } } = await supabase.auth.getUser();

      const { data: inserted, error } = await supabase
        .from("reminders" as any)
        .insert({
          ...data,
          agency_id: agencyId,
          user_id: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return inserted;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast.success("Reminder added");
    },
    onError: (e: any) => toast.error("Failed to add reminder", { description: e.message }),
  });

  const updateReminder = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Reminder> & { id: string }) => {
      const { data, error } = await supabase
        .from("reminders" as any)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast.success("Reminder updated");
    },
    onError: (e: any) => toast.error("Failed to update reminder", { description: e.message }),
  });

  const toggleReminderComplete = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const { error } = await supabase
        .from("reminders" as any)
        .update({ is_completed, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });

  const deleteReminder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reminders" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast.success("Reminder deleted");
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (patch: Partial<ReminderSettings>) => {
      if (!agencyId) throw new Error("No agency");

      const { data, error } = await supabase
        .from("reminder_settings" as any)
        .upsert({
          agency_id: agencyId,
          ...patch,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminder_settings"] });
      toast.success("Reminder settings saved");
    },
  });

  return {
    reminders,
    settings,
    dynamicTravelAlerts,
    dailyPrompts,
    pendingRemindersCount,
    loadingReminders,
    refetch,
    addReminder,
    updateReminder,
    toggleReminderComplete,
    deleteReminder,
    updateSettings,
  };
}

