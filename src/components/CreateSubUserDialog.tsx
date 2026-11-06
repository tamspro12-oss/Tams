import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useSubUsers, SubUserPermissions } from "@/hooks/useSubUsers";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { Loader2 } from "lucide-react";

interface CreateSubUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateSubUserDialog = ({ open, onOpenChange }: CreateSubUserDialogProps) => {
  const { createSubUser } = useSubUsers();
  const { data: agencyId } = useCurrentAgencyId();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
  });

  const [permissions, setPermissions] = useState<SubUserPermissions>({
    dashboard: false,
    bookings: { read: false, write: false, delete: false },
    vendors: { read: false, write: false, delete: false },
    clients: { read: false, write: false, delete: false },
    queries: { read: false, write: false, delete: false },
    expenses: { read: false, write: false, delete: false },
    reports: { read: false },
    invoices: { read: false, write: false },
    settings: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId) return;

    createSubUser.mutate(
      {
        ...formData,
        permissions,
        agency_id: agencyId,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setFormData({ email: "", password: "", full_name: "" });
        },
      }
    );
  };

  const toggleModulePermission = (module: keyof SubUserPermissions, action?: "read" | "write" | "delete") => {
    setPermissions((prev) => {
      if (typeof prev[module] === "boolean") {
        return { ...prev, [module]: !prev[module] };
      }
      if (action && typeof prev[module] === "object") {
        return {
          ...prev,
          [module]: { ...prev[module], [action]: !prev[module][action] },
        };
      }
      return prev;
    });
  };

  const handleSelectAllReadOnly = () => {
    // Check if any permission is enabled
    const hasAnyPermission = 
      permissions.dashboard ||
      permissions.bookings.read ||
      permissions.vendors.read ||
      permissions.clients.read ||
      permissions.queries.read ||
      permissions.expenses.read ||
      permissions.reports.read ||
      permissions.invoices.read;

    if (hasAnyPermission) {
      // Deselect all
      setPermissions({
        dashboard: false,
        bookings: { read: false, write: false, delete: false },
        vendors: { read: false, write: false, delete: false },
        clients: { read: false, write: false, delete: false },
        queries: { read: false, write: false, delete: false },
        expenses: { read: false, write: false, delete: false },
        reports: { read: false },
        invoices: { read: false, write: false },
        settings: false,
      });
    } else {
      // Select all with read-only access
      setPermissions({
        dashboard: true,
        bookings: { read: true, write: false, delete: false },
        vendors: { read: true, write: false, delete: false },
        clients: { read: true, write: false, delete: false },
        queries: { read: true, write: false, delete: false },
        expenses: { read: true, write: false, delete: false },
        reports: { read: true },
        invoices: { read: true, write: false },
        settings: false,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Sub User</DialogTitle>
          <DialogDescription>
            Create a new sub user with specific permissions. All features are optional - select any combination or leave all unchecked. Maximum 2 sub users allowed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground mt-1">Minimum 8 characters</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Permissions</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAllReadOnly}
              >
                {permissions.dashboard || permissions.bookings.read ? "Deselect All" : "Select All (Read-Only)"}
              </Button>
            </div>

            <div className="space-y-3">
              {/* Dashboard */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={permissions.dashboard}
                  onCheckedChange={() => toggleModulePermission("dashboard")}
                />
                <Label>Dashboard</Label>
              </div>

              {/* Bookings */}
              <div className="space-y-2">
                <Label className="font-medium">Bookings</Label>
                <div className="ml-6 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={permissions.bookings.read}
                      onCheckedChange={() => toggleModulePermission("bookings", "read")}
                    />
                    <Label>Read</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={permissions.bookings.write}
                      onCheckedChange={() => toggleModulePermission("bookings", "write")}
                    />
                    <Label>Write (Create/Edit)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={permissions.bookings.delete}
                      onCheckedChange={() => toggleModulePermission("bookings", "delete")}
                    />
                    <Label>Delete</Label>
                  </div>
                </div>
              </div>

              {/* Vendors */}
              <div className="space-y-2">
                <Label className="font-medium">Vendors</Label>
                <div className="ml-6 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={permissions.vendors.read}
                      onCheckedChange={() => toggleModulePermission("vendors", "read")}
                    />
                    <Label>Read</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={permissions.vendors.write}
                      onCheckedChange={() => toggleModulePermission("vendors", "write")}
                    />
                    <Label>Write (Create/Edit)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={permissions.vendors.delete}
                      onCheckedChange={() => toggleModulePermission("vendors", "delete")}
                    />
                    <Label>Delete</Label>
                  </div>
                </div>
              </div>

              {/* Clients */}
              <div className="space-y-2">
                <Label className="font-medium">Clients</Label>
                <div className="ml-6 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={permissions.clients.read}
                      onCheckedChange={() => toggleModulePermission("clients", "read")}
                    />
                    <Label>Read</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={permissions.clients.write}
                      onCheckedChange={() => toggleModulePermission("clients", "write")}
                    />
                    <Label>Write (Create/Edit)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={permissions.clients.delete}
                      onCheckedChange={() => toggleModulePermission("clients", "delete")}
                    />
                    <Label>Delete</Label>
                  </div>
                </div>
              </div>

              {/* Queries */}
              <div className="space-y-2">
                <Label className="font-medium">Queries</Label>
                <div className="ml-6 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={permissions.queries.read}
                      onCheckedChange={() => toggleModulePermission("queries", "read")}
                    />
                    <Label>Read</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={permissions.queries.write}
                      onCheckedChange={() => toggleModulePermission("queries", "write")}
                    />
                    <Label>Write (Create/Edit)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={permissions.queries.delete}
                      onCheckedChange={() => toggleModulePermission("queries", "delete")}
                    />
                    <Label>Delete</Label>
                  </div>
                </div>
              </div>

              {/* Expenses */}
              <div className="space-y-2">
                <Label className="font-medium">Expenses</Label>
                <div className="ml-6 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={permissions.expenses.read}
                      onCheckedChange={() => toggleModulePermission("expenses", "read")}
                    />
                    <Label>Read</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={permissions.expenses.write}
                      onCheckedChange={() => toggleModulePermission("expenses", "write")}
                    />
                    <Label>Write (Create/Edit)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={permissions.expenses.delete}
                      onCheckedChange={() => toggleModulePermission("expenses", "delete")}
                    />
                    <Label>Delete</Label>
                  </div>
                </div>
              </div>

              {/* Invoices */}
              <div className="space-y-2">
                <Label className="font-medium">Invoices</Label>
                <div className="ml-6 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={permissions.invoices.read}
                      onCheckedChange={() => toggleModulePermission("invoices", "read")}
                    />
                    <Label>Read</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={permissions.invoices.write}
                      onCheckedChange={() => toggleModulePermission("invoices", "write")}
                    />
                    <Label>Write (Create)</Label>
                  </div>
                </div>
              </div>

              {/* Reports */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={permissions.reports.read}
                  onCheckedChange={() => toggleModulePermission("reports", "read")}
                />
                <Label>Reports</Label>
              </div>

              {/* Settings */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={permissions.settings}
                  onCheckedChange={() => toggleModulePermission("settings")}
                />
                <Label>Settings</Label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createSubUser.isPending}>
              {createSubUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Sub User
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
