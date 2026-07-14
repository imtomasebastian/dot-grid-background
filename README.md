# dot-grid-background

An interactive, animated dot-grid canvas background — cursor push/glow, click ripples, organic
Perlin drift, optional clustered coverage, and configurable shapes (dot, square, triangle, line)
with rotation and size variation. Framework-agnostic core with a thin React wrapper.

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

### Aligning overlapping grids

Set `pageAligned` and share the same `seed` + `gridSpacing` (and cluster/shape props) across
instances, and they render as one continuous field — so a smaller grid can sit "inside" a larger
one as a recoloured window onto the same dots. Spread a shared config object to keep them in sync:

```tsx
const field = {
  gridSpacing: 40,
  shape: 'dot' as const,
  clusterEnabled: true,
  clusterSize: 400,
  opacityRange: 0.5,
  shapeSizeRange: 0.3,
  seed: 3,
  pageAligned: true,
}

// Both draw the same field; only the colour differs. The inner grid's dots
// line up with the outer grid's, and stay aligned across resize and scroll.
<DotGridBackground {...field} baseColor="grey" />
<DotGridBackground {...field} baseColor="lightblue" />
```

Without `pageAligned`, each grid anchors to its own top-left instead, so they stay independent.

### Tuning with DialKit (optional)

`dot-grid-background` ships with no UI for tweaking props — that's on purpose, so the
package stays dependency-free. If you want a live control panel while you dial in values,
[DialKit](https://github.com/joshpuckett/dialkit) is a good fit: it turns a plain config
object into sliders/selects and gives you back the current values, no wiring required.

```bash
npm install dialkit
```

```tsx
import { useDialKit } from 'dialkit'
import { DotGridBackground } from 'dot-grid-background'

export function Hero() {
  const p = useDialKit('Dot Grid', {
    gridSpacing: [16, 6, 48] as [number, number, number],
    shapeSize: [2, 1, 32] as [number, number, number],
    shape: { type: 'select', options: ['dot', 'square', 'triangle', 'line'], default: 'dot' } as const,
    influenceRadius: [725, 50, 1200] as [number, number, number],
    maxPush: [28, 0, 120] as [number, number, number],
  })

  return (
    <div style={{ position: 'relative', height: '100vh' }}>
      <DotGridBackground
        gridSpacing={p.gridSpacing}
        shapeSize={p.shapeSize}
        shape={p.shape as 'dot' | 'square' | 'triangle' | 'line'}
        influenceRadius={p.influenceRadius}
        maxPush={p.maxPush}
        style={{ position: 'absolute', inset: 0 }}
      />
    </div>
  )
}
```

Add one entry per prop you want to tune — `[default, min, max, step?]` for numeric sliders,
`{ type: 'select', options: [...], default: '...' } as const` for string enums (`shape`,
`shapeRotationRandom`, `glowAnimation`, `cursorTracking`). This is dev tooling, not something
`dot-grid-background` depends on or ships — remove the DialKit panel and hardcode the values
you land on before shipping to production. See [`src/App.tsx`](./src/App.tsx) in this repo for
the full config this demo uses, covering every prop.

## Props

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
| `fadeInDuration` | `number` | `1200` | React-only: mount fade-in (ms) |
| `className` | `string` | — | React-only: wrapper class |
| `style` | `CSSProperties` | — | React-only: wrapper inline style |

See [PACKAGING.md](./PACKAGING.md) for a full write-up of how the effect works internally.

## License

MIT
