/**
 * Forest.tsx — /forest route
 * The Bond Tree: one central tree that grows with your message count.
 * Inspired by eztree.dev's cinematic simulation.
 */

import { useCallback, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useForestData } from "@/hooks/useForestData";
import { useIsMobile } from "@/hooks/use-mobile";
import ForestCanvas from "@/components/forest/ForestCanvas";
import { ForestLoading } from "@/components/forest/ForestHUD";
import BondTreeHUD from "@/components/forest/BondTreeHUD";

export default function Forest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { totalMessages, loading, error } = useForestData(user?.id);
  const [isMuted, setIsMuted] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Autoplay handler following browser compatibility guidelines
  useEffect(() => {
    if (!loading && audioRef.current) {
      // Try playing immediately
      audioRef.current.play()
        .then(() => {
          if (audioRef.current) {
            audioRef.current.muted = false;
            setIsMuted(false);
          }
        })
        .catch(() => {
          // If browser autoplay protection blocks it, wait for first click/touch
          const handleUserInteraction = () => {
            if (audioRef.current) {
              audioRef.current.play()
                .then(() => {
                  if (audioRef.current) {
                    audioRef.current.muted = false;
                    setIsMuted(false);
                  }
                })
                .catch((err) => console.log("Interaction play failed:", err));
            }
            window.removeEventListener("click", handleUserInteraction);
            window.removeEventListener("touchstart", handleUserInteraction);
          };
          window.addEventListener("click", handleUserInteraction);
          window.addEventListener("touchstart", handleUserInteraction);
        });
    }
  }, [loading]);

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.play().catch((err) => console.log("Audio play failed:", err));
        audioRef.current.muted = false;
        setIsMuted(false);
      } else {
        audioRef.current.muted = true;
        setIsMuted(true);
      }
    }
  }, [isMuted]);

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  if (error) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0e1a0e] flex-col gap-3">
        <span className="text-4xl">🌵</span>
        <p className="text-white/60 text-sm">Forest couldn't grow: {error}</p>
        <button onClick={handleBack} className="text-green-400 text-sm underline mt-2">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-dvh overflow-hidden bg-[#0d1b2e]">
      {/* Audio element with MPEG source support */}
      <audio ref={audioRef} loop muted>
        <source src="/audio/ambience.mp3" type="audio/mpeg" />
      </audio>

      {/* Loading overlay */}
      {loading && <ForestLoading />}

      {/* 3D World */}
      {!loading && (
        <ForestCanvas
          totalMessages={totalMessages}
          isMobile={!!isMobile}
        />
      )}

      {/* HUD overlay */}
      {!loading && (
        <BondTreeHUD
          totalMessages={totalMessages}
          onBack={handleBack}
        />
      )}

      {/* Audio toggle button */}
      {!loading && (
        <button
          onClick={toggleMute}
          className="absolute top-4 right-4 z-20 flex items-center justify-center rounded-full p-2.5 text-white shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
          style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(10px)" }}
        >
          {isMuted ? <VolumeX className="h-4 w-4 text-white/70" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
        </button>
      )}
    </div>
  );
}
