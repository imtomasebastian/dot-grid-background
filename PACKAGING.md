# DotGridBackground — Packaging Guide

This document records what was built, how it works, and the exact steps to turn it into a
publishable npm package. The demo is fully working. The packaging steps have **not** been
run yet — they are the next milestone.

---

## What was built

A reusable interactive dot-grid canvas background. The project lives in
`src/DotGridBackground/` and is structured as a **framework-agnostic core engine + thin React
wrapper**, so only the wrapper needs to change when adding Vue/Svelte/vanilla-JS support later.

### Files

| File | Purpose |
|---|---|
| `src/DotGridBackground/perlin.ts` | Zero-dependency 2D Perlin noise (512-entry perm table, fade/lerp/grad) |
| `src/DotGridBackground/types.ts` | `DotGridOptions` interface, defaults, `resolveOptions()`, `parseColor()` |
| `src/DotGridBackground/core.ts` | `createDotGrid(canvas, opts)` — owns grid, rAF loop, ResizeObserver, mouse tracking |
| `src/DotGridBackground/DotGridBackground.tsx` | React wrapper (`'use client'`), fade-in, prop forwarding |
| `src/DotGridBackground/index.ts` | Public exports — main entry (`.`), includes the React wrapper, requires `react`/`react-dom` |
| `src/DotGridBackground/vanilla.ts` | Public exports — `./core` subpath entry, framework-agnostic only, no `react` import anywhere in its bundle |
| `src/App.tsx` | Demo: full-screen background + live control panel |

---

## How the effect works

### Per-frame algorithm

Every `requestAnimationFrame`, for each dot on the grid:

1. **Mouse influence** — if the cursor is within `influenceRadius` px of the dot's home
   position, compute `a = 1 − dist/radius` (0 → 1 as the cursor nears).
2. **Repel** — push the dot away: `push = a³ × maxPush`. Direction = from cursor to dot.
3. **Perlin drift** — add noise-based displacement on top of the repel:
   `dx += noise(gx×scale, gy×scale + time) × a² × amplitude`. This makes movement organic.
4. **Ease back** — lerp current position toward target each frame:
   `dot.x += (target − dot.x) × returnSpeed`. Lower `returnSpeed` = more lag/bounce feel.
5. **Bottom fade** — alpha fades to 0 in the bottom 25% of the canvas.
6. **Glow tint** (only when `glowColor` is set and the dot is within `glowRadius`):
   - `colorInfluence` is computed independently of the push `influence`, using `glowRadius`
   - Smoothstep falloff with a solid core: full tint (`colorInfluence = 1`) through the inner
     `(1 − glowSoftness)` fraction of the radius, then feathers to 0 across the outer
     `glowSoftness` band — no hard edge, but `glowRadius` stays a real outer boundary
   - `glowAnimation` (`'none' | 'pulse' | 'breathe'`, default `'none'`) drives an optional
     animation, computed once per frame from a shared phase:
     `contract = glowAnimateDepth × (0.5 − 0.5×cos(time × glowAnimateSpeed))` (0 at full inhale,
     up to `glowAnimateDepth` at full exhale). `'none'` → `contract = 0`, fully static.
     `'pulse'` → only `effIntensity = glowIntensity × (1 − contract)`; radius/softness stay fixed.
     `'breathe'` (watchOS-Breathe-style) → radius and intensity contract together while softness
     rises, then expand back with softness falling: `effRadius = glowRadius × (1 − contract)`,
     `effIntensity = glowIntensity × (1 − contract)`, `effSoftness = glowSoftness + (1 −
     glowSoftness) × contract`. One shared depth/speed pair drives whichever mode is active; if a
     single coupled ratio ever proves too rigid, the natural next step is per-property knobs
     (`glowBreatheRadiusDepth`, etc.) instead of the shared `glowAnimateDepth`.
   - Mix toward `glowColor` by `colorInfluence × effIntensity` (no alpha dimming — the tint itself
     is the highlight)
7. **Draw** — shape-dependent (see "Shapes" below); colour/alpha math above is shared by all shapes.

### Shapes (`shape`, `shapeSize`, `shapeRotation*`, `lineWidth`)

Shape is purely a draw-time concern — push, noise, glow, ripple, and opacity all operate on a
dot's *position*, so none of that math changes when the shape changes. Only the final paint at
the end of the per-dot loop branches on `shape`:

