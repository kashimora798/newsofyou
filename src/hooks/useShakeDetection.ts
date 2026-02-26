import { useEffect, useRef, useState, useCallback } from "react";

export function useShakeDetection(threshold = 35, cooldownMs = 5000) {
  const [shakeDetected, setShakeDetected] = useState(false);
  const lastShakeRef = useRef(0);
  const lastAccelRef = useRef({ x: 0, y: 0, z: 0 });

  const reset = useCallback(() => setShakeDetected(false), []);

  useEffect(() => {
    const handler = (e: DeviceMotionEvent) => {
      const accel = e.accelerationIncludingGravity;
      if (!accel) return;

      const { x = 0, y = 0, z = 0 } = accel;
      const last = lastAccelRef.current;
      const delta = Math.abs(x - last.x) + Math.abs(y - last.y) + Math.abs(z - last.z);
      lastAccelRef.current = { x, y, z };

      if (delta > threshold) {
        const now = Date.now();
        if (now - lastShakeRef.current > cooldownMs) {
          lastShakeRef.current = now;
          setShakeDetected(true);
        }
      }
    };

    window.addEventListener("devicemotion", handler);
    return () => window.removeEventListener("devicemotion", handler);
  }, [threshold, cooldownMs]);

  return { shakeDetected, reset };
}
