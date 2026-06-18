import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWrappedData } from "@/hooks/useWrappedData";
import { yearsTogether, ordinal } from "@/lib/anniversary";
import { FloatingHearts } from "@/components/wrapped/wrappedAnim";
import WrappedStory from "@/components/wrapped/WrappedStory";

const Wrapped: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <WrappedView userId={user.id} />;
};

const WrappedView: React.FC<{ userId: string }> = ({ userId }) => {
  const navigate = useNavigate();
  const { data, loading, error } = useWrappedData(userId);
  const years = yearsTogether();

  const close = () => navigate("/home");

  // Beautiful themed loader (loading the year of memories).
  if (loading) {
    return (
      <div
        className="relative flex h-dvh flex-col items-center justify-center overflow-hidden"
        style={{ background: "linear-gradient(160deg, #1e1b4b 0%, #4c1d95 55%, #831843 100%)" }}
      >
        <FloatingHearts emoji="💞" count={16} />
        <motion.div
          animate={{ scale: [1, 1.18, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="text-6xl z-10"
        >
          💞
        </motion.div>
        <p className="text-white/80 text-base mt-6 z-10 font-semibold">
          {years >= 1 ? `Wrapping up your ${ordinal(years)} year…` : "Wrapping up your year…"}
        </p>
        <p className="text-white/50 text-xs mt-2 z-10">gathering a year of memories</p>
      </div>
    );
  }

  if (error || !data || data.totalMessages === 0) {
    return (
      <div
        className="relative flex h-dvh flex-col items-center justify-center overflow-hidden px-8 text-center"
        style={{ background: "linear-gradient(160deg, #1e1b4b 0%, #4c1d95 100%)" }}
      >
        <div className="text-5xl mb-4 z-10">🌙</div>
        <p className="text-white/90 text-lg font-semibold z-10">Not enough memories yet</p>
        <p className="text-white/60 text-sm mt-2 z-10 max-w-xs">
          Keep chatting — your Wrapped will be ready to celebrate your year together.
        </p>
        <button onClick={close} className="mt-8 px-6 h-11 rounded-2xl bg-white/15 text-white font-semibold text-sm z-10">
          Back home
        </button>
      </div>
    );
  }

  return <WrappedStory data={data} onClose={close} />;
};

export default Wrapped;
