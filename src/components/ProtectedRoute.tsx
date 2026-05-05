import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function ProtectedRoute({ children, requireMaster = false }: { children: React.ReactNode; requireMaster?: boolean }) {
  const { user, isMaster, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (requireMaster && !isMaster) return <Navigate to="/" replace />;
  return <>{children}</>;
}
