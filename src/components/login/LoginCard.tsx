import React, { useState } from "react";
import { Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginCardProps {
  onSubmit: (email: string, password: string) => Promise<{ error: Error | null }>;
  onSuccess: () => void;
  invalidUser?: boolean;
  attemptsRemaining?: number;
}

const LoginCard: React.FC<LoginCardProps> = ({ onSubmit, onSuccess, invalidUser = false, attemptsRemaining = 5 }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await onSubmit(email, password);
    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    onSuccess();
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
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Chatroom Login</CardTitle>
            <CardDescription>
              {invalidUser ? "Invalid user" : "Sign in to continue to private chat"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
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
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{invalidUser ? "Invalid user" : error}</p>
              )}

              {invalidUser && (
                <p className="text-xs text-center text-destructive/80">Attempts remaining: {attemptsRemaining}</p>
              )}

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

export default LoginCard;
