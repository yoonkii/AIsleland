// Module B (props) — geometry build helpers.
//
// Every prop type is assembled ONCE at module level from cheap primitives:
// each `PartSpec` is cloned, optionally blob-displaced (for the icosa-d0
// meringue canopies), transformed, painted with vertex colors, then all parts
// are merged into a single BufferGeometry so one makeMeringue({vertexColors})
// material renders the whole prop in ONE draw call.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Deterministic 0..1 hash of a string (FNV-1a + finalizer). */
export function hash01(str: string, salt = 0): number {
  let h = 2166136261 ^ Math.imul(salt + 1, 0x9e3779b1)
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 13
  h = Math.imul(h, 0x5bd1e995)
  h ^= h >>> 15
  return (h >>> 0) / 4294967295
}

/** back.out easing — overshoot grows with `s` (s=2.4 peaks near 1.15). */
export function easeOutBack(t: number, s = 1.70158): number {
  const c3 = s + 1
  const u = t - 1
  return 1 + c3 * u * u * u + s * u * u
}

export interface PartSpec {
  geo: THREE.BufferGeometry
  /** Base color (bottom of the gradient when colorTop is set). */
  color: THREE.ColorRepresentation
  /** Optional lighter top color — lerped along the part's world-y extent. */
  colorTop?: THREE.ColorRepresentation
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number | [number, number, number]
  /** Radial vertex displacement (units) for blobby silhouettes; re-facets normals. */
  blob?: number
  seed?: number
}

// Deterministic value noise keyed on the (pre-transform) vertex position, so
// vertices duplicated by toNonIndexed displace identically and stay welded.
function vnoise(x: number, y: number, z: number, seed: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 91.7) * 43758.5453
  return s - Math.floor(s)
}

const _mat = new THREE.Matrix4()
const _quat = new THREE.Quaternion()
const _euler = new THREE.Euler()
const _pos = new THREE.Vector3()
const _scl = new THREE.Vector3()
const _v = new THREE.Vector3()
const _c0 = new THREE.Color()
const _c1 = new THREE.Color()
const _cc = new THREE.Color()

/** Clone + displace + transform + paint one part. Build-time only. */
export function bakePart(spec: PartSpec): THREE.BufferGeometry {
  const g = spec.geo.index ? spec.geo.toNonIndexed() : spec.geo.clone()

  if (spec.blob && spec.blob > 0) {
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i)
      const n = (vnoise(_v.x, _v.y, _v.z, spec.seed ?? 0) - 0.5) * 2 * spec.blob
      const len = _v.length()
      if (len > 1e-4) _v.setLength(Math.max(0.02, len + n))
      pos.setXYZ(i, _v.x, _v.y, _v.z)
    }
    g.computeVertexNormals() // chunky facets — the style
  }

  const p = spec.position ?? [0, 0, 0]
  const r = spec.rotation ?? [0, 0, 0]
  const s = spec.scale ?? 1
  _euler.set(r[0], r[1], r[2])
  _quat.setFromEuler(_euler)
  _pos.set(p[0], p[1], p[2])
  if (typeof s === 'number') _scl.setScalar(s)
  else _scl.set(s[0], s[1], s[2])
  _mat.compose(_pos, _quat, _scl)
  g.applyMatrix4(_mat)
  g.normalizeNormals()

  // Paint vertex colors (uniform, or a soft vertical gradient).
  g.computeBoundingBox()
  const bb = g.boundingBox as THREE.Box3
  const span = Math.max(1e-4, bb.max.y - bb.min.y)
  _c0.set(spec.color)
  const hasTop = spec.colorTop !== undefined
  if (hasTop) _c1.set(spec.colorTop as THREE.ColorRepresentation)
  const posAttr = g.attributes.position
  const colors = new Float32Array(posAttr.count * 3)
  for (let i = 0; i < posAttr.count; i++) {
    if (hasTop) {
      let t = (posAttr.getY(i) - bb.min.y) / span
      t = t * t * (3 - 2 * t)
      _cc.copy(_c0).lerp(_c1, t)
    } else {
      _cc.copy(_c0)
    }
    colors[i * 3] = _cc.r
    colors[i * 3 + 1] = _cc.g
    colors[i * 3 + 2] = _cc.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}

/** Bake and merge parts into one vertex-colored geometry (one draw call). */
export function mergeParts(parts: PartSpec[]): THREE.BufferGeometry {
  const baked = parts.map(bakePart)
  const merged = mergeGeometries(baked, false)
  if (!merged) throw new Error('props: mergeGeometries failed (attribute mismatch)')
  merged.computeBoundingSphere()
  return merged
}
