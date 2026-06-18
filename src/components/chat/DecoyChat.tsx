import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Menu, Plus, Trash2, MessageSquare, Bot, Sparkles, ChevronDown, Check, PanelLeftClose, PanelLeft, ArrowUp, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DECOY_SKINS, type DecoySkin } from "@/lib/decoySkins";
import { matchesCode } from "@/hooks/useDecoy";

interface DecoyChatProps {
  skin: DecoySkin;
  unlockHash: string | null;
  onUnlock: () => void;
}

interface DecoyMsg {
  role: "user" | "assistant";
  content: string;
}

interface DecoyChatSession {
  id: string;
  title: string;
  skin: DecoySkin;
  messages: DecoyMsg[];
  createdAt: number;
}

const LOCAL_STORAGE_CHATS_KEY = "decoy-chat-sessions";

// High-fidelity logo components
const ChatGPTLogo = ({ className = "h-7 w-7" }: { className?: string }) => (
  <div className={`rounded-full bg-[#10a37f] flex items-center justify-center ${className} shrink-0`}>
    <svg viewBox="0 0 41 41" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 text-white">
      <path d="M37.5324 16.8707C37.9808 15.5241 38.0863 14.0924 37.84 12.699C37.4627 10.569 36.2237 8.68122 34.3813 7.4299C32.6534 6.25624 30.5517 5.75386 28.4813 6.0199C27.6749 5.04414 26.626 4.27641 25.4374 3.7919C23.3644 2.94639 21.0343 2.99722 19.0013 3.9319C18.1729 3.51347 17.2606 3.22055 16.3213 3.0719C14.1783 2.73038 11.9798 3.32832 10.2313 4.7299C8.89297 5.79973 7.91578 7.2435 7.40134 8.9099C6.44497 9.07153 5.52554 9.47953 4.71134 10.1099C2.97746 11.4552 1.87413 13.4839 1.63134 15.7099C1.38856 17.9359 2.03055 20.1389 3.42134 21.7899C2.9729 23.1365 2.86737 24.5683 3.11375 25.9617C3.49103 28.0917 4.73003 29.9794 6.57241 31.2307C8.30032 32.4044 10.402 32.9068 12.4724 32.6407C13.2789 33.6165 14.3278 34.3842 15.5164 34.8687C17.5893 35.7142 19.9194 35.6634 21.9524 34.7287C22.7808 35.1471 23.6931 35.4401 24.6324 35.5887C26.7754 35.9302 28.9739 35.3323 30.7224 33.9307C32.0607 32.8609 33.0379 31.4171 33.5524 29.7507C34.5087 29.5891 35.4282 29.1811 36.2424 28.5507C37.9763 27.2054 39.0796 25.1767 39.3224 22.9507C39.5652 20.7247 38.9232 18.5217 37.5324 16.8707V16.8707Z" fill="white" />
      <path d="M28.0813 19.3499L22.9813 16.4099L23.0813 22.2599L18.0013 19.3199L15.0613 24.4199L20.1413 27.3599L15.0013 27.3099L15.0513 33.1599L20.1513 30.2199L23.0913 35.3199L28.1713 32.3799L25.2313 27.2799L30.3113 30.2199L33.2513 25.1199L28.1713 22.1799L28.0813 19.3499Z" fill="#10A37F" />
    </svg>
  </div>
);

