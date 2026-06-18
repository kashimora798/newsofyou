import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Bell, PhoneOff, Target, CalendarHeart, Moon } from "lucide-react";
import type { ProposalType } from "@/hooks/useProposals";

interface ProposalSheetProps {
  open: boolean;
  onClose: () => void;
  onPropose: (type: ProposalType, title: string, payload: Record<string, any>) => Promise<{ error: any }>;
}

const TYPES: { type: ProposalType; label: string; icon: React.ReactNode; hint: string }[] = [
  { type: "time_limit", label: "Talk for…", icon: <Clock className="h-5 w-5" />, hint: "A focused chat window with a countdown" },
  { type: "reminder", label: "Shared reminder", icon: <Bell className="h-5 w-5" />, hint: "Remind us both at a time" },
  { type: "date", label: "Plan a date", icon: <CalendarHeart className="h-5 w-5" />, hint: "Adds it to your shared calendar" },
  { type: "no_phone", label: "No-phone focus", icon: <PhoneOff className="h-5 w-5" />, hint: "Be present together" },
  { type: "challenge", label: "Challenge", icon: <Target className="h-5 w-5" />, hint: "A little pact, e.g. one photo today" },
  { type: "goodnight", label: "Goodnight pact", icon: <Moon className="h-5 w-5" />, hint: "Wind down together" },
];

const ProposalSheet: React.FC<ProposalSheetProps> = ({ open, onClose, onPropose }) => {
  const [type, setType] = useState<ProposalType | null>(null);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [when, setWhen] = useState("");
  const [sending, setSending] = useState(false);

  const reset = () => { setType(null); setTitle(""); setMinutes(30); setWhen(""); };
  const close = () => { reset(); onClose(); };

  const selected = TYPES.find((t) => t.type === type);

  const handleSend = async () => {
    if (!type) return;
    const payload: Record<string, any> = {};
    let finalTitle = title.trim();

    if (type === "time_limit") {
      payload.minutes = minutes;
      if (!finalTitle) finalTitle = `Talk for ${minutes} min`;
    } else if (type === "reminder") {
      if (!when) return;
      payload.remind_at = new Date(when).toISOString();
      if (!finalTitle) finalTitle = "Our reminder";
    } else if (type === "date") {
      if (!when) return;
      payload.event_date = new Date(when).toISOString();
      if (!finalTitle) finalTitle = "Our date";
    } else if (!finalTitle) {
      finalTitle = selected?.label ?? "Pact";
    }

    setSending(true);
    const { error } = await onPropose(type, finalTitle, payload);
    setSending(false);
    if (!error) close();
  };

  const needsWhen = type === "reminder" || type === "date";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{type ? selected?.label : "Propose a pact 🤝"}</DialogTitle>
        </DialogHeader>

        {!type ? (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {TYPES.map((t) => (
              <button
                key={t.type}
                onClick={() => setType(t.type)}
                className="flex flex-col items-start gap-1.5 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-primary/5"
              >
                <span className="text-primary">{t.icon}</span>
                <span className="text-sm font-medium text-foreground">{t.label}</span>
                <span className="text-[10px] leading-tight text-muted-foreground">{t.hint}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground">{selected?.hint}</p>

            {type === "time_limit" && (
              <div>
                <label className="text-xs font-medium text-foreground">Minutes</label>
                <div className="mt-1 flex gap-2">
                  {[15, 30, 60, 120].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMinutes(m)}
                      className={`flex-1 rounded-lg border py-2 text-sm transition-colors ${
                        minutes === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                      }`}
                    >
                      {m < 60 ? `${m}m` : `${m / 60}h`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {needsWhen && (
              <div>
                <label className="text-xs font-medium text-foreground">When</label>
                <Input
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-foreground">Note (optional)</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={selected?.label}
                className="mt-1"
                maxLength={120}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="ghost" onClick={() => setType(null)} className="flex-1">Back</Button>
              <Button onClick={handleSend} disabled={sending || (needsWhen && !when)} className="flex-1">
                {sending ? "Sending…" : "Propose"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProposalSheet;
