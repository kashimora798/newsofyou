

# Red String of Fate — Login Screen Redesign

## What We're Building

A cinematic, immersive login experience that replaces the current standard form with an animated "Red String of Fate" concept. Since this is a **web app** (not native iOS/Android), we'll adapt the concept for touch/mouse interactions using CSS animations and canvas/SVG — no WebGL needed for elegance.

## Realistic Scope (Web App Constraints)

- **No native haptics** — Web Vibration API is limited (Android Chrome only, no iOS). We'll rely on visual/audio cues instead.
- **No biometric auth** — Web doesn't support fingerprint scanning. We keep email/password but hide it behind the ritual.
- **No gyroscope tilt** — DeviceOrientation requires HTTPS + permissions; we'll use mouse/touch position instead.
- **Partner awareness IS possible** — We already have `usePartner` + realtime status. We can show partner's online state on the login screen.

## Design: 3 Phases

### Phase 1: Ambient State (Page Load)
- Pure black (`#000`) fullscreen background
- A single glowing red thread (SVG path with glow filter) drifts gently using CSS keyframe animation
- Thread responds to mouse/touch position (parallax offset) for that "alive" feeling
- No text, no UI — just the string floating

### Phase 2: The Reveal (Tap/Click the Pulse)
- A subtle glowing red pulse dot sits at the bottom center
- On tap/click, the string animates toward the dot and coils into a fingerprint-like spiral pattern
- The login form fades in elegantly over the black background — email + password inputs styled as minimal glowing outlines (red/crimson accent, no backgrounds)
- The string stays wrapped around the form area

### Phase 3: The Pull (After Authentication)
- On successful sign-in, instead of a boring redirect:
  - The string goes taut (straightens, glows brighter)
  - Screen "splits" with a zoom/tunnel animation (CSS transform + opacity)
  - Navigates to `/home`

### Dynamic States (Partner Awareness)
- **Partner online**: String glows bright crimson, pulses rhythmically — subtle text "They're waiting..." fades in
- **Partner offline**: String is dim, translucent, drifts slowly
- **Long absence**: String appears nearly invisible, rebuilds glow on interaction

## Technical Approach

### Files to Create
1. **`src/components/login/RedString.tsx`** — The animated SVG string component with mouse-follow physics
2. **`src/components/login/PulsePoint.tsx`** — The glowing entry point at bottom
3. **`src/components/login/LoginTransition.tsx`** — The "pull & snap" exit animation
4. **`src/pages/Login.tsx`** — Rewrite to orchestrate the 3 phases

### Files to Edit
1. **`src/index.css`** — Add keyframes for string drift, glow pulse, tunnel zoom, form fade-in

### Key Implementation Details

- **String animation**: SVG `<path>` with animated `d` attribute using sine-wave offsets, plus a red `drop-shadow` glow filter. Mouse/touch events offset control points for interactivity.
- **Partner status on login**: We can't use `usePartner` (requires auth). Instead, query `user_status` table anonymously — this needs an RLS policy allowing anon reads of `is_online` only, OR we skip this and show it post-auth during the transition phase.
- **Form reveal**: The email/password fields appear after tapping the pulse — styled with transparent backgrounds, thin red borders, white text on black.
- **Transition**: On auth success, a 1.2s CSS animation plays (string tightens → screen splits → navigate). Chat data preloads during this via `queryClient.prefetchQuery`.
- **No heavy dependencies**: Pure CSS animations + inline SVG. No canvas library needed.

### Simplified Partner Detection Alternative
Since RLS blocks anon access, we check partner status **after** auth succeeds but **before** the transition animation plays. This lets us show "They're waiting..." during the pull animation — still magical, zero security compromise.

## What This Won't Include (Native-Only)
- Haptic vibration (no reliable web API on iOS)
- Biometric fingerprint overlay (no web API)
- Lock-screen "tug" notifications (requires native push)
- True gyroscope tilt (would need permission prompt, unreliable)

