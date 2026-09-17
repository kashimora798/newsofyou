/**
 * VoiceNoteRecorder
 *
 * UX:
 *  - Single tap  → starts recording (locked mode — hands free)
 *  - While recording: animated waveform + timer + X cancel button shown
 *  - Tap mic again (or release after hold) → stops and sends
 *  - X button → cancels and discards recording
 *  - Supports webm (Android/Chrome) + mp4 (iOS Safari) automatically
 *
 * Noise Cancellation Pipeline (no voice modulation):
 *  getUserMedia (noiseSuppression + echoCancellation + autoGainControl)
 *    → AudioContext HighPass filter (cuts rumble below 80 Hz)
 *    → DynamicsCompressor (smooths volume fluctuations)
 *    → MediaRecorder (records the cleaned stream)
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// ─── Audio format detection ────────────────────────────────────────────────────

function getSupportedMimeType(): string {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function getFileExtension(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "mp4";
  return "audio";
}

// ─── Waveform bar animation ────────────────────────────────────────────────────

const BARS = 20;

const WaveformBars: React.FC<{ active: boolean }> = ({ active }) => (
  <div className="flex items-center gap-[2px] h-7">
    {Array.from({ length: BARS }).map((_, i) => (
      <motion.div
        key={i}
        className="w-[3px] rounded-full bg-primary"
        animate={
          active
            ? {
                scaleY: [0.3, Math.random() * 0.7 + 0.5, 0.3],
                opacity: [0.6, 1, 0.6],
              }
            : { scaleY: 0.2, opacity: 0.3 }
        }
        transition={
          active
            ? {
                duration: 0.5 + Math.random() * 0.4,
                repeat: Infinity,
                delay: (i / BARS) * 0.25,
                ease: "easeInOut",
              }
            : { duration: 0.2 }
        }
        style={{ height: "100%", originY: "center" }}
      />
    ))}
  </div>
);

// ─── Timer display ─────────────────────────────────────────────────────────────

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface VoiceNoteRecorderProps {
  onSend: (content: string, extras?: any) => Promise<any>;
  replyToId?: string;
  onRecordingChange?: (isRecording: boolean) => void;
  /** Called when recording UI closes (cancel or send) */
  onDone: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const VoiceNoteRecorder: React.FC<VoiceNoteRecorderProps> = ({
  onSend,
  replyToId,
  onRecordingChange,
  onDone,
}) => {
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mimeTypeRef = useRef<string>("");

  // Auto-start recording when component mounts
  useEffect(() => {
    startRecording();
    return () => stopStream();
  }, []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    // Close AudioContext to release audio resources
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const startRecording = async () => {
    try {
      // ── Step 1: Request mic with browser-native noise suppression ──────────
      // These constraints tell the browser's built-in audio processing to:
      //   • noiseSuppression  – filter out steady background noise (fans, AC, traffic)
      //   • echoCancellation  – remove room echo and reverb
      //   • autoGainControl   – stabilise volume so quiet parts aren't silent
      // These do NOT alter voice pitch or character — purely signal cleanup.
      const constraints: MediaStreamConstraints = {
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 1 }, // mono — more effective noise processing
        },
      };

      const rawStream = await navigator.mediaDevices.getUserMedia(constraints);

      // ── Step 2: AudioContext pipeline for additional acoustic cleanup ───────
      // Pipeline: Source → HighPass → DynamicsCompressor → Destination (stream)
      //
      //  HighPass filter:  cuts low-frequency rumble (handling noise, AC hum)
      //                    below 80 Hz without touching the voice band.
      //
      //  DynamicsCompressor: evens out sudden volume spikes / fluctuations
      //                      so the recording stays consistent throughout.
      //                      Uses a mild 4:1 ratio — not a voice changer.
      //
      // No pitch shift, no frequency modulation — pure dynamics/level control.
      const audioCtx = new AudioContext({ sampleRate: 48000 });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(rawStream);

      // High-pass filter — removes rumble below 80 Hz
      const highPass = audioCtx.createBiquadFilter();
      highPass.type = "highpass";
      highPass.frequency.value = 80;
      highPass.Q.value = 0.7;

      // Dynamics compressor — smooths volume fluctuations
      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.value = -24; // start compressing at -24 dB
      compressor.knee.value = 10;       // soft knee for natural transition
      compressor.ratio.value = 4;       // gentle 4:1 ratio
      compressor.attack.value = 0.003;  // 3 ms — fast enough to catch peaks
      compressor.release.value = 0.25;  // 250 ms — natural release

      // Wire up the processing chain and output to a new stream
      const destination = audioCtx.createMediaStreamDestination();
      source.connect(highPass);
      highPass.connect(compressor);
      compressor.connect(destination);

      // Record the processed (clean) stream, keep ref to raw for cleanup
      const processedStream = destination.stream;
      streamRef.current = rawStream;

      const mimeType = getSupportedMimeType();
      mimeTypeRef.current = mimeType;

      const mr = new MediaRecorder(processedStream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.start(100); // collect data every 100ms
      setRecording(true);
      setSeconds(0);
      onRecordingChange?.(true);

      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      console.error("[VoiceNoteRecorder] Mic access error:", err);
      onRecordingChange?.(false);
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to send voice notes.",
        variant: "destructive",
      });
      onDone();
    }
  };

  const stopAndSend = useCallback(async () => {
    if (!mediaRecorderRef.current || !recording) return;

    setSending(true);
    onRecordingChange?.(false);
    stopStream();

    await new Promise<void>((resolve) => {
      const mr = mediaRecorderRef.current!;
      mr.onstop = () => resolve();
      mr.stop();
    });

    const mimeType = mimeTypeRef.current || "audio/webm";
    const ext = getFileExtension(mimeType);
    const blob = new Blob(chunksRef.current, { type: mimeType });

    if (blob.size < 500) {
      // Too short (< 0.5s) — cancel
      setSending(false);
      onDone();
      return;
    }

    try {
      const filePath = `voice_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("chat-images")
        .upload(filePath, blob, {
          contentType: mimeType.split(";")[0], // e.g. "audio/webm"
          upsert: false
        });

      if (uploadError) {
        console.error("[VoiceNoteRecorder] Upload error:", uploadError);
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from("chat-images")
        .getPublicUrl(filePath);

      const extras: any = {
        file_url: urlData.publicUrl,
        file_type: mimeType,
        file_name: `voice_note_${seconds}s.${ext}`,
        file_size: blob.size,
        message_type: "voice_note",
        duration: seconds,
      };
      if (replyToId) extras.reply_to_id = replyToId;

      const sendErr = await onSend("", extras);
      if (sendErr) {
        throw sendErr;
      }
    } catch (err: any) {
      console.error("[VoiceNoteRecorder] send error:", err);
      toast({
        title: "Failed to send voice note 😢",
        description: err?.message || "Please check your connection and try again",
        variant: "destructive"
      });
    }

    setSending(false);
    onDone();
  }, [recording, seconds, onSend, replyToId, onDone, onRecordingChange]);

  const cancel = useCallback(() => {
    onRecordingChange?.(false);
    mediaRecorderRef.current?.stop();
    stopStream();
    setRecording(false);
    onDone();
  }, [onDone, onRecordingChange]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="flex items-center gap-3 px-3 py-2.5 glass-chat-input"
    >
      {/* Cancel button */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={cancel}
        disabled={sending}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
        aria-label="Cancel recording"
      >
        <X className="h-5 w-5" />
      </motion.button>

      {/* Recording indicator + waveform */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        {/* Pulsing red dot */}
        <motion.div
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
          className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0"
        />
        {/* Timer */}
        <span className="text-sm font-mono font-semibold text-foreground tabular-nums shrink-0">
          {formatDuration(seconds)}
        </span>
        {/* Waveform */}
        <div className="flex-1 overflow-hidden">
          <WaveformBars active={recording} />
        </div>
      </div>

      {/* Send button */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        whileHover={{ scale: 1.05 }}
        onClick={stopAndSend}
        disabled={sending || !recording}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40 transition-all shadow-sm shadow-primary/20"
        aria-label="Send voice note"
      >
        {sending ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
            className="h-4 w-4 border-2 border-white/60 border-t-white rounded-full"
          />
        ) : (
          <Send className="h-[18px] w-[18px]" />
        )}
      </motion.button>
    </motion.div>
  );
};

// ─── Mic button (shown in MessageInput when text is empty) ────────────────────

interface MicButtonProps {
  onClick: () => void;
}

export const MicButton: React.FC<MicButtonProps> = ({ onClick }) => (
  <motion.button
    whileTap={{ scale: 0.88 }}
    whileHover={{ scale: 1.05 }}
    onClick={onClick}
    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm shadow-primary/20 transition-all"
    aria-label="Record voice note"
  >
    <Mic className="h-[18px] w-[18px]" />
  </motion.button>
);

export default VoiceNoteRecorder;
