import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Lantern {
  id: string;
  message: string;
  x: number;
  startTime: number;
  senderName: string;
}

interface SkyLanternsProps {
  userId: string | undefined;
  partnerUserId: string | undefined;
  currentUserName: string;
}

const SkyLanterns: React.FC<SkyLanternsProps> = ({ userId, partnerUserId, currentUserName }) => {
  const [lanterns, setLanterns] = useState<Lantern[]>([]);
  const [tappedId, setTappedId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [inputMsg, setInputMsg] = useState("");

  // Listen for incoming lanterns via realtime
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("sky-lanterns")
      .on("broadcast", { event: "lantern" }, (payload) => {
        const data = payload.payload as Lantern;
        if (data.id) {
          setLanterns((prev) => [...prev, { ...data, startTime: Date.now() }]);
          // Auto-remove after float animation
          setTimeout(() => setLanterns((prev) => prev.filter((l) => l.id !== data.id)), 12000);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const releaseLantern = useCallback(async () => {
    if (!userId) return;
    const msg = inputMsg.trim().slice(0, 20);
    const lantern: Lantern = {
      id: `${Date.now()}-${Math.random()}`,
      message: msg || "💛",
      x: 20 + Math.random() * 60,
      startTime: Date.now(),
      senderName: currentUserName,
    };

    // Show locally
    setLanterns((prev) => [...prev, lantern]);
    setTimeout(() => setLanterns((prev) => prev.filter((l) => l.id !== lantern.id)), 12000);

    // Broadcast to partner
    await supabase.channel("sky-lanterns").send({
      type: "broadcast",
      event: "lantern",
      payload: lantern,
    });

    setInputMsg("");
    setShowComposer(false);
  }, [userId, inputMsg, currentUserName]);

  return (
    <>
      {/* Floating lanterns */}
      {lanterns.map((l) => (
        <div
          key={l.id}
          className="absolute pointer-events-auto cursor-pointer"
          style={{
            left: `${l.x}%`,
            bottom: "10%",
            animation: "lanternFloat 12s ease-out forwards",
            zIndex: 6,
          }}
          onPointerDown={() => setTappedId(tappedId === l.id ? null : l.id)}
        >
          {/* Lantern body */}
          <div style={{
            width: 28,
            height: 36,
            background: "radial-gradient(ellipse at center, rgba(255,200,80,0.95), rgba(255,160,40,0.8))",
            borderRadius: "50% 50% 45% 45%",
            boxShadow: "0 0 20px 8px rgba(255,180,60,0.4), 0 0 40px 16px rgba(255,150,30,0.15)",
            position: "relative",
          }}>
            {/* Inner glow */}
            <div style={{
              position: "absolute",
              inset: 4,
              background: "radial-gradient(circle, rgba(255,255,200,0.8), transparent)",
              borderRadius: "50%",
              animation: "lanternFlicker 2s ease-in-out infinite alternate",
            }} />
          </div>
          {/* Warm trail below */}
          <div style={{
            width: 8,
            height: 20,
            margin: "0 auto",
            background: "linear-gradient(to bottom, rgba(255,180,60,0.3), transparent)",
            borderRadius: "0 0 50% 50%",
          }} />

          {/* Message tooltip */}
          {tappedId === l.id && l.message && (
            <div
              className="absolute whitespace-nowrap text-xs font-medium px-2 py-1 rounded-full"
              style={{
                top: -28,
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(0,0,0,0.6)",
                color: "white",
                animation: "fadeIn 0.2s ease-out",
              }}
            >
              {l.message} — {l.senderName}
            </div>
          )}
        </div>
      ))}

      {/* Release button */}
      <div
        className="absolute bottom-20 right-3 z-10 pointer-events-auto"
      >
        {showComposer ? (
          <div
            className="flex flex-col items-end gap-1.5 p-2 rounded-xl"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
          >
            <input
              type="text"
              maxLength={20}
              placeholder="Message (20 chars)"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              className="text-xs px-2 py-1 rounded-md bg-white/20 text-white placeholder:text-white/50 outline-none w-36"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && releaseLantern()}
            />
            <div className="flex gap-1.5">
              <button
                onClick={() => setShowComposer(false)}
                className="text-xs text-white/60 px-2 py-0.5"
              >
                Cancel
              </button>
              <button
                onClick={releaseLantern}
                className="text-xs bg-amber-500/80 text-white px-2 py-0.5 rounded-md"
              >
                Release 🏮
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowComposer(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
            style={{
              background: "rgba(255,180,60,0.3)",
              backdropFilter: "blur(4px)",
              border: "1px solid rgba(255,180,60,0.4)",
            }}
            title="Release a sky lantern"
          >
            🏮
          </button>
        )}
      </div>

      <style>{`
        @keyframes lanternFloat {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          5% { opacity: 1; }
          70% { opacity: 0.9; }
          100% { transform: translateY(-90vh) scale(0.5); opacity: 0; }
        }
        @keyframes lanternFlicker {
          0% { opacity: 0.7; }
          100% { opacity: 1; }
        }
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
    </>
  );
};

export default SkyLanterns;
