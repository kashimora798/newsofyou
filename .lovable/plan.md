

# Two New Features: Sky Toggle + Shake Love Animation

## Feature 1: Toggle to hide chat UI and show only the live sky background

**What it does:** A small eye/landscape toggle button in the ChatHeader. When tapped, it hides the message list, input bar, search bar, and connection banner — leaving only the full-screen SkyBackground visible. Tap again to restore the chat.

**Changes:**
- **`src/pages/Chat.tsx`** — Add `immersiveMode` state. Pass it to `ChatHeader` as a prop + toggle callback. Conditionally hide `ConnectionBanner`, `SearchBar`, `MessageList`, and `MessageInput` when active. Pass `immersiveMode` to `MessageList` so sky stays visible full-screen.
- **`src/components/chat/ChatHeader.tsx`** — Add an `Eye`/`EyeOff` toggle icon button next to the search button. Only show when `wallpaper === "sky"`. Props: `immersiveMode`, `onImmersiveToggle`.

## Feature 2: Shake-to-love animation with vibration

**What it does:** Uses the DeviceMotion API to detect a shake gesture. On shake:
1. Phone vibrates for 3-4 seconds (pattern vibration)
2. Full-screen overlay with floating hearts (like leaves blowing in wind — rotating, swaying, drifting across screen with varied sizes and speeds)
3. Text appears: "Love you [partner name], I know you miss me !!" with a fade-in animation
4. Auto-dismisses after ~5 seconds

**Changes:**
- **`src/hooks/useShakeDetection.ts`** (new) — Custom hook using `devicemotion` event. Detects sharp acceleration changes (threshold ~15). Debounces to prevent repeated triggers. Returns `shakeDetected` boolean + reset function.
- **`src/components/chat/ShakeLoveOverlay.tsx`** (new) — Full-screen overlay component:
  - 30-40 heart particles with randomized: start position, size (16-48px), rotation, sway amplitude, fall duration (3-6s), delay
  - CSS keyframes: `heartFloat` combining translateY (top to bottom), translateX (sine-wave sway), rotate, and opacity fade
  - Center text with scale-in + fade animation
  - Vibration via `navigator.vibrate([200, 100, 200, 100, 200, 100, 300, 150, 300, 150, 500])` (~3.5s pattern)
  - Auto-dismiss after 5 seconds
- **`src/pages/Chat.tsx`** — Import hook + overlay. Call `useShakeDetection()`, render `<ShakeLoveOverlay>` when triggered, passing `partner?.name`.

## Files to create
1. `src/hooks/useShakeDetection.ts`
2. `src/components/chat/ShakeLoveOverlay.tsx`

## Files to modify
1. `src/pages/Chat.tsx`
2. `src/components/chat/ChatHeader.tsx`

