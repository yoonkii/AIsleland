// Five flat-shaded cloud blobs orbiting the island at r~18, y~+3.5, 90s
// period (docs/GAME_DESIGN.md §3.4). One shared geometry + the shared
// meringue material = 5 cheap draws.

import { useRef } from 'react'
import type { JSX } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { cloudGeometry } from './islandGeometry'
import { meringueVertexMat } from './worldMaterials'

const ORBIT_PERIOD_S = 90

const CLOUDS = [
  { azimuth: 0.4, radius: 17.5, y: 3.6, scale: 1.25, spin: 0.3 },
  { azimuth: 1.55, radius: 20.5, y: 5.1, scale: 0.95, spin: 2.1 },
  { azimuth: 2.75, radius: 18.4, y: 2.9, scale: 1.45, spin: 4.0 },
  { azimuth: 4.2, radius: 21.5, y: 4.4, scale: 1.1, spin: 1.2 },
  { azimuth: 5.35, radius: 19.0, y: 6.0, scale: 0.8, spin: 5.3 },
] as const

export function Clouds(): JSX.Element {
  const orbitRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const orbit = orbitRef.current
    if (orbit) orbit.rotation.y = (clock.elapsedTime * Math.PI * 2) / ORBIT_PERIOD_S
  })

  return (
    <group ref={orbitRef}>
      {CLOUDS.map((c, i) => (
        <mesh
          key={i}
          geometry={cloudGeometry()}
          material={meringueVertexMat}
          position={[Math.sin(c.azimuth) * c.radius, c.y, Math.cos(c.azimuth) * c.radius]}
          scale={c.scale}
          rotation-y={c.spin}
        />
      ))}
    </group>
  )
}
