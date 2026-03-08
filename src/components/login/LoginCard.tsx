import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Loader2, Sparkles } from "lucide-react";

interface LoginCardProps {
  onSubmit: (email: string, password: string) => Promise<{ error: Error | null }>;
  onSuccess: () => void;
}

const LoginCard: React.FC<LoginCardProps> = ({ onSubmit, onSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await onSubmit(email, password);
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(onSuccess, 1200);
    }
  };

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {!success ? (
          <motion.div
            key="card"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-sm"
          >
            <div
              className="rounded-2xl p-8 space-y-7"
              style={{
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: error
                  ? "0 0 30px rgba(255,80,80,0.15), inset 0 0 30px rgba(255,80,80,0.05)"
                  : "0 8px 32px rgba(0,0,0,0.4)",
                transition: "box-shadow 0.4s ease",
              }}
            >
              {/* Logo */}
              <div className="flex flex-col items-center gap-3">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{
                    background:
                      "linear-gradient(135deg, hsla(140,70%,45%,0.2), hsla(270,50%,55%,0.2))",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <Heart className="h-7 w-7" style={{ color: "hsl(160,60%,60%)" }} fill="currentColor" />
                </div>
                <h1 className="text-xl font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>
                  ChatRoom
                </h1>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Your private space
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-12 rounded-xl px-4 text-sm outline-none transition-all duration-300 placeholder:text-white/30"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.9)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "hsla(160,60%,50%,0.5)";
                    e.currentTarget.style.boxShadow = "0 0 20px hsla(160,60%,50%,0.1)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-12 rounded-xl px-4 text-sm outline-none transition-all duration-300 placeholder:text-white/30"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.9)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "hsla(160,60%,50%,0.5)";
                    e.currentTarget.style.boxShadow = "0 0 20px hsla(160,60%,50%,0.1)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />

                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-sm text-center"
                      style={{ color: "hsl(0,70%,65%)" }}
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(140,70%,40%), hsl(170,60%,45%), hsl(270,50%,50%))",
                    color: "white",
                    boxShadow: "0 4px 20px hsla(160,60%,40%,0.3)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 4px 30px hsla(160,60%,40%,0.5)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "0 4px 20px hsla(160,60%,40%,0.3)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Sign In
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                Only for the two of us 💕
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3"
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6 }}
            >
              <Heart className="h-12 w-12" style={{ color: "hsl(160,60%,60%)" }} fill="currentColor" />
            </motion.div>
            <p className="text-lg font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>
              Welcome back ✨
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LoginCard;
