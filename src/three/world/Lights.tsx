// The exactly-3-lights rig (docs/GAME_DESIGN.md §3.3): key directional (the
// only shadow caster, 1024 map fit to the island), hemisphere, and a fill
// directional opposite the key. Colors/intensities lerp with time of day.

import { useRef } from 'react'
import type { JSX } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGameStore, effectiveTimeOfDay } from '../../state/gameStore'
import { PALETTE } from '../../design/tokens'
import { colorTrack, scalarTrack, sunDirection, moonDirection, daylight } from './skyColors'

// Sunlight tones (no palette token exists for raw light colors; the warm
// day-white is picked to keep PALETTE.grass reading true under the toon ramp).
const keyColorTrack = colorTrack([
  [0.0, PALETTE.rimNight],
  [0.2, PALETTE.rimNight],
  [0.27, PALETTE.skyDuskHorizon],
  [0.38, '#FFF7E8'],
  [0.62, '#FFF7E8'],
  [0.73, PALETTE.skyDuskHorizon],
  [0.8, PALETTE.rimNight],
])
const keyIntensityTrack = scalarTrack([
  [0.0, 0.42],
  [0.2, 0.42],
  [0.27, 1.0],
  [0.38, 1.4],
  [0.62, 1.4],
  [0.73, 1.0],
  [0.8, 0.42],
])

const hemiSkyTrack = colorTrack([
  [0.0, '#2A3B66'],
  [0.2, '#2A3B66'],
  [0.27, '#F5B58C'],
  [0.38, '#BFE3FF'],
  [0.62, '#BFE3FF'],
  [0.73, '#F5B58C'],
  [0.8, '#2A3B66'],
])
const hemiGroundTrack = colorTrack([
  [0.0, '#1A2530'],
  [0.2, '#1A2530'],
  [0.27, '#7C6B8F'],
  [0.38, '#E8C9A0'],
  [0.62, '#E8C9A0'],
  [0.73, '#7C6B8F'],
  [0.8, '#1A2530'],
])
const hemiIntensityTrack = scalarTrack([
  [0.0, 0.35],
  [0.2, 0.35],
  [0.27, 0.5],
  [0.38, 0.55],
  [0.62, 0.55],
  [0.73, 0.5],
  [0.8, 0.35],
])

const fillColorTrack = colorTrack([
  [0.0, PALETTE.skyNightMid],
  [0.2, PALETTE.skyNightMid],
  [0.27, PALETTE.skyDuskTop],
  [0.38, PALETTE.skyDayMid],
  [0.62, PALETTE.skyDayMid],
  [0.73, PALETTE.skyDuskTop],
  [0.8, PALETTE.skyNightMid],
])
const fillIntensityTrack = scalarTrack([
  [0.0, 0.12],
  [0.2, 0.12],
  [0.27, 0.2],
  [0.38, 0.25],
  [0.62, 0.25],
  [0.73, 0.2],
  [0.8, 0.12],
])

const sunScratch = new THREE.Vector3()
const moonScratch = new THREE.Vector3()
const keyDirScratch = new THREE.Vector3()

export function Lights(): JSX.Element {
  const keyRef = useRef<THREE.DirectionalLight>(null)
  const fillRef = useRef<THREE.DirectionalLight>(null)
  const hemiRef = useRef<THREE.HemisphereLight>(null)

  useFrame(() => {
    const t = effectiveTimeOfDay(useGameStore.getState())
    const day = daylight(t)
    const night = 1 - day

    // key follows the sun by day and hands off to the moon at night;
    // blended + elevation-clamped so twilight never flips the shadows hard
    sunDirection(t, sunScratch)
    moonDirection(t, moonScratch)
    keyDirScratch.copy(sunScratch).multiplyScalar(day).addScaledVector(moonScratch, night)
    if (keyDirScratch.lengthSq() < 0.01) keyDirScratch.set(0.4, 0.6, -0.3)
    keyDirScratch.y = Math.max(keyDirScratch.y, 0.28)
    keyDirScratch.normalize()

    const key = keyRef.current
    if (key) {
      key.position.copy(keyDirScratch).multiplyScalar(30)
      keyColorTrack(t, key.color)
      key.intensity = keyIntensityTrack(t)
    }
    const fill = fillRef.current
    if (fill) {
      fill.position.set(-keyDirScratch.x * 26, 12, -keyDirScratch.z * 26)
      fillColorTrack(t, fill.color)
      fill.intensity = fillIntensityTrack(t)
    }
    const hemi = hemiRef.current
    if (hemi) {
      hemiSkyTrack(t, hemi.color)
      hemiGroundTrack(t, hemi.groundColor)
      hemi.intensity = hemiIntensityTrack(t)
    }
  })

  return (
    <>
      <directionalLight
        ref={keyRef}
        position={[14, 24, -10]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-camera-near={8}
        shadow-camera-far={62}
        shadow-radius={4}
        shadow-normalBias={0.05}
      />
      <hemisphereLight ref={hemiRef} args={['#BFE3FF', '#E8C9A0', 0.55]} />
      <directionalLight ref={fillRef} position={[-14, 12, 10]} intensity={0.25} />
    </>
  )
}
