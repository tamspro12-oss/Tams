import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Pencil, DollarSign, Trash2, Mail, Download, 
  ChevronDown, ChevronUp, MapPin, Plane, Users,
  MoreHorizontal, CreditCard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InlinePaymentHistory } from "@/components/InlinePaymentHistory";
import { BookingDownloadButton } from "@/components/BookingDownloadButton";
import { EmailBookingButton } from "@/components/EmailBookingButton";
import { DirectInvoiceButton } from "@/components/DirectInvoiceButton";
import { EmailInvoiceButton } from "@/components/EmailInvoiceButton";
import { PermissionGate } from "@/components/PermissionGate";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MobileClientCardProps {
  client: any;
  vendorName: string | null;
  onEdit: (client: any) => void;
  onDelete: (clientId: string) => void;
  onPayment: (client: any) => void;
}

export function MobileClientCard({ client, vendorName, onEdit, onDelete, onPayment }: MobileClientCardProps) {
  const [expanded, setExpanded] = useState(false);

  const sellingPrice = client.selling_price || 0;
  const purchasePrice = client.purchasing_price || 0;
  const amountPaid = client.amount_paid || 0;
  const pending = sellingPrice - amountPaid;
  const profit = sellingPrice - purchasePrice;

  const statusColor = client.payment_status === "paid" 
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
    : client.payment_status === "partial"
    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800"
    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";

  const isCustomService = client.travel_type && 
    !['Ticket', 'Ticket – One Way', 'Ticket – Return', 'Umrah'].includes(client.travel_type);
  const customServiceData = client.passengers_data?.[0]?.custom_service;
  const locationDisplay = isCustomService 
    ? (customServiceData?.location || client.destination || "—")
    : (client.destination || "—");

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Main Card Content - Tappable */}
      <button 
        className="w-full text-left p-3.5 space-y-2.5 active:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Top Row: Name + Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground truncate">{client.name}</h3>
            {client.group_size && client.group_size > 1 && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                <Users className="h-3 w-3" />
                {client.group_size} travelers
              </div>
            )}
          </div>
          <span className={cn(
            "px-2 py-0.5 rounded-full text-[11px] font-semibold border flex-shrink-0 capitalize",
            statusColor
          )}>
            {client.payment_status || "pending"}
          </span>
        </div>

        {/* Info Rows */}
        <div className="space-y-1.5">
          {client.travel_type && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Plane className="h-3.5 w-3.5 flex-shrink-0 text-accent" />
              <span className="truncate">
                {client.travel_type}
                {locationDisplay !== "—" && ` • ${locationDisplay}`}
              </span>
            </div>
          )}
          {vendorName && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CreditCard className="h-3.5 w-3.5 flex-shrink-0 text-accent" />
              <span className="truncate">{vendorName}</span>
            </div>
          )}
          {client.pnr && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-accent" />
              <span className="font-mono text-foreground/80">PNR: {client.pnr}</span>
            </div>
          )}
        </div>

        {/* Price Summary Row */}
        <div className="flex items-center gap-3 pt-1 text-xs">
          <span className="text-muted-foreground">Rs. <span className="font-semibold text-foreground">{sellingPrice.toLocaleString()}</span></span>
          <span className="text-muted-foreground/40">|</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Paid: {amountPaid.toLocaleString()}</span>
          {pending > 0 && (
            <>
              <span className="text-muted-foreground/40">|</span>
              <span className="text-destructive font-medium">Due: {pending.toLocaleString()}</span>
            </>
          )}
        </div>
      </button>

      {/* Bottom Actions */}
      <div className="flex items-center border-t border-border/40 bg-muted/20">
        <PermissionGate module="clients" action="write">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-10 rounded-none gap-1.5 text-xs font-medium text-muted-foreground hover:text-accent"
            onClick={() => onEdit(client)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        </PermissionGate>

        <div className="w-px h-5 bg-border/40" />

        <PermissionGate module="clients" action="write">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-10 rounded-none gap-1.5 text-xs font-medium text-muted-foreground hover:text-accent"
            onClick={() => onPayment(client)}
          >
            <DollarSign className="h-3.5 w-3.5" />
            Payment
          </Button>
        </PermissionGate>

        <div className="w-px h-5 bg-border/40" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-10 rounded-none gap-1.5 text-xs font-medium text-muted-foreground hover:text-accent"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
              More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="gap-2" asChild>
              <div><BookingDownloadButton client={client} vendor={vendorName ? { name: vendorName } : undefined} /></div>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" asChild>
              <div><EmailBookingButton client={client} vendor={vendorName ? { name: vendorName } : undefined} /></div>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" asChild>
              <div><DirectInvoiceButton client={client} /></div>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" asChild>
              <div><EmailInvoiceButton client={client} /></div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <PermissionGate module="clients" action="delete">
              <DropdownMenuItem 
                className="gap-2 text-destructive focus:text-destructive"
                onClick={() => onDelete(client.id)}
              >
                <Trash2 className="h-4 w-4" />
                Delete Booking
              </DropdownMenuItem>
            </PermissionGate>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-border/40 p-3.5 bg-muted/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Passport</div>
              <div className="text-sm font-medium mt-0.5">{client.passport_number || "—"}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Flight Date</div>
              <div className="text-sm font-medium mt-0.5">{client.flight_date || "—"}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Purchase</div>
              <div className="text-sm font-medium mt-0.5">Rs. {purchasePrice.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Profit</div>
              <div className="text-sm font-medium mt-0.5 text-emerald-600 dark:text-emerald-400">Rs. {profit.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Group</div>
              <div className="text-sm font-medium mt-0.5">
                {client.group_size && client.group_size > 1
                  ? `${client.group_booking_type || "Group"} (${client.group_size})`
                  : "Individual"}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Contact</div>
              <div className="text-sm font-medium mt-0.5">{client.contact_number || "—"}</div>
            </div>
          </div>
          
          <InlinePaymentHistory entityId={client.id} entityType="client" />
        </div>
      )}
    </Card>
  );
}
