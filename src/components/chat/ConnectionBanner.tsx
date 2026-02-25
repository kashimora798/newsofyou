import React, { useState, useEffect } from "react";
import { Wifi, WifiOff } from "lucide-react";

const ConnectionBanner: React.FC = () => {
  const [online, setOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };
    const handleOffline = () => {
      setOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online && !showReconnected) return null;

  return (
    <div
      className={`flex items-center justify-center gap-2 py-1.5 px-4 text-xs font-medium transition-all ${
        online
          ? "bg-online/20 text-green-700 dark:text-green-400"
          : "bg-destructive/20 text-destructive"
      }`}
    >
      {online ? (
        <>
          <Wifi className="h-3.5 w-3.5" />
          Reconnected
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          No connection — messages will send when you're back online
        </>
      )}
    </div>
  );
};

export default ConnectionBanner;
