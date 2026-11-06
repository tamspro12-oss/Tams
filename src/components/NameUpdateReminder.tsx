import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Calendar, Plane, ArrowRight } from "lucide-react";
import { useClients } from "@/hooks/useStorage";
import { useMemo } from "react";
import { format, startOfDay, addDays, subDays } from "date-fns";
import { useNavigate } from "react-router-dom";

export function NameUpdateReminder() {
  const { clients = [] } = useClients();
  const navigate = useNavigate();
  
  const nameUpdateReminders = useMemo(() => {
    const today = startOfDay(new Date());
    const dayOfWeek = today.getDay(); // 0 = Sunday
    
    return clients
      .filter(client => {
        if (!client.name_update_date || !client.flight_date) return false;
        
        let updateDate = startOfDay(new Date(client.name_update_date));
        
        // Handle Sunday off - move reminder to Saturday
        if (updateDate.getDay() === 0) { // If Sunday
          updateDate = subDays(updateDate, 1); // Move to Saturday
        }
        
        // Show reminder 1 day before the update date AND on the update date
        const reminderStartDate = subDays(updateDate, 1);
        const todayTime = today.getTime();
        const reminderStartTime = reminderStartDate.getTime();
        const updateDateTime = updateDate.getTime();
        
        // Show if today is reminder start date or update date
        const shouldShowReminder = todayTime >= reminderStartTime && todayTime <= updateDateTime;
        
        // Also check if flight is within 3 days
        const flightDate = startOfDay(new Date(client.flight_date));
        const threeDaysFromNow = addDays(today, 3);
        const isUpcoming = flightDate.getTime() <= threeDaysFromNow.getTime() && flightDate.getTime() >= todayTime;
        
        return shouldShowReminder && isUpcoming;
      })
      .map(client => ({
        id: client.id,
        name: client.name,
        destination: client.destination || 'N/A',
        travelDate: format(new Date(client.flight_date), 'MMM dd, yyyy'),
        updateDate: format(new Date(client.name_update_date), 'MMM dd, yyyy'),
        pnr: client.pnr || 'N/A',
        serviceType: client.travel_type || 'Ticket',
      }))
      .slice(0, 7); // Limit to 7 items
  }, [clients]);
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-warning" />
            <CardTitle>Name Update Reminder</CardTitle>
          </div>
          {nameUpdateReminders.length > 0 && (
            <Badge variant="destructive">{nameUpdateReminders.length}</Badge>
          )}
        </div>
        <CardDescription>
          Bookings requiring passenger name updates
        </CardDescription>
      </CardHeader>
      <CardContent>
        {nameUpdateReminders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No reminders today</p>
            <p className="text-xs mt-1">Name update reminders will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {nameUpdateReminders.map((booking) => (
            <div
              key={booking.id}
              className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex-shrink-0 w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center">
                <Plane className="w-5 h-5 text-warning" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm truncate">{booking.name}</p>
                  <Badge variant="outline" className="flex-shrink-0">
                    {booking.serviceType}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Travel: {booking.travelDate}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bell className="w-3 h-3" />
                    Update: {booking.updateDate}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Destination: {booking.destination} • PNR: {booking.pnr}
                </p>
                <Badge className="bg-warning/20 text-warning hover:bg-warning/30 text-xs">
                  Update Name Today
                </Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate('/app/clients')}
                className="flex-shrink-0"
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            ))}
            
            {nameUpdateReminders.length > 5 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/app/clients')}
              >
                View All Reminders
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
