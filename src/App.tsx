import { useDialKit } from 'dialkit'
import { DotGridBackground } from './DotGridBackground'

export default function App() {
  const p = useDialKit('Dot Grid', {
    background: '#111111',
    dots: {
      gridSpacing:  [16, 6, 60] as [number, number, number],
      dotRadius:    [1, 0.5, 6] as [number, number, number],
      baseColor:    '#444444',
      baseOpacity:  [1, 0, 1] as [number, number, number],
      opacityRange: [0, 0, 1] as [number, number, number],
      bottomFade:   true,
    },
    cursor: {
      influenceRadius: [725, 50, 1200] as [number, number, number],
      maxPush:         [28, 0, 120] as [number, number, number],
      returnSpeed:     [0.035, 0.005, 0.2, 0.005] as [number, number, number, number],
    },
    noise: {
      amplitude: [6, 0, 40] as [number, number, number],
      scale:     [0.04, 0.001, 0.15, 0.001] as [number, number, number, number],
      speed:     [0.0008, 0, 0.005, 0.0001] as [number, number, number, number],
    },
    hover: {
      enabled:  true,
      color1:   '#5656F0',
      color2:   '#40D9C6',
      radius:   [725, 50, 1200] as [number, number, number],
      animate:  true,
      speed:    [0.0024, 0, 0.02, 0.0001] as [number, number, number, number],
    },
  })

  const hoverColors = p.hover.enabled
    ? ([p.hover.color1, p.hover.color2] as [string, string])
    : undefined

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: p.background }}>
      <DotGridBackground
        gridSpacing={p.dots.gridSpacing}
        dotRadius={p.dots.dotRadius}
        baseColor={p.dots.baseColor}
        baseOpacity={p.dots.baseOpacity}
        opacityRange={p.dots.opacityRange}
        bottomFade={p.dots.bottomFade}
        influenceRadius={p.cursor.influenceRadius}
        maxPush={p.cursor.maxPush}
        returnSpeed={p.cursor.returnSpeed}
        noiseAmplitude={p.noise.amplitude}
        noiseScale={p.noise.scale}
        noiseSpeed={p.noise.speed}
        hoverColors={hoverColors}
        hoverRadius={p.hover.radius}
        hoverAnimate={p.hover.animate}
        hoverSpeed={p.hover.speed}
      />

      <div style={styles.hero}>
        <h1 style={styles.heroTitle}>Dot Grid Background</h1>
        <p style={styles.heroSub}>Move your cursor around to interact with the dots.</p>
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
}
