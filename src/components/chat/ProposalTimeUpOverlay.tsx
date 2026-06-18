import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface ProposalTimeUpOverlayProps {
  title: string;
  onDismiss: () => void;
}

/**
 * Gentle, dismissible "time's up" overlay shown when a time-limit pact ends.
 * Soft by design — it never blocks the chat, just nudges.
 */
const ProposalTimeUpOverlay: React.FC<ProposalTimeUpOverlayProps> = ({ title, onDismiss }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
    onClick={onDismiss}
  >
    <motion.div
      initial={{ scale: 0.9, y: 10 }}
      animate={{ scale: 1, y: 0 }}
      className="mx-6 max-w-xs rounded-2xl bg-card p-6 text-center shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-4xl">💤</div>
      <h3 className="mt-3 text-base font-semibold text-foreground">Time's up</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Your “{title}” window just ended. Carry on whenever you like 💞
      </p>
      <Button onClick={onDismiss} className="mt-4 w-full">Okay</Button>
    </motion.div>
  </motion.div>
);

export default ProposalTimeUpOverlay;
