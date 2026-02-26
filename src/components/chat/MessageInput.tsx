import React, { useState, useRef, useCallback } from "react";
import { Send, Paperclip, Smile, Clock, Heart, Plus, X, Lock, Mail, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import MediaPanel from "./MediaPanel";
import ReplyPreview from "./ReplyPreview";
import SchedulePicker from "./SchedulePicker";
import TouchReactionPicker from "./TouchReactionPicker";
import { TOUCH_EMOTIONS, type TouchEmotion } from "./TouchReactionOverlay";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import type { CustomReaction } from "@/pages/CustomTouchReactions";

interface MessageInputProps {
  onSend: (content: string, extras?: any) => Promise<any>;
  onTyping: () => void;
  userId: string;
  replyTo: Tables<"messages"> | null;
  onCancelReply: () => void;
  onOpenLetter?: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSend, onTyping, userId, replyTo, onCancelReply, onOpenLetter }) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showTouchReactions, setShowTouchReactions] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [secretMode, setSecretMode] = useState(false);
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
    toast({ title: "Message scheduled! ⏰" });
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
  }, [text, onSend, uploading, replyTo, onCancelReply]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");

    // Use documents bucket for non-image/video files, chat-images for media
    const bucket = isImage || isVideo || isAudio ? "chat-images" : "documents";

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      const extras: any = {};
      if (replyTo) extras.reply_to_id = replyTo.id;

      if (isAudio) {
        await onSend(text.trim() || "", {
          ...extras,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          message_type: "audio",
        });
      } else if (isVideo) {
        await onSend(text.trim() || "", { ...extras, video: true, vidUrl: urlData.publicUrl, message_type: "video" });
      } else if (isImage) {
        await onSend(text.trim() || "", { ...extras, image_url: urlData.publicUrl, message_type: "image" });
      } else {
        await onSend(text.trim() || "", {
          ...extras,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          message_type: "file",
        });
      }
      setText("");
      onCancelReply();
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
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

  const handleTouchReaction = useCallback(async (emotion: TouchEmotion) => {
    await onSend(emotion, {
      message_type: "touch_reaction",
    });
    setShowTouchReactions(false);
    toast({ title: `${TOUCH_EMOTIONS[emotion].emoji} Sent a ${TOUCH_EMOTIONS[emotion].label}!` });
  }, [onSend]);

  const handleCustomTouchReaction = useCallback(async (reaction: CustomReaction) => {
    await onSend(`custom:${reaction.id}`, {
      message_type: "touch_reaction",
    });
    setShowTouchReactions(false);
    toast({ title: `${reaction.emoji?.startsWith("http") ? "✨" : reaction.emoji} Sent a ${reaction.label}!` });
  }, [onSend]);

  return (
    <div className="shrink-0">
      {replyTo && <ReplyPreview message={replyTo} onCancel={onCancelReply} />}

      {showMedia && (
        <div className="px-3 pb-1 relative">
          <button onClick={() => setShowMedia(false)} className="absolute top-1 right-4 z-10 h-6 w-6 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <MediaPanel onEmojiSelect={handleEmojiSelect} onGifSelect={handleGifSelect} onStickerSelect={handleStickerSelect} />
        </div>
      )}

      {showSchedule && (
        <div className="px-3 pb-1 relative">
          <button onClick={() => setShowSchedule(false)} className="absolute top-1 right-4 z-10 h-6 w-6 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <SchedulePicker onSchedule={handleSchedule} onClose={() => setShowSchedule(false)} />
        </div>
      )}

      {showTouchReactions && (
        <div className="px-3 pb-1 relative">
          <button onClick={() => setShowTouchReactions(false)} className="absolute top-1 right-4 z-10 h-6 w-6 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <TouchReactionPicker onSelect={handleTouchReaction} onSelectCustom={handleCustomTouchReaction} />
        </div>
      )}

      {showMore && (
        <div className="px-3 pb-1">
          <div className="flex gap-2 bg-card border border-border rounded-2xl p-2 shadow-lg animate-scale-in items-center">
            <button
              onClick={() => { fileInputRef.current?.click(); setShowMore(false); }}
              className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-muted/70 transition-colors"
            >
              <Paperclip className="h-5 w-5 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground">File</span>
            </button>
            <button
              onClick={() => { setShowTouchReactions(!showTouchReactions); setShowMore(false); setShowSchedule(false); setShowMedia(false); }}
              className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-muted/70 transition-colors"
            >
              <Heart className="h-5 w-5 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground">Touch</span>
            </button>
            <button
              onClick={() => { setShowSchedule(!showSchedule); setShowMore(false); setShowTouchReactions(false); setShowMedia(false); }}
              className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-muted/70 transition-colors"
            >
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground">Schedule</span>
            </button>
            <button
              onClick={() => { onOpenLetter?.(); setShowMore(false); }}
              className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-muted/70 transition-colors"
            >
              <Mail className="h-5 w-5 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground">Letter</span>
            </button>
            <button
              onClick={() => {
                (window as any).__skyLanternComposer?.show?.();
                setShowMore(false);
              }}
              className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-muted/70 transition-colors"
            >
              <Flame className="h-5 w-5 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground">Lantern</span>
            </button>
            <button onClick={() => setShowMore(false)} className="ml-auto h-6 w-6 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2 px-3 py-3 bg-card border-t border-border">
        <button
          onClick={() => { setShowMore(!showMore); if (showMore) { setShowTouchReactions(false); setShowSchedule(false); } }}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
            showMore ? "bg-primary/10 text-primary rotate-45" : "hover:bg-muted text-muted-foreground"
          }`}
        >
          <Plus className="h-5 w-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv"
          onChange={handleFileUpload}
          className="hidden"
        />

        <button
          onClick={() => { setShowMedia(!showMedia); setShowMore(false); setShowTouchReactions(false); setShowSchedule(false); }}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
            showMedia ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"
          }`}
        >
          <Smile className="h-5 w-5" />
        </button>

        <div className="flex-1 relative">
          {secretMode && (
            <div className="absolute -top-6 left-2 text-[10px] text-primary font-medium flex items-center gap-1 animate-fade-in">
              <Lock className="h-3 w-3" /> Secret message mode
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => { setText(e.target.value); adjustHeight(); onTyping(); }}
            onKeyDown={handleKeyDown}
            placeholder={secretMode ? "Write a secret message..." : "Type a message..."}
            rows={1}
            className={`w-full resize-none rounded-2xl border-0 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 scrollbar-thin ${
              secretMode ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/50"
            }`}
            style={{ maxHeight: 120 }}
          />
        </div>

        <button
          onClick={() => setSecretMode(!secretMode)}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
            secretMode ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
          }`}
          title="Secret message"
        >
          <Lock className="h-4 w-4" />
        </button>

        <button
          onClick={handleSend}
          disabled={(!text.trim() && !uploading) || sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40 transition-all hover:opacity-90 active:scale-95"
        >
          <Send className="h-4.5 w-4.5" />
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
