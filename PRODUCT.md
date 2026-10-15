# NutriDuo · Product

## Who

Two people sharing one app: Luca (Samsung S23 Ultra, Chrome) and Ari (iPhone 17 Pro Max, Safari). Installed as a PWA from GitHub Pages.

## Promise

Eat well, train, and see progress together, with almost no typing. 100% free: no paid APIs or services, ever.

## Pillars

1. Comidas: photo → AI estimate (Groq via the Cloudflare Worker, Workers AI fallback), weekly menu, groceries.
2. Entrenamiento: workouts and runs.
3. Progreso: weight, measurements, streaks, constancy.
4. Juntos: shared menu and groceries, encrypted cloud backup, push reminders.

## Principles

- Interactive over informative: tap, swipe, see. Avoid "demasiada información".
- Celebrate small wins (closed day, water goal) with motion and haptics, not walls of text.
- Data stays on the device (Dexie). Cloud only for encrypted backup and sharing.
- Secrets live only as Cloudflare secrets, never in the repo or in chat.

## Working agreement

Claude and Codex (ChatGPT) alternate on this repo. Before starting, pull and read the last commits; keep `DESIGN.md` updated when the visual language changes.
