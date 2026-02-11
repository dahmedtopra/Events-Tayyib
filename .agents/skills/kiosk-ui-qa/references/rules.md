# Kiosk UI QA Rules

## Hard checks

- `html, body, #root` must set full height.
- `body` must keep `overflow: hidden`.
- Decorative layers must not capture clicks.

## Touch targets

- Controls should be at least `44px` tall.
- Prefer `48px+` for kiosk usage.

## Scroll policy

- No full page scroll.
- Internal scroll should be intentional and confined to dedicated containers.

## Overlay policy

- Full-screen `absolute/fixed inset-0` overlays must be decorative-only and non-interactive unless explicitly a modal/scrim.

