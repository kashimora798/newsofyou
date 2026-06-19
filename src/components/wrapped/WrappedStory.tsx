import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { WrappedData } from "@/hooks/useWrappedData";
import { yearsTogether } from "@/lib/anniversary";
import {
  IntroCard, TotalCard, BusyDayCard, NightOwlCard, WordsCard,
  LoveCard, EmojiCard, GamesCard, FirstMessageCard, FinaleCard,
  SecretGardenCard, ComplimentCard, StreakCard, BookmarkCard, MilestoneCard
} from "./WrappedCards";

interface Props {
  data: WrappedData;
  onClose: () => void;
}

const AUTO_MS = 6000; // each card auto-advances after this

const WrappedStory: React.FC<Props> = ({ data, onClose }) => {
  const years = useMemo(() => yearsTogether(), []);

  // Build the card list, skipping ones with no data so it never feels empty.
  const cards = useMemo(() => {
    const list: React.ReactNode[] = [];
    list.push(<IntroCard data={data} years={years} />);
    if (data.totalMessages > 0) list.push(<TotalCard data={data} years={years} />);
    if (data.busiestDay) list.push(<BusyDayCard data={data} years={years} />);
    if (data.nightOwlCount > 0) list.push(<NightOwlCard data={data} years={years} />);
    if (data.topWords.length > 0) list.push(<WordsCard data={data} years={years} />);
    if (data.loveCount > 0) list.push(<LoveCard data={data} years={years} />);
    if (data.topEmoji) list.push(<EmojiCard data={data} years={years} />);
    if (data.gamesPlayed > 0) list.push(<GamesCard data={data} years={years} />);
    if (data.firstMessage) list.push(<FirstMessageCard data={data} years={years} />);
    
    // New Intimate Slides
    // if (data.forestCount > 0) list.push(<SecretGardenCard data={data} years={years} />);
    if (data.randomCompliment) list.push(<ComplimentCard data={data} years={years} />);
    if (data.longestStreak > 0) list.push(<StreakCard data={data} years={years} />);
    if (data.randomBookmark) list.push(<BookmarkCard data={data} years={years} />);
    if (data.daysTogether > 0) list.push(<MilestoneCard data={data} years={years} />);
    // Finale is appended below (needs handlers).
    return list;
  }, [data, years]);

  const total = cards.length + 1; // +1 for finale
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const progRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (next: number) => {
      if (next < 0) return;
      if (next >= total) {
        onClose();
        return;
      }
      setIndex(next);
    },
    [total, onClose]
  );

  const replay = useCallback(() => setIndex(0), []);

  // Auto-advance timer (paused while finger is down).
  useEffect(() => {
    if (paused) return;
    // Don't auto-advance off the finale.
    if (index >= total - 1) return;
    timerRef.current = setTimeout(() => setIndex((i) => Math.min(i + 1, total - 1)), AUTO_MS);
    return () => clearTimeout(timerRef.current);
  }, [index, paused, total]);

  const isFinale = index === total - 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black select-none"
    >
      {/* Progress bars */}
      <div ref={progRef} className="absolute top-0 left-0 right-0 z-30 flex gap-1 px-3 pt-3">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex-1 h-[3px] rounded-full bg-white/25 overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              initial={false}
              animate={{ width: i < index ? "100%" : i === index ? "100%" : "0%" }}
              transition={
                i === index && !paused && !isFinale
                  ? { duration: AUTO_MS / 1000, ease: "linear" }
                  : { duration: 0.2 }
              }
              style={i === index ? undefined : undefined}
            />
          </div>
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-40 h-9 w-9 rounded-full bg-black/30 backdrop-blur flex items-center justify-center"
        style={{ marginTop: 8 }}
      >
        <X className="h-4 w-4 text-white" />
      </button>

      {/* Card stage */}
      <div className="absolute inset-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.4}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120) onClose();
            }}
          >
            {isFinale ? (
              <FinaleCard data={data} years={years} onReplay={replay} onClose={onClose} />
            ) : (
              cards[index]
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Tap zones (left = back, right = forward). Disabled on finale so its buttons work. */}
      {!isFinale && (
        <div className="absolute inset-0 z-20 flex">
          <button
            aria-label="Previous"
            className="w-1/3 h-full"
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onClick={() => go(index - 1)}
          />
          <button
            aria-label="Pause"
            className="w-1/3 h-full"
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
          />
          <button
            aria-label="Next"
            className="w-1/3 h-full"
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onClick={() => go(index + 1)}
          />
        </div>
      )}
    </motion.div>
  );
};

export default WrappedStory;