const GeminiLogo = ({ className = "h-7 w-7" }: { className?: string }) => (
  <div className={`rounded-full bg-slate-950 flex items-center justify-center overflow-hidden border border-slate-900 ${className} shrink-0`}>
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5">
      <path d="M12 3C12 3 12.5 8 15 10.5C17.5 13 22.5 13.5 22.5 13.5C22.5 13.5 17.5 14 15 16.5C12.5 19 12 24 12 24C12 24 11.5 19 9 16.5C6.5 14 1.5 13.5 1.5 13.5C1.5 13.5 6.5 13 9 10.5C11.5 8 12 3 12 3Z" fill="url(#geminiGradient)" />
      <defs>
        <linearGradient id="geminiGradient" x1="1.5" y1="3" x2="22.5" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9b72cb" />
          <stop offset="0.5" stopColor="#d96570" />
          <stop offset="1" stopColor="#f39f76" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

const ClaudeLogo = ({ className = "h-7 w-7" }: { className?: string }) => (
  <div className={`rounded-full bg-[#d97757] flex items-center justify-center ${className} shrink-0`}>
    <span className="text-[#f9f8f6] font-serif text-[13px] font-bold">C</span>
  </div>
);

// Markdown/code block parser helper
const formatDecoyText = (content: string) => {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, index) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const code = part.slice(3, -3).trim();
      const lines = code.split("\n");
      const lang = lines[0].match(/^[a-zA-Z0-9_-]+$/) ? lines[0] : "";
      const actualCode = lang ? lines.slice(1).join("\n") : code;
      return (
        <div key={index} className="my-3 rounded-lg overflow-hidden border border-border/60 bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs shadow-xs w-full max-w-full">
          {lang && (
            <div className="bg-[#2d2d2d] px-4 py-1.5 flex justify-between items-center text-[10px] uppercase font-bold text-muted-foreground select-none">
              <span>{lang}</span>
            </div>
          )}
          <pre className="p-4 overflow-x-auto whitespace-pre">
            <code>{actualCode}</code>
          </pre>
        </div>
      );
    }
    
    const lines = part.split("\n");
    return (
      <div key={index} className="space-y-1.5 w-full max-w-full">
        {lines.map((line, lIdx) => {
          if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
            return (
              <li key={lIdx} className="ml-4 list-disc pl-1">
                {renderInlineStyles(line.trim().substring(2))}
              </li>
            );
          }
          return (
            <p key={lIdx} className="break-words">
              {renderInlineStyles(line)}
            </p>
          );
        })}
      </div>
    );
  });
};

const renderInlineStyles = (text: string) => {
  const boldParts = text.split(/(\*\*.*?\*\*)/g);
  return boldParts.map((bPart, bIdx) => {
    if (bPart.startsWith("**") && bPart.endsWith("**")) {
      const inner = bPart.slice(2, -2);
      return <strong key={bIdx} className="font-bold">{inner}</strong>;
    }
    const codeParts = bPart.split(/(`.*?`)/g);
    return codeParts.map((cPart, cIdx) => {
      if (cPart.startsWith("`") && cPart.endsWith("`")) {
        return <code key={cIdx} className="px-1.5 py-0.5 rounded bg-muted/75 text-xs font-mono">{cPart.slice(1, -1)}</code>;
      }
      return cPart;
    });
  });
};

