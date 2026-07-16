# Handoff — DotGridBackground component & demo

## What this project is

An interactive animated **dot-grid canvas background**, built as a reusable React component
intended for future npm publishing. Located at `/Users/tomas/Projects/playground` (Vite +
React 19 + TypeScript).

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

## Glow rework — single-colour soft glow (replaces two-tone hover) — done this session

User didn't like the old two-tone rotating glow (`hoverColors` blend + near-cursor dimming) —
felt out of place next to the rest of the effect. Replaced with a single-colour soft tint,
modeled on the ripple colour wave the user already liked (pure delta-from-`base` tint, no
separate brightness/alpha term — a bright colour on a dark base *is* the highlight).

- **Old props removed entirely** (pre-release, clean break): `hoverColors`, `hoverRadius`,
  `hoverAnimate`, `hoverSpeed`, and the whole rotating angular two-tone blend + the
  `alpha *= 1 - colorInfluence² * 0.85` dimming line.
- **New props (`glow*` prefix, confirmed naming)**: `glowColor`, `glowRadius`, `glowIntensity`,
  `glowSoftness`, `glowPulseDepth`, `glowPulseSpeed`.
- **Falloff = smoothstep with a solid core**: full tint through the inner `(1 - glowSoftness)`
  fraction of `glowRadius`, feathering only across the outer `glowSoftness` band. `glowRadius`
  stays a real, predictable outer boundary (unlike a Gaussian, which never reaches exactly zero).
- **Pulse is explicitly experimental** — a slow breathing oscillation of `glowIntensity`
  (`effIntensity = glowIntensity × (1 − glowPulseDepth × (0.5 − 0.5·cos(time × glowPulseSpeed)))`),
  flagged as the first thing to cut if it doesn't fit in practice. `glowPulseDepth: 0` disables it.
- The existing glow×ripple **summed-delta combine is unchanged** — glow and ripple still each
  compute their own colour delta from `base` and sum them, so the ripple color-interaction fix
  (see below) still holds.
- Custom SVG-defined glow areas + shape morphing were discussed and **explicitly deferred** as a
  separate future milestone — a true morph needs a runtime dependency (breaks the zero-dep core
  rule), and a heavily-feathered custom shape reads as a blob anyway. If revisited: rasterize the
  SVG to an offscreen canvas, blur it, sample the bitmap per-dot — no morph library needed for a
  single static shape.
- Plan: `~/.claude/plans/i-don-t-like-the-abstract-alpaca.md`.

## Glow animation modes (`glowAnimation`) + clustered coverage (`clusterEnabled`) — done this session

User's ask: the old always-on intensity pulse (`glowPulseDepth` defaulting to `0.3`) felt
persistent rather than opt-in; wanted a second watchOS-Breathe-style animation to choose from
instead; and wanted an optional clustered/sparse coverage mode (organic blobs of dots with gaps,
not a uniform field). Resolved via a `/grill-me` session — see
`~/.claude/plans/okay-there-are-few-precious-lagoon.md` for the full decision log.

- **`glowPulseDepth`/`glowPulseSpeed` removed** (pre-release, clean break) — replaced by a single
  mode selector: **`glowAnimation: 'none' | 'pulse' | 'breathe'`**, default `'none'` (glow is now
  fully static unless opted in — this was the actual "not persistent" ask). Shared knobs
  **`glowAnimateDepth`** / **`glowAnimateSpeed`** drive whichever mode is active, computed from one
  phase: `contract = glowAnimateDepth × (0.5 − 0.5·cos(time × glowAnimateSpeed))`.
  - `'pulse'` = old behaviour, intensity-only: `effIntensity = glowIntensity × (1 − contract)`,
    radius/softness fixed.
  - `'breathe'` = new, radius + intensity contract together while softness rises (then expand back
    with softness falling) — one coupled motion, tuned ratio baked in rather than exposed as
    separate knobs: `effRadius = glowRadius × (1 − contract)`, `effIntensity = glowIntensity × (1 −
    contract)`, `effSoftness = glowSoftness + (1 − glowSoftness) × contract`.
  - If the single shared ratio ever feels too rigid, the documented escape hatch is granular
    per-property knobs (e.g. `glowBreatheRadiusDepth`) — deliberately not built yet (YAGNI until
    proven needed).
  - Verified live via `agent-browser`: canvas pixel sampling confirmed `'none'` is flat over time,
    `'pulse'` keeps a far point continuously tinted (varying strength, never drops to baseline —
    radius fixed), `'breathe'` makes a far point genuinely enter/exit the tinted zone over time
    (radius really contracts/expands, not just intensity).
