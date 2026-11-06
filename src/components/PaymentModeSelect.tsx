import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Banknote, Building2, Plus, PlusCircle } from "lucide-react";
import { useAgencyBanks } from "@/hooks/useAgencyBanks";
import { toast } from "sonner";

interface PaymentModeSelectProps {
  value: string;
  onChange: (mode: string) => void;
  bankName?: string;
  onBankNameChange?: (name: string) => void;
  className?: string;
  required?: boolean;
}

export function PaymentModeSelect({ 
  value, 
  onChange, 
  bankName = "",
  onBankNameChange,
  className = "",
  required = false
}: PaymentModeSelectProps) {
  const { banks: agencyBanks, addBank, isLoading } = useAgencyBanks();
  const [selectedBank, setSelectedBank] = useState(bankName || "");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Get only user's added banks
  const userBanks = agencyBanks?.map((b: any) => b.bank_name) || [];

  useEffect(() => {
    if (bankName) {
      setSelectedBank(bankName);
    }
  }, [bankName]);

  const handleBankSelect = (bank: string) => {
    if (bank === "__add_new__") {
      setShowQuickAdd(true);
      return;
    }
    setSelectedBank(bank);
    onBankNameChange?.(bank);
  };

  const handleQuickAddBank = async () => {
    if (!newBankName.trim()) {
      toast.error("Please enter a bank name");
      return;
    }

    // Check if bank already exists
    if (userBanks.includes(newBankName.trim())) {
      toast.error("Bank already exists");
      return;
    }

    setIsAdding(true);
    try {
      await addBank.mutateAsync({
        bank_name: newBankName.trim(),
        account_number: null,
        account_title: null,
        branch_name: null,
        is_active: true,
        opening_balance: 0,
      });
      
      // Select the newly added bank
      setSelectedBank(newBankName.trim());
      onBankNameChange?.(newBankName.trim());
      setNewBankName("");
      setShowQuickAdd(false);
      toast.success("Bank added successfully!");
    } catch (error) {
      toast.error("Failed to add bank");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <>
      <div className={`space-y-3 ${className}`}>
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Banknote className="w-4 h-4 text-primary" />
            Payment Mode {required && "*"}
          </Label>
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select payment mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4" />
                  Cash
                </div>
              </SelectItem>
              <SelectItem value="bank">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Bank
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bank selection - only shows when payment mode is 'bank' */}
        {value === "bank" && (
          <div className="space-y-2 ml-6 pl-4 border-l-2 border-primary/20">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Select Bank
            </Label>
            
            {userBanks.length === 0 ? (
              // No banks added yet - show prompt to add
              <div className="p-4 border border-dashed rounded-lg bg-muted/30 text-center">
                <Building2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">No bank accounts added yet</p>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowQuickAdd(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Bank
                </Button>
              </div>
            ) : (
              // Show user's banks with quick add option
              <Select value={selectedBank} onValueChange={handleBankSelect}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select your bank" />
                </SelectTrigger>
                <SelectContent>
                  {/* User's banks */}
                  {userBanks.map((bank: string) => (
                    <SelectItem key={bank} value={bank}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-600" />
                        {bank}
                      </div>
                    </SelectItem>
                  ))}
                  
                  {/* Divider and Quick Add option */}
                  <div className="border-t my-1" />
                  <SelectItem value="__add_new__" className="text-primary">
                    <div className="flex items-center gap-2">
                      <PlusCircle className="w-4 h-4" />
                      Add New Bank...
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>

      {/* Quick Add Bank Dialog */}
      <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Quick Add Bank
            </DialogTitle>
            <DialogDescription>
              Add a new bank to your account. You can add more details later in Bank & Cash Manager.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="quickBankName">Bank Name *</Label>
              <Input
                id="quickBankName"
                value={newBankName}
                onChange={(e) => setNewBankName(e.target.value)}
                placeholder="e.g., HBL, UBL, Meezan Bank"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowQuickAdd(false)}>
              Cancel
            </Button>
            <Button onClick={handleQuickAddBank} disabled={isAdding || !newBankName.trim()}>
              {isAdding ? "Adding..." : "Add Bank"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Compact inline version for use in tables or smaller spaces
export function PaymentModeInline({ 
  value, 
  onChange,
  bankName = "",
  onBankNameChange 
}: PaymentModeSelectProps) {
  const { banks: agencyBanks } = useAgencyBanks();
  const userBanks = agencyBanks?.map((b: any) => b.bank_name) || [];

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-24 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cash">Cash</SelectItem>
          <SelectItem value="bank">Bank</SelectItem>
        </SelectContent>
      </Select>
      
      {value === "bank" && userBanks.length > 0 && (
        <Select value={bankName} onValueChange={onBankNameChange}>
          <SelectTrigger className="w-28 h-8 text-xs">
            <SelectValue placeholder="Bank" />
          </SelectTrigger>
          <SelectContent>
            {userBanks.map((bank: string) => (
              <SelectItem key={bank} value={bank}>{bank}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
