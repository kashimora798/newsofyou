import { useEffect, useState } from "react";

const CALM_MODE_KEY = "calm-mode";

/**
 * Returns true when decorative animations should run.
 *
 * Animations are paused when any of the following hold:
 *   - the user prefers reduced motion (OS setting)
 *   - the user has enabled "Calm mode" (persisted in localStorage)
 *   - the tab is hidden (no point animating offscreen — saves battery/CPU)
 *
 * Heavy ambient/sky layers should gate their render and their
 * requestAnimationFrame loops on this value.
 */
export function useAnimationsEnabled(): boolean {
  const [enabled, setEnabled] = useState(() => computeEnabled());

  useEffect(() => {
    const recompute = () => setEnabled(computeEnabled());

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    motionQuery.addEventListener("change", recompute);
    document.addEventListener("visibilitychange", recompute);
    window.addEventListener("calm-mode-change", recompute);
    window.addEventListener("storage", recompute);

    return () => {
      motionQuery.removeEventListener("change", recompute);
      document.removeEventListener("visibilitychange", recompute);
      window.removeEventListener("calm-mode-change", recompute);
      window.removeEventListener("storage", recompute);
    };
  }, []);

  return enabled;
}

function computeEnabled(): boolean {
  if (typeof window === "undefined") return true;
  if (document.visibilityState === "hidden") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (isCalmMode()) return false;
  return true;
}

export function isCalmMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CALM_MODE_KEY) === "1";
}

export function setCalmMode(on: boolean): void {
  localStorage.setItem(CALM_MODE_KEY, on ? "1" : "0");
  window.dispatchEvent(new Event("calm-mode-change"));
}
