import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { AddBookingDialog } from "@/components/AddBookingDialog";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useBookings } from "@/hooks/useStorage";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isWithinInterval } from "date-fns";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DateRange } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PermissionGate } from "@/components/PermissionGate";

export default function Bookings() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const { bookings, isLoading, deleteBooking } = useBookings();

  const filteredBookings = useMemo(() => {
    let filtered = Array.isArray(bookings) ? bookings : [];
    
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((b: any) => 
        b.pnr?.toLowerCase().includes(q) || 
        b.notes?.toLowerCase().includes(q)
      );
    }
    
    // Date range filter
    if (dateRange?.from) {
      filtered = filtered.filter((b: any) => {
        if (!b.flight_date) return false;
        const flightDate = parseISO(b.flight_date);
        if (dateRange.to) {
          return isWithinInterval(flightDate, { start: dateRange.from!, end: dateRange.to });
        }
        return flightDate >= dateRange.from!;
      });
    }
    
    return filtered;
  }, [bookings, searchQuery, dateRange]);

  const stats = useMemo(() => {
    const total = filteredBookings.length;
    const paid = filteredBookings.filter((b: any) => b.payment_status === "Paid").length;
    return { total, paid, pending: total - paid };
  }, [filteredBookings]);

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Booking Management</h1>
            <p className="text-muted-foreground mt-1">Manage flight bookings and reservations</p>
          </div>
          <PermissionGate module="bookings" action="write">
            <Button onClick={() => setShowAddDialog(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Booking
            </Button>
          </PermissionGate>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All bookings</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.paid}</div>
              <p className="text-xs text-muted-foreground">Completed payments</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Awaiting payment</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by PNR or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : filteredBookings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No bookings found. Click "Add Booking" to get started.
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PNR</TableHead>
                  <TableHead>Flight Date</TableHead>
                  <TableHead>Seat Class</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.map((booking: any) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">{booking.pnr}</TableCell>
                    <TableCell>
                      {booking.flight_date ? format(new Date(booking.flight_date), "MMM dd, yyyy") : "-"}
                    </TableCell>
                    <TableCell>{booking.seat_class || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{booking.booking_type || "Ticket"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          booking.payment_status === "Paid"
                            ? "default"
                            : "outline"
                        }
                      >
                        {booking.payment_status || "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{booking.notes || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <PermissionGate module="bookings" action="write">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingBooking(booking);
                              setShowAddDialog(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate module="bookings" action="delete">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm("Delete this booking?")) {
                                deleteBooking.mutate(booking.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <AddBookingDialog 
          open={showAddDialog} 
          onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) setEditingBooking(null);
          }}
          editBooking={editingBooking}
        />
      </div>
    </DashboardLayout>
  );
}
