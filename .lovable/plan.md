

# Realistic Moon Phases & AI-Generated Foreground for Sky Background

## Overview
Replace the CSS-drawn moon with your 8 real NASA moon phase photographs, and generate realistic silhouette/foreground images for different times of day using AI image generation.

## Part 1: Realistic Moon Phases

**Moon phase images you provided (8 phases):**
- New Moon
- Waxing Crescent
- First Quarter
- Waxing Gibbous
- Full Moon
- Waning Gibbous
- Third Quarter
- Waning Crescent

**Moon phase calculation:**
Add a `getMoonPhase(date)` function using the synodic month (29.53 days) to determine the current lunar phase. The function calculates days since a known new moon (e.g., Jan 6, 2000) and maps it to one of the 8 phases.

**Implementation:**
- Copy all 8 moon images to `src/assets/moon/`
- Import them in `SkyBackground.tsx`
- Replace the current CSS `radial-gradient` moon with an `<img>` element that displays the correct phase image based on the current date
- Add a soft glow effect behind the moon image using a CSS box-shadow/radial-gradient backdrop
- Size: ~40-48px with a subtle moonlight glow aura

## Part 2: AI-Generated Foreground Silhouettes

**Generate 3 realistic panoramic silhouette images** using the AI image generation tool for different times of day:

1. **Daytime** -- Warm-toned Indian town silhouette with trees, rooftops, temple spires, electric poles against a bright sky. Earthy browns and greens.
2. **Dusk/Sunset** -- Same scene as dark purple-orange silhouette with warm window glows beginning to appear.
3. **Night** -- Deep dark silhouette with glowing yellow windows, street lamp spots, dark blues and blacks.

These will be generated as wide panoramic images (aspect ratio ~4:1), saved to `src/assets/sky/`, and used in the foreground `<div>` replacing the current SVG paths.

**Implementation:**
- Replace the SVG `SILHOUETTE_PATH` and `TREES_PATH` with `<img>` elements
- Crossfade between the 3 images based on `altitude` using CSS opacity transitions
- Keep the lit window rects as an optional overlay for extra realism at night

## Technical Changes

### Files Modified
- **`src/components/chat/SkyBackground.tsx`** -- Major update:
  - Add `getMoonPhase()` function
  - Import moon phase images and foreground images
  - Replace CSS moon with phase-accurate `<img>`
  - Replace SVG foreground with crossfading realistic images

### New Assets (copied/generated)
- `src/assets/moon/` -- 8 moon phase images (from your uploads)
- `src/assets/sky/` -- 3 AI-generated foreground silhouettes (day, dusk, night)

### Moon Phase Logic
```text
synodic_month = 29.53 days
days_since_known_new_moon = (now - Jan_6_2000) mod 29.53
phase_index = floor(days_since / 3.69)  -->  0-7 mapping to 8 phases
```

### Foreground Crossfade Logic
```text
altitude > 10   -->  daytime image at full opacity
altitude 0-10   -->  blend daytime + dusk
altitude -6 to 0 --> dusk image at full opacity  
altitude < -6   -->  night image at full opacity
```

All transitions use `duration-[5000ms]` to match the existing sky gradient transition speed.

