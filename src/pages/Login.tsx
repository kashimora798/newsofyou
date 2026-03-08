import React, { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AuroraBackground from "@/components/login/AuroraBackground";
import LoginCard from "@/components/login/LoginCard";

const Login: React.FC = () => {
  const { user, signIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [auroraIntensity, setAuroraIntensity] = useState(1);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#050510" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(160,60%,60%)" }} />
      </div>
    );
  }

  if (user) return <Navigate to="/home" replace />;

  const handleSuccess = () => {
    setAuroraIntensity(3);
    setTimeout(() => navigate("/home", { replace: true }), 100);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AuroraBackground intensity={auroraIntensity} />
      <LoginCard onSubmit={signIn} onSuccess={handleSuccess} />
    </div>
  );
};

export default Login;
