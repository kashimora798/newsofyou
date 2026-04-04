import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, Send, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface DemoMessage {
  id: string;
  content: string;
  isMe: boolean;
  time: string;
}

const SAMPLE_MESSAGES: DemoMessage[] = [
  { id: "1", content: "Hey! Welcome to the demo 👋", isMe: false, time: "10:00 AM" },
  { id: "2", content: "This is a preview of the chat experience", isMe: false, time: "10:01 AM" },
  { id: "3", content: "You can type messages here — they stay local only", isMe: false, time: "10:01 AM" },
  { id: "4", content: "To access the full chat, your account needs partner access", isMe: false, time: "10:02 AM" },
  { id: "5", content: "Try sending a message below! 💬", isMe: false, time: "10:02 AM" },
];

const DemoChat: React.FC = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<DemoMessage[]>(SAMPLE_MESSAGES);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        content: text,
        isMe: true,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setInput("");

    // Auto-reply after a short delay
    setTimeout(() => {
      const replies = [
        "Nice! This is a demo reply 😊",
        "Cool message! Remember, this is just a preview",
        "Great to see you exploring! 🎉",
        "Everything here is local — no data sent anywhere",
        "Ask your partner to give you access for the full experience! 💕",
      ];
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          content: replies[Math.floor(Math.random() * replies.length)],
          isMe: false,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate("/home")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-foreground truncate">Demo Chat</h1>
          <p className="text-xs text-muted-foreground">Preview Mode</p>
        </div>
      </div>

      {/* Demo banner */}
      <div className="flex items-center gap-2 px-4 py-2 bg-accent/50 border-b border-border">
        <Info className="h-4 w-4 text-primary shrink-0" />
        <p className="text-xs text-muted-foreground">
          Demo Mode — You're exploring a preview. Messages stay local.
        </p>
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
            placeholder="Type a demo message..."
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
