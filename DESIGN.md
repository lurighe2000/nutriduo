# NutriDuo · Design system

Read this before touching any UI. It is the source of truth for both AI agents (Claude and Codex) working on this repo.

## Feel

Apple Fitness / Oura / Headspace calm. Soft relief ("neumorphic profundo"), one idea per card, very little text, generous spacing. Playful touches (Duo mascots, the buddy on the switch) but never noisy. If a screen needs a paragraph to explain itself, redesign it.

## Profiles and color

Each profile has its own palette, applied on `.app-shell.theme-luca` / `.app-shell.theme-ari`, light and dark:

- Luca → blues. Ari → pinks.
- Tokens: `--duo-1`, `--duo-2`, `--duo-3` (accent ramp), `--duo-button`, `--duo-shadow`.
- Relief tokens: `--neo-bg`, `--neo-hi`, `--neo-lo`, `--neo-out` (raised), `--neo-in` (pressed / tracks / inputs).
- Never hardcode a profile color in a component; use the tokens.

## Type

Manrope. Headings 800, numbers 800 with the gradient text treatment, body 500. Spanish rioplatense copy: short, warm, "vos" ("¡Bien ahí!", "Día cerrado").

## Bottom bar (NotchNav) — do not redesign

Fixed to the bottom (12px + safe area), height 96, bar top 31, raised circle r=24, notch r=29.5, gooey notch that slides with an easeOutBack tween (560ms). Labels under icons. Spec lives in `src/components/NotchNav.tsx`.

## Motion

- Spring: `cubic-bezier(.34,1.56,.64,1)`; standard enters 250–400ms; section slide `duo-in-left` / `duo-in-right`.
- Animate only `transform` and `opacity`.
- Everything decorative respects `prefers-reduced-motion`.
- Haptics via `haptic()` in `src/components/motion.tsx` (short, only on real actions).
- `html, body, .app-shell { overflow-x: clip }` must stay: horizontal overflow makes mobile browsers zoom out and the fixed bar slides away.

## Switch buddy

`src/components/SwitchBuddy.tsx`: stick figure on the day/night switch. Random activity every 7.5s from DAY / NIGHT / RAIN pools (rain from Open-Meteo, Buenos Aires). Poses live in a 28×28 viewBox, ground at y=25, head r=3. Keep new poses inside x 0–28 so the page never gets wider.

## Checks before shipping

- 360, 393, 412, 430 px widths; light and dark; both profiles.
- No horizontal scroll; bar bottom stays put while switching sections.
- `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`.
