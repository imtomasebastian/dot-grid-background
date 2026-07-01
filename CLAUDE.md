# DotGridBackground — Claude instructions

## Start here

**Always read `docs/HANDOFF.md` first** — before any work, after `/clear`, after a context
reset, or when picking up mid-session. It is the single source of truth for what's been built,
what's in progress, and what's next. Do not start from scratch or make assumptions without
reading it.

## Project overview

Interactive animated dot-grid canvas background. Vite + React 19 + TypeScript.

Architecture: **framework-agnostic core engine + thin React wrapper.**

- `src/DotGridBackground/` — the publishable component (zero runtime dependencies — non-negotiable)
- `src/App.tsx` + `src/main.tsx` — demo only (DialKit live panel lives here, nowhere else)

## Key constraints

- **The core must stay zero-dependency.** Never import dialkit, motion, or any runtime package into `src/DotGridBackground/`. Demo-only tools belong in `src/App.tsx` and `src/main.tsx`.
- **`DotGridBackground.tsx` spreads `...opts`** — new `DotGridOptions` props forward automatically to the engine. Adding a new prop only requires changes to `types.ts`, `core.ts`, and `App.tsx` (DialKit config).
- **`resolveOptions()` in `types.ts`** is the single place defaults are applied. Always add new props + defaults there.
- **Type-check after every change:** `npx tsc -p tsconfig.app.json --noEmit`

## Goal: publishable npm package

The end goal is to publish this as a standalone npm package (e.g. `@yourscope/dot-grid-background`)
so anyone can `npm install` and drop it into their project. The component architecture was
deliberately designed for this — framework-agnostic core, React wrapper as a thin layer,
zero runtime dependencies, TypeScript types included.

**The packaging steps are fully documented in `PACKAGING.md`** — tsup build config, `package.json`
exports/peerDependencies, README, LICENSE, `npm pack` local testing, and `npm publish`. This
work has not been executed yet; it is the explicit next milestone when the user is ready.

Do not execute packaging steps without being explicitly asked to.

## Where things live

| What                               | File                                          |
| ---------------------------------- | --------------------------------------------- |
| Props + defaults                   | `src/DotGridBackground/types.ts`              |
| All draw logic                     | `src/DotGridBackground/core.ts`               |
| React wrapper                      | `src/DotGridBackground/DotGridBackground.tsx` |
| Demo + DialKit panel               | `src/App.tsx`                                 |
| Algorithm docs + npm publish guide | `PACKAGING.md`                                |
| Handoff / session state            | `docs/HANDOFF.md`                             |
