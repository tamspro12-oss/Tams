import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSubUsers } from "@/hooks/useSubUsers";
import { CreateSubUserDialog } from "./CreateSubUserDialog";
import { UserPlus, Edit, Trash2, Shield } from "lucide-react";
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

export const SubUserManagement = () => {
  const { subUsers, subUserCount, deleteSubUser, isLoading } = useSubUsers();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSubUserId, setSelectedSubUserId] = useState<string | null>(null);

  const handleDelete = () => {
    if (selectedSubUserId) {
      deleteSubUser.mutate(selectedSubUserId);
      setDeleteDialogOpen(false);
      setSelectedSubUserId(null);
    }
  };

  const getPermissionSummary = (permissions: any) => {
    const enabled = [];
    if (permissions.dashboard) enabled.push("Dashboard");
    if (permissions.bookings?.read) enabled.push("Bookings");
    if (permissions.vendors?.read) enabled.push("Vendors");
    if (permissions.clients?.read) enabled.push("Clients");
    if (permissions.reports?.read) enabled.push("Reports");
    if (permissions.settings) enabled.push("Settings");
    return enabled.join(", ") || "No permissions";
  };

  if (isLoading) {
    return <div>Loading sub users...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Sub Users ({subUserCount}/2 used)
              </CardTitle>
              <CardDescription>Manage sub user accounts with limited permissions</CardDescription>
            </div>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              disabled={subUserCount >= 2}
              size="sm"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Create Sub User
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {subUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No sub users created yet.</p>
              <p className="text-sm mt-2">Create up to 2 sub users with custom permissions.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {subUsers.map((subUser) => (
                <div
                  key={subUser.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{subUser.sub_id_code}</Badge>
                        {!subUser.is_active && <Badge variant="destructive">Inactive</Badge>}
                      </div>
                      <p className="font-medium">{subUser.profiles?.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {subUser.agencies?.name}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedSubUserId(subUser.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="text-sm">
                    <p className="text-muted-foreground mb-1">Permissions:</p>
                    <p className="text-xs">{getPermissionSummary(subUser.permissions)}</p>
                  </div>

                  {subUser.last_login && (
                    <p className="text-xs text-muted-foreground">
                      Last login: {new Date(subUser.last_login).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-4">
            📝 Note: Maximum 2 Sub Users allowed per account
          </p>
        </CardContent>
      </Card>

      <CreateSubUserDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sub User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this sub user? This action cannot be undone and will
              permanently remove their account and access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