const DecoyChat: React.FC<DecoyChatProps> = ({ skin, unlockHash, onUnlock }) => {
  const [currentSkin, setCurrentSkin] = useState<DecoySkin>(skin);
  const [chats, setChats] = useState<DecoyChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load chats from localStorage or create a default session
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_CHATS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChats(parsed);
          setActiveChatId(parsed[0].id);
          const activeSkin = parsed[0].skin;
          if (activeSkin) setCurrentSkin(activeSkin);
          return;
        }
      } catch (e) {
        console.error("Error parsing decoy chats", e);
      }
    }
    const defaultChat = createDefaultChat(skin);
    setChats([defaultChat]);
    setActiveChatId(defaultChat.id);
  }, []);

  // Save chats to localStorage
  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_CHATS_KEY, JSON.stringify(chats));
    }
  }, [chats]);

  // Scroll to bottom on message updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, thinking, activeChatId]);

  const createDefaultChat = (skinType: DecoySkin): DecoyChatSession => {
    const cfg = DECOY_SKINS[skinType] ?? DECOY_SKINS.chatgpt;
    return {
      id: `decoy_${Date.now()}`,
      title: "New Chat",
      skin: skinType,
      messages: [...cfg.seed],
      createdAt: Date.now()
    };
  };

  const handleNewChat = () => {
    const newSession = createDefaultChat(currentSkin);
    setChats(prev => [newSession, ...prev]);
    setActiveChatId(newSession.id);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const deleteChat = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    const nextChats = chats.filter(c => c.id !== chatId);
    if (nextChats.length === 0) {
      const defaultChat = createDefaultChat(currentSkin);
      setChats([defaultChat]);
      setActiveChatId(defaultChat.id);
    } else {
      setChats(nextChats);
      if (activeChatId === chatId) {
        setActiveChatId(nextChats[0].id);
        setCurrentSkin(nextChats[0].skin);
      }
    }
  };

  const selectChat = (chatId: string) => {
    setActiveChatId(chatId);
    const selected = chats.find(c => c.id === chatId);
    if (selected) {
      setCurrentSkin(selected.skin);
    }
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const send = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Secret unlock trigger
    if (await matchesCode(trimmed, unlockHash)) {
      setText("");
      onUnlock();
      return;
    }

    const activeChat = chats.find(c => c.id === activeChatId);
    if (!activeChat) return;

    const userMessage = { role: "user" as const, content: trimmed };
    const nextMessages = [...activeChat.messages, userMessage];

    let newTitle = activeChat.title;
    if (activeChat.title === "New Chat" && activeChat.messages.length <= 4) {
      newTitle = trimmed.length > 22 ? trimmed.substring(0, 22) + "..." : trimmed;
    }

    // Update active chat locally
    setChats(prev => prev.map(c => {
      if (c.id === activeChatId) {
        return {
          ...c,
          title: newTitle,
          skin: currentSkin,
          messages: nextMessages
        };
      }
      return c;
    }));

    setText("");
    setThinking(true);

    try {
      const { data } = await supabase.functions.invoke("ai-decoy-bot", {
        body: { messages: nextMessages, persona: currentSkin },
      });
      const reply = (data as any)?.reply ?? "Sorry, I couldn't process that right now.";
      
      setChats(prev => prev.map(c => {
        if (c.id === activeChatId) {
          return {
            ...c,
            messages: [...nextMessages, { role: "assistant" as const, content: reply }]
          };
        }
        return c;
      }));
    } catch {
      setChats(prev => prev.map(c => {
        if (c.id === activeChatId) {
          return {
            ...c,
            messages: [...nextMessages, { role: "assistant" as const, content: "Sorry, something went wrong. Please try again." }]
          };
        }
        return c;
      }));
    } finally {
      setThinking(false);
    }
  }, [text, chats, activeChatId, unlockHash, onUnlock, currentSkin]);

  // Skin configs for high-fidelity rendering
  const cfg = useMemo(() => {
    if (currentSkin === "gemini") {
      return {
        id: "gemini" as const,
        name: "Gemini",
        logo: <GeminiLogo />,
        headerBg: "bg-[#131314] text-[#e3e3e3] border-b border-white/5",
        pageBg: "bg-[#0f0f11]",
        sidebarBg: "bg-[#1e1f20]",
        sidebarText: "text-[#e3e3e3]",
        accentBg: "bg-[#1a73e8] hover:bg-[#1557b0]",
        accentText: "text-white",
        inputContainerBg: "bg-[#1e1f20]",
        inputText: "text-[#e3e3e3]",
        bubbleBotBg: "bg-transparent",
        bubbleBotText: "text-[#e3e3e3]",
        bubbleUserBg: "bg-[#2d2f31]",
        bubbleUserText: "text-[#e3e3e3]",
        placeholder: "Ask Gemini...",
        greeting: "Hello, Friend",
        suggestions: [
          "Explain the carbon cycle in simple terms",
          "Suggest wholesome Indian teenage movies",
          "Draft a sweet thank you note for my bestie",
          "Help me study for board exams"
        ]
      };
    } else if (currentSkin === "claude") {
      return {
        id: "claude" as const,
        name: "Claude 3.5 Sonnet",
        logo: <ClaudeLogo />,
        headerBg: "bg-[#f5f4ef] text-[#191919] border-b border-[#e5e2d9]",
        pageBg: "bg-[#f9f8f6]",
        sidebarBg: "bg-[#f0ede4]",
        sidebarText: "text-[#191919]",
        accentBg: "bg-[#d97757] hover:bg-[#c05e3a]",
        accentText: "text-white",
        inputContainerBg: "bg-white border border-[#e5e2d9] shadow-xs",
        inputText: "text-[#191919]",
        bubbleBotBg: "bg-white border border-[#e5e2d9] shadow-xs text-[#191919]",
        bubbleBotText: "text-[#191919]",
        bubbleUserBg: "bg-[#f0ede4] text-[#191919]",
        bubbleUserText: "text-[#191919]",
        placeholder: "Message Claude...",
        greeting: "How can I help you today?",
        suggestions: [
          "Recommend 3 books on building good habits",
          "Tell me a short school lunch story",
          "Write a simple Python script to solve Sudoku",
          "Create a weekend trip plan in India"
        ]
      };
    } else {
      // ChatGPT
      return {
        id: "chatgpt" as const,
        name: "ChatGPT 4o",
        logo: <ChatGPTLogo />,
        headerBg: "bg-[#212121] text-[#ececec] border-b border-white/5",
        pageBg: "bg-[#212121]",
        sidebarBg: "bg-[#171717]",
        sidebarText: "text-[#ececec]",
        accentBg: "bg-[#ececec] hover:bg-[#d0d0d0]",
        accentText: "text-[#212121]",
        inputContainerBg: "bg-[#2f2f2f]",
        inputText: "text-[#ececec]",
        bubbleBotBg: "bg-transparent",
        bubbleBotText: "text-[#ececec]",
        bubbleUserBg: "bg-[#2f2f2f]",
        bubbleUserText: "text-[#ececec]",
        placeholder: "Message ChatGPT...",
        greeting: "How can I help you today?",
        suggestions: [
          "Explain recursive functions in coding",
          "Suggest clean Bollywood romance movies",
          "Draft a polite email asking for notes",
          "Create a 10-day workout split"
        ]
      };
    }
  }, [currentSkin]);

  const activeChat = chats.find(c => c.id === activeChatId);
  const activeMessages = activeChat?.messages ?? [];

  const renderSuggestions = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full px-4 mt-6">
        {cfg.suggestions.map((s, idx) => (
          <button
            key={idx}
            onClick={() => {
              setText(s);
            }}
            className={`p-4 rounded-2xl text-left text-xs transition-all border ${
              currentSkin === "claude"
                ? "bg-white border-[#e5e2d9] hover:bg-[#f5f4ef] text-[#191919]"
                : currentSkin === "gemini"
                ? "bg-[#1e1f20] border-transparent hover:bg-[#2d2f31] text-[#e3e3e3]"
                : "bg-transparent border-[#424242] hover:bg-[#2f2f2f] text-[#ececec]"
            }`}
          >
            <span className="font-semibold block truncate">{s}</span>
            <span className="text-[10px] opacity-60 mt-1 block">Click to try prompt</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className={`flex h-dvh w-full overflow-hidden`} style={{ fontFamily: currentSkin === "claude" ? "Georgia, serif" : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      
      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 flex w-66 flex-col border-r transition-transform duration-250 md:static md:translate-x-0 ${cfg.sidebarBg} ${cfg.sidebarText} ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:hidden"
        } ${currentSkin === "claude" ? "border-[#e5e2d9]" : "border-white/5"}`}
      >
        {/* Sidebar Header */}
        <div className="p-3.5 flex items-center justify-between">
          <button 
            onClick={handleNewChat}
            className={`flex-1 flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
              currentSkin === "claude" 
                ? "border-[#e5e2d9] hover:bg-[#f5f4ef] bg-[#fdfdfc] text-[#191919]"
                : currentSkin === "gemini"
                ? "border-transparent bg-[#1a73e8]/10 text-[#1a73e8] hover:bg-[#1a73e8]/20"
                : "border-white/10 hover:bg-[#212121] text-white"
            }`}
          >
            <Plus className="h-4 w-4" />
            New Chat
          </button>
          
          <button 
            onClick={() => setSidebarOpen(false)}
            className={`p-2 ml-1 rounded-lg md:flex hidden hover:opacity-80 transition-opacity`}
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
          <p className="text-[10px] font-bold opacity-45 px-3 uppercase tracking-wider mb-2">Recent Chats</p>
          
          {chats.map(item => {
            const isActive = item.id === activeChatId;
            return (
              <div
                key={item.id}
                onClick={() => selectChat(item.id)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                  isActive
                    ? currentSkin === "claude" ? "bg-[#e5e2d9] text-[#191919]" : currentSkin === "gemini" ? "bg-[#2d2f31] text-white" : "bg-[#212121] text-white"
                    : currentSkin === "claude" ? "hover:bg-[#e5e2d9]/40 text-[#191919]/80" : "hover:bg-[#212121]/50 text-[#ececec]/80"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare className="h-3.5 w-3.5 opacity-60 shrink-0" />
                  <span className="truncate">{item.title}</span>
                </div>
                
                <button
                  onClick={(e) => deleteChat(e, item.id)}
                  className={`opacity-0 group-hover:opacity-100 p-1 rounded-md transition-opacity ${
                    currentSkin === "claude" ? "hover:bg-[#f5f4ef] text-[#191919]/60" : "hover:bg-[#2f2f2f] text-white/60"
                  }`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer with Bot / Skin Switcher */}
        <div className={`p-3 border-t ${currentSkin === "claude" ? "border-[#e5e2d9]" : "border-white/5"}`}>
          <div className="space-y-2">
            <span className="text-[10px] font-bold opacity-45 uppercase tracking-wider block">Switch Persona</span>
            <div className="grid grid-cols-3 gap-1 bg-black/15 p-1 rounded-lg">
              {(["chatgpt", "gemini", "claude"] as const).map(botSkin => {
                const isSelected = currentSkin === botSkin;
                return (
                  <button
                    key={botSkin}
                    onClick={() => {
                      setCurrentSkin(botSkin);
                      setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, skin: botSkin } : c));
                    }}
                    className={`py-1 text-[10px] font-semibold rounded-md transition-all uppercase ${
                      isSelected
                        ? currentSkin === "claude" ? "bg-[#d97757] text-white" : currentSkin === "gemini" ? "bg-[#1a73e8] text-white" : "bg-[#ececec] text-[#212121]"
                        : currentSkin === "claude" ? "text-[#191919]/60 hover:bg-[#e5e2d9]/40" : "text-[#ececec]/60 hover:bg-[#212121]/50"
                    }`}
                  >
                    {botSkin === "chatgpt" ? "GPT" : botSkin === "gemini" ? "Gemini" : "Claude"}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Container */}
      <main className={`flex-1 flex flex-col h-full overflow-hidden ${cfg.pageBg}`}>
        
        {/* Header */}
        <header className={`flex items-center justify-between px-4 py-3 shrink-0 h-[56px] ${cfg.headerBg}`}>
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg hover:opacity-85 transition-opacity"
              >
                <PanelLeft className="h-4.5 w-4.5" />
              </button>
            )}
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight">{cfg.name}</span>
              <ChevronDown className="h-3 w-3 opacity-60 mt-0.5" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleNewChat}
              className={`p-1.5 rounded-lg hover:opacity-85 transition-opacity`}
            >
              <Plus className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>

        {/* Messages list */}
        <div className={`flex-1 overflow-y-auto px-4 py-6 scrollbar-thin flex flex-col`}>
          <div className="max-w-2.5xl mx-auto flex flex-col gap-6 w-full flex-1 justify-center">
            
            {/* Empty state brand welcome screen */}
            {activeMessages.length === 0 ? (
              <div className="flex flex-col items-center text-center justify-center my-auto py-10 w-full">
                {currentSkin === "chatgpt" && (
                  <div className="flex flex-col items-center">
                    <ChatGPTLogo className="h-12 w-12" />
                    <h3 className="text-xl font-bold text-white mt-4">{cfg.greeting}</h3>
                  </div>
                )}
                {currentSkin === "gemini" && (
                  <div className="flex flex-col items-start text-left w-full px-4">
                    <h3 className="text-4xl font-semibold bg-gradient-to-r from-[#9b72cb] via-[#d96570] to-[#f39f76] bg-clip-text text-transparent leading-snug animate-pulse">
                      {cfg.greeting}
                    </h3>
                    <p className="text-lg font-medium text-[#c4c7c5] mt-1">What can I help you with today?</p>
                  </div>
                )}
                {currentSkin === "claude" && (
                  <div className="flex flex-col items-center">
                    <h3 className="text-3xl font-serif text-[#d97757] tracking-tight">Claude</h3>
                    <p className="text-md text-[#191919]/60 font-serif mt-1">{cfg.greeting}</p>
                  </div>
                )}
                
                {renderSuggestions()}
              </div>
            ) : (
              <div className="flex flex-col gap-6 w-full self-start justify-start my-0">
                {/* Conversation Messages */}
                {activeMessages.map((m, i) => {
                  const isBot = m.role === "assistant";
                  return (
                    <div key={i} className={`flex items-start gap-3.5 w-full max-w-full ${isBot ? "" : "flex-row-reverse"}`}>
                      
                      {/* Avatar */}
                      <div className="shrink-0 mt-0.5">
                        {isBot ? (
                          currentSkin === "chatgpt" ? <ChatGPTLogo className="h-7 w-7" /> : currentSkin === "gemini" ? <GeminiLogo className="h-7 w-7" /> : <ClaudeLogo className="h-7 w-7" />
                        ) : (
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold select-none ${
                            currentSkin === "claude" ? "bg-[#e5e2d9] text-[#191919]" : "bg-primary/10 text-primary"
                          }`}>
                            U
                          </div>
                        )}
                      </div>

                      {/* Body Text */}
                      <div className={`flex flex-col max-w-[82%] ${isBot ? "items-start" : "items-end"}`}>
                        <div
                          className={`text-[14px] leading-relaxed rounded-2xl px-4 py-2.5 ${
                            isBot 
                              ? `${cfg.bubbleBotBg} ${cfg.bubbleBotText} w-full` 
                              : `${cfg.bubbleUserBg} ${cfg.bubbleUserText}`
                          }`}
                        >
                          {formatDecoyText(m.content)}
                        </div>
                      </div>

                    </div>
                  );
                })}

                {/* Thinking / typing spinner */}
                {thinking && (
                  <div className="flex items-start gap-3.5 w-full">
                    <div className="shrink-0 mt-0.5">
                      {currentSkin === "chatgpt" ? <ChatGPTLogo className="h-7 w-7" /> : currentSkin === "gemini" ? <GeminiLogo className="h-7 w-7" /> : <ClaudeLogo className="h-7 w-7" />}
                    </div>
                    <div className={`rounded-2xl px-4 py-3 shrink-0 ${cfg.bubbleBotBg}`}>
                      <span className="inline-flex gap-1.5 items-center">
                        <span className={`h-1.5 w-1.5 animate-bounce rounded-full opacity-60 ${currentSkin === "claude" ? "bg-[#191919]" : "bg-white"}`} style={{ animationDelay: "0ms" }} />
                        <span className={`h-1.5 w-1.5 animate-bounce rounded-full opacity-60 ${currentSkin === "claude" ? "bg-[#191919]" : "bg-white"}`} style={{ animationDelay: "150ms" }} />
                        <span className={`h-1.5 w-1.5 animate-bounce rounded-full opacity-60 ${currentSkin === "claude" ? "bg-[#191919]" : "bg-white"}`} style={{ animationDelay: "300ms" }} />
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div ref={bottomRef} className="h-2" />
          </div>
        </div>

        {/* Text Input area */}
        <div className={`px-4 pb-5 pt-2 shrink-0 max-w-3xl w-full mx-auto`}>
          <div
            className={`flex items-end gap-2 rounded-2xl px-3 py-2 ${cfg.inputContainerBg}`}
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={cfg.placeholder}
              className={`max-h-36 flex-1 resize-none border-0 bg-transparent px-2.5 py-2 text-sm outline-none ${cfg.inputText}`}
            />
            
            <button
              onClick={send}
              disabled={!text.trim()}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-opacity disabled:opacity-25 ${cfg.accentBg}`}
            >
              <ArrowUp className={`h-4.5 w-4.5 ${currentSkin === "chatgpt" ? "text-[#212121]" : "text-white"}`} />
            </button>
          </div>
          
          <p className="text-[10px] text-center opacity-40 mt-2 font-medium tracking-tight">
            {cfg.name} can make mistakes. Verify important info.
          </p>
        </div>

      </main>
    </div>
  );
};

export default DecoyChat;
