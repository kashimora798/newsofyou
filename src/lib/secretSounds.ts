// Tiny Web Audio synth — pleasant chimes/melodies with NO downloaded assets,
// so secret effects keep the app fast and work offline. All calls are wrapped
// in try/catch and no-op where Web Audio is unavailable or autoplay is blocked.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

interface NoteOpts {
  type?: OscillatorType;
  peak?: number;
}

function playNote(freq: number, startIn: number, dur: number, opts: NoteOpts = {}) {
  const ac = getCtx();
  if (!ac) return;
  try {
    const t0 = ac.currentTime + startIn;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.value = freq;
    const peak = opts.peak ?? 0.16;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch {
    /* ignore */
  }
}

/** Bright ascending arpeggio — a cheerful "good morning" chime. */
export function playMorningChime() {
  // C5 E5 G5 C6
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => playNote(f, i * 0.13, 0.55, { type: "triangle", peak: 0.16 }));
  // soft shimmer on top
  playNote(1318.5, 0.5, 0.7, { type: "sine", peak: 0.08 });
}

/** Soft descending lullaby — a gentle "good night" melody. */
export function playNightLullaby() {
  // G5 E5 D5 C5 G4  (slow, soft)
  const notes = [783.99, 659.25, 587.33, 523.25, 392.0];
  notes.forEach((f, i) => playNote(f, i * 0.34, 0.85, { type: "sine", peak: 0.13 }));
}

/** Quick rising sparkle — used for a lucky match / surprise. */
export function playSparkle() {
  const notes = [659.25, 880, 1108.7, 1318.5];
  notes.forEach((f, i) => playNote(f, i * 0.07, 0.4, { type: "triangle", peak: 0.14 }));
}