- `'dot'` — unchanged: `ctx.arc(x, y, radius, 0, 2π)` filled.
- `'square'` / `'triangle'` — filled polygon via `moveTo`/`lineTo` over precomputed vertex offsets.
- `'line'` — stroked segment (`ctx.lineWidth`, `ctx.stroke()`) between two precomputed endpoint
  offsets.

Size and rotation are **static and frozen per dot at grid build time** (like `opacityRange`), not
recomputed every frame:

```
sizeMult   = 1 − hash(wx, wy, seed) × shapeSizeRange
halfExtent = (shapeSize / 2) × sizeMult          // full-extent semantics: shapeSize is px across
angleDeg   = shapeRotation, adjusted by shapeRotationRandom:
  'none'   → shapeRotation
  'jitter' → shapeRotation ± hash(0…shapeRotationAmount)       // continuous scatter
  'steps'  → shapeRotation + k × shapeRotationAmount, k = hashed integer
                                                                // (e.g. amount 45 ⇒ only 0/45/90/…)
verts = buildShapeVerts(shape, halfExtent, angleDeg)  // rotated offsets relative to (dot.x, dot.y)
```

`buildShapeVerts` returns rotated corner/endpoint offsets — a square's 4 corners, a triangle's 3
(circumradius = `halfExtent`, canonical point-up), or a line's 2 endpoints (canonical horizontal at
`shapeRotation = 0`). Because everything is precomputed once, the per-frame draw loop only adds
these frozen offsets to the dot's current `(x, y)` — no trig, no `ctx.save/rotate/restore` per
frame, so drawing a rotated square is exactly as cheap as drawing a dot.

`shapeSize` uses full-extent semantics (diameter/side/length, not radius) so the number reads as
"how many px across" regardless of shape — a `shapeSize: 4` line is a 4px line. There's no engine
clamp against `gridSpacing`; shapes overlapping into each other is a valid deliberate look, not
something the engine second-guesses — the DialKit demo just picks a sane slider `max` as a
guardrail.

`lineWidth` is the one draw-time-only prop (stroke width for `'line'`) — it doesn't affect
geometry, so changing it doesn't trigger a grid rebuild.

Deferred (not built): live rotation animation (spin), rounded corners, and outlined (stroke-only)
squares/triangles — all clean future additions if wanted, not needed for this round.

### Click ripple

A click spawns a `{ x, y, start }` entry in a ripple array. Each frame:

1. **Expand wavefront** — `waveRadius = (now − start) × rippleSpeed`.
2. **Decay** — `decay = 1 − waveRadius / rippleMaxRadius`. Ripple is pruned when it reaches `rippleMaxRadius`.
3. **Per dot** — compute the dot's distance from the click origin. `front = dist − waveRadius`. A Gaussian envelope `exp(−front² / 2σ²)` (where σ = `rippleWidth`) is zero except near the wavefront. Offset = `envelope × rippleAmplitude × decay` in the radial direction. This is added to the dot's `targetX/targetY` before the ease step.
4. **Spring handles the rest** — the existing `returnSpeed` easing makes each dot spring out and settle back as the ring passes through it. No extra physics needed.

Multiple ripples sum their contributions. Rapid clicks naturally stack.

If `rippleColor` is set, the same Gaussian envelope `env` that drives displacement also drives
a colour mix toward the ripple colour: `amt = env × decay × rippleColorIntensity`. The tint is
layered on top of whatever the glow produced, so the two effects compose cleanly — the ripple
colour momentarily overrides the glow exactly where the ring is strongest.

### Cross-instance sync (`rippleGroup` / `cursorTracking`)

