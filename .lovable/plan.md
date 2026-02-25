

# Fix Foreground Image Rendering

## Problem
The foreground images are inside a container `div` with `height: 42%` and use `object-cover`, which crops and distorts them on mobile. The user wants the images placed directly — no wrapping container, just the images positioned at the bottom of the screen spanning full width with their natural proportions.

## Solution
Remove the container `div` wrapping the three foreground images. Instead, render each `<img>` as a direct child of the root element, positioned `absolute bottom-0 left-0 w-full` with no fixed height. This lets the image scale naturally to fill the width while anchoring at the bottom, preserving the correct aspect ratio on all screen sizes.

## Layer Order (DOM order, bottom to top)
1. Sky gradient (background CSS on root div)
2. Stars (absolute positioned dots)
3. Moon (absolute positioned, night only)
4. Sun (absolute positioned, day only)
5. Clouds (absolute positioned img elements)
6. **Foreground day image** (absolute, bottom-0, full width)
7. **Foreground dusk image** (absolute, bottom-0, full width)
8. **Foreground night image** (absolute, bottom-0, full width)

## Changes to `SkyBackground.tsx`

**Remove** lines 246-265 (the container div with three images inside it).

**Replace with** three standalone `<img>` tags as direct children of the root div:

```tsx
<img
  src={fgDay}
  alt=""
  className="absolute bottom-0 left-0 w-full pointer-events-none transition-opacity duration-[5000ms]"
  style={{ opacity: fgDayOpacity }}
/>
<img
  src={fgDusk}
  alt=""
  className="absolute bottom-0 left-0 w-full pointer-events-none transition-opacity duration-[5000ms]"
  style={{ opacity: fgDuskOpacity }}
/>
<img
  src={fgNight}
  alt=""
  className="absolute bottom-0 left-0 w-full pointer-events-none transition-opacity duration-[5000ms]"
  style={{ opacity: fgNightOpacity }}
/>
```

Key differences:
- No container div — images are direct children
- No `height` constraint — images use their natural height
- No `object-cover` / `object-bottom` — just `w-full` so width fills screen, height scales proportionally
- `bottom-0 left-0` anchors them to the bottom edge

## Files Modified
- `src/components/chat/SkyBackground.tsx` — remove foreground container div, replace with direct image elements

