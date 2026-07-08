# dot-grid-background

An interactive, animated dot-grid canvas background — cursor push/glow, click ripples, organic
Perlin drift, and optional clustered coverage. Framework-agnostic core with a thin React wrapper.

Reverse-engineered from the background effect on [stitch.withgoogle.com](https://stitch.withgoogle.com).

## Install

```bash
npm install dot-grid-background
```

`react`/`react-dom` (>=18) are optional peer dependencies — only required if you use the React
entry point below. The `./core` entry has zero runtime dependencies.

## Usage

### React

```tsx
import { DotGridBackground } from 'dot-grid-background'

export function Hero() {
  return (
    <div style={{ position: 'relative', height: '100vh' }}>
      <DotGridBackground
        glowColor="#5656F0"
        rippleColor="#5656F0"
        style={{ position: 'absolute', inset: 0 }}
      />
    </div>
  )
}
```

Safe to use in Next.js App Router / Remix — the effect only touches the DOM inside `useEffect`,
never during server rendering.

### Vanilla / non-React

```ts
import { createDotGrid } from 'dot-grid-background/core'

const canvas = document.querySelector('canvas')!
const grid = createDotGrid(canvas, { glowColor: '#5656F0' })

// later, if needed
grid.destroy()
```

The `./core` entry ships as its own bundle with no `react` import anywhere in it.

## Props

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

See [PACKAGING.md](./PACKAGING.md) for a full write-up of how the effect works internally.

## License

MIT
