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

interface Ripple {
  x: number
  y: number
  start: number
}

const RIPPLE_EVENT = 'dotgrid:ripple'

interface RippleBroadcast {
  group: string
  clientX: number
  clientY: number
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
  let ripples: Ripple[] = []
  let rafId: number | null = null

  let lastClient: { x: number; y: number } | null = null // raw viewport cursor

  function rippleSync() {
    return !!opts.rippleGroup
  }

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
            baseColor, baseOpacity, hoverColors, hoverRadius, hoverAnimate, hoverSpeed,
            bottomFade,
            rippleSpeed, rippleAmplitude, rippleWidth, rippleMaxRadius,
            rippleColor, rippleColorIntensity } = opts

    const now = performance.now()
    const time = now * noiseSpeed
    const radiusSq = influenceRadius * influenceRadius
    const hoverRadiusSq = hoverRadius * hoverRadius
    const maxRadiusSq = Math.max(radiusSq, hoverRadiusSq)
    const hoverPhase = hoverAnimate ? now * hoverSpeed : 0

    // Parse colours once per frame (cheap for a handful of values)
    const base = parseColor(baseColor)
    const hover0 = hoverColors ? parseColor(hoverColors[0]) : null
    const hover1 = hoverColors ? parseColor(hoverColors[1]) : null
    const rippleRGB = rippleColor ? parseColor(rippleColor) : null

    // Prune finished ripples and precompute per-frame wavefront state
    ripples = ripples.filter(r => (now - r.start) * rippleSpeed <= rippleMaxRadius)
    const rippleFronts = ripples.map(r => {
      const waveRadius = (now - r.start) * rippleSpeed
      return {
        x: r.x, y: r.y,
        waveRadius,
        decay: 1 - waveRadius / rippleMaxRadius,
      }
    })
    const twoSigmaSq = 2 * rippleWidth * rippleWidth
    const bandCutoff = rippleWidth * 3

    ctx.clearRect(0, 0, canvasW, canvasH)

    for (const dot of dots) {
      let targetX = dot.gx
      let targetY = dot.gy
      let influence = 0       // push + noise (influenceRadius)
      let colorInfluence = 0  // hover colour (hoverRadius)

      if (mouse) {
        const dx = dot.gx - mouse.x
        const dy = dot.gy - mouse.y
        const distSq = dx * dx + dy * dy

        if (distSq > 0 && distSq < maxRadiusSq) {
          const dist = Math.sqrt(distSq)

          if (distSq < radiusSq) {
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

          if (distSq < hoverRadiusSq) {
            colorInfluence = 1 - dist / hoverRadius
          }
        }
      }

      // Ripple contributions: radial push + track max colour envelope across active ripples
      let rippleColorAmt = 0
      if (rippleFronts.length) {
        for (const rip of rippleFronts) {
          const rdx = dot.gx - rip.x
          const rdy = dot.gy - rip.y
          const rd = Math.sqrt(rdx * rdx + rdy * rdy)
          if (rd <= 0) continue
          const front = rd - rip.waveRadius
          if (front > bandCutoff || front < -bandCutoff) continue
          const env = Math.exp(-(front * front) / twoSigmaSq)
          targetX += (rdx / rd) * env * rippleAmplitude * rip.decay
          targetY += (rdy / rd) * env * rippleAmplitude * rip.decay
          const colorAmt = env * rip.decay
          if (colorAmt > rippleColorAmt) rippleColorAmt = colorAmt
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
      // Glow and ripple each compute their own delta from `base` independently, then the
      // deltas are summed. Blending ripple from the glow's already-tinted output (instead of
      // from base) would make the ripple vanish wherever the glow phase already leans toward
      // rippleColor — this keeps the two effects from competing for the same channel.
      let glowDR = 0, glowDG = 0, glowDB = 0

      if (colorInfluence > 0 && hover0 && hover1) {
        // Dim alpha near cursor
        alpha *= 1 - colorInfluence * colorInfluence * 0.85

        // Angle for two-tone blend: cursor-relative when animating (pattern rotates with cursor),
        // canvas-center-relative when static (pattern frozen in world space)
        const angle = hoverAnimate
          ? Math.atan2(dot.gy - (mouse?.y ?? canvasH / 2), dot.gx - (mouse?.x ?? canvasW / 2))
          : Math.atan2(dot.gy - canvasH / 2, dot.gx - canvasW / 2)
        const t = (Math.sin(angle * 2 + hoverPhase) + 1) * 0.5
        const blendAmt = colorInfluence * colorInfluence

        const mixR = hover0[0] + t * (hover1[0] - hover0[0])
        const mixG = hover0[1] + t * (hover1[1] - hover0[1])
        const mixB = hover0[2] + t * (hover1[2] - hover0[2])

        glowDR = blendAmt * (mixR - base[0])
        glowDG = blendAmt * (mixG - base[1])
        glowDB = blendAmt * (mixB - base[2])
      }

      let rippleDR = 0, rippleDG = 0, rippleDB = 0

      if (rippleRGB && rippleColorAmt > 0) {
        const amt = Math.min(1, rippleColorAmt * rippleColorIntensity)
        rippleDR = amt * (rippleRGB[0] - base[0])
        rippleDG = amt * (rippleRGB[1] - base[1])
        rippleDB = amt * (rippleRGB[2] - base[2])
      }

      // Sum the two deltas rather than picking a winner: a "larger delta wins" combine still
      // lets a strong, sustained glow delta swamp a weaker ripple delta on the same channel
      // (e.g. mid-decay ripple envelope against a fully-saturated glow) — the exact muting this
      // fix targets. Summing guarantees the ripple always contributes visibly, scaled by its own
      // envelope/intensity, regardless of what the glow is doing on that channel.
      const r = Math.round(Math.max(0, Math.min(255, base[0] + glowDR + rippleDR)))
      const g = Math.round(Math.max(0, Math.min(255, base[1] + glowDG + rippleDG)))
      const b = Math.round(Math.max(0, Math.min(255, base[2] + glowDB + rippleDB)))

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

  // The single place `mouse` is decided from the raw viewport cursor.
  // 'hover' grids only react while the cursor is over themselves.
  // 'global' grids (default) track the page cursor everywhere — influenceRadius/
  // hoverRadius already bound how far the effect visibly reaches, so nearby grids
  // read as one continuous field instead of cutting out in the gaps between them.
  function recomputeMouse() {
    const parent = canvas.parentElement
    if (!lastClient || !parent) {
      mouse = null
      return
    }
    const rect = parent.getBoundingClientRect()
    const localX = lastClient.x - rect.left
    const localY = lastClient.y - rect.top

    if (opts.cursorTracking === 'global') {
      mouse = { x: localX, y: localY }
      return
    }

    const overSelf =
      lastClient.x >= rect.left && lastClient.x <= rect.right &&
      lastClient.y >= rect.top && lastClient.y <= rect.bottom
    mouse = overSelf ? { x: localX, y: localY } : null
  }

  function onMouseMove(e: MouseEvent) {
    lastClient = { x: e.clientX, y: e.clientY }
    recomputeMouse()
  }

  function onMouseLeave() {
    lastClient = null
    recomputeMouse()
  }

  function onPointerDown(e: PointerEvent) {
    if (!opts.rippleEnabled) return
    const parent = canvas.parentElement
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    if (
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top  || e.clientY > rect.bottom
    ) return

    if (rippleSync()) {
      // Broadcast in screen coords — every grid in the group (including this
      // one) spawns its own ripple via onRippleBroadcast, seeded from the
      // same world point, so the wave looks continuous across instances.
      window.dispatchEvent(new CustomEvent<RippleBroadcast>(RIPPLE_EVENT, {
        detail: { group: opts.rippleGroup, clientX: e.clientX, clientY: e.clientY },
      }))
      return
    }

    ripples.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, start: performance.now() })
  }

  function onRippleBroadcast(e: Event) {
    if (!opts.rippleEnabled || !rippleSync()) return
    const { group, clientX, clientY } = (e as CustomEvent<RippleBroadcast>).detail
    if (group !== opts.rippleGroup) return
    const parent = canvas.parentElement
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    ripples.push({ x: clientX - rect.left, y: clientY - rect.top, start: performance.now() })
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseleave', onMouseLeave)
  window.addEventListener('pointerdown', onPointerDown)
  window.addEventListener(RIPPLE_EVENT, onRippleBroadcast)

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
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener(RIPPLE_EVENT, onRippleBroadcast)
    },
  }
}
