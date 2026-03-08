

# Northern Lights Login

## Concept

A dark sky scene with shimmering aurora borealis bands that react to mouse/touch movement. Silhouette mountains anchor the bottom. The login form floats as a frosted glass card in the center. On successful login, the aurora intensifies and the scene dissolves into the app.

## Visual Layers (bottom to top)

```text
┌─────────────────────────────────┐
│  Dark gradient sky (#0a0a1a)    │
│  Stars (tiny white dots, twinkle)│
│  Aurora bands (green/teal/purple)│
│  Mountain silhouettes (bottom)   │
│  Frosted glass login card        │
└─────────────────────────────────┘
```

## New Files

### `src/components/login/AuroraBackground.tsx`
- Full-screen SVG/CSS aurora using multiple layered gradient divs with `mix-blend-mode: screen`
- 3-4 aurora bands with different colors (green, teal, purple) animated with CSS keyframes (slow vertical wave + horizontal drift)
- `onMouseMove` handler warps band positions slightly toward cursor using CSS custom properties
- Twinkling star field: ~80 small absolute-positioned dots with randomized `animation-delay` on an opacity pulse keyframe
- Mountain silhouette: dark SVG path anchored to bottom with subtle gradient edge

### `src/components/login/LoginCard.tsx`
- Glassmorphism card: `bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl`
- Framer Motion `initial={{ opacity: 0, y: 20 }}` fade-up entrance
- Inputs styled with transparent dark backgrounds and white/green accent on focus
- Button with aurora-gradient background (green→teal→purple)
- Error state: card border briefly flashes red
- Success: aurora intensifies (brightness filter ramps up), card scales down and fades, then navigate

### `src/pages/Login.tsx`
- Rewritten to compose `AuroraBackground` + `LoginCard`
- Black background, full viewport
- Auth logic unchanged

## Animation Details
- Aurora wave: CSS `@keyframes aurora-wave` — translateY oscillation + slight skewX, 8-12s infinite
- Star twinkle: opacity 0.3→1→0.3, randomized 2-4s duration per star
- Mouse reactivity: `--mouse-x` and `--mouse-y` CSS vars updated on `pointermove`, aurora `translate` uses `calc()` referencing these vars (lightweight, no re-renders)
- Login success: `framer-motion` animates card out + aurora brightness via inline style transition

## No new dependencies needed
Uses existing `framer-motion` for card animations and pure CSS for aurora/stars.

