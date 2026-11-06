import { useMemo } from "react";
import { useClients, useQueries } from "@/hooks/useStorage";
import { useB2BBookings } from "@/hooks/useB2BBookings";
import { useB2BAgents } from "@/hooks/useB2BAgents";
import { format, startOfDay, addDays, subDays } from "date-fns";

export interface ActionableFlightAlert {
  id: string;
  name: string;
  destination: string;
  date: string;
  fullDate: Date;
  flightDateFormatted: string;
  pnr: string;
  serviceType: string;
  passport?: string | null;
  contactNumber?: string | null;
  source: 'b2c' | 'b2b';
  agentName?: string;
  isToday: boolean;
  isTomorrow: boolean;
}

export interface ActionableNameUpdate {
  id: string;
  name: string;
  destination: string;
  travelDate: string;
  updateDate: string;
  pnr: string;
  serviceType: string;
}

export interface ActionableQueryAlert {
  id: string;
  client_name: string;
  query_text: string;
  status: string;
  priority: string;
  contact_number?: string | null;
  due_date?: string | null;
  assigned_to?: string | null;
  created_at: string;
}

export function useActionableAlerts() {
  const { clients = [], isLoading: loadingClients } = useClients();
  const { queries = [], isLoading: loadingQueries } = useQueries();
  const { bookings: b2bBookings = [], isLoading: loadingB2BBookings } = useB2BBookings();
  const { agents: b2bAgents = [], isLoading: loadingB2BAgents } = useB2BAgents();

  // 1. Upcoming Flights within 48h (today + tomorrow, including Monday if Saturday)
  const upcomingFlights = useMemo<ActionableFlightAlert[]>(() => {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    const lastDay = dayOfWeek === 6 ? addDays(today, 2) : tomorrow;

    // B2C upcoming flights
    const b2cList: ActionableFlightAlert[] = clients
      .filter((c: any) => {
        if (!c.flight_date) return false;
        const flightDate = startOfDay(new Date(c.flight_date));
        const flightTime = flightDate.getTime();
        return flightTime >= today.getTime() && flightTime <= lastDay.getTime();
      })
      .map((client: any) => {
        const flightDate = startOfDay(new Date(client.flight_date));
        const isToday = flightDate.getTime() === today.getTime();
        const isTomorrow = flightDate.getTime() === tomorrow.getTime();

        let dateLabel = format(flightDate, 'MMM d');
        if (isToday) dateLabel = 'Today';
        else if (isTomorrow) dateLabel = 'Tomorrow';

        return {
          id: client.id,
          name: client.name,
          destination: client.destination || 'N/A',
          date: dateLabel,
          fullDate: flightDate,
          flightDateFormatted: format(flightDate, 'MMM d, yyyy'),
          pnr: client.pnr || 'N/A',
          serviceType: client.travel_type || 'Ticket',
          passport: client.passport_number,
          contactNumber: client.contact_number,
          source: 'b2c' as const,
          isToday,
          isTomorrow,
        };
      });

    // B2B upcoming flights
    const b2bList: ActionableFlightAlert[] = b2bBookings
      .filter((b: any) => {
        if (!b.flight_date) return false;
        const flightDate = startOfDay(new Date(b.flight_date));
        const flightTime = flightDate.getTime();
        return flightTime >= today.getTime() && flightTime <= lastDay.getTime();
      })
      .map((booking: any) => {
        const flightDate = startOfDay(new Date(booking.flight_date!));
        const isToday = flightDate.getTime() === today.getTime();
        const isTomorrow = flightDate.getTime() === tomorrow.getTime();

        let dateLabel = format(flightDate, 'MMM d');
        if (isToday) dateLabel = 'Today';
        else if (isTomorrow) dateLabel = 'Tomorrow';

        let serviceType = 'Ticket';
        try {
          if (booking.notes && booking.notes.startsWith('{')) {
            const parsed = JSON.parse(booking.notes.split('\n')[0]);
            if (parsed.type === 'umrah_package') {
              serviceType = 'Umrah';
            }
          }
        } catch {
          // ignore parsing error
        }

        const agent = b2bAgents.find((a: any) => a.id === booking.agent_id);

        return {
          id: booking.id,
          name: `${booking.passenger_name} (B2B)`,
          agentName: agent?.agent_name || 'B2B Partner',
          destination: booking.destination || 'N/A',
          date: dateLabel,
          fullDate: flightDate,
          flightDateFormatted: format(flightDate, 'MMM d, yyyy'),
          pnr: booking.pnr || 'N/A',
          serviceType,
          passport: booking.passenger_passport,
          contactNumber: booking.passenger_contact,
          source: 'b2b' as const,
          isToday,
          isTomorrow,
        };
      });

    return [...b2cList, ...b2bList].sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
  }, [clients, b2bBookings, b2bAgents]);

  // 2. Name Update Reminders
  const nameUpdateReminders = useMemo<ActionableNameUpdate[]>(() => {
    const today = startOfDay(new Date());

    return clients
      .filter((client: any) => {
        if (!client.name_update_date || !client.flight_date) return false;

        let updateDate = startOfDay(new Date(client.name_update_date));
        // Handle Sunday off - move reminder to Saturday
        if (updateDate.getDay() === 0) {
          updateDate = subDays(updateDate, 1);
        }

        const reminderStartDate = subDays(updateDate, 1);
        const todayTime = today.getTime();
        const reminderStartTime = reminderStartDate.getTime();
        const updateDateTime = updateDate.getTime();

        const shouldShowReminder = todayTime >= reminderStartTime && todayTime <= updateDateTime;

        const flightDate = startOfDay(new Date(client.flight_date));
        const threeDaysFromNow = addDays(today, 3);
        const isUpcoming = flightDate.getTime() <= threeDaysFromNow.getTime() && flightDate.getTime() >= todayTime;

        return shouldShowReminder && isUpcoming;
      })
      .map((client: any) => ({
        id: client.id,
        name: client.name,
        destination: client.destination || 'N/A',
        travelDate: format(new Date(client.flight_date), 'MMM dd, yyyy'),
        updateDate: format(new Date(client.name_update_date), 'MMM dd, yyyy'),
        pnr: client.pnr || 'N/A',
        serviceType: client.travel_type || 'Ticket',
      }));
  }, [clients]);

  // 3. Active Queries
  const activeQueries = useMemo<ActionableQueryAlert[]>(() => {
    return (queries as any[])
      .filter((q) => q.status === 'pending' || q.status === 'in-progress')
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
        const priorityDiff = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [queries]);

  // Total urgent actionable items
  const urgentCount = upcomingFlights.length + nameUpdateReminders.length + activeQueries.length;

  // Concise alert summary string for slim banner
  const summaryText = useMemo(() => {
    const parts: string[] = [];
    if (upcomingFlights.length > 0) {
      parts.push(`${upcomingFlights.length} Flight${upcomingFlights.length > 1 ? 's' : ''} departing within 48h`);
    }
    if (nameUpdateReminders.length > 0) {
      parts.push(`${nameUpdateReminders.length} Name Update${nameUpdateReminders.length > 1 ? 's' : ''} needed`);
    }
    if (activeQueries.length > 0) {
      parts.push(`${activeQueries.length} Active Quer${activeQueries.length > 1 ? 'ies' : 'y'} pending`);
    }
    return parts.join(' • ');
  }, [upcomingFlights.length, nameUpdateReminders.length, activeQueries.length]);

  return {
    upcomingFlights,
    nameUpdateReminders,
    activeQueries,
    urgentCount,
    summaryText,
    isLoading: loadingClients || loadingQueries || loadingB2BBookings || loadingB2BAgents,
  };
}
