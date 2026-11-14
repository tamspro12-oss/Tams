import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Receipt, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Filter,
  ChevronDown
} from "lucide-react";
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { useVendorPaymentHistoryLocal } from "@/hooks/useLocalPaymentHistory";
import { useClients } from "@/hooks/useStorage";
import { isInvoiceVoidedOrRefunded, getKarachiTodayNoon } from "@/lib/accountingEngine";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface VendorLedgerViewProps {
  vendorId: string;
  vendorName: string;
}

type DateFilter = 'all' | 'this_month' | 'last_month' | 'last_3_months';

interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  type: 'debit' | 'credit';
  amount: number;
  reference?: string;
  runningBalance?: number;
}

export function VendorLedgerView({ vendorId, vendorName }: VendorLedgerViewProps) {
  const { history, isLoading } = useVendorPaymentHistoryLocal(vendorId);
  const { clients } = useClients();
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  // Build ledger entries from existing data (read-only)
  const ledgerEntries = useMemo((): LedgerEntry[] => {
    const entries: LedgerEntry[] = [];
    
    // Get vendor's active (non-void/non-refunded) client bookings as debits (what we owe)
    const vendorClients = clients.filter(
      (c) => c.vendor_id === vendorId && !isInvoiceVoidedOrRefunded(c)
    );
    vendorClients.forEach(client => {
      const purchasingPrice = Number(client.purchasing_price) || 0;
      if (purchasingPrice > 0) {
        entries.push({
          id: `booking-${client.id}`,
          date: client.flight_date || client.created_at || new Date().toISOString(),
          description: `Booking: ${client.name}${client.pnr ? ` (PNR: ${client.pnr})` : ''}`,
          type: 'debit',
          amount: purchasingPrice,
          reference: client.pnr || undefined,
        });
      }
    });

    // Add payment history as credits
    history.forEach(payment => {
      entries.push({
        id: `payment-${payment.id}`,
        date: payment.payment_date,
        description: payment.notes || 'Payment',
        type: 'credit',
        amount: Number(payment.payment_amount),
        reference: payment.payment_type === 'full' ? 'Full Payment' : 'Partial Payment',
      });
    });

    // Sort by date ascending
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let runningBalance = 0;
    entries.forEach(entry => {
      if (entry.type === 'debit') {
        runningBalance += entry.amount;
      } else {
        runningBalance -= entry.amount;
      }
      entry.runningBalance = runningBalance;
    });

    return entries;
  }, [clients, history, vendorId]);

  // Filter entries by date (Asia/Karachi)
  const filteredEntries = useMemo(() => {
    if (dateFilter === 'all') return ledgerEntries;

    const now = getKarachiTodayNoon();
    let fromDate: Date;
    let toDate = endOfMonth(now);

    switch (dateFilter) {
      case 'this_month':
        fromDate = startOfMonth(now);
        toDate = endOfMonth(now);
        break;
      case 'last_month':
        fromDate = startOfMonth(subMonths(now, 1));
        toDate = endOfMonth(subMonths(now, 1));
        break;
      case 'last_3_months':
        fromDate = startOfMonth(subMonths(now, 2));
        toDate = endOfMonth(now);
        break;
      default:
        return ledgerEntries;
    }

    return ledgerEntries.filter(entry => {
      const entryDate = parseISO(entry.date);
      return isWithinInterval(entryDate, { start: fromDate, end: toDate });
    });
  }, [ledgerEntries, dateFilter]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalDebits = filteredEntries
      .filter(e => e.type === 'debit')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalCredits = filteredEntries
      .filter(e => e.type === 'credit')
      .reduce((sum, e) => sum + e.amount, 0);
    const balance = totalDebits - totalCredits;
    return { totalDebits, totalCredits, balance };
  }, [filteredEntries]);

  const getFilterLabel = (filter: DateFilter): string => {
    switch (filter) {
      case 'all': return 'All Time';
      case 'this_month': return 'This Month';
      case 'last_month': return 'Last Month';
      case 'last_3_months': return 'Last 3 Months';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Receipt className="w-4 h-4" />
          <span>Vendor Ledger</span>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (ledgerEntries.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Receipt className="w-4 h-4" />
          <span>Vendor Ledger</span>
        </div>
        <p className="text-sm text-muted-foreground italic">No transactions recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Receipt className="w-4 h-4" />
          <span>Vendor Ledger ({filteredEntries.length} entries)</span>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <Filter className="w-3 h-3 mr-1" />
              {getFilterLabel(dateFilter)}
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setDateFilter('all')}>
              All Time
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDateFilter('this_month')}>
              This Month
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDateFilter('last_month')}>
              Last Month
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDateFilter('last_3_months')}>
              Last 3 Months
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Ledger Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-[300px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[100px]">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right w-[100px]">Debit</TableHead>
                <TableHead className="text-right w-[100px]">Credit</TableHead>
                <TableHead className="text-right w-[110px]">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs">
                    {format(parseISO(entry.date), "MMM d, yy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {entry.type === 'debit' ? (
                        <TrendingDown className="w-3.5 h-3.5 text-destructive shrink-0" />
                      ) : (
                        <TrendingUp className="w-3.5 h-3.5 text-success shrink-0" />
                      )}
                      <span className="text-sm truncate max-w-[200px]">{entry.description}</span>
                      {entry.reference && (
                        <Badge variant="outline" className="text-[10px] h-4 shrink-0">
                          {entry.reference}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {entry.type === 'debit' && (
                      <span className="text-destructive font-medium">
                        ₨ {entry.amount.toLocaleString()}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {entry.type === 'credit' && (
                      <span className="text-success font-medium">
                        ₨ {entry.amount.toLocaleString()}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    ₨ {(entry.runningBalance || 0).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Totals Footer */}
      <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-muted/50 border">
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">Total Debits</p>
          <p className="text-sm font-bold text-destructive">
            ₨ {totals.totalDebits.toLocaleString()}
          </p>
        </div>
        <div className="text-center border-l border-r">
          <p className="text-[10px] text-muted-foreground">Total Credits</p>
          <p className="text-sm font-bold text-success">
            ₨ {totals.totalCredits.toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">Balance</p>
          <p className={`text-sm font-bold ${totals.balance > 0 ? 'text-warning' : 'text-success'}`}>
            ₨ {Math.abs(totals.balance).toLocaleString()}
            {totals.balance > 0 ? ' Due' : totals.balance < 0 ? ' Cr' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
