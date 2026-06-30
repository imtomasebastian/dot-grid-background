/**
 * 2D Perlin noise — zero dependencies.
 *
 * Generates smooth, continuous pseudo-random values in approximately [-1, 1].
 * Nearby inputs return similar values (unlike Math.random()), which is what
 * makes dot drift look organic rather than jittery.
 *
 * Internals: 512-entry permutation table seeded deterministically, classic
 * fade / lerp / gradient implementation.
 */

const perm = new Uint8Array(512)

// Build permutation table (deterministic, no seed needed for this use-case)
{
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const j = (i * 2654435761 >>> 0) % (i + 1);
    [p[i], p[j]] = [p[j], p[i]]
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]
}

// 2D gradient vectors (unit vectors at 8 angles)
const GRADS: [number, number][] = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
]

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a)
}

function grad(hash: number, x: number, y: number): number {
  const g = GRADS[hash & 7]
  return g[0] * x + g[1] * y
}

/** Returns a smooth pseudo-random value in approximately [-1, 1]. */
export function noise2d(x: number, y: number): number {
  const xi = Math.floor(x) & 255
  const yi = Math.floor(y) & 255
  const xf = x - Math.floor(x)
  const yf = y - Math.floor(y)
  const u = fade(xf)
  const v = fade(yf)

  const aa = perm[perm[xi] + yi]
  const ab = perm[perm[xi] + yi + 1]
  const ba = perm[perm[xi + 1] + yi]
  const bb = perm[perm[xi + 1] + yi + 1]

  return lerp(
    lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
    lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
    v,
  )
}
