

# Realistic Living Sky Background — Corrected Plan

## Clarification

The three full-scene images (day, evening, night with sky) were **reference only** — showing the desired look and feel. The actual assets to use are the **earlier uploaded foreground-only images** (transparent backgrounds, no sky):

- **Daytime foreground**: Sunflower field + farmhouse, transparent sky (already saved as `foreground_day.png`)
- **Dusk foreground**: Same scene in warm sunset tones, transparent sky (`foreground_dusk.png`)
- **Night foreground**: Same scene dark with lit windows, transparent sky (`foreground_night.png`)
- **Cloud 1 & Cloud 2**: Realistic cloud PNGs with transparent backgrounds

## Architecture (Unchanged from Current)

```text
┌─────────────────────────────────┐
│  CSS gradient sky (full screen) │  ← dynamic gradient based on sun altitude
│                                 │
│  ☀ Sun (CSS)    ☁ Clouds (PNG)  │  ← animated overlays
│  ✦ Stars        🌙 Moon (photo) │
│                                 │
├─────────────────────────────────┤
│  Foreground images (bottom ~40%)│  ← crossfading day/dusk/night PNGs
│  (transparent sky, opaque ground)│     (the images you uploaded first)
└─────────────────────────────────┘
```

The CSS gradient sky shows through the transparent portions of the foreground images. This is the **existing approach** — we keep it.

## Changes to `SkyBackground.tsx`

### 1. Replace SVG clouds with realistic cloud PNGs
- Import `cloud1.png` and `cloud2.png`
- Create 4–5 cloud instances at different positions, scales, and speeds
- Back layer: smaller, slower drift (~120s), opacity ~0.3
- Front layer: larger, faster drift (~80s), opacity ~0.5
- Clouds fade out at night (tied to sun altitude)

### 2. Refine CSS sun for realism
- Near horizon (altitude 0–5°): larger disc ~50px, deep orange, big glow halo
- Mid-sky (altitude 5–30°): ~40px, warm yellow
- High noon (altitude >30°): ~35px, bright white-yellow, subtle glow
- Smooth 30s position transitions for natural movement

### 3. Increase foreground height
- Change from 35% to ~42% to better showcase the sunflower field detail in the uploaded foreground images

### 4. Ambient shimmer
- Very subtle brightness pulse (~20s cycle, ±2%) on the sky gradient layer to simulate atmospheric shimmer and make it feel alive

### 5. Keep existing features
- Star twinkling at night
- Real moon phase photos
- Day/dusk/night foreground crossfade logic (already implemented)
- Sky gradient transitions

## Files Modified
- **`src/components/chat/SkyBackground.tsx`** — replace SVG clouds with cloud PNG images, refine sun appearance, increase foreground height, add shimmer animation

## New Assets
- **`src/assets/sky/cloud1.png`** — realistic cloud image
- **`src/assets/sky/cloud2.png`** — realistic cloud image

## No Changes To
- Existing foreground images (`foreground_day.png`, `foreground_dusk.png`, `foreground_night.png`) — they stay as uploaded earlier
- Moon phase images — unchanged
- Sun position calculation math — unchanged

