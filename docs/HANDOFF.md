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
6. **Cross-instance sync — `rippleGroup` + `cursorTracking`** — two independent, single-purpose props (final form, after two revisions this session):
   - **`rippleGroup?: string`** — opt-in ripple relay channel. A `window` `CustomEvent('dotgrid:ripple')` carries the raw `clientX/clientY` + group id; `onPointerDown` broadcasts instead of spawning locally when a group is set (own instance receives its own broadcast, so it still ripples itself); `onRippleBroadcast` on every instance filters by matching group id and seeds a ripple in its own local coords (`clientX/Y - own rect`). Omit for solo (no broadcast, no listen).
   - **`cursorTracking?: 'hover' | 'global'`** (default `'global'`) — no broadcast at all; purely per-instance. Covers push + hover/glow together (both driven by the single `mouse` variable). `recomputeMouse()` is the single place `mouse` gets set: `'global'` always uses the raw viewport cursor converted to local coords (each instance already receives it via the existing `window` `mousemove` listener); `'hover'` only sets `mouse` while the cursor is over that instance's own rect (today's original solo behaviour). `influenceRadius`/`hoverRadius` bound how far `'global'` visibly reaches, so several nearby grids read as one continuous field while far-apart grids stay calm on their own.
   - **Revision history:** started as ripple-only `rippleGroup`. Generalized to a unified `syncGroup` + `syncEffects: ('ripple'|'cursor')[]` so a shared group id could also relay cursor push/glow — cursor sync there broadcast a per-instance "cursor is over me" boolean (`dotgrid:cursor`, keyed by `memberId`) and only activated `mouse` while *some* group member was hovered (`groupActive`). That gate cut the cursor effect off completely in the gap between two nearby boxes — a distracting flicker when dragging across it. Fixed by switching cursor to unconditional global tracking (deleted the whole broadcast layer: `CURSOR_EVENT`, `CursorBroadcast`, `memberId`, `hoverStates`, `groupActive`, `overSelfPrev`) — but that made the shared group id meaningless for cursor (any two `'global'` instances look synced regardless of id) while ripple still needed a real channel. A thought experiment on real layouts (cards/tiles wanting `'hover'`; isolated cursor sub-groups being YAGNI since distance falloff or `'hover'` already covers every real case) settled on splitting into the current two independent props, with `cursorTracking` defaulting to `'global'`. `cursorGroup` (isolated cursor sub-fields) is intentionally deferred — API is named so it could be added later without breaking either prop.
   - `draw()` and the `Ripple` type are unchanged throughout all three revisions — only how `mouse`/ripples get *seeded* changed, so push, glow, and ripple all inherit sync for free.
   - Demo: two small boxed grids in `App.tsx` (non-overlapping, top-left + lower-center — the full-page hero grid intentionally has no `rippleGroup`, since its rect covers the whole page and would double-broadcast with any overlapping grouped grid). DialKit `sync` folder (`ripple`/`cursorGlobal` toggles) drives both props live, independently. Plan: `~/.claude/plans/read-docs-handoff-md-imagine-we-radiant-sphinx.md`.

Verification status: `npx tsc -p tsconfig.app.json --noEmit` passes clean after every change. Dev server last ran on **http://localhost:5174** (`npm run dev`). Core confirmed dependency-free (no dialkit/motion imports under `src/DotGridBackground/`). Verified live via `agent-browser` + in-page canvas pixel polling / `performance.now()` timing (screenshot-timing alone was unreliable due to CLI round-trip overhead): ripple broadcast fires only when grouped, peer ripple arrives with correct timing/direction; hovering one demo box pushes/glows the other and both settle on cursor leave; dragging the cursor across the gap between the two demo boxes shows a continuous push/glow field with no cut-out (gap-flicker fix, still holds after the `cursorTracking` rename); toggling `ripple` and `cursorGlobal` independently in DialKit confirms the two props don't affect each other; solo grids never broadcast on the ripple channel; mismatched group ids don't cross-ripple.

## Glow × ripple color interaction bug — fixed this session

User-reported symptom: when `rippleColor` is similar/identical to one of the two `hoverColors`,
the ripple becomes almost invisible where it passes through glow-tinted dots.

**Root cause (confirmed):** in `core.ts` `draw()`, the ripple colour blend mixed *from the
already-glow-colored* `r,g,b` toward `rippleColor` (sequential, not independent blends). Where
the glow's rotating two-tone blend already happened to be near `rippleColor`, the ripple pass had
almost nothing left to move toward. Reproduced with the pre-fix defaults: hero grid's
`ripple.color` (`'#5656F0'`) equalled `hover.color1`; both demo boxes hardcoded
`rippleColor="#40D9C6"` equal to `hoverColors[1]`.

**Fix:** glow and ripple now each compute their own colour delta independently from `base`
(`glowDR/DG/DB`, `rippleDR/DG/DB`), then the deltas are **summed** (clamped to `[0,255]`) instead
of the ripple lerping from the glow's output. This guarantees the ripple always contributes a
visible shift proportional to its own envelope/intensity, regardless of what the glow is doing on
that channel. A "larger-delta-wins" combine was tried first and rejected — it still let a
sustained glow delta swamp a weaker mid-decay ripple delta on the same channel, reproducing the
original bug in a milder form.

**Verified live** via `agent-browser` canvas pixel sampling (both the hero grid and a demo box
with `rippleColor` hardcoded equal to `hoverColors[1]`): sampled RGB just before a ripple fires,
while glow phase was already trending toward the same hue as `rippleColor`, then sampled through
the ripple's pass — confirmed a clear, visible colour spike where previously the delta would have
been near-zero. `npx tsc -p tsconfig.app.json --noEmit` passes clean.

**Known minor tradeoff:** in the exact worst case (glow fully saturated to the same colour as
`rippleColor`, ripple envelope near peak), the additive sum can clamp at `255` on multiple
channels, reading as a brief brightening/whitish flash rather than a pure colour pulse. Not raised
with the user yet — revisit only if it looks off in practice (e.g. soften via a lower
`rippleColorIntensity`, or scale the sum instead of hard-clamping).

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
