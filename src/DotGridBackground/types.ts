/**
 * Options for the dot-grid effect.
 * All fields are optional — a sensible default is applied for every field.
 */
export interface DotGridOptions {
  /** Pixels between dots on the grid. Default: 16 */
  gridSpacing?: number

  /**
   * Which shape to draw at each grid point. `'line'` is drawn as a stroked
   * segment (see `lineWidth`); the others are solid fills. Default: 'dot'
   */
  shape?: 'dot' | 'square' | 'triangle' | 'line'

  /**
   * Shape size — the full extent in pixels (diameter for `dot`, side length
   * for `square`, circumscribed diameter for `triangle`, length for `line`).
   * Default: 2
   */
  shapeSize?: number

  /**
   * Random per-dot size reduction, 0–1. `0` = every shape at full `shapeSize`.
   * `0.5` = each dot's size randomly reduced by up to 50%. Frozen per dot when
   * the grid is built (like `opacityRange`); regenerated on resize.
   * Default: 0
   */
  shapeSizeRange?: number

  /**
   * Global static rotation, in degrees. Applied to every shape; a no-op for
   * `'dot'` (a rotated circle is identical). Default: 0
   */
  shapeRotation?: number

  /**
   * Per-dot rotation randomness mode, layered on top of `shapeRotation`.
   * `'none'` = every dot shares the same rotation.
   * `'jitter'` = each dot rotates by `shapeRotation ± random(0…shapeRotationAmount)`
   * (continuous scatter).
   * `'steps'` = each dot snaps to `shapeRotation + k × shapeRotationAmount` for a
   * random integer `k` (e.g. `shapeRotationAmount: 45` ⇒ only 0/45/90/…/315°).
   * Frozen per dot at grid build, like `shapeSizeRange`. No-op for `'dot'`.
   * Default: 'none'
   */
  shapeRotationRandom?: 'none' | 'jitter' | 'steps'

  /**
   * Degrees used by `shapeRotationRandom` — max deviation for `'jitter'`, step
   * size for `'steps'`. Ignored when `shapeRotationRandom` is `'none'`.
   * Default: 0
   */
  shapeRotationAmount?: number

  /** Stroke width (px) for the `'line'` shape. No-op for other shapes. Default: 1 */
  lineWidth?: number

  /** How far (px) the cursor's influence reaches. Default: 725 */
  influenceRadius?: number

  /** Max pixel displacement when a dot is pushed away. Default: 28 */
  maxPush?: number

  /**
   * Fraction of the distance to target that a dot moves each frame.
   * Lower = lazier / more lag. Range 0–1. Default: 0.035
   */
  returnSpeed?: number

  /** Strength of the organic Perlin-noise drift. Default: 6 */
  noiseAmplitude?: number

  /** Spatial frequency of the noise (higher = tighter patterns). Default: 0.04 */
  noiseScale?: number

  /** How fast the noise field evolves over time. Default: 0.0008 */
  noiseSpeed?: number

  /** Dot colour when the cursor is not nearby. Default: '#444' */
  baseColor?: string

  /** Global maximum alpha (0–1). Default: 1 */
  baseOpacity?: number

  /**
   * Random per-dot opacity variation at rest.
   * 0 = all dots at full baseOpacity.
   * 0.5 = each dot's rest opacity randomly reduced by up to 50%.
   * Applied once when the grid is built; regenerated on resize.
   * Default: 0
   */
  opacityRange?: number

  /**
   * Colour the cursor's glow region tints dots toward, soft-edged (no hard
   * cutoff). When omitted, the glow is disabled entirely (no colour shift).
   * Example: '#5656F0'
   */
  glowColor?: string

  /**
   * Radius (px) of the glow zone, independent of influenceRadius.
   * When omitted, defaults to influenceRadius so colour reach matches push reach.
   */
  glowRadius?: number

  /**
   * Peak tint strength at the centre of the glow (0–1).
   * 0 = no colour; 1 = full tint at the core. Default: 1
   */
  glowIntensity?: number

  /**
   * Fraction (0–1) of glowRadius that feathers into the background.
   * 0 = solid tint all the way to glowRadius, then a hard cutoff.
   * 1 = the tint feathers across the entire radius (softest dome).
   * Default: 0.33 (solid core, outer third feathers).
   */
  glowSoftness?: number

