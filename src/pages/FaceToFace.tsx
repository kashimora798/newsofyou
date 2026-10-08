import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Handshake,
  HeartHandshake,
  Loader2,
  Pause,
  Play,
  Send,
  ShieldAlert,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFaceToFace } from "@/hooks/useFaceToFace";
import { useTwinConsent } from "@/hooks/useTwinConsent";

/**
 * FaceToFace — /face-to-face, the room for the conversation that is too heavy
 * for the chat (build-plan Phase 8).
 *
 * Both people agree the ground rules before a word is exchanged. Turns
 * alternate. Either of them can ask for a gentler version of what they wrote —
 * read it, edit it, choose — and what they choose is what gets stored, with
 * their original kept beside it.
 *
 * If a turn carries a self-harm or abuse signal the room stops and shows real
 * help. The assistant does not continue past that; that is the whole point.
 */

const RULES = [
  "One thing at a time. We finish one, then the next.",
  "I talk about what I felt and what I need — not about what is wrong with you.",
  "No name-calling, no mocking, no “you always / you never”.",
  "Either of us can say “pause” and we stop, without a penalty.",
  "Nothing said here gets used as a weapon later, or forwarded.",
  "The AI only helps us say things more clearly. It never takes a side, and it never decides anything for us.",
];

const Stars: React.FC = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
    {Array.from({ length: 20 }).map((_, i) => (
      <span
        key={i}
        className="absolute rounded-full bg-[hsl(var(--moon-white))]"
        style={{
          left: `${(i * 41) % 100}%`,
          top: `${(i * 29) % 100}%`,
          width: i % 4 === 0 ? 2 : 1,
          height: i % 4 === 0 ? 2 : 1,
          opacity: 0.18 + (i % 4) * 0.12,
        }}
      />
    ))}
    <div
      className="absolute -top-20 right-0 h-56 w-56 rounded-full blur-3xl"
      style={{ background: "radial-gradient(circle, hsl(var(--gold-ink) / 0.14), transparent 70%)" }}
    />
  </div>
);

