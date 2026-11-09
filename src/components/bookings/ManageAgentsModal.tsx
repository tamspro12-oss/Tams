import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  Building2,
  Phone,
  Mail,
  Globe,
  DollarSign,
  Scale,
  X,
} from "lucide-react";
import { B2BAgent, useB2BAgents } from "@/hooks/useB2BAgents";
import { useOpeningBalances } from "@/hooks/useOpeningBalances";
import { AddB2BAgentDialog } from "@/components/AddB2BAgentDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ManageAgentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageAgentsModal({ open, onOpenChange }: ManageAgentsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [agentToEdit, setAgentToEdit] = useState<B2BAgent | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<B2BAgent | null>(null);

  const { agents, deleteAgent, isLoading } = useB2BAgents();
  const { balances } = useOpeningBalances();

  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents;
    const q = searchQuery.toLowerCase().trim();
    return agents.filter(
      (a) =>
        a.agent_name.toLowerCase().includes(q) ||
        a.business_name?.toLowerCase().includes(q) ||
        a.phone?.toLowerCase().includes(q) ||
        a.city?.toLowerCase().includes(q)
    );
  }, [agents, searchQuery]);

  const getAgentOpeningBalance = (agentId: string) => {
    const ob = balances.find(
      (b) => b.party_type === "b2b_agent" && b.party_id === agentId
    );
    if (!ob || !ob.amount) return null;
    return {
      amount: ob.amount,
      type: ob.balance_type,
    };
  };

  const handleDelete = async () => {
    if (!agentToDelete) return;
    try {
      await deleteAgent.mutateAsync(agentToDelete.id);
      toast.success(`Agent "${agentToDelete.agent_name}" deleted successfully`);
      setAgentToDelete(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete agent");
    }
  };

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-muted/40 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold">
                    Manage B2B Agents
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Directory of registered B2B travel agents, commissions & opening balances
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setAgentToEdit(null);
                    setShowAddDialog(true);
                  }}
                  className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add New Agent
                </Button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative mt-3">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search by agent name, agency, phone, city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-xs pl-8 bg-background"
              />
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-0">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 text-muted-foreground sticky top-0 border-b z-10">
                <tr>
                  <th className="p-2.5 text-left">Agent Name</th>
                  <th className="p-2.5 text-left">Business / City</th>
                  <th className="p-2.5 text-left">Contact Info</th>
                  <th className="p-2.5 text-left">Commission</th>
                  <th className="p-2.5 text-left">Opening Bal</th>
                  <th className="p-2.5 text-center">Status</th>
                  <th className="p-2.5 text-right w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredAgents.length > 0 ? (
                  filteredAgents.map((agent) => {
                    const ob = getAgentOpeningBalance(agent.id);
                    return (
                      <tr key={agent.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-2.5 font-bold text-foreground">
                          {agent.agent_name}
                        </td>
                        <td className="p-2.5">
                          <span className="font-medium text-foreground block">
                            {agent.business_name || "-"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {[agent.city, agent.country].filter(Boolean).join(", ") || "-"}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <span className="block text-foreground">{agent.phone || "-"}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {agent.email || "-"}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <Badge variant="outline" className="text-[10px] h-5 border-purple-500/30 text-purple-700 dark:text-purple-300">
                            {agent.commission_type === "percentage"
                              ? `${agent.commission_value || 0}%`
                              : `PKR ${agent.commission_value || 0}`}
                          </Badge>
                        </td>
                        <td className="p-2.5">
                          {ob ? (
                            <span className="text-[11px] font-semibold text-foreground">
                              PKR {ob.amount.toLocaleString()}{" "}
                              <span className="text-[10px] text-muted-foreground uppercase">
                                ({ob.type === "receivable" ? "Rec" : "Pay"})
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] h-4.5 px-1.5 capitalize",
                              agent.status === "active"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                : "bg-gray-500/10 text-gray-500 border-gray-500/30"
                            )}
                          >
                            {agent.status}
                          </Badge>
                        </td>
                        <td className="p-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setAgentToEdit(agent);
                                setShowAddDialog(true);
                              }}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Edit Agent"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setAgentToDelete(agent)}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              title="Delete Agent"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground italic">
                      No B2B agents found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Agent Dialog */}
      {showAddDialog && (
        <AddB2BAgentDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          editAgent={agentToEdit}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={Boolean(agentToDelete)}
        onOpenChange={(val) => !val && setAgentToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete B2B Agent?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete agent <b>{agentToDelete?.agent_name}</b>?
              Existing bookings linked to this agent will remain in records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete Agent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

