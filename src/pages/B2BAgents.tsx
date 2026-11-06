import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useB2BAgents, B2BAgent } from "@/hooks/useB2BAgents";
import { useB2BBookings } from "@/hooks/useB2BBookings";
import { useB2BLedger } from "@/hooks/useB2BLedger";
import { DateFilterSelector } from "@/components/DateFilterSelector";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { parseISO, isWithinInterval } from "date-fns";
import { AddB2BAgentDialog } from "@/components/AddB2BAgentDialog";
import { 
  Users, 
  Plus, 
  Search, 
  Eye, 
  Building2, 
  Phone, 
  Globe,
  TrendingUp,
  Banknote,
  AlertCircle,
  Pencil,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

export default function B2BAgents() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editAgent, setEditAgent] = useState<B2BAgent | null>(null);
  const [deleteAgent, setDeleteAgent] = useState<B2BAgent | null>(null);
  
  const { agents, isLoading, deleteAgent: deleteAgentMutation } = useB2BAgents();
  const { bookings: allBookings } = useB2BBookings();
  const { ledgerEntries: allLedger } = useB2BLedger();
  const { filter, setPreset } = useDateFilter();

  // Set "All Time" as default filter for B2B Agents page
  useEffect(() => {
    setPreset("all_time");
  }, []);

  // Get unique countries for filtering
  const countries = useMemo(() => {
    const countrySet = new Set(agents.map(a => a.country).filter(Boolean));
    return Array.from(countrySet).sort();
  }, [agents]);

  // Filter agents
  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      const matchesSearch = searchTerm === "" || 
        agent.agent_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.city?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCountry = countryFilter === "all" || agent.country === countryFilter;
      
      // Date filter based on created_at
      let matchesDate = true;
      if (filter.startDate) {
        const createdAt = agent.created_at ? parseISO(agent.created_at) : null;
        if (!createdAt) {
          matchesDate = false;
        } else if (filter.endDate) {
          matchesDate = isWithinInterval(createdAt, { start: filter.startDate, end: filter.endDate });
        } else {
          matchesDate = createdAt >= filter.startDate;
        }
      }
      
      return matchesSearch && matchesCountry && matchesDate;
    });
  }, [agents, searchTerm, countryFilter, filter]);

  // Calculate agent statistics - ACCURATE calculation from ledger
  const getAgentStats = (agentId: string) => {
    const agentBookings = allBookings.filter(b => b.agent_id === agentId);
    const agentLedger = allLedger.filter(l => l.agent_id === agentId);
    
    // Total Sales = sum of selling prices from bookings
    const totalSales = agentBookings.reduce((sum, b) => sum + (b.selling_price || 0), 0);
    
    // Total Commission = sum of commission amounts from bookings
    const totalCommission = agentBookings.reduce((sum, b) => sum + (b.commission_amount || 0), 0);
    
    // Outstanding calculation from ledger:
    // Debits = What agent owes (bookings create debits for service amount = selling - commission)
    // Credits = What agent paid (payments received)
    const totalDebits = agentLedger.filter(l => l.entry_type === 'debit').reduce((sum, l) => sum + l.amount, 0);
    const totalCredits = agentLedger.filter(l => l.entry_type === 'credit').reduce((sum, l) => sum + l.amount, 0);
    
    // Outstanding = Total Debits - Total Credits (positive means agent owes, negative means advance)
    const outstanding = totalDebits - totalCredits;
    
    return { totalSales, totalCommission, outstanding };
  };

  const handleDelete = async () => {
    if (deleteAgent) {
      await deleteAgentMutation.mutateAsync(deleteAgent.id);
      setDeleteAgent(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">B2B Agents</h1>
            <p className="text-sm text-muted-foreground">{agents.length} agents registered</p>
          </div>
        </div>
        
        <Button onClick={() => setShowAddDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add New Agent
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search agents by name, business, city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Globe className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {countries.map(country => (
                  <SelectItem key={country} value={country!}>{country}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DateFilterSelector />
        </CardContent>
      </Card>

      {/* Agents List */}
      {filteredAgents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No B2B Agents Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || countryFilter !== "all" 
                ? "Try adjusting your filters" 
                : "Add your first B2B agent to get started"}
            </p>
            {!searchTerm && countryFilter === "all" && (
              <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add First Agent
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredAgents.map(agent => {
            const stats = getAgentStats(agent.id);
            return (
              <Card key={agent.id} className="hover:shadow-md transition-shadow overflow-hidden">
                {/* Banner Header with Agent Name */}
                <div className="bg-gradient-to-r from-primary to-primary/80 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl text-white truncate">{agent.agent_name}</h3>
                        {agent.business_name && (
                          <span className="text-sm text-white/80">{agent.business_name}</span>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-sm font-medium",
                        agent.status === 'active' 
                          ? "bg-white/20 text-white border-white/30" 
                          : "bg-gray-500/30 text-gray-100 border-gray-300/30"
                      )}
                    >
                      {agent.status === 'active' ? '● Active' : '○ Inactive'}
                    </Badge>
                  </div>
                </div>

                <CardContent className="py-4">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Agent Contact Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {agent.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {agent.phone}
                          </span>
                        )}
                        {(agent.city || agent.country) && (
                          <span className="flex items-center gap-1">
                            <Globe className="w-3.5 h-3.5" />
                            {[agent.city, agent.country].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex flex-wrap gap-4 lg:gap-6">
                      <div className="text-center min-w-[80px]">
                        <div className="flex items-center justify-center gap-1 text-blue-600">
                          <TrendingUp className="w-4 h-4" />
                          <span className="font-bold">PKR {stats.totalSales.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Total Sales</p>
                      </div>
                      <div className="text-center min-w-[80px]">
                        <div className="flex items-center justify-center gap-1 text-green-600">
                          <Banknote className="w-4 h-4" />
                          <span className="font-bold">PKR {stats.totalCommission.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Commission</p>
                      </div>
                      <div className="text-center min-w-[80px]">
                        <div className={cn(
                          "flex items-center justify-center gap-1",
                          stats.outstanding > 0 ? "text-red-600" : "text-green-600"
                        )}>
                          <AlertCircle className="w-4 h-4" />
                          <span className="font-bold">PKR {Math.abs(stats.outstanding).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {stats.outstanding > 0 ? 'Outstanding' : 'Advance'}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 lg:ml-4">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => navigate(`/app/b2b-agents/${agent.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View Agent</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditAgent(agent)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit Agent</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteAgent(agent)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete Agent</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Agent Dialog */}
      <AddB2BAgentDialog
        open={showAddDialog || !!editAgent}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditAgent(null);
          }
        }}
        editAgent={editAgent}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteAgent} onOpenChange={() => setDeleteAgent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete B2B Agent?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteAgent?.agent_name}</strong>? 
              This will also delete all their bookings and ledger entries. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Agent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
