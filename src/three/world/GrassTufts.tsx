// Instanced grass tufts scattered over the meadow (never inside the
// buildable clearing). One InstancedMesh + the shared meringue material.

import { useLayoutEffect, useMemo, useRef } from 'react'
import type { JSX } from 'react'
import * as THREE from 'three'
import { tuftGeometry, scatterTufts, mulberry32 } from './islandGeometry'
import { meringueVertexMat } from './worldMaterials'

const TUFT_COUNT = 380

const dummy = new THREE.Object3D()
const tint = new THREE.Color()

export function GrassTufts(): JSX.Element {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const spots = useMemo(() => scatterTufts(TUFT_COUNT), [])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const rng = mulberry32(0x9a55)
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i]
      dummy.position.set(s.x, s.y, s.z)
      dummy.rotation.set(0, s.rot, 0)
      dummy.scale.setScalar(s.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      // subtle per-tuft hue variance so the meadow doesn't tile
      tint.setScalar(0.9 + rng() * 0.1)
      tint.g += rng() * 0.05
      mesh.setColorAt(i, tint)
    }
    mesh.count = spots.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [spots])

  return (
    <instancedMesh
      ref={meshRef}
      args={[tuftGeometry(), meringueVertexMat, TUFT_COUNT]}
      receiveShadow
      frustumCulled={false}
    />
  )
}
