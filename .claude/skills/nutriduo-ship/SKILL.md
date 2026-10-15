---
name: nutriduo-ship
description: How to change, verify and publish NutriDuo safely. Use for any code change in this repo, before starting and before publishing.
---

# NutriDuo: change, verify, publish

## Before touching code

1. Two agents (Claude and Codex) alternate on this repo. Run `git status` and `git log --oneline -5`. Uncommitted files you did not write are someone else's work in progress: never revert or reformat them, never `git add` them.
2. Read `DESIGN.md` (visual rules, tokens, motion, bottom bar) and `PRODUCT.md` (who, promise, principles). Everything stays 100% free: no paid APIs, no keys in the repo or in chat.
3. UI copy is Spanish rioplatense with "vos", short and warm. Less text, more interaction.

## While building

- Store data with Dexie through `repository()`; every record is validated by a zod schema in `src/schemas`. New fields must be optional so old backups still load.
- Mobile first: check 360, 393, 412 and 430 px, light and dark, Luca (blue) and Ari (pink). No horizontal overflow.
- Animate only transform/opacity; respect `prefers-reduced-motion`; haptics via `haptic()`.
- Pure logic goes in `src/services/*.ts` with a vitest file next to it.
- Features users touch get a Playwright test in `tests/` (Desktop Chrome, 60 s timeout, one worker).

## Verify

- `npx tsc -b`, `npx eslint .`, `npx prettier --check <changed files>`.
- `npm test` (vitest) and `npm run test:e2e` (Playwright, ~6 min).
- Slow crypto or reload-heavy tests can flake on a busy laptop: give them explicit timeouts or retry the flaky step with `expect(...).toPass()`, never delete assertions.

## Publish

- Bump the footer version in `src/app/App.tsx` (`NutriDuo · 1.x`).
- Write the commit message in `_publicar/mensaje.txt`: one subject line with `(1.x)`, a blank line, short bullets, then the Co-Authored-By trailer.
- On Luca's PC, `_publicar/auto-publicar.cmd` watches for `_publicar/subir.flag`. Create the flag to run tests, commit and push; read `_publicar/log.txt` until `=== LISTO ===` or `=== ERROR ===`. Without the watcher, Luca double-clicks `_publicar/publicar.cmd`.
- GitHub Actions (`.github/workflows/pages.yml`) re-runs lint, tests, build and e2e, then deploys to GitHub Pages. The app shows "Actualizar ahora" for the new version.
- The Cloudflare Worker (`worker/`) deploys only from Luca's PC with wrangler.