const FaceToFace: React.FC = () => {
  const consent = useTwinConsent();
  const room = useFaceToFace(Boolean(consent.consentedAt || consent.configured));
  const [topic, setTopic] = useState("");
  const [draft, setDraft] = useState("");
  const [softened, setSoftened] = useState<{ gentler: string; need: string; land: string } | null>(null);
  const [useSoftened, setUseSoftened] = useState(false);
  const [closing, setClosing] = useState<{ note?: string | null; aNeed?: string; bNeed?: string; nextStep?: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const session = room.session;
  const turns = room.turns;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, closing]);

  const partnerName = consent.isOwner ? "her" : "him";

  // A room waiting for the other person: joining is just opening the door.
  useEffect(() => {
    if (session && !session.partner_id && session.started_by !== room.state?.me) {
      void room.join(session.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.partner_id]);

  const askSoften = async () => {
    if (!session || !draft.trim()) return;
    const result = await room.soften(session.id, draft.trim());
    if (result?.safe === false) return; // the room is stopping
    if (result && result.gentler) {
      setSoftened({ gentler: result.gentler, need: result.need, land: result.land });
      setUseSoftened(true);
    }
  };

  const send = async () => {
    if (!session) return;
    const raw = draft.trim();
    if (!raw) return;
    await room.send(session.id, raw, {
      softened: softened?.gentler,
      useSoftened: useSoftened && Boolean(softened?.gentler),
    });
    setDraft("");
    setSoftened(null);
    setUseSoftened(false);
  };

  const stopCard = useMemo(() => turns.find((t) => t.kind === "resources") ?? null, [turns]);

  const header = (
    <header className="relative z-10 flex items-center gap-3 px-4 pt-5 pb-3">
      <Link to="/home" className="text-muted-foreground transition-colors hover:text-foreground" aria-label="back">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="flex-1">
        <p className="scene-label">one conversation, properly</p>
        <h1 className="font-heading text-[19px] leading-tight">Face to Face</h1>
      </div>
      {session && session.status !== "closed" && (
        <button
          type="button"
          onClick={() => void room.pause(session.id, session.status !== "paused")}
          className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          style={{ border: "0.5px solid hsl(var(--moon-white) / 0.12)" }}
        >
          {session.status === "paused" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          {session.status === "paused" ? "resume" : "pause"}
        </button>
      )}
    </header>
  );

  // ── no room yet ─────────────────────────────────────────────────────────
  if (!room.loading && !session) {
    return (
      <div className="night-scene relative flex h-dvh flex-col overflow-hidden bg-[hsl(var(--night-900))] text-foreground">
        <Stars />
        {header}
        <div className="relative z-10 flex flex-1 items-start justify-center overflow-y-auto px-4 pb-8">
          <div className="mx-auto w-full max-w-md space-y-3">
            <div className="pane pane-glow px-5 py-6">
              <Handshake className="mb-3 h-5 w-5" style={{ color: "hsl(var(--gold-ink))" }} />
              <h2 className="font-heading text-[21px] leading-snug">When something is too heavy for the chat.</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                One topic at a time, both of you in the room. You can ask me to help you say a hard thing gently — I only ever
                suggest, you decide what gets said. If either of you says “pause”, we stop.
              </p>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={200}
                placeholder="what is this about? (one line is enough)"
                className="mt-4 w-full rounded-xl bg-white/5 px-3.5 py-2.5 text-[14px] outline-none placeholder:text-muted-foreground/70"
                style={{ border: "0.5px solid hsl(var(--moon-white) / 0.1)" }}
              />
              <Button
                className="mt-3 w-full"
                disabled={!topic.trim() || room.busy === "open"}
                onClick={() => void room.open(topic.trim())}
              >
                {room.busy === "open" ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeartHandshake className="h-4 w-4" />}
                <span className="ml-2">Open the room</span>
              </Button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                {partnerName} gets asked to agree the ground rules before anything is said.
              </p>
            </div>
            <p className="text-center text-[11.5px] text-muted-foreground">
              Only one room at a time. Opening a new one closes the last, quietly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── the room ────────────────────────────────────────────────────────────
  return (
    <div className="night-scene relative flex h-dvh flex-col overflow-hidden bg-[hsl(var(--night-900))] text-foreground">
      <Stars />
      {header}

      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-3 scrollbar-overlay">
        <div className="mx-auto max-w-md">
          {session && (
            <div className="pane px-4 py-3">
              <p className="scene-label">the topic</p>
              <p className="mt-1 text-[15px] leading-snug">{session.topic}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant={session.status === "active" ? "default" : "secondary"}>{session.status}</Badge>
                <Badge variant="outline">
                  {session.turn_count}/{session.max_turns} turns
                </Badge>
                {room.state?.waiting_for_partner && <Badge variant="outline">waiting for {partnerName}</Badge>}
                {session.status === "paused" && <Badge variant="secondary">paused — no pressure</Badge>}
              </div>
            </div>
          )}

          {/* rules stage */}
          {session?.stage === "rules" && (
            <div className="pane pane-glow mt-3 px-4 py-4">
              <p className="scene-label">ground rules — both of you</p>
              <ul className="mt-2 space-y-1.5">
                {RULES.map((r, i) => (
                  <li key={i} className="flex gap-2 text-[13px] leading-relaxed">
                    <span className="text-muted-foreground">{i + 1}.</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
              <Button className="mt-4 w-full" disabled={room.state?.i_agreed || room.busy === "agree"} onClick={() => void room.agree(session.id)}>
                {room.state?.i_agreed ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="ml-2">waiting for {partnerName} to agree…</span>
                  </>
                ) : (
                  <>
                    <Handshake className="h-4 w-4" />
                    <span className="ml-2">I agree to these</span>
                  </>
                )}
              </Button>
            </div>
          )}

          {/* stopped */}
          {session?.status === "stopped" && stopCard && (
            <div className="mt-3 rounded-3xl border border-rose-400/30 bg-rose-500/10 px-4 py-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-300" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-200">the room stopped</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed">{stopCard.content}</p>
            </div>
          )}

          {/* turns */}
          {turns
            .filter((t) => t.kind === "message")
            .map((t) => {
              const mine = t.user_id === room.state?.me;
              return (
                <div key={t.id} className={`mt-3 flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[82%] ${mine ? "text-right" : "text-left"}`}>
                    <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {mine ? "you" : partnerName}
                      {t.softened && <span className="ml-1.5 normal-case tracking-normal">· said gently</span>}
                    </p>
                    <div
                      className="rounded-2xl px-3.5 py-2.5 text-[14.5px] leading-relaxed"
                      style={{
                        background: mine ? "hsl(var(--bubble-own))" : "hsl(var(--bubble-partner))",
                        color: mine ? "hsl(var(--bubble-own-foreground))" : "hsl(var(--bubble-partner-foreground))",
                        border: "0.5px solid hsl(var(--moon-white) / 0.07)",
                      }}
                    >
                      {t.content}
                    </div>
                  </div>
                </div>
              );
            })}

          {/* closing note */}
          {closing?.note && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pane pane-glow mt-4 px-4 py-4">
              <p className="scene-label">how this one ended</p>
              <p className="mt-2 text-[14px] leading-relaxed">{closing.note}</p>
              {(closing.aNeed || closing.bNeed || closing.nextStep) && (
                <div className="mt-3 space-y-1.5 text-[12.5px] text-muted-foreground">
                  {closing.aNeed && <p>he asked for: <span className="text-foreground">{closing.aNeed}</span></p>}
                  {closing.bNeed && <p>she asked for: <span className="text-foreground">{closing.bNeed}</span></p>}
                  {closing.nextStep && <p>next small step: <span className="text-foreground">{closing.nextStep}</span></p>}
                </div>
              )}
              <Button className="mt-3 w-full" variant="outline" onClick={() => setClosing(null)}>
                Thank you
              </Button>
            </motion.div>
          )}

          {session?.close_note && !closing?.note && (
            <div className="pane mt-4 px-4 py-3">
              <p className="scene-label">the note you kept</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed">{session.close_note}</p>
            </div>
          )}

          <div ref={bottomRef} className="h-2" />
        </div>
      </div>

      {/* composer */}
      {session && session.stage === "turns" && session.status === "active" && (
        <div className="relative z-10 px-4 pb-5 pt-2">
          <div className="mx-auto max-w-md">
            {/* the suggestion, before anything is sent */}
            <AnimatePresence>
              {softened && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="pane pane-glow mb-2 px-3.5 py-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="scene-label flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" /> a gentler way to say it
                    </span>
                    <button type="button" onClick={() => setSoftened(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={softened.gentler}
                    onChange={(e) => setSoftened({ ...softened, gentler: e.target.value })}
                    rows={3}
                    className="mt-2 w-full resize-none rounded-xl bg-white/5 px-3 py-2 text-[14px] leading-relaxed outline-none"
                  />
                  {(softened.need || softened.land) && (
                    <div className="mt-2 space-y-1 text-[11.5px] text-muted-foreground">
                      {softened.need && <p>what you actually need: <span className="text-foreground">{softened.need}</span></p>}
                      {softened.land && <p>how it may land: <span className="text-foreground">{softened.land}</span></p>}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button size="sm" className="h-7 rounded-full px-3 text-[12px]" onClick={() => setUseSoftened(true)}>
                      Send this version
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 rounded-full px-3 text-[12px]"
                      onClick={() => {
                        setUseSoftened(false);
                        void send();
                      }}
                    >
                      Send my own words
                    </Button>
                    <span className="text-[10.5px] text-muted-foreground">
                      your original is kept beside it — nobody can be misquoted
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-end gap-2">
              <div className="pane flex-1 px-3 py-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  maxLength={3000}
                  placeholder={room.state?.my_turn ? "say it — plainly is fine…" : `waiting for ${partnerName}…`}
                  disabled={!room.state?.my_turn}
                  className="max-h-32 w-full resize-none bg-transparent text-[14.5px] leading-relaxed outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
                />
              </div>
              <Button
                size="icon"
                variant="outline"
                className="h-10 w-10 shrink-0 rounded-full"
                onClick={() => void askSoften()}
                disabled={!draft.trim() || !room.state?.my_turn || room.busy === "soften"}
                aria-label="say it gentler"
              >
                {room.busy === "soften" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full"
                onClick={() => void send()}
                disabled={!draft.trim() || !room.state?.my_turn || room.busy === "send"}
                aria-label="send"
              >
                {room.busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-2 text-center text-[10.5px] text-muted-foreground">
              {room.state?.my_turn ? "your turn — one thing at a time" : `${partnerName}'s turn`}
            </p>
          </div>
        </div>
      )}

      {/* closing */}
      {session && (session.stage === "closing" || session.turn_count >= session.max_turns) && session.status === "active" && !closing && (
        <div className="relative z-10 px-4 pb-5">
          <div className="mx-auto max-w-md">
            <Button className="w-full" variant="outline" disabled={room.busy === "close"} onClick={() => void room.close(session.id).then((r) => setClosing(r))}>
              {room.busy === "close" ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeartHandshake className="h-4 w-4" />}
              <span className="ml-2">Wrap up — write down what we agreed</span>
            </Button>
          </div>
        </div>
      )}

      {room.error && (
        <p className="relative z-10 px-4 pb-3 text-center text-[12px] text-destructive">{room.error}</p>
      )}
    </div>
  );
};

export default FaceToFace;
