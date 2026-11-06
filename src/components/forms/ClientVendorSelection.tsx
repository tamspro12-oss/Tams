import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Store, Plus, Search, Filter } from "lucide-react";
import { useState } from "react";

interface ClientVendorSelectionProps {
  vendors: any[];
  selectedVendorId: string;
  setSelectedVendorId: (id: string) => void;
  onQuickAdd: () => void;
  serviceTypes: string[];
}

export function ClientVendorSelection({ 
  vendors, 
  selectedVendorId, 
  setSelectedVendorId,
  onQuickAdd,
  serviceTypes 
}: ClientVendorSelectionProps) {
  const [vendorSearchOpen, setVendorSearchOpen] = useState(false);
  const [vendorSearchTerm, setVendorSearchTerm] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all");

  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = vendorSearchTerm === "" || 
      vendor.name.toLowerCase().includes(vendorSearchTerm.toLowerCase()) ||
      vendor.service_type?.toLowerCase().includes(vendorSearchTerm.toLowerCase());
    
    const matchesServiceType = serviceTypeFilter === "all" || vendor.service_type === serviceTypeFilter;
    
    return matchesSearch && matchesServiceType;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Store className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Vendor Assignment</h3>
      </div>

      <div className="space-y-2">
        <Label>Vendor (Optional)</Label>
        <div className="flex gap-2">
          <Popover open={vendorSearchOpen} onOpenChange={setVendorSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 justify-between">
                <span className="truncate">
                  {selectedVendorId === "none" 
                    ? "Select Vendor" 
                    : vendors.find(v => v.id === selectedVendorId)?.name || "Select Vendor"}
                </span>
                <Search className="ml-2 h-4 w-4 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command>
                <CommandInput 
                  placeholder="Search vendors..." 
                  value={vendorSearchTerm}
                  onValueChange={setVendorSearchTerm}
                />
                <div className="p-2 border-b">
                  <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                    <SelectTrigger className="h-8">
                      <Filter className="h-3 w-3 mr-2" />
                      <SelectValue placeholder="Filter by service" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      {serviceTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <CommandList>
                  <CommandEmpty>No vendor found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="none"
                      onSelect={() => {
                        setSelectedVendorId("none");
                        setVendorSearchOpen(false);
                      }}
                    >
                      <span className="text-muted-foreground">No Vendor</span>
                    </CommandItem>
                    {filteredVendors.map((vendor) => (
                      <CommandItem
                        key={vendor.id}
                        value={vendor.name}
                        onSelect={() => {
                          setSelectedVendorId(vendor.id);
                          setVendorSearchOpen(false);
                        }}
                      >
                        <div className="flex flex-col flex-1">
                          <span className="font-medium">{vendor.name}</span>
                          {vendor.service_type && (
                            <span className="text-xs text-muted-foreground">{vendor.service_type}</span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          
          <Button type="button" variant="outline" size="icon" onClick={onQuickAdd}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
