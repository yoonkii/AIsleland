// Five flat-shaded cloud blobs orbiting the island at r~18, y~+3.5, 90s
// period (docs/GAME_DESIGN.md §3.4). One shared geometry + the shared
// meringue material = 5 cheap draws.

import { useRef } from 'react'
import type { JSX } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGameStore, effectiveTimeOfDay } from '../../state/gameStore'
import { cloudGeometry } from './islandGeometry'
import { nightness } from './skyColors'

const ORBIT_PERIOD_S = 90

// Clouds are UNLIT (VISUAL_PLAYBOOK): lit toon materials turn them into grey
// rocks at dusk. Vertex colors carry the cream underside; the material color
// dims toward a moonlit blue at night. 0.93 base keeps them under the bloom
// threshold.
const cloudMat = new THREE.MeshBasicMaterial({ vertexColors: true })
const cloudDay = new THREE.Color('#EFEDE8').multiplyScalar(0.98)
const cloudNight = new THREE.Color('#6F7BA6')

const CLOUDS = [
  { azimuth: 0.4, radius: 22.5, y: 4.6, scale: 1.35, spin: 0.3 },
  { azimuth: 1.55, radius: 27.5, y: 6.6, scale: 1.0, spin: 2.1 },
  { azimuth: 2.75, radius: 24.4, y: 3.4, scale: 1.55, spin: 4.0 },
  { azimuth: 4.2, radius: 29.5, y: 5.6, scale: 1.2, spin: 1.2 },
  { azimuth: 5.35, radius: 25.0, y: 7.6, scale: 0.85, spin: 5.3 },
  // low clouds drifting BELOW the island sell the altitude (playbook P1)
  { azimuth: 0.9, radius: 20.0, y: -8.5, scale: 1.7, spin: 2.8 },
  { azimuth: 3.6, radius: 24.0, y: -11.0, scale: 1.3, spin: 0.9 },
] as const

export function Clouds(): JSX.Element {
  const orbitRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const orbit = orbitRef.current
    if (orbit) orbit.rotation.y = (clock.elapsedTime * Math.PI * 2) / ORBIT_PERIOD_S
    const night = nightness(effectiveTimeOfDay(useGameStore.getState()))
    cloudMat.color.copy(cloudDay).lerp(cloudNight, night)
  })

  return (
    <group ref={orbitRef}>
      {CLOUDS.map((c, i) => (
        <mesh
          key={i}
          geometry={cloudGeometry()}
          material={cloudMat}
          position={[Math.sin(c.azimuth) * c.radius, c.y, Math.cos(c.azimuth) * c.radius]}
          scale={c.scale}
          rotation-y={c.spin}
        />
      ))}
    </group>
  )
}
