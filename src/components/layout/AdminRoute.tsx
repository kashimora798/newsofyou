import React from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

interface AdminRouteProps {
  children: React.ReactNode;
  allowNonAdmin?: boolean;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children, allowNonAdmin = false }) => {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole(user?.id);

  if (authLoading || roleLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/you/login" replace />;
  if (allowNonAdmin) return <>{children}</>;
  if (role !== "admin") return <Navigate to="/you/login" replace />;

  return <>{children}</>;
};

export default AdminRoute;