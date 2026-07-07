# DotGridBackground — Packaging Guide

This document records what was built, how it works, and the exact steps to turn it into a
publishable npm package. The demo is fully working. The packaging steps have **not** been
run yet — they are the next milestone.

---

## What was built

A reusable interactive dot-grid canvas background, reverse-engineered from
`stitch.withgoogle.com`. The project lives in `src/DotGridBackground/` and is structured
as a **framework-agnostic core engine + thin React wrapper**, so only the wrapper needs to
change when adding Vue/Svelte/vanilla-JS support later.

### Files

| File | Purpose |
|---|---|
| `src/DotGridBackground/perlin.ts` | Zero-dependency 2D Perlin noise (512-entry perm table, fade/lerp/grad) |
| `src/DotGridBackground/types.ts` | `DotGridOptions` interface, defaults, `resolveOptions()`, `parseColor()` |
| `src/DotGridBackground/core.ts` | `createDotGrid(canvas, opts)` — owns grid, rAF loop, ResizeObserver, mouse tracking |
| `src/DotGridBackground/DotGridBackground.tsx` | React wrapper (`'use client'`), fade-in, prop forwarding |
| `src/DotGridBackground/index.ts` | Public exports |
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
7. **Draw** — `ctx.arc(x, y, dotRadius, 0, 2π)` filled with `rgba(r,g,b,alpha)`.

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

Each dot gets `restOpacity = 1 − Math.random() × opacityRange` when the grid is built.
This is a one-time random value, so dots don't flicker — they just have varied resting
brightnesses. It's applied as a multiplier before all other alpha operations, so bottom-fade
composes on top cleanly.

### Clustered coverage (`clusterEnabled`)

Instead of a uniform field, dots can be masked into organic blobs with gaps between them —
a Perlin-noise threshold mask, computed once per dot at grid build time (like `opacityRange`,
static unless the grid rebuilds):

```
freq = 1 / clusterSize
n    = (noise2d(gx×freq + clusterSeed×1000, gy×freq + clusterSeed×1000) + 1) / 2   // → [0, 1]
threshold = 1 − clusterCoverage
mask = clusterEdge <= 0
  ? (n >= threshold ? 1 : 0)                                    // hard cutoff
  : smoothstep(threshold − clusterEdge×0.5, threshold + clusterEdge×0.5, n)  // feathered
restOpacity = (1 − Math.random() × opacityRange) × mask
```

`clusterSize` reads as "bigger = larger blobs" (internally the inverse of noise frequency);
`clusterCoverage` is roughly the fraction of area covered — approximate, not exact, since Perlin
values aren't uniformly distributed; `clusterEdge` is 0 (sharp) to 1 (soft feather) at each blob's
boundary; `clusterSeed` (integer) offsets the noise sample coordinates, so the same seed always
reproduces the same layout and changing it reshuffles. The mask multiplies onto `restOpacity`
independently of `opacityRange`, so both stack — a dot inside a cluster can still get random rest-
opacity dimming. Glow, ripple, and bottom-fade are untouched (they all read the same `restOpacity`
downstream). Clusters are static today; the mask function takes only `(gx, gy)`, but is the single
place a time term would go if animated drift is added later.

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

## Props reference

| Prop | Type | Default | Description |
|---|---|---|---|
| `gridSpacing` | `number` | `16` | px between dots |
| `dotRadius` | `number` | `1` | dot radius (px) |
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
| `clusterSeed` | `number` | `0` | integer seed — changes the cluster layout; same seed reproduces it |
| `cursorTracking` | `'hover' \| 'global'` | `'global'` | `'global'` follows the cursor anywhere (bounded by influenceRadius); `'hover'` reacts only when the cursor is over this instance |
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
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
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
  entry: ['src/DotGridBackground/index.ts'],
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
- **Aurora layer** — the coloured curved glow from `stitch.withgoogle.com` is a separate
  canvas layer (`auroraTunerConfig`) not included here. Could be added as a companion component.
- **Touch support** — currently mouse-only. `touchmove` could be added to `core.ts` for
  mobile interaction.
