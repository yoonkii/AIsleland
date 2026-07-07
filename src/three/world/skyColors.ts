// Day-night color math for Module A (world).
//
// All time-of-day color blends run through OKLab so dawn/dusk stay creamy
// instead of turning muddy grey (docs/GAME_DESIGN.md §3.3). Tracks are
// allocation-free: samplers write into caller-provided THREE.Color scratch.

import * as THREE from 'three'
import { PALETTE } from '../../design/tokens'

// ---------------------------------------------------------------------------
// OKLab conversion (sRGB hex -> OKLab, OKLab -> linear working-space Color)
// ---------------------------------------------------------------------------

function channelToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function hexToOklab(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  const r = channelToLinear(((n >> 16) & 255) / 255)
  const g = channelToLinear(((n >> 8) & 255) / 255)
  const b = channelToLinear((n & 255) / 255)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

/** Writes an OKLab triplet into `out` as linear-working-space RGB. */
function oklabToColor(L: number, a: number, b: number, out: THREE.Color): void {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  out.setRGB(
    clamp01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  )
}

// ---------------------------------------------------------------------------
// Keyframe tracks over the 0..1 day (wrap-around)
// ---------------------------------------------------------------------------

export type ColorTrack = (t: number, out: THREE.Color) => THREE.Color
export type ScalarTrack = (t: number) => number

interface Segment {
  i0: number
  i1: number
  t0: number
  t1: number
}

function findSegment(ts: readonly number[], t: number, seg: Segment): void {
  let i = 0
  while (i < ts.length && ts[i] <= t) i++
  if (i === 0) {
    seg.i0 = ts.length - 1
    seg.i1 = 0
    seg.t0 = ts[ts.length - 1] - 1
    seg.t1 = ts[0]
  } else if (i === ts.length) {
    seg.i0 = ts.length - 1
    seg.i1 = 0
    seg.t0 = ts[ts.length - 1]
    seg.t1 = ts[0] + 1
  } else {
    seg.i0 = i - 1
    seg.i1 = i
    seg.t0 = ts[i - 1]
    seg.t1 = ts[i]
  }
}

const segScratch: Segment = { i0: 0, i1: 0, t0: 0, t1: 0 }

/** Build a wrap-around color track. Stops must be sorted by time (0..1). */
export function colorTrack(stops: ReadonlyArray<readonly [number, string]>): ColorTrack {
  const ts = stops.map((s) => s[0])
  const labs = stops.map((s) => hexToOklab(s[1]))
  return (t, out) => {
    t = ((t % 1) + 1) % 1
    findSegment(ts, t, segScratch)
    const { i0, i1, t0, t1 } = segScratch
    const k = t1 === t0 ? 0 : (t - t0) / (t1 - t0)
    const a = labs[i0]
    const b = labs[i1]
    oklabToColor(
      a[0] + (b[0] - a[0]) * k,
      a[1] + (b[1] - a[1]) * k,
      a[2] + (b[2] - a[2]) * k,
      out,
    )
    return out
  }
}

/** Build a wrap-around scalar track (plain lerp). */
export function scalarTrack(stops: ReadonlyArray<readonly [number, number]>): ScalarTrack {
  const ts = stops.map((s) => s[0])
  const vs = stops.map((s) => s[1])
  return (t) => {
    t = ((t % 1) + 1) % 1
    findSegment(ts, t, segScratch)
    const { i0, i1, t0, t1 } = segScratch
    const k = t1 === t0 ? 0 : (t - t0) / (t1 - t0)
    return vs[i0] + (vs[i1] - vs[i0]) * k
  }
}

// ---------------------------------------------------------------------------
// Sun / moon / daylight helpers
// ---------------------------------------------------------------------------

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

/** Unit direction of the sun. t=0.25 dawn (east horizon), t=0.5 noon (up). */
export function sunDirection(t: number, out: THREE.Vector3): THREE.Vector3 {
  const a = (t - 0.25) * Math.PI * 2
  return out.set(Math.cos(a) * 0.92, Math.sin(a), -0.32).normalize()
}

/** The moon rides the same rail, opposite the sun. */
export function moonDirection(t: number, out: THREE.Vector3): THREE.Vector3 {
  const a = (t - 0.25) * Math.PI * 2 + Math.PI
  return out.set(Math.cos(a) * 0.92, Math.sin(a), -0.32).normalize()
}

/** 1 in full daylight, 0 at deep night, smooth twilight ramp. */
export function daylight(t: number): number {
  const sy = Math.sin((t - 0.25) * Math.PI * 2)
  return smoothstep(-0.08, 0.16, sy)
}

/** 1 at deep night, 0 in full daylight. */
export function nightness(t: number): number {
  return 1 - daylight(t)
}

// ---------------------------------------------------------------------------
// Shared sky gradient tracks (keyframes at 0 / .27 dawn / .38-.62 day / .73 dusk / .8 night)
// ---------------------------------------------------------------------------

export const skyTopTrack = colorTrack([
  [0.0, PALETTE.skyNightTop],
  [0.2, PALETTE.skyNightTop],
  [0.27, PALETTE.skyDuskTop],
  [0.38, PALETTE.skyDayTop],
  [0.62, PALETTE.skyDayTop],
  [0.73, PALETTE.skyDuskTop],
  [0.8, PALETTE.skyNightTop],
])

export const skyMidTrack = colorTrack([
  [0.0, PALETTE.skyNightMid],
  [0.2, PALETTE.skyNightMid],
  [0.27, PALETTE.skyDuskMid],
  [0.38, PALETTE.skyDayMid],
  [0.62, PALETTE.skyDayMid],
  [0.73, PALETTE.skyDuskMid],
  [0.8, PALETTE.skyNightMid],
])

export const skyHorizonTrack = colorTrack([
  [0.0, PALETTE.skyNightHorizon],
  [0.2, PALETTE.skyNightHorizon],
  [0.27, PALETTE.skyDuskHorizon],
  [0.38, PALETTE.skyDayHorizon],
  [0.62, PALETTE.skyDayHorizon],
  [0.73, PALETTE.skyDuskHorizon],
  [0.8, PALETTE.skyNightHorizon],
])

/** Warm glow around the sun disc on the dome (moon-blue at night). */
export const sunGlowTrack = colorTrack([
  [0.0, PALETTE.rimNight],
  [0.2, PALETTE.rimNight],
  [0.27, PALETTE.skyDuskHorizon],
  [0.38, PALETTE.sparkle],
  [0.62, PALETTE.sparkle],
  [0.73, PALETTE.skyDuskHorizon],
  [0.8, PALETTE.rimNight],
])
