// MODULE A entry — the whole environment: gumdrop island (+ waterfalls,
// grass, rune ring, fireflies riding the island bob), sky dome, sky-sea,
// clouds and the 3-light rig.
//
// NOTE for the integrator: <World/> ships WITHOUT an EffectComposer — add the
// post stack (Bloom / Vignette / HueSaturation) around it at the scene level.

import { useEffect, useRef } from 'react'
import type { JSX } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGameStore, effectiveTimeOfDay } from '../../state/gameStore'
import { updateGlobalUniforms } from '../materials'
import { islandBob, islandRoll } from '../islandMotion'
import { skyHorizonTrack } from './skyColors'
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

// Distance haze matched to the sky's horizon color — the island's far rim
// melts into the sky instead of ending in a hard silhouette (playbook P1).
const worldFog = new THREE.FogExp2('#FDEBD2', 0.0042)

export function World(): JSX.Element {
  const islandRef = useRef<THREE.Group>(null)
  const scene = useThree((s) => s.scene)
  // OrbitControls (module D) registers itself via makeDefault; until then we
  // bend the world around the default camera target.
  const controls = useThree((s) => s.controls) as unknown as { target?: unknown } | null

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- three.js scene graph is imperatively owned
    scene.fog = worldFog
    return () => {
      // eslint-disable-next-line react-hooks/immutability -- see above
      scene.fog = null
    }
  }, [scene])

  useFrame(({ clock }) => {
    const t = effectiveTimeOfDay(useGameStore.getState())
    const pivot =
      controls && controls.target instanceof THREE.Vector3 ? controls.target : FALLBACK_PIVOT
    updateGlobalUniforms(pivot, t)
    skyHorizonTrack(t, worldFog.color)

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
