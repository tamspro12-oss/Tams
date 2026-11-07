import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export interface UseRealtimeTableOptions<T = any> {
  table: string;
  schema?: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  filter?: string;
  enabled?: boolean;
  channelPrefix?: string;
  onInsert?: (payload: RealtimePostgresChangesPayload<T>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<T>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<T>) => void;
  onChange?: (payload: RealtimePostgresChangesPayload<T>) => void;
}

export interface RealtimeTableSubConfig {
  table: string;
  schema?: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  filter?: string;
  callback: (payload: RealtimePostgresChangesPayload<any>) => void;
}

export interface UseRealtimeMultiTableOptions {
  channelPrefix?: string;
  enabled?: boolean;
  subscriptions: RealtimeTableSubConfig[];
}

const generateUniqueChannelName = (prefix: string): string => {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  return `${prefix}-${uuid}`;
};

/**
 * Reusable hook for single-table Supabase Realtime subscriptions.
 * Guarantees:
 * - .on(...) is registered BEFORE .subscribe()
 * - Every channel name is unique per instance (crypto.randomUUID)
 * - Safe cleanup via supabase.removeChannel(channel)
 * - Callbacks kept in a ref so inline arrow functions never trigger re-subscriptions
 * - Subscribes only when enabled (e.g. valid agencyId)
 */
export function useRealtimeTable<T = any>({
  table,
  schema = "public",
  event = "*",
  filter,
  enabled = true,
  channelPrefix,
  onInsert,
  onUpdate,
  onDelete,
  onChange,
}: UseRealtimeTableOptions<T>) {
  const callbacksRef = useRef({ onInsert, onUpdate, onDelete, onChange });
  callbacksRef.current = { onInsert, onUpdate, onDelete, onChange };

  useEffect(() => {
    if (!enabled || !table) return;

    const prefix = channelPrefix || `rt-${table}`;
    const channelName = generateUniqueChannelName(prefix);
    const channel = supabase.channel(channelName);

    try {
      if (onInsert || onUpdate || onDelete) {
        if (onInsert) {
          channel.on(
            "postgres_changes",
            { event: "INSERT", schema, table, filter },
            (payload) => callbacksRef.current.onInsert?.(payload as any)
          );
        }
        if (onUpdate) {
          channel.on(
            "postgres_changes",
            { event: "UPDATE", schema, table, filter },
            (payload) => callbacksRef.current.onUpdate?.(payload as any)
          );
        }
        if (onDelete) {
          channel.on(
            "postgres_changes",
            { event: "DELETE", schema, table, filter },
            (payload) => callbacksRef.current.onDelete?.(payload as any)
          );
        }
      }

      if (onChange) {
        channel.on(
          "postgres_changes",
          { event, schema, table, filter },
          (payload) => callbacksRef.current.onChange?.(payload as any)
        );
      }

      channel.subscribe((status, err) => {
        if (err) {
          console.warn(`[useRealtimeTable] Subscription warning (${channelName}):`, err);
        }
      });
    } catch (err) {
      console.error(`[useRealtimeTable] Failed to setup channel (${channelName}):`, err);
    }

    return () => {
      supabase.removeChannel(channel).catch((err) => {
        console.warn(`[useRealtimeTable] Error removing channel (${channelName}):`, err);
      });
    };
  }, [table, schema, event, filter, enabled, channelPrefix]);
}

/**
 * Reusable hook for multi-table Supabase Realtime subscriptions (e.g., Dashboard).
 * Configures all .on(...) handlers on a single unique channel before subscribing.
 */
export function useRealtimeMultiTable({
  channelPrefix = "rt-multi",
  enabled = true,
  subscriptions,
}: UseRealtimeMultiTableOptions) {
  const subsRef = useRef(subscriptions);
  subsRef.current = subscriptions;

  // Stable key from subscription table names and filters
  const subKey = subscriptions
    .map((s) => `${s.table}:${s.event || "*"}:${s.filter || "all"}`)
    .join("|");

  useEffect(() => {
    if (!enabled || !subsRef.current.length) return;

    const channelName = generateUniqueChannelName(channelPrefix);
    const channel = supabase.channel(channelName);

    try {
      subsRef.current.forEach((sub, index) => {
        channel.on(
          "postgres_changes",
          {
            event: sub.event || "*",
            schema: sub.schema || "public",
            table: sub.table,
            filter: sub.filter,
          },
          (payload) => {
            const currentSub = subsRef.current[index];
            if (currentSub?.callback) {
              currentSub.callback(payload);
            }
          }
        );
      });

      channel.subscribe((status, err) => {
        if (err) {
          console.warn(`[useRealtimeMultiTable] Subscription warning (${channelName}):`, err);
        }
      });
    } catch (err) {
      console.error(`[useRealtimeMultiTable] Setup failed (${channelName}):`, err);
    }

    return () => {
      supabase.removeChannel(channel).catch((err) => {
        console.warn(`[useRealtimeMultiTable] Error removing channel (${channelName}):`, err);
      });
    };
  }, [channelPrefix, enabled, subKey]);
}

