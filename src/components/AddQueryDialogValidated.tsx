import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueries } from "@/hooks/useStorage";
import { toast } from "sonner";
import { Maximize2, Minimize2 } from "lucide-react";
import { querySchema, validateData } from "@/lib/validations/schemas";

interface AddQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editQuery?: any;
}

export function AddQueryDialogValidated({ open, onOpenChange, editQuery }: AddQueryDialogProps) {
  const { addQuery, updateQuery } = useQueries();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("You are offline, not saved");
      return;
    }

    setIsSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const queryData = {
      client_name: formData.get("client_name") as string,
      contact_number: (formData.get("contact_number") as string) || undefined,
      query_text: formData.get("query_text") as string,
      priority: formData.get("priority") as string,
      status: formData.get("status") as string,
      assigned_to: (formData.get("assigned_to") as string) || undefined,
      due_date: (formData.get("due_date") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
    };

    // Validate data
    const validation = validateData(querySchema, queryData);

    if (!validation.success) {
      setIsSubmitting(false);
      toast.error((validation as { success: false; error: string }).error);
      return;
    }

    const validatedData = validation.data;

    try {
      if (editQuery) {
        await updateQuery.mutateAsync({ id: editQuery.id, query: validatedData });
        toast.success("Query updated successfully");
      } else {
        await addQuery.mutateAsync(validatedData);
        toast.success("Query added successfully");
      }
      form.reset();
      onOpenChange(false);
    } catch (error: any) {
      const errorMessage = error?.message || (editQuery ? "Failed to update query" : "Failed to add query");
      toast.error(`Could not save: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isFullScreen ? "max-w-full h-screen m-0 rounded-none overflow-y-auto" : "w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] overflow-y-auto"}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{editQuery ? 'Edit Query' : 'Add New Query'}</DialogTitle>
              <DialogDescription>Capture and track client queries and follow-ups.</DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="h-8 w-8 p-0"
            >
              {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className={isFullScreen ? "p-6 lg:p-8" : ""}>
          <div className={isFullScreen ? "max-w-6xl mx-auto space-y-4" : "space-y-4"}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client_name">Client Name *</Label>
                <Input
                  id="client_name"
                  name="client_name"
                  required
                  defaultValue={editQuery?.client_name || ''}
                  placeholder="Client full name"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_number">Contact Number</Label>
                <Input
                  id="contact_number"
                  name="contact_number"
                  defaultValue={editQuery?.contact_number || ''}
                  placeholder="03001234567"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="query_text">Query Description *</Label>
              <Textarea
                id="query_text"
                name="query_text"
                required
                defaultValue={editQuery?.query_text || ''}
                rows={3}
                placeholder="Describe the client's query or request..."
                maxLength={2000}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority *</Label>
                <Select name="priority" defaultValue={editQuery?.priority || 'medium'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select name="status" defaultValue={editQuery?.status || 'pending'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  name="due_date"
                  type="date"
                  defaultValue={editQuery?.due_date || ''}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assigned To</Label>
              <Input
                id="assigned_to"
                name="assigned_to"
                defaultValue={editQuery?.assigned_to || ''}
                placeholder="Staff member name"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={editQuery?.notes || ''}
                rows={3}
                placeholder="Any additional information..."
                maxLength={5000}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (editQuery ? "Updating..." : "Adding...") : (editQuery ? "Update Query" : "Add Query")}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
