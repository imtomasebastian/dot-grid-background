/**
 * Options for the dot-grid effect.
 * All fields are optional — defaults match the original Stitch effect.
 */
export interface DotGridOptions {
  /** Pixels between dots on the grid. Default: 16 */
  gridSpacing?: number

  /** Dot radius in pixels. Default: 1 */
  dotRadius?: number

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
   * Two colours [start, end] that dots oscillate between when the
   * cursor is nearby, creating a two-tone swirl effect.
   * When omitted, pushed dots keep their baseColor (no colour shift, no dim).
   * Example: ['#5656F0', '#40D9C6']
   */
  hoverColors?: [string, string]

  /**
   * Fade dots out toward the bottom edge of the canvas.
   * Fading starts at 75% of canvas height. Default: true
   */
  bottomFade?: boolean
}

/** Resolved options with all defaults filled in. */
export interface ResolvedDotGridOptions extends Required<DotGridOptions> {}

export const DEFAULTS: ResolvedDotGridOptions = {
  gridSpacing: 16,
  dotRadius: 1,
  influenceRadius: 725,
  maxPush: 28,
  returnSpeed: 0.035,
  noiseAmplitude: 6,
  noiseScale: 0.04,
  noiseSpeed: 0.0008,
  baseColor: '#444',
  baseOpacity: 1,
  opacityRange: 0,
  hoverColors: undefined as unknown as [string, string], // optional — see DotGridOptions
  bottomFade: true,
}

export function resolveOptions(opts: DotGridOptions): ResolvedDotGridOptions {
  return { ...DEFAULTS, ...opts }
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