These are two independent props for two effects with fundamentally different needs: ripple is a
discrete event that must be *relayed* between instances (needs a named channel), while cursor
reaction is a continuous distance-bounded field (a channel doesn't add anything a plain global
read doesn't already give you). Mixing them into a single group knob was tried first and dropped
— see "Design history" below.

- **`rippleGroup?: string`** — opt-in ripple relay channel. Each instance already listens for
  clicks on `window` (not its own div) and stores ripple origins as `client − ownRect`, so the
  same screen-space click point maps to correct local coordinates in every instance for free.
  When `rippleGroup` is set, a click doesn't spawn a ripple directly — it broadcasts
  `{ group, clientX, clientY }` via a `window` `CustomEvent('dotgrid:ripple')` instead. Every
  instance (including the one clicked) listens for that event, and any instance whose own
  `rippleGroup` matches seeds a ripple using its *own* rect to convert the shared screen point
  into local coordinates. Reads as one continuous ring sweeping across every grouped instance,
  gap between divs included. A ripple still fades out after `rippleMaxRadius`, so grids farther
  apart than that need a larger radius (and/or `rippleSpeed`) for the wave to visibly arrive.
  Omit for a solo grid — no broadcast, no listen. Group members should occupy non-overlapping
  screen regions (overlap double-counts clicks) — don't group a full-bleed background with a
  nested grid.
- **`cursorTracking?: 'hover' | 'global'`** (default `'global'`) — per-instance, no broadcast at
  all. Covers push *and* glow together, since both are driven by the same `mouse` position.
  `'global'` tracks the page cursor everywhere (converted to local coords via its own rect on
  every move); `influenceRadius`/`glowRadius` bound how far the effect visibly reaches, so
  several nearby grids read as one continuous field (no cut-out in the gap between them) while
  far-apart grids stay calm on their own — the cursor is simply out of range. `'hover'` reacts
  only while the cursor is over that instance's own rect — right for discrete cards/tiles that
  should light up only when directly pointed at, not whenever the mouse is nearby.

There's intentionally no `cursorGroup` for isolated cursor sub-fields (e.g. two clusters on the
same page that shouldn't influence each other's cursor reaction). Every real scenario considered
was already covered by distance falloff (far-apart clusters self-isolate under `'global'`) or by
`'hover'` (a lone card that shouldn't react to a neighboring cluster's cursor) — a true cursor
sub-group would only matter for two internally-connected clusters crammed within
`influenceRadius` of each other, which is a narrow enough case to defer.

**Design history:** an earlier version unified both under one `syncGroup` + `syncEffects:
('ripple' | 'cursor')[]` pair, with cursor sync gated on a per-instance "cursor is over me"
broadcast (only active while some group member was hovered). That gate cut the cursor effect off
entirely in the gap between grouped instances — a distracting flicker when dragging across it.
Switching cursor to unconditional global tracking fixed the flicker, but made the shared group id
meaningless for cursor (any two `'global'` instances look synced regardless of id) while ripple
still needed a real channel — so the two were split into separate props instead.

### opacityRange

Each dot gets `restOpacity = 1 − hash(wx, wy, seed) × opacityRange` when the grid is built.
This is a one-time value per dot, so dots don't flicker — they just have varied resting
brightnesses. It's applied as a multiplier before all other alpha operations, so bottom-fade
composes on top cleanly. The value comes from a deterministic position hash (not `Math.random`),
so it's stable across rebuilds/resizes and reproducible from `seed` — see "Determinism & seeding".

### Clustered coverage (`clusterEnabled`)

Instead of a uniform field, dots can be masked into organic blobs with gaps between them —
a Perlin-noise threshold mask, computed once per dot at grid build time (like `opacityRange`,
static unless the grid rebuilds):

```
freq = 1 / clusterSize
n    = (noise2d(gx×freq + seed×1000, gy×freq + seed×1000) + 1) / 2   // → [0, 1]
threshold = 1 − clusterCoverage
mask = clusterEdge <= 0
  ? (n >= threshold ? 1 : 0)                                    // hard cutoff
  : smoothstep(threshold − clusterEdge×0.5, threshold + clusterEdge×0.5, n)  // feathered
restOpacity = (1 − hash(gx, gy, seed) × opacityRange) × mask
```

`clusterSize` reads as "bigger = larger blobs" (internally the inverse of noise frequency);
`clusterCoverage` is roughly the fraction of area covered — approximate, not exact, since Perlin
values aren't uniformly distributed; `clusterEdge` is 0 (sharp) to 1 (soft feather) at each blob's
boundary; `seed` (integer) offsets the noise sample coordinates, so the same seed always
reproduces the same layout and changing it reshuffles. The mask multiplies onto `restOpacity`
independently of `opacityRange`, so both stack — a dot inside a cluster can still get random rest-
opacity dimming. Glow, ripple, and bottom-fade are untouched (they all read the same `restOpacity`
downstream). Clusters are static today; the mask function takes only `(gx, gy)`, but is the single
place a time term would go if animated drift is added later.

### Determinism & seeding (`seed`, `pageAligned`)

All per-dot randomness — cluster layout, `opacityRange`, `shapeSizeRange`, and
`shapeRotationRandom` — comes from a deterministic hash `hash(x, y, seed, salt)` rather than
`Math.random()`. The hash is an integer scramble (xxHash-style, no trig) returning `[0, 1)`; a
per-channel `salt` (opacity / size / rotation) keeps the three streams decorrelated so a dim dot
isn't also always the smallest. Two consequences:

