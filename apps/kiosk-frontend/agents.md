# AGENTS

## Scope
Kiosk frontend (React + Vite + TypeScript + TailwindCSS).

## UX Rules (non-negotiable)
- No scrolling in main Ask/Guide panels; only Sources drawer/panel may scroll.
- Arabic UI is RTL; Arabic output is Fusha.
- Language is selected on Home and locked for the session.
- Tayyib is always visible (Hero on Home; compact elsewhere).

## Orientation
- Auto-detect layout: vertical if height>=width, else horizontal.
- Include a future admin override hook.

## Admin Gesture
- Long-press ICHS logo for 5 seconds opens Admin panel (no PIN).

## Commands
- npm install
- npm run dev
- npm run build
- npm run preview
