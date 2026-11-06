import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueries } from "@/hooks/useStorage";
import { toast } from "sonner";
import { MessageSquare, User, Phone, Flag, Clock, UserCheck, Calendar, FileText, Maximize2, Minimize2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { FormSectionNav } from "@/components/FormSectionNav";

interface AddQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editQuery?: any;
}

const SECTIONS = [
  { id: 'client-info', label: 'Client Information', color: 'blue' },
  { id: 'query-details', label: 'Query Details', color: 'purple' },
  { id: 'status-assignment', label: 'Status & Assignment', color: 'amber' },
];

export function AddQueryDialog({ open, onOpenChange, editQuery }: AddQueryDialogProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const { addQuery, updateQuery } = useQueries();
  
  const { activeSection, setSectionRef, scrollToSection, containerRef, isVisible } = useScrollAnimation(SECTIONS.length);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const queryData = {
      client_name: formData.get("client_name") as string,
      contact_number: formData.get("contact_number") as string,
      query_text: formData.get("query_text") as string,
      priority: formData.get("priority") as string,
      status: formData.get("status") as string,
      assigned_to: formData.get("assigned_to") as string,
      due_date: (formData.get("due_date") as string) || null,
      notes: formData.get("notes") as string,
    };

    try {
      if (editQuery) {
        await updateQuery.mutateAsync({ id: editQuery.id, query: queryData });
        toast.success("Query updated successfully");
      } else {
        await addQuery.mutateAsync(queryData);
        toast.success("Query added successfully");
      }
      form.reset();
      onOpenChange(false);
    } catch (error: any) {
      const errorMessage = error?.message || (editQuery ? "Failed to update query" : "Failed to add query");
      toast.error(errorMessage);
    }
  };

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
              <div className="form-section-icon form-section-icon-purple">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">{editQuery ? 'Edit Query' : 'Add New Query'}</DialogTitle>
                <DialogDescription className="text-muted-foreground/80">Capture and track client queries and follow-ups</DialogDescription>
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
        
        {/* Section Navigation - Only in fullscreen */}
        {isFullScreen && (
          <FormSectionNav
            sections={SECTIONS}
            activeSection={activeSection}
            onNavigate={scrollToSection}
          />
        )}
        
        <form 
          onSubmit={handleSubmit} 
          className={cn(
            "flex-1 overflow-y-auto form-scroll-container",
            isFullScreen ? "p-6 lg:p-8" : "p-2"
          )}
        >
          <div 
            ref={containerRef}
            className={isFullScreen ? "max-w-3xl mx-auto space-y-6" : "space-y-4"}
          >
          {/* Client Information Card */}
          <div 
            ref={setSectionRef(0)}
            className={cn(
              "scroll-reveal",
              isVisible(0) && "is-visible"
            )}
          >
            <Card className="form-card form-card-blue">
              <CardHeader className="pb-4 pt-5">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon-blue">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="form-section-title form-section-title-blue">Client Information</h3>
                    <p className="form-section-description">Enter the client details for this query</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="client_name" className="text-sm font-medium flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-600" />
                      Client Name *
                    </Label>
                    <Input 
                      id="client_name" 
                      name="client_name" 
                      required 
                      defaultValue={editQuery?.client_name || ''} 
                      placeholder="Client full name"
                      className="enterprise-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_number" className="text-sm font-medium flex items-center gap-2">
                      <Phone className="w-4 h-4 text-blue-600" />
                      Contact Number
                    </Label>
                    <Input 
                      id="contact_number" 
                      name="contact_number" 
                      defaultValue={editQuery?.contact_number || ''} 
                      placeholder="Phone number"
                      className="enterprise-input"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Query Details Card */}
          <div 
            ref={setSectionRef(1)}
            className={cn(
              "scroll-reveal",
              isVisible(1) && "is-visible"
            )}
          >
            <Card className="form-card form-card-purple">
              <CardHeader className="pb-4 pt-5">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon-purple">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="form-section-title form-section-title-purple">Query Details</h3>
                    <p className="form-section-description">Describe the client's query or request</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-6">
                <div className="space-y-2">
                  <Label htmlFor="query_text" className="text-sm font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600" />
                    Query / Request *
                  </Label>
                  <Textarea 
                    id="query_text" 
                    name="query_text" 
                    required 
                    defaultValue={editQuery?.query_text || ''} 
                    placeholder="Describe the client's query or request in detail..."
                    rows={3}
                    className="enterprise-input min-h-[100px] resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status & Priority Card */}
          <div 
            ref={setSectionRef(2)}
            className={cn(
              "scroll-reveal",
              isVisible(2) && "is-visible"
            )}
          >
            <Card className="form-card form-card-amber">
              <CardHeader className="pb-4 pt-5">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon-amber">
                    <Flag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="form-section-title form-section-title-amber">Status & Assignment</h3>
                    <p className="form-section-description">Set priority, status, and assign the query</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority" className="text-sm font-medium flex items-center gap-2">
                      <Flag className="w-4 h-4 text-amber-600" />
                      Priority *
                    </Label>
                    <Select name="priority" defaultValue={editQuery?.priority || "medium"} required>
                      <SelectTrigger className="enterprise-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="low">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            Low
                          </span>
                        </SelectItem>
                        <SelectItem value="medium">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                            Medium
                          </span>
                        </SelectItem>
                        <SelectItem value="high">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                            High
                          </span>
                        </SelectItem>
                        <SelectItem value="urgent">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            Urgent
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-sm font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600" />
                      Status *
                    </Label>
                    <Select name="status" defaultValue={editQuery?.status || "pending"} required>
                      <SelectTrigger className="enterprise-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assigned_to" className="text-sm font-medium flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-amber-600" />
                      Assigned To
                    </Label>
                    <Input 
                      id="assigned_to" 
                      name="assigned_to" 
                      defaultValue={editQuery?.assigned_to || ''} 
                      placeholder="Team member name"
                      className="enterprise-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_date" className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-600" />
                      Due Date
                    </Label>
                    <Input 
                      id="due_date" 
                      name="due_date" 
                      type="date" 
                      defaultValue={editQuery?.due_date || ''} 
                      className="enterprise-input"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-600" />
                    Notes
                  </Label>
                  <Textarea 
                    id="notes" 
                    name="notes" 
                    defaultValue={editQuery?.notes || ''} 
                    placeholder="Additional notes or follow-up actions..."
                    rows={2}
                    className="enterprise-input min-h-[70px] resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          </div>
          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-border/50 sticky bottom-0 bg-background pb-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="px-6"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={addQuery.isPending || updateQuery.isPending}
              className="px-6 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/25"
            >
              {addQuery.isPending || updateQuery.isPending ? "Saving..." : editQuery ? "Update Query" : "Add Query"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