- **Clustered coverage** — new opt-in props: `clusterEnabled` (default `false`, mirrors
  `rippleEnabled`'s explicit-boolean pattern), `clusterSize` (bigger = larger blobs, size-oriented
  naming chosen over raw noise-frequency naming for consumer-facing clarity), `clusterCoverage`
  (~fraction of area covered, approximate since Perlin values aren't uniform), `clusterEdge` (0 =
  sharp cutoff, 1 = soft feather), `clusterSeed` (integer; reshuffles the layout, same seed
  reproduces it). Implemented as a **Perlin-noise threshold mask** (reusing `perlin.ts`, still
  zero-dep), computed once per dot in `buildGrid()` and **multiplied onto `restOpacity`** — stacks
  independently with `opacityRange` (a dot inside a cluster can still get random rest-opacity
  dimming) and flows through glow/ripple/bottom-fade untouched since they all read `restOpacity`
  downstream. Static for now (computed at build time, rebuilt on resize/prop change, like
  `opacityRange`); `clusterMask(gx, gy)` is structured as the single place a time term would go if
  animated drift is added later — deliberately not built yet.
  - Verified live via `agent-browser` screenshots: organic blobs with real gaps (not scattered
    single dots), `clusterEdge` visibly sharp vs feathered, `clusterSeed` reshuffling the layout.
- **Distribution — executed this session**: reuse across the user's other projects goes through a
  **private git dependency**, not `npm link`/`file:` (machine-local, breaks for other checkouts/CI)
  or GitHub Packages (needs `.npmrc` auth tokens everywhere). Chosen specifically because it's a
  strict subset of the existing `PACKAGING.md` npm-publish steps — going public later is just
  adding `npm publish` on top of the same build, no rework. What was done:
  - Discovered `node_modules` had been committed the whole time (no `.gitignore` existed) — added
    `.gitignore` (`node_modules`, `dist`, `*.local`) and `git rm -r --cached node_modules` before
    pushing anywhere, so the repo isn't bloated for every future clone.
  - Created private GitHub repo `imtomasebastian/dot-grid-background`, pushed `main`.
  - `package.json` rewritten to serve both the demo (`dev`/`build`/`preview` via vite, unchanged)
    and the library (`name: "dot-grid-background"`, `main`/`module`/`types`/`exports` pointing at
    `dist/`, `files: ["dist"]`, `sideEffects: false`, `react`/`react-dom` moved to
    `peerDependencies` *and* kept in `dependencies` so the demo still runs standalone). Added
    `"prepare": "tsup"` so `dist/` is built automatically on install for git-dependency consumers
    (who never see committed build output). `"private": true` kept as a guard against an accidental
    `npm publish` until the user explicitly decides to go public.
  - `tsup.config.ts` added per `PACKAGING.md` (ESM+CJS+dts, `'use client'` banner) — needed one
    tweak beyond the doc: `tsconfig: 'tsconfig.app.json'` explicitly, since the root `tsconfig.json`
    is reference-only (no compiler options / no `jsx` setting) under this project's solution-style
    TS config, so tsup's default tsconfig lookup failed on `.tsx` without it.
  - Tagged `v0.1.0`, pushed the tag.
  - **Verified end-to-end** in a scratch project: `npm install
    "git+https://github.com/imtomasebastian/dot-grid-background.git#v0.1.0"` actually builds
    `dist/` on install via `prepare`, and `import { DotGridBackground, createDotGrid } from
    'dot-grid-background'` resolves both exports correctly.
  - Documented in `PACKAGING.md` under "Interim distribution: private git dependency".
  - **Follow-up fix (v0.1.1)**: the user caught that the first cut of packaging silently broke the
    "framework-agnostic core, zero runtime deps" architecture promise — `index.ts` bundled the
    React wrapper and the vanilla `createDotGrid` engine into one entry point, so
    `import { createDotGrid } from 'dot-grid-background'` still pulled in `react` internally, even
    though `core.ts`/`types.ts`/`perlin.ts` themselves never import it. Fixed by adding a second
    public entry: `src/DotGridBackground/vanilla.ts` (re-exports `createDotGrid`/`DotGrid`/
    `DotGridOptions` only) built as its own `tsup` entry, exposed as the `./core` subpath
    (`dot-grid-background/core`) in `package.json` `exports`. `react`/`react-dom` marked
    `optional: true` in `peerDependenciesMeta` since the `./core` subpath doesn't need them.
    Verified in a scratch project with **no react anywhere in `node_modules`**: `import {
    createDotGrid } from 'dot-grid-background/core'` resolves and works; `grep` confirmed
    `dist/core.js` has zero `react` references. Tagged `v0.1.1`.

