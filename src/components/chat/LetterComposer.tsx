import React, { useState } from "react";
import { X, Send, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export interface LetterMeta {
  letter_paper: number;
  letter_font: number;
  letter_ink: string | null;
  letter_decorations: boolean;
}

interface LetterComposerProps {
  partnerName: string;
  senderName: string;
  onSend: (content: string, meta: LetterMeta) => void;
  onClose: () => void;
  defaultHandwriting?: boolean;
}

const PAPER_STYLES = [
  { label: "Parchment", bg: "linear-gradient(to bottom, #f5f0e8, #ede4d3)", text: "hsl(30,20%,20%)", swatch: "#e8dcc8" },
  { label: "Rose", bg: "linear-gradient(to bottom, #fce4ec, #f8bbd0)", text: "hsl(340,30%,25%)", swatch: "#f8bbd0" },
  { label: "Midnight", bg: "linear-gradient(to bottom, #1a1a2e, #16213e)", text: "hsl(0,0%,90%)", swatch: "#1a1a2e" },
  { label: "Ocean", bg: "linear-gradient(to bottom, #e0f7fa, #b2ebf2)", text: "hsl(187,30%,20%)", swatch: "#b2ebf2" },
  { label: "Lavender", bg: "linear-gradient(to bottom, #e8d5f5, #d1b3e8)", text: "hsl(275,25%,22%)", swatch: "#d1b3e8" },
  { label: "Sunset", bg: "linear-gradient(to bottom, #fde1c8, #f5a0a0)", text: "hsl(15,30%,22%)", swatch: "#f5a0a0" },
  { label: "Forest", bg: "linear-gradient(to bottom, #c8e6c9, #81c784)", text: "hsl(125,25%,18%)", swatch: "#81c784" },
  { label: "Starlight", bg: "linear-gradient(to bottom, #1a1a3e, #2d2d5e)", text: "hsl(240,20%,88%)", swatch: "#2d2d5e" },
];

const FONTS = [
  { label: "Elegant", family: "Georgia, 'Times New Roman', serif" },
  { label: "Classic", family: "'Palatino Linotype', 'Book Antiqua', serif" },
  { label: "Modern", family: "system-ui, sans-serif" },
  { label: "Anshika's Magic", family: "'MyHandwriting', 'Comic Neue', cursive, sans-serif" },
];

const INK_COLORS = [
  { label: "Default", color: null },
  { label: "Black", color: "#1a1a1a" },
  { label: "Blue", color: "#1e3a8a" },
  { label: "Red", color: "#991b1b" },
  { label: "Gold", color: "#92750c" },
  { label: "Purple", color: "#6b21a8" },
];

const GREETINGS = [
  { label: "Dear", template: (n: string) => `Dear ${n},` },
  { label: "My dearest", template: (n: string) => `My dearest ${n},` },
  { label: "Hey", template: (n: string) => `Hey ${n},` },
  { label: "To my love", template: () => `To my love,` },
  { label: "Custom", template: null },
];

const SIGNOFFS = [
  { label: "Love", template: (n: string) => `Love, ${n}` },
  { label: "Forever yours", template: (n: string) => `Forever yours, ${n}` },
  { label: "XOXO", template: (n: string) => `XOXO, ${n}` },
  { label: "With all my heart", template: (n: string) => `With all my heart, ${n}` },
  { label: "Custom", template: null },
];

const LetterComposer: React.FC<LetterComposerProps> = ({ partnerName, senderName, onSend, onClose, defaultHandwriting = false }) => {
  const [body, setBody] = useState("");
  const [paperIdx, setPaperIdx] = useState(0);
  const [fontIdx, setFontIdx] = useState(() => {
    if (defaultHandwriting) return 3;
    try {
      return localStorage.getItem("app_use_handwriting_font") === "true" ? 3 : 0;
    } catch {
      return 0;
    }
  });
  const [inkIdx, setInkIdx] = useState(0);
  const [greetingIdx, setGreetingIdx] = useState(0);
  const [signoffIdx, setSignoffIdx] = useState(0);
  const [customGreeting, setCustomGreeting] = useState("");
  const [customSignoff, setCustomSignoff] = useState("");
  const [decorations, setDecorations] = useState(false);

  const paper = PAPER_STYLES[paperIdx];
  const font = FONTS[fontIdx];
  const ink = INK_COLORS[inkIdx];
  const textColor = ink.color || paper.text;

  const greeting = GREETINGS[greetingIdx];
  const greetingText = greeting.template ? greeting.template(partnerName) : customGreeting;

  const signoff = SIGNOFFS[signoffIdx];
  const signoffText = signoff.template ? signoff.template(senderName) : customSignoff;

  const handleSend = () => {
    if (!body.trim()) return;
    const fullLetter = `${greetingText}\n\n${body.trim()}\n\n${signoffText} 💕`;
    onSend(fullLetter, {
      letter_paper: paperIdx,
      letter_font: fontIdx,
      letter_ink: ink.color,
      letter_decorations: decorations,
    });
  };

  // Corner flourish preview
  const Flourish = () => (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute top-2 left-2 text-lg opacity-20" style={{ color: textColor }}>❧</div>
      <div className="absolute top-2 right-2 text-lg opacity-20 scale-x-[-1]" style={{ color: textColor }}>❧</div>
      <div className="absolute bottom-2 left-2 text-lg opacity-20 rotate-180" style={{ color: textColor }}>❧</div>
      <div className="absolute bottom-2 right-2 text-lg opacity-20 rotate-180 scale-x-[-1]" style={{ color: textColor }}>❧</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">💌 Write a Letter</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Letter paper preview */}
        <div
          className="flex-1 overflow-y-auto p-5 relative min-h-0"
          style={{
            background: paper.bg,
            color: textColor,
            fontFamily: font.family,
            backgroundImage: `${paper.bg}, url("data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 3h1v1H1V3zm2-2h1v1H3V1z' fill='%23000' fill-opacity='0.03'/%3E%3C/svg%3E")`,
          }}
        >
          {decorations && <Flourish />}
          <p className="text-lg italic mb-3 opacity-80">{greetingText}</p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write from your heart..."
            className="w-full bg-transparent border-none resize-none focus:outline-none text-base leading-[2rem] min-h-[160px] placeholder:opacity-40"
            style={{
              fontFamily: font.family,
              color: textColor,
              backgroundImage: "repeating-linear-gradient(transparent, transparent 31px, rgba(0,0,0,0.06) 31px, rgba(0,0,0,0.06) 32px)",
              lineHeight: "2rem",
            }}
            autoFocus
          />
          <p className="text-base italic text-right mt-3 opacity-80">{signoffText} 💕</p>
        </div>

        {/* Controls */}
        <div className="px-3 py-2.5 bg-card border-t border-border space-y-2 overflow-y-auto max-h-[45vh]">
          {/* Paper */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider w-10">Paper</span>
            <div className="flex gap-1.5 flex-wrap">
              {PAPER_STYLES.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setPaperIdx(i)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${i === paperIdx ? "border-primary scale-110 ring-2 ring-primary/30" : "border-border"}`}
                  style={{ background: p.swatch }}
                  title={p.label}
                />
              ))}
            </div>
          </div>

          {/* Font */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider w-10">Font</span>
            <div className="flex gap-1">
              {FONTS.map((f, i) => (
                <button
                  key={i}
                  onClick={() => setFontIdx(i)}
                  className={`px-2 py-0.5 rounded text-[10px] transition-all ${i === fontIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                  style={{ fontFamily: f.family }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ink */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider w-10">Ink</span>
            <div className="flex gap-1.5">
              {INK_COLORS.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setInkIdx(i)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${i === inkIdx ? "border-primary scale-110" : "border-border"}`}
                  style={{ background: c.color || "linear-gradient(135deg,#ccc,#999)" }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Greeting */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider w-10">Hello</span>
            <div className="flex gap-1 flex-wrap">
              {GREETINGS.map((g, i) => (
                <button
                  key={i}
                  onClick={() => setGreetingIdx(i)}
                  className={`px-2 py-0.5 rounded text-[10px] transition-all ${i === greetingIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            {greetingIdx === GREETINGS.length - 1 && (
              <Input
                value={customGreeting}
                onChange={(e) => setCustomGreeting(e.target.value)}
                placeholder="Custom greeting..."
                className="h-7 text-xs flex-1 min-w-[120px]"
              />
            )}
          </div>

          {/* Sign-off */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider w-10">Bye</span>
            <div className="flex gap-1 flex-wrap">
              {SIGNOFFS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setSignoffIdx(i)}
                  className={`px-2 py-0.5 rounded text-[10px] transition-all ${i === signoffIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {signoffIdx === SIGNOFFS.length - 1 && (
              <Input
                value={customSignoff}
                onChange={(e) => setCustomSignoff(e.target.value)}
                placeholder="Custom sign-off..."
                className="h-7 text-xs flex-1 min-w-[120px]"
              />
            )}
          </div>

          {/* Decorations toggle */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider w-10">Deco</span>
            <div className="flex items-center gap-2">
              <Switch checked={decorations} onCheckedChange={setDecorations} className="scale-75" />
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Corner flourishes
              </Label>
            </div>
          </div>

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={!body.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 transition-all hover:opacity-90 active:scale-[0.98] font-medium text-sm"
          >
            <Send className="h-4 w-4" />
            Send Letter 💌
          </button>
        </div>
      </div>
    </div>
  );
};

export default LetterComposer;
