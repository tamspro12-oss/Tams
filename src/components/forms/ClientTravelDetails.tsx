import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plane, Calendar, MapPin, Building } from "lucide-react";

interface ClientTravelDetailsProps {
  formData: any;
  setFormData: (data: any) => void;
}

export function ClientTravelDetails({ formData, setFormData }: ClientTravelDetailsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Plane className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Travel Details</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="destination">Destination</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="destination"
              value={formData.destination}
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              placeholder="e.g., Dubai, London"
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="flight_date">Flight Date</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="flight_date"
              type="date"
              value={formData.flight_date}
              onChange={(e) => setFormData({ ...formData, flight_date: e.target.value })}
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="airline">Airline</Label>
          <div className="relative">
            <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="airline"
              value={formData.airline}
              onChange={(e) => setFormData({ ...formData, airline: e.target.value })}
              placeholder="e.g., PIA, Emirates"
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pnr">PNR</Label>
          <Input
            id="pnr"
            value={formData.pnr}
            onChange={(e) => setFormData({ ...formData, pnr: e.target.value })}
            placeholder="Booking reference"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="travel_type">Travel Type</Label>
          <Input
            id="travel_type"
            value={formData.travel_type}
            onChange={(e) => setFormData({ ...formData, travel_type: e.target.value })}
            placeholder="e.g., One-way, Round-trip"
          />
        </div>
      </div>
    </div>
  );
}
