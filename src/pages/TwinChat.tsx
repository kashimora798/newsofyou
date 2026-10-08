import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  History,
  Loader2,
  Lock,
  MessageCirclePlus,
  Send,
  Share2,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ConsentSheet from "@/components/twin/ConsentSheet";
import { useTwinChat, type TwinMessage } from "@/hooks/useTwinChat";
import { useTwinConsent } from "@/hooks/useTwinConsent";
import { useTwinActions } from "@/hooks/useTwinActions";
import ActionCard from "@/components/twin/ActionCard";

/**
 * TwinChat — /twin, her private chat with the twin (build-plan Phase 4).
 *
 * The twin speaks in his voice but is never presented as him: every bubble is
 * labelled "AI", and the header says whose AI it is. Threads are hers — private
 * by default, shared one at a time with the toggle in the chats sheet.
 *
 * Nothing here needs a key: sending invokes the `twin-reply` edge function.
 */

const MOOD_LABEL: Record<string, string> = {
  sweet: "sweet",
  playful: "playful",
  flirty: "flirty",
  caring: "caring",
  missing_you: "missing you",
  proud: "proud",
  tender: "tender",
  apologetic: "sorry",
  ordinary: "ordinary",
};

const STARTERS = ["I miss him", "Tell me something he'd say", "I had a rough day", "Kaise ho tum?"];

/** Things the twin can *do*, not just say. Every write still needs a tap. */
const ASKS = [
  { label: "Remind me to…", prompt: "remind me to " },
  { label: "Send him a message at…", prompt: "send a message saying " },
  { label: "Add to our calendar", prompt: "add an event " },
];

const Stars: React.FC = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
    {Array.from({ length: 26 }).map((_, i) => {
      const left = (i * 37) % 100;
      const top = (i * 53) % 100;
      const size = i % 5 === 0 ? 2 : 1;
      return (
        <span
          key={i}
          className="absolute rounded-full bg-[hsl(var(--moon-white))]"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: size,
            height: size,
            opacity: 0.22 + ((i % 4) * 0.14),
            animation: i % 3 === 0 ? `scene-twinkle ${5 + (i % 5)}s ease-in-out ${i * 0.3}s infinite` : undefined,
          }}
        />
      );
    })}
    <div
      className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full blur-3xl"
      style={{ background: "radial-gradient(circle, hsl(var(--rose-glow) / 0.20), transparent 70%)" }}
    />
  </div>
);

const TwinBubble: React.FC<{ message: TwinMessage; ownerName: string }> = ({ message, ownerName }) => {
  const actions = message.actions ?? [];
  return (
    <div className="mt-3 flex items-start gap-2">
      <span
        className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ background: "hsl(var(--rose-glow) / 0.16)", border: "0.5px solid hsl(var(--rose-glow) / 0.35)" }}
      >
        <Sparkles className="h-3.5 w-3.5" style={{ color: "hsl(var(--rose-glow))" }} />
      </span>
      <div className="max-w-[78%]">
        <div className="mb-1 flex items-center gap-1.5">
          <span className="scene-label">{ownerName}&apos;s AI</span>
          {message.mood && MOOD_LABEL[message.mood] && (
            <span className="text-[10px] text-muted-foreground/70">· {MOOD_LABEL[message.mood]}</span>
          )}
        </div>
        <div
          className="rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[14.5px] leading-relaxed"
          style={{
            background: "hsl(var(--bubble-partner))",
            color: "hsl(var(--bubble-partner-foreground))",
            border: "0.5px solid hsl(var(--moon-white) / 0.07)",
          }}
        >
          {message.content}
        </div>
        {message.guarded && (
          <p className="mt-1 text-[10.5px] text-muted-foreground">kept this one gentle on purpose</p>
        )}
        {actions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {actions.map((a, i) => (
              <Badge key={i} variant="outline" className="text-[10px] font-normal">
                noted · {String(a.type).replace(/_/g, " ")}
              </Badge>
            ))}
            <span className="text-[10px] text-muted-foreground">he confirms before anything is scheduled</span>
          </div>
        )}
      </div>
    </div>
  );
};

const HerBubble: React.FC<{ message: TwinMessage }> = ({ message }) => (
  <div className="mt-3 flex justify-end">
    <div
      className="max-w-[78%] rounded-2xl rounded-tr-md px-3.5 py-2.5 text-[14.5px] leading-relaxed"
      style={{ background: "hsl(var(--bubble-own))", color: "hsl(var(--bubble-own-foreground))" }}
    >
      {message.content}
    </div>
  </div>
);

