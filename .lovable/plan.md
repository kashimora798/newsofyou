

## Fine-tune Shooting Stars

### Changes to `src/components/chat/sky/ShootingStars.tsx`:

1. **Bright head + fading tail**: Replace the single `div` with a composite element — a bright circular head (3-4px glowing dot) followed by a tapered gradient tail that fades from bright white to transparent.

2. **Longer animation**: Increase `duration` from `0.6-1.2s` to `1.2-2.2s`. Increase `length` from `60-140px` to `120-220px`. Increase travel distance from `200px` to `400px`.

3. **Parabolic path**: Use a CSS `@keyframes` animation with intermediate keyframes that include `translateY` offsets to create a curved/parabolic arc instead of a straight line. The star will arc downward slightly as it travels.

4. **Structure**: Each shooting star becomes a small container with:
   - A bright white head dot with strong `box-shadow` glow
   - A trailing gradient tail element that tapers in width
   - The container animated along a parabolic path using multi-step keyframes with `translateX` + `translateY`

5. **Unique curves**: Add a `curve` property to each star instance (random value) that selects from a few keyframe variants for different arc shapes.

