import React, { useState, useRef, useCallback } from "react";
import { Send, Paperclip, Smile, Clock, Heart, Plus, X, Lock, Mail, Flame, Handshake, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import MediaPanel from "./MediaPanel";
import ReplyPreview from "./ReplyPreview";
import SchedulePicker from "./SchedulePicker";
import TouchReactionPicker from "./TouchReactionPicker";
import { TOUCH_EMOTIONS, type TouchEmotion } from "./TouchReactionOverlay";
import { toast } from "@/hooks/use-toast";
import { SECRET_COMMANDS } from "@/lib/secretCommands";
import type { Tables } from "@/integrations/supabase/types";
import type { CustomReaction } from "@/pages/CustomTouchReactions";
import { VoiceNoteRecorder, MicButton } from "./VoiceNoteRecorder";

interface MessageInputProps {
  onSend: (content: string, extras?: any) => Promise<any>;
  onTyping: () => void;
  userId: string;
  replyTo: Tables<"messages"> | null;
  onCancelReply: () => void;
  onOpenLetter?: () => void;
  onOpenProposal?: () => void;
  onComposeHelp?: (draft: string) => Promise<string | null>;
  placeholder?: string;
  secretPlaceholder?: string;
  sendLabel?: string;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSend, onTyping, userId, replyTo, onCancelReply, onOpenLetter, onOpenProposal, onComposeHelp, placeholder = "Type a message...", secretPlaceholder = "Write a secret message...", sendLabel }) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [composing, setComposing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showTouchReactions, setShowTouchReactions] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [secretMode, setSecretMode] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSchedule = useCallback(async (date: Date) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const { data: userStatus } = await supabase
      .from("user_status")
      .select("name")
      .eq("user_id", userId)
      .maybeSingle();
    const extras: any = {};
    if (replyTo) extras.reply_to_id = replyTo.id;
    await supabase.from("scheduled_messages").insert({
      user_id: userId,
      username: userStatus?.name ?? "User",
      content: trimmed,
      send_at: date.toISOString(),
      extras,
    } as any);
    setText("");
    onCancelReply();
    setShowSchedule(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    toast({ title: "Message scheduled! â°" });
  }, [text, userId, replyTo, onCancelReply]);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }
  };

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed && !uploading) return;
    setSending(true);
    const extras: any = {};
    if (replyTo) extras.reply_to_id = replyTo.id;
    if (secretMode) extras.message_type = "secret";
    await onSend(trimmed, extras);
    setSecretMode(false);
    setText("");
    onCancelReply();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSending(false);
    setShowMedia(false);
    textareaRef.current?.focus();
  }, [text, onSend, uploading, replyTo, onCancelReply, secretMode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Slash-command suggestions (/flip, /dice, â€¦)
  const commandQuery = text.startsWith("/") ? text.slice(1).toLowerCase() : null;
  const matchedCommands =
    commandQuery !== null
      ? SECRET_COMMANDS.filter((c) => c.cmd.slice(1).startsWith(commandQuery))
      : [];

  const runCommand = useCallback(async (cmd: string) => {
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await onSend(cmd, {});
  }, [onSend]);

  const handleComposeHelp = useCallback(async () => {
    if (!onComposeHelp || composing) return;
    setComposing(true);
    const suggestion = await onComposeHelp(text.trim());
    if (suggestion) {
      setText(suggestion);
      setTimeout(adjustHeight, 0);
    }
    setComposing(false);
    textareaRef.current?.focus();
  }, [onComposeHelp, composing, text]);

  const uploadAndSendFile = async (file: File) => {
    setUploading(true);
    let fileExt = file.name ? file.name.split(".").pop() : "";
    if (!fileExt || fileExt === file.name) {
      if (file.type === "image/gif") fileExt = "gif";
      else if (file.type === "image/png") fileExt = "png";
      else if (file.type === "image/jpeg") fileExt = "jpg";
      else if (file.type.startsWith("image/")) fileExt = "png";
      else fileExt = "bin";
    }
    const filePath = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");

    const bucket = isImage || isVideo || isAudio ? "chat-images" : "documents";

    const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      const extras: any = {};
      if (replyTo) extras.reply_to_id = replyTo.id;

      const isGif = file.type === "image/gif" || fileExt === "gif";

      if (isAudio) {
        await onSend(text.trim() || "", { ...extras, file_url: urlData.publicUrl, file_name: file.name || `audio.${fileExt}`, file_type: file.type, file_size: file.size, message_type: "audio" });
      } else if (isVideo) {
        await onSend(text.trim() || "", { ...extras, video: true, vidUrl: urlData.publicUrl, message_type: "video" });
      } else if (isGif) {
        await onSend(text.trim() || "", { ...extras, gif_url: urlData.publicUrl, message_type: "gif" });
      } else if (isImage) {
        await onSend(text.trim() || "", { ...extras, image_url: urlData.publicUrl, message_type: "image" });
      } else {
        await onSend(text.trim() || "", { ...extras, file_url: urlData.publicUrl, file_name: file.name || `file.${fileExt}`, file_type: file.type, file_size: file.size, message_type: "file" });
      }
      setText("");
      onCancelReply();
    } else {
      toast({ title: "Failed to upload file ðŸ˜¢", description: uploadError.message, variant: "destructive" });
    }

    setUploading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadAndSendFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    let fileToUpload: File | null = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          fileToUpload = file;
          break;
        }
      }
    }

    if (fileToUpload) {
      e.preventDefault();
      await uploadAndSendFile(fileToUpload);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setText((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleGifSelect = async (gifUrl: string) => {
    const extras: any = { gif_url: gifUrl, message_type: "gif" };
    if (replyTo) extras.reply_to_id = replyTo.id;
    await onSend("", extras);
    setShowMedia(false);
    onCancelReply();
  };

  const handleStickerSelect = async (stickerUrl: string) => {
    const extras: any = { sticker_url: stickerUrl, message_type: "sticker" };
    if (replyTo) extras.reply_to_id = replyTo.id;
    await onSend("", extras);
    setShowMedia(false);
    onCancelReply();
  };

  const handleVideoSelect = async (videoUrl: string) => {
    const extras: any = { video: true, vidUrl: videoUrl, message_type: "video" };
    if (replyTo) extras.reply_to_id = replyTo.id;
    await onSend("", extras);
    setShowMedia(false);
    onCancelReply();
  };

  const handleTouchReaction = useCallback(async (emotion: TouchEmotion) => {
    await onSend(emotion, { message_type: "touch_reaction" });
    setShowTouchReactions(false);
    toast({ title: `${TOUCH_EMOTIONS[emotion].emoji} Sent a ${TOUCH_EMOTIONS[emotion].label}!` });
  }, [onSend]);

  const handleCustomTouchReaction = useCallback(async (reaction: CustomReaction) => {
    await onSend(`custom:${reaction.id}`, { message_type: "touch_reaction" });
    setShowTouchReactions(false);
    toast({ title: `${reaction.emoji?.startsWith("http") ? "âœ¨" : reaction.emoji} Sent a ${reaction.label}!` });
  }, [onSend]);

  const closeAll = () => { setShowMore(false); setShowTouchReactions(false); setShowSchedule(false); setShowMedia(false); };

  return (
    <div className="shrink-0">
      {replyTo && <ReplyPreview message={replyTo} onCancel={onCancelReply} />}

      {/* Voice recorder overlay — replaces the entire input bar while active */}
      <AnimatePresence mode="wait">
        {showVoiceRecorder ? (
          <VoiceNoteRecorder
            key="voice-recorder"
            onSend={onSend}
            replyToId={replyTo?.id}
            onDone={() => { setShowVoiceRecorder(false); onCancelReply(); }}
          />
        ) : (
          <div key="normal-input">
            {/* Slide-up panels */}
            <AnimatePresence>
              {showMedia && (
                <motion.div key="media" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="px-3 pb-1 relative overflow-hidden">
                  <button onClick={() => setShowMedia(false)} className="absolute top-1 right-4 z-10 h-6 w-6 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  <MediaPanel onEmojiSelect={handleEmojiSelect} onGifSelect={handleGifSelect} onStickerSelect={handleStickerSelect} onVideoSelect={handleVideoSelect} draft={text} />
                </motion.div>
              )}
              {showSchedule && (
                <motion.div key="schedule" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="px-3 pb-1 relative overflow-hidden">
                  <button onClick={() => setShowSchedule(false)} className="absolute top-1 right-4 z-10 h-6 w-6 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  <SchedulePicker onSchedule={handleSchedule} onClose={() => setShowSchedule(false)} />
                </motion.div>
              )}
              {showTouchReactions && (
                <motion.div key="touch" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="px-3 pb-1 relative overflow-hidden">
                  <button onClick={() => setShowTouchReactions(false)} className="absolute top-1 right-4 z-10 h-6 w-6 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  <TouchReactionPicker onSelect={handleTouchReaction} onSelectCustom={handleCustomTouchReaction} />
                </motion.div>
              )}
              {showMore && (
                <motion.div key="more" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="px-3 pb-1 overflow-hidden">
                  <div className="flex gap-1.5 glass rounded-[20px] p-2 shadow-lg items-center">
                    <MoreBtn icon={<Paperclip className="h-5 w-5" />} label="File" onClick={() => { fileInputRef.current?.click(); closeAll(); }} />
                    <MoreBtn icon={<Heart className="h-5 w-5" />} label="Touch" onClick={() => { closeAll(); setShowTouchReactions(true); }} />
                    <MoreBtn icon={<Clock className="h-5 w-5" />} label="Schedule" onClick={() => { closeAll(); setShowSchedule(true); }} />
                    <MoreBtn icon={<Mail className="h-5 w-5" />} label="Letter" onClick={() => { onOpenLetter?.(); closeAll(); }} />
                    <MoreBtn icon={<Handshake className="h-5 w-5" />} label="Pact" onClick={() => { onOpenProposal?.(); closeAll(); }} />
                    <MoreBtn icon={<Flame className="h-5 w-5" />} label="Lantern" onClick={() => { (window as any).__skyLanternComposer?.show?.(); closeAll(); }} />
                    <button onClick={() => setShowMore(false)} className="ml-auto h-6 w-6 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted transition-colors"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Slash command suggestions */}
            <AnimatePresence>
              {matchedCommands.length > 0 && (
                <motion.div key="cmd-suggest" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.16 }} className="px-3 pb-1.5">
                  <div className="glass rounded-[18px] p-1.5 shadow-lg">
                    {matchedCommands.map((c) => (
                      <button key={c.cmd} onClick={() => runCommand(c.cmd)} className="flex items-center gap-3 w-full px-3 py-2 rounded-[12px] hover:bg-muted/60 transition-colors text-left tappable">
                        <span className="text-xl">{c.emoji}</span>
                        <span className="text-[14px] font-semibold text-foreground">{c.cmd}</span>
                        <span className="text-[12px] text-muted-foreground">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main input bar */}
            <div className="glass-chat-input flex items-end gap-2 px-3 py-2.5">
              <motion.button whileTap={{ scale: 0.88, rotate: showMore ? -45 : 0 }} onClick={() => { setShowMore(!showMore); if (showMore) { setShowTouchReactions(false); setShowSchedule(false); } }} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${showMore ? "bg-primary/10 text-primary" : "hover:bg-muted/60 text-muted-foreground"}`} style={{ transform: showMore ? "rotate(45deg)" : undefined }}>
                <Plus className="h-5 w-5" />
              </motion.button>

              <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv" onChange={handleFileUpload} className="hidden" />

              <motion.button whileTap={{ scale: 0.88 }} onClick={() => { setShowMedia(!showMedia); closeAll(); if (!showMedia) setShowMedia(true); }} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${showMedia ? "bg-primary/10 text-primary" : "hover:bg-muted/60 text-muted-foreground"}`}>
                <Smile className="h-5 w-5" />
              </motion.button>

              <div className="flex-1 relative">
                <AnimatePresence>
                  {secretMode && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="absolute -top-6 left-2 text-[10px] text-primary font-medium flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Secret message mode
                    </motion.div>
                  )}
                </AnimatePresence>
                <textarea ref={textareaRef} value={text} onChange={(e) => { setText(e.target.value); adjustHeight(); onTyping(); }} onKeyDown={handleKeyDown} onPaste={handlePaste} placeholder={secretMode ? secretPlaceholder : placeholder} rows={1} className={`w-full resize-none rounded-[20px] border-0 px-4 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/20 scrollbar-thin transition-all ${secretMode ? "bg-primary/8 ring-1 ring-primary/20" : "bg-muted/50 ring-1 ring-border/40"}`} style={{ maxHeight: 120 }} />
              </div>

              <motion.button whileTap={{ scale: 0.88 }} onClick={() => setSecretMode(!secretMode)} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${secretMode ? "bg-primary text-primary-foreground" : "hover:bg-muted/60 text-muted-foreground"}`} title="Secret message">
                <Lock className="h-4 w-4" />
              </motion.button>

              {/* Send ↔ Mic animated swap */}
              <AnimatePresence mode="wait" initial={false}>
                {text.trim() || uploading ? (
                  <motion.button key="send" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ type: "spring", stiffness: 500, damping: 28 }} whileTap={{ scale: 0.88 }} whileHover={{ scale: 1.05 }} onClick={handleSend} disabled={(!text.trim() && !uploading) || sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-30 transition-all shadow-sm shadow-primary/20">
                    <Send className="h-[18px] w-[18px]" />
                  </motion.button>
                ) : (
                  <motion.div key="mic" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ type: "spring", stiffness: 500, damping: 28 }}>
                    <MicButton onClick={() => { closeAll(); setShowVoiceRecorder(true); }} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};


const MoreBtn: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <motion.button
    whileTap={{ scale: 0.9 }}
    onClick={onClick}
    className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-muted/50 transition-colors text-muted-foreground"
  >
    {icon}
    <span className="text-[9px]">{label}</span>
  </motion.button>
);

export default MessageInput;