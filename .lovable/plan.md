

# Fix Foreground Image Rendering — No Zoom, No Scaling

## Problem
The current approach uses `height: 45%` + `object-fit: cover` which zooms and crops the image to fill a fixed area. The user wants the image to scale proportionally by width (`width: 100%`, `height: auto`) with no forced fit, anchored at the bottom.

## Changes

### 1. Replace night foreground asset
Copy the uploaded wide image to `src/assets/sky/foreground_night.png`, replacing the existing night foreground.

### 2. Update foreground image styles in `SkyBackground.tsx` (lines 246-263)
Remove `height: "45%"`, `objectFit: "cover"`, and `objectPosition: "bottom center"` from all three foreground images. Replace with simple `width: 100%` + `height: auto` styling:

```tsx
<img
  src={fgDay}
  alt=""
  className="absolute bottom-0 left-0 w-full h-auto pointer-events-none transition-opacity duration-[5000ms]"
  style={{ opacity: fgDayOpacity }}
/>
<img
  src={fgDusk}
  alt=""
  className="absolute bottom-0 left-0 w-full h-auto pointer-events-none transition-opacity duration-[5000ms]"
  style={{ opacity: fgDuskOpacity }}
/>
<img
  src={fgNight}
  alt=""
  className="absolute bottom-0 left-0 w-full h-auto pointer-events-none transition-opacity duration-[5000ms]"
  style={{ opacity: fgNightOpacity }}
/>
```

This way: width always fills the viewport, height scales proportionally from the image's natural aspect ratio, anchored at the bottom. No zoom, no crop, no `object-fit`. The wide panoramic night image will naturally be shorter in height on narrow screens and proportionally taller on wide screens — exactly matching its native aspect ratio.

### 3. Moon — already fixed
The `rounded-full` class was already removed in the last edit. No further changes needed.

## Files Modified
- `src/assets/sky/foreground_night.png` — replaced with wide image
- `src/components/chat/SkyBackground.tsx` — remove forced height/object-fit from foreground images

