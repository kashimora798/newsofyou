import React, { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import AuroraBackground from "@/components/login/AuroraBackground";
import LoginCard from "@/components/login/LoginCard";

const Login: React.FC = () => {
  const { user, signIn, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole(user?.id);
  const navigate = useNavigate();
  const [auroraIntensity, setAuroraIntensity] = useState(1);
  const [invalidUser, setInvalidUser] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);

  const handleSubmit = useCallback(async (email: string, password: string) => {
    const result = await signIn(email, password);
    const isInvalid = result.error?.message === "INVALID_USER";

    if (isInvalid) {
      setInvalidUser(true);
      setAttemptsRemaining((prev) => Math.max(prev - 1, 0));
      return { error: new Error("INVALID_USER") };
    }

    if (!result.error) {
      setInvalidUser(false);
      setAttemptsRemaining(5);
    }

    return result;
  }, [signIn]);

  if (authLoading || (user && roleLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#050510" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(160,60%,60%)" }} />
      </div>
    );
  }

  if (user) return <Navigate to={role === "partner" ? "/home" : "/you/dashboard"} replace />;

  const handleSuccess = () => {
    setAuroraIntensity(3);
    setTimeout(() => navigate("/home", { replace: true }), 100);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AuroraBackground intensity={auroraIntensity} />
      <LoginCard
        onSubmit={handleSubmit}
        onSuccess={handleSuccess}
        invalidUser={invalidUser}
        attemptsRemaining={attemptsRemaining}
      />
    </div>
  );
};

export default Login;