const TwinChat: React.FC = () => {
  const consent = useTwinConsent();
  const chat = useTwinChat();
  const actions = useTwinActions(Boolean(consent.consentedAt));
  const [draft, setDraft] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const ownerName = chat.config?.owner_name ?? "his";
  const partnerName = chat.config?.partner_name ?? "her";

  // She has not agreed yet → the honesty screen comes first (build-plan §7.1).
  useEffect(() => {
    if (!consent.loading && consent.configured && !consent.consentedAt && consent.canGrant) {
      setConsentOpen(true);
    }
  }, [consent.loading, consent.configured, consent.consentedAt, consent.canGrant]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages.length, chat.sending]);

  const empty = chat.messages.length === 0;

  const submit = async () => {
    const text = draft.trim();
    if (!text || chat.sending) return;
    setDraft("");
    await chat.send(text);
    // Anything the twin suggested while answering is now waiting for a tap.
    void actions.load();
  };

  const header = (
    <header className="relative z-10 flex items-center gap-3 px-4 pt-5 pb-3">
      <Link to="/home" className="text-muted-foreground transition-colors hover:text-foreground" aria-label="back">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="flex-1">
        <p className="scene-label">his AI, in his voice</p>
        <h1 className="font-heading text-[19px] leading-tight">
          {ownerName}&apos;s twin
        </h1>
      </div>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        style={{ border: "0.5px solid hsl(var(--moon-white) / 0.12)" }}
        aria-label="your chats"
      >
        <History className="h-4 w-4" />
        {chat.conversations.length > 1 && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full" style={{ background: "hsl(var(--rose-glow))" }} />
        )}
      </button>
    </header>
  );

  const gate = useMemo(() => {
    if (consent.loading || chat.loading) return null;
    if (!consent.configured) {
      return {
        title: "not set up yet",
        body: `The twin needs a one-time setup (his voice, her yes) before it can talk.`,
      };
    }
    if (!consent.consentedAt) {
      return consent.canGrant
        ? { title: "your yes first", body: "Read the short sheet — then we can talk." }
        : { title: "waiting for her", body: `The twin stays silent until ${partnerName} agrees. That part is hers alone.` };
    }
    if (!chat.chatEnabled) {
      return { title: "twin chat is off", body: "He can switch it back on in the twin control room." };
    }
    return null;
  }, [chat.chatEnabled, chat.loading, consent.canGrant, consent.configured, consent.consentedAt, consent.loading, partnerName]);

  return (
    <div className="night-scene relative flex h-dvh flex-col overflow-hidden bg-[hsl(var(--night-900))] text-foreground">
      <Stars />
      {header}

      {gate ? (
        <div className="relative z-10 flex flex-1 items-center justify-center px-6">
          <div className="pane pane-glow max-w-sm px-6 py-7 text-center">
            <Sparkles className="mx-auto mb-3 h-5 w-5" style={{ color: "hsl(var(--rose-glow))" }} />
            <h2 className="font-heading text-[20px]">{gate.title}</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{gate.body}</p>
            {consent.canGrant && !consent.consentedAt && (
              <Button className="mt-4" size="sm" onClick={() => setConsentOpen(true)}>
                Read the two-minute sheet
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-3 scrollbar-overlay">
            <div className="mx-auto max-w-md">
              {empty && (
                <div className="pane pane-glow mt-2 px-5 py-6">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    an AI stand-in, not {ownerName}
                  </p>
                  <p className="mt-2 font-heading text-[19px] leading-snug">
                    I talk the way he does, but I&apos;m his AI. Anything you say here stays with you unless you share it.
                  </p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                    He can read a thread only when you tap <Share2 className="inline h-3 w-3" /> share. I never promise things for
                    him — I can only pass a message along.
                  </p>
                </div>
              )}

              {chat.conversations.length > 0 && chat.activeConversation && (
                <div className="mt-3 flex items-center justify-between px-1">
                  <span className="truncate text-[11px] text-muted-foreground">{chat.activeConversation.title}</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => void chat.setVisibility(chat.activeConversation!.id, chat.activeConversation!.visibility !== "shared")}
                  >
                    {chat.activeConversation.visibility === "shared" ? (
                      <>
                        <Share2 className="h-3 w-3" /> shared with him
                      </>
                    ) : (
                      <>
                        <Lock className="h-3 w-3" /> only you
                      </>
                    )}
                  </button>
                </div>
              )}

              {chat.messages.map((m) =>
                m.role === "twin" ? (
                  <TwinBubble key={m.id} message={m} ownerName={ownerName} />
                ) : (
                  <HerBubble key={m.id} message={m} />
                ),
              )}

              {chat.sending && (
                <div className="mt-3 flex items-center gap-2 text-muted-foreground">
                  <span className="scene-label">{ownerName}&apos;s AI</span>
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-current"
                        style={{ animation: `scene-twinkle 1.2s ease-in-out ${i * 0.18}s infinite` }}
                      />
                    ))}
                  </span>
                </div>
              )}

              {empty && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {ASKS.map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      onClick={() => setDraft(a.prompt)}
                      className="rounded-full px-3 py-1.5 text-[12px]"
                      style={{ border: "0.5px solid hsl(var(--rose-glow) / 0.35)", color: "hsl(var(--rose-glow))" }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}

              {empty && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDraft(s)}
                      className="rounded-full px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                      style={{ border: "0.5px solid hsl(var(--moon-white) / 0.12)" }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {chat.error && <p className="mt-4 text-center text-[12px] text-destructive">{chat.error}</p>}
              <div ref={bottomRef} className="h-2" />
            </div>
          </div>

          {/* The twin proposes; a person taps. Nothing here has been written yet. */}
          {(actions.open.length > 0 || actions.lastAnswer) && (
            <div className="relative z-10 space-y-2 px-4 pb-1">
              <div className="mx-auto max-w-md space-y-2">
                {actions.lastAnswer && (
                  <ActionCard
                    action={{
                      id: `answer-${actions.lastAnswer.kind}`,
                      kind: actions.lastAnswer.kind,
                      status: "done",
                      title: actions.lastAnswer.title || "the twin's answer",
                      payload: { answer: actions.lastAnswer.text },
                    }}
                    onCancel={() => actions.dismissAnswer()}
                  />
                )}
                {actions.open.map((a) => (
                  <ActionCard
                    key={a.id}
                    action={a}
                    onConfirm={async (id) => {
                      await actions.confirm(id);
                    }}
                    onCancel={async (id) => {
                      await actions.cancel(id);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="relative z-10 px-4 pb-5 pt-2">
            <div className="mx-auto flex max-w-md items-end gap-2">
              <div className="pane flex-1 px-3 py-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  rows={1}
                  maxLength={2000}
                  placeholder="say something to his AI…"
                  className="max-h-28 w-full resize-none bg-transparent text-[14.5px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
                />
              </div>
              <Button
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full"
                onClick={submit}
                disabled={!draft.trim() || chat.sending}
                aria-label="send"
              >
                {chat.sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mx-auto mt-2 max-w-md text-center text-[10.5px] text-muted-foreground">
              answered by {ownerName}&apos;s AI — never by him pretending
            </p>
          </div>
        </>
      )}

      {/* Chats sheet */}
      <AnimatePresence>
        {sheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[70dvh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5"
              style={{ background: "hsl(var(--night-800))", borderTop: "0.5px solid hsl(var(--moon-white) / 0.1)" }}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-[18px]">your chats with his AI</h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await chat.newChat();
                    setSheetOpen(false);
                  }}
                >
                  <MessageCirclePlus className="h-3.5 w-3.5" />
                  <span className="ml-1.5">new</span>
                </Button>
              </div>

              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Each thread is private to you. Sharing is per-thread and can be taken back.
              </p>

              <div className="mt-3 space-y-2">
                {chat.conversations.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 rounded-2xl px-3 py-2.5"
                    style={{
                      background: c.id === chat.activeId ? "hsl(var(--rose-glow) / 0.10)" : "hsl(var(--moon-white) / 0.03)",
                      border: "0.5px solid hsl(var(--moon-white) / 0.07)",
                    }}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={async () => {
                        await chat.open(c.id);
                        setSheetOpen(false);
                      }}
                    >
                      <p className="truncate text-[14px]">{c.title}</p>
                      <p className="truncate text-[11.5px] text-muted-foreground">{c.preview ?? "empty"}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/80">
                        {c.msg_count} {c.msg_count === 1 ? "line" : "lines"} ·{" "}
                        {c.visibility === "shared" ? "shared with him" : "private"}
                      </p>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={c.visibility === "shared" ? "make private" : "share with him"}
                        onClick={() => void chat.setVisibility(c.id, c.visibility !== "shared")}
                      >
                        {c.visibility === "shared" ? <Undo2 className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label="delete chat"
                        onClick={() => void chat.remove(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {chat.conversations.length === 0 && (
                  <p className="py-6 text-center text-[13px] text-muted-foreground">No chats yet — say hello.</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConsentSheet
        open={consentOpen}
        ownerName={ownerName}
        canAgree={consent.canGrant}
        onClose={() => setConsentOpen(false)}
        onAgreed={() => {
          setConsentOpen(false);
          void chat.refresh();
        }}
      />
    </div>
  );
};

export default TwinChat;
