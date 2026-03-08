import React, { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

const OfflineBanner: React.FC = () => {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline && !showReconnected) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 py-2 px-4 text-xs font-semibold transition-all duration-300 ${
        offline
          ? "bg-destructive text-destructive-foreground"
          : "bg-online text-primary-foreground"
      }`}
    >
      {offline ? (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          <span>You're offline — some features may be limited</span>
        </>
      ) : (
        <span>Back online ✓</span>
      )}
    </div>
  );
};

export default OfflineBanner;