- **Stable across rebuilds.** A resize (or any prop change that rebuilds the grid) no longer
  reshuffles the field — a dot's opacity/size/rotation is a function of its position + `seed`, not
  of call order. `seed` is the single knob that reshuffles everything; the same seed always
  reproduces the same field.
- **`clusterSeed` → `seed`.** The old `clusterSeed` seeded only the cluster mask; `seed` now seeds
  everything. `clusterSeed` is still accepted as a deprecated alias (mapped to `seed` when `seed`
  is unset, in `resolveOptions()`), removed next major.

**`pageAligned`** makes two grids render as one continuous field. Each dot has two coordinate roles
that normally coincide but diverge when aligned:

- **local** (`gx`/`gy`, where the dot is drawn on its own canvas) — phase-shifted by the fractional
  page phase `((pageX % gridSpacing) + gridSpacing) % gridSpacing` so the visible lattice registers
  with the global one;
- **world** (`wx`/`wy`, the dot's page-space position = `getBoundingClientRect()` + `scrollX/Y`) —
  fed to the cluster mask and the per-dot hash, so the same physical point yields the same dot in
  every aligned grid.

Both offsets are `0` when `pageAligned` is off, so a solo grid is byte-for-byte a local grid. Using
page coords (not viewport) keeps alignment stable across scroll; the measurement is build-time only
(mount / resize), so there's no per-frame or scroll-listener cost.

### HiDPI / resize

`ResizeObserver` watches the parent element. On each resize it sets:
```
canvas.width  = cssWidth  × devicePixelRatio
canvas.height = cssHeight × devicePixelRatio
ctx.scale(dpr, dpr)
```
This keeps the canvas pixel-crisp on retina displays. The dot grid is always rebuilt after
a resize so dot count matches the new dimensions.

### SSR safety

`createDotGrid()` only touches the DOM when called with a real `HTMLCanvasElement`. The
React wrapper calls it inside `useEffect`, which never runs on the server. Safe to use in
Next.js App Router, Remix, etc.

---

## Entry points

The package ships two entries so the framework-agnostic core is actually reachable without React,
not just architected that way internally:

- **`dot-grid-background`** (main, `.`) — `DotGridBackground` React component. Requires `react`/
  `react-dom` (declared as `peerDependencies`, marked `optional` in `peerDependenciesMeta` since
  they're only needed if you use this entry).
- **`dot-grid-background/core`** (`./core`) — `createDotGrid(canvas, opts)` + `DotGridOptions`
  type only. Zero runtime dependencies, verified by building it as its own `tsup` entry
  (`src/DotGridBackground/vanilla.ts`) so it's a physically separate bundle — `dist/core.js` has
  no `react` import anywhere in it, confirmed by grepping the built output. Use this for a vanilla
  `<canvas>` in a non-React project.

## Props reference

| Prop | Type | Default | Description |
|---|---|---|---|
| `gridSpacing` | `number` | `16` | px between dots |
| `shape` | `'dot' \| 'square' \| 'triangle' \| 'line'` | `'dot'` | shape drawn at each grid point |
| `shapeSize` | `number` | `2` | full extent (px) — diameter/side/length depending on `shape` |
| `shapeSizeRange` | `number` | `0` | per-dot random size reduction (0–1, 0 = uniform) |
| `shapeRotation` | `number` | `0` | global static rotation (degrees); no-op for `'dot'` |
| `shapeRotationRandom` | `'none' \| 'jitter' \| 'steps'` | `'none'` | per-dot rotation randomness mode; no-op for `'dot'` |
| `shapeRotationAmount` | `number` | `0` | degrees used by `shapeRotationRandom` (max jitter, or step size) |
| `lineWidth` | `number` | `1` | stroke width (px) for the `'line'` shape |
| `influenceRadius` | `number` | `725` | cursor reach (px) |
| `maxPush` | `number` | `28` | max repel displacement |
| `returnSpeed` | `number` | `0.035` | ease-back per frame (0–1) |
| `noiseAmplitude` | `number` | `6` | organic drift strength |
| `noiseScale` | `number` | `0.04` | drift spatial frequency |
| `noiseSpeed` | `number` | `0.0008` | drift time evolution |
| `baseColor` | `string` | `'#444'` | dot colour at rest |
| `baseOpacity` | `number` | `1` | global max alpha |
| `opacityRange` | `number` | `0` | per-dot random opacity variation (0 = uniform) |
| `glowColor` | `string` | `undefined` | colour the cursor's glow region tints toward; omit to keep base colour |
| `glowRadius` | `number` | `influenceRadius` | radius (px) of the glow zone, independent of push radius |
| `glowIntensity` | `number` | `1` | peak tint strength at the core (0–1) |
| `glowSoftness` | `number` | `0.33` | fraction of `glowRadius` that feathers (0 = hard disc, 1 = full dome) |
| `glowAnimation` | `'none' \| 'pulse' \| 'breathe'` | `'none'` | glow animation mode — static, intensity-only pulse, or watchOS-style breathe (radius+intensity+softness coupled) |
| `glowAnimateDepth` | `number` | `0.3` | how deep the glow animation swings (0 = static regardless of mode) |
| `glowAnimateSpeed` | `number` | `0.0014` | glow animation rate |
| `bottomFade` | `boolean` | `true` | fade dots toward bottom edge |
| `rippleEnabled` | `boolean` | `true` | enable click-to-ripple shockwave |
| `rippleSpeed` | `number` | `0.5` | wavefront expansion speed (px/ms) |
| `rippleAmplitude` | `number` | `30` | peak outward push at the wavefront (px) |
| `rippleWidth` | `number` | `70` | Gaussian σ — wave band thickness (px) |
| `rippleMaxRadius` | `number` | `800` | travel distance before fade-out (px) |
| `rippleColor` | `string` | `undefined` | colour the wave tints dots toward; omit = push-only |
| `rippleColorIntensity` | `number` | `1` | peak tint strength at the wavefront (0–1) |
| `rippleGroup` | `string` | `undefined` | opt-in channel: instances sharing a group id ripple together as one ring |
| `clusterEnabled` | `boolean` | `false` | enable clustered coverage (Perlin-mask blobs instead of a uniform field) |
| `clusterSize` | `number` | `400` | approximate blob size (px-ish scale) — bigger = larger clusters |
| `clusterCoverage` | `number` | `0.4` | roughly the fraction (0–1) of the area covered by clusters |
| `clusterEdge` | `number` | `0.3` | blob edge softness (0 = sharp cutoff, 1 = soft feather) |
| `clusterSeed` | `number` | `0` | **Deprecated** — use `seed`. Still accepted (mapped to `seed` when `seed` is unset); removed next major |
| `seed` | `number` | `0` | integer seed for all per-dot randomness (cluster layout, opacity, size, rotation); same seed reproduces the field |
| `pageAligned` | `boolean` | `false` | anchor the lattice to page coords so grids sharing `seed` + `gridSpacing` read as one continuous field (overlap/stack); stays aligned across resize + scroll |
| `cursorTracking` | `'hover' \| 'global'` | `'global'` | `'global'` follows the cursor anywhere (bounded by influenceRadius); `'hover'` reacts only when the cursor is over this instance |
| `freeze` | `boolean` | `false` | render the grid as a fully static pattern — no cursor push/glow, no ripples; any existing displacement eases back to rest, then the draw loop parks |
| `fadeInDuration` | `number` | `1200` | React-only: mount fade-in (ms) |
| `className` | `string` | — | React-only: wrapper class |
| `style` | `CSSProperties` | — | React-only: wrapper inline style |

---

## Interim distribution: private git dependency (done)

Before a public npm release, this repo is reused in other projects as a **private git
dependency**, not `npm link`/`file:` (machine-local only, breaks for other checkouts/CI) and not
GitHub Packages (needs an `.npmrc` auth token in every consumer + CI). This is executed and live:

- Private repo: `github.com/imtomasebastian/dot-grid-background`, tagged `v0.1.0`.
- `package.json` has library `exports`/`peerDependencies`/`files` (steps 1–2 below) alongside the
  existing demo scripts, plus a `"prepare": "tsup"` script so `dist/` builds automatically on
  install — consumers never need to commit build output.
- `tsup.config.ts` sets `tsconfig: 'tsconfig.app.json'` explicitly (see step 3) since this repo's
  root `tsconfig.json` is reference-only.

Consumers install straight from the repo + tag:

```json
"dot-grid-background": "git+https://github.com/imtomasebastian/dot-grid-background.git#v0.1.0"
```

To ship an update: bump code, commit, `git tag vX.Y.Z && git push origin vX.Y.Z`, then consumers
bump the `#vX.Y.Z` in their `package.json` and run `npm install` again (git-URL deps don't
auto-update on `npm update`).

Going public later is not a migration: it's the same `package.json`/build, just flip `"private"`
to `false` and add `npm publish` (step 8) on top.

## Steps to publish to npm

Steps 1–3 are already done (see "Interim distribution" above) — `tsup` is installed,
`package.json` has the library fields, and `tsup.config.ts` exists. What's left for a public
release starts at step 4. Kept below for reference/history.

### 1. Add `tsup` (the build tool) — done

```bash
npm install --save-dev tsup
```

`tsup` compiles TypeScript to ESM + CJS + `.d.ts` type declarations in one command,
which is the standard for modern npm packages.

### 2. Update `package.json` — done

The actual `package.json` keeps the demo's `dev`/`build`/`preview` scripts (vite) alongside the
library fields, since this repo doubles as the demo app:

```json
{
  "name": "dot-grid-background",
  "private": true,
  "version": "0.1.1",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./core": {
      "types": "./dist/core.d.ts",
      "import": "./dist/core.js",
      "require": "./dist/core.cjs"
    }
  },
  "files": ["dist"],
  "sideEffects": false,
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "build:lib": "tsup",
    "prepare": "tsup"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true },
    "react-dom": { "optional": true }
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "...": "vite, @vitejs/plugin-react, dialkit, motion, tsup, typescript — demo + build tooling"
  }
}
```

Key points:
- `react`/`react-dom` are in **both** `peerDependencies` (what a consumer must supply — not
  bundled into `dist/`, see `external` below) and `dependencies` (so the demo app in this same
  repo runs standalone via `npm run dev`).
- `sideEffects: false` lets bundlers tree-shake the package.
- `files: ["dist"]` — only matters for `npm publish`/`npm pack`; git-dependency installs clone the
  whole repo regardless, which is why `.gitignore`-ing `node_modules`/`dist` matters for repo size.
- The `types` condition must come **first** in `exports` — esbuild/tsup warns if it comes after
  `import`/`require`, since those are matched first and `types` would never be reached.
- `"private": true` stays until an explicit decision to publish publicly — flip it to `false` as
  part of step 8.
- `"prepare": "tsup"` — not in the original public-npm plan, added specifically so git-dependency
  consumers get a built `dist/` automatically on `npm install` (see "Interim distribution" above).

### 3. Add `tsup.config.ts` — done

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/DotGridBackground/index.ts',
    core: 'src/DotGridBackground/vanilla.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  tsconfig: 'tsconfig.app.json',
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
  banner: {
    js: "'use client'",
  },
})
```

The `banner` ensures the `'use client'` directive is at the top of the compiled output,
which is required for Next.js App Router to treat this as a client component. `tsconfig:
'tsconfig.app.json'` is set explicitly — this repo's root `tsconfig.json` is a solution-style file
with no compiler options of its own (just `references`), so tsup's default lookup can't find the
`jsx` setting needed to type-check `.tsx` without pointing at the real config directly.

### 4. Add `README.md`

Write a README with install instructions, usage examples, and the props table (copy from
this doc). Include a screenshot or GIF of the effect.

### 5. Add `LICENSE`

Create an MIT (or your preferred) license file.

### 6. Build and verify

```bash
npm run build:lib
# ("build" is taken by the demo's vite build — the library build is "build:lib")
# Inspect dist/ — should contain:
#   dist/index.js        (ESM)
#   dist/index.cjs       (CommonJS)
#   dist/index.d.ts      (TypeScript declarations)
```

### 7. Test locally in another project

```bash
# In this repo
npm pack
# Creates dot-grid-background-0.1.0.tgz

# In a test project
npm install /path/to/dot-grid-background-0.1.0.tgz
```

### 8. Publish

```bash
npm login
npm publish --access public
```

---

## Future additions

- **Vanilla JS adapter** — `createDotGrid(canvas, opts)` is already framework-agnostic.
  A vanilla usage example just needs wrapping in a `<script>` tag.
- **Vue adapter** — a thin `<DotGridBackground>` SFC using `onMounted`/`onUnmounted`.
- **Aurora layer** — a coloured curved "aurora" glow could be drawn on a separate canvas layer,
  not included here. Could be added as a companion component.
- **Touch support** — currently mouse-only. `touchmove` could be added to `core.ts` for
  mobile interaction.
