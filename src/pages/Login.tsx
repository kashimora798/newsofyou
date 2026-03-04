import React, { useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import RedString from "@/components/login/RedString";
import PulsePoint from "@/components/login/PulsePoint";
import LoginTransition from "@/components/login/LoginTransition";

type Phase = "ambient" | "reveal" | "pull";

const Login: React.FC = () => {
  const { user, signIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>("ambient");
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [formVisible, setFormVisible] = useState(false);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  }, []);

  const handlePulseTap = useCallback(() => {
    setPhase("reveal");
    setTimeout(() => setFormVisible(true), 600);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: session } = await supabase.auth.getSession();
      if (session?.session) {
        const { data } = await supabase
          .from("user_status")
          .select("is_online")
          .neq("user_id", session.session.user.id)
          .limit(1)
          .single();
        if (data?.is_online) setPartnerOnline(true);
      }
    } catch {}

    setLoading(false);
    setPhase("pull");
    setTransitioning(true);
  };

  const handleTransitionComplete = useCallback(() => {
    navigate("/home");
  }, [navigate]);

  // Early returns AFTER all hooks
  if (!authLoading && user) return <Navigate to="/home" replace />;

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#000" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#cc1133" }} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      className="relative min-h-screen w-full overflow-hidden select-none"
      style={{ background: "#000" }}
    >
      {/* The Red String */}
      <RedString
        phase={phase}
        mousePos={mousePos}
        intensity={partnerOnline ? 0.9 : transitioning ? 1 : phase === "reveal" ? 0.6 : 0.35}
      />

      {/* Pulse Point (Phase 1 only) */}
      <PulsePoint onClick={handlePulseTap} visible={phase === "ambient"} />

      {/* Login Form (Phase 2) */}
      {phase === "reveal" && (
        <div
          className={`absolute inset-0 z-30 flex items-center justify-center px-6 transition-all duration-1000 ${
            formVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-5">
            <p
              className="text-center text-xs tracking-[0.4em] uppercase mb-8 opacity-50"
              style={{ color: "#cc3344", fontFamily: "'Quicksand', sans-serif" }}
            >
              our space
            </p>

            <Input
              type="email"
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-12 rounded-xl border bg-transparent text-sm tracking-wide placeholder:opacity-40 focus-visible:ring-1"
              style={{
                borderColor: "rgba(200,20,40,0.3)",
                color: "#eee",
                caretColor: "#cc3344",
              }}
            />

            <Input
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-12 rounded-xl border bg-transparent text-sm tracking-wide placeholder:opacity-40 focus-visible:ring-1"
              style={{
                borderColor: "rgba(200,20,40,0.3)",
                color: "#eee",
                caretColor: "#cc3344",
              }}
            />

            {error && (
              <p className="text-xs text-center" style={{ color: "#ff4455" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl text-xs tracking-[0.3em] uppercase font-medium transition-all duration-500 hover:shadow-lg disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #991122, #cc1133)",
                color: "#fff",
                boxShadow: "0 0 30px rgba(200,20,40,0.2)",
                fontFamily: "'Quicksand', sans-serif",
              }}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              ) : (
                "enter"
              )}
            </button>

            <p className="text-center text-[10px] opacity-30" style={{ color: "#cc3344" }}>
              only for us 💕
            </p>
          </form>
        </div>
      )}

      {/* Transition Animation (Phase 3) */}
      <LoginTransition
        active={transitioning}
        partnerOnline={partnerOnline}
        onComplete={handleTransitionComplete}
      />

      {/* Subtle ambient particles */}
      {phase === "ambient" && (
        <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 2 + i * 0.5,
                height: 2 + i * 0.5,
                background: "#cc1133",
                opacity: 0.15 + i * 0.03,
                left: `${15 + i * 12}%`,
                top: `${25 + i * 8}%`,
                animation: `float-particle ${6 + i * 0.8}s ease-in-out infinite`,
                animationDelay: `${i * 1.3}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Login;
