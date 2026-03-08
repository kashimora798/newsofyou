import React from "react";
import { WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

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

  return (
    <AnimatePresence>
      {(offline || showReconnected) && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 py-2 px-4 text-xs font-semibold ${
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
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineBanner;
