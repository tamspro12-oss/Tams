import { ReactNode } from "react";
import { useUserPermissions } from "@/hooks/useUserPermissions";

interface PermissionGateProps {
  module: string;
  action?: "read" | "write" | "delete";
  children: ReactNode;
  fallback?: ReactNode;
}

export const PermissionGate = ({
  module,
  action = "read",
  children,
  fallback = null,
}: PermissionGateProps) => {
  const { hasActionPermission, isLoading } = useUserPermissions();

  if (isLoading) return null;

  const hasPermission = hasActionPermission(module, action);

  return hasPermission ? <>{children}</> : <>{fallback}</>;
};