  /**
   * Animate the glow over time. `'none'` = static glow (default).
   * `'pulse'` = glowIntensity breathes up and down, radius/softness fixed.
   * `'breathe'` = watchOS-Breathe-style: radius and intensity contract
   * together while softness rises (fades out), then expand back with
   * softness falling (fades in) — one coupled motion, see `glowAnimateDepth`.
   * Default: 'none'
   */
  glowAnimation?: 'none' | 'pulse' | 'breathe'

  /**
   * How deep the glow animation swings (0–1). 0 = static regardless of
   * glowAnimation. Default: 0.3
   */
  glowAnimateDepth?: number

  /**
   * Speed of the glow animation (units: radians per millisecond).
   * Only visible when glowAnimateDepth > 0. Default: 0.0014 (~one cycle / 4.5s)
   */
  glowAnimateSpeed?: number

  /**
   * Fade dots out toward the bottom edge of the canvas.
   * Fading starts at 75% of canvas height. Default: true
   */
  bottomFade?: boolean

  // --- Click ripple ---

  /**
   * Enable click-to-ripple: a click spawns an expanding shockwave that
   * pushes dots outward as the ring passes through them. Default: true
   */
  rippleEnabled?: boolean

  /**
   * How fast the wavefront expands (px per millisecond). Default: 0.5
   */
  rippleSpeed?: number

  /**
   * Peak outward displacement at the wavefront (px). Default: 30
   */
  rippleAmplitude?: number

  /**
   * Gaussian σ — thickness of the wave band (px).
   * Higher = softer, more spread-out ring. Default: 70
   */
  rippleWidth?: number

  /**
   * How far (px) the ripple travels before fully fading out.
   * Also determines the ripple's lifetime. Default: 800
   */
  rippleMaxRadius?: number

  /**
   * Colour the ripple wave tints dots toward as it passes.
   * When omitted the ripple is displacement-only (no colour shift).
   * Example: '#5656F0'
   */
  rippleColor?: string

  /**
   * Peak tint strength at the wavefront (0–1).
   * 0 = no colour; 1 = full tint at the centre of the band. Default: 1
   */
  rippleColorIntensity?: number

  /**
   * Opt-in ripple relay channel. Grids sharing a non-empty group id ripple
   * together as one continuous ring — a click on any one sweeps across all
   * of them (own local coords, converted from the shared screen point).
   * Omit for a solo grid (default — no broadcast, no listen). Example: 'hero'
   */
  rippleGroup?: string

  // --- Clustered coverage ---

  /**
   * Enable clustered coverage: instead of a uniform field, dots are masked
   * into organic blobs with gaps between them (Perlin-noise threshold mask,
   * computed once at grid build). Default: false
   */
  clusterEnabled?: boolean

  /**
   * Approximate blob size (px-ish scale) — bigger = larger clusters.
   * Default: 400
   */
  clusterSize?: number

  /**
   * Roughly the fraction (0–1) of the area covered by clusters. Approximate,
   * not exact — Perlin values aren't uniformly distributed. Default: 0.4
   */
  clusterCoverage?: number

  /**
   * Edge softness of each blob (0–1). 0 = sharp cutoff, 1 = soft feather.
   * Default: 0.3
   */
  clusterEdge?: number

  /**
   * @deprecated Use `seed` instead — it now seeds the cluster layout together
   * with all other per-dot randomness. `clusterSeed` is still accepted (mapped
   * to `seed` when `seed` is not set) and will be removed in the next major.
   */
  clusterSeed?: number

  // --- Randomness & positioning ---

  /**
   * Integer seed for all per-dot randomness: cluster layout, per-dot opacity
   * (`opacityRange`), size (`shapeSizeRange`), and rotation
   * (`shapeRotationRandom`). The same seed always reproduces the same field —
   * two grids sharing a `seed` (and `gridSpacing`) render identical fields.
   * Combine with `pageAligned` to make overlapping grids line up in space.
   * Default: 0
   */
  seed?: number

