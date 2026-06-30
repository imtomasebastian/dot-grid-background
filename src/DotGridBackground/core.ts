/**
 * Framework-agnostic dot-grid core engine.
 *
 * Usage:
 *   const grid = createDotGrid(canvasElement, options)
 *   grid.update(newOptions)   // hot-swap any option
 *   grid.destroy()            // cleanup: cancel rAF, remove listeners
 *
 * Zero React / framework dependencies. Safe to call in any environment
 * that has a real HTMLCanvasElement (SSR guard is the caller's responsibility).
 */

import { noise2d } from './perlin'
import { resolveOptions, parseColor, type DotGridOptions } from './types'

interface Dot {
  /** Grid (home) position */
  gx: number
  gy: number
  /** Current animated position */
  x: number
  y: number
  /** Per-dot rest opacity multiplier (1 when opacityRange = 0) */
  restOpacity: number
}

interface MousePos {
  x: number
  y: number
}

export interface DotGrid {
  update(opts: DotGridOptions): void
  destroy(): void
}

export function createDotGrid(canvas: HTMLCanvasElement, initialOpts: DotGridOptions = {}): DotGrid {
  let opts = resolveOptions(initialOpts)
  let dots: Dot[] = []
  let canvasW = 0
  let canvasH = 0
  let mouse: MousePos | null = null
  let rafId: number | null = null

  // --- Grid builder ---

  function buildGrid(w: number, h: number) {
    const { gridSpacing, opacityRange } = opts
    const cols = Math.ceil(w / gridSpacing) + 1
    const rows = Math.ceil(h / gridSpacing) + 1
    const next: Dot[] = []
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const gx = col * gridSpacing
        const gy = row * gridSpacing
        next.push({
          gx, gy, x: gx, y: gy,
          restOpacity: 1 - Math.random() * opacityRange,
        })
      }
    }
    dots = next
  }

  // --- Draw frame ---

  function draw() {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { dotRadius, influenceRadius, maxPush, returnSpeed,
            noiseAmplitude, noiseScale, noiseSpeed,
            baseColor, baseOpacity, hoverColors, bottomFade } = opts

    const time = performance.now() * noiseSpeed
    const radiusSq = influenceRadius * influenceRadius

    // Parse colours once per frame (cheap for a handful of values)
    const base = parseColor(baseColor)
    const hover0 = hoverColors ? parseColor(hoverColors[0]) : null
    const hover1 = hoverColors ? parseColor(hoverColors[1]) : null

    ctx.clearRect(0, 0, canvasW, canvasH)

    for (const dot of dots) {
      let targetX = dot.gx
      let targetY = dot.gy
      let influence = 0

      if (mouse) {
        const dx = dot.gx - mouse.x
        const dy = dot.gy - mouse.y
        const distSq = dx * dx + dy * dy

        if (distSq < radiusSq && distSq > 0) {
          const dist = Math.sqrt(distSq)
          influence = 1 - dist / influenceRadius       // 0 → 1 as cursor nears dot
          const push = influence * influence * influence * maxPush
          const nx = dx / dist
          const ny = dy / dist
          targetX = dot.gx + nx * push
          targetY = dot.gy + ny * push

          // Organic noise layered on top of the repel
          const noiseX = noise2d(dot.gx * noiseScale, dot.gy * noiseScale + time)
          const noiseY = noise2d(dot.gx * noiseScale + 100, dot.gy * noiseScale + time)
          const noiseMag = influence * influence * noiseAmplitude
          targetX += noiseX * noiseMag
          targetY += noiseY * noiseMag
        }
      }

      // Ease toward target (lazy, springy return)
      dot.x += (targetX - dot.x) * returnSpeed
      dot.y += (targetY - dot.y) * returnSpeed

      // --- Alpha ---
      let alpha = baseOpacity * dot.restOpacity

      // Bottom fade: starts at 75% of canvas height
      if (bottomFade && dot.gy > canvasH * 0.75) {
        alpha *= 1 - (dot.gy - canvasH * 0.75) / (canvasH * 0.25)
      }

      // --- Colour ---
      let r = base[0], g = base[1], b = base[2]

      if (influence > 0 && hover0 && hover1) {
        // Dim alpha near cursor
        alpha *= 1 - influence * influence * 0.85

        // Oscillate between the two hover colours based on angle + time
        const angle = Math.atan2(dot.gy - (mouse?.y ?? 0), dot.gx - (mouse?.x ?? 0))
        const t = (Math.sin(angle * 2 + time * 3) + 1) * 0.5
        const blendAmt = influence * influence

        const mixR = hover0[0] + t * (hover1[0] - hover0[0])
        const mixG = hover0[1] + t * (hover1[1] - hover0[1])
        const mixB = hover0[2] + t * (hover1[2] - hover0[2])

        r = Math.round(base[0] + blendAmt * (mixR - base[0]))
        g = Math.round(base[1] + blendAmt * (mixG - base[1]))
        b = Math.round(base[2] + blendAmt * (mixB - base[2]))
      }

      if (alpha <= 0) continue

      ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`
      ctx.beginPath()
      ctx.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // --- Animation loop ---

  function loop() {
    draw()
    rafId = requestAnimationFrame(loop)
  }

  // --- Resize / DPR ---

  function handleResize() {
    const parent = canvas.parentElement
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(rect.width)
    const h = Math.round(rect.height)

    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')
    ctx?.scale(dpr, dpr)

    canvasW = w
    canvasH = h
    buildGrid(w, h)
  }

  const resizeObserver = new ResizeObserver(handleResize)
  resizeObserver.observe(canvas.parentElement ?? canvas)
  handleResize()

  // --- Mouse tracking ---

  function onMouseMove(e: MouseEvent) {
    const parent = canvas.parentElement
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    if (
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom
    ) {
      mouse = null
      return
    }
    mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onMouseLeave() {
    mouse = null
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseleave', onMouseLeave)

  // --- Start loop ---
  rafId = requestAnimationFrame(loop)

  // --- Public API ---

  return {
    update(newOpts: DotGridOptions) {
      const prev = opts
      opts = resolveOptions({ ...prev, ...newOpts })

      // Rebuild grid if spacing or opacityRange changed (dot count / positions change)
      if (
        newOpts.gridSpacing !== undefined ||
        newOpts.opacityRange !== undefined
      ) {
        buildGrid(canvasW, canvasH)
      }
    },

    destroy() {
      if (rafId !== null) cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
    },
  }
}
