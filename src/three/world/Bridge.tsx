// A cozy arched plank bridge over the creek (Animal Crossing staple).
// Static merged geometry, drawn with the shared meringue material.

import { useMemo } from 'react'
import type { JSX } from 'react'
import * as THREE from 'three'
import { mergeParts, type PartSpec } from '../props/geometry'
import { makeMeringue } from '../materials'
import { SURFACE_Y, WATERFALL_AZIMUTHS } from '../coords'

const WOOD = '#C08A5E'
const WOOD_TOP = '#DFB183'
const bridgeMat = makeMeringue({ vertexColors: true })

function box(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d)
}

function bridgeGeometry(): THREE.BufferGeometry {
  const parts: PartSpec[] = []
  const SPAN = 3.0 // crossing direction (local x)
  const STEPS = 7
  for (let i = 0; i < STEPS; i++) {
    const t = (i / (STEPS - 1)) * 2 - 1 // -1..1 across the stream
    const y = 0.34 + Math.cos(t * Math.PI * 0.42) * 0.3
    parts.push({
      geo: box(SPAN / STEPS + 0.06, 0.09, 0.5),
      color: WOOD,
      colorTop: WOOD_TOP,
      position: [t * (SPAN / 2 - 0.2), y, 0],
      rotation: [0, 0, -Math.sin(t * Math.PI * 0.42) * 0.42],
    })
  }
  // rails: posts at both ends of both sides + a sloped top rail
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      parts.push({
        geo: box(0.09, 0.5, 0.09),
        color: WOOD,
        colorTop: WOOD_TOP,
        position: [end * (SPAN / 2 - 0.16), 0.52, side * 0.26],
      })
    }
    parts.push({
      geo: box(SPAN - 0.2, 0.07, 0.07),
      color: WOOD,
      colorTop: WOOD_TOP,
      position: [0, 0.86, side * 0.26],
    })
  }
  return mergeParts(parts)
}

export function Bridge(): JSX.Element {
  const geo = useMemo(() => bridgeGeometry(), [])
  // cross the second channel (the one without the pond), just past the clearing
  const a = WATERFALL_AZIMUTHS[1]
  const r = 7.6
  return (
    <mesh
      geometry={geo}
      material={bridgeMat}
      position={[Math.sin(a) * r, SURFACE_Y - 0.06, Math.cos(a) * r]}
      rotation-y={a}
      castShadow
      receiveShadow
    />
  )
}
