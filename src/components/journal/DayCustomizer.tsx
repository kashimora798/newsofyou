import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, RotateCcw, X } from "lucide-react";
import {
  ACCENTS, EMOJI_CHOICES, MOODS, PAPERS, WASHI, describeDay, type AccentKey, type JournalDayStyle, type PaperKey, type WashiKey,
} from "@/lib/journal";
import { Washi } from "./Decor";

interface Props {
  open: boolean;
  dayKey: string;
  value: JournalDayStyle;
  saving: boolean;
  /** live preview — called on every tweak */
  onChange: (next: JournalDayStyle) => void;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-2">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
    {children}
  </div>
);

const DayCustomizer: React.FC<Props> = ({ open, dayKey, value, saving, onChange, onSave, onCancel, onReset }) => {
  const [custom, setCustom] = useState("");
  const d = describeDay(dayKey);
  const set = <K extends keyof JournalDayStyle>(k: K, v: JournalDayStyle[K]) => onChange({ ...value, [k]: v });

  const toggleEmoji = (e: string) => {
    if (value.emojis.includes(e)) set("emojis", value.emojis.filter((x) => x !== e));
    else if (value.emojis.length < 6) set("emojis", [...value.emojis, e]);
  };
  const addCustom = () => {
    const e = [...custom.trim()].slice(0, 2).join("");
    if (e && !value.emojis.includes(e) && value.emojis.length < 6) set("emojis", [...value.emojis, e]);
    setCustom("");
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className="fixed inset-0 z-40 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-label="Customize this day"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[72dvh] w-full max-w-lg flex-col rounded-t-3xl border border-border bg-card shadow-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <div>
                <h3 className="font-heading text-base font-bold text-foreground">Decorate this day ✨</h3>
                <p className="text-xs text-muted-foreground">{d.weekday}, {d.month} {d.date}</p>
              </div>
              <button type="button" onClick={onCancel} className="rounded-full p-2 hover:bg-muted" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-4 pt-2">
              <Section title="Title">
                <input
                  value={value.title ?? ""}
                  maxLength={40}
                  onChange={(e) => set("title", e.target.value || null)}
                  placeholder="e.g. the rainy movie night"
                  className="w-full rounded-xl bg-muted px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
                />
                <textarea
                  value={value.caption ?? ""}
                  maxLength={140}
                  rows={2}
                  onChange={(e) => set("caption", e.target.value || null)}
                  placeholder="A little note to your future selves…"
                  className="w-full resize-none rounded-xl bg-muted px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
                />
              </Section>

              <Section title={`Emoji stickers (${value.emojis.length}/6)`}>
                <div className="flex flex-wrap gap-1.5">
                  {EMOJI_CHOICES.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => toggleEmoji(e)}
                      className={`h-9 w-9 rounded-xl text-xl transition-transform active:scale-90 ${value.emojis.includes(e) ? "bg-primary/15 ring-2 ring-primary" : "bg-muted hover:bg-muted/70"}`}
                      aria-pressed={value.emojis.includes(e)}
                    >{e}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustom()}
                    placeholder="Type any emoji…"
                    className="min-w-0 flex-1 rounded-xl bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button type="button" onClick={addCustom} className="rounded-xl bg-muted px-3 text-sm font-medium hover:bg-muted/70">Add</button>
                </div>
              </Section>

              <Section title="Ink colour">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(ACCENTS) as AccentKey[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => set("accent", k)}
                      aria-label={ACCENTS[k].label}
                      aria-pressed={value.accent === k}
                      className={`h-8 w-8 rounded-full border-2 transition-transform active:scale-90 ${value.accent === k ? "scale-110 border-foreground" : "border-white"}`}
                      style={{ background: `linear-gradient(135deg, ${ACCENTS[k].ink} 50%, ${ACCENTS[k].tape} 50%)`, boxShadow: "0 1px 3px rgba(0,0,0,.25)" }}
                    />
                  ))}
                </div>
              </Section>

              <Section title="Paper">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(PAPERS) as PaperKey[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => set("paper", k)}
                      aria-pressed={value.paper === k}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${value.paper === k ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                    >
                      <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full border border-black/20 align-middle" style={{ background: PAPERS[k].bg }} />
                      {PAPERS[k].label}
                    </button>
                  ))}
                </div>
              </Section>

              <Section title="Washi tape">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(WASHI) as WashiKey[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => set("washi", k)}
                      aria-label={WASHI[k].label}
                      aria-pressed={value.washi === k}
                      className={`rounded-md p-1 ${value.washi === k ? "bg-primary/10 ring-2 ring-primary" : "bg-muted"}`}
                    >
                      <Washi kind={k} color={ACCENTS[value.accent].tape} width={56} height={18} rot={0} />
                    </button>
                  ))}
                </div>
              </Section>

              <Section title="Mood">
                <div className="flex flex-wrap gap-1.5">
                  {MOODS.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => set("mood", value.mood === m.key ? null : m.key)}
                      aria-pressed={value.mood === m.key}
                      className={`rounded-full border px-2.5 py-1 text-xs ${value.mood === m.key ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                    >{m.emoji} {m.label}</button>
                  ))}
                </div>
              </Section>
            </div>

            <div className="flex items-center gap-2 border-t border-border px-5 py-3">
              <button type="button" onClick={onReset} className="flex items-center gap-1 rounded-full px-3 py-2 text-xs text-muted-foreground hover:bg-muted">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
              <div className="flex-1" />
              <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm hover:bg-muted">Cancel</button>
              <button type="button" onClick={onSave} disabled={saving}
                className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save page
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default DayCustomizer;
