import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { toast } from "sonner";

export interface AgencyNotification {
  id: string;
  agency_id: string;
  title: string;
  message: string;
  type: "all" | "travel" | "accounts" | "reminders" | "system" | "b2b";
  category: string;
  link: string | null;
  metadata: Record<string, any>;
  is_read: boolean;
  snoozed_until: string | null;
  created_at: string;
  updated_at: string;
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();

  const {
    data: notifications = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["agency_notifications", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      try {
        const { data, error } = await supabase
          .from("notifications" as any)
          .select("*")
          .eq("agency_id", agencyId)
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) {
          console.warn("Notifications query warning:", error);
          return [];
        }
        return (Array.isArray(data) ? data : []) as unknown as AgencyNotification[];
      } catch (e) {
        console.warn("Notifications query warning:", e);
        return [];
      }
    },
    enabled: !!agencyId,
  });

  // Realtime subscription for instant updates
  useEffect(() => {
    if (!agencyId) return;

    const channel = supabase
      .channel(`agency-notifications-${agencyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `agency_id=eq.${agencyId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["agency_notifications", agencyId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agencyId, queryClient]);

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications" as any)
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency_notifications", agencyId] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!agencyId) return;
      const { error } = await supabase
        .from("notifications" as any)
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq("agency_id", agencyId)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency_notifications", agencyId] });
      toast.success("All notifications marked as read");
    },
  });

  const snoozeNotification = useMutation({
    mutationFn: async ({ id, hours = 24 }: { id: string; hours?: number }) => {
      const snoozedUntil = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      const { error } = await supabase
        .from("notifications" as any)
        .update({ snoozed_until: snoozedUntil, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency_notifications", agencyId] });
      toast.info("Notification snoozed");
    },
  });

  const deleteNotification = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency_notifications", agencyId] });
      toast.success("Notification removed");
    },
  });

  // Active unread notifications (ignoring active snoozes)
  const safeList = Array.isArray(notifications) ? notifications : [];
  const unreadNotifications = safeList.filter((n) => {
    if (!n || n.is_read) return false;
    if (n.snoozed_until) {
      try {
        const snoozeDate = new Date(n.snoozed_until);
        if (!isNaN(snoozeDate.getTime()) && snoozeDate > new Date()) return false;
      } catch {
        // Safe fallback
      }
    }
    return true;
  });

  return {
    notifications,
    unreadNotifications,
    unreadCount: unreadNotifications.length,
    isLoading,
    refetch,
    markAsRead,
    markAllAsRead,
    snoozeNotification,
    deleteNotification,
  };
}

