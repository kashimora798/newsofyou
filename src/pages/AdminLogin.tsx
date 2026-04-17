import React, { useMemo, useState, useEffect } from "react";
import { Navigate, Link, useNavigate, useLocation } from "react-router-dom";
import { Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AdminLogin: React.FC = () => {
  const { user, loading: authLoading, signIn, signOut } = useAuth();
  const { role, loading: roleLoading } = useUserRole(user?.id);
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [invalidUser, setInvalidUser] = useState(new URLSearchParams(location.search).get("invalid") === "1");
  const [attemptsRemaining, setAttemptsRemaining] = useState(() => {
    const usedAttempts = Number(sessionStorage.getItem("invalidAttempts") ?? "0");
    return Math.max(5 - usedAttempts, 0);
  });
  const [authError, setAuthError] = useState("");

  const subtitle = useMemo(() => {
    if (!invalidUser) return "Authorized school access only";
    return `Invalid user - attempts remaining: ${attemptsRemaining}`;
  }, [invalidUser, attemptsRemaining]);

  useEffect(() => {
    const hasInvalidParam = new URLSearchParams(location.search).get("invalid") === "1";
    setInvalidUser(hasInvalidParam);
    if (hasInvalidParam) {
      const usedAttempts = Number(sessionStorage.getItem("invalidAttempts") ?? "0");
      setAttemptsRemaining(Math.max(5 - usedAttempts, 0));
    }
  }, [location.search]);

  if (authLoading || (user && roleLoading)) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-slate-700" />
      </div>
    );
  }

  if (user && role === "partner") return <Navigate to="/chat" replace />;
  if (user && role !== "partner") return <Navigate to="/you/dashboard" replace />;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setInvalidUser(false);
    setAuthError("");

    const result = await signIn(email, password);
    if (result.error) {
      if (result.error.message === "INVALID_USER") {
        setInvalidUser(true);
        const usedAttempts = Number(sessionStorage.getItem("invalidAttempts") ?? "0");
        setAttemptsRemaining(Math.max(5 - usedAttempts, 0));
      } else {
        setAuthError(result.error.message);
      }
      setLoading(false);
      return;
    }

    const currentUser = (await supabase.auth.getUser()).data.user;
    if (!currentUser?.id) {
      await signOut();
      setAuthError("Unable to verify account. Please try again.");
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("id", currentUser.id)
      .maybeSingle();

    sessionStorage.removeItem("invalidUser");
    sessionStorage.removeItem("invalidAttempts");

    if ((data as { role?: string } | null)?.role === "partner") {
      navigate("/chat", { replace: true });
      return;
    }

    navigate("/you/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Website
        </Link>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Admin Login</CardTitle>
            <CardDescription>{invalidUser ? subtitle : "Sign in to manage school content"}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@school.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              {invalidUser && <p className="text-sm text-destructive">{subtitle}</p>}
              {authError && !invalidUser && <p className="text-sm text-destructive">{authError}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;