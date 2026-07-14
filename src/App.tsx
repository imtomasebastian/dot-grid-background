import { useDialKit } from 'dialkit'
import { DotGridBackground } from './DotGridBackground'

export default function App() {
  const p = useDialKit('Dot Grid', {
    background: '#111111',
    dots: {
      gridSpacing:  [16, 6, 48] as [number, number, number],
      shapeSize:    [2, 1, 32] as [number, number, number],
      baseColor:    '#444444',
      baseOpacity:  [1, 0, 1] as [number, number, number],
      opacityRange: [0, 0, 1] as [number, number, number],
      seed:         [0, 0, 20, 1] as [number, number, number, number],
      pageAligned:  true,
      bottomFade:   false,
    },
    shape: {
      type:           { type: 'select', options: ['dot', 'square', 'triangle', 'line'], default: 'dot' } as const,
      rotation:       [0, 0, 360, 1] as [number, number, number, number],
      rotationMode:   { type: 'select', options: ['none', 'jitter', 'steps'], default: 'none' } as const,
      rotationAmount: [0, 0, 180, 1] as [number, number, number, number],
      sizeRange:      [0, 0, 1, 0.01] as [number, number, number, number],
      lineWidth:      [1, 0.5, 6, 0.5] as [number, number, number, number],
    },
    cursor: {
      influenceRadius: [730, 50, 1200] as [number, number, number],
      maxPush:         [30, 0, 120] as [number, number, number],
      returnSpeed:     [0.035, 0.005, 0.2, 0.005] as [number, number, number, number],
    },
    noise: {
      amplitude: [10, 0, 40] as [number, number, number],
      scale:     [0.03, 0.001, 0.15, 0.001] as [number, number, number, number],
      speed:     [0.001, 0, 0.005, 0.0001] as [number, number, number, number],
    },
    glow: {
      enabled:      true,
      color:        '#5656F0',
      radius:       [180, 50, 1200] as [number, number, number],
      intensity:    [0.9, 0, 1] as [number, number, number],
      softness:     [0.75, 0, 1, 0.01] as [number, number, number, number],
      animation:    { type: 'select', options: ['none', 'pulse', 'breathe'], default: 'none' } as const,
      animateDepth: [0.3, 0, 1, 0.01] as [number, number, number, number],
      animateSpeed: [0.0014, 0, 0.005, 0.0001] as [number, number, number, number],
    },
    ripple: {
      enabled:        true,
      speed:          [0.5, 0.05, 2, 0.05] as [number, number, number, number],
      amplitude:      [40, 0, 120] as [number, number, number],
      width:          [80, 10, 300] as [number, number, number],
      maxRadius:      [1100, 100, 2000] as [number, number, number],
      colorEnabled:   true,
      color:          '#5656F0',
      colorIntensity: [1, 0, 1] as [number, number, number],
    },
    clusters: {
      enabled:  false,
      size:     [400, 50, 1200] as [number, number, number],
      coverage: [0.4, 0, 1, 0.01] as [number, number, number, number],
      edge:     [0.3, 0, 1, 0.01] as [number, number, number, number],
    },
    sync: {
      ripple: true,
      cursorGlobal: true,
    },
  })

  const glowColor = p.glow.enabled ? p.glow.color : undefined

  const rippleColor = p.ripple.colorEnabled ? p.ripple.color : undefined

  // Everything that defines the shared field (all but baseColor). Spreading the
  // same object into two grids is the recommended way to make them line up:
  // identical seed/gridSpacing/etc. + pageAligned → one continuous field.
  const field = {
    gridSpacing: p.dots.gridSpacing,
    shapeSize: p.dots.shapeSize,
    baseOpacity: p.dots.baseOpacity,
    opacityRange: p.dots.opacityRange,
    seed: p.dots.seed,
    pageAligned: p.dots.pageAligned,
    bottomFade: p.dots.bottomFade,
    shape: p.shape.type as 'dot' | 'square' | 'triangle' | 'line',
    shapeRotation: p.shape.rotation,
    shapeRotationRandom: p.shape.rotationMode as 'none' | 'jitter' | 'steps',
    shapeRotationAmount: p.shape.rotationAmount,
    shapeSizeRange: p.shape.sizeRange,
    lineWidth: p.shape.lineWidth,
    influenceRadius: p.cursor.influenceRadius,
    maxPush: p.cursor.maxPush,
    returnSpeed: p.cursor.returnSpeed,
    noiseAmplitude: p.noise.amplitude,
    noiseScale: p.noise.scale,
    noiseSpeed: p.noise.speed,
    glowColor,
    glowRadius: p.glow.radius,
    glowIntensity: p.glow.intensity,
    glowSoftness: p.glow.softness,
    glowAnimation: p.glow.animation as 'none' | 'pulse' | 'breathe',
    glowAnimateDepth: p.glow.animateDepth,
    glowAnimateSpeed: p.glow.animateSpeed,
    rippleEnabled: p.ripple.enabled,
    rippleSpeed: p.ripple.speed,
    rippleAmplitude: p.ripple.amplitude,
    rippleWidth: p.ripple.width,
    rippleMaxRadius: p.ripple.maxRadius,
    rippleColor,
    rippleColorIntensity: p.ripple.colorIntensity,
    rippleGroup: 'test',
    clusterEnabled: p.clusters.enabled,
    clusterSize: p.clusters.size,
    clusterCoverage: p.clusters.coverage,
    clusterEdge: p.clusters.edge,
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: p.background }}>
      <DotGridBackground {...field} baseColor={p.dots.baseColor} />

      <div style={styles.hero}>
        <h1 style={styles.heroTitle}>Dot Grid Background</h1>
        <p style={styles.heroSub}>Move your cursor around to interact with the dots.</p>
      </div>

      {/* pageAligned demo: a recoloured window onto the same field. With the same
          `field` config + pageAligned, its blue dots continue the grey grid behind
          it dot-for-dot. Toggle `dots.pageAligned` off to see them drift apart. */}
      <div style={styles.overlayBox}>
        <DotGridBackground {...field} baseColor="#5656F0" />
      </div>
    </div>
  )
}

const styles = {
  hero: {
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    textAlign: 'center' as const,
    padding: '0 24px',
    pointerEvents: 'none' as const,
  },
  heroTitle: {
    fontSize: 'clamp(2rem, 6vw, 4.5rem)',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    marginBottom: 16,
    color: '#fff',
  },
  heroSub: {
    fontSize: 'clamp(0.9rem, 2vw, 1.2rem)',
    color: 'rgba(255,255,255,0.5)',
  },
  overlayBox: {
    // Offset below dead-center so it doesn't sit under the hero title/subtitle,
    // which occupy the exact vertical center via the flex-centered hero div.
    position: 'absolute' as const,
    top: '72%',
    left: '50%',
    width: 380,
    height: 240,
    transform: 'translate(-50%, -50%)',
    border: '1px solid rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
}
