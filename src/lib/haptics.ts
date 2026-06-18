/**
 * Tiny haptics helper — consistent vibration feedback across the app.
 * No-ops gracefully where navigator.vibrate is unsupported (iOS Safari, desktop).
 *
 * Usage: haptic.tap(), haptic.success(), haptic.impact()
 */

function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore — unsupported */
  }
}

export const haptic = {
  /** Light tick — taps, button presses, reaction chips. */
  tap: () => vibrate(10),
  /** A touch firmer — crossing a gesture threshold (swipe commit point). */
  impact: () => vibrate(20),
  /** Double-pulse celebration — a reaction landed, an action confirmed. */
  success: () => vibrate([15, 40, 25]),
  /** Soft warning — destructive or "are you sure" moments. */
  warn: () => vibrate([30, 60, 30]),
  /** Cancel any ongoing vibration. */
  stop: () => vibrate(0),
};
