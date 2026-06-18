/**
 * ForestHUD.tsx
 * Apple-style overlay UI for the forest:
 * - Back button (top-left)
 * - Stats pill (top-right)
 * - Message card bottom sheet (when element selected)
 * - Loading screen with sprouting sapling animation
 */

import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, TreePine, X, Heart, Clock } from "lucide-react";
import type { ForestNode } from "@/lib/forestParser";
import { formatDistanceToNow } from "date-fns";

const APPLE_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif";

const ELEMENT_LABELS: Record<string, string> = {
  oak: "Oak Tree 🌳",
  cherry: "Cherry Blossom 🌸",
  willow: "Willow Tree 🌿",
  pine: "Night Pine 🌲",
  redwood: "Ancient Redwood 🌲",
  sunflower: "Sunflower 🌻",
  wildflower: "Wildflower 🌸",
  mushroom: "Mushroom Ring 🍄",
  crystal: "Memory Crystal 💎",
  bush: "Berry Bush 🫐",
  fern: "Curious Fern 🌿",
  bamboo: "Laughing Bamboo 🎋",
};

const ELEMENT_DESCS: Record<string, string> = {
  oak: "A strong message that grew into something lasting.",
  cherry: "A love-filled message bloomed into cherry blossoms.",
  willow: "A message of longing, swaying gently in the breeze.",
  pine: "Sent in the quiet of night, glowing softly.",
  redwood: "A long, heartfelt message became an ancient giant.",
  sunflower: "Pure joy — turned into a sunflower facing the light.",
  wildflower: "A small, sweet message that sprouted quickly.",
  mushroom: "An apology that softly glows with sincerity.",
  crystal: "A shared moment — image or memory crystallized.",
  bush: "Emoji magic — grew into a colorful berry bush.",
  fern: "A curious question unfurled into delicate fronds.",
  bamboo: "Laughter so strong it made the bamboo dance.",
};

// ─── Loading Screen ───────────────────────────────────────────────────────────
export function ForestLoading() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#1a2e1a] to-[#0e1a0e] z-50"
      style={{ fontFamily: APPLE_FONT }}
    >
      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="text-7xl mb-6"
      >
        🌱
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[17px] font-semibold text-white/90"
      >
        Growing your forest…
      </motion.p>
      <p className="text-[13px] text-white/50 mt-1">Every message is becoming a tree</p>
    </div>
  );
}

// ─── Stats Pill ───────────────────────────────────────────────────────────────
function StatsPill({ total }: { total: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
      style={{
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <TreePine className="h-3.5 w-3.5 text-green-400" />
      <span className="text-[13px] font-semibold text-white/90 tabular-nums">
        {total.toLocaleString()}
      </span>
    </motion.div>
  );
}

// ─── Message Card ─────────────────────────────────────────────────────────────
function MessageCard({ node, onClose }: { node: ForestNode; onClose: () => void }) {
  const label = ELEMENT_LABELS[node.type] ?? "Forest Element";
  const desc = ELEMENT_DESCS[node.type] ?? "";
  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(node.createdAt), { addSuffix: true });
    } catch {
      return "some time ago";
    }
  })();

  const initial = (node.senderName || "?")[0].toUpperCase();
  const isMedia = !node.content || node.content.trim() === "";

  return (
    <motion.div
      initial={{ y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 340 }}
      className="absolute bottom-0 left-0 right-0 z-40 px-4 pb-8 pt-2"
      style={{ fontFamily: APPLE_FONT }}
    >
      <div
        className="rounded-[28px] overflow-hidden shadow-2xl"
        style={{
          background: "rgba(18, 18, 22, 0.88)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        <div className="px-5 pb-6 pt-2">
          {/* Element type badge */}
          <div className="flex items-center justify-between mb-4">
            <span
              className="text-[13px] font-semibold px-3 py-1 rounded-full"
              style={{ background: "rgba(100,200,100,0.15)", color: "#90e890" }}
            >
              {label}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <X className="h-4 w-4 text-white/70" />
            </button>
          </div>

          {/* Description */}
          <p className="text-[12px] text-white/45 italic mb-4">{desc}</p>

          {/* Message content */}
          <div
            className="rounded-[16px] p-4 mb-4"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            {isMedia ? (
              <p className="text-[14px] text-white/40 italic">
                📷 A media message — crystallized into the forest.
              </p>
            ) : (
              <p className="text-[15px] text-white/90 leading-relaxed">
                {node.content.length > 200 ? node.content.slice(0, 197) + "…" : node.content}
              </p>
            )}
          </div>

          {/* Sender + Time */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold text-white"
                style={{ background: "linear-gradient(135deg, #4ea84c, #2d6e3e)" }}
              >
                {initial}
              </div>
              <span className="text-[13px] font-medium text-white/70">{node.senderName}</span>
            </div>
            <div className="flex items-center gap-1 text-white/40">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-[12px]">{timeAgo}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── HUD Root ─────────────────────────────────────────────────────────────────
interface HUDProps {
  totalElements: number;
  selectedNode: ForestNode | null;
  onClearSelection: () => void;
  onBack: () => void;
}

export default function ForestHUD({ totalElements, selectedNode, onClearSelection, onBack }: HUDProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-30" style={{ fontFamily: APPLE_FONT }}>
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 pointer-events-auto">
        {/* Back */}
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-full"
          style={{
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <ArrowLeft className="h-4 w-4 text-white/90" />
          <span className="text-[13px] font-semibold text-white/90">Our Forest</span>
        </motion.button>

        <StatsPill total={totalElements} />
      </div>

      {/* Controls hint (bottom-left, fades after 4s) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5 }}
        exit={{ opacity: 0 }}
        className="absolute bottom-28 left-4 pointer-events-none"
      >
        <div
          className="px-3 py-2 rounded-2xl text-[11px] text-white/50 leading-relaxed"
          style={{
            background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          👆 Drag to walk • Tap a tree to read
        </div>
      </motion.div>

      {/* Message card */}
      <AnimatePresence>
        {selectedNode && (
          <div className="pointer-events-auto">
            <MessageCard node={selectedNode} onClose={onClearSelection} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
