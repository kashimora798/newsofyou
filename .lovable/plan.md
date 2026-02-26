

## Current State

The sky background already includes: real-time sun/moon positioning, moon phases with proper images, twinkling stars, cloud drift animation, foreground silhouette crossfading (day/dusk/night), and a subtle brightness shimmer.

## Feature Ideas to Make the Sky More Realistic and Beautiful

### 1. Shooting Stars (Night)
Random shooting star streaks that occasionally flash across the night sky with a bright trail. Triggered randomly every 15-30 seconds when it's dark. Pure CSS animation — a small bright dot with a fading tail moving diagonally.

### 2. Sun/Moon Reflection Glow on Horizon
A soft gradient band near the horizon that simulates light scattering — warm orange during sunrise/sunset, cool blue during moonlit nights. Implemented as an additional gradient overlay div near the bottom of the sky.

### 3. Fireflies at Dusk/Night
Small warm-yellow dots that float gently around the foreground area during evening and night. They fade in/out with randomized timing, creating a magical countryside feel. 10-15 particles with CSS animations.

### 4. Cloud Color Tinting
Tint clouds based on time of day — golden/orange during sunrise/sunset, dark/grey at night, white during day. Use CSS `filter` on cloud images to shift hue and brightness based on sun altitude.

### 5. Airplane Trails
Occasionally (every 60-90 seconds during daytime), a tiny dot crosses the sky leaving a thin white contrail that slowly fades. Adds a subtle realistic touch.

### 6. Birds Flying at Dawn/Dusk
Small V-shaped bird silhouettes that fly across the screen in small flocks during sunrise and sunset transitions. Simple CSS shapes animated horizontally.

### 7. Aurora Borealis (Special Event)
On certain dates or randomly on clear nights, faint green/purple aurora waves shimmer near the top of the sky. Could use CSS gradients with slow opacity animation.

### Implementation Plan

Each feature would be a self-contained section within `SkyBackground.tsx`:
- Add shooting stars, fireflies, and cloud tinting as immediate improvements (highest visual impact, lowest complexity)
- Add bird silhouettes and airplane trails as secondary enhancements
- Aurora as a rare special event

All features would respect the existing altitude-based visibility system (e.g., fireflies only at night, birds only at dusk).

