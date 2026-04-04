import React, { useState, useRef, useEffect } from "react";
import { LogOut, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ChatMessage {
  id: string;
  content: string;
  isMe: boolean;
  time: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  { id: "1", content: "Hey! How are you? 👋", isMe: false, time: "10:00 AM" },
  { id: "2", content: "I was thinking about you today 💕", isMe: false, time: "10:01 AM" },
  { id: "3", content: "What are you up to?", isMe: false, time: "10:02 AM" },
];

const AUTO_REPLIES = [
  "That sounds great! 😊",
  "Haha I love that 💕",
  "Tell me more!",
  "You're the best ❤️",
  "I miss you so much!",
  "Can't wait to see you 🥰",
  "That's so sweet of you",
  "You always make me smile 😄",
];

const DemoChat: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const partnerName = "Ramu";
  const partnerInitial = "R";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `me-${Date.now()}`,
        content: text,
        isMe: true,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setInput("");

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `reply-${Date.now()}`,
          content: AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)],
          isMe: false,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }, 1000 + Math.random() * 1500);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
            {partnerInitial}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-foreground truncate">{partnerName}</h1>
          <p className="text-xs text-muted-foreground">online</p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} className="shrink-0 text-muted-foreground">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.isMe ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                msg.isMe
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted text-foreground rounded-bl-md"
              }`}
            >
              <p className="text-sm leading-relaxed">{msg.content}</p>
              <p
                className={`text-[10px] mt-1 ${
                  msg.isMe ? "text-primary-foreground/60" : "text-muted-foreground"
                }`}
              >
                {msg.time}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-full border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default DemoChat;
