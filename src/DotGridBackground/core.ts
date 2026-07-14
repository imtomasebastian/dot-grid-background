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
  /** Grid (home) position — local canvas coords, where the dot is drawn */
  gx: number
  gy: number
  /**
   * World (page-space) position. Equals gx/gy unless pageAligned is on. Used for
   * anything that must match across aligned grids — currently the organic noise
   * sample, so the cursor wobble stays locked between overlapping instances.
   */
  wx: number
  wy: number
  /** Current animated position */
  x: number
  y: number
  /** Per-dot rest opacity multiplier (1 when opacityRange = 0) */
  restOpacity: number
  /** Precomputed radius for the 'dot' shape (shapeSize/2, scaled by shapeSizeRange) */
  radius: number
  /**
   * Precomputed, rotated vertex/endpoint offsets relative to the dot's center,
   * for 'square' | 'triangle' | 'line'. Empty for 'dot'. Frozen at grid build
   * (shape/size/rotation are all static), so the draw loop only adds — no
   * per-frame trig or canvas transforms.
   */
  verts: Array<[number, number]>
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

// Deterministic per-dot pseudo-random in [0, 1), a pure function of position +
// seed (+ a per-channel salt so opacity/size/rotation are decorrelated). Replaces
// Math.random() so a rebuild — or a second grid sharing seed + gridSpacing —
// reproduces the exact same field. Integer scramble (xxHash-style), no trig;
// coords are rounded so sub-pixel differences between aligned grids collapse to
// the same value.
function hash(x: number, y: number, seed: number, salt: number): number {
  let h = Math.imul((Math.round(x) | 0) ^ 0x9e3779b9, 374761393)
  h = Math.imul(h ^ (Math.round(y) | 0), 668265263)
  h = Math.imul(h ^ (seed | 0), 1274126177)
  h = Math.imul(h ^ (salt | 0), 2246822519)
  h ^= h >>> 15
  h = Math.imul(h, 2246822519)
  h ^= h >>> 13
  return (h >>> 0) / 4294967296
}

