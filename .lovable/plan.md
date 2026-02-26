## Interactive & Intimate Sky Enhancements

### 3. Heart-Shaped Cloud

Occasionally (randomly, ~10% chance), a heart-shaped cloud drifts across the daytime sky. Tapping it triggers a small love animation and sends a notification to the partner: "[Name] caught a heart cloud for you 💕"

### 5. Sky Lanterns (Send Love)

A button lets either partner release a glowing sky lantern that floats upward with a warm glow trail. The other partner sees it arrive in their sky. Can attach a short message (max 20 chars) that appears when the lantern is tapped.

### 6. Rainbow After Rain

Randomly during daytime, a rainbow arc fades in across the sky for 30-60 seconds. Tapping it reveals a random love quote or memory.

### 7. Falling Leaves / Petals (Seasonal)

Based on the actual season — cherry blossom petals in spring, golden leaves in autumn, snowflakes in winter, flower petals in summer — gentle particles drift down. Tapping them creates a small burst animation.

### Implementation Priority

**Phase 1 — High impact, self-contained:**

&nbsp;

- Heart-shaped cloud (daytime surprise)
- Sky lanterns (partner communication)

**Phase 2 — Atmospheric polish:**

- Seasonal particles (petals/leaves/snow)
- Rainbow events

&nbsp;

### Technical Approach

- Each feature is a separate component in `src/components/chat/sky/`
- Touch interactions use `onPointerDown` on the sky container
- Partner sync features use Supabase realtime channels
- All effects respect the altitude-based day/night system
- Seasonal detection uses `Date` month checks