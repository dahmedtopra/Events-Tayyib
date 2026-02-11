# UI Style Guide (Kiosk)

## Palette
- Emerald (primary): use for primary actions, focus rings, and key accents.
- Gold (accent): use for dividers, badges, and secondary emphasis.
- Ivory (background): base surface to keep the kiosk light and premium.
- Charcoal (text): default body and headings.

## Surfaces
- Glass cards: `glass` class for panels and headers.
- Avoid heavy blur; keep layers subtle and cheap to render.

## Typography
- Large, clear headings for distance readability.
- Direct answers should be 1–2 lines max.
- Avoid dense paragraphs; use short lists.

## Interaction
- Touch targets >= 48px height.
- Chips are pill-shaped with clear pressed state.
- Primary action: emerald; secondary: glass.

## Background
- Subtle geometric pattern + gradient + vignette.
- Decorative layers are `pointer-events: none`.

## Kiosk Constraints
- No page scroll; only Sources rail scrolls.
- Always show grounded label when sources exist.
