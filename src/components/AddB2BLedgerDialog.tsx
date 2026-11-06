import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useB2BLedger, B2BLedgerEntry } from "@/hooks/useB2BLedger";
import { useB2BBookings, B2BBooking } from "@/hooks/useB2BBookings";
import { B2BAgent } from "@/hooks/useB2BAgents";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Receipt, CreditCard, Link2, Plane, Maximize2, Minimize2, FileText, AlertCircle, Split, Wand2, X, Check, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { PaymentModeSelect } from "@/components/PaymentModeSelect";

interface AddB2BLedgerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: B2BAgent;
  editEntry?: B2BLedgerEntry | null;
  preselectedBookingId?: string | null;
}

interface BookingAllocation {
  bookingId: string;
  bookingRef: string;
  passengerName: string;
  outstanding: number;
  amount: number;
  selected: boolean;
}

export function AddB2BLedgerDialog({ open, onOpenChange, agent, editEntry, preselectedBookingId }: AddB2BLedgerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [entryType, setEntryType] = useState<string>("credit");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState("");
  const [linkedBookingId, setLinkedBookingId] = useState<string>("none");
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // Split payment states
  const [paymentMode, setPaymentMode] = useState<'single' | 'split'>('single');
  const [allocations, setAllocations] = useState<BookingAllocation[]>([]);
  
  // Payment mode (cash/bank) states
  const [cashBankMode, setCashBankMode] = useState<string>("cash");
  const [bankName, setBankName] = useState<string>("");
  
  const { ledgerEntries, addLedgerEntry, updateLedgerEntry, addSplitPayment } = useB2BLedger(agent.id);
  const { bookings } = useB2BBookings(agent.id);

  const isEditMode = !!editEntry;

  // Calculate paid amount for a specific booking from ledger entries
  const getBookingPaidAmount = (bookingId: string): number => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return 0;
    
    const bookingRef = booking.pnr || booking.passenger_name;
    return ledgerEntries
      .filter(e => 
        e.entry_type === 'credit' && 
        e.remarks?.includes(`[Booking: ${bookingRef}]`)
      )
      .reduce((sum, e) => sum + e.amount, 0);
  };

  // Calculate service amount for a booking (what agent owes)
  const getServiceAmount = (booking: B2BBooking): number => {
    return (booking.selling_price || 0) - (booking.commission_amount || 0);
  };

  // Get booking outstanding balance
  const getBookingOutstanding = (bookingId: string): number => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return 0;
    const serviceAmount = getServiceAmount(booking);
    const paidAmount = getBookingPaidAmount(bookingId);
    return serviceAmount - paidAmount;
  };

  // Selected booking info (for single mode)
  const selectedBookingInfo = useMemo(() => {
    if (linkedBookingId === "none") return null;
    const booking = bookings.find(b => b.id === linkedBookingId);
    if (!booking) return null;
    
    const serviceAmount = getServiceAmount(booking);
    const paidAmount = getBookingPaidAmount(linkedBookingId);
    const outstanding = serviceAmount - paidAmount;
    
    return {
      booking,
      serviceAmount,
      paidAmount,
      outstanding
    };
  }, [linkedBookingId, bookings, ledgerEntries]);

  // Get pending bookings for linking (with outstanding balance > 0)
  const pendingBookings = useMemo(() => {
    return bookings.filter(b => {
      const outstanding = getBookingOutstanding(b.id);
      return outstanding > 0;
    });
  }, [bookings, ledgerEntries]);

  // Initialize allocations when pending bookings change or payment mode switches
  useEffect(() => {
    if (paymentMode === 'split' && !isEditMode) {
      const newAllocations: BookingAllocation[] = pendingBookings.map(b => ({
        bookingId: b.id,
        bookingRef: b.pnr || b.passenger_name,
        passengerName: b.passenger_name,
        outstanding: getBookingOutstanding(b.id),
        amount: 0,
        selected: false
      }));
      setAllocations(newAllocations);
    }
  }, [paymentMode, pendingBookings.length]);

  // Parse linked booking from remarks if editing
  const parseLinkedBookingFromRemarks = (remarksText: string | null): string | null => {
    if (!remarksText) return null;
    const match = remarksText.match(/\[Booking: ([^\]]+)\]/);
    return match ? match[1] : null;
  };

  // Populate form when editing or when preselectedBookingId changes
  useEffect(() => {
    if (editEntry) {
      setPaymentMode('single'); // Edit mode always single
      setEntryType(editEntry.entry_type);
      setAmount(editEntry.amount.toString());
      setEntryDate(editEntry.entry_date);
      
      // Try to extract linked booking from remarks
      const linkedPnr = parseLinkedBookingFromRemarks(editEntry.remarks);
      if (linkedPnr) {
        const linkedBooking = bookings.find(b => b.pnr === linkedPnr || b.passenger_name === linkedPnr);
        if (linkedBooking) {
          setLinkedBookingId(linkedBooking.id);
          // Remove the booking reference from remarks for display
          setRemarks(editEntry.remarks?.replace(/\s*\[Booking: [^\]]+\]/, '').trim() || "");
        } else {
          setRemarks(editEntry.remarks || "");
          setLinkedBookingId("none");
        }
      } else {
        setRemarks(editEntry.remarks || "");
        setLinkedBookingId("none");
      }
    } else if (preselectedBookingId) {
      // Reset for new entry with preselected booking
      setPaymentMode('single');
      setEntryType("credit");
      setAmount("");
      setEntryDate(new Date().toISOString().split('T')[0]);
      setRemarks("");
      setLinkedBookingId(preselectedBookingId);
    } else {
      // Reset form for new entry
      setPaymentMode('single');
      setEntryType("credit");
      setAmount("");
      setEntryDate(new Date().toISOString().split('T')[0]);
      setRemarks("");
      setLinkedBookingId("none");
      setAllocations([]);
    }
  }, [editEntry, open, bookings, preselectedBookingId]);

  // Split payment calculations
  const splitSummary = useMemo(() => {
    const totalPayment = parseFloat(amount) || 0;
    const allocatedAmount = allocations
      .filter(a => a.selected && a.amount > 0)
      .reduce((sum, a) => sum + a.amount, 0);
    const unallocated = totalPayment - allocatedAmount;
    const selectedCount = allocations.filter(a => a.selected).length;
    
    return {
      totalPayment,
      allocatedAmount,
      unallocated,
      selectedCount,
      isValid: totalPayment > 0 && allocatedAmount <= totalPayment
    };
  }, [amount, allocations]);

  // Validation: check if any allocation exceeds outstanding
  const hasOverAllocation = useMemo(() => {
    return allocations.some(a => a.selected && a.amount > a.outstanding);
  }, [allocations]);

  // Validation: check if payment exceeds outstanding (single mode)
  const paymentExceedsOutstanding = useMemo(() => {
    if (entryType !== 'credit' || linkedBookingId === "none") return false;
    const enteredAmount = parseFloat(amount) || 0;
    if (enteredAmount <= 0) return false;
    
    const outstanding = selectedBookingInfo?.outstanding || 0;
    return enteredAmount > outstanding;
  }, [entryType, linkedBookingId, amount, selectedBookingInfo]);

  // Allocation handlers
  const toggleBookingSelection = (bookingId: string) => {
    setAllocations(prev => prev.map(a => 
      a.bookingId === bookingId ? { ...a, selected: !a.selected, amount: !a.selected ? 0 : a.amount } : a
    ));
  };

  const updateAllocationAmount = (bookingId: string, newAmount: string) => {
    const numAmount = parseFloat(newAmount) || 0;
    setAllocations(prev => prev.map(a => 
      a.bookingId === bookingId ? { ...a, amount: numAmount, selected: true } : a
    ));
  };

  const payFullForBooking = (bookingId: string) => {
    const booking = allocations.find(a => a.bookingId === bookingId);
    if (booking) {
      updateAllocationAmount(bookingId, booking.outstanding.toString());
    }
  };

  const autoAllocate = () => {
    let remaining = parseFloat(amount) || 0;
    const sortedPending = [...allocations].sort((a, b) => {
      // Sort by flight date if available, otherwise by outstanding amount
      return a.outstanding - b.outstanding; // Smallest first
    });
    
    const newAllocations = sortedPending.map(a => {
      if (remaining <= 0) return { ...a, selected: false, amount: 0 };
      const allocAmount = Math.min(a.outstanding, remaining);
      remaining -= allocAmount;
      return { ...a, selected: true, amount: allocAmount };
    });
    
    setAllocations(newAllocations);
  };

  const clearAllocations = () => {
    setAllocations(prev => prev.map(a => ({ ...a, selected: false, amount: 0 })));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    setLoading(true);

    try {
      if (paymentMode === 'split' && !isEditMode) {
        // Split payment mode
        const validAllocations = allocations
          .filter(a => a.selected && a.amount > 0)
          .map(a => ({
            bookingId: a.bookingId,
            bookingRef: a.bookingRef,
            amount: a.amount
          }));
        
        await addSplitPayment.mutateAsync({
          agent_id: agent.id,
          entry_date: entryDate,
          total_amount: parseFloat(amount) || 0,
          remarks: remarks.trim(),
          allocations: validAllocations
        });
      } else {
        // Single booking mode (original logic)
        // Prevent overpayment for linked bookings
        if (paymentExceedsOutstanding && !isEditMode) {
          setLoading(false);
          return;
        }
        
        // Build remarks with optional booking link
        let finalRemarks = remarks.trim();
        if (linkedBookingId !== "none") {
          const linkedBooking = bookings.find(b => b.id === linkedBookingId);
          if (linkedBooking) {
            const bookingRef = linkedBooking.pnr || linkedBooking.passenger_name;
            finalRemarks = finalRemarks 
              ? `${finalRemarks} [Booking: ${bookingRef}]`
              : `[Booking: ${bookingRef}]`;
          }
        }

        const entryData = {
          agent_id: agent.id,
          entry_date: entryDate,
          entry_type: entryType,
          amount: parseFloat(amount) || 0,
          remarks: finalRemarks || null,
          linked_booking_id: linkedBookingId !== "none" ? linkedBookingId : null,
          payment_mode: entryType === 'credit' ? cashBankMode : null,
          bank_name: entryType === 'credit' && cashBankMode === 'bank' ? bankName : null
        };

        if (isEditMode && editEntry) {
          await updateLedgerEntry.mutateAsync({ id: editEntry.id, ...entryData });
        } else {
          await addLedgerEntry.mutateAsync(entryData);
        }
      }
      
      setLoading(false);
      onOpenChange(false);
    } catch (error) {
      setLoading(false);
    }
  };

  const canSubmit = useMemo(() => {
    if (!amount || parseFloat(amount) <= 0) return false;
    
    if (paymentMode === 'split') {
      return splitSummary.selectedCount > 0 && splitSummary.isValid && !hasOverAllocation;
    } else {
      return !paymentExceedsOutstanding;
    }
  }, [amount, paymentMode, splitSummary, hasOverAllocation, paymentExceedsOutstanding]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "enterprise-dialog overflow-hidden flex flex-col transition-all duration-300",
        isFullScreen 
          ? "!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0 !max-w-none w-screen h-[100dvh] !rounded-none border-0" 
          : "w-[95vw] max-w-4xl max-h-[85vh]"
      )}>
        <DialogHeader className="pb-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="form-section-icon form-section-icon-green">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">
                  {isEditMode ? 'Edit Ledger Entry' : 'Add Ledger Entry'}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground/80">
                  Recording for agent: <span className="font-medium text-foreground">{agent.agent_name}</span>
                  {agent.business_name && <span className="text-muted-foreground"> ({agent.business_name})</span>}
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="h-8 w-8 shrink-0"
              title={isFullScreen ? "Compact mode" : "Fullscreen mode"}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className={cn("flex-1 overflow-y-auto form-scroll-container", isFullScreen ? "p-6 lg:p-8" : "p-2")}>
          <div className={isFullScreen ? "max-w-6xl mx-auto space-y-6" : "space-y-4"}>
            
            {/* Transaction Details */}
            <Card className="form-card form-card-green">
              <CardHeader className="pb-4 pt-5">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon-green">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="form-section-title form-section-title-green">Transaction Details</h3>
                    <p className="form-section-description">Enter the payment or adjustment information</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
                <div className="space-y-2">
                  <Label htmlFor="entry_type" className="text-sm font-medium">Entry Type *</Label>
                  <Select value={entryType} onValueChange={(val) => {
                    setEntryType(val);
                    // Switch to single mode for debits
                    if (val === 'debit') setPaymentMode('single');
                  }}>
                    <SelectTrigger className="enterprise-input">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit">Credit (Payment Received)</SelectItem>
                      <SelectItem value="debit">Debit (Payment Given/Adjustment)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm font-medium">Amount (PKR) *</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={cn(
                      "enterprise-input",
                      paymentMode === 'single' && paymentExceedsOutstanding && "border-red-500 focus:ring-red-500"
                    )}
                  />
                  {paymentMode === 'single' && paymentExceedsOutstanding && (
                    <p className="text-xs text-red-500">
                      Amount exceeds outstanding balance (PKR {selectedBookingInfo?.outstanding.toLocaleString()})
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entry_date" className="text-sm font-medium">Entry Date *</Label>
                  <Input
                    id="entry_date"
                    name="entry_date"
                    type="date"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="enterprise-input"
                  />
                </div>
                
                {/* Payment Mode (Cash/Bank) - Only for credits */}
                {entryType === 'credit' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Banknote className="w-4 h-4" />
                      Payment Mode
                    </Label>
                    <PaymentModeSelect
                      value={cashBankMode}
                      onChange={setCashBankMode}
                      bankName={bankName}
                      onBankNameChange={setBankName}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Mode Toggle - Only for credits and not edit mode */}
            {entryType === 'credit' && !isEditMode && pendingBookings.length > 1 && (
              <Card className="form-card form-card-purple">
                <CardHeader className="pb-4 pt-5">
                  <div className="form-section-header">
                    <div className="form-section-icon form-section-icon-purple">
                      <Split className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="form-section-title form-section-title-purple">Payment Mode</h3>
                      <p className="form-section-description">Choose how to allocate this payment</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-6">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={paymentMode === 'single' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentMode('single')}
                      className="gap-2"
                    >
                      <Link2 className="w-4 h-4" />
                      Single Booking
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMode === 'split' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentMode('split')}
                      className="gap-2"
                    >
                      <Split className="w-4 h-4" />
                      Split Across Multiple
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Single Booking Mode - Link to Booking */}
            {paymentMode === 'single' && (
              <Card className="form-card form-card-blue">
                <CardHeader className="pb-4 pt-5">
                  <div className="form-section-header">
                    <div className="form-section-icon form-section-icon-blue">
                      <Link2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="form-section-title form-section-title-blue">Link to Booking (Optional)</h3>
                      <p className="form-section-description">Associate this entry with a specific booking</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="linked_booking" className="text-sm font-medium">Select Booking</Label>
                    <Select value={linkedBookingId} onValueChange={setLinkedBookingId}>
                      <SelectTrigger className="enterprise-input">
                        <SelectValue placeholder="No linked booking" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="none">No linked booking</SelectItem>
                        {bookings.length > 0 && (
                          <>
                            {pendingBookings.length > 0 && (
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                                Bookings with Outstanding Balance
                              </div>
                            )}
                            {pendingBookings.map(booking => {
                              const outstanding = getBookingOutstanding(booking.id);
                              return (
                                <SelectItem key={booking.id} value={booking.id}>
                                  <div className="flex items-center gap-2">
                                    <Plane className="w-3 h-3 text-blue-500" />
                                    <span className="font-medium">{booking.pnr || 'No PNR'}</span>
                                    <span className="text-muted-foreground">- {booking.passenger_name}</span>
                                    <span className="text-xs text-red-600 font-medium">
                                      Due: PKR {outstanding.toLocaleString()}
                                    </span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                            {bookings.filter(b => getBookingOutstanding(b.id) <= 0).length > 0 && (
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                                Fully Paid Bookings
                              </div>
                            )}
                            {bookings.filter(b => getBookingOutstanding(b.id) <= 0).map(booking => (
                              <SelectItem key={booking.id} value={booking.id}>
                                <div className="flex items-center gap-2">
                                  <Plane className="w-3 h-3 text-muted-foreground" />
                                  <span>{booking.pnr || 'No PNR'}</span>
                                  <span className="text-muted-foreground">- {booking.passenger_name}</span>
                                  <span className="text-xs text-green-600 font-medium">Paid</span>
                                </div>
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Show booking balance info when a booking is selected */}
                  {selectedBookingInfo && entryType === 'credit' && (
                    <Alert className={cn(
                      "border",
                      selectedBookingInfo.outstanding > 0 
                        ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/30" 
                        : "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/30"
                    )}>
                      <AlertCircle className={cn(
                        "h-4 w-4",
                        selectedBookingInfo.outstanding > 0 ? "text-amber-600" : "text-green-600"
                      )} />
                      <AlertDescription>
                        <div className="grid grid-cols-3 gap-4 mt-1">
                          <div>
                            <p className="text-xs text-muted-foreground">Service Amount</p>
                            <p className="font-semibold">PKR {selectedBookingInfo.serviceAmount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Already Paid</p>
                            <p className="font-semibold text-green-600">PKR {selectedBookingInfo.paidAmount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Outstanding</p>
                            <p className={cn(
                              "font-semibold",
                              selectedBookingInfo.outstanding > 0 ? "text-red-600" : "text-green-600"
                            )}>
                              PKR {selectedBookingInfo.outstanding.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Split Payment Mode - Allocation Table */}
            {paymentMode === 'split' && entryType === 'credit' && !isEditMode && (
              <Card className="form-card form-card-blue">
                <CardHeader className="pb-4 pt-5">
                  <div className="form-section-header">
                    <div className="form-section-icon form-section-icon-blue">
                      <Split className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="form-section-title form-section-title-blue">Allocate Payment</h3>
                      <p className="form-section-description">Distribute this payment across multiple bookings</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={autoAllocate}
                        disabled={!amount || parseFloat(amount) <= 0}
                        className="gap-1 text-xs"
                      >
                        <Wand2 className="w-3 h-3" />
                        Auto
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearAllocations}
                        className="gap-1 text-xs"
                      >
                        <X className="w-3 h-3" />
                        Clear
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-6 space-y-4">
                  {allocations.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      No pending bookings available for allocation
                    </div>
                  ) : (
                    <>
                      {/* Allocation Table */}
                      <div className="border rounded-lg overflow-hidden">
                        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 p-3 bg-muted/50 text-xs font-medium text-muted-foreground">
                          <div></div>
                          <div>Booking</div>
                          <div className="text-right">Outstanding</div>
                          <div className="text-right w-28">Allocate</div>
                          <div className="w-16"></div>
                        </div>
                        <div className="divide-y max-h-[200px] overflow-y-auto">
                          {allocations.map((allocation) => (
                            <div 
                              key={allocation.bookingId}
                              className={cn(
                                "grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 p-3 items-center transition-colors",
                                allocation.selected && "bg-blue-50 dark:bg-blue-950/20"
                              )}
                            >
                              <Checkbox
                                checked={allocation.selected}
                                onCheckedChange={() => toggleBookingSelection(allocation.bookingId)}
                              />
                              <div className="flex items-center gap-2 min-w-0">
                                <Plane className="w-3 h-3 text-blue-500 shrink-0" />
                                <span className="font-medium truncate">{allocation.bookingRef}</span>
                                <span className="text-muted-foreground text-xs truncate">- {allocation.passengerName}</span>
                              </div>
                              <div className="text-right text-sm text-red-600 font-medium whitespace-nowrap">
                                PKR {allocation.outstanding.toLocaleString()}
                              </div>
                              <div className="w-28">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={allocation.amount || ''}
                                  onChange={(e) => updateAllocationAmount(allocation.bookingId, e.target.value)}
                                  placeholder="0"
                                  className={cn(
                                    "h-8 text-right text-sm",
                                    allocation.amount > allocation.outstanding && "border-red-500"
                                  )}
                                  disabled={!allocation.selected}
                                />
                              </div>
                              <div className="w-16">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => payFullForBooking(allocation.bookingId)}
                                  className="h-8 text-xs px-2"
                                >
                                  Full
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Over-allocation warning */}
                      {hasOverAllocation && (
                        <Alert className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/30">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          <AlertDescription className="text-red-600">
                            One or more allocations exceed the booking's outstanding balance
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Summary */}
                      <div className="bg-muted/50 rounded-lg p-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-xs text-muted-foreground">Total Payment</p>
                            <p className="text-lg font-bold">PKR {splitSummary.totalPayment.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Allocated</p>
                            <p className={cn(
                              "text-lg font-bold",
                              splitSummary.allocatedAmount > 0 ? "text-green-600" : "text-muted-foreground"
                            )}>
                              PKR {splitSummary.allocatedAmount.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Unallocated</p>
                            <p className={cn(
                              "text-lg font-bold",
                              splitSummary.unallocated > 0 ? "text-amber-600" : "text-muted-foreground"
                            )}>
                              PKR {splitSummary.unallocated.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {splitSummary.unallocated > 0 && (
                          <p className="text-xs text-center text-muted-foreground mt-2">
                            Unallocated amount will be credited to agent's general balance
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Remarks */}
            <Card className="form-card form-card-amber">
              <CardHeader className="pb-4 pt-5">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon-amber">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="form-section-title form-section-title-amber">Additional Information</h3>
                    <p className="form-section-description">Add any notes or description for this entry</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-6">
                <div className="space-y-2">
                  <Label htmlFor="remarks" className="text-sm font-medium">Remarks / Description</Label>
                  <Textarea
                    id="remarks"
                    name="remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Payment received via bank transfer, Cash payment, Adjustment for booking cancellation, etc."
                    className="enterprise-input min-h-[100px] resize-none"
                  />
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Footer Actions */}
          <div className={cn(
            "flex justify-end gap-3 pt-4 mt-4 border-t",
            isFullScreen && "max-w-6xl mx-auto"
          )}>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="min-w-[100px]"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !canSubmit}
              className={cn(
                "min-w-[140px] gap-2",
                entryType === "credit" 
                  ? "bg-green-600 hover:bg-green-700 text-white" 
                  : "bg-red-600 hover:bg-red-700 text-white"
              )}
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  {isEditMode ? 'Updating...' : 'Recording...'}
                </>
              ) : (
                <>
                  {paymentMode === 'split' ? <Split className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
                  {isEditMode 
                    ? 'Update Entry' 
                    : paymentMode === 'split'
                      ? `Split Payment (${splitSummary.selectedCount})`
                      : `Add ${entryType === 'credit' ? 'Credit' : 'Debit'} Entry`
                  }
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
