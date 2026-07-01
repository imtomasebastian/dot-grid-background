# Handoff — DotGridBackground component & demo

## What this project is

An interactive animated **dot-grid canvas background**, reverse-engineered from
`stitch.withgoogle.com`, built as a reusable React component intended for future npm
publishing. Located at `/Users/tomas/Projects/playground` (Vite + React 19 + TypeScript).

Architecture: **framework-agnostic core engine + thin React wrapper**, so the core has zero
runtime dependencies (a deliberate selling point). DialKit (live control panel) is used **only
in the demo**, never in the component.

### Key files
- `src/DotGridBackground/perlin.ts` — zero-dep 2D Perlin noise
- `src/DotGridBackground/types.ts` — `DotGridOptions`, `DEFAULTS`, `resolveOptions()`, `parseColor()`
- `src/DotGridBackground/core.ts` — `createDotGrid(canvas, opts)`: grid, rAF loop, ResizeObserver, mouse + click listeners, all draw math
- `src/DotGridBackground/DotGridBackground.tsx` — React wrapper (`'use client'`, fade-in, spreads `...opts` so new options auto-forward)
- `src/DotGridBackground/index.ts` — public exports
- `src/App.tsx` — demo page + DialKit control panel (folders: dots, cursor, noise, hover, ripple; plus top-level `background`)
- `src/main.tsx` — mounts `<DialRoot position="top-right" />` + `import 'dialkit/styles.css'`
- `src/vite-env.d.ts` — Vite client types + `declare module 'dialkit/styles.css'`

## Full reference docs (do NOT duplicate — read these)
- **`/Users/tomas/Projects/playground/PACKAGING.md`** — complete props table, per-frame algorithm explanation (push, noise, glow, bottom-fade, opacityRange, click ripple, ripple colour wave), and the 8-step npm publish guide (tsup, peerDeps, etc.). This is the source of truth for how everything works.
- **`/Users/tomas/.claude/plans/dynamic-inventing-blossom.md`** — the most recent plan (ripple colour wave), now fully implemented.

## Current state — everything below is DONE and type-checks clean

Work completed this session (chronological):
1. **DialKit migration** — replaced the hand-rolled control panel in `App.tsx` with `useDialKit`. Added `dialkit` + `motion` as devDependencies.
2. **`background`** — added as a top-level DialKit color driving the demo wrapper's background. Deliberately **not** added as a component prop (consumers use `style`/`className` — decided this is the right call, don't revisit unless asked).
3. **Glow controls** — added `hoverRadius` (defaults to `influenceRadius` when omitted), `hoverAnimate` (freeze toggle), `hoverSpeed` (independent rotation speed, decoupled from `noiseSpeed`). Fixed a bug where "static" still visually rotated: when `hoverAnimate` is false the blend angle is now computed relative to canvas center instead of the cursor.
4. **Click ripple** — `pointerdown` spawns an expanding Gaussian shockwave that pushes dots radially; the existing spring (`returnSpeed`) handles settle. Props: `rippleEnabled`, `rippleSpeed`, `rippleAmplitude`, `rippleWidth`, `rippleMaxRadius`.
5. **Ripple colour wave** — the same Gaussian envelope drives a colour tint (`env × decay × intensity`) toward `rippleColor`, layered over the glow. Props: `rippleColor` (optional), `rippleColorIntensity`.

Verification status: `npx tsc -p tsconfig.app.json --noEmit` passes clean after every change. Dev server last ran on **http://localhost:5174** (`npm run dev`). Core confirmed dependency-free (no dialkit/motion imports under `src/DotGridBackground/`).

## Possible next steps (nothing committed to)
- **Rename `hoverColors` → `glow`**: user mused "glow was probably the right name, but we can change that later." A rename would touch `types.ts`, `core.ts` (`hover0/hover1/hoverColors/hoverRadius/hoverAnimate/hoverSpeed`), `App.tsx` DialKit folder, and `PACKAGING.md`. Not started.
- **npm packaging**: fully documented in `PACKAGING.md` (tsup config, package.json exports/peerDeps, README, LICENSE, `npm pack`, publish). Explicitly deferred — was always a documented "next milestone," not to be executed without a go-ahead.
- Possible future extensions noted as out-of-scope: two-colour ripple gradient, ripple alpha/brightness boost, multi-ring ripple oscillation, Vue/vanilla adapters, touch drag support, the Stitch "aurora" glow layer.

## Working style notes (from this user)
- Iterative and hands-on — ships small changes, tests visually in the demo, then asks for the next tweak. Keep changes surgical.
- Cares about **prop naming clarity** (pushed back hard on `glowColors` before settling on `hoverColors`). Expect naming discussions.
- Values simplicity and asks "is it worth it?" — give a direct recommendation, not a menu.
- The component must stay **zero-dependency**; DialKit/motion belong to the demo only.
- Every tunable value should be a DialKit control so it can be tweaked live.

## Suggested skills
- **`interface-craft` (dialkit sub-skill)** — for any further live-control panel changes in `App.tsx`. Config syntax: slider `[default, min, max, step?]`, toggle `true`, color = hex string, nested object = folder. Access nested values via `params.folder.key`.
- **`artifact-design`** — only if the user later wants a shareable visual showcase/landing page for the component.
