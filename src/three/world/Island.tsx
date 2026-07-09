// The gumdrop island itself: merged top/cliff/underside/roots mesh, three
// orbiting rock chunks below, and the distant mini-island silhouette.

import { useRef } from 'react'
import type { JSX } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { voxelIslandGeometry, voxelRockGeometry } from './voxelIsland'
import { meringueVertexMat } from './worldMaterials'

const ROCKS = [
  { radius: 7.2, phase: 0.0, baseY: -7.6, scale: 0.8 },
  { radius: 9.4, phase: 2.3, baseY: -8.8, scale: 0.5 },
  { radius: 8.2, phase: 4.4, baseY: -8.1, scale: 0.7 },
] as const

const ORBIT_PERIOD_S = 20

export function Island(): JSX.Element {
  const orbitRef = useRef<THREE.Group>(null)
  const rockRefs = useRef<Array<THREE.Mesh | null>>([null, null, null])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const orbit = orbitRef.current
    if (orbit) orbit.rotation.y = (t * Math.PI * 2) / ORBIT_PERIOD_S
    for (let i = 0; i < ROCKS.length; i++) {
      const rock = rockRefs.current[i]
      if (!rock) continue
      rock.position.y = ROCKS[i].baseY + Math.sin(t * 0.3 + ROCKS[i].phase * 2.1) * 0.55
      rock.rotation.x = ROCKS[i].phase + t * 0.05
    }
  })

  return (
    <group>
      <mesh geometry={voxelIslandGeometry()} material={meringueVertexMat} castShadow receiveShadow />

      {/* orbiting rock chunks under the island */}
      <group ref={orbitRef}>
        {ROCKS.map((r, i) => (
          <mesh
            key={i}
            ref={(m) => {
              rockRefs.current[i] = m
            }}
            geometry={voxelRockGeometry()}
            material={meringueVertexMat}
            position={[Math.sin(r.phase) * r.radius, r.baseY, Math.cos(r.phase) * r.radius]}
            scale={[r.scale * 1.3, r.scale * 1.1, r.scale * 1.4]}
            rotation={[0, r.phase * 1.7, 0]}
          />
        ))}
      </group>

      {/* distant mini-island silhouette on the horizon, azimuth +120deg */}
      <mesh
        geometry={voxelIslandGeometry()}
        material={meringueVertexMat}
        position={[Math.sin(2.1) * 55, -6, Math.cos(2.1) * 55]}
        scale={0.4}
        rotation-y={1.2}
      />
    </group>
  )
}
