/**
 * sceneTime — the clock behind the Home scene (build-plan Phase 3).
 *
 * The home screen lives in a midnight world, but it should still *feel* like
 * the hour it is: a colder, stiller sky at 3am than at 9pm. This module turns a
 * Date into a small, testable description of that mood — no DOM, no theme
 * tokens — and owns the copy ("good evening") so the scene and the header never
 * disagree.
 */

export type ScenePhase = "dawn" | "day" | "dusk" | "night";

/** Phase for a moment in time (local clock, hour-based). */
export function scenePhase(date: Date = new Date()): ScenePhase {
  const h = date.getHours();
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 17) return "day";
  if (h >= 17 && h < 21) return "dusk";
  return "night";
}

/** "good morning" / "good evening" / … — lowercase, as the header uses it. */
export function phaseGreeting(phase: ScenePhase): string {
  switch (phase) {
    case "dawn":
      return "good morning";
    case "day":
      return "good afternoon";
    case "dusk":
      return "good evening";
    default:
      return "good night";
  }
}

/** The small line under the name — warmer than a clock. */
export function phaseWhisper(phase: ScenePhase, hour: number): string {
  switch (phase) {
    case "dawn":
      return "the sky is only just turning";
    case "day":
      return hour < 13 ? "a slow afternoon ahead" : "afternoon light";
    case "dusk":
      return "the lamps are coming on";
    default:
      return hour >= 0 && hour < 4 ? "still awake, you two" : "the house is quiet";
  }
}

/** The ambient strength of the stars: brightest late at night, faint by day. */
export function starDensity(phase: ScenePhase): number {
  switch (phase) {
    case "night":
      return 1;
    case "dusk":
      return 0.7;
    case "dawn":
      return 0.45;
    default:
      return 0.25;
  }
}

/** Where the moon sits in the sky, as a fraction of the viewport (x from left, y from top). */
export function moonPosition(phase: ScenePhase, hour: number): { x: number; y: number } {
  // The moon arcs left→right through the night (21:00 → 05:00), then parks.
  const nightStart = 21;
  const nightEnd = 29; // 05:00 next day
  // Treat the small hours (and dawn) as the tail of the same night.
  const t = hour < 12 ? hour + 24 : hour;
  const progress = Math.min(1, Math.max(0, (t - nightStart) / (nightEnd - nightStart)));

  const arc = phase === "night" || phase === "dawn" ? progress : phase === "dusk" ? 0.12 : 1;
  return {
    x: 0.12 + arc * 0.72, // 12% → 84% across
    y: 0.1 + Math.sin(arc * Math.PI) * -0.02 + arc * 0.16, // dips a little as it crosses
  };
}

/** "Saturday, 4 October" — the date line in the header. */
export function formatToday(date: Date = new Date()): string {
  return date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}

/** "21:40" — a quiet clock, no seconds. */
export function formatClock(date: Date = new Date()): string {
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}
