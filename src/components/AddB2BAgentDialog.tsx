import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useB2BAgents, B2BAgent } from "@/hooks/useB2BAgents";
import { useOpeningBalances } from "@/hooks/useOpeningBalances";
import {
  Users,
  Building2,
  Phone,
  Mail,
  MapPin,
  Percent,
  DollarSign,
  Scale,
  FileText,
  X,
  Plus,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useEnterToNext } from "@/hooks/useEnterToNext";

export interface AddB2BAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editAgent?: B2BAgent | null;
  initialName?: string;
  onSaved?: (agent: B2BAgent) => void;
}

export function AddB2BAgentDialog({
  open,
  onOpenChange,
  editAgent,
  initialName = "",
  onSaved,
}: AddB2BAgentDialogProps) {
  const [loading, setLoading] = useState(false);
  const { addAgent, updateAgent } = useB2BAgents();
  const { balances, upsertBalance } = useOpeningBalances();

  // Form references
  const formRef = useRef<HTMLFormElement>(null);
  const agentNameRef = useRef<HTMLInputElement>(null);

  // Form state
  const [agentName, setAgentName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("Pakistan");
  const [city, setCity] = useState("");
  const [commissionType, setCommissionType] = useState<"percentage" | "fixed">("percentage");
  const [commissionValue, setCommissionValue] = useState<string>("0");
  const [status, setStatus] = useState<"active" | "blocked">("active");
  const [openingBalanceAmount, setOpeningBalanceAmount] = useState<string>("");
  const [openingBalanceType, setOpeningBalanceType] = useState<"receivable" | "payable">("receivable");
  const [notes, setNotes] = useState("");

  const existingOpeningBalance = editAgent
    ? balances.find((b) => b.party_type === "b2b_agent" && b.party_id === editAgent.id)
    : null;

  // Initialize form state
  const resetForm = (namePrefill = "") => {
    if (editAgent) {
      setAgentName(editAgent.agent_name || "");
      setBusinessName(editAgent.business_name || "");
      setEmail(editAgent.email || "");
      setPhone(editAgent.phone || "");
      setCountry(editAgent.country || "Pakistan");
      setCity(editAgent.city || "");
      setCommissionType((editAgent.commission_type as "fixed" | "percentage") || "percentage");
      setCommissionValue(editAgent.commission_value?.toString() || "0");
      setStatus((editAgent.status as any) || "active");
      setNotes(editAgent.notes || "");
      if (existingOpeningBalance) {
        setOpeningBalanceAmount(String(existingOpeningBalance.amount));
        setOpeningBalanceType(existingOpeningBalance.balance_type);
      } else {
        setOpeningBalanceAmount("");
        setOpeningBalanceType("receivable");
      }
    } else {
      setAgentName(namePrefill || initialName || "");
      setBusinessName("");
      setEmail("");
      setPhone("");
      setCountry("Pakistan");
      setCity("");
      setCommissionType("percentage");
      setCommissionValue("0");
      setStatus("active");
      setOpeningBalanceAmount("");
      setOpeningBalanceType("receivable");
      setNotes("");
    }
  };

  useEffect(() => {
    if (open) {
      resetForm(initialName);
      setTimeout(() => {
        if (agentNameRef.current) {
          agentNameRef.current.focus();
          if (agentNameRef.current.value) {
            agentNameRef.current.select();
          }
        }
      }, 80);
    }
  }, [open, editAgent, initialName, existingOpeningBalance]);

  // Main submit handler
  const handleSaveInternal = async (isSaveAndAddNext = false) => {
    const trimmedName = agentName.trim();
    if (!trimmedName) {
      toast.error("Agent Name is required");
      agentNameRef.current?.focus();
      return;
    }

    setLoading(true);
    const agentData = {
      agent_name: trimmedName,
      business_name: businessName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      country: country.trim() || null,
      city: city.trim() || null,
      commission_type: commissionType,
      commission_value: commissionValue ? parseFloat(commissionValue) : null,
      status: status,
      notes: notes.trim() || null,
    };

    try {
      let savedResult: B2BAgent | null = null;
      if (editAgent) {
        await updateAgent.mutateAsync({ id: editAgent.id, agent: agentData });
        savedResult = { ...editAgent, ...agentData } as B2BAgent;
        toast.success(`Agent "${trimmedName}" updated successfully!`);
      } else {
        savedResult = await addAgent.mutateAsync(agentData);
        toast.success(`Agent "${trimmedName}" created successfully!`);
      }

      // Record optional Opening Balance
      const opBalNum = parseFloat(openingBalanceAmount);
      if (savedResult?.id && !isNaN(opBalNum) && opBalNum > 0) {
        await upsertBalance.mutateAsync({
          party_type: "b2b_agent",
          party_id: savedResult.id,
          balance_type: openingBalanceType,
          amount: opBalNum,
          as_of_date: new Date().toISOString().split("T")[0],
          notes: "Initial brought-forward opening balance",
        });
      }

      if (savedResult) {
        onSaved?.(savedResult);
      }

      if (isSaveAndAddNext) {
        resetForm("");
        toast.info("Ready for next agent");
        setTimeout(() => {
          agentNameRef.current?.focus();
        }, 60);
      } else {
        onOpenChange(false);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to save agent");
    } finally {
      setLoading(false);
    }
  };

  // Keyboard navigation hook
  useEnterToNext({
    containerRef: formRef,
    enabled: open,
    onSave: () => handleSaveInternal(false),
    onSaveAndAddNext: () => handleSaveInternal(true),
    onCancel: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] p-0 gap-0 overflow-hidden rounded-xl border border-border shadow-2xl flex flex-col bg-background"
        aria-describedby="add-b2b-agent-description"
      >
        <DialogTitle className="sr-only">
          {editAgent ? "Edit B2B Agent" : "Add New B2B Agent"}
        </DialogTitle>
        <DialogDescription id="add-b2b-agent-description" className="sr-only">
          B2B Agent details and commission setup form
        </DialogDescription>

        {/* ================= HEADER ================= */}
        <div className="h-11 px-4 border-b border-border/80 flex items-center justify-between shrink-0 bg-muted/40">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-sm tracking-tight text-foreground">
              {editAgent ? "Edit B2B Agent" : "Add New B2B Agent"}
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-cancel-button="true"
            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* ================= FORM BODY ================= */}
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveInternal(false);
          }}
          className="flex-1 overflow-y-auto p-4 space-y-3.5"
        >
          {/* 1. Basic Info (BLUE) */}
          <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 border-l-4 border-l-blue-600 dark:border-l-blue-500 rounded-lg p-3 shadow-2xs">
            <div className="text-xs font-bold text-blue-950 dark:text-blue-100 flex items-center gap-1.5 mb-2.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Basic Information
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {/* Agent Name */}
              <div className="sm:col-span-2 md:col-span-1">
                <Label
                  htmlFor="agent_name"
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 block"
                >
                  Agent Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="agent_name"
                  ref={agentNameRef}
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g. Tariq Mehmood"
                  required
                  className="h-8 text-xs font-medium focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                />
              </div>

              {/* Business Name */}
              <div>
                <Label
                  htmlFor="business_name"
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 block"
                >
                  Agency / Business Name
                </Label>
                <Input
                  id="business_name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Al-Madina Travels"
                  className="h-8 text-xs focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                />
              </div>

              {/* Phone */}
              <div>
                <Label
                  htmlFor="phone"
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 block flex items-center gap-1"
                >
                  <Phone className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0300-1234567"
                  className="h-8 text-xs focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                />
              </div>

              {/* Email */}
              <div>
                <Label
                  htmlFor="email"
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 block flex items-center gap-1"
                >
                  <Mail className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="agent@agency.com"
                  className="h-8 text-xs focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                />
              </div>

              {/* Country */}
              <div>
                <Label
                  htmlFor="country"
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 block flex items-center gap-1"
                >
                  <MapPin className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  Country
                </Label>
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Pakistan"
                  className="h-8 text-xs focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                />
              </div>

              {/* City */}
              <div>
                <Label
                  htmlFor="city"
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 block"
                >
                  City
                </Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Lahore / Karachi"
                  className="h-8 text-xs focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 2. Financial & Commission (GREEN) */}
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 border-l-4 border-l-emerald-600 dark:border-l-emerald-500 rounded-lg p-3 shadow-2xs">
            <div className="text-xs font-bold text-emerald-950 dark:text-emerald-100 flex items-center gap-1.5 mb-2.5">
              <Percent className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Financial & Commission Settings
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {/* Commission Type */}
              <div>
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 block">
                  Commission Type
                </Label>
                <Select
                  value={commissionType}
                  onValueChange={(val: any) => setCommissionType(val)}
                >
                  <SelectTrigger className="h-8 text-xs bg-background focus:ring-2 focus:ring-emerald-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (PKR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Commission Value */}
              <div>
                <Label
                  htmlFor="commission_value"
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 block flex items-center gap-1"
                >
                  {commissionType === "percentage" ? (
                    <Percent className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <DollarSign className="w-3 h-3 text-emerald-600" />
                  )}
                  {commissionType === "percentage" ? "Rate (%)" : "Rate (PKR)"}
                </Label>
                <Input
                  id="commission_value"
                  type="number"
                  step="0.01"
                  value={commissionValue}
                  onChange={(e) => setCommissionValue(e.target.value)}
                  placeholder="0"
                  className="h-8 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
                />
              </div>

              {/* Status */}
              <div>
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 block">
                  Account Status
                </Label>
                <Select
                  value={status}
                  onValueChange={(val: any) => setStatus(val)}
                >
                  <SelectTrigger className="h-8 text-xs bg-background focus:ring-2 focus:ring-emerald-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Opening Balance Group */}
              <div>
                <Label
                  htmlFor="opening_balance_amount"
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 block flex items-center gap-1"
                >
                  <Scale className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Opening Balance
                </Label>
                <div className="flex gap-1">
                  <Select
                    value={openingBalanceType}
                    onValueChange={(val: any) => setOpeningBalanceType(val)}
                  >
                    <SelectTrigger className="h-8 text-xs w-20 shrink-0 bg-background focus:ring-2 focus:ring-emerald-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receivable">Rec (Owed)</SelectItem>
                      <SelectItem value="payable">Pay (Advance)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="opening_balance_amount"
                    type="number"
                    step="0.01"
                    value={openingBalanceAmount}
                    onChange={(e) => setOpeningBalanceAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-8 text-xs flex-1 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Notes (AMBER) */}
          <div className="bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 border-l-4 border-l-amber-500 dark:border-l-amber-500 rounded-lg p-3 shadow-2xs">
            <div className="text-xs font-bold text-amber-950 dark:text-amber-100 flex items-center gap-1.5 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Notes & Remarks
            </div>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes, payment terms, or instructions for this agent..."
              rows={2}
              className="text-xs min-h-[56px] resize-none bg-background focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:border-amber-500"
            />
          </div>
        </form>

        {/* ================= PINNED FOOTER ================= */}
        <div className="h-12 border-t border-border px-4 flex items-center justify-between shrink-0 bg-background/95 backdrop-blur-xs">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-cancel-button="true"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-xs h-8 cursor-pointer"
          >
            Cancel
          </Button>

          {/* Center hint text */}
          <div className="hidden sm:flex items-center text-[11px] text-muted-foreground select-none">
            <span>Enter = next field • Ctrl+Enter = save • Esc = cancel</span>
          </div>

          <div className="flex items-center gap-2">
            {!editAgent && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                data-save-next="true"
                onClick={() => handleSaveInternal(true)}
                disabled={loading}
                className="text-xs h-8 font-semibold gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Save & Add Next
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              data-save-button="true"
              onClick={() => handleSaveInternal(false)}
              disabled={loading}
              className="text-xs h-8 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-sm cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {loading ? "Saving..." : editAgent ? "Update Agent" : "Save Agent"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
