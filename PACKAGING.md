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
6. **Colour shift** (only when `hoverColors` is set and the dot is within `hoverRadius`):
   - `colorInfluence` is computed independently of the push `influence`, using `hoverRadius`
   - Dim alpha: `alpha *= 1 − colorInfluence² × 0.85`
   - `hoverPhase = hoverAnimate ? time × hoverSpeed : 0` — computed once per frame
   - Compute angle from cursor to dot, use `sin(angle×2 + hoverPhase)` to oscillate `t` 0→1
   - Blend between `hoverColors[0]` and `hoverColors[1]` by `t`, mix into base color by `colorInfluence²`
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

### opacityRange

Each dot gets `restOpacity = 1 − Math.random() × opacityRange` when the grid is built.
This is a one-time random value, so dots don't flicker — they just have varied resting
brightnesses. It's applied as a multiplier before all other alpha operations, so bottom-fade
and hover-dim compose on top cleanly.

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
| `hoverColors` | `[string, string]` | `undefined` | two-tone cursor swirl; omit to keep base colour |
| `hoverRadius` | `number` | `influenceRadius` | radius (px) of the colour zone, independent of push radius |
| `hoverAnimate` | `boolean` | `true` | animate the colour pattern over time; `false` freezes it |
| `hoverSpeed` | `number` | `0.0024` | speed of colour-pattern rotation (ignored when `hoverAnimate` false) |
| `bottomFade` | `boolean` | `true` | fade dots toward bottom edge |
| `rippleEnabled` | `boolean` | `true` | enable click-to-ripple shockwave |
| `rippleSpeed` | `number` | `0.5` | wavefront expansion speed (px/ms) |
| `rippleAmplitude` | `number` | `30` | peak outward push at the wavefront (px) |
| `rippleWidth` | `number` | `70` | Gaussian σ — wave band thickness (px) |
| `rippleMaxRadius` | `number` | `800` | travel distance before fade-out (px) |
| `rippleColor` | `string` | `undefined` | colour the wave tints dots toward; omit = push-only |
| `rippleColorIntensity` | `number` | `1` | peak tint strength at the wavefront (0–1) |
| `fadeInDuration` | `number` | `1200` | React-only: mount fade-in (ms) |
| `className` | `string` | — | React-only: wrapper class |
| `style` | `CSSProperties` | — | React-only: wrapper inline style |

---

## Steps to publish to npm

These steps assume you want to publish as e.g. `@yourscope/dot-grid-background`.

### 1. Add `tsup` (the build tool)

```bash
npm install --save-dev tsup
```

`tsup` compiles TypeScript to ESM + CJS + `.d.ts` type declarations in one command,
which is the standard for modern npm packages.

### 2. Update `package.json`

Replace the current demo `package.json` with a library-focused one:

```json
{
  "name": "@yourscope/dot-grid-background",
  "version": "0.1.0",
  "description": "Interactive animated dot-grid canvas background for React",
  "license": "MIT",
  "author": "Your Name",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "sideEffects": false,
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "tsup": "^8.0.0",
    "typescript": "~5.8.3"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch"
  }
}
```

Key points:
- `react` and `react-dom` move to `peerDependencies` — not bundled into the output.
- `sideEffects: false` lets bundlers tree-shake the package.
- `files: ["dist"]` — only the compiled output ships to npm, not the demo source.

### 3. Add `tsup.config.ts`

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/DotGridBackground/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
  banner: {
    js: "'use client'",
  },
})
```

The `banner` ensures the `'use client'` directive is at the top of the compiled output,
which is required for Next.js App Router to treat this as a client component.

### 4. Add `README.md`

Write a README with install instructions, usage examples, and the props table (copy from
this doc). Include a screenshot or GIF of the effect.

### 5. Add `LICENSE`

Create an MIT (or your preferred) license file.

### 6. Build and verify

```bash
npm run build
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