  /**
   * Anchor the dot lattice to page/document coordinates instead of this
   * element's own top-left. When `true`, two grids sharing `seed` +
   * `gridSpacing` read as one continuous field — overlapping instances line up
   * dot-for-dot, so a smaller grid can sit "inside" a larger one as a recoloured
   * window onto the same field. Stays aligned across resizes and scroll.
   * Default: false (element-local origin — each grid is self-contained and
   * renders identically wherever it's placed).
   */
  pageAligned?: boolean

  /**
   * How the grid reacts to the cursor (push + hover/glow — both are driven
   * by the same cursor position, so they travel together).
   * `'global'` (default) = follow the page cursor anywhere, bounded by
   * influenceRadius/glowRadius — several grids read as one continuous
   * field, and far-apart grids stay calm on their own since the cursor is
   * out of reach.
   * `'hover'` = react only while the cursor is over this grid — right for
   * discrete cards/tiles that should light up only when pointed at.
   */
  cursorTracking?: 'hover' | 'global'

  /**
   * Render the grid as a fully static pattern: no cursor push/glow, no click
   * ripples, no reaction of any kind. Any existing displacement eases back to
   * rest (via `returnSpeed`) and then the draw loop parks. Useful for using
   * the grid as a plain decorative pattern rather than an interactive effect.
   * Default: false
   */
  freeze?: boolean
}

/**
 * Resolved options with all defaults filled in. `clusterSeed` is dropped — the
 * deprecated alias is collapsed into `seed` by `resolveOptions()`, so the engine
 * only ever reads `seed`.
 */
export interface ResolvedDotGridOptions
  extends Required<Omit<DotGridOptions, 'clusterSeed'>> {}

export const DEFAULTS: ResolvedDotGridOptions = {
  gridSpacing: 16,
  shape: 'dot',
  shapeSize: 2,
  shapeSizeRange: 0,
  shapeRotation: 0,
  shapeRotationRandom: 'none',
  shapeRotationAmount: 0,
  lineWidth: 1,
  influenceRadius: 725,
  maxPush: 28,
  returnSpeed: 0.035,
  noiseAmplitude: 6,
  noiseScale: 0.04,
  noiseSpeed: 0.0008,
  baseColor: '#444',
  baseOpacity: 1,
  opacityRange: 0,
  glowColor: undefined as unknown as string, // optional — see DotGridOptions
  glowRadius: 725,
  glowIntensity: 1,
  glowSoftness: 0.33,
  glowAnimation: 'none',
  glowAnimateDepth: 0.3,
  glowAnimateSpeed: 0.0014,
  bottomFade: true,
  rippleEnabled: true,
  rippleSpeed: 0.5,
  rippleAmplitude: 30,
  rippleWidth: 70,
  rippleMaxRadius: 800,
  rippleColor: undefined as unknown as string, // optional — see DotGridOptions
  rippleColorIntensity: 1,
  rippleGroup: undefined as unknown as string, // optional — see DotGridOptions
  clusterEnabled: false,
  clusterSize: 400,
  clusterCoverage: 0.4,
  clusterEdge: 0.3,
  seed: 0,
  pageAligned: false,
  cursorTracking: 'global',
  freeze: false,
}

export function resolveOptions(opts: DotGridOptions): ResolvedDotGridOptions {
  const { clusterSeed, ...rest } = opts
  const merged = { ...DEFAULTS, ...rest }
  // Deprecated `clusterSeed` → `seed` alias — honoured only when `seed` was not
  // set explicitly (an explicit `seed` always wins).
  if (opts.seed === undefined && clusterSeed !== undefined) merged.seed = clusterSeed
  // glowRadius defaults to influenceRadius when not explicitly set
  if (opts.glowRadius === undefined) merged.glowRadius = merged.influenceRadius
  return merged
}

/** Parse a CSS hex/rgb colour to [r, g, b] integers. */
export function parseColor(color: string): [number, number, number] {
  // Support #RGB, #RRGGBB
  const hex = color.trim().replace('#', '')
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16)
    const g = parseInt(hex[1] + hex[1], 16)
    const b = parseInt(hex[2] + hex[2], 16)
    return [r, g, b]
  }
  if (hex.length === 6) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ]
  }
  // Fallback for rgb() strings — let the browser parse via a temporary element
  // (not needed for our defaults, but safe to have)
  return [68, 68, 68]
}
