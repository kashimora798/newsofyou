import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import {
  FONT_SIZES, JOURNAL_FONTS, type FontSizeKey, type JournalFontKey, type JournalFontPrefs,
} from "@/lib/journal";

interface Props {
  open: boolean;
  value: JournalFontPrefs;
  onChange: (patch: Partial<JournalFontPrefs>) => void;
  onClose: () => void;
}

/** Bottom sheet to pick the journal's handwriting + text size. Applies live. */
const FontPicker: React.FC<Props> = ({ open, value, onChange, onClose }) => (
  <AnimatePresence>
    {open && (
      <>
        <motion.div
          key="fp-backdrop" className="fixed inset-0 z-40 bg-black/30"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        />
        <motion.div
          key="fp-sheet"
          role="dialog" aria-label="Journal font"
          className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-4 pb-6 shadow-2xl"
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 320 }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-heading text-base font-bold text-foreground">Journal font ✍️</h3>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-muted p-1.5"><X className="h-4 w-4" /></button>
          </div>

          <div className="grid gap-2">
            {(Object.keys(JOURNAL_FONTS) as JournalFontKey[]).map((k) => {
              const f = JOURNAL_FONTS[k];
              const active = value.font === k;
              return (
                <button
                  key={k} type="button" onClick={() => onChange({ font: k })}
                  className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 text-left transition-colors ${active ? "border-primary bg-primary/10" : "border-border hover:bg-muted/60"}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-foreground" style={{ fontFamily: f.css, fontSize: 21, lineHeight: "26px" }}>
                      Good morning, love ♡
                    </span>
                    <span className="block text-[11px] text-muted-foreground">{f.label} · {f.note}</span>
                  </span>
                  {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>

          <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Text size</p>
          <div className="flex gap-2">
            {(Object.keys(FONT_SIZES) as FontSizeKey[]).map((k) => (
              <button
                key={k} type="button" onClick={() => onChange({ size: k })}
                className={`flex-1 rounded-full border px-3 py-1.5 text-xs font-medium ${value.size === k ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
              >
                {FONT_SIZES[k].label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Saved on this device. Pages re-flow automatically.</p>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

export default FontPicker;
