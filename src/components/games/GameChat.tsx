import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ChatMessage {
  id: string;
  userId: string;
  text: string;
  timestamp: number;
}

interface GameChatProps {
  sessionId: string;
  userId: string;
  partnerName?: string;
}

const GameChat: React.FC<GameChatProps> = ({ sessionId, userId, partnerName }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [floatingMsg, setFloatingMsg] = useState<ChatMessage | null>(null);
  const channelRef = useRef<any>(null);
  const floatingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const channel = supabase
      .channel(`game_chat_${sessionId}`)
      .on("broadcast", { event: "chat_msg" }, ({ payload }) => {
        const msg = payload as ChatMessage;
        setMessages((prev) => [...prev.slice(-29), msg]);
        if (msg.userId !== userId) {
          setUnread((prev) => prev + 1);
          setFloatingMsg(msg);
          if (floatingTimeoutRef.current) clearTimeout(floatingTimeoutRef.current);
          floatingTimeoutRef.current = setTimeout(() => setFloatingMsg(null), 4000);
        }
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      if (floatingTimeoutRef.current) clearTimeout(floatingTimeoutRef.current);
    };
  }, [sessionId, userId]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !channelRef.current) return;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      userId,
      text,
      timestamp: Date.now(),
    };
    channelRef.current.send({
      type: "broadcast",
      event: "chat_msg",
      payload: msg,
    });
    setMessages((prev) => [...prev.slice(-29), msg]);
    setInput("");
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, open]);

  return (
    <>
      {/* Floating partner message */}
      <AnimatePresence>
        {floatingMsg && !open && (
          <motion.div
            key={floatingMsg.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-32 left-3 right-16 z-40 pointer-events-none"
          >
            <div className="glass rounded-2xl px-4 py-2.5 text-xs shadow-lg flex items-center gap-2 max-w-xs">
              <span className="font-bold text-primary shrink-0">{partnerName ?? "Partner"}:</span>
              <span className="text-foreground truncate">{floatingMsg.text}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={() => {
          setOpen(!open);
          if (!open) setUnread(0);
        }}
        className="fixed bottom-[4.5rem] right-3 z-40 h-10 w-10 rounded-full glass shadow-lg flex items-center justify-center"
      >
        {open ? (
          <X className="h-4 w-4 text-foreground" />
        ) : (
          <MessageCircle className="h-4 w-4 text-foreground" />
        )}
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-[7.5rem] right-3 z-40 w-72 glass rounded-2xl shadow-2xl overflow-hidden border border-border/30"
          >
            <div className="px-3 py-2 border-b border-border/30 flex items-center gap-2">
              <MessageCircle className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold text-foreground">Game Chat</span>
            </div>

            <div className="max-h-52 overflow-y-auto p-3 space-y-1.5">
              {messages.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-6">
                  Send a fun message! 💬
                </p>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.userId === userId ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`rounded-2xl px-3 py-1.5 max-w-[85%] text-[11px] leading-relaxed ${
                      msg.userId === userId
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex gap-1.5 p-2 border-t border-border/30"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Say something fun…"
                className="flex-1 h-8 rounded-xl bg-background/60 px-3 text-[11px] outline-none placeholder:text-muted-foreground text-foreground"
                autoFocus
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="h-8 w-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 shrink-0"
              >
                <Send className="h-3 w-3" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GameChat;
