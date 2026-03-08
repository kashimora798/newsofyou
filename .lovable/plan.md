

# Touch Reaction System Upgrade

## What We're Improving

The current touch reaction system has basic particle floating, simple fade animations, and a flat picker UI. Here's what we'll do to make it feel premium and real:

---

## 1. Enhanced Particle Physics (TouchReactionOverlay.tsx)

**Current**: Particles float straight up with a simple linear animation.
**Upgrade**:
- Particles will have randomized sinusoidal sway (left-right oscillation) as they rise
- Multiple particle layers: foreground (large, fast) + background (small, slow, blurred)
- Gravity-aware burst from center on entry before floating upward
- Fade-out with scale-down at the end of lifecycle

## 2. Richer Overlay Animations (index.css + TouchReactionOverlay.tsx)

- Replace basic fade-in with a **radial reveal** (circle expanding from center)
- Emoji entrance: bouncy spring scale with rotation
- Pulsing glow ring behind the center emoji
- Smooth blur transition on background (0 -> 20px blur)
- Text fades in with a subtle upward slide, staggered after emoji

## 3. Redesigned Picker UI (TouchReactionPicker.tsx)

**Current**: Simple grid with tiny text labels.
**Upgrade**:
- Horizontal scrollable category tabs at top (pill-shaped, animated active indicator)
- Larger emoji buttons (44px) with glassmorphic hover cards showing label + verb preview
- Long-press on a reaction shows a mini-preview tooltip
- Smooth `framer-motion` staggered entrance when picker opens
- Glass card styling consistent with the dashboard redesign

## 4. New Touch Reactions (TouchReactionOverlay.tsx)

Add 7 new emotions to expand expressiveness:

| Key | Emoji | Label | Verb | Vibe |
|-----|-------|-------|------|------|
| `kiss` | 💋 | Kiss | kissing | Romantic pink burst |
| `high_five` | 🙌 | High Five | high-fiving | Energetic yellow flash |
| `poke` | 👉 | Poke | poking | Playful bounce effect |
| `blush` | 😊 | Blush | making blush | Soft pink warmth |
| `sleepy` | 🥱 | Sleepy | yawning with | Dark blue with stars |
| `cheer` | 📣 | Cheer | cheering for | Vibrant confetti |
| `butterfly` | 🦋 | Butterflies | giving butterflies to | Dreamy purple with flutter |

New categories reorganized: **Love** (6), **Energy** (5), **Comfort** (4), **Playful** (4), **Vibes** (3)

## 5. Premium Keyframe Animations (index.css)

New keyframes to add:
- `particle-burst` — initial outward explosion before float
- `particle-sway` — sinusoidal left-right movement
- `emoji-spring-in` — bouncy overshoot scale entrance
- `glow-pulse` — pulsing ring behind center emoji
- `radial-reveal` — clip-path circle expansion
- `text-slide-up` — subtle upward fade for the verb text

## 6. "React Back" Button Polish

- Glassmorphic styling with border glow
- Scale-in with spring physics
- Ripple effect on tap

---

## Files to Edit

| File | Changes |
|------|---------|
| `src/components/chat/TouchReactionOverlay.tsx` | Add 7 new emotions, multi-layer particles, burst physics, glow ring, radial reveal, improved center animation |
| `src/components/chat/TouchReactionPicker.tsx` | Horizontal category tabs, larger buttons, glassmorphic styling, framer-motion stagger, long-press preview |
| `src/index.css` | New keyframes (particle-burst, particle-sway, emoji-spring-in, glow-pulse, radial-reveal, text-slide-up) |
| `src/components/settings/ReactionPreview.tsx` | Update preview to match new particle physics and glow effects |

No backend or data model changes needed — the new built-in reactions are hardcoded like the existing 15.

