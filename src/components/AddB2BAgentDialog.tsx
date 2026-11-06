import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useB2BAgents, B2BAgent } from "@/hooks/useB2BAgents";
import { useOpeningBalances } from "@/hooks/useOpeningBalances";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Users, Building2, Phone, Mail, MapPin, Percent, DollarSign, Maximize2, Minimize2, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddB2BAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editAgent?: B2BAgent | null;
}

export function AddB2BAgentDialog({ open, onOpenChange, editAgent }: AddB2BAgentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [commissionType, setCommissionType] = useState(editAgent?.commission_type || "percentage");
  const { addAgent, updateAgent } = useB2BAgents();
  const { balances, upsertBalance } = useOpeningBalances();

  const existingOpeningBalance = editAgent
    ? balances.find((b) => b.party_type === "b2b_agent" && b.party_id === editAgent.id)
    : null;
  const [openingBalanceAmount, setOpeningBalanceAmount] = useState<string>("");
  const [openingBalanceType, setOpeningBalanceType] = useState<"receivable" | "payable">("receivable");

  useEffect(() => {
    if (editAgent) {
      setCommissionType(editAgent.commission_type || "percentage");
      if (existingOpeningBalance) {
        setOpeningBalanceAmount(String(existingOpeningBalance.amount));
        setOpeningBalanceType(existingOpeningBalance.balance_type);
      } else {
        setOpeningBalanceAmount("");
        setOpeningBalanceType("receivable");
      }
    } else {
      setCommissionType("percentage");
      setOpeningBalanceAmount("");
      setOpeningBalanceType("receivable");
    }
  }, [editAgent, existingOpeningBalance]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const agentData = {
      agent_name: formData.get("agent_name") as string,
      business_name: (formData.get("business_name") as string) || null,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      country: (formData.get("country") as string) || null,
      city: (formData.get("city") as string) || null,
      commission_type: commissionType,
      commission_value: formData.get("commission_value") ? parseFloat(formData.get("commission_value") as string) : null,
      status: (formData.get("status") as string) || "active",
      notes: (formData.get("notes") as string) || null,
    };

    try {
      let targetAgentId = editAgent?.id;
      if (editAgent) {
        await updateAgent.mutateAsync({ id: editAgent.id, agent: agentData });
      } else {
        const newAgent = await addAgent.mutateAsync(agentData);
        targetAgentId = newAgent.id;
      }

      // Record optional Opening Balance
      const opBalNum = parseFloat(openingBalanceAmount);
      if (targetAgentId && !isNaN(opBalNum) && opBalNum > 0) {
        await upsertBalance.mutateAsync({
          party_type: "b2b_agent",
          party_id: targetAgentId,
          balance_type: openingBalanceType,
          amount: opBalNum,
          as_of_date: new Date().toISOString().split("T")[0],
          notes: "Initial brought-forward opening balance",
        });
      }

      setLoading(false);
      onOpenChange(false);
    } catch (error) {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "enterprise-dialog overflow-hidden flex flex-col transition-all duration-300",
        isFullScreen 
          ? "!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0 !max-w-none w-screen h-[100dvh] !rounded-none border-0" 
          : "w-[95vw] max-w-3xl max-h-[85vh]"
      )}>
        <DialogHeader className="pb-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="form-section-icon form-section-icon-blue">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">
                  {editAgent ? 'Edit B2B Agent' : 'Add New B2B Agent'}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground/80">
                  {editAgent ? 'Update agent details' : 'Enter agent information for B2B partnership'}
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
            
            {/* Basic Information */}
            <Card className="form-card form-card-blue">
              <CardHeader className="pb-4 pt-5">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon-blue">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="form-section-title form-section-title-blue">Basic Information</h3>
                    <p className="form-section-description">Enter agent and business details</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
                <div className="space-y-2">
                  <Label htmlFor="agent_name" className="text-sm font-medium">Agent Name *</Label>
                  <Input
                    id="agent_name"
                    name="agent_name"
                    required
                    defaultValue={editAgent?.agent_name || ''}
                    placeholder="John Doe"
                    className="enterprise-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business_name" className="text-sm font-medium">Business Name</Label>
                  <Input
                    id="business_name"
                    name="business_name"
                    defaultValue={editAgent?.business_name || ''}
                    placeholder="ABC Travels"
                    className="enterprise-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      defaultValue={editAgent?.email || ''}
                      placeholder="agent@email.com"
                      className="pl-9 enterprise-input"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      name="phone"
                      defaultValue={editAgent?.phone || ''}
                      placeholder="03001234567"
                      className="pl-9 enterprise-input"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Location */}
            <Card className="form-card form-card-slate">
              <CardHeader className="pb-4 pt-5">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon-slate">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="form-section-title form-section-title-slate">Location</h3>
                    <p className="form-section-description">Agent's country and city</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
                <div className="space-y-2">
                  <Label htmlFor="country" className="text-sm font-medium">Country</Label>
                  <Input
                    id="country"
                    name="country"
                    defaultValue={editAgent?.country || ''}
                    placeholder="Pakistan"
                    className="enterprise-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-sm font-medium">City</Label>
                  <Input
                    id="city"
                    name="city"
                    defaultValue={editAgent?.city || ''}
                    placeholder="Lahore"
                    className="enterprise-input"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Commission Settings */}
            <Card className="form-card form-card-green">
              <CardHeader className="pb-4 pt-5">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon-green">
                    <Percent className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="form-section-title form-section-title-green">Commission Settings</h3>
                    <p className="form-section-description">Configure agent commission structure</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Commission Type</Label>
                  <Select value={commissionType} onValueChange={setCommissionType}>
                    <SelectTrigger className="enterprise-input">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission_value" className="text-sm font-medium">
                    {commissionType === 'percentage' ? 'Commission %' : 'Fixed Amount (PKR)'}
                  </Label>
                  <div className="relative">
                    {commissionType === 'percentage' ? (
                      <Percent className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    ) : (
                      <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    )}
                    <Input
                      id="commission_value"
                      name="commission_value"
                      type="number"
                      step="0.01"
                      defaultValue={editAgent?.commission_value ?? 0}
                      placeholder={commissionType === 'percentage' ? '5' : '1000'}
                      className="pl-9 enterprise-input"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-sm font-medium">Status</Label>
                  <Select name="status" defaultValue={editAgent?.status || "active"}>
                    <SelectTrigger className="enterprise-input">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Opening Balance (Brought Forward) */}
            <Card className="form-card form-card-amber">
              <CardHeader className="pb-4 pt-5">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon-amber">
                    <Scale className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="form-section-title text-amber-700 dark:text-amber-400">Opening Balance (Optional)</h3>
                    <p className="form-section-description">Record existing balance brought forward (does not impact sales or P&L)</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
                <div className="space-y-2">
                  <Label htmlFor="opening_balance_amount" className="text-sm font-medium">Opening Balance Amount (PKR)</Label>
                  <Input
                    id="opening_balance_amount"
                    type="number"
                    step="0.01"
                    value={openingBalanceAmount}
                    onChange={(e) => setOpeningBalanceAmount(e.target.value)}
                    placeholder="0.00"
                    className="enterprise-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Balance Type</Label>
                  <Select
                    value={openingBalanceType}
                    onValueChange={(val: any) => setOpeningBalanceType(val)}
                  >
                    <SelectTrigger className="enterprise-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receivable">Receivable (Agent owes Agency)</SelectItem>
                      <SelectItem value="payable">Advance / Credit (Agency owes Agent)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">Additional Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={editAgent?.notes || ''}
                placeholder="Additional notes about this agent..."
                rows={3}
                className="enterprise-input min-h-[80px] resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 mt-4 border-t border-border/50 sticky bottom-0 bg-background pb-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="px-6">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25"
            >
              {loading ? 'Saving...' : (editAgent ? 'Update Agent' : 'Add Agent')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
