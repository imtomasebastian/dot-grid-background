'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createDotGrid } from './core'
import type { DotGridOptions } from './types'

export interface DotGridBackgroundProps extends DotGridOptions {
  /** Duration (ms) of the fade-in on mount. Default: 1200 */
  fadeInDuration?: number
  /** Applied to the outer wrapper div. */
  className?: string
  /** Applied to the outer wrapper div. */
  style?: CSSProperties
}

/**
 * Drop-in background component. Place it inside a `position: relative`
 * parent and it will fill the space with an animated interactive dot grid.
 *
 * All layout/positioning is left to the consumer — the wrapper is
 * `position: absolute; inset: 0` by default so it sits behind content.
 *
 * Example:
 * ```tsx
 * <div style={{ position: 'relative', height: '100vh' }}>
 *   <DotGridBackground hoverColors={['#5656F0', '#40D9C6']} />
 *   <h1 style={{ position: 'relative' }}>Hello</h1>
 * </div>
 * ```
 */
export function DotGridBackground({
  fadeInDuration = 1200,
  className,
  style,
  // All remaining props are DotGridOptions — forwarded to the core engine
  ...opts
}: DotGridBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gridRef = useRef<ReturnType<typeof createDotGrid> | null>(null)
  const [visible, setVisible] = useState(false)

  // Mount / unmount
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    gridRef.current = createDotGrid(canvas, opts)
    // Fade in after first rAF so the grid is already drawn when it appears
    const frameId = requestAnimationFrame(() => setVisible(true))
    return () => {
      cancelAnimationFrame(frameId)
      gridRef.current?.destroy()
      gridRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — we handle prop changes via update() below

  // Forward option changes to the running engine (no remount needed)
  useEffect(() => {
    gridRef.current?.update(opts)
    // opts reference changes every render; the engine handles diffing internally
  })

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: `opacity ${fadeInDuration}ms ease-in`,
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{ position: 'absolute', inset: 0 }}
      />
    </div>
  )
}
