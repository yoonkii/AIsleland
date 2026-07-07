// MODULE A entry — the whole environment: gumdrop island (+ waterfalls,
// grass, rune ring, fireflies riding the island bob), sky dome, sky-sea,
// clouds and the 3-light rig.
//
// NOTE for the integrator: <World/> ships WITHOUT an EffectComposer — add the
// post stack (Bloom / Vignette / HueSaturation) around it at the scene level.

import { useRef } from 'react'
import type { JSX } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGameStore, effectiveTimeOfDay } from '../../state/gameStore'
import { updateGlobalUniforms } from '../materials'
import { islandBob, islandRoll } from '../islandMotion'
import { Island } from './Island'
import { Waterfalls } from './Waterfalls'
import { SkySea } from './SkySea'
import { Sky } from './Sky'
import { Clouds } from './Clouds'
import { Lights } from './Lights'
import { Fireflies } from './Fireflies'
import { GrassTufts } from './GrassTufts'
import { RuneRing } from './RuneRing'

const FALLBACK_PIVOT = new THREE.Vector3(0, 1.2, 0)

export function World(): JSX.Element {
  const islandRef = useRef<THREE.Group>(null)
  // OrbitControls (module D) registers itself via makeDefault; until then we
  // bend the world around the default camera target.
  const controls = useThree((s) => s.controls) as unknown as { target?: unknown } | null

  useFrame(({ clock }) => {
    const t = effectiveTimeOfDay(useGameStore.getState())
    const pivot =
      controls && controls.target instanceof THREE.Vector3 ? controls.target : FALLBACK_PIVOT
    updateGlobalUniforms(pivot, t)

    const island = islandRef.current
    if (island) {
      island.position.y = islandBob(clock.elapsedTime)
      island.rotation.z = islandRoll(clock.elapsedTime)
    }
  })

  return (
    <group>
      <Lights />
      <Sky />
      <SkySea />
      <Clouds />

      {/* everything below rides the island bob/roll */}
      <group ref={islandRef}>
        <Island />
        <Waterfalls />
        <GrassTufts />
        <RuneRing />
        <Fireflies />
      </group>
    </group>
  )
}
