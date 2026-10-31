# Project memory

## Product intent & audience

- Web-based survivor-type game (Vampire Survivors–like) built in the browser
- Core loop: move → dodge/auto-attack enemies → collect XP → level up & pick upgrades → survive
- Audience: casual players wanting a quick, polished browser game
- Development phased in 4 steps; user asked step-by-step but all 4 were implemented at once for first preview

## Brand personality & voice

- Polished, "production-worthy," visually distinctive — not cookie-cutter
- Dark, neon-glow arcade aesthetic; feels responsive and juicy

## Visual design & UX direction

- React + Vite + TypeScript; game runs on HTML5 canvas inside a React wrapper
- Deep dark palette with glowing accents (blue player, red enemies, gold projectiles, green XP)
- Infinite grid background to convey boundless map; camera follows player smoothly
- HUD overlay (React): level, timer, kill count, health bar, XP bar; positioned over canvas
- Upgrade selection modal with three-choice cards
- Death screen with restart button
- Visual feedback: particle effects on hits/kills, enemy HP bars, XP magnet effect on pickup
- Tailwind for HUD/menu styling; Lucide icons per global UI convention

## Decisions, constraints & rationale

- Canvas-based engine chosen over Phaser to avoid extra dependency and keep bundle small; React handles UI/HUD layer
- Player controls: WASD or mouse (dual input); camera follows player
- Enemies: spawn every 2s around player from all directions, scale HP over time
- Auto-attack: fires every 1s at nearest enemy (cooldown upgradable)
- XP: green drops with magnet pickup; XP bar fills → level-up → 3-choice upgrade menu
- Upgrades offered: attack speed, move speed, multi-shot, damage, heal, max HP
- `@/` path alias used for imports; no extra packages beyond vite-react defaults + lucide-react

## Open questions & assumptions

- User may still want per-step preview/approval flow for future iterations
- Balance tuning (HP scaling, spawn rates, XP curves) likely needs iteration after playtest feedback
- Potential future additions: more enemy types, boss enemies, additional weapons/skills, pause menu, sound