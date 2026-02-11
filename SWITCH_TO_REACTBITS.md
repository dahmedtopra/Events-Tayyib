# Switch to Official ReactBits Components

## Current: Lightweight CSS Versions
- **Noise**: CSS-only animation, ~0.5kb
- **AnimatedContent**: CSS transitions, ~0.8kb
- **Performance**: Minimal CPU usage
- **Dependencies**: None

## Official ReactBits Versions Available
- **NoiseReactBits**: Canvas + requestAnimationFrame, more realistic grain
- **AnimatedContentReactBits**: GSAP-powered, scroll-triggered animations

## To Switch

### 1. Update SearchExperience.tsx imports:

```typescript
// Change from:
import { Noise } from "../components/ui/Noise";
import { AnimatedContent } from "../components/ui/AnimatedContent";

// To:
import Noise from "../components/ui/NoiseReactBits";
import AnimatedContent from "../components/ui/AnimatedContentReactBits";
```

### 2. Update Noise usage (API changed):

```typescript
// Old (CSS version):
<Noise opacity={0.12} tint="#2fa987" />

// New (Canvas version):
<Noise
  patternAlpha={30}  // 0-255, default 15
  patternRefreshInterval={2}  // frames between updates
/>
```

### 3. Update AnimatedContent usage (API changed):

```typescript
// Old (CSS version):
<AnimatedContent delay={400} duration={1000} distance={30}>
  {children}
</AnimatedContent>

// New (GSAP version) - scroll-triggered by default:
<AnimatedContent
  delay={0.4}  // seconds, not ms
  duration={1}  // seconds, not ms
  distance={30}
  direction="vertical"
  threshold={0.1}  // when to trigger (0-1)
>
  {children}
</AnimatedContent>
```

### 4. For non-scroll animations (ATTRACT screen):

The official AnimatedContent is scroll-triggered. For the ATTRACT screen (no scroll), you may want to:
- Keep using the lightweight CSS version for ATTRACT
- Or trigger it manually with GSAP timeline
- Or use a different ReactBits component

## Trade-offs

| Feature | Lightweight (CSS) | Official (ReactBits) |
|---------|------------------|---------------------|
| File size | ~1.3kb total | ~5kb + 50kb GSAP |
| CPU usage | Minimal | Moderate (Canvas RAF) |
| Dependencies | None | GSAP (already installed) |
| Realism | Good | Excellent |
| Scroll effects | Manual | Built-in |
| Touch-safe | Yes | Yes |
| Kiosk-friendly | ✅ Best | ⚠️ May impact long-running kiosk |

## Recommendation

For kiosk environment (per CLAUDE.md):
- ✅ **Keep lightweight versions** for ATTRACT/LANGUAGE_PICK
- ✅ Use official ReactBits for specific effects if needed elsewhere
- ⚠️ Canvas + RAF can add up on kiosks running 24/7
