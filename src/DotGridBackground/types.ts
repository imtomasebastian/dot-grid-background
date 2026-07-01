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
   * Radius (px) of the hover-colour zone, independent of influenceRadius.
   * When omitted, defaults to influenceRadius so colour reach matches push reach.
   */
  hoverRadius?: number

  /**
   * Whether the two-tone colour pattern animates over time.
   * false = pattern is frozen (varies by angle only, no shimmer). Default: true
   */
  hoverAnimate?: boolean

  /**
   * Speed of the colour-pattern rotation (units: radians per millisecond × 1000).
   * Only used when hoverAnimate is true. Default: 0.0024
   */
  hoverSpeed?: number

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
  hoverRadius: 725,
  hoverAnimate: true,
  hoverSpeed: 0.0024,
  bottomFade: true,
  rippleEnabled: true,
  rippleSpeed: 0.5,
  rippleAmplitude: 30,
  rippleWidth: 70,
  rippleMaxRadius: 800,
  rippleColor: undefined as unknown as string, // optional — see DotGridOptions
  rippleColorIntensity: 1,
}

export function resolveOptions(opts: DotGridOptions): ResolvedDotGridOptions {
  const merged = { ...DEFAULTS, ...opts }
  // hoverRadius defaults to influenceRadius when not explicitly set
  if (opts.hoverRadius === undefined) merged.hoverRadius = merged.influenceRadius
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
