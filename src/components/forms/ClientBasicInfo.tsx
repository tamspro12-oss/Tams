import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Phone, Mail } from "lucide-react";

interface ClientBasicInfoProps {
  formData: any;
  setFormData: (data: any) => void;
  groupBookingType: string;
  setGroupBookingType: (type: string) => void;
  groupSize: number;
  setGroupSize: (size: number) => void;
}

export function ClientBasicInfo({ 
  formData, 
  setFormData, 
  groupBookingType, 
  setGroupBookingType,
  groupSize,
  setGroupSize 
}: ClientBasicInfoProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <User className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-blue-900">Primary Contact Information</h3>
      </div>
      <p className="text-sm text-blue-700 mb-4">Enter the person or company making this booking</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Contact Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter contact name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact_number">Contact Number</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="contact_number"
              value={formData.contact_number}
              onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
              placeholder="03001234567"
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Contact Email (Optional)</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="contact@example.com"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Booking Type</Label>
        <Select value={groupBookingType} onValueChange={setGroupBookingType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="individual">Individual</SelectItem>
            <SelectItem value="group">Group</SelectItem>
            <SelectItem value="umrah">Umrah</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {groupBookingType !== "individual" && (
        <div className="space-y-2">
          <Label htmlFor="group_size">Group Size *</Label>
          <Input
            id="group_size"
            type="number"
            min="1"
            max="500"
            value={groupSize}
            onChange={(e) => setGroupSize(parseInt(e.target.value) || 1)}
            required
          />
        </div>
      )}
    </div>
  );
}
