import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SubUserPermissions {
  dashboard: boolean;
  bookings: { read: boolean; write: boolean; delete: boolean };
  vendors: { read: boolean; write: boolean; delete: boolean };
  clients: { read: boolean; write: boolean; delete: boolean };
  queries: { read: boolean; write: boolean; delete: boolean };
  expenses: { read: boolean; write: boolean; delete: boolean };
  reports: { read: boolean };
  invoices: { read: boolean; write: boolean };
  settings: boolean;
}

export interface SubUser {
  id: string;
  user_id: string;
  main_user_id: string;
  agency_id: string;
  sub_id_code: string;
  permissions: SubUserPermissions;
  is_active: boolean;
  last_login: string | null;
  last_activity: string | null;
  created_at: string;
  profiles?: { full_name: string };
  agencies?: { name: string };
}

export function useSubUsers() {
  const queryClient = useQueryClient();

  const { data: subUsers, isLoading } = useQuery({
    queryKey: ["sub-users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-sub-users", {
        body: { action: "list" },
      });

      if (error) throw error;
      return data.sub_users as SubUser[];
    },
  });

  const { data: subUserCount } = useQuery({
    queryKey: ["sub-user-count"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-sub-users", {
        body: { action: "get-count" },
      });

      if (error) throw error;
      return data.count as number;
    },
  });

  const createSubUser = useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      full_name: string;
      permissions: SubUserPermissions;
      agency_id: string;
    }) => {
      const { data: result, error } = await supabase.functions.invoke("manage-sub-users", {
        body: { action: "create", data },
      });

      if (error) throw error;
      return result.sub_user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-users"] });
      queryClient.invalidateQueries({ queryKey: ["sub-user-count"] });
      toast.success("Sub user created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create sub user");
    },
  });

  const updateSubUser = useMutation({
    mutationFn: async ({
      sub_user_id,
      permissions,
      is_active,
    }: {
      sub_user_id: string;
      permissions?: SubUserPermissions;
      is_active?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("manage-sub-users", {
        body: {
          action: "update",
          sub_user_id,
          data: { permissions, is_active },
        },
      });

      if (error) throw error;
      return data.sub_user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-users"] });
      toast.success("Sub user updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update sub user");
    },
  });

  const deleteSubUser = useMutation({
    mutationFn: async (sub_user_id: string) => {
      const { error } = await supabase.functions.invoke("manage-sub-users", {
        body: { action: "delete", sub_user_id },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-users"] });
      queryClient.invalidateQueries({ queryKey: ["sub-user-count"] });
      toast.success("Sub user deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete sub user");
    },
  });

  return {
    subUsers: subUsers || [],
    subUserCount: subUserCount || 0,
    isLoading,
    createSubUser,
    updateSubUser,
    deleteSubUser,
  };
}