## Shapes, rotation & size randomness — done this session

Added shape choice, static rotation (+ randomness), and size randomness, all decided via a
`/grilling` session (see `~/.claude/plans/drifting-swimming-owl.md` for the full decision log).

- **`shape: 'dot' | 'square' | 'triangle' | 'line'`** (default `'dot'`) — shape is purely a
  draw-time concern. Push/noise/glow/ripple/opacity all operate on `dot.x`/`dot.y` unchanged;
  only the final paint at the end of the per-dot loop in `core.ts` branches on shape. `dot` is
  filled via `arc()` (unchanged behaviour); `square`/`triangle` are filled polygons; `line` is a
  stroked segment (`lineWidth` controls stroke width, no-op for other shapes).
- **`dotRadius` renamed to `shapeSize`** (pre-release clean break) — discoverability over
  precision; `dotRadius` read oddly once triangles/lines exist. `shapeSize` uses **full-extent**
  semantics (px across — diameter/side/length), not radius, so the number reads the same
  regardless of shape. Default `2` (visually identical to the old `dotRadius: 1`).
- **`shapeSizeRange`** — per-dot random size reduction (0–1), mirrors `opacityRange` exactly:
  frozen at grid build, doesn't shimmer.
- **Rotation is static, not animated** — a "spinning" mode was explicitly ruled out. This let
  rotation be precomputed once per dot at grid build (`buildShapeVerts()` returns rotated vertex
  *offsets* relative to the dot's position), so the hot draw loop only adds — no per-frame trig
  or `ctx.save/rotate/restore`, same cost as drawing a plain dot.
  - **`shapeRotation`** (degrees, default `0`) — global static angle. No-op for `'dot'`.
  - **`shapeRotationRandom: 'none' | 'jitter' | 'steps'`** (default `'none'`) + shared
    **`shapeRotationAmount`** (degrees) — mirrors the `glowAnimation` mode-enum-with-shared-knobs
    pattern. `'jitter'` = continuous scatter (`base ± random(0…amount)`); `'steps'` = snaps to
    `base + k × amount` for random integer `k` (e.g. `amount: 45` ⇒ only 0/45/90/…/315°).
- **No engine clamp** of `shapeSize` against `gridSpacing` — shape overlap is a valid deliberate
  look; the DialKit demo slider `max` is the only guardrail (kept unbounded in the prop itself).
- **Line geometry**: length = `shapeSize` (no special-cased fixed length), canonically
  **horizontal** at `shapeRotation = 0` — the demo's bottom-left→top-right 45° look is just a
  demo default (`shape.rotation` DialKit default), not baked into the shape itself.
- **Deferred, not built**: live rotation animation (spin), rounded corners, outlined/stroke-only
  squares & triangles. All clean future additions — the "steps" rotation mode combined with a
  polygon's own symmetry (e.g. a square at 90°-multiples) is expected and not treated as a bug.
- **DialKit-in-package question resolved as a hard no** (same rule as React/zero-dep) — a
  "ship a DialKit config preset" idea was explored and rejected: it'd be a third public entry
  point serving only a minority of consumers, and would put DialKit-flavored data inside
  `src/DotGridBackground/`, which the whole architecture fights to keep pure. Landed on:
  DialKit guidance (if ever written) belongs only in the README as a copy-paste block — nothing
  shipped in the package.
- Demo (`App.tsx`): `gridSpacing` slider max lowered `60 → 48`; new `shape` DialKit folder
  (`type`, `rotation`, `rotationMode`, `rotationAmount`, `sizeRange`, `lineWidth`); `dots.dotRadius`
  renamed to `dots.shapeSize` (range `[2, 1, 32]`).
- Verified: `npx tsc -p tsconfig.app.json --noEmit` passes clean. Core confirmed still
  zero-dependency (no new imports beyond `perlin`/`types` in `core.ts`).

## Cross-instance field alignment (`pageAligned`) + `seed` rename — done this session

Goal: let two mounted grids render as windows onto the **same** underlying dot field, so a smaller
recoloured grid can sit "inside" a larger one with dots that line up. Designed conversationally
(full decision log: the session scratch file `pageAligned-design.md`; superseded research files
`patternGroup-research.md` / `HANDOFF-patternGroup-research.md` kept only as history).

- **`pageAligned?: boolean`** (default `false`, opt-in). `true` → the grid anchors its lattice to
  **page/document coordinates** instead of its own top-left, so grids sharing `seed` + `gridSpacing`
  read as one continuous field. Named for what it is (coordinate origin), not the pattern —
  deliberately rejected `patternGroup`/a string group id (nothing needs cross-instance coordination;
  alignment is emergent from both grids measuring themselves against the same frame). Chose opt-in
  over default so a solo drop-in stays position-independent and each grid renders identically
  wherever placed.
- **Coordinate-role split in `buildGrid()`** (the crux): `gx`/`gy` now diverge into **local** draw
  coords (phase-shifted by the fractional page phase so the visible lattice registers globally) and
  **world** sample coords (`getBoundingClientRect() + scrollX/Y`, fed to the cluster mask + per-dot
  hash). Both offsets `0` when `pageAligned` off → byte-for-byte the old local grid. Page coords (not
  raw viewport rect) so alignment survives scroll; measurement is build-time only, zero per-frame
  cost. One extra row/col of coverage when aligned (phase shift pulls the lattice up/left).
- **Single deterministic RNG path** — removed `Math.random()` from `buildGrid()`/`pickRotationDeg()`
  entirely, replaced with `hash(x, y, seed, salt)` (integer xxHash-style scramble, no trig, coords
  rounded so sub-pixel differences between aligned grids collapse). Per-channel salts
  (`SALT_OPACITY`/`SALT_SIZE`/`SALT_ROTATION`) decorrelate opacity/size/rotation. Two behaviour
  changes: (+) resizes no longer reshuffle per-dot cosmetics (killed the flicker); (~) a one-time
  arrangement change for grids using `opacityRange`/`shapeSizeRange`/random rotation — defaults
  (ranges `0`) are pixel-identical.
- **`clusterSeed` → `seed`** (renamed; now seeds cluster layout *and* all per-dot cosmetics *and* the
  aligned-field identity). Kept as a **deprecated alias** (not a clean rename — ~650 weekly npm
  downloads) mapped to `seed` in `resolveOptions()` when `seed` is unset; `seed` wins if both set.
  `ResolvedDotGridOptions` drops `clusterSeed` (`Required<Omit<…, 'clusterSeed'>>`) so the engine
  only reads `seed`. `update()` normalises the alias on the **raw `newOpts`** before merging (else
  `prev.seed` masks it) and its rebuild-trigger watches both `seed` and `clusterSeed`.
- **Demo (`App.tsx`)**: `seed` + `pageAligned` moved into the `dots` DialKit folder (seed removed
  from `clusters`); render refactored to spread a shared `field` object into two grids (hero + a
  centred overlay box with `baseColor="#5656F0"`), demonstrating the recommended consumer pattern —
  toggle `dots.pageAligned` to watch the overlay's dots snap into / drift out of the field. Removed
  the orphaned `groupDemoBoxA/B` styles (dead since the old sync demo was removed).
- Docs updated: README props table + a new "Aligning overlapping grids" usage section; `PACKAGING.md`
  props table + a new "Determinism & seeding" section + algorithm pseudo-code (`Math.random` → `hash`).
- **Also this session (housekeeping):** removed all origin-attribution mentions of the tool this
  effect was originally modelled on, across `types.ts`, `PACKAGING.md`, and this file, per user request.
- Verification: `npx tsc -p tsconfig.app.json --noEmit` passes clean. Core confirmed still
  zero-dependency (no new imports in `core.ts` beyond `perlin`/`types`). **Visual alignment not yet
  eyeballed in the running demo** — the design flagged this needs the dev server + eyes (tsc won't
  catch a phase-offset bug); run `npm run dev` and toggle `pageAligned` to confirm before shipping.

## Performance rework (branch `perf-upgrades`) — done this session

User-reported symptom: tight configs (gridSpacing 4, shapeSize 2 → ~100k dots on a large
viewport) get laggy. Requirement: improve performance while keeping the output **exactly**
identical. All changes are in `core.ts` + `perlin.ts`; no API/props changes.

What was done (in rough order of impact):
1. **Style batching (opaque dots)** — dots are grouped per final rgba() style and painted as
   one multi-subpath `fill()`/`stroke()` per style instead of one per dot (the former ~100k
   `beginPath/fill` pairs dominated frame time). Only **opaque** (`alphaQ >= 1000`) dots batch:
   a same-style opaque fill composites identically regardless of grouping/overlap, while
   translucent overlaps double-blend when painted separately — so translucent dots keep the
   original per-dot painting in grid order (no regression, just no speedup there). rgba()
   strings are memoised in a Map keyed by packed `(r,g,b,alphaQ)` int (capped, self-describing
   keys). A `lastKey/lastArr` fast path skips the Map lookup for same-style runs.
2. **Cached per-dot rest alpha (`dot.alphaQ`)** — `baseOpacity × restOpacity × bottomFade`,
   quantised to the same 3-decimal precision the old `alpha.toFixed(3)` painted, recomputed by
   `refreshAlphas()` only when one of its inputs (or canvasH) changes — never per frame.
   `alphaQ <= 0` dots (cluster gaps etc.) are skipped entirely, including physics (they're
   snapped home when going invisible so they can't strand mid-displacement).
3. **Settle parking** — when the frame is provably final (cursor absent or out of reach —
   `activeMouse()` bounds by max(influenceRadius, glowRadius) — no live ripples, max dot
   displacement < 1e-4), `settled = true` and the rAF loop keeps ticking but skips `draw()`
   entirely. Unset by mousemove near the grid, pointerdown/ripple broadcast, `update()`,
   and rebuilds. Idle CPU is ~zero for offscreen/undisturbed grids.
4. **Cheaper per-dot math** — ripple band test now rejects via squared distances (sqrt only
   inside the band); glow smoothstep branch gated on `glowRGB` being set; noise2d calls skipped
   when `noiseAmplitude === 0`; colour blend skipped when the max possible channel shift < 0.5
   (rounds back to base anyway — provably identical); `getContext('2d')` hoisted out of draw.
5. **perlin.ts** — gradient table as flat Float64Arrays, single `Math.floor` per axis.

Measured (M-series Mac, 1600×1000 @2x, spacing 4 / size 2, glow + ripple colours on):
idle 53.7 → 60 fps (flat 16.7ms), hover 44 → ~60 fps, hover+ripples 32.5 → 53 fps
(worst frame 116ms → 33ms).

**Verified pixel-identical** via `agent-browser` screenshot diffs (0 of 6.4M pixels differ):
rest state before/after; rest state after a full push+ripple interaction then settling; and a
translucent config (`bottomFade: true, opacityRange: 0.6, baseOpacity: 0.8`) old-vs-new via
`git stash` A/B. Wake-from-parked verified by canvas pixel sampling (no tint while parked,
glow tint appears on cursor entry). `npx tsc -p tsconfig.app.json --noEmit` clean; core still
zero-dependency. Known acceptable deviation: when displaced shapes overlap *while moving*,
batched same-colour opaque fills anti-alias the overlap as a union instead of double-blending
edge pixels (subpixel-level, imperceptible; none at rest — proven by the 0-diff screenshots).

## `freeze` prop — done this session (branch `freeze`)

User's ask: a way to use the grid as a plain static decorative pattern — no push, no glow,
no ripple, no reaction of any kind.

- **`freeze?: boolean`** (default `false`). When `true`, `activeMouse()` returns `null`
  unconditionally, so the push/glow branch in `draw()` (already gated on `if (m)`) never runs.
  In-flight ripples are cleared immediately (`if (opts.freeze) ripples = []`) and
  `onPointerDown`/`onRippleBroadcast` bail early so new ones can't spawn either.
- No new physics path needed — with the cursor and ripples both suppressed, `targetX/targetY`
  fall back to `dot.gx/dot.gy` (the existing default), so any prior displacement eases back to
  rest via the normal `returnSpeed` spring, and the existing settle-parking logic (`maxDispSq <
  1e-4`) parks the draw loop once it arrives. Toggling `freeze` off restores normal reactivity
  immediately (no separate re-enable path).
- Demo: `freeze` toggle added to the `dots` DialKit folder, wired into the shared `field` object
  (both grid instances).
- **Verified live** via `agent-browser`: hovering with `freeze: true` produces a 0%-pixel-diff
  screenshot vs. rest (vs. ~0.7% with it off); a dispatched click produces no ripple; toggling
  `freeze` off restores the ~0.7% hover diff; re-enabling `freeze` while still hovering eases the
  grid back to and settles at a canvas pixel-identical to a from-rest frozen state (0% diff).
  `npx tsc -p tsconfig.app.json --noEmit` passes clean.

## Possible next steps (nothing committed to)
- **npm packaging**: `PACKAGING.md` steps 4–8 remain (README, LICENSE, `npm pack` local test, flip `private` to `false`, `npm publish`). Explicitly deferred — do only when asked.
- **Consume in another project**: add `"dot-grid-background": "git+https://github.com/imtomasebastian/dot-grid-background.git#v0.1.0"` to that project's `package.json` and `npm install`. Bump the `#vX.Y.Z` tag (new tag pushed from this repo) to pick up updates.
- **Custom SVG glow shape** (single shape, no morph) — deferred this session, see above.
- **Live shape rotation animation (spin), rounded shape corners, outlined/stroke-only square & triangle** — all deferred this session, see above.
- **Granular per-property breathe knobs** (`glowBreatheRadiusDepth` etc.) — only if the single coupled `glowAnimateDepth` ratio proves too rigid in practice.
- **Animated cluster drift** — `clusterMask(gx, gy)` is structured to take a time term later; not built.
- Possible future extensions noted as out-of-scope: two-colour ripple gradient, ripple alpha/brightness boost, multi-ring ripple oscillation, Vue/vanilla adapters, touch drag support, an "aurora" glow layer.

## Working style notes (from this user)
- Iterative and hands-on — ships small changes, tests visually in the demo, then asks for the next tweak. Keep changes surgical.
- Cares about **prop naming clarity** (pushed back hard on `glowColors` before settling on `hoverColors`). Expect naming discussions.
- Values simplicity and asks "is it worth it?" — give a direct recommendation, not a menu.
- The component must stay **zero-dependency**; DialKit/motion belong to the demo only.
- Every tunable value should be a DialKit control so it can be tweaked live.

## Suggested skills
- **`interface-craft` (dialkit sub-skill)** — for any further live-control panel changes in `App.tsx`. Config syntax: slider `[default, min, max, step?]`, toggle `true`, color = hex string, nested object = folder. Access nested values via `params.folder.key`.
- **`artifact-design`** — only if the user later wants a shareable visual showcase/landing page for the component.