const SALT_OPACITY = 1
const SALT_SIZE = 2
const SALT_ROTATION = 3

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

  function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)
  }

  // Perlin-threshold mask for clustered coverage: dots inside a blob get ~1,
  // dots outside get ~0, with a feathered band around the threshold. Computed
  // once per dot at build time (static clusters). If animated drift is added
  // later, this is the single place a time term would offset the sample.
  function clusterMask(gx: number, gy: number): number {
    const { clusterSize, clusterCoverage, clusterEdge, seed } = opts
    const freq = 1 / clusterSize
    const seedOffset = seed * 1000
    const v = noise2d(gx * freq + seedOffset, gy * freq + seedOffset) // ~[-1, 1]
    const n = (v + 1) / 2 // → [0, 1]
    const threshold = 1 - clusterCoverage
    if (clusterEdge <= 0) return n >= threshold ? 1 : 0
    const band = clusterEdge * 0.5
    return smoothstep(threshold - band, threshold + band, n)
  }

  // Rotated offsets for a shape, centered on the origin. Called once per dot
  // at build time — 'dot' needs no vertices (drawn via arc + radius).
  function buildShapeVerts(
    shape: DotGridOptions['shape'],
    halfExtent: number,
    angleRad: number,
  ): Array<[number, number]> {
    const rotate = (x: number, y: number): [number, number] => {
      const cos = Math.cos(angleRad)
      const sin = Math.sin(angleRad)
      return [x * cos - y * sin, x * sin + y * cos]
    }

    switch (shape) {
      case 'square':
        return [
          rotate(-halfExtent, -halfExtent),
          rotate(halfExtent, -halfExtent),
          rotate(halfExtent, halfExtent),
          rotate(-halfExtent, halfExtent),
        ]
      case 'triangle': {
        // Upward equilateral triangle, circumradius = halfExtent, before rotation.
        const cornerAngles = [-90, 30, 150]
        return cornerAngles.map(deg => {
          const a = (deg * Math.PI) / 180
          return rotate(Math.cos(a) * halfExtent, Math.sin(a) * halfExtent)
        })
      }
      case 'line':
        // Canonically horizontal at angleRad = 0.
        return [rotate(-halfExtent, 0), rotate(halfExtent, 0)]
      default:
        return []
    }
  }

  // Per-dot static rotation (degrees), from shapeRotation + shapeRotationRandom.
  // Randomness is a deterministic hash of the dot's world position + seed.
  function pickRotationDeg(wx: number, wy: number): number {
    const { shapeRotation, shapeRotationRandom, shapeRotationAmount, seed } = opts
    if (shapeRotationRandom === 'jitter') {
      return shapeRotation + (hash(wx, wy, seed, SALT_ROTATION) * 2 - 1) * shapeRotationAmount
    }
    if (shapeRotationRandom === 'steps') {
      if (shapeRotationAmount <= 0) return shapeRotation
      const count = Math.max(1, Math.round(360 / shapeRotationAmount))
      const k = Math.floor(hash(wx, wy, seed, SALT_ROTATION) * count)
      return shapeRotation + k * shapeRotationAmount
    }
    return shapeRotation
  }

  function buildGrid(w: number, h: number) {
    const { gridSpacing, opacityRange, clusterEnabled, shape, shapeSize,
            shapeSizeRange, seed, pageAligned } = opts

    // Two coordinate roles diverge under pageAligned:
    //  - local (gx/gy): where the dot is drawn on this canvas. Phase-shifted by
    //    the fractional page phase so the visible lattice registers with the
    //    global one.
    //  - world (wx/wy): the dot's page-space position, used only to sample
    //    cluster/opacity/size/rotation. Identical for the same point in every
    //    aligned grid, so they render the same field.
    // Both offsets are 0 when pageAligned is off → byte-for-byte the local grid.
    let phaseX = 0, phaseY = 0, worldOffX = 0, worldOffY = 0
    if (pageAligned) {
      const rect = (canvas.parentElement ?? canvas).getBoundingClientRect()
      const pageX = rect.left + window.scrollX
      const pageY = rect.top + window.scrollY
      phaseX = ((pageX % gridSpacing) + gridSpacing) % gridSpacing
      phaseY = ((pageY % gridSpacing) + gridSpacing) % gridSpacing
      worldOffX = pageX - phaseX // a whole number of cells
      worldOffY = pageY - phaseY
    }

    // The phase shift pulls the lattice left/up by up to one cell, so cover one
    // extra column/row when aligned to avoid a gap at the right/bottom edge.
    const extra = pageAligned ? 2 : 1
    const cols = Math.ceil(w / gridSpacing) + extra
    const rows = Math.ceil(h / gridSpacing) + extra
    const next: Dot[] = []
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const gx = col * gridSpacing - phaseX
        const gy = row * gridSpacing - phaseY
        const wx = col * gridSpacing + worldOffX
        const wy = row * gridSpacing + worldOffY

        let restOpacity = 1 - hash(wx, wy, seed, SALT_OPACITY) * opacityRange
        if (clusterEnabled) restOpacity *= clusterMask(wx, wy)

        const sizeMult = Math.max(0, 1 - hash(wx, wy, seed, SALT_SIZE) * shapeSizeRange)
        const halfExtent = (shapeSize / 2) * sizeMult
        const angleRad = (pickRotationDeg(wx, wy) * Math.PI) / 180
        const radius = halfExtent
        const verts = buildShapeVerts(shape, halfExtent, angleRad)

        next.push({ gx, gy, wx, wy, x: gx, y: gy, restOpacity, radius, verts })
      }
    }
    dots = next
  }

  // --- Draw frame ---

  function draw() {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { shape, lineWidth, influenceRadius, maxPush, returnSpeed,
            noiseAmplitude, noiseScale, noiseSpeed,
            baseColor, baseOpacity, glowColor, glowRadius, glowIntensity,
            glowSoftness, glowAnimation, glowAnimateDepth, glowAnimateSpeed,
            bottomFade,
            rippleSpeed, rippleAmplitude, rippleWidth, rippleMaxRadius,
            rippleColor, rippleColorIntensity } = opts

    const now = performance.now()
    const time = now * noiseSpeed
    const radiusSq = influenceRadius * influenceRadius

    // Glow animation: one shared phase drives 'pulse' (intensity only) or
    // 'breathe' (radius + intensity contract together while softness rises,
    // watchOS-Breathe-style). `contract` is 0 at full inhale, up to
    // glowAnimateDepth at full exhale; glowAnimateDepth = 0 freezes both modes.
    const contract = glowAnimation === 'none'
      ? 0
      : glowAnimateDepth * (0.5 - 0.5 * Math.cos(now * glowAnimateSpeed))
    const effGlowIntensity = glowIntensity * (1 - contract)
    const effGlowRadius = glowAnimation === 'breathe' ? glowRadius * (1 - contract) : glowRadius
    const effGlowSoftness = glowAnimation === 'breathe'
      ? glowSoftness + (1 - glowSoftness) * contract
      : glowSoftness

    const glowRadiusSq = effGlowRadius * effGlowRadius
    const maxRadiusSq = Math.max(radiusSq, glowRadius * glowRadius)

    // Parse colours once per frame (cheap for a handful of values)
    const base = parseColor(baseColor)
    const glowRGB = glowColor ? parseColor(glowColor) : null
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
    if (shape === 'line') ctx.lineWidth = lineWidth

    for (const dot of dots) {
      let targetX = dot.gx
      let targetY = dot.gy
      let influence = 0       // push + noise (influenceRadius)
      let colorInfluence = 0  // glow colour (glowRadius)

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

            // Organic noise layered on top of the repel. Sampled from world
            // coords so the wobble matches across pageAligned grids (wx/wy == gx/gy
            // when alignment is off, so a solo grid is unchanged).
            const noiseX = noise2d(dot.wx * noiseScale, dot.wy * noiseScale + time)
            const noiseY = noise2d(dot.wx * noiseScale + 100, dot.wy * noiseScale + time)
            const noiseMag = influence * influence * noiseAmplitude
            targetX += noiseX * noiseMag
            targetY += noiseY * noiseMag
          }

          if (distSq < glowRadiusSq) {
            // Smoothstep falloff with a solid core: full tint through the inner
            // (1 - effGlowSoftness) fraction of the radius, feathering only in the outer band.
            const norm = dist / effGlowRadius
            const innerEdge = 1 - effGlowSoftness
            if (norm <= innerEdge) {
              colorInfluence = 1
            } else {
              const f = (norm - innerEdge) / effGlowSoftness
              colorInfluence = 1 - f * f * (3 - 2 * f)
            }
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

      if (colorInfluence > 0 && glowRGB) {
        const amt = colorInfluence * effGlowIntensity
        glowDR = amt * (glowRGB[0] - base[0])
        glowDG = amt * (glowRGB[1] - base[1])
        glowDB = amt * (glowRGB[2] - base[2])
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

      // Colour math above is shared by every shape; only the final paint differs.
      if (shape === 'line') {
        const [[x1, y1], [x2, y2]] = dot.verts
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`
        ctx.beginPath()
        ctx.moveTo(dot.x + x1, dot.y + y1)
        ctx.lineTo(dot.x + x2, dot.y + y2)
        ctx.stroke()
      } else {
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`
        ctx.beginPath()
        if (shape === 'dot') {
          ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2)
        } else {
          const [[x0, y0], ...rest] = dot.verts
          ctx.moveTo(dot.x + x0, dot.y + y0)
          for (const [vx, vy] of rest) ctx.lineTo(dot.x + vx, dot.y + vy)
          ctx.closePath()
        }
        ctx.fill()
      }
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
  // glowRadius already bound how far the effect visibly reaches, so nearby grids
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
      // Normalise the deprecated clusterSeed alias on the *raw* incoming opts
      // before merging: prev already carries a resolved `seed`, which would
      // otherwise mask a clusterSeed passed here.
      const incoming: DotGridOptions = { ...newOpts }
      if (incoming.seed === undefined && incoming.clusterSeed !== undefined) {
        incoming.seed = incoming.clusterSeed
      }
      delete incoming.clusterSeed
      opts = resolveOptions({ ...prev, ...incoming })

      // Rebuild grid if spacing, opacityRange, any cluster prop, the seed, page
      // alignment, or any shape/size/rotation prop changed (all affect the
      // build-time geometry of each dot). lineWidth is draw-time only.
      if (
        newOpts.gridSpacing !== undefined ||
        newOpts.opacityRange !== undefined ||
        newOpts.clusterEnabled !== undefined ||
        newOpts.clusterSize !== undefined ||
        newOpts.clusterCoverage !== undefined ||
        newOpts.clusterEdge !== undefined ||
        newOpts.seed !== undefined ||
        newOpts.clusterSeed !== undefined ||
        newOpts.pageAligned !== undefined ||
        newOpts.shape !== undefined ||
        newOpts.shapeSize !== undefined ||
        newOpts.shapeSizeRange !== undefined ||
        newOpts.shapeRotation !== undefined ||
        newOpts.shapeRotationRandom !== undefined ||
        newOpts.shapeRotationAmount !== undefined
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
